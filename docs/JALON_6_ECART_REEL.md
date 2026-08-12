# Jalon 6 — l'écart réel

*Cartographie du 12/08/2026. Six tranches confrontées au code, puis un
contradicteur sur chaque constat « fait ». **65 exigences · 14 faites, dont 10
réfutées · 17 mortes · 16 absentes · 18 partielles.***

---

## Ce que « mort » veut dire, et pourquoi il y en a dix-sept

Une exigence est **morte** quand le code existe, qu'il est correct, que ses
tests sont verts — et qu'il ne peut **rien produire en production**. Ni bogue,
ni oubli : une chaîne complète dont un maillon n'a jamais été alimenté.

C'est le motif dominant de ce dépôt, et le jalon 6 en est saturé. Deux exemples
corrigés aujourd'hui donnent la mesure :

- l'écran Pass lisait `event_registrations`, **table à zéro ligne, jamais
  écrite** — il annonçait « aucune inscription » à des pilotes qui avaient payé ;
- `resoudreMarqueur` recevait `[]` pour les cordes de ses **deux** appelants :
  `virage` valait toujours `null`, quel que soit le geste du coach.

Le second est corrigé (commit `0a9db87`). Le reste tient à cinq verrous, et
**quatre d'entre eux ne sont pas à moi.**

---

## 1 · Aucun compte coach n'existe

```
select role, count(*) from users group by role
→ pilot 10 · admin 3 · partner 1 · coach 0        (14 comptes)
```

`app/(coach)/_layout.tsx:48` renvoie hors de l'espace quiconque n'a pas
`role = 'coach'`. **Les trente-quatre écrans coach sont donc inatteignables par
tous les comptes existants**, sans exception.

Ce seul fait rend intestables : le fil de séance, la file de lecture, le hub à
deux modes, le liseré rouge, la carte de séance, la facturation, l'espace live.
Il explique à lui seul six des dix réfutations.

L'unique ligne de `coach_pilots` ne sauve rien : son côté coach est occupé par
un compte `role = 'admin'`, et elle porte `active = false`, `status = 'pending'`,
`live_sharing_at = NULL`. `is_detailed_coach_of` échoue sur **trois de ses
quatre conditions**.

**Geste attendu — vous seul.** Passer un compte en `role = 'coach'`, comme vous
l'avez fait pour `partner` en juillet, puis activer le binôme coach-pilote. Sans
cela, le jalon 6 ne peut pas être accepté, quel que soit le code écrit.

---

## 2 · Le fil ne peut pas se remplir en temps réel

L'acceptation n° 1 du jalon demande : *« le fil se remplit-il en temps réel
pendant un run ? »*. Trois blocages indépendants, **chacun suffisant** :

**a. L'écran ne s'abonne à rien.** `fil.tsx:237-261` charge une fois, et se
rafraîchit par un compteur manuel. Aucun `.channel(`, aucun `postgres_changes`.

**b. La table des événements n'est pas diffusée.** Vérifié en production :

```
select tablename from pg_publication_tables where pubname='supabase_realtime'
→ telemetry_sessions · coach_annotations
```

`laps` — que `filSeanceService.ts:14` désigne comme *« les SEULS vrais
événements datés »* — n'y est pas. Un abonnement passerait `SUBSCRIBED` et ne
recevrait jamais rien.

**c. Les tours ne sont écrits qu'à la clôture.** `captureSessionService.ts:792`
met les tours en file à l'étape d'ARRÊT de la capture. Aucun tour n'atteint la
base avant que le pilote ne rentre.

**Ce que je peux faire :** (a), sans réserve. **Ce qui vous revient :** (b), une
migration de publication — et (c), qui touche **deux fichiers protégés**
(`captureSessionService.ts`, `captureSyncQueue.ts`). Leur commentaire
`captureSyncQueue.ts:606-615` raconte une régression déjà vécue — douze tours
affichés vingt-quatre, deux `is_best_lap` vrais. Émettre par tour multiplie les
rejeux, donc les occasions de la reproduire. **Je ne touche pas à ces fichiers
sans votre accord explicite.**

---

## 3 · Sept drapeaux éteints, dont un qui affirme le contraire

```
select key, enabled from app_feature_flags
→ app_payments, biometry, coach_billing, convoys, founders,
  pilot_waivers, video_overlay : tous false
```

Tous horodatés **à la même minute, le 2026-08-03 12:14** — signature d'un
ré-amorçage global.

Et la description de `biometry`, en base, dit ceci :

> « **Levé le 2026-07-25 sur décision fondateur**, après validation avocat du
> consentement. »

**Une décision que vous avez prise, documentée dans la ligne elle-même, a été
défaite en silence par un ré-amorçage neuf jours plus tard.** La ligne se
contredit : sa description affirme l'inverse de sa valeur.

Je ne rallume pas un drapeau qui porte sur des données de santé. **C'est votre
geste**, et il mérite d'être posé en connaissance de ce qui l'a éteint.

---

## 4 · L'effacement RGPD d'un membre fondateur lèverait une erreur

`purge_user_data` porte, en production :

```sql
update public.founding_members
   set prenom = null, nom = null, email = null, user_id = null
 where user_id = $1
```

Les trois colonnes sont **NOT NULL** depuis leur création et ne l'ont jamais
cessé. L'UPDATE lèverait `23502`, et **la purge entière échouerait** — la
fonction n'a pas de bloc d'exception autour de ce bras.

**Le défaut ne se déclenche pas aujourd'hui** : `founding_members` compte une
ligne, son `user_id` est nul, zéro ligne correspond. Il se déclenchera au
**premier rattachement d'une candidature à un compte** — c'est-à-dire
exactement ce que la phase 5bis du jalon 6 demande de construire.

**Livrer la phase 5bis sans ce correctif, c'est armer une purge RGPD qui
échoue.** Un pilote exerçant son droit à l'effacement recevrait une erreur, et
ses données resteraient en place.

Correctif rédigé : `supabase/migrations/PROPOSITION_J6_founding_members_effacement.sql`.
Non horodaté, donc ignoré par `supabase db push`. Il relâche une contrainte —
DDL non additive, hors de ce que je m'autorise seul.

---

## 5 · Le marquage pilote passe par un stub déclaré

L'acceptation n° 2 demande : *« un marqueur posé sur les LUNETTES se résout-il
correctement ? »*.

`src/ble/flic2Service.ts:4` porte la mention « V1 STUB intentionnel ». `scan()`
n'écoute aucun périphérique ; un `setTimeout` repasse l'état à `idle`. Son
unique consommateur, `initFlic.ts:29`, ne reçoit donc jamais de clic.

**Matériel.** Rien de logiciel ne débloque cette acceptation.

---

## Ce qui a été corrigé aujourd'hui, malgré tout

| Défaut | Où |
|---|---|
| Le marqueur ne pouvait trouver aucun virage — `cordes: []` chez ses deux appelants | `0a9db87` |
| Les cordes de tous les circuits, dérivées ou relevées, avec l'inverse de projection testé au centimètre | `0a9db87` |
| Deux tests de garde qui lisent les appelants, pour que le tableau vide ne revienne pas | `0a9db87` |

---

## Ce qui reste écrivable sans vous, et que j'attaque ensuite

- L'abonnement temps réel dans `fil.tsx` — inerte tant que `laps` n'est pas
  publiée, mais **il ne doit annoncer « en direct » qu'après RÉCEPTION** d'un
  événement, jamais sur le seul statut `SUBSCRIBED`.
- `useCoachThread.ts:1-7` affirme « un nouveau message apparaît sans refetch » :
  `coach_messages` n'est pas publiée. Le texte ment, le canal dort.
- La phrase de consentement, qui doit dire la comparaison d'élèves.
- La suppression de `payment_link` et de `coach_testimonials`.
- L'absorption des quatre écrans par le fil — **sous réserve** : supprimer un
  écran maquetté relève de votre validation (CLAUDE.md).

---

## Le constat qu'il faut regarder en face

Le jalon 6 n'est pas en retard parce que le code manque. **Il est en retard
parce que rien de ce qu'il produit n'a jamais pu être exercé.** Quatre de ses
quatre critères d'acceptation dépendent de conditions extérieures au code : un
compte, une publication, un drapeau, un boîtier.

Écrire davantage de code coach avant de lever le premier verrou reviendrait à
ajouter des étages à ce qui est déjà mort.
