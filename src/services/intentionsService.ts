/**
 * Service Intention de séance (table `session_intentions`, V9 §7).
 *
 * L'intention se pose AVANT la séance (en préparation : `session_id` null), puis
 * se rattache à la séance à sa création. Elle sert ensuite à juxtaposer « ce que
 * je voulais explorer » et « ce que la trace raconte » — le pilote conclut,
 * jamais l'app.
 *
 * Own-row strict (RLS). L'app n'écrit, ne pré-remplit ni ne suggère JAMAIS le
 * contenu : ce service ne fait que stocker et relire ce que le pilote a écrit.
 * Partage opt-in (`shared_with_coach`) en lecture seule vers le coach consenti ;
 * le partenaire n'accède jamais (cardinale §148).
 */

import { supabase } from '@/lib/supabase';

import { isPendingFresh, normalizeIntention } from './intentionLogic';

export interface SessionIntention {
  id: string;
  circuitId: string | null;
  sessionId: string | null;
  body: string;
  sharedWithCoach: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MutationResult {
  ok: boolean;
  id?: string;
  error?: string;
}

const COLS = 'id, circuit_id, session_id, body, shared_with_coach, created_at, updated_at';

function mapIntention(r: Record<string, unknown>): SessionIntention {
  return {
    id: r.id as string,
    circuitId: (r.circuit_id as string | null) ?? null,
    sessionId: (r.session_id as string | null) ?? null,
    body: r.body as string,
    sharedWithCoach: Boolean(r.shared_with_coach),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

/**
 * L'intention « en attente » du pilote (posée en prépa, pas encore rattachée),
 * la plus récente ET encore fraîche (fenêtre 24 h). NON filtrée par circuit
 * volontairement : la prépa et le lancement de capture peuvent dériver le
 * circuit différemment (défaut vs choisi) — le rattachement doit suivre le
 * pilote, pas le circuit. La RLS own-row borne déjà au pilote courant. La borne
 * de fraîcheur évite de ressortir une vieille intention jamais consommée.
 */
export async function getPendingIntention(): Promise<SessionIntention | null> {
  const { data, error } = await supabase
    .from('session_intentions')
    .select(COLS)
    .is('session_id', null)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    console.warn('[OXV][intention] getPendingIntention :', error.message);
    return null;
  }
  const row = (data ?? [])[0];
  if (!row) return null;
  const intention = mapIntention(row as Record<string, unknown>);
  return isPendingFresh(intention.createdAt, Date.now()) ? intention : null;
}

/**
 * Enregistre l'intention en attente pour un circuit. Met à jour la dernière en
 * attente si elle existe (le pilote corrige son texte), sinon en crée une. Le
 * texte vient du pilote ; on le borne seulement (normalizeIntention).
 */
export async function savePendingIntention(input: {
  circuitId: string | null;
  body: string;
  sharedWithCoach: boolean;
}): Promise<MutationResult> {
  const body = normalizeIntention(input.body);
  if (!body) return { ok: false, error: 'Intention vide.' };

  const existing = await getPendingIntention();
  if (existing) {
    // Met à jour la même ligne (le pilote corrige son texte) et reflète le
    // circuit courant, sans dupliquer.
    const { error } = await supabase
      .from('session_intentions')
      .update({
        body,
        shared_with_coach: input.sharedWithCoach,
        circuit_id: input.circuitId,
      } as never)
      .eq('id', existing.id);
    return error ? { ok: false, error: error.message } : { ok: true, id: existing.id };
  }

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Session expirée.' };

  const { data, error } = await supabase
    .from('session_intentions')
    .insert({
      user_id: uid,
      circuit_id: input.circuitId,
      body,
      shared_with_coach: input.sharedWithCoach,
    } as never)
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Enregistrement impossible.' };
  return { ok: true, id: (data as { id: string }).id };
}

/**
 * Partage / retire le partage d'une intention avec le coach. Acte explicite et
 * révocable : false coupe l'accès coach immédiatement (RLS).
 */
export async function setIntentionShared(id: string, shared: boolean): Promise<MutationResult> {
  const { error } = await supabase
    .from('session_intentions')
    .update({ shared_with_coach: shared } as never)
    .eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true, id };
}

/**
 * Rattache l'intention en attente (fraîche) du pilote à la séance qui vient
 * d'être créée. Best-effort, appelé à la création de capture. Sans intention en
 * attente fraîche, ne fait rien (l'intention est facultative). Non filtré par
 * circuit : on suit le pilote, pas le circuit (cf. getPendingIntention).
 */
export async function attachPendingIntentionToSession(input: { sessionId: string }): Promise<void> {
  const pending = await getPendingIntention();
  if (!pending) return;
  const { error } = await supabase
    .from('session_intentions')
    .update({ session_id: input.sessionId } as never)
    .eq('id', pending.id);
  if (error) console.warn('[OXV][intention] attachPendingIntentionToSession :', error.message);
}

/** L'intention rattachée à une séance (pour la juxtaposition Bilan/Trace). */
export async function getIntentionForSession(sessionId: string): Promise<SessionIntention | null> {
  const { data, error } = await supabase
    .from('session_intentions')
    .select(COLS)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    console.warn('[OXV][intention] getIntentionForSession :', error.message);
    return null;
  }
  const row = (data ?? [])[0];
  return row ? mapIntention(row as Record<string, unknown>) : null;
}
