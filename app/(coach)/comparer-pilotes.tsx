/**
 * Coach — Comparer DEUX pilotes, RESPONSIVE DEUX FORMATS (décision fondateur
 * 2026-07-13, handoff §12 · `coach/17-comparer-pilotes.png`).
 *
 * Distinct de `comparer.tsx` (2 séances d'UN même pilote). Ici le coach choisit
 * pilote A + une de ses séances, pilote B + une des siennes, pour les LIRE côte
 * à côte.
 *
 *  - CONSOLE tablette (largeur ≥ COACH_CONSOLE_MIN_WIDTH) : fidèle à la maquette
 *    — deux cartes pilote côte à côte (identité A or / B bleu §4 comparaison),
 *    colonne de droite = rappel doctrinal (« deux styles, pas un meilleur ») +
 *    écart factuel B − A ; sous les cartes, les marges par virage en pleine
 *    largeur. Le rail vertical est fourni par `_layout.tsx`.
 *  - COMPAGNON téléphone : la même matière empilée en une colonne. Les onglets
 *    bas sont fournis par `_layout.tsx`.
 *
 * Légitimité doctrinale (cahier OXV Mirror §8) : le coach est le tiers agréé qui
 * interprète. L'app reste DESCRIPTIVE — elle montre les chiffres, JAMAIS un
 * classement ni un gagnant entre pilotes. Deux lectures, pas un rang.
 *
 * Sécurité : le coach ne voit QUE ses pilotes consentis (RLS coach_pilots_view +
 * is_coach_of) ; `loadSessionSnapshot` échoue si la séance n'appartient pas à un
 * pilote suivi. Chaque consultation est loggée via `logCoachView` (audit RGPD).
 *
 * Données réelles : chaque valeur trace vers `loadSessionSnapshot` (marge,
 * meilleur tour, trajectoire, zones de virage — mêmes services/RLS qu'avant).
 * Le radar QDI 5 branches de la maquette n'est PAS reproduit : ces branches ne
 * font pas partie du snapshot de cette vue (elles vivraient dans getQdiForSession,
 * autre chemin RLS) — plutôt qu'inventer un pentagone, on garde la trace GPS
 * réelle colorée par marge (le vrai miroir de la ligne du pilote). Le second
 * chiffre « régularité » de la maquette étant hors snapshot, la carte montre le
 * record (or = chrono) + la marge globale, tous deux réels.
 *
 * Couleurs : langage refonte-v2. Or `#FFB703` = chrono/record. Identité de
 * comparaison A = or / B = bleu `#4F9DF7` (portée aux liserés d'avatar et aux
 * eyebrows de côté, jamais aux valeurs). Zones de virage sur le dégradé §7.6.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';

import { CoachPreset } from '@/components/CircuitMap';
import { FadeInSection } from '@/components/motion';
import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import {
  type CoachPilotRow,
  type PilotSessionSummary,
  type SessionSnapshot,
  listMyPilots,
  listPilotSessions,
  loadSessionSnapshot,
  logCoachView,
} from '@/services/coachService';
import { libelleLigneMarge } from '@/services/marginCalculator';
import { type MarginZone, marginLabelOf } from '@/types/domain';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatChronoTenths, formatDateShort, formatDelta } from '@/utils/format';
import { useSessionCircuitName } from '@/hooks/useSessionCircuitName';

const { palette, dataColors, fonts, spacing, radius } = theme;

/** Gouttière écran de la console (§5 handoff : 24 px horizontal). */
const CONSOLE_GUTTER = 24;

/** Signe moins typographique (U+2212), jamais le trait d'union. */
const MINUS = '−';

/** Identité de comparaison (§4) : A = or, B = bleu. Liserés/eyebrows, pas données. */
const SIDE_COLOR = { A: palette.gold, B: dataColors.trajectory } as const;

interface Side {
  pilot: CoachPilotRow | null;
  sessions: PilotSessionSummary[];
  selectedSessionId: string | null;
  snapshot: SessionSnapshot | null;
  loadingSessions: boolean;
  loadingSnapshot: boolean;
}

const EMPTY_SIDE: Side = {
  pilot: null,
  sessions: [],
  selectedSessionId: null,
  snapshot: null,
  loadingSessions: false,
  loadingSnapshot: false,
};

export default function CoachComparerPilotesScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [pilots, setPilots] = useState<CoachPilotRow[]>([]);
  const [loadingPilots, setLoadingPilots] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [sideA, setSideA] = useState<Side>(EMPTY_SIDE);
  const [sideB, setSideB] = useState<Side>(EMPTY_SIDE);

  useEffect(() => {
    let cancelled = false;
    setLoadingPilots(true);
    setError(false);
    listMyPilots()
      .then((rows) => {
        if (!cancelled) {
          setPilots(rows);
          setLoadingPilots(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoadingPilots(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const state: ScreenState = loadingPilots ? 'loading' : error ? 'error' : 'nominal';

  async function selectPilot(side: 'A' | 'B', pilot: CoachPilotRow) {
    const setter = side === 'A' ? setSideA : setSideB;
    setter({ ...EMPTY_SIDE, pilot, loadingSessions: true });
    const sessions = await listPilotSessions(pilot.pilotId);
    setter((prev) =>
      prev.pilot?.pilotId === pilot.pilotId ? { ...prev, sessions, loadingSessions: false } : prev
    );
  }

  async function selectSession(side: 'A' | 'B', pilotId: string, sessionId: string) {
    const setter = side === 'A' ? setSideA : setSideB;
    setter((prev) => ({ ...prev, selectedSessionId: sessionId, loadingSnapshot: true }));
    logCoachView(pilotId, { subtype: 'coach_view_compare_pilots', sessionId });
    const snap = await loadSessionSnapshot(sessionId);
    setter((prev) =>
      prev.selectedSessionId === sessionId
        ? { ...prev, snapshot: snap, loadingSnapshot: false }
        : prev
    );
  }

  const bothReady = Boolean(sideA.snapshot && sideB.snapshot);
  const nameA = sideA.pilot ? pilotName(sideA.pilot) : null;
  const nameB = sideB.pilot ? pilotName(sideB.pilot) : null;
  const headerTitle = nameA && nameB ? `${nameA} & ${nameB}` : 'Deux pilotes, côte à côte.';

  // ── En-tête (eyebrow + titre + rappel « aucun classement ») ────────────────
  const headerBlock = (
    <View style={isConsole ? s.headerRow : undefined}>
      <View style={{ flexShrink: 1 }}>
        <Text style={s.eyebrow}>COMPARER DEUX PILOTES</Text>
        <Text style={s.title} accessibilityRole="header">
          {headerTitle}
        </Text>
      </View>
      <View style={isConsole ? undefined : { marginTop: spacing.md, alignSelf: 'flex-start' }}>
        <NoRankingBadge />
      </View>
    </View>
  );

  const pickers = (
    <View style={isConsole ? s.pickerRow : s.pickerCol}>
      <SidePicker
        label="PILOTE A"
        side={sideA}
        pilots={pilots}
        grow={isConsole}
        onSelectPilot={(p) => selectPilot('A', p)}
        onSelectSession={(sid) => sideA.pilot && selectSession('A', sideA.pilot.pilotId, sid)}
      />
      <SidePicker
        label="PILOTE B"
        side={sideB}
        pilots={pilots}
        grow={isConsole}
        onSelectPilot={(p) => selectPilot('B', p)}
        onSelectSession={(sid) => sideB.pilot && selectSession('B', sideB.pilot.pilotId, sid)}
      />
    </View>
  );

  // Un ÉCART affirme plus fort qu'un chiffre : il pose que les deux valeurs
  // sont commensurables. Le libellé dit donc sur quoi elles reposent, et la
  // note prévient si les deux bases diffèrent.
  const ligneMarge =
    sideA.snapshot && sideB.snapshot
      ? libelleLigneMarge([sideA.snapshot.marginBase, sideB.snapshot.marginBase])
      : { label: 'marge globale', note: null };

  const deltaCard =
    sideA.snapshot && sideB.snapshot ? (
      <Card>
        <SectionLabel>{`ÉCART B ${MINUS} A`}</SectionLabel>
        <View style={{ marginTop: spacing.md }}>
          <DeltaLine
            label={ligneMarge.label.charAt(0).toUpperCase() + ligneMarge.label.slice(1)}
            deltaText={formatDelta(sideA.snapshot.marginGlobal, sideB.snapshot.marginGlobal, 'pts')}
          />
          <DeltaLine
            label="Meilleur tour"
            deltaText={formatDelta(
              sideA.snapshot.bestLapSeconds,
              sideB.snapshot.bestLapSeconds,
              's',
              2
            )}
          />
        </View>
        {ligneMarge.note !== null ? <Text style={s.noteMarge}>{ligneMarge.note}</Text> : null}
      </Card>
    ) : null;

  const cornerSection =
    sideA.snapshot && sideB.snapshot ? (
      <View style={{ marginTop: spacing.xxl }}>
        <View style={{ marginBottom: spacing.md }}>
          <SectionLabel>MARGES PAR VIRAGE</SectionLabel>
        </View>
        <View style={{ gap: spacing.xs }}>
          {BELTOISE_CORNERS.map((corner) => (
            <CornerRow
              key={corner.index}
              cornerIndex={corner.index}
              cornerName={corner.name}
              zoneA={sideA.snapshot!.zoneByIndex[corner.index] ?? null}
              zoneB={sideB.snapshot!.zoneByIndex[corner.index] ?? null}
              marginA={sideA.snapshot!.marginByIndex[corner.index] ?? null}
              marginB={sideB.snapshot!.marginByIndex[corner.index] ?? null}
            />
          ))}
        </View>
      </View>
    ) : null;

  const cardA =
    sideA.snapshot && nameA ? (
      <SnapshotCard
        side="A"
        name={nameA}
        snap={sideA.snapshot}
        height={isConsole ? 180 : 200}
        sessionId={sideA.selectedSessionId}
      />
    ) : null;
  const cardB =
    sideB.snapshot && nameB ? (
      <SnapshotCard
        side="B"
        name={nameB}
        snap={sideB.snapshot}
        height={isConsole ? 180 : 200}
        sessionId={sideB.selectedSessionId}
      />
    ) : null;

  return (
    <Screen>
      <AppBar title="COMPARER PILOTES" onBack={() => router.back()} />
      <View
        style={{
          paddingHorizontal: isConsole ? CONSOLE_GUTTER : spacing.lg,
          paddingBottom: spacing.xxl,
        }}
      >
        <View style={{ marginBottom: spacing.md }}>
          <RoleBadge role="coach" />
        </View>

        {headerBlock}

        <StateWrapper
          state={state}
          skeletonLines={5}
          errorCause="La liste de vos pilotes n'a pas pu être chargée."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          {pilots.length < 2 ? (
            <EmptyPilots count={pilots.length} />
          ) : (
            <>
              <View style={{ marginTop: spacing.xl }}>{pickers}</View>

              {bothReady ? (
                isConsole ? (
                  <>
                    <View style={s.resultRow}>
                      <View style={s.cardsWrap}>
                        <FadeInSection delay={0} style={{ flex: 1 }}>
                          {cardA}
                        </FadeInSection>
                        <FadeInSection delay={150} style={{ flex: 1 }}>
                          {cardB}
                        </FadeInSection>
                      </View>
                      <View style={s.sideCol}>
                        <DoctrineNote />
                        {deltaCard}
                      </View>
                    </View>
                    {cornerSection}
                    <Manifest />
                  </>
                ) : (
                  <View style={{ marginTop: spacing.xxl, gap: spacing.xl }}>
                    {cardA}
                    {cardB}
                    <DoctrineNote />
                    {deltaCard}
                    {cornerSection}
                    <Manifest />
                  </View>
                )
              ) : (
                <Text style={s.hint}>Choisissez un pilote et une séance de chaque côté.</Text>
              )}
            </>
          )}
        </StateWrapper>
      </View>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SidePicker({
  label,
  side,
  pilots,
  grow,
  onSelectPilot,
  onSelectSession,
}: {
  label: string;
  side: Side;
  pilots: CoachPilotRow[];
  grow: boolean;
  onSelectPilot: (p: CoachPilotRow) => void;
  onSelectSession: (sessionId: string) => void;
}) {
  return (
    <View style={grow ? { flex: 1 } : { width: '100%' }}>
      <View style={{ marginBottom: spacing.sm }}>
        <SectionLabel>{label}</SectionLabel>
      </View>
      {/* Pilotes */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm }}>
          {pilots.map((p) => (
            <PickChip
              key={p.pilotId}
              label={pilotName(p)}
              active={side.pilot?.pilotId === p.pilotId}
              onPress={() => onSelectPilot(p)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Séances du pilote choisi */}
      {side.pilot ? (
        side.loadingSessions ? (
          <Text style={[s.caption, { marginTop: spacing.sm }]}>Chargement des séances…</Text>
        ) : side.sessions.length === 0 ? (
          <Text style={[s.caption, { marginTop: spacing.sm }]}>Aucune séance analysée.</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: spacing.sm }}
          >
            <View style={{ flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm }}>
              {side.sessions.map((sess) => (
                <PickChip
                  key={sess.id}
                  label={`${formatDateShort(sess.startedAt)} · ${sess.circuitName ?? '—'}`}
                  active={side.selectedSessionId === sess.id}
                  onPress={() => onSelectSession(sess.id)}
                />
              ))}
            </View>
          </ScrollView>
        )
      ) : null}
    </View>
  );
}

function PickChip({
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
      hitSlop={theme.hitSlop}
      onPress={onPress}
      style={({ pressed }) => [s.chip, active ? s.chipOn : null, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Text numberOfLines={1} style={[s.chipText, active ? s.chipTextOn : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SnapshotCard({
  side,
  name,
  snap,
  height,
  sessionId,
}: {
  side: 'A' | 'B';
  name: string;
  snap: SessionSnapshot;
  height: number;
  /** Séance de CETTE carte : chaque côté déclare son propre circuit. */
  sessionId: string | null;
}) {
  const { circuitName } = useSessionCircuitName(sessionId);
  const record = snap.bestLapSeconds !== null ? formatChronoTenths(snap.bestLapSeconds) : '—';
  const marge = snap.marginGlobal !== null ? `${Math.round(snap.marginGlobal)} %` : '—';
  const sideColor = SIDE_COLOR[side];
  const a11y = `Pilote ${side}, ${name}. Séance du ${formatDateShort(
    snap.startedAt
  )}. Record ${record}. Marge globale ${marge}.`;

  return (
    <Card>
      <View accessible accessibilityLabel={a11y}>
        <View style={s.snapHead}>
          <View style={[s.avatar, { borderColor: sideColor }]}>
            <Text style={s.avatarTxt}>{initialsOf(name)}</Text>
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={[s.sideEyebrow, { color: sideColor }]}>PILOTE {side}</Text>
            <Text numberOfLines={1} style={s.snapName}>
              {name}
            </Text>
          </View>
        </View>

        <CoachPreset
          circuitName={circuitName}
          trajectory={snap.trajectory.length > 1 ? snap.trajectory : undefined}
          zoneByIndex={snap.zoneByIndex}
          height={height}
        />

        <View style={s.statRow}>
          <View style={s.stat}>
            <Text style={s.statRecord}>{record}</Text>
            <Text style={s.statLabel}>record</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statMarge}>{marge}</Text>
            <Text style={s.statLabel}>marge</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

function DeltaLine({ label, deltaText }: { label: string; deltaText: string }) {
  return (
    <View style={s.deltaLine}>
      <Text style={s.deltaLabel}>{label}</Text>
      <Text style={s.deltaValue}>{deltaText}</Text>
    </View>
  );
}

function CornerRow({
  cornerIndex,
  cornerName,
  zoneA,
  zoneB,
  marginA,
  marginB,
}: {
  cornerIndex: number;
  cornerName: string;
  zoneA: MarginZone | null;
  zoneB: MarginZone | null;
  marginA: number | null;
  marginB: number | null;
}) {
  const deltaStr = formatDelta(marginA, marginB, 'pts');
  // Les pastilles couleur restent décoratives ; on les double d'un libellé
  // accessible (zone A → zone B + écart) pour le lecteur d'écran.
  const a11yLabel = `Virage ${cornerIndex}, ${cornerName}. ${zoneLabelFr(zoneA)} vers ${zoneLabelFr(
    zoneB
  )}. Écart ${deltaStr}.`;
  return (
    <View accessible accessibilityLabel={a11yLabel} style={s.cornerRow}>
      <Text style={s.cornerIndex}>{cornerIndex}</Text>
      <Text style={s.cornerName}>{cornerName}</Text>
      <ZoneDot zone={zoneA} />
      <Text style={s.arrow}>→</Text>
      <ZoneDot zone={zoneB} />
      <Text style={s.cornerDelta}>{deltaStr}</Text>
    </View>
  );
}

function ZoneDot({ zone }: { zone: MarginZone | null }) {
  return <View style={[s.zoneDot, { backgroundColor: colorForZone(zone) }]} />;
}

function NoRankingBadge() {
  return (
    <View style={s.badge} accessible accessibilityLabel="Aucun classement entre les pilotes.">
      <View style={s.badgeDot} accessibilityElementsHidden importantForAccessibility="no" />
      <Text style={s.badgeTxt}>AUCUN CLASSEMENT</Text>
    </View>
  );
}

function DoctrineNote() {
  return (
    <View style={s.note}>
      <Text style={s.noteStrong}>Deux styles, pas un meilleur.</Text>
      <Text style={s.noteTxt}>
        Sert à adapter votre pédagogie — jamais à les mettre en concurrence.
      </Text>
    </View>
  );
}

function Manifest() {
  return <Text style={s.manifest}>Les chiffres sont là. Le sens, vous le posez avec chacun.</Text>;
}

function EmptyPilots({ count }: { count: number }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: spacing.xxl, marginTop: spacing.xl }}>
      <Text style={s.emptyTitle}>
        {count === 0 ? 'Aucun pilote suivi.' : 'Un seul pilote suivi.'}
      </Text>
      <Text style={s.emptyHint}>La comparaison requiert au moins deux pilotes consentants.</Text>
    </Card>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function pilotName(p: CoachPilotRow): string {
  return (
    [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || `Pilote ${p.pilotId.slice(0, 6)}`
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) || '·').toUpperCase();
}

function colorForZone(zone: MarginZone | null): string {
  switch (zone) {
    // Dégradé de marge §7.6 : large→vert, moyen→or (midpoint), serré→rouge de
    // DONNÉE (freinage #F65B5B), jamais le rouge de marque.
    case 'green':
      return dataColors.accel;
    case 'yellow':
      return palette.gold;
    case 'red':
      return dataColors.brake;
    default:
      return palette.creamMute;
  }
}

function zoneLabelFr(zone: MarginZone | null): string {
  return zone ? marginLabelOf(zone) : 'marge indisponible';
}

const s = StyleSheet.create({
  /** La note de base : ton de méthode, sous l'écart, atténuée. */
  noteMarge: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    color: palette.creamMute,
    marginTop: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.3,
    color: palette.cream,
    lineHeight: theme.fontSize.h2 * 1.2,
    marginTop: spacing.xs,
  },

  // Rappel doctrinal « aucun classement » (statut, pas un contrôle).
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(79,201,138,0.30)',
    backgroundColor: 'rgba(79,201,138,0.08)',
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: dataColors.accel },
  badgeTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },

  // Sélecteurs
  pickerRow: { flexDirection: 'row', gap: spacing.lg },
  pickerCol: { gap: spacing.lg },

  // Résultat console : cartes (2/3) + colonne latérale (1/3).
  resultRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.xxl,
    alignItems: 'flex-start',
  },
  cardsWrap: { flex: 2, flexDirection: 'row', gap: spacing.lg, alignItems: 'stretch' },
  sideCol: { flex: 1, minWidth: 200, gap: spacing.lg },

  // Carte pilote
  snapHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    backgroundColor: palette.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontFamily: fonts.mono, fontSize: 12, color: palette.creamSoft },
  sideEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  snapName: {
    fontFamily: fonts.bodySemi,
    fontSize: theme.fontSize.bodyLg,
    color: palette.cream,
    marginTop: 1,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxl,
    marginTop: spacing.md,
  },
  stat: { alignItems: 'center' },
  statRecord: { fontFamily: fonts.monoSemi, fontSize: theme.fontSize.h3, color: palette.gold },
  statMarge: { fontFamily: fonts.monoSemi, fontSize: theme.fontSize.h3, color: palette.cream },
  statLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: palette.eyebrow,
    marginTop: spacing.xs,
  },

  // Note doctrinale (colonne latérale)
  note: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(79,201,138,0.25)',
    backgroundColor: 'rgba(79,201,138,0.08)',
  },
  noteStrong: {
    fontFamily: fonts.bodySemi,
    fontSize: theme.fontSize.body,
    color: palette.creamSoft,
    marginBottom: spacing.xs,
  },
  noteTxt: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
  },

  // Écart B − A
  deltaLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  deltaLabel: { fontFamily: fonts.body, fontSize: theme.fontSize.body, color: palette.creamSoft },
  deltaValue: { fontFamily: fonts.mono, fontSize: theme.fontSize.body, color: palette.cream },

  // Marges par virage
  cornerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
  },
  cornerIndex: {
    fontFamily: fonts.mono,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    width: 16,
    textAlign: 'center',
  },
  cornerName: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: theme.fontSize.body,
    color: palette.cream,
  },
  arrow: { fontFamily: fonts.body, fontSize: theme.fontSize.small, color: palette.creamMute },
  cornerDelta: {
    width: 72,
    textAlign: 'right',
    fontFamily: fonts.mono,
    fontSize: theme.fontSize.small,
    color: palette.cream,
  },
  zoneDot: { width: 12, height: 12, borderRadius: 6 },

  // Divers
  caption: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    paddingVertical: spacing.lg,
  },
  hint: {
    fontFamily: fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic',
    color: palette.creamMute,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  manifest: {
    fontFamily: fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic',
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: palette.creamMute,
    textAlign: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
    maxWidth: 220,
  },
  chipOn: { borderColor: palette.coachAccent, backgroundColor: 'rgba(226,58,78,0.10)' },
  chipText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: palette.creamMute,
  },
  chipTextOn: { color: palette.cream },
  emptyTitle: {
    fontFamily: fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic',
    color: palette.creamSoft,
    textAlign: 'center',
  },
  emptyHint: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: theme.fontSize.small * 1.5,
  },
});
