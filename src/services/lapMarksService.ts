/**
 * MARQUES DE TOUR — ce que l'HUMAIN déclare sur un tour (`public.lap_marks`).
 *
 * ===========================================================================
 * POURQUOI CETTE TABLE EXISTE
 * ===========================================================================
 *
 * `validationToursLogic` (module M05) DOUTE : il dit « 8,4 s au-dessus de la
 * médiane des tours propres », jamais « trafic ». La cause appartient à qui
 * était dans la voiture. Jusqu'au 25/08/2026, elle n'avait aucune place en
 * base — `laps` ne porte que trois booléens calculés, sans motif ni auteur — et
 * l'en-tête de M05 le disait mot pour mot : « confirmer ou infirmer demandera
 * une décision de schéma ». Elle est prise : `lap_marks`.
 *
 * ===========================================================================
 * UNE MARQUE NE CORRIGE PAS LA MACHINE : ELLE S'AJOUTE À CÔTÉ
 * ===========================================================================
 *
 * Rien ici ne réécrit `laps`, ne recalcule un classement, ne masque un fait.
 * Les deux lectures cohabitent, et c'est `marquesTourLogic` qui les met côte à
 * côte pour l'écran. Un tour peut très bien porter à la fois « 8,4 s au-dessus
 * de la médiane » (la machine) et « Gêné par le trafic » (le pilote) : c'est
 * précisément la paire qu'on veut lire.
 *
 * ===========================================================================
 * IL N'Y A PAS DE MODIFICATION, ET CE N'EST PAS UN OUBLI
 * ===========================================================================
 *
 * La table n'a AUCUNE politique UPDATE. Une déclaration ne se corrige pas :
 * elle se RETIRE et se repose. Ce service n'expose donc aucune fonction de
 * modification — en écrire une produirait un appel refusé par la RLS, c'est-à-
 * dire une commande d'écran qui échoue toujours.
 *
 * ===========================================================================
 * CE QUE LA LECTURE NE RAMÈNE PAS
 * ===========================================================================
 *
 * Aucune donnée personnelle de l'auteur : ni nom, ni pseudonyme, ni avatar —
 * l'identifiant seul. Le coach lit les séances de ses pilotes ; il n'a pas à
 * découvrir par ce chemin une identité que l'app ne lui montre pas déjà.
 * L'écran distingue « ma marque » de « la marque d'un tiers » en comparant à
 * l'utilisateur courant, ce qui suffit et n'expose rien.
 *
 * RLS (migration `20260825140000_m05_lap_marks_declarations_humaines`) :
 *   SELECT  propriétaire de la séance, auteur, coach du propriétaire, admin
 *   INSERT  author_id = auth.uid() ET (propriétaire de la séance OU son coach)
 *   DELETE  author_id = auth.uid()
 */

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

/** Les six déclarations possibles — l'énumération de la base, pas une copie. */
export type GenreMarqueTour = Database['public']['Enums']['lap_mark_kind_enum'];

/** Une marque telle qu'elle est lue. `motif` vaut `null` quand rien n'a été écrit. */
export interface MarqueTourPosee {
  id: string;
  lapId: string;
  sessionId: string;
  /** Identifiant de l'auteur — RIEN d'autre. Voir l'en-tête. */
  auteurId: string;
  genre: GenreMarqueTour;
  motif: string | null;
  poseeLe: string;
}

/** Résultat d'une écriture : le fait, et s'il a échoué, la raison en français. */
export interface ResultatMarque {
  ok: boolean;
  erreur?: string;
}

const COLONNES = 'id, lap_id, session_id, author_id, kind, motif, created_at';

type LigneMarque = Database['public']['Tables']['lap_marks']['Row'];

function versMarque(ligne: LigneMarque): MarqueTourPosee {
  return {
    id: ligne.id,
    lapId: ligne.lap_id,
    sessionId: ligne.session_id,
    auteurId: ligne.author_id,
    genre: ligne.kind,
    motif: ligne.motif ?? null,
    poseeLe: ligne.created_at,
  };
}

/**
 * Toutes les marques d'une séance, les plus anciennes d'abord.
 *
 * L'ORDRE EST CELUI DE LA DÉCLARATION, pas celui du tour. Deux marques posées
 * sur le même tour se lisent dans l'ordre où elles ont été dites — c'est un
 * registre, et un registre ne se réordonne pas. Le regroupement par tour est
 * le travail de `marquesTourLogic`, qui conserve cet ordre à l'intérieur de
 * chaque tour.
 *
 * La RLS filtre déjà : le pilote voit sa séance, le coach celle de son pilote.
 * Une erreur de lecture rend une liste VIDE et le dit au journal — l'écran
 * affiche alors les faits de la machine seuls, ce qui reste vrai, plutôt qu'un
 * écran en panne.
 */
export async function listerMarquesSeance(sessionId: string): Promise<MarqueTourPosee[]> {
  const { data, error } = await supabase
    .from('lap_marks')
    .select(COLONNES)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('[OXV][marques-tour] listerMarquesSeance :', error.message);
    return [];
  }
  return (data ?? []).map(versMarque);
}

export interface EntreeMarque {
  lapId: string;
  sessionId: string;
  genre: GenreMarqueTour;
  /**
   * Motif libre, ou `null` quand la personne n'en donne pas.
   *
   * Il est REQUIS dans la signature — sans valeur par défaut — parce qu'un
   * appelant doit choisir explicitement entre « elle a écrit ceci » et « elle
   * n'a rien écrit ». Un paramètre optionnel laisserait l'absence se glisser
   * sans décision.
   *
   * La base refuse une chaîne vide après nettoyage (CHECK) : on la ramène donc
   * à `null` ici plutôt que de faire l'aller-retour pour l'apprendre.
   */
  motif: string | null;
}

/**
 * Pose une marque. L'auteur est l'utilisateur courant — jamais un identifiant
 * fourni par l'appelant : la RLS impose `author_id = auth.uid()`, et le lui
 * passer depuis l'écran n'ouvrirait qu'une occasion de se tromper.
 *
 * LE CONFLIT D'UNICITÉ N'EST PAS UNE PANNE. `(lap_id, author_id, kind)` est
 * unique : une même personne ne déclare pas deux fois la même chose sur le même
 * tour. Retomber dessus signifie que la marque est DÉJÀ là — on le dit
 * simplement, on ne jette pas une erreur brute qui ferait croire à un échec.
 */
export async function poserMarque(entree: EntreeMarque): Promise<ResultatMarque> {
  const { data: auth } = await supabase.auth.getUser();
  const auteurId = auth?.user?.id;
  if (!auteurId) return { ok: false, erreur: 'Session expirée.' };

  const motif = entree.motif?.trim() ?? '';

  const { error } = await supabase.from('lap_marks').insert({
    lap_id: entree.lapId,
    session_id: entree.sessionId,
    author_id: auteurId,
    kind: entree.genre,
    motif: motif.length > 0 ? motif : null,
  });

  if (error) {
    // 23505 : la marque existe déjà. Ce n'est pas un échec, c'est un état.
    if (error.code === '23505') {
      return { ok: false, erreur: 'Cette déclaration est déjà posée sur ce tour.' };
    }
    // 23503 : le tour ou la séance n'existe plus (suppression en cascade).
    if (error.code === '23503') {
      return { ok: false, erreur: 'Ce tour n’est plus disponible.' };
    }
    // 42501 / P0001 : la RLS ou le déclencheur a refusé — séance d'autrui, ou
    // `session_id` qui n'est pas celle du tour.
    if (error.code === '42501') {
      return { ok: false, erreur: 'Vous ne pouvez pas déclarer sur cette séance.' };
    }
    console.warn('[OXV][marques-tour] poserMarque :', error.message);
    return { ok: false, erreur: error.message };
  }
  return { ok: true };
}

/**
 * Retire une marque. La RLS n'autorise que son AUTEUR : la commande n'est donc
 * offerte à l'écran que sur ses propres déclarations, et un refus se lit ici.
 *
 * C'est la seule façon de revenir sur une déclaration — il n'y a pas de
 * modification. Retirer puis reposer laisse deux traces horodatées distinctes,
 * ce qui est exactement ce qu'on veut d'un registre.
 */
export async function retirerMarque(marqueId: string): Promise<ResultatMarque> {
  const { error } = await supabase.from('lap_marks').delete().eq('id', marqueId);

  if (error) {
    if (error.code === '42501') {
      return { ok: false, erreur: 'Seul l’auteur peut retirer sa déclaration.' };
    }
    console.warn('[OXV][marques-tour] retirerMarque :', error.message);
    return { ok: false, erreur: error.message };
  }
  return { ok: true };
}
