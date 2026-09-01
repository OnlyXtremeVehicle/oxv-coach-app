/**
 * LES ONZE FAITS DE SÉANCE QUI RESTAIENT SANS PRODUCTEUR — 01/09/2026.
 *
 * ===========================================================================
 * CE QUE CE FICHIER FERME
 * ===========================================================================
 *
 * `FaitsSeance` compte quatorze champs. Trois étaient lus par
 * `sourcesCompositionService` (`acquis`, `voixCoach`, `reperePiste`) ; les onze
 * autres n'avaient AUCUN producteur. Le moteur de composition était complet et
 * affamé : `composerPresentations` savait écarter soixante-cinq fiches faute de
 * données, sans que rien ne lui en apporte jamais.
 *
 * Ce module ne réécrit pas les trois qui existent — il les appelle. La règle du
 * dépôt vaut ici comme ailleurs : on branche, on ne redouble pas.
 *
 * ===========================================================================
 * CHAQUE FAIT A ÉTÉ CHERCHÉ, PUIS SOUMIS À RÉFUTATION
 * ===========================================================================
 *
 * Une première lecture a proposé une source pour huit des onze. Une seconde,
 * adverse, en a rabaissé huit — parce que la source n'existait pas telle que
 * citée, parce qu'elle n'était pas lisible sous la RLS du pilote, ou parce
 * qu'elle établissait un fait VOISIN.
 *
 * C'est le second cas qui compte le plus, et il revient partout : une source
 * approximative se lit comme une source. La fiche s'ouvre, montre du vide, et
 * personne ne sait dire pourquoi. Un `false` honnête coûte une carte ; un
 * `true` approximatif coûte la confiance dans toutes les autres.
 *
 * ===========================================================================
 * SIX RESTENT FAUX. CE N'EST PAS UN ÉCHEC DE LOT
 * ===========================================================================
 *
 * C'est l'état du produit, et le moteur sait déjà l'énoncer : `ecartees` porte
 * le motif de chaque fiche fermée. Le jour où une source apparaît, elle se
 * branche ici et les fiches s'ouvrent d'elles-mêmes.
 */

import type { FaitsSeance } from '@/features/presentations/compositionLogic';
import {
  lireFaitsHumains,
  lireReperePiste,
} from '@/features/presentations/sourcesCompositionService';
import { supabase } from '@/lib/supabase';
import { compterPointsTrace } from '@/services/circuitsService';
import { consignePorteSurSeance } from '@/services/coachConsignesService';
import { referenceDisponible } from '@/services/referencesPartageesService';
import { POINTS_TRACE_MIN } from '@/trackviz/pisteDepuisBase';

/**
 * Le passage est-il situé sur le tracé ?
 *
 * ---------------------------------------------------------------------------
 * DEUX LECTURES POSSIBLES, ET CELLE QUE LE REGISTRE TRANCHE
 * ---------------------------------------------------------------------------
 *
 * P05 lit ce champ comme « le tracé DU CIRCUIT est affichable » — sa fiche vit
 * au moment `avant`, quand aucune trame du run n'existe encore. L'écran de
 * séance le lit comme « le GPS DU RUN existe ». Un seul booléen pour deux
 * choses différentes, et l'alimenter par l'une rendrait l'autre fausse.
 *
 * Le registre tranche, et ce n'est pas une hypothèse : `trace-position` est
 * rangée dans `DONNEES_MESUREES`, donc retirée quand la confiance de mesure est
 * faible. Une géométrie de circuit ne dépend pas de la confiance d'un tour ;
 * une trace de run, si. Le champ décrit donc le RUN.
 *
 * ---------------------------------------------------------------------------
 * DEUX POSITIONS DISTINCTES, PAS UNE DE PLUS
 * ---------------------------------------------------------------------------
 *
 * `construireIndex` refuse trois choses : moins de deux points, moins de deux
 * points FINIS, et une longueur totale nulle. Deux positions distinctes
 * franchissent les trois.
 *
 * On n'exige PAS que le run tombe sur le circuit qui lui est rattaché : le
 * dépôt ne porte aucun recalage run/centerline, et le vérifier serait établir
 * un fait que personne ne mesure.
 *
 * On ne lit PAS `telemetry_sessions.total_frames` : la colonne ment. Deux
 * séances de production annoncent 1 145 et 258 trames pour zéro trame réelle.
 */
export async function lireTracePosition(captureId: string): Promise<boolean> {
  if (typeof captureId !== 'string' || captureId.length === 0) return false;

  const { data, error } = await supabase
    .from('telemetry_frames')
    .select('latitude, longitude')
    .eq('session_id', captureId)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('elapsed_ms', { ascending: true })
    .limit(200);

  if (error) {
    console.warn('[OXV][composition] lireTracePosition :', error.message);
    return false;
  }
  if (!Array.isArray(data) || data.length < 2) return false;

  const premier = data[0] as { latitude: unknown; longitude: unknown };
  return data.some((ligne) => {
    const p = ligne as { latitude: unknown; longitude: unknown };
    return p.latitude !== premier.latitude || p.longitude !== premier.longitude;
  });
}

/**
 * Le TRACÉ DU CIRCUIT est-il affichable ?
 *
 * ---------------------------------------------------------------------------
 * CE QUE LE PARTAGE DU 01/09 A CHANGÉ
 * ---------------------------------------------------------------------------
 *
 * Ce fait vivait confondu avec `tracePosition`. Les deux se ressemblent, et la
 * confusion se payait sur P05 : sa fiche vit au moment « avant », quand aucune
 * trame n'existe encore, et elle restait donc fermée sur toute séance — quel
 * que soit le circuit.
 *
 * C'est le multi-circuit qui l'a rendu visible. Ce qui varie d'un circuit à
 * l'autre, c'est justement de savoir s'il porte un tracé : Bouteville 139
 * points, le Bugatti 589, Albi 138, un circuit neuf aucun. Ce fait-là ne
 * dépend ni d'un tour, ni d'une trame, ni d'une confiance de mesure.
 *
 * ---------------------------------------------------------------------------
 * LE SEUIL EST CELUI DE LA LECTURE, PAS UN CHOIX NEUF
 * ---------------------------------------------------------------------------
 *
 * `parseCenterline` refuse un tracé de trois points ou moins, et
 * `cordesDepuisCenterline` fait de même. On reprend ce plancher plutôt que d'en
 * inventer un second : un tracé que l'application refuse de charger n'est pas
 * un tracé affichable, et le dire deux fois avec deux nombres différents
 * finirait par diverger.
 */
export async function lireTraceCircuit(circuitId: string | null): Promise<boolean> {
  if (circuitId === null) return false;
  return (await compterPointsTrace(circuitId)) >= POINTS_TRACE_MIN;
}

/**
 * Un coach est-il rattaché au compte de ce pilote ?
 *
 * `coach_pilots` porte DEUX marqueurs d'état, et il faut les deux : `status`
 * (`pending | active | declined | ended`) et le booléen `active`. Une
 * affiliation `pending` est une demande, pas un rattachement — ouvrir sur elle
 * les douze fiches qui dépendent de ce champ montrerait au pilote un coach
 * qu'il n'a pas.
 *
 * La RLS fait le reste : `coach_pilots_select_own_pilot` limite déjà la lecture
 * aux lignes du pilote courant. On ne la rejoue pas en TypeScript — deux copies
 * de la même règle finissent par diverger, et c'est celle du TypeScript qui
 * mentirait.
 */
export async function lireCoachLie(piloteId: string): Promise<boolean> {
  if (typeof piloteId !== 'string' || piloteId.length === 0) return false;

  const { data, error } = await supabase
    .from('coach_pilots')
    .select('id')
    .eq('pilot_id', piloteId)
    .eq('status', 'active')
    .eq('active', true)
    .limit(1);

  if (error) {
    console.warn('[OXV][composition] lireCoachLie :', error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

/**
 * Les bornes de la JOURNÉE LOCALE qui contient cet instant. Logique pure.
 *
 * Une journée de roulage change de jour à minuit LOCAL, pas à minuit UTC. La
 * séance de référence le démontre : elle commence le 12/08 à 23 h 35 UTC,
 * c'est-à-dire le 13/08 à 1 h 35 en France. Compter en UTC la rangerait un jour
 * trop tôt, et deux runs d'une même nuit tomberaient dans deux journées.
 *
 * Le fuseau retenu est celui de l'APPAREIL — décision du fondateur, la même que
 * pour tout ce que l'application date. Les bornes se calculent en local puis se
 * convertissent pour la requête : la base, elle, ne connaît que l'instant.
 */
export function bornesJourneeLocale(debut: string | null): { de: string; a: string } | null {
  if (typeof debut !== 'string' || debut.length === 0) return null;
  const instant = new Date(debut);
  if (Number.isNaN(instant.getTime())) return null;

  const minuit = new Date(instant.getFullYear(), instant.getMonth(), instant.getDate());
  const lendemain = new Date(minuit);
  lendemain.setDate(lendemain.getDate() + 1);
  return { de: minuit.toISOString(), a: lendemain.toISOString() };
}

/**
 * Combien de runs ce pilote a-t-il faits ce jour-là, celui-ci compris ?
 *
 * Aucune restriction de circuit : le champ dit « les runs de la journée », et
 * une journée de piste peut en changer.
 *
 * `0` quand la date est illisible. Le seuil du registre est `>= 2` : un compte
 * indisponible ferme la lecture au lieu de l'ouvrir sur une supposition.
 */
export async function lireRunsDeLaJournee(entree: {
  piloteId: string;
  debutSeance: string | null;
}): Promise<number> {
  const { piloteId, debutSeance } = entree;
  if (typeof piloteId !== 'string' || piloteId.length === 0) return 0;

  const bornes = bornesJourneeLocale(debutSeance);
  if (bornes === null) return 0;

  const { count, error } = await supabase
    .from('telemetry_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', piloteId)
    .gte('started_at', bornes.de)
    .lt('started_at', bornes.a);

  if (error) {
    console.warn('[OXV][composition] lireRunsDeLaJournee :', error.message);
    return 0;
  }
  return typeof count === 'number' && count > 0 ? count : 0;
}

/**
 * L'avancement du traitement de ce run est-il connu ? Logique pure.
 *
 * Lecture ÉTROITE et assumée : la séance porte un statut lisible et ARRÊTÉ.
 * `completed` et `aborted` sont les deux valeurs de la production — onze et
 * neuf lignes au 01/09/2026 — et l'une comme l'autre dit où en est le run.
 *
 * Ce qu'on ne prétend PAS établir : une file d'attente de traitement. Elle
 * n'existe nulle part en base ; le suivi de synchronisation vit dans le
 * stockage local de l'appareil, et un fait de séance lu par le moteur ne peut
 * pas dépendre de l'appareil qui l'ouvre.
 */
export function lireEtatTraitement(statutSeance: string | null): boolean {
  return statutSeance === 'completed' || statutSeance === 'aborted';
}

/**
 * LES SIX FAITS QUI RESTENT FAUX, ET LA RAISON DE CHACUN.
 *
 * Ils sont rassemblés dans une constante plutôt qu'en six fonctions rendant
 * `false` : une fonction laisserait croire qu'elle lit quelque chose.
 *
 *   `santeChaine` — rien n'est PERSISTÉ. `getCaptureLinkStatus` rend l'état
 *   vivant de la liaison, en mémoire, pendant la capture ; après coup il n'en
 *   reste rien. `battery_level` est bien un relevé du boîtier, mais une charge
 *   n'est pas la santé d'une chaîne : la servir ainsi ouvrirait P64 sur un seul
 *   de ses six membres.
 *
 *   `video` — `video_overlays` existe et porte le décalage d'alignement. Le lot
 *   qui RATTACHE une vidéo à un run n'est pas branché : aucune surface n'y
 *   écrit. Le champ exige rattachée ET alignée ; la table n'établit que la
 *   seconde moitié.
 *
 *   `canauxVehicule` — le boîtier RaceBox Mini ne porte ni CAN ni OBD, et rien
 *   d'autre ne les fournit. Piège nommé : `session_insights.throttle_brake`
 *   porte un nom de pédales et n'en est pas un — c'est une dérivée du G
 *   longitudinal, calculée. La lire comme un canal véhicule ferait passer un
 *   calcul pour une mesure.
 *
 *   (`referencePartagee` A QUITTÉ CETTE LISTE le 01/09/2026. Le fondateur a
 *   tranché en QCM pour la construire avant Le Mans, et le cahier de veille
 *   spécifiait déjà M09 avec sa propre limite : « partage inter-pilotes
 *   autorisé, équitable, révocable et anonymisable ». `session_references`
 *   tient les trois, et `referenceDisponible` la lit.)
 *
 *   `live` / `flotteLive` — le direct a été RETIRÉ du périmètre par arbitrage.
 *   Le chemin technique subsiste dans le dépôt, écrit et testé ; il n'est pas
 *   une source tant que la décision tient.
 *
 * (`consigneCoach` A QUITTÉ CETTE LISTE le 01/09/2026. Elle y était pour la
 * bonne raison — `coach_annotations` établit qu'une NOTE porte sur la séance,
 * et une note n'est pas une consigne — et le fondateur a tranché en QCM contre
 * les deux replis : ni fermer, ni ouvrir sur la note. La table `coach_consignes`
 * existe depuis, et `consignePorteSurSeance` la lit.)
 */
export const FAITS_SANS_SOURCE = {
  santeChaine: false,
  video: false,
  canauxVehicule: false,
  live: false,
  flotteLive: false,
} as const;

/** Ce dont `lireFaitsSeance` a besoin, et qui vient de la ligne de séance. */
export interface EntreeFaitsSeance {
  piloteId: string;
  captureId: string;
  /** `telemetry_sessions.circuit_id`. `null` = séance sans circuit rattaché. */
  circuitId: string | null;
  /** `telemetry_sessions.started_at`, tel que la base le rend. */
  debutSeance: string | null;
  /** `telemetry_sessions.status`. */
  statutSeance: string | null;
}

/**
 * Les quatorze faits d'une séance, lus en parallèle.
 *
 * Ne rejette JAMAIS : chaque lecteur avale sa propre panne et rend le repli
 * fermé. Un débrief ne tombe pas parce qu'une table n'a pas répondu — il
 * compose une carte de moins, et `ecartees` dit laquelle.
 */
export async function lireFaitsSeance(entree: EntreeFaitsSeance): Promise<FaitsSeance> {
  const { piloteId, captureId, circuitId, debutSeance, statutSeance } = entree;

  const [
    humains,
    tracePosition,
    traceCircuit,
    consigneCoach,
    referencePartagee,
    coachLie,
    reperePiste,
    runsDeLaJournee,
  ] = await Promise.all([
    lireFaitsHumains({ piloteId, captureId }),
    lireTracePosition(captureId),
    lireTraceCircuit(circuitId),
    consignePorteSurSeance(captureId),
    referenceDisponible(),
    lireCoachLie(piloteId),
    circuitId !== null ? lireReperePiste({ piloteId, circuitId }) : Promise.resolve(false),
    lireRunsDeLaJournee({ piloteId, debutSeance }),
  ]);

  return {
    ...FAITS_SANS_SOURCE,
    tracePosition,
    traceCircuit,
    consigneCoach,
    referencePartagee,
    etatTraitement: lireEtatTraitement(statutSeance),
    coachLie,
    voixCoach: humains.voixCoach,
    reperePiste,
    acquis: humains.acquis,
    runsDeLaJournee,
  };
}
