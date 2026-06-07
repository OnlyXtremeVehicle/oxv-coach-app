/**
 * Service de mesure d'audience — §9 du cahier OXV Mirror.
 *
 * « Mesure d'audience via une solution conforme au RGPD (type Plausible). »
 *
 * Plausible est privacy-first par design : pas de cookies, pas d'adresse IP
 * stockée, pas de données personnelles, données hébergées en UE. On envoie
 * uniquement des ÉVÉNEMENTS ANONYMES (nom + propriétés non-identifiantes).
 *
 * Garde-fous RGPD ici :
 *   - INACTIF tant que EXPO_PUBLIC_PLAUSIBLE_DOMAIN n'est pas configuré
 *     (rien n'est envoyé tant que Gabin n'a pas mis le domaine)
 *   - JAMAIS de PII : aucun email, nom, user_id, position GPS envoyés
 *   - Opt-out respecté (drapeau local MMKV) — l'utilisateur peut couper
 *   - Best-effort : un échec réseau n'impacte jamais l'app
 *
 * Usage :
 *   import { trackEvent } from '@/services/analyticsService';
 *   trackEvent('session_analysee');           // event simple
 *   trackEvent('ecran_vu', { ecran: 'bilan' }); // props non-identifiantes
 */

import { storage } from '@/lib/mmkv';

const PLAUSIBLE_API = 'https://plausible.io/api/event';
const OPT_OUT_KEY = 'analytics.optOut';

/** Domaine Plausible configuré côté env. Vide = analytics désactivé. */
function plausibleDomain(): string {
  return process.env.EXPO_PUBLIC_PLAUSIBLE_DOMAIN ?? '';
}

/** L'utilisateur a-t-il refusé la mesure d'audience ? (default : non) */
export function isAnalyticsOptedOut(): boolean {
  try {
    return storage.getBoolean(OPT_OUT_KEY) === true;
  } catch {
    return false;
  }
}

/** Active / désactive la mesure d'audience pour cet appareil. */
export function setAnalyticsOptOut(optedOut: boolean): void {
  try {
    storage.set(OPT_OUT_KEY, optedOut);
  } catch {
    // MMKV indisponible (ex : tests) — on ignore.
  }
}

/** Analytics actif ? (domaine configuré ET pas d'opt-out) */
export function isAnalyticsEnabled(): boolean {
  return plausibleDomain() !== '' && !isAnalyticsOptedOut();
}

/**
 * Envoie un événement anonyme à Plausible. No-op si désactivé.
 *
 * @param name  nom de l'événement (ex: 'session_analysee')
 * @param props propriétés NON-identifiantes uniquement (ex: { ecran: 'bilan' }).
 *              Ne JAMAIS passer d'email, nom, id utilisateur, coordonnées.
 */
export function trackEvent(name: string, props?: Record<string, string | number | boolean>): void {
  const domain = plausibleDomain();
  if (domain === '' || isAnalyticsOptedOut()) return;

  // Plausible attend un champ `url` ; pour une app mobile on utilise un
  // pseudo-URL app://<event> qui n'expose aucune donnée personnelle.
  const body = {
    name,
    domain,
    url: `app://oxv-mirror/${name}`,
    props: props ?? undefined,
  };

  // Fire-and-forget : on n'attend pas la réponse, on n'échoue jamais.
  fetch(PLAUSIBLE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {
    // Silencieux : la mesure d'audience ne doit jamais perturber l'app.
  });
}
