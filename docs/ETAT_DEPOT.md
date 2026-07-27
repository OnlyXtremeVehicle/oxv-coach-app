# État du dépôt — constat avant sauvegarde

**27 juillet 2026** · Jalon 0.1, étape 1 · **Lecture seule : rien n'a été modifié, commité, poussé ni supprimé.**

Dépôt local `oxv-app` · distant `git@github.com:OnlyXtremeVehicle/oxv-coach-app.git` · branche `feat/site-document-emails`.

---

## Le fait qui commande la décision

**Le dépôt distant est public.** `gh repo view` retourne `"visibility":"PUBLIC"`.

Le plan de montage ne le mentionne nulle part. Il prescrit « pousser » à l'étape 4 sans poser la question de la visibilité, et sa règle d'arrêt ne porte que sur les secrets. Or **pousser sur un dépôt public n'est pas une sauvegarde : c'est une publication**, et l'historique Git d'un dépôt public est indexé, cloné et mis en cache par des tiers. Il ne se reprend pas.

Ce qui suit établit ce que la publication ajouterait.

---

## 1 · Le volume réel : 149, non 130

Le dossier annonce « cent trente commits ne sont pas poussés » et propose la mesure `git log origin/main..HEAD`. Cette mesure est inexacte pour deux raisons : elle compte des commits déjà sauvegardés sur d'autres branches distantes, et elle ignore les branches locales sans distant.

La mesure juste est **ce qui n'est atteignable depuis aucune référence distante** :

```
git log --oneline --all --not --remotes | wc -l   →  149
git log origin/main..HEAD --oneline | wc -l       →  264   (mesure du dossier, surévaluée)
```

**149 commits, du 13 juin au 26 juillet 2026** — six semaines de travail.

| Branche | Commits hors distants | Suivi |
|---|---|---|
| `feat/site-document-emails` | **143** | `[ahead 143]` |
| `claude/trusting-albattani-d94548` | **2** | distant **supprimé** (`[gone]`) |
| `feat/site-booking-fiable` | **1** | **aucun distant** |
| `feat/site-transactional-emails` | **1** | **aucun distant** |
| remise (`stash@{0}`) | **2 objets** | hors branche |

Les cinq autres branches `claude/*` sont **entièrement contenues** dans `feat/site-document-emails` : elles ne portent aucun travail propre et ne demandent aucune sauvegarde séparée.

`main`, `refonte` et `gaming` sont à zéro hors distants : leurs commits, bien qu'en avance sur `origin/main`, sont déjà sauvegardés ailleurs.

### Les quatre commits isolés

Ce sont eux qui disparaîtraient sans que personne le remarque, la branche de travail concentrant l'attention :

| Commit | Objet |
|---|---|
| `45ad19e` | contrainte unique partielle sur `registrations` — anti-doublon, réinscription après annulation |
| `772d059` | edge functions et déclencheurs transactionnels du site — réservation, paiement, notification admin |
| `f60bbd2` | correctifs prettier bloquant l'intégration continue de la PR #76 |
| `bffaaeb` | bilan — héros « fait saillant », correctifs de doctrine, réconciliation des spécifications v2 |

### La remise

`stash@{0}` — « SEC-1 : reformatage prettier accidentel des docs historiques (récupérable) ». Le libellé dit lui-même qu'il s'agit d'un artefact, non de travail. **À vider, non à sauvegarder.**

---

## 2 · Non commité

```
?? docs/INVENTAIRE_ECRANS.md
?? docs/T0_reconnaissance.md
?? docs/VERIFICATIONS_V3.md
```

Trois documents non suivis, produits le 26 juillet. **Aucune modification en attente sur un fichier suivi.** L'arbre de travail est propre.

---

## 3 · Contrôle de secrets — la règle d'arrêt n'est pas déclenchée

Balayage des lignes ajoutées par les 149 commits, sur matière de secret réelle : JWT, `sb_secret_`, clés Stripe, clés privées, affectations de `service_role`, valeurs de plus de vingt caractères assignées à `api_key`, `secret`, `password` ou `token`.

**Une seule occurrence**, dans `supabase/migrations/20260718133742_fix_relay_validate_inscription_jwt.sql:35` :

```sql
anon_jwt CONSTANT TEXT := 'eyJhbGciOi…';
```

**Ce n'est pas un secret.** C'est la clé **anon** du projet `fouvuqkdxarjpjbqnsjq`, publique par construction dans le modèle Supabase, et la migration le documente en clair à la ligne 33. Elle sert uniquement à franchir `verify_jwt` sur l'edge function. **L'autorisation réelle est `x-oxv-admin-secret`, lue depuis le Vault à l'exécution** (`oxv_get_secret`) et absente du fichier.

Le fichier est l'une des 94 migrations reconstituées depuis la production le 26 juillet. Le SQL est celui qui a réellement tourné.

**Réserve.** La clé anon n'est publique sans conséquence **que si la RLS est saine**. C'est le lien à retenir pour la section 5.

**Contradiction relevée.** `BILAN_COMPLET_OXV.md` affirme « JWT anon en dur repo entier | Aucun (`eyJhbGciOi` : 0 hit) ». Cette affirmation était vraie à sa rédaction et **est devenue fausse** avec la reconstitution des migrations. Elle deviendrait publiquement fausse au push.

---

## 4 · `.gitignore` — quatre gardes sur huit sont absentes

| Motif | État |
|---|---|
| `.env`, `.env.local` | couverts |
| `*.p8`, `*.p12` | couverts |
| `google-services.json` | **non couvert** |
| `GoogleService-Info.plist` | **non couvert** |
| `*.mobileprovision` | **non couvert** |
| `*.keystore` | **non couvert** |

**Aucun fichier de ce type n'est suivi aujourd'hui** — seul `.env.example` l'est, ce qui est sa fonction. Il n'y a donc pas de fuite. Mais la garde n'existe pas : un fichier de signature déposé dans l'arbre partirait au prochain `git add`.

---

## 5 · Ce que la publication ajouterait

Le schéma est **déjà public** : 78 migrations sur `origin/main`, 96 sur `origin/feat/site-document-emails`. Le push n'aggrave donc pas l'exposition du schéma.

Il ajoute **167 fichiers, +6 781 lignes**, dont le registre complet des migrations appliquées en production (229 lignes) et **quatorze documents d'audit et d'état** :

```
BILAN_COMPLET_OXV.md
CONNEXIONS_ET_AUTOMATISATIONS.md
ETAT_APP_OXV_MIRROR.md
design-retours/programme-v2/OXV_V2_AUDIT_EXHAUSTIVITE_SECURITE.md
design-retours/programme-v2/PROMPT_CLAUDE_CODE_SEC1_SECURITE.md
docs/ETAT_APP_2026-07-26.md
docs/ETAT_COMPLET_APP_2026-07-26.md
docs/architecture/09_HANDOFF_SITE_BASE_PARTAGEE.md
docs/architecture/10_DOSSIER_CONNEXIONS_APP_SITE.md
docs/architecture/13_BE1_ETAT.md
docs/architecture/17_CI_RLS_SETUP.md
…
```

**Le point dur.** `docs/ETAT_COMPLET_APP_2026-07-26.md` porte, vérifié ligne à ligne :

| Ligne | Contenu |
|---|---|
| 18 | « Une élévation de privilège est ouverte en production. » |
| 1369 | « L'exploitabilité de l'escalade `is_admin`. Trois faits vérifiés » |
| 4743 | « `is_coach_of()` ne vérifie pas non plus que l'appelant a le rôle `coach`. » |
| 5420 | « Un coach rétrogradé conserve l'accès aux données au niveau de la base. » |

L'escalade `is_admin` **a été corrigée en production** par SEC-2 le 26 juillet ; le document ne l'a pas suivi et la décrit encore comme ouverte, avec le détail de son exploitabilité.

**Le défaut du coach rétrogradé, lui, est toujours ouvert** : `demoteToPilot` n'écrit toujours pas `active = false` — zéro occurrence de `active` dans son corps.

Publier ce document revient donc à joindre, sur un dépôt public, la description d'un défaut de contrôle d'accès **encore ouvert** sur une base de production dont la clé anon est publique. C'est la liste de courses d'un attaquant.

---

## 6 · Ce qui n'a pas été fait, et pourquoi

Les étapes 2 à 6 du jalon 0.1 — traiter le non commité, pousser, poser l'étiquette `pre-migration-sdk55`, créer la branche de migration — **n'ont pas été engagées**. Toutes supposent le push, et le push est une publication qui n'a pas été arbitrée.

`git ls-remote` répond : le distant est joignable, rien ne s'oppose techniquement au push.

---

## 7 · La règle de sécurité du jalon 0.5 est tenue

Aucune migration destructive n'a été écrite ni exécutée. Les cinq tables `_backup_*_20260719` sont intactes. Les 43 journées disparues restent en l'état, en attente de D-01.

---

*Constat produit en lecture seule. Seul ce fichier a été créé.*
