/**
 * L'ENTRÉE DU MOTEUR DE COMPOSITION, ASSEMBLÉE DEPUIS LA BASE — 01/09/2026.
 *
 * ===========================================================================
 * CE QUE CE FICHIER FERME
 * ===========================================================================
 *
 * `composerPresentations` demande cinq choses : qui lit, ce que le pilote a
 * vécu, ce qu'il a dit vouloir, ce que la séance permet de lire, et le travail
 * qu'il a en cours. Le lot 9a a livré le moteur ; personne ne lui a jamais
 * apporté ces cinq choses, et il est resté dormant six semaines.
 *
 * Ce module ne calcule rien. Il LIT, et il assemble. Chaque morceau vient d'un
 * lecteur qui existait déjà — `lireFaitsSeance`, `lirePresentationsVues`,
 * `lireTravailActif`, `loadEtatSeance`, `getIntentionForSession` — ou d'une
 * requête d'agrégat écrite ici et nulle part ailleurs.
 *
 * ===========================================================================
 * DEUX ENTRÉES RESTENT NULLES, ET CE N'EST PAS UN OUBLI
 * ===========================================================================
 *
 * `souhait.theme` et `souhait.ressenti` viennent du QCM d'entre-runs, et une
 * première rédaction de cet en-tête affirmait qu'aucune table ne les gardait.
 * C'ÉTAIT FAUX, et la vérification l'a montré le jour même : l'écran
 * `rec/entre-runs` appelle `addNote(body, sessionId, { theme, ressenti })`
 * depuis le 12/08, et `pilot_notes` porte les deux colonnes — `theme` est même
 * CONTRAINTE en base sur les quatre valeurs de `ThemeQcm`.
 *
 * La leçon est celle que `pilotNotesService` avait déjà écrite pour lui-même :
 * un ajout de colonne se vérifie sur le trajet COMPLET, aller ET retour. Ici
 * le retour manquait au moteur, pas à la base.
 *
 * `ressenti`, lui, n'est pas contraint côté Postgres : la validation se fait
 * donc en TypeScript, contre `RESSENTIS`. Une valeur hors liste devient `null`
 * plutôt que d'entrer dans le moteur.
 *
 * `disponibilite.confiance` est DEMANDÉE à l'appelant, jamais devinée — et
 * `null` y veut dire « non évaluée », ce que le moteur sait lire. La note se
 * calcule sur les trames de qualité d'UN tour (`evaluerConfianceTour`), donc
 * après un choix de tour que l'entrée de composition n'a pas à faire. Celui qui
 * l'a déjà la passe ; les autres écrivent `null` et le disent. C'est le repli
 * SÛR : une note absente ne retient aucune donnée mesurée, alors qu'un
 * `'faible'` supposé les retirerait toutes.
 */

import {
  type EntreeComposition,
  type ExperiencePilote,
  type SurfaceLecteur,
} from '@/features/presentations/compositionLogic';
import { lireFaitsSeance } from '@/features/presentations/faitsSeanceService';
import {
  lirePresentationsVues,
  lireTravailActif,
} from '@/features/presentations/sourcesCompositionService';
import type { NiveauConfiance } from '@/features/data/confianceLogic';
import { supabase } from '@/lib/supabase';
import { getIntentionForSession } from '@/services/intentionsService';
import { lireQcmSeance } from '@/services/pilotNotesService';
import { loadEtatSeance, ETAT_SEANCE_VIDE } from '@/services/etatSeanceService';

/**
 * Plafond de séances relues pour l'agrégat d'expérience.
 *
 * On compte des journées et des circuits distincts, pas des lignes : il faut
 * donc les lire, et non demander un `count`. Deux cents séances couvrent
 * largement une saison ; au-delà, `journees` et `circuits` ne bougent plus
 * assez pour changer un plafond de lecture.
 */
export const SEANCES_RELUES_MAX = 200;

/** Une ligne de séance, réduite à ce que l'agrégat d'expérience lit. */
interface LigneSeance {
  started_at: string | null;
  circuit_id: string | null;
}

/** Le jour LOCAL d'un instant, sous la forme `AAAA-MM-JJ`. `null` si illisible. */
function jourLocal(instant: string | null): string | null {
  if (typeof instant !== 'string' || instant.length === 0) return null;
  const d = new Date(instant);
  if (Number.isNaN(d.getTime())) return null;
  const mois = String(d.getMonth() + 1).padStart(2, '0');
  const jour = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mois}-${jour}`;
}

/**
 * Ce que le pilote a déjà vécu.
 *
 * `journees` compte les JOURNÉES DE PISTE, pas les séances : la fiche P48
 * demande « Ai-je conservé ce que j'avais appris ? » au *prochain événement*,
 * et deux runs du même après-midi ne sont pas deux événements. Le jour est
 * LOCAL, pour la même raison qu'ailleurs — une nuit de roulage ne se coupe pas
 * à minuit UTC.
 *
 * Une panne rend une expérience VIDE, jamais une exception. Le pilote retombe
 * alors au flash, qui est le repli sûr du moteur.
 */
export async function lireExperience(piloteId: string): Promise<ExperiencePilote> {
  const vide: ExperiencePilote = { seances: 0, journees: 0, circuits: [], presentationsVues: [] };
  if (typeof piloteId !== 'string' || piloteId.length === 0) return vide;

  const [seancesR, vues] = await Promise.all([
    supabase
      .from('telemetry_sessions')
      .select('started_at, circuit_id')
      .eq('user_id', piloteId)
      .order('started_at', { ascending: false })
      .limit(SEANCES_RELUES_MAX),
    lirePresentationsVues(piloteId),
  ]);

  if (seancesR.error) {
    console.warn('[OXV][composition] lireExperience :', seancesR.error.message);
    return { ...vide, presentationsVues: vues };
  }

  const lignes = (seancesR.data ?? []) as LigneSeance[];
  const jours = new Set<string>();
  const circuits = new Set<string>();
  for (const l of lignes) {
    const j = jourLocal(l.started_at);
    if (j !== null) jours.add(j);
    if (typeof l.circuit_id === 'string' && l.circuit_id.length > 0) circuits.add(l.circuit_id);
  }

  return {
    seances: lignes.length,
    journees: jours.size,
    circuits: [...circuits],
    presentationsVues: vues,
  };
}

/** Ce dont l'assemblage a besoin, et qui vient de la ligne de séance. */
export interface EntreeAssemblage {
  surface: SurfaceLecteur;
  piloteId: string;
  captureId: string;
  circuitId: string | null;
  /** `telemetry_sessions.started_at`. */
  debutSeance: string | null;
  /** `telemetry_sessions.status`. */
  statutSeance: string | null;
  /**
   * La note de mesure, quand l'appelant l'a déjà calculée sur un tour.
   *
   * REQUISE, et `null` veut dire « non évaluée » — jamais « faible ». Elle
   * n'est pas optionnelle pour la raison que `FaitsSeance` donne déjà de tous
   * ses champs : une entrée optionnelle que personne ne renseigne devient un
   * repli invisible. L'appelant dit ce qu'il n'a pas.
   */
  confiance: NiveauConfiance | null;
}

/**
 * L'entrée complète du moteur, en une lecture.
 *
 * Tout part en parallèle : cinq lectures indépendantes, aucune ne bloque les
 * autres, et chacune porte son propre repli fermé. Un écran ne tombe pas
 * parce qu'une table n'a pas répondu — il compose une carte de moins, et
 * `ecartees` dit laquelle.
 */
export async function lireEntreeComposition(e: EntreeAssemblage): Promise<EntreeComposition> {
  const [experience, faits, etat, travailActif, intention, qcm] = await Promise.all([
    lireExperience(e.piloteId),
    lireFaitsSeance({
      piloteId: e.piloteId,
      captureId: e.captureId,
      circuitId: e.circuitId,
      debutSeance: e.debutSeance,
      statutSeance: e.statutSeance,
    }),
    loadEtatSeance(e.captureId).catch(() => ETAT_SEANCE_VIDE),
    lireTravailActif(e.piloteId),
    getIntentionForSession(e.captureId),
    lireQcmSeance(e.captureId),
  ]);

  /**
   * L'INTENTION EST LA CARTE, RÉDUITE À CE QUE LE MOTEUR EN LIT.
   *
   * `composerPlanDeRun` compose une carte complète — intention plus lignes de
   * contexte — pour l'écran d'avant-run. Le moteur, lui, ne regarde que
   * `plan.intention !== null`. Reconstruire la carte entière ici demanderait le
   * contexte du run (météo, véhicule, prévol) que la séance n'a plus après
   * coup, et produirait des lignes vides qui ne servent à personne.
   *
   * On rend donc la forme minimale et VRAIE : le texte posé par le pilote, ses
   * lignes de contexte laissées vides, et `vide` qui dit exactement s'il y a
   * quelque chose.
   */
  const texte = intention?.body?.trim();
  const plan =
    typeof texte === 'string' && texte.length > 0
      ? { version: 'plan-de-run-lu-1.0.0', intention: texte, lignes: [], vide: false }
      : null;

  return {
    surface: e.surface,
    experience,
    souhait: { plan, theme: qcm.theme, ressenti: qcm.ressenti },
    disponibilite: { etat, confiance: e.confiance ?? null, faits },
    travailActif,
  };
}
