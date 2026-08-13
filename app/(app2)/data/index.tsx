/**
 * DATA HUB — porte analyse (app2), lot V2-L3 écran 1/4. Route : `/(app2)/data`.
 *
 * Remplace le placeholder `data.tsx` du lot L0. C'est la LISTE de VOS séances —
 * self-only, données réelles uniquement (Doctrine L3) :
 *  - header condensable « DATA » + eyebrow « VOS SÉANCES » ;
 *  - filtres `Chip` scrollables : Tous · <par PAIRE circuit-véhicule roulée> ·
 *    Cette saison. La puce par circuit seul est tombée le 12/08/2026 : deux
 *    voitures sur le même circuit produisent des chronos qui ne se comparent
 *    pas, et une puce unique les mélangeait en silence ;
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

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
  haptic,
  motionTokens,
  msToLapLabel,
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
  useReduceMotion,
} from '@/ui/v2';
import {
  canCompare,
  compareHref,
  confidenceBadge,
  filterSessions,
  toggleSelect,
  type SessionFilter,
} from '@/features/data/dataHubLogic';
import { pairesRoulees } from '@/features/data/pairesLogic';
import { vehicleName } from '@/features/vous/garageLogic';
import { listMyVehicles, type Vehicle } from '@/services/garageService';
import { messageHorsLigne } from '@/features/data/horsLigneLogic';
import { fetchAllSessions, seancesDuCache } from '@/services/sessionsService';
import {
  SaisonCircuitSheet,
  SaisonSections,
  useSaisonData,
} from '@/features/data/saison/SaisonSections';
import { useAuthStore } from '@/store/useAuthStore';

// Le type de session vient du service (mirroir de `TelemetrySession`) — pas
// d'import de type transverse, l'écran reste auto-porté.
type Session = Awaited<ReturnType<typeof fetchAllSessions>>[number];

/**
 * Vue normalisée en camelCase attendue par la logique pure du hub
 * (`pairesRoulees`, `filterSessions`) : miroir exact des champs snake_case.
 */
type HubSession = Session & {
  circuitId: string | null;
  circuitName: string | null;
  vehicleId: string | null;
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

  // La saison, chargée une fois et partagée par les sections et la feuille.
  const saison = useSaisonData();

  const [status, setStatus] = useState<LoadStatus>('loading');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<SessionFilter>({ kind: 'all' });
  // Le garage ne sert QU'À NOMMER les véhicules des puces de paire.
  const [garage, setGarage] = useState<Vehicle[]>([]);
  useEffect(() => {
    let annule = false;
    listMyVehicles()
      .then((rows) => {
        if (!annule) setGarage(rows);
      })
      .catch(() => undefined);
    return () => {
      annule = true;
    };
  }, []);

  // Mode comparaison : sélection bornée à deux (aucun gagnant).
  /**
   * ISO de la dernière lecture réseau réussie, quand la liste affichée vient de
   * la copie locale. `null` = liste fraîche.
   */
  const [horsLigneDepuis, setHorsLigneDepuis] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

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
        setHorsLigneDepuis(null);
        setStatus('ready');
      } catch {
        /**
         * PAS DE RÉSEAU N'EST PAS PAS DE SÉANCES.
         *
         * L'écran basculait en état d'erreur, avec un bouton « Réessayer ». Au
         * retour de Bouteville — rase campagne — le pilote venait de rouler,
         * ses séances étaient en base, ses trames sur son téléphone, et il ne
         * pouvait rien regarder.
         *
         * On sert donc la dernière liste connue, ET ON DIT qu'elle date :
         * présenter une donnée d'hier comme celle du jour serait le défaut
         * inverse, et le plus grave des deux. Sans copie locale — un téléphone
         * qui n'a jamais lu la liste — l'état d'erreur reste le bon.
         */
        const copie = seancesDuCache(userId);
        if (copie !== null) {
          setSessions(copie.seances);
          setHorsLigneDepuis(copie.capturéLe);
          setStatus('ready');
        } else {
          setStatus('error');
        }
      } finally {
        if (mode === 'refresh') setRefreshing(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

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
        vehicleId: s.vehicle_id,
        startedAt: s.started_at,
      })),
    [sessions]
  );

  /**
   * Les puces sont des PAIRES réellement roulées, jamais le produit des
   * circuits par les véhicules. Le garage ne sert qu'à nommer : son échec
   * n'empêche pas de filtrer, `pairesRoulees` sait dire un véhicule qu'elle
   * ne peut pas nommer.
   */
  const paireChips = useMemo(() => {
    const nomDe = (id: string): string | null => {
      const v = garage.find((x) => x.id === id);
      return v ? vehicleName(v) : null;
    };
    return pairesRoulees(hubSessions, nomDe);
  }, [hubSessions, garage]);
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

  // Barre flottante : ressort en spring quand le mode s'active. Réglage
  // « animations réduites » honoré comme partout dans le kit : état final direct.
  const reduce = useReduceMotion();
  const barProgress = useSharedValue(0);
  useEffect(() => {
    barProgress.value = reduce
      ? selectionMode
        ? 1
        : 0
      : withSpring(selectionMode ? 1 : 0, motionTokens.spring);
  }, [selectionMode, barProgress, reduce]);
  const barStyle = useAnimatedStyle(() => ({
    opacity: barProgress.value,
    transform: [{ translateY: (1 - barProgress.value) * 120 }],
  }));

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
      // Le label explicite du Pressable REMPLACE la lecture de ses enfants :
      // on y remet ce que la carte MONTRE (circuit, date, chrono, honnêteté de
      // la donnée). L'appui long est une instruction → il part en hint.
      const dataLabel =
        level === 'full'
          ? 'Données complètes'
          : level === 'partial'
            ? 'Données partielles'
            : 'Données absentes';
      const cardFacts = `${circuit}, ${formatDay(item.started_at)}${
        chronoMs !== undefined ? `, ${msToLapLabel(chronoMs)}` : ''
      }. ${dataLabel}`;

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
                ? `${cardFacts}. ${isSelected ? 'Sélectionnée' : 'Non sélectionnée'}`
                : cardFacts
            }
            accessibilityHint={selectionMode ? undefined : 'Appui long pour comparer'}
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
      {/*
        LA SAISON D'ABORD — c'est la fusion du jalon 4.

        « Le hub Data devient la Saison, data/saison fusionne et disparaît. »
        L'écran de saison existait, faisait treize cents lignes, et AUCUNE route
        du dépôt n'y menait. Ses quatre lectures ouvrent désormais le hub : la
        saison est l'objet principal, littéralement, et la liste des séances
        devient ce qu'elle est — le chemin vers une séance précise.
      */}
      <SaisonSections data={saison} />

      <View style={styles.ruptureSeances} />

      <Animated.View style={header.headerStyle}>
        <Text style={styles.eyebrow}>VOS SÉANCES</Text>
        <Animated.Text style={[styles.title, header.titleStyle]} accessibilityRole="header">
          DATA
        </Animated.Text>
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
        {paireChips.map((p) => (
          <Chip
            key={p.cle}
            label={p.libelle}
            active={filter.kind === 'paire' && filter.paireCle === p.cle}
            onPress={() => setFilter({ kind: 'paire', paireCle: p.cle })}
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
  /**
   * LE BANDEAU HORS-LIGNE — au-dessus de la liste, jamais dedans.
   *
   * Il cadre la lecture de tout ce qui suit. Placé plus bas, il commenterait des
   * séances qu'on aurait déjà lues comme si elles étaient d'aujourd'hui.
   * `null` quand la liste est fraîche : le cas nominal est SILENCIEUX.
   */
  const phraseHorsLigne = messageHorsLigne(horsLigneDepuis);
  const bandeauHorsLigne =
    phraseHorsLigne !== null ? (
      <View style={styles.horsLigne} accessible accessibilityRole="alert">
        <Text style={styles.horsLigneTexte}>{phraseHorsLigne}</Text>
      </View>
    ) : null;

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
        {bandeauHorsLigne}
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
              /**
               * Le bandeau hors-ligne voyage AVEC l'en-tête, et non collé au
               * haut de l'écran : il doit défiler avec la liste qu'il qualifie.
               * Fixe, il finirait par commenter des séances qu'on ne voit plus.
               */
              ListHeaderComponent={
                <>
                  {bigHeader}
                  {bandeauHorsLigne}
                </>
              }
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

      {/*
        La feuille de circuit se pose en position absolue sur tout l'écran.
        Montée dans l'en-tête de la liste, elle se placerait par rapport à lui
        et défilerait avec — d'où sa place ici, hors de la liste.
      */}
      <SaisonCircuitSheet data={saison} />

      {/* Barre condensée « DATA » (patron Airbnb) — invisible tant qu'on n'a pas scrollé. */}
      <CondensingHeaderBar
        condensedStyle={header.condensedStyle}
        height={52 + insets.top}
        style={{ paddingTop: insets.top }}
      >
        <Text style={styles.condensedTitle}>DATA</Text>
      </CondensingHeaderBar>

      {/* Barre flottante de comparaison — ressort en spring en mode sélection. */}
      <Animated.View
        style={[styles.compareBar, { bottom: tabBarSpace(insets.bottom) }, barStyle]}
        pointerEvents={selectionMode ? 'auto' : 'none'}
      >
        {/* hitSlop : « Annuler » est un texte nu de 13 px (~18 pt) — on porte la
            cible tactile à 44 pt sans toucher au visuel. */}
        <PressScale
          onPress={onCancelSelection}
          accessibilityLabel="Annuler la sélection"
          hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
        >
          <Text style={styles.compareCancel}>Annuler</Text>
        </PressScale>
        <Text style={styles.compareCount}>{selected.length}/2 sélectionnées</Text>
        <PressScale
          onPress={onCompare}
          disabled={!canCompare(selected)}
          accessibilityLabel="Comparer les deux séances"
          hitSlop={{ top: 8, bottom: 8 }}
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
  /**
   * La frontière entre la saison et la liste des séances.
   *
   * *« Une frontière de mise en page, pas une convention de couleur : une
   * convention s'oublie, une rupture de fond se voit avant qu'on lise. »*
   * — plan de montage. Une barre pleine largeur, précédée d'air.
   */
  ruptureSeances: {
    marginTop: space.xxl,
    marginBottom: space.xl,
    marginHorizontal: -space.xl,
    height: 1,
    backgroundColor: colors.border.card,
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

  // États
  horsLigne: {
    borderLeftWidth: 2,
    borderLeftColor: colors.text.mid,
    paddingLeft: 12,
    marginBottom: space.md,
  },
  horsLigneTexte: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    // `text.mid`, jamais `text.low` : ce bandeau se lit au retour du circuit,
    // en voiture ou en plein soleil. Plancher de contraste 7:1.
    color: colors.text.mid,
  },
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
