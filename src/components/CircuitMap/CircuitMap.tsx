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
   * ce nom désigne un autre circuit, la carte refuse de dessiner et le dit —
   * sinon elle peindrait la forme de Beltoise, ses sept pastilles à leurs
   * coordonnées, et une trajectoire projetée depuis une origine située à des
   * centaines de kilomètres, le tout sous le nom d'un autre circuit.
   *
   * OBLIGATOIRE, ET C'EST TOUT L'INTÉRÊT. Ce champ était optionnel, et la dette
   * assumée dans ce commentaire disait « les appelants qui connaissent leur
   * circuit doivent le passer ». Aucun ne le passait : sur les six montages du
   * dépôt, ZÉRO l'armait. La garde existait et ne s'est jamais déclenchée.
   *
   * Le rendre obligatoire déplace la garantie du runtime vers le COMPILATEUR :
   * il devient impossible d'ajouter une carte qui dessine en silence. Un
   * appelant qui ignore son circuit passe `null` explicitement — ce qui est une
   * déclaration, pas un oubli.
   */
  circuitName: string | null;
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

  // Circuit inconnu, ou différent de celui dont nous avons la géométrie : on ne
  // dessine rien, et on explique. Un tracé faux se lit comme un tracé vrai.
  if (!estHauteSaintonge(circuitName)) {
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

      {/*
        ODbL — LA MENTION MANQUAIT, ET C'EST LE MAUVAIS CÔTÉ DU RISQUE.

        Tout ce que ce composant dessine vient de `HAUTE_SAINTONGE_TRACK`
        (`projection.ts:46`), que `src/trackviz/hauteSaintonge.ts:2` déclare
        « OpenStreetMap way 54412766 ». La garde ci-dessus le rend inconditionnel :
        si `estHauteSaintonge` est faux, rien n'est dessiné ; si elle est vraie,
        c'est de la donnée OSM. Il n'existe donc aucun cas où ce bloc s'affiche
        sans que l'attribution soit due.

        `TraceCircuit` la portait depuis l'origine, ce composant-ci jamais —
        et il sert trois écrans, dont deux côté coach. Sur-attribuer n'a pas de
        créancier ; sous-attribuer en a un.

        Jetons de `@/theme/v2` et non de `src/ui/v2` : R3, les deux univers ne
        se mélangent pas, et cet écran est de l'univers coach.
      */}
      <Text
        style={{
          position: 'absolute',
          right: 8,
          bottom: 6,
          fontFamily: theme.fonts.mono,
          fontSize: theme.fontSize.micro,
          letterSpacing: 0.4,
          color: theme.palette.eyebrow,
        }}
      >
        © contributeurs OpenStreetMap
      </Text>
    </View>
  );
});
