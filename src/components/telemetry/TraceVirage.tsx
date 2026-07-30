/**
 * TraceVirage — le virage seul, dessiné. Arbre `app/(app2)`, kit V2, Skia.
 *
 * Porté au lot J5 depuis `app/(app)/virage.tsx` et `virage-comparer.tsx`, sur
 * décision fondateur du 29/07/2026.
 *
 * ---
 *
 * CE QU'IL MONTRE, ET CE QU'IL A FALLU RÉPARER POUR LE MONTRER
 *
 * Le tracé du virage seul, découpé dans LES TRAMES D'UN TOUR. Le service V1
 * `cornerDeepDiveService` faisait autre chose : il lisait mille trames de la
 * SÉANCE ENTIÈRE et les découpait sur leur rang dans cette liste. Avec
 * plusieurs tours, ce découpage ne désigne plus un virage mais une tranche
 * arbitraire du roulage. Le calcul vit désormais dans `src/telemetry/virage.ts`,
 * il ne prend que des trames de tour, et il est testé.
 *
 * Ce service portait par ailleurs les segments de Haute Saintonge EN DUR. Rien
 * de tel ici : la fenêtre vient de la ligne `app_segment_analyses` du virage
 * affiché, quel que soit le circuit.
 *
 * ---
 *
 * DEUX TOURS : AUCUN VAINQUEUR
 *
 * Quand un second tour est fourni, les deux passages se superposent dans le
 * MÊME cadre — deux cadres séparés les feraient coïncider visuellement alors
 * qu'ils ne passent pas au même endroit.
 *
 * L'OR NE SE DONNE PAS À UN TOUR QUELCONQUE. Dans le canon, `heritage.gold`
 * code le chrono et le record — le même écran l'emploie pour le meilleur tour
 * de la séance. Peindre en or le tour qu'on regarde parce qu'il est « celui de
 * gauche » lui prêterait un statut qu'il n'a pas.
 *
 * L'or n'est donc pris que si le tour lu EST le meilleur tour de la séance
 * (`referenceEstMeilleurTour`). Sinon il passe en crème, et le tour comparé
 * garde le bleu trajectoire. Dans les deux cas, aucun n'est déclaré meilleur et
 * aucun écart n'est peint : ce sont deux faits côte à côte.
 *
 * ---
 *
 * L'APEX EST UNE TRAME MESURÉE
 *
 * Le point marqué est la trame la plus proche de la corde de référence, prise
 * telle quelle. Aucun apex n'est interpolé, et sans corde connue aucun point
 * n'est marqué.
 */

import { memo, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';

import { GlowStroke, colors, space, typo } from '@/ui/v2';
import { cadreCommun, projette, type TrancheVirage } from '@/telemetry/virage';

const HAUTEUR = 200;
const MARGE = 14;

/** Bleu trajectoire — la branche QDI, pas une couleur d'humeur. */
const BLEU = colors.qdi.trajectoire;
const OR = colors.heritage.gold;

export interface TraceVirageProps {
  /** Le tour qu'on lit. */
  reference: TrancheVirage;
  /**
   * Ce tour est-il le meilleur de la séance ? Seul ce cas autorise l'or —
   * ailleurs, la couleur mentirait sur le statut du tour.
   */
  referenceEstMeilleurTour?: boolean;
  /** Second tour à superposer. Absent = un seul tracé. */
  compare?: TrancheVirage | null;
  /** Libellés des deux tours, pour la légende et le lecteur d'écran. */
  labelReference?: string;
  labelCompare?: string;
}

export const TraceVirage = memo(function TraceVirage({
  reference,
  referenceEstMeilleurTour = false,
  compare,
  labelReference = 'Tour lu',
  labelCompare = 'Tour comparé',
}: TraceVirageProps) {
  const teinteRef = referenceEstMeilleurTour ? OR : colors.text.hi;
  const [largeur, setLargeur] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const l = e.nativeEvent.layout.width;
    setLargeur((prev) => (Math.abs(prev - l) < 1 ? prev : l));
  };

  const dessin = useMemo(() => {
    if (largeur <= 0) return null;
    const tranches = compare ? [reference, compare] : [reference];
    const cadre = cadreCommun(tranches);
    if (cadre === null) return null;

    const chemin = (t: TrancheVirage) => {
      if (t.points.length < 2) return null;
      const p = Skia.Path.Make();
      t.points.forEach((pt, i) => {
        const { x, y } = projette(pt, cadre, largeur, HAUTEUR, MARGE);
        if (i === 0) p.moveTo(x, y);
        else p.lineTo(x, y);
      });
      return p;
    };

    const apex = (t: TrancheVirage) =>
      t.apex ? projette(t.apex, cadre, largeur, HAUTEUR, MARGE) : null;

    return {
      cheminRef: chemin(reference),
      cheminCmp: compare ? chemin(compare) : null,
      apexRef: apex(reference),
      apexCmp: compare ? apex(compare) : null,
    };
  }, [reference, compare, largeur]);

  const vide = reference.points.length < 2 && (!compare || compare.points.length < 2);

  return (
    <View onLayout={onLayout}>
      {vide ? (
        <View style={[styles.cadre, styles.cadreVide]}>
          <Text style={styles.note}>
            Pas assez de trames sur ce virage pour en dessiner le passage.
          </Text>
        </View>
      ) : (
        <>
          <View
            style={styles.cadre}
            accessible
            accessibilityLabel={
              compare
                ? `Tracé du virage, deux passages superposés : ${labelReference} et ${labelCompare}.`
                : `Tracé du virage, ${labelReference}.`
            }
          >
            {dessin !== null && largeur > 0 ? (
              <Canvas style={{ width: largeur, height: HAUTEUR }}>
                {/* Le comparé passe DESSOUS : le tour de référence reste lisible
                    là où les deux se croisent. */}
                {dessin.cheminCmp ? (
                  <Path
                    path={dessin.cheminCmp}
                    style="stroke"
                    strokeWidth={2}
                    strokeCap="round"
                    strokeJoin="round"
                    color={BLEU}
                  />
                ) : null}
                {dessin.cheminRef ? (
                  <GlowStroke
                    path={dessin.cheminRef}
                    color={teinteRef}
                    glowColor={
                      referenceEstMeilleurTour ? colors.heritage.glow : 'rgba(232,233,237,0.22)'
                    }
                    strokeWidth={2.4}
                  />
                ) : null}
                {dessin.apexCmp ? (
                  <Circle cx={dessin.apexCmp.x} cy={dessin.apexCmp.y} r={3.5} color={BLEU} />
                ) : null}
                {dessin.apexRef ? (
                  <Circle cx={dessin.apexRef.x} cy={dessin.apexRef.y} r={3.5} color={teinteRef} />
                ) : null}
              </Canvas>
            ) : null}
          </View>

          <View style={styles.legende}>
            <Legende teinte={teinteRef} texte={labelReference} />
            {compare ? <Legende teinte={BLEU} texte={labelCompare} /> : null}
          </View>

          <Text style={styles.note}>
            Le point marque le passage à la corde le plus proche de la référence du circuit — une
            trame mesurée, jamais un point construit.
          </Text>
        </>
      )}
    </View>
  );
});

function Legende({ teinte, texte }: { teinte: string; texte: string }) {
  return (
    <View style={styles.legendeItem}>
      <View style={[styles.pastille, { backgroundColor: teinte }]} />
      <Text style={styles.legendeTexte}>{texte}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: {
    height: HAUTEUR,
    borderRadius: 12,
    backgroundColor: colors.bg.card2,
    overflow: 'hidden',
  },
  cadreVide: { alignItems: 'center', justifyContent: 'center', padding: space.lg },
  legende: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Les légendes ne sont pas tactiles : l'écart sert la lecture, pas la cible.
    gap: space.md,
    marginTop: space.md,
  },
  legendeItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pastille: { width: 8, height: 8, borderRadius: 4 },
  legendeTexte: { fontFamily: typo.mono, fontSize: 11, color: colors.text.mid },
  note: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.low,
    marginTop: space.sm,
  },
});
