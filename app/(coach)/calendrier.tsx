/**
 * Coach — Calendrier / Agenda (handoff §12 `coach/22-calendrier.png` console +
 * `coach-mobile/10-agenda.png` compagnon).
 *
 * RESPONSIVE DEUX FORMATS (décision fondateur 2026-07-13) : un seul écran, deux
 * arrangements selon la largeur.
 *   - CONSOLE tablette (≥ COACH_CONSOLE_MIN_WIDTH) : vue calendrier semaine —
 *     en-tête (« Semaine du 14 juillet » + légende confirmé/ouvert + navigation
 *     ‹ ›), gouttière horaire à gauche, 7 colonnes jour, blocs positionnés à
 *     l'heure réelle. Le rail vertical est fourni par `_layout.tsx`.
 *   - COMPAGNON téléphone (< seuil) : liste agenda — titre « Agenda », deux
 *     sections « Cette semaine » / « À venir », cartes à pastille date. Les
 *     onglets bas sont fournis par `_layout.tsx`.
 *
 * Données réelles UNIQUEMENT (`coachMarketplaceService`, zéro schéma nouveau) :
 *   - séances CONFIRMÉES = demandes `accepted` datées (`listCoachBookings`) —
 *     voix coach, rouge d'identité `#E23A4E` (confirmé).
 *   - créneaux OUVERTS = disponibilités `open` (`listMyAvailability`) — vert
 *     translucide (ouvert), avec leur capacité réelle.
 * Une demande n'a pas de fin en base : son bloc est ancré à l'heure de début,
 * hauteur minimale (jamais une durée inventée). Un créneau porte parfois une
 * fin (`endsAt`) : elle seule dimensionne le bloc. Absent = masqué. L'or reste
 * réservé au chrono (aucun chrono ici → aucun or).
 *
 * Doctrine : vouvoiement, zéro emoji, DESCRIPTIF jamais prescriptif — un agenda
 * qui se lit, pas un rappel qui presse. Lecture seule côté pilote.
 *
 * Motion (passe transversale, kit src/components/motion) : en-tête en fondu,
 * grille semaine en fondu re-joué à chaque navigation de semaine (key), cartes
 * agenda compagnon en cascade (Stagger), navigation et blocs en PressableScale.
 * PAS de cascade sur les blocs positionnés en absolu (le wrapper les casserait).
 * Durées et courbes = celles du kit ; reduce-motion respecté par construction.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';

import { FadeInSection, PressableScale, Stagger } from '@/components/motion';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import {
  type CoachBooking,
  type MyAvailabilitySlot,
  listCoachBookings,
  listMyAvailability,
} from '@/services/coachMarketplaceService';
import { theme } from '@/theme/v2';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const { palette, fonts, fontSize, spacing, radius } = theme;

// — Géométrie de la grille console (fidélité §12) —
const HOUR_H = 34; // px par heure
const MIN_BLOCK_H = 46; // hauteur mini d'un bloc (cible tactile + 2 lignes)
const MIN_HOURS = MIN_BLOCK_H / HOUR_H; // durée mini pour la mise en lanes
const GUTTER_W = 46; // gouttière horaire gauche
const DAY_HEADER_H = 40; // en-tête de colonne (jour + n°)
const DEFAULT_MIN_H = 8; // plage horaire par défaut (8 h → 20 h)
const DEFAULT_MAX_H = 20;
const CONSOLE_GUTTER = 24; // gouttière écran console (§5 handoff)
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Vert « ouvert » (créneau) — translucide, dérivé de palette.green (#4FC98A).
const OPEN_FILL = 'rgba(79,201,138,0.12)';
const OPEN_BORDER = 'rgba(79,201,138,0.42)';

interface AgendaItem {
  key: string;
  kind: 'session' | 'slot';
  start: Date;
  /** Fin réelle (créneau avec `endsAt`) ou null (demande, créneau sans fin). */
  end: Date | null;
  /** Nom du pilote (séance) ou libellé neutre (créneau). */
  title: string;
  circuit: string | null;
  /** Capacité (créneau ouvert) — jamais un ratio réservé/total (non porté). */
  capacity: number | null;
  onPress: () => void;
}

// ── Helpers de temps (purs, affichage) ──────────────────────────────────────

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function mondayOf(d: Date): Date {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // 0 = lundi … 6 = dimanche
  x.setDate(x.getDate() - dow);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fracHour(d: Date): number {
  return d.getHours() + d.getMinutes() / 60;
}

function plur(n: number): string {
  return n >= 2 ? 's' : '';
}

/** Heure au format français court : « 9 h », « 9 h 30 ». */
function frTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** Plage horaire : « 9 h – 11 h » si fin connue, sinon l'heure de début. */
function frTimeRange(start: Date, end: Date | null): string {
  return end ? `${frTime(start)} – ${frTime(end)}` : frTime(start);
}

/** Abréviation jour de semaine minuscule (« mer », « sam »). */
function weekdayAbbr(d: Date): string {
  return d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
}

/** Abréviation mois minuscule (« juil », « août »). */
function monthAbbr(d: Date): string {
  return d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ── Construction de l'agenda (données réelles) ───────────────────────────────

function buildItems(bookings: CoachBooking[], slots: MyAvailabilitySlot[]): AgendaItem[] {
  const floor = startOfDay(new Date()).getTime();
  const items: AgendaItem[] = [];

  for (const b of bookings) {
    if (b.status !== 'accepted' || !b.requestedStartsAt) continue;
    const start = new Date(b.requestedStartsAt);
    if (start.getTime() < floor) continue;
    items.push({
      key: `b-${b.id}`,
      kind: 'session',
      start,
      end: null, // une demande ne porte pas de fin en base
      title: b.pilotFirstName?.trim() || 'Pilote',
      circuit: b.circuitName?.trim() || null,
      capacity: null,
      onPress: () =>
        router.push({ pathname: '/(coach)/pilote/[id]', params: { id: b.pilotId } } as never),
    });
  }

  for (const sl of slots) {
    if (sl.status !== 'open' || !sl.startsAt) continue;
    const start = new Date(sl.startsAt);
    if (start.getTime() < floor) continue;
    items.push({
      key: `s-${sl.id}`,
      kind: 'slot',
      start,
      end: sl.endsAt ? new Date(sl.endsAt) : null,
      title: 'Créneau ouvert',
      circuit: sl.circuitName?.trim() || null,
      capacity: Number.isFinite(sl.capacity) ? sl.capacity : null,
      onPress: () => router.push('/(coach)/disponibilites' as never),
    });
  }

  items.sort((a, b) => a.start.getTime() - b.start.getTime());
  return items;
}

// ── Mise en lanes d'une journée (chevauchements côte à côte) ─────────────────

interface Placed {
  item: AgendaItem;
  lane: number;
}

function layoutDay(dayItems: AgendaItem[]): { placed: Placed[]; laneCount: number } {
  const sorted = [...dayItems].sort((a, b) => a.start.getTime() - b.start.getTime());
  const laneEnds: number[] = []; // heure de fin (frac) occupée par lane
  const placed: Placed[] = [];
  for (const item of sorted) {
    const s = fracHour(item.start);
    const e = Math.max(item.end ? fracHour(item.end) : s + MIN_HOURS, s + MIN_HOURS);
    let lane = laneEnds.findIndex((le) => le <= s);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(e);
    } else {
      laneEnds[lane] = e;
    }
    placed.push({ item, lane });
  }
  return { placed, laneCount: Math.max(1, laneEnds.length) };
}

// ── Écran ────────────────────────────────────────────────────────────────────

export default function CoachCalendrierScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [bookings, setBookings] = useState<CoachBooking[]>([]);
  const [slots, setSlots] = useState<MyAvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Navigation semaine (console). weekOffset 0 = semaine courante.
  const [weekOffset, setWeekOffset] = useState(0);
  const userMovedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([listCoachBookings(), listMyAvailability()])
      .then(([b, sl]) => {
        if (!cancelled) {
          setBookings(b);
          setSlots(sl);
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
  }, [reloadKey]);

  const items = useMemo(() => buildItems(bookings, slots), [bookings, slots]);

  // Ancrage initial : si rien cette semaine mais des rendez-vous plus tard, la
  // console s'ouvre sur la première semaine peuplée (tant que le coach n'a pas
  // navigué manuellement). Honnête : aucune donnée n'est cachée.
  useEffect(() => {
    if (userMovedRef.current || items.length === 0) return;
    const todayMonday = mondayOf(new Date());
    const firstMonday = mondayOf(items[0].start);
    const diff = Math.round((firstMonday.getTime() - todayMonday.getTime()) / WEEK_MS);
    if (diff > 0) setWeekOffset(diff);
  }, [items]);

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : items.length === 0
        ? 'empty'
        : 'nominal';

  if (isConsole) {
    return (
      <ConsoleCalendar
        items={items}
        state={state}
        weekOffset={weekOffset}
        onWeek={(dir) => {
          userMovedRef.current = true;
          setWeekOffset((o) => o + dir);
        }}
        onRetry={() => setReloadKey((k) => k + 1)}
      />
    );
  }

  return <CompanionAgenda items={items} state={state} onRetry={() => setReloadKey((k) => k + 1)} />;
}

// ── CONSOLE (tablette) : grille semaine ──────────────────────────────────────

function ConsoleCalendar({
  items,
  state,
  weekOffset,
  onWeek,
  onRetry,
}: {
  items: AgendaItem[];
  state: ScreenState;
  weekOffset: number;
  onWeek: (dir: number) => void;
  onRetry: () => void;
}) {
  const now = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => addDays(mondayOf(now), weekOffset * 7), [now, weekOffset]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const weekItems = useMemo(() => {
    const from = weekStart.getTime();
    const to = from + WEEK_MS;
    return items.filter((it) => {
      const t = it.start.getTime();
      return t >= from && t < to;
    });
  }, [items, weekStart]);

  // Plage horaire visible : 8 h–20 h par défaut, élargie pour ne masquer aucun
  // rendez-vous de la semaine.
  const { rangeStart, rangeEnd } = useMemo(() => {
    let lo = DEFAULT_MIN_H;
    let hi = DEFAULT_MAX_H;
    for (const it of weekItems) {
      const s = fracHour(it.start);
      const e = it.end ? fracHour(it.end) : s + MIN_HOURS;
      lo = Math.min(lo, Math.floor(s));
      hi = Math.max(hi, Math.ceil(e));
    }
    lo = Math.max(0, Math.min(lo, 23));
    hi = Math.max(lo + 1, Math.min(hi, 24));
    return { rangeStart: lo, rangeEnd: hi };
  }, [weekItems]);

  const gridHeight = (rangeEnd - rangeStart) * HOUR_H;
  const marks = useMemo(() => {
    const out: number[] = [];
    for (let h = rangeStart; h <= rangeEnd; h += 1) if (h % 3 === 0) out.push(h);
    return out;
  }, [rangeStart, rangeEnd]);

  const sessionCount = weekItems.filter((it) => it.kind === 'session').length;
  const slotCount = weekItems.length - sessionCount;

  const weekTitle = weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

  return (
    <Screen>
      <View style={{ paddingHorizontal: CONSOLE_GUTTER, paddingBottom: spacing.xxl }}>
        <FadeInSection style={s.consoleHead}>
          <View style={{ flexShrink: 1 }}>
            <Text style={s.eyebrow}>CALENDRIER</Text>
            <View style={s.titleRow}>
              <WeekNavButton dir={-1} onPress={() => onWeek(-1)} />
              <Text style={s.title} accessibilityRole="header">
                Semaine du {weekTitle}
              </Text>
              <WeekNavButton dir={1} onPress={() => onWeek(1)} />
            </View>
            <Text style={s.summary}>
              {sessionCount} séance{plur(sessionCount)} · {slotCount} créneau{plur(slotCount)}
            </Text>
          </View>
          <Legend />
        </FadeInSection>

        <StateWrapper
          state={state}
          skeletonLines={6}
          emptyLabel="Rien de programmé"
          emptyMessage="Vos séances confirmées et vos créneaux ouverts à venir apparaîtront ici."
          emptySource="coaching_bookings"
          errorCause="Votre agenda n'a pas pu être chargé."
          onRetry={onRetry}
        >
          {/* La grille ENTIÈRE fond à l'arrivée, et re-fond à chaque changement
              de semaine (key) — les blocs restent en absolu, jamais cascadés. */}
          <FadeInSection key={weekStart.toISOString()} delay={80} style={s.gridRow}>
            {/* Gouttière horaire */}
            <View style={{ width: GUTTER_W }}>
              <View style={{ height: DAY_HEADER_H }} />
              <View style={{ height: gridHeight }}>
                {marks.map((h) => (
                  <Text
                    key={h}
                    style={[s.hourLabel, { top: (h - rangeStart) * HOUR_H - 6 }]}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  >
                    {h} h
                  </Text>
                ))}
              </View>
            </View>

            {/* Colonnes jour */}
            {days.map((day) => {
              const dayItems = weekItems.filter((it) => sameDay(it.start, day));
              const { placed, laneCount } = layoutDay(dayItems);
              const isToday = sameDay(day, now);
              return (
                <View key={day.toISOString()} style={s.dayCol}>
                  <View style={s.dayHeader}>
                    <Text style={[s.dayName, isToday && s.dayNameToday]}>
                      {weekdayAbbr(day).toUpperCase()}
                    </Text>
                    <Text style={[s.dayNum, isToday && s.dayNumToday]}>{day.getDate()}</Text>
                  </View>
                  <View style={[s.dayArea, { height: gridHeight }]}>
                    {marks.map((h) => (
                      <View
                        key={h}
                        style={[s.hairline, { top: (h - rangeStart) * HOUR_H }]}
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                      />
                    ))}
                    {placed.map(({ item, lane }) => (
                      <ConsoleBlock
                        key={item.key}
                        item={item}
                        lane={lane}
                        laneCount={laneCount}
                        rangeStart={rangeStart}
                        gridHeight={gridHeight}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </FadeInSection>
        </StateWrapper>
      </View>
    </Screen>
  );
}

function WeekNavButton({ dir, onPress }: { dir: -1 | 1; onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={dir < 0 ? 'Semaine précédente' : 'Semaine suivante'}
      hitSlop={10}
      onPress={onPress}
      style={s.navBtn}
    >
      <Text style={s.navChevron}>{dir < 0 ? '‹' : '›'}</Text>
    </PressableScale>
  );
}

function Legend() {
  return (
    <View style={s.legend} accessibilityElementsHidden importantForAccessibility="no">
      <View style={s.legendItem}>
        <View style={[s.legendDot, { backgroundColor: palette.coachAccent }]} />
        <Text style={s.legendTxt}>confirmé</Text>
      </View>
      <View style={s.legendItem}>
        <View style={[s.legendDot, { backgroundColor: palette.green }]} />
        <Text style={s.legendTxt}>ouvert</Text>
      </View>
    </View>
  );
}

function ConsoleBlock({
  item,
  lane,
  laneCount,
  rangeStart,
  gridHeight,
}: {
  item: AgendaItem;
  lane: number;
  laneCount: number;
  rangeStart: number;
  gridHeight: number;
}) {
  const s0 = fracHour(item.start);
  const e0 = Math.max(item.end ? fracHour(item.end) : s0 + MIN_HOURS, s0 + MIN_HOURS);
  const top = Math.max(0, (s0 - rangeStart) * HOUR_H);
  const rawBottom = Math.min(gridHeight, (e0 - rangeStart) * HOUR_H);
  const height = Math.max(MIN_BLOCK_H, rawBottom - top);

  const isSession = item.kind === 'session';
  const a11y = isSession
    ? `Séance confirmée. ${item.title}. ${frTimeRange(item.start, item.end)}.${
        item.circuit ? ` ${item.circuit}.` : ''
      }`
    : `Créneau ouvert. ${frTimeRange(item.start, item.end)}.${
        item.circuit ? ` ${item.circuit}.` : ''
      }${item.capacity ? ` ${item.capacity} place${plur(item.capacity)}.` : ''}`;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={item.onPress}
      style={[
        s.block,
        isSession ? s.blockSession : s.blockSlot,
        {
          top,
          height,
          left: `${(lane / laneCount) * 100}%`,
          width: `${100 / laneCount}%`,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[s.blockTitle, isSession ? s.blockTitleSession : s.blockTitleSlot]}
      >
        {isSession ? item.title : 'Ouvert'}
      </Text>
      <Text
        numberOfLines={1}
        style={[s.blockTime, isSession ? s.blockTimeSession : s.blockTimeSlot]}
      >
        {frTimeRange(item.start, item.end)}
      </Text>
    </PressableScale>
  );
}

// ── COMPAGNON (téléphone) : liste agenda ─────────────────────────────────────

function CompanionAgenda({
  items,
  state,
  onRetry,
}: {
  items: AgendaItem[];
  state: ScreenState;
  onRetry: () => void;
}) {
  const nextMonday = useMemo(() => addDays(mondayOf(new Date()), 7).getTime(), []);
  const thisWeek = items.filter((it) => it.start.getTime() < nextMonday);
  const upcoming = items.filter((it) => it.start.getTime() >= nextMonday);

  return (
    <Screen>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <FadeInSection>
          <Text style={[s.title, { marginTop: spacing.md }]} accessibilityRole="header">
            Agenda
          </Text>
        </FadeInSection>

        <View style={{ marginTop: spacing.lg }}>
          <StateWrapper
            state={state}
            skeletonLines={5}
            emptyLabel="Rien de programmé"
            emptyMessage="Vos séances confirmées et vos créneaux ouverts à venir apparaîtront ici."
            emptySource="coaching_bookings"
            errorCause="Votre agenda n'a pas pu être chargé."
            onRetry={onRetry}
          >
            <View style={{ gap: spacing.xl }}>
              <AgendaSection
                label="Cette semaine"
                items={thisWeek}
                emptyNote="Rien cette semaine."
              />
              <AgendaSection
                label="À venir"
                items={upcoming}
                emptyNote="Rien de programmé plus tard."
              />
            </View>
          </StateWrapper>
        </View>
      </View>
    </Screen>
  );
}

function AgendaSection({
  label,
  items,
  emptyNote,
}: {
  label: string;
  items: AgendaItem[];
  emptyNote: string;
}) {
  return (
    <View>
      <SectionLabel>{label}</SectionLabel>
      {/* Cartes cascadées — la note calme entre au même rythme qu'une carte. */}
      <Stagger style={{ marginTop: spacing.md, gap: spacing.sm }}>
        {items.length === 0 ? (
          <Text style={s.calmNote}>{emptyNote}</Text>
        ) : (
          items.map((it) => <AgendaRow key={it.key} item={it} />)
        )}
      </Stagger>
    </View>
  );
}

function AgendaRow({ item }: { item: AgendaItem }) {
  const isSession = item.kind === 'session';
  const today = new Date();
  const chipBottom = sameMonth(item.start, today) ? weekdayAbbr(item.start) : monthAbbr(item.start);

  const title = isSession ? `${item.title} · séance` : 'Créneau ouvert';
  const meta = [frTimeRange(item.start, item.end), item.circuit].filter(Boolean).join(' · ');

  const a11y = `${title}. ${meta}.${
    !isSession && item.capacity ? ` ${item.capacity} place${plur(item.capacity)}.` : ''
  }`;

  return (
    <Card onPress={item.onPress} accessibilityLabel={a11y} style={s.row}>
      <View style={s.rowInner}>
        <View style={[s.dateChip, isSession ? s.dateChipSession : s.dateChipSlot]}>
          <Text style={s.dateNum}>{String(item.start.getDate()).padStart(2, '0')}</Text>
          <Text style={s.dateAbbr}>{chipBottom}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.rowTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={s.rowMeta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        {!isSession && item.capacity ? (
          <View style={s.capPill}>
            <Text style={s.capTxt}>
              {item.capacity} place{plur(item.capacity)}
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // En-tête
  consoleHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingTop: spacing.md,
    marginBottom: spacing.xl,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.3,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.2,
  },
  summary: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.xs,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navChevron: { fontFamily: fonts.body, fontSize: 18, color: palette.creamSoft, lineHeight: 20 },

  // Légende
  legend: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center', paddingTop: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: palette.creamMute,
  },

  // Grille
  gridRow: { flexDirection: 'row', gap: 6 },
  hourLabel: {
    position: 'absolute',
    right: 8,
    fontFamily: fonts.mono,
    fontSize: 10,
    color: palette.faint,
  },
  dayCol: { flex: 1 },
  dayHeader: {
    height: DAY_HEADER_H,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayName: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: palette.faint,
  },
  dayNameToday: { color: palette.coachAccent },
  dayNum: {
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    color: palette.creamMute,
  },
  dayNumToday: { color: palette.cream },
  dayArea: {
    position: 'relative',
    backgroundColor: palette.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.separator,
    overflow: 'hidden',
  },
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: palette.separator,
  },

  // Blocs
  block: {
    position: 'absolute',
    borderRadius: radius.hud,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderLeftWidth: 2,
    overflow: 'hidden',
  },
  blockSession: { backgroundColor: palette.coachAccent, borderLeftColor: palette.red },
  blockSlot: { backgroundColor: OPEN_FILL, borderLeftColor: OPEN_BORDER },
  blockTitle: { fontFamily: fonts.bodySemi, fontSize: 11.5 },
  blockTitleSession: { color: palette.cream },
  blockTitleSlot: { color: palette.creamSoft },
  blockTime: { fontFamily: fonts.mono, fontSize: 9.5, marginTop: 1 },
  blockTimeSession: { color: 'rgba(245,245,247,0.82)' },
  blockTimeSlot: { color: palette.creamMute },

  // Compagnon — cartes agenda
  row: { paddingVertical: spacing.md },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dateChip: {
    width: 48,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  // Séance confirmée = liseré rouge d'identité coach ; créneau = neutre.
  dateChipSession: { borderLeftWidth: 2, borderLeftColor: palette.coachAccent },
  dateChipSlot: {},
  dateNum: {
    fontFamily: fonts.monoMedium,
    fontSize: 18,
    color: palette.cream,
    letterSpacing: -0.5,
  },
  dateAbbr: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: palette.creamMute,
  },
  rowTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  rowMeta: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
  },
  capPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: OPEN_FILL,
    borderWidth: 1,
    borderColor: OPEN_BORDER,
  },
  capTxt: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 0.4,
    color: palette.green,
  },
  calmNote: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic',
    color: palette.creamMute,
    paddingVertical: spacing.sm,
  },
});
