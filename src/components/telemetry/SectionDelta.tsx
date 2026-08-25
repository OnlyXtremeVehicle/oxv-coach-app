/**
 * La section « LE DELTA » de l'écran de séance — jalon 4, phase 4septies.
 *
 * ---
 *
 * ELLE NE CHARGE QU'À L'ENTRÉE DANS LA FENÊTRE
 *
 * L'écran de séance atteint déjà `loadSessionFrames` — lecture paginée jusqu'à
 * soixante mille lignes, sans cache — **cinq fois par ouverture**, parce que la
 * section Télémétrie lance ses quatre requêtes au montage, que le pilote y
 * descende ou non.
 *
 * Le delta demande deux tours de trames de plus. Les charger au montage
 * porterait le total à sept lectures pour un écran dont on ne voit que le haut.
 *
 * `useFirstViewport` existait dans le kit et n'était utilisé que par les
 * animations. Il sert ici à ce pour quoi il est fait : ne rien demander tant
 * que personne ne regarde.
 *
 * ---
 *
 * ELLE NE FABRIQUE RIEN
 *
 * Moins de deux tours chronométrés, une lecture qui échoue, deux tours de
 * longueurs incomparables : chaque cas rend son texte, en français, et aucune
 * courbe. Un zéro dirait « les deux tours sont identiques », ce qui est un
 * fait, et pas celui qu'on connaît.
 */

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';

import { fontSize } from '@/theme/v2';
import { colors, radius, space, typo, useFirstViewport, useReduceMotion } from '@/ui/v2';
import { CourbeDelta } from '@/components/telemetry/CourbeDelta';
import { choisitPaireTours, type TourCandidat } from '@/features/data/choixPaireTours';
import { formatDeltaMs } from '@/features/data/comparerLogic';
import {
  calculeOpportunites,
  type OpportunitesTour,
  type SegmentEcart,
} from '@/features/data/opportunitesLogic';
import { reperesDepuisSegments, type SegmentSituable } from '@/features/data/reperesVirages';
import type { Repere } from '@/telemetry/courbeDelta';
import { loadDeltaEntreTours, TEXTE_ABSENCE, type DeltaEntreTours } from '@/services/deltaService';

export interface SectionDeltaProps {
  sessionId: string;
  /** Les tours de la séance, tels que `fetchSessionLaps` les rend. */
  tours: readonly TourCandidat[];
  /** Le tour sélectionné dans la section Tours, s'il y en a un. */
  tourSelectionne: number | null;
  /**
   * Le découpage du tracé, d'où viennent les noms de virages.
   *
   * Vide tant qu'aucune analyse de segments n'existe pour la séance — la
   * courbe se dessine alors sans repères, et c'est le comportement voulu.
   */
  segments?: readonly SegmentSituable[];
}

/** Marge latérale de l'écran de séance (`space.xl`), des deux côtés. */
const MARGE_ECRAN = space.xl;
/** Rembourrage horizontal de la carte. */
const PAD_CARTE = space.md;

export function SectionDelta({
  sessionId,
  tours,
  tourSelectionne,
  segments = [],
}: SectionDeltaProps) {
  const reduce = useReduceMotion();
  const { width: largeurEcran } = useWindowDimensions();
  const { ref, visible } = useFirstViewport(!reduce);

  const paire = choisitPaireTours(tours, tourSelectionne);
  const [resultat, setResultat] = useState<DeltaEntreTours | null>(null);
  const [etat, setEtat] = useState<'attente' | 'charge' | 'pret' | 'erreur'>('attente');

  useEffect(() => {
    if (!visible || !paire) return;
    let vivant = true;
    setEtat('charge');
    loadDeltaEntreTours(sessionId, paire.courant, paire.reference)
      .then((r) => {
        if (!vivant) return;
        setResultat(r);
        setEtat('pret');
      })
      .catch(() => {
        if (!vivant) return;
        setEtat('erreur');
      });
    return () => {
      vivant = false;
    };
    // `paire` est recalculée à chaque rendu : on dépend de ses deux nombres.
  }, [visible, sessionId, paire?.courant, paire?.reference]); // eslint-disable-line react-hooks/exhaustive-deps

  const largeurCourbe = Math.max(1, largeurEcran - MARGE_ECRAN * 2 - PAD_CARTE * 2);

  /**
   * Les repères se composent APRÈS le calcul : leur position vient d'une
   * fraction du tour, et la longueur du tour n'est connue qu'une fois la
   * grille du delta établie. La déduire ailleurs ferait glisser les virages.
   */
  const reperes = useMemo(() => {
    const grille = resultat?.delta?.distance;
    if (!grille || grille.length === 0) return [];
    return reperesDepuisSegments(segments, grille[grille.length - 1]);
  }, [resultat, segments]);

  /**
   * Les écarts locaux par segment (module M07), calculés sur LE MÊME delta que
   * la courbe — jamais un second calcul qui pourrait diverger d'elle. Les
   * entrées de virages servent de frontières quand elles existent ; sinon la
   * découpe régulière de 100 m du module.
   */
  const opportunites = useMemo(() => {
    const delta = resultat?.delta ?? null;
    if (!delta) return null;
    const bornesM = reperes.map((r) => r.distanceM);
    return calculeOpportunites(delta, bornesM.length > 0 ? { bornesM } : undefined);
  }, [resultat, reperes]);

  // Moins de deux tours chronométrés : rien à comparer, et on le dit.
  if (!paire) {
    return (
      <Animated.View ref={ref}>
        <View style={styles.carteVide}>
          <Text style={styles.titre}>LE DELTA</Text>
          <Text style={styles.absence}>
            Cette séance ne porte pas deux tours chronométrés à comparer.
          </Text>
          <Text style={styles.note}>
            Les tours de sortie et de rentrée aux stands n’entrent pas dans la comparaison.
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View ref={ref}>
      {etat === 'pret' && resultat ? (
        <>
          <CourbeDelta
            delta={resultat.delta}
            width={largeurCourbe}
            raisonAbsence={resultat.raison ? TEXTE_ABSENCE[resultat.raison] : undefined}
            tours={resultat.tours}
            reperes={reperes}
            tronque={resultat.tronque}
          />
          {paire.referenceEstSecond ? (
            <Text style={styles.precision}>
              Vous lisez votre meilleur tour comparé au deuxième : c’est là que se voit où il s’est
              fait.
            </Text>
          ) : null}
          {opportunites && resultat.delta ? (
            <BlocOpportunites
              opportunites={opportunites}
              reperes={reperes}
              step={resultat.delta.step}
            />
          ) : null}
        </>
      ) : (
        <View style={styles.carteVide}>
          <Text style={styles.titre}>LE DELTA</Text>
          <Text style={styles.absence}>
            {etat === 'erreur'
              ? 'Les trames n’ont pas pu être lues.'
              : `Tour ${paire.courant} comparé au tour ${paire.reference}.`}
          </Text>
          {etat !== 'erreur' ? <Text style={styles.note}>Lecture en cours.</Text> : null}
        </View>
      )}
    </Animated.View>
  );
}

/**
 * Nom d'un segment d'écart : le virage dont l'entrée est sa frontière de
 * départ, sinon ses bornes en mètres. La correspondance se fait par INDEX de
 * grille — c'est ainsi que le module rabat les bornes (`round(borne / pas)`),
 * et refaire la même conversion est le seul moyen de retomber juste.
 */
function nomSegment(seg: SegmentEcart, reperes: readonly Repere[], step: number): string {
  if (step > 0) {
    const idxDebut = Math.round(seg.debutM / step);
    const repere = reperes.find((r) => Math.round(r.distanceM / step) === idxDebut);
    if (repere) return repere.nom;
  }
  return `${Math.round(seg.debutM)}–${Math.round(seg.finM)} m`;
}

/**
 * Les deux-trois segments à plus forte perte locale, sous la courbe — l'ordre
 * du potentiel, jamais un classement de fautes : aucune cause n'est attribuée.
 * La ligne de réconciliation dit d'où viennent les chiffres : la somme des
 * segments retombe sur le delta du tour, et l'écran affiche l'écart mesuré.
 */
function BlocOpportunites({
  opportunites,
  reperes,
  step,
}: {
  opportunites: OpportunitesTour;
  reperes: readonly Repere[];
  /** Pas de la grille du delta, en mètres — celui-là même du calcul amont. */
  step: number;
}) {
  // Positif = temps rendu par le tour courant. Les segments arrivent déjà triés
  // par écart décroissant : les trois premiers positifs sont les plus fortes
  // pertes locales.
  const pertes = opportunites.segments.filter((s) => s.ecartLocalS > 0).slice(0, 3);

  return (
    <View style={styles.opportunites}>
      <Text style={styles.opportunitesTitre}>OÙ LE TEMPS SE REND LE PLUS</Text>
      {pertes.length > 0 ? (
        pertes.map((seg) => (
          <Text key={`${seg.debutM}-${seg.finM}`} style={styles.opportunitesLigne}>
            {`${nomSegment(seg, reperes, step)} · ${formatDeltaMs(seg.ecartLocalS * 1000)}`}
          </Text>
        ))
      ) : (
        <Text style={styles.note}>
          Aucun segment où le tour lu rend du temps sur cette comparaison.
        </Text>
      )}
      <Text style={styles.note}>
        {`Écarts lus segment par segment sur la courbe ci-dessus.${
          opportunites.ecartReconciliationS !== null
            ? ` Somme des segments = delta du tour à ±${Math.round(
                opportunites.ecartReconciliationS * 1000
              )} ms.`
            : ''
        }`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  carteVide: {
    backgroundColor: colors.bg.card,
    borderColor: colors.border.card,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
  },
  titre: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.text.mid,
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
  precision: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.low,
    marginTop: space.sm,
    paddingHorizontal: space.xs,
  },
  // ── Écarts locaux par segment (M07), sous la courbe ──
  opportunites: {
    marginTop: space.md,
    paddingHorizontal: space.xs,
  },
  opportunitesTitre: {
    fontFamily: typo.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.2,
    color: colors.text.low,
    marginBottom: space.sm,
  },
  opportunitesLigne: {
    fontFamily: typo.mono,
    fontSize: fontSize.small,
    color: colors.text.hi,
    fontVariant: ['tabular-nums'],
    paddingVertical: 2,
  },
});
