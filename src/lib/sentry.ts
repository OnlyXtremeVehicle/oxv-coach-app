/**
 * Init Sentry conditionnel.
 *
 * - En dev (__DEV__) : no-op, on ne veut pas polluer Sentry avec les
 *   logs des sessions de développement.
 * - Sans EXPO_PUBLIC_SENTRY_DSN : no-op aussi.
 * - En preview/production avec DSN : init standard, traces 100%.
 *
 * Le plugin @sentry/react-native/expo est déjà dans app.json, donc
 * la native auto-instrumentation est installée au build. Cette fonction
 * gère uniquement le runtime JS.
 */

import * as Sentry from '@sentry/react-native';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  if (__DEV__) return;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    debug: false,
    tracesSampleRate: 1.0,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30_000,
  });

  initialized = true;
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (__DEV__) {
    console.error('[OXV][dev]', err, context);
    return;
  }
  Sentry.withScope((scope) => {
    if (context) {
      for (const [k, v] of Object.entries(context)) {
        scope.setExtra(k, v);
      }
    }
    Sentry.captureException(err);
  });
}
