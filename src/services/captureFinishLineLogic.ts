/**
 * Résolution de la ligne d'arrivée pour la détection de tours (pure, testable).
 *
 * La détection de tours (point + rayon, cf. `utils/lapDetection`) n'est fiable
 * que si on lui passe la ligne d'arrivée DU CIRCUIT CHOISI. Sans elle, la capture
 * retombait sur un défaut codé en dur (mauvaises coordonnées) → aucun tour détecté
 * sur Haute Saintonge / Charente. Ce helper fournit la ligne du circuit, ou
 * `undefined` si elle n'est pas renseignée (0/0 ou non finie) — jamais une fausse
 * valeur.
 */

export interface FinishLineSource {
  finishLineLat: number;
  finishLineLon: number;
  finishLineRadiusM: number;
}

export interface CaptureFinishLine {
  lat: number;
  lon: number;
  radiusM: number;
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
  return { lat, lon, radiusM };
}
