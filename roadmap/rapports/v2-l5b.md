# Rapport — LOT V2-L5-B · coach_reviews → coach_testimonials (décision fondateur)

Date : 19/07/2026 · Décision fondateur : remplacer les avis notés (note 1-5) par
des **témoignages** — citations factuelles (texte + auteur), ZÉRO note/score/
échelle/étoile. L'ancien `coach_reviews.rating` NOT NULL forçait un `3` neutre
fabriqué à chaque avis ; il disparaît.

---

## Livré

### Backend (prod, `fouvuqkdxarjpjbqnsjq`)
- **Migration `20260719170000`** : `coach_testimonials` (id, coach_id,
  author_user_id, author_first_name, body borné 1-1500, published, created_at ;
  unique(coach_id, author_user_id)). RLS **dans la même migration** (fail-closed) :
  author écrit/lit son own-row **si** séance acceptée/complétée réelle (garde
  anti-faux-témoignage) ; coach lit ses publiés ; pilote en découverte lit les
  publiés d'un coach publié ; admin tout. **Aucun agrégat exposé.** Puis
  `drop table coach_reviews` (0 ligne, 0 FK entrante, 0 vue → cru « propre »).
- **`author_first_name`** ajouté au-delà de la liste stricte du fondateur : c'est
  la moitié « auteur » de la citation (texte + auteur) qu'il a demandée.

### Code (service + logique + 4 écrans)
- `coachMarketplaceService` : `createTestimonial` / `listCoachTestimonials`
  (sans moyenne) / `getMyTestimonialFor` ; types de note supprimés.
- `coachingLogic.testimonialCitations`, `useCoaching` (fiche + submit sans `3`).
- v1 `coach/[id].tsx` : `RatingDots` + moyenne /5 retirés → citations texte.
- v1 `mes-demandes.tsx` : formulaire 1-5 retiré → témoignage texte requis.
- Types régénérés (`database.types.ts` : bloc coach_reviews → coach_testimonials).

### Garde-fou automatisé (demandé par le fondateur)
- `coachDomainNoScore.test.ts` : parcourt **toute entrée `coach*`** du contrat de
  types (tables, vues ET fonctions tabulaires via `Returns:`) et **échoue** si une
  colonne `rating`/`score`/`stars` (par le nom) ou une `note` **numérique** (grade)
  réapparaît. Nuance : une `note` **texte** (annotation légitime, ex.
  `coach_pilot_highlight.note`) reste permise. Filet numérique en plus
  (avg_rating, note_globale, …). Assère aussi coach_testimonials présent /
  coach_reviews absent.

## Vérification adversariale — 5 findings survivants, TOUS corrigés
La revue (5 dim × 3 lentilles, agents ayant interrogé la prod en lecture) a
attrapé une **régression critique en production** que mon DROP avait causée :
Postgres **ne suit pas** les références depuis un corps PL/pgSQL (contrairement
aux FK/vues), donc `drop coach_reviews` a réussi en silence et orphelin **deux**
corps :

1. **[CRITIQUE] `purge_user_data()`** faisait encore `delete from coach_reviews`
   → 42P01 → la **purge RGPD art.17 avortait ENTIÈREMENT** (rollback). Cron jobid 9
   → edge v5 → cette RPC est câblé en prod. **Hotfix `20260719180000`** :
   repointé sur `coach_testimonials` (auteur OU coach), ce qui **couvre aussi** →
2. **[MAJEUR] Trou de purge du nouveau schéma** : le CASCADE des FK ne se
   déclenche jamais (la purge **anonymise** la ligne users, ne la supprime pas), et
   rien ne supprimait explicitement les témoignages → `author_first_name` + `body`
   (données perso) **survivaient à la suppression de compte**, publiquement
   lisibles. Le même `delete coach_testimonials` de la purge corrige les deux.
3. **[MAJEUR] `moderation_validate_target()`** faisait `select 1 from
   coach_reviews` → signaler un témoignage levait un **42P01 brut** chez le pilote.
   Repointé sur `coach_testimonials`.
4. **[durcissement]** les 4 policies passent **`TO authenticated`** (l'anon ne lit
   plus `author_first_name`/`body` via la clé anon).
5. **[garde-fou]** parseur élargi aux `Returns:` (une RPC coach ne peut plus
   exposer une note en douce).

**Hotfix appliqué en prod + vérifié** : 0 statement `from public.coach_reviews`
restant dans les deux corps ; probe `purge_user_data(uuid-zéro)` sans 42P01 ;
policies = `{authenticated}`. Corps re-émis à l'identique (pg_get_functiondef),
seules les lignes coach_reviews changées.

Findings écartés par la vérif : vocabulaire banni « incomplet » (rank/avg/count…)
— 0/3, hors spec fondateur + faux positifs (lap_count, points fidélité).

## Leçon
Un DROP « propre » vérifie FK **et vues** — mais **pas** les corps de fonctions/
triggers, que Postgres ne recense pas comme dépendances. À l'avenir : grep du nom
de table dans `pg_proc.prosrc` avant tout DROP.

## Preuves
- **tsc 0 · eslint 0 · jest 1680 · cardinal capture VIDE (0 diff)** · garde-fou
  8 assertions vertes · prod : advisors inchangés, purge OK, policies durcies.

## Suite
[SMOKE TEST TERRAIN] (frames réelles) puis **L3 DATA** (demandé par le fondateur).
