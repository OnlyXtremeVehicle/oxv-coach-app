/**
 * VOUS HUB — porte d'identité (app2), lot V2-L4 écran 1/8 (Mission A).
 *
 * Le passeport du pilote + les trois chantiers business gatés :
 *   - héros passeport : photo du véhicule principal (repli insigne), avatar
 *     bordé or si tier Heritage, nom, @handle, ligne d'identité mono qui roule
 *     au premier viewport (« {palier} · {n} records · {km} km ») ;
 *   - A2 carte Membre Fondateur (flag 'founders' fail-closed — carte absente si
 *     OFF) : candidater / en examen / fondateur ;
 *   - A3 mon code de parrainage (partage natif) + ma ligne « écurie » ;
 *   - sections d'accès (7) en cascade.
 *
 * Données réelles câblées (useVousHub) : tout trace vers une source réelle ;
 * absent = section masquée / « — », jamais un chiffre fabriqué. Panne de la
 * source primaire (identité) = StateView erreur + Réessayer.
 *
 * DÉVIATION DOCTRINALE ASSUMÉE (heritage.gold exclusif au tier Heritage —
 * tokens.ts « non négociable ») : la jauge fondateur, décrite « remplie or »
 * dans le prompt, est rendue en `text.mid` neutre — l'or reste réservé au tier
 * Heritage ; l'unique accent de la carte est le CTA. Consigné au rapport.
 */

import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/useAuthStore';
import {
  colors,
  CondensingHeaderBar,
  HeroPhoto,
  ListRow,
  OxvIcon,
  Photo,
  PressScale,
  radius,
  RollingCounter,
  Shimmer,
  space,
  Stagger,
  StateView,
  tabBarSpace,
  typo,
  useCondensingHeader,
  useDoorTransition,
  useFirstViewport,
  type OxvIconName,
} from '@/ui/v2';

import { zeroLike } from '@/features/miroir/miroirHomeLogic';
import { FOUNDERS_MAX, shareMessage } from '@/features/vous/vousHubLogic';
import { useVousHub, type VousFounder, type VousHub } from '@/features/vous/useVousHub';

/** Version installée (native), repli sur la version du manifeste Expo. */
const APP_VERSION: string | null =
  Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? null;

/** Les sept portes de l'espace personnel (icône · libellé · route). */
const SECTIONS: readonly { icon: OxvIconName; label: string; href: string }[] = [
  { icon: 'casque', label: 'Profil public', href: '/(app2)/vous/profil' },
  { icon: 'cle', label: 'Garage', href: '/(app2)/vous/garage' },
  { icon: 'data', label: 'Carnet', href: '/(app2)/vous/carnet' },
  { icon: 'ceinture', label: 'Équipement', href: '/(app2)/vous/equipement' },
  { icon: 'drapeau-damier', label: 'Licence & documents', href: '/(app2)/vous/documents' },
  { icon: 'cle', label: 'Réglages', href: '/(app2)/vous/reglages' },
  { icon: 'incident', label: 'Support', href: '/(app2)/vous/support' },
];

export default function VousHubScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const profile = useAuthStore((s) => s.profile);
  const hub = useVousHub(profile?.id ?? null);
  const header = useCondensingHeader();
  const [heroOffset, setHeroOffset] = useState(0);

  return (
    <Animated.View style={[styles.root, door]}>
      <Animated.ScrollView
        onScroll={header.scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + space.md,
          paddingBottom: tabBarSpace(insets.bottom) + space.xl,
          paddingHorizontal: space.xl,
        }}
      >
        {/* Grand header — s'efface au scroll (barre condensée en relais). */}
        <Animated.View style={[styles.headerRow, header.headerStyle]}>
          <Text style={styles.headerEyebrow}>VOTRE ESPACE</Text>
          <Animated.Text style={[styles.headerTitle, header.titleStyle]}>VOUS</Animated.Text>
        </Animated.View>

        {hub.status === 'loading' ? (
          <HubSkeleton />
        ) : hub.status === 'error' ? (
          <StateView
            state="error"
            errorMessage="Votre espace n'a pas pu se charger."
            onRetry={hub.refresh}
          />
        ) : (
          <>
            <Animated.View onLayout={(e) => setHeroOffset(e.nativeEvent.layout.y)}>
              <Hero hub={hub} scrollY={header.scrollY} parallaxOffset={heroOffset} />
            </Animated.View>

            <View style={styles.body}>
              <FounderSection founder={hub.founder} />
              <CodeSection hub={hub} />
              <CrewSection hub={hub} />
              {/* Les sept portes entrent en cascade (Stagger sur chaque ligne). */}
              <Stagger step={40} initialDelay={60} style={styles.sectionsCard}>
                {SECTIONS.map((s, i) => (
                  <ListRow
                    key={s.href}
                    icon={s.icon}
                    label={s.label}
                    onPress={() => router.push(s.href as never)}
                    divider={i < SECTIONS.length - 1}
                  />
                ))}
              </Stagger>
            </View>

            <Text style={styles.version}>
              {APP_VERSION !== null ? `OXV Mirror · v${APP_VERSION}` : 'OXV Mirror'}
            </Text>
          </>
        )}
      </Animated.ScrollView>

      <CondensingHeaderBar
        condensedStyle={header.condensedStyle}
        height={52 + insets.top}
        style={{ paddingTop: insets.top }}
      >
        <Text style={styles.condensedTitle}>VOUS</Text>
      </CondensingHeaderBar>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Héros passeport — photo véhicule principal (repli insigne), identité posée
// ---------------------------------------------------------------------------

function InsigneFallback() {
  return <OxvIcon name="insigne" size={72} color={colors.text.low} />;
}

function Hero({
  hub,
  scrollY,
  parallaxOffset,
}: {
  hub: VousHub;
  scrollY: ReturnType<typeof useCondensingHeader>['scrollY'];
  parallaxOffset: number;
}) {
  const heritage = hub.heritage.isHeritage;
  return (
    <HeroPhoto
      uri={hub.vehiclePhotoUrl ?? undefined}
      height={190}
      scrollY={scrollY}
      parallaxOffset={parallaxOffset}
      fallback={<InsigneFallback />}
    >
      <View style={styles.heroTopRow}>
        <View style={styles.avatarCol}>
          <View
            style={[
              styles.avatarWrap,
              { borderColor: heritage ? colors.heritage.gold : colors.border.strong },
            ]}
          >
            {hub.avatarUrl !== null ? (
              <Photo uri={hub.avatarUrl} style={styles.avatarPhoto} />
            ) : (
              <OxvIcon name="casque" size={24} color={colors.text.mid} />
            )}
          </View>
          {heritage ? <View style={styles.goldRule} /> : null}
        </View>

        <View style={styles.heroNameCol}>
          {heritage ? <Text style={styles.heritageEyebrow}>HERITAGE</Text> : null}
          <Text style={styles.heroName} numberOfLines={1}>
            {hub.name}
          </Text>
          {hub.handle !== null ? (
            <Text style={styles.heroHandle} numberOfLines={1}>
              {hub.handle}
            </Text>
          ) : null}
        </View>
      </View>

      {hub.statsLine !== null ? <StatsLine line={hub.statsLine} /> : null}
    </HeroPhoto>
  );
}

/** Ligne d'identité mono qui roule (odomètre) au premier viewport. */
function StatsLine({ line }: { line: string }) {
  const fv = useFirstViewport(true);
  return (
    <Animated.View ref={fv.ref} style={styles.statsLineWrap}>
      <RollingCounter
        value={fv.visible ? line : zeroLike(line)}
        fontSize={11}
        color={colors.text.mid}
      />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// A2 — carte Membre Fondateur (flag fail-closed, décidé en amont dans le hook)
// ---------------------------------------------------------------------------

function FounderSection({ founder }: { founder: VousFounder }) {
  if (!founder.flagOn || founder.state === 'absent') return null;
  if (founder.state === 'approved') return <FounderApproved />;
  return <FounderGaugeCard founder={founder} />;
}

/** Badge définitif : bande accent, sans numéro (aucune source de rang réelle). */
function FounderApproved() {
  return (
    <View style={styles.approvedBand}>
      <Text style={styles.approvedEyebrow}>MEMBRE FONDATEUR</Text>
      <Text style={styles.approvedBody}>Votre place est confirmée.</Text>
    </View>
  );
}

function FounderGaugeCard({ founder }: { founder: VousFounder }) {
  const fv = useFirstViewport(true);
  const { filled, remaining } = founder.gauge;
  const pending = founder.state === 'pending';
  const gaugeLabel = `${filled}/${FOUNDERS_MAX}`;

  return (
    <View style={styles.founderCard}>
      <View style={styles.founderHead}>
        <OxvIcon name="insigne" size={20} color={colors.text.mid} />
        <Text style={styles.founderTitle}>MEMBRE FONDATEUR</Text>
        {pending ? (
          <View style={styles.examPill}>
            <Text style={styles.examLabel}>CANDIDATURE EN EXAMEN</Text>
          </View>
        ) : null}
      </View>

      <View ref={fv.ref} style={styles.gaugeRow}>
        <View style={styles.gaugeTrack}>
          <View style={[styles.gaugeFill, { flex: filled }]} />
          <View style={{ flex: remaining }} />
        </View>
        <RollingCounter
          value={fv.visible ? gaugeLabel : zeroLike(gaugeLabel)}
          fontSize={13}
          color={colors.text.mid}
        />
      </View>

      <Text style={styles.founderRemaining}>
        {remaining > 0
          ? `${remaining} place${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}`
          : 'Complet'}
      </Text>

      {founder.state === 'candidater' ? (
        <PressScale
          onPress={() => router.push('/(app2)/vous/fondateur' as never)}
          accessibilityLabel="Candidater au statut de Membre Fondateur"
          containerStyle={styles.founderCtaWrap}
          style={styles.founderCta}
        >
          <Text style={styles.founderCtaLabel}>CANDIDATER</Text>
        </PressScale>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// A3 — mon code de parrainage (partage natif) + ligne « écurie »
// ---------------------------------------------------------------------------

function CodeSection({ hub }: { hub: VousHub }) {
  const code = hub.referral.code;
  if (code === null) return null;

  const onShare = () => {
    void Share.share({ message: shareMessage(code) }).catch(() => undefined);
  };

  return (
    <View style={styles.codeCard}>
      <Text style={styles.codeEyebrow}>VOTRE CODE</Text>
      <View style={styles.codeRow}>
        <Text style={styles.codeValue} numberOfLines={1}>
          {code}
        </Text>
        <PressScale
          onPress={onShare}
          accessibilityLabel="Partager votre code de parrainage"
          style={styles.sharePill}
        >
          <Text style={styles.shareLabel}>PARTAGER</Text>
        </PressScale>
      </View>
    </View>
  );
}

function CrewSection({ hub }: { hub: VousHub }) {
  const crew = hub.referral.crew;
  if (crew === null) return null;
  return (
    <View style={styles.crewCard}>
      <ListRow
        icon="groupe"
        label={crew.label}
        sublabel={crew.sublabel}
        onPress={() => router.navigate('/(app2)/club' as never)}
        divider={false}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Squelette — les FORMES réelles (héros 190, deux cartes, liste)
// ---------------------------------------------------------------------------

function HubSkeleton() {
  return (
    <View
      style={styles.skeleton}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement de votre espace"
    >
      <Shimmer height={190} width="100%" radius={radius.hero} />
      <Shimmer height={72} width="100%" radius={radius.card} />
      <Shimmer height={92} width="100%" radius={radius.card} />
      <Shimmer height={220} width="100%" radius={radius.card} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles — tokens V2 uniquement
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },

  // Header
  headerRow: {
    marginBottom: space.xl,
  },
  headerEyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.text.low,
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

  // Héros
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  avatarCol: {
    alignItems: 'center',
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    backgroundColor: colors.bg.card2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPhoto: { width: '100%', height: '100%' },
  goldRule: {
    width: 28,
    height: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.heritage.gold,
    marginTop: space.sm,
  },
  heroNameCol: {
    flex: 1,
  },
  heritageEyebrow: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.heritage.text,
    marginBottom: space.xs,
  },
  heroName: {
    fontFamily: typo.bodySemi,
    fontSize: 16,
    color: colors.text.hi,
  },
  heroHandle: {
    fontFamily: typo.mono,
    fontSize: 12,
    color: colors.text.mid,
    marginTop: 2,
  },
  statsLineWrap: {
    marginTop: space.md,
  },

  // Corps
  body: {
    marginTop: space.xl,
    gap: space.md,
  },

  // A2 — carte fondateur
  founderCard: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.md,
  },
  founderHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  founderTitle: {
    flex: 1,
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.text.hi,
  },
  examPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  examLabel: {
    fontFamily: typo.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.text.mid,
  },
  gaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  gaugeTrack: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.bg.card2,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  gaugeFill: {
    backgroundColor: colors.text.mid,
    borderRadius: radius.pill,
  },
  founderRemaining: {
    fontFamily: typo.body,
    fontSize: 13,
    color: colors.text.mid,
  },
  founderCtaWrap: {
    alignSelf: 'flex-start',
    marginTop: space.xs,
  },
  founderCta: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
  },
  founderCtaLabel: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.accent,
  },

  // A2 — bande fondateur validée (accent)
  approvedBand: {
    backgroundColor: colors.bg.card,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.card,
    borderRightColor: colors.border.card,
    borderBottomColor: colors.border.card,
    borderRadius: radius.card,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
  },
  approvedEyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  approvedBody: {
    fontFamily: typo.body,
    fontSize: 14,
    color: colors.text.mid,
    marginTop: space.xs,
  },

  // A3 — carte code
  codeCard: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.lg,
  },
  codeEyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.text.low,
    marginBottom: space.md,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  codeValue: {
    flex: 1,
    fontFamily: typo.monoSemi,
    fontSize: 18,
    letterSpacing: 4,
    color: colors.text.hi,
  },
  sharePill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  shareLabel: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.text.hi,
  },

  // A3 — ligne écurie
  crewCard: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
  },

  // Sections
  sectionsCard: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
  },

  version: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.text.dim,
    textAlign: 'center',
    marginTop: space.xxl,
  },

  // Squelette
  skeleton: { gap: space.lg },
});
