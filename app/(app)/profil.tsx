/**
 * Écran Pilote — Mon profil (niveau, expérience, licence, véhicule, réseaux).
 *
 * Le pilote édite sa propre ligne `users` (RLS self-update) et ses médias
 * (bucket privé `pilot-media`, URLs signées). C'est ce que son coach affilié
 * voit. Doctrine : sobre, vouvoiement, factuel ; le vocabulaire de niveau est
 * figé (« Apprivoisé » pour intermédiaire).
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import {
  PILOT_LEVELS,
  getMyPilotProfile,
  updateMyPilotProfile,
} from '@/services/pilotProfileService';
import {
  addMyPilotMedia,
  type PilotMediaType,
  type PilotMediaView,
  listMyPilotMedia,
  removeMyPilotMedia,
} from '@/services/pilotMediaService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

export default function PilotProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [level, setLevel] = useState<string | null>(null);
  const [experience, setExperience] = useState('');
  const [ffsa, setFfsa] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [media, setMedia] = useState<PilotMediaView[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      listMyPilotMedia().then((m) => {
        if (!cancelled) setMedia(m);
      });
      getMyPilotProfile()
        .then((p) => {
          if (cancelled) return;
          setLevel(p.pilotLevel);
          setExperience(p.experienceYears ?? '');
          setFfsa(p.ffsaLicense ?? '');
          setVehicle(p.vehicle ?? '');
          setWebsite(p.socials.website ?? '');
          setInstagram(p.socials.instagram ?? '');
          setYoutube(p.socials.youtube ?? '');
          setLoading(false);
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  async function onSave() {
    setSaving(true);
    const res = await updateMyPilotProfile({
      pilotLevel: level,
      experienceYears: experience,
      ffsaLicense: ffsa,
      vehicle,
      socials: { website, instagram, youtube },
    });
    setSaving(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: res.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Profil enregistré.' });
  }

  async function onAddMedia(type: PilotMediaType) {
    setMediaBusy(true);
    const res = await addMyPilotMedia(type);
    setMediaBusy(false);
    if (res.ok) {
      setMedia(res.items);
      Toast.show({
        type: 'success',
        text1: type === 'video' ? 'Vidéo ajoutée.' : 'Photo ajoutée.',
      });
    } else if (!('cancelled' in res)) {
      Toast.show({ type: 'error', text1: res.error });
    }
  }

  async function onRemoveMedia(id: string) {
    const res = await removeMyPilotMedia(id);
    if (res.ok) {
      setMedia(res.items);
    } else {
      Toast.show({ type: 'error', text1: res.error });
    }
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="MON PROFIL" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="MON PROFIL" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title} accessibilityRole="header">
          Votre profil pilote.
        </Text>
        <Text style={s.intro}>
          Ce que votre coach voit de vous : vos repères, votre véhicule, vos réseaux.
        </Text>

        <View style={s.block}>
          <SectionLabel>Niveau</SectionLabel>
          <View style={s.row}>
            {PILOT_LEVELS.map((l) => {
              const on = level === l.value;
              return (
                <Pressable
                  key={l.value}
                  onPress={() => setLevel(l.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={l.label}
                  hitSlop={6}
                  style={[s.pill, on ? s.pillOn : null]}
                >
                  <Text style={[s.pillT, on ? s.pillTOn : null]}>{l.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ marginTop: theme.spacing.xl }}>
          <Field
            label="Années d'expérience"
            optional
            value={experience}
            onChangeText={setExperience}
            placeholder="ex. 5 ans, débuts en 2019…"
          />
          <Field
            label="Licence FFSA"
            optional
            value={ffsa}
            onChangeText={setFfsa}
            placeholder="Numéro de licence"
          />
          <Field
            label="Véhicule"
            optional
            value={vehicle}
            onChangeText={setVehicle}
            placeholder="Marque, modèle, préparation…"
            multiline
            maxLength={200}
          />
        </View>

        <View style={{ marginTop: theme.spacing.lg }}>
          <SectionLabel>Réseaux</SectionLabel>
          <View style={{ marginTop: theme.spacing.md }}>
            <Field
              label="Site web"
              optional
              value={website}
              onChangeText={setWebsite}
              placeholder="https://…"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Field
              label="Instagram"
              optional
              value={instagram}
              onChangeText={setInstagram}
              placeholder="https://instagram.com/…"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Field
              label="YouTube"
              optional
              value={youtube}
              onChangeText={setYoutube}
              placeholder="https://youtube.com/…"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>
        </View>

        <View style={{ marginTop: theme.spacing.xl }}>
          <SectionLabel>Médias</SectionLabel>
          <Text style={s.mediaHint}>
            Photos et vidéos de votre profil, visibles par votre coach.
          </Text>

          {media.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: theme.spacing.md }}
              contentContainerStyle={{ gap: theme.spacing.sm }}
            >
              {media.map((m) => (
                <View key={m.id} style={s.mediaTile}>
                  {m.type === 'photo' && m.signedUrl ? (
                    <Image
                      source={{ uri: m.signedUrl }}
                      style={s.mediaThumb}
                      resizeMode="cover"
                      accessibilityLabel="Photo du profil"
                    />
                  ) : (
                    <View style={[s.mediaThumb, s.mediaCenter]}>
                      <Text style={s.mediaTileT}>{m.type === 'video' ? 'Vidéo' : 'Photo'}</Text>
                    </View>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retirer ce média"
                    hitSlop={6}
                    onPress={() => onRemoveMedia(m.id)}
                    style={s.mediaRemove}
                  >
                    <Text style={s.mediaRemoveT}>Retirer</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={s.mediaEmpty}>Aucun média pour l&apos;instant.</Text>
          )}

          <View style={s.mediaActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ajouter une photo"
              disabled={mediaBusy}
              onPress={() => onAddMedia('photo')}
              style={[s.mediaBtn, mediaBusy ? { opacity: 0.5 } : null]}
            >
              <Text style={s.mediaBtnT}>Ajouter une photo</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ajouter une vidéo"
              disabled={mediaBusy}
              onPress={() => onAddMedia('video')}
              style={[s.mediaBtn, mediaBusy ? { opacity: 0.5 } : null]}
            >
              <Text style={s.mediaBtnT}>Ajouter une vidéo</Text>
            </Pressable>
          </View>

          {mediaBusy ? (
            <ActivityIndicator
              color={theme.palette.creamMute}
              style={{ marginTop: theme.spacing.md }}
              accessibilityLabel="Envoi du média en cours"
            />
          ) : null}
        </View>

        <View style={{ marginTop: theme.spacing.xl }}>
          <Button label="Enregistrer mon profil" loading={saving} onPress={onSave} />
        </View>
      </View>
    </Screen>
  );
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
  },
  intro: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  block: { gap: theme.spacing.md },
  row: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: theme.spacing.sm },
  pill: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    minHeight: 44,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  pillOn: { borderColor: theme.palette.gold, backgroundColor: 'rgba(255,183,3,0.10)' },
  pillT: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
  },
  pillTOn: { color: theme.palette.cream },
  mediaHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: theme.spacing.xs,
  },
  mediaEmpty: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.faint,
    marginTop: theme.spacing.md,
  },
  mediaTile: { width: 120 },
  mediaThumb: {
    width: 120,
    height: 120,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  mediaCenter: { alignItems: 'center' as const, justifyContent: 'center' as const },
  mediaTileT: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  mediaRemove: {
    minHeight: 36,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginTop: theme.spacing.xs,
  },
  mediaRemoveT: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  mediaActions: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  mediaBtn: {
    minHeight: 44,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.gold,
  },
  mediaBtnT: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.3,
    color: theme.palette.gold,
  },
};
