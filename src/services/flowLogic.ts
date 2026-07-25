/**
 * A-FLOW-1 — lecture de la FLUIDITÉ : logique PURE, zéro I/O.
 *
 * Contrat : docs/architecture/A-FLOW-1_flowService_definition.md (définition
 * écrite AVANT le code et validée par le fondateur le 19/07/2026). Les quatre
 * décisions du document sont des VERROUS. Ce fichier pose la FORME et les
 * INVARIANTS ; le CALAGE des paramètres se fait sur les données RÉELLES (smoke
 * test / distribution Beltoise), jamais sur du synthétique — c'est pourquoi tout
 * coefficient est exposé et surchargeable, pas enfoui.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VERROU 1 — GRANDEUR : le jerk IMU, dérivée de l'accélération, en g/s, calculé
 * sur le dt RÉEL entre trames (`elapsedMs`), jamais sur un pas supposé. Une
 * cadence nominale de 25 Hz n'est pas une cadence garantie : supposer 40 ms
 * fabriquerait un jerk faux à chaque irrégularité de capture.
 *
 * VERROU 2 — NORMALISATION PAR LA SÉVÉRITÉ (le point dur). La fluidité n'est PAS
 * le jerk absolu, c'est le jerk INATTENDU. Le jerk absolu confond deux choses :
 * le pilote BRUSQUE (à-coups de commande) et le pilote RAPIDE sur circuit
 * exigeant (gros freinage, mise en appui, changement d'appui — transitions
 * violentes mais PHYSIQUEMENT JUSTIFIÉES). Mesurer le jerk absolu punirait les
 * rapides et récompenserait les lents : c'est faux, et c'est un jugement déguisé
 * en mesure — anti-doctrine. La sortie décrit donc le jerk RÉSIDUEL : la part de
 * discontinuité que la géométrie de la trajectoire à cet instant (vitesse, |g|
 * soutenu) N'EXPLIQUE PAS. Voir `explainedJerkGPerS` ci-dessous.
 *
 * VERROU 3 — ANTI-BRUIT causal, déterministe, fenêtre EXPOSÉE. Le jerk est une
 * dérivée : il amplifie le bruit IMU. D'où un lissage passe-bas court AVANT
 * dérivation, qui (a) ne regarde QUE le passé — une séance reste recalculable à
 * l'identique et un futur temps réel n'est pas bloqué ; (b) est déterministe et
 * rejouable ; (c) dont la fenêtre est un paramètre d'appel (`smoothingWindowMs`),
 * réglable après le smoke test sans rouvrir le cœur du service.
 *
 * VERROU 4 — SORTIE SANS VERDICT NI SEUIL. Trois formes factuelles seulement :
 * distribution, trace temporelle, intensité par segment. Le nombre unique
 * éventuel est une MESURE NOMMÉE AVEC UNITÉ (« variation moyenne d'accélération :
 * 1,8 g/s »), jamais un nombre-verdict sans unité, jamais une échelle 0-100.
 * AUCUN seuil de jugement en dur : la frontière du « fluide » est REPORTÉE au
 * post-piste, elle émergera des percentiles réels, elle ne se décrète pas. Aucune
 * échelle qualitative n'est produite ici, et aucune couleur.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Règle de données du dépôt : absence => vide honnête. Une trame incomplète est
 * exclue, jamais complétée par un 0 (un 0 de g est une MESURE, pas une absence),
 * jamais par une valeur type. Une séance sans assez de trames valides ne produit
 * rien plutôt qu'un chiffre inventé.
 */

import type { SessionFrame } from '@/services/sessionTelemetryMapping';

// Ré-export du contrat d'entrée : la convention d'axes reste définie à un seul
// endroit (`sessionTelemetryMapping`), les consommateurs de flow n'ont pas à
// connaître deux chemins d'import.
export type { SessionFrame } from '@/services/sessionTelemetryMapping';

/* ────────────────────────────── Paramètres exposés ───────────────────────── */

/**
 * Fenêtre de lissage causal par défaut, en millisecondes (VERROU 3).
 *
 * 160 ms ≈ 4 trames à 25 Hz : assez court pour ne pas effacer une vraie
 * transition de commande (une mise en appui s'établit en ~200 ms), assez long
 * pour que la dérivée ne mesure plus surtout le bruit capteur. Valeur PROVISOIRE :
 * le niveau de bruit réel du boîtier n'est connu qu'après le smoke test, c'est lui
 * qui tranchera. D'ici là on ne fige rien — d'où le paramètre d'appel.
 */
export const DEFAULT_SMOOTHING_WINDOW_MS = 160;

/**
 * Écart maximal admis entre deux trames pour dériver, en millisecondes.
 *
 * Au-delà, l'intervalle est un TROU de capture (décrochage BLE, perte de fix) et
 * non une transition de conduite : la différence de g qui l'enjambe ne décrit
 * aucun geste du pilote. On ne fabrique pas de jerk sur un trou — la paire sort du
 * calcul. 250 ms ≈ 6 trames manquantes à 25 Hz ; exposé pour d'autres cadences.
 *
 * Ce n'est PAS un seuil de jugement (rien n'est qualifié ici) : c'est un critère
 * de VALIDITÉ de capture.
 */
export const DEFAULT_MAX_GAP_MS = 250;

/**
 * Écart MINIMAL admis entre deux trames pour dériver, en ms.
 *
 * Le jerk est un quotient par dt : un dt anormalement petit ne mesure pas un
 * geste, il EXPLOSE le résultat. Et ce cas n'est pas théorique — la chaîne
 * d'écriture du dépôt produit elle-même des trames espacées de 1 ms, ce qui
 * multiplierait le jerk par vingt à quarante et injecterait des pics purement
 * artificiels dans la distribution.
 *
 * 20 ms ≈ la moitié d'une période à 25 Hz : on accepte une trame un peu en
 * avance, on refuse un doublon d'horodatage déguisé.
 */
export const DEFAULT_MIN_GAP_MS = 20;

/**
 * Fenêtre causale sur laquelle on lit le |g| SOUTENU du contexte, en ms.
 *
 * 600 ms ≈ l'ordre de grandeur d'une phase d'appui : assez large pour que le
 * niveau de charge d'un virage soit établi, assez étroite pour ne pas traîner la
 * charge d'un virage sur la ligne droite suivante. À caler sur le réel.
 */
export const DEFAULT_SEVERITY_WINDOW_MS = 600;

/** Largeur de bin par défaut de la distribution, en g/s. Résolution de lecture. */
export const DEFAULT_BIN_WIDTH_G_PER_S = 0.5;

/**
 * Garde-fou d'allocation : au-delà, la largeur de bin demandée est absurde
 * (résolution qui n'existe pas dans la mesure) et on revient à la résolution par
 * défaut plutôt que d'allouer des millions de cases vides.
 */
const MAX_DISTRIBUTION_BINS = 10_000;

/* ─────────────────────────── VERROU 2 — la sévérité ──────────────────────── */

/**
 * Contexte géométrique d'une trame — ce qui, à cet instant, rend une transition
 * d'accélération PHYSIQUEMENT ATTENDUE.
 */
export interface FlowSeverityContext {
  /** Vitesse RÉELLE de la trame (km/h). Mesurée, jamais supposée. */
  speedKmh: number;
  /** |g| soutenu sur la fenêtre causale (magnitude lissée maximale), en g. */
  gSustained: number;
}

/**
 * Coefficients de la fonction de sévérité — À CALER SUR LE RÉEL.
 *
 * Ils ne sont pas des constantes de vérité : ce sont les trois grandeurs
 * physiques que la distribution réelle (smoke test, puis plusieurs pilotes)
 * viendra régler. Ils sont exposés pour être surchargés sans rouvrir ce fichier.
 */
export interface FlowSeverityWeights {
  /**
   * Plancher de variation d'accélération (g/s) qu'on n'attribue à aucun geste :
   * le résidu de bruit capteur qui survit au lissage. À mesurer sur boîtier réel
   * (un boîtier au repos donne directement cette valeur).
   */
  noiseFloorGPerS: number;
  /**
   * Amplitude de transfert de charge (g) légitimement disponible même quand la
   * charge passée est nulle : au bout d'une ligne droite, le pilote VA freiner
   * fort — l'absence de charge dans le passé immédiat ne rend pas la transition
   * inattendue. Ordre de grandeur de l'enveloppe d'adhérence. À caler par
   * véhicule / plateau.
   */
  loadAmplitudeG: number;
  /**
   * Longueur caractéristique (m) sur laquelle une transition de charge s'établit
   * — la distance d'application des freins, de mise en appui, de changement
   * d'appui. C'est LE paramètre qui protège les pilotes rapides.
   * À caler sur le réel (elle dépend du circuit et du véhicule).
   */
  transitionLengthM: number;
  /**
   * PLAFOND du budget expliqué (g/s) — la variation d'accélération maximale
   * qu'une géométrie de trajectoire peut légitimement imposer.
   *
   * Sans ce plafond, le budget croît linéairement avec la vitesse et finit par
   * dépasser tout jerk atteignable : le résiduel devient identiquement nul en
   * vitesse, ce qui n'est pas une mesure de fluidité mais une exonération
   * automatique — le symétrique exact du défaut que le verrou 2 corrige.
   * À caler sur le réel : c'est le percentile haut du jerk observé sur des
   * transitions incontestablement propres.
   */
  maxExplainedGPerS: number;
}

/**
 * Valeurs de départ, PROVISOIRES par construction (§2.1 du contrat : la forme est
 * posée ici, la pondération se règle sur les données réelles).
 *
 * Ordre de grandeur retenu pour `transitionLengthM` : un freinage appuyé
 * s'établit en ~0,2 s ; à 55 m/s cela couvre ~11 m. D'où 12 m comme point de
 * départ, à confirmer ou corriger devant la distribution mesurée.
 */
export const DEFAULT_SEVERITY_WEIGHTS: FlowSeverityWeights = {
  noiseFloorGPerS: 0.3,
  loadAmplitudeG: 1.0,
  transitionLengthM: 12,
  // PROVISOIRE, comme les trois autres. Ordre de grandeur : une transition
  // franche mais propre établit ~1,5 g en ~0,25 s, soit ~6 g/s. Au-delà, la
  // géométrie n'explique plus — c'est le geste. À remplacer par le percentile
  // haut observé sur des transitions incontestablement propres (post-piste).
  maxExplainedGPerS: 6,
};

/**
 * FONCTION DE SÉVÉRITÉ — le budget de jerk que la géométrie EXPLIQUE à cet
 * instant, exprimé dans la même unité que la mesure (g/s).
 *
 * POURQUOI CETTE FORME. Une transition de charge d'amplitude Δg ne s'établit pas
 * en un temps arbitraire : elle s'établit sur une LONGUEUR de piste (la zone
 * d'application des freins, la zone de mise en appui). À la vitesse v, cette
 * longueur L est parcourue en τ = L / v secondes, donc la transition produit un
 * jerk de l'ordre de Δg / τ = Δg · v / L. D'où :
 *
 *     explained = plancherBruit + (amplitudeDeBase + |g| soutenu) · v / L
 *
 * Deux conséquences, toutes deux voulues :
 *   — la sévérité CROÎT avec la vitesse : à 210 km/h le même geste dispose de
 *     trois fois moins de temps qu'à 70 km/h pour la même portion de piste. Le
 *     pilote rapide n'est pas puni pour aller vite ;
 *   — la sévérité CROÎT avec le |g| soutenu : plus la voiture est chargée, plus
 *     la charge à établir puis relâcher est grande, plus le jerk attendu est fort.
 *
 * Le RÉSIDUEL (ce que le service publie) est la part du jerk qui EXCÈDE ce budget.
 * Un pic cohérent avec une vraie transition physique n'en laisse presque rien ; un
 * à-coup sans justification géométrique laisse presque tout.
 *
 * Renvoie `null` quand le contexte n'est pas calculable (entrée non finie, vitesse
 * négative, longueur caractéristique nulle) : sans contexte, la part inexpliquée
 * ne se calcule pas et l'appelant doit écarter la trame. On ne renvoie surtout pas
 * 0, qui ferait passer TOUT le jerk pour inexpliqué — punir sur une donnée
 * manquante serait inventer.
 */
export function explainedJerkGPerS(
  context: FlowSeverityContext,
  weights: FlowSeverityWeights = DEFAULT_SEVERITY_WEIGHTS
): number | null {
  if (context === null || typeof context !== 'object') return null;
  const { speedKmh, gSustained } = context;
  if (!Number.isFinite(speedKmh) || !Number.isFinite(gSustained)) return null;
  if (speedKmh < 0 || gSustained < 0) return null;

  const { noiseFloorGPerS, loadAmplitudeG, transitionLengthM, maxExplainedGPerS } = weights;
  if (!Number.isFinite(noiseFloorGPerS) || noiseFloorGPerS < 0) return null;
  if (!Number.isFinite(loadAmplitudeG) || loadAmplitudeG < 0) return null;
  if (!Number.isFinite(transitionLengthM) || transitionLengthM <= 0) return null;
  if (!Number.isFinite(maxExplainedGPerS) || maxExplainedGPerS <= 0) return null;

  const speedMs = speedKmh / 3.6;
  const brut = noiseFloorGPerS + ((loadAmplitudeG + gSustained) * speedMs) / transitionLengthM;

  // PLAFOND — sans lui, le budget croît linéairement avec la vitesse SANS LIMITE
  // et finit par dépasser tout jerk réellement atteignable : au-delà d'environ
  // 80 km/h le résiduel devenait identiquement 0. Ce zéro-là n'était pas un
  // constat de fluidité, c'était une valeur FABRIQUÉE — et il exonérait
  // exactement les pilotes rapides que le verrou 2 voulait cesser de PUNIR. La
  // correction d'une injustice ne doit pas en installer l'inverse : au-dessus
  // d'un certain niveau, plus aucune géométrie n'explique la discontinuité.
  const explained = Math.min(brut, maxExplainedGPerS);
  return Number.isFinite(explained) ? explained : null;
}

/* ────────────────────────────── Trace temporelle ─────────────────────────── */

/** Options de calcul — tout ce qui se règlera sur le réel est ici (VERROU 3). */
export interface FlowOptions {
  /** Fenêtre de lissage causal, en ms. Paramètre EXPOSÉ (VERROU 3). 0 = aucun lissage. */
  smoothingWindowMs?: number;
  /** Écart maximal admis entre deux trames pour dériver, en ms (trou de capture). */
  maxGapMs?: number;
  /** Écart MINIMAL admis, en ms : sous ce seuil, dériver fabrique un pic (cf. DEFAULT_MIN_GAP_MS). */
  minGapMs?: number;
  /** Fenêtre causale de lecture du |g| soutenu, en ms. */
  severityWindowMs?: number;
  /** Coefficients de la fonction de sévérité (VERROU 2), à caler sur le réel. */
  severityWeights?: FlowSeverityWeights;
}

/**
 * Un point de la trace : le jerk BRUT et le jerk RÉSIDUEL, au temps de la trame.
 *
 * Les deux sont publiés : le brut pour la TRAÇABILITÉ (§1 du contrat — un pilote
 * doit pouvoir reconstruire le chiffre depuis les trames), le résiduel parce que
 * c'est lui qui décrit la fluidité (VERROU 2).
 */
export interface FlowPoint {
  /** Temps de la trame d'arrivée de la dérivée, en ms depuis le début de séance. */
  elapsedMs: number;
  /** Magnitude du jerk lissé, en g/s. */
  jerkMagnitude: number;
  /** Part du jerk NON expliquée par la sévérité, en g/s. Jamais négative. */
  jerkResidual: number;
}

/** Trame retenue pour le calcul : toutes ses grandeurs utiles sont mesurées. */
interface UsableFrame {
  elapsedMs: number;
  gLat: number;
  gLong: number;
  speedKmh: number;
}

/**
 * Ne garde que les trames exploitables, dans l'ordre de capture.
 *
 * Sont écartées, SANS être remplacées :
 *   — `elapsedMs` non fini : la trame n'a pas de place dans le temps ;
 *   — `gLat` / `gLong` null ou non fini : le geste n'est pas mesuré. Y mettre 0
 *     fabriquerait une accélération nulle, donc un faux jerk de part et d'autre ;
 *   — `speedKmh` null ou non fini : sans vitesse, la sévérité (VERROU 2) n'est pas
 *     calculable, et le résiduel non plus. Publier le jerk brut à la place serait
 *     revenir au jerk absolu que le contrat interdit ;
 *   — trame non strictement postérieure à la précédente retenue (doublon,
 *     désordre de capture). On l'écarte plutôt que de réordonner : réordonner
 *     inventerait une chronologie que la capture n'a pas fournie.
 */
function usableFrames(frames: readonly SessionFrame[]): UsableFrame[] {
  const kept: UsableFrame[] = [];
  for (const frame of frames) {
    if (frame === null || typeof frame !== 'object') continue;
    const { elapsedMs, gLat, gLong, speedKmh } = frame;
    if (!Number.isFinite(elapsedMs)) continue;
    if (gLat === null || !Number.isFinite(gLat)) continue;
    if (gLong === null || !Number.isFinite(gLong)) continue;
    if (speedKmh === null || !Number.isFinite(speedKmh)) continue;
    if (kept.length > 0 && elapsedMs <= kept[kept.length - 1].elapsedMs) continue;
    kept.push({ elapsedMs, gLat, gLong, speedKmh });
  }
  return kept;
}

/**
 * Indice de début de la fenêtre CAUSALE ouverte `(t − windowMs, t]` finissant à
 * `end`. Ne regarde jamais au-delà de `end` : c'est ce qui rend une séance
 * rejouable à l'identique et un futur temps réel possible.
 *
 * `windowMs <= 0` renvoie `end` : la fenêtre se réduit à la trame courante, donc
 * aucun lissage. C'est un réglage légitime (mesurer le jerk non filtré), pas un
 * cas d'erreur.
 */
function causalWindowStart(times: readonly number[], end: number, windowMs: number): number {
  if (!(windowMs > 0)) return end;
  const oldestExcluded = times[end] - windowMs;
  let start = end;
  while (start > 0 && times[start - 1] > oldestExcluded) start -= 1;
  return start;
}

/**
 * Trace temporelle du jerk sur une suite de trames.
 *
 * Chaîne de calcul, dans cet ordre exact :
 *   1. sélection des trames exploitables (aucune fabrication de valeur) ;
 *   2. lissage CAUSAL de gLat/gLong sur la fenêtre passée bornée en TEMPS RÉEL
 *      (`smoothingWindowMs`), pas sur un nombre de trames supposé ;
 *   3. lecture du |g| soutenu sur la fenêtre causale de sévérité ;
 *   4. dérivation sur le dt RÉEL entre deux trames retenues consécutives, les
 *      paires invalides (dt ≤ 0, non fini, trou de capture) étant écartées ;
 *   5. soustraction du budget expliqué par la sévérité → résiduel, borné à 0.
 *
 * Le point d'indice `i` ne dépend QUE des trames d'indice ≤ `i` : modifier une
 * trame future ne change aucun point antérieur (invariant testé).
 *
 * Les toutes premières trames ont une fenêtre de lissage partielle — c'est le prix
 * assumé de la causalité, et non un défaut : aucune valeur n'est extrapolée pour
 * « remplir » la fenêtre.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LIMITE CONNUE DU MODÈLE DE SÉVÉRITÉ — à trancher sur données réelles.
 *
 * `gSustained` est lu sur le |g| MESURÉ, c'est-à-dire sur le signal dont on
 * mesure précisément la discontinuité. La boucle est donc partiellement fermée :
 * une brutalité fait monter le |g|, donc le budget censé l'expliquer. Et comme
 * on prend un MAXIMUM sur la fenêtre, cette indulgence est MÉMORISÉE pendant
 * toute sa durée — soit exactement l'intervalle où un pilote brusque enchaîne
 * ses corrections. Le mécanisme est donc le moins sensible là où il devrait
 * l'être le plus.
 *
 * Le maximum reste préféré à la moyenne : une moyenne serait tirée vers le bas
 * par la phase d'approche, sous-estimerait la transition légitime et gonflerait
 * le résiduel du pilote rapide — ce que le verrou 2 interdit d'abord. On a donc
 * choisi le défaut le moins grave, pas un modèle satisfaisant.
 *
 * La sortie non circulaire est la GÉOMÉTRIE au sens propre : la courbure de la
 * trajectoire déduite de `lat`/`lon` et de la vitesse (accélération latérale
 * attendue = v²/R), indépendante de l'IMU. Elle n'est pas implémentée ici : la
 * courbure est une dérivée SECONDE de la position GPS, très bruitée à 25 Hz, et
 * son lissage ne se règle pas sur du synthétique. Le contrat (§2.1) prévoit
 * exactement cela — « le calage fin se fait sur le RÉEL, jamais sur du
 * synthétique ». Tant que ce calage n'a pas eu lieu, le résiduel décrit une
 * tendance, il ne tranche pas un cas individuel.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function computeFlowTrace(frames: readonly SessionFrame[], opts?: FlowOptions): FlowPoint[] {
  if (!Array.isArray(frames) || frames.length < 2) return [];

  const smoothingWindowMs = Number.isFinite(opts?.smoothingWindowMs)
    ? (opts?.smoothingWindowMs as number)
    : DEFAULT_SMOOTHING_WINDOW_MS;
  const maxGapMs =
    Number.isFinite(opts?.maxGapMs) && (opts?.maxGapMs as number) > 0
      ? (opts?.maxGapMs as number)
      : DEFAULT_MAX_GAP_MS;
  const minGapMs =
    Number.isFinite(opts?.minGapMs) && (opts?.minGapMs as number) >= 0
      ? (opts?.minGapMs as number)
      : DEFAULT_MIN_GAP_MS;
  const severityWindowMs = Number.isFinite(opts?.severityWindowMs)
    ? (opts?.severityWindowMs as number)
    : DEFAULT_SEVERITY_WINDOW_MS;
  const weights = opts?.severityWeights ?? DEFAULT_SEVERITY_WEIGHTS;

  const usable = usableFrames(frames);
  if (usable.length < 2) return [];

  const times = usable.map((f) => f.elapsedMs);

  // Étape 2 — lissage causal. Moyenne simple sur les trames de la fenêtre passée :
  // la fenêtre est bornée en TEMPS, donc une capture irrégulière n'élargit pas
  // silencieusement le filtre. Recalculée trame par trame (et non par somme
  // glissante) pour rester exactement reproductible.
  const smoothedLat = new Array<number>(usable.length);
  const smoothedLong = new Array<number>(usable.length);
  for (let i = 0; i < usable.length; i += 1) {
    const start = causalWindowStart(times, i, smoothingWindowMs);
    let sumLat = 0;
    let sumLong = 0;
    for (let j = start; j <= i; j += 1) {
      sumLat += usable[j].gLat;
      sumLong += usable[j].gLong;
    }
    const count = i - start + 1;
    smoothedLat[i] = sumLat / count;
    smoothedLong[i] = sumLong / count;
  }

  // Étape 3 — |g| soutenu : le MAXIMUM de la magnitude lissée sur la fenêtre
  // causale de sévérité. Un maximum, et non une moyenne : « soutenu » décrit le
  // niveau de charge auquel la voiture travaille dans cette phase ; une moyenne
  // serait tirée vers le bas par l'approche et sous-estimerait la transition
  // légitime — donc gonflerait artificiellement le résiduel du pilote rapide.
  const sustained = new Array<number>(usable.length);
  for (let i = 0; i < usable.length; i += 1) {
    const start = causalWindowStart(times, i, severityWindowMs);
    let maxMagnitude = 0;
    for (let j = start; j <= i; j += 1) {
      const magnitude = Math.hypot(smoothedLat[j], smoothedLong[j]);
      if (magnitude > maxMagnitude) maxMagnitude = magnitude;
    }
    sustained[i] = maxMagnitude;
  }

  // Étapes 4 et 5 — dérivation sur dt réel, puis retrait du budget expliqué.
  const points: FlowPoint[] = [];
  for (let i = 1; i < usable.length; i += 1) {
    const gapMs = times[i] - times[i - 1];
    // Borné DES DEUX CÔTÉS. En haut : un trou de capture ne se dérive pas. En
    // bas : un dt minuscule n'est pas un geste rapide, c'est un artefact
    // d'horodatage, et diviser par lui fabriquerait un pic qui n'a pas eu lieu.
    if (!Number.isFinite(gapMs) || gapMs < minGapMs || gapMs > maxGapMs) continue;

    const dt = gapMs / 1000;
    const jerkLat = (smoothedLat[i] - smoothedLat[i - 1]) / dt;
    const jerkLong = (smoothedLong[i] - smoothedLong[i - 1]) / dt;
    const jerkMagnitude = Math.hypot(jerkLat, jerkLong);
    if (!Number.isFinite(jerkMagnitude)) continue;

    const explained = explainedJerkGPerS(
      { speedKmh: usable[i].speedKmh, gSustained: sustained[i] },
      weights
    );
    if (explained === null) continue;

    points.push({
      elapsedMs: times[i],
      jerkMagnitude,
      // Jamais négatif : « expliqué en excès » ne veut rien dire, et un résiduel
      // négatif se lirait comme un crédit de fluidité — une note déguisée.
      jerkResidual: Math.max(0, jerkMagnitude - explained),
    });
  }

  return points;
}

/* ──────────────────────────────── Distribution ───────────────────────────── */

/** Canal lu par la distribution : la part inexpliquée (défaut) ou le jerk brut. */
export type FlowChannel = 'residual' | 'magnitude';

/** Une case d'histogramme : borne basse en g/s, effectif brut. */
export interface FlowBin {
  /** Borne inférieure de la case, en g/s (case fermée à gauche). */
  binStart: number;
  /** Nombre de points tombés dans la case. Un effectif, pas une proportion. */
  count: number;
}

function channelValue(point: FlowPoint, channel: FlowChannel): number {
  return channel === 'magnitude' ? point.jerkMagnitude : point.jerkResidual;
}

/**
 * Distribution (histogramme) du jerk sur un ensemble de points — « où se
 * concentre la variation d'accélération ». C'est une FORME, pas un verdict :
 * aucune case n'est qualifiée, aucune n'est colorée, aucun seuil ne la coupe.
 *
 * Le canal par défaut est le RÉSIDUEL (VERROU 2 : la sortie décrit le jerk
 * inattendu). Le canal `magnitude` reste disponible pour la traçabilité — il
 * permet de retrouver la grandeur brute mesurée.
 *
 * Les cases renvoyées sont CONTIGUËS de 0 au maximum observé, effectifs nuls
 * compris : un histogramme troué se lirait comme une absence de mesure alors que
 * c'est une absence de valeur dans cette plage. Liste vide → `[]` (vide honnête).
 */
export function jerkDistribution(
  points: readonly FlowPoint[],
  binWidth: number = DEFAULT_BIN_WIDTH_G_PER_S,
  channel: FlowChannel = 'residual'
): FlowBin[] {
  if (!Array.isArray(points) || points.length === 0) return [];

  let width = Number.isFinite(binWidth) && binWidth > 0 ? binWidth : DEFAULT_BIN_WIDTH_G_PER_S;

  const values: number[] = [];
  for (const point of points) {
    if (point === null || typeof point !== 'object') continue;
    const value = channelValue(point, channel);
    if (!Number.isFinite(value) || value < 0) continue;
    values.push(value);
  }
  if (values.length === 0) return [];

  let maxValue = 0;
  for (const value of values) if (value > maxValue) maxValue = value;

  // Résolution absurde (largeur infime devant l'étendue) : on revient à la
  // résolution par défaut plutôt que d'allouer un histogramme ingérable.
  // Le garde-fou doit ÉLARGIR le bin, pas revenir à la valeur par défaut : en
  // appel nominal `width` VAUT déjà cette valeur par défaut, et le repli était
  // donc un no-op — la protection ne protégeait rien. On calcule la largeur
  // minimale qui tient dans le budget de cases.
  if (Math.floor(maxValue / width) + 1 > MAX_DISTRIBUTION_BINS) {
    width = maxValue / (MAX_DISTRIBUTION_BINS - 1);
  }
  if (!Number.isFinite(width) || width <= 0) return [];

  const binCount = Math.floor(maxValue / width) + 1;
  const bins: FlowBin[] = [];
  for (let k = 0; k < binCount; k += 1) bins.push({ binStart: k * width, count: 0 });
  for (const value of values) {
    const index = Math.min(Math.floor(value / width), binCount - 1);
    bins[index].count += 1;
  }
  return bins;
}

/* ───────────────────────────── Intensité par segment ─────────────────────── */

/** Bornes temporelles d'un segment de tour (virage, ligne droite). */
export interface FlowSegment {
  startMs: number;
  endMs: number;
  label?: string;
}

/** Intensité mesurée sur un segment. `null` quand rien n'a été mesuré. */
export interface FlowSegmentIntensity {
  label: string | null;
  startMs: number;
  endMs: number;
  /** Médiane du jerk résiduel du segment, en g/s. `null` si aucun point. */
  medianResidual: number | null;
  /** Nombre de points retenus — la densité de preuve derrière la médiane. */
  pointCount: number;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Intensité du jerk résiduel par segment de tour — la matière du calque
 * Constellation lié.
 *
 * Médiane et non moyenne : un unique pic (un vibreur, une bosse) déplacerait la
 * moyenne du segment entier et raconterait un segment agité qui ne l'était pas.
 * La médiane décrit le niveau ordinaire du segment ; le pic reste visible dans la
 * trace et la distribution, à sa place.
 *
 * Bornes DEMI-OUVERTES `[startMs, endMs)` : des segments contigus ne comptent
 * jamais deux fois le même point.
 *
 * Un segment sans point exploitable (segment vide, bornes non finies, `endMs`
 * antérieur à `startMs`) est RENVOYÉ quand même, avec `medianResidual: null` et
 * `pointCount: 0` — le segment existe, il n'a simplement rien à dire. Le faire
 * disparaître laisserait croire qu'il n'a pas été parcouru ; lui donner 0
 * laisserait croire qu'il a été parfaitement lisse.
 */
export function segmentIntensity(
  points: readonly FlowPoint[],
  segments: readonly FlowSegment[]
): FlowSegmentIntensity[] {
  if (!Array.isArray(segments) || segments.length === 0) return [];
  const safePoints = Array.isArray(points) ? points : [];

  return segments.map((segment) => {
    const label = typeof segment?.label === 'string' ? segment.label : null;
    const startMs = segment?.startMs;
    const endMs = segment?.endMs;

    const bornesValides = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;

    const residuals: number[] = [];
    if (bornesValides) {
      for (const point of safePoints) {
        if (point === null || typeof point !== 'object') continue;
        if (!Number.isFinite(point.elapsedMs)) continue;
        if (point.elapsedMs < startMs || point.elapsedMs >= endMs) continue;
        if (!Number.isFinite(point.jerkResidual)) continue;
        residuals.push(point.jerkResidual);
      }
    }

    return {
      label,
      startMs,
      endMs,
      medianResidual: median(residuals),
      pointCount: residuals.length,
    };
  });
}

/* ───────────────────────── Mesure unique, nommée, en g/s ─────────────────── */

/**
 * Variation moyenne d'accélération INEXPLIQUÉE, en g/s.
 *
 * C'est le seul nombre unique que ce module accepte de produire, et il obéit à la
 * règle du VERROU 4 : une grandeur physique NOMMÉE, avec son UNITÉ dans le nom de
 * la fonction, reconstructible depuis les trames. Il ne se transforme pas en
 * échelle, ne se compare pas entre pilotes, et n'est adossé à aucun seuil : dire
 * « 1,8 g/s » est un constat, dire « 78 » serait un verdict.
 *
 * Renvoie `null` sur données insuffisantes — jamais 0. Un 0 se lirait comme une
 * conduite parfaitement continue, ce qui serait exactement le contraire de la
 * vérité (on n'a rien mesuré).
 */
export function meanResidualGPerS(points: readonly FlowPoint[]): number | null {
  if (!Array.isArray(points) || points.length === 0) return null;

  let sum = 0;
  let count = 0;
  for (const point of points) {
    if (point === null || typeof point !== 'object') continue;
    if (!Number.isFinite(point.jerkResidual)) continue;
    sum += point.jerkResidual;
    count += 1;
  }
  if (count === 0) return null;

  const mean = sum / count;
  return Number.isFinite(mean) ? mean : null;
}
