# Coordination site ↔ app — nom public partagé (`users.public_handle`)

> Note courte à destination du repo du site (oxv-site). Base Supabase commune :
> le site et l'app lisent et écrivent la MÊME colonne.

## La source unique

- **Colonne** : `users.public_handle TEXT UNIQUE` (index `idx_users_public_handle`).
- C'est **LA** source du pseudo partagé : le même nom suit le pilote sur
  oxvehicle.fr et dans l'app. Le site doit lire, afficher et éditer **ce champ**,
  pas une copie locale.
- Le préfixe `@` est un habillage d'affichage. Il n'est **jamais stocké**.

## Unicité — par la contrainte, pas par pré-vérification

- L'unicité est garantie par la contrainte `UNIQUE` de la colonne. **Ne pas**
  faire de `SELECT` de vérification préalable : c'est racé (deux clients peuvent
  passer la vérification puis entrer en collision).
- Un `INSERT`/`UPDATE` qui viole la contrainte renvoie l'erreur Postgres
  **`23505`** (`unique_violation`). C'est la vérité. Côté UI, la rendre :
  **« Ce nom est déjà pris. »** (message identique dans l'app).

## Règles de validation — identiques des deux côtés

Recopiées de `src/utils/validation.ts` (app) — à reprendre telles quelles :

```ts
export const HANDLE_REGEX = /^[a-z0-9_-]{3,20}$/;

export function isValidHandle(handle: string): boolean {
  return HANDLE_REGEX.test(handle.trim().toLowerCase());
}
```

- **Normalisation avant validation ET écriture** : `trim()` puis minuscules
  (la base stocke la forme minuscule). Retirer un éventuel `@` saisi.
- **Format** : 3 à 20 caractères, parmi `a-z`, `0-9`, `-`, `_`.

## Comportements côté app (état actuel)

- Édition dans l'écran Profil pilote (`app/(app)/profil.tsx`). Si le pilote n'a
  pas encore de nom (`public_handle IS NULL`), une invite visible propose
  « Choisissez votre nom public », avec l'explication « Le même nom vous suit
  sur oxvehicle.fr et dans l'app. »
- **Pas d'étape d'onboarding dédiée** pour l'instant (choix assumé, hors
  périmètre : l'invite dans Profil suffit ; à réévaluer plus tard).
- L'app ne propose **pas de retirer** un nom choisi, seulement de le remplacer.
  Si le site souhaite permettre la remise à `NULL`, coordonner d'abord (des
  affichages des deux côtés reposent sur ce champ).
- La recherche par nom côté app est insensible à la casse (`ilike`) — voir
  `findUserByPublicHandle` dans `src/services/friendshipsService.ts`. Tant que
  l'écriture est normalisée en minuscules des deux côtés, tout reste cohérent.
