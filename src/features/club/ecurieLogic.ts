/**
 * L'écurie — la part qui se teste.
 *
 * ===========================================================================
 * CE QUE LA MESURE A TROUVÉ LE 14/08/2026
 * ===========================================================================
 *
 * `crews` et `crew_members` sont en production depuis le 04/07, avec quatre
 * fonctions serveur et une cinquième pour l'annuaire. Mesuré :
 *
 *   • `nameMyCrew` (le baptême)      — **zéro appelant** ;
 *   • `crews_public_rows` (l'annuaire) — **zéro appelant**.
 *
 * Le service `referralService.ts` les expose, testés, corrects. Aucun écran ne
 * les touchait. Une écurie ne pouvait donc pas être nommée, et l'annuaire
 * n'existait nulle part — la garde posée, non armée, pour la troisième fois de
 * la semaine.
 *
 * ===========================================================================
 * LES DEUX RÈGLES DOCTRINALES DE CE MODULE
 * ===========================================================================
 *
 * **L'ordre porte l'information, le numéro déclarerait un verdict.** L'annuaire
 * est trié par nombre de membres, et ne porte AUCUN rang. Le lecteur voit
 * qu'une écurie est plus grande ; il ne lit pas qu'elle est « première ». C'est
 * la même règle que les deux colonnes de comparaison : la position compare, le
 * signe juge.
 *
 * **Aucun chrono nulle part dans l'écurie.** Ce module n'expose aucune durée,
 * aucune vitesse, aucun temps au tour — et un test le vérifie sur l'écran, pas
 * seulement ici.
 */

/** Bornes du baptême, telles que `oxv_name_my_crew` les applique côté serveur. */
export const NOM_MIN = 3;
export const NOM_MAX = 40;

/**
 * Seuil de l'annuaire public, tel que `crews_public_rows()` l'applique :
 * `count(*) filter (where referral_validated or role = 'captain') >= 20`.
 *
 * Il est répété ici pour pouvoir EXPLIQUER l'absence au lecteur, jamais pour
 * filtrer une seconde fois — le filtrage appartient au serveur.
 */
export const SEUIL_ANNUAIRE = 20;

/**
 * Valide un nom d'écurie AVANT l'aller-retour serveur. Rend le message à
 * afficher, ou `null` si le nom convient.
 *
 * Doubler la validation du serveur n'est pas de la défiance : c'est éviter au
 * capitaine d'attendre un refus pour apprendre qu'il a tapé deux lettres.
 */
export function validerNomEcurie(nom: string): string | null {
  const propre = nom.trim();
  if (propre.length === 0) return 'Le nom de votre écurie ne peut pas être vide.';
  if (propre.length < NOM_MIN) return `${NOM_MIN} caractères au minimum.`;
  if (propre.length > NOM_MAX) return `${NOM_MAX} caractères au maximum.`;
  return null;
}

export interface MembreRole {
  userId: string;
  role: string;
}

/** Le lecteur est-il capitaine de son écurie ? Le baptême lui est réservé. */
export function estCapitaine(membres: readonly MembreRole[], userId: string | null): boolean {
  if (!userId) return false;
  return membres.some((m) => m.userId === userId && m.role === 'captain');
}

/** Une ligne d'annuaire, telle que `crews_public_rows()` la rend. */
export interface LigneAnnuaire {
  name: string;
  validated_members: number;
  created_at: string;
}

/**
 * Trie l'annuaire : la plus grande écurie d'abord.
 *
 * **Aucun rang n'est ajouté** — pas d'index, pas de médaille, pas de « 1er ».
 * La fonction serveur ne trie pas (`crews_public_rows` n'a pas d'ORDER BY) :
 * sans ce tri, l'ordre serait celui du planificateur PostgreSQL, c'est-à-dire
 * aucun ordre du tout.
 *
 * Départage à égalité par ancienneté puis par nom, pour que deux lectures
 * successives ne réordonnent pas la liste sous les yeux du lecteur.
 */
export function trierAnnuaire(lignes: readonly LigneAnnuaire[]): LigneAnnuaire[] {
  return [...lignes].sort((a, b) => {
    if (b.validated_members !== a.validated_members) {
      return b.validated_members - a.validated_members;
    }
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
    return a.name.localeCompare(b.name, 'fr');
  });
}

/** « 1 pilote » / « 4 pilotes ». Jamais « 0 pilote » : une écurie a un capitaine. */
export function libelleMembres(n: number): string {
  const borne = Math.max(0, Math.floor(n));
  return borne > 1 ? `${borne} pilotes` : `${borne} pilote`;
}

/**
 * Ce qu'on dit quand l'annuaire est vide.
 *
 * Le dossier de travail le prévoit noir sur blanc : *« avec 43 journées et une
 * poignée de pilotes, l'annuaire public restera vide toute la première
 * saison. »* Une liste vide sans explication se lit comme une panne. On nomme
 * donc la règle plutôt que de laisser le blanc parler — **l'absence n'est
 * jamais un zéro**.
 */
export const ANNUAIRE_VIDE = `Aucune écurie n'a encore atteint ${SEUIL_ANNUAIRE} pilotes confirmés. L'annuaire s'ouvrira quand ce sera le cas.`;
