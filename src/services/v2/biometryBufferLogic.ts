/**
 * Logique PURE du tampon biométrique (BIO-2) — testable sans réseau.
 *
 * Ce module ne contient AUCUN I/O (ni Supabase, ni RN, ni HealthKit) : uniquement
 * le calcul de qualité d'un flux cardiaque, le découpage en lots de vidage
 * idempotents, et une lecture FACTUELLE de tendance de variabilité (HRV).
 * L'I/O — et le canal coach exclusif — vit ailleurs (`biometryService.ts`).
 *
 * DOCTRINE (RGPD art. 9 — donnée de santé). Ce module :
 *   - DÉCRIT des faits (qualité, dispersion), il ne DIAGNOSTIQUE jamais : aucune
 *     alerte auto, aucun jugement. Le coach juge, l'app ne diagnostique pas.
 *   - n'expose qu'un VOCABULAIRE FERMÉ et factuel ('stable' | 'en baisse' | 'en
 *     hausse') pour la tendance : trois constats, jamais une interprétation.
 *   - étant purement local (zéro I/O), il ne peut par construction faire fuiter
 *     aucune donnée de santé vers un canal non-coach.
 *
 * Séparation exigée par le cadre Jest (ts-jest node, pas de rendu RN) : la
 * logique se teste ici en .ts pur.
 */

/** Contact du capteur avec la peau : suffisant, dégradé, ou non supporté. */
export type BioContact = 'ok' | 'poor' | 'unsupported';

/** Échantillon biométrique brut collecté par le capteur (montre / ceinture). */
export interface BioSample {
  /** Horodatage epoch en millisecondes. */
  ts: number;
  /** Fréquence cardiaque instantanée (bpm). */
  hrBpm: number;
  /** Intervalles R-R (ms) rapportés sur cet échantillon (0..n selon le capteur). */
  rrMs: number[];
  /** État du contact peau-capteur au moment de l'échantillon. */
  contact: BioContact;
}

/** Options du calcul de qualité. */
export interface QualityOpts {
  /**
   * Fenêtre attendue en millisecondes. Si fournie (finie, > 0), elle sert de
   * durée de référence pour la densité (prioritaire sur l'étendue des ts).
   */
  windowMs?: number;
  /** Fréquence d'échantillonnage attendue en Hz. Défaut : 1 Hz. */
  expectedHz?: number;
}

/** Fréquence d'échantillonnage attendue par défaut (1 échantillon / seconde). */
export const DEFAULT_EXPECTED_HZ = 1;

/**
 * Demi-largeur de la bande « stable » pour la tendance de variabilité : tant que
 * le RMSSD récent reste à ±10 % du RMSSD de référence, la tendance est neutre.
 */
export const RR_TREND_BAND = 0.1;

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * Qualité d'un flux biométrique, entre 0 et 100, ou `null` si aucun échantillon.
 *
 * Deux facteurs indépendants, multipliés — donc la qualité croît de façon
 * monotone quand l'un OU l'autre s'améliore, sans jamais qu'un facteur ne masque
 * l'autre :
 *
 *  1. CONTACT — part des échantillons dont le contact est « ok ».
 *       contactRatio = nbOk / nbTotal              ∈ [0, 1]
 *     Un contact « poor » ou « unsupported » ne compte pas : un flux entièrement
 *     décroché donne contactRatio = 0 (fait mesuré, pas une valeur inventée).
 *
 *  2. DENSITÉ — combien d'échantillons reçus rapporté à combien attendus sur la
 *     durée de référence, à `expectedHz` (défaut 1 Hz) :
 *       durée      = windowMs/1000 si fournie, sinon (maxTs − minTs)/1000
 *       attendus   = durée × expectedHz
 *       densité    = min(1, nbReçus / attendus)    ∈ [0, 1]
 *     Un flux nominal (≈ expectedHz) donne densité ≈ 1 ; la moitié des
 *     échantillons donne densité ≈ 0,5. Sur-échantillonner ne dépasse pas 1.
 *     Si aucune durée n'est mesurable (fenêtre absente et < 2 ts finis), la
 *     densité vaut 1 par défaut : on ne pénalise pas ce qu'on ne peut mesurer,
 *     la qualité reflète alors le seul contact.
 *
 *  Qualité = round( contactRatio × densité × 100 ), bornée [0, 100].
 *
 * Retourne `null` UNIQUEMENT sur un tableau vide (empty honnête, jamais un 0
 * fabriqué). Un `expectedHz` invalide (non fini, ≤ 0) retombe sur le défaut.
 */
export function qualityFromSamples(samples: BioSample[], opts?: QualityOpts): number | null {
  if (!Array.isArray(samples) || samples.length === 0) return null;

  const total = samples.length;
  let okCount = 0;
  for (const s of samples) {
    if (s.contact === 'ok') okCount++;
  }
  const contactRatio = okCount / total;

  const hzRaw = opts?.expectedHz;
  const expectedHz =
    typeof hzRaw === 'number' && Number.isFinite(hzRaw) && hzRaw > 0 ? hzRaw : DEFAULT_EXPECTED_HZ;

  let spanS = 0;
  const winRaw = opts?.windowMs;
  if (typeof winRaw === 'number' && Number.isFinite(winRaw) && winRaw > 0) {
    spanS = winRaw / 1000;
  } else {
    let min = Infinity;
    let max = -Infinity;
    let finiteCount = 0;
    for (const s of samples) {
      if (Number.isFinite(s.ts)) {
        finiteCount++;
        if (s.ts < min) min = s.ts;
        if (s.ts > max) max = s.ts;
      }
    }
    if (finiteCount >= 2) spanS = (max - min) / 1000;
  }

  const expectedCount = spanS * expectedHz;
  const density = expectedCount > 0 ? clamp01(total / expectedCount) : 1;

  return Math.round(clamp01(contactRatio * density) * 100);
}

/**
 * Découpe un tableau en lots de `chunkSize` éléments, pour un vidage groupé et
 * idempotent (chaque lot est rejouable sans effet de bord côté serveur).
 *
 * Le dernier lot peut être plus petit. Tableau vide → `[]`. `chunkSize` doit
 * être un entier ≥ 1, sinon on lève (contrat de découpage invalide).
 */
export function chunkSamples<T>(samples: T[], chunkSize: number): T[][] {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error('[OXV][biometry] chunkSamples : chunkSize doit être un entier ≥ 1.');
  }
  const out: T[][] = [];
  for (let i = 0; i < samples.length; i += chunkSize) {
    out.push(samples.slice(i, i + chunkSize));
  }
  return out;
}

/**
 * RMSSD (racine de la moyenne des carrés des écarts R-R successifs), mesure de
 * dispersion standard de la variabilité cardiaque. `null` si < 2 intervalles
 * R-R finis et positifs (aucun écart successif exploitable).
 */
function rmssd(rrMs: number[]): number | null {
  if (!Array.isArray(rrMs)) return null;
  const rr = rrMs.filter((v) => Number.isFinite(v) && v > 0);
  if (rr.length < 2) return null;
  let sumSq = 0;
  for (let i = 1; i < rr.length; i++) {
    const d = rr[i] - rr[i - 1];
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / (rr.length - 1));
}

/**
 * Tendance FACTUELLE de la variabilité cardiaque (HRV) entre une fenêtre récente
 * et une fenêtre de référence, dans un vocabulaire FERMÉ à trois constats.
 *
 * On compare le RMSSD récent au RMSSD de référence :
 *   ratio = RMSSD(récent) / RMSSD(référence)
 *     ratio > 1 + bande   → 'en hausse'   (dispersion accrue)
 *     ratio < 1 − bande   → 'en baisse'   (dispersion réduite)
 *     sinon               → 'stable'
 *
 * C'est un CONSTAT, jamais un diagnostic ni un jugement : le module ne dit pas
 * si c'est « bon » ou « mauvais ». Données insuffisantes (< 2 R-R exploitables
 * dans l'une des fenêtres) ou référence sans dispersion (RMSSD = 0, ratio non
 * défini) → 'stable' : on reste neutre, jamais une alerte inventée.
 */
export function rrTrendLabel(
  rrMsRecent: number[],
  rrMsBaseline: number[]
): 'stable' | 'en baisse' | 'en hausse' {
  const recent = rmssd(rrMsRecent);
  const baseline = rmssd(rrMsBaseline);
  if (recent === null || baseline === null || baseline <= 0) return 'stable';

  const ratio = recent / baseline;
  if (ratio > 1 + RR_TREND_BAND) return 'en hausse';
  if (ratio < 1 - RR_TREND_BAND) return 'en baisse';
  return 'stable';
}
