/**
 * File de synchronisation de capture — PERSISTANTE SUR FICHIER (P0 Valence).
 *
 * Rend la chaîne d'écriture télémétrie SURVIVANTE HORS-LIGNE. Contrairement à
 * la file MMKV d'`offlineQueue` (petites actions unitaires), la capture produit
 * des dizaines de milliers de trames par séance (plusieurs Mo). On persiste donc
 * chaque OPÉRATION dans un FICHIER JSON sous
 * `${FileSystem.documentDirectory}capture-queue/`, une opération par fichier.
 *
 * Ordre FIFO STRICT : le nom de fichier est
 *   `${horodatage(15)}-${séquence(6)}-${type}.json`
 * L'horodatage est rendu MONOTONE dans un run (Math.max avec le dernier), la
 * séquence casse les ex æquo. Le tri lexicographique des noms == ordre d'insertion.
 * Au relancement de l'app (séquence remise à 0), les opérations en attente d'un
 * run précédent portent un horodatage antérieur et sont donc drainées en premier.
 *
 * Drain (`processQueue`) : traite les fichiers DANS L'ORDRE ; supprime du disque
 * chaque opération réussie ; s'ARRÊTE au premier échec RÉSEAU en gardant le reste
 * (FIFO préservé, on ne martèle pas un réseau tombé) ; DROP (log + suppression)
 * une opération en échec PERMANENT clair (erreur logique Postgres, fichier source
 * absent) pour ne pas bloquer la file. Toute erreur ambiguë est traitée
 * prudemment comme transitoire (conservée, jamais perdue).
 *
 * IDEMPOTENCE au replay :
 *   - create_session : upsert onConflict 'id' (pose/replace la ligne) ;
 *   - frames         : insert simple pour l'instant (cf. TODO valencia-6) ;
 *   - laps           : insert ;
 *   - complete       : update .eq(id).eq(user_id) — idempotent par nature, et
 *                      RÉCONCILIE `total_frames` en recomptant les trames RÉELLES
 *                      en base (voir execComplete) ;
 *   - ubx_upload     : uploadTelemetryFile (déjà idempotent, upsert:true).
 *
 * Doctrine « silence en piste » : ce module n'affiche rien, ne notifie rien.
 */

import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';

import { supabase } from '@/lib/supabase';
import { uploadTelemetryFile } from '@/services/telemetryStorage';
import { parseRaceBoxDataMessage, UbxFrameBuffer } from '@/ubx/parser';
import type { Database } from '@/types/database.types';

import { type TelemetryFrameInsert, raceBoxToFrameInsert } from './captureFrameMapping';

type Tables = Database['public']['Tables'];

/** Ligne d'insertion telemetry_sessions avec `id` client garanti. */
export type CaptureSessionRow = Tables['telemetry_sessions']['Insert'] & { id: string };
/** Sous-ensemble d'update telemetry_sessions (clôture). */
export type CaptureSessionUpdate = Tables['telemetry_sessions']['Update'];
/** Ligne d'insertion laps. */
export type LapInsert = Tables['laps']['Insert'];

/**
 * Opération sérialisable de la file de capture. Toutes portent `sessionId`
 * (indexation par séance pour `pendingSessionIds`).
 */
export type CaptureQueueOp =
  | { type: 'create_session'; sessionId: string; row: CaptureSessionRow }
  | { type: 'frames'; sessionId: string; batch: TelemetryFrameInsert[] }
  | { type: 'laps'; sessionId: string; rows: LapInsert[] }
  | { type: 'complete'; sessionId: string; userId: string; updates: CaptureSessionUpdate }
  | { type: 'ubx_upload'; sessionId: string; userId: string; fileUri: string };

/** Bilan d'un drain. */
export interface ProcessResult {
  /** Opérations effectivement synchronisées puis supprimées du disque. */
  processed: number;
  /** Opérations abandonnées (erreur permanente / fichier illisible). */
  dropped: number;
  /** Opérations restant sur disque (arrêt réseau ou rien à faire). */
  remaining: number;
}

// ============================================================================
// UUID v4 client (offline-first : l'id de session est généré côté app)
// ============================================================================

const HEX_BYTE: string[] = [];
for (let i = 0; i < 256; i += 1) HEX_BYTE.push((i + 0x100).toString(16).slice(1));

/**
 * Génère un UUID v4. Repose sur `crypto.getRandomValues` (garanti présent sur
 * RN via react-native-url-polyfill et nativement en Node), PAS sur
 * `crypto.randomUUID` (absent sur certaines cibles). Repli Math.random si
 * l'entropie forte est indisponible — un id unique reste préférable à un échec.
 */
export function newUuid(): string {
  const b = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(b);
  } else {
    for (let i = 0; i < 16; i += 1) b[i] = Math.floor(Math.random() * 256);
  }
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  return (
    HEX_BYTE[b[0]] +
    HEX_BYTE[b[1]] +
    HEX_BYTE[b[2]] +
    HEX_BYTE[b[3]] +
    '-' +
    HEX_BYTE[b[4]] +
    HEX_BYTE[b[5]] +
    '-' +
    HEX_BYTE[b[6]] +
    HEX_BYTE[b[7]] +
    '-' +
    HEX_BYTE[b[8]] +
    HEX_BYTE[b[9]] +
    '-' +
    HEX_BYTE[b[10]] +
    HEX_BYTE[b[11]] +
    HEX_BYTE[b[12]] +
    HEX_BYTE[b[13]] +
    HEX_BYTE[b[14]] +
    HEX_BYTE[b[15]]
  );
}

// ============================================================================
// Disposition sur disque
// ============================================================================

function queueDir(): string {
  const base = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
  return `${base}capture-queue/`;
}

/** Séquence + horodatage monotone pour des noms de fichiers FIFO stricts. */
let seq = 0;
let lastTs = 0;

function nextFileName(type: CaptureQueueOp['type']): string {
  const ts = Math.max(Date.now(), lastTs);
  lastTs = ts;
  const s = seq;
  seq += 1;
  return `${String(ts).padStart(15, '0')}-${String(s).padStart(6, '0')}-${type}.json`;
}

async function ensureDir(): Promise<void> {
  const dir = queueDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

/** Noms de fichiers d'opérations, triés en ordre FIFO (lexicographique). */
async function listOpFiles(): Promise<string[]> {
  const dir = queueDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) return [];
  const names = await FileSystem.readDirectoryAsync(dir);
  return names.filter((n) => n.endsWith('.json')).sort();
}

async function readOp(fileName: string): Promise<CaptureQueueOp | null> {
  try {
    const raw = await FileSystem.readAsStringAsync(queueDir() + fileName, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return JSON.parse(raw) as CaptureQueueOp;
  } catch {
    return null; // fichier illisible/corrompu → drop en amont
  }
}

async function deleteOp(fileName: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(queueDir() + fileName, { idempotent: true });
  } catch {
    /* best-effort : une suppression ratée sera retentée au prochain drain */
  }
}

/**
 * Persiste une opération sur disque. Best-effort : lève si le disque est
 * indisponible (l'appelant décide — la capture ne doit jamais s'arrêter pour ça,
 * le .ubx local reste le filet ultime).
 */
export async function enqueue(op: CaptureQueueOp): Promise<void> {
  await ensureDir();
  const name = nextFileName(op.type);
  await FileSystem.writeAsStringAsync(queueDir() + name, JSON.stringify(op), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

// ============================================================================
// Classification d'erreurs (réseau/transitoire vs permanent)
// ============================================================================

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return String(err);
}

function errorCode(err: unknown): string {
  if (err && typeof err === 'object') {
    const c = (err as { code?: unknown }).code;
    if (typeof c === 'string') return c;
    if (typeof c === 'number') return String(c);
  }
  return '';
}

const NETWORK_RE =
  /network|fetch failed|failed to fetch|timeout|timed out|econn|enotfound|socket|offline|unreachable|abort|load failed/i;
const MISSING_FILE_RE = /introuvable|not found|no such file|enoent/i;

function isNetworkFailure(err: unknown): boolean {
  return NETWORK_RE.test(errorMessage(err));
}

/**
 * Décide si une erreur justifie de DROP l'opération (log + suppression), par
 * opposition à un simple report réseau. Prudence : on ne DROP que sur erreur
 * NON-RÉSEAU CLAIRE — erreur logique Postgres (SQLSTATE/`code` présent) ou
 * fichier source disparu. Tout le reste est traité comme transitoire (conservé).
 */
function isPermanentFailure(err: unknown): boolean {
  if (isNetworkFailure(err)) return false;
  if (MISSING_FILE_RE.test(errorMessage(err))) return true;
  return errorCode(err).length > 0;
}

// ============================================================================
// Exécution des opérations
// ============================================================================

async function execCreateSession(op: Extract<CaptureQueueOp, { type: 'create_session' }>) {
  const { error } = await supabase
    .from('telemetry_sessions')
    .upsert(op.row, { onConflict: 'id', ignoreDuplicates: false });
  if (error) throw error;
}

async function execFrames(op: Extract<CaptureQueueOp, { type: 'frames' }>) {
  if (op.batch.length === 0) return;
  // TODO(valencia-6): upsert onConflict (session_id,elapsed_ms) pour une
  // idempotence stricte au replay. Insert simple pour l'instant (chantier séparé).
  const { error } = await supabase.from('telemetry_frames').insert(op.batch);
  if (error) throw error;
}

async function execLaps(op: Extract<CaptureQueueOp, { type: 'laps' }>) {
  if (op.rows.length === 0) return;
  const { error } = await supabase.from('laps').insert(op.rows);
  if (error) throw error;
}

async function execComplete(op: Extract<CaptureQueueOp, { type: 'complete' }>) {
  const updates: CaptureSessionUpdate = { ...op.updates };

  // RÉCONCILIATION de total_frames — uniquement pour une clôture 'completed'.
  // Grâce au FIFO, toutes les opérations `frames` de cette séance PRÉCÈDENT ce
  // `complete` et ont donc déjà été insérées quand on arrive ici. On recompte
  // alors le total RÉEL en base pour être honnête : si un lot a été droppé
  // définitivement, total_frames reflète ce qui existe vraiment, pas le total
  // émis. En cas d'échec du comptage (réseau), on retombe sur la valeur portée
  // par l'op — mais l'update qui suit échouera de toute façon et l'op sera
  // rejouée intacte. (Un abort ne recompte pas.)
  if (op.updates.status === 'completed') {
    const countRes = await supabase
      .from('telemetry_frames')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', op.sessionId);
    if (!countRes.error && typeof countRes.count === 'number') {
      updates.total_frames = countRes.count;
    }
  }

  const { error } = await supabase
    .from('telemetry_sessions')
    .update(updates)
    .eq('id', op.sessionId)
    .eq('user_id', op.userId);
  if (error) throw error;
}

async function execUbxUpload(op: Extract<CaptureQueueOp, { type: 'ubx_upload' }>) {
  await uploadTelemetryFile({
    fileUri: op.fileUri,
    userId: op.userId,
    telemetrySessionId: op.sessionId,
  });
}

async function executeOp(op: CaptureQueueOp): Promise<void> {
  switch (op.type) {
    case 'create_session':
      return execCreateSession(op);
    case 'frames':
      return execFrames(op);
    case 'laps':
      return execLaps(op);
    case 'complete':
      return execComplete(op);
    case 'ubx_upload':
      return execUbxUpload(op);
    default: {
      const exhaustive: never = op;
      throw new Error(`Opération de capture inconnue : ${String(exhaustive)}`);
    }
  }
}

// ============================================================================
// Drain
// ============================================================================

let processing = false;

/**
 * Draine la file DANS L'ORDRE. Non réentrant (un drain concurrent renvoie
 * aussitôt). S'arrête au premier échec réseau/transitoire en gardant le reste ;
 * drop les échecs permanents clairs pour ne pas bloquer.
 */
export async function processQueue(): Promise<ProcessResult> {
  if (processing) {
    return { processed: 0, dropped: 0, remaining: await countPending() };
  }
  processing = true;
  let processed = 0;
  let dropped = 0;
  try {
    const files = await listOpFiles();
    for (let i = 0; i < files.length; i += 1) {
      const name = files[i];
      const op = await readOp(name);
      if (!op) {
        // Fichier illisible/corrompu : on le retire pour ne pas bloquer.
        await deleteOp(name);
        dropped += 1;
        continue;
      }
      try {
        await executeOp(op);
        await deleteOp(name);
        processed += 1;
      } catch (err) {
        if (isPermanentFailure(err)) {
          console.warn(
            `[OXV][capture-queue] op ${op.type} abandonnée (erreur permanente) : ${errorMessage(err)}`
          );
          await deleteOp(name);
          dropped += 1;
          continue;
        }
        // Réseau/transitoire : on s'ARRÊTE et on GARDE ce fichier + tous les suivants.
        return { processed, dropped, remaining: files.length - i };
      }
    }
    return { processed, dropped, remaining: 0 };
  } finally {
    processing = false;
  }
}

async function countPending(): Promise<number> {
  return (await listOpFiles()).length;
}

/** Vrai s'il reste au moins une opération à synchroniser. */
export async function hasPending(): Promise<boolean> {
  return (await listOpFiles()).length > 0;
}

/** Identifiants de séances ayant encore des opérations en attente (dédupliqués). */
export async function pendingSessionIds(): Promise<string[]> {
  const files = await listOpFiles();
  const ids = new Set<string>();
  for (const name of files) {
    const op = await readOp(name);
    if (op) ids.add(op.sessionId);
  }
  return [...ids];
}

/**
 * Reprise au lancement de l'app (ou au retour réseau) : draine la file si elle
 * n'est pas vide. Silencieux et non bloquant (silence en piste). À appeler en
 * fire-and-forget (`void resumeUnsyncedCaptures()`).
 */
export async function resumeUnsyncedCaptures(): Promise<void> {
  try {
    if (await hasPending()) {
      await processQueue();
    }
  } catch (e) {
    console.warn(`[OXV][capture-queue] reprise KO : ${errorMessage(e)}`);
  }
}

// ============================================================================
// Réimport .ubx → telemetry_frames (filet de dernier recours)
// ============================================================================

/**
 * Ré-insère dans telemetry_frames les trames d'un fichier .ubx local, pour une
 * séance dont des lots sont définitivement absents côté serveur. Réutilise le
 * parser UBX existant (checksum Fletcher-8 + reconstruction par chunks).
 *
 * Best-effort, idempotent-ready : les trames sont insérées par paquets ; un lot
 * en échec est loggé sans interrompre les autres. L'`elapsed_ms` est dérivé de
 * l'iTOW relatif au premier échantillon (comme parseUbxFile) — la déduplication
 * stricte sur (session_id, elapsed_ms) est le CHANTIER 6 (upsert), séparé.
 */
export async function reimportUbxToFrames(
  sessionId: string,
  userId: string,
  fileUri: string
): Promise<{ inserted: number }> {
  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists) {
    throw new Error(`Fichier .ubx introuvable : ${fileUri}`);
  }
  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = new Uint8Array(Buffer.from(base64, 'base64'));

  const buffer = new UbxFrameBuffer();
  const chunkSize = 4096;
  const rawFrames: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    rawFrames.push(...buffer.push(bytes.slice(i, i + chunkSize)));
  }

  const rows: TelemetryFrameInsert[] = [];
  let originItow: number | null = null;
  for (const frameBytes of rawFrames) {
    const data = parseRaceBoxDataMessage(frameBytes);
    if (!data) continue;
    if (originItow === null) originItow = data.timestamp.iTOW;
    rows.push(raceBoxToFrameInsert(data, sessionId, data.timestamp.iTOW - originItow));
  }
  if (rows.length === 0) return { inserted: 0 };

  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    // TODO(valencia-6): upsert onConflict (session_id,elapsed_ms) — idempotence stricte.
    const { error } = await supabase.from('telemetry_frames').insert(batch);
    if (error) {
      console.warn(
        `[OXV][capture-queue] réimport .ubx : lot KO (session ${sessionId}, user ${userId}) : ${error.message}`
      );
      continue;
    }
    inserted += batch.length;
  }
  return { inserted };
}
