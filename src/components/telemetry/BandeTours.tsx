/**
 * La bande de vos tours — jalon 4, phase 4octies. Arbre `app/(app2)`, kit V2.
 *
 * *« Bascule automatique superposition → bande au-delà de 20 à 30 tours »* —
 * `OXV_Mirror_V3_Plan_Montage.md`, phase 4octies.
 *
 * ---
 *
 * CE QU'ELLE MONTRE, EN TROIS COUCHES
 *
 *   l'ÉTENDUE — du tour le plus lent au plus rapide, à chaque pas ;
 *   les QUARTILES — la moitié centrale de vos tours ;
 *   la LIGNE CENTRALE — la médiane, et non la moyenne.
 *
 * La médiane parce qu'une séance de piste porte des tours gâchés : un
 * dépassement, un drapeau, un tour d'observation. Une moyenne les absorbe et
 * déplace toute la courbe.
 *
 * ---
 *
 * ELLE DÉCRIT VOS TOURS, ELLE NE VISE RIEN
 *
 * Aucune cible n'est tracée, aucune médiane d'autrui, aucune valeur
 * « optimale ». Le dossier l'écrit pour la mémoire du circuit et cela vaut
 * ici : une ligne superposée à celle du pilote deviendrait une cible, et
 * l'application aurait prescrit sans un mot.
 *
 * ---
 *
 * LES TROUS RESTENT DES TROUS
 *
 * Là où moins de trois tours mesurent, la bande s'interrompt. Aucune surface ne
 * franchit l'absence : une aire tirée par-dessus se lirait comme une étendue
 * mesurée.
 */

import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { Easing, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { GlowStroke, colors, motionTokens, radius, space, typo, useReduceMotion } from '@/ui/v2';
import type { Bande } from '@/telemetry/bande';
import { formateDistance } from '@/telemetry/courbeDelta';

const HAUTEUR = 150;
const PAD_L = 14;
const PAD_R = 14;
const PAD_T = 16;
const PAD_B = 16;

export interface BandeToursProps {
  bande: Bande;
  /** Largeur disponible, mesurée par le parent. */
  width: number;
  /** Pourquoi elle est vide. Affiché tel quel. */
  raisonAbsence?: string;
  /** Unité de la grandeur portée — « km/h » pour une trace de vitesse. */
  unite?: string;
}

/** Une aire fermée entre deux séries, par segments continus. */
function aire(
  b: Bande,
  bas: readonly (number | null)[],
  haut: readonly (number | null)[],
  xFor: (i: number) => number,
  yFor: (v: number) => number
) {
  const chemin = Skia.Path.Make();
  let i = 0;
  let dessine = false;

  while (i < b.distance.length) {
    // Cherche le début d'un segment mesuré des deux côtés.
    while (i < b.distance.length && (bas[i] === null || haut[i] === null)) i++;
    const debut = i;
    while (i < b.distance.length && bas[i] !== null && haut[i] !== null) i++;
    const fin = i;
    if (fin - debut < 2) continue;

    chemin.moveTo(xFor(debut), yFor(haut[debut] as number));
    for (let k = debut + 1; k < fin; k++) chemin.lineTo(xFor(k), yFor(haut[k] as number));
    for (let k = fin - 1; k >= debut; k--) chemin.lineTo(xFor(k), yFor(bas[k] as number));
    chemin.close();
    dessine = true;
  }
  return dessine ? chemin : null;
}

/** Le trait médian, par segments continus. */
function ligne(
  b: Bande,
  xFor: (i: number) => number,
  yFor: (v: number) => number
): ReturnType<typeof Skia.Path.Make>[] {
  const out: ReturnType<typeof Skia.Path.Make>[] = [];
  let i = 0;
  while (i < b.distance.length) {
    while (i < b.distance.length && b.mediane[i] === null) i++;
    const debut = i;
    while (i < b.distance.length && b.mediane[i] !== null) i++;
    const fin = i;
    if (fin - debut < 2) continue;
    const p = Skia.Path.Make();
    p.moveTo(xFor(debut), yFor(b.mediane[debut] as number));
    for (let k = debut + 1; k < fin; k++) p.lineTo(xFor(k), yFor(b.mediane[k] as number));
    out.push(p);
  }
  return out;
}

function Vide({ raison }: { raison?: string }) {
  return (
    <View style={styles.panneau}>
      <Text style={styles.titre}>LA BANDE DE VOS TOURS</Text>
      <Text style={styles.absence}>
        {raison ?? 'Pas encore de quoi dessiner une bande sur cette séance.'}
      </Text>
    </View>
  );
}

function BandeToursBrut({ bande, width, raisonAbsence, unite = '' }: BandeToursProps) {
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
    if (bande.distance.length < 2 || width <= 0) return null;

    let bas = Number.POSITIVE_INFINITY;
    let haut = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < bande.distance.length; i++) {
      const lo = bande.min[i];
      const hi = bande.max[i];
      if (lo !== null && lo < bas) bas = lo;
      if (hi !== null && hi > haut) haut = hi;
    }
    if (!Number.isFinite(bas) || !Number.isFinite(haut)) return null;
    if (haut - bas < 1e-9) {
      bas -= 0.5;
      haut += 0.5;
    }

    const utileW = Math.max(1, width - PAD_L - PAD_R);
    const utileH = HAUTEUR - PAD_T - PAD_B;
    const n = bande.distance.length;
    const xFor = (i: number) => PAD_L + (n > 1 ? i / (n - 1) : 0.5) * utileW;
    const yFor = (v: number) => PAD_T + (1 - (v - bas) / (haut - bas)) * utileH;

    return {
      bas,
      haut,
      etendue: aire(bande, bande.min, bande.max, xFor, yFor),
      quartiles: aire(bande, bande.q1, bande.q3, xFor, yFor),
      medianes: ligne(bande, xFor, yFor),
    };
  }, [bande, width]);

  if (!geo || geo.medianes.length === 0) return <Vide raison={raisonAbsence} />;

  const suffixe = unite ? ` ${unite}` : '';
  const longueur = bande.distance[bande.distance.length - 1] - bande.distance[0];

  return (
    <View style={styles.panneau}>
      <View style={styles.entete}>
        <Text style={styles.titre}>LA BANDE DE VOS TOURS</Text>
        <Text style={styles.enteteDroite}>{`${bande.nbTours} TOURS`}</Text>
      </View>

      <Canvas
        style={{ width, height: HAUTEUR }}
        accessible
        accessibilityLabel={`Bande de ${bande.nbTours} tours sur ${formateDistance(longueur)}. Ligne centrale médiane, moitié centrale en clair, étendue complète en fond.`}
      >
        {/* L'étendue complète — ce que les tours extrêmes ont fait. */}
        {geo.etendue ? (
          <Path path={geo.etendue} style="fill" color={colors.border.hairline} opacity={0.9} />
        ) : null}
        {/* La moitié centrale de vos tours. */}
        {geo.quartiles ? (
          <Path path={geo.quartiles} style="fill" color={colors.border.strong} opacity={0.7} />
        ) : null}
        {/* La ligne centrale — médiane, jamais moyenne. */}
        {geo.medianes.map((p, i) => (
          <GlowStroke
            key={i}
            path={p}
            color={colors.text.hi}
            glowColor="rgba(232,233,237,0.18)"
            strokeWidth={1.8}
            progress={progress as SharedValue<number>}
          />
        ))}
      </Canvas>

      <View style={styles.axe}>
        <Text style={styles.axeTexte}>{formateDistance(bande.distance[0])}</Text>
        <Text style={styles.axeTexte}>
          {formateDistance(bande.distance[bande.distance.length - 1])}
        </Text>
      </View>

      <Text style={styles.echelle}>
        {`échelle verticale ${geo.bas.toFixed(0)} à ${geo.haut.toFixed(0)}${suffixe} · pas de ${bande.pas} m`}
      </Text>

      <View style={styles.legende}>
        <View style={styles.legendeItem}>
          <View style={[styles.pastille, { backgroundColor: colors.text.hi }]} />
          <Text style={styles.legendeTexte}>ligne centrale</Text>
        </View>
        <View style={styles.legendeItem}>
          <View style={[styles.pastille, { backgroundColor: colors.border.strong }]} />
          <Text style={styles.legendeTexte}>moitié centrale</Text>
        </View>
        <View style={styles.legendeItem}>
          <View style={[styles.pastille, { backgroundColor: colors.border.hairline }]} />
          <Text style={styles.legendeTexte}>étendue</Text>
        </View>
      </View>

      <Text style={styles.note}>
        La ligne centrale est une médiane : un tour gâché par du trafic ne la déplace pas. Elle
        décrit vos tours, elle ne vise rien.
      </Text>
    </View>
  );
}

export const BandeTours = memo(BandeToursBrut);

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
    marginBottom: space.sm,
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
  axe: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.xs,
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
  legende: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    marginTop: space.sm,
  },
  legendeItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pastille: { width: 10, height: 3, borderRadius: 2 },
  legendeTexte: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text.dim,
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
