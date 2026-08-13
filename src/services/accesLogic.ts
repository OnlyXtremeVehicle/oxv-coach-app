/**
 * Qui a le droit d'entrer où — logique PURE, une seule réponse par question.
 *
 * ---
 *
 * POURQUOI CE MODULE EXISTE
 *
 * La base de données et l'application ne répondaient pas la même chose à
 * « ce compte est-il administrateur ? ».
 *
 * Au matin du 28/07/2026, `public.is_admin()` disait
 * `role = 'admin' OR is_admin = true`, quand deux endroits de l'application ne
 * lisaient que **la colonne** : `SpaceSwitcher` (la porte) et le garde de
 * `app/(admin)/_layout.tsx` (le seuil). Deux comptes portaient `role = 'admin'`
 * avec `is_admin = false` : la base leur accordait tout, l'application ne leur
 * montrait pas la porte. Des administrateurs enfermés dehors.
 *
 * L'écart n'a jamais levé d'erreur — il n'y avait rien à lever. L'application
 * était simplement **plus restrictive que la base**, ce qui ne casse rien de
 * visible et ne se voit donc pas.
 *
 * ---
 *
 * DEPUIS LE LOT 8 (OPTION B), LA RÈGLE S'EST SIMPLIFIÉE
 *
 * Migration `20260728161300`, appliquée sur accord du fondateur :
 * `administration@oxvehicle.fr` est passé en `role = 'admin'`, et la fonction ne
 * consulte plus la colonne du tout :
 *
 *     SELECT role = 'admin' FROM public.users WHERE id = auth.uid()
 *
 * Ce module suit, et **le `OR is_admin` a été retiré**. Le garder aurait recréé
 * le même défaut dans l'autre sens : un compte portant la colonne sans le rôle
 * aurait vu la porte, franchi le seuil, puis reçu un refus muet de la RLS à
 * chaque requête. Un échec silencieux derrière une porte ouverte est plus
 * difficile à diagnostiquer qu'une porte fermée.
 *
 * `users.is_admin` est désormais annotée INERTE en base. Ne plus s'en servir.
 *
 * ---
 *
 * CE QUE CE MODULE NE FAIT PAS
 *
 * Il n'accorde aucun droit. La barrière reste la RLS — le dépôt est public, et
 * c'est elle qui décide. `estAdmin` ne fait que **reproduire fidèlement** la
 * règle que la base applique déjà, pour que l'interface cesse de la contredire.
 *
 * Toute divergence future se répare ici, pas dans un écran.
 */

import type { UserRole } from '@/store/useAuthStore';

/**
 * La part du profil qui décide de l'accès : le rôle, et lui seul.
 *
 * `is_admin` a été retiré du type le 14/08, avec la colonne. Le laisser
 * facultatif aurait invité à s'en resservir, et ce champ ne pourrait plus
 * qu'être `undefined` — c'est-à-dire mentir par omission plutôt que par valeur.
 */
export interface ProfilAcces {
  role: UserRole;
}

/**
 * Miroir exact de `public.is_admin()` : le rôle, et lui seul.
 *
 * Ne pas réintroduire un repli sur `is_admin`. La colonne est inerte en base
 * depuis le 28/07/2026 : un compte qui la porterait sans le rôle passerait la
 * porte de l'application et se ferait refuser en silence par la RLS.
 */
export function estAdmin(profil: ProfilAcces | null | undefined): boolean {
  return profil?.role === 'admin';
}

/**
 * Miroir exact de `public.is_coach()` — `role = 'coach'`, sans repli.
 *
 * Noté pour que la question ait, elle aussi, une seule réponse dans le dépôt.
 */
export function estCoach(profil: ProfilAcces | null | undefined): boolean {
  return profil?.role === 'coach';
}

/**
 * Le sélecteur d'espace n'a de sens que pour un compte qui en a plusieurs.
 *
 * Aujourd'hui c'est l'administrateur : il voit les trois espaces. Un coach seul
 * n'a rien à choisir — il est dans le sien.
 */
export function peutChangerEspace(profil: ProfilAcces | null | undefined): boolean {
  return estAdmin(profil);
}
