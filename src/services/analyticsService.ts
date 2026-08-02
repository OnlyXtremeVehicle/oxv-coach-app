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

/**
 * CONSENTEMENT — MIROIR LOCAL, LU SYNCHRONIQUEMENT.
 *
 * Le consentement fait foi côté serveur (`users.privacy_accepted_at`), mais
 * `trackEvent` est synchrone et ne peut pas interroger la base. On garde donc un
 * miroir local, écrit à l'acceptation et au chargement du profil.
 *
 * ABSENT = PAS DE CONSENTEMENT. C'est l'inverse de l'ancien comportement, et
 * c'est le seul défaut acceptable : le 02/08/2026, `app_ouverte` partait au
 * montage de la racine — avant l'écran de connexion, donc avant les cases CGU et
 * confidentialité. Le premier évènement d'un pilote était émis avant qu'il ait
 * vu un seul écran.
 */
const CONSENT_KEY = 'analytics.consentement';

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

/**
 * Le pilote a-t-il accepté ? Fermé par défaut.
 *
 * Toute anomalie de lecture vaut REFUS : on préfère perdre une mesure d'audience
 * que d'émettre sans accord.
 */
export function hasAnalyticsConsent(): boolean {
  try {
    return storage.getBoolean(CONSENT_KEY) === true;
  } catch {
    return false;
  }
}

/** Enregistre l'accord (ou son retrait) sur cet appareil. */
export function setAnalyticsConsent(donne: boolean): void {
  try {
    storage.set(CONSENT_KEY, donne);
  } catch {
    // MMKV indisponible (ex : tests) — on ignore : sans écriture, on reste fermé.
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

/** Analytics actif ? (domaine configuré ET consenti ET pas d'opt-out) */
export function isAnalyticsEnabled(): boolean {
  return plausibleDomain() !== '' && hasAnalyticsConsent() && !isAnalyticsOptedOut();
}

/**
 * Garde PII (SEC-1) : clés de propriétés interdites dans un événement.
 * La promesse « jamais de PII » devient vérifiée, pas seulement documentée.
 */
export const FORBIDDEN_ANALYTICS_PROP_KEYS = [
  'email',
  'name',
  'first_name',
  'last_name',
  'handle',
  'phone',
  'iban',
] as const;

/**
 * Retourne les clés interdites présentes dans les props (comparaison
 * insensible à la casse). Pure — testée sans mock.
 */
export function findForbiddenAnalyticsKeys(props?: Record<string, unknown>): string[] {
  if (!props) return [];
  const forbidden = new Set<string>(FORBIDDEN_ANALYTICS_PROP_KEYS);
  return Object.keys(props).filter((k) => forbidden.has(k.toLowerCase()));
}

/**
 * Envoie un événement anonyme à Plausible. No-op si désactivé.
 *
 * @param name  nom de l'événement (ex: 'session_analysee')
 * @param props propriétés NON-identifiantes uniquement (ex: { ecran: 'bilan' }).
 *              Ne JAMAIS passer d'email, nom, id utilisateur, coordonnées.
 */
export function trackEvent(name: string, props?: Record<string, string | number | boolean>): void {
  // Garde DEV (SEC-1) : on casse fort en développement si une clé PII se
  // glisse dans un événement — AVANT le court-circuit « domaine absent », pour
  // que la garde joue aussi quand Plausible n'est pas configuré. En prod : no-op.
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const bad = findForbiddenAnalyticsKeys(props);
    if (bad.length > 0) {
      throw new Error(`[OXV][analytics] clés PII interdites dans « ${name} » : ${bad.join(', ')}`);
    }
  }

  const domain = plausibleDomain();
  // Trois conditions, toutes nécessaires : configuré, consenti, non refusé.
  if (domain === '' || !hasAnalyticsConsent() || isAnalyticsOptedOut()) return;

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
