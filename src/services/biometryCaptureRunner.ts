/**
 * biometryCaptureRunner — capture LOCALE des échantillons cardio d'une séance
 * (V2-BIO-2, Livrable 3), greffée sur le cycle de vie de la capture.
 *
 * Module-level (PAS un hook React) : la capture tourne sans écran monté (silence
 * en piste). Greffé sur `captureSessionService` (start/stop/abort) via TROIS
 * lignes, sous dégel cardinal ciblé approuvé par le fondateur — le producteur de
 * capture RaceBox n'est pas modifié, seulement appelé.
 *
 * DOCTRINE (RGPD art. 9). Double verrou LOCAL fail-closed : flag serveur `biometry`
 * + consentement de CAPTURE du pilote. Le 3e verrou (partage coach) ne concerne
 * que le relais live [[liveRelayRunner]], pas la persistance de SES propres
 * données. Flag/consentement absent → DORMANT (aucun abonnement, aucune I/O).
 * Offline-first via [[biometryCaptureBuffer]] (registre MMKV SÉPARÉ, jamais
 * captureSyncQueue) : les échantillons survivent hors-ligne et sont préservés au
 * retour réseau (upsert idempotent). Minimisation : le local est PURGÉ dès la
 * préservation confirmée, et une séance ABANDONNÉE ne persiste jamais rien.
 *
 * Le stockage natif et l'I/O sont chargés à la demande / injectables → la logique
 * de garde est testable sous ts-jest node sans natif ni réseau.
 */

import type { HeartRateSample } from '@/services/v2/heartRateParser';
import type { BioSample } from '@/services/v2/biometryBufferLogic';
import type { BiometryInputSample, BiometrySource } from '@/services/v2/biometryService';
import {
  type KVStorage,
  clearSession,
  loadPendingSessions,
  loadSamples,
  persistSamples,
  toBiometryInput,
} from '@/features/rec/biometryCaptureBuffer';

/** Cadence de persistance locale de sûreté (crash / kill en séance). */
const PERSIST_INTERVAL_MS = 10000;

/**
 * Un tick sur six — soit une relecture de consentement par minute.
 *
 * Le retrait fait DANS l'application coupe instantanément (l'écran de réglages
 * appelle `discardBiometryCapture`). Cette relecture ne sert qu'au retrait venu
 * d'ailleurs, et une minute est le compromis entre ce délai-là et le réseau du
 * circuit.
 */
const CONSENT_RECHECK_TICKS = 6;

/** Dépendances injectables (réelles par défaut) — test sans natif ni réseau. */
export interface BiometryCaptureDeps {
  storage: KVStorage;
  isFlagEnabled: (key: string) => Promise<boolean>;
  loadConsents: (userId: string) => Promise<{ capture: boolean }>;
  onBiometry: (cb: (s: HeartRateSample) => void) => () => void;
  saveSamples: (
    sessionId: string,
    samples: BiometryInputSample[],
    source: BiometrySource
  ) => Promise<{ saved: number }>;
  nowMs: () => number;
}

// ── Implémentations RÉELLES chargées PARESSEUSEMENT (require au 1er appel) ──
// Objectif : ne PAS tirer supabase / MMKV / BLE au chargement du module, pour
// rester testable sous ts-jest node. Les tests injectent tout → aucun require ci-
// dessous ne s'exécute. En production, chaque dépendance se résout à l'invocation.
let memoryFallback: Map<string, string> | null = null;
function realStorage(): KVStorage {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/lib/mmkv') as { storage: KVStorage };
    return mod.storage;
  } catch {
    if (!memoryFallback) memoryFallback = new Map<string, string>();
    const mem = memoryFallback;
    return {
      getString: (k) => mem.get(k),
      set: (k, v) => {
        mem.set(k, v);
      },
      delete: (k) => {
        mem.delete(k);
      },
    };
  }
}

function lazyIsFlagEnabled(key: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (
    require('@/services/featureFlagsService') as typeof import('@/services/featureFlagsService')
  ).isFlagEnabled(key);
}
function lazyLoadConsents(userId: string): Promise<{ capture: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (
    require('@/services/consentService') as typeof import('@/services/consentService')
  ).loadBiometryConsents(userId);
}
function lazyOnBiometry(cb: (s: HeartRateSample) => void): () => void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (
    require('@/ble/bluetoothService') as typeof import('@/ble/bluetoothService')
  ).bluetoothService.onBiometry(cb);
}
function lazySaveSamples(
  sessionId: string,
  samples: BiometryInputSample[],
  source: BiometrySource
): Promise<{ saved: number }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (
    require('@/services/v2/biometryService') as typeof import('@/services/v2/biometryService')
  ).saveSamples(sessionId, samples, source);
}

/**
 * Résout les dépendances champ par champ : chaque valeur injectée gagne, sinon la
 * lazy réelle (référence non appelée ici → aucun require au montage). En test,
 * tout est injecté, donc aucune lazy ne s'exécute.
 */
function resolveDeps(injected?: Partial<BiometryCaptureDeps>): BiometryCaptureDeps {
  return {
    storage: injected?.storage ?? realStorage(),
    isFlagEnabled: injected?.isFlagEnabled ?? lazyIsFlagEnabled,
    loadConsents: injected?.loadConsents ?? lazyLoadConsents,
    onBiometry: injected?.onBiometry ?? lazyOnBiometry,
    saveSamples: injected?.saveSamples ?? lazySaveSamples,
    nowMs: injected?.nowMs ?? (() => Date.now()),
  };
}

interface ActiveCapture {
  sessionId: string;
  /** Le pilote — nécessaire pour RELIRE son consentement en cours de séance. */
  pilotId: string;
  buffer: BioSample[];
  off: () => void;
  timer: ReturnType<typeof setInterval> | null;
  deps: BiometryCaptureDeps;
}

let active: ActiveCapture | null = null;

function teardownActive(state: ActiveCapture): void {
  state.off();
  if (state.timer) clearInterval(state.timer);
}

/**
 * Tente la préservation d'une séance : RELIT LE CONSENTEMENT, lit le local,
 * écarte les lectures non physiologiques, upsert idempotent, puis PURGE le local
 * (minimisation). Un échec (hors-ligne, auth) laisse le local intact pour un
 * rejeu ultérieur — c'est l'appelant qui décide d'avaler l'erreur.
 *
 * ===========================================================================
 * LA RELECTURE N'EST PAS UNE PRÉCAUTION, C'EST LA GARANTIE
 * ===========================================================================
 *
 * Le consentement n'était lu QU'UNE FOIS, à l'armement. Un pilote qui décochait
 * « Capter ma fréquence cardiaque » entre deux runs voyait quand même son
 * tampon téléversé à la clôture — le retrait n'avait aucun effet sur ce qui
 * était déjà mesuré.
 *
 * Le document validé par le conseil dit pourtant : *« À la révocation, la
 * mesure s'arrête et la lecture des données cesse immédiatement. »*
 *
 * C'est ici que la promesse se tient VRAIMENT : quel que soit le chemin — même
 * écran, autre appareil, redémarrage de l'application —, aucune donnée de santé
 * ne quitte l'appareil si le consentement est retombé. Et le local est PURGÉ
 * plutôt que gardé : un tampon conservé « au cas où » est une donnée de santé
 * conservée sans base légale.
 */
async function flushSession(
  deps: BiometryCaptureDeps,
  sessionId: string,
  pilotId: string
): Promise<void> {
  const consent = await deps.loadConsents(pilotId).catch(() => null);
  // `null` = lecture impossible (hors-ligne). FAIL-CLOSED sur le TÉLÉVERSEMENT,
  // pas sur le local : on ne téléverse pas, et on garde le tampon pour un rejeu
  // quand le consentement pourra être relu. Purger sur une panne réseau
  // détruirait une donnée que le pilote a acceptée de fournir.
  if (consent === null) return;
  if (consent.capture !== true) {
    clearSession(deps.storage, sessionId); // consentement retiré → purge, aucun envoi
    return;
  }

  const samples = loadSamples(deps.storage, sessionId);
  const input = toBiometryInput(samples);
  if (input.length === 0) {
    clearSession(deps.storage, sessionId); // rien d'exploitable → purge locale
    return;
  }
  await deps.saveSamples(sessionId, input, 'polar_h10'); // throw si échec → garde local
  clearSession(deps.storage, sessionId); // succès confirmé → purge locale
}

/**
 * Rejoue les séances orphelines (préservation offline antérieure). Ne touche RIEN
 * si le flag est retiré. Chaque échec reste en attente. Ne rejoue jamais la séance
 * active en cours.
 */
export async function flushPendingBiometry(
  pilotId: string,
  injected?: Partial<BiometryCaptureDeps>
): Promise<void> {
  const deps = resolveDeps(injected);
  const flag = await deps.isFlagEnabled('biometry').catch(() => false);
  if (!flag) return;
  for (const sessionId of loadPendingSessions(deps.storage)) {
    if (active && active.sessionId === sessionId) continue;
    // `flushSession` relit le consentement : une séance orpheline d'un pilote
    // qui a retiré son accord est PURGÉE, jamais téléversée.
    await flushSession(deps, sessionId, pilotId).catch(() => undefined);
  }
}

/**
 * Arme la capture cardio locale pour la séance, SI le flag `biometry` est actif ET
 * le pilote a consenti la capture. Sinon : dormant. Best-effort, non bloquant,
 * n'affecte jamais la capture télémétrique. Rejoue au passage les séances orphelines.
 */
export async function startBiometryCapture(
  input: { sessionId: string; pilotId: string },
  injected?: Partial<BiometryCaptureDeps>
): Promise<void> {
  if (active) {
    teardownActive(active);
    active = null;
  }
  const deps = resolveDeps(injected);

  // Rejeu opportuniste des préservations offline antérieures.
  await flushPendingBiometry(input.pilotId, injected).catch(() => undefined);

  const flag = await deps.isFlagEnabled('biometry').catch(() => false);
  if (!flag) return; // dormant : la santé ne circule pas tant que le flag est OFF
  const consent = await deps.loadConsents(input.pilotId).catch(() => ({ capture: false }));
  if (consent.capture !== true) return; // pas de consentement capture → rien

  const buffer: BioSample[] = [];
  const off = deps.onBiometry((s) => {
    buffer.push({ ts: deps.nowMs(), hrBpm: s.hrBpm, rrMs: s.rrMs, contact: s.contact });
  });
  /**
   * Persistance locale de sûreté, ET relecture périodique du consentement.
   *
   * LA RELECTURE EST LE FILET, PAS LE MÉCANISME. Le chemin normal est
   * instantané et ne coûte rien au réseau : l'écran de réglages appelle
   * `discardBiometryCapture()` au moment où le pilote décoche. Ce filet-ci
   * couvre le cas où le retrait vient d'AILLEURS — un autre appareil, le site.
   *
   * Une fois par minute, pas toutes les dix secondes : une lecture de
   * consentement est un aller-retour réseau, et le réseau du circuit est le
   * pire que cette application rencontre. Le tampon local, lui, est bien
   * persisté toutes les dix secondes — c'est la garde anti-plantage.
   */
  let ticks = 0;
  const timer = setInterval(() => {
    if (buffer.length > 0) persistSamples(deps.storage, input.sessionId, buffer);

    ticks += 1;
    if (ticks % CONSENT_RECHECK_TICKS !== 0) return;
    void deps
      .loadConsents(input.pilotId)
      .then((c) => {
        // Retiré ailleurs → on coupe l'abonnement ET on purge le tampon local.
        // Une panne de lecture NE COUPE PAS : elle n'est pas un retrait.
        if (c.capture !== true) discardBiometryCapture();
      })
      .catch(() => undefined);
  }, PERSIST_INTERVAL_MS);

  active = { sessionId: input.sessionId, pilotId: input.pilotId, buffer, off, timer, deps };
}

/**
 * Clôt la capture cardio et PRÉSERVE : persiste le dernier delta puis tente
 * l'upsert (offline-first — reste en local si le réseau manque). Fire-and-forget
 * côté appelant : la persistance locale (synchrone) précède l'await réseau.
 */
export async function stopBiometryCapture(): Promise<void> {
  const state = active;
  active = null;
  if (!state) return;
  teardownActive(state);
  if (state.buffer.length > 0) persistSamples(state.deps.storage, state.sessionId, state.buffer);
  await flushSession(state.deps, state.sessionId, state.pilotId).catch(() => undefined);
}

/**
 * Abandonne la capture cardio : coupe l'abonnement et PURGE le local sans jamais
 * rien préserver (une séance abandonnée ne laisse aucune trace de santé — art. 5
 * minimisation).
 */
export function discardBiometryCapture(): void {
  const state = active;
  active = null;
  if (!state) return;
  teardownActive(state);
  clearSession(state.deps.storage, state.sessionId);
}
