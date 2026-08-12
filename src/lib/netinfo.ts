/**
 * Détection de l'état réseau.
 *
 * Source de vérité : @react-native-community/netinfo. Émet vers
 * useAppStateStore.setCondition('network', …) et useUIStore.setOfflineBannerVisible.
 *
 * Une fonction d'init unique branche les listeners au démarrage de l'app
 * (depuis app/_layout.tsx). Pas de hook React pour éviter les contextes
 * multiples et la dégradation du store.
 */

import NetInfo from '@react-native-community/netinfo';

import { useAppStateStore } from '@/store/useAppStateStore';
import { useUIStore } from '@/store/useUIStore';
import { flushQueue } from '@/services/offlineQueue';
import { hasPending, processQueue } from '@/services/captureSyncQueue';

let unsubscribe: (() => void) | null = null;
let wasOffline = false;

/**
 * ── POURQUOI UNE RELANCE PÉRIODIQUE (posée le 13/08/2026) ────────────────────
 *
 * La file de capture ne se redrainait qu'à trois occasions : au démarrage à
 * froid, à la capture suivante, et sur `online && wasOffline`.
 *
 * Cette dernière condition exige un passage EXPLICITE par `isConnected: false`.
 * Or le réseau qui fait échouer une requête au bord d'une route de campagne
 * n'est presque jamais un réseau ABSENT : c'est une 4G attachée, affichée
 * pleine, sans débit utile. `isConnected` reste `true`, `wasOffline` ne bascule
 * jamais, et la relance n'a JAMAIS lieu.
 *
 * Conséquence relevée sur le premier essai terrain : le drain s'arrête au
 * premier lot de trames en échec et garde TOUT ce qui suit — la clôture
 * comprise. Séance à zéro trame en base, statut `recording` à vie, et les
 * octets encore sur le téléphone sans que rien ne les rejoue.
 *
 * On ajoute donc deux déclencheurs, tous deux conditionnés à `hasPending()` —
 * sans travail en attente, il ne se passe rien du tout :
 *   1. TOUT évènement réseau en ligne relance (plus seulement un retour d'un
 *      hors-ligne constaté) ;
 *   2. une relance périodique, qui S'ARRÊTE D'ELLE-MÊME dès que la file est
 *      vide — ce n'est pas un sondage permanent.
 */
const RELANCE_PERIODE_MS = 60_000;
/** Anti-rafale : NetInfo émet plusieurs fois par changement d'interface. */
const RELANCE_DEBOUNCE_MS = 3_000;

let relanceTimer: ReturnType<typeof setInterval> | null = null;
let derniereRelanceMs = 0;
let relanceEnCours = false;

/**
 * Draine la file de capture SI elle a du travail. Jamais bloquant, jamais
 * bruyant : c'est un filet, pas un flux.
 */
async function relancerSiEnAttente(raison: string): Promise<void> {
  if (relanceEnCours) return;
  relanceEnCours = true;
  try {
    if (!(await hasPending())) {
      arreterRelancePeriodique();
      return;
    }
    derniereRelanceMs = Date.now();
    await processQueue();
    // Toujours en attente après le passage → on garde la relance armée.
    if (await hasPending()) demarrerRelancePeriodique();
    else arreterRelancePeriodique();
  } catch (err) {
    console.warn(`[OXV] relance de la file de capture (${raison}) :`, err);
  } finally {
    relanceEnCours = false;
  }
}

function demarrerRelancePeriodique(): void {
  if (relanceTimer) return;
  relanceTimer = setInterval(() => void relancerSiEnAttente('périodique'), RELANCE_PERIODE_MS);
}

function arreterRelancePeriodique(): void {
  if (relanceTimer) {
    clearInterval(relanceTimer);
    relanceTimer = null;
  }
}

export function initNetInfo(): () => void {
  if (unsubscribe) return unsubscribe;

  unsubscribe = NetInfo.addEventListener((state) => {
    const online = Boolean(state.isConnected) && state.isInternetReachable !== false;
    const appState = useAppStateStore.getState();
    const uiState = useUIStore.getState();

    appState.setCondition('network', online ? 'online' : 'offline');
    uiState.setOfflineBannerVisible(!online);

    // Si on revient en ligne après un offline, on vide les files : actions
    // unitaires (MMKV) ET file de synchro de capture (fichiers) — cette dernière
    // draine create_session / frames requeuées / laps / complete / upload .ubx.
    if (online && wasOffline) {
      flushQueue().catch((err) => {
        console.warn('[OXV] flushQueue après reconnexion :', err);
      });
    }

    // TOUT évènement en ligne relance la file de capture — plus seulement un
    // retour d'un hors-ligne constaté (cf. l'en-tête : le réseau de campagne
    // n'est presque jamais ABSENT, il est juste sans débit). Anti-rafale, et
    // sans effet si la file est vide.
    if (online && Date.now() - derniereRelanceMs > RELANCE_DEBOUNCE_MS) {
      void relancerSiEnAttente('évènement réseau');
    }

    wasOffline = !online;
  });

  // Au branchement : s'il reste du travail d'une séance précédente, on arme la
  // relance périodique tout de suite. C'est ce qui rattrape une capture restée
  // sur le téléphone sans qu'aucun évènement réseau ne survienne ensuite.
  void relancerSiEnAttente('démarrage');

  // Lecture initiale (au cas où on démarre offline)
  NetInfo.fetch().then((state) => {
    const online = Boolean(state.isConnected) && state.isInternetReachable !== false;
    useAppStateStore.getState().setCondition('network', online ? 'online' : 'offline');
    useUIStore.getState().setOfflineBannerVisible(!online);
    wasOffline = !online;
  });

  return unsubscribe;
}

export function teardownNetInfo(): void {
  arreterRelancePeriodique();
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
