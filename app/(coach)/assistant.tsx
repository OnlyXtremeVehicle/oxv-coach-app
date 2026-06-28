/**
 * Espace Coach — Assistant IA (C-1).
 *
 * L'IA PRÉ-RÉDIGE une observation descriptive sur un virage ; le coach la relit,
 * l'édite, puis la VALIDE (vers le pilote) ou la rejette. Rien n'atteint le pilote
 * sans cette validation. Le filtrage doctrinal est côté serveur (edge) — l'écran
 * reste utilisable si l'IA est indisponible.
 *
 * Doctrine : l'IA propose, le coach décide. Vouvoiement, pas d'emoji.
 */

import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  type CoachPilotRow,
  type PilotSessionSummary,
  listMyPilots,
  listPilotSessions,
} from '@/services/coachService';
import { requestDraft, validateDraft } from '@/services/coachAiService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateLong } from '@/utils/format';

const CORNERS = [1, 2, 3, 4, 5, 6, 7];

function errorLabel(code: string | undefined): string {
  switch (code) {
    case 'coach_ai_not_allowed':
      return "Ce pilote n'a pas activé l'assistant IA, ou vous n'avez pas l'accès détaillé consenti.";
    case 'doctrine_violation':
      return "La proposition n'était pas conforme à la doctrine. Réessayez ou rédigez votre note.";
    case 'segment_not_found':
      return 'Ce virage n’a pas de données analysées sur cette séance.';
    case 'openai_error':
    case 'openai_empty_response':
      return 'L’IA est momentanément indisponible. Vous pouvez rédiger votre note manuellement.';
    default:
      return 'La proposition a échoué. Réessayez plus tard.';
  }
}

export default function CoachAssistantScreen() {
  const [pilots, setPilots] = useState<CoachPilotRow[]>([]);
  const [pilotId, setPilotId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<PilotSessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [corner, setCorner] = useState<number>(1);

  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Brouillon actif en relecture.
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'shared'>('shared');
  const [validating, setValidating] = useState(false);

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
      setSessions([]);
      setSessionId(null);
      return;
    }
    let cancelled = false;
    listPilotSessions(pilotId).then((rows) => {
      if (!cancelled) {
        setSessions(rows);
        setSessionId(rows[0]?.id ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pilotId]);

  function resetDraft() {
    setDraftId(null);
    setDraftText('');
    setVisibility('shared');
  }

  async function onPropose() {
    if (!pilotId || !sessionId || requesting) return;
    setRequesting(true);
    setError(null);
    resetDraft();
    const res = await requestDraft({ pilotId, sessionId, cornerIndex: corner });
    setRequesting(false);
    if (res.ok && res.draftId && res.text) {
      setDraftId(res.draftId);
      setDraftText(res.text);
    } else {
      setError(errorLabel(res.error));
    }
  }

  async function onValidate() {
    if (!draftId || validating || !draftText.trim()) return;
    setValidating(true);
    const res = await validateDraft({ draftId, editedText: draftText, visibility });
    setValidating(false);
    if (res.ok) {
      Alert.alert(
        'Observation enregistrée',
        visibility === 'shared'
          ? 'Votre observation est visible par le pilote sur le virage.'
          : 'Votre note de travail est enregistrée (non visible du pilote).'
      );
      resetDraft();
    } else {
      setError(errorLabel(res.error));
    }
  }

  function onDiscard() {
    // Rejet local : on abandonne la relecture (le brouillon reste 'draft' en base,
    // ré-éditable plus tard). Pas d'envoi au pilote.
    resetDraft();
    setError(null);
  }

  const pilotName = (p: CoachPilotRow) =>
    [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Pilote';

  return (
    <Screen>
      <AppBar title="ASSISTANT IA" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>AIDE À LA RÉDACTION</Text>
        <Text style={s.title} accessibilityRole="header">
          Pré-rédiger une observation.
        </Text>
        <Text style={s.intro}>
          L&apos;IA propose un constat factuel. Vous le relisez, l&apos;éditez, puis vous décidez.
          Rien n&apos;atteint le pilote sans votre validation.
        </Text>

        {/* 1. Pilote */}
        <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
          <SectionLabel>Pilote</SectionLabel>
          {pilots.length === 0 ? (
            <Text style={s.muted}>Aucun pilote suivi consentant pour le moment.</Text>
          ) : (
            pilots.map((p) => (
              <Card
                key={p.pilotId}
                onPress={() => {
                  setPilotId(p.pilotId);
                  resetDraft();
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

        {/* 2. Séance */}
        {pilotId ? (
          <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
            <SectionLabel>Séance</SectionLabel>
            {sessions.length === 0 ? (
              <Text style={s.muted}>Aucune séance analysée pour ce pilote.</Text>
            ) : (
              sessions.slice(0, 6).map((sess) => (
                <Card
                  key={sess.id}
                  onPress={() => {
                    setSessionId(sess.id);
                    resetDraft();
                    setError(null);
                  }}
                  accessibilityLabel={`${formatDateLong(sess.startedAt)}, ${sess.circuitName ?? 'circuit'}`}
                  style={
                    sessionId === sess.id
                      ? { borderColor: theme.palette.coach, borderWidth: 1.5 }
                      : undefined
                  }
                >
                  <Text style={s.rowLabel}>{formatDateLong(sess.startedAt)}</Text>
                  <Text style={s.muted}>{sess.circuitName ?? 'Circuit'}</Text>
                </Card>
              ))
            )}
          </View>
        ) : null}

        {/* 3. Virage + proposer */}
        {pilotId && sessionId ? (
          <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.md }}>
            <SectionLabel>Virage</SectionLabel>
            <Segmented
              options={CORNERS.map(String)}
              value={String(corner)}
              onChange={(v) => setCorner(Number(v))}
            />
            <Button label="Proposer une observation" onPress={onPropose} loading={requesting} />
          </View>
        ) : null}

        {error ? (
          <Text style={s.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        {/* 4. Relecture / validation */}
        {draftId ? (
          <Card style={{ marginTop: theme.spacing.xl, gap: theme.spacing.md }}>
            <View style={s.badgeRow}>
              <View style={s.badgeDot} />
              <Text style={s.badge}>Suggestion IA — à relire</Text>
            </View>
            <Field
              label="Observation (éditable)"
              value={draftText}
              onChangeText={setDraftText}
              multiline
              maxLength={1000}
              showCounter
            />
            <SectionLabel>Visibilité</SectionLabel>
            <Segmented
              options={['Note de travail', 'Partagée au pilote']}
              value={visibility === 'shared' ? 'Partagée au pilote' : 'Note de travail'}
              onChange={(v) => setVisibility(v === 'Partagée au pilote' ? 'shared' : 'private')}
            />
            <Button
              label="Valider"
              onPress={onValidate}
              loading={validating}
              disabled={!draftText.trim()}
            />
            <Button label="Rejeter" variant="ghost" onPress={onDiscard} />
          </Card>
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
    fontSize: theme.fontSize.small,
    color: theme.palette.red,
    marginTop: theme.spacing.lg,
    lineHeight: theme.fontSize.small * 1.5,
  },
  badgeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.coach,
  },
  badge: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    color: theme.palette.coach,
  },
};
