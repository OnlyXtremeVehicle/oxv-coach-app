/**
 * Écran « La carte OXV » — écran UNIQUE du territoire OXV (carte + liste).
 *
 * Fusion (décision Gabin 2026-06) : `social`, `social-carte` et `lieux` sont
 * désormais des coquilles `<Redirect>` vers cet écran ; le modèle `places`
 * (partners/lodgings/restaurants, tables vides) est déprécié au profit de
 * `social_pings`. Voir `roadmap/rapports/pr-08-fusion-carte-oxv.md`.
 *
 * Deux vues via un bascule sobre : « Carte » (MapView, marqueurs circuits +
 * points du territoire, panneau « marketing au clic ») et « Liste » (points
 * groupés par type, actions Direct/Détails/Contacter). En Expo Go la carte
 * native est indisponible → la vue Liste est rendue d'office.
 *
 * Doctrine : visualisation sobre, aucune gamification, aucun classement.
 * **or = donnée (marqueurs circuits) UNIQUEMENT** — le bascule, les filtres, les
 * puces de groupe et les CTA restent gris/crème, jamais or.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

import { EmptyState } from '@/components/instruments/EmptyState';
import { isExpoGo } from '@/lib/runtime';
import { type Circuit, fetchCircuits } from '@/services/circuitsService';
import {
  type SocialPing,
  PING_KIND_LABELS,
  groupPingsByKind,
  listSocialPings,
} from '@/services/socialPingsService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateLong } from '@/utils/format';

// Centre par défaut : Nouvelle-Aquitaine.
const DEFAULT_REGION = {
  latitude: 45.6,
  longitude: -0.4,
  latitudeDelta: 3.2,
  longitudeDelta: 3.2,
};

type ViewMode = 'carte' | 'liste';
type Selected = { type: 'circuit'; circuit: Circuit } | { type: 'ping'; ping: SocialPing } | null;

export default function CarteOxvScreen() {
  const canMap = !isExpoGo();
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [pings, setPings] = useState<SocialPing[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<ViewMode>('carte');
  const [selected, setSelected] = useState<Selected>(null);

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

  const showMap = canMap && view === 'carte';

  return (
    <Screen scroll={false}>
      <AppBar
        title="LA CARTE OXV"
        subtitle="Circuits · lieux · événements"
        onBack={() => router.back()}
      />

      {canMap ? <ViewToggle view={view} onChange={setView} /> : null}

      {showMap ? (
        <View style={{ flex: 1 }}>
          <MapView
            provider={PROVIDER_DEFAULT}
            style={{ flex: 1 }}
            initialRegion={DEFAULT_REGION}
            showsPointsOfInterest={false}
            showsCompass={false}
            toolbarEnabled={false}
            onPress={() => setSelected(null)}
          >
            {circuits.map((c) => (
              <Marker
                key={`c-${c.id}`}
                coordinate={{ latitude: c.finishLineLat, longitude: c.finishLineLon }}
                title={c.name}
                description="Circuit OXV"
                pinColor={theme.palette.gold}
                onPress={() => setSelected({ type: 'circuit', circuit: c })}
              />
            ))}
            {pings.map((p) => (
              <Marker
                key={`p-${p.id}`}
                coordinate={{ latitude: p.lat, longitude: p.lon }}
                title={p.title}
                description={PING_KIND_LABELS[p.kind]}
                pinColor={theme.palette.creamSoft}
                onPress={() => setSelected({ type: 'ping', ping: p })}
              />
            ))}
          </MapView>

          {loading ? (
            <View style={s.loadingPill}>
              <ActivityIndicator
                color={theme.palette.creamSoft}
                size="small"
                accessibilityLabel="Chargement de la carte"
              />
              <Text style={s.loadingTxt}>Chargement…</Text>
            </View>
          ) : null}

          {/* Légende sobre */}
          <View style={s.legend}>
            <LegendItem color={theme.palette.gold} label="Circuits" />
            <LegendItem color={theme.palette.creamSoft} label="Lieux & événements" />
          </View>

          {/* Panneau « marketing au clic » */}
          {selected ? <DetailPanel selected={selected} onClose={() => setSelected(null)} /> : null}
        </View>
      ) : (
        <TerritoryList loading={loading} failed={failed} pings={pings} />
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
        <Text
          style={s.count}
          accessibilityLabel={`${circuits.length + pings.length} points sur la carte`}
        >
          <Text style={s.countNum}>{circuits.length + pings.length}</Text> points
        </Text>
      </View>
    </Screen>
  );
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <View style={s.toggle}>
      {(['carte', 'liste'] as const).map((mode) => {
        const on = view === mode;
        return (
          <Pressable
            key={mode}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={mode === 'carte' ? 'Vue carte' : 'Vue liste'}
            hitSlop={theme.hitSlop}
            onPress={() => onChange(mode)}
            style={[s.toggleBtn, on ? s.toggleBtnOn : null]}
          >
            <Text style={[s.toggleT, on ? s.toggleTOn : null]}>
              {mode === 'carte' ? 'Carte' : 'Liste'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TerritoryList({
  loading,
  failed,
  pings,
}: {
  loading: boolean;
  failed: boolean;
  pings: SocialPing[];
}) {
  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator
          color={theme.palette.creamMute}
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
          message="Le territoire n'a pas pu être chargé. Réessayez quand votre connexion sera de retour."
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
      {groups.map((group) => (
        <View key={group.kind} style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
          <View style={s.headRow}>
            <View style={s.headDot} accessibilityElementsHidden importantForAccessibility="no" />
            <SectionLabel>{PING_KIND_LABELS[group.kind]}</SectionLabel>
          </View>
          {group.items.map((ping) => (
            <PingCard key={ping.id} ping={ping} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function PingCard({ ping }: { ping: SocialPing }) {
  const openUrl = (url: string | null) => {
    if (url) Linking.openURL(url).catch(() => undefined);
  };
  const openEmail = (email: string | null) => {
    if (email) Linking.openURL(`mailto:${email}`).catch(() => undefined);
  };

  return (
    <Card style={s.dataPanel}>
      <Text style={s.pingTitle}>{ping.title}</Text>
      {ping.startsAt ? <Text style={s.pingMeta}>{formatDateLong(ping.startsAt)}</Text> : null}
      {ping.description ? <Text style={s.pingBody}>{ping.description}</Text> : null}
      {ping.address ? <Text style={s.pingAddr}>{ping.address}</Text> : null}

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          marginTop: theme.spacing.md,
        }}
      >
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={theme.hitSlop}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: theme.palette.edge,
        // Doctrine : or = donnée. Le CTA primaire se distingue par un fond gris
        // (card2), jamais par l'or.
        backgroundColor: primary ? theme.palette.card2 : 'transparent',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: theme.fonts.bodyMedium,
          fontSize: theme.fontSize.small,
          letterSpacing: 0.3,
          color: theme.palette.cream,
        }}
      >
        {label}
      </Text>
    </Pressable>
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
      <Card style={s.panel}>
        <PanelHead label="Circuit OXV" title={c.name} onClose={onClose} />
        {c.lengthKm ? (
          <Text style={s.panelMeta}>{c.lengthKm.toFixed(1).replace('.', ',')} km</Text>
        ) : null}
        <PanelAction
          label="Voir le circuit"
          primary
          onPress={() =>
            router.push({ pathname: '/(app)/circuit/[id]', params: { id: c.id } } as never)
          }
        />
      </Card>
    );
  }

  const p = selected.ping;
  const isEvent = p.kind === 'event_oxv' || p.kind === 'event_partner' || p.kind === 'soiree';
  return (
    <Card style={s.panel}>
      <PanelHead label={PING_KIND_LABELS[p.kind]} title={p.title} onClose={onClose} />
      {p.imageUrl ? (
        <Image
          source={{ uri: p.imageUrl }}
          resizeMode="cover"
          style={s.panelImage}
          accessibilityLabel={`Visuel — ${p.title}`}
        />
      ) : null}
      {p.startsAt ? <Text style={s.panelMeta}>{formatDateLong(p.startsAt)}</Text> : null}
      {p.description ? (
        <Text style={s.panelBody} numberOfLines={3}>
          {p.description}
        </Text>
      ) : null}
      {p.address ? <Text style={s.panelAddr}>{p.address}</Text> : null}
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
  title,
  onClose,
}: {
  label: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <View style={s.panelHead}>
      <View style={{ flex: 1 }}>
        <Text style={s.panelEyebrow}>{label}</Text>
        <Text style={s.panelTitle}>{title}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fermer"
        hitSlop={theme.hitSlop}
        onPress={onClose}
        style={s.panelClose}
      >
        <Text style={s.panelCloseT}>✕</Text>
      </Pressable>
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        s.panelBtn,
        primary ? s.panelBtnPrimary : s.panelBtnGhost,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={[s.panelBtnT, primary ? s.panelBtnTPrimary : null]}>{label}</Text>
    </Pressable>
  );
}

const s = {
  centered: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: theme.spacing.xl,
  },
  toggle: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  toggleBtn: {
    minHeight: 36,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.palette.line,
  },
  // Actif = fond gris (card2), jamais d'or ni de heritageGold.
  toggleBtnOn: { backgroundColor: theme.palette.card2, borderColor: theme.palette.edge },
  toggleT: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  toggleTOn: { color: theme.palette.cream },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  loadingPill: {
    position: 'absolute' as const,
    top: theme.spacing.md,
    alignSelf: 'center' as const,
    backgroundColor: theme.palette.card,
    borderColor: theme.palette.line,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  loadingTxt: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
  },
  legend: {
    position: 'absolute' as const,
    top: theme.spacing.md,
    left: theme.spacing.md,
    backgroundColor: 'rgba(5,5,5,0.6)',
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    gap: 4,
  },
  legendItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendT: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
  },
  headRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  // Doctrine : puce de groupe en gris (creamMute), jamais or.
  headDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.creamMute,
  },
  dataPanel: { backgroundColor: theme.palette.card2 },
  pingTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  pingMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.xs,
  },
  pingBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.sm,
    lineHeight: theme.fontSize.small * 1.5,
  },
  pingAddr: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  panel: {
    position: 'absolute' as const,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    bottom: theme.spacing.lg,
    backgroundColor: theme.palette.card2,
  },
  panelImage: {
    width: '100%' as const,
    height: 120,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.palette.card,
    marginTop: theme.spacing.md,
  },
  panelHead: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: theme.spacing.md,
  },
  panelEyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginBottom: 4,
  },
  panelTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 0.3,
    color: theme.palette.cream,
  },
  panelClose: {
    width: 32,
    height: 32,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  panelCloseT: { fontFamily: theme.fonts.body, fontSize: 16, color: theme.palette.creamMute },
  panelMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.6,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.sm,
  },
  panelBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: theme.spacing.sm,
  },
  panelAddr: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  panelActions: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  panelBtn: {
    minHeight: 44,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  // Doctrine : or = donnée. Le CTA primaire du panneau se distingue par un fond
  // gris (card2) + bordure, jamais par l'or.
  panelBtnPrimary: {
    backgroundColor: theme.palette.card2,
    borderWidth: 1,
    borderColor: theme.palette.edge,
  },
  panelBtnGhost: { borderWidth: 1, borderColor: theme.palette.edge },
  panelBtnT: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  panelBtnTPrimary: { color: theme.palette.cream },
  actionBar: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.palette.line,
  },
  actionHit: { minHeight: 44, justifyContent: 'center' as const },
  action: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.3,
    color: theme.palette.cream,
  },
  count: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  countNum: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
  },
};
