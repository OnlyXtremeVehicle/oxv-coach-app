/**
 * Logique pure du DetailLevel (séparée du hook React pour être testable
 * sans dépendre de Supabase ni du store auth).
 */

export type DetailLevel = 'simple' | 'detailed';

type Role = 'pilot' | 'coach' | 'admin' | 'partner' | 'pro_pilot' | null | undefined;

/**
 * Le coach a le mode détaillé par défaut : besoin professionnel des chiffres
 * exacts. Tous les autres, administrateur compris : mode simple.
 *
 * ---
 *
 * L'ADMINISTRATEUR A ÉTÉ RETIRÉ DE CETTE RÈGLE
 *
 * Ces deux fonctions traitaient `admin` comme `coach`. Sur les écrans PILOTE
 * (`settings`, `stats`, `tours`, `replay`), un compte administrateur recevait
 * donc les chiffres bruts **et perdait le commutateur** — `canToggleForRole` ne
 * consulte aucune préférence, le bouton n'est simplement plus dessiné.
 *
 * Autrement dit : pas de retour possible vers la lecture simple. C'est le
 * principe 5 — un seul chiffre par écran — qu'on ne pouvait plus retrouver.
 *
 * Un administrateur qui roule est un pilote. Il administre sur d'autres écrans,
 * dans un autre espace. Le besoin professionnel des chiffres exacts est celui du
 * coach pendant qu'il lit la séance d'un autre ; il n'est pas celui de
 * l'administrateur pendant qu'il lit la sienne.
 *
 * Ce correctif conditionne le lot 8, option B : sans lui, faire passer
 * `administration@oxvehicle.fr` en `role = 'admin'` lui aurait imposé le mode
 * détaillé, sans retour, sur quatre écrans. C'était le SEUL coût réel de
 * l'option B — deux lignes, pas un lot de séparation de comptes. Voir
 * `supabase/migrations/PROPOSITION_L8_role_autorite.sql`.
 */
export function defaultLevelForRole(role: Role): DetailLevel {
  return role === 'coach' ? 'detailed' : 'simple';
}

/**
 * Tout le monde peut basculer le mode, sauf le coach — fixé sur détaillé pour
 * qu'il ne passe pas accidentellement en simple au milieu d'une lecture.
 */
export function canToggleForRole(role: Role): boolean {
  return role !== 'coach';
}
