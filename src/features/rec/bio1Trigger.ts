/**
 * bio1Trigger — déclencheur BIO-1 (lecture cardio Apple Watch en fin de séance).
 *
 * Orchestration PURE à dépendances INJECTÉES : aucun import natif (MMKV,
 * services, Sentry) au chargement du module → testable sous ts-jest node
 * (__tests__/bio1Trigger.test.ts). L'écran `app/(app2)/rec/fin.tsx` câble les
 * vraies dépendances (garde MMKV « bio1-read:{sessionId} », feature flag,
 * consentement, healthKitService, biometryService, computeQuality, Sentry).
 *
 * Invariants garantis (et testés) :
 *   1. IDEMPOTENT — si la garde marque la séance comme déjà lue, on ne touche
 *      à AUCUN service (retour 'already').
 *   2. FAIL-CLOSED — sans flag `biometry` OU sans consentement de capture,
 *      aucune donnée de santé n'est approchée.
 *   3. JAMAIS BLOQUANT — toute erreur est capturée (Sentry) et rendue
 *      SILENCIEUSE ; `runBio1` ne rejette jamais. Le flux de fin continue quoi
 *      qu'il arrive.
 *   4. Garde posée UNIQUEMENT après une lecture RÉELLE persistée (jamais sur
 *      un échec, un flag OFF, ou zéro échantillon) — sinon la vraie lecture
 *      deviendrait définitivement injouable pour cette séance.
 *
 * ÉTAT phase A : healthKitService est un no-op ('unavailable') → readHeartRate
 * renvoie [] → reason 'no-samples', aucune garde posée, prêt pour BIO-1.
 */

/** Fréquence d'échantillonnage attendue de l'Apple Watch (~1 Hz) pour la qualité. */
export const BIO1_EXPECTED_HZ = 1;

/** Préfixe MMKV de la garde d'idempotence de la lecture BIO-1. */
export const BIO1_GUARD_PREFIX = 'bio1-read:';

/** Clé MMKV de la garde d'idempotence, pour une séance. */
export function bio1GuardKey(sessionId: string): string {
  return `${BIO1_GUARD_PREFIX}${sessionId}`;
}

/** Échantillon cardiaque minimal manipulé par le déclencheur. */
export interface Bio1Sample {
  /** Epoch millisecondes. */
  ts: number;
  /** Fréquence cardiaque (bpm). */
  hr: number;
  /** Qualité 0-100 attachée avant persistance. */
  quality?: number;
}

export interface Bio1Deps {
  /** La garde marque-t-elle déjà cette séance comme lue ? */
  guardHas: (sessionId: string) => boolean;
  /** Pose la garde (idempotence) après une lecture réussie et persistée. */
  guardMark: (sessionId: string) => void;
  /** Lecture fail-closed du flag `biometry` (service déjà fail-closed). */
  isFlagEnabled: (key: string) => Promise<boolean>;
  /** Consentement de CAPTURE cardio (loadBiometryConsents().capture). */
  loadCaptureConsent: () => Promise<boolean>;
  /** Lit le cardio sur [from, to] (HealthKit — gate consentement côté service). */
  readHeartRate: (
    from: Date,
    to: Date,
    hasConsent: boolean
  ) => Promise<{ ts: number; hr: number }[]>;
  /** Persiste les échantillons (biometryService.saveSamples, source apple_watch). */
  saveSamples: (
    sessionId: string,
    samples: Bio1Sample[],
    source: 'apple_watch'
  ) => Promise<{ saved: number }>;
  /** Qualité 0-100 (biometryLogic.computeQuality). */
  computeQuality: (samples: { ts: number; hr: number }[], expectedHz: number) => number;
  /** Capture d'erreur silencieuse (Sentry captureException). */
  captureError: (err: unknown, context?: Record<string, unknown>) => void;
}

export interface Bio1Input {
  sessionId: string;
  /** Début de la fenêtre de lecture (meta.startedAt). */
  start: Date;
  /** Fin de la fenêtre de lecture (meta.endedAt ?? maintenant). */
  end: Date;
}

export type Bio1Reason =
  | 'ok'
  | 'already'
  | 'flag-off'
  | 'consent-off'
  | 'no-samples'
  | 'invalid'
  | 'error';

export interface Bio1Outcome {
  /** Une lecture a-t-elle réellement été persistée ? */
  ran: boolean;
  reason: Bio1Reason;
  /** Nombre d'échantillons envoyés (si ran). */
  saved?: number;
}

/**
 * Déclenche la lecture BIO-1. Résout TOUJOURS (jamais de rejet) : le flux de
 * fin ne doit jamais être bloqué par la biométrie.
 */
export async function runBio1(input: Bio1Input, deps: Bio1Deps): Promise<Bio1Outcome> {
  try {
    if (!input.sessionId) return { ran: false, reason: 'invalid' };

    // 1. Idempotence AVANT toute I/O : déjà lu → on ne touche à rien.
    if (deps.guardHas(input.sessionId)) return { ran: false, reason: 'already' };

    // 2. Fail-closed : flag puis consentement, avant tout accès aux données.
    const flagEnabled = await deps.isFlagEnabled('biometry');
    if (!flagEnabled) return { ran: false, reason: 'flag-off' };

    const consent = await deps.loadCaptureConsent();
    if (!consent) return { ran: false, reason: 'consent-off' };

    // 3. Lecture (gate consentement redondant côté service, priorité absolue).
    const raw = await deps.readHeartRate(input.start, input.end, consent);
    if (!Array.isArray(raw) || raw.length === 0) {
      // No-op propre (HealthKit indisponible aujourd'hui) : PAS de garde posée,
      // on pourra réessayer quand le module santé sera câblé (BIO-1).
      return { ran: false, reason: 'no-samples' };
    }

    // 4. Qualité + persistance idempotente (upsert côté service).
    const quality = deps.computeQuality(raw, BIO1_EXPECTED_HZ);
    const enriched: Bio1Sample[] = raw.map((s) => ({ ts: s.ts, hr: s.hr, quality }));
    const res = await deps.saveSamples(input.sessionId, enriched, 'apple_watch');

    // 5. Garde posée UNIQUEMENT sur une lecture réelle persistée.
    deps.guardMark(input.sessionId);
    return { ran: true, reason: 'ok', saved: res.saved };
  } catch (err) {
    // JAMAIS bloquant : capturé, silencieux, le flux de fin continue.
    deps.captureError(err, { where: 'bio1Trigger', sessionId: input.sessionId });
    return { ran: false, reason: 'error' };
  }
}
