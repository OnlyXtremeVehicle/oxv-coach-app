/**
 * Wrapper HealthKit (BE-1, MISSION A) — iOS uniquement, no-op Android.
 *
 * ÉTAT (25/07/2026) : CÂBLÉ. `react-native-health` est installé et les deux
 * appels réels sont branchés — autorisation en lecture seule, et lecture bornée
 * des échantillons de fréquence cardiaque.
 *
 * MAIS IL NE FONCTIONNERA QU'APRÈS UN BUILD NATIF. HealthKit est un module natif :
 * tant que l'app tourne sur un binaire compilé AVANT cette installation, le
 * `require` échoue et tout retombe proprement sur 'unavailable' / []. Ce n'est
 * pas une panne, c'est le comportement attendu — et c'est pour cela que rien
 * n'appelle ces fonctions sans vérifier leur retour.
 *
 * GATE DE CONSENTEMENT — fail-closed : `readHeartRate` n'accède JAMAIS aux
 * données de santé sans consentement de CAPTURE. L'appelant passe le flag
 * `hasConsent` (= `loadBiometryConsents(userId).capture` de consentService).
 * Sans consentement, la lecture retourne [] sans même tenter d'accès natif.
 */

import { Platform } from 'react-native';

/** Résultat d'une demande d'autorisation santé. */
export type HealthAuthStatus = 'granted' | 'denied' | 'unavailable';

/** Échantillon cardiaque lu depuis la plateforme santé. */
export interface HeartRateSample {
  /** Epoch millisecondes. */
  ts: number;
  /** Fréquence cardiaque (bpm). */
  hr: number;
}

/**
 * Nom du module natif, gardé en VARIABLE et non en littéral.
 *
 * Le paquet est désormais installé, mais la résolution reste volontairement
 * dynamique : sur un binaire compilé avant l'installation — ou sous Jest, qui
 * tourne en environnement Node sans natif — un import statique ferait échouer le
 * chargement du module entier. Ici, l'échec est capturé et se traduit par un
 * simple « indisponible ».
 */
const HEALTH_MODULE_NAME = 'react-native-health';

/**
 * Forme du module natif RÉELLEMENT utilisée ici — volontairement minimale.
 *
 * On ne type que les deux appels dont on se sert, plutôt que d'importer les
 * types du paquet : `require` est paresseux (le module peut être absent au
 * bundling), et une surface étroite documente exactement ce à quoi l'app touche
 * dans HealthKit. Tout le reste de l'API santé reste hors de portée.
 *
 * L'API du paquet est à CALLBACKS (err en premier) : on la promisifie plus bas.
 */
interface HealthSampleLike {
  /** Valeur de la mesure — ici, la fréquence cardiaque en bpm. */
  value: number;
  /** Début de l'échantillon (ISO 8601). */
  startDate: string;
  endDate: string;
}

interface HealthModuleLike {
  initHealthKit(
    permissions: { permissions: { read: string[]; write: string[] } },
    callback: (error: string | null, result?: unknown) => void
  ): void;
  getHeartRateSamples(
    options: { startDate: string; endDate: string; ascending?: boolean },
    callback: (error: string | null, results?: HealthSampleLike[]) => void
  ): void;
  Constants?: { Permissions?: Record<string, string> };
}

function loadHealthModule(): HealthModuleLike | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(HEALTH_MODULE_NAME) as HealthModuleLike;
    return mod ?? null;
  } catch {
    // Module absent (cas actuel) → indisponible, sans bruit.
    return null;
  }
}

/** true seulement sur iOS AVEC le module natif santé présent (faux aujourd'hui). */
export function isHealthAvailable(): boolean {
  return Platform.OS === 'ios' && loadHealthModule() !== null;
}

/**
 * Demande l'autorisation d'accès au cardio.
 * iOS sans module → 'unavailable' ; Android → 'unavailable' (no-op).
 * BIO-1 : appeler l'autorisation réelle du module et mapper vers 'granted'
 * / 'denied'.
 */
export async function requestAuthorization(): Promise<HealthAuthStatus> {
  if (Platform.OS !== 'ios') return 'unavailable';
  const mod = loadHealthModule();
  if (!mod) return 'unavailable';

  // On ne demande QUE la lecture de la fréquence cardiaque, et AUCUNE écriture :
  // l'app lit une mesure que la montre a prise, elle n'écrit jamais dans le
  // dossier de santé du pilote. Demander plus large serait réclamer un accès
  // dont on n'a pas l'usage — sur une donnée de l'article 9, c'est non.
  const heartRate = mod.Constants?.Permissions?.HeartRate ?? 'HeartRate';
  const permissions = { permissions: { read: [heartRate], write: [] as string[] } };

  return new Promise<HealthAuthStatus>((resolve) => {
    try {
      mod.initHealthKit(permissions, (error) => {
        // iOS ne dit JAMAIS si l'utilisateur a refusé une autorisation de
        // LECTURE (c'est délibéré chez Apple : le refus doit être
        // indiscernable de l'absence de données, pour ne pas le trahir). Une
        // erreur ici signifie donc « pas d'accès », sans qu'on puisse en
        // conclure le motif. On répond 'denied' : c'est le sens utile pour
        // l'appelant, et c'est fail-closed.
        resolve(error ? 'denied' : 'granted');
      });
    } catch {
      resolve('unavailable');
    }
  });
}

/**
 * Lit les échantillons cardiaques sur [from, to].
 *
 * Fail-closed : sans `hasConsent` (consentement de CAPTURE), retourne [] sans
 * aucun accès natif. Sur Android, ou si le module natif est absent, retourne []
 * également.
 *
 * @param hasConsent Consentement de capture du pilote — `loadBiometryConsents(userId).capture`.
 */
export async function readHeartRate(
  from: Date,
  to: Date,
  hasConsent: boolean
): Promise<HeartRateSample[]> {
  if (!hasConsent) return []; // GATE consentement — priorité absolue.
  if (Platform.OS !== 'ios') return [];
  const mod = loadHealthModule();
  if (!mod) return [];

  // Bornes invalides : on ne lit rien plutôt que d'ouvrir une fenêtre imprévue
  // sur le dossier de santé. Une plage inversée ou non datée n'est pas une
  // requête, c'est un bug — et on ne l'exécute pas « au cas où ».
  const fromMs = from instanceof Date ? from.getTime() : NaN;
  const toMs = to instanceof Date ? to.getTime() : NaN;
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return [];

  return new Promise<HeartRateSample[]>((resolve) => {
    try {
      mod.getHeartRateSamples(
        {
          startDate: new Date(fromMs).toISOString(),
          endDate: new Date(toMs).toISOString(),
          ascending: true,
        },
        (error, results) => {
          // Vide honnête sur erreur : l'absence de mesure se dit par une liste
          // vide, jamais par une valeur inventée.
          if (error || !Array.isArray(results)) {
            resolve([]);
            return;
          }
          const samples: HeartRateSample[] = [];
          for (const r of results) {
            if (r === null || typeof r !== 'object') continue;
            const hr = r.value;
            const ts = Date.parse(r.startDate);
            // Une FC nulle ou non finie n'est pas une mesure basse : c'est une
            // absence de mesure. On l'écarte au lieu de la faire entrer dans
            // une moyenne qu'elle fausserait.
            if (!Number.isFinite(hr) || hr <= 0) continue;
            if (!Number.isFinite(ts)) continue;
            samples.push({ ts, hr });
          }
          resolve(samples);
        }
      );
    } catch {
      resolve([]);
    }
  });
}
