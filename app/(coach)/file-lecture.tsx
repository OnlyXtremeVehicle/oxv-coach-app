/**
 * Coach — File de lecture (handoff §12 `coach/02-file-lecture`, sur `coach_queue`).
 *
 * RESPONSIVE DEUX FORMATS (décision fondateur 2026-07-13) : le MÊME écran
 * s'adapte selon la largeur.
 *   - CONSOLE tablette (≥ COACH_CONSOLE_MIN_WIDTH) : table dense fidèle à la
 *     maquette — en-tête (eyebrow + titre + filtres à droite), ligne de colonnes
 *     (PILOTE · CIRCUIT · REÇU), rangées à ligne unique + flèche d'entrée Studio.
 *     Le rail (CoachRail) est fourni par `_layout.tsx`.
 *   - COMPAGNON téléphone (< seuil) : AppBar + une colonne de cartes compactes.
 *
 * Les séances des pilotes consentis, avec un statut de lecture EXPLICITE et
 * persistant : à lire / lues / archivées (filtrable, marquable via `coach_queue`).
 * La flèche ouvre le Studio (lecture de CETTE séance, entrée directe §12).
 * « À votre rythme » : la file aide le coach, elle ne le presse pas. Identité
 * coach = rouge #E23A4E sur l'actif et l'action ; l'or reste réservé au chrono
 * (absent ici : la file ne porte ni meilleur tour ni régularité — cf. rapport).
 * Vouvoiement, zéro emoji, descriptif jamais prescriptif. Lecture seule côté
 * pilote — rien de ceci ne lui est exposé.
 *
 * Motion (passe transversale, kit src/components/motion) : en-tête en fondu,
 * rangées en cascade (Stagger), toutes les actions en PressableScale. Durées et
 * courbes = celles du kit (ease-out cubic), reduce-motion respecté par le kit.
 */

import { useCallback, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { FadeInSection, PressableScale, Stagger } from '@/components/motion';
import * as haptics from '@/lib/haptics';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import {
  groupQueue,
  ordonnePourLecture,
  seanceParLaquelleCommencer,
  type QueueItem,
  type QueueStatus,
} from '@/services/coachQueueLogic';
import { loadCoachQueue, setQueueStatus } from '@/services/coachQueueService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatDateShort } from '@/utils/format';

const { palette, fonts, fontSize, spacing, radius } = theme;

const AVATAR = 34;
const RECU_W = 100;
const TRAIL_W = 40;
/** Nombre de « lues récemment » montrées sous le filtre « à lire » (teaser). */
const RECENT_READ_LIMIT = 4;

const FILTERS: { key: QueueStatus; label: string }[] = [
  { key: 'unread', label: 'À lire' },
  { key: 'read', label: 'Lues' },
  { key: 'archived', label: 'Archivées' },
];

const EMPTY: Record<QueueStatus, string> = {
  unread: 'Rien à lire pour l’instant. Les séances de vos pilotes apparaîtront ici.',
  read: 'Aucune séance lue pour l’instant.',
  archived: 'Aucune séance archivée.',
};

export default function FileLectureScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [items, setItems] = useState<QueueItem[]>([]);
  const [filter, setFilter] = useState<QueueStatus>('unread');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    loadCoachQueue()
      .then((rows) => {
        if (!cancelled) {
          setItems(rows);
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

  const mark = useCallback(
    (item: QueueItem, status: QueueStatus) => {
      haptics.tap();
      // Optimiste : reflète tout de suite, recharge en cas d'échec.
      setItems((prev) => prev.map((i) => (i.sessionId === item.sessionId ? { ...i, status } : i)));
      setQueueStatus({ sessionId: item.sessionId, pilotId: item.pilotId, status }).then((res) => {
        if (!res.ok) reload();
      });
    },
    [reload]
  );

  const groups = groupQueue(items);
  /**
   * LA séance par laquelle commencer — une seule, la plus ancienne en attente.
   *
   * Le liseré était posé sur TOUTES les séances non lues : un mur rouge qui
   * n'aidait pas à choisir. Si tout est signalé, rien ne l'est. Il désigne
   * désormais un point de départ, et ne presse personne (jalon 6, phase 5).
   */
  const aCommencer = seanceParLaquelleCommencer(items);
  // La file arrive du plus récent au plus ancien : sans ce replacement, la
  // séance désignée — la plus ANCIENNE — se retrouvait en bas de l'écran, et
  // « à commencer par celle-ci » pointait vers la dernière ligne.
  const nonLues = ordonnePourLecture(groups.unread, aCommencer);
  // Même ordre sur les deux chemins : sinon la séance désignée changerait de
  // place selon l'onglet, et « à commencer par celle-ci » perdrait son sens.
  const primary = filter === 'unread' ? nonLues : groups[filter];
  // Sous « à lire », on montre en second un rappel des dernières lues (maquette
  // « LUES RÉCEMMENT ») — composition d'écran, aucune requête supplémentaire.
  const hasRecentRead = filter === 'unread' && groups.read.length > 0;
  const listState: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : primary.length === 0 && !hasRecentRead
        ? 'empty'
        : 'nominal';

  const renderFilters = () => (
    <View style={s.filterRow} accessibilityRole="tablist">
      {FILTERS.map((f) => {
        const on = f.key === filter;
        return (
          <PressableScale
            key={f.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${f.label}, ${groups.counts[f.key]}`}
            onPress={() => setFilter(f.key)}
            style={[s.chip, !isConsole && s.chipGrow, on && s.chipActive]}
          >
            <Text style={[s.chipLabel, on && s.chipLabelActive]}>
              {f.label} · {groups.counts[f.key]}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );

  const renderList = () => (
    <StateWrapper
      state={listState}
      skeletonLines={4}
      emptyLabel="Rien ici"
      emptyMessage={EMPTY[filter]}
      emptySource="telemetry_sessions"
      errorCause="La file n'a pas pu être chargée."
      onRetry={reload}
    >
      {isConsole ? <ColumnHeader /> : null}
      {/* Cascade d'entrée : chaque rangée est un enfant direct du Stagger
          (tableaux plats, pas de fragments — sinon la cascade ne les voit pas). */}
      <Stagger style={{ gap: spacing.sm }}>
        {filter === 'unread'
          ? [
              ...(groups.unread.length === 0
                ? [
                    <Text key="calm" style={s.calmNote}>
                      Rien à lire pour l’instant.
                    </Text>,
                  ]
                : nonLues.map((item) => (
                    <QueueRow
                      key={item.sessionId}
                      item={item}
                      isConsole={isConsole}
                      onMark={mark}
                      estLePointDeDepart={item.sessionId === aCommencer}
                    />
                  ))),
              ...(groups.read.length > 0
                ? [
                    <RecentlyReadDivider key="recent-divider" />,
                    ...groups.read
                      .slice(0, RECENT_READ_LIMIT)
                      .map((item) => (
                        <QueueRow
                          key={item.sessionId}
                          item={item}
                          isConsole={isConsole}
                          onMark={mark}
                        />
                      )),
                  ]
                : []),
            ]
          : primary.map((item) => (
              <QueueRow
                key={item.sessionId}
                item={item}
                isConsole={isConsole}
                onMark={mark}
                estLePointDeDepart={item.sessionId === aCommencer}
              />
            ))}
      </Stagger>
    </StateWrapper>
  );

  return (
    <Screen>
      {isConsole ? null : <AppBar title="FILE DE LECTURE" onBack={() => router.back()} />}
      <View style={isConsole ? s.consolePad : s.companionPad}>
        {isConsole ? (
          <FadeInSection style={s.consoleHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>FILE DE LECTURE</Text>
              <Text style={s.title} accessibilityRole="header">
                {titleFor(filter, groups.counts)}
              </Text>
            </View>
            {renderFilters()}
          </FadeInSection>
        ) : (
          <FadeInSection>
            <Text style={[s.eyebrow, { marginTop: spacing.sm }]}>À VOTRE RYTHME</Text>
            <Text style={s.title} accessibilityRole="header">
              {titleFor(filter, groups.counts)}
            </Text>
            <View style={{ marginTop: spacing.lg }}>{renderFilters()}</View>
          </FadeInSection>
        )}

        <View style={{ marginTop: spacing.lg }}>{renderList()}</View>
      </View>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ColumnHeader() {
  return (
    <View
      style={s.colHead}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={{ width: AVATAR }} />
      <Text style={[s.colHeadTxt, { flex: 1.4 }]}>PILOTE</Text>
      <Text style={[s.colHeadTxt, { flex: 1.2 }]}>CIRCUIT</Text>
      <Text style={[s.colHeadTxt, { width: RECU_W }]}>REÇU</Text>
      <View style={{ width: TRAIL_W }} />
    </View>
  );
}

function RecentlyReadDivider() {
  return (
    <View style={s.divider}>
      <Text style={s.dividerTxt} accessibilityRole="header">
        LUES RÉCEMMENT
      </Text>
      <View style={s.dividerLine} />
    </View>
  );
}

function QueueRow({
  item,
  isConsole,
  onMark,
  estLePointDeDepart,
}: {
  item: QueueItem;
  isConsole: boolean;
  onMark: (item: QueueItem, status: QueueStatus) => void;
  /** Vrai pour UNE seule ligne de la file : celle par laquelle commencer. */
  estLePointDeDepart?: boolean;
}) {
  const recu = receivedLabel(item.startedAt);
  const circuit = item.circuitName ?? '—';
  const lapLabel = item.lapCount != null ? `${item.lapCount} tours` : null;
  const muted = item.status !== 'unread';

  const openStudio = () =>
    router.push({ pathname: '/(coach)/studio', params: { sessionId: item.sessionId } } as never);

  // Le liseré est une information visuelle : sans cette mention, un lecteur
  // d'écran ne saurait pas laquelle est désignée.
  const depart = estLePointDeDepart ? 'À commencer par celle-ci. ' : '';
  const a11y = `${depart}${item.pilotName}. ${item.circuitName ?? 'circuit inconnu'}. Reçu ${recu}. Ouvrir le studio.`;

  return (
    <View style={[s.rowCard, estLePointDeDepart === true && s.rowCardUnread]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={a11y}
        onPress={openStudio}
        style={s.rowMain}
      >
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>{initialsOf(item.pilotName)}</Text>
        </View>

        {isConsole ? (
          <>
            <View style={{ flex: 1.4 }}>
              <Text numberOfLines={1} style={[s.name, muted && s.nameMuted]}>
                {item.pilotName}
              </Text>
              {lapLabel ? (
                <Text numberOfLines={1} style={s.lapSub}>
                  {lapLabel}
                </Text>
              ) : null}
            </View>
            <Text numberOfLines={1} style={[s.cellMuted, { flex: 1.2 }]}>
              {circuit}
            </Text>
            <Text numberOfLines={1} style={[s.cellMuted, { width: RECU_W }]}>
              {recu}
            </Text>
          </>
        ) : (
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[s.name, muted && s.nameMuted]}>
              {item.pilotName}
            </Text>
            <Text numberOfLines={1} style={s.metaLine}>
              {[circuit, lapLabel, recu].filter(Boolean).join(' · ')}
            </Text>
          </View>
        )}

        <View style={s.trailCol} accessibilityElementsHidden importantForAccessibility="no">
          <Trailing status={item.status} />
        </View>
      </PressableScale>

      {/* Marquage + accès — actions sobres selon le statut courant. */}
      <View style={s.actions}>
        <RowAction
          label="Rapport"
          onPress={() =>
            router.push({
              pathname: '/(coach)/rapport',
              params: { sessionId: item.sessionId, startedAt: item.startedAt },
            } as never)
          }
        />
        {item.status !== 'read' ? (
          <RowAction label="Marquer lue" onPress={() => onMark(item, 'read')} />
        ) : null}
        {item.status !== 'unread' ? (
          <RowAction label="À relire" onPress={() => onMark(item, 'unread')} />
        ) : null}
        {item.status !== 'archived' ? (
          <RowAction label="Archiver" onPress={() => onMark(item, 'archived')} />
        ) : null}
        <RowAction
          label="Fiche"
          onPress={() =>
            router.push({ pathname: '/(coach)/pilote/[id]', params: { id: item.pilotId } } as never)
          }
        />
      </View>
    </View>
  );
}

/** Indicateur de fin de rangée (décoratif) : flèche rouge d'entrée si à lire,
 *  coche si lue, flèche neutre si archivée. Le tap Studio porte sur la rangée. */
function Trailing({ status }: { status: QueueStatus }) {
  if (status === 'unread') {
    return (
      <View style={s.trailUnread}>
        <Text style={s.trailArrowOn}>→</Text>
      </View>
    );
  }
  if (status === 'read') {
    return <Text style={s.trailCheck}>✓</Text>;
  }
  return <Text style={s.trailArrowMuted}>→</Text>;
}

function RowAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={onPress}
      style={s.action}
    >
      <Text style={s.actionText}>{label}</Text>
    </PressableScale>
  );
}

// ============================================================================
// Helpers (purs, affichage seulement — dérivés de données réelles)
// ============================================================================

function plur(n: number): string {
  return n >= 2 ? 's' : '';
}

function titleFor(
  filter: QueueStatus,
  counts: { unread: number; read: number; archived: number }
): string {
  const n = counts[filter];
  if (filter === 'unread') {
    return n === 0 ? 'Rien à lire pour l’instant.' : `${n} séance${plur(n)} à lire.`;
  }
  if (filter === 'read') {
    return n === 0 ? 'Aucune séance lue.' : `${n} séance${plur(n)} lue${plur(n)}.`;
  }
  return n === 0 ? 'Aucune séance archivée.' : `${n} séance${plur(n)} archivée${plur(n)}.`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase() || '·';
}

/** Ancienneté lisible de la séance (colonne REÇU). Dérivée de `started_at` —
 *  seul horodatage porté par la file (pas de timestamp de réception distinct). */
function receivedLabel(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const diffMs = Date.now() - t;
  if (diffMs < 0) return formatDateShort(iso);
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 2) return 'hier';
  if (d < 7) return `il y a ${d} j`;
  return formatDateShort(iso);
}

const s = StyleSheet.create({
  consolePad: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  companionPad: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl },
  consoleHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.lg,
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

  // Filtres
  filterRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipGrow: { flex: 1 },
  // Actif = rouge coach (identité de rôle sur l'actif — jamais le blanc/or pilote).
  chipActive: { backgroundColor: palette.coachAccent, borderColor: palette.coachAccent },
  chipLabel: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  chipLabelActive: { color: palette.cream },

  // En-tête de colonnes (console)
  colHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  colHeadTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.faint,
  },

  // Rangée
  rowCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    backgroundColor: palette.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowCardUnread: { borderLeftWidth: 2, borderLeftColor: palette.coachAccent },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52 },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.5, color: palette.creamSoft },
  name: { fontFamily: fonts.bodyMedium, fontSize: fontSize.bodyLg, color: palette.cream },
  nameMuted: { color: palette.creamMute },
  lapSub: {
    fontFamily: fonts.mono,
    fontSize: fontSize.micro,
    color: palette.creamMute,
    marginTop: 1,
  },
  cellMuted: { fontFamily: fonts.mono, fontSize: fontSize.small, color: palette.creamMute },
  metaLine: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
  },

  trailCol: { width: TRAIL_W, alignItems: 'flex-end', justifyContent: 'center' },
  trailUnread: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: palette.coachAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailArrowOn: { fontFamily: fonts.mono, fontSize: 15, color: palette.night },
  trailArrowMuted: { fontFamily: fonts.mono, fontSize: 15, color: palette.faint },
  trailCheck: { fontFamily: fonts.mono, fontSize: 15, color: palette.creamMute },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.separator,
  },
  action: { minHeight: 36, justifyContent: 'center' },
  actionText: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  dividerTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.faint,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: palette.separator },
  calmNote: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic',
    color: palette.creamMute,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
