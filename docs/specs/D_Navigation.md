# Bloc D — Navigation, Club, Écurie, Vous

*Le bloc le plus vaste en nombre de lignes et le plus pauvre en risque technique. C'est pourtant lui qui décide si le pilote trouve quelque chose quand il cherche seul, sans vous à côté.*

---

## D-1 · Le hub Club — cinq portes

`app/(app2)/club/_layout.tsx` **(à confirmer)** — **hub**

**Les cinq portes, dans cet ordre :** Écurie · Territoire · Services · Fil · Rendez-vous.

**Pourquoi cet ordre.** Par fréquence d'usage réelle, pas par importance supposée. L'Écurie en premier : c'est le seul endroit où quelqu'un revient plusieurs fois par semaine. Les Rendez-vous en dernier : on y va quand on les cherche, jamais par hasard. L'ordre se remesure quand il y aura des données d'usage — pas avant, et surtout pas par intuition.

**Les tiroirs sous chaque porte.** Chacun a deux entrées (voir D-3). Aucun tiroir n'est atteignable par un lien unique.

---

## D-2 · Les quatre écrans du Paddock Pro — tous au Socle

Vous les construisez tous les quatre avant Le Mans. Deux choses avant que Claude Code n'écrive une ligne.

### La confusion qu'il faut lever d'abord

**« Écurie » désigne deux choses différentes, et il ne faut jamais les mélanger.**

| | Ce que c'est | Où |
|---|---|---|
| L'**Écurie OXV** | L'entourage du membre : son coach, son préparateur, son assistant. Un objet personnel, attaché à un compte pilote | `club/ecurie`, `club/membres` |
| L'**écurie professionnelle** | Team FFC : un chef, deux camions, deux pilotes, des droits | **N'existe pas encore.** Spécifiée après Albi (I-4) |

Un développeur qui lit « Membres — rôles typés » juste après avoir lu le dossier des épreuves fondra les deux en un seul modèle. Ce serait une erreur coûteuse : le premier est un carnet personnel, le second est une organisation avec une hiérarchie et des droits. **Le bloc D ne construit que le premier.**

### Les quatre écrans

| Écran | Route | Ce qu'il fait | Ce qu'il suppose |
|---|---|---|---|
| **Membres** | `club/membres.tsx` | Le pilote invite son coach, son préparateur, son assistant ; chaque rôle a ses droits de lecture | `crew_members` avec un rôle typé. `pro_team_members` y est fondu |
| **Journal de réglages** | `vous/garage/reglages.tsx` | Chaque réglage daté, relié aux séances roulées avec | `vehicle_setups` ↔ `laps`. **C'est ici qu'atterrit la photo de la feuille de l'écurie** (A-2 du dossier, I-10) |
| **Dossier vivant** | `vous/dossier.tsx` | Page publique révocable, métrique par métrique, PDF filigrané | Le même mécanisme que le Débrief J+1 (C-1). **Corrigé le 30/08 : ce mécanisme existe** — `app_progression_shares` porte jeton, portée, liste blanche de métriques, expiration, révocation et compteur de vues, avec trois fonctions `SECURITY DEFINER`. Il n'y a plus de décision à prendre, seulement une portée à déclarer |
| **Ambassadeur** | `vous/ambassadeur.tsx` | Candidature et biographie ; publication sur le site quand OXV valide | Rien. C'est le moins cher des quatre |

**Ce que ce choix déplace.** Trois de ces quatre écrans ne servent à aucune des cinq preuves du Mans. Ils viennent après la passerelle, le coach multi-circuit, l'assistant et le lot des écrans dans l'ordre de sacrifice. Si le 12 septembre la passerelle a pris du retard, ce sont les trois premiers de ce tableau qui sautent — Ambassadeur reste, il ne coûte rien.

**Le partage, encore — et la correction du 30/08.** Dossier vivant et Débrief J+1 dépendent du même mécanisme de jeton révocable. J'avais écrit qu'il n'était « pas tranché » et qu'une décision débloquerait les deux. **Le mécanisme est en production** : `app_progression_shares` (`share_token`, `share_scope`, `included_metrics`, `expires_at`, `revoked_at`, `view_count`, `last_viewed_at`) et trois fonctions `SECURITY DEFINER` sur `p_token`. Ce qui reste pour chaque écran : déclarer un `share_scope`, poser sa liste blanche de métriques, et rendre la page. Aucune décision d'architecture.

---

## D-3 · La règle des deux entrées — assouplie, mais comptée

Vous demandez à assouplir la règle pour les tiroirs qui n'ont naturellement qu'une entrée. Je ne l'assouplis pas dans la garde : **je rends les exceptions explicites, datées et finies** — exactement le motif que vous venez de retenir pour les gels (D-4).

**Le mécanisme.** Un fichier `src/lib/deuxEntrees.exceptions.ts` :

```
{ route: 'app/(app2)/…', raison: 'pourquoi une seule entrée suffit ici', jusquau: '2026-12-31' }
```

**La garde `deuxEntrees` fait alors trois choses.** Elle échoue si un écran a une seule entrée **et** n'est pas listé. Elle échoue si une exception n'a pas de raison écrite en français. Elle échoue si la date est passée. Une exception sans date n'est pas une exception, c'est un abandon.

**Ce qui reste interdit.** Une page « index » ou « tout voir » créée pour satisfaire la garde. Elle donnerait deux entrées à tout le monde d'un coup, et l'illusion que le problème de navigation est réglé — alors que personne n'ouvre un plan du site.

**Pourquoi je ne cède pas sur la garde elle-même.** L'inventaire a mesuré 35 orphelins et 16 liens directs. Ils ne sont pas apparus par négligence : ils sont apparus un par un, chacun avec une bonne raison locale. Une liste d'exceptions datées se relit en trente secondes ; une règle assouplie ne se relit jamais.

---

## D-4 · Les sept gels

**Un gel qui ne pourrit pas porte trois choses.**

| | |
|---|---|
| Un déclencheur **nommé** | « premier coach signé », « SIRET obtenu » — pas « quand ce sera prêt » |
| Une date limite | La date à laquelle on décide, même si le déclencheur n'est pas venu |
| Une garde qui casse | `gelsDates.guard` échoue quand une date passe sans décision |

**Les sept gels concernent le commerce coach** et se réveillent avec le SIRET, en janvier 2027. Ils sont donc datés au 31 janvier 2027 : à cette date, ou bien on les allume, ou bien on les retire. Pas de troisième option, et surtout pas de report silencieux.

**Le principe général, qui vaut au-delà de ces sept.** Brancher ou retirer, jamais dormir. Un drapeau sans déclencheur ni date est du code mort déguisé en fonctionnalité à venir — et il coûte à chaque migration, à chaque relecture, à chaque recette.

---

## D-5 · Les retraits

37 entrées retirées, **aucun écran atteignable** du pilote, du coach, de l'admin ou du partenaire. Git garde l'historique ; la branche n'a pas à porter ce que personne n'ouvre.

**La règle de sécurité avant chaque retrait.** Vérifier qu'aucune entrée du registre ne le cite comme appelant. Le registre est la source : si une ligne pointe vers un écran retiré, c'est la ligne qui est fausse, ou le retrait qui l'est.

---

## D-6 · Ce que la navigation doit prouver

| # | Preuve | Comment |
|---|---|---|
| 1 | `modulesOrphelins` transitif = 0 | Garde |
| 2 | `deuxEntrees` vert, exceptions datées et justifiées | Garde |
| 3 | Aucun lien direct | Garde |
| 4 | Chaque porte s'ouvre sur un écran qui n'est pas vide sans raison nommée | Recette, garde `cinqEtats` |
| 5 | Un pilote qui cherche « où sont mes réglages » le trouve en deux gestes | À vérifier sur quelqu'un qui n'a pas construit l'application |
