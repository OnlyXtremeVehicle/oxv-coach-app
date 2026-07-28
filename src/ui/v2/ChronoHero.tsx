/**
 * ChronoHero — LE chrono (chiffre roi) : RollingCounter mono au millième
 * (millièmes en accent), trois tailles s/m/l.
 *
 * `celebrate` (front montant) permute RollingCounter → RecordFlash le temps
 * de la célébration (900 ms, blanc → or, haptic record), puis revient —
 * le contrat prévu par le langage motion. `chronoMs` est en MILLISECONDES ;
 * la conversion vers « M:SS.mmm » passe par msToLapLabel (formatLapTimeMs,
 * la référence du repo), vérifiée par test.
 *
 * La hauteur est réservée (minHeight) : la permutation ne fait pas sauter
 * la mise en page.
 */

import { useCallback, useEffect, useState } from 'react';
import { useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { largeurUtile } from '@/theme/metriques';
import { RecordFlash, RollingCounter } from './motion';
import { space, type as typo } from './tokens';
import { chronoHeroFontSize, msToLapLabel, type ChronoHeroSize } from './uiLogic';

export type { ChronoHeroSize } from './uiLogic';

export interface ChronoHeroProps {
  /** Chrono en millisecondes. */
  chronoMs: number;
  /** Par défaut 'm'. */
  size?: ChronoHeroSize;
  /** Front montant → célébration record (RecordFlash), une fois. */
  celebrate?: boolean;
  /** Appelé à la fin des 900 ms de célébration. */
  onCelebrateDone?: () => void;
  style?: StyleProp<ViewStyle>;
  /**
   * Largeur réellement offerte au chrono, quand l'appelant la connaît.
   *
   * Omise → la largeur utile de l'écran MOINS le remplissage typique d'un bloc
   * héros. Ce n'est pas la largeur utile brute : le héros porte son propre
   * remplissage, et l'ignorer laissait `1:41,203` déborder de 32 pt sur
   * iPhone SE, coupé en silence par l'`overflow: 'hidden'` du cadre.
   */
  largeurDisponible?: number;
}

export function ChronoHero({
  chronoMs,
  size = 'm',
  celebrate = false,
  onCelebrateDone,
  style,
  largeurDisponible,
}: ChronoHeroProps) {
  const { width } = useWindowDimensions();
  const label = msToLapLabel(chronoMs);

  /**
   * PLAFOND ET REPLI — `src/theme/metriques.ts`, posés au jalon 2 mais branchés
   * seulement sur `KingNumber`. Le chrono que le pilote lit vraiment n'en
   * bénéficiait pas : `chronoHeroFontSize` rendait 56 pt sans jamais regarder
   * la longueur du chrono ni la largeur offerte.
   *
   * Le budget par défaut retire du utile le remplissage d'un bloc héros
   * (`space.xl` autour du bloc + `space.lg` dans le cadre, de chaque côté).
   * Sans cette soustraction, le calcul serait juste et le rendu faux.
   */
  const budget = largeurDisponible ?? largeurUtile(width) - 2 * (space.xl + space.lg);
  const fontSize = chronoHeroFontSize(size, label, budget);
  // Même métrique que la bande du RollingCounter : pas de saut au swap.
  const lineHeight = Math.round(fontSize * 1.24);

  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (celebrate) setCelebrating(true);
  }, [celebrate]);

  const handleDone = useCallback(() => {
    setCelebrating(false);
    if (onCelebrateDone) onCelebrateDone();
  }, [onCelebrateDone]);

  return (
    <View style={[{ minHeight: lineHeight, justifyContent: 'center' }, style]}>
      {celebrating ? (
        <RecordFlash
          trigger
          text={label}
          fontSize={fontSize}
          fontFamily={typo.monoSemi}
          onDone={handleDone}
        />
      ) : (
        <RollingCounter value={label} fontSize={fontSize} fontFamily={typo.monoSemi} accentMillis />
      )}
    </View>
  );
}
