/**
 * Écran « La carte OXV » — écran UNIQUE du territoire OXV (carte + liste).
 * Reskin fidèle au langage refonte-v2 (§7bis, screens/34-carte-oxv-live.png),
 * enrichi build 23 (carte intrigante, décision fondateur 2026-07-16) :
 *
 * - ONGLETS PAR CATÉGORIE en tête (Tout · Événements · Garages · Restaurants ·
 *   Hôtels · Autres) — chips avec COMPTE RÉEL par catégorie, masquées à zéro ;
 * - marqueurs différenciés par catégorie : pastille sombre cerclée de la
 *   couleur d'identité + initiale mono (src/ui/carteIdentity.ts, documenté —
 *   identité de lieu, jamais de la donnée, jamais l'or) ;
 * - apparition des marqueurs en fondu séquentiel (rejoué au changement de
 *   filtre), panneau de détail monté/démonté en AnimatedPresence ;
 * - vue liste cascadée (Stagger) avec liserés par catégorie.
 *
 * ÉCART À LA MAQUETTE (assumé). Le PNG montre un mode LIVE (positions des
 * pilotes en temps réel, badge LIVE rouge, temps restant, nb de voitures) qui
 * N'EXISTE PAS côté pilote : le suivi en direct est réservé au Coach (décision
 * P5 ; §12 « En direct · centre de contrôle », coach-only). On NE simule donc
 * NI positions de pilotes NI badge LIVE.
 *
 * Fusion (décision Gabin 2026-06) : les anciennes routes `social` /
 * `social-carte` / `lieux` ont été SUPPRIMÉES (PR-86) au profit de cet écran ;
 * le modèle `places` est déprécié au profit de `social_pings`.
 *
 * Données RÉELLES uniquement : circuits (circuitsService) + points publiés
 * (social_pings, RLS membres validés). Les points partenaires n'apparaissent
 * qu'une fois validés par OXV (is_published, workflow fondateur 2026-07-16).
 *
 * Doctrine : visualisation sobre, aucune gamification, aucun classement.
 * **or = chrono/record UNIQUEMENT** — les couleurs de catégorie sont des
 * identités de lieu (carteIdentity.ts) ; bascule, chips et CTA jamais or.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

import { EmptyState } from '@/components/instruments/EmptyState';
import {
  AnimatedPresence,
  FadeInSection,
  PressableScale,
  Stagger,
  useReduceMotion,
} from '@/components/motion';
import { isExpoGo } from '@/lib/runtime';
import { type Circuit, fetchCircuits } from '@/services/circuitsService';
import {
  type CarteCategoryKey,
  type SocialPing,
  CARTE_CATEGORIES,
  PING_KIND_LABELS,
  categoryOfKind,
  countPingsByCategory,
  filterPingsByCategory,
  groupPingsByKind,
  listSocialPings,
} from '@/services/socialPingsService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import {
  CARTE_CATEGORY_COLOR,
  CARTE_CATEGORY_GLYPH,
  CARTE_CIRCUIT_COLOR,
} from '@/ui/carteIdentity';
import { Screen } from '@/ui/Screen';
import { formatDateLong } from '@/utils/format';

const { palette, fonts, fontSize, spacing, radius } = theme;

// Centre par défaut : Nouvelle-Aquitaine.
const DEFAULT_REGION = {
  latitude: 45.6,
  longitude: -0.4,
  latitudeDelta: 3.2,
  longitudeDelta: 3.2,
};

type ViewMode = 'carte' | 'liste';
type CatFilter = 'tout' | CarteCategoryKey;
type Selected = { type: 'circuit'; circuit: Circuit } | { type: 'ping'; ping: SocialPing } | null;

export default function CarteOxvScreen() {
  const canMap = !isExpoGo();
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [pings, setPings] = useState<SocialPing[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<ViewMode>('carte');
  const [cat, setCat] = useState<CatFilter>('tout');
  const [selected, setSelected] = useState<Selected>(null);
  // Contenu du panneau retenu pendant le fondu sortant (AnimatedPresence).
  const [panelData, setPanelData] = useState<NonNullable<Selected> | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCircuits(), listSocialPings()])
      .then(([c, p]) => {
        if (cancelled) return;
        setCircuits(
          c.filter((x) => Number.isFinite(x.finishLineLat) && Number.isFinite(x.finishLineLon))
        );
        setPings(p);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selected) setPanelData(selected);
  }, [selected]);

  const counts = countPingsByCategory(pings);
  const filtered = filterPingsByCategory(pings, cat);
  const showMap = canMap && view === 'carte';
  // Les circuits restent visibles quel que soit le filtre (repère maître).
  const visibleCount = circuits.length + filtered.length;

  const onCategoryChange = (next: CatFilter) => {
    setCat(next);
    setSelected(null);
  };

  return (
    <Screen scroll={false}>
      <AppBar
        title="La carte OXV"
        subtitle="Circuits · lieux · événements"
        onBack={() => router.back()}
      />

      {canMap ? <ViewToggle view={view} onChange={setView} /> : null}
      <CategoryChips cat={cat} counts={counts} total={pings.length} onChange={onCategoryChange} />

      {showMap ? (
        <View style={{ flex: 1 }}>
          <View style={s.mapFrame}>
            <MapView
              provider={PROVIDER_DEFAULT}
              style={{ flex: 1 }}
              initialRegion={DEFAULT_REGION}
              showsPointsOfInterests={false}
              showsCompass={false}
              toolbarEnabled={false}
              onPress={() => setSelected(null)}
            >
              {circuits.map((c, i) => (
                <FadeMarker
                  key={`c-${c.id}`}
                  coordinate={{ latitude: c.finishLineLat, longitude: c.finishLineLon }}
                  index={i}
                  onPress={() => setSelected({ type: 'circuit', circuit: c })}
                >
                  <View style={s.markerCircuit}>
                    <View style={s.markerCircuitCore} />
                  </View>
                </FadeMarker>
              ))}
              {filtered.map((p, i) => {
                const key = categoryOfKind(p.kind);
                const color = CARTE_CATEGORY_COLOR[key];
                return (
                  // La clé porte le filtre : le fondu séquentiel se rejoue à
                  // chaque transition d'onglet.
                  <FadeMarker
                    key={`${cat}-p-${p.id}`}
                    coordinate={{ latitude: p.lat, longitude: p.lon }}
                    index={circuits.length + i}
                    onPress={() => setSelected({ type: 'ping', ping: p })}
                  >
                    <View style={[s.markerDot, { borderColor: color }]}>
                      <Text style={[s.markerGlyph, { color }]}>{CARTE_CATEGORY_GLYPH[key]}</Text>
                    </View>
                  </FadeMarker>
                );
              })}
            </MapView>

            {loading ? (
              <View style={s.loadingPill}>
                <ActivityIndicator
                  color={palette.creamSoft}
                  size="small"
                  accessibilityLabel="Chargement de la carte"
                />
                <Text style={s.loadingTxt}>Chargement</Text>
              </View>
            ) : null}

            {/* Légende : circuits + catégories réellement affichées. */}
            <View style={s.legend}>
              <LegendItem color={CARTE_CIRCUIT_COLOR} label="Circuits" />
              {CARTE_CATEGORIES.filter((c) =>
                cat === 'tout' ? counts[c.key] > 0 : c.key === cat
              ).map((c) => (
                <LegendItem key={c.key} color={CARTE_CATEGORY_COLOR[c.key]} label={c.label} />
              ))}
            </View>
          </View>

          {/* Note factuelle (transposée de la maquette : un repère, pas un rang). */}
          <View style={s.mapNote}>
            <View style={s.mapNoteDot} accessibilityElementsHidden importantForAccessibility="no" />
            <Text style={s.mapNoteT}>
              Chaque point est un repère du territoire OXV. Aucun rang.
            </Text>
          </View>

          {/* Panneau « au clic » — monté/démonté en fondu (AnimatedPresence). */}
          {panelData ? (
            <AnimatedPresence visible={selected !== null} style={s.panelWrap}>
              <DetailPanel selected={panelData} onClose={() => setSelected(null)} />
            </AnimatedPresence>
          ) : null}
        </View>
      ) : (
        <TerritoryList loading={loading} failed={failed} pings={filtered} filterKey={cat} />
      )}

      <View style={s.actionBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voir les circuits en liste"
          hitSlop={theme.hitSlop}
          onPress={() => router.push('/(app)/circuits' as never)}
          style={({ pressed }) => [s.actionHit, pressed && { opacity: 0.85 }]}
        >
          <Text style={s.action}>Les circuits en liste</Text>
        </Pressable>
        <Text style={s.count} accessibilityLabel={`${visibleCount} points sur la carte`}>
          <Text style={s.countNum}>{visibleCount}</Text> points
        </Text>
      </View>
    </Screen>
  );
}

/**
 * Marqueur en fondu séquentiel. `tracksViewChanges` reste actif le temps du
 * fondu (les enfants du Marker sont rasterisés par react-native-maps) puis
 * se coupe pour la performance. Reduce-motion : rendu direct.
 */
function FadeMarker({
  coordinate,
  index,
  onPress,
  children,
}: {
  coordinate: { latitude: number; longitude: number };
  index: number;
  onPress: () => void;
  children: ReactNode;
}) {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      setSettled(true);
      return;
    }
    const anim = Animated.timing(opacity, {
      toValue: 1,
      duration: 320,
      delay: Math.min(index * 60, 900),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) setSettled(true);
    });
    return () => anim.stop();
  }, [reduceMotion, index, opacity]);

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={!settled}
      onPress={onPress}
    >
      <Animated.View style={{ opacity }}>{children}</Animated.View>
    </Marker>
  );
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <View style={s.toggle}>
      {(['carte', 'liste'] as const).map((mode) => {
        const on = view === mode;
        return (
          <PressableScale
            key={mode}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={mode === 'carte' ? 'Vue carte' : 'Vue liste'}
            hitSlop={theme.hitSlop}
            haptic="tap"
            onPress={() => onChange(mode)}
            style={[s.toggleBtn, on ? s.toggleBtnOn : null]}
          >
            <Text style={[s.toggleT, on ? s.toggleTOn : null]}>
              {mode === 'carte' ? 'Carte' : 'Liste'}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/**
 * Onglets par catégorie — comptes RÉELS, chips masquées à zéro. Masqué
 * entièrement tant qu'aucun point n'est publié (rien à filtrer).
 */
function CategoryChips({
  cat,
  counts,
  total,
  onChange,
}: {
  cat: CatFilter;
  counts: Record<CarteCategoryKey, number>;
  total: number;
  onChange: (c: CatFilter) => void;
}) {
  if (total === 0) return null;

  const items: { key: CatFilter; label: string; count: number; color: string | null }[] = [
    { key: 'tout', label: 'Tout', count: total, color: null },
    ...CARTE_CATEGORIES.filter((c) => counts[c.key] > 0).map((c) => ({
      key: c.key as CatFilter,
      label: c.label,
      count: counts[c.key],
      color: CARTE_CATEGORY_COLOR[c.key],
    })),
  ];

  return (
    <FadeInSection>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipsRow}
      >
        {items.map((item) => {
          const on = cat === item.key;
          return (
            <PressableScale
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${item.label} — ${item.count} ${
                item.count > 1 ? 'points' : 'point'
              }`}
              hitSlop={theme.hitSlop}
              haptic="tap"
              onPress={() => onChange(item.key)}
              style={[s.chip, on ? s.chipOn : null]}
            >
              {item.color ? (
                <View
                  style={[s.chipDot, { backgroundColor: item.color }]}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              ) : null}
              <Text style={[s.chipT, on ? s.chipTOn : null]}>{item.label}</Text>
              <Text style={[s.chipCount, on ? s.chipCountOn : null]}>{item.count}</Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    </FadeInSection>
  );
}

function TerritoryList({
  loading,
  failed,
  pings,
  filterKey,
}: {
  loading: boolean;
  failed: boolean;
  pings: SocialPing[];
  filterKey: CatFilter;
}) {
  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator
          color={palette.creamMute}
          accessibilityLabel="Chargement du territoire OXV"
        />
      </View>
    );
  }

  if (failed) {
    return (
      <ScrollView contentContainerStyle={s.listContent}>
        <EmptyState
          label="Indisponible"
          message="Le territoire n'a pas pu être chargé. À revoir quand votre connexion sera de retour."
          source="social_pings"
        />
      </ScrollView>
    );
  }

  if (pings.length === 0) {
    return (
      <ScrollView contentContainerStyle={s.listContent}>
        <EmptyState
          label="À l'horizon"
          message="Les événements et lieux OXV apparaîtront ici."
          source="social_pings"
        />
      </ScrollView>
    );
  }

  const groups = groupPingsByKind(pings);
  return (
    <ScrollView contentContainerStyle={s.listContent}>
      {/* La clé porte le filtre : la cascade se rejoue à chaque onglet. */}
      <Stagger key={filterKey} interval={70}>
        {groups.map((group) => {
          const color = CARTE_CATEGORY_COLOR[categoryOfKind(group.kind)];
          return (
            <View key={group.kind} style={s.group}>
              <View style={s.headRow}>
                <View
                  style={[s.headDot, { backgroundColor: color }]}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
                <Text style={s.groupEyebrow}>{PING_KIND_LABELS[group.kind]}</Text>
                <View
                  style={s.headLine}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
                <Text style={s.groupCount}>{group.items.length}</Text>
              </View>
              <View style={{ gap: spacing.sm }}>
                {group.items.map((ping) => (
                  <PingCard key={ping.id} ping={ping} accent={color} />
                ))}
              </View>
            </View>
          );
        })}
      </Stagger>
    </ScrollView>
  );
}

function PingCard({ ping, accent }: { ping: SocialPing; accent: string }) {
  const openUrl = (url: string | null) => {
    if (url) Linking.openURL(url).catch(() => undefined);
  };
  const openEmail = (email: string | null) => {
    if (email) Linking.openURL(`mailto:${email}`).catch(() => undefined);
  };

  return (
    <Card style={[s.pingCard, { borderLeftColor: accent }]}>
      <Text style={s.pingTitle}>{ping.title}</Text>
      <View style={s.pingMetas}>
        {ping.startsAt ? <PingMeta label="date" value={formatDateLong(ping.startsAt)} /> : null}
        {ping.address ? <PingMeta label="lieu" value={ping.address} /> : null}
      </View>
      {ping.description ? <Text style={s.pingBody}>{ping.description}</Text> : null}

      <View style={s.pingActions}>
        {/* Sémantique liste (comme l'ancien `social`) : aucune condition isEvent. */}
        {ping.liveUrl ? (
          <PingAction
            label="Direct"
            accessibilityLabel={`${ping.title} — suivre en direct`}
            onPress={() => openUrl(ping.liveUrl)}
            primary
          />
        ) : null}
        {ping.eventUrl ? (
          <PingAction
            label="Détails"
            accessibilityLabel={`${ping.title} — voir les détails`}
            onPress={() => openUrl(ping.eventUrl)}
          />
        ) : null}
        {ping.contactEmail ? (
          <PingAction
            label="Contacter"
            accessibilityLabel={`${ping.title} — écrire un message`}
            onPress={() => openEmail(ping.contactEmail)}
          />
        ) : null}
      </View>
    </Card>
  );
}

/** Rangée factuelle « micro-label mono · valeur » (langage v2). */
function PingMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metaRow}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={s.metaValue}>{value}</Text>
    </View>
  );
}

function PingAction({
  label,
  accessibilityLabel,
  onPress,
  primary,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={theme.hitSlop}
      haptic="tap"
      onPress={onPress}
      style={[s.btn, primary ? s.btnPrimary : s.btnGhost]}
    >
      <Text style={[s.btnT, primary ? s.btnTPrimary : null]}>{label}</Text>
    </PressableScale>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={s.legendItem}>
      <View
        style={[s.legendDot, { backgroundColor: color }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={s.legendT}>{label}</Text>
    </View>
  );
}

function DetailPanel({
  selected,
  onClose,
}: {
  selected: NonNullable<Selected>;
  onClose: () => void;
}) {
  if (selected.type === 'circuit') {
    const c = selected.circuit;
    return (
      <Card style={[s.panel, { borderTopColor: CARTE_CIRCUIT_COLOR }]}>
        <PanelHead
          label="Circuit OXV"
          accent={CARTE_CIRCUIT_COLOR}
          title={c.name}
          onClose={onClose}
        />
        {c.lengthKm ? (
          <View style={s.panelMetas}>
            <PingMeta label="longueur" value={`${c.lengthKm.toFixed(1).replace('.', ',')} km`} />
          </View>
        ) : null}
        <View style={s.panelActions}>
          <PanelAction
            label="Voir le circuit"
            primary
            onPress={() =>
              router.push({ pathname: '/(app)/circuit/[id]', params: { id: c.id } } as never)
            }
          />
        </View>
      </Card>
    );
  }

  const p = selected.ping;
  const accent = CARTE_CATEGORY_COLOR[categoryOfKind(p.kind)];
  const isEvent = p.kind === 'event_oxv' || p.kind === 'event_partner' || p.kind === 'soiree';
  return (
    <Card style={[s.panel, { borderTopColor: accent }]}>
      <PanelHead
        label={PING_KIND_LABELS[p.kind]}
        accent={accent}
        title={p.title}
        onClose={onClose}
      />
      {p.imageUrl ? (
        <Image
          source={{ uri: p.imageUrl }}
          resizeMode="cover"
          style={s.panelImage}
          accessibilityLabel={`Visuel — ${p.title}`}
        />
      ) : null}
      <View style={s.panelMetas}>
        {p.startsAt ? <PingMeta label="date" value={formatDateLong(p.startsAt)} /> : null}
        {p.address ? <PingMeta label="lieu" value={p.address} /> : null}
      </View>
      {p.description ? (
        <Text style={s.panelBody} numberOfLines={3}>
          {p.description}
        </Text>
      ) : null}
      <View style={s.panelActions}>
        {/* Liens du point : Direct/Détails (événement), Site, réseaux, contact. */}
        {isEvent && p.liveUrl ? (
          <PanelAction label="Direct" primary onPress={() => open(p.liveUrl)} />
        ) : null}
        {p.websiteUrl ? (
          <PanelAction label="Site web" primary={!isEvent} onPress={() => open(p.websiteUrl)} />
        ) : null}
        {isEvent && p.eventUrl ? (
          <PanelAction label="Détails" onPress={() => open(p.eventUrl)} />
        ) : null}
        {p.instagramUrl ? (
          <PanelAction label="Instagram" onPress={() => open(p.instagramUrl)} />
        ) : null}
        {p.facebookUrl ? (
          <PanelAction label="Facebook" onPress={() => open(p.facebookUrl)} />
        ) : null}
        {p.youtubeUrl ? <PanelAction label="YouTube" onPress={() => open(p.youtubeUrl)} /> : null}
        {p.contactEmail ? (
          <PanelAction label="Contacter" onPress={() => open(`mailto:${p.contactEmail}`)} />
        ) : null}
      </View>
    </Card>
  );
}

function open(url: string | null) {
  if (url) Linking.openURL(url).catch(() => undefined);
}

function PanelHead({
  label,
  accent,
  title,
  onClose,
}: {
  label: string;
  accent: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <View style={s.panelHead}>
      <View style={{ flex: 1 }}>
        <View style={s.panelEyebrowRow}>
          <View
            style={[s.panelEyebrowDot, { backgroundColor: accent }]}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text style={s.panelEyebrow}>{label}</Text>
        </View>
        <Text style={s.panelTitle}>{title}</Text>
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Fermer"
        hitSlop={theme.hitSlop}
        onPress={onClose}
        style={s.panelClose}
      >
        <View style={s.panelCloseX} accessibilityElementsHidden importantForAccessibility="no" />
      </PressableScale>
    </View>
  );
}

function PanelAction({
  label,
  primary,
  onPress,
}: {
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      haptic="tap"
      onPress={onPress}
      style={[s.btn, primary ? s.btnPrimary : s.btnGhost]}
    >
      <Text style={[s.btnT, primary ? s.btnTPrimary : null]}>{label}</Text>
    </PressableScale>
  );
}

/* ------------------------------------------------------------------ */
/* Styles — langage refonte-v2 : surfaces sombres, hairlines,          */
/* eyebrows mono, cadre de carte, identités de catégorie               */
/* (carteIdentity.ts — jamais l'or). Cibles tactiles ≥ 44 px.          */
/* ------------------------------------------------------------------ */

const s = {
  centered: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.xl,
  },

  // — Bascule Carte / Liste (segment sobre v2) —
  toggle: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  toggleBtn: {
    minHeight: 36,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center' as const,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.line,
  },
  // Actif = fond gris (card2), jamais d'or ni de heritageGold.
  toggleBtnOn: { backgroundColor: palette.card2, borderColor: palette.cardBorderProminent },
  toggleT: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  toggleTOn: { color: palette.cream },

  // — Onglets par catégorie (chips à compte réel, point d'identité) —
  chipsRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  chip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
  },
  chipOn: { backgroundColor: palette.card2, borderColor: palette.cardBorderProminent },
  chipDot: { width: 7, height: 7, borderRadius: 3.5 },
  chipT: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  chipTOn: { color: palette.cream },
  chipCount: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: palette.faint,
  },
  chipCountOn: { color: palette.creamSoft },

  // — Vue carte (cadre sombre v2 autour du MapView) —
  mapFrame: {
    flex: 1,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    overflow: 'hidden' as const,
  },
  mapNote: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  mapNoteDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.creamSoft,
  },
  mapNoteT: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.4,
    color: palette.creamMute,
  },

  // — Marqueurs par catégorie (pastille sombre + initiale mono) —
  markerDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    backgroundColor: 'rgba(11,11,13,0.92)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  markerGlyph: {
    fontFamily: fonts.monoSemi,
    fontSize: 11,
    letterSpacing: 0,
  },
  markerCircuit: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: CARTE_CIRCUIT_COLOR,
    backgroundColor: 'rgba(11,11,13,0.92)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  markerCircuitCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: CARTE_CIRCUIT_COLOR,
  },

  // — Liste territoire —
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  group: { marginTop: spacing.xl, gap: spacing.sm },
  headRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  // Point d'identité de catégorie (couleur posée inline — jamais or).
  headDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  groupEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase' as const,
    color: palette.eyebrow,
  },
  headLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.separator,
  },
  groupCount: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.5,
    color: palette.faint,
  },

  // — Carte d'un point (liseré gauche = identité de catégorie, jamais or) —
  pingCard: {
    backgroundColor: palette.card2,
    borderLeftWidth: 2,
    borderLeftColor: palette.edge,
    padding: spacing.lg,
  },
  pingTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  pingMetas: { marginTop: spacing.sm, gap: spacing.xs },
  pingBody: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.sm,
    lineHeight: fontSize.small * 1.5,
  },
  pingActions: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  // — Rangée factuelle « label mono · valeur » —
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.md,
  },
  metaLabel: {
    width: 56,
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: palette.faint,
    paddingTop: 2,
  },
  metaValue: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.3,
    color: palette.creamMute,
  },

  // — Boutons (partagés carte/liste) : ghost bordé, primaire fond card2 —
  btn: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  // Doctrine : or = donnée. Le CTA primaire se distingue par un fond gris
  // (card2) + bordure prominente, jamais par l'or.
  btnPrimary: { backgroundColor: palette.card2, borderColor: palette.cardBorderProminent },
  btnGhost: { borderColor: palette.line },
  btnT: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  btnTPrimary: { color: palette.cream },

  // — Overlays carte —
  loadingPill: {
    position: 'absolute' as const,
    top: spacing.md,
    alignSelf: 'center' as const,
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  loadingTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: palette.creamSoft,
  },
  legend: {
    position: 'absolute' as const,
    top: spacing.md,
    left: spacing.md,
    backgroundColor: 'rgba(11,11,13,0.72)',
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    gap: 4,
  },
  legendItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendT: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: palette.creamSoft,
  },

  // — Panneau « au clic » (liseré haut = identité, hairlines, eyebrow) —
  panelWrap: {
    position: 'absolute' as const,
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
  },
  panel: {
    backgroundColor: palette.card2,
    borderTopWidth: 2,
    borderTopColor: palette.edge,
    padding: spacing.lg,
  },
  panelImage: {
    width: '100%' as const,
    height: 120,
    borderRadius: radius.sm,
    backgroundColor: palette.card,
    marginTop: spacing.md,
  },
  panelHead: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.md,
  },
  panelEyebrowRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 4,
  },
  panelEyebrowDot: { width: 6, height: 6, borderRadius: 3 },
  panelEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    color: palette.eyebrow,
  },
  panelTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.h3,
    letterSpacing: 0.2,
    color: palette.cream,
  },
  panelClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  panelCloseX: {
    width: 11,
    height: 11,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: palette.creamMute,
    transform: [{ rotate: '-45deg' }],
    marginTop: -2,
  },
  panelMetas: { marginTop: spacing.md, gap: spacing.xs },
  panelBody: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
    marginTop: spacing.sm,
  },
  panelActions: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  // — Barre d'action basse —
  actionBar: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.separator,
  },
  actionHit: { minHeight: 44, justifyContent: 'center' as const },
  action: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.small,
    letterSpacing: 0.3,
    color: palette.cream,
  },
  count: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
  },
  countNum: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.creamSoft,
  },
};
