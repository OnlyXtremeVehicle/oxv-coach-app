/**
 * LES MARQUEURS D'UNE SÉANCE, RÉSOLUS (jalon 6, phase 5).
 *
 * *« Le marqueur ressort partout : file de lecture, carte de séance,
 * préparation suivante du pilote. »* — Arbre Coach, II.2.
 *
 * Ce module sert la CARTE DE SÉANCE : le coach y choisit les moments qu'il
 * retient. Le fil, lui, les affiche tous — même besoin, deux surfaces.
 *
 * ---
 *
 * UNE SEULE RÉSOLUTION, PARTAGÉE
 *
 * Les primitives de chargement (`tramesPourMarqueurs`, `bornesDesTours`)
 * viennent de `filSeanceService` et ne sont pas réécrites ici. Deux chemins de
 * résolution finiraient par diverger, et le pilote lirait deux vérités sur le
 * même geste.
 *
 * ---
 *
 * ON NE CHARGE RIEN POUR RIEN
 *
 * Les trames ne sont lues que si la séance porte au moins un marqueur. Sans
 * marqueur, la fonction rend une liste vide sans toucher à la télémétrie.
 */

import { bornesDesTours, tramesPourMarqueurs } from '@/features/coach/filSeanceService';
import { supabase } from '@/lib/supabase';
import { phraseMarqueur, resoudreMarqueur } from '@/telemetry/marqueur';

export interface MarqueurSeance {
  id: string;
  /** Instant dans la capture, en ms. Ce que le geste a produit. */
  elapsedMs: number;
  /** Les faits résolus, en une phrase. `null` si rien n'a pu être établi. */
  faits: string | null;
  /** La note du coach, si elle existe. Un marqueur naît sans texte. */
  note: string | null;
  tour: number | null;
  virage: number | null;
  /** Où le pilote se trouvait. Mesure directe, sans géométrie de circuit. */
  position: { lat: number; lon: number } | null;
}

/**
 * Charge les marqueurs d'une capture, résolus, du plus ancien au plus récent.
 *
 * Ne rejette jamais : une lecture impossible rend une liste vide. Un écran de
 * composition ne doit pas tomber parce que la télémétrie n'a pas répondu — le
 * coach peut toujours écrire sa phrase.
 */
export async function chargerMarqueursSeance(captureId: string): Promise<MarqueurSeance[]> {
  if (typeof captureId !== 'string' || captureId.length === 0) return [];

  const { data, error } = await supabase
    .from('coach_annotations')
    .select('id, body, marker_elapsed_ms')
    .eq('telemetry_session_id', captureId)
    .is('deleted_at', null)
    .not('marker_elapsed_ms', 'is', null)
    .order('marker_elapsed_ms', { ascending: true });

  if (error || !Array.isArray(data) || data.length === 0) return [];

  const { data: seance } = await supabase
    .from('telemetry_sessions')
    .select('started_at')
    .eq('id', captureId)
    .maybeSingle();
  const debutIso = (seance as { started_at?: string | null } | null)?.started_at ?? null;

  const [trames, bornes] = await Promise.all([
    tramesPourMarqueurs(captureId).catch(() => []),
    bornesDesTours(captureId, debutIso).catch(() => []),
  ]);

  return (data as Record<string, unknown>[])
    .map((row): MarqueurSeance | null => {
      const at = row.marker_elapsed_ms;
      if (typeof at !== 'number' || !Number.isFinite(at)) return null;
      // Aucune corde de référence n'existe encore : `virage` vaudra `null`, et
      // c'est l'affichage juste. La position, elle, tient toujours.
      const m = resoudreMarqueur(at, trames, bornes, []);
      const note = typeof row.body === 'string' && row.body.trim().length > 0 ? row.body : null;
      return {
        id: String(row.id),
        elapsedMs: at,
        faits: phraseMarqueur(m),
        note,
        tour: m.tour,
        virage: m.virage,
        position: m.position,
      };
    })
    .filter((m): m is MarqueurSeance => m !== null);
}

/**
 * Ce qu'un marqueur retenu écrit dans le document.
 *
 * Les FAITS d'abord, la note du coach ensuite — l'ordre de la doctrine. Un
 * marqueur dont rien n'a pu être résolu et qui ne porte aucune note n'écrit
 * rien : `null`, et l'appelant ne le propose pas.
 */
export function ligneDocument(m: MarqueurSeance): string | null {
  const bouts = [m.faits, m.note].filter(
    (b): b is string => typeof b === 'string' && b.trim().length > 0
  );
  return bouts.length > 0 ? bouts.join(' — ') : null;
}
