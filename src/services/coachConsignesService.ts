/**
 * LES CONSIGNES DU COACH — lecture et écriture. Migration du 01/09/2026.
 *
 * ===========================================================================
 * ELLE EST LA PAROLE DU COACH, PAS CELLE DE L'APPLICATION
 * ===========================================================================
 *
 * Une première version filtrait cette table comme les notes partagées : aucun
 * verbe d'ordre, aucune causalité. C'ÉTAIT FAUX, et le dépôt le disait déjà —
 * `CoachBand.tsx`, en tête de fichier, bien avant cette table :
 *
 *   « SEUL espace prescriptif de l'application. Partout ailleurs, l'app est un
 *     miroir : elle énonce des faits, jamais des consignes. Ici, et ici
 *     seulement, le coach (humain, BPJEPS) a droit aux verbes d'ordre et à la
 *     causalité. Le marquage rouge + "De votre coach" signale sans ambiguïté
 *     que ce qui suit vient d'un tiers et n'est pas une lecture automatique. »
 *
 * La retenue doctrinale protège l'APPLICATION — elle l'empêche de conseiller,
 * et c'est elle qui tient OXV hors du champ de l'enseignement du pilotage. Un
 * coach diplômé, lui, EXERCE ce droit. L'application ne fait que porter sa
 * parole.
 *
 * CE QUI REMPLACE LE FILTRE : l'ATTRIBUTION. Une consigne ne se rend JAMAIS
 * dans la voix de l'application — elle se lit dans `CoachBand`, marquée,
 * nommée. Cela ne se contraint pas en SQL ; c'est un contrat de surface, et
 * `consigneAttribuee.guard.test.ts` le tient.
 *
 * `coach_annotation_doctrine_guard` reste, lui, et ce n'est pas une
 * incohérence : une NOTE s'affiche sur les feuilles de données du pilote, où
 * la règle « aucune consigne » vaut ; une CONSIGNE s'affiche dans la bande
 * coach, où elle ne vaut pas. Deux régimes, deux surfaces.
 *
 * ===========================================================================
 * SEPT FICHES L'ATTENDAIENT, ET AUCUNE NE VOULAIT D'UNE NOTE
 * ===========================================================================
 *
 * `coach_annotations` établit qu'un coach a ÉCRIT sur la séance. P39 demande
 * « Que dois-je modifier, et rien d'autre ? », P43 « Est-ce que l'action a
 * fonctionné ? », P44 « Pourquoi ne peut-on pas conclure ? ». Une note ne
 * répond à aucune des trois : elle n'a ni unicité, ni résultat, ni séance
 * d'observation.
 *
 * Le fondateur a tranché le 01/09 contre les deux replis — laisser fermé, ou
 * ouvrir sur la note. C'est la table qui a été demandée.
 *
 * ===========================================================================
 * TROIS RÈGLES TENUES PAR LA BASE, PAS PAR CE FICHIER
 * ===========================================================================
 *
 *   • UNE SEULE consigne ouverte par pilote (index unique partiel) — P39.
 *   • Le coach n'écrit que pour un pilote dont il est réellement le coach
 *     (`is_coach_of` dans la politique d'insertion).
 *   • Le pilote ne modifie QUE sa confirmation de compréhension (trigger).
 *
 * Aucune n'est rejouée ici. Deux copies de la même règle finissent par
 * diverger, et c'est celle du TypeScript qui mentirait — elle n'est opposable
 * à personne.
 */

import { supabase } from '@/lib/supabase';

/**
 * `as never` sur `.from()` : `coach_consignes` n'est pas encore dans
 * `database.types.ts`. C'est le motif maison — la requête est correcte, le
 * typage du client ne connaît pas encore la table. Il disparaîtra à la
 * prochaine régénération des types.
 */

/** Une consigne, telle que les écrans la lisent. */
export interface ConsigneCoach {
  id: string;
  coachId: string;
  pilotId: string;
  /** La séance qui l'a motivée. `null` = consigne de programme. */
  sessionId: string | null;
  /** Le virage visé, base 1. `null` = la séance entière. */
  cornerIndex: number | null;
  body: string;
  /** P37 — instant où le pilote a confirmé avoir compris. */
  compriseLe: string | null;
  /** P43/P44 — la séance où le résultat se lit. */
  observeeSessionId: string | null;
  observeeLe: string | null;
  closedAt: string | null;
  createdAt: string;
}

const COLS =
  'id, coach_id, pilot_id, session_id, corner_index, body, comprise_le, ' +
  'observee_session_id, observee_le, closed_at, created_at';

function mapConsigne(r: Record<string, unknown>): ConsigneCoach {
  return {
    id: r.id as string,
    coachId: r.coach_id as string,
    pilotId: r.pilot_id as string,
    sessionId: (r.session_id as string | null) ?? null,
    cornerIndex: r.corner_index === null ? null : Number(r.corner_index),
    body: r.body as string,
    compriseLe: (r.comprise_le as string | null) ?? null,
    observeeSessionId: (r.observee_session_id as string | null) ?? null,
    observeeLe: (r.observee_le as string | null) ?? null,
    closedAt: (r.closed_at as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

export interface ResultatConsigne {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Une consigne porte-t-elle sur CETTE séance ?
 *
 * Le fait `consigneCoach` du moteur de composition, réduit à un booléen : les
 * sept fiches demandent si la porte peut s'ouvrir, pas combien de consignes
 * existent. Compter en ferait un score.
 *
 * La séance compte des DEUX côtés : celle qui a motivé la consigne, et celle où
 * son résultat s'observe. P43 et P44 lisent la seconde, et fermer sur la
 * première seule les priverait de leur sujet.
 *
 * Ne rejette jamais : une lecture impossible rend `false`. Un débrief ne tombe
 * pas parce qu'une table n'a pas répondu.
 */
export async function consignePorteSurSeance(sessionId: string): Promise<boolean> {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return false;

  const { data, error } = await supabase
    .from('coach_consignes' as never)
    .select('id')
    .or(`session_id.eq.${sessionId},observee_session_id.eq.${sessionId}`)
    .limit(1);

  if (error) {
    console.warn('[OXV][consignes] consignePorteSurSeance :', error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

/**
 * La consigne OUVERTE de ce pilote, ou `null`.
 *
 * Il ne peut y en avoir qu'une — l'index unique partiel le tient — et c'est le
 * sujet même de P39 : « Que dois-je modifier, et rien d'autre ? »
 */
export async function consigneOuverte(pilotId: string): Promise<ConsigneCoach | null> {
  if (typeof pilotId !== 'string' || pilotId.length === 0) return null;

  const { data, error } = await supabase
    .from('coach_consignes' as never)
    .select(COLS)
    .eq('pilot_id', pilotId)
    .is('closed_at', null)
    .limit(1);

  if (error) {
    console.warn('[OXV][consignes] consigneOuverte :', error.message);
    return null;
  }
  const ligne = (data ?? [])[0];
  return ligne ? mapConsigne(ligne as Record<string, unknown>) : null;
}

/** Les consignes qui portent sur une séance, des deux côtés, les plus récentes d'abord. */
export async function consignesDeSeance(sessionId: string): Promise<ConsigneCoach[]> {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return [];

  const { data, error } = await supabase
    .from('coach_consignes' as never)
    .select(COLS)
    .or(`session_id.eq.${sessionId},observee_session_id.eq.${sessionId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[OXV][consignes] consignesDeSeance :', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapConsigne(r as Record<string, unknown>));
}

/**
 * Le coach pose une consigne.
 *
 * UN refus vient de la base et arrive ici traduit, parce qu'il ne se devine
 * pas : une consigne est déjà ouverte pour ce pilote — c'est P39, « un seul
 * changement », tenu par un index unique partiel.
 *
 * Le corps, lui, n'est PLUS filtré : c'est la parole d'un coach diplômé, et
 * elle a droit aux verbes d'ordre. Voir l'en-tête.
 */
export async function poserConsigne(entree: {
  pilotId: string;
  sessionId: string | null;
  cornerIndex: number | null;
  body: string;
}): Promise<ResultatConsigne> {
  const { data: auth } = await supabase.auth.getUser();
  const coachId = auth?.user?.id;
  if (!coachId) return { ok: false, error: 'Session expirée.' };

  const texte = entree.body.trim();
  if (texte.length === 0) return { ok: false, error: 'Consigne vide.' };

  const { data, error } = await supabase
    .from('coach_consignes' as never)
    .insert({
      coach_id: coachId,
      pilot_id: entree.pilotId,
      session_id: entree.sessionId,
      corner_index: entree.cornerIndex,
      body: texte,
    } as never)
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.message.includes('coach_consignes_une_ouverte_par_pilote')) {
      return {
        ok: false,
        error: 'Ce pilote a déjà une consigne ouverte. Fermez-la avant d’en poser une autre.',
      };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, id: (data as { id?: string } | null)?.id };
}

/**
 * P37 — le PILOTE confirme avoir compris.
 *
 * Le geste lui appartient : le trigger `coach_consigne_pilote_ne_change_que_
 * comprise` refuse toute autre modification venant de lui. On n'écrit donc
 * qu'une colonne, et on la laisse refuser si elle est déjà posée — une
 * compréhension ne se confirme pas deux fois.
 */
export async function confirmerComprehension(consigneId: string): Promise<ResultatConsigne> {
  const { error } = await supabase
    .from('coach_consignes' as never)
    .update({ comprise_le: new Date().toISOString() } as never)
    .eq('id', consigneId)
    .is('comprise_le', null);

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: consigneId };
}

/**
 * Le coach clôt une consigne, en nommant la séance où il a lu le résultat.
 *
 * `observeeSessionId` peut être `null`, et c'est P44 : « Pourquoi ne peut-on
 * pas conclure ? » Une consigne close sans séance d'observation est un travail
 * arrêté sans verdict — un état réel, que la fiche existe pour montrer.
 */
export async function cloreConsigne(entree: {
  consigneId: string;
  observeeSessionId: string | null;
}): Promise<ResultatConsigne> {
  const maintenant = new Date().toISOString();
  const { error } = await supabase
    .from('coach_consignes' as never)
    .update({
      closed_at: maintenant,
      observee_session_id: entree.observeeSessionId,
      observee_le: entree.observeeSessionId === null ? null : maintenant,
    } as never)
    .eq('id', entree.consigneId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: entree.consigneId };
}
