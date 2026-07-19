/**
 * StateView — les quatre états non nominaux de toute section (app2) :
 *
 * - loading : Shimmer aux FORMES réelles de la section (`shape`) — jamais
 *   de spinner ;
 * - empty   : illustration SVG maison (tracé de circuit qui se dessine en
 *   boucle lente de 8 s, trait `text.dim`) + message ;
 * - error   : icône `incident` + message + bouton Réessayer (PressScale) ;
 * - offline : bandeau sobre + `children` (le dernier contenu connu reste
 *   affiché dessous — local-first).
 *
 * Reduce-motion : l'illustration vide est rendue complète, sans boucle.
 */

import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { OxvIcon } from './icons';
import { PressScale, Shimmer, useReduceMotion } from './motion';
import { colors, radius, space, type as typo } from './tokens';
import {
  EMPTY_CIRCUIT_LENGTH,
  EMPTY_CIRCUIT_PATH,
  EMPTY_CIRCUIT_VIEWBOX,
  EMPTY_LOOP_MS,
  skeletonBlocksFor,
  type StateShape,
} from './uiLogic';

const DEFAULT_EMPTY_MESSAGE = 'Rien à afficher pour le moment.';
const DEFAULT_ERROR_MESSAGE = 'Le chargement a échoué.';
const OFFLINE_LABEL = 'Hors ligne — dernier contenu affiché';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export type { StateShape } from './uiLogic';

export type StateViewState = 'loading' | 'empty' | 'error' | 'offline';

export interface StateViewProps {
  state: StateViewState;
  /** Forme du squelette (état loading). Par défaut 'list'. */
  shape?: StateShape;
  /** Message de l'état vide. */
  emptyMessage?: string;
  /** Message de l'état erreur. */
  errorMessage?: string;
  /** Présent → bouton Réessayer sous le message d'erreur. */
  onRetry?: () => void;
  /** État offline : le dernier contenu connu, affiché sous le bandeau. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Tracé de circuit qui se dessine en boucle lente — l'état vide OXV. */
function EmptyCircuit() {
  const reduce = useReduceMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      cancelAnimation(progress);
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: EMPTY_LOOP_MS, easing: Easing.linear }),
      -1,
      false
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [reduce, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: EMPTY_CIRCUIT_LENGTH * (1 - progress.value),
  }));

  return (
    <Svg
      width={156}
      height={87}
      viewBox={EMPTY_CIRCUIT_VIEWBOX}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <AnimatedPath
        d={EMPTY_CIRCUIT_PATH}
        stroke={colors.text.dim}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={`${EMPTY_CIRCUIT_LENGTH} ${EMPTY_CIRCUIT_LENGTH}`}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

export function StateView({
  state,
  shape = 'list',
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  errorMessage = DEFAULT_ERROR_MESSAGE,
  onRetry,
  children,
  style,
}: StateViewProps) {
  if (state === 'loading') {
    const blocks = skeletonBlocksFor(shape);
    return (
      <View style={[styles.loading, shape === 'radar' && styles.centeredItems, style]}>
        {blocks.map((block, index) => (
          <Shimmer key={index} height={block.height} width={block.width} radius={block.radius} />
        ))}
      </View>
    );
  }

  if (state === 'empty') {
    return (
      <View style={[styles.stateBlock, style]}>
        <EmptyCircuit />
        <Text style={styles.message}>{emptyMessage}</Text>
      </View>
    );
  }

  if (state === 'error') {
    return (
      <View style={[styles.stateBlock, style]}>
        <OxvIcon name="incident" size={28} color={colors.text.mid} />
        <Text style={styles.message}>{errorMessage}</Text>
        {onRetry ? (
          // hitSlop : la pill fait ~36 px de haut — cible tactile complétée.
          <PressScale
            onPress={onRetry}
            accessibilityLabel="Réessayer"
            hitSlop={{ top: 4, bottom: 4 }}
          >
            <View style={styles.retryPill}>
              <Text style={styles.retryLabel}>Réessayer</Text>
            </View>
          </PressScale>
        ) : null}
      </View>
    );
  }

  // offline
  return (
    <View style={style}>
      <View style={styles.offlineBanner} accessibilityRole="alert">
        <Text style={styles.offlineLabel}>{OFFLINE_LABEL}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    gap: space.md,
  },
  centeredItems: {
    alignItems: 'center',
  },
  stateBlock: {
    alignItems: 'center',
    paddingVertical: space.xxl,
    gap: space.lg,
  },
  message: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.mid,
    textAlign: 'center',
    maxWidth: 260,
  },
  retryPill: {
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
  },
  retryLabel: {
    fontFamily: typo.bodyMedium,
    fontSize: 14,
    color: colors.text.hi,
  },
  offlineBanner: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    marginBottom: space.md,
  },
  offlineLabel: {
    fontFamily: typo.bodyMedium,
    fontSize: 13,
    color: colors.text.mid,
    textAlign: 'center',
  },
});
