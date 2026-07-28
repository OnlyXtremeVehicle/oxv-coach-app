# Jalon 2 — Socle produit

**28 juillet 2026.** Branche `migration/sdk-55`. Complet.

Source : `OXV_Mirror_V3_Plan_Montage.md`, « JALON 2 — SOCLE PRODUIT ».

> « Aucun écran n'est encore refondu. On pose ce que tous consommeront. »

---

## Phase 1 · Jetons

Détail dans [J2P1_JETONS.md](J2P1_JETONS.md). En trois lignes :

- `spacing.xl` valait 22 pt — ni un pas, ni un demi-pas — sur **386 emplacements**.
- Le plafond de 56 pt du chiffre roi **ne suffit pas** : sur iPhone SE, `1:41,203`
  y occupe 96 % de la largeur utile. Le repli descend à 52.
- Onze graisses mortes retirées ; ligatures coupées après lecture de la table de
  la fonte, pas par supposition.

---

## Phase 2 · Rôles et sécurité

### Le quatrième défaut n'était pas où le plan le cherchait

Les **162 policies** qui gardent la base appellent `public.is_admin()`, laquelle
disait déjà `role = 'admin' OR is_admin = true`. Cinq policies seulement lisaient
la colonne en direct, sur des tables vides.

Le défaut était dans l'**application**, aux deux seuls endroits qui décident :
`SpaceSwitcher` et le garde de `(admin)/_layout`. Résultat en production : deux
comptes `role='admin'` avec `is_admin=false` — la base leur accordait tout,
l'application ne leur montrait pas la porte.

Rien ne levait d'erreur. L'application était simplement **plus restrictive que la
base**, ce qui ne casse rien de visible.

### SEC-3 — la garde n'avait jamais été armée

Le corps de `guard_users_privileged_columns` couvrait `is_admin`. Le déclencheur,
lui, se lisait `BEFORE UPDATE OF role, kyc_status`. SEC-2 avait remplacé la
fonction sans recréer le déclencheur : le correctif était inerte depuis le jour
de sa pose.

`update public.users set is_admin = true where id = auth.uid()` passait, sur un
dépôt public où la RLS est la seule barrière. **J'avais déclaré cette faille
fermée le 27/07** — en confondant « migration appliquée » et « correctif
effectif ».

Fermée le 28/07 par `20260728161300`, déclencheur recréé **sans clause `OF`** :
on supprime la classe du défaut, pas son instance. Aucune trace d'exploitation
dans `admin_audit`.

**Reste à vérifier sur appareil** : depuis une session pilote réelle, l'écriture
doit échouer avec 42501. La console SQL tourne en `postgres` et serait exemptée.
C'est le contrôle que SEC-2 avait prévu et omis.

### Lot 8 — option B, appliquée

`role` fait seul autorité. `administration@oxvehicle.fr` est passé en
`role='admin'`, la colonne est annotée inerte, les cinq policies sont réalignées.

Le « préalable obligatoire » que j'avais annoncé — scinder le compte — **n'en
était pas un** : aucune policy ne dépend du rôle pilote, et le routage traite
`admin` et `pilot` identiquement. Le seul coût réel tenait dans deux lignes de
`detailLevelLogic`, qui imposaient le mode détaillé sans commutateur.

Bénéfice non anticipé : `oxv_is_admin()` était une **troisième** définition, plus
étroite, dont `administration@` était refoulé. Les deux convergent.

---

## Phase 3 · Corrections bloquantes

| Lot | État | Ce qui a été trouvé |
|---|---|---|
| 10 · RGPD | **Appliqué** | La référence morte à `coach_reviews` était déjà corrigée. La vraie trouvaille est venue d'une vérification **colonne par colonne** : `coach_payout_details` — IBAN, BIC, titulaire — survivait à la suppression du compte. |
| 11 · `registrations` | Livré | `setAttendance` pointait sans regarder le statut : un pilote annulé ou déclaré absent pouvait être marqué présent. |
| 12 · `registration_id` | Livré | Le défaut annoncé n'existe pas — la colonne non plus. Mais `resolveDaySessionId` retenait **la première** journée quand plusieurs correspondaient. |
| 13 · Insights | Livré | Six portes ouvraient six fois « Données insuffisantes ». `DemoBanner` était défini et **monté nulle part**. Les chiffres de démonstration sont physiquement retirés. |
| 27bis · créneaux | Livré (code) | L'écran annonçait « Créneau ouvert. Il apparaît désormais sur votre fiche. » Les deux phrases étaient fausses. |

---

## Le motif, sept fois

Garde multi-circuit jamais montée · scanner a11y limité à `app/` · scanner
doctrinal aveugle à 125 fichiers · `.gitignore` ancré sur des dossiers absents ·
police nommée sans être chargée · `DemoBanner` sans appelant · déclencheur SEC-2
sans sa colonne.

**Aucun ne lève d'erreur.** Un garde-fou qui ne se déclenche jamais se comporte
exactement comme un garde-fou satisfait. D'où la discipline appliquée dans ce
jalon : confronter le déclaré à l'installé — `pg_get_triggerdef` et pas seulement
`pg_get_functiondef`, les sites d'appel et pas seulement la signature.

Trois de mes propres vérifications ont d'ailleurs été fausses avant d'être
refaites : le comptage des policies (167 au lieu de 162 + 5), la couverture de
purge par nom de table (`registrations` masquée par `event_registrations`), et
les gardes de vide des vues comptées au grep. **Compter des motifs n'est pas
lire.**

---

## En attente de décision

| Sujet | Fichier |
|---|---|
| Cinq tables `_backup_*` — supprimer ou purger | `PROPOSITION_L10_purge_completude.sql` |
| État `pending_validation` des créneaux | `PROPOSITION_L27bis_creneau_en_attente.sql` |
| `is_coach_of` et le rôle | `PROPOSITION_D1_is_coach_of_role.sql` |
| Colonne ThumbHash | `PROPOSITION_T2_thumbhash.sql` |
| Lot 9bis — hygiène de comptes, sans urgence technique | — |

## Portes

`tsc` 0 · `jest` **2 182** (163 suites) · `eslint` 0 erreur · doctrine 0 sur
342 fichiers · accessibilité 0 sur 342 · prettier propre.

Aucun build depuis le début du jalon : tout ce qui précède est vérifié au banc ou
en lecture de la base, jamais à l'écran.
