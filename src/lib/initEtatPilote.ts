/**
 * Réveil de la machine d'état pilote — jalon 3.
 *
 * ---
 *
 * CE QUI ÉTAIT CASSÉ, ET DEPUIS TOUJOURS
 *
 * `useAppStateStore` porte trois entrées et trois setters. Seuls `setPosition`
 * et `setCondition` étaient appelés. `setUser`, `setSessions` et
 * `setActiveRecording` n'avaient **aucun appelant en production** — les
 * occurrences apparentes étaient des `useState` homonymes dans un écran admin.
 *
 * Conséquence en chaîne :
 *
 *   `hasAccount` reste `false` (valeur initiale)
 *     → `determineState` rend toujours `S1_decouverte`
 *       → `captureStepLogic` le mappe sur `route: null`
 *         → l'aiguilleur `rec/index.tsx` ne redirige jamais
 *         → `setSilenceMode(isSilentState('S1_decouverte'))` vaut toujours faux
 *           → `isSilenced()` est faux en permanence
 *             → **le garde-fou du silence en piste ne s'est jamais déclenché.**
 *
 * Principe 3 — « pendant que le véhicule roule, aucun écran, aucune
 * notification, aucun son » — était tenu par le code mais jamais armé. Le son
 * était bien coupé, lui, de façon inconditionnelle ; c'est ce qui a masqué le
 * reste.
 *
 * ---
 *
 * CE MODULE NE MODIFIE AUCUN FICHIER PROTÉGÉ
 *
 * `useAppStateStore`, `captureSessionService`, `captureSyncQueue` et
 * `bluetoothService` relèvent de la règle cardinale. On ne les touche pas : on
 * APPELLE ce qu'ils exposent déjà. Les setters existaient, il leur manquait un
 * appelant.
 *
 * ---
 *
 * L'ARBITRAGE DU FONDATEUR : LE SEUIL DE VITESSE
 *
 * Deux façons d'armer le silence : sur « capture en cours », ou sur les 60 km/h
 * de `determineState`. Le fondateur a tranché pour le second (28/07/2026).
 *
 * Conséquence assumée, et dite : le silence s'arme quand le pilote ROULE, pas
 * quand il arme. Il reste une fenêtre entre l'armement et l'entrée en piste.
 * La moyenne glissante de cinq secondes y ajoute environ trois secondes pour
 * une entrée à 100 km/h — voir `vitesseRecente.ts`.
 */

import { bluetoothService } from '@/ble/bluetoothService';
import { ajouter, moyenne, type Releve } from '@/features/rec/vitesseRecente';
import { useAppStateStore } from '@/store/useAppStateStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getMyNextTrackDay } from '@/services/nextTrackDayService';
import { useSessionStore } from '@/store/useSessionStore';

let demarre = false;
const desabonnements: (() => void)[] = [];

/** Fenêtre glissante des vitesses. Remise à zéro à chaque fin de séance. */
let fenetre: Releve[] = [];

/**
 * Anti-emballement. Le RaceBox émet à 25 Hz : recalculer l'état à chaque trame
 * ferait vingt-cinq recalculs par seconde, chacun traversant `determineState`
 * et repoussant `setSilenceMode`. Une fois par seconde suffit largement pour un
 * seuil lissé sur cinq.
 */
const PAS_MS = 1_000;
let dernierPoussage = 0;

/**
 * Réveille la machine d'état. Idempotent — un second appel ne fait rien.
 *
 * Appelé depuis `app/_layout.tsx`, au même endroit que `initGeolocation`.
 */
export function initEtatPilote(): void {
  if (demarre) return;
  demarre = true;

  const app = useAppStateStore.getState();

  // --- 1. Le compte -------------------------------------------------------
  //
  // `hasAccount` conditionne TOUT : sans lui, `determineState` sort sur
  // `S1_decouverte` à la première ligne et rien d'autre n'est évalué.
  const poserCompte = (profil: ReturnType<typeof useAuthStore.getState>['profile']) => {
    app.setUser(profil != null, profil?.profile_completed_at != null);
    app.recompute();
  };
  poserCompte(useAuthStore.getState().profile);
  desabonnements.push(
    useAuthStore.subscribe((s, prec) => {
      if (s.profile?.id !== prec.profile?.id) poserCompte(s.profile);
    })
  );

  // --- 1 bis. Les journées du pilote --------------------------------------
  //
  // `setSessions` N'AVAIT AUCUN APPELANT — posé le 13/08/2026.
  //
  // `upcomingSessions` et `pastSessions` restaient donc VIDES en permanence, et
  // avec eux tous les états qui en dépendent : la veille de journée, le jour J,
  // le retour de séance. La machine ne quittait jamais l'axe « compte + capture
  // en cours », et trois états de la doctrine n'étaient jamais atteints.
  //
  // Un `setSessions` posé sans lecture, ou une lecture posée sans `setSessions`,
  // c'est la même chose vue des deux côtés : un mécanisme complet dont un
  // maillon manque, et qui ne produit rien sans jamais lever d'erreur.
  //
  // On lit la journée réservée du pilote — celle-là même qui commande désormais
  // le circuit à l'armement — et on la pose. `endsAt` inclus : une journée de
  // nuit franchit minuit, et une fin antérieure à son début la classerait dans
  // le passé avant qu'elle n'ait commencé.
  const poserJournees = (userId: string | null) => {
    if (!userId) {
      app.setSessions([], []);
      return;
    }
    void getMyNextTrackDay(userId)
      .then((j) => {
        if (!j) {
          app.setSessions([], []);
          return;
        }
        const debut = new Date(`${j.date}T${(j.startTime ?? '00:00:00').slice(0, 8)}`);
        let fin: Date | null = null;
        if (j.endTime) {
          const f = new Date(`${j.date}T${j.endTime.slice(0, 8)}`);
          fin = f.getTime() < debut.getTime() ? new Date(f.getTime() + 86_400_000) : f;
        }
        if (!Number.isFinite(debut.getTime())) {
          app.setSessions([], []);
          return;
        }
        const ref = { id: j.sessionId, startsAt: debut, endsAt: fin, circuitId: j.circuitId ?? '' };
        // `getMyNextTrackDay` ne rend QUE la journée en cours ou à venir : une
        // journée déjà finie n'en sort pas. Elle appartient donc au futur.
        app.setSessions([ref], []);
      })
      .catch(() => {
        // Une lecture ratée n'est pas « aucune journée » : on ne touche à rien
        // plutôt que d'affirmer un vide. Le prochain passage réessaiera.
      });
  };
  poserJournees(useAuthStore.getState().profile?.id ?? null);
  desabonnements.push(
    useAuthStore.subscribe((s, prec) => {
      if (s.profile?.id !== prec.profile?.id) poserJournees(s.profile?.id ?? null);
    })
  );

  // --- 2. La séance en cours ----------------------------------------------
  //
  // On lit le store de séance, pas le service de capture : le service est
  // protégé, et le store porte déjà l'état dont on a besoin.
  const poserSeance = () => {
    const s = useSessionStore.getState();
    if (s.status !== 'recording' && s.status !== 'paused') {
      fenetre = [];
      if (useAppStateStore.getState().activeRecording !== null) {
        app.setActiveRecording(null);
        app.recompute();
      }
      return;
    }
    if (!s.meta) return;
    app.setActiveRecording({
      sessionId: s.meta.id,
      startedAt: s.meta.startedAt,
      status: s.status === 'paused' ? 'paused' : 'recording',
      // Fenêtre vide → 0 : on ne connaît pas encore la vitesse, et 0 laisse
      // l'état au paddock. Le contraire — supposer le roulage — armerait le
      // silence avant la piste.
      recentAverageSpeedKmh: moyenne(fenetre) ?? 0,
    });
    app.recompute();
  };
  poserSeance();
  desabonnements.push(useSessionStore.subscribe(poserSeance));

  // --- 3. La vitesse ------------------------------------------------------
  //
  // Abonnement SÉPARÉ de celui de la capture : le service BLE diffuse à
  // plusieurs écouteurs, et celui-ci ne consomme rien qu'il n'observe.
  desabonnements.push(
    bluetoothService.onData((frame) => {
      const ts = Date.now();
      fenetre = ajouter(fenetre, { ts, kmh: frame.motion.speed }, ts);
      if (ts - dernierPoussage < PAS_MS) return;
      dernierPoussage = ts;
      poserSeance();
    })
  );
}

/** Coupe les abonnements. Symétrique de `teardownGeolocation`. */
export function teardownEtatPilote(): void {
  for (const off of desabonnements) {
    try {
      off();
    } catch {
      // Un désabonnement qui échoue ne doit pas empêcher les suivants.
    }
  }
  desabonnements.length = 0;
  fenetre = [];
  dernierPoussage = 0;
  demarre = false;
}
