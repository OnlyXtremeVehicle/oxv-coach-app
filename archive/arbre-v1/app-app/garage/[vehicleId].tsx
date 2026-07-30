/**
 * Garage — fiche véhicule : photos réelles + journal de réglages (M3).
 *
 * Photos (retour fondateur build 23 : « relier les véhicules et les photos ») :
 * médias rattachés au véhicule via `users.media` (jsonb `vehicleId`, zéro
 * schéma), bucket privé `pilot-media` → URLs signées. Grille réelle, ajout et
 * retrait réels — jamais d'image factice : sans photo, la section reste vide.
 * Pressions en bar. Doctrine : on consigne des faits matériels, aucun jugement
 * sur les réglages (miroir). Sobre, vouvoiement, pas d'emoji.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';

import { FadeInSection } from '@/components/motion';
import {
  type Vehicle,
  type VehicleSetup,
  addSetup,
  getVehicle,
  listSetups,
} from '@/services/garageService';
import {
  type PilotMediaView,
  addMyPilotMedia,
  listMyVehicleMedia,
  removeMyPilotMedia,
} from '@/services/pilotMediaService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

function parseBar(v: string): number | null {
  const t = v.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function fmtBar(v: number | null): string {
  return v != null ? `${v.toFixed(1).replace('.', ',')} bar` : '—';
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function VehicleDetailScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [setups, setSetups] = useState<VehicleSetup[]>([]);
  const [media, setMedia] = useState<PilotMediaView[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [tires, setTires] = useState('');
  const [brakes, setBrakes] = useState('');
  const [pfs, setPfs] = useState('');
  const [prs, setPrs] = useState('');
  const [pfe, setPfe] = useState('');
  const [pre, setPre] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    if (!vehicleId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getVehicle(vehicleId), listSetups(vehicleId), listMyVehicleMedia(vehicleId)]).then(
      ([v, sp, m]) => {
        if (!cancelled) {
          setVehicle(v);
          setSetups(sp);
          setMedia(m);
          setLoading(false);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  useFocusEffect(reload);

  async function onAdd() {
    if (!vehicleId || saving) return;
    setSaving(true);
    const res = await addSetup(vehicleId, {
      tires: tires || undefined,
      brakes: brakes || undefined,
      pressureFrontStart: parseBar(pfs),
      pressureRearStart: parseBar(prs),
      pressureFrontEnd: parseBar(pfe),
      pressureRearEnd: parseBar(pre),
      notes: notes || undefined,
    });
    setSaving(false);
    if (res.ok) {
      setComposing(false);
      setTires('');
      setBrakes('');
      setPfs('');
      setPrs('');
      setPfe('');
      setPre('');
      setNotes('');
      reload();
    }
  }

  async function onAddPhoto() {
    if (!vehicleId || mediaBusy) return;
    setMediaBusy(true);
    const res = await addMyPilotMedia('photo', { vehicleId });
    setMediaBusy(false);
    if (res.ok) {
      setMedia(res.items);
      Toast.show({ type: 'success', text1: 'Photo ajoutée.' });
    } else if (!('cancelled' in res)) {
      Toast.show({ type: 'error', text1: res.error });
    }
  }

  function onRemovePhoto(mediaId: string) {
    Alert.alert('Retirer cette photo ?', 'Elle sera retirée du véhicule et supprimée.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: () => {
          void removeMyPilotMedia(mediaId).then((res) => {
            if (res.ok) setMedia(res.items);
            else Toast.show({ type: 'error', text1: res.error });
          });
        },
      },
    ]);
  }

  const name = vehicle
    ? [vehicle.brand, vehicle.model].filter(Boolean).join(' ').trim() || 'Véhicule'
    : '';

  return (
    <Screen>
      <AppBar title="VÉHICULE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        {loading || !vehicle ? (
          <Text style={s.muted}>{loading ? 'Chargement…' : 'Véhicule introuvable.'}</Text>
        ) : (
          <>
            <Text style={s.name} accessibilityRole="header">
              {name}
            </Text>
            <Text style={s.meta}>
              {[vehicle.year, vehicle.color].filter(Boolean).join(' · ') || '—'}
            </Text>

            {/* ── Photos réelles du véhicule (jsonb vehicleId, URLs signées). ── */}
            <FadeInSection style={{ marginTop: theme.spacing.xl }}>
              <SectionLabel>{`Photos (${media.length})`}</SectionLabel>
              {media.length === 0 ? (
                <Text style={s.photoEmpty}>Aucune photo pour l&apos;instant.</Text>
              ) : (
                <View style={s.photoGrid}>
                  {media.map((m) => (
                    <View key={m.id} style={s.photoTile}>
                      {m.type === 'photo' && m.signedUrl ? (
                        <Image
                          source={{ uri: m.signedUrl }}
                          style={s.photoImg}
                          resizeMode="cover"
                          accessibilityLabel={`Photo de ${name}`}
                        />
                      ) : (
                        <View style={[s.photoImg, s.photoCenter]}>
                          <Text style={s.photoFallbackT}>
                            {m.type === 'video' ? 'Vidéo' : 'Photo'}
                          </Text>
                        </View>
                      )}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Retirer cette photo"
                        hitSlop={6}
                        onPress={() => onRemovePhoto(m.id)}
                        style={s.photoRemove}
                      >
                        <Text style={s.photoRemoveT}>Retirer</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
              <View style={s.photoActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ajouter une photo"
                  disabled={mediaBusy}
                  onPress={onAddPhoto}
                  style={[s.photoBtn, mediaBusy ? { opacity: 0.5 } : null]}
                >
                  <Text style={s.photoBtnT}>Ajouter une photo</Text>
                </Pressable>
                {mediaBusy ? (
                  <ActivityIndicator
                    color={theme.palette.creamMute}
                    accessibilityLabel="Envoi de la photo en cours"
                  />
                ) : null}
              </View>
              <Text style={s.photoHint}>Visibles par vous et votre coach affilié.</Text>
            </FadeInSection>

            <FadeInSection delay={80}>
              {!composing ? (
                <View style={{ marginTop: theme.spacing.lg }}>
                  <Button label="Consigner un réglage" onPress={() => setComposing(true)} />
                </View>
              ) : (
                <Card style={{ marginTop: theme.spacing.lg, gap: theme.spacing.md }}>
                  <SectionLabel>Nouveau réglage</SectionLabel>
                  <Field label="Pneus" optional value={tires} onChangeText={setTires} />
                  <Field label="Freins" optional value={brakes} onChangeText={setBrakes} />
                  <View style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Pression AV départ (bar)"
                        optional
                        value={pfs}
                        onChangeText={setPfs}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Pression AR départ (bar)"
                        optional
                        value={prs}
                        onChangeText={setPrs}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  <View style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Pression AV retour (bar)"
                        optional
                        value={pfe}
                        onChangeText={setPfe}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Pression AR retour (bar)"
                        optional
                        value={pre}
                        onChangeText={setPre}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  <Field
                    label="Notes"
                    optional
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    maxLength={1000}
                  />
                  <Button label="Enregistrer le réglage" onPress={onAdd} loading={saving} />
                  <Button label="Annuler" variant="ghost" onPress={() => setComposing(false)} />
                </Card>
              )}
            </FadeInSection>

            <FadeInSection delay={160}>
              <View style={{ marginTop: theme.spacing.xxl, gap: theme.spacing.sm }}>
                <SectionLabel>{`Historique (${setups.length})`}</SectionLabel>
                {setups.length === 0 ? (
                  <Text style={s.muted}>Aucun réglage consigné.</Text>
                ) : (
                  setups.map((sp) => (
                    <Card key={sp.id} style={{ gap: theme.spacing.xs }}>
                      <Text style={s.date}>{fmtDate(sp.recordedAt)}</Text>
                      {sp.tires ? <Text style={s.line}>Pneus : {sp.tires}</Text> : null}
                      {sp.brakes ? <Text style={s.line}>Freins : {sp.brakes}</Text> : null}
                      <Text style={s.line}>
                        Départ AV/AR : {fmtBar(sp.pressureFrontStart)} /{' '}
                        {fmtBar(sp.pressureRearStart)}
                      </Text>
                      <Text style={s.line}>
                        Retour AV/AR : {fmtBar(sp.pressureFrontEnd)} / {fmtBar(sp.pressureRearEnd)}
                      </Text>
                      {sp.notes ? <Text style={s.note}>{sp.notes}</Text> : null}
                    </Card>
                  ))
                )}
              </View>
            </FadeInSection>
          </>
        )}
      </View>
    </Screen>
  );
}

const s = {
  name: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.sm,
  },
  meta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  row: {
    flexDirection: 'row' as const,
    gap: theme.spacing.md,
  },
  date: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  line: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.cream,
  },
  note: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
    lineHeight: theme.fontSize.small * 1.4,
  },
  muted: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
  },

  /* Photos du véhicule — grille 3 colonnes, tuiles réelles signées. */
  photoEmpty: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.faint,
    marginTop: theme.spacing.md,
  },
  photoGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  photoTile: {
    width: '31.5%' as const,
  },
  photoImg: {
    width: '100%' as const,
    aspectRatio: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  photoCenter: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  photoFallbackT: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  photoRemove: {
    minHeight: 32,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginTop: theme.spacing.xs,
  },
  photoRemoveT: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  photoActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  photoBtn: {
    minHeight: 44,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.edge,
  },
  photoBtnT: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.3,
    color: theme.palette.cream,
  },
  photoHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    lineHeight: theme.fontSize.small * 1.5,
    color: theme.palette.eyebrow,
    marginTop: theme.spacing.md,
  },
};
