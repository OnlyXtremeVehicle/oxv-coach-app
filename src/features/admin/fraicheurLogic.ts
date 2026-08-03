/**
 * CE QUE L'ÉCRAN DIT DE SA PROPRE FRAÎCHEUR (jalon 7, phase 6).
 *
 * Module PUR : aucune dépendance React, RN ni Supabase — c'est ce qui le rend
 * testable, et la partie qui compte ici EST la décision, pas le réseau.
 *
 * ---
 *
 * S'ABONNER N'EST PAS RECEVOIR
 *
 * `postgres_changes` ne livre que les tables inscrites à la publication
 * `supabase_realtime`. Vérifié le 03/08/2026 : **`telemetry_sessions` n'y est
 * pas** — seule `coach_annotations` l'est.
 *
 * Or un canal portant sur une table non publiée REJOINT quand même, et son
 * statut passe à `SUBSCRIBED`. Déduire « en direct » de ce statut serait un
 * mensonge qu'aucune erreur ne signalerait — la garde posée, non armée, motif
 * que ce dépôt combat.
 *
 * D'où la règle : **le mot « direct » n'apparaît qu'après un évènement REÇU.**
 *
 * `PROPOSITION_L34_realtime_seances.sql` ajoute la table à la publication. Ce
 * module dit la vérité avant comme après ; la migration ne fait que rendre vrai
 * ce qu'il sait déjà dire.
 */

/** Ce que l'appelant apprend du canal. */
export interface EtatDirect {
  /** Le canal a rejoint. NE PROUVE RIEN sur l'arrivée des évènements. */
  abonne: boolean;
  /**
   * Un évènement a été REÇU au moins une fois. C'est la seule preuve que le
   * direct fonctionne réellement — publication comprise.
   */
  recuAuMoinsUn: boolean;
}

/**
 * Ce que l'écran affiche de sa propre fraîcheur.
 *
 * Trois états, et le mot « direct » n'apparaît que dans le troisième.
 *
 * Pur : aucune dépendance réseau, testable.
 */
export function phraseFraicheur(etat: EtatDirect, luLe: Date | null): string {
  const heure =
    luLe !== null
      ? `${String(luLe.getHours()).padStart(2, '0')}:${String(luLe.getMinutes()).padStart(2, '0')}`
      : null;

  if (etat.recuAuMoinsUn) return 'En direct — la liste se met à jour seule.';
  if (etat.abonne) {
    // Abonné mais rien reçu : c'est l'état ordinaire d'une piste calme, ET
    // celui d'une table non publiée. On ne peut pas les distinguer, alors on
    // n'affirme ni l'un ni l'autre.
    return heure !== null
      ? `Lu à ${heure}. Aucune mise à jour reçue depuis.`
      : 'Aucune mise à jour reçue.';
  }
  return heure !== null ? `Lu à ${heure}.` : 'Lecture en cours.';
}
