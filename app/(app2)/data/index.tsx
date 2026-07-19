/**
 * DATA HUB — porte analyse (app2), lot V2-L3 écran 1/4. Route : `/(app2)/data`.
 *
 * Remplace le placeholder `data.tsx` du lot L0. C'est la LISTE de VOS séances —
 * self-only, données réelles uniquement (Doctrine L3) :
 *  - header condensable « DATA » + eyebrow « VOS SÉANCES » ;
 *  - filtres `Chip` scrollables : Tous · <par circuit dynamique> · Cette saison ;
 *  - FlashList de `SessionCard` (chrono au millième, badge d'honnêteté de la
 *    donnée via `confidenceBadge`), entrée en `Stagger`, `PullToRefreshDial` ;
 *  - MODE COMPARAISON (le vieux TODO v1 enfin réglé) : appui long → sélection
 *    (haptic, bord accent, coche) bornée à DEUX via `toggleSelect` ; une barre
 *    flottante ressort en spring et mène au comparateur (`compareHref`) — jamais
 *    de gagnant, deux côtés symétriques ;
 *  - export de VOS données via `dataExportService`, avec un `Dial` de progression.
 *
 * Toute la logique pure vient de `@/features/data/dataHubLogic` (testée). L'écran
 * ne fabrique aucune valeur : une donnée absente reste absente (« — » / états
 * StateView), jamais un zéro inventé. La prod n'ayant presque pas de trames, les
 * états vides doivent rester dignes.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Chip,
  colors,
  CondensingHeaderBar,
  Dial,
  haptic,
  motionTokens,
  PressScale,
  PullToRefreshDial,
  radius,
  SessionCard,
  space,
  staggerEntering,
  StateView,
  tabBarSpace,
  typo,
  useCondensingHeader,
  useDoorTransition,
} from '@/ui/v2';
import {
  canCompare,
  circuitFilters,
  compareHref,
  confidenceBadge,
  filterSessions,
  toggleSelect,
  type SessionFilter,
} from '@/features/data/dataHubLogic';
import { fetchAllSessions } from '@/services/sessionsService';
import { exportAndShareMyData } from '@/services/dataExportService';
import { useAuthStore } from '@/store/useAuthStore';

// Le type de session vient du service (mirroir de `TelemetrySession`) — pas
// d'import de type transverse, l'écran reste auto-porté.
type Session = Awaited<ReturnType<typeof fetchAllSessions>>[number];

/**
 * Vue normalisée en camelCase attendue par la logique pure du hub
 * (`circuitFilters`, `filterSessions`) : miroir exact des champs snake_case.
 */
type HubSession = Session & {
  circuitId: string | null;
  circuitName: string | null;
  startedAt: string | null;
};

type ConfidenceLevel = ReturnType<typeof confidenceBadge>;

/** État de chargement de la liste — strict (une panne DB devient un état erreur). */
type LoadStatus = 'loading' | 'ready' | 'error';

/** Date courte fr-FR (« 4 juil. 2026 ») — inlinée pour garder l'écran auto-porté. */
function formatDay(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function DataHubScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const header = useCondensingHeader();
  const userId = useAuthStore((s) => s.profile?.id ?? null);

  const [status, setStatus] = useState<LoadStatus>('loading');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<SessionFilter>({ kind: 'all' });

  // Mode comparaison : sélection bornée à deux (aucun gagnant).
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  // Export : le service est atomique (pas de progression réelle) → cadran
  // indéterminé qui monte pendant l'attente. // TODO device-tune : brancher une
  // vraie progression le jour où `dataExportService` en publie une.
  const [exporting, setExporting] = useState(false);
  const [exportPct, setExportPct] = useState(0);
  const exportTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // -------------------------------------------------------------------------
  // Chargement (strict : erreur DB → état erreur + Réessayer, jamais un [] muet).
  // -------------------------------------------------------------------------
  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!userId) return; // auth pas encore résolue : on reste en loading.
      if (mode === 'initial') setStatus('loading');
      else setRefreshing(true);
      try {
        const rows = await fetchAllSessions(userId, { strict: true });
        setSessions(rows);
        setStatus('ready');
      } catch {
        setStatus('error');
      } finally {
        if (mode === 'refresh') setRefreshing(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  // Nettoyage du minuteur d'export au démontage.
  useEffect(
    () => () => {
      if (exportTimer.current) clearInterval(exportTimer.current);
    },
    []
  );

  // La sélection vidée referme le mode comparaison.
  useEffect(() => {
    if (selected.length === 0) setSelectionMode(false);
  }, [selected]);

  // -------------------------------------------------------------------------
  // Dérivés purs (logique de hub testée).
  // -------------------------------------------------------------------------
  const hubSessions = useMemo<HubSession[]>(
    () =>
      sessions.map((s) => ({
        ...s,
        circuitId: s.circuit_id,
        circuitName: s.circuit_name,
        startedAt: s.started_at,
      })),
    [sessions]
  );

  const circuitChips = useMemo(() => circuitFilters(hubSessions), [hubSessions]);
  const filtered = useMemo(() => filterSessions(hubSessions, filter), [hubSessions, filter]);
  const seasonYear = useMemo(() => new Date().getFullYear(), []);

  // -------------------------------------------------------------------------
  // Sélection / comparaison.
  // -------------------------------------------------------------------------
  const onCardLongPress = useCallback((id: string) => {
    haptic('arm');
    setSelectionMode(true);
    setSelected((prev) => (prev.includes(id) ? prev : toggleSelect(prev, id)));
  }, []);

  const onCardPress = useCallback(
    (id: string) => {
      if (selectionMode) {
        haptic('tap');
        setSelected((prev) => toggleSelect(prev, id));
      } else {
        // La séance (écran pivot) arrive dans un sous-lot L3 ultérieur ;
        // le lien est câblé dès maintenant (comme `compareHref`).
        router.push(`/data/session/${id}` as never);
      }
    },
    [selectionMode]
  );

  const onCancelSelection = useCallback(() => {
    setSelected([]);
    setSelectionMode(false);
  }, []);

  const onCompare = useCallback(() => {
    const href = compareHref(selected);
    if (!href) return;
    haptic('tap');
    router.push(href as never);
  }, [selected]);

  // Barre flottante : ressort en spring quand le mode s'active.
  const barProgress = useSharedValue(0);
  useEffect(() => {
    barProgress.value = withSpring(selectionMode ? 1 : 0, motionTokens.spring);
  }, [selectionMode, barProgress]);
  const barStyle = useAnimatedStyle(() => ({
    opacity: barProgress.value,
    transform: [{ translateY: (1 - barProgress.value) * 120 }],
  }));

  // -------------------------------------------------------------------------
  // Export de VOS données (droit à la portabilité).
  // -------------------------------------------------------------------------
  const runExport = useCallback(async () => {
    if (exporting || !userId) return;
    setExporting(true);
    setExportPct(0);
    exportTimer.current = setInterval(() => {
      setExportPct((p) => (p < 90 ? p + 6 : p));
    }, 120);
    try {
      const res = await exportAndShareMyData(userId);
      if (!res.ok) haptic('warn');
    } catch {
      haptic('warn');
    } finally {
      if (exportTimer.current) {
        clearInterval(exportTimer.current);
        exportTimer.current = null;
      }
      setExportPct(100);
      setTimeout(() => setExporting(false), 350);
    }
  }, [exporting, userId]);

  // -------------------------------------------------------------------------
  // Rendu de la liste.
  // -------------------------------------------------------------------------
  const renderItem = useCallback(
    ({ item, index }: { item: HubSession; index: number }) => {
      const level = confidenceBadge({
        lapCount: item.lap_count,
        hasFrames: item.total_frames > 0,
        distanceKm: item.distance_km,
      });
      const circuit =
        item.circuit_name && item.circuit_name.trim().length > 0 ? item.circuit_name : 'Séance';
      const chronoMs = item.best_lap_seconds !== null ? item.best_lap_seconds * 1000 : undefined;
      const isSelected = selected.includes(item.id);

      return (
        <Animated.View entering={staggerEntering(index)} style={styles.rowWrap}>
          <Pressable
            onPress={() => onCardPress(item.id)}
            onLongPress={() => onCardLongPress(item.id)}
            delayLongPress={280}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={
              selectionMode
                ? `${circuit}. ${isSelected ? 'Sélectionnée' : 'Non sélectionnée'}. Toucher pour ${
                    isSelected ? 'retirer de la comparaison' : 'ajouter à la comparaison'
                  }`
                : `${circuit}. Ouvrir la séance. Appui long pour comparer`
            }
          >
            <SessionCard
              circuit={circuit}
              dateLabel={formatDay(item.started_at)}
              chronoMs={chronoMs}
              style={isSelected ? styles.cardSelected : undefined}
            />
            <View style={styles.badgeSlot} pointerEvents="none">
              <ConfidenceDot level={level} />
            </View>
            {selectionMode ? (
              <View
                style={[styles.checkSlot, isSelected && styles.checkSlotOn]}
                pointerEvents="none"
              >
                {isSelected ? <Text style={styles.check}>✓</Text> : null}
              </View>
            ) : null}
          </Pressable>
        </Animated.View>
      );
    },
    [onCardPress, onCardLongPress, selectionMode, selected]
  );

  // En-tête déployé (titre + eyebrow + filtres) — sert de ListHeaderComponent
  // ET d'en-tête statique dans les états non nominaux (scrollY reste à 0,
  // headerStyle = pleine opacité).
  const bigHeader = (
    <View style={styles.headerBlock}>
      <Animated.View style={header.headerStyle}>
        <Text style={styles.eyebrow}>VOS SÉANCES</Text>
        <Animated.Text style={[styles.title, header.titleStyle]}>DATA</Animated.Text>
      </Animated.View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        <Chip
          label="Tous"
          active={filter.kind === 'all'}
          onPress={() => setFilter({ kind: 'all' })}
        />
        {circuitChips.map((c) => (
          <Chip
            key={c.id}
            label={c.label}
            active={filter.kind === 'circuit' && filter.circuitId === c.id}
            onPress={() => setFilter({ kind: 'circuit', circuitId: c.id })}
          />
        ))}
        <Chip
          label="Cette saison"
          active={filter.kind === 'season'}
          onPress={() => setFilter({ kind: 'season', year: seasonYear })}
        />
      </ScrollView>
    </View>
  );

  // Corps : loading / error / vide / liste.
  let body: ReactNode;
  if (status === 'loading') {
    body = (
      <View style={styles.staticWrap}>
        {bigHeader}
        <StateView state="loading" shape="list" style={styles.loading} />
      </View>
    );
  } else if (status === 'error') {
    body = (
      <View style={styles.staticWrap}>
        {bigHeader}
        <StateView
          state="error"
          errorMessage="Vos séances n'ont pas pu être chargées."
          onRetry={() => void load('initial')}
          style={styles.stateFill}
        />
      </View>
    );
  } else if (filtered.length === 0) {
    body = (
      <View style={styles.staticWrap}>
        {bigHeader}
        <StateView
          state="empty"
          emptyMessage="Vos séances apparaîtront ici après votre première journée."
          style={styles.stateFill}
        />
      </View>
    );
  } else {
    body = (
      <PullToRefreshDial refreshing={refreshing} onRefresh={() => void load('refresh')}>
        {(scrollProps) => {
          const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            scrollProps.onScroll(e);
            header.scrollY.value = e.nativeEvent.contentOffset.y;
          };
          return (
            <FlashList
              data={filtered}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              estimatedItemSize={96}
              ListHeaderComponent={bigHeader}
              showsVerticalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={scrollProps.scrollEventThrottle}
              bounces={scrollProps.bounces}
              overScrollMode={scrollProps.overScrollMode}
              contentContainerStyle={{
                paddingHorizontal: space.xl,
                paddingTop: insets.top + space.md,
                paddingBottom: tabBarSpace(insets.bottom) + space.xxl,
              }}
            />
          );
        }}
      </PullToRefreshDial>
    );
  }

  return (
    <Animated.View style={[styles.root, door]}>
      {body}

      {/* Barre condensée « DATA » (patron Airbnb) — invisible tant qu'on n'a pas scrollé. */}
      <CondensingHeaderBar
        condensedStyle={header.condensedStyle}
        height={52 + insets.top}
        style={{ paddingTop: insets.top }}
      >
        <Text style={styles.condensedTitle}>DATA</Text>
      </CondensingHeaderBar>

      {/* Action export — toujours visible, au-dessus de la barre condensée. */}
      <View style={[styles.exportSlot, { top: insets.top + space.sm }]} pointerEvents="box-none">
        <PressScale
          onPress={runExport}
          disabled={exporting}
          accessibilityLabel="Exporter mes données"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={styles.exportPill}>
            <Text style={styles.exportLabel}>EXPORTER</Text>
          </View>
        </PressScale>
      </View>

      {/* Barre flottante de comparaison — ressort en spring en mode sélection. */}
      <Animated.View
        style={[styles.compareBar, { bottom: tabBarSpace(insets.bottom) }, barStyle]}
        pointerEvents={selectionMode ? 'auto' : 'none'}
      >
        <PressScale onPress={onCancelSelection} accessibilityLabel="Annuler la sélection">
          <Text style={styles.compareCancel}>Annuler</Text>
        </PressScale>
        <Text style={styles.compareCount}>{selected.length}/2 sélectionnées</Text>
        <PressScale
          onPress={onCompare}
          disabled={!canCompare(selected)}
          accessibilityLabel="Comparer les deux séances"
        >
          <View style={[styles.compareBtn, !canCompare(selected) && styles.compareBtnOff]}>
            <Text
              style={[styles.compareBtnLabel, !canCompare(selected) && styles.compareBtnLabelOff]}
            >
              COMPARER
            </Text>
          </View>
        </PressScale>
      </Animated.View>

      {/* Voile d'export avec cadran de progression (indéterminé, voir TODO). */}
      {exporting ? (
        <View style={styles.exportOverlay}>
          <View style={styles.exportCard}>
            <Dial value={exportPct} max={100} size="m" label="Export" unit="%" />
            <Text style={styles.exportNote}>Préparation de vos données</Text>
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Pastille d'honnêteté de la donnée (qualifie la DONNÉE, jamais le pilote).
// Pleine (text.mid) · partielle (anneau text.low) · creuse (anneau text.dim).
// Ni accent (réservé à la sélection) ni QDI (réservé aux données) ici.
// ---------------------------------------------------------------------------
function ConfidenceDot({ level }: { level: ConfidenceLevel }) {
  const label =
    level === 'full'
      ? 'Données complètes'
      : level === 'partial'
        ? 'Données partielles'
        : 'Données absentes';
  return (
    <View style={styles.dotBox} accessible accessibilityLabel={label}>
      {level === 'full' ? (
        <View style={styles.dotFull} />
      ) : level === 'partial' ? (
        <View style={styles.dotRingLow}>
          <View style={styles.dotInnerLow} />
        </View>
      ) : (
        <View style={styles.dotRingDim} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles — tokens V2 uniquement.
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  staticWrap: {
    flex: 1,
    paddingHorizontal: space.xl,
    paddingTop: 0,
  },

  // En-tête déployé
  headerBlock: {
    paddingTop: space.md,
    marginBottom: space.md,
  },
  eyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  title: {
    fontFamily: typo.display,
    fontSize: 22,
    letterSpacing: 2,
    color: colors.text.hi,
    marginTop: space.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingTop: space.lg,
    paddingBottom: space.xs,
  },
  condensedTitle: {
    fontFamily: typo.display,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.text.hi,
  },

  // Export
  exportSlot: {
    position: 'absolute',
    right: space.xl,
    zIndex: 12,
  },
  exportPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    backgroundColor: colors.bg.card2,
  },
  exportLabel: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.text.mid,
  },
  exportOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  exportCard: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    paddingVertical: space.xl,
    paddingHorizontal: space.xxl,
    alignItems: 'center',
    gap: space.md,
  },
  exportNote: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.text.mid,
  },

  // États
  loading: {
    marginTop: space.lg,
  },
  stateFill: {
    flex: 1,
    justifyContent: 'center',
  },

  // Cartes
  rowWrap: {
    position: 'relative',
    marginBottom: space.md,
  },
  cardSelected: {
    borderColor: colors.accent,
    borderWidth: 1.5,
  },
  badgeSlot: {
    position: 'absolute',
    right: space.sm,
    bottom: space.sm,
  },
  checkSlot: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border.strong,
    backgroundColor: colors.bg.scrim,
  },
  checkSlotOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  check: {
    fontFamily: typo.bodySemi,
    fontSize: 13,
    lineHeight: 16,
    color: colors.text.hi,
  },

  // Pastille d'honnêteté
  dotBox: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotFull: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.text.mid,
  },
  dotRingLow: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.text.low,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInnerLow: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text.low,
  },
  dotRingDim: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.text.dim,
  },

  // Barre flottante de comparaison
  compareBar: {
    position: 'absolute',
    left: space.xl,
    right: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg.card2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    zIndex: 15,
  },
  compareCancel: {
    fontFamily: typo.bodyMedium,
    fontSize: 13,
    color: colors.text.mid,
  },
  compareCount: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.text.hi,
  },
  compareBtn: {
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: colors.text.hi,
  },
  compareBtnOff: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
  },
  compareBtnLabel: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.bg.base,
  },
  compareBtnLabelOff: {
    color: colors.text.low,
  },
});
