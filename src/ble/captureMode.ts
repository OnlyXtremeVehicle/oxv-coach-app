/**
 * Mode capture : enregistre tous les bytes BLE reçus du RaceBox dans un
 * fichier .ubx local, partageable via expo-sharing.
 *
 * Vise à produire des fixtures reproductibles pour les tests du parser et
 * du service BLE (semaines 3-4), à partir d'une session réelle au lieu de
 * dépendre d'un RaceBox physique à chaque dev.
 *
 * Architecture :
 *   bluetoothService.onRawData  →  buffer mémoire  →  fichier .ubx  →  sharesheet
 *
 * Le fichier produit est strictement la concaténation des chunks BLE bruts
 * (base64 → bytes). Il est rejouable via UbxFrameBuffer.push() côté tests.
 */

import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { bluetoothService } from './bluetoothService';

export interface CaptureStats {
  startedAt: number;
  durationMs: number;
  chunkCount: number;
  byteCount: number;
}

let active = false;
let chunks: Uint8Array[] = [];
let totalBytes = 0;
let startedAt = 0;
let unsubscribe: (() => void) | null = null;
let lastSavedUri: string | null = null;

export function isCapturing(): boolean {
  return active;
}

export function getCurrentStats(): CaptureStats {
  return {
    startedAt,
    durationMs: active ? Date.now() - startedAt : 0,
    chunkCount: chunks.length,
    byteCount: totalBytes,
  };
}

export function getLastSavedUri(): string | null {
  return lastSavedUri;
}

/**
 * Séance à laquelle appartient la capture en cours, `null` pour une capture de
 * diagnostic lancée depuis l'écran de debug.
 *
 * ===========================================================================
 * LE MAILLON QUI MANQUAIT ENTRE LE FICHIER ET LA SÉANCE
 * ===========================================================================
 *
 * Le `.ubx` s'appelait `racebox-capture-<horodatage>.ubx`. Rien, sur le disque,
 * ne reliait ces octets à la séance qui les avait produits.
 *
 * Conséquence : `reimportUbxToFrames` — le filet de dernier recours, capable de
 * recoller des trames perdues côté serveur — exige un `sessionId` et n'avait
 * donc AUCUN appelant possible. Et `gcOldCaptures` conservait les fichiers sept
 * jours en s'en réclamant explicitement : « le fichier reste disponible comme
 * filet de reprise ». La rétention servait une promesse que rien ne pouvait
 * tenir.
 */
let sessionCourante: string | null = null;

export function startCapture(sessionId: string | null = null): void {
  if (active) return;
  chunks = [];
  totalBytes = 0;
  startedAt = Date.now();
  sessionCourante = sessionId;
  active = true;
  unsubscribe = bluetoothService.onRawData((bytes) => {
    chunks.push(bytes);
    totalBytes += bytes.length;
  });
}

export async function stopCapture(): Promise<string> {
  if (!active) {
    throw new Error('Capture non active.');
  }
  unsubscribe?.();
  unsubscribe = null;
  active = false;

  if (chunks.length === 0) {
    throw new Error('Aucune donnée capturée. Vérifiez la connexion BLE.');
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) throw new Error('Système de fichiers non disponible.');

  const fixturesDir = `${baseDir}fixtures/`;
  const dirInfo = await FileSystem.getInfoAsync(fixturesDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(fixturesDir, { intermediates: true });
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  /**
   * Le suffixe `--<uuid>` est OPTIONNEL dans le nom : les fichiers écrits avant
   * le 13/08/2026, et ceux d'une capture de diagnostic, n'en portent pas. Le
   * motif de lecture (`captureSyncQueue`) les accepte donc toujours — il les
   * traite simplement comme non rattachables.
   */
  const suffixe = sessionCourante !== null ? `--${sessionCourante}` : '';
  const fileUri = `${fixturesDir}racebox-capture-${ts}${suffixe}.ubx`;

  const base64 = Buffer.from(merged).toString('base64');
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  lastSavedUri = fileUri;
  chunks = [];

  return fileUri;
}

export async function shareCapture(uri?: string): Promise<void> {
  const target = uri ?? lastSavedUri;
  if (!target) throw new Error('Aucune capture à partager.');

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Partage non disponible sur ce système.');
  }

  await Sharing.shareAsync(target, {
    mimeType: 'application/octet-stream',
    UTI: 'public.data',
    dialogTitle: 'Partager la capture UBX',
  });
}

export function resetCapture(): void {
  if (active) {
    unsubscribe?.();
    unsubscribe = null;
    active = false;
  }
  chunks = [];
  totalBytes = 0;
  startedAt = 0;
  lastSavedUri = null;
}
