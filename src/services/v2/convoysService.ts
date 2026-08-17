/**
 * Service convois (C2) — v2.
 *
 * Un convoi regroupe des pilotes inscrits à la MÊME journée (session site) autour
 * d'une route belle optionnelle (`scenic_routes`) et d'un point de RDV. L'accès
 * est borné côté base : seuls les inscrits de la journée (fonction serveur
 * `is_registered_for_session`) lisent et rejoignent ; le créateur gère son convoi.
 * Le service ne réimplémente PAS ce contrôle : il remonte proprement un refus RLS
 * en message FR vouvoyé.
 *
 * Doctrine : coordination avant/après roulage uniquement — jamais de push en piste.
 */

import { supabase } from '@/lib/supabase';

/**
 * `invite` = convié par le capitaine, pas encore répondu. `present` = a rejoint,
 * de lui-même ou après invitation. `decline` = a décliné.
 *
 * Le défaut en base est `present` et NON `invite` : une ligne créée par
 * `join()` est un pilote qui a rejoint de son propre chef.
 */
export type StatutParticipant = 'invite' | 'present' | 'decline';

export interface ConvoyParticipant {
  userId: string;
  joinedAt: string;
  statut: StatutParticipant;
}

export interface Convoy {
  id: string;
  sessionId: string;
  routeId: string | null;
  createdBy: string;
  /** Écurie qui sort. `null` = convoi libre — le cas qui existait avant. */
  crewId: string | null;
  /** Restaurant choisi par le capitaine. Devient une étape du tracé. */
  restaurantId: string | null;
  meetingPoint: string | null;
  rdvAt: string | null;
  createdAt: string;
  participants: ConvoyParticipant[];
}

export interface CreateConvoyInput {
  sessionId: string;
  routeId?: string | null;
  /**
   * Rattache la sortie à une écurie. La RLS n'accepte que le CAPITAINE de cette
   * écurie — et par une politique RESTRICTIVE, donc réellement contraignante.
   */
  crewId?: string | null;
  restaurantId?: string | null;
  meetingPoint?: string | null;
  rdvAt?: string | null;
}

const ACCESS_DENIED_FR =
  'Accès refusé : seuls les inscrits de la journée peuvent accéder à ce convoi.';

/** Repère un refus de sécurité (RLS) pour le traduire en message FR lisible. */
function isRlsDenial(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('row-level security') ||
    m.includes('violates row-level') ||
    m.includes('permission denied') ||
    m.includes('policy')
  );
}

/**
 * Convois d'une journée (session site), participants inclus. Lecture bornée aux
 * inscrits par RLS : un non-inscrit obtient une liste vide. Erreur transport
 * remontée.
 */
export async function getForSession(sessionId: string): Promise<Convoy[]> {
  const { data, error } = await supabase
    .from('convoys')
    .select(
      'id, session_id, route_id, crew_id, restaurant_id, created_by, meeting_point, rdv_at, created_at, convoy_participants(user_id, joined_at, status)'
    )
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => {
    const participants = Array.isArray(r.convoy_participants) ? r.convoy_participants : [];
    return {
      id: r.id,
      sessionId: r.session_id,
      routeId: r.route_id ?? null,
      crewId: r.crew_id ?? null,
      restaurantId: r.restaurant_id ?? null,
      createdBy: r.created_by,
      meetingPoint: r.meeting_point ?? null,
      rdvAt: r.rdv_at ?? null,
      createdAt: r.created_at,
      participants: participants.map((p) => ({
        userId: p.user_id,
        joinedAt: p.joined_at,
        statut: p.status,
      })),
    };
  });
}

/**
 * Crée un convoi pour une journée. RLS n'autorise l'insertion qu'aux inscrits de
 * la session : un refus remonte en message FR. Le créateur en devient gestionnaire.
 */
export async function create(
  input: CreateConvoyInput
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Vous devez être connecté.' };

  const { data, error } = await supabase
    .from('convoys')
    .insert({
      session_id: input.sessionId,
      created_by: uid,
      route_id: input.routeId ?? null,
      crew_id: input.crewId ?? null,
      restaurant_id: input.restaurantId ?? null,
      meeting_point: input.meetingPoint?.trim() ? input.meetingPoint.trim() : null,
      rdv_at: input.rdvAt ?? null,
    })
    .select('id')
    .maybeSingle();
  if (error)
    return { ok: false, error: isRlsDenial(error.message) ? ACCESS_DENIED_FR : error.message };
  if (!data) return { ok: false, error: ACCESS_DENIED_FR };
  return { ok: true, id: data.id };
}

/**
 * Rejoint un convoi. Idempotent : un second appel n'échoue pas (ignore le doublon
 * de clé). RLS n'autorise l'inscription qu'aux inscrits de la journée ; un refus
 * remonte en message FR.
 */
export async function join(convoyId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Vous devez être connecté.' };

  const { error } = await supabase
    .from('convoy_participants')
    .upsert(
      { convoy_id: convoyId, user_id: uid },
      { onConflict: 'convoy_id,user_id', ignoreDuplicates: true }
    );
  if (error)
    return { ok: false, error: isRlsDenial(error.message) ? ACCESS_DENIED_FR : error.message };
  return { ok: true };
}

/**
 * Quitte un convoi. Idempotent : ne rien supprimer (déjà parti) reste un succès.
 */
export async function leave(convoyId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Vous devez être connecté.' };

  const { error } = await supabase
    .from('convoy_participants')
    .delete()
    .eq('convoy_id', convoyId)
    .eq('user_id', uid);
  if (error)
    return { ok: false, error: isRlsDenial(error.message) ? ACCESS_DENIED_FR : error.message };
  return { ok: true };
}

/** Le circuit d'une journée, avec ses coordonnées — destination du trajet. */
export interface CircuitJournee {
  id: string;
  nom: string;
  lat: number;
  lon: number;
}

/**
 * Résout le circuit d'une journée, ou `null`.
 *
 * Deux lectures plutôt qu'une jointure : `sessions` porte `circuit_id`, et les
 * coordonnées vivent dans `circuits`. La jointure imbriquée de PostgREST
 * dépendrait d'une clé étrangère nommée, et une RLS différente sur les deux
 * tables la ferait échouer d'un bloc — là où deux lectures dégradent
 * proprement.
 *
 * `null` est un état NORMAL : une journée sans circuit renseigné existe, et le
 * trajet doit alors le dire plutôt que de viser un point inventé.
 */
export async function circuitDeLaSession(sessionId: string): Promise<CircuitJournee | null> {
  const { data: session } = await supabase
    .from('sessions')
    .select('circuit_id')
    .eq('id', sessionId)
    .maybeSingle();

  const circuitId = session?.circuit_id;
  if (!circuitId) return null;

  const { data: circuit } = await supabase
    .from('circuits')
    .select('id, name, finish_line_lat, finish_line_lon')
    .eq('id', circuitId)
    .maybeSingle();

  const lat = circuit?.finish_line_lat;
  const lon = circuit?.finish_line_lon;
  if (!circuit || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return { id: circuit.id, nom: circuit.name, lat: lat as number, lon: lon as number };
}

/**
 * Met à jour le rendez-vous et l'étape restaurant d'une sortie.
 *
 * Deux politiques se combinent, et c'est voulu : `convoys_owner_manage`
 * (permissive) exige d'être le créateur, `convoys_crew_update_capitaine`
 * (RESTRICTIVE) exige d'être capitaine de l'écurie attachée. Le service ne
 * revérifie ni l'une ni l'autre.
 *
 * Les champs ABSENTS ne sont pas touchés — poser `undefined` et poser `null`
 * ne veulent pas dire la même chose. `null` retire explicitement l'étape ou le
 * rendez-vous ; ne rien passer le laisse tel quel. Sans cette distinction,
 * enregistrer un rendez-vous effacerait le restaurant.
 */
export async function majSortie(
  convoyId: string,
  champs: { meetingPoint?: string | null; restaurantId?: string | null }
): Promise<{ ok: boolean; error?: string }> {
  // Typé sur les colonnes RÉELLES et non `Record<string, …>` : le client
  // Supabase refuse un index signature, et il a raison — une clé mal orthographiée
  // partirait sinon en base sans que rien ne l'arrête.
  const patch: { meeting_point?: string | null; restaurant_id?: string | null } = {};
  if ('meetingPoint' in champs) {
    const v = champs.meetingPoint;
    patch.meeting_point = typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
  }
  if ('restaurantId' in champs) patch.restaurant_id = champs.restaurantId ?? null;
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase.from('convoys').update(patch).eq('id', convoyId);
  if (error)
    return { ok: false, error: isRlsDenial(error.message) ? ACCESS_DENIED_FR : error.message };
  return { ok: true };
}

const INVITE_REFUSE_FR = 'Seul le capitaine peut inviter, et seulement les membres de son écurie.';

/**
 * Invite des membres de l'écurie sur une sortie.
 *
 * La RLS fait tout le travail (`convoy_participants_invite_capitaine`) : le
 * convoi doit porter une écurie, l'appelant doit en être le capitaine, et chaque
 * invité doit en être membre. Rien de tout cela n'est revérifié ici — dupliquer
 * une règle de sécurité, c'est se donner deux vérités qui divergeront.
 *
 * `ignoreDuplicates` rend l'appel IDEMPOTENT, et le choix n'est pas anodin : un
 * `upsert` ordinaire écraserait le `status` d'un pilote qui a déjà répondu.
 * Réinviter quelqu'un qui a décliné ne doit pas effacer sa réponse.
 */
export async function inviter(
  convoyId: string,
  userIds: readonly string[]
): Promise<{ ok: boolean; error?: string; invites?: number }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Vous devez être connecté.' };
  if (userIds.length === 0) return { ok: true, invites: 0 };

  const { data, error } = await supabase
    .from('convoy_participants')
    .upsert(
      userIds.map((userId) => ({
        convoy_id: convoyId,
        user_id: userId,
        status: 'invite' as const,
        invited_by: uid,
      })),
      { onConflict: 'convoy_id,user_id', ignoreDuplicates: true }
    )
    .select('user_id');
  if (error)
    return { ok: false, error: isRlsDenial(error.message) ? INVITE_REFUSE_FR : error.message };
  return { ok: true, invites: (data ?? []).length };
}

/**
 * Répond à une invitation — pour soi, et pour personne d'autre
 * (`convoy_participants_repond_pour_soi`).
 *
 * `responded_at` est posé ici plutôt que par un déclencheur : la date de réponse
 * n'a de sens que pour ce geste, et un déclencheur l'écrirait aussi lors d'une
 * mise à jour technique.
 */
export async function repondre(
  convoyId: string,
  statut: Extract<StatutParticipant, 'present' | 'decline'>
): Promise<{ ok: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Vous devez être connecté.' };

  const { error } = await supabase
    .from('convoy_participants')
    .update({ status: statut, responded_at: new Date().toISOString() })
    .eq('convoy_id', convoyId)
    .eq('user_id', uid);
  if (error)
    return { ok: false, error: isRlsDenial(error.message) ? ACCESS_DENIED_FR : error.message };
  return { ok: true };
}

/**
 * Règle une inscription avec une séance du pack Heritage.
 *
 * TOUT SE DÉCIDE CÔTÉ SERVEUR. `oxv_use_heritage_session` vérifie que
 * l'inscription est bien celle de l'appelant, qu'il a été invité par son écurie
 * sur cette journée, que le pack est actif et dans sa fenêtre de validité, qu'il
 * lui reste un crédit, et que cette inscription n'en a pas déjà consommé un —
 * puis verrouille la ligne du pack le temps de décrémenter.
 *
 * Ce service ne fait que traduire les codes en français. Recalculer le solde ici
 * pour « éviter un aller-retour » rouvrirait exactement la course que le verrou
 * serveur ferme : deux inscriptions simultanées sur le dernier crédit.
 */
const MOTIFS_PACK: Record<string, string> = {
  inscription_introuvable: 'Cette inscription est introuvable.',
  non_autorise: 'Cette inscription n’est pas la vôtre.',
  pas_invite_par_ecurie:
    'Une séance du pack se règle sur une sortie d’écurie à laquelle vous avez été invité.',
  aucun_pack_utilisable: 'Vous n’avez aucune séance disponible sur un pack en cours de validité.',
  deja_consomme: 'Cette inscription a déjà été réglée avec une séance de votre pack.',
};

export async function utiliserSeanceHeritage(
  registrationId: string
): Promise<{ ok: boolean; error?: string; seancesRestantes?: number }> {
  const { data, error } = await supabase.rpc('oxv_use_heritage_session', {
    p_registration_id: registrationId,
  });
  if (error) return { ok: false, error: error.message };

  const obj = (data ?? {}) as { ok?: unknown; error?: unknown; sessions_restantes?: unknown };
  if (obj.ok === true) {
    return {
      ok: true,
      seancesRestantes:
        typeof obj.sessions_restantes === 'number' ? obj.sessions_restantes : undefined,
    };
  }
  const code = typeof obj.error === 'string' ? obj.error : '';
  return { ok: false, error: MOTIFS_PACK[code] ?? 'Cette séance n’a pas pu être décomptée.' };
}
