/**
 * La courbe de delta — jalon 4, phase 4septies. Arbre `app/(app2)`, kit V2.
 *
 * *« Le delta cumulé montre OÙ le temps se gagne et se perd le long du tour ;
 * sa pente est le taux instantané. Mobile : très bon, une seule courbe. »*
 * — `OXV_Mirror_V3_Banque_Telemetrie.md`, banque de visualisations, forme n° 4.
 *
 * ---
 *
 * POURQUOI L'OR, ET POURQUOI D'UNE SEULE COULEUR
 *
 * `heritage.gold` porte déjà la courbe du tour de référence dans la Saison
 * (`src/features/data/saison/SaisonSections.tsx`, `GoldCurveChart` — l'écran a
 * fusionné dans le hub Data au jalon 4). Le delta cumulé est du TEMPS,
 * comme elle : il hérite de la même couleur, et l'application garde une seule
 * langue pour parler de chrono.
 *
 * Mais d'une SEULE couleur. La banque proscrit « le delta coloré » et « le
 * signe de comparaison imposé » : peindre en rouge ce qui monte et en vert ce
 * qui descend ferait d'un constat un verdict. Le signe s'écrit sous la courbe.
 *
 * ---
 *
 * LA LIGNE DE RÉFÉRENCE
 *
 * Le pointillé horizontal est le tour auquel on compare. Sans lui la courbe
 * flotte et son signe ne se rapporte à rien : l'échelle inclut donc toujours
 * zéro, même quand toute la courbe est d'un seul côté.
 *
 * ---
 *
 * LES TROUS RESTENT DES TROUS
 *
 * Là où `computeDelta` n'a rien pu établir — sous le plancher de vitesse — la
 * courbe s'interrompt. Aucun trait ne franchit l'absence : il se lirait comme
 * une mesure. Le compte des pas écartés est affiché.
 *
 * ---
 *
 * ELLE NE FABRIQUE RIEN
 *
 * Sans delta, la carte affiche la raison en français, et rien d'autre. Pas de
 * courbe vide, pas de zéro : un zéro dirait « les deux tours sont identiques »,
 * ce qui est un fait, et pas celui qu'on connaît.
 */

import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Canvas, Circle, DashPathEffect, Path, Skia } from '@shopify/react-native-skia';
import { Easing, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { GlowStroke, colors, motionTokens, radius, space, typo, useReduceMotion } from '@/ui/v2';
import type { DeltaResult } from '@/telemetry/delta';
import {
  ancreRepere,
  echelleDelta,
  formateDistance,
  formateSecondes,
  runs,
  type Cadre,
  type Repere,
} from '@/telemetry/courbeDelta';

const HAUTEUR = 152;
const PAD_L = 14;
const PAD_R = 14;
const PAD_T = 18;
/** Place réservée sous la zone utile aux libellés de repères. */
const PAD_B = 26;

export interface CourbeDeltaProps {
  /** Le résultat du calcul, ou `null` s'il n'a pas pu être établi. */
  delta: DeltaResult | null;
  /** Largeur disponible, mesurée par le parent. */
  width: number;
  /** Pourquoi il est absent. Affiché tel quel — descriptif, jamais prescriptif. */
  raisonAbsence?: string;
  /** Numéros des deux tours comparés. */
  tours?: { courant: number; reference: number };
  /**
   * Repères nommés posés sur l'axe — les virages, le plus souvent.
   *
   * Vides sans gyroscope : le découpage seuille la courbure, qui n'existe pas
   * sans vitesse de lacet. La courbe se dessine alors sans repères — c'est le
   * comportement voulu, pas une dégradation à masquer.
   */
  reperes?: readonly Repere[];
  /**
   * L'un des deux tours a-t-il été tronqué au chargement ?
   *
   * `loadLapFrames` plafonne à deux mille trames, soit quatre-vingts secondes à
   * vingt-cinq hertz. Un tour plus long arrive amputé, et le delta se refermerait
   * proprement sur un morceau de tour sans que rien ne le dise.
   */
  tronque?: boolean;
}

function Cartouche({ children }: { children: React.ReactNode }) {
  return <View style={styles.panneau}>{children}</View>;
}

function Vide({ raison }: { raison?: string }) {
  return (
    <Cartouche>
      <Text style={styles.titre}>LE DELTA</Text>
      <Text style={styles.absence}>
        {raison ?? 'Aucun delta n’a pu être établi sur cette séance.'}
      </Text>
      <Text style={styles.note}>
        Le delta compare deux de vos tours à distance égale. Il apparaîtra dès que la séance en
        portera deux qui couvrent le même parcours.
      </Text>
    </Cartouche>
  );
}

function CourbeDeltaBrut({
  delta,
  width,
  raisonAbsence,
  tours,
  reperes = [],
  tronque = false,
}: CourbeDeltaProps) {
  const reduce = useReduceMotion();
  const progress = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) {
      progress.value = 1;
      return;
    }
    progress.value = withTiming(1, {
      duration: motionTokens.pulse,
      easing: Easing.out(Easing.cubic),
    });
  }, [reduce, progress]);

  const geo = useMemo(() => {
    if (!delta || width <= 0) return null;
    const cadre: Cadre = {
      largeur: Math.max(1, width - PAD_L - PAD_R),
      hauteur: HAUTEUR - PAD_T - PAD_B,
    };
    const echelle = echelleDelta(delta.distance, delta.cumulative, cadre);
    if (!echelle) return null;

    const segments = runs(delta.distance, delta.cumulative, echelle, cadre);
    if (segments.length === 0) return null;

    // Un chemin Skia par segment CONTINU : un chemin unique relierait les
    // extrémités par-dessus le trou, et ce trait se lirait comme une mesure.
    const chemins = segments
      .filter((s) => s.length > 1)
      .map((s) => {
        const p = Skia.Path.Make();
        s.forEach((pt, i) =>
          i === 0 ? p.moveTo(PAD_L + pt.x, PAD_T + pt.y) : p.lineTo(PAD_L + pt.x, PAD_T + pt.y)
        );
        return p;
      });

    const zero = Skia.Path.Make();
    zero.moveTo(PAD_L, PAD_T + echelle.yZero);
    zero.lineTo(PAD_L + cadre.largeur, PAD_T + echelle.yZero);

    // Un pas encadré de deux trous ne fait pas un trait. Il se dessine en
    // pastille : le taire serait plus faux que le montrer seul.
    const isoles = segments
      .filter((s) => s.length === 1)
      .map((s) => ({ x: PAD_L + s[0].x, y: PAD_T + s[0].y }));

    const { ancres, ecartes } = ancreRepere(reperes, echelle, cadre);
    return { echelle, cadre, chemins, zero, isoles, ancres, ecartes };
  }, [delta, width, reperes]);

  if (!delta || !geo) return <Vide raison={raisonAbsence} />;

  const { echelle, chemins, zero, isoles, ancres, ecartes } = geo;
  const longueur = echelle.distanceMax - echelle.distanceMin;
  const total = delta.total;

  return (
    <Cartouche>
      <View style={styles.entete}>
        <Text style={styles.titre}>LE DELTA</Text>
        {tours ? (
          <Text style={styles.enteteDroite}>
            {`TOUR ${tours.courant} · RÉF. ${tours.reference}`}
          </Text>
        ) : null}
      </View>

      {/* La valeur d'arrivée. Le signe s'écrit ; il ne se peint pas. */}
      <Text style={styles.valeur}>{formateSecondes(total)}</Text>
      <Text style={styles.valeurLabel}>
        {total === null
          ? 'AUCUN PAS EXPLOITABLE'
          : total > 0
            ? 'DE PLUS QUE VOTRE TOUR DE RÉFÉRENCE, AU BOUT DU TOUR'
            : total < 0
              ? 'DE MOINS QUE VOTRE TOUR DE RÉFÉRENCE, AU BOUT DU TOUR'
              : 'ÉCART NUL AU BOUT DU TOUR'}
      </Text>

      <View style={{ width, height: HAUTEUR }}>
        <Canvas
          style={{ width, height: HAUTEUR }}
          accessible
          accessibilityLabel={`Courbe du delta cumulé sur ${formateDistance(longueur)}. Écart final ${formateSecondes(total)}.`}
        >
          {/* La référence : pointillé, comme le record de la Saison. */}
          <Path path={zero} style="stroke" strokeWidth={1} color={colors.border.strong}>
            <DashPathEffect intervals={[4, 4]} />
          </Path>
          {chemins.map((p, i) => (
            <GlowStroke
              key={i}
              path={p}
              color={colors.heritage.gold}
              glowColor={colors.heritage.glow}
              strokeWidth={2}
              progress={progress as SharedValue<number>}
            />
          ))}
          {/* Les pas mesurés seuls entre deux trous. */}
          {isoles.map((p, i) => (
            <Circle key={`i-${i}`} cx={p.x} cy={p.y} r={1.8} color={colors.heritage.gold} />
          ))}
        </Canvas>

        {/* Repères nommés — texte RN par-dessus le Canvas, qui n'a pas de fonte. */}
        {ancres.map((a) => (
          <View
            key={`${a.nom}-${a.distanceM}`}
            style={[styles.repere, { left: PAD_L + a.x, height: HAUTEUR - PAD_B }]}
            pointerEvents="none"
          />
        ))}
        {ancres.map((a) => (
          <Text
            key={`l-${a.nom}-${a.distanceM}`}
            style={[
              styles.repereTexte,
              a.aGauche
                ? { right: width - (PAD_L + a.x) + 3, textAlign: 'right' }
                : { left: PAD_L + a.x + 3 },
            ]}
            numberOfLines={1}
          >
            {a.nom}
          </Text>
        ))}
      </View>

      <View style={styles.axe}>
        <Text style={styles.axeTexte}>{formateDistance(echelle.distanceMin)}</Text>
        <Text style={styles.axeTexte}>{formateDistance(echelle.distanceMax)}</Text>
      </View>

      <Text style={styles.echelle}>
        {`échelle verticale ${formateSecondes(echelle.deltaMin, 1)} à ${formateSecondes(echelle.deltaMax, 1)} · pas de ${delta.step} m`}
      </Text>

      {delta.skipped > 0 ? (
        <Text style={styles.echelle}>
          {`${delta.skipped} pas écartés faute de vitesse exploitable des deux côtés — la courbe s’y interrompt.`}
        </Text>
      ) : null}

      {ecartes > 0 ? (
        <Text style={styles.echelle}>{`${ecartes} repères masqués faute de place sur l’axe.`}</Text>
      ) : null}

      {tronque ? (
        <Text style={styles.avertissement}>
          Un des deux tours dépasse la limite de chargement : la courbe ne couvre qu’un début de
          tour.
        </Text>
      ) : null}

      <Text style={styles.note}>
        La pente dit à quelle vitesse l’écart se fait ; la courbe dit où. Elle ne dit pas pourquoi.
      </Text>
    </Cartouche>
  );
}

export const CourbeDelta = memo(CourbeDeltaBrut);

const styles = StyleSheet.create({
  panneau: {
    backgroundColor: colors.bg.card,
    borderColor: colors.border.card,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingTop: space.lg,
    paddingBottom: space.md,
    paddingHorizontal: space.md,
  },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titre: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.text.mid,
  },
  enteteDroite: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.text.dim,
  },
  valeur: {
    fontFamily: typo.monoSemi,
    fontSize: 38,
    color: colors.heritage.gold,
    marginTop: space.md,
  },
  valeurLabel: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    lineHeight: 15,
    color: colors.text.dim,
    marginBottom: space.sm,
  },
  repere: {
    position: 'absolute',
    top: 0,
    width: 1,
    backgroundColor: colors.border.hairline,
  },
  repereTexte: {
    position: 'absolute',
    bottom: 4,
    fontFamily: typo.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.text.dim,
    maxWidth: 44,
  },
  axe: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axeTexte: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.text.dim,
  },
  echelle: {
    fontFamily: typo.mono,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.6,
    color: colors.text.dim,
    marginTop: space.xs,
  },
  avertissement: {
    fontFamily: typo.bodyMedium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.mid,
    marginTop: space.sm,
  },
  absence: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.hi,
    marginTop: space.md,
  },
  note: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.low,
    marginTop: space.sm,
  },
});
