/**
 * CLUB HUB — porte communauté (app2), lot V2-L5 écran 1/7.
 *
 * Un fil vertical de blocs qui RESPIRE : chaque bloc n'apparaît que s'il a du
 * contenu réel (règle « données réelles » — absent = masqué, jamais un
 * placeholder). Header condensable « CLUB » + eyebrow « LE PADDOCK » accent,
 * puis, dans l'ordre : Mon coaching (binôme ou découverte), Mon groupe (A3 —
 * fil de faits d'écurie SANS chrono d'autrui, doctrine), Roulages à venir, Pass,
 * Partenaires.
 *
 * Tout vient de `useClubHub` (services existants). Panne TOTALE des sources =
 * StateView erreur + Réessayer ; sinon un bloc muet vaut mieux qu'une alarme.
 */

import { useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { router } from 'expo-router';
import Animated, { runOnJS, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/useAuthStore';
import {
  colors,
  CondensingHeaderBar,
  OxvIcon,
  Photo,
  PressScale,
  PullToRefreshDial,
  radius,
  SectionHeader,
  Shimmer,
  space,
  Stagger,
  StateView,
  tabBarSpace,
  typo,
  useCondensingHeader,
  useDoorTransition,
} from '@/ui/v2';

import { crewFactLine } from '@/features/club/clubHubLogic';
import {
  useClubHub,
  type HubCoaching,
  type HubCrew,
  type HubPartner,
  type HubPass,
  type HubRoulage,
} from '@/features/club/useClubHub';

export default function ClubHubScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const profileId = useAuthStore((s) => s.profile?.id ?? null);
  const hub = useClubHub(profileId);
  const header = useCondensingHeader();

  // Un scroll, deux consommateurs (worklet header + onScroll JS du dial) —
  // même composition que l'accueil Miroir (L1).
  const dialOnScroll = useRef<((e: NativeSyntheticEvent<NativeScrollEvent>) => void) | null>(null);
  const forwardScrollToDial = useCallback((y: number) => {
    dialOnScroll.current?.({
      nativeEvent: { contentOffset: { y } },
    } as NativeSyntheticEvent<NativeScrollEvent>);
  }, []);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    header.scrollY.value = event.contentOffset.y;
    runOnJS(forwardScrollToDial)(event.contentOffset.y);
  });

  const hasAnyBlock =
    hub.coaching !== null ||
    hub.crew !== null ||
    hub.roulages.length > 0 ||
    hub.pass !== null ||
    hub.partners.length > 0;

  return (
    <Animated.View style={[styles.root, door]}>
      <PullToRefreshDial refreshing={hub.refreshing} onRefresh={hub.refresh}>
        {(scrollProps) => {
          dialOnScroll.current = scrollProps.onScroll;
          return (
            <Animated.ScrollView
              onScroll={scrollHandler}
              scrollEventThrottle={scrollProps.scrollEventThrottle}
              bounces={scrollProps.bounces}
              overScrollMode={scrollProps.overScrollMode}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingTop: insets.top + space.md,
                paddingBottom: tabBarSpace(insets.bottom) + space.xl,
                paddingHorizontal: space.xl,
              }}
            >
              <Animated.View style={[styles.headerRow, header.headerStyle]}>
                <View>
                  <Text style={styles.headerEyebrow}>LE PADDOCK</Text>
                  <Animated.Text
                    style={[styles.headerTitle, header.titleStyle]}
                    accessibilityRole="header"
                  >
                    CLUB
                  </Animated.Text>
                </View>
              </Animated.View>

              {hub.status === 'loading' ? (
                <HubSkeleton />
              ) : hub.status === 'error' ? (
                <StateView
                  state="error"
                  errorMessage="Le club n'a pas pu se charger."
                  onRetry={hub.refresh}
                />
              ) : !hasAnyBlock ? (
                <StateView
                  state="empty"
                  emptyMessage="La vie du club s'installera ici — coaching, écurie, roulages."
                  style={styles.emptyState}
                />
              ) : (
                <Stagger step={45} initialDelay={45}>
                  {hub.coaching !== null ? <CoachingBlock coaching={hub.coaching} /> : null}
                  {hub.crew !== null ? <CrewBlock crew={hub.crew} /> : null}
                  {hub.roulages.length > 0 ? (
                    <RoulagesBlock roulages={hub.roulages} onRespond={hub.respondRoulage} />
                  ) : null}
                  {hub.pass !== null ? <PassBlock pass={hub.pass} /> : null}
                  {hub.partners.length > 0 ? <PartnersBlock partners={hub.partners} /> : null}
                </Stagger>
              )}
            </Animated.ScrollView>
          );
        }}
      </PullToRefreshDial>

      <CondensingHeaderBar
        condensedStyle={header.condensedStyle}
        height={52 + insets.top}
        style={{ paddingTop: insets.top }}
      >
        <Text style={styles.condensedTitle}>CLUB</Text>
      </CondensingHeaderBar>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Bloc — Mon coaching
// ---------------------------------------------------------------------------

const COACHING_HREF = '/(app2)/club/coaching';

function CoachingBlock({ coaching }: { coaching: HubCoaching }) {
  return (
    <View style={styles.block}>
      <SectionHeader eyebrow="COACHING" title="Mon coaching" />
      {coaching.kind === 'binome' ? (
        <PressScale
          onPress={() => router.navigate(COACHING_HREF as never)}
          // Le label explicite EFFACE la lecture des enfants : on y remet ce
          // que la carte montre (le rôle bouton porte déjà l'action).
          accessibilityLabel={[
            coaching.coachName,
            coaching.nextBookingLabel ? `Prochaine séance ${coaching.nextBookingLabel}` : null,
            coaching.lastMessagePreview,
          ]
            .filter(Boolean)
            .join('. ')}
          style={styles.card}
        >
          <View style={styles.cardRow}>
            <Avatar uri={coaching.coachPhotoUrl ?? null} size={48} />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {coaching.coachName}
              </Text>
              {coaching.nextBookingLabel !== null && coaching.nextBookingLabel !== undefined ? (
                <Text style={styles.cardMeta} numberOfLines={1}>
                  Prochaine séance · {coaching.nextBookingLabel}
                </Text>
              ) : null}
              {coaching.lastMessagePreview ? (
                <Text style={styles.cardQuote} numberOfLines={1}>
                  {coaching.lastMessagePreview}
                </Text>
              ) : null}
            </View>
            <Chevron />
          </View>
        </PressScale>
      ) : (
        <PressScale
          onPress={() => router.navigate(COACHING_HREF as never)}
          accessibilityLabel="Découvrir les coachs"
          style={styles.card}
        >
          <Text style={styles.discoverTitle}>Un regard extérieur sur votre pilotage</Text>
          <View style={styles.discoverRow}>
            <FacesRail faces={coaching.faces ?? []} />
            <Chevron />
          </View>
        </PressScale>
      )}
    </View>
  );
}

/** Rail de visages de coachs publiés — 40px chevauchés −8 (patron Airbnb). */
function FacesRail({ faces }: { faces: HubCoaching['faces'] }) {
  const list = (faces ?? []).slice(0, 5);
  if (list.length === 0) return null;
  return (
    <View style={styles.facesRail}>
      {list.map((f, i) => (
        <View key={f.coachId} style={[styles.faceWrap, i > 0 && styles.faceOverlap]}>
          <Avatar uri={f.photoUrl} size={40} />
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Bloc — Mon groupe (A3) : fil de FAITS d'écurie, jamais un chrono d'autrui.
// ---------------------------------------------------------------------------

function CrewBlock({ crew }: { crew: HubCrew }) {
  const avatars = crew.avatars.slice(0, 6);
  return (
    <View style={styles.block}>
      <SectionHeader eyebrow="ÉCURIE" title="Mon groupe" />
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.crewIcon}>
            <OxvIcon name="groupe" size={22} color={colors.text.mid} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {crew.title}
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {crew.memberCount > 1 ? `${crew.memberCount} pilotes` : '1 pilote'}
            </Text>
          </View>
        </View>

        {avatars.length > 0 ? (
          <View style={styles.crewAvatars}>
            {avatars.map((a, i) => (
              <View key={a.userId} style={[styles.faceWrap, i > 0 && styles.faceOverlap]}>
                <Avatar uri={a.avatarUrl} size={36} />
              </View>
            ))}
          </View>
        ) : null}

        {crew.facts.length > 0 ? (
          <View style={styles.factList}>
            {crew.facts.map((fact) => (
              <Text key={`${fact.userId}-${fact.dayIso}`} style={styles.factLine} numberOfLines={1}>
                {crewFactLine(fact)}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Bloc — Roulages à venir
// ---------------------------------------------------------------------------

function RoulagesBlock({
  roulages,
  onRespond,
}: {
  roulages: HubRoulage[];
  onRespond: (invitationId: string, accepted: boolean) => Promise<void>;
}) {
  return (
    <View style={styles.block}>
      <SectionHeader eyebrow="INVITATIONS" title="Roulages à venir" />
      <View style={styles.stack}>
        {roulages.map((r) => (
          <View key={r.invitationId} style={styles.card}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {r.title}
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {[r.whenLabel, r.circuitName].filter(Boolean).join(' · ')}
            </Text>
            {r.location ? (
              <Text style={styles.cardMetaDim} numberOfLines={1}>
                {r.location}
              </Text>
            ) : null}
            {r.pending ? (
              <View style={styles.actionsRow}>
                <PressScale
                  onPress={() => void onRespond(r.invitationId, true)}
                  accessibilityLabel={`Accepter ${r.title}`}
                  containerStyle={styles.actionFlex}
                  style={[styles.pill, styles.pillAccent]}
                >
                  <Text style={styles.pillAccentLabel}>Accepter</Text>
                </PressScale>
                <PressScale
                  onPress={() => void onRespond(r.invitationId, false)}
                  accessibilityLabel={`Décliner ${r.title}`}
                  containerStyle={styles.actionFlex}
                  style={[styles.pill, styles.pillGhost]}
                >
                  <Text style={styles.pillGhostLabel}>Décliner</Text>
                </PressScale>
              </View>
            ) : (
              <Text style={styles.responseLine}>Votre réponse : {r.statusLabel}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Bloc — Pass
// ---------------------------------------------------------------------------

function PassBlock({ pass }: { pass: HubPass }) {
  return (
    <View style={styles.block}>
      <SectionHeader eyebrow="PASS" title="Prochaine inscription" />
      <PressScale
        onPress={() => router.navigate('/(app2)/club/pass' as never)}
        accessibilityLabel={[pass.circuitName ?? 'Journée OXV', pass.dayLabel]
          .filter(Boolean)
          .join(', ')}
        style={styles.card}
      >
        <View style={styles.cardRow}>
          <View style={styles.crewIcon}>
            <OxvIcon name="insigne" size={22} color={colors.text.mid} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {pass.circuitName ?? 'Journée OXV'}
            </Text>
            {pass.dayLabel ? (
              <Text style={styles.cardMeta} numberOfLines={1}>
                {pass.dayLabel}
              </Text>
            ) : null}
          </View>
          <Chevron />
        </View>
      </PressScale>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Bloc — Partenaires (jamais de push télémétrique)
// ---------------------------------------------------------------------------

function PartnersBlock({ partners }: { partners: HubPartner[] }) {
  return (
    <View style={styles.block}>
      <SectionHeader eyebrow="ÉCOSYSTÈME" title="Partenaires" />
      <PressScale
        onPress={() => router.navigate('/(app2)/club/partenaires' as never)}
        // Les logos sont étiquetés un par un, mais le label du parent les
        // efface : on énonce ici les noms effectivement affichés.
        accessibilityLabel={`Partenaires : ${partners
          .slice(0, 8)
          .map((p) => p.name)
          .join(', ')}`}
        style={styles.partnersRail}
      >
        {partners.slice(0, 8).map((p) => (
          <View key={p.id} style={styles.partnerTile}>
            {p.logoUrl ? (
              <Photo uri={p.logoUrl} style={styles.partnerLogo} accessibilityLabel={p.name} />
            ) : (
              <View style={styles.partnerFallback}>
                <Text style={styles.partnerMono} numberOfLines={1}>
                  {p.name.slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        ))}
      </PressScale>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Primitives locales
// ---------------------------------------------------------------------------

function Avatar({ uri, size }: { uri: string | null; size: number }) {
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return <Photo uri={uri} style={[style, styles.avatarPhoto]} />;
  }
  return (
    <View style={[style, styles.avatarFallback]}>
      <OxvIcon name="casque" size={Math.round(size * 0.42)} color={colors.text.low} />
    </View>
  );
}

function Chevron() {
  return <Text style={styles.chevron}>›</Text>;
}

function HubSkeleton() {
  return (
    <View
      style={styles.skeleton}
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement du club"
    >
      <Shimmer height={12} width="34%" radius={radius.cell} />
      <Shimmer height={82} width="100%" radius={radius.card} />
      <Shimmer height={12} width="28%" radius={radius.cell} />
      <Shimmer height={120} width="100%" radius={radius.card} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles — tokens V2 uniquement
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: space.xl,
  },
  headerEyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  headerTitle: {
    fontFamily: typo.display,
    fontSize: 22,
    letterSpacing: 2,
    color: colors.text.hi,
    marginTop: space.xs,
  },
  condensedTitle: {
    fontFamily: typo.display,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.text.hi,
  },

  emptyState: { paddingVertical: space.xxl },

  block: { marginBottom: space.xl },
  stack: { gap: space.md },

  card: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.lg,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: {
    fontFamily: typo.bodySemi,
    fontSize: 15,
    color: colors.text.hi,
  },
  cardMeta: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.text.mid,
  },
  cardMetaDim: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.text.low,
  },
  cardQuote: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.low,
    marginTop: 2,
  },

  discoverTitle: {
    fontFamily: typo.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.hi,
  },
  discoverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.md,
  },

  facesRail: { flexDirection: 'row', alignItems: 'center' },
  faceWrap: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.bg.card,
  },
  faceOverlap: { marginLeft: -8 },

  crewIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bg.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crewAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.md,
  },
  factList: {
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.hairline,
    gap: space.sm,
  },
  factLine: {
    fontFamily: typo.body,
    fontSize: 13,
    color: colors.text.mid,
  },

  actionsRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.md,
  },
  actionFlex: { flex: 1 },
  pill: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  pillAccent: { backgroundColor: colors.accent },
  pillAccentLabel: {
    fontFamily: typo.bodySemi,
    fontSize: 13,
    color: colors.text.hi,
  },
  pillGhost: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    backgroundColor: colors.bg.card2,
  },
  pillGhostLabel: {
    fontFamily: typo.bodyMedium,
    fontSize: 13,
    color: colors.text.mid,
  },
  responseLine: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.low,
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.hairline,
  },

  partnersRail: {
    flexDirection: 'row',
    gap: space.md,
    flexWrap: 'wrap',
  },
  partnerTile: {
    width: 72,
    height: 72,
    borderRadius: radius.cell,
    overflow: 'hidden',
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
  },
  partnerLogo: { width: 72, height: 72 },
  partnerFallback: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerMono: {
    fontFamily: typo.monoSemi,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.text.low,
  },

  avatarPhoto: { backgroundColor: colors.bg.card2 },
  avatarFallback: {
    backgroundColor: colors.bg.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    fontFamily: typo.body,
    fontSize: 20,
    color: colors.text.low,
  },

  skeleton: { gap: space.lg },
});
