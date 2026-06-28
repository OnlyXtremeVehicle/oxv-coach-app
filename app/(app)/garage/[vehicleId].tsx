/**
 * Garage — fiche véhicule : journal de réglages (historique + ajout) (M3).
 *
 * Pressions en bar. Doctrine : on consigne des faits matériels, aucun jugement
 * sur les réglages (miroir). Sobre, vouvoiement, pas d'emoji.
 */

import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  type Vehicle,
  type VehicleSetup,
  addSetup,
  getVehicle,
  listSetups,
} from '@/services/garageService';
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
    Promise.all([getVehicle(vehicleId), listSetups(vehicleId)]).then(([v, sp]) => {
      if (!cancelled) {
        setVehicle(v);
        setSetups(sp);
        setLoading(false);
      }
    });
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

  const name = vehicle
    ? [vehicle.brand, vehicle.model].filter(Boolean).join(' ').trim() || 'Véhicule'
    : '';

  return (
    <Screen>
      <AppBar title="VÉHICULE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
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
};
