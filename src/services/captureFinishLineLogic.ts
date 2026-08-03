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
}

export interface CaptureFinishLine {
  lat: number;
  lon: number;
  /** Mode rayon : rayon du disque. Mode porte : demi-largeur de la porte. */
  radiusM: number;
  /** Cap de franchissement, ou null si non relevé (→ repli mode rayon). */
  headingDeg?: number | null;
}

const DEFAULT_RADIUS_M = 40;

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
  const heading = c.finishLineHeading;
  // Cap non relevé → on ne l'invente pas : la clé est simplement absente et la
  // détection reste en mode rayon.
  if (typeof heading !== 'number' || !Number.isFinite(heading)) {
    return { lat, lon, radiusM };
  }
  return { lat, lon, radiusM, headingDeg: heading };
}
