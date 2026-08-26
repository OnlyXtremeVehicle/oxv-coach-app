/**
 * SYNCHRONISATION VIDÉO — le décalage ET l'erreur de ce décalage. Logique PURE.
 *
 * M24. Une vidéo embarquée et une trace de mesure ont deux horloges. Les
 * superposer demande un décalage. Le donner seul serait malhonnête : un
 * décalage sans son erreur se lit comme une certitude, et il n'y en a aucune.
 * Ce module rend donc TOUJOURS les deux — et quand il ne peut rien caler, il
 * le dit au lieu de rendre zéro.
 *
 * ===========================================================================
 * LA CONVENTION DE SIGNE, ÉCRITE UNE FOIS
 * ===========================================================================
 *
 *     instantMesure(ms) = positionDansLaVideo(ms) + offsetMs
 *
 * `offsetMs` est donc l'instant de mesure qui correspond à la PREMIÈRE image.
 * Il peut être négatif : la caméra tourne souvent avant que la capture parte.
 * C'est exactement la convention de `video_overlays.offset_ms` (entier signé,
 * NOT NULL), pour qu'aucune traduction ne s'intercale entre le calcul et la
 * base.
 *
 * ===========================================================================
 * QUATRE RÈGLES D'HONNÊTETÉ
 * ===========================================================================
 *
 * 1. **Sans repère commun, il n'y a pas de calage.** Un décalage posé à la
 *    main reste un décalage posé à la main : on le rend, on dit qu'il vient de
 *    la main, et on rend `erreurMs = null`. Jamais un « parfaitement
 *    synchronisé », jamais un ±0,00 s.
 *
 * 2. **L'erreur ne se moyenne pas, elle se cumule.** Les postes indépendants
 *    (cadence de la mesure, cadence de l'image, netteté du repère, dispersion
 *    des repères) se composent en quadrature ; la dérive, systématique et
 *    croissante avec l'éloignement du repère, s'AJOUTE ensuite. Et quand un
 *    poste ne peut pas être établi, l'erreur rendue est un PLANCHER — dit tel
 *    quel (`erreurMinoree`), pas silencieusement omis.
 *
 * 3. **La dérive ne se mesure qu'avec deux repères ÉCARTÉS.** Deux repères
 *    collés donnent une pente dont l'incertitude explose : en deçà de
 *    `COUVERTURE_ANCRAGE_MINIMALE` de la durée, la dérive redevient une
 *    convention présumée, et le dit (`derive.mesuree === false`).
 *
 * 4. **Les trames se trient sur `elapsed_ms`, jamais sur l'ordre d'arrivée.**
 *    `telemetry_frames.created_at` est un ordre d'INSERTION — piège documenté
 *    du dépôt. Le tri est refait ici, systématiquement.
 *
 * ===========================================================================
 * LE REPÈRE PAR ÉVÉNEMENT, ET POURQUOI IL VAUT MIEUX QUE L'ŒIL
 * ===========================================================================
 *
 * Caler à l'œil, c'est faire glisser une image jusqu'à ce que « ça colle » :
 * l'erreur est celle de l'œil, et personne ne sait la chiffrer. Caler sur un
 * ÉVÉNEMENT, c'est pointer dans la vidéo un fait franc que la mesure a vu
 * aussi — un départ arrêté, le freinage le plus franc du roulage. L'erreur
 * devient alors la NETTETÉ de ce fait, et elle se mesure : largeur du pic,
 * intervalle entre la dernière trame à l'arrêt et la première en mouvement.
 *
 * Chaque événement rendu porte le fait qui le justifie, en clair. Le pilote
 * voit sur quoi la synchronisation repose, et peut la refuser.
 */

import { FREQUENCE_NOMINALE_HZ, PERIODE_NOMINALE_MS } from './confianceLogic';

// ===========================================================================
// Seuils — conventions nommées, À VALIDER SUR PISTE.
// Aucun de ces chiffres n'est une mesure : ce sont des choix de lecture.
// ===========================================================================

/** Version du calcul — à incrémenter à chaque changement de seuil ou de méthode. */
export const VERSION_SYNCHRO_VIDEO = '1.0.0';

/** Vitesse (m/s) sous laquelle le véhicule est dit à l'arrêt. À valider sur piste. */
export const SEUIL_ARRET_MS = 0.5;

/** Vitesse (m/s) au-delà de laquelle il est dit clairement reparti. À valider sur piste. */
export const SEUIL_REPARTI_MS = 3;

/** Immobilité minimale (ms) pour qu'un départ soit un repère franc. À valider sur piste. */
export const DUREE_ARRET_MINIMALE_MS = 3000;

/** Fenêtre (ms) accordée au véhicule pour atteindre `SEUIL_REPARTI_MS`. À valider sur piste. */
export const FENETRE_DEPART_MS = 6000;

/**
 * Décélération (g ; convention verrouillée du dépôt : `gForceX > 0` vaut
 * freinage) en deçà de laquelle un freinage n'est pas un repère franc.
 * À valider sur piste.
 */
export const SEUIL_FREINAGE_FRANC_G = 0.6;

/** Tolérance (g) servant à mesurer la largeur du pic de freinage. À valider sur piste. */
export const TOLERANCE_PIC_G = 0.05;

/**
 * Dérive PRÉSUMÉE entre l'horloge de l'image et une horloge disciplinée par le
 * GPS (`itow_ms` présent), en parties par million. À valider sur piste.
 */
export const DERIVE_PRESUMEE_GPS_PPM = 100;

/**
 * Dérive PRÉSUMÉE quand l'horloge de mesure est celle de l'appareil (`itow_ms`
 * absent : `elapsed_ms` seul), en ppm. Plus large — deux horloges libres
 * dérivent l'une contre l'autre. À valider sur piste.
 */
export const DERIVE_PRESUMEE_APPAREIL_PPM = 300;

/**
 * Part de la durée de la vidéo que les repères doivent couvrir pour que la
 * dérive soit tenue pour MESURÉE plutôt que présumée. À valider sur piste.
 */
export const COUVERTURE_ANCRAGE_MINIMALE = 0.5;

/** Nombre minimal d'intervalles pour qu'une cadence observée soit dérivable. */
export const MIN_INTERVALLES_POUR_CADENCE = 5;

/** Repères minimaux pour qu'une dispersion soit mesurable (deux points ne dispersent pas). */
export const MIN_ANCRAGES_POUR_DISPERSION = 3;

/** Pas du réglage manuel du décalage, en ms. À valider sur piste. */
export const PAS_REGLAGE_MS = 100;

// ===========================================================================
// Types
// ===========================================================================

/** Les faits francs qu'une image et une mesure peuvent voir tous les deux. */
export type TypeEvenement = 'depart-arrete' | 'freinage-franc';

/**
 * Le strict nécessaire d'une trame — colonnes réelles de `telemetry_frames`.
 * Tout canal peut manquer : `null` vaut « non mesuré », jamais « nul ».
 */
export interface TrameSynchro {
  /** `elapsed_ms` — LA clé de tri (jamais l'ordre d'insertion). */
  elapsedMs: number;
  /** `speed_ms`, en m/s. */
  vitesseMs: number | null;
  /** `g_force_x` — convention du dépôt : positif vaut FREINAGE. */
  gForceX: number | null;
  /** `itow_ms` — présent = l'horloge de mesure est disciplinée par le GPS. */
  itowMs: number | null;
}

/** Un fait franc localisé sur l'horloge de mesure, avec sa netteté mesurée. */
export interface EvenementMesure {
  type: TypeEvenement;
  /** Instant du fait sur l'horloge de mesure, en ms. */
  elapsedMs: number;
  /** Demi-largeur temporelle du fait — sa netteté, mesurée sur les trames. */
  incertitudeMs: number;
  /** Ce qui justifie ce repère, en clair, pour que le pilote puisse le refuser. */
  fait: string;
}

/** Ce que le pilote a pointé dans la vidéo : un instant, et le fait qu'il y voit. */
export interface RepereVideo {
  /** Position dans la vidéo, en ms depuis la première image. */
  positionVideoMs: number;
  evenement: TypeEvenement;
}

/** Ce qu'on sait du média. Les deux champs manquent souvent — et se disent. */
export interface MediaVideo {
  /** Durée du média en ms, `null` si inconnue. */
  dureeMs: number | null;
  /** Cadence d'images, `null` si inconnue — le budget devient alors minoré. */
  imagesParSeconde: number | null;
}

export interface EntreeSynchro {
  trames: TrameSynchro[];
  /** `null` quand aucune vidéo n'est rattachée. */
  video: MediaVideo | null;
  /** Repères pointés par le pilote. Vide = aucun calage par événement. */
  reperes: RepereVideo[];
  /** Décalage déjà posé à la main (`video_overlays.offset_ms`), `null` sinon. */
  offsetManuelMs: number | null;
}

/** Un repère pointé, apparié au fait mesuré qui lui correspond. */
export interface AncragePose {
  evenement: EvenementMesure;
  positionVideoMs: number;
  /** `evenement.elapsedMs − positionVideoMs`. */
  offsetMs: number;
}

export interface DeriveSynchro {
  /** Dérive relative des deux horloges, en parties par million. */
  ppm: number;
  /** `false` = convention présumée ; `true` = pente ajustée sur des repères écartés. */
  mesuree: boolean;
  fait: string;
}

export type ClePoste = 'cadence-mesure' | 'cadence-video' | 'ancrage' | 'derive' | 'dispersion';

/** Un poste du budget d'erreur. `ms = null` = poste non établi, et dit tel quel. */
export interface PosteErreur {
  cle: ClePoste;
  libelle: string;
  /** Contribution en ms (demi-largeur). `null` quand le poste n'a pas pu être établi. */
  ms: number | null;
  /** `true` = mesuré sur les données ; `false` = convention présumée. */
  mesure: boolean;
  motif: string;
}

export interface SynchroVideo {
  version: string;
  /** D'où vient le décalage. `null` = il n'y en a pas. */
  origine: 'evenement' | 'manuel' | null;
  /** Décalage image → mesure, en ms entières. `null` = rien ne permet de caler. */
  offsetMs: number | null;
  /** Erreur résiduelle estimée (demi-largeur ±, en ms). `null` = non estimable. */
  erreurMs: number | null;
  /** `true` = un poste du budget manque : `erreurMs` est un PLANCHER. */
  erreurMinoree: boolean;
  ancrages: AncragePose[];
  derive: DeriveSynchro | null;
  budget: PosteErreur[];
  /** Les faits francs que la mesure offre — de quoi caler, si une vidéo arrive. */
  evenementsDisponibles: EvenementMesure[];
  /** Phrase française prête à afficher, factuelle. */
  phrase: string;
  /** Ce qui empêche, ou ce qui borne. Vide quand rien n'est à signaler. */
  motifs: string[];
}

// ===========================================================================
// Outils
// ===========================================================================

function fini(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function trierTrames(trames: TrameSynchro[]): TrameSynchro[] {
  return trames.filter((t) => fini(t.elapsedMs)).sort((a, b) => a.elapsedMs - b.elapsedMs);
}

function moyenne(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** Une décimale, virgule française. */
function fmt1(x: number): string {
  return x.toFixed(1).replace('.', ',');
}

/** Deux décimales, virgule française. */
function fmt2(x: number): string {
  return x.toFixed(2).replace('.', ',');
}

/**
 * Secondes arrondies AU-DESSUS au centième. Une erreur ne s'arrondit jamais
 * vers le bas : ce serait la rétrécir d'un trait de plume.
 */
export function formaterErreurSecondes(ms: number): string {
  return fmt2(Math.ceil(ms / 10) / 100);
}

/** Décalage signé, en secondes — « −0,40 s », « +0,25 s ». */
export function formaterOffsetSecondes(ms: number): string {
  const signe = ms < 0 ? '−' : '+';
  return `${signe}${fmt2(Math.abs(ms) / 1000)} s`;
}

function libelleEvenement(type: TypeEvenement, pluriel: boolean): string {
  if (type === 'depart-arrete') return pluriel ? 'départs arrêtés' : 'départ arrêté';
  return pluriel ? 'freinages francs' : 'freinage franc';
}

// ===========================================================================
// Cadence réellement observée
// ===========================================================================

interface Cadence {
  periodeMs: number;
  mesuree: boolean;
}

/**
 * Période MÉDIANE entre trames consécutives. La médiane, pas la moyenne : un
 * seul trou de liaison suffirait à gonfler une moyenne et à faire croire à une
 * cadence lente. Sous `MIN_INTERVALLES_POUR_CADENCE`, on retombe sur la période
 * nominale (25 Hz, décision fondateur) et on le dit.
 */
function cadenceObservee(trames: TrameSynchro[]): Cadence {
  const ecarts: number[] = [];
  for (let i = 1; i < trames.length; i++) {
    const d = trames[i].elapsedMs - trames[i - 1].elapsedMs;
    if (d > 0) ecarts.push(d);
  }
  if (ecarts.length < MIN_INTERVALLES_POUR_CADENCE) {
    return { periodeMs: PERIODE_NOMINALE_MS, mesuree: false };
  }
  ecarts.sort((a, b) => a - b);
  const m = ecarts.length >> 1;
  const mediane = ecarts.length % 2 === 1 ? ecarts[m] : (ecarts[m - 1] + ecarts[m]) / 2;
  return { periodeMs: mediane, mesuree: true };
}

// ===========================================================================
// Détection des faits francs
// ===========================================================================

/** Premier instant, dans la fenêtre, où le véhicule est clairement reparti. */
function instantReparti(trames: TrameSynchro[], depuis: number): number | null {
  const t0 = trames[depuis].elapsedMs;
  for (let i = depuis; i < trames.length; i++) {
    const t = trames[i];
    if (t.elapsedMs - t0 > FENETRE_DEPART_MS) return null;
    if (fini(t.vitesseMs) && t.vitesseMs >= SEUIL_REPARTI_MS) return t.elapsedMs;
  }
  return null;
}

function departsArretes(trames: TrameSynchro[]): EvenementMesure[] {
  const out: EvenementMesure[] = [];
  const seuilKmh = Math.round(SEUIL_REPARTI_MS * 3.6);
  let debutArret: number | null = null;

  for (let i = 0; i < trames.length; i++) {
    const v = trames[i].vitesseMs;
    // Canal absent : on ne conclut rien, et la chaîne d'immobilité se rompt.
    if (!fini(v)) {
      debutArret = null;
      continue;
    }
    if (v <= SEUIL_ARRET_MS) {
      if (debutArret === null) debutArret = trames[i].elapsedMs;
      continue;
    }
    if (debutArret !== null && i > 0) {
      const avant = trames[i - 1];
      const vAvant = avant.vitesseMs;
      const duree = avant.elapsedMs - debutArret;
      if (fini(vAvant) && duree >= DUREE_ARRET_MINIMALE_MS) {
        const reparti = instantReparti(trames, i);
        if (reparti !== null) {
          const pente = v - vAvant;
          const frac = pente > 0 ? (SEUIL_ARRET_MS - vAvant) / pente : 0.5;
          const instant = avant.elapsedMs + frac * (trames[i].elapsedMs - avant.elapsedMs);
          out.push({
            type: 'depart-arrete',
            elapsedMs: instant,
            incertitudeMs: Math.max(
              (trames[i].elapsedMs - avant.elapsedMs) / 2,
              PERIODE_NOMINALE_MS / 2
            ),
            fait:
              `Départ arrêté : ${fmt1(duree / 1000)} s d'immobilité, ` +
              `puis ${seuilKmh} km/h atteints en ${fmt2((reparti - instant) / 1000)} s.`,
          });
        }
      }
    }
    debutArret = null;
  }
  return out;
}

/**
 * Le freinage le plus franc du roulage. UN seul candidat par construction : un
 * extremum global ne peut pas être ambigu, contrairement aux départs. Sa
 * netteté est la LARGEUR du pic — un pic large est un mauvais repère, et le
 * budget en porte la trace au lieu de la taire.
 */
function freinageFranc(trames: TrameSynchro[]): EvenementMesure | null {
  let iPic = -1;
  let pic = 0;
  for (let i = 0; i < trames.length; i++) {
    const g = trames[i].gForceX;
    if (!fini(g)) continue;
    if (iPic < 0 || g > pic) {
      iPic = i;
      pic = g;
    }
  }
  if (iPic < 0 || pic < SEUIL_FREINAGE_FRANC_G) return null;

  const plancher = pic - TOLERANCE_PIC_G;
  let g0 = iPic;
  let g1 = iPic;
  while (g0 - 1 >= 0) {
    const g = trames[g0 - 1].gForceX;
    if (!fini(g) || g < plancher) break;
    g0--;
  }
  while (g1 + 1 < trames.length) {
    const g = trames[g1 + 1].gForceX;
    if (!fini(g) || g < plancher) break;
    g1++;
  }
  const largeur = trames[g1].elapsedMs - trames[g0].elapsedMs;
  return {
    type: 'freinage-franc',
    elapsedMs: trames[iPic].elapsedMs,
    incertitudeMs: Math.max(largeur / 2, PERIODE_NOMINALE_MS / 2),
    fait:
      `Freinage le plus franc du roulage : ${fmt2(pic)} g, ` +
      `pic large de ${fmt2(largeur / 1000)} s.`,
  };
}

/** Tous les faits francs que la mesure offre, triés dans le temps. */
export function detecterEvenements(trames: TrameSynchro[]): EvenementMesure[] {
  const tries = trierTrames(trames);
  const out: EvenementMesure[] = departsArretes(tries);
  const freinage = freinageFranc(tries);
  if (freinage !== null) out.push(freinage);
  return out.sort((a, b) => a.elapsedMs - b.elapsedMs);
}

// ===========================================================================
// Appariement repère pointé ↔ fait mesuré
// ===========================================================================

interface Appariement {
  ancrages: AncragePose[];
  motifs: string[];
}

/**
 * Un repère nomme un TYPE de fait, pas une occurrence. Quand plusieurs
 * occurrences existent et que rien ne dit laquelle, on REFUSE d'ancrer :
 * choisir la première serait tirer à pile ou face sur la synchronisation. Un
 * décalage déjà posé lève l'ambiguïté — il désigne la plus proche.
 */
function apparier(
  reperes: RepereVideo[],
  evenements: EvenementMesure[],
  offsetManuelMs: number | null
): Appariement {
  const ancrages: AncragePose[] = [];
  const motifs: string[] = [];

  for (const r of reperes) {
    if (!fini(r.positionVideoMs)) continue;
    const candidats = evenements.filter((e) => e.type === r.evenement);
    if (candidats.length === 0) {
      motifs.push(`Aucun ${libelleEvenement(r.evenement, false)} n'apparaît dans la mesure.`);
      continue;
    }
    let choisi: EvenementMesure;
    if (candidats.length === 1) {
      choisi = candidats[0];
    } else if (fini(offsetManuelMs)) {
      const cible = r.positionVideoMs + offsetManuelMs;
      choisi = candidats.reduce((a, b) =>
        Math.abs(b.elapsedMs - cible) < Math.abs(a.elapsedMs - cible) ? b : a
      );
    } else {
      motifs.push(
        `${candidats.length} ${libelleEvenement(r.evenement, true)} sont mesurés : ` +
          `le repère pointé ne dit pas lequel.`
      );
      continue;
    }
    ancrages.push({
      evenement: choisi,
      positionVideoMs: r.positionVideoMs,
      offsetMs: choisi.elapsedMs - r.positionVideoMs,
    });
  }
  return { ancrages, motifs };
}

// ===========================================================================
// Le calcul
// ===========================================================================

function etendueVideoMs(video: MediaVideo | null, trames: TrameSynchro[]): number | null {
  if (video !== null && fini(video.dureeMs) && video.dureeMs > 0) return video.dureeMs;
  if (trames.length >= 2) {
    const span = trames[trames.length - 1].elapsedMs - trames[0].elapsedMs;
    if (span > 0) return span;
  }
  return null;
}

interface Pente {
  a: number;
  b: number;
  tBar: number;
}

/** Moindres carrés `offset(t) = a + b·(t − t̄)` sur les repères posés. */
function ajusterPente(ancrages: AncragePose[]): Pente {
  const ts = ancrages.map((x) => x.positionVideoMs);
  const os = ancrages.map((x) => x.offsetMs);
  const tBar = moyenne(ts);
  const oBar = moyenne(os);
  let num = 0;
  let den = 0;
  for (let i = 0; i < ts.length; i++) {
    const dt = ts[i] - tBar;
    num += dt * (os[i] - oBar);
    den += dt * dt;
  }
  return { a: oBar, b: den > 0 ? num / den : 0, tBar };
}

/**
 * Le calcul complet : décalage, erreur, budget, phrase. Aucun accès réseau,
 * aucune horloge — la même entrée rend toujours la même sortie.
 */
export function synchroniserVideo(entree: EntreeSynchro): SynchroVideo {
  const trames = trierTrames(entree.trames);
  const evenements = detecterEvenements(trames);
  const offsetManuelMs = fini(entree.offsetManuelMs) ? entree.offsetManuelMs : null;
  const { ancrages, motifs } = apparier(entree.reperes, evenements, offsetManuelMs);

  // ── Rien à caler ────────────────────────────────────────────────────────
  if (ancrages.length === 0 && offsetManuelMs === null) {
    return {
      version: VERSION_SYNCHRO_VIDEO,
      origine: null,
      offsetMs: null,
      erreurMs: null,
      erreurMinoree: false,
      ancrages: [],
      derive: null,
      budget: [],
      evenementsDisponibles: evenements,
      phrase: "Décalage non mesuré — la vidéo n'est pas alignée sur la mesure.",
      motifs: [
        ...motifs,
        evenements.length > 0
          ? `${evenements.length} repère(s) franc(s) existent dans la mesure : rien n'a encore été pointé dans l'image.`
          : "Aucun repère franc n'apparaît dans la mesure de cette séance.",
      ],
    };
  }

  // ── Décalage posé à la main, sans repère : l'erreur reste inconnue ──────
  if (ancrages.length === 0 && offsetManuelMs !== null) {
    return {
      version: VERSION_SYNCHRO_VIDEO,
      origine: 'manuel',
      offsetMs: Math.round(offsetManuelMs),
      erreurMs: null,
      erreurMinoree: false,
      ancrages: [],
      derive: null,
      budget: [],
      evenementsDisponibles: evenements,
      phrase: `Vidéo calée à la main sur ${formaterOffsetSecondes(offsetManuelMs)} — erreur de calage non mesurée.`,
      motifs: [
        ...motifs,
        "Aucun repère commun à l'image et à la mesure n'a été posé : rien ne permet de chiffrer l'écart qui reste.",
      ],
    };
  }

  // ── Calage par événement ────────────────────────────────────────────────
  const bornes: string[] = [...motifs];
  const etendueMs = etendueVideoMs(entree.video, trames);
  const cadence = cadenceObservee(trames);
  const horlogeGps = trames.some((t) => fini(t.itowMs));

  const positions = ancrages.map((x) => x.positionVideoMs);
  const empanMs = Math.max(...positions) - Math.min(...positions);
  const couverture = etendueMs !== null && ancrages.length >= 2 ? empanMs / etendueMs : 0;
  const deriveMesurable = ancrages.length >= 2 && couverture >= COUVERTURE_ANCRAGE_MINIMALE;

  let offsetBrut: number;
  let derive: DeriveSynchro;
  let dispersionMs: number | null = null;

  if (deriveMesurable && etendueMs !== null) {
    const { a, b, tBar } = ajusterPente(ancrages);
    // Décalage rendu AU MILIEU de la vidéo : une valeur constante y borne au
    // mieux l'écart aux deux bouts. `video_overlays` ne stocke qu'un scalaire.
    offsetBrut = a + b * (etendueMs / 2 - tBar);
    derive = {
      ppm: b * 1e6,
      mesuree: true,
      fait:
        `${ancrages.length} repères écartés de ${fmt1(empanMs / 1000)} s ` +
        `donnent une dérive de ${Math.round(b * 1e6)} ppm entre les deux horloges.`,
    };
    if (ancrages.length >= MIN_ANCRAGES_POUR_DISPERSION) {
      const residus = ancrages.map((x) => x.offsetMs - (a + b * (x.positionVideoMs - tBar)));
      dispersionMs = Math.sqrt(moyenne(residus.map((r) => r * r)));
    } else {
      bornes.push(
        'Deux repères posent une pente mais ne la contredisent pas : leur dispersion reste non mesurée.'
      );
    }
  } else {
    offsetBrut = moyenne(ancrages.map((x) => x.offsetMs));
    const ppm = horlogeGps ? DERIVE_PRESUMEE_GPS_PPM : DERIVE_PRESUMEE_APPAREIL_PPM;
    derive = {
      ppm,
      mesuree: false,
      fait:
        ancrages.length >= 2
          ? `Les repères couvrent ${Math.round(couverture * 100)} % de la vidéo : trop resserrés pour mesurer une dérive. ${ppm} ppm présumés.`
          : `Un seul repère : la dérive ne se mesure pas. ${ppm} ppm présumés, ` +
            `${horlogeGps ? 'horloge de mesure disciplinée par le GPS' : "horloge de mesure celle de l'appareil"}.`,
    };
  }

  // ── Le budget d'erreur, poste par poste ─────────────────────────────────
  const cadenceMesureMs = cadence.periodeMs / 2;
  const fps =
    entree.video !== null &&
    fini(entree.video.imagesParSeconde) &&
    entree.video.imagesParSeconde > 0
      ? entree.video.imagesParSeconde
      : null;
  const cadenceVideoMs = fps !== null ? 1000 / fps / 2 : null;
  // La PLUS LARGE des netteté de repères, jamais leur moyenne — moyenner
  // flatterait le repère le plus flou en le noyant dans les autres.
  const ancrageMs = Math.max(...ancrages.map((x) => x.evenement.incertitudeMs));

  let deriveMs: number | null;
  if (etendueMs === null) {
    deriveMs = null;
  } else if (derive.mesuree) {
    deriveMs = (Math.abs(derive.ppm) * 1e-6 * etendueMs) / 2;
  } else {
    const pRef = moyenne(positions);
    const eloignementMax = Math.max(Math.abs(pRef), Math.abs(etendueMs - pRef));
    deriveMs = derive.ppm * 1e-6 * eloignementMax;
  }

  const budget: PosteErreur[] = [
    {
      cle: 'cadence-mesure',
      libelle: 'Cadence de la mesure',
      ms: cadenceMesureMs,
      mesure: cadence.mesuree,
      motif: cadence.mesuree
        ? `Période médiane observée : ${Math.round(cadence.periodeMs)} ms — un fait ne se situe pas plus fin que la moitié.`
        : `Trop peu d'intervalles pour observer la cadence : ${FREQUENCE_NOMINALE_HZ} Hz nominaux retenus (${Math.round(PERIODE_NOMINALE_MS)} ms).`,
    },
    {
      cle: 'cadence-video',
      libelle: "Cadence de l'image",
      ms: cadenceVideoMs,
      mesure: fps !== null,
      motif:
        fps !== null
          ? `${fps} images par seconde : une image dure ${Math.round(1000 / fps)} ms.`
          : "La cadence de la vidéo n'est pas connue : ce poste manque au budget.",
    },
    {
      cle: 'ancrage',
      libelle: 'Netteté du repère',
      ms: ancrageMs,
      mesure: true,
      motif: ancrages.map((x) => x.evenement.fait).join(' '),
    },
    {
      cle: 'derive',
      libelle: 'Dérive des horloges',
      ms: deriveMs,
      mesure: derive.mesuree,
      motif:
        deriveMs === null
          ? "Ni la durée de la vidéo ni l'étendue de la mesure ne sont connues : la dérive ne se chiffre pas."
          : derive.fait,
    },
  ];
  if (dispersionMs !== null) {
    budget.push({
      cle: 'dispersion',
      libelle: 'Dispersion des repères',
      ms: dispersionMs,
      mesure: true,
      motif: `${ancrages.length} repères : écart quadratique moyen à la droite ajustée.`,
    });
  }

  // Postes indépendants en quadrature ; la dérive, systématique, s'ajoute.
  const aleas = [cadenceMesureMs, cadenceVideoMs, ancrageMs, dispersionMs].filter(fini);
  const erreurMs = Math.sqrt(aleas.reduce((s, v) => s + v * v, 0)) + (deriveMs ?? 0);

  const manquants: string[] = [];
  if (cadenceVideoMs === null) manquants.push("la cadence de l'image n'est pas connue");
  if (deriveMs === null) manquants.push("la durée de la vidéo n'est pas connue");
  // La dispersion demande trois repères : à deux, elle n'est pas chiffrable et
  // le budget n'en porte pas le poste. L'erreur est alors un plancher au même
  // titre que les deux autres — la règle 2 de l'en-tête vaut pour tous les
  // postes, pas seulement pour ceux qu'on avait en tête en l'écrivant.
  if (dispersionMs === null) {
    manquants.push(`la dispersion demande trois repères, il y en a ${ancrages.length}`);
  }
  const erreurMinoree = manquants.length > 0;

  const phrase = erreurMinoree
    ? `Vidéo calée à ±${formaterErreurSecondes(erreurMs)} s au moins — ${manquants.join(', ')}.`
    : `Vidéo calée à ±${formaterErreurSecondes(erreurMs)} s.`;

  return {
    version: VERSION_SYNCHRO_VIDEO,
    origine: 'evenement',
    offsetMs: Math.round(offsetBrut),
    erreurMs,
    erreurMinoree,
    ancrages,
    derive,
    budget,
    evenementsDisponibles: evenements,
    phrase,
    motifs: bornes,
  };
}

// ===========================================================================
// Réglage manuel — un geste, et son effet dit
// ===========================================================================

/** Décale d'un pas. Entier : `video_overlays.offset_ms` est un entier signé. */
export function decalerOffset(offsetMs: number, sens: 1 | -1): number {
  return Math.round(offsetMs + sens * PAS_REGLAGE_MS);
}

/** Ce qu'un pas déplace, sans direction — la ligne qui accompagne le geste. */
export function phraseDuPas(): string {
  return `Chaque pas déplace les mesures de ${fmt2(PAS_REGLAGE_MS / 1000)} s sur l'image.`;
}

/** Ce que le geste fait, à l'indicatif — jamais un ordre. */
export function effetDuPas(sens: 1 | -1): string {
  const pas = fmt2(PAS_REGLAGE_MS / 1000);
  return sens === 1
    ? `Les mesures avancent de ${pas} s sur l'image.`
    : `Les mesures reculent de ${pas} s sur l'image.`;
}
