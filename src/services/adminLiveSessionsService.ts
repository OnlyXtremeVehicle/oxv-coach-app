/**
 * LES SÉANCES EN COURS, EN DIRECT — SI LA BASE LE PERMET (jalon 7, phase 6).
 *
 * *« Temps réel sur tout l'espace, pas seulement sur les séances en cours. »*
 * — Plan de montage, Jalon 7, Phase 6.
 *
 * ---
 *
 * S'ABONNER N'EST PAS RECEVOIR
 *
 * C'est tout le sujet de ce module. `postgres_changes` ne livre que les tables
 * inscrites à la publication `supabase_realtime`. Vérifié le 03/08/2026 :
 * **`telemetry_sessions` n'y est pas** — seule `coach_annotations` l'est.
 *
 * Or un canal portant sur une table non publiée REJOINT quand même, et son
 * statut passe à `SUBSCRIBED`. Un écran qui déduirait « en direct » de ce
 * statut mentirait sans qu'aucune erreur ne se produise : le motif exact que ce
 * dépôt combat.
 *
 * D'où la règle de ce module : **on n'annonce le direct qu'après avoir REÇU un
 * évènement.** L'abonnement seul ne prouve rien. Tant que rien n'arrive,
 * l'appelant continue d'afficher « lu à l'ouverture », ce qui est vrai.
 *
 * `PROPOSITION_L34_realtime_seances.sql` ajoute la table à la publication. Ce
 * module fonctionne avant comme après — il dit simplement la vérité des deux
 * côtés.
 *
 * ---
 *
 * CE QUI CIRCULE
 *
 * Des métadonnées de séance : début, statut, nombre de tours. Aucune trame,
 * aucune position. La RLS s'applique aux évènements Realtime comme aux
 * lectures : chacun ne reçoit que ce qu'il pouvait déjà lire.
 */

import { supabase } from '@/lib/supabase';

import type { EtatDirect } from '@/features/admin/fraicheurLogic';

export type { EtatDirect };

export type Desabonnement = () => void;

/**
 * S'abonne aux changements de séances de télémétrie.
 *
 * `onChangement` est appelé à chaque insertion, mise à jour ou suppression :
 * l'appelant recharge sa liste plutôt que d'appliquer un delta. Une séance qui
 * démarre, s'arrête ou change de statut touche plusieurs champs, et
 * reconstruire depuis la base évite d'entretenir deux vérités.
 *
 * `onEtat` reçoit l'état du canal à chaque changement — c'est lui qui permet à
 * l'écran de ne PAS prétendre au direct tant que rien n'est arrivé.
 */
export function suivreSeancesEnDirect(
  onChangement: () => void,
  onEtat: (etat: EtatDirect) => void
): Desabonnement {
  let abonne = false;
  let recuAuMoinsUn = false;
  let vivant = true;

  const dire = () => {
    if (vivant) onEtat({ abonne, recuAuMoinsUn });
  };

  const canal = supabase
    .channel('admin:seances')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'telemetry_sessions' }, () => {
      if (!vivant) return;
      // LA PREUVE. Tant que cette ligne n'a pas tourné, le direct n'est pas
      // établi — quel que soit le statut du canal.
      recuAuMoinsUn = true;
      dire();
      onChangement();
    })
    .subscribe((statut) => {
      if (!vivant) return;
      abonne = statut === 'SUBSCRIBED';
      dire();
    });

  return () => {
    vivant = false;
    void supabase.removeChannel(canal);
  };
}
