/**
 * Résolution de la ligne d'arrivée pour la détection de tours (pure, testable).
 *
 * La détection de tours (cf. `utils/lapDetection`) n'est fiable que si on lui
 * passe la ligne d'arrivée DU CIRCUIT CHOISI. Sans elle, la capture retombait sur
 * un défaut codé en dur (mauvaises coordonnées) → aucun tour détecté sur Haute
 * Saintonge / Charente. Ce helper fournit la ligne du circuit, ou `undefined` si
 * elle n'est pas renseignée (0/0 ou non finie) — jamais une fausse valeur.
 *
 * Le CAP (`finishLineHeading`) est transmis quand il est renseigné : il fait
 * basculer la détection en mode PORTE (segment perpendiculaire à la piste), seul
 * mode capable d'exclure une voie des stands parallèle. Cap absent → mode rayon,
 * comportement historique.
 *
 * Ce repli n'a plus AUCUN circuit pour l'exercer depuis le 03/08/2026 : « La
 * charade », seule fiche sans cap, a été retirée (jalon 0.H). Il reste parce
 * qu'un tracé pilote fraîchement dessiné n'a pas de cap relevé — mais plus rien
 * en production ne passe par là, et un défaut y dormirait sans se voir.
 */

export interface FinishLineSource {
  finishLineLat: number;
  finishLineLon: number;
  finishLineRadiusM: number;
  /** Cap de la piste au franchissement (degrés, 0 = nord). NULL en base = non relevé. */
  finishLineHeading?: number | null;
  /** Longueur du circuit (km). NULL en base = non renseignée → aucune garde de distance. */
  lengthKm?: number | null;
}

export interface CaptureFinishLine {
  lat: number;
  lon: number;
  /** Mode rayon : rayon du disque. Mode porte : demi-largeur de la porte. */
  radiusM: number;
  /** Cap de franchissement, ou null si non relevé (→ repli mode rayon). */
  headingDeg?: number | null;
  /**
   * Distance minimale (m) entre deux tours comptés, dérivée de la longueur du
   * circuit. Absente si la longueur n'est pas renseignée : on ne devine pas un
   * seuil, on laisse la détection sans garde plutôt que d'en inventer une qui
   * refuserait des tours réels.
   */
  minLapDistanceM?: number;
}

/**
 * Rayon (ou demi-largeur de porte) employé quand le circuit n'en renseigne pas.
 *
 * EXPORTÉE parce qu'elle était recopiée : `lapDetectionRunner` posait 30 pendant
 * qu'on posait 40 ici — deux valeurs pour une seule notion, aux deux bouts de la
 * même chaîne. L'écart ne se voyait pas, l'appelant nominal fournissant toujours
 * un rayon ; c'est exactement le genre d'incohérence qui dort jusqu'au jour où
 * un troisième appelant emprunte le repli.
 */
export const DEFAULT_FINISH_RADIUS_M = 40;

const DEFAULT_RADIUS_M = DEFAULT_FINISH_RADIUS_M;

/**
 * Fraction de la longueur du circuit exigée entre deux tours comptés.
 *
 * ── POURQUOI UN CINQUIÈME, ET PAS LA MOITIÉ ──────────────────────────────────
 *
 * Première valeur posée : 0,5. Une vérification adversariale du même jour l'a
 * condamnée, et le raisonnement est celui-ci.
 *
 * L'odomètre intègre la vitesse, SAUF pendant un trou de données — où il se
 * replie sur la corde entre les deux points qui l'encadrent. Cette corde MINORE
 * la distance réellement parcourue, et elle la minore d'autant plus que le trou
 * est long : sur une boucle, elle est bornée par le diamètre du circuit, quelle
 * que soit la durée de la coupure. Une interruption BLE de quelques minutes
 * pouvait donc faire passer un tour RÉEL sous la barre des 50 %.
 *
 * Et un tour refusé ne disparaît pas proprement : le runner ne déplace pas sa
 * borne de tour, si bien que le franchissement SUIVANT produit un chrono qui
 * couvre DEUX tours. La garde ne perdait pas une donnée, elle en fabriquait une
 * fausse — exactement ce qu'elle existait pour empêcher.
 *
 * Un cinquième garde tout le pouvoir utile et supprime le risque : à l'arrêt,
 * la vitesse Doppler sous la bande morte de 3 km/h fait avancer l'odomètre de
 * ZÉRO — les tours fantômes sont écartés aussi sûrement à 20 % qu'à 50 %. En
 * revanche, refuser un tour réel exigerait désormais de perdre plus de QUATRE
 * CINQUIÈMES de la boucle en trous de données, auquel cas il n'y a plus de tour
 * à sauver.
 *
 * La garde ne peut nuire que dans un sens. On s'en tient loin.
 */
const MIN_LAP_FRACTION = 0.2;

export function captureFinishLineFor(
  c: FinishLineSource | null | undefined
): CaptureFinishLine | undefined {
  if (!c) return undefined;
  const { finishLineLat: lat, finishLineLon: lon } = c;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  // 0/0 = ligne non renseignée (le mapping circuit met 0 par défaut). On ne
  // détecte pas de tours sur une fausse ligne plutôt que d'en inventer.
  if (lat === 0 && lon === 0) return undefined;
  const radiusM =
    Number.isFinite(c.finishLineRadiusM) && c.finishLineRadiusM > 0
      ? c.finishLineRadiusM
      : DEFAULT_RADIUS_M;
  const km = c.lengthKm;
  const minLapDistanceM =
    typeof km === 'number' && Number.isFinite(km) && km > 0
      ? km * 1000 * MIN_LAP_FRACTION
      : undefined;

  const heading = c.finishLineHeading;
  // Cap non relevé → on ne l'invente pas : la clé est simplement absente et la
  // détection reste en mode rayon.
  if (typeof heading !== 'number' || !Number.isFinite(heading)) {
    return { lat, lon, radiusM, minLapDistanceM };
  }
  return { lat, lon, radiusM, headingDeg: heading, minLapDistanceM };
}
