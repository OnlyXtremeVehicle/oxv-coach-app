/**
 * QDI 5 branches — calcul, persistance et lecture (Lot M1).
 *
 * Calcul déterministe (qdiLogic, `algo_version` estampillé) persisté dans
 * `app_session_analyses.qdi` (jsonb, migration 2026-07-04). Self-only strict :
 * la référence du radar est la médiane des dernières sessions DU PILOTE sur le
 * même circuit — jamais un autre pilote, jamais de classement.
 *
 * Lecture par des tiers CONSENTIS (décision fondateur 2026-07-04, « assumer ») :
 * la colonne qdi hérite des policies SELECT existantes de la table — un coach
 * consenti ou un AMI accepté (double consentement) peut lire les branches d'un
 * pilote. Assumé : le consentement mutuel prime ; l'app n'affiche pour autant
 * aucun comparatif inter-pilotes ni classement.
 *
 * Gating offres (prompt v2) : Signature/Heritage = radar + détail des
 * branches ; Access = radar seul. Le niveau se lit sur les inscriptions du
 * site (`registrations.offer_type`, RLS own). Sans aucune inscription (compte
 * hors parcours commercial), le détail reste visible.
 */

import { supabase } from '@/lib/supabase';
import {
  computeQdi,
  medianBranches,
  QDI_ALGO_VERSION,
  type QdiBranches,
  type QdiFrame,
  type QdiLapWindow,
  type QdiResult,
} from '@/services/qdiLogic';
import { loadSessionFrames } from '@/services/sessionTelemetryService';
import { fetchSessionLaps } from '@/services/sessionsService';

export interface QdiRecord extends QdiResult {
  computedAt: string;
  reference: { sessions: number; circuit: string | null };
}

/** Calcule et persiste le QDI d'une session analysée. Best-effort. */
export async function computeAndPersistQdi(sessionId: string): Promise<QdiRecord | null> {
  const { data: session } = await supabase
    .from('telemetry_sessions')
    .select('id, user_id, started_at, circuit_name')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session?.started_at) return null;

  const sessionStartMs = new Date(session.started_at).getTime();
  const [rawFrames, laps] = await Promise.all([
    loadSessionFrames(sessionId),
    fetchSessionLaps(sessionId),
  ]);

  const frames: QdiFrame[] = rawFrames.map((f) => ({
    elapsedMs: f.elapsedMs,
    lat: f.lat,
    lon: f.lon,
    gLat: f.gLat,
    gLong: f.gLong,
  }));
  const windows: QdiLapWindow[] = laps
    .filter((l) => !l.is_outlap && !l.is_inlap && l.started_at && l.ended_at)
    .map((l) => ({
      startMs: new Date(l.started_at).getTime() - sessionStartMs,
      endMs: new Date(l.ended_at).getTime() - sessionStartMs,
      durationSeconds: l.duration_seconds,
    }));

  const result = computeQdi(frames, windows);
  const record: QdiRecord = {
    ...result,
    computedAt: new Date().toISOString(),
    reference: { sessions: 0, circuit: session.circuit_name ?? null },
  };

  // .select() chaîné : sans lui, un UPDATE qui ne touche AUCUNE ligne (analyse
  // pas encore créée, refus RLS) passerait pour un succès — faux « QDI calculé ».
  const { data: updated, error } = await supabase
    .from('app_session_analyses')
    .update({ qdi: record } as never)
    .eq('telemetry_session_id', sessionId)
    .select('telemetry_session_id');
  if (error || !updated || updated.length === 0) return null;
  return record;
}

/** QDI persisté d'une session (null si pas encore calculé). */
export async function getQdiForSession(sessionId: string): Promise<QdiRecord | null> {
  const { data } = await supabase
    .from('app_session_analyses')
    .select('qdi')
    .eq('telemetry_session_id', sessionId)
    .maybeSingle();
  const qdi = (data as { qdi?: QdiRecord | null } | null)?.qdi;
  return qdi ?? null;
}

/**
 * QDI d'une session, avec RECALCUL PARESSEUX : si l'analyse existe mais que le
 * qdi manque (session rattrapée par le cron serveur, qui ne calcule pas le
 * QDI ; ou ancienne session d'avant la migration), on le calcule et on le
 * persiste à la lecture. Le pilote propriétaire est le seul à pouvoir écrire
 * (RLS own-row) — pour un lecteur consenti, le calcul est simplement ignoré.
 */
export async function getOrComputeQdiForSession(sessionId: string): Promise<QdiRecord | null> {
  const existing = await getQdiForSession(sessionId);
  // Invalidation par version : un QDI persisté par un algo antérieur (axes G
  // inversés / troncature 1000 trames en 1.0.x) est recalculé à la lecture.
  // Si le recalcul échoue (lecteur non propriétaire, trames purgées), on rend
  // l'existant plutôt que rien — mais jamais silencieusement à jour.
  if (existing && existing.algoVersion === QDI_ALGO_VERSION) return existing;
  try {
    const fresh = await computeAndPersistQdi(sessionId);
    return fresh ?? existing;
  } catch {
    return existing;
  }
}

/**
 * Référence self-only : médiane par branche des 5 derniers QDI du pilote sur
 * le même circuit (session courante exclue).
 */
export async function getQdiReference(
  userId: string,
  circuitName: string | null,
  excludeSessionId: string
): Promise<{ branches: QdiBranches; sessions: number }> {
  let query = supabase
    .from('telemetry_sessions')
    .select('id')
    .eq('user_id', userId)
    .neq('id', excludeSessionId)
    .order('started_at', { ascending: false })
    .limit(15);
  // Contrat « même circuit » strict : circuit inconnu → référence = les autres
  // séances À CIRCUIT INCONNU (jamais un mélange tous-circuits silencieux).
  if (circuitName) query = query.eq('circuit_name', circuitName);
  else query = query.is('circuit_name', null);
  const { data: sessions } = await query;
  const ids = (sessions ?? []).map((s) => s.id);
  if (ids.length === 0) {
    return {
      branches: {
        trajectoire: null,
        fluidite: null,
        freinage: null,
        acceleration: null,
        regularite: null,
      },
      sessions: 0,
    };
  }

  const { data: analyses } = await supabase
    .from('app_session_analyses')
    .select('qdi, telemetry_session_id')
    .in('telemetry_session_id', ids)
    .not('qdi', 'is', null);
  // PostgREST ne garantit aucun ordre : on retrie selon la récence des
  // sessions (ids déjà triés started_at desc) puis on garde les 5 dernières.
  const orderIndex = new Map(ids.map((id, i) => [id, i]));
  const history = (analyses ?? [])
    .map((a) => a as unknown as { qdi?: QdiBranches | null; telemetry_session_id: string })
    .filter((a) => Boolean(a.qdi))
    .sort(
      (x, y) =>
        (orderIndex.get(x.telemetry_session_id) ?? 99) -
        (orderIndex.get(y.telemetry_session_id) ?? 99)
    )
    .slice(0, 5)
    .map((a) => a.qdi as QdiBranches);
  return { branches: medianBranches(history), sessions: history.length };
}

/** Style QDI d'un mois : médiane des branches des séances du mois (self-only). */
export interface MonthlyQdi {
  /** Libellé court du mois (« MAI », « JUIN », « JUIL. »). */
  monthLabel: string;
  /** Clé de tri AAAA-MM. */
  monthKey: string;
  branches: QdiBranches;
  sessions: number;
}

/** Options de listMonthlyQdi (extension additive V2-L1 — défauts inchangés). */
export interface ListMonthlyQdiOptions {
  /**
   * strict : REJETTE (throw) sur erreur DB au lieu d'avaler en [] — permet aux
   * écrans de distinguer « aucun mois avec données » (constat honnête, état
   * vide) d'un « échec de chargement » (état erreur + retry). Règle fondateur :
   * ABSENT ≠ ERREUR, jamais un vide fabriqué sur panne. Défaut false : les
   * appelants existants (signature v1, empreinte-saison) sont inchangés.
   */
  strict?: boolean;
}

/**
 * « Votre style au fil des séances » (maquette §7.3) : le style QDI des derniers
 * mois AVEC données, en constats juxtaposés — médiane par branche par mois,
 * JAMAIS une courbe d'évolution. Self-only strict.
 *
 * Filtre de version (correctif V2-L1) : seuls les QDI persistés à
 * `QDI_ALGO_VERSION` nourrissent les médianes — les calculs 1.0.x sont
 * documentés INVALIDES (axes G inversés, cf. qdiLogic) et un mois qui n'a que
 * des QDI invalides disparaît de la liste plutôt que d'afficher de fausses
 * mesures. Aligné sur la baseline 30 j de l'écran Signature (même filtre).
 */
export async function listMonthlyQdi(
  userId: string,
  months = 3,
  opts: ListMonthlyQdiOptions = {}
): Promise<MonthlyQdi[]> {
  // Fenêtre bornée par DATE (pas par nombre de lignes) : le mois le plus ancien
  // du triplet est complet, jamais une médiane sur une fraction de mois.
  const windowStart = new Date();
  windowStart.setMonth(windowStart.getMonth() - (months + 1));
  const { data: sessions, error: sessionsError } = await supabase
    .from('telemetry_sessions')
    .select('id, started_at')
    .eq('user_id', userId)
    .gte('started_at', windowStart.toISOString())
    .order('started_at', { ascending: false })
    .limit(200);
  if (opts.strict && sessionsError) {
    throw new Error(`listMonthlyQdi(sessions): ${sessionsError.message}`);
  }
  const rows = (sessions ?? []) as { id: string; started_at: string }[];
  if (rows.length === 0) return [];

  const { data: analyses, error: analysesError } = await supabase
    .from('app_session_analyses')
    .select('qdi, telemetry_session_id')
    .in(
      'telemetry_session_id',
      rows.map((r) => r.id)
    )
    .not('qdi', 'is', null);
  if (opts.strict && analysesError) {
    throw new Error(`listMonthlyQdi(analyses): ${analysesError.message}`);
  }
  // Le jsonb persisté est un QdiRecord aplati (QdiResult extends QdiBranches) :
  // il porte algoVersion. Sans estampille reconnue → écarté (fail-closed).
  const qdiBySession = new Map(
    (
      (analyses ?? []) as unknown as {
        qdi: QdiBranches & { algoVersion?: string };
        telemetry_session_id: string;
      }[]
    )
      .filter((a) => a.qdi?.algoVersion === QDI_ALGO_VERSION)
      .map((a) => [a.telemetry_session_id, a.qdi])
  );

  // Groupe par mois VÉCU (fuseau local de l'appareil — une séance du 1er à 0h30
  // heure de Paris n'appartient pas au mois UTC précédent), médiane par branche.
  const byMonth = new Map<string, QdiBranches[]>();
  for (const r of rows) {
    const q = qdiBySession.get(r.id);
    if (!q) continue;
    const d = new Date(r.started_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const list = byMonth.get(key) ?? [];
    list.push(q);
    byMonth.set(key, list);
  }

  const entries = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-months);
  // Année dans le label si le triplet traverse deux années (sinon « JUIL 25 »
  // juxtaposé à « JUIN » suggérerait des mois consécutifs).
  const spansYears = new Set(entries.map(([k]) => k.slice(0, 4))).size > 1;
  const MONTH_FR = [
    'JANV',
    'FÉVR',
    'MARS',
    'AVR',
    'MAI',
    'JUIN',
    'JUIL',
    'AOÛT',
    'SEPT',
    'OCT',
    'NOV',
    'DÉC',
  ];
  return entries.map(([monthKey, list]) => {
    const m = MONTH_FR[Number(monthKey.slice(5, 7)) - 1] ?? monthKey;
    return {
      monthKey,
      monthLabel: spansYears ? `${m} ${monthKey.slice(2, 4)}` : m,
      branches: medianBranches(list),
      sessions: list.length,
    };
  });
}

export type QdiAccessLevel = 'full' | 'simple';

/** Niveau de restitution selon l'offre (Signature/Heritage = détail). */
export async function getQdiAccessLevel(userId: string): Promise<QdiAccessLevel> {
  const { data } = await supabase
    .from('registrations')
    .select('offer_type, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  // Le niveau suit l'inscription EFFECTIVE la plus récente (confirmée/venue/
  // en attente de paiement) — pas un some() sur tout l'historique : une
  // Signature annulée il y a un an ne donne pas le détail à vie.
  const ACTIVE = new Set(['confirmed', 'attended', 'pending_payment', 'pending']);
  const current = (data ?? []).find((r) => ACTIVE.has(String(r.status)));
  if (!current) return 'full'; // hors parcours commercial : rien à restreindre
  const offer = String(current.offer_type).toLowerCase();
  return offer.includes('signature') || offer.includes('heritage') ? 'full' : 'simple';
}
