/**
 * Service modération — signalements communautaires (tables `moderation_reports`
 * + `moderation_report_reviews`, migration 0029).
 *
 * Fonction d'ADMINISTRATION défensive. Un utilisateur signale un contenu UGC
 * visible ; l'admin traite en file. Le signaleur est confidentiel vis-à-vis du
 * signalé. La résolution (note admin) vit dans une table admin-only : elle ne
 * fuit jamais au signaleur. Aucune télémétrie, aucun contenu pilote privé.
 */

import { supabase } from '@/lib/supabase';

export type ModerationTargetType = 'coach_review' | 'partner_offer';
export type ModerationReason = 'contenu_illicite' | 'spam' | 'usurpation' | 'inapproprie' | 'autre';
export type ModerationStatus = 'nouveau' | 'en_cours' | 'resolu' | 'rejete';

export interface ModerationReport {
  id: string;
  reporterId: string;
  targetType: ModerationTargetType;
  targetId: string;
  reason: ModerationReason;
  details: string | null;
  status: ModerationStatus;
  createdAt: string;
}

export interface ModerationReview {
  resolution: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface MutationResult {
  ok: boolean;
  error?: string;
}

const REPORT_COLS = 'id, reporter_id, target_type, target_id, reason, details, status, created_at';

function mapReport(r: Record<string, unknown>): ModerationReport {
  return {
    id: r.id as string,
    reporterId: r.reporter_id as string,
    targetType: r.target_type as ModerationTargetType,
    targetId: r.target_id as string,
    reason: r.reason as ModerationReason,
    details: (r.details as string | null) ?? null,
    status: r.status as ModerationStatus,
    createdAt: r.created_at as string,
  };
}

/** Garde anti-abus côté app : plafond de signalements par 24 h et par signaleur. */
const DAILY_REPORT_CAP = 20;

/**
 * Signale un contenu UGC. La RLS impose reporter_id=auth.uid() et status=nouveau ;
 * le trigger DB vérifie que la cible existe ET est visible par le signaleur.
 */
export async function reportContent(input: {
  targetType: ModerationTargetType;
  targetId: string;
  reason: ModerationReason;
  details?: string;
}): Promise<MutationResult> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Session expirée.' };

  const details = input.details?.trim() || null;
  if (input.reason === 'autre' && !details) {
    return { ok: false, error: 'Précisez le motif.' };
  }

  // Rate-limit léger : pas plus de DAILY_REPORT_CAP signalements / 24 h.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('moderation_reports')
    .select('id', { count: 'exact', head: true })
    .eq('reporter_id', uid)
    .gte('created_at', since);
  if ((count ?? 0) >= DAILY_REPORT_CAP) {
    return { ok: false, error: 'Trop de signalements aujourd’hui. Réessayez demain.' };
  }

  const { error } = await supabase.from('moderation_reports').insert({
    reporter_id: uid,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    details,
  } as never);
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Vous avez déjà signalé ce contenu.' };
    if (error.code === '23503') return { ok: false, error: 'Ce contenu n’est plus disponible.' };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Mes signalements (statut seul ; la résolution admin n'est jamais exposée). */
export async function listMyReports(): Promise<ModerationReport[]> {
  const { data, error } = await supabase
    .from('moderation_reports')
    .select(REPORT_COLS)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[OXV][moderation] listMyReports :', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapReport(r as Record<string, unknown>));
}

// ---------------------------------------------------------------------------
// Côté ADMIN (file de traitement). RLS : is_admin().
// ---------------------------------------------------------------------------

/** File admin : non-traités d'abord (nouveau, en_cours), puis le reste. */
export async function listReports(status?: ModerationStatus): Promise<ModerationReport[]> {
  let query = supabase
    .from('moderation_reports')
    .select(REPORT_COLS)
    .order('created_at', { ascending: true });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) {
    console.warn('[OXV][moderation] listReports :', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapReport(r as Record<string, unknown>));
}

/** Volet admin d'un signalement (résolution, traitant) — admin only. */
export async function getReportReview(reportId: string): Promise<ModerationReview | null> {
  const { data, error } = await supabase
    .from('moderation_report_reviews')
    .select('resolution, reviewed_by, reviewed_at')
    .eq('report_id', reportId)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as Record<string, unknown>;
  return {
    resolution: (r.resolution as string | null) ?? null,
    reviewedBy: (r.reviewed_by as string | null) ?? null,
    reviewedAt: (r.reviewed_at as string | null) ?? null,
  };
}

/** Prend en charge un signalement (status=en_cours + horodate le traitant). */
export async function takeReport(reportId: string): Promise<MutationResult> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  const { error: e1 } = await supabase
    .from('moderation_reports')
    .update({ status: 'en_cours' } as never)
    .eq('id', reportId);
  if (e1) return { ok: false, error: e1.message };
  const { error: e2 } = await supabase
    .from('moderation_report_reviews')
    .upsert(
      { report_id: reportId, reviewed_by: uid, reviewed_at: new Date().toISOString() } as never,
      { onConflict: 'report_id' }
    );
  return e2 ? { ok: false, error: e2.message } : { ok: true };
}

/** Clôt un signalement (resolu/rejete) avec une note de résolution admin-only. */
export async function resolveReport(
  reportId: string,
  status: 'resolu' | 'rejete',
  resolution?: string
): Promise<MutationResult> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  const { error: e1 } = await supabase
    .from('moderation_reports')
    .update({ status } as never)
    .eq('id', reportId);
  if (e1) return { ok: false, error: e1.message };
  const { error: e2 } = await supabase.from('moderation_report_reviews').upsert(
    {
      report_id: reportId,
      resolution: resolution?.trim() || null,
      reviewed_by: uid,
      reviewed_at: new Date().toISOString(),
    } as never,
    { onConflict: 'report_id' }
  );
  return e2 ? { ok: false, error: e2.message } : { ok: true };
}

export function reasonLabel(r: ModerationReason): string {
  switch (r) {
    case 'contenu_illicite':
      return 'Contenu illicite';
    case 'spam':
      return 'Spam';
    case 'usurpation':
      return 'Usurpation d’identité';
    case 'inapproprie':
      return 'Contenu inapproprié';
    case 'autre':
      return 'Autre';
  }
}

// ---------------------------------------------------------------------------
// INSIGNES D'ÉCURIE — la file qui n'existait pas
// ---------------------------------------------------------------------------

/**
 * La modération des insignes manquait, et c'est ce qui rendait la voie
 * « téléversement » morte en pratique.
 *
 * La migration du 17/08 a posé le fail-closed : une image part en `en_attente`
 * et n'est visible que de son écurie. Correct — mais rien ne pouvait la faire
 * passer à `valide`, donc AUCUN capitaine n'aurait jamais vu son insigne publié.
 * La fonctionnalité était livrée à moitié.
 *
 * Aucune migration ici : `crews_admin_all` autorise déjà l'admin à écrire, et
 * ajouter un RPC pour ce que la RLS permet déjà serait une couche de plus sans
 * garantie de plus.
 */
export interface InsigneAModerer {
  crewId: string;
  /** Nom de l'écurie, ou `null` si elle n'a pas encore été baptisée. */
  nom: string | null;
  chemin: string;
  soumisLe: string | null;
}

/** Les insignes en attente, les plus anciens d'abord — une file, pas une pile. */
export async function listInsignesAModerer(): Promise<InsigneAModerer[]> {
  const { data, error } = await supabase
    .from('crews')
    .select('id, name, insigne_image_path, insigne_updated_at')
    .eq('insigne_status', 'en_attente')
    .not('insigne_image_path', 'is', null)
    .order('insigne_updated_at', { ascending: true });

  if (error) {
    console.warn('[OXV][moderation] listInsignesAModerer :', error.message);
    return [];
  }
  return (data ?? [])
    .filter((c) => typeof c.insigne_image_path === 'string')
    .map((c) => ({
      crewId: c.id,
      nom: c.name ?? null,
      chemin: c.insigne_image_path as string,
      soumisLe: c.insigne_updated_at ?? null,
    }));
}

/**
 * Tranche sur un insigne. `valide: false` REFUSE sans effacer le fichier.
 *
 * Le chemin est conservé volontairement : le capitaine doit pouvoir lire
 * « votre insigne a été refusé » en voyant lequel. Effacer la ligne le laisserait
 * devant une absence muette, et il retéléverserait la même image.
 */
export async function reviewInsigne(
  crewId: string,
  valide: boolean
): Promise<{ ok: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id ?? null;

  const { error } = await supabase
    .from('crews')
    .update({
      insigne_status: valide ? 'valide' : 'refuse',
      insigne_reviewed_at: new Date().toISOString(),
      insigne_reviewed_by: uid,
    })
    .eq('id', crewId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
