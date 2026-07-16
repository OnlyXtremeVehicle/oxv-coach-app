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
 * chaque opération réussie ; s'ARRÊTE au premier échec RÉSEAU/TRANSITOIRE en
 * gardant le reste (FIFO préservé, on ne martèle pas un réseau tombé) ; met en
 * QUARANTAINE (log + déplacement sous `capture-queue/quarantine/`, JAMAIS de
 * suppression) une opération en échec réellement LOGIQUE, pour ne pas bloquer la
 * file. Toute erreur ambiguë est traitée prudemment comme transitoire (conservée,
 * jamais perdue).
 *
 * CLASSIFICATION — liste BLANCHE d'abandon (cf. Valencia §1) :
 *   - DROP seulement sur erreur sans espoir de rejeu : SQLSTATE 22 (donnée
 *     invalide), 23 (intégrité) SAUF 23503/23505, 42 (syntaxe/privilège),
 *     PGRST202/PGRST205, fichier source absent, et quelques statuts Storage ;
 *   - TRANSITOIRE explicite : SQLSTATE 08/40/53/57, PGRST000/001/002 (503
 *     plateforme, p. ex. rechargement du cache de schéma après une migration) ;
 *   - DÉFAUT pour tout code INCONNU : TRANSITOIRE. C'est le sens de la promesse
 *     ci-dessus : un code qu'on ne sait pas lire n'autorise pas à détruire la
 *     donnée d'un pilote.
 *   - GARDE DURE : une op `create_session` n'est JAMAIS abandonnée — la FK
 *     `telemetry_frames.session_id … ON DELETE CASCADE` ferait tomber TOUTE la
 *     séance derrière elle.
 *
 * IDEMPOTENCE au replay :
 *   - create_session : upsert onConflict 'id' (pose/replace la ligne) ;
 *   - frames         : upsert onConflict (session_id, elapsed_ms) ignoreDuplicates
 *                      (Valencia §4.6) — un rejeu de lot ne crée plus de doublon.
 *                      GARDE : si la contrainte UNIQUE n'est pas encore en prod
 *                      (42P10), repli automatique sur insert simple, RÉ-ARMÉ dès
 *                      qu'un 23505 prouve que la migration est passée (cf.
 *                      insertFramesIdempotent) ;
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
  /**
   * Opérations abandonnées (erreur logique / fichier illisible). Elles ne sont
   * pas détruites : elles partent en `capture-queue/quarantine/`.
   */
  dropped: number;
  /** Opérations restant sur disque (arrêt réseau, upload sauté, ou rien à faire). */
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

/**
 * Sous-dossier des opérations ABANDONNÉES. Elles y sont DÉPLACÉES, jamais
 * supprimées : la file repart, mais la donnée du pilote reste inspectable et
 * rejouable à la main. Une séance ne doit pas mourir dans une branche `catch`.
 */
function quarantineDir(): string {
  return `${queueDir()}quarantine/`;
}

/**
 * Enveloppe persistée sur disque. `attempts` borne le dead-letter d'`ubx_upload`
 * (seul type d'op où l'on abandonne au bout d'un nombre de tentatives) ; les
 * autres types ne sont jamais abandonnés pour cause de tentatives. L'enveloppe
 * évite de polluer l'union `CaptureQueueOp` avec des champs de transport.
 */
interface QueueEnvelope {
  op: CaptureQueueOp;
  attempts: number;
  enqueuedAt: string;
}

/** Tentatives transitoires tolérées pour un `ubx_upload` avant quarantaine. */
const MAX_UPLOAD_ATTEMPTS = 10;

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

/**
 * Noms de fichiers d'opérations, triés en ordre FIFO (lexicographique).
 * Le filtre `.json` écarte par construction le sous-dossier `quarantine/` et les
 * `.tmp` d'écriture en cours (invisibles au drain tant qu'ils ne sont pas
 * renommés — cf. `writeEnvelopeAtomic`).
 */
async function listOpFiles(): Promise<string[]> {
  const dir = queueDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) return [];
  const names = await FileSystem.readDirectoryAsync(dir);
  return names.filter((n) => n.endsWith('.json') && !n.includes('/')).sort();
}

/**
 * Relit une enveloppe. Accepte aussi une op « nue » écrite par une version
 * antérieure de l'app : la file survit à une mise à jour en cours de journée.
 */
function parseEnvelope(raw: string): QueueEnvelope | null {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  const env = parsed as Partial<QueueEnvelope>;
  if (env.op && typeof env.op === 'object' && typeof (env.op as CaptureQueueOp).type === 'string') {
    return {
      op: env.op as CaptureQueueOp,
      attempts: typeof env.attempts === 'number' ? env.attempts : 0,
      enqueuedAt: typeof env.enqueuedAt === 'string' ? env.enqueuedAt : '',
    };
  }
  if (typeof (parsed as Partial<CaptureQueueOp>).type === 'string') {
    return { op: parsed as CaptureQueueOp, attempts: 0, enqueuedAt: '' };
  }
  return null;
}

async function readOp(fileName: string): Promise<QueueEnvelope | null> {
  try {
    const raw = await FileSystem.readAsStringAsync(queueDir() + fileName, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return parseEnvelope(raw);
  } catch {
    return null; // fichier illisible/corrompu → quarantaine en amont
  }
}

async function deleteOp(fileName: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(queueDir() + fileName, { idempotent: true });
  } catch {
    /* best-effort : une suppression ratée sera retentée au prochain drain */
  }
}

async function ensureQuarantineDir(): Promise<void> {
  const dir = quarantineDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

/**
 * Déplace une op abandonnée en quarantaine AU LIEU de la détruire. Best-effort :
 * si le déplacement échoue, on laisse le fichier en place plutôt que de le
 * supprimer — le prochain drain retentera. Ne jamais lever (silence en piste).
 */
async function quarantineOp(fileName: string): Promise<void> {
  try {
    await ensureQuarantineDir();
    await FileSystem.moveAsync({
      from: queueDir() + fileName,
      to: quarantineDir() + fileName,
    });
  } catch (e) {
    console.warn(`[OXV][capture-queue] mise en quarantaine KO (${fileName}) : ${errorMessage(e)}`);
  }
}

/**
 * Écrit une enveloppe de façon ATOMIQUE : fichier temporaire puis renommage.
 * Le `.tmp` ne finit pas par `.json`, donc le drain ne le voit jamais ; le
 * renommage rend le fichier visible d'un coup, complet ou pas du tout.
 * Indispensable sur Android : `writeAsStringAsync` y écrit en flux, hors du
 * thread JS — un fichier à demi écrit y était listable, donc lisible tronqué.
 * (iOS écrit déjà atomiquement ; on unifie pour ne pas dépendre de l'OS.)
 */
async function writeEnvelopeAtomic(name: string, env: QueueEnvelope): Promise<void> {
  const tmp = `${queueDir()}${name}.tmp`;
  await FileSystem.writeAsStringAsync(tmp, JSON.stringify(env), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await FileSystem.moveAsync({ from: tmp, to: queueDir() + name });
}

/**
 * Persiste une opération sur disque. Best-effort : lève si le disque est
 * indisponible (l'appelant décide — la capture ne doit jamais s'arrêter pour ça,
 * le .ubx local reste le filet ultime).
 */
export async function enqueue(op: CaptureQueueOp): Promise<void> {
  await ensureDir();
  const name = nextFileName(op.type);
  await writeEnvelopeAtomic(name, { op, attempts: 0, enqueuedAt: new Date().toISOString() });
}

/**
 * Balaie les `.tmp` orphelins (écriture torpillée par un crash/OOM). Ils ne sont
 * pas drainables mais leurs octets peuvent être inspectés : quarantaine, jamais
 * suppression.
 */
async function sweepOrphanTmp(): Promise<void> {
  try {
    const dir = queueDir();
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) return;
    const names = await FileSystem.readDirectoryAsync(dir);
    for (const n of names) {
      if (n.endsWith('.tmp') && !n.includes('/')) await quarantineOp(n);
    }
  } catch {
    /* best-effort : ne jamais bloquer la reprise */
  }
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
 * Codes PostgREST TRANSITOIRES : 503 de la plateforme. PGRST002 (« Could not
 * query the database for its schema cache ») survient notamment pendant les
 * quelques secondes qui suivent l'application d'une migration — soit exactement
 * la manœuvre prévue en prod le jour J. PGRST000/001 = pooler/connexion.
 * Ces erreurs portent un `code` mais ne sont EN RIEN logiques.
 */
const TRANSIENT_PGRST_CODES = new Set(['PGRST000', 'PGRST001', 'PGRST002']);

/**
 * Classes SQLSTATE TRANSITOIRES : 08 connexion, 40 rollback/sérialisation,
 * 53 ressources épuisées (53300 « sorry, too many clients already » — le cas
 * quand tous les pilotes synchronisent en fin de roulage), 57 intervention
 * opérateur (57P03 arrêt/redémarrage de la base).
 */
const TRANSIENT_SQLSTATE_CLASSES = new Set(['08', '40', '53', '57']);

/**
 * Codes PostgREST réellement LOGIQUES : la requête ne peut pas aboutir au rejeu.
 * PGRST202 = fonction RPC introuvable, PGRST205 = table absente du schéma.
 */
const DROPPABLE_PGRST_CODES = new Set(['PGRST202', 'PGRST205']);

/**
 * Classes SQLSTATE réellement LOGIQUES : 22 donnée invalide, 23 violation de
 * contrainte, 42 syntaxe/type/privilège (dont 42501 RLS).
 */
const DROPPABLE_SQLSTATE_CLASSES = new Set(['22', '23', '42']);

/**
 * Classe un `code` d'erreur. LISTE BLANCHE d'abandon : on ne renvoie `true` que
 * pour ce dont on est SÛR que le rejeu ne peut rien changer. Tout code inconnu
 * est traité comme TRANSITOIRE — c'est l'inversion voulue (l'ancienne règle
 * « tout code ⇒ abandon » faisait détruire une séance entière par un 503).
 */
function isDroppableCode(code: string): boolean {
  if (TRANSIENT_PGRST_CODES.has(code)) return false;
  if (DROPPABLE_PGRST_CODES.has(code)) return true;
  // 23503 (foreign_key_violation) sur frames/laps n'est PAS une erreur de
  // donnée : c'est un signal d'ORDONNANCEMENT — le `create_session` de la
  // séance n'est pas encore passé. On conserve et on laisse le FIFO rejouer.
  if (code === '23503') return false;
  // 23505 (unique_violation) : soit les lignes sont déjà en base, soit le lot
  // doit être absorbé en UPSERT (cf. insertFramesIdempotent). Jeter 50 trames
  // pour une collision sur une seule serait absurde.
  if (code === '23505') return false;
  const cls = code.slice(0, 2);
  if (TRANSIENT_SQLSTATE_CLASSES.has(cls)) return false;
  if (DROPPABLE_SQLSTATE_CLASSES.has(cls)) return true;
  return false;
}

/**
 * Erreurs Supabase Storage : storage-js n'expose que `status`/`statusCode`, JAMAIS
 * `.code` (asymétrie vérifiée avec postgrest-js, qui lui pose `.code`). La
 * classification par SQLSTATE est donc aveugle ici, et un `ubx_upload` en échec
 * dur bloquerait la file. On ne DROPPE que ce qui ne peut structurellement pas
 * aboutir au rejeu : 400 (requête malformée), 413 (au-dessus de la limite du
 * bucket), 415 (type refusé).
 *
 * SURTOUT PAS 401/403 : JWT expiré ou mauvais pilote connecté sont RÉCUPÉRABLES
 * (rafraîchissement du jeton, reconnexion) — les dropper perdrait la télémétrie
 * brute sur une erreur pourtant réparable. Idem 404 (bucket absent = config).
 */
function isStorageDroppable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const status = (err as { status?: unknown }).status;
  if (typeof status !== 'number') return false;
  return status === 400 || status === 413 || status === 415;
}

/**
 * Décide si une erreur justifie d'ABANDONNER l'opération (log + quarantaine),
 * par opposition à la conserver pour un rejeu ultérieur.
 */
function isDroppableFailure(op: CaptureQueueOp, err: unknown): boolean {
  // GARDE DURE : `create_session` n'est JAMAIS abandonnée, même sur une erreur
  // parfaitement logique. La ligne de séance porte la FK de toutes les trames et
  // de tous les tours (ON DELETE CASCADE) : l'abandonner fait tomber la séance
  // ENTIÈRE, en silence. Mieux vaut une file bloquée — visible, réparable — que
  // des heures de piste effacées.
  if (op.type === 'create_session') return false;
  if (isNetworkFailure(err)) return false;
  if (MISSING_FILE_RE.test(errorMessage(err))) return true;
  const code = errorCode(err);
  if (code.length === 0) return isStorageDroppable(err);
  return isDroppableCode(code);
}

// ============================================================================
// Insertion idempotente des trames (Valencia §4.6)
// ============================================================================

/**
 * Bascule de repli : passe à `true` dès qu'on constate que la contrainte UNIQUE
 * (session_id, elapsed_ms) n'existe pas encore en prod. On cesse alors de tenter
 * l'UPSERT (qui échouerait à chaque lot) et on insère directement.
 *
 * NON définitive : un 23505 en mode repli prouve que la contrainte est apparue
 * entre-temps (migration appliquée en cours de journée, sans redémarrage de
 * l'app) et RÉ-ARME la bascule — cf. `insertFramesIdempotent`.
 */
let framesUpsertUnsupported = false;
/** Ne loguer le repli qu'UNE fois (pas à chaque lot). */
let framesUpsertFallbackLogged = false;

/**
 * Vrai si l'erreur signale l'ABSENCE de contrainte UNIQUE/exclusion compatible
 * avec la clause ON CONFLICT (Postgres 42P10). C'est le cas tant que la migration
 * Valencia §4.6 n'a pas été appliquée en prod.
 */
function isMissingConflictConstraint(err: unknown): boolean {
  if (errorCode(err) === '42P10') return true;
  // Détection RESSERRÉE : un simple `includes('on conflict')` enclencherait le
  // repli sur n'importe quelle erreur mentionnant la clause (p. ex. un 23505,
  // dont le message la cite parfois) — le repli doit rester réservé à l'absence
  // AVÉRÉE de contrainte.
  return errorMessage(err).toLowerCase().includes('no unique or exclusion constraint');
}

/**
 * Insère un lot de trames de façon IDEMPOTENTE (Valencia §4.6).
 *
 * Chemin nominal : UPSERT onConflict (session_id, elapsed_ms) ignoreDuplicates —
 * un rejeu de lot par la file de synchro n'introduit AUCUN doublon.
 *
 * GARDE ANTI-CASSE : tant que la migration
 * `..._valencia_telemetry_frames_unique.sql` n'est pas appliquée en prod, la
 * contrainte UNIQUE n'existe pas et Postgres renvoie 42P10 (« no unique or
 * exclusion constraint matching the ON CONFLICT specification »). On DÉTECTE ce
 * cas et on RETOMBE sur un `.insert(batch)` simple (le lot passe quand même), en
 * loguant UNE seule fois. Le code est ainsi SÛR que la contrainte existe ou non,
 * et devient RÉELLEMENT idempotent dès que la migration est en prod. Les autres
 * erreurs (réseau/permanentes) sont propagées telles quelles à l'appelant.
 */
async function insertFramesIdempotent(batch: TelemetryFrameInsert[]): Promise<void> {
  if (!framesUpsertUnsupported) {
    const { error } = await supabase
      .from('telemetry_frames')
      .upsert(batch, { onConflict: 'session_id,elapsed_ms', ignoreDuplicates: true });
    if (!error) return;
    if (!isMissingConflictConstraint(error)) throw error;
    // Contrainte pas encore en prod : bascule définitive vers l'insert simple.
    framesUpsertUnsupported = true;
    if (!framesUpsertFallbackLogged) {
      framesUpsertFallbackLogged = true;
      console.warn(
        '[OXV][capture-queue] contrainte UNIQUE (session_id,elapsed_ms) absente — ' +
          "repli sur insert simple. Appliquer la migration Valencia §4.6 pour l'idempotence stricte."
      );
    }
  }
  const { error } = await supabase.from('telemetry_frames').insert(batch);
  if (!error) return;
  // Un 23505 en mode repli est la PREUVE que la contrainte existe DÉSORMAIS : la
  // migration a été appliquée pendant la vie de l'app. Laisser la bascule à
  // `true` transformerait alors une collision sur UNE trame en abandon du lot
  // ENTIER. On ré-arme et on rejoue en UPSERT : ON CONFLICT DO NOTHING absorbe
  // aussi bien le rejeu de lot que l'ex æquo intra-lot.
  if (errorCode(error) === '23505') {
    framesUpsertUnsupported = false;
    framesUpsertFallbackLogged = false;
    const retry = await supabase
      .from('telemetry_frames')
      .upsert(batch, { onConflict: 'session_id,elapsed_ms', ignoreDuplicates: true });
    if (retry.error) throw retry.error;
    return;
  }
  throw error;
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
  await insertFramesIdempotent(op.batch);
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
 * met en quarantaine les échecs réellement logiques pour ne pas bloquer.
 */
export async function processQueue(): Promise<ProcessResult> {
  if (processing) {
    return { processed: 0, dropped: 0, remaining: await countPending() };
  }
  processing = true;
  let processed = 0;
  let dropped = 0;
  // Ops laissées sur disque sans bloquer la file (upload transitoire sauté).
  let skipped = 0;
  try {
    const files = await listOpFiles();
    for (let i = 0; i < files.length; i += 1) {
      const name = files[i];
      const env = await readOp(name);
      if (!env) {
        // Fichier illisible/corrompu (écriture torpillée, JSON tronqué) : on le
        // sort de la file pour ne pas la bloquer, mais on le GARDE — ses octets
        // sont peut-être un lot de trames récupérable à la main.
        await quarantineOp(name);
        dropped += 1;
        continue;
      }
      const { op } = env;
      try {
        await executeOp(op);
        await deleteOp(name);
        processed += 1;
      } catch (err) {
        if (isDroppableFailure(op, err)) {
          console.warn(
            `[OXV][capture-queue] op ${op.type} abandonnée (erreur logique) : ${errorMessage(err)}`
          );
          await quarantineOp(name);
          dropped += 1;
          continue;
        }
        if (op.type === 'ubx_upload') {
          // Op FEUILLE : aucune autre op ne dépend d'elle (contrairement à
          // create_session → frames/laps/complete). L'arrêter le drain entier
          // ferait bloquer À VIE toutes les séances suivantes derrière un upload
          // durablement en échec (403 du mauvais pilote, 413…). On la SAUTE et
          // on la garde sur disque, en comptant la tentative.
          const attempts = env.attempts + 1;
          if (attempts >= MAX_UPLOAD_ATTEMPTS) {
            console.warn(
              `[OXV][capture-queue] ubx_upload en échec après ${attempts} tentatives — quarantaine : ${errorMessage(err)}`
            );
            await quarantineOp(name);
            dropped += 1;
            continue;
          }
          try {
            await writeEnvelopeAtomic(name, { ...env, attempts });
          } catch {
            /* compteur non persisté : coûte une tentative de plus, rien de plus */
          }
          skipped += 1;
          continue;
        }
        // Réseau/transitoire : on s'ARRÊTE et on GARDE ce fichier + tous les suivants.
        return { processed, dropped, remaining: files.length - i + skipped };
      }
    }
    return { processed, dropped, remaining: skipped };
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
    const env = await readOp(name);
    if (env) ids.add(env.op.sessionId);
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
    // Un crash pendant une écriture laisse un `.tmp` partiel : on l'évacue avant
    // de drainer (il n'est pas listé par la file, donc jamais nettoyé sinon).
    await sweepOrphanTmp();
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
 * Best-effort et IDEMPOTENT (Valencia §4.6) : les trames sont insérées par
 * paquets via `insertFramesIdempotent` (UPSERT onConflict (session_id,
 * elapsed_ms), repli insert si la contrainte n'est pas encore en prod) ; un lot
 * en échec est loggé sans interrompre les autres. L'`elapsed_ms` est dérivé de
 * l'iTOW relatif au premier échantillon (comme parseUbxFile) — deux réimports
 * du même .ubx ne créent donc plus de doublons une fois la migration appliquée.
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
    try {
      await insertFramesIdempotent(batch);
      inserted += batch.length;
    } catch (err) {
      console.warn(
        `[OXV][capture-queue] réimport .ubx : lot KO (session ${sessionId}, user ${userId}) : ${errorMessage(err)}`
      );
      continue;
    }
  }
  return { inserted };
}
