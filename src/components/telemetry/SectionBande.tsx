/**
 * La bande, dans la section Tours — jalon 4, phase 4octies.
 *
 * ---
 *
 * ELLE NE S'AFFICHE QUE QUAND ELLE SERT
 *
 * *« Bascule automatique superposition → bande au-delà de 20 à 30 tours. »*
 *
 * En deçà du seuil, la liste des tours suffit et se lit mieux : chaque tour y
 * garde son identité. Au-delà, les traces cessent de se distinguer et la bande
 * prend le relais.
 *
 * Le seuil est une CONVENTION en attente de mesure — le critère d'acceptation
 * du jalon exige le seuil réel, mesuré sur appareil.
 *
 * ---
 *
 * ELLE NE CHARGE QU'À L'ENTRÉE DANS LA FENÊTRE
 *
 * La bande demande la séance entière. L'écran atteint déjà `loadSessionFrames`
 * cinq fois par ouverture ; une sixième au montage serait indéfendable.
 * `useFirstViewport` diffère la lecture jusqu'à ce que quelqu'un regarde.
 */

import { useEffect, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { space, useFirstViewport, useReduceMotion } from '@/ui/v2';
import { BandeTours } from '@/components/telemetry/BandeTours';
import { loadBandeSeance, TEXTE_BANDE, type BandeSeance } from '@/services/bandeService';
import { formeRecommandee } from '@/telemetry/bande';
import type { Lap } from '@/types/telemetry';

export interface SectionBandeProps {
  sessionId: string;
  /** Début de la séance, ISO — sert à convertir les bornes de tour. */
  debutSeanceIso: string;
  laps: readonly Lap[];
}

/** Marge latérale de l'écran (`space.xl`) et rembourrage de carte (`space.md`). */
const MARGE_ECRAN = space.xl;
const PAD_CARTE = space.md;

export function SectionBande({ sessionId, debutSeanceIso, laps }: SectionBandeProps) {
  const reduce = useReduceMotion();
  const { width: largeurEcran } = useWindowDimensions();
  const { ref, visible } = useFirstViewport(!reduce);
  const [resultat, setResultat] = useState<BandeSeance | null>(null);

  const chronometres = laps.filter((l) => !l.is_outlap && !l.is_inlap).length;
  const forme = formeRecommandee(chronometres);

  useEffect(() => {
    if (!visible || forme !== 'bande') return;
    let vivant = true;
    loadBandeSeance(sessionId, debutSeanceIso, laps).then((r) => {
      if (vivant) setResultat(r);
    });
    return () => {
      vivant = false;
    };
  }, [visible, forme, sessionId, debutSeanceIso, laps]);

  // En deçà du seuil, la liste des tours dit mieux ce qu'il y a à dire : chaque
  // tour y garde son identité. On n'affiche RIEN plutôt qu'une bande de trop.
  if (forme !== 'bande') return null;

  const largeur = Math.max(1, largeurEcran - MARGE_ECRAN * 2 - PAD_CARTE * 2);

  return (
    <Animated.View ref={ref} style={styles.bloc}>
      {resultat ? (
        <BandeTours
          bande={resultat.bande}
          width={largeur}
          unite="km/h"
          raisonAbsence={resultat.raison ? TEXTE_BANDE[resultat.raison] : undefined}
        />
      ) : (
        // Réserve la hauteur pour que l'arrivée de la bande ne fasse pas sauter
        // la page sous le doigt du pilote.
        <View style={styles.reserve} />
      )}
    </Animated.View>
  );
}

const styles = {
  bloc: { marginTop: space.md },
  reserve: { height: 150 },
} as const;
