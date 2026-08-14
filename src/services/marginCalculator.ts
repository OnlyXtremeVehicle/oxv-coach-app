/**
 * Calcul de la marge composite — V1 simplifié.
 *
 * Doctrine OXV : "L'app est un miroir, pas un coach." Le chiffre doit
 * être honnête, ni optimiste ni pessimiste. La marge représente le
 * potentiel non utilisé du couple véhicule/pilote, sans jugement de
 * valeur sur le pilotage observé.
 *
 * V1 simplifié — pas de Kalman, pas de Pacejka complet :
 *   - Marge véhicule : (1 - G_lat_observé / G_lat_max) × 100
 *   - Marge pilote   : combinaison régularité (stddev temps au tour)
 *                      + smoothness (stddev des G_lat par tour)
 *   - Marge globale  : 40% véhicule + 60% pilote
 *
 * Le pilote pèse plus que le véhicule dans la formule V1 — c'est le
 * pilote qu'on évalue, pas la voiture. Les améliorations V2 ajouteront
 * le transfert de charge dynamique (sec. 7 des algos), la stabilité
 * dynamique (sec. 8), et la marge par virage (sec. 5).
 *
 * DONNÉE ABSENTE ≠ VALEUR NULLE (règle fondateur « données réelles ») :
 * chaque composante vaut `null` quand son entrée manque, et la marge
 * globale vaut `null` dès qu'une composante manque. Un trou ne se comble
 * jamais par une valeur par défaut : une session non close porte
 * `max_g_lateral = NULL`, et la lire comme « 0 g observé » produirait
 * « 100 % de marge » — le chiffre roi du bilan, faux et persisté à vie.
 * Les appelants filtrent avec `isMarginResolved()` et rendent « — ».
 *
 * Même règle pour la FLUIDITÉ, sur `laps.max_g_lateral` : les tours sans
 * mesure sont écartés, et sous deux tours mesurés la fluidité vaut `null`.
 * Conséquence ASSUMÉE : les séances captées AVANT l'écriture de cette colonne
 * (cf. captureSessionService) n'ont pas de marge et se rendent « — ». On
 * préfère le silence honnête au chiffre inventé ; on ne les rattrape pas.
 *
 * Voir docs/architecture/02_PARTIE_2_algorithmes.md, sections 7-8.
 */

import { computeRegularite } from '@/services/qdiLogic';
import { marginZoneOf, type MarginPercent, type MarginZone } from '@/types/domain';
import type { Lap, TelemetrySession } from '@/types/telemetry';

export interface VehicleParameters {
  /** Limite latérale typique du véhicule, en g. */
  maxGLateral: number;
}

/**
 * ===========================================================================
 * IL N'Y A PLUS DE VÉHICULE PAR DÉFAUT — RETIRÉ LE 14/08/2026
 * ===========================================================================
 *
 * Ce fichier portait :
 *
 *     /** Profil "route sportive" par défaut — calibration GT3 à venir en V2. *\/
 *     export const DEFAULT_VEHICLE = { maxGLateral: 1.0 };
 *
 * Et `input.vehicle` n'était JAMAIS passé : l'unique appelant de production,
 * `analyzeSessionService.ts`, appelle `computeMargin({ session, laps })`. La
 * constante s'appliquait donc à **100 % des séances**.
 *
 * ===========================================================================
 * CE QUE ÇA COÛTAIT, CHIFFRÉ
 * ===========================================================================
 *
 * `VEHICLE_WEIGHT = 0.4`. Sur Bouteville, `observedG = 0,62 g` :
 *
 *   | dénominateur              | marge véhicule | marge globale |
 *   |---------------------------|---------------:|--------------:|
 *   | 1,0 g — la constante      |           38,0 |          51,4 |
 *   | 1,45 g — une GT3 réelle   |           57,2 |          59,1 |
 *   | 0,95 g — une routière     |           34,7 |          50,1 |
 *
 * **7,7 points** dus à un véhicule inventé. La fabrication corrigée le même
 * jour — la constance en écart-type absolu — en valait 12,2.
 *
 * ===========================================================================
 * POURQUOI ELLE A SURVÉCU À TROIS PASSES DE MESURE
 * ===========================================================================
 *
 * Parce qu'elle n'avait pas la forme des autres. `?? 0`, `?? 100`,
 * `temperature: 0` se cherchent au grep. Celle-ci était une constante
 * **nommée, exportée, typée, documentée** — avec un commentaire qui promettait
 * même la suite.
 *
 * Elle ne ressemblait pas à une fabrication. Elle ressemblait à un paramètre.
 *
 * ===========================================================================
 * ET ON NE LA CALIBRE PAS : ON REND `null`
 * ===========================================================================
 *
 * La tentation serait une table d'adhérence par modèle, ou un g maximal
 * déclaré par le pilote. Les deux fabriquent encore : une valeur tabulée ne
 * connaît ni les pneus, ni la pression, ni la température de piste ; un pilote
 * qui déclare « 1,3 g » déclare une croyance.
 *
 * La table `vehicles` ne porte AUCUNE grandeur d'adhérence — dix-sept colonnes,
 * `mass_kg` ajoutée le 29/07, le g latéral jamais. Il n'y a donc rien à passer.
 *
 * **La caractérisation se mesure.** Le g latéral maximal d'une voiture donnée
 * sur des pneus donnés, c'est le maximum observé sur plusieurs séances. La
 * donnée existe déjà ; il lui manque des séances.
 */

/**
 * Sous-composantes 0..100. `null` = entrée absente, donc rien à dire.
 *
 * ===========================================================================
 * `consistency` S'APPELAIT `regularity` JUSQU'AU 13/08/2026 — UN HOMONYME PIÉGÉ
 * ===========================================================================
 *
 * `app_session_analyses` porte deux colonnes voisines, `qdi` et
 * `margin_breakdown`. Sur la séance de Bouteville du 13/08, LA MÊME LIGNE
 * disait :
 *
 *     qdi.regularite              = 34
 *     margin_breakdown.regularity = 0
 *
 * ---------------------------------------------------------------------------
 * CE QUE J'AI ÉCRIT ICI LE 13/08 AU SOIR ÉTAIT FAUX, ET CORRIGÉ LE LENDEMAIN
 * ---------------------------------------------------------------------------
 *
 * J'avais écrit : *« deux mesures qui n'ont rien à voir — le QDI mesure la
 * constance du geste, la marge la dispersion des temps au tour »*. **Non.**
 *
 * `qdiLogic.computeRegularite` reçoit `laps.map((l) => l.durationSeconds)`.
 * Les deux partent des MÊMES temps au tour. Ce n'est pas une homonymie entre
 * deux grandeurs : c'est **une seule grandeur, calculée deux fois, par deux
 * formules qui ne s'accordent pas**.
 *
 *     QDI    — coefficient de variation (écart-type / moyenne), noté sur
 *              [0 ; 6 %] ;
 *     marge  — écart-type ABSOLU en secondes, pénalisé de 25 points par
 *              seconde au-delà d'une seconde.
 *
 * Reproduit sur les trois tours réels de Bouteville — 360,485 · 327,542 ·
 * 339,483 s :
 *
 *     moyenne 342,503 s · écart-type 13,617 s · coef. de variation 3,98 %
 *     → QDI 34    ·    marge 0
 *
 * Les deux valeurs de la base sortent à l'unité près. Le renommage reste juste
 * — deux formules d'une même grandeur doivent porter deux noms — mais le motif
 * n'était pas celui que j'avais écrit.
 *
 * Cette confusion-là ne se voit pas. Personne ne la remarque tant qu'il n'ouvre
 * pas les deux colonnes côte à côte — et le jour où quelqu'un le fait, il
 * cherche un bug là où il y a un désaccord de calibration.
 *
 * ---------------------------------------------------------------------------
 * LA CALIBRATION ÉTAIT FAUSSE AUSSI — CORRIGÉE LE 14/08
 * ---------------------------------------------------------------------------
 *
 * Le désaccord ne venait pas d'un choix de formule mais d'une erreur de
 * dimension : la marge comparait des SECONDES à un seuil fixe. Voir
 * `computeConsistency` plus bas, qui délègue désormais à `computeRegularite`.
 *
 * Les deux valeurs de l'exemple ci-dessus ne peuvent donc plus diverger : il
 * n'y a plus qu'un seul calcul, appelé de deux endroits.
 *
 * Ce qu'il reste à faire est un GESTE, pas une décision — un déploiement unique
 * portant la clé ET la formule, et une reprise des lignes déjà écrites. Registre
 * § 0.8.
 */
export interface MarginBreakdown {
  vehicle: number | null;
  pilot: number | null;
  consistency: number | null;
  smoothness: number | null;
}

export interface ComputeMarginInput {
  session: Pick<TelemetrySession, 'max_g_lateral'>;
  laps: Lap[];
  vehicle?: VehicleParameters;
}

/**
 * SUR QUOI LE CHIFFRE REPOSE — à dire au pilote, toujours.
 *
 *   • `complete`    — véhicule ET pilote mesurés, pondération 40/60 ;
 *   • `pilote-seul` — véhicule non caractérisé : c'est la marge PILOTE ;
 *   • `aucune`      — pas assez de tours, il n'y a pas de marge.
 *
 * Aujourd'hui, `pilote-seul` est le cas de TOUTES les séances : la table
 * `vehicles` ne porte aucune grandeur d'adhérence. Ce n'est pas un état
 * dégradé exceptionnel, c'est l'état normal tant que la caractérisation n'est
 * pas mesurée — et l'écran doit le dire plutôt que de laisser croire à une
 * marge complète.
 */
export type MarginBase = 'complete' | 'pilote-seul' | 'aucune';

/**
 * CE QU'ON DIT AU PILOTE, SOUS LE CHIFFRE.
 *
 * `null` quand la base est complète : rien à préciser, la marge est ce qu'elle
 * annonce. Sinon la phrase dit sur quoi elle repose — parce qu'un chiffre dont
 * la nature a changé sans le dire est pire qu'un chiffre absent.
 */
export function libelleBaseMarge(base: MarginBase): string | null {
  if (base === 'complete') return null;
  if (base === 'pilote-seul') {
    return 'Cette marge porte sur votre pilotage seul : votre véhicule n’est pas caractérisé.';
  }
  return null;
}

/**
 * CE QU'ON DIT AU COACH, AU-DESSUS DE DEUX CHIFFRES CÔTE À CÔTE.
 *
 * Comparer suppose que les deux nombres mesurent la même chose. Tant que
 * toutes les séances partagent la même base, c'est vrai et l'en-tête peut le
 * nommer. Le jour où un véhicule sera caractérisé et l'autre non, la
 * comparaison portera sur deux grandeurs différentes — et c'est précisément ce
 * qu'il faut dire, plutôt que de laisser un écart parler tout seul.
 *
 * Une base `null` (ligne antérieure au 14/08/2026) ne se devine pas : on garde
 * alors le libellé d'origine et on se tait.
 */
export function libelleLigneMarge(bases: readonly (MarginBase | null)[]): {
  label: string;
  note: string | null;
} {
  const connues = bases.filter((b): b is MarginBase => b !== null);
  if (connues.length !== bases.length || connues.length === 0) {
    return { label: 'marge globale', note: null };
  }
  const distinctes = new Set(connues);
  if (distinctes.size > 1) {
    return {
      label: 'marge',
      note: 'Ces marges ne reposent pas sur la même base : l’une porte sur le pilotage seul.',
    };
  }
  if (distinctes.has('pilote-seul')) {
    return {
      label: 'marge pilote',
      note: 'Aucun véhicule n’est caractérisé : ces marges portent sur le pilotage.',
    };
  }
  return { label: 'marge globale', note: null };
}

export interface ComputeMarginOutput {
  marginGlobal: MarginPercent | null;
  marginZone: MarginZone | null;
  marginVehicle: number | null;
  marginPilot: number | null;
  /** Ce sur quoi `marginGlobal` repose. Jamais tu. */
  base: MarginBase;
  breakdown: MarginBreakdown;
  /** Nombre de tours valides utilisés pour le calcul (hors outlap/inlap). */
  validLapCount: number;
}

/** Breakdown entièrement calculé — aucune composante absente. */
export interface ResolvedMarginBreakdown {
  vehicle: number;
  pilot: number;
  consistency: number;
  smoothness: number;
}

/**
 * Marge dont TOUTES les composantes sortent de données réelles. Seule forme
 * persistable (app_session_analyses) et affichable : le reste se rend « — ».
 */
export interface ResolvedMarginOutput extends ComputeMarginOutput {
  marginGlobal: MarginPercent;
  marginZone: MarginZone;
  marginVehicle: number;
  marginPilot: number;
  breakdown: ResolvedMarginBreakdown;
}

/**
 * Garde de type : la marge est-elle réellement calculable ?
 *
 * Le point d'entrée unique des appelants — figer une marge partielle en base
 * la rendrait définitive (upsert `onConflict`, jamais recalculé), et aucun
 * écran ne pourrait plus distinguer le chiffre réel de son bouche-trou.
 */
export function isMarginResolved(out: ComputeMarginOutput): out is ResolvedMarginOutput {
  return (
    out.marginGlobal !== null &&
    out.marginZone !== null &&
    out.marginVehicle !== null &&
    out.marginPilot !== null &&
    out.breakdown.vehicle !== null &&
    out.breakdown.pilot !== null &&
    out.breakdown.consistency !== null &&
    out.breakdown.smoothness !== null
  );
}

const VEHICLE_WEIGHT = 0.4;
const PILOT_WEIGHT = 0.6;

const CONSISTENCY_WEIGHT = 0.6;
const SMOOTHNESS_WEIGHT = 0.4;

export function computeMargin(input: ComputeMarginInput): ComputeMarginOutput {
  // Aucun repli : sans véhicule caractérisé, il n'y a pas de marge véhicule.
  const marginVehicle =
    input.vehicle !== undefined ? computeVehicleMargin(input.session, input.vehicle) : null;
  const pilot = computePilotMargin(input.laps);

  /**
   * LA MARGE GLOBALE SE REPLIE SUR CE QU'ELLE CONNAÎT.
   *
   * Les deux composantes présentes → la pondération 40/60.
   *
   * Le véhicule absent → **la marge pilote seule**, et `base` le dit. Un
   * chiffre sur une base connue vaut mieux qu'un chiffre sur une base
   * inventée ; le taire entièrement priverait le pilote de la moitié qui EST
   * mesurée.
   *
   * Le pilote absent → rien. La séance n'a pas assez de tours, et une marge
   * véhicule seule ne décrit pas un pilotage.
   */
  const marginGlobal =
    pilot.marginPilot === null
      ? null
      : marginVehicle !== null
        ? clampMargin(VEHICLE_WEIGHT * marginVehicle + PILOT_WEIGHT * pilot.marginPilot)
        : pilot.marginPilot;

  const base: MarginBase =
    marginGlobal === null ? 'aucune' : marginVehicle !== null ? 'complete' : 'pilote-seul';

  return {
    marginGlobal,
    marginZone: marginGlobal !== null ? marginZoneOf(marginGlobal) : null,
    marginVehicle,
    marginPilot: pilot.marginPilot,
    base,
    breakdown: {
      vehicle: marginVehicle,
      pilot: pilot.marginPilot,
      consistency: pilot.consistency,
      smoothness: pilot.smoothness,
    },
    validLapCount: pilot.validLapCount,
  };
}

/**
 * Marge véhicule, ou `null` si le G latéral maximum n'a pas été observé.
 *
 * `max_g_lateral` n'est écrit qu'à la CLÔTURE de la session (op `complete` de
 * la file de synchro) : tant qu'elle est en `recording`, la colonne est NULL.
 * Ce NULL dit « pas encore mesuré », pas « 0 g » — le confondre avec un zéro
 * réel donnait 100 % de marge à la séance la plus engagée.
 */
function computeVehicleMargin(
  session: Pick<TelemetrySession, 'max_g_lateral'>,
  vehicle: VehicleParameters
): number | null {
  // `== null` couvre aussi l'`undefined` : les lignes Supabase sont castées en
  // `TelemetrySession`, un SELECT partiel peut donc laisser la clé absente.
  const raw = session.max_g_lateral;
  if (raw == null) return null;
  const observedG = Number(raw);
  if (!Number.isFinite(observedG)) return null;
  if (observedG <= 0) return 100;
  if (vehicle.maxGLateral <= 0) return 0;
  const usage = observedG / vehicle.maxGLateral;
  return clampMargin((1 - usage) * 100);
}

interface PilotMarginResult {
  marginPilot: number | null;
  consistency: number | null;
  smoothness: number | null;
  validLapCount: number;
}

function computePilotMargin(laps: Lap[]): PilotMarginResult {
  const validLaps = laps.filter((l) => !l.is_outlap && !l.is_inlap && l.duration_seconds > 0);

  // Constance et fluidité sont des DISPERSIONS : sous deux tours valides il
  // n'y a rien à disperser. Zéro tour n'est pas un pilote parfaitement régulier,
  // c'est une séance dont les tours ne sont pas (encore) là.
  //
  // La CONSTANCE, elle, en exige TROIS depuis le 14/08 — la garde de
  // `computeRegularite`, à qui elle est déléguée. Deux tours ne donnent qu'un
  // écart, et un écart n'est pas une dispersion. Elle rend alors `null`, ce que
  // la suite traite comme une absence, jamais comme un zéro.
  if (validLaps.length < 2) {
    return {
      marginPilot: null,
      consistency: null,
      smoothness: null,
      validLapCount: validLaps.length,
    };
  }

  const consistency = computeConsistency(validLaps.map((l) => l.duration_seconds));
  const smoothness = computeSmoothness(validLaps);

  // Même arbitrage que la marge globale : une composante absente ne se pondère
  // pas. Les DEUX sont désormais traitées symétriquement — jusqu'au 14/08 seule
  // la fluidité pouvait manquer, la constance étant toujours un nombre. Depuis
  // qu'elle est déléguée au QDI, elle peut valoir `null` sous trois tours, et il
  // n'y a aucune raison de la traiter autrement que sa jumelle.
  //
  // Chacune reste exposée dans le breakdown quand elle existe : une composante
  // mesurée se montre même si l'autre manque. C'est la SOMME qui n'a pas de sens
  // à un seul terme, pas les termes.
  const marginPilot =
    consistency !== null && smoothness !== null
      ? clampMargin(CONSISTENCY_WEIGHT * consistency + SMOOTHNESS_WEIGHT * smoothness)
      : null;

  return { marginPilot, consistency, smoothness, validLapCount: validLaps.length };
}

/**
 * Constance : coefficient de variation des temps au tour — DÉLÉGUÉ au QDI.
 *
 * ===========================================================================
 * ELLE PORTAIT UN SEUIL ABSOLU JUSQU'AU 14/08/2026, ET IL ÉTAIT FAUX
 * ===========================================================================
 *
 * L'ancienne formule était `100 − max(0, σ − 1 s) × 25` : une seconde, cinq
 * secondes, les mêmes bornes quelle que soit la longueur du tour. Or un
 * écart-type ne se lit qu'en proportion de ce qu'il disperse.
 *
 *   tour de kart, 60 s        → σ = 5 s vaut 8 %    → dispersé, note zéro juste ;
 *   tour de Bouteville, 342 s → σ = 5 s vaut 1,5 %  → remarquable, et notée ZÉRO.
 *
 * Sur la seule séance réelle de la base, elle rendait 0 là où le QDI — mêmes
 * tours, coefficient de variation — rendait 34.
 *
 * ---------------------------------------------------------------------------
 * CE QUI DÉSIGNE LE COUPABLE : LA JUMELLE, ELLE, FONCTIONNE
 * ---------------------------------------------------------------------------
 *
 * `computeSmoothness` applique exactement le même patron — un seuil, une pente
 * — à des accélérations latérales, c'est-à-dire à une grandeur **déjà sans
 * dimension**. Et elle est juste.
 *
 * Des deux jumelles, celle qui porte sur un nombre sans unité marche, celle qui
 * porte sur des secondes échoue. Ce n'est donc pas un oubli isolé : c'est ce qui
 * arrive quand un seuil est écrit sans qu'on se demande **en quelle unité il
 * est**. Le coefficient de variation n'est pas seulement une réponse possible,
 * c'est LA réponse : il rend la grandeur sans dimension avant de la comparer.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI DÉLÉGUER PLUTÔT QUE RECOPIER
 * ---------------------------------------------------------------------------
 *
 * Une fois passé au coefficient de variation, ce calcul EST celui du QDI. En
 * écrire une seconde copie, c'est reprogrammer la divergence qu'on vient de
 * retirer — deux formules d'une même grandeur, qui finiront par ne plus
 * s'accorder. `computeRegularite` est la source unique.
 *
 * Conséquence assumée : le minimum passe de deux tours à TROIS, la garde du
 * QDI. Sous trois tours il n'y a qu'un ou deux écarts, ce qui ne fait pas une
 * dispersion. `null` remonte alors jusqu'à la marge pilote — absence, jamais
 * zéro. Aucune séance de production n'est concernée (une seule porte des tours
 * valides, et elle en a trois).
 *
 * ---------------------------------------------------------------------------
 * LE CORRECTIF REMONTE LA NOTE, ET CELA SE DIT
 * ---------------------------------------------------------------------------
 *
 * `margin_global` est une RÉSERVE : `>= 30 → vert`, plus haut vaut mieux. Le
 * défaut sous-notait ; le corriger relève. Bouteville passe de 39,20 à 51,44.
 *
 * C'est la direction qui ne déclenche aucune alarme chez qui la reçoit — un
 * chiffre qui monte ne fait protester personne. Cela n'invalide rien : la
 * formule d'avant était fausse pour une raison dimensionnelle, indépendante du
 * sens du résultat. Mais c'est écrit ici plutôt que tu.
 *
 * Et la zone, elle, ne bouge pas : 39,20 comme 51,44 sont au-dessus de 30, donc
 * verts tous les deux. J'avais annoncé un changement de zone au § 0.9 — il
 * n'existe pas.
 */
function computeConsistency(lapSecondsList: number[]): number | null {
  return computeRegularite(lapSecondsList);
}

/**
 * Smoothness : stddev des G_lat max par tour, mappé sur [0, 100], ou `null`
 * quand moins de DEUX tours portent une mesure.
 * stddev ≤ 0.05 g → 100 (transitions très constantes)
 * stddev ≥ 0.55 g → 0 (transitions très variables)
 *
 * Les tours SANS mesure sont écartés, jamais convertis en 0 g. Le `?? 0` d'avant
 * était la dernière fabrication du write-path : `laps.max_g_lateral` n'était
 * écrit par personne, tous les tours entraient donc à 0, l'écart-type valait 0,
 * et la fluidité sortait à 100 sur 100 % des séances réelles — ~24 % de la marge
 * globale (0,6 × 0,4) adossés à rien. Une dispersion de zéros identiques n'est
 * pas un pilotage d'une constance parfaite : c'est une absence de données.
 */
function computeSmoothness(laps: Lap[]): number | null {
  const measured = laps
    .map((l) => toFiniteNumber(l.max_g_lateral))
    .filter((v): v is number => v !== null);
  // Une dispersion demande deux points. Sous ce seuil il n'y a rien à dire —
  // et surtout pas « 100 ».
  if (measured.length < 2) return null;
  const stddev = standardDeviation(measured);
  return clampMargin(100 - Math.max(0, stddev - 0.05) * 200);
}

/**
 * Nombre exploitable, ou `null`. Couvre l'`undefined` (SELECT partiel casté en
 * `Lap`), le NULL de base, et une valeur corrompue — un trou, quelle qu'en soit
 * la forme, ne devient jamais une valeur.
 */
function toFiniteNumber(v: number | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function clampMargin(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}
