/**
 * Service Admin — Qualité data (§7.1) et équipements (§7, §22).
 *
 * Détecte les anomalies de session à partir des données EXISTANTES
 * (`telemetry_sessions` + `app_session_analyses`) — aucune table de détection.
 * L'état résolu/assigné est persisté dans `data_quality_reports` (tag/resolve).
 *
 * Admin-only : toutes ces tables sont en RLS `is_admin()`. Le service échoue
 * proprement (listes vides) si l'appelant n'est pas admin.
 */

import { supabase } from '@/lib/supabase';

export type AnomalyType = 'no_frames' | 'recording_stuck' | 'analysis_missing' | 'no_debrief';
export type Severity = 'info' | 'warning' | 'critical';
export type ReportStatus = 'open' | 'assigned' | 'resolved';

const ANOMALY_LABELS: Record<AnomalyType, { label: string; severity: Severity }> = {
  no_frames: { label: 'Aucune frame reçue', severity: 'critical' },
  recording_stuck: { label: 'Session jamais clôturée', severity: 'warning' },
  analysis_missing: { label: 'Analyse absente', severity: 'warning' },
  no_debrief: { label: 'Débrief non généré', severity: 'info' },
};

export interface SessionAnomaly {
  sessionId: string;
  userId: string;
  sessionName: string | null;
  circuitName: string | null;
  startedAt: string;
  status: string;
  totalFrames: number | null;
  anomalies: { type: AnomalyType; severity: Severity; label: string }[];
}

/**
 * Liste les sessions porteuses d'au moins une anomalie, la plus récente d'abord.
 * Dérivé : frames manquantes, `recording` non clôturé, analyse absente, débrief
 * non généré. Ne lit que des champs déjà présents (zéro table de détection).
 */
export async function detectSessionAnomalies(limit = 100): Promise<SessionAnomaly[]> {
  const { data: sessions, error } = await supabase
    .from('telemetry_sessions')
    .select('id, user_id, name, circuit_name, started_at, status, total_frames')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error || !sessions) {
    if (error) console.warn('[OXV][admin] detectSessionAnomalies :', error.message);
    return [];
  }

  const ids = sessions.map((s) => s.id);
  const { data: analyses } = await supabase
    .from('app_session_analyses')
    .select('telemetry_session_id, debrief_text')
    .in('telemetry_session_id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);

  const analyzed = new Map<string, { hasDebrief: boolean }>();
  for (const a of analyses ?? []) {
    analyzed.set(a.telemetry_session_id, {
      hasDebrief: Boolean((a.debrief_text ?? '').trim()),
    });
  }

  const out: SessionAnomaly[] = [];
  for (const s of sessions) {
    const flags: AnomalyType[] = [];
    if (s.total_frames == null || s.total_frames === 0) flags.push('no_frames');
    if (s.status === 'recording') flags.push('recording_stuck');
    const a = analyzed.get(s.id);
    if (!a) flags.push('analysis_missing');
    else if (!a.hasDebrief) flags.push('no_debrief');

    if (flags.length === 0) continue;
    out.push({
      sessionId: s.id,
      userId: s.user_id,
      sessionName: s.name ?? null,
      circuitName: s.circuit_name ?? null,
      startedAt: s.started_at,
      status: s.status,
      totalFrames: s.total_frames ?? null,
      anomalies: flags.map((t) => ({
        type: t,
        severity: ANOMALY_LABELS[t].severity,
        label: ANOMALY_LABELS[t].label,
      })),
    });
  }
  return out;
}

export interface QualityReport {
  id: string;
  sessionId: string;
  severity: Severity;
  type: string;
  message: string | null;
  status: ReportStatus;
  ownerAdminId: string | null;
  createdAt: string;
}

function mapReport(row: Record<string, unknown>): QualityReport {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    severity: row.severity as Severity,
    type: row.type as string,
    message: (row.message as string | null) ?? null,
    status: row.status as ReportStatus,
    ownerAdminId: (row.owner_admin_id as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/** Liste les rapports qualité persistés (tag/resolve), filtrés par statut. */
export async function listQualityReports(status?: ReportStatus): Promise<QualityReport[]> {
  let q = supabase
    .from('data_quality_reports')
    .select('id, session_id, severity, type, message, status, owner_admin_id, created_at')
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) {
    console.warn('[OXV][admin] listQualityReports :', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapReport(r as Record<string, unknown>));
}

/** Tague une anomalie : crée un rapport qualité (statut `open`). */
export async function createQualityReport(input: {
  sessionId: string;
  type: AnomalyType | string;
  severity: Severity;
  message?: string;
}): Promise<QualityReport | null> {
  const { data, error } = await supabase
    .from('data_quality_reports')
    .insert({
      session_id: input.sessionId,
      type: input.type,
      severity: input.severity,
      message: input.message ?? null,
    })
    .select('id, session_id, severity, type, message, status, owner_admin_id, created_at')
    .single();
  if (error || !data) {
    console.warn('[OXV][admin] createQualityReport :', error?.message ?? 'no data');
    return null;
  }
  return mapReport(data as Record<string, unknown>);
}

/** Change le statut d'un rapport (assigné / résolu). */
export async function setReportStatus(
  id: string,
  status: ReportStatus
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('data_quality_reports').update({ status }).eq('id', id);
  if (error) {
    console.warn('[OXV][admin] setReportStatus :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
