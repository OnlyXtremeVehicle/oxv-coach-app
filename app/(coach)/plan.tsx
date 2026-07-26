/**
 * Coach — Plan d'objectifs (P-plan). Reskin refonte-v2 §12, RESPONSIVE deux formats.
 *
 * Le coach pose des objectifs MESURABLES pour SON pilote (métrique + direction +
 * cible) et suit leur statut. Câble la table existante `coach_objectives` via
 * coachObjectivesService (aucun schéma nouveau). Émetteur = le coach (humain) ;
 * côté pilote, ces objectifs apparaissent ATTRIBUÉS, jamais comme une consigne de
 * l'app. Pas d'échéance (absente du schéma — on n'invente rien).
 *
 * Deux formats (décision fondateur 2026-07-13, handoff §12) :
 *   - CONSOLE tablette (largeur ≥ COACH_CONSOLE_MIN_WIDTH, maquette
 *     coach/12-plan-objectifs) : deux colonnes — la file des objectifs à gauche,
 *     le panneau « Nouvel objectif » (métrique · direction · cible) à droite.
 *   - COMPAGNON téléphone : une colonne, la file puis le formulaire. Même matière.
 * Le rail §12 est porté par (coach)/_layout ; l'écran n'adapte que son corps.
 *
 * Doctrine & couleurs : identité coach = rouge d'accent (#E23A4E) sur le panneau,
 * les pills actives et le CTA. La couleur de gauche d'une carte encode la MÉTRIQUE
 * (branche QDI quand elle correspond : régularité violet, freinage rouge, vitesse
 * en virage bleu, vitesse de pointe vert ; neutre sinon) — une couleur = une
 * donnée. AUCUNE barre de progression : la table ne stocke pas de valeur mesurée
 * courante, seulement baseline/target — on affiche donc « baseline → cible », un
 * fait, jamais un pourcentage inventé. L'or reste au chrono (jamais ici).
 * Données réelles : listObjectivesForPilot (RLS) + nom du pilote via listMyPilots
 * (coach_pilots_view, jamais ses coordonnées). Absent = « — » / EmptyState.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import {
  type CoachObjective,
  type ObjectiveDirection,
  type ObjectiveMetric,
  METRICS,
  METRIC_LABEL,
  createObjective,
  listObjectivesForPilot,
  objectiveTargetLabel,
  setObjectiveStatus,
} from '@/services/coachObjectivesService';
import { listMyPilots } from '@/services/coachService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const { palette, dataColors, fonts, fontSize, spacing, radius } = theme;

const DIRECTIONS: { key: ObjectiveDirection; label: string }[] = [
  { key: 'below', label: 'Sous' },
  { key: 'above', label: 'Au-dessus' },
  { key: 'reach', label: 'Atteindre' },
];

const STATUS_LABEL: Record<CoachObjective['status'], string> = {
  active: 'En cours',
  achieved: 'Atteint',
  archived: 'Archivé',
};

/**
 * Couleur d'accent d'une métrique = sa branche QDI quand elle correspond
 * directement (§4 handoff, une couleur = une donnée). Les métriques de type
 * chrono (meilleur tour, tour moyen) restent NEUTRES pour laisser l'or au seul
 * chrono/record ; les comptages/qualitatif n'ont pas de branche → neutre.
 */
const METRIC_ACCENT: Partial<Record<ObjectiveMetric, string>> = {
  regularity: dataColors.regularity, // violet
  corner_braking: dataColors.brake, // rouge (freinage)
  corner_speed: dataColors.trajectory, // bleu (ligne / vitesse portée)
  top_speed: dataColors.accel, // vert (accélération)
};

function metricAccent(metric: ObjectiveMetric): string | null {
  return METRIC_ACCENT[metric] ?? null;
}

/** Formate un nombre au canon fr : virgule décimale, − U+2212 (jamais « - »). */
function formatNumberFr(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded).replace('.', ',').replace('-', '−');
}

/**
 * Ligne factuelle de cible. Avec baseline ET cible → « Métrique · baseline →
 * cible » (les deux tracent vers baseline_value / target_value). Sinon → le
 * libellé neutre du service (jamais un chiffre inventé).
 */
function targetLine(o: CoachObjective): string {
  if (o.baselineValue != null && o.targetValue != null) {
    return `${METRIC_LABEL[o.metric]} · ${formatNumberFr(o.baselineValue)} → ${formatNumberFr(
      o.targetValue
    )}`;
  }
  return objectiveTargetLabel(o);
}

function isoNow(): string {
  return new Date().toISOString();
}

export default function CoachPlanScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const params = useLocalSearchParams<{ pilotId?: string }>();
  const pilotId = params.pilotId;

  const [objectives, setObjectives] = useState<CoachObjective[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  // `res.error` était disponible et jeté : l'écran ne bougeait pas, et le
  // coach ne savait pas si son objectif avait été assigné.
  const [erreurObjectif, setErreurObjectif] = useState<string | null>(null);

  // Nom du pilote (affichage seul — jamais ses coordonnées, garde-fou §12).
  const [pilot, setPilot] = useState<{ full: string | null; first: string | null }>({
    full: null,
    first: null,
  });

  // Formulaire de création.
  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState<ObjectiveMetric>('regularity');
  const [direction, setDirection] = useState<ObjectiveDirection>('below');
  const [targetText, setTargetText] = useState('');

  const reload = useCallback(() => {
    if (!pilotId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    listObjectivesForPilot(pilotId)
      .then((rows) => {
        if (!cancelled) {
          setObjectives(rows);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pilotId]);

  useFocusEffect(reload);

  useEffect(() => {
    if (!pilotId) return;
    let cancelled = false;
    listMyPilots()
      .then((rows) => {
        if (cancelled) return;
        const p = rows.find((r) => r.pilotId === pilotId);
        if (!p) return;
        const first = p.firstName?.trim() || null;
        const full =
          [p.firstName, p.lastName]
            .map((x) => x?.trim())
            .filter(Boolean)
            .join(' ') || null;
        setPilot({ full, first });
      })
      .catch(() => {
        /* nom facultatif : l'écran reste utilisable sans lui */
      });
    return () => {
      cancelled = true;
    };
  }, [pilotId]);

  async function onCreate() {
    if (!pilotId || saving || !title.trim()) return;
    setSaving(true);
    const parsed = targetText.trim().replace(',', '.');
    const targetValue =
      parsed.length > 0 && Number.isFinite(Number(parsed)) ? Number(parsed) : null;
    const res = await createObjective({
      pilotId,
      title,
      metric,
      targetDirection: direction,
      targetValue,
    });
    setSaving(false);
    if (res.ok) {
      setErreurObjectif(null);
      setTitle('');
      setTargetText('');
      reload();
      return;
    }
    setErreurObjectif(
      "L'objectif n'a pas été assigné. Votre saisie est conservée : vous pouvez réessayer."
    );
  }

  async function onStatus(o: CoachObjective, status: CoachObjective['status']) {
    // Optimiste, recharge en cas d'échec.
    setObjectives((prev) => prev.map((x) => (x.id === o.id ? { ...x, status } : x)));
    const res = await setObjectiveStatus(o.id, status, status === 'achieved' ? isoNow() : null);
    if (!res.ok) reload();
  }

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : objectives.length === 0
        ? 'empty'
        : 'nominal';

  const eyebrowText = pilot.full
    ? `PLAN D'OBJECTIFS · ${pilot.full.toUpperCase()}`
    : "PLAN D'OBJECTIFS";

  // ── File des objectifs ──────────────────────────────────────────────────────
  const listBlock = (
    <StateWrapper
      state={pilotId ? state : 'empty'}
      skeletonLines={4}
      emptyLabel={pilotId ? 'Aucun objectif' : 'Pilote non précisé'}
      emptyMessage={
        pilotId
          ? 'Posez un premier objectif dans le panneau.'
          : "Ouvrez le plan depuis la fiche d'un pilote."
      }
      errorCause="Les objectifs n'ont pas pu être chargés."
      onRetry={reload}
    >
      <View style={{ gap: spacing.md }}>
        {objectives.map((o) => {
          const accent = metricAccent(o.metric);
          const chip = STATUS_STYLE[o.status];
          return (
            <Card
              key={o.id}
              accessibilityLabel={`${o.title}, ${STATUS_LABEL[o.status]}`}
              style={[
                s.objCard,
                { borderLeftWidth: 2, borderLeftColor: accent ?? palette.cardBorderProminent },
                o.status === 'archived' ? s.objArchived : null,
              ]}
            >
              <View style={s.objHead}>
                <View style={s.objTitleWrap}>
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                    style={[s.objDot, { backgroundColor: accent ?? palette.creamMute }]}
                  />
                  <Text style={s.objTitle}>{o.title}</Text>
                </View>
                <View
                  style={[s.statusChip, { backgroundColor: chip.bg, borderColor: chip.border }]}
                >
                  <Text style={[s.statusTxt, { color: chip.color }]}>{STATUS_LABEL[o.status]}</Text>
                </View>
              </View>

              <Text style={s.objTarget}>{targetLine(o)}</Text>
              {o.detail ? <Text style={s.objDetail}>{o.detail}</Text> : null}

              {o.status === 'active' ? (
                <View style={s.objActions}>
                  <RowAction label="Marquer atteint" onPress={() => onStatus(o, 'achieved')} />
                  <RowAction label="Archiver" onPress={() => onStatus(o, 'archived')} />
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>
    </StateWrapper>
  );

  // ── Panneau « Nouvel objectif » (seulement si le pilote est précisé) ─────────
  const formBlock = pilotId ? (
    <View style={s.formPanel}>
      <SectionLabel>NOUVEL OBJECTIF</SectionLabel>

      <View style={{ marginTop: spacing.md }}>
        <Field
          label="Intitulé"
          value={title}
          onChangeText={setTitle}
          placeholder="Ce que vous visez avec ce pilote."
          maxLength={120}
        />

        <Text style={s.fieldLabel}>Métrique</Text>
        <View style={s.pillWrap}>
          {METRICS.map((m) => (
            <Selectable
              key={m}
              label={METRIC_LABEL[m]}
              active={metric === m}
              onPress={() => setMetric(m)}
            />
          ))}
        </View>

        <Text style={[s.fieldLabel, { marginTop: spacing.lg }]}>Direction de la cible</Text>
        <View style={s.pillWrap}>
          {DIRECTIONS.map((d) => (
            <Selectable
              key={d.key}
              label={d.label}
              active={direction === d.key}
              onPress={() => setDirection(d.key)}
            />
          ))}
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <Field
            label="Valeur cible"
            value={targetText}
            onChangeText={setTargetText}
            placeholder="Un chiffre, ou laissez vide."
            keyboardType="numeric"
            optional
          />
        </View>

        {erreurObjectif ? (
          <Text style={s.erreurTxt} accessibilityLiveRegion="assertive">
            {erreurObjectif}
          </Text>
        ) : null}
        <CoachCta
          label={
            saving
              ? 'Enregistrement…'
              : pilot.first
                ? `Assigner à ${pilot.first}`
                : 'Assigner l’objectif'
          }
          onPress={onCreate}
          loading={saving}
          disabled={!title.trim()}
        />
      </View>
    </View>
  ) : null;

  return (
    <Screen scroll={false}>
      <AppBar title="PLAN" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
        >
          <Text style={s.eyebrow}>{eyebrowText}</Text>
          <Text style={s.title} accessibilityRole="header">
            Des cibles claires et mesurables.
          </Text>
          <Text style={s.manifest}>
            Des cibles mesurables que vous posez. Le pilote les voit, attribuées à vous — jamais une
            consigne de l&apos;app.
          </Text>

          {isConsole ? (
            <View style={s.consoleRow}>
              <View style={{ flex: 1.5 }}>{listBlock}</View>
              {formBlock ? <View style={{ flex: 1 }}>{formBlock}</View> : null}
            </View>
          ) : (
            <View style={{ marginTop: spacing.xl, gap: spacing.xxl }}>
              {listBlock}
              {formBlock}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** Action de statut d'un objectif (mono, sobre) — cible ≥ 44 px. */
function RowAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [s.action, pressed && { opacity: 0.6 }]}
    >
      <Text style={s.actionText}>{label}</Text>
    </Pressable>
  );
}

/** Pastille sélectionnable (métrique / direction) — active à l'identité coach. */
function Selectable({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [s.pill, active ? s.pillOn : null, { opacity: pressed ? 0.8 : 1 }]}
    >
      <Text style={[s.pillText, active ? s.pillTextOn : null]}>{label}</Text>
    </Pressable>
  );
}

/**
 * CoachCta — action primaire d'identité coach (rouge d'accent #E23A4E), texte
 * sombre pour le contraste. Porte l'état de chargement sans casser la cible ≥ 48 px.
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

/** Style de la pastille de statut (En cours neutre · Atteint vert · Archivé faible). */
const STATUS_STYLE: Record<
  CoachObjective['status'],
  { color: string; bg: string; border: string }
> = {
  active: { color: palette.creamMute, bg: palette.card2, border: palette.line },
  achieved: { color: palette.green, bg: 'rgba(79,201,138,0.12)', border: 'rgba(79,201,138,0.35)' },
  archived: { color: palette.faint, bg: palette.card2, border: palette.line },
};

const s = StyleSheet.create({
  erreurTxt: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
    color: palette.cream,
    marginBottom: spacing.sm,
  },
  consoleRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.xl,
    alignItems: 'flex-start',
  },

  // En-tête — identité coach en rouge d'accent (couleur de rôle §5).
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.coachAccent,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.25,
  },
  manifest: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.bodyLg,
    fontStyle: 'italic',
    lineHeight: fontSize.bodyLg * 1.6,
    color: palette.creamSoft,
    marginTop: spacing.md,
    maxWidth: 520,
  },

  // Carte d'objectif
  objCard: {
    padding: spacing.lg,
  },
  objArchived: {
    opacity: 0.6,
  },
  objHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  objTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  objDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  objTitle: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
    lineHeight: fontSize.bodyLg * 1.3,
  },
  // Cible d'objectif (baseline → cible) : pas un chrono/record → mono neutre.
  objTarget: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.3,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },
  objDetail: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.xs,
    lineHeight: fontSize.small * 1.4,
  },
  objActions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  action: {
    minHeight: 44,
    justifyContent: 'center',
  },
  actionText: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },

  // Pastille de statut
  statusChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  statusTxt: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Panneau de création — accent haut coach (bordure d'accent §5).
  formPanel: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderTopWidth: 2,
    borderTopColor: palette.coachAccent,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  fieldLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginBottom: spacing.sm,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
    minHeight: 36,
    justifyContent: 'center',
  },
  pillOn: {
    borderColor: palette.coachAccent,
    backgroundColor: 'rgba(226,58,78,0.12)',
  },
  pillText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    color: palette.creamMute,
  },
  pillTextOn: {
    color: palette.cream,
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
    marginTop: spacing.xl,
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
