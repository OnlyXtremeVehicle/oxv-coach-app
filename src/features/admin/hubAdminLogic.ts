/**
 * LE HUB ADMIN À DEUX MODES (jalon 7, phase 6).
 *
 * *« Deux modes — écran unique le jour J, hub structuré sinon. Même règle que
 * le pilote et le coach : la temporalité commande. »*
 *
 * *« Séparation verticale : surveillance en haut, gestes au milieu sous
 * "À faire", plateau en bas. »* — Plan de montage, Jalon 7, Phase 6.
 *
 * Module PUR : aucune dépendance React, RN ni Supabase.
 *
 * ---
 *
 * CE QUI ÉTAIT EN PLACE
 *
 * `app/(admin)/index.tsx` était une liste plate de VINGT-DEUX cartes, rendue à
 * l'identique le jour J et un mardi de février. Aucun état, aucun hook de
 * donnée, pas une seule section — `SectionLabel` n'était même pas importé. Les
 * vingt-deux descriptions étaient des chaînes littérales figées : aucun
 * compteur, nulle part.
 *
 * Vingt-deux destinations sans ordre, c'est un menu. Ce n'est pas un poste de
 * travail au bord d'une piste.
 *
 * ---
 *
 * DEUX SIGNAUX MESURÉS, JAMAIS UNE SUPPOSITION
 *
 * Le mode ne se lit pas au calendrier — une journée s'annule, un pilote roule un
 * jour non prévu. Il se lit sur ce qui SE PASSE : quelqu'un roule maintenant, ou
 * une séance est arrivée aujourd'hui.
 *
 * Et il échoue vers `hors-journee`, le mode COMPLET. Se tromper en montrant tout
 * coûte un écran chargé ; se tromper en mode jour J cacherait ce que
 * l'administrateur est venu chercher.
 */

export type ModeAdmin = 'jour-j' | 'hors-journee';

/**
 * Les quatre familles de la séparation verticale, dans l'ordre d'affichage.
 *
 * `surveillance` — ce qui se passe maintenant, en haut.
 * `a-faire`      — les gestes du jour, au milieu.
 * `plateau`      — les gens et le matériel, en bas.
 * `structure`    — ce qui se règle au calme : réglages, économie, contenus.
 */
export type FamilleAdmin = 'surveillance' | 'a-faire' | 'plateau' | 'structure';

export const ORDRE_FAMILLES: readonly FamilleAdmin[] = [
  'surveillance',
  'a-faire',
  'plateau',
  'structure',
];

export const TITRE_FAMILLE: Record<FamilleAdmin, string> = {
  surveillance: 'SURVEILLANCE',
  'a-faire': 'À FAIRE',
  plateau: 'PLATEAU',
  structure: 'STRUCTURE',
};

export interface SignauxAdmin {
  /** Pilotes actuellement en roulage (séances `recording`). */
  pilotesEnPiste: number;
  /** Séances de télémétrie commencées aujourd'hui. */
  seancesDuJour: number;
}

/**
 * Le mode du hub, lu sur les faits.
 *
 * Tout ce qui n'est pas un nombre fini strictement positif vaut « rien ne se
 * passe ». Une valeur absente ne bascule jamais en jour J : c'est le sens du
 * fail-closed appliqué à un mode qui CACHE des outils.
 */
export function modeAdmin(signaux: SignauxAdmin): ModeAdmin {
  if (signaux === null || typeof signaux !== 'object') return 'hors-journee';
  const positif = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v) && v > 0;
  return positif(signaux.pilotesEnPiste) || positif(signaux.seancesDuJour)
    ? 'jour-j'
    : 'hors-journee';
}

/**
 * Cette famille a-t-elle sa place dans ce mode ?
 *
 * Le jour J ne garde que ce qui sert AU BORD DE LA PISTE : la surveillance, les
 * gestes du jour, le plateau. La structure — réglages, drapeaux, économie,
 * contenus — attend le soir.
 *
 * ELLE N'EST JAMAIS SUPPRIMÉE POUR AUTANT : l'écran la replie. La leçon du hub
 * coach, où filtrer avait rendu deux écrans littéralement inatteignables faute
 * d'autre porte d'entrée.
 */
export function familleVisible(famille: FamilleAdmin, mode: ModeAdmin): boolean {
  if (mode === 'hors-journee') return true;
  return famille !== 'structure';
}

/**
 * Ce que le hub annonce de son propre mode.
 *
 * Sans cette phrase, un administrateur qui cherche ses drapeaux un jour de
 * roulage croit à une panne. Elle ne promet AUCUNE heure de retour : le mode
 * tient tant qu'un pilote roule ou qu'une séance est arrivée aujourd'hui, donc
 * jusqu'à minuit. La même erreur avait été commise côté coach, et un test
 * l'avait verrouillée.
 */
export function phraseMode(mode: ModeAdmin): string | null {
  return mode === 'jour-j' ? 'Journée en cours. La structure est rangée plus bas.' : null;
}

/**
 * Un compte, ou son absence.
 *
 * `null` ne s'écrit JAMAIS « 0 ». Zéro pilote attendu est une mesure ; ne pas
 * avoir pu compter n'en est pas une, et sur un écran de régie la différence
 * décide si l'on ouvre le portail.
 */
export function compteLisible(v: number | null | undefined): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : '—';
}
