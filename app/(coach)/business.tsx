/**
 * Coach — Business / Roulages (handoff §12 `coach/24-business`, sur les roulages
 * organisés du coach et leurs présences confirmées).
 *
 * RESPONSIVE DEUX FORMATS (décision fondateur 2026-07-13) : un seul composant,
 * deux arrangements selon la largeur.
 *   - CONSOLE tablette (≥ COACH_CONSOLE_MIN_WIDTH) : deux colonnes fidèles à la
 *     maquette — à gauche, les deux chiffres d'activité + l'histogramme
 *     « Revenus par mois » ; à droite, la colonne « Roulages organisés » (places)
 *     et l'accès création. Le rail vertical est fourni par `_layout.tsx`.
 *   - COMPAGNON téléphone (< seuil) : AppBar + une colonne compacte (chiffres,
 *     faits, histogramme, roulages) — pas de maquette mobile dédiée, version
 *     cohérente au même langage.
 *
 * Décision Gabin (2026-06-07, cahier v3 §10.2 sans la remise) : suivi FACTUEL de
 * l'activité — pilotes suivis, roulages organisés, présences confirmées, revenu
 * cumulé des roulages tarifés. Aucun classement, aucune commission, aucune
 * remise. Gating : permission can_view_business_dashboard (§8.1).
 *
 * DONNÉES RÉELLES : chaque valeur trace vers un service coach existant
 * (`listMyPilots`, `listMyRoulages`, `listMyRoulageInvitationStatuses`) et la
 * logique pure `roulagesLogic` (résumé, revenus, places, tri temporel). Aucune
 * table ni colonne nouvelle. L'histogramme mensuel attribue à chaque roulage le
 * revenu de ses présences confirmées au mois de sa date (`starts_at`), sur une
 * fenêtre glissante de 6 mois ; sans revenu tarifé, il cède la place à une note.
 * Rien n'est fabriqué : le revenu n'existe que si un prix est renseigné.
 *
 * Doctrine : vouvoiement, zéro emoji, DESCRIPTIF jamais prescriptif. Identité
 * coach = rouge `#E23A4E` (accents/actif) ; l'OR reste réservé au chrono (absent
 * ici : ce tableau ne porte ni meilleur tour ni record → aucun or, revenu en
 * crème mono). Un chiffre dominant : le revenu cumulé.
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { useCoachPermissions } from '@/hooks/useCoachPermissions';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import { listMyPilots } from '@/services/coachService';
import {
  type Roulage,
  computeCoachBusinessSummary,
  remainingPlaces,
  roulageRevenueCents,
  splitRoulagesByTime,
} from '@/services/roulagesLogic';
import { listMyRoulageInvitationStatuses, listMyRoulages } from '@/services/roulagesService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Fact } from '@/ui/Fact';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatDateShort, formatPriceCents } from '@/utils/format';

const { palette, fonts, fontSize, spacing, radius } = theme;

/** Données brutes chargées (les 3 mêmes lectures que le service business). */
interface RawData {
  pilotCount: number;
  roulages: Roulage[];
  statuses: { roulageId: string; status: string }[];
}

/** Une colonne de l'histogramme mensuel. */
interface MonthBucket {
  label: string;
  cents: number;
  current: boolean;
}

/** Fenêtre de l'histogramme (mois glissants, mois courant inclus). */
const MONTHS_WINDOW = 6;
/** Nombre de roulages à venir montrés dans la colonne « Roulages organisés ». */
const UPCOMING_LIMIT = 5;

export default function CoachBusinessScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const { permissions, loading: permLoading } = useCoachPermissions();
  const [raw, setRaw] = useState<RawData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([listMyPilots(), listMyRoulages(), listMyRoulageInvitationStatuses()])
      .then(([pilots, roulages, statuses]) => {
        if (!cancelled) {
          setRaw({ pilotCount: pilots.length, roulages, statuses });
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
  }, []);

  useFocusEffect(reload);

  // Dérivés purs : résumé factuel + présences par roulage + histogramme + à venir.
  const derived = useMemo(() => {
    if (!raw) return null;
    const acceptedByRoulage = new Map<string, number>();
    for (const st of raw.statuses) {
      if (st.status === 'accepted') {
        acceptedByRoulage.set(st.roulageId, (acceptedByRoulage.get(st.roulageId) ?? 0) + 1);
      }
    }
    const summary = computeCoachBusinessSummary(raw.pilotCount, raw.roulages, acceptedByRoulage);
    const { upcoming } = splitRoulagesByTime(
      raw.roulages.filter((r) => r.status !== 'cancelled'),
      new Date().toISOString()
    );
    return {
      summary,
      acceptedByRoulage,
      upcoming,
      monthly: buildMonthly(raw.roulages, acceptedByRoulage),
    };
  }, [raw]);

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : derived == null || isNothing(derived.summary)
        ? 'empty'
        : 'nominal';

  // Chrome partagé : pas d'AppBar en console (le rail porte la navigation).
  const frame = (children: ReactNode) => (
    <Screen>
      {isConsole ? null : <AppBar title="BUSINESS" onBack={() => router.back()} />}
      <View style={isConsole ? s.consolePad : s.companionPad}>{children}</View>
    </Screen>
  );

  if (permLoading) {
    return frame(
      <>
        <HeaderBlock isConsole={isConsole} />
        <View style={{ marginTop: spacing.xl }}>
          <StateWrapper state="loading" skeletonLines={5}>
            {null}
          </StateWrapper>
        </View>
      </>
    );
  }

  // Feature gardée : permission non accordée → message sobre, aucune donnée.
  if (!permissions.canViewBusinessDashboard) {
    return frame(
      <>
        <HeaderBlock isConsole={isConsole} />
        <Card style={{ marginTop: spacing.xl }}>
          <Text style={s.manifest}>
            Le tableau de bord business n&apos;est pas activé sur votre compte.
          </Text>
          <Text style={s.caption}>Cet accès est ouvert au cas par cas par l&apos;équipe OXV.</Text>
        </Card>
      </>
    );
  }

  // ---- Blocs partagés entre les deux formats (construits une seule fois) ----
  let statRow: ReactNode = null;
  let factRow: ReactNode = null;
  let histogram: ReactNode = null;
  let roulages: ReactNode = null;

  if (derived) {
    const { summary, monthly, upcoming, acceptedByRoulage } = derived;
    const hasRevenue = summary.totalRevenueCents > 0;
    const canCreate = permissions.canManageOwnSessions;
    const chartH = isConsole ? 150 : 120;

    statRow = (
      <View style={s.statRow}>
        <StatTile
          hero
          label="Revenus de vos roulages"
          value={formatPriceCents(summary.totalRevenueCents)}
          caption={
            hasRevenue
              ? 'Cumul des présences confirmées sur vos roulages tarifés.'
              : 'Renseignez un prix sur vos roulages pour suivre vos revenus.'
          }
        />
        <StatTile
          label={summary.totalAccepted > 1 ? 'Présences confirmées' : 'Présence confirmée'}
          value={String(summary.totalAccepted)}
        />
      </View>
    );

    factRow = (
      <View style={s.factRow}>
        <Fact
          label={summary.pilotCount > 1 ? 'Pilotes' : 'Pilote'}
          value={String(summary.pilotCount)}
        />
        <Fact
          label={summary.activeRoulageCount > 1 ? 'Roulages' : 'Roulage'}
          value={String(summary.activeRoulageCount)}
        />
      </View>
    );

    histogram = (
      <Card style={s.chartCard}>
        <SectionLabel>Revenus par mois</SectionLabel>
        {hasRevenue ? (
          <RevenueHistogram data={monthly} chartH={chartH} />
        ) : (
          <Text style={[s.calm, { marginTop: spacing.md }]}>
            Renseignez un prix sur vos roulages pour suivre vos revenus mois par mois.
          </Text>
        )}
      </Card>
    );

    roulages = (
      <View>
        <SectionLabel>Roulages organisés</SectionLabel>
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {upcoming.length === 0 ? (
            <Text style={s.calm}>Aucun roulage à venir. Créez-en un pour convier vos pilotes.</Text>
          ) : (
            upcoming
              .slice(0, UPCOMING_LIMIT)
              .map((r) => (
                <RoulageRow key={r.id} roulage={r} accepted={acceptedByRoulage.get(r.id) ?? 0} />
              ))
          )}
        </View>
        <View style={{ marginTop: spacing.lg }}>
          <Button
            label={canCreate ? 'Créer un roulage' : 'Voir mes roulages'}
            variant="ghost"
            onPress={() =>
              router.push((canCreate ? '/(coach)/roulages/nouveau' : '/(coach)/roulages') as never)
            }
          />
        </View>
      </View>
    );
  }

  // ---- CONSOLE (tablette) : deux colonnes ---------------------------------
  if (isConsole) {
    return frame(
      <>
        <HeaderBlock isConsole />
        <View style={{ marginTop: spacing.xl }}>
          <StateWrapper
            state={state}
            skeletonLines={5}
            emptyLabel="Aucune activité"
            emptyMessage="Votre activité apparaîtra ici dès vos premiers roulages tarifés."
            emptySource="coach_roulages"
            errorCause="Votre activité n'a pas pu être chargée."
            onRetry={reload}
          >
            <View style={s.twoCol}>
              <View style={s.mainCol}>
                {statRow}
                <View style={{ marginTop: spacing.lg }}>{histogram}</View>
                <View style={{ marginTop: spacing.lg }}>{factRow}</View>
              </View>
              <View style={s.sideCol}>{roulages}</View>
            </View>
          </StateWrapper>
        </View>
      </>
    );
  }

  // ---- COMPAGNON (téléphone) : une colonne --------------------------------
  return frame(
    <>
      <HeaderBlock isConsole={false} />
      <View style={{ marginTop: spacing.xl }}>
        <StateWrapper
          state={state}
          skeletonLines={5}
          emptyLabel="Aucune activité"
          emptyMessage="Votre activité apparaîtra ici dès vos premiers roulages tarifés."
          emptySource="coach_roulages"
          errorCause="Votre activité n'a pas pu être chargée."
          onRetry={reload}
        >
          {statRow}
          <View style={{ marginTop: spacing.lg }}>{factRow}</View>
          <View style={{ marginTop: spacing.lg }}>{histogram}</View>
          <View style={{ marginTop: spacing.xl }}>{roulages}</View>
        </StateWrapper>
      </View>
    </>
  );
}

// ===========================================================================
// Sous-composants
// ===========================================================================

function HeaderBlock({ isConsole }: { isConsole: boolean }) {
  if (isConsole) {
    return (
      <View style={s.consoleHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>BUSINESS</Text>
          <Text style={s.title} accessibilityRole="header">
            Votre activité
          </Text>
        </View>
        <Text style={s.year}>{new Date().getFullYear()}</Text>
      </View>
    );
  }
  return (
    <>
      <View style={{ marginBottom: spacing.md }}>
        <RoleBadge role="coach" />
      </View>
      <Text style={s.eyebrow}>COACH OXV</Text>
      <Text style={[s.title, { marginTop: spacing.sm }]} accessibilityRole="header">
        Votre activité.
      </Text>
    </>
  );
}

function StatTile({
  label,
  value,
  caption,
  hero,
}: {
  label: string;
  value: string;
  caption?: string;
  hero?: boolean;
}) {
  return (
    <Card style={s.statTile}>
      <Text style={s.statLabel}>{label}</Text>
      <Text
        style={[s.statValue, hero && s.statValueHero]}
        accessibilityLabel={`${label} : ${value}`}
      >
        {value}
      </Text>
      {caption ? <Text style={s.statCaption}>{caption}</Text> : null}
    </Card>
  );
}

function RevenueHistogram({ data, chartH }: { data: MonthBucket[]; chartH: number }) {
  const max = Math.max(1, ...data.map((d) => d.cents));
  const a11y =
    'Revenus par mois. ' +
    data.map((d) => `${d.label} ${formatPriceCents(d.cents)}`).join('. ') +
    '.';
  return (
    <View
      style={[s.chartRow, { marginTop: spacing.lg }]}
      accessibilityRole="summary"
      accessibilityLabel={a11y}
    >
      {data.map((d) => {
        const barH = d.cents === 0 ? 0 : Math.max(6, Math.round((d.cents / max) * chartH));
        return (
          <View key={d.label} style={s.chartCol}>
            <View
              style={[s.chartBarArea, { height: chartH }]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              <View style={[s.chartBar, { height: barH }, d.current && s.chartBarCurrent]} />
            </View>
            <Text style={[s.chartLabel, d.current && s.chartLabelCurrent]}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function RoulageRow({ roulage, accepted }: { roulage: Roulage; accepted: number }) {
  const left = remainingPlaces(roulage, accepted) ?? 0;
  const hasCap = roulage.maxPilots != null;
  const placesText = hasCap ? `${accepted}/${roulage.maxPilots}` : String(accepted);
  const placesA11y = hasCap
    ? left === 0
      ? 'complet'
      : `${left} place${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''}`
    : `${accepted} présence${accepted > 1 ? 's' : ''} confirmée${accepted > 1 ? 's' : ''}`;
  const meta =
    [roulage.circuitName, roulage.location].filter(Boolean).join(' · ') || 'Journée coach';

  return (
    <Card
      onPress={() =>
        router.push({ pathname: '/(coach)/roulages/[id]', params: { id: roulage.id } } as never)
      }
      accessibilityLabel={`${roulage.title}. ${formatDateShort(roulage.startsAt)}. ${meta}. ${placesA11y}.`}
      style={s.roulageCard}
    >
      <View style={s.roulageRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.roulageDate} numberOfLines={1}>
            {formatDateShort(roulage.startsAt)}
          </Text>
          <Text style={s.roulageMeta} numberOfLines={1}>
            {roulage.title} · {meta}
          </Text>
        </View>
        <View style={s.placeChip}>
          <Text style={s.placeChipTxt}>{placesText}</Text>
        </View>
      </View>
    </Card>
  );
}

// ===========================================================================
// Helpers purs (affichage seulement — dérivés de données réelles)
// ===========================================================================

/** Coach sans aucune activité mesurable → EmptyState honnête plutôt que zéros. */
function isNothing(summary: {
  totalRevenueCents: number;
  activeRoulageCount: number;
  pilotCount: number;
  totalAccepted: number;
}): boolean {
  return (
    summary.totalRevenueCents === 0 &&
    summary.activeRoulageCount === 0 &&
    summary.pilotCount === 0 &&
    summary.totalAccepted === 0
  );
}

/** Revenus par mois sur une fenêtre glissante (mois courant inclus, dernier). */
function buildMonthly(roulages: Roulage[], acceptedByRoulage: Map<string, number>): MonthBucket[] {
  const now = new Date();
  const buckets: { key: string; date: Date; cents: number }[] = [];
  for (let i = MONTHS_WINDOW - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: monthKey(d), date: d, cents: 0 });
  }
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const r of roulages) {
    const t = Date.parse(r.startsAt);
    if (Number.isNaN(t)) continue;
    const idx = index.get(monthKey(new Date(t)));
    if (idx == null) continue;
    buckets[idx].cents += roulageRevenueCents(r, acceptedByRoulage.get(r.id) ?? 0);
  }
  const nowKey = monthKey(now);
  return buckets.map((b) => ({
    label: monthLabel(b.date),
    cents: b.cents,
    current: b.key === nowKey,
  }));
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

/** Étiquette de mois courte (« JUIL », « AOÛT ») — mono, sans le point abrégé. */
function monthLabel(d: Date): string {
  return d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '').toUpperCase();
}

const s = StyleSheet.create({
  consolePad: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  companionPad: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  // En-tête
  consoleHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.2,
    marginTop: spacing.sm,
  },
  year: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 1,
    color: palette.eyebrow,
    marginTop: spacing.xs,
  },

  // Deux colonnes (console)
  twoCol: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  mainCol: { flex: 1 },
  sideCol: { width: 300 },

  // Chiffres d'activité
  statRow: { flexDirection: 'row', gap: spacing.sm },
  statTile: { flex: 1, paddingVertical: spacing.lg, paddingHorizontal: spacing.lg },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  statValue: {
    fontFamily: fonts.mono,
    fontSize: fontSize.value,
    letterSpacing: -0.5,
    color: palette.cream,
    marginTop: spacing.sm,
  },
  // Le revenu domine (chiffre roi de l'écran). Crème — jamais l'or (chrono seul).
  statValueHero: { fontSize: fontSize.display },
  statCaption: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
    marginTop: spacing.sm,
  },

  factRow: { flexDirection: 'row', gap: spacing.sm },

  // Histogramme mensuel
  chartCard: { paddingVertical: spacing.lg, paddingHorizontal: spacing.lg },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  chartCol: { flex: 1, alignItems: 'center' },
  chartBarArea: { width: '100%', justifyContent: 'flex-end' },
  chartBar: {
    width: '100%',
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    backgroundColor: palette.surface3,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
  },
  // Mois courant en rouge coach (identité de rôle — pas l'or, réservé au chrono).
  chartBarCurrent: { backgroundColor: palette.coachAccent, borderColor: palette.coachAccent },
  chartLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: palette.eyebrow,
    marginTop: spacing.sm,
  },
  chartLabelCurrent: { color: palette.coachAlert },

  // Colonne roulages
  roulageCard: { paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  roulageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  roulageDate: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.body,
    letterSpacing: 0.3,
    color: palette.cream,
  },
  roulageMeta: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
  },
  placeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    backgroundColor: palette.card2,
  },
  placeChipTxt: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.5,
    color: palette.creamSoft,
  },

  // Textes calmes / messages
  calm: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
  },
  manifest: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.bodyLg,
    fontStyle: 'italic',
    lineHeight: fontSize.bodyLg * 1.6,
    color: palette.creamSoft,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.md,
    lineHeight: fontSize.small * 1.5,
  },
});
