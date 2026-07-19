# Crews / parrainage — état prod (inspection MCP BE-1, 2026-07-19)

> Inspection lecture seule de `fouvuqkdxarjpjbqnsjq` avant la migration BE-1.
> **Conclusion : le système A3 (parrainage + écuries) existe DÉJÀ en prod.**
> BE-1 NE recrée RIEN — `referralService` s'adosse aux fonctions existantes.

## Tables existantes (ne pas recréer)

### `public.crews`

| colonne    | type                 | note                                         |
| ---------- | -------------------- | -------------------------------------------- |
| id         | uuid PK              | `gen_random_uuid()`                          |
| captain_id | uuid NOT NULL        | le capitaine (parrain fondateur de l'écurie) |
| name       | text NULL            | nommée après coup via `oxv_name_my_crew`     |
| named_at   | timestamptz NULL     |                                              |
| created_at | timestamptz NOT NULL |                                              |

### `public.crew_members`

| colonne            | type                 | note                     |
| ------------------ | -------------------- | ------------------------ |
| crew_id            | uuid NOT NULL        |                          |
| user_id            | uuid NOT NULL        |                          |
| role               | text NOT NULL        | `'member'` / `'captain'` |
| referred_by        | uuid NULL            | qui a parrainé ce membre |
| referral_validated | boolean NOT NULL     | défaut false             |
| joined_at          | timestamptz NOT NULL |                          |

### RLS en place

- `crews_select_member` : `is_admin() OR id = oxv_my_crew_id()` (SELECT).
- `crews_admin_all`, `crew_members_admin_all` : admin (ALL).
- `crew_members_select_own_crew` : `is_admin() OR crew_id = oxv_my_crew_id()` (SELECT).
- **Aucune policy INSERT/UPDATE membre** : toute mutation passe par la fonction
  SECURITY DEFINER `oxv_redeem_referral` (fail-closed par construction).

## Fonctions existantes (à appeler depuis `referralService`)

| Fonction                           | Signature | Rôle                                                                                                                                                                                                           |
| ---------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ---------------------- | ------------------ |
| `oxv_get_my_referral_code()`       | → text    | Renvoie `users.affiliation_code` (le code A3), le génère si absent (format `OXV-{PRENOM8}-{4hex}`).                                                                                                            |
| `oxv_redeem_referral(p_code text)` | → jsonb   | Rattache l'appelant à l'écurie du parrain : crée l'écurie si besoin (parrain = capitaine), insère l'appelant en `member` avec `referred_by`. Renvoie `{ok:true, crew_id}` ou `{ok:false, error:'code_invalide' | 'auto_parrainage_interdit' | 'deja_dans_une_ecurie' | 'auth_required'}`. |
| `oxv_my_crew_id()`                 | → uuid    | L'écurie de l'appelant (NULL si aucune).                                                                                                                                                                       |
| `oxv_name_my_crew(p_name text)`    | → jsonb   | Nomme l'écurie de l'appelant.                                                                                                                                                                                  |

**Le code de parrainage EST `users.affiliation_code`** (pas de colonne
`referral_code` séparée à créer — livrable 5 points 2/3 du prompt BE-1 déjà
couverts par l'existant). Fonctions `get_or_create_my_affiliation_code` /
`redeem_affiliation_code` / `rotate_my_affiliation_code` : ancien système de
parrainage coach↔pilote (amitiés), distinct des écuries — non touché par BE-1.

## Écart BE-1 réel

- **crews / crew_members** : EXISTANTS → `referralService` s'y adosse. ✅
- **convoys / convoy_participants** : ABSENTS → créés par BE-1 (livrable 5.4).
- `scenic_routes` (routes belles) : EXISTANT (colonnes `id, user_id, name,
geometry, status, certified_*…`) → `convoys.route_id` y référence.
