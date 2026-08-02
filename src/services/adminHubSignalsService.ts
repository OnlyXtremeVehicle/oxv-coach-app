/**
 * LES DEUX SIGNAUX DU HUB ADMIN (jalon 7, phase 6).
 *
 * Le mode du hub se lit sur ce qui SE PASSE, jamais sur le calendrier : une
 * journée s'annule, un pilote roule un jour non prévu.
 *
 *   1. quelqu'un roule MAINTENANT (séance `recording`) ;
 *   2. une séance a commencé AUJOURD'HUI.
 *
 * Deux comptages `head: true` — on ne rapatrie aucune ligne, seulement des
 * nombres. Aucune donnée de télémétrie, aucun nom : le mode n'a besoin de
 * savoir que combien, pas qui.
 *
 * ---
 *
 * L'ÉCHEC SE DIT, IL NE SE DÉGUISE PAS EN ZÉRO
 *
 * `count` vaut `null` quand la requête échoue. Rendre `0` ferait croire que
 * personne ne roule — et le hub s'ouvrirait en mode complet en pleine journée,
 * ou pire, afficherait « 0 pilote en piste » comme un fait. Chaque signal vaut
 * donc `number | null`, et `modeAdmin` traite `null` comme « rien de mesuré »,
 * ce qui le fait échouer vers le mode COMPLET — celui qui ne cache rien.
 */

import { supabase } from '@/lib/supabase';

export interface SignauxHubAdmin {
  /** Séances en cours d'enregistrement. `null` = lecture impossible. */
  pilotesEnPiste: number | null;
  /** Séances commencées aujourd'hui. `null` = lecture impossible. */
  seancesDuJour: number | null;
}

function compteOuNull(res: { count: number | null; error: unknown }): number | null {
  if (res.error !== null && res.error !== undefined) return null;
  return typeof res.count === 'number' && Number.isFinite(res.count) ? res.count : null;
}

/**
 * Les deux signaux, lus à l'instant donné.
 *
 * `maintenant` est injecté plutôt que lu ici : c'est ce qui rend la fenêtre du
 * jour testable, et ce qui évite qu'un écran affiche la journée d'hier après
 * être resté ouvert toute la nuit.
 *
 * Ne rejette jamais : chaque signal tombe indépendamment à `null`.
 */
export async function chargerSignauxHubAdmin(maintenant: Date): Promise<SignauxHubAdmin> {
  const debut = new Date(maintenant);
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(maintenant);
  fin.setHours(23, 59, 59, 999);

  const [enPiste, duJour] = await Promise.all([
    supabase
      .from('telemetry_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'recording'),
    supabase
      .from('telemetry_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('started_at', debut.toISOString())
      .lte('started_at', fin.toISOString()),
  ]);

  return {
    pilotesEnPiste: compteOuNull(enPiste),
    seancesDuJour: compteOuNull(duJour),
  };
}
