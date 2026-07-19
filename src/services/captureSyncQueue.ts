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
 * jamais perdue). Un drain concurrent ne perd pas son déclencheur : il est
 * COALESCÉ et rejoué en fin de passe (cf. `processQueue`).
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
 *   - attach_intention : update .eq(id) posant `session_id` — idempotent par
 *                      nature (même id d'intention, même séance à chaque rejeu) ;
 *   - frames         : upsert onConflict (session_id, elapsed_ms) ignoreDuplicates
 *                      (Valencia §4.6) — un rejeu de lot ne crée plus de doublon.
 *                      GARDE : si la contrainte UNIQUE n'est pas encore en prod
 *                      (42P10), repli automatique sur insert simple, RÉ-ARMÉ dès
 *                      qu'un 23505 prouve que la migration est passée ;
 *   - laps           : upsert onConflict (session_id, lap_number) ignoreDuplicates
 *                      — un rejeu de la file ne duplique plus les tours. MÊME
 *                      garde 42P10 + ré-armement 23505 que les trames. L'op porte
 *                      le lot COMPLET et immuable des tours : un rejeu est
 *                      identique à l'original, `ignoreDuplicates` est donc exact ;
 *   - complete       : update .eq(id).eq(user_id) — idempotent par nature, et
 *                      RÉCONCILIE `total_frames` en recomptant les trames RÉELLES
 *                      en base (voir execComplete) ;
 *   - ubx_upload     : uploadTelemetryFile (déjà idempotent, upsert:true).
 *
 * ── CHOIX DE LA CLÉ D'IDEMPOTENCE DES TRAMES (Valencia §4.6) ────────────────
 * Retenu : (session_id, elapsed_ms), avec `elapsed_ms` rendu STRICTEMENT
 * croissant à la source (captureFrameMapping.nextElapsedMs).
 *
 * L'alternative examinée et ÉCARTÉE était (session_id, itow_ms). `itow_ms` a
 * pourtant un attrait réel : c'est la seule valeur issue du BOÎTIER, donc
 * identique par construction sur le chemin live ET sur le réimport .ubx. Deux
 * raisons dirimantes l'écartent comme clé d'UNICITÉ :
 *
 *   1. Son unicité n'est pas la NÔTRE. L'iTOW est un temps GPS produit par le
 *      RaceBox : avant fix il peut se répéter ou rester à 0, et il se réenroule
 *      chaque dimanche à 00:00 UTC. Sous `ignoreDuplicates` (ON CONFLICT DO
 *      NOTHING), toute répétition d'iTOW = une trame RÉELLE DISTINCTE DÉTRUITE
 *      EN SILENCE — exactement le défaut qu'on corrige. On ne fonde pas
 *      l'identité d'une donnée de pilote sur une valeur qu'on ne contrôle pas
 *      et dont on ne peut pas PROUVER l'unicité.
 *   2. `itow_ms` est NULLABLE (colonne + type). En Postgres les NULL sont
 *      DISTINCTS : un index total ne dédoublonnerait donc PAS les lignes à iTOW
 *      nul, et un index partiel `WHERE itow_ms IS NOT NULL` les laisserait sans
 *      protection. Un `SET NOT NULL` interdirait par ailleurs toute source de
 *      trame future sans iTOW.
 *
 * `elapsed_ms` strict offre au contraire une garantie SOUS NOTRE CONTRÔLE :
 * unique par séance par construction, et STABLE au rejeu (calculé une seule
 * fois à la capture puis sérialisé dans le lot) — les deux propriétés que
 * l'idempotence exige, et les seules.
 *
 * COMPROMIS ASSUMÉ : la clé `elapsed_ms` ne réconcilie pas, à elle seule, le
 * réimport .ubx (base de temps différente du live). On ne le règle donc PAS en
 * changeant la clé, mais là où est le problème : `reimportUbxToFrames`
 * réconcilie explicitement sur `itow_ms` — l'identité PHYSIQUE de la trame,
 * ce que l'iTOW est réellement — sans lui faire porter une unicité qu'il ne
 * garantit pas. Voir l'en-tête de cette fonction.
 *
 * RÉTENTION DES .ubx : le brut local n'est PAS supprimé à l'upload — il reste le
 * filet de reprise. Il est effacé par ÂGE (`gcOldCaptures`, 7 j) depuis
 * `resumeUnsyncedCaptures`, et jamais tant qu'il peut encore servir.
 *
 * Doctrine « silence en piste » : ce module n'affiche rien, ne notifie rien.
 */

import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';

import { captureException } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';
import { uploadTelemetryFile } from '@/services/telemetryStorage';
import { parseRaceBoxDataMessage, UbxFrameBuffer } from '@/ubx/parser';
import type { Database } from '@/types/database.types';
import type { RaceBoxData } from '@/types/telemetry';

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
  | { type: 'attach_intention'; sessionId: string; intentionId: string }
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

/** Relit une enveloppe à un chemin ABSOLU (file d'attente ou quarantaine). */
async function readEnvelopeAt(path: string): Promise<QueueEnvelope | null> {
  try {
    const raw = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return parseEnvelope(raw);
  } catch {
    return null; // fichier illisible/corrompu → quarantaine en amont
  }
}

async function readOp(fileName: string): Promise<QueueEnvelope | null> {
  return readEnvelopeAt(queueDir() + fileName);
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
    // SEC-1 : échec silencieux critique remonté à Sentry (aucun changement de flux).
    captureException(e, { point: 'capture-queue.quarantaine_deplacement_ko', fichier: fileName });
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
// Écriture idempotente (Valencia §4.6) — trames et tours
// ============================================================================

/**
 * Bascule de repli par table : passe à `true` dès qu'on constate que la
 * contrainte UNIQUE n'existe pas encore en prod. On cesse alors de tenter
 * l'UPSERT (qui échouerait à chaque lot) et on insère directement.
 *
 * NON définitive : un 23505 en mode repli prouve que la contrainte est apparue
 * entre-temps (migration appliquée en cours de journée, sans redémarrage de
 * l'app) et RÉ-ARME la bascule — cf. `writeIdempotent`.
 */
interface UpsertGuard {
  /** Contrainte UNIQUE constatée absente (42P10) → repli sur insert simple. */
  unsupported: boolean;
  /** Ne loguer le repli qu'UNE fois (pas à chaque lot). */
  logged: boolean;
}

const framesGuard: UpsertGuard = { unsupported: false, logged: false };
const lapsGuard: UpsertGuard = { unsupported: false, logged: false };

/** Réponse minimale d'un appel PostgREST, telle qu'on la classe ici. */
type WriteOutcome = { error: unknown };

/**
 * Exécute une écriture IDEMPOTENTE : UPSERT `ON CONFLICT DO NOTHING`, avec
 * repli sûr tant que la contrainte UNIQUE n'est pas en prod.
 *
 * Motif commun aux trames et aux tours (les deux seules ops multi-lignes de la
 * file), en trois temps :
 *
 *   1. UPSERT nominal. Un rejeu de lot n'introduit aucun doublon.
 *   2. 42P10 (« no unique or exclusion constraint matching the ON CONFLICT
 *      specification ») = la migration Valencia n'est pas encore appliquée. On
 *      bascule sur `.insert()` simple (le lot passe quand même) en loguant UNE
 *      fois. Les autres erreurs (réseau/logiques) remontent telles quelles.
 *   3. 23505 en mode repli = PREUVE que la contrainte existe DÉSORMAIS (migration
 *      appliquée pendant la vie de l'app, sans redémarrage). Laisser la bascule
 *      à `true` transformerait une collision sur UNE ligne en abandon du lot
 *      ENTIER : on RÉ-ARME et on rejoue en UPSERT, qui absorbe aussi bien le
 *      rejeu de lot que l'ex æquo intra-lot. Jamais de lot perdu pour une
 *      collision d'unicité.
 */
async function writeIdempotent(
  guard: UpsertGuard,
  keyLabel: string,
  upsert: () => Promise<WriteOutcome>,
  insert: () => Promise<WriteOutcome>
): Promise<void> {
  if (!guard.unsupported) {
    const { error } = await upsert();
    if (!error) return;
    if (!isMissingConflictConstraint(error)) throw error;
    guard.unsupported = true;
    if (!guard.logged) {
      guard.logged = true;
      console.warn(
        `[OXV][capture-queue] contrainte UNIQUE ${keyLabel} absente — ` +
          "repli sur insert simple. Appliquer la migration Valencia §4.6 pour l'idempotence stricte."
      );
    }
  }
  const { error } = await insert();
  if (!error) return;
  if (errorCode(error) === '23505') {
    guard.unsupported = false;
    guard.logged = false;
    const retry = await upsert();
    if (retry.error) throw retry.error;
    return;
  }
  throw error;
}

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
 * Clé : (session_id, elapsed_ms) — cf. l'argumentaire du choix de clé en tête
 * de module. Repose sur la STRICTE croissance d'`elapsed_ms` garantie à la
 * source (captureFrameMapping.nextElapsedMs) : sans elle, deux trames réelles
 * distinctes partageraient une clé et l'une serait jetée en silence.
 */
async function insertFramesIdempotent(batch: TelemetryFrameInsert[]): Promise<void> {
  await writeIdempotent(
    framesGuard,
    '(session_id,elapsed_ms)',
    async () =>
      await supabase
        .from('telemetry_frames')
        .upsert(batch, { onConflict: 'session_id,elapsed_ms', ignoreDuplicates: true }),
    async () => await supabase.from('telemetry_frames').insert(batch)
  );
}

/**
 * Insère les tours de façon IDEMPOTENTE.
 *
 * Clé naturelle : (session_id, lap_number). Les lignes de `laps` ne portent
 * AUCUN `id` client (buildLapRows) : le serveur applique `gen_random_uuid()` à
 * chaque insert, donc un rejeu de la file — at-least-once par construction :
 * réponse perdue après COMMIT, `deleteOp` raté, ou app tuée entre l'exécution et
 * la suppression du fichier — créait des lignes NEUVES sans jamais entrer en
 * collision. Une séance de 12 tours en affichait 24, avec `is_best_lap` vrai sur
 * deux lignes et `loadLapFrames` (.maybeSingle) en erreur « multiple rows ».
 */
async function insertLapsIdempotent(rows: LapInsert[]): Promise<void> {
  await writeIdempotent(
    lapsGuard,
    '(session_id,lap_number)',
    async () =>
      await supabase
        .from('laps')
        .upsert(rows, { onConflict: 'session_id,lap_number', ignoreDuplicates: true }),
    async () => await supabase.from('laps').insert(rows)
  );
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

/**
 * Rattache l'intention posée en préparation à la séance (V9 §7).
 *
 * Passe par la FILE, comme tout le write-path : hors-ligne, l'UPDATE attend au
 * lieu d'être perdu. Le FIFO garantit que le `create_session` de CETTE séance a
 * déjà été joué quand on arrive ici — la FK `session_id` et le `with check` RLS
 * (`session_id in (select id from telemetry_sessions where user_id = auth.uid())`)
 * sont donc satisfaits. L'op ne porte QUE des identifiants : elle n'écrit jamais
 * de contenu, ne suggère rien (doctrine).
 */
async function execAttachIntention(op: Extract<CaptureQueueOp, { type: 'attach_intention' }>) {
  const { error } = await supabase
    .from('session_intentions')
    .update({ session_id: op.sessionId } as never)
    .eq('id', op.intentionId);
  if (error) throw error;
}

async function execFrames(op: Extract<CaptureQueueOp, { type: 'frames' }>) {
  if (op.batch.length === 0) return;
  await insertFramesIdempotent(op.batch);
}

async function execLaps(op: Extract<CaptureQueueOp, { type: 'laps' }>) {
  if (op.rows.length === 0) return;
  await insertLapsIdempotent(op.rows);
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
    case 'attach_intention':
      return execAttachIntention(op);
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
 * Un drain a été DEMANDÉ pendant qu'un autre était en vol. On COALESCE le
 * déclencheur au lieu de l'avaler : le drain en cours re-listera la file avant
 * de rendre la main. Voir `processQueue`.
 */
let rerunRequested = false;

/** Bilan d'UNE passe de drain, plus le motif de sortie (cf. `processQueue`). */
interface DrainPass {
  processed: number;
  dropped: number;
  remaining: number;
  /** Sortie sur échec RÉSEAU/TRANSITOIRE : la file est gardée, on ne rejoue PAS. */
  stoppedOnNetwork: boolean;
}

/**
 * UNE passe : liste la file une fois et la traite dans l'ordre. La liste est
 * figée à l'entrée — les ops enqueuées PENDANT la passe ne sont pas vues ici
 * (c'est `processQueue` qui les rattrape via le rejeu coalescé).
 */
async function drainOnce(): Promise<DrainPass> {
  let processed = 0;
  let dropped = 0;
  // Ops laissées sur disque sans bloquer la file (upload transitoire sauté).
  let skipped = 0;
  const files = await listOpFiles();
  for (let i = 0; i < files.length; i += 1) {
    const name = files[i];
    const env = await readOp(name);
    if (!env) {
      // Fichier illisible/corrompu (écriture torpillée, JSON tronqué) : on le
      // sort de la file pour ne pas la bloquer, mais on le GARDE — ses octets
      // sont peut-être un lot de trames récupérable à la main.
      // SEC-1 : remonté à Sentry (donnée pilote écartée = jamais silencieux).
      captureException(new Error('capture-queue : fichier de file illisible mis en quarantaine'), {
        point: 'capture-queue.quarantaine_fichier_illisible',
        fichier: name,
      });
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
        // SEC-1 : quarantaine logique remontée à Sentry (aucun changement de flux).
        captureException(err, {
          point: 'capture-queue.quarantaine_logique',
          opType: op.type,
          sessionId: op.sessionId,
          fichier: name,
        });
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
          // SEC-1 : abandon d'upload .ubx remonté à Sentry (aucun changement de flux).
          captureException(err, {
            point: 'capture-queue.quarantaine_upload',
            sessionId: op.sessionId,
            attempts,
          });
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
      return {
        processed,
        dropped,
        remaining: files.length - i + skipped,
        stoppedOnNetwork: true,
      };
    }
  }
  return { processed, dropped, remaining: skipped, stoppedOnNetwork: false };
}

/**
 * Draine la file DANS L'ORDRE. S'arrête au premier échec réseau/transitoire en
 * gardant le reste ; met en quarantaine les échecs réellement logiques pour ne
 * pas bloquer.
 *
 * NON RÉENTRANT, mais le déclencheur d'un appel concurrent n'est PAS AVALÉ : il
 * est COALESCÉ (`rerunRequested`) et la passe en cours est REJOUÉE avant de
 * rendre la main. Sans ce rejeu, une op enqueuée après le listing d'une passe en
 * vol n'était vue ni par l'appelant (qui rendait la main aussitôt) ni par le
 * drain en cours (dont la liste est figée) : elle dormait sur disque jusqu'au
 * prochain démarrage à froid — alors même que le réseau était là. Deux cas réels
 * et structurels : le retour de réseau pendant l'upload .ubx de fin de séance
 * (le déclencheur était perdu, plus rien ne partait), et le `create_session` de
 * la séance SUIVANTE enqueué pendant ce même upload (toute la séance 2 partait
 * alors en FK 23503, lot par lot, sur disque).
 *
 * LE REJEU NE COUVRE QUE LA FIN DE LISTE NORMALE, JAMAIS L'ARRÊT RÉSEAU. Rejouer
 * après un échec réseau ferait boucler en marteau sur un réseau absent, contre la
 * doctrine du module (« on ne martèle pas un réseau tombé ») : dans ce cas on
 * sort pour de bon et on attend le prochain déclencheur RÉEL (retour réseau,
 * boot, capture).
 *
 * Terminaison garantie : `rerunRequested` est remis à zéro AVANT chaque passe —
 * seul un appel concurrent survenu PENDANT la passe peut le ré-armer.
 */
export async function processQueue(): Promise<ProcessResult> {
  if (processing) {
    rerunRequested = true;
    return { processed: 0, dropped: 0, remaining: await countPending() };
  }
  processing = true;
  let processed = 0;
  let dropped = 0;
  try {
    for (;;) {
      rerunRequested = false;
      const pass = await drainOnce();
      processed += pass.processed;
      dropped += pass.dropped;
      if (pass.stoppedOnNetwork || !rerunRequested) {
        return { processed, dropped, remaining: pass.remaining };
      }
    }
  } finally {
    processing = false;
    rerunRequested = false;
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

// ============================================================================
// Rétention des .ubx bruts (GC par ÂGE)
// ============================================================================

/**
 * Dossier des .ubx bruts. MIROIR de `captureMode.stopCapture` — on ne l'importe
 * pas (captureMode tire tout `bluetoothService` derrière lui, hors sujet ici et
 * dans les tests de file). Toute modification du chemin doit rester synchrone
 * avec `src/ble/captureMode.ts`.
 */
function capturesDir(): string {
  const base = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
  return `${base}fixtures/`;
}

/**
 * `racebox-capture-<YYYY-MM-DDTHH-MM-SS>.ubx` (cf. captureMode : `toISOString()`
 * avec `:` et `.` remplacés par `-`, tronqué à 19 caractères). L'horodatage du
 * NOM est notre seule source d'âge fiable et testable : `modificationTime` varie
 * selon l'OS et n'est pas garanti par le mock d'`expo-file-system`.
 */
const UBX_NAME_RE = /^racebox-capture-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})\.ubx$/;

/**
 * Âge au-delà duquel un .ubx déjà synchronisé est effaçable. 7 jours couvrent
 * largement une journée de piste ET une reprise manuelle a posteriori
 * (`reimportUbxToFrames`), tout en bornant la croissance (~2,6 Mo/séance, sinon
 * strictement monotone dans `documentDirectory` — invisible et non purgeable
 * depuis l'app).
 */
const UBX_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Instant d'écriture lu dans le nom, ou `null` si le nom n'est pas des nôtres. */
function parseCaptureTimestamp(fileName: string): number | null {
  const m = UBX_NAME_RE.exec(fileName);
  if (!m) return null;
  const t = Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6])
  );
  return Number.isFinite(t) ? t : null;
}

/** Noms de fichiers directement contenus dans un dossier (jamais récursif). */
async function listNamesIn(dir: string): Promise<string[]> {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) return [];
  const names = await FileSystem.readDirectoryAsync(dir);
  return names.filter((n) => !n.includes('/'));
}

/**
 * URI des .ubx encore RÉFÉRENCÉS par une op `ubx_upload`, en file ACTIVE comme en
 * QUARANTAINE. La quarantaine compte double : un upload abandonné est justement
 * le cas où le fichier local est le seul exemplaire du brut.
 *
 * On apparie par `fileUri` et non par séance : le nom `racebox-capture-<ts>.ubx`
 * ne porte AUCUN sessionId, `pendingSessionIds()` est donc inutilisable ici.
 */
async function referencedUbxUris(): Promise<Set<string>> {
  const out = new Set<string>();
  for (const dir of [queueDir(), quarantineDir()]) {
    for (const name of await listNamesIn(dir)) {
      const env = await readEnvelopeAt(dir + name);
      if (env?.op.type === 'ubx_upload') out.add(env.op.fileUri);
    }
  }
  return out;
}

/**
 * Supprime les .ubx ANCIENS et devenus inutiles. Best-effort et silencieux : ne
 * lève jamais, n'affiche rien (silence en piste). Retourne le nombre de fichiers
 * effacés.
 *
 * TROIS VERROUS, dans l'ordre de la règle fondateur (en cas de doute, CONSERVER).
 * Un .ubx est le filet ultime d'une séance : on ne l'efface que si l'on est SÛR
 * qu'il ne peut plus servir.
 *
 *   1. FILE NON VIDE ⇒ AUCUN GC. Une op en attente peut être le `create_session`,
 *      un lot `frames` ou le `complete` d'une séance NON CONFIRMÉE en base : son
 *      .ubx est alors le seul exemplaire du brut. Comme le nom du fichier ne
 *      permet pas de savoir DE QUELLE séance il s'agit, on ne prend aucun risque
 *      et on ne GC qu'une fois la file entièrement drainée.
 *   2. RÉFÉRENCÉ ⇒ CONSERVÉ. Un `ubx_upload` encore en file ou en quarantaine
 *      protège son fichier par URI (verrou redondant avec le 1 pour la file
 *      active, mais SEUL rempart pour la quarantaine).
 *   3. ÂGE ILLISIBLE ⇒ CONSERVÉ. Un nom qu'on ne sait pas dater n'autorise pas
 *      à détruire la donnée d'un pilote.
 *
 * On ne supprime donc PAS à l'upload : entre l'upload et l'expiration, le
 * fichier reste disponible comme filet de reprise (`reimportUbxToFrames`).
 */
export async function gcOldCaptures(now: number = Date.now()): Promise<number> {
  try {
    if (await hasPending()) return 0; // verrou 1
    const dir = capturesDir();
    const names = await listNamesIn(dir);
    if (names.length === 0) return 0;
    const referenced = await referencedUbxUris();
    let removed = 0;
    for (const name of names) {
      const writtenAt = parseCaptureTimestamp(name);
      if (writtenAt === null) continue; // verrou 3
      if (now - writtenAt < UBX_MAX_AGE_MS) continue;
      const uri = dir + name;
      if (referenced.has(uri)) continue; // verrou 2
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        removed += 1;
      } catch {
        /* best-effort : retenté à la prochaine reprise */
      }
    }
    return removed;
  } catch {
    return 0; // ne JAMAIS faire échouer une reprise pour du ménage
  }
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
    // Ménage des .ubx périmés APRÈS le drain : si la file n'est pas vide, le GC
    // se retire de lui-même (verrou 1).
    await gcOldCaptures();
  } catch (e) {
    console.warn(`[OXV][capture-queue] reprise KO : ${errorMessage(e)}`);
    // SEC-1 : reprise en échec remontée à Sentry (aucun changement de flux).
    captureException(e, { point: 'capture-queue.reprise_ko' });
  }
}

// ============================================================================
// Réimport .ubx → telemetry_frames (filet de dernier recours)
// ============================================================================

/** Clés des trames déjà présentes en base, pour réconcilier un réimport. */
interface ExistingFrameKey {
  itow_ms: number | null;
  elapsed_ms: number;
}

/** Pagination PostgREST (défaut supabase-js : 1000 lignes max par requête). */
const FRAMES_PAGE_SIZE = 1000;
/** Borne de sûreté : une séance de 20 min à 25 Hz ≈ 30 000 trames. */
const FRAMES_READ_LIMIT = 200_000;

/**
 * Lit les clés (itow_ms, elapsed_ms) de TOUTES les trames déjà en base pour une
 * séance. Paginé — même motif que `analyzeSessionService.fetchSamplesFromFrames`.
 */
async function fetchExistingFrameKeys(sessionId: string): Promise<ExistingFrameKey[]> {
  const out: ExistingFrameKey[] = [];
  let offset = 0;
  while (offset < FRAMES_READ_LIMIT) {
    const { data, error } = await supabase
      .from('telemetry_frames')
      .select('itow_ms, elapsed_ms')
      .eq('session_id', sessionId)
      .order('elapsed_ms', { ascending: true })
      .range(offset, offset + FRAMES_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as ExistingFrameKey[];
    out.push(...page);
    if (page.length < FRAMES_PAGE_SIZE) break;
    offset += FRAMES_PAGE_SIZE;
  }
  return out;
}

/**
 * Ré-insère dans telemetry_frames les trames d'un fichier .ubx local, pour une
 * séance dont des lots sont définitivement absents côté serveur. Réutilise le
 * parser UBX existant (checksum Fletcher-8 + reconstruction par chunks).
 *
 * ── IL COMBLE, IL NE DUPLIQUE PAS ───────────────────────────────────────────
 * Le défaut historique : le réimport dérivait son `elapsed_ms` de l'iTOW du
 * PREMIER échantillon du fichier, quand le chemin live le dérive de l'horloge
 * MURALE depuis l'armement. Deux bases de temps sans rapport → la clé
 * d'idempotence (session_id, elapsed_ms) ne faisait coïncider AUCUNE trame :
 * réimporter une séance à moitié synchronisée AJOUTAIT les 10 000 trames du
 * fichier aux 8 000 déjà en base — 18 000 lignes, deux séries entrelacées, une
 * séance PARTIELLE (récupérable) rendue CORROMPUE. Le filet de secours
 * détruisait la séance qu'il devait sauver.
 *
 * La réconciliation se fait donc sur `itow_ms` — l'IDENTITÉ PHYSIQUE de la
 * trame, la seule valeur écrite à l'identique par les deux chemins (mapper
 * partagé `raceBoxToFrameInsert`). On ne fait PAS d'`itow_ms` la clé d'unicité
 * de la table pour autant (cf. l'argumentaire en tête de module : son unicité
 * est une propriété du boîtier, pas du code) : on l'utilise ici comme critère
 * d'APPARIEMENT, ce qu'il est réellement.
 *
 * Trois garanties, dans l'ordre de la règle fondateur (ne jamais perdre, ne
 * jamais inventer) :
 *
 *   1. ANTI-JOIN MULTI-ENSEMBLE sur itow_ms : une trame du fichier n'est
 *      réinsérée que si la base n'en a pas déjà autant portant cet iTOW. Deux
 *      trames réelles partageant un iTOW (répétition avant fix GPS) sont donc
 *      comptées, pas confondues — on n'en perd aucune.
 *   2. RECALAGE de la base de temps : l'`elapsed_ms` des trames comblées est
 *      reconstruit depuis une ANCRE live déjà en base (la trame de plus petit
 *      iTOW et son elapsed_ms), pour que les trames restituées tombent sur la
 *      MÊME échelle de temps que les trames live. Sans ancre (séance à zéro
 *      trame), on retombe sur l'origine = premier iTOW du fichier.
 *   3. ALLOCATION SANS COLLISION : l'`elapsed_ms` attribué est strictement
 *      croissant ET garanti libre vis-à-vis des valeurs déjà en base. Sans
 *      cela, une trame comblée tombant par hasard sur l'`elapsed_ms` d'une
 *      trame live serait écartée par `ON CONFLICT DO NOTHING` — soit exactement
 *      la trame manquante que le réimport devait restaurer.
 *
 * REFUS EXPLICITE : si la séance porte déjà des trames SANS `itow_ms` (lignes
 * héritées, écrites avant l'ajout de la colonne), l'appariement est impossible
 * et réimporter dupliquerait. On LÈVE plutôt que de corrompir en silence — le
 * .ubx reste intact sur l'appareil, l'opérateur décide.
 *
 * LIMITE ASSUMÉE : la lecture des clés existantes puis l'insertion ne sont pas
 * atomiques. Le réimport est un outil de secours MANUEL, à lancer sur une séance
 * close — jamais en concurrence d'une capture live sur la même séance.
 */
export async function reimportUbxToFrames(
  sessionId: string,
  userId: string,
  fileUri: string
): Promise<{ inserted: number; skipped: number }> {
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

  const parsed = rawFrames
    .map((f) => parseRaceBoxDataMessage(f))
    .filter((d): d is RaceBoxData => d !== null);
  if (parsed.length === 0) return { inserted: 0, skipped: 0 };

  // ── Trames déjà en base : appariement par iTOW + ancre de recalage ────────
  const existing = await fetchExistingFrameKeys(sessionId);

  const untrackable = existing.filter((r) => r.itow_ms === null).length;
  if (untrackable > 0) {
    throw new Error(
      `Réimport refusé : la séance ${sessionId} porte ${untrackable} trame(s) sans itow_ms — ` +
        'appariement impossible, le réimport dupliquerait au lieu de combler. ' +
        'Le .ubx local reste intact ; réconcilier à la main (cf. Valencia §4.6).'
    );
  }

  /** Combien de trames de cet iTOW la base porte DÉJÀ (anti-join multi-ensemble). */
  const alreadyByItow = new Map<number, number>();
  /** Valeurs d'elapsed_ms occupées : une trame comblée ne doit jamais y tomber. */
  const usedElapsed = new Set<number>();
  let anchor: { itow: number; elapsed: number } | null = null;
  for (const r of existing) {
    if (r.itow_ms === null) continue;
    alreadyByItow.set(r.itow_ms, (alreadyByItow.get(r.itow_ms) ?? 0) + 1);
    usedElapsed.add(r.elapsed_ms);
    if (anchor === null || r.itow_ms < anchor.itow) {
      anchor = { itow: r.itow_ms, elapsed: r.elapsed_ms };
    }
  }
  // Séance à zéro trame : aucune ancre live, l'origine est le 1er iTOW du fichier
  // (comportement historique, correct dans ce cas tout-ou-rien).
  const base = anchor ?? { itow: parsed[0].timestamp.iTOW, elapsed: 0 };

  const rows: TelemetryFrameInsert[] = [];
  let skipped = 0;
  let lastElapsed = -1;
  for (const data of parsed) {
    const itow = data.timestamp.iTOW;
    const already = alreadyByItow.get(itow) ?? 0;
    if (already > 0) {
      // Cette trame physique est DÉJÀ en base : on ne la réinsère pas. On
      // décrémente pour que d'éventuelles trames SUPPLÉMENTAIRES au même iTOW
      // soient tout de même restituées.
      alreadyByItow.set(itow, already - 1);
      skipped += 1;
      continue;
    }
    let elapsed = Math.max(0, Math.round(base.elapsed + (itow - base.itow)));
    if (elapsed <= lastElapsed) elapsed = lastElapsed + 1;
    while (usedElapsed.has(elapsed)) elapsed += 1;
    usedElapsed.add(elapsed);
    lastElapsed = elapsed;
    rows.push(raceBoxToFrameInsert(data, sessionId, elapsed));
  }
  if (rows.length === 0) return { inserted: 0, skipped };

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
      // SEC-1 : lot de réimport perdu remonté à Sentry (aucun changement de flux).
      captureException(err, { point: 'capture-queue.reimport_lot_ko', sessionId });
      continue;
    }
  }
  return { inserted, skipped };
}
