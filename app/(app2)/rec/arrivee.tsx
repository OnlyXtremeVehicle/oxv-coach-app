/**
 * ARRIVÉE — écran 3/8 du flux de capture v2 (lot V2-L2, PORTE REC).
 * Route : /(app2)/rec/arrivee (segment immersif — la TabBar s'efface).
 *
 * Plein écran cérémoniel : fond base, l'insigne OXV se DESSINE au trait (2 s,
 * une seule fois par jour — garde MMKV via arriveeInsigneLogic), le nom réel du
 * circuit de la journée en display, « Vous y êtes ». Un seul bouton, pleine
 * largeur, bord accent : « JE SUIS AU PADDOCK ». Le trait de l'insigne est
 * NEUTRE (text.hi) : le seul accent rouge de l'écran est ce bouton.
 *
 * RÈGLE CARDINALE : aucune écriture dans la state machine. L'appui rejoue la
 * MÊME transition que la v1 (le hub session v1 mène « Connecter l'équipement »
 * → écran équipement par simple navigation ; la bascule d'état S5→S7 reste
 * portée par la géolocalisation, cf. src/lib/geolocation.ts). Ici : haptic
 * `arm` + navigation vers l'étape suivante (équipement), rien de plus — la
 * porte du prochain écran fait la transition. Zéro logique nouvelle.
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { storage } from '@/lib/mmkv';
import { getMyNextTrackDay } from '@/services/nextTrackDayService';
import { useAuthStore } from '@/store/useAuthStore';
import {
  colors,
  haptic,
  PressScale,
  radius,
  space,
  typo,
  useDoorTransition,
  useReduceMotion,
} from '@/ui/v2';

import { REC_ROUTES } from '@/features/rec/captureStepLogic';
import {
  INSIGNE_DRAWN_KEY,
  INSIGNE_PATH_LENGTH,
  INSIGNE_SVG_PATH,
  INSIGNE_VIEWBOX,
  shouldAnimateInsigne,
  todayIsoLocal,
} from '@/features/rec/arriveeInsigneLogic';

/** Diamètre de rendu de l'insigne (px) et durée du tracé cérémoniel. */
const INSIGNE_SIZE = 132;
const INSIGNE_DRAW_MS = 2000;
/** Trait fin, dans l'espace du viewBox 24×24. */
const INSIGNE_STROKE = 0.6;

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * L'insigne OXV au trait qui se dessine — une fois par jour (garde MMKV).
 * Trait NEUTRE (text.hi) : le seul accent rouge de l'écran reste le bouton.
 */
function DrawingInsigne() {
  const reduce = useReduceMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = storage.getString(INSIGNE_DRAWN_KEY) ?? null;
    } catch {
      stored = null;
    }
    const today = todayIsoLocal(new Date());
    const animate = shouldAnimateInsigne(stored, today);

    if (reduce || !animate) {
      // Déjà dessiné aujourd'hui, ou réduction des animations : insigne complet.
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: INSIGNE_DRAW_MS,
      easing: Easing.inOut(Easing.cubic),
    });
    // Rituel joué : on mémorise le jour (best-effort) pour ne pas le rejouer.
    try {
      storage.set(INSIGNE_DRAWN_KEY, today);
    } catch {
      // MMKV indisponible : au pire, l'insigne se redessinera à la prochaine
      // ouverture — jamais bloquant.
    }
  }, [reduce, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: INSIGNE_PATH_LENGTH * (1 - progress.value),
  }));

  return (
    <Svg
      width={INSIGNE_SIZE}
      height={INSIGNE_SIZE}
      viewBox={`0 0 ${INSIGNE_VIEWBOX} ${INSIGNE_VIEWBOX}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <AnimatedPath
        d={INSIGNE_SVG_PATH}
        stroke={colors.text.hi}
        strokeWidth={INSIGNE_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={`${INSIGNE_PATH_LENGTH} ${INSIGNE_PATH_LENGTH}`}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

export default function ArriveeScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const profile = useAuthStore((s) => s.profile);
  const [circuitName, setCircuitName] = useState<string | null>(null);

  // Nom RÉEL du circuit de la journée (donnée réelle câblée) — masqué si absent,
  // jamais un nom inventé.
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    getMyNextTrackDay(profile.id)
      .then((d) => {
        if (!cancelled) setCircuitName(d?.circuitName ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const onPaddock = () => {
    haptic('arm');
    // Même transition que la v1 (navigation vers l'équipement) — la porte du
    // prochain écran fait la bascule visuelle. La state machine n'est pas touchée.
    router.replace(REC_ROUTES.equipement as never);
  };

  return (
    <Animated.View
      style={[
        styles.root,
        { paddingTop: insets.top, paddingBottom: insets.bottom + space.xl },
        door,
      ]}
    >
      <View style={styles.center}>
        <DrawingInsigne />
        {circuitName !== null ? (
          <Text style={styles.circuit} accessibilityRole="header">
            {circuitName}
          </Text>
        ) : null}
        <Text style={styles.here}>Vous y êtes.</Text>
      </View>

      <PressScale
        onPress={onPaddock}
        hapticOnPress={false}
        accessibilityLabel="Je suis au paddock"
        containerStyle={styles.buttonContainer}
        style={styles.button}
      >
        <Text style={styles.buttonLabel}>JE SUIS AU PADDOCK</Text>
      </PressScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
    paddingHorizontal: space.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xl,
  },
  circuit: {
    fontFamily: typo.display,
    fontSize: 26,
    letterSpacing: 0.5,
    lineHeight: 34,
    color: colors.text.hi,
    textAlign: 'center',
  },
  here: {
    fontFamily: typo.body,
    fontSize: 16,
    color: colors.text.mid,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
  },
  button: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontFamily: typo.mono,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.text.hi,
  },
});
