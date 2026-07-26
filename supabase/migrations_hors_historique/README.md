# Migrations retirées du chemin d'application

**Ne remettez aucun de ces fichiers dans `supabase/migrations/`.**

Ce dossier n'est pas lu par la CLI Supabase. Les fichiers qu'il contient ont été
écrits comme migrations, mais aucun ne doit être appliqué : leur contenu est déjà
passé en base sous un autre nom, et trois d'entre eux **dégraderaient la
production** s'ils étaient rejoués aujourd'hui.

Ils sont conservés — et non supprimés — parce qu'ils documentent une intention et
qu'un lecteur pourrait autrement les réécrire de bonne foi.

Vérifié le 26 juillet 2026 contre l'état réel du schéma en production
(`fouvuqkdxarjpjbqnsjq`), objet par objet, pas seulement contre les migrations.

---

## `20260719_sec1_purge_sante.sql` — le plus grave

Il redéfinit `public.purge_user_data(uuid)`, la fonction qui exécute le droit à
l'effacement.

La version en production descend bien de ce fichier, mais elle a été **étendue
depuis** (`be1_purge_extend`, puis la refonte des témoignages). Elle purge
aujourd'hui `coach_testimonials`, `video_overlays`, `founder_applications`,
`convoy_participants`, `convoys`, et efface deux consentements biométriques
supplémentaires sur `users`. Le fichier local ignore tout cela.

Pire : il contient `delete from public.coach_reviews`, or **cette table n'existe
plus**. Comme le corps d'une fonction PL/pgSQL n'est pas résolu à sa création, le
`create or replace function` **réussirait sans broncher**, écraserait la version
courante, et la purge ne casserait qu'au premier effacement réel demandé par un
pilote — transaction annulée en bloc, droit RGPD inopérant.

Un fichier qui s'applique proprement et casse une obligation légale plus tard est
exactement le genre de piège qu'un dossier de migrations ne doit pas contenir.

## `20260614120000_secure_sessions_public_calendar.sql` — dangereux

Il supprime puis recrée la vue `public.sessions_public`. Or cette vue a été refaite
deux fois depuis : `sessions_public_circuit` lui a ajouté `circuit_id` et
`circuit_name`, puis le lot SEC-1 A l'a convertie en `security_invoker = true`
alimentée par la fonction `sessions_public_rows()`.

Le rejouer produirait une vue à 18 colonnes au lieu de 20, en `security_invoker =
false`, lisant `sessions` en direct **sans filtre `is_private`**. Conséquences :
le multi-circuits du site casse, les journées privatisées réapparaissent dans le
calendrier public, le durcissement SEC-1 est annulé et `sessions_public_rows()`
reste orpheline. Aucun objet ne dépend de la vue, donc le `DROP` passerait sans la
moindre résistance — c'est ce qui rend l'opération silencieuse.

## `20260615183000_sessions_public_exclude_private_rows.sql` — dangereux

Même vue. Son apport réel, la clause `WHERE is_private IS NOT TRUE`, est déjà en
production dans le corps de `sessions_public_rows()`.

Appliqué tel quel il **échouerait** (`CREATE OR REPLACE VIEW` ne peut pas retirer
de colonnes). Le danger n'est pas là : il est dans l'opérateur qui, devant cette
erreur, le convertirait en `DROP VIEW` puis `CREATE VIEW` — et retomberait
exactement sur la dégradation décrite ci-dessus.

## `20260719122000_sec1_c_payout.sql` — doublon inoffensif

Appliqué mot pour mot sous `20260719011137_sec1_c_coach_payout_details`, qui cite
d'ailleurs ce fichier comme source. `public.coach_payout_details` existe avec ses
six colonnes, RLS active, ses deux policies, son trigger, et aucun droit accordé à
`anon` ni à `PUBLIC` — ce qui compte, s'agissant de coordonnées bancaires.

Le rejouer échouerait dès le `create table` (pas de `IF NOT EXISTS`), sans effet de
bord. Il est ici pour ne pas laisser croire qu'il resterait à appliquer.

---

## Ce que cet épisode enseigne

Un fichier présent dans `supabase/migrations/` est lu comme « à appliquer ». Trois
de ces quatre-là portaient un en-tête rassurant — l'un affirmait même « PRÉPARÉE,
NON APPLIQUÉE, approbation fondateur requise », mention devenue fausse depuis
longtemps. **Un commentaire ne protège pas une base de production ; seule la place
du fichier le fait.**

D'où la règle retenue : ce qui ne doit pas être appliqué ne reste pas dans le
dossier des migrations.
