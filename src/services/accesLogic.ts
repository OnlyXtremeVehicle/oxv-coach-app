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
 * Côté base, `public.is_admin()` — la fonction qu'appellent **167 policies sur
 * 93 tables** — dit :
 *
 *     SELECT role = 'admin' OR is_admin = true FROM public.users WHERE id = auth.uid()
 *
 * Côté application, deux endroits lisaient **la seule colonne `is_admin`** :
 * `SpaceSwitcher` (la porte) et le garde de `app/(admin)/_layout.tsx` (le seuil).
 *
 * Conséquence constatée en production le 28/07/2026 : deux comptes portent
 * `role = 'admin'` avec `is_admin = false`. La base leur accorde **tout** ;
 * l'application ne leur montre pas la porte et les refoule si elles l'atteignent
 * autrement. Des administrateurs enfermés dehors.
 *
 * L'écart n'a jamais levé d'erreur — il n'y avait rien à lever. L'application
 * était simplement **plus restrictive que la base**, ce qui ne casse rien de
 * visible et ne se voit donc pas.
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

/** La part du profil qui décide de l'accès. Rien d'autre n'est nécessaire. */
export interface ProfilAcces {
  role: UserRole;
  is_admin: boolean;
}

/**
 * Miroir exact de `public.is_admin()`.
 *
 * Le `OR` n'est pas une largesse : c'est la règle en vigueur dans la base. Un
 * `AND`, ou la seule colonne, refoulerait des comptes que la RLS admet.
 */
export function estAdmin(profil: ProfilAcces | null | undefined): boolean {
  if (!profil) return false;
  return profil.role === 'admin' || profil.is_admin === true;
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
