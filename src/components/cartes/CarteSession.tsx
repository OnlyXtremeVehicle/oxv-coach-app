// DIVERGENCE_SCHEMA: température PISTE absente du schéma réel
// (weather_snapshots ne porte que temperature_c, l'air) → le pied de carte
// affiche météo + « Air N°C » uniquement, jamais de valeur inventée.
/**
 * Carte de session — composant réutilisable du Panel de cartes (référence
 * panel-cartes.html, bloc .carte). Une carte = une ligne telemetry_sessions.
 *
 * Pixel-perfect : surface #141414, bordure ligne (rouge si sélectionnée),
 * rayon 5, padding 16 ; n° de carte mono 10, date Syncopate 13, badge
 * « Référence personnelle » blanc sur noir ; grille de données 3 colonnes
 * (labels mono 8.5, valeurs mono bold 15, chrono 17, écart 13 gris NEUTRE
 * #D6D6D6) ; pied météo mono 10 + « Ouvrir → » (flèche rouge). Filigrane :
 * tracé réel du circuit (opacity 0.07, pointerEvents none).
 *
 * Doctrine Miroir : données factuelles, écarts neutres, aucun jugement.
 */

import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PressableScale } from '@/components/motion';
import { lotProfilTokens as t } from '@/theme/v2';

export interface CarteSessionProps {
  /** « 024 » — rang chronologique zero-paddé. */
  numero: string;
  /** « Jeu. 08 Juil. 2027 ». */
  date: string;
  estReference: boolean;
  /** « 1:52.418 » ou « — ». */
  chrono: string;
  /** « +0.684 » — null : cellule masquée (référence ou chrono absent). */
  ecart: string | null;
  /** « 31 » ou « — ». */
  tours: string;
  /** Libellé voiture — null : cellule masquée. */
  voiture: string | null;
  /** « Sec · Air 26°C » — null : rien à gauche du pied. */
  meteo: string | null;
  /** Tracé SVG réel (viewBox 0..1000) — null : pas de filigrane. */
  trackSvgPath: string | null;
  selectionnee: boolean;
  onBasculerSelection: () => void;
  onOuvrir: () => void;
}

interface Cellule {
  label: string;
  valeur: string;
  genre: 'temps' | 'ecart' | 'nombre' | 'voiture';
}

/**
 * Cellules de la grille — reproduction exacte de la référence : la carte de
 * référence (sans écart) montre Meilleur tour · Tours · Voiture ; les autres
 * Meilleur tour · Écart réf. · Tours (3 cellules maximum).
 */
function cellules({ chrono, ecart, tours, voiture }: CarteSessionProps): Cellule[] {
  const liste: Cellule[] = [{ label: 'Meilleur tour', valeur: chrono, genre: 'temps' }];
  if (ecart !== null) liste.push({ label: 'Écart réf.', valeur: ecart, genre: 'ecart' });
  liste.push({ label: 'Tours', valeur: tours, genre: 'nombre' });
  if (liste.length < 3 && voiture)
    liste.push({ label: 'Voiture', valeur: voiture, genre: 'voiture' });
  return liste.slice(0, 3);
}

export function CarteSession(props: CarteSessionProps) {
  const {
    numero,
    date,
    estReference,
    meteo,
    trackSvgPath,
    selectionnee,
    onBasculerSelection,
    onOuvrir,
  } = props;

  return (
    <PressableScale
      onPress={onBasculerSelection}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selectionnee }}
      accessibilityLabel={`Carte ${numero}, ${date}${estReference ? ', référence personnelle' : ''}`}
      pressedOpacity={0.85}
      pressedScale={0.99}
      style={[s.carte, selectionnee ? s.carteSelectionnee : null]}
    >
      {trackSvgPath ? (
        <View style={s.filigrane} pointerEvents="none">
          <Svg width={150} height={150} viewBox="0 0 1000 1000">
            <Path
              d={trackSvgPath}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={9}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      ) : null}

      <View style={s.haut}>
        <View style={{ flexShrink: 1 }}>
          <Text style={s.numCarte}>Carte {numero}</Text>
          <Text style={s.date}>{date}</Text>
          {estReference ? (
            <View style={s.badgeRef}>
              <Text style={s.badgeRefTexte}>Référence personnelle</Text>
            </View>
          ) : null}
        </View>
        <View style={[s.selecteur, selectionnee ? s.selecteurCoche : null]}>
          {selectionnee ? (
            <Svg width={20} height={20} viewBox="0 0 22 22">
              <Path
                d="M5 11.5 L9.5 16 L17 7"
                fill="none"
                stroke={t.blanc}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          ) : null}
        </View>
      </View>

      <View style={s.donnees}>
        {cellules(props).map((c) => (
          <View key={c.label} style={s.donnee}>
            <Text style={s.label}>{c.label}</Text>
            <Text
              style={[
                s.valeur,
                c.genre === 'temps' ? s.valeurTemps : null,
                c.genre === 'ecart' ? s.valeurEcart : null,
                c.genre === 'voiture' ? s.valeurVoiture : null,
              ]}
              numberOfLines={2}
            >
              {c.valeur}
            </Text>
          </View>
        ))}
      </View>

      <View style={s.pied}>
        <Text style={s.meteo} numberOfLines={1}>
          {meteo ?? ''}
        </Text>
        <Pressable
          onPress={onOuvrir}
          accessibilityRole="button"
          accessibilityLabel={`Ouvrir la carte ${numero}`}
          hitSlop={10}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
          <Text style={s.ouvrir}>
            Ouvrir<Text style={s.fleche}> →</Text>
          </Text>
        </Pressable>
      </View>
    </PressableScale>
  );
}

const s = {
  carte: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.ligne,
    borderRadius: 5,
    padding: 16,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  carteSelectionnee: {
    borderColor: t.rouge,
  },
  filigrane: {
    position: 'absolute' as const,
    right: -20,
    bottom: -18,
    opacity: 0.07,
  },
  haut: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
  },
  numCarte: {
    fontFamily: t.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: t.gris,
    textTransform: 'uppercase' as const,
  },
  date: {
    fontFamily: t.fonts.displayReg,
    fontSize: 13,
    letterSpacing: 0.52,
    textTransform: 'uppercase' as const,
    color: t.blanc,
    marginTop: 5,
  },
  badgeRef: {
    alignSelf: 'flex-start' as const,
    backgroundColor: t.blanc,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 2,
    marginTop: 8,
  },
  badgeRefTexte: {
    fontFamily: t.fonts.monoBold,
    fontSize: 8,
    letterSpacing: 0.96,
    textTransform: 'uppercase' as const,
    color: t.noir,
  },
  selecteur: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: t.ligne,
    borderRadius: 3,
    flexShrink: 0,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  selecteurCoche: {
    borderColor: t.rouge,
    backgroundColor: t.rouge,
  },
  donnees: {
    flexDirection: 'row' as const,
    gap: 12,
    marginTop: 14,
    zIndex: 1,
  },
  donnee: { flex: 1 },
  label: {
    fontFamily: t.fonts.mono,
    fontSize: 8.5,
    letterSpacing: 1.02,
    textTransform: 'uppercase' as const,
    color: t.grisSombre,
  },
  valeur: {
    fontFamily: t.fonts.monoBold,
    fontSize: 15,
    letterSpacing: 0.3,
    color: t.blanc,
    marginTop: 4,
  },
  valeurTemps: { fontSize: 17 },
  // Écart NEUTRE — gris #D6D6D6, jamais un vert/rouge de jugement.
  valeurEcart: { fontSize: 13, color: t.deltaNeutre },
  valeurVoiture: { fontSize: 11, lineHeight: 15.4 },
  pied: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: t.ligne,
    zIndex: 1,
  },
  meteo: {
    flexShrink: 1,
    fontFamily: t.fonts.mono,
    fontSize: 10,
    color: t.gris,
    letterSpacing: 0.6,
  },
  ouvrir: {
    fontFamily: t.fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: t.blanc,
  },
  fleche: { color: t.rouge },
};
