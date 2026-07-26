/**
 * Composant base — orchestre le rendu SVG du circuit Beltoise avec
 * des layers composables (tracé, virages, trajectoire pilote, etc.).
 *
 * Utilisable directement avec n'importe quelle combinaison de layers,
 * ou via les presets (PilotPreset, CoachPreset, PublicPreset) qui
 * pré-configurent les compositions usuelles.
 *
 * Fournit l'unique <Svg> racine et son viewBox cohérent. Les layers
 * sont des fragments SVG injectés en children.
 */

import { type ReactNode, memo } from 'react';
import { Text, View } from 'react-native';
import Svg from 'react-native-svg';

import { theme } from '@/theme/v2';

import { getCircuitViewBox } from './projection';
import { estHauteSaintonge } from '@/lib/circuitTopology';

export interface CircuitMapProps {
  /** Layers SVG composés (TrackLayer, CornersLayer, etc.). */
  children: ReactNode;
  /** Hauteur du composant en pixels. Largeur = parent. */
  height?: number;
  /** Couleur de fond du conteneur. Par défaut background.secondary. */
  background?: string;
  /** Border radius du conteneur. Par défaut 12. */
  borderRadius?: number;
  /**
   * Override du viewBox SVG. Par défaut on prend le viewBox du circuit
   * entier (getCircuitViewBox), mais on peut zoomer sur un virage en
   * passant getCornerViewBox(cornerIndex).
   */
  viewBox?: string;
  /**
   * Le circuit de la séance affichée.
   *
   * Cette carte n'a QU'UNE géométrie : Haute Saintonge (tracé Beltoise). Quand
   * ce nom est fourni et désigne un autre circuit, la carte refuse de dessiner
   * et le dit — sinon elle peindrait la forme de Beltoise, ses sept pastilles à
   * leurs coordonnées, et une trajectoire projetée depuis une origine située à
   * des centaines de kilomètres, le tout sous le nom d'un autre circuit.
   *
   * Laisser ce champ absent conserve l'ancien comportement : c'est une DETTE,
   * pas un choix. Les appelants qui connaissent leur circuit doivent le passer.
   */
  circuitName?: string | null;
}

export const CircuitMap = memo(function CircuitMap({
  children,
  height = 320,
  background = theme.palette.card2,
  borderRadius = 12,
  viewBox: viewBoxOverride,
  circuitName,
}: CircuitMapProps) {
  const viewBox = viewBoxOverride ?? getCircuitViewBox();

  // Circuit déclaré et différent de celui dont nous avons la géométrie : on ne
  // dessine rien, et on explique. Un tracé faux se lit comme un tracé vrai.
  if (circuitName !== undefined && !estHauteSaintonge(circuitName)) {
    return (
      <View
        style={{
          width: '100%',
          height,
          backgroundColor: background,
          borderRadius,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        <Text
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSize.small,
            lineHeight: theme.fontSize.small * 1.5,
            color: theme.palette.creamMute,
            textAlign: 'center',
          }}
        >
          {circuitName
            ? `Le tracé de ${circuitName} n'est pas encore disponible.`
            : "Le circuit de cette séance n'est pas identifié : aucun tracé n'est affiché."}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        width: '100%',
        height,
        backgroundColor: background,
        borderRadius,
        overflow: 'hidden',
      }}
    >
      <Svg width="100%" height="100%" viewBox={viewBox}>
        {children}
      </Svg>
    </View>
  );
});
