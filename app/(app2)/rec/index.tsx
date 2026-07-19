/**
 * PISTE HUB — écran 1/8 du flux de capture v2 (lot V2-L2, PORTE REC), cible du
 * bouton central REC. Route : /(app2)/rec (remplace le placeholder rec.tsx L0).
 *
 * Deux visages, tranchés par `useCaptureStep` (lecture seule du store, state
 * machine INTACTE) :
 *   - JOUR J (S5..S9) → Redirect expo-router vers l'écran de l'étape courante
 *     (arrivée / roulage / entre-runs / fin). Le hub ne s'affiche pas : on entre
 *     directement dans le flux.
 *   - HORS JOUR J (S1..S4, S10) → le hub se rend : HeroPhoto de LA voiture du
 *     membre (patron vehiclePhoto de useMiroirHome, importé — jamais dupliqué),
 *     cadran de compte à rebours vers la prochaine journée, entrée « Préparation ».
 *     Aucune journée au calendrier → état RÉSERVER (même decideReserve que
 *     l'accueil Miroir, flag app_payments fail-closed).
 *
 * Données réelles câblées : tout vient de useMiroirHome (services existants) ;
 * panne des sources primaires → StateView erreur + Réessayer, jamais un hub
 * calme sur des données jamais lues. Doctrine : vouvoiement, pas d'emoji, aucune
 * consigne — le hub oriente, il ne dirige pas.
 */

import { StyleSheet, Text, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { Redirect, router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { trackEvent } from '@/services/analyticsService';
import { useAuthStore } from '@/store/useAuthStore';
import {
  colors,
  Dial,
  EMPTY_CIRCUIT_PATH,
  GlowStroke,
  HeroPhoto,
  ListRow,
  PressScale,
  radius,
  space,
  Stagger,
  StateView,
  tabBarSpace,
  typo,
  useDoorTransition,
} from '@/ui/v2';

import { REC_ROUTES } from '@/features/rec/captureStepLogic';
import { useCaptureStep } from '@/features/rec/useCaptureStep';
import { decideReserve, DIAL_COUNTDOWN_MAX_DAYS } from '@/features/miroir/miroirHomeLogic';
import { useMiroirHome, type MiroirHome } from '@/features/miroir/useMiroirHome';

/** « Sam. 19 juil. » — date courte de la prochaine journée (patron accueil). */
function shortDayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return '';
  const txt = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

export default function RecHubScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const profile = useAuthStore((s) => s.profile);
  const { route } = useCaptureStep();
  const redirecting = route !== null;

  // Jour J : on ne paye pas le chargement du hub — on part vers l'étape
  // courante (userId null → useMiroirHome reste au repos, aucune requête).
  const home = useMiroirHome(redirecting ? null : (profile?.id ?? null));

  if (route !== null) {
    return <Redirect href={route as never} />;
  }

  return (
    <Animated.View
      style={[
        styles.root,
        { paddingTop: insets.top + space.xl, paddingBottom: tabBarSpace(insets.bottom) + space.xl },
        door,
      ]}
    >
      <Text style={styles.title}>PISTE</Text>

      {home.status === 'loading' ? (
        <StateView state="loading" shape="card" style={styles.state} />
      ) : home.status === 'error' ? (
        <StateView
          state="error"
          errorMessage="Votre journée n'a pas pu se charger."
          onRetry={home.refresh}
          style={styles.state}
        />
      ) : (
        <HubContent home={home} />
      )}
    </Animated.View>
  );
}

/** Fallback visuel du héros : tracé Skia GlowStroke (kit), jamais d'image stock. */
function CircuitTraceFallback() {
  return (
    <Canvas style={styles.fallbackCanvas}>
      <GlowStroke path={EMPTY_CIRCUIT_PATH} strokeWidth={2} />
    </Canvas>
  );
}

function HubContent({ home }: { home: MiroirHome }) {
  if (home.nextDay === null) {
    return <ReserveState home={home} />;
  }

  const nextDay = home.nextDay;
  return (
    <Stagger>
      <HeroPhoto
        uri={home.vehiclePhotoUrl ?? undefined}
        height={200}
        fallback={<CircuitTraceFallback />}
      >
        <View style={styles.heroRow}>
          <Dial value={home.daysToNextDay} max={DIAL_COUNTDOWN_MAX_DAYS} size="m" label="jours" />
          <View style={styles.heroInfo}>
            <Text style={styles.heroEyebrow}>PROCHAINE JOURNÉE</Text>
            {nextDay.circuitName !== null ? (
              <Text style={styles.heroCircuit} numberOfLines={1}>
                {nextDay.circuitName}
              </Text>
            ) : null}
            <Text style={styles.heroDate}>{shortDayLabel(nextDay.date)}</Text>
          </View>
        </View>
      </HeroPhoto>

      <View style={styles.rowCard}>
        <ListRow
          icon="circuit"
          label="Préparation"
          sublabel="Conditions, check-list, intention"
          onPress={() => router.navigate(REC_ROUTES.preparation as never)}
          divider={false}
        />
      </View>
    </Stagger>
  );
}

/** Aucune journée au calendrier : porte RÉSERVER (decideReserve, fail-closed). */
function ReserveState({ home }: { home: MiroirHome }) {
  const onReserve = () => {
    const decision = decideReserve(home.paymentsEnabled);
    trackEvent(decision.analyticsEvent);
    router.navigate(decision.href as never);
  };
  return (
    <View style={styles.emptyCard}>
      <StateView state="empty" emptyMessage="Aucune journée au calendrier." />
      <PressScale
        onPress={onReserve}
        accessibilityLabel="Réserver une journée"
        containerStyle={styles.reserveContainer}
        style={styles.reservePill}
      >
        <Text style={styles.reserveLabel}>RÉSERVER</Text>
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
    paddingHorizontal: space.xl,
  },
  title: {
    fontFamily: typo.display,
    fontSize: 22,
    letterSpacing: 2,
    color: colors.text.hi,
    marginBottom: space.xl,
  },
  state: {
    marginTop: space.xl,
  },

  // Héros — cadran countdown + infos journée superposés sur la photo voiture.
  fallbackCanvas: { width: 208, height: 116 },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.lg,
  },
  heroInfo: {
    flex: 1,
    alignItems: 'flex-end',
    gap: space.xs,
  },
  heroEyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.text.hi,
  },
  heroCircuit: {
    fontFamily: typo.bodySemi,
    fontSize: 14,
    color: colors.text.hi,
  },
  heroDate: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.mid,
  },

  // Entrée Préparation — carte hairline, ligne universelle.
  rowCard: {
    marginTop: space.xl,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
  },

  // RÉSERVER
  emptyCard: {
    marginTop: space.xl,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.hero,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    alignItems: 'center',
  },
  reserveContainer: { marginTop: space.xs, marginBottom: space.md },
  reservePill: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.xxl,
    paddingVertical: space.md,
  },
  reserveLabel: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.accent,
  },
});
