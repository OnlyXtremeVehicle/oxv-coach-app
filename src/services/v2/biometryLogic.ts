/**
 * Logique PURE de la biométrie (BE-1, MISSION A) — testable sans réseau.
 *
 * Ce module ne contient AUCUN I/O Supabase : uniquement le calcul de qualité
 * d'un échantillonnage cardiaque et les utilitaires de découpage/normalisation.
 * L'I/O vit dans `biometryService.ts`. Séparation exigée par le cadre Jest
 * (ts-jest node, pas de rendu RN) : la logique se teste ici en .ts pur.
 */

/** Seuil au-delà duquel un intervalle entre deux battements compte comme un « trou ». */
export const GAP_THRESHOLD_S = 10;

/** Taille de lot par défaut pour les écritures groupées (upsert). */
export const DEFAULT_CHUNK_SIZE = 500;

/** Échantillon minimal manipulé par la logique de qualité. */
export interface QualitySample {
  /** Horodatage : epoch millisecondes (number) ou chaîne ISO 8601 (string). */
  ts: number | string;
  /** Fréquence cardiaque instantanée (bpm). */
  hr: number;
}

/**
 * Normalise un horodatage vers un nombre de millisecondes epoch.
 * `number` → tel quel ; `string` → `Date.parse` (NaN si illisible, filtré en amont).
 */
export function toMillis(ts: number | string): number {
  return typeof ts === 'number' ? ts : Date.parse(ts);
}

/**
 * Découpe un tableau en lots de `size` éléments (500 par défaut).
 * Utilisé pour l'upsert par paquets (évite les requêtes géantes).
 */
export function chunk<T>(arr: T[], size: number = DEFAULT_CHUNK_SIZE): T[][] {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error('[OXV][biometry] chunk : la taille de lot doit être un entier > 0.');
  }
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * Qualité d'un échantillonnage cardiaque, entre 0 et 100.
 *
 * Deux facteurs indépendants, multipliés :
 *
 *  1. DENSITÉ — combien d'échantillons on a reçus rapporté à combien on en
 *     attendait sur la durée couverte.
 *       spanS         = (dernier ts − premier ts) en secondes
 *       attendus      = spanS × expectedHz
 *       densité       = min(1, nbÉchantillons / attendus)
 *     Un flux nominal (≈ expectedHz) donne densité ≈ 1 ; la moitié des
 *     échantillons donne densité ≈ 0,5.
 *
 *  2. COUVERTURE — pénalité pour les « trous » (capteur décroché, hors portée).
 *     On somme, pour chaque intervalle entre battements consécutifs dépassant
 *     GAP_THRESHOLD_S (10 s), le temps EXCÉDENTAIRE (durée − seuil). Ce total
 *     rapporté à la durée couverte donne la fraction perdue :
 *       pénalité      = min(1, Σ max(0, intervalle − 10 s) / spanS)
 *       couverture    = 1 − pénalité
 *     Un trou de 15 s pénalise donc 5 s de couverture ; des intervalles ≤ 10 s
 *     (échantillonnage clairsemé mais régulier) ne pénalisent rien — seule la
 *     densité les capte.
 *
 *  Qualité = round( densité × couverture × 100 ), bornée [0, 100].
 *
 * Retourne 0 si : tableau vide ou < 2 échantillons, expectedHz ≤ 0, ou durée
 * couverte nulle (tous les ts identiques) — cas où la qualité n'est pas définissable.
 */
export function computeQuality(samples: QualitySample[], expectedHz: number): number {
  if (!Array.isArray(samples) || samples.length < 2) return 0;
  if (!Number.isFinite(expectedHz) || expectedHz <= 0) return 0;

  const times = samples
    .map((s) => toMillis(s.ts))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (times.length < 2) return 0;

  const spanS = (times[times.length - 1] - times[0]) / 1000;
  if (spanS <= 0) return 0;

  const expectedCount = spanS * expectedHz;
  const density = clamp01(times.length / expectedCount);

  let gapLossS = 0;
  for (let i = 1; i < times.length; i++) {
    const intervalS = (times[i] - times[i - 1]) / 1000;
    if (intervalS > GAP_THRESHOLD_S) gapLossS += intervalS - GAP_THRESHOLD_S;
  }
  const coverage = 1 - clamp01(gapLossS / spanS);

  return Math.round(clamp01(density * coverage) * 100);
}
