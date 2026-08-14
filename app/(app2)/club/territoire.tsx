/**
 * TERRITOIRE — porte CLUB, écran 4/7 (V2-L5, mission C). Route `club/territoire`.
 *
 * L'écran carte du club, à 3 onglets (Carte · Routes · Créer) :
 *
 *   - CARTE : plein écran (module carto v1, GARDE isExpoGo — sans carte en Expo
 *     Go, liste honnête). Style sombre demandé au provider (Apple Maps iOS).
 *     Repères : circuits OXV (insigne), pings sociaux publiés (social_pings),
 *     départs des belles routes certifiées (anneau OR — l'or = route certifiée).
 *     Panneau bas persistant à poignée : la liste des repères VISIBLES,
 *     synchronisée au pan (bbox → territoireLogic).
 *   - ROUTES : cartes route (mini-tracé Skia, badge « CERTIFIÉE OXV » hairline
 *     or) ; détail en Sheet (distance/sinuosité, « Ouvrir dans Plans ») + bloc
 *     C2 Convoi si route certifiée liée à une journée à venir (flag `convoys`
 *     fail-closed, convoysService).
 *   - CRÉER : deux entrées vers les planificateurs v1 (creer-route GraphHopper,
 *     creer-trace import OSM) — la logique v1 est RÉUTILISÉE telle quelle, jamais
 *     réécrite (le moteur reste intact).
 *
 * NOTE DONNÉES RÉELLES (divergence assumée, honnête) : `scenicRoutesService`
 * n'expose PAS la géométrie du tracé (SavedScenicRoute n'a ni polyligne ni
 * durée) — le service n'est pas modifié dans un lot d'écran. On ne dessine donc
 * JAMAIS une polyligne fabriquée : sur la carte, une route certifiée n'apparaît
 * que par son POINT DE DÉPART (réel) ; dans les cartes/le détail, le motif de
 * tracé est le circuit-repère OXV générique (EMPTY_CIRCUIT_PATH), pas une
 * représentation de la géométrie réelle de cette route. Durée non affichée.
 *
 * Doctrine : sobre, vouvoyé, sans emoji, jamais prescriptif. TOURISME /
 * DÉCOUVERTE — la sinuosité est une préférence géométrique, jamais une note ni
 * un classement. Un seul accent rouge par zone ; l'or réservé à la certification.
 *
 * ---
 *
 * POURQUOI L'ONGLET ROUTES RESTE, MALGRÉ LA LIGNE DU PLAN — 14/08/2026
 *
 * Le plan écrit : *« Le Territoire garde le circuit et son entourage : les
 * convois partent chez les amis, les belles routes ont leur écran. »* Un relevé
 * a conclu qu'il fallait donc supprimer cet onglet, `club/routes` existant.
 *
 * **Mesuré : ce ne sont pas les mêmes routes.**
 *
 *   • ici          → `mergeRoutes(listMyRoutes(), listCertifiedRoutes())` ;
 *   • `club/routes` → `listMyRoutes()` seul.
 *
 * Cet onglet est un SUR-ENSEMBLE : il est le seul endroit où les routes
 * certifiées se découvrent en liste. Le supprimer n'aurait pas retiré un
 * doublon, il aurait retiré la découverte — une régression déguisée en
 * nettoyage.
 *
 * Le fond de la ligne reste juste, et demande un vrai déplacement : porter la
 * découverte des routes certifiées DANS `club/routes`, puis retirer l'onglet.
 * C'est un changement de produit, pas une correction de défaut ; il est posé
 * ici pour arbitrage plutôt qu'exécuté à la volée.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { FlashList } from '@shopify/flash-list';
import { Canvas } from '@shopify/react-native-skia';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { isExpoGo } from '@/lib/runtime';
import { useAuthStore } from '@/store/useAuthStore';
import { cornersForCircuit } from '@/circuit/circuitCorners';
import { fetchCircuitCenterline, fetchCircuits, type Circuit } from '@/services/circuitsService';
import { listSocialPings, PING_KIND_LABELS, type SocialPing } from '@/services/socialPingsService';
import {
  listCertifiedRoutes,
  listMyRoutes,
  type SavedScenicRoute,
} from '@/services/routing/scenicRoutesService';
import { isFlagEnabled } from '@/services/featureFlagsService';
import { getMyNextTrackDay } from '@/services/nextTrackDayService';
import { resolveDaySessionId } from '@/features/rec/attendancePublicService';
import { lienOuvrable } from '@/features/vous/profilLogic';
import * as convoysService from '@/services/v2/convoysService';
import {
  Chip,
  colors,
  EMPTY_CIRCUIT_PATH,
  GlowStroke,
  ListRow,
  OxvIcon,
  PressScale,
  radius,
  SectionHeader,
  Sheet,
  space,
  StateView,
  staggerEntering,
  TraceCircuit,
  tabBarSpace,
  typo,
  useDoorTransition,
} from '@/ui/v2';
import {
  convoysForRoute,
  curvinessLabel,
  distanceKmLabel,
  filterInView,
  isCertified,
  isParticipant,
  mergeRoutes,
  participantsLabel,
  regionToBBox,
  shouldOfferConvoy,
  sinuosityLabel,
  type LatLon,
  type MapRegion,
} from '@/features/club/territoireLogic';

// Centre par défaut : Nouvelle-Aquitaine (patron carte-oxv v1).
const DEFAULT_REGION: MapRegion = {
  latitude: 45.6,
  longitude: -0.4,
  latitudeDelta: 3.2,
  longitudeDelta: 3.2,
};

type TabKey = 'carte' | 'routes' | 'creer';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'carte', label: 'Carte' },
  { key: 'routes', label: 'Routes' },
  { key: 'creer', label: 'Créer' },
];

/** Repère unifié de la carte (circuit / ping / départ de route certifiée). */
type MapItem =
  | { kind: 'circuit'; id: string; name: string; lat: number; lon: number; circuit: Circuit }
  | { kind: 'ping'; id: string; name: string; lat: number; lon: number; ping: SocialPing }
  | { kind: 'route'; id: string; name: string; lat: number; lon: number; route: SavedScenicRoute };

type LoadPhase = 'loading' | 'ready' | 'error';

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

export default function TerritoireScreen() {
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const uid = profile?.id ?? null;
  const canMap = !isExpoGo();

  const door = useDoorTransition();
  const [tab, setTab] = useState<TabKey>('carte');

  // Données partagées.
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [pings, setPings] = useState<SocialPing[]>([]);
  const [routes, setRoutes] = useState<SavedScenicRoute[]>([]);
  const [phase, setPhase] = useState<LoadPhase>('loading');

  // Contexte convoi (fail-closed).
  const [convoysFlag, setConvoysFlag] = useState(false);
  const [daySessionId, setDaySessionId] = useState<string | null>(null);

  // Sélection → Sheet détail (partagé carte/routes).
  const [selected, setSelected] = useState<MapItem | null>(null);

  const load = useCallback(async () => {
    setPhase('loading');
    try {
      const [c, p, mine, certified] = await Promise.all([
        fetchCircuits(),
        listSocialPings(),
        listMyRoutes(),
        listCertifiedRoutes(),
      ]);
      setCircuits(
        c.filter((x) => Number.isFinite(x.finishLineLat) && Number.isFinite(x.finishLineLon))
      );
      setPings(p);
      setRoutes(mergeRoutes(mine, certified));
      setPhase('ready');
    } catch {
      setPhase('error');
    }

    // Contexte convoi — best-effort, fail-closed (flag OFF → jamais résolu).
    const flag = await isFlagEnabled('convoys').catch(() => false);
    setConvoysFlag(flag);
    if (uid && flag) {
      const day = await getMyNextTrackDay(uid).catch(() => null);
      const sid = day ? await resolveDaySessionId(uid, day.date).catch(() => null) : null;
      setDaySessionId(sid);
    } else {
      setDaySessionId(null);
    }
  }, [uid]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Animated.View style={[styles.root, door]}>
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <PressScale
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={styles.backDisc}>
            <BackChevron />
          </View>
        </PressScale>
        <View>
          <Text style={styles.eyebrow}>LE PADDOCK</Text>
          <Text style={styles.title} accessibilityRole="header">
            TERRITOIRE
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabsRow}>
        {TABS.map((t) => (
          <Chip key={t.key} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />
        ))}
      </View>

      {tab === 'carte' ? (
        <CarteTab
          canMap={canMap}
          phase={phase}
          circuits={circuits}
          pings={pings}
          routes={routes}
          bottomInset={tabBarSpace(insets.bottom)}
          onRetry={load}
          onSelect={setSelected}
        />
      ) : tab === 'routes' ? (
        <RoutesTab
          phase={phase}
          routes={routes}
          bottomInset={tabBarSpace(insets.bottom)}
          onRetry={load}
          onSelect={setSelected}
        />
      ) : (
        <CreerTab bottomInset={tabBarSpace(insets.bottom)} />
      )}

      <DetailSheet
        selected={selected}
        onClose={() => setSelected(null)}
        uid={uid}
        convoysFlag={convoysFlag}
        daySessionId={daySessionId}
      />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Onglet CARTE — carte plein écran + panneau bas persistant (repères visibles)
// ---------------------------------------------------------------------------

function CarteTab({
  canMap,
  phase,
  circuits,
  pings,
  routes,
  bottomInset,
  onRetry,
  onSelect,
}: {
  canMap: boolean;
  phase: LoadPhase;
  circuits: Circuit[];
  pings: SocialPing[];
  routes: SavedScenicRoute[];
  bottomInset: number;
  onRetry: () => void;
  onSelect: (item: MapItem) => void;
}) {
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<MapRegion>(DEFAULT_REGION);

  const certifiedRoutes = useMemo(() => routes.filter(isCertified), [routes]);

  // Repères unifiés (départs de routes = point réel, jamais une polyligne feinte).
  const allItems = useMemo<MapItem[]>(() => {
    const out: MapItem[] = [];
    for (const c of circuits) {
      out.push({
        kind: 'circuit',
        id: `c-${c.id}`,
        name: c.name,
        lat: c.finishLineLat,
        lon: c.finishLineLon,
        circuit: c,
      });
    }
    for (const p of pings) {
      out.push({ kind: 'ping', id: `p-${p.id}`, name: p.title, lat: p.lat, lon: p.lon, ping: p });
    }
    for (const r of certifiedRoutes) {
      out.push({
        kind: 'route',
        id: `r-${r.id}`,
        name: r.name,
        lat: r.start.lat,
        lon: r.start.lon,
        route: r,
      });
    }
    return out;
  }, [circuits, pings, certifiedRoutes]);

  const visible = useMemo(
    () => filterInView(allItems, regionToBBox(region), (it) => ({ lat: it.lat, lon: it.lon })),
    [allItems, region]
  );

  const onRowPress = useCallback(
    (item: MapItem) => {
      mapRef.current?.animateToRegion(
        { latitude: item.lat, longitude: item.lon, latitudeDelta: 0.15, longitudeDelta: 0.15 },
        350
      );
      onSelect(item);
    },
    [onSelect]
  );

  // Sans carte (Expo Go) : liste honnête, jamais un faux plan.
  if (!canMap) {
    return (
      <View style={[styles.tabBody, { paddingBottom: bottomInset + space.xl }]}>
        <View style={styles.expoGoNotice}>
          <Text style={styles.expoGoText}>
            La carte n’est disponible que dans l’application installée. Voici les repères du
            territoire OXV.
          </Text>
        </View>
        <TerritoryList phase={phase} items={allItems} onRetry={onRetry} onSelect={onSelect} />
      </View>
    );
  }

  return (
    <View style={styles.carte}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        onRegionChangeComplete={(r) => setRegion(r)}
        showsPointsOfInterests={false}
        showsCompass={false}
        toolbarEnabled={false}
        // Style sombre demandé au provider (Apple Maps iOS l'honore ;
        // repli défaut ailleurs — jamais un plan clair forcé).
        userInterfaceStyle="dark"
        onPress={() => undefined}
      >
        {allItems.map((item) => (
          <SettledMarker
            key={item.id}
            coordinate={{ latitude: item.lat, longitude: item.lon }}
            label={`${item.name || itemKindLabel(item)}, ${itemSubLabel(item)}`}
            onPress={() => onSelect(item)}
          >
            <MarkerGlyph kind={item.kind} />
          </SettledMarker>
        ))}
      </MapView>

      {phase === 'loading' ? (
        <View style={styles.mapLoading}>
          <Text style={styles.mapLoadingText}>Chargement du territoire</Text>
        </View>
      ) : null}

      <VisiblePanel
        items={visible}
        totalCount={allItems.length}
        bottomInset={bottomInset}
        onRowPress={onRowPress}
      />
    </View>
  );
}

/** Panneau bas persistant à poignée — la liste de ce qui est visible à l'écran. */
function VisiblePanel({
  items,
  totalCount,
  bottomInset,
  onRowPress,
}: {
  items: MapItem[];
  totalCount: number;
  bottomInset: number;
  onRowPress: (item: MapItem) => void;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHandle} />
      <View style={styles.panelHead}>
        <SectionHeader
          eyebrow="REPÈRES VISIBLES"
          count={items.length > 0 ? items.length : undefined}
        />
      </View>
      <View style={styles.panelListArea}>
        {items.length === 0 ? (
          <Text style={styles.panelEmpty}>
            {totalCount === 0
              ? 'Aucun repère publié pour l’instant.'
              : 'Déplacez la carte pour révéler les repères du territoire.'}
          </Text>
        ) : (
          <FlashList
            data={items}
            keyExtractor={(it) => it.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: bottomInset + space.sm }}
            renderItem={({ item, index }) => (
              <ListRow
                icon={markerIcon(item.kind)}
                label={item.name || itemKindLabel(item)}
                sublabel={itemSubLabel(item)}
                divider={index < items.length - 1}
                onPress={() => onRowPress(item)}
              />
            )}
          />
        )}
      </View>
    </View>
  );
}

/** Liste honnête du territoire (repli Expo Go / erreur / vide). */
function TerritoryList({
  phase,
  items,
  onRetry,
  onSelect,
}: {
  phase: LoadPhase;
  items: MapItem[];
  onRetry: () => void;
  onSelect: (item: MapItem) => void;
}) {
  if (phase === 'loading') return <StateView state="loading" shape="list" />;
  if (phase === 'error') {
    return (
      <StateView
        state="error"
        errorMessage="Le territoire n'a pas pu se charger."
        onRetry={onRetry}
      />
    );
  }
  if (items.length === 0) {
    return (
      <StateView state="empty" emptyMessage="Les circuits, lieux et routes OXV apparaîtront ici." />
    );
  }
  return (
    <View style={styles.listCard}>
      <FlashList
        data={items}
        keyExtractor={(it) => it.id}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <ListRow
            icon={markerIcon(item.kind)}
            label={item.name || itemKindLabel(item)}
            sublabel={itemSubLabel(item)}
            divider={index < items.length - 1}
            onPress={() => onSelect(item)}
          />
        )}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Onglet ROUTES — cartes route (mini-tracé, badge certifiée), détail en Sheet
// ---------------------------------------------------------------------------

function RoutesTab({
  phase,
  routes,
  bottomInset,
  onRetry,
  onSelect,
}: {
  phase: LoadPhase;
  routes: SavedScenicRoute[];
  bottomInset: number;
  onRetry: () => void;
  onSelect: (item: MapItem) => void;
}) {
  if (phase === 'loading') {
    return (
      <View style={styles.tabBody}>
        <StateView state="loading" shape="card" />
      </View>
    );
  }
  if (phase === 'error') {
    return (
      <View style={styles.tabBody}>
        <StateView
          state="error"
          errorMessage="Les routes n'ont pas pu se charger."
          onRetry={onRetry}
        />
      </View>
    );
  }
  if (routes.length === 0) {
    return (
      <View style={styles.tabBody}>
        <StateView
          state="empty"
          emptyMessage="Vos belles routes et les routes certifiées OXV apparaîtront ici."
        />
      </View>
    );
  }

  return (
    <FlashList
      data={routes}
      keyExtractor={(r) => r.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: space.xl,
        paddingTop: space.md,
        paddingBottom: bottomInset + space.xxl,
      }}
      renderItem={({ item, index }) => (
        <Animated.View entering={staggerEntering(index)} style={styles.routeCardWrap}>
          <RouteCard
            route={item}
            onPress={() =>
              onSelect({
                kind: 'route',
                id: `r-${item.id}`,
                name: item.name,
                lat: item.start.lat,
                lon: item.start.lon,
                route: item,
              })
            }
          />
        </Animated.View>
      )}
    />
  );
}

function RouteCard({ route, onPress }: { route: SavedScenicRoute; onPress: () => void }) {
  const certified = isCertified(route);
  const curve = curvinessLabel(route.curviness);
  const sinuo = sinuosityLabel(route.sinuosity);

  return (
    <PressScale
      onPress={onPress}
      // Le label explicite EFFACE la lecture des enfants : le badge « CERTIFIÉE
      // OXV », la sinuosité et la ligne de courbe étaient muets.
      accessibilityLabel={[
        certified ? 'Route certifiée OXV' : 'Belle route',
        route.name,
        distanceKmLabel(route.distanceKm),
        sinuo,
        curve,
      ]
        .filter(Boolean)
        .join(', ')}
    >
      <View style={styles.routeCard}>
        <View style={styles.routeTraceFrame}>
          <MiniTrace certified={certified} />
          {certified ? (
            <View style={styles.certBadge}>
              <Text style={styles.certBadgeText}>CERTIFIÉE OXV</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.routeBody}>
          <Text style={styles.routeName} numberOfLines={2}>
            {route.name}
          </Text>
          <View style={styles.routeMetaRow}>
            <Text style={styles.routeMeta}>{distanceKmLabel(route.distanceKm)}</Text>
            {sinuo ? <Text style={styles.routeMetaDim}>· {sinuo}</Text> : null}
          </View>
          {curve ? <Text style={styles.routeCurve}>{curve}</Text> : null}
        </View>
      </View>
    </PressScale>
  );
}

/**
 * Mini-tracé : motif de circuit OXV générique (EMPTY_CIRCUIT_PATH) — OR si la
 * route est certifiée (usage exclusif de l'or), sinon trait sourd. Ce n'est PAS
 * la géométrie réelle de la route (non exposée par le service) : c'est un repère
 * d'identité, pas une carte. Skia natif (dev-client), pas d'Expo Go.
 */
function MiniTrace({ certified }: { certified: boolean }) {
  const color = certified ? colors.heritage.gold : colors.border.strong;
  const glow = certified ? colors.heritage.glow : 'transparent';
  return (
    <Canvas style={styles.miniTraceCanvas}>
      <GlowStroke path={EMPTY_CIRCUIT_PATH} color={color} glowColor={glow} strokeWidth={2} />
    </Canvas>
  );
}

// ---------------------------------------------------------------------------
// Onglet CRÉER — entrées vers les planificateurs v1 (logique réutilisée)
// ---------------------------------------------------------------------------

function CreerTab({ bottomInset }: { bottomInset: number }) {
  return (
    <View style={[styles.tabBody, { paddingBottom: bottomInset + space.xl }]}>
      <Text style={styles.creerLede}>
        Composez un itinéraire de balade ou importez un tracé. Hors chrono, hors piste.
      </Text>
      {/* La logique v1 (GraphHopper/Overpass, import OSM) reste intacte : ces
          entrées ouvrent les planificateurs existants plutôt que de dupliquer
          leur moteur. */}
      <EntryCard
        icon="convoi"
        eyebrow="PLANIFICATEUR"
        title="Créer une route"
        hint="Composez un itinéraire sinueux depuis votre position, étape par étape."
        onPress={() => router.push('/(app2)/club/composer-route' as never)}
      />
      <EntryCard
        icon="circuit"
        eyebrow="IMPORT OSM"
        title="Importer un tracé"
        hint="Reconstituez un circuit à partir d’un tracé OpenStreetMap."
        onPress={() => router.push('/(app2)/club/importer-trace' as never)}
      />
    </View>
  );
}

function EntryCard({
  icon,
  eyebrow,
  title,
  hint,
  onPress,
}: {
  icon: 'convoi' | 'circuit';
  eyebrow: string;
  title: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <PressScale onPress={onPress} accessibilityLabel={title}>
      <View style={styles.entryCard}>
        <View style={styles.entryIcon}>
          <OxvIcon name={icon} size={22} color={colors.text.mid} />
        </View>
        <View style={styles.entryBody}>
          <Text style={styles.entryEyebrow}>{eyebrow}</Text>
          <Text style={styles.entryTitle}>{title}</Text>
          <Text style={styles.entryHint}>{hint}</Text>
        </View>
        <Chevron />
      </View>
    </PressScale>
  );
}

// ---------------------------------------------------------------------------
// Sheet détail — circuit / ping / route (+ C2 convoi si éligible)
// ---------------------------------------------------------------------------

function DetailSheet({
  selected,
  onClose,
  uid,
  convoysFlag,
  daySessionId,
}: {
  selected: MapItem | null;
  onClose: () => void;
  uid: string | null;
  convoysFlag: boolean;
  daySessionId: string | null;
}) {
  return (
    <Sheet visible={selected !== null} onClose={onClose}>
      <ScrollView
        style={styles.sheetScrollFlex}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.sheetScroll}
      >
        {selected?.kind === 'circuit' ? (
          <CircuitDetail circuit={selected.circuit} />
        ) : selected?.kind === 'ping' ? (
          <PingDetail ping={selected.ping} />
        ) : selected?.kind === 'route' ? (
          <RouteDetail
            route={selected.route}
            uid={uid}
            convoysFlag={convoysFlag}
            daySessionId={daySessionId}
          />
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

function DetailHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={styles.detailHead}>
      <Text style={styles.detailEyebrow}>{eyebrow}</Text>
      <Text style={styles.detailTitle}>{title}</Text>
    </View>
  );
}

/**
 * LA FICHE DE CIRCUIT — deux champs, puis sa GÉOMÉTRIE.
 *
 * ===========================================================================
 * CE QU'ELLE MONTRAIT, ET CE QUE LA BASE PORTAIT
 * ===========================================================================
 *
 * Elle montrait le nom et la longueur. La géométrie existe pourtant en base
 * — `circuits.centerline_latlon` — et elle est déjà consommée : l'espace COACH
 * s'en sert pour ses repères de virage depuis des semaines. Le Territoire,
 * l'écran dont la ligne du plan dit qu'il *« devient l'objet circuit »*, ne la
 * regardait pas.
 *
 * ===========================================================================
 * CHARGÉE À L'OUVERTURE DE LA FICHE, PAS DANS LA LISTE
 * ===========================================================================
 *
 * `fetchCircuits` est mise en cache et sert le rendu de la carte entière.
 * Y ajouter `centerline_latlon` chargerait des milliers de points POUR CHAQUE
 * circuit, à chaque ouverture de l'écran, pour une fiche qu'on n'ouvrira
 * peut-être jamais — et gonflerait le cache d'autant.
 *
 * `cornersForCircuit` fait déjà exactement le bon geste : une lecture par
 * circuit, à la demande. On s'appuie dessus.
 *
 * ===========================================================================
 * ET SI LA GÉOMÉTRIE MANQUE
 * ===========================================================================
 *
 * La section disparaît. Pas de silhouette générique sous le nom d'un circuit
 * qui n'en a pas : ce serait montrer le tracé d'un AUTRE. Le motif générique
 * de la carte reste un repère de position, ce qui est autre chose.
 */
function CircuitDetail({ circuit }: { circuit: Circuit }) {
  const [centerline, setCenterline] = useState<LatLon[] | null>(null);
  const [virages, setVirages] = useState<number | null>(null);

  useEffect(() => {
    let annule = false;
    setCenterline(null);
    setVirages(null);
    Promise.all([fetchCircuitCenterline(circuit.id), cornersForCircuit(circuit)])
      .then(([pts, corners]) => {
        if (annule) return;
        if (pts && pts.length > 2) setCenterline(pts);
        if (corners.length > 0) setVirages(corners.length);
      })
      // Best-effort : la fiche garde son nom et sa longueur.
      .catch(() => undefined);
    return () => {
      annule = true;
    };
  }, [circuit]);

  /**
   * Le nombre de virages, dans l'ordre de vérité : ce que la base DÉCLARE
   * d'abord, ce que la géométrie donne ensuite. Une valeur saisie par
   * l'exploitant vaut mieux qu'une valeur dérivée d'un seuil de courbure.
   */
  const nbVirages = circuit.turnsCount ?? virages;

  return (
    <View>
      <DetailHead eyebrow="CIRCUIT OXV" title={circuit.name} />
      <View style={styles.detailMetaRow}>
        <MetaCell
          label="longueur"
          value={
            circuit.lengthKm != null ? `${circuit.lengthKm.toFixed(1).replace('.', ',')} km` : '—'
          }
        />
        <MetaCell label="virages" value={nbVirages != null ? String(nbVirages) : '—'} />
      </View>
      {centerline ? (
        <View style={styles.circuitTrace}>
          <TraceCircuit centerline={centerline} height={160} color={colors.text.mid} />
        </View>
      ) : null}
    </View>
  );
}

function PingDetail({ ping }: { ping: SocialPing }) {
  return (
    <View>
      <DetailHead eyebrow={PING_KIND_LABELS[ping.kind]} title={ping.title} />
      {ping.address ? <Text style={styles.detailBody}>{ping.address}</Text> : null}
      {ping.description ? (
        <Text style={styles.detailBody} numberOfLines={4}>
          {ping.description}
        </Text>
      ) : null}
      <View style={styles.detailActions}>
        {ping.websiteUrl ? <LinkButton label="Site web" url={ping.websiteUrl} primary /> : null}
        {ping.instagramUrl ? <LinkButton label="Instagram" url={ping.instagramUrl} /> : null}
        {ping.eventUrl ? <LinkButton label="Détails" url={ping.eventUrl} /> : null}
        {ping.contactEmail ? (
          <LinkButton label="Contacter" url={`mailto:${ping.contactEmail}`} />
        ) : null}
      </View>
    </View>
  );
}

function RouteDetail({
  route,
  uid,
  convoysFlag,
  daySessionId,
}: {
  route: SavedScenicRoute;
  uid: string | null;
  convoysFlag: boolean;
  daySessionId: string | null;
}) {
  const certified = isCertified(route);
  const sinuo = sinuosityLabel(route.sinuosity);
  const curve = curvinessLabel(route.curviness);
  const offerConvoy = shouldOfferConvoy(route, { flagEnabled: convoysFlag, daySessionId });

  return (
    <View>
      <DetailHead eyebrow={certified ? 'ROUTE CERTIFIÉE OXV' : 'BELLE ROUTE'} title={route.name} />
      <View style={styles.detailTraceFrame}>
        <MiniTrace certified={certified} />
      </View>
      <View style={styles.detailMetaRow}>
        <MetaCell label="distance" value={distanceKmLabel(route.distanceKm)} />
        {sinuo ? <MetaCell label="sinuosité" value={sinuo.replace('sinuosité ', '')} /> : null}
        {route.ascentM != null ? (
          <MetaCell label="dénivelé" value={`${Math.round(route.ascentM)} m`} />
        ) : null}
      </View>
      {curve ? <Text style={styles.detailBody}>{curve}</Text> : null}

      <View style={styles.detailActions}>
        <LinkButton
          label="Ouvrir dans Plans"
          url={mapsUrl({ lat: route.start.lat, lon: route.start.lon }, route.name)}
          primary
        />
      </View>

      {offerConvoy && daySessionId ? (
        <ConvoyBlock routeId={route.id} sessionId={daySessionId} uid={uid} />
      ) : null}
    </View>
  );
}

/** C2 — convois de la journée rattachés à cette route (flag déjà validé amont). */
function ConvoyBlock({
  routeId,
  sessionId,
  uid,
}: {
  routeId: string;
  sessionId: string;
  uid: string | null;
}) {
  const [convoys, setConvoys] = useState<convoysService.Convoy[] | null>(null);

  const reload = useCallback(async () => {
    const all = await convoysService.getForSession(sessionId).catch(() => []);
    setConvoys(convoysForRoute(all, routeId));
  }, [routeId, sessionId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onJoin = useCallback(
    async (id: string) => {
      await convoysService.join(id);
      await reload();
    },
    [reload]
  );
  const onLeave = useCallback(
    async (id: string) => {
      await convoysService.leave(id);
      await reload();
    },
    [reload]
  );

  return (
    <View style={styles.convoySection}>
      <SectionHeader eyebrow="CONVOI" />
      {convoys === null ? (
        <StateView state="loading" shape="list" />
      ) : convoys.length === 0 ? (
        <Text style={styles.detailBody}>
          Aucun convoi rattaché à cette route pour votre journée.
        </Text>
      ) : (
        convoys.map((cv) => (
          <ConvoyCard
            key={cv.id}
            convoy={cv}
            meIn={isParticipant(cv, uid)}
            onJoin={() => onJoin(cv.id)}
            onLeave={() => onLeave(cv.id)}
          />
        ))
      )}
    </View>
  );
}

function ConvoyCard({
  convoy,
  meIn,
  onJoin,
  onLeave,
}: {
  convoy: convoysService.Convoy;
  meIn: boolean;
  onJoin: () => void;
  onLeave: () => void;
}) {
  const rdv = formatRdv(convoy.rdvAt);
  const count = convoy.participants.length;
  // Les participants n'exposent qu'un id (aucune identité/photo côté service) :
  // on représente un COMPTE anonyme, jamais une donnée fabriquée.
  const rings = Math.min(count, 5);

  return (
    <View style={styles.convoyCard}>
      {rdv ? <Text style={styles.convoyRdv}>RDV {rdv}</Text> : null}
      {convoy.meetingPoint ? (
        <Text style={styles.detailBody} numberOfLines={2}>
          {convoy.meetingPoint}
        </Text>
      ) : null}
      <View style={styles.convoyPeople}>
        <View style={styles.convoyRings}>
          {Array.from({ length: rings }).map((_, i) => (
            <View key={i} style={[styles.convoyRing, i > 0 && styles.convoyRingOverlap]}>
              <OxvIcon name="casque" size={16} color={colors.text.mid} />
            </View>
          ))}
        </View>
        <Text style={styles.convoyCount}>{participantsLabel(count)}</Text>
      </View>
      <PressScale
        onPress={meIn ? onLeave : onJoin}
        accessibilityLabel={meIn ? 'Quitter le convoi' : 'Rejoindre le convoi'}
        style={[styles.convoyBtn, meIn ? styles.convoyBtnLeave : styles.convoyBtnJoin]}
      >
        <Text style={[styles.convoyBtnLabel, meIn && styles.convoyBtnLabelLeave]}>
          {meIn ? 'QUITTER' : 'REJOINDRE'}
        </Text>
      </PressScale>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Petits éléments partagés
// ---------------------------------------------------------------------------

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    // Regroupé : l'étiquette et sa valeur sont UN fait, pas deux arrêts.
    <View style={styles.metaCell} accessible accessibilityLabel={`${label} : ${value}`}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

/**
 * Un point de carte porte des adresses saisies à la main par un administrateur
 * (site, Instagram, évènement, courriel). Le formulaire ne fait qu'un `trim` :
 * `cafeducircuit.fr` arrive donc sans schéma. On complète ici plutôt que de
 * laisser un bouton inerte.
 */
function LinkButton({ label, url, primary }: { label: string; url: string; primary?: boolean }) {
  const cible = lienOuvrable(url);
  // Pas d'adresse ouvrable → pas de bouton. Un contrôle mort vaut moins que
  // pas de contrôle : il promet une action et n'en rend aucune.
  if (cible === null) return null;
  return (
    <PressScale
      onPress={() => void Linking.openURL(cible).catch(() => undefined)}
      accessibilityLabel={label}
      style={[styles.linkBtn, primary ? styles.linkBtnPrimary : styles.linkBtnGhost]}
    >
      <Text style={[styles.linkBtnLabel, primary && styles.linkBtnLabelPrimary]}>{label}</Text>
    </PressScale>
  );
}

/**
 * Marqueur qui coupe `tracksViewChanges` une fois rasterisé (patron carte-oxv) :
 * le rendu custom apparaît, puis on fige pour la performance.
 */
function SettledMarker({
  coordinate,
  label,
  onPress,
  children,
}: {
  coordinate: { latitude: number; longitude: number };
  /** Nom du repère : le marqueur est tappable et resterait sinon sans nom. */
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 600);
    return () => clearTimeout(t);
  }, []);
  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={!settled}
      onPress={onPress}
      accessibilityLabel={label}
    >
      {children}
    </Marker>
  );
}

function MarkerGlyph({ kind }: { kind: MapItem['kind'] }) {
  if (kind === 'circuit') {
    return (
      <View style={styles.markerRing}>
        <OxvIcon name="insigne" size={15} color={colors.text.hi} />
      </View>
    );
  }
  if (kind === 'route') {
    // Or = route certifiée (usage exclusif).
    return (
      <View style={[styles.markerRing, styles.markerRingGold]}>
        <OxvIcon name="drapeau-damier" size={14} color={colors.heritage.gold} />
      </View>
    );
  }
  return (
    <View style={styles.markerRing}>
      <View style={styles.markerDot} />
    </View>
  );
}

function BackChevron() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M14.5 5 L8 12 L14.5 19"
        stroke={colors.text.hi}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function Chevron() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M9 5 L15.5 12 L9 19"
        stroke={colors.text.dim}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers d'affichage
// ---------------------------------------------------------------------------

function markerIcon(kind: MapItem['kind']): 'insigne' | 'drapeau-damier' | 'club' {
  if (kind === 'circuit') return 'insigne';
  if (kind === 'route') return 'drapeau-damier';
  return 'club';
}

function itemKindLabel(item: MapItem): string {
  if (item.kind === 'circuit') return 'Circuit OXV';
  if (item.kind === 'route') return 'Belle route';
  return PING_KIND_LABELS[item.ping.kind];
}

function itemSubLabel(item: MapItem): string {
  if (item.kind === 'circuit') {
    return item.circuit.lengthKm != null
      ? `Circuit · ${item.circuit.lengthKm.toFixed(1).replace('.', ',')} km`
      : 'Circuit OXV';
  }
  if (item.kind === 'route') {
    return `Route certifiée · ${distanceKmLabel(item.route.distanceKm)}`;
  }
  return item.ping.address ?? PING_KIND_LABELS[item.ping.kind];
}

/** « Sam. 19 juil. 08:30 » depuis un datetime ISO (null si illisible). */
function formatRdv(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  const txt = d.toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

/** URL d'ouverture native de Plans vers le point de départ de la route. */
function mapsUrl(point: LatLon, label: string): string {
  const q = encodeURIComponent(label);
  return (
    Platform.select({
      ios: `maps://?daddr=${point.lat},${point.lon}&q=${q}`,
      android: `geo:${point.lat},${point.lon}?q=${point.lat},${point.lon}(${q})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lon}`,
    }) ?? `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lon}`
  );
}

// ---------------------------------------------------------------------------
// Styles — tokens V2 uniquement. Un accent rouge par zone ; or = certification.
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  backDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { flex: 1 },
  eyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  title: {
    fontFamily: typo.display,
    fontSize: 20,
    letterSpacing: 2,
    color: colors.text.hi,
    marginTop: space.xs,
  },

  tabsRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
  },

  tabBody: {
    flex: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    gap: space.lg,
  },

  // — Onglet Carte —
  carte: { flex: 1 },
  mapLoading: {
    position: 'absolute',
    top: space.md,
    alignSelf: 'center',
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  mapLoadingText: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.text.mid,
  },
  expoGoNotice: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    padding: space.md,
  },
  expoGoText: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.mid,
  },

  // Panneau bas persistant (hauteur définie : la FlashList a besoin de bornes).
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '44%',
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: colors.border.card,
    paddingHorizontal: space.lg,
  },
  panelHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border.strong,
    alignSelf: 'center',
    marginTop: space.sm,
    marginBottom: space.sm,
  },
  panelHead: { paddingBottom: space.xs },
  panelListArea: { flex: 1 },
  panelEmpty: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.mid,
    paddingVertical: space.lg,
  },

  listCard: {
    flex: 1,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
  },

  // Marqueurs.
  markerRing: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.border.strong,
    backgroundColor: colors.bg.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerRingGold: { borderColor: colors.heritage.gold },
  markerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.text.mid },

  // — Onglet Routes —
  routeCardWrap: { marginBottom: space.lg },
  routeCard: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  routeTraceFrame: {
    height: 104,
    backgroundColor: colors.bg.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniTraceCanvas: { width: 168, height: 94 },
  certBadge: {
    position: 'absolute',
    top: space.md,
    left: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.heritage.gold,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 4,
  },
  certBadgeText: {
    fontFamily: typo.mono,
    fontSize: 9,
    letterSpacing: 1.6,
    color: colors.heritage.text,
  },
  routeBody: { padding: space.lg, gap: space.xs },
  routeName: { fontFamily: typo.bodySemi, fontSize: 16, color: colors.text.hi },
  routeMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  routeMeta: {
    fontFamily: typo.mono,
    fontSize: 13,
    color: colors.text.mid,
    fontVariant: ['tabular-nums'],
  },
  routeMetaDim: { fontFamily: typo.mono, fontSize: 12, color: colors.text.low },
  routeCurve: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.text.low,
    marginTop: space.xs,
  },

  // — Onglet Créer —
  creerLede: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.mid,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.lg,
  },
  entryIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.cell,
    backgroundColor: colors.bg.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryBody: { flex: 1, gap: 2 },
  entryEyebrow: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.text.low,
  },
  entryTitle: { fontFamily: typo.bodySemi, fontSize: 16, color: colors.text.hi },
  entryHint: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.mid,
    marginTop: 2,
  },

  // — Sheet détail —
  sheetScrollFlex: { flex: 1 },
  sheetScroll: { paddingBottom: space.xl },
  circuitTrace: { marginTop: space.lg },
  detailHead: { gap: space.xs, marginBottom: space.md },
  detailEyebrow: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.text.low,
  },
  detailTitle: { fontFamily: typo.bodySemi, fontSize: 20, color: colors.text.hi },
  detailTraceFrame: {
    height: 110,
    backgroundColor: colors.bg.card2,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  detailMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xl, marginBottom: space.md },
  detailBody: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.mid,
    marginBottom: space.sm,
  },
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },

  metaCell: { gap: 2 },
  metaLabel: {
    fontFamily: typo.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text.low,
  },
  metaValue: {
    fontFamily: typo.mono,
    fontSize: 15,
    color: colors.text.hi,
    fontVariant: ['tabular-nums'],
  },

  linkBtn: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  linkBtnPrimary: { backgroundColor: colors.bg.card2, borderColor: colors.border.strong },
  linkBtnGhost: { borderColor: colors.border.card },
  linkBtnLabel: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text.mid,
  },
  linkBtnLabelPrimary: { color: colors.text.hi },

  // — C2 Convoi —
  convoySection: { marginTop: space.xl },
  convoyCard: {
    backgroundColor: colors.bg.card2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.lg,
    marginTop: space.md,
    gap: space.sm,
  },
  convoyRdv: {
    fontFamily: typo.monoSemi,
    fontSize: 13,
    letterSpacing: 0.4,
    color: colors.text.hi,
  },
  convoyPeople: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  convoyRings: { flexDirection: 'row' },
  convoyRing: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  convoyRingOverlap: { marginLeft: -8 },
  convoyCount: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.text.mid,
  },
  convoyBtn: {
    minHeight: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xs,
  },
  convoyBtnJoin: { backgroundColor: colors.accent },
  convoyBtnLeave: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.strong },
  convoyBtnLabel: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.text.hi,
  },
  convoyBtnLabelLeave: { color: colors.text.mid },
});
