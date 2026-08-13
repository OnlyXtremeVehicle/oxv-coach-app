/**
 * La carte de séance et ses points de freinage — extraite de `triage`.
 *
 * ===========================================================================
 * POURQUOI ELLE SORT DE `triage`
 * ===========================================================================
 *
 * Le plan de montage du jalon 6 condamne quatre écrans : *« le fil de séance
 * rend inutiles `debrief`, `triage`, `lecture` et `priorites` »*. Le fil existe
 * (`app/(coach)/fil.tsx`), et l'argument tient — pour le TEXTE.
 *
 * Mais `triage` portait autre chose que du texte, et personne d'autre ne le
 * portait :
 *
 *   • c'était le SEUL point de montage de `PilotPreset` dans l'application ;
 *   • et donc le seul endroit où `detectBrakingPoints` était appelé, c'est-à-dire
 *     le seul endroit où `BrakingPointsLayer` pouvait s'allumer.
 *
 * Supprimer l'écran aurait donc éteint la chaîne de freinage entière — celle
 * que le fondateur a demandé le 13/08 de garder ET de rendre fiable, par ces
 * mots : *« garde la chaine de freinage et rend la fiable »*.
 *
 * Deux instructions se croisaient. Aucune n'était à trancher : il suffisait de
 * les découpler. La carte vit désormais ici, montée par le fil ; l'écran
 * `triage` peut disparaître sans rien emporter.
 *
 * C'est le même geste qu'au jalon 5 pour l'écriture d'intention, qui allait
 * mourir avec l'arbre V1 et a été réhébergée dans `rec/fin` avant sa
 * suppression.
 *
 * ===========================================================================
 * CE QU'ELLE NE FAIT PAS
 * ===========================================================================
 *
 * Aucune priorisation, aucun classement, aucun « où regarder en premier ». Le
 * plan note que `triage` est *« doctrinalement douteux : un signalement
 * automatique est une interprétation »*. On n'emporte donc PAS cette part-là :
 * on garde la carte et les faits qu'elle situe, on laisse le tri derrière.
 *
 * La carte montre où la vitesse tombe. Elle ne dit pas si c'est bien.
 */

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PilotPreset, type TrajectoryPoint } from '@/components/CircuitMap';
import { useSessionCircuitName } from '@/hooks/useSessionCircuitName';
import { detectBrakingPoints } from '@/services/brakingPointsService';
import { loadSessionTrajectory } from '@/services/sessionTelemetryService';
import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing } = theme;

export interface CarteSeanceFreinageProps {
  sessionId: string | null;
  height?: number;
}

/**
 * Le composant résout LUI-MÊME son circuit, plutôt que de le recevoir.
 *
 * L'hôte — le fil de séance — ne porte pas cette information et n'a aucune
 * raison de la porter : il lit du texte. Lui faire charger un nom de circuit
 * pour le repasser ici étendrait sa responsabilité à un besoin qui n'est pas le
 * sien. `useSessionCircuitName` fait déjà exactement ce travail.
 */
export function CarteSeanceFreinage({ sessionId, height = 300 }: CarteSeanceFreinageProps) {
  const { circuitName } = useSessionCircuitName(sessionId);
  const [trajectory, setTrajectory] = useState<TrajectoryPoint[] | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let annule = false;
    // Best-effort : avant les trames du boîtier, la trajectoire est vide et la
    // silhouette du circuit suffit à situer. Pas d'état d'erreur pour autant —
    // l'absence de tracé n'est pas une panne de l'écran.
    loadSessionTrajectory(sessionId)
      .then((pts) => {
        if (!annule && pts.length > 1) setTrajectory(pts);
      })
      .catch(() => undefined);
    return () => {
      annule = true;
    };
  }, [sessionId]);

  /**
   * Les points de freinage.
   *
   * `undefined` et non `[]` quand il n'y a rien : la garde du preset teste la
   * longueur, mais un tableau vide dirait « calculé, aucun freinage » là où l'on
   * veut dire « pas de trajectoire ».
   *
   * `useMemo` parce que la détection parcourt la trajectoire entière.
   */
  const brakingPoints = useMemo(() => {
    if (trajectory === null || trajectory.length < 3) return undefined;
    const pts = detectBrakingPoints(trajectory);
    return pts.length > 0 ? pts : undefined;
  }, [trajectory]);

  return (
    <View>
      <PilotPreset
        circuitName={circuitName}
        animate
        trajectory={trajectory ?? undefined}
        brakingPoints={brakingPoints}
        height={height}
      />
      {/* Ce que la carte montre, dit sans commentaire de pilotage. La légende
          n'apparaît que si des repères existent : trois lignes d'explication
          sous une carte vide seraient du bruit. */}
      {brakingPoints ? (
        <Text style={s.legende}>
          Les repères marquent où la vitesse tombe le plus franchement. Ils situent, ils ne jugent
          pas.
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  legende: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: 18,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },
});
