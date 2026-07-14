/**
 * Coach — Assistant IA (C-1). Reskin refonte-v2 §12, RESPONSIVE deux formats.
 *
 * L'IA PRÉ-RÉDIGE une observation descriptive sur un virage ; le coach la relit,
 * l'édite, puis la VALIDE (vers le pilote) ou la rejette. Rien n'atteint le pilote
 * sans cette validation (garde-fou C-1). Le filtrage doctrinal est côté serveur
 * (edge) — l'écran reste utilisable si l'IA est indisponible.
 *
 * Deux formats (décision fondateur 2026-07-13, handoff §12) :
 *   - CONSOLE tablette (largeur ≥ COACH_CONSOLE_MIN_WIDTH, maquette
 *     coach/11-assistant-ia) : deux colonnes — à gauche « choisir la lecture »
 *     (pilote · séance · virage + demande), à droite l'observation proposée et
 *     sa validation. La bande-garde IA reste en tête, pleine largeur.
 *   - COMPAGNON téléphone : une colonne, même matière empilée.
 * Le rail §12 est porté par (coach)/_layout ; l'écran n'adapte que son corps.
 *
 * Doctrine : l'IA propose, le coach décide. Identité coach = rouge d'accent
 * (#E23A4E) sur les actions ; jamais l'or (chrono) ni le rouge de DONNÉE.
 * Vouvoiement, pas d'emoji, descriptif jamais prescriptif. Aucune valeur inventée :
 * pilotes/séances/brouillon tracent vers coachService + coachAiService (edge).
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';

import { AIReviewBanner } from '@/components/AIReviewBanner';
import { EmptyState } from '@/components/instruments';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
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
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';
import { formatDateLong } from '@/utils/format';

const { palette, spacing, fonts, fontSize, radius } = theme;

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
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

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

  const selectedPilot = pilots.find((p) => p.pilotId === pilotId) ?? null;

  // ── Colonne « choisir la lecture » : pilote · séance · virage + demande ─────
  const setupBlock = (
    <View style={{ gap: spacing.xl }}>
      <View style={{ gap: spacing.sm }}>
        <Text style={s.sectionLabel}>Pilote</Text>
        {pilots.length === 0 ? (
          <EmptyState
            label="Aucun pilote consentant"
            message="Un pilote apparaît ici lorsqu'il vous a accordé l'accès détaillé."
            source="coach_pilots_view"
          />
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
              style={pilotId === p.pilotId ? s.cardSelected : undefined}
            >
              <Text style={s.rowLabel}>{pilotName(p)}</Text>
            </Card>
          ))
        )}
      </View>

      {pilotId ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={s.sectionLabel}>Séance</Text>
          {sessions.length === 0 ? (
            <EmptyState
              label="Aucune séance analysée"
              message="Les séances analysées de ce pilote apparaîtront ici."
              source="app_session_analyses"
            />
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
                style={sessionId === sess.id ? s.cardSelected : undefined}
              >
                <Text style={s.rowLabel}>{formatDateLong(sess.startedAt)}</Text>
                <Text style={s.muted}>{sess.circuitName ?? 'Circuit'}</Text>
              </Card>
            ))
          )}
        </View>
      ) : null}

      {pilotId && sessionId ? (
        <View style={{ gap: spacing.md }}>
          <Text style={s.sectionLabel}>Virage</Text>
          <Segmented
            options={CORNERS.map(String)}
            value={String(corner)}
            onChange={(v) => setCorner(Number(v))}
          />
          <CoachCta
            label="Proposer une observation"
            onPress={onPropose}
            loading={requesting}
            disabled={requesting}
          />
        </View>
      ) : null}
    </View>
  );

  // ── Colonne « observation proposée » : relecture + validation humaine ───────
  const reviewBlock = (
    <View style={{ gap: spacing.md }}>
      <Text style={s.sectionLabel}>Observation proposée</Text>
      {draftId ? (
        <Card style={s.reviewCard}>
          <Text style={s.proposedEyebrow}>Proposé · basé sur la télémétrie</Text>
          <Field
            label="Observation (éditable)"
            value={draftText}
            onChangeText={setDraftText}
            multiline
            maxLength={1000}
            showCounter
          />
          <Text style={s.sectionLabel}>Visibilité</Text>
          <Segmented
            options={['Note de travail', 'Partagée au pilote']}
            value={visibility === 'shared' ? 'Partagée au pilote' : 'Note de travail'}
            onChange={(v) => setVisibility(v === 'Partagée au pilote' ? 'shared' : 'private')}
          />
          <View style={s.reviewActions}>
            <View style={{ flex: 1 }}>
              <CoachCta
                label="Valider l'observation"
                onPress={onValidate}
                loading={validating}
                disabled={!draftText.trim()}
              />
            </View>
            <Button label="Rejeter" variant="ghost" onPress={onDiscard} />
          </View>
        </Card>
      ) : (
        <EmptyState
          label="Aucune proposition"
          message={
            pilotId && sessionId
              ? 'Choisissez un virage, puis demandez une proposition.'
              : 'Choisissez un pilote et une séance pour demander une proposition.'
          }
        />
      )}
    </View>
  );

  return (
    <Screen>
      <AppBar title="ASSISTANT IA" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={{ marginBottom: spacing.md }}>
          <RoleBadge role="coach" />
        </View>

        {/* En-tête : le pilote sélectionné situe la lecture (comme la maquette). */}
        <Text style={s.eyebrow}>
          {selectedPilot ? `Assistant · ${pilotName(selectedPilot)}` : 'Aide à la rédaction'}
        </Text>
        <Text style={s.title} accessibilityRole="header">
          Observations proposées.
        </Text>
        <Text style={s.subtitle}>{"L'IA propose un fait. Vous décidez."}</Text>

        {/* Bande-garde IA (garde-fou C-1) : pleine largeur, toujours visible —
            rien n'atteint le pilote sans validation. Composant partagé, intact. */}
        <View style={{ marginTop: spacing.lg }}>
          <AIReviewBanner />
        </View>

        {error ? (
          <Text style={s.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        {isConsole ? (
          <View style={s.consoleRow}>
            <View style={{ flex: 1 }}>{setupBlock}</View>
            <View style={{ flex: 1.2 }}>{reviewBlock}</View>
          </View>
        ) : (
          <View style={{ gap: spacing.xl, marginTop: spacing.xl }}>
            {setupBlock}
            {reviewBlock}
          </View>
        )}

        <Text style={s.doctrine}>
          {"L'assistant propose un fait. La validation, et la décision, restent à vous."}
        </Text>
      </View>
    </Screen>
  );
}

/**
 * CoachCta — action primaire d'identité coach (rouge d'accent #E23A4E). Texte
 * sombre pour le contraste (précédent Studio), grammaire mono du bouton OXV.
 * Porte l'état de chargement (spinner) sans casser la cible ≥ 48 px.
 */
function CoachCta({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const inert = disabled || loading;
  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }) => [
        s.cta,
        disabled ? s.ctaDisabled : null,
        pressed && !inert ? s.ctaPressed : null,
      ]}
    >
      <View style={s.ctaContent}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={palette.night}
            style={{ marginRight: spacing.sm }}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
        <Text style={s.ctaLabel}>{label}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  consoleRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xl,
    alignItems: 'flex-start',
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginTop: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.25,
    marginTop: spacing.md,
  },
  subtitle: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  rowLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.cream,
  },
  muted: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.xs,
  },
  // Sélection = contexte coach → liseré rouge d'accent (identité de rôle).
  cardSelected: {
    borderColor: palette.coachAccent,
    borderWidth: 1.5,
  },
  // Carte de relecture : accent haut 2px coach (handoff §5 « bordure d'accent »).
  reviewCard: {
    borderTopWidth: 2,
    borderTopColor: palette.coachAccent,
    padding: spacing.lg,
    gap: spacing.md,
  },
  proposedEyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  reviewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.coachAlert,
    marginTop: spacing.lg,
    lineHeight: fontSize.small * 1.5,
  },
  doctrine: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic',
    color: palette.creamMute,
    textAlign: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.md,
    lineHeight: fontSize.small * 1.5,
  },
  // CTA coach (identité rouge d'accent)
  cta: {
    backgroundColor: palette.coachAccent,
    borderRadius: radius.md,
    paddingVertical: spacing.lg - 2,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.5 },
  ctaPressed: { opacity: 0.9 },
  ctaContent: { flexDirection: 'row', alignItems: 'center' },
  ctaLabel: {
    fontFamily: fonts.monoSemi,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.night,
  },
});
