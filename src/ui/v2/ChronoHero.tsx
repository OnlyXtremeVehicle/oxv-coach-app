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
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { RecordFlash, RollingCounter } from './motion';
import { type as typo } from './tokens';
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
}

export function ChronoHero({
  chronoMs,
  size = 'm',
  celebrate = false,
  onCelebrateDone,
  style,
}: ChronoHeroProps) {
  const label = msToLapLabel(chronoMs);
  const fontSize = chronoHeroFontSize(size);
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
