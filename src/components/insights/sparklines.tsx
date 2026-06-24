/**
 * Mini-sparklines de la galerie « Lectures approfondies » (un avant-goût
 * visuel par carte, maquette galerie). Données DÉMO figées, rendues en
 * react-native-svg, couleurs QDI (theme.dataColors).
 *
 * Une sparkline par clé de lecture. Pass B réutilise ce mapping tel quel
 * (les six existent déjà ici), via `Sparkline`.
 *
 * Chaque sparkline remplit son conteneur (34 px de haut, largeur pleine) ;
 * viewBox 300×34, preserveAspectRatio « none » comme la maquette.
 */

import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';

import { theme } from '@/theme/v2';
import type { ReadingKey } from '@/components/insights/catalogue';

const C = theme.dataColors;

// rgba dérivées des couleurs QDI pour les remplissages discrets des zones.
// Ambre pilote : neutralise le rouge trajectory (#E63946 réservé marque/coach).
const TRAJ_LINE = '#F2792B';
const TRAJ_FILL = 'rgba(242,121,43,0.10)';
const TRAJ_SOFT = 'rgba(242,121,43,0.50)';
const BRAKE_FILL = 'rgba(96,165,250,0.10)';
const BRAKE_SOFT = 'rgba(96,165,250,0.45)';
const BRAKE_DOT = 'rgba(96,165,250,0.35)';
const ACCEL_FILL = 'rgba(74,222,128,0.50)';
const ACCEL_SOFT = 'rgba(96,165,250,0.50)';
const RED_GHOST = 'rgba(242,121,43,0.40)';
const LINE_GHOST = 'rgba(248,249,250,0.25)';

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <Svg width="100%" height={34} viewBox="0 0 300 34" preserveAspectRatio="none">
      {children}
    </Svg>
  );
}

function AnatomieSpark() {
  return (
    <Frame>
      <Rect x={0} y={6} width={100} height={22} fill={BRAKE_FILL} />
      <Rect x={100} y={6} width={55} height={22} fill={TRAJ_FILL} />
      <Rect x={155} y={6} width={145} height={22} fill="rgba(74,222,128,0.10)" />
      <Path
        d="M4,9 C40,11 75,24 128,27 C150,28 165,26 200,20 C245,12 270,10 296,9"
        fill="none"
        stroke={theme.palette.cream}
        strokeWidth={1.5}
      />
      <Circle cx={128} cy={27} r={2.5} fill={TRAJ_LINE} />
    </Frame>
  );
}

function GGSpark() {
  // Petit nuage G-G centré : axes purs marqués, combiné creux.
  return (
    <Frame>
      <Circle cx={150} cy={17} r={15} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
      <Circle cx={150} cy={4} r={1.6} fill={BRAKE_SOFT} />
      <Circle cx={150} cy={8} r={1.6} fill={BRAKE_SOFT} />
      <Circle cx={152} cy={11} r={1.6} fill={BRAKE_SOFT} />
      <Circle cx={150} cy={30} r={1.6} fill="rgba(74,222,128,0.55)" />
      <Circle cx={150} cy={26} r={1.6} fill="rgba(74,222,128,0.55)" />
      <Circle cx={137} cy={17} r={1.6} fill={TRAJ_SOFT} />
      <Circle cx={141} cy={17} r={1.6} fill={TRAJ_SOFT} />
      <Circle cx={163} cy={17} r={1.6} fill={TRAJ_SOFT} />
      <Circle cx={159} cy={17} r={1.6} fill={TRAJ_SOFT} />
    </Frame>
  );
}

function DispersionSpark() {
  return (
    <Frame>
      <Path d="M0,17 L60,17 L60,16 L120,18" fill="none" stroke={LINE_GHOST} strokeWidth={1} />
      <Path d="M120,18 C150,4 150,30 180,17 C150,26 150,8 120,18" fill={TRAJ_FILL} stroke="none" />
      <Path
        d="M120,18 C150,8 165,9 180,14 L300,16"
        fill="none"
        stroke={TRAJ_LINE}
        strokeWidth={1.5}
      />
      <Path
        d="M120,18 C150,28 165,27 180,20 L300,18"
        fill="none"
        stroke={TRAJ_SOFT}
        strokeWidth={1.5}
      />
    </Frame>
  );
}

function TourIdealSpark() {
  return (
    <Frame>
      <Rect x={0} y={10} width={92} height={14} rx={3} fill={ACCEL_FILL} />
      <Rect x={96} y={10} width={112} height={14} rx={3} fill={ACCEL_SOFT} />
      <Rect x={212} y={10} width={88} height={14} rx={3} fill={ACCEL_FILL} />
    </Frame>
  );
}

function FlowSpark() {
  return (
    <Frame>
      <Polyline
        points="0,17 16,8 26,26 38,7 52,27 64,13 78,5 90,28 104,12 118,25 130,11 150,27 158,14 172,6 186,27"
        fill="none"
        stroke={RED_GHOST}
        strokeWidth={1}
      />
      <Polyline
        points="150,17 175,14 200,19 225,13 250,18 275,15 300,17"
        fill="none"
        stroke={C.flow}
        strokeWidth={1.5}
      />
    </Frame>
  );
}

function TransfertSpark() {
  return (
    <Frame>
      <Path
        d="M10,30 C50,29 70,6 95,5 C115,4 130,24 160,28 C200,30 245,30 290,30"
        fill="none"
        stroke={C.flow}
        strokeWidth={1.5}
      />
      <Path
        d="M10,30 C60,29 80,14 130,8 C180,4 240,6 290,6"
        fill="none"
        stroke={BRAKE_DOT}
        strokeWidth={1.5}
      />
    </Frame>
  );
}

const SPARKS: Record<ReadingKey, () => React.ReactElement> = {
  anatomie: AnatomieSpark,
  gg: GGSpark,
  dispersion: DispersionSpark,
  'tour-ideal': TourIdealSpark,
  flow: FlowSpark,
  transfert: TransfertSpark,
};

/** Sparkline DÉMO d'une lecture donnée (galerie). */
export function Sparkline({ reading }: { reading: ReadingKey }) {
  const Spark = SPARKS[reading];
  return <Spark />;
}
