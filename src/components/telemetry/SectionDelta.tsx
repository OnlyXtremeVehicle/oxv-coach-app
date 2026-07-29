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

import { colors, radius, space, typo, useFirstViewport, useReduceMotion } from '@/ui/v2';
import { CourbeDelta } from '@/components/telemetry/CourbeDelta';
import { choisitPaireTours, type TourCandidat } from '@/features/data/choixPaireTours';
import { reperesDepuisSegments, type SegmentSituable } from '@/features/data/reperesVirages';
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
});
