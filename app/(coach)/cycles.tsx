/**
 * Espace Coach — Programmes adaptatifs (C-2, V1.5). Liste + création.
 *
 * Un programme = un cycle qualitatif que LE COACH authore pour un pilote (niveau
 * 'programme' requis) et fait évoluer. L'app ne génère ni n'adapte rien. Sobre,
 * vouvoiement, pas d'emoji. Pas de score chiffré.
 */

import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';

import { type CoachPilotRow, listMyPilots } from '@/services/coachService';
import {
  type DevelopmentCycle,
  createCycle,
  listMyCycles,
} from '@/services/developmentCycleService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

export default function CoachCyclesScreen() {
  const [pilots, setPilots] = useState<CoachPilotRow[]>([]);
  const [pilotId, setPilotId] = useState<string | null>(null);
  const [cycles, setCycles] = useState<DevelopmentCycle[]>([]);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [intention, setIntention] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMyPilots().then((rows) => {
      if (!cancelled) setPilots(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pilotId) {
      setCycles([]);
      return;
    }
    let cancelled = false;
    listMyCycles(pilotId).then((rows) => {
      if (!cancelled) setCycles(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [pilotId]);

  async function reloadCycles() {
    if (!pilotId) return;
    setCycles(await listMyCycles(pilotId));
  }

  async function onCreate() {
    if (!pilotId || saving || !title.trim()) return;
    setSaving(true);
    setError(null);
    const res = await createCycle({ pilotId, title, intention: intention || undefined });
    setSaving(false);
    if (res.ok) {
      setComposing(false);
      setTitle('');
      setIntention('');
      reloadCycles();
    } else {
      setError(
        res.error?.includes('row-level') || res.error?.includes('policy')
          ? 'Ce pilote ne vous a pas accordé le niveau « programme ».'
          : (res.error ?? 'Création impossible.')
      );
    }
  }

  const pilotName = (p: CoachPilotRow) =>
    [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Pilote';

  return (
    <Screen>
      <AppBar title="PROGRAMMES" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>CYCLES DE PROGRESSION</Text>
        <Text style={s.title} accessibilityRole="header">
          Vos programmes.
        </Text>
        <Text style={s.intro}>
          Un cycle qualitatif que vous façonnez dans le temps. L&apos;app conserve et affiche —
          c&apos;est vous qui l&apos;ajustez.
        </Text>

        <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
          <SectionLabel>Pilote</SectionLabel>
          {pilots.length === 0 ? (
            <Text style={s.muted}>Aucun pilote suivi consentant.</Text>
          ) : (
            pilots.map((p) => (
              <Card
                key={p.pilotId}
                onPress={() => {
                  setPilotId(p.pilotId);
                  setComposing(false);
                  setError(null);
                }}
                accessibilityLabel={pilotName(p)}
                style={
                  pilotId === p.pilotId
                    ? { borderColor: theme.palette.coach, borderWidth: 1.5 }
                    : undefined
                }
              >
                <Text style={s.rowLabel}>{pilotName(p)}</Text>
              </Card>
            ))
          )}
        </View>

        {pilotId ? (
          <>
            {!composing ? (
              <View style={{ marginTop: theme.spacing.xl }}>
                <Button label="Créer un programme" onPress={() => setComposing(true)} />
              </View>
            ) : (
              <Card style={{ marginTop: theme.spacing.xl, gap: theme.spacing.md }}>
                <SectionLabel>Nouveau programme</SectionLabel>
                <Field
                  label="Titre"
                  value={title}
                  onChangeText={setTitle}
                  maxLength={120}
                  helper="Une intention, pas un ordre."
                />
                <Field
                  label="Intention"
                  optional
                  value={intention}
                  onChangeText={setIntention}
                  multiline
                  maxLength={1000}
                />
                {error ? (
                  <Text style={s.error} accessibilityLiveRegion="polite">
                    {error}
                  </Text>
                ) : null}
                <Button
                  label="Créer"
                  onPress={onCreate}
                  loading={saving}
                  disabled={!title.trim()}
                />
                <Button label="Annuler" variant="ghost" onPress={() => setComposing(false)} />
              </Card>
            )}

            <View style={{ marginTop: theme.spacing.xxl, gap: theme.spacing.sm }}>
              <SectionLabel>{`Programmes (${cycles.length})`}</SectionLabel>
              {cycles.length === 0 ? (
                <Text style={s.muted}>Aucun programme pour ce pilote.</Text>
              ) : (
                cycles.map((c) => (
                  <Card
                    key={c.id}
                    onPress={() => router.push(`/(coach)/cycles/${c.id}` as never)}
                    accessibilityLabel={c.title}
                    style={{ borderColor: theme.palette.coach }}
                  >
                    <Text style={s.rowLabel}>{c.title}</Text>
                    <Text style={s.muted}>
                      {c.status === 'closed' ? 'Clôturé' : 'Actif'}
                      {c.isShared ? ' · Partagé' : ' · Privé'}
                    </Text>
                  </Card>
                ))
              )}
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.coach,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.md,
  },
  intro: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginTop: theme.spacing.md,
  },
  rowLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  muted: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  error: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.red,
  },
};
