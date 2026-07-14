/**
 * Écran « La carte OXV » — écran UNIQUE du territoire OXV (carte + liste).
 * Reskin fidèle au langage refonte-v2 (§7bis, screens/34-carte-oxv-live.png).
 *
 * ÉCART À LA MAQUETTE (assumé). Le PNG montre un mode LIVE (positions des
 * pilotes en temps réel, badge LIVE rouge, temps restant, nb de voitures) qui
 * N'EXISTE PAS côté pilote : le suivi en direct est réservé au Coach (décision
 * P5 ; §12 « En direct · centre de contrôle », coach-only). On NE simule donc
 * NI positions de pilotes NI badge LIVE. Ce qui est repris de la maquette :
 * le langage sombre v2 (surfaces, hairlines, eyebrows mono, liseré d'accent),
 * la carte réelle du territoire, et la note factuelle « repère, pas classement »
 * transposée aux points réels de la carte. Écart noté dans sharedChangesNeeded.
 *
 * Fusion (décision Gabin 2026-06) : les anciennes routes `social` /
 * `social-carte` / `lieux` ont été SUPPRIMÉES (PR-86) au profit de cet écran ;
 * le modèle `places` (partners/lodgings/restaurants, tables vides) est déprécié
 * au profit de `social_pings`. Voir `roadmap/rapports/pr-08-fusion-carte-oxv.md`.
 *
 * Deux vues via un bascule sobre : « Carte » (MapView, marqueurs circuits +
 * points du territoire, panneau « au clic ») et « Liste » (points groupés par
 * type, actions Direct/Détails/Contacter). En Expo Go la carte native est
 * indisponible → la vue Liste est rendue d'office.
 *
 * Données RÉELLES uniquement : circuits (circuitsService) + points publiés
 * (social_pings, RLS membres validés). Chiffres/textes de la maquette = exemples.
 *
 * Doctrine : visualisation sobre, aucune gamification, aucun classement.
 * **or = chrono/record UNIQUEMENT** — un marqueur de circuit est un repère
 * d'identité (pas un temps), donc crème ; le bascule, les filtres, les puces de
 * groupe et les CTA restent gris/crème, jamais or.
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
  const total = circuits.length + pings.length;

  return (
    <Screen scroll={false}>
      <AppBar
        title="La carte OXV"
        subtitle="Circuits · lieux · événements"
        onBack={() => router.back()}
      />

      {canMap ? <ViewToggle view={view} onChange={setView} /> : null}

      {showMap ? (
        <View style={{ flex: 1 }}>
          <View style={s.mapFrame}>
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
                  pinColor={palette.cream}
                  onPress={() => setSelected({ type: 'circuit', circuit: c })}
                />
              ))}
              {pings.map((p) => (
                <Marker
                  key={`p-${p.id}`}
                  coordinate={{ latitude: p.lat, longitude: p.lon }}
                  title={p.title}
                  description={PING_KIND_LABELS[p.kind]}
                  pinColor={palette.creamSoft}
                  onPress={() => setSelected({ type: 'ping', ping: p })}
                />
              ))}
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

            {/* Légende sobre */}
            <View style={s.legend}>
              <LegendItem color={palette.cream} label="Circuits" />
              <LegendItem color={palette.creamSoft} label="Lieux & événements" />
            </View>
          </View>

          {/* Note factuelle (transposée de la maquette : un repère, pas un rang). */}
          <View style={s.mapNote}>
            <View style={s.mapNoteDot} accessibilityElementsHidden importantForAccessibility="no" />
            <Text style={s.mapNoteT}>
              Chaque point est un repère du territoire OXV. Aucun rang.
            </Text>
          </View>

          {/* Panneau « au clic » */}
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
        <Text style={s.count} accessibilityLabel={`${total} points sur la carte`}>
          <Text style={s.countNum}>{total}</Text> points
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
      {groups.map((group) => (
        <View key={group.kind} style={s.group}>
          <View style={s.headRow}>
            <View style={s.headDot} accessibilityElementsHidden importantForAccessibility="no" />
            <Text style={s.groupEyebrow}>{PING_KIND_LABELS[group.kind]}</Text>
            <View style={s.headLine} accessibilityElementsHidden importantForAccessibility="no" />
            <Text style={s.groupCount}>{group.items.length}</Text>
          </View>
          <View style={{ gap: spacing.sm }}>
            {group.items.map((ping) => (
              <PingCard key={ping.id} ping={ping} />
            ))}
          </View>
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
    <Card style={s.pingCard}>
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={theme.hitSlop}
      onPress={onPress}
      style={({ pressed }) => [s.btn, primary ? s.btnPrimary : s.btnGhost, pressed && s.btnPressed]}
    >
      <Text style={[s.btnT, primary ? s.btnTPrimary : null]}>{label}</Text>
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
        <View style={s.panelCloseX} accessibilityElementsHidden importantForAccessibility="no" />
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
      style={({ pressed }) => [s.btn, primary ? s.btnPrimary : s.btnGhost, pressed && s.btnPressed]}
    >
      <Text style={[s.btnT, primary ? s.btnTPrimary : null]}>{label}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Styles — langage refonte-v2 : surfaces sombres, hairlines,          */
/* eyebrows mono, cadre de carte, liseré d'accent crème (identité,     */
/* jamais l'or). Cibles tactiles ≥ 44 px.                              */
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
  // Doctrine : puce de groupe en gris (creamMute), jamais or.
  headDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.creamMute,
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

  // — Carte d'un point (liseré gauche crème = identité territoire, jamais or) —
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
  btnPressed: { opacity: 0.85 },
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

  // — Panneau « au clic » (liseré haut crème, hairlines, eyebrow) —
  panel: {
    position: 'absolute' as const,
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
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
  panelEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    color: palette.eyebrow,
    marginBottom: 4,
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
