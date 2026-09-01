/**
 * LES RÉFÉRENCES PARTAGÉES — M09, « Gestionnaire de références ».
 *
 * ===========================================================================
 * TROIS ADJECTIFS QUI SONT DES CONTRAINTES
 * ===========================================================================
 *
 * Le cahier de veille spécifie M09 et porte sa propre limite : *« Partage
 * inter-pilotes autorisé, ÉQUITABLE, RÉVOCABLE et ANONYMISABLE. »* Chacun est
 * tenu en base, pas ici :
 *
 *   • ÉQUITABLE — sans `consent_owner_at`, la référence n'existe pour aucune
 *     lecture. Le coach publie ce qui lui est confié ; il ne dispose pas du
 *     tour d'un pilote.
 *   • RÉVOCABLE — `revoked_at`. Le pilote coupe sans demander, et la référence
 *     sort des lectures à l'instant même.
 *   • ANONYMISABLE — `anonyme`, VRAI par défaut. Le brief est plus strict que
 *     le cahier : « jamais à un autre pilote nommé, teammate compris ».
 *
 * ===========================================================================
 * CE MODULE NE CALCULE AUCUNE COMPARABILITÉ
 * ===========================================================================
 *
 * M09 demande un score — « configuration, véhicule, conditions, date, qualité
 * et niveau ; blocage des incompatibilités ». Il EXISTE déjà :
 * `features/coach/comparabiliteLogic`, livré au lot 4, avec son verdict et son
 * blocage sur circuits différents. On le branche le jour où un écran de
 * références s'ouvre ; on ne le réécrit pas.
 *
 * ===========================================================================
 * CE QUE CE MODULE NE REND JAMAIS
 * ===========================================================================
 *
 * Le NOM du propriétaire. Pas même quand `anonyme` est faux — il faudrait
 * alors le lire dans `users`, et aucun appelant d'aujourd'hui n'en a besoin.
 * Le jour où un écran l'affichera, ce sera un geste explicite, avec sa garde.
 */

import { supabase } from '@/lib/supabase';

/**
 * `as never` sur `.from()` : `session_references` n'est pas encore dans
 * `database.types.ts`. Motif maison — la requête est correcte, le typage du
 * client ne connaît pas encore la table.
 */

/** À qui une référence est offerte. Jamais « tout le monde ». */
export type PorteeReference = 'coach_seul' | 'pilotes_du_coach' | 'ecurie';

/** Une référence, telle qu'un écran la lit. Sans identité de propriétaire. */
export interface ReferencePartagee {
  id: string;
  sessionId: string;
  /** `null` = la séance entière. */
  lapNumber: number | null;
  /** Ce que le coach dit qu'elle démontre. Obligatoire en base. */
  demontre: string;
  portee: PorteeReference;
  anonyme: boolean;
  /** `null` tant que le propriétaire n'a pas consenti — donc invisible. */
  consentLe: string | null;
  revoqueeLe: string | null;
  creeLe: string;
}

const COLS =
  'id, session_id, lap_number, demontre, portee, anonyme, ' +
  'consent_owner_at, revoked_at, created_at';

function mapReference(r: Record<string, unknown>): ReferencePartagee {
  return {
    id: r.id as string,
    sessionId: r.session_id as string,
    lapNumber: r.lap_number === null ? null : Number(r.lap_number),
    demontre: r.demontre as string,
    portee: r.portee as PorteeReference,
    anonyme: Boolean(r.anonyme),
    consentLe: (r.consent_owner_at as string | null) ?? null,
    revoqueeLe: (r.revoked_at as string | null) ?? null,
    creeLe: r.created_at as string,
  };
}

export interface ResultatReference {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Une référence publiée ET consentie est-elle disponible pour ce lecteur ?
 *
 * C'est le fait `referencePartagee` du moteur de composition, réduit à un
 * booléen. La RLS fait tout le travail de portée : elle ne rend que ce que ce
 * lecteur a le droit de voir. On ne rejoue pas ses règles ici.
 *
 * Les deux conditions de vie sont explicites dans la requête plutôt que
 * laissées à la politique : une référence non consentie ou révoquée n'existe
 * pour personne, et l'écrire ici le dit à qui lit ce code.
 *
 * Ne rejette jamais : une lecture impossible rend `false`.
 */
export async function referenceDisponible(): Promise<boolean> {
  const { data, error } = await supabase
    .from('session_references' as never)
    .select('id')
    .not('consent_owner_at', 'is', null)
    .is('revoked_at', null)
    .limit(1);

  if (error) {
    console.warn('[OXV][references] referenceDisponible :', error.message);
    return false;
  }
  return Array.isArray(data) && (data as unknown[]).length > 0;
}

/** Les références vivantes visibles par ce lecteur, les plus récentes d'abord. */
export async function referencesVivantes(): Promise<ReferencePartagee[]> {
  const { data, error } = await supabase
    .from('session_references' as never)
    .select(COLS)
    .not('consent_owner_at', 'is', null)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[OXV][references] referencesVivantes :', error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map(mapReference);
}

/**
 * Les références qui portent MA donnée — consenties ou non, révoquées ou non.
 *
 * C'est l'écran par lequel un pilote consent et révoque. Il doit donc voir ce
 * qui l'attend, pas seulement ce qui est déjà vivant : une référence en attente
 * de consentement qu'on ne montrerait pas serait un accord arraché par le
 * silence.
 */
export async function mesReferences(pilotId: string): Promise<ReferencePartagee[]> {
  if (typeof pilotId !== 'string' || pilotId.length === 0) return [];

  const { data, error } = await supabase
    .from('session_references' as never)
    .select(COLS)
    .eq('owner_id', pilotId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[OXV][references] mesReferences :', error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map(mapReference);
}

/**
 * Le coach publie une référence.
 *
 * Elle naît SANS consentement : c'est le propriétaire qui l'accordera, et
 * jusque-là elle n'est lue par personne d'autre que lui et le coach qui l'a
 * posée. C'est l'« équitable » de M09, et il vaut mieux qu'une case à cocher
 * côté coach — un consentement qu'on peut donner pour autrui n'en est pas un.
 */
export async function publierReference(entree: {
  sessionId: string;
  ownerId: string;
  lapNumber: number | null;
  demontre: string;
  portee: PorteeReference;
  anonyme: boolean;
}): Promise<ResultatReference> {
  const { data: auth } = await supabase.auth.getUser();
  const coachId = auth?.user?.id;
  if (!coachId) return { ok: false, error: 'Session expirée.' };

  const phrase = entree.demontre.trim();
  if (phrase.length === 0) {
    return { ok: false, error: 'Dites ce que cette référence démontre.' };
  }

  const { data, error } = await supabase
    .from('session_references' as never)
    .insert({
      session_id: entree.sessionId,
      owner_id: entree.ownerId,
      published_by: coachId,
      lap_number: entree.lapNumber,
      demontre: phrase,
      portee: entree.portee,
      anonyme: entree.anonyme,
    } as never)
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as { id?: string } | null)?.id };
}

/** Le propriétaire accorde son consentement. Sans lui, rien n'est lisible. */
export async function consentirReference(referenceId: string): Promise<ResultatReference> {
  const { error } = await supabase
    .from('session_references' as never)
    .update({ consent_owner_at: new Date().toISOString(), revoked_at: null } as never)
    .eq('id', referenceId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: referenceId };
}

/**
 * Le propriétaire révoque.
 *
 * Sans condition, sans délai, sans motif à donner. Une révocation qu'il faut
 * justifier n'est pas une révocation.
 */
export async function revoquerReference(referenceId: string): Promise<ResultatReference> {
  const { error } = await supabase
    .from('session_references' as never)
    .update({ revoked_at: new Date().toISOString() } as never)
    .eq('id', referenceId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: referenceId };
}
