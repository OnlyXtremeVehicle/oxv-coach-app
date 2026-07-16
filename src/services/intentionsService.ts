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

import { STORAGE_KEYS, storage } from '@/lib/mmkv';
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

// ============================================================================
// Marqueur LOCAL de l'intention en attente (survie hors-ligne)
// ============================================================================

/**
 * Ce que l'on gèle sur l'appareil à l'écriture de l'intention. On ne stocke QUE
 * des métadonnées (identifiant + date) : le TEXTE du pilote reste en base, sous
 * RLS own-row — on ne le recopie pas dans un cache non chiffré.
 */
interface LocalPendingIntention {
  id: string;
  createdAt: string;
}

/**
 * Gèle l'intention en attente LOCALEMENT, dès son écriture. C'est ce qui permet
 * de la rattacher à une séance démarrée en MODE AVION : au démarrage de capture
 * on ne peut pas se payer un SELECT (il échoue précisément quand on en a besoin),
 * et une intention non rattachée reste « pending » — donc réattribuable à la
 * séance SUIVANTE. Geler l'id à l'écriture supprime les deux problèmes.
 */
function rememberPendingIntention(id: string, createdAt: string): void {
  try {
    const entry: LocalPendingIntention = { id, createdAt };
    storage.set(STORAGE_KEYS.PENDING_INTENTION, JSON.stringify(entry));
  } catch (e) {
    // Marqueur local indisponible : l'intention est écrite en base, seul le
    // rattachement automatique est perdu. Jamais bloquant.
    console.warn('[OXV][intention] marqueur local KO :', e instanceof Error ? e.message : e);
  }
}

/** Oublie le marqueur local (intention consommée, ou périmée). */
export function forgetPendingIntention(): void {
  try {
    storage.delete(STORAGE_KEYS.PENDING_INTENTION);
  } catch {
    /* sans effet */
  }
}

/**
 * Identifiant de l'intention en attente, lu LOCALEMENT — synchrone, ZÉRO réseau.
 * À appeler au démarrage de capture pour enfiler le rattachement.
 *
 * Applique la MÊME borne de fraîcheur que `getPendingIntention` (24 h) : au-delà,
 * une intention jamais rattachée n'est plus « celle du jour », on l'oublie plutôt
 * que de la coller à une séance sans rapport.
 *
 * Pas de repli réseau si le marqueur est absent, et c'est DÉLIBÉRÉ : un
 * `getPendingIntention()` de secours ressortirait une intention encore « pending »
 * (parce que son rattachement dort dans la file, hors-ligne) et la rattacherait à
 * la séance SUIVANTE — exactement la mauvaise attribution qu'on supprime. La
 * doctrine préfère le silence au faux.
 */
export function peekPendingIntentionId(now: number = Date.now()): string | null {
  let raw: string | undefined;
  try {
    raw = storage.getString(STORAGE_KEYS.PENDING_INTENTION);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as Partial<LocalPendingIntention>;
    if (typeof entry.id !== 'string' || typeof entry.createdAt !== 'string') {
      forgetPendingIntention();
      return null;
    }
    if (!isPendingFresh(entry.createdAt, now)) {
      forgetPendingIntention();
      return null;
    }
    return entry.id;
  } catch {
    forgetPendingIntention();
    return null;
  }
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
    if (error) return { ok: false, error: error.message };
    // Gèle l'id localement : le rattachement à la séance n'aura plus besoin du
    // réseau (cf. peekPendingIntentionId).
    rememberPendingIntention(existing.id, existing.createdAt);
    return { ok: true, id: existing.id };
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
    .select('id, created_at')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Enregistrement impossible.' };
  const row = data as { id: string; created_at: string };
  rememberPendingIntention(row.id, row.created_at);
  return { ok: true, id: row.id };
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

/*
 * Le rattachement intention → séance ne se fait PLUS ici.
 *
 * Il passait par un appel direct (SELECT puis UPDATE) au démarrage de capture —
 * le SEUL appel du write-path resté hors file, et sans rejeu. Hors-ligne, le
 * SELECT échouait le premier : aucun rattachement, aucune trace, et l'intention
 * restait « pending » — donc réattribuée à la séance SUIVANTE, dont le Bilan
 * présentait alors comme « intention du jour » un texte écrit pour une autre
 * séance. Mauvaise attribution silencieuse, contraire à la doctrine.
 *
 * Désormais : l'id est gelé LOCALEMENT à l'écriture (rememberPendingIntention),
 * lu sans réseau au démarrage (peekPendingIntentionId), et le rattachement est
 * enfilé DERRIÈRE le create_session dans la file de capture (op
 * `attach_intention`, cf. captureSyncQueue) — rejoué au retour du réseau comme
 * le reste du write-path.
 */

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
