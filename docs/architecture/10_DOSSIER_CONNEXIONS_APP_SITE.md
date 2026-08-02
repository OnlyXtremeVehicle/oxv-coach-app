# Dossier des connexions — application OXV Mirror ↔ site oxvehicle.fr

**26 juillet 2026** · rédigé depuis le dépôt de l'application
**Destinataire : l'équipe qui tient oxvehicle.fr**

---

## Ce que ce dossier est

Douze enquêtes menées en parallèle sur le code de l'application et sur la base de
production en lecture seule, puis relues l'une contre l'autre par deux relecteurs
indépendants. Six sections par rôle, six par fonction transverse. 6 500 lignes.

Trois marqueurs sont employés partout, et il faut les lire :

- **[APP]** — vérifié dans le code de l'application, chemin et ligne donnés.
- **[BASE]** — vérifié en production, requête et résultat donnés.
- **[DÉDUIT]** — inféré de ce que la base montre et de ce que l'application ne
  fait pas. **À confirmer par vous.** Nous n'avons pas accès à votre code.

Rien de ce qui suit n'a été obtenu en exécutant l'application ou le site.

---

## Trois choses à regarder aujourd'hui

### 1. Quarante-trois journées de calendrier ont disparu de la table vive

`public.sessions` contient **une seule ligne**. La table de sauvegarde
`_backup_sessions_20260719` en contient **44**. Et **aucun identifiant n'est
commun aux deux** : la ligne actuelle est nouvelle, les 44 journées d'origine ne
sont plus dans la table vive.

Même constat sur les inscriptions : `registrations` porte 1 ligne, sa sauvegarde
en porte 5, recouvrement nul.

```
sessions aujourd'hui        : 1
sessions sauvegarde 19/07   : 44
identifiants communs        : 0
inscriptions aujourd'hui    : 1
inscriptions sauvegarde     : 5
```

Deux lectures possibles, et nous ne pouvons pas trancher : soit c'est une remise
à zéro volontaire de votre côté, soit c'est une perte. **Dites-nous laquelle.**

Conséquence immédiate, quelle que soit la réponse : **les cinq tables
`_backup_*_20260719` sont aujourd'hui la seule copie survivante de ces données.**
Un `DROP` serait irréversible. Nous ne les toucherons pas.

### 2. Une élévation de privilège est ouverte

Tout compte authentifié peut se déclarer administrateur sur sa propre ligne :
`authenticated` détient UPDATE sur `users.is_admin`, la policy autorise
l'écriture de sa propre ligne, et le déclencheur de garde ne couvre que `role` et
`kyc_status`. Aucun audit ne le tracerait.

Le correctif est écrit dans `supabase/migrations_a_valider/20260726_sec2_guard_is_admin.sql`
et **n'est pas appliqué** — il attend l'accord du fondateur. Détail en section
ADMIN.

### 3. Le pont que vous devez construire n'existe pas encore

La fonction edge `pair-app` est déployée et complète. L'application sait
consommer un code d'appairage. `app_pairing_codes` contient **zéro ligne** :
il manque l'écran « générer un code » côté site. Tant qu'il n'existe pas, aucun
pilote ne peut relier son compte web à l'application par ce chemin.

---

## Le fait structurant

**Il n'y a aucune API entre l'application et le site.** Ils partagent un unique
projet Supabase — `fouvuqkdxarjpjbqnsjq`, `eu-west-1`, Irlande. Même
`auth.users` : un compte créé chez vous *est* le compte chez nous, pas une copie.
Mêmes 114 tables, mêmes 13 buckets, mêmes 34 fonctions edge, même historique de
migrations.

**La seule interface entre nos deux produits est le schéma, et il n'a jamais été
écrit comme un contrat.** C'est précisément ce que ce dossier propose de corriger.

---

## Comment lire la suite

**Par rôle** — qui fait quoi, de quel côté :

1. **Pilote** — le parcours complet, de la découverte au partage.
2. **Coach** — recrutement, consentement, prestation. Zéro compte en production.
3. **Partenaire** — vitrine, offres, médias. Entièrement instrumenté, entièrement vide.
4. **Admin et direction de course** — le sujet le plus délicat du dossier.
5. **Pro pilote, écuries, et visiteur anonyme** — dont la surface publique exacte.

**Par fonction** — ce qui traverse les rôles :

6. **Identité** — authentification, rôles, tous les consentements.
7. **Argent** — inscriptions, paiements, factures.
8. **Médias** — buckets, partages publics, vue AR.
9. **Notifications** — onze déclencheurs e-mail, et le push.
10. **Temps réel** — direct coach, biométrie, tableau de marche.
11. **Données personnelles** — rétention, purge, RGPD.
12. **Schéma** — le contrat implicite, ses trois ruptures, et les règles
    d'engagement que nous proposons.

Chaque section se termine par **« Ce que nous demandons au site »**. Le dossier
en compte 145 au total ; la relecture a demandé qu'elles soient dédoublonnées et
classées — c'est un travail que nous ferons avec vous, pas à votre place.

---

## Relecture croisée : ce que le dossier se corrige à lui-même

Deux relecteurs ont lu les douze sections l'une contre l'autre et relevé **29
points** : contradictions entre sections, chiffres divergents, affirmations sans
source, et manques. Nous les listons plutôt que de les masquer — ils vous disent
exactement quelles phrases lire avec prudence.

**Corrections factuelles à appliquer en lisant :**

1. **Surface anonyme** — les sections PARTENAIRE et ARGENT décrivent une lecture
   anonyme plus large que la réalité. La section PRO ET ANONYME est la seule à
   avoir testé sous le rôle : c'est elle qui fait foi.
2. **Écuries** — `crews` et `crew_members` sont à **0 ligne**, pas 1. La section
   SCHÉMA s'appuie à tort sur ces chiffres.
3. **Tables de sauvegarde** — 110 tables sur 114 ont la RLS active, pas 109 ; les
   exceptions sont quatre, pas cinq.
4. **Relais direct** — il exige **quatre** conditions, pas deux. La section
   IDENTITÉ en cite deux et qualifie `coach_pilots.status` de « non câblée » : la
   colonne est bien lue, comme un verrou bloquant.
5. **Factures coach** — le PDF reste sur l'appareil ; le bucket `invoices` ne
   reçoit que les factures OXV produites par `generate-invoice`.
6. **Paiements** — l'écriture n'est pas réservée au seul `service_role` : tout
   compte satisfaisant `is_admin()` y accède aussi.
7. **Documents et véhicules** — la section RGPD les range sous « collecté par
   l'application » alors qu'ils sont alimentés par vous.
8. **Fonctions edge sans propriétaire** — créées le **21 juillet 2026**, pas le
   19. La date sert d'indice de propriété dans quatre sections.
9. **Appairage** — le site *déclenche*, la fonction edge *écrit* en service_role.
   La nuance est le cœur du dispositif.
10. **Pavillon du jour** — la vue est `security_invoker`, pas SECURITY DEFINER, et
    l'application ne l'appelle pas.
11. **Tâches planifiées** — « toutes en succès » est faux. Le journal `cron` ne
    consigne que la mise en file de la requête, jamais la réponse :
    `compute-insights-hourly` échoue en 401 depuis le 13 juin.
12. **Changements de rôle** — trois entrées `role_changed`, pas deux.

**Manques signalés, à combler avec vous :**

13. Deux propositions **incompatibles** sont faites pour relier la capture à la
    journée. Une seule doit survivre — celle de la section SCHÉMA, qui
    l'argumente.
14. `app_config` est le coupe-circuit de l'application mobile (maintenance,
    version minimale) et n'apparaît dans aucune liste d'objets intouchables.
    Il doit y entrer.
15. La configuration Auth de Supabase — URL du site, redirections, durée de vie
    des jetons, gabarits d'e-mail — est un objet **partagé** au même titre que le
    schéma, et le dossier ne la nomme nulle part.
16. `users.kyc_status` apparaît seize fois dans le dossier sans qu'aucune section
    ne demande qui l'écrit ni selon quelle procédure. C'est pourtant un verrou.
17. La section SCHÉMA annonce « écriture vérifiée dans le code » pour 58 tables
    mais ne le prouve que pour 17. À lire comme une hypothèse pour les 41 autres.
18. La politique de confidentialité partagée doit être corrigée : hébergement en
    **Irlande** et non Francfort, et mention des sous-traitants réellement
    destinataires.

---

## Rôle PILOTE — le parcours complet, du site à l'app et retour

Le pilote est le rôle central du dispositif : 11 des 14 comptes de production
portent `users.role = 'pilot'` (vérifié en base : `pilot: 11, admin: 2,
partner: 1`). Cette section retrace son parcours de bout en bout et dit, à
chaque étape, quelle table est touchée, quelle colonne porte l'état, quelle
policy garde l'écriture, et quel côté écrit.

### Conventions de preuve

Nous n'avons pas accès au code du site. Chaque affirmation porte donc sa marque
d'origine : **vérifié dans le code de l'app** (chemin et ligne du dépôt
`oxv-app`), **vérifié en base** (requête en lecture seule sur
`fouvuqkdxarjpjbqnsjq`), ou **déduit, à confirmer par le site** — une inférence
tirée de ce que la base montre et de ce que l'application ne fait pas. Une
déduction n'est jamais un fait établi.

### État de production au 26 juillet 2026

Les volumes comptent : une table vide ne prouve pas l'absence d'un flux, elle
prouve seulement qu'il n'a pas encore servi. Comptages réels, vérifiés en base.

| Objet | Lignes | Lecture |
|---|---:|---|
| `users` (role `pilot`) | 11 | la population de référence |
| `auth.users` | 12 | **deux `public.users` n'ont pas de compte d'authentification** |
| `demandes_inscription` | 4 | 3 `acceptee`, 1 `en_attente`, toutes `type_demande = 'pilote'` |
| `sessions` (journées site) | 1 | 24/12/2026, `half_day`, `scheduled` |
| `registrations` | 1 | statut `pending`, offre `access`, 390,00 € |
| `payments` | 1 | statut `pending`, `paid_at` NULL |
| `eligibility_items` | 9 | 3 `ok`, 6 `pending`, pour l'unique inscription |
| `documents` | 9 | 3 pilotes concernés |
| `pilot_waiver_signatures` | 0 | flux gelé par drapeau (étape 11) |
| `app_pairing_codes` | 0 | **aucun code d'appairage jamais généré** |
| `telemetry_sessions` | 18 | 4 pilotes |
| `app_session_analyses` | 13 | les lectures d'après-séance |
| `app_progression_shares` | 1 | expiré le 14/07, `view_count = 0` |
| `session_feedback` | 0 | l'avis J+1 n'a jamais été rempli |

---

### Étape 1 — Découverte, puis demande d'inscription

Aucune trace en base pour la découverte. Les vues `sessions_public` et
`session_availability` sont accordées en `SELECT` au rôle `anon`, alors que la
table `sessions` elle-même ne lui accorde rien (vérifié en base,
`information_schema.role_table_grants`) : un visiteur non connecté voit donc les
journées et les places restantes, nécessairement par la vue. L'application
consomme exactement les mêmes vues, en lecture seule assumée — « LECTURE SEULE,
ZÉRO WRITE » (vérifié dans le code de l'app,
`src/services/bookingCatalogService.ts:4`, `:160`, `:177`).

**Table** : `demandes_inscription`. **Colonne d'état** : `statut`
(`en_attente | acceptee | refusee`). **Policy** : `demandes_insert_public`, sur
`INSERT`, ouverte à `anon` et `authenticated`, avec ce `WITH CHECK` (vérifié en
base) :

```sql
statut = 'en_attente' AND consent_cgv = true
AND consent_rgpd = true AND consent_contact = true
```

N'importe qui peut déposer une demande, mais uniquement en `en_attente` et
uniquement avec les trois consentements cochés : la contrainte juridique est
portée par la base, pas par le formulaire. C'est un bon dispositif.

**Qui écrit** : le site. L'application ne contient **aucune** référence à
`demandes_inscription` (vérifié dans le code de l'app). Un accusé de réception
part : `ack_sent_at` est renseigné sur la demande du 21/07, et `email_log`
compte 3 lignes `application_received` en `sent` (vérifié en base) ; l'edge
`send-application-ack` est déployée et active.

### Étape 2 — Validation par un administrateur

**Policies** : `demandes_admin_select` et `demandes_admin_update`, gardées par
`oxv_is_admin()`. Or il existe **deux fonctions d'administration distinctes**
(vérifié en base, `pg_get_functiondef`) :

```sql
-- oxv_is_admin() : STRICTEMENT role = 'admin'
select exists (select 1 from public.users where id = auth.uid() and role = 'admin');
-- is_admin() : role = 'admin' OU is_admin = true
select coalesce((select role = 'admin' or is_admin = true from public.users where id = auth.uid()), false);
```

Conséquence vérifiée sur les comptes réels : `administration@oxvehicle.fr` porte
`role = 'pilot'` et `is_admin = true` — il passe `is_admin()`, donc toutes les
policies d'administration du reste de la base, mais **échoue `oxv_is_admin()`** :
il ne peut ni lire ni valider une demande. Symétriquement, les deux comptes
`role = 'admin'` ont `is_admin = false` : ils valident les demandes mais
n'entrent pas dans l'espace admin de l'application, dont le garde est
`profile.is_admin` (vérifié dans le code de l'app, `app/(admin)/_layout.tsx:17`).

Le déclenchement passe par la fonction `admin_validate_inscription(...)`,
`SECURITY DEFINER`, qui vérifie `oxv_is_admin()` puis relaie en `pg_net` vers
l'edge `validate-inscription` (vérifié dans le dépôt,
`supabase/migrations/20260718133742_fix_relay_validate_inscription_jwt.sql:16-80`).
**Déduit, à confirmer par le site** : c'est votre back-office qui appelle cette
RPC — l'application ne l'invoque nulle part.

### Étape 3 — Création du compte

L'edge `validate-inscription` fait, dans cet ordre (vérifié dans le code de
l'app, `supabase/functions/validate-inscription/index.ts`) :
`auth.admin.createUser({ email, email_confirm: true })` (ligne 325) ; un `upsert`
sur `public.users` avec `id, email, first_name, last_name, role, email_verified`
plus `phone`, `birth_date` et `city` s'ils sont présents (353-370) ; en cas
d'échec, un **repli minimal** sur `id, email, first_name, last_name, role`
(371-383) ; `auth.admin.generateLink({ type: 'recovery' })` vers
`SITE_URL/?p=reset-password` (451) ; enfin `statut = 'acceptee'` et
`created_user_id` (486). Un déclencheur double la création :
`on_auth_user_created` sur `auth.users` appelle `handle_new_user()`, qui insère
`public.users (id, email)` en `ON CONFLICT DO NOTHING` (vérifié en base).

**Un défaut confirmé.** `public.users` n'a pas de colonne `city` — elle s'appelle
`address_city` (vérifié en base). Dès que la demande porte une ville, l'upsert
complet échoue et le repli s'applique : **le téléphone et la date de naissance
sont perdus**. Les données le confirment (vérifié en base) :

| demande | `city` | `phone` (demande) | `users.phone` | `users.birth_date` |
|---|---|---|---|---|
| `2868469f` | Donnezac | +336… | NULL | NULL |
| `490fe1e5` | Montlieu-la-Garde | +336… | NULL | NULL (demande : 2000-04-12) |
| `8ecad273` | Bordeaux | +336… | NULL | NULL (demande : 2006-12-24) |

Sur les 11 pilotes, **0 a un téléphone** et 1 a une date de naissance. Or le
téléphone d'un pilote sur circuit n'est pas un agrément : c'est le moyen de le
joindre le jour J. Le correctif tient en un mot (`city` → `address_city`), mais
il touche une fonction dont l'appelant est le site : nous ne le posons pas seuls.

### Étape 4 — Première connexion dans l'application

**Chemin nominal** : email + mot de passe (vérifié dans le code de l'app,
`app/(auth)/login.tsx:26`). Le mot de passe est celui défini depuis le lien
`recovery` reçu par email — donc **depuis le site**. L'application n'offre ni
inscription ni création de mot de passe : aucun écran de `signUp` n'existe dans
le dépôt. Le profil chargé est restreint à 14 colonnes
(`src/store/useAuthStore.ts:57-60`), sous `users_select_own_or_admin`
(`id = auth.uid() OR is_admin()`) : le pilote ne lit que sa propre ligne.

Trois observations de production, toutes vérifiées en base :

- **`users.last_login_at` est NULL pour les 14 comptes.** Aucun des deux côtés
  ne l'écrit. Si le site s'en sert pour une relance, il compte des zéros.
- Un pilote sur onze s'est authentifié par **Apple**
  (`auth.identities.provider = 'apple'`, email
  `p98gjmfjyg@privaterelay.appleid.com`) : pas de mot de passe, adresse en relais
  privé. **Déduit, à confirmer par le site** : il ne peut pas se connecter chez
  vous par email + mot de passe, et vos courriels transitent par le relais. C'est
  pourtant un pilote actif — 4 sessions capturées, et l'un des deux seuls
  `public_handle` renseignés (`laparadd`).
- **Deux comptes fantômes** : `louis.arnd05@icloud.com` (`f27e56e2`) et
  `shadowsresidents@gmail.com` (`f936c42c`) existent dans `public.users`
  (`role = 'pilot'`) sans ligne `auth.users`. Ils ne peuvent se connecter nulle
  part. **Déduit, à confirmer par le site** : insertion directe en `public.users`
  sans passer par `auth.admin.createUser`. Nous n'y toucherons pas.

### Étape 5 — Appairage site → app par code court

C'est le seul mécanisme conçu explicitement comme un pont entre les deux
produits (vérifié dans le code de l'app,
`supabase/functions/pair-app/index.ts`) :

- **`action = 'generate'`** — appelée avec le JWT d'un utilisateur connecté, donc
  **depuis le site**. Elle invalide les codes actifs précédents du compte, puis
  insère dans `app_pairing_codes` un code de 8 caractères tiré d'un alphabet non
  ambigu (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`, sans 0/O/1/I/L), valable
  **10 minutes**, à usage unique. Un seul code vivant par compte.
- **`action = 'redeem'`** — appelée **sans JWT** par l'application. Elle consomme
  le code atomiquement (`update … where code = ? and used_at is null and
  expires_at > now()`), génère un magic link et renvoie son `token_hash`.
  Anti-force brute : 10 tentatives par minute et par IP, l'IP hachée en SHA-256
  dans `app_pairing_redeem_attempts`.

Côté application : `src/services/pairingService.ts:33` puis `:60`
(`verifyOtp({ type: 'magiclink', token_hash })`). L'écran `app/(auth)/lier.tsx`
annonce « Depuis votre compte sur oxvehicle.fr, générez un code d'appairage puis
saisissez-le ici. Il est valable dix minutes. » (`:73-75`), et le lien profond
`oxv://lier?code=XXXXXXXX` préremplit le champ (`:37-40`).

**Table** : `app_pairing_codes` (`user_id, code, expires_at, used_at,
used_user_agent`). **Policy** : `app_pairing_codes_select_own`, SELECT seulement,
`user_id = auth.uid()`. Aucune policy d'écriture : **seul le `service_role`
écrit**, via l'edge. C'est correct.

**État de production** : `app_pairing_codes` = **0 ligne** ;
`app_pairing_redeem_attempts` = 1 (vérifié en base). Le pont est déployé
(`pair-app` version 6, `ACTIVE`) mais **n'a jamais servi**. **Déduit, à confirmer
par le site** : l'écran « compte → application » qui déclenche `generate` n'est
pas encore publié. C'est le point le plus concret de cette section : le travail
est fait aux deux tiers, il manque un bouton.

### Étape 6 — Onboarding et pacte de pilotage

Entièrement porté par l'application (vérifié dans le code de l'app,
`src/services/onboardingService.ts`). Toutes les écritures visent `public.users`,
policy `users_update_own_or_admin`.

| Écran | Colonnes écrites | Référence |
|---|---|---|
| Niveau pilote | `pilot_level` | `onboardingService.ts:29` |
| CGU + confidentialité | `cgu_accepted_at`, `cgu_version`, `privacy_accepted_at`, `privacy_version`, `ai_debrief_enabled` | `:54-63` |
| Pacte de pilotage | `pact_accepted_at`, `pact_version` | `:82-88` |
| Fin d'onboarding | `profile_completed_at` | `:140-143` |

Les versions en vigueur sont des constantes du code (`PACT_VERSION`,
`CGU_VERSION`, `PRIVACY_VERSION`, toutes à `'1.0'`, `:18-21`). Si le site publie
des CGU d'une autre version, les deux côtés divergeront silencieusement : la
colonne enregistre une version, personne ne la compare.

La porte d'entrée applique ces colonnes — tant que `profile_completed_at`,
`cgu_accepted_at` et `pact_accepted_at` ne sont pas tous renseignés, le pilote
est renvoyé vers `(onboarding)` (`app/index.tsx:79-88`,
`onboardingService.ts:159-175`). **Un pilote créé par le site arrive donc avec
ces trois colonnes vides et doit signer le pacte avant d'accéder à quoi que ce
soit** ; une acceptation de CGU faite chez vous ne dispense de rien ici. En
production : 4 comptes sur 14 ont `profile_completed_at`, 2 ont
`pact_accepted_at` (vérifié en base). Ces écritures sont mises en file hors ligne
en cas d'échec réseau (`:32-37`) et rejouées plus tard : une acceptation peut
arriver en base avec du retard.

### Étape 7 — Inscription à une journée de roulage

**C'est le site qui inscrit. L'application n'inscrit pas.**

**Table** : `registrations`. **Colonne d'état** : `status`
(`pending | confirmed | cancelled | attended | no_show | pending_payment`).
Colonnes structurantes : `session_id`, `offer_type`
(`access | signature | promotion | heritage`), `price_total`, `price_deposit`,
`slot_choice`, `attended_at`. **Policies** (vérifié en base) :
`registrations_insert_own_or_admin` (`WITH CHECK user_id = auth.uid() OR
is_admin()`), `registrations_select_own_or_admin`,
`registrations_update_own_or_admin`, `registrations_delete_admin_only`.

Techniquement, l'application **pourrait** insérer une inscription. Elle ne le
fait pas : sur 13 occurrences de `from('registrations')`, une seule est une
écriture, et elle ne touche que `attended_at`
(`src/services/attendanceService.ts:116-119`). Ce qu'elle **lit**, et à quoi cela
sert :

- la **prochaine journée** du Paddock — `src/services/nextTrackDayService.ts:34-83`,
  qui joint `registrations` → `sessions` → `circuits` et masque le bloc s'il n'y
  a rien ;
- la **logistique du jour** (créneau, format) — `app/(app)/preparation.tsx:96-118` ;
- le **niveau de restitution du QDI** — `src/services/qdiService.ts:302-313` : si
  l'inscription active la plus récente porte `offer_type` `signature` ou
  `heritage`, le pilote reçoit la lecture détaillée, sinon la lecture simple.
  **Une colonne écrite par le site pilote donc ce que l'application montre.**

L'unique inscription (`a36cb11e`) est `pending`, offre `access`, 390,00 €, sur la
journée du 24/12/2026, `confirmation_email_sent_at` renseigné, `attended_at` NULL
(vérifié en base).

**Le flux « Réserver » de l'application existe mais est inerte.** Trois écrans
sont construits (`app/(app2)/reserver/`), en lecture seule sur `sessions_public`,
`session_availability` et `pricing`, derrière le drapeau `app_payments` —
**`enabled = false`**, « Activé au lot A1-ON » (vérifié en base,
`app_feature_flags`) ; les boutons de paiement sont explicitement inertes
(`app/(app2)/reserver/paiement.tsx:5-8`).

Il existe par ailleurs un second circuit d'inscription, propre à l'application :
`events` + `event_registrations` (insertion en `src/services/eventsService.ts:378`,
policy `event_reg_insert`, `pilot_id = auth.uid()`), qui alimente le « pass »
présenté à l'entrée. `events` compte 1 ligne, `event_registrations` **0**.
**Déduit, à confirmer par le site** : ces tables ne sont pas les vôtres, et aucun
rapprochement `sessions` ↔ `events` n'existe en base.

### Étape 8 — Paiement

**Table** : `payments`. **Colonne d'état** : `status`
(`pending | succeeded | failed | refunded`). Colonnes : `registration_id`,
`amount` (centimes), `payment_method`, `stripe_payment_intent_id`,
`stripe_charge_id`, `stripe_invoice_id`, `paid_at`, `invoice_pdf_url`,
`reference`.

**Policies** : `payments_select_own_or_admin` et `payments_admin_all`. Il n'y a
**aucune policy d'INSERT ni d'UPDATE pour un utilisateur authentifié** (vérifié
en base) : seul le `service_role` peut créer ou faire évoluer un paiement. C'est
la bonne conception, et elle signifie qu'un webhook serveur — **le vôtre** — est
le seul écrivain.

**Qui écrit** : le site. L'application ne contient **aucune** occurrence de
`payments` (vérifié dans le code de l'app) : elle n'affiche ni montant, ni
facture, ni état de règlement. Production : 1 paiement `pending`, 390,00 €,
méthode `card`, référence `OXV-A36CB11E`, `paid_at` et `invoice_pdf_url` NULL ;
`invoices` et `subscriptions` vides ; `users.stripe_customer_id` renseigné pour
0 pilote. Avec `app_payments = false`, cela dit une seule chose : **la chaîne de
paiement n'a pas encore tourné en vrai**.

### Étape 9 — Pièces justificatives et éligibilité

**Tables** : `documents` et `eligibility_items`. Aucune des deux n'est touchée
par l'application (vérifié dans le code de l'app : zéro occurrence).

Le mécanisme est porté par la base (vérifié en base, `pg_get_functiondef`) :
`oxv_seed_eligibility(registration_id)` insère 9 items à la création d'une
inscription (`permis, cni, assurance_circuit, controle_technique, pneus_freins,
niveau_sonore, casque, decharge, briefing`) ; `oxv_sync_eligibility_docs` recopie
l'état des documents (`validated` → `ok`, `rejected` → `refused`) sur les trois
premiers, **sauf si un admin a déjà tranché à la main**
(`and ei.validated_by is null` — « une décision admin manuelle prime toujours ») ;
la vue `registration_eligibility` agrège en `GO` / `NO_GO` / `EN_ATTENTE` ; le
cron `oxv-eligibility-reminders` (6 h) relance les inscriptions `pending` ou
`confirmed` qui ne sont pas `GO`.

**Policies** : `eligibility_select_own` (le pilote voit les items de ses propres
inscriptions), `eligibility_update_admin` (seul un admin coche) ;
`documents_insert_own_or_admin` (le pilote dépose), `documents_update_admin_only`
(seul l'admin valide). Production : 3 `ok`, 6 `pending` — l'agrégat vaut
`EN_ATTENTE`.

**Ce que l'application montre à la place** : son écran « Licence & documents »
(`app/(app2)/vous/documents.tsx`) n'affiche pas la table `documents` mais
`users.ffsa_license` et `users.kyc_status` sous forme de carte de licence, plus
les textes légaux embarqués dans le binaire. Or `ffsa_license` est vide pour les
11 pilotes et un seul a `kyc_status = 'validated'` (vérifié en base). **Le pilote
ne peut ni déposer ni consulter ses pièces depuis l'application.**

### Étape 10 — Signature de décharge

C'est l'endroit où les deux produits se marchent le plus dessus : **trois
mécanismes distincts coexistent, sans lien entre eux.**

**1. `eligibility_items.item_key = 'decharge'`** — une case cochée par un
administrateur (policy `eligibility_update_admin`). En production : `pending`.
C'est ce qui bloque ou débloque le `GO`.

**2. `pilot_waiver_signatures`** — la signature électronique de l'application.
Table immuable : `waiver_owner_insert` et `waiver_owner_select` seulement,
**aucune policy d'UPDATE ni de DELETE** (vérifié en base). L'insertion scelle
`waiver_version`, `document_hash` (empreinte du texte calculée au build),
`signed_full_name`, `signed_at`, `app_version`, `user_agent`, et le `WITH CHECK`
vérifie que `booking_id` et `session_id` appartiennent au signataire (vérifié
dans le code de l'app, `src/services/waiverService.ts:76-85`). Le tout est gelé
par le drapeau `pilot_waivers`, **`enabled = false`**, « activation après
relecture avocat » ; le service refuse même un appel hors écran (`:68`).
**0 signature en production.**

**3. Yousign** — l'edge `yousign-webhook` (version 6, `ACTIVE`,
`verify_jwt: false`, HMAC-SHA256 vérifié en interne), dont nous avons lu la
source depuis la plateforme : elle bascule `founding_members.statut = 'signe'`
sur `yousign_request_id` puis envoie un email de bienvenue Membre Fondateur.
**Elle ne touche donc pas la décharge du pilote**, et n'existe dans aucun code de
notre côté — **elle est vraisemblablement à vous, merci de le confirmer.**

**Ce qu'il faut trancher** : quand la décharge sera effective, laquelle des trois
fait foi, et qui coche l'item `decharge` à partir de laquelle. Aujourd'hui, une
signature posée dans l'application ne cocherait rien.

### Étape 11 — Jour de roulage, la présence

**Colonne d'état** : `registrations.attended_at`. **Qui écrit** :
**l'application, côté administrateur** — c'est le seul endroit où elle écrit dans
une table du site. Le service l'assume en en-tête : « Le site (oxvehicle.fr) vit
sur `sessions` + `registrations` ; ses KPI, la demande d'avis J+1 (cron) et la
livraison des médias s'appuient sur `registrations.attended_at`. L'app pointe
donc la présence LÀ » (vérifié dans le code de l'app,
`src/services/attendanceService.ts:1-11`). L'écriture est en ligne 118,
`.update({ attended_at: … })`, sous `registrations_update_own_or_admin` branche
`is_admin()` ; écrans `app/(admin)/presences.tsx` et
`app/(admin)/scan-checkin.tsx`.

**Une rupture confirmée.** L'application écrit `attended_at` mais **jamais**
`status`. Or le cron `oxv-feedback-requests` (7 h) sélectionne `registrations`
avec `.eq('status', 'attended')` (vérifié dans le code de l'app,
`supabase/functions/feedback-request/index.ts:27-29`), et la policy
`feedback_insert_own` de `session_feedback` exige elle aussi
`r.status = 'attended'` (vérifié en base). **Un pilote pointé présent depuis
l'application ne reçoit donc pas la demande d'avis et ne peut pas déposer son
retour.** `session_feedback` compte 0 ligne. **Déduit, à confirmer par le site** :
c'est votre back-office qui bascule `status`. Si ce n'est pas le cas, personne ne
le fait.

Deux corrections possibles : écrire `status` en même temps qu'`attended_at` côté
application, ou faire porter le cron sur `attended_at is not null`. La seconde
est plus sûre — elle n'ajoute pas d'écrivain à une colonne partagée. **Nous ne
trancherons pas seuls : `registrations.status` est à vous.**

### Étape 12 — Capture

Domaine propre de l'application, aucune écriture du site attendue. **Tables** :
`telemetry_sessions` (18 lignes, 4 pilotes), `telemetry_frames` (53), `laps` (1).
**Policies** : `Users can insert own sessions` (`auth.uid() = user_id`) ; pour
les trames et les tours, une appartenance transitive `session_id IN (select id
from telemetry_sessions where user_id = auth.uid())`. Des lectures
supplémentaires existent pour le coach (`is_coach_of`, qui exige
`coach_pilots.pilot_consent_at is not null`) et pour les amis (`are_friends`).
Aucune de ces portes n'est ouverte au site.

Deux points utiles pour vous :

- `telemetry_sessions.event_id` existe mais **vaut NULL sur les 18 lignes**
  (vérifié en base) : **aucun lien, en pratique, entre une capture et une journée
  vendue**. Le rapprochement reste à définir ; nous avons refusé de le deviner.
- La vue `pavillon_pilotes_jour` (SECURITY DEFINER, accordée au seul rôle
  `authenticated`) expose, pour les captures du jour, `car_number`,
  `public_handle`, le véhicule, et un `display_name` réduit à « Prénom N. »
  **uniquement si `users.pavilion_name_optin` est vrai**. C'est le seul endroit
  où un pilote en voit un autre nommé ; 1 compte a activé l'option.

### Étape 13 — Bilan

**Tables** : `app_session_analyses` (13 lignes) et `session_insights` (1).

`app_session_analyses` porte la lecture rendue au pilote (`margin_global`,
`margin_zone`, `next_focus_phrase`, `debrief_text`, `qdi`) et une trace du pacte
au moment du calcul (`pact_accepted_at`, `pact_version`). **Policy d'écriture** :
`app_session_analyses_insert_own` — c'est l'application qui écrit
(`src/services/analyzeSessionService.ts:492`). `session_insights` est
**verrouillée au serveur** : la policy `service writes insights` exige
`auth.role() = 'service_role'` (vérifié en base) ; elle est alimentée par l'edge
`compute-session-insights`, appelée par l'application (`:167`) et par le cron
horaire `compute-insights-hourly`.

Rien de tout cela n'est visible du site, et rien du site n'y entre — à
l'exception déjà citée de `registrations.offer_type`, qui décide du niveau de
détail du QDI.

### Étape 14 — Partage

**Table** : `app_progression_shares` (`share_token`, `share_scope`,
`included_metrics` jsonb, `expires_at`, `revoked_at`, `view_count`,
`last_viewed_at`). **Qui écrit** : l'application. Le pilote crée un lien et
choisit **métrique par métrique** ce qu'il expose (liste blanche stricte de 5
clés, vérifié dans le code de l'app, `src/services/sharesService.ts:21-42`), avec
expiration facultative ; le jeton fait 192 bits en base64url (`:70-87`).

**L'URL pointe chez vous** : `const SHARE_BASE_URL = 'https://oxvehicle.fr/share'`
(`src/services/sharesService.ts:58`). **C'est donc au site d'afficher cette
page.** La lecture publique passe par la RPC `get_shared_progression(p_token
text)`, `SECURITY DEFINER`, **exécutable par `anon`** (vérifié en base, `proacl`
contient `anon=X`) : elle vérifie que le partage n'est ni révoqué ni expiré,
incrémente `view_count`, et ne renvoie que `share_scope`, `included_metrics`,
`created_at`, `expires_at` — **jamais le `user_id` ni le jeton d'un autre**. Une
seconde RPC, `get_shared_progression_values`, existe avec les mêmes droits.

Production : 1 partage, portée `last_5_sessions`, une seule métrique cochée
(`regularity`), **expiré le 14/07/2026**, `view_count = 0` (vérifié en base).
**Déduit, à confirmer par le site** : la page `/share/{token}` n'est pas en
ligne, ou n'a jamais été visitée.

### Étape 15 — Fin de parcours

Le pilote demande la suppression depuis l'application : `deletion_requested_at`
et `deletion_scheduled_at` sont posés à J+30 (vérifié dans le code de l'app,
`src/services/accountService.ts:36-49`). L'effacement réel est porté par l'edge
`purge-deleted-accounts`, déclenchée par le cron `purge-deleted-accounts-daily`
(2 h 30). Aucun pilote n'a de demande en cours (vérifié en base). **La matrice de
purge touche des tables du site : `docs/architecture/14_PURGE_MATRIX.md` en tient
la liste et mérite votre relecture.**

---

### Qui écrit quoi — tableau de synthèse

| Objet | Colonne d'état | Écrit par | Policy qui garde |
|---|---|---|---|
| `demandes_inscription` | `statut` | site (dépôt), admin (revue) | `demandes_insert_public`, `demandes_admin_update` |
| `auth.users` + `public.users` (création) | — | edge `validate-inscription` (service role) | hors RLS |
| `users` (identité, contacts) | — | site | `users_update_own_or_admin` |
| `users` (pacte, CGU, niveau, consentements) | `pact_accepted_at`, `cgu_accepted_at`, `profile_completed_at` | **app** | `users_update_own_or_admin` |
| `users.public_handle` | — | **les deux** | `users_update_own_or_admin` |
| `users.role`, `users.kyc_status` | — | admin uniquement | déclencheur `trg_guard_users_privileged_columns` |
| `app_pairing_codes` | `used_at` | edge `pair-app` (service role) | aucune policy d'écriture |
| `sessions` | `status` | site | `sessions_insert_admin_only` |
| `registrations` | `status` | **site** | `registrations_insert_own_or_admin` |
| `registrations.attended_at` | — | **app (admin)** | `registrations_update_own_or_admin` |
| `payments` | `status` | site (service role) | aucune policy d'écriture utilisateur |
| `documents` | `status` | pilote dépose (site), admin valide | `documents_insert_own_or_admin` |
| `eligibility_items` | `status` | admin + déclencheurs | `eligibility_update_admin` |
| `pilot_waiver_signatures` | — | **app**, drapeau OFF | `waiver_owner_insert`, immuable |
| `founding_members` | `statut` | edge `yousign-webhook` | — |
| `telemetry_sessions`, `laps`, `telemetry_frames` | `status` | **app** | `user_id = auth.uid()` |
| `app_session_analyses` | — | **app** | `app_session_analyses_insert_own` |
| `session_insights` | — | edge (service role) | `service writes insights` |
| `app_progression_shares` | `revoked_at` | **app** ; lu par le site | `app_progression_shares_insert_own` + RPC `anon` |

### Ce que le pilote voit sur le site et pas dans l'application

Déduit de l'absence **totale** de ces tables dans le code de l'application
(vérifié dans le code de l'app : zéro occurrence de chacune), à confirmer par le
site — le montant, l'acompte, le moyen de paiement, la facture (`payments`,
`invoices`, `invoice_counters`) ; le dépôt et l'état de ses pièces (`documents`,
`eligibility_items`) ; le statut de sa demande d'inscription
(`demandes_inscription` — de toute façon il n'a pas encore de compte) ; l'acte
d'achat lui-même (le tunnel de l'application est inerte) ; l'éditorial
(`articles`) ; les échanges de contact (`contact_messages`, `email_log`,
`resend_events`) ; l'avis J+1 (`session_feedback`).

### Ce que le pilote voit dans l'application et pas sur le site

Déduit de la nature des tables et de leurs policies, à confirmer par le site :

- **sa télémétrie et ses lectures** — `telemetry_sessions`, `telemetry_frames`,
  `laps`, `app_session_analyses`, `session_insights`, `app_segment_analyses` ;
- **son QDI, ses marges, son débrief** — dont le niveau de détail dépend pourtant
  de `registrations.offer_type`, écrit par vous ;
- **le pavillon du jour** — qui roule aujourd'hui, sous pseudo
  (`pavillon_pilotes_jour`, accordée au seul rôle `authenticated`) ;
- **ses amis pilotes** (`pilot_friendships`) et **son coach** (tables `coach_*`,
  accès conditionné à `coach_pilots.pilot_consent_at`) ;
- **ses consentements fins** — débrief IA (`ai_debrief_enabled`), biométrie
  (`biometry_capture_consent_at`, `biometry_coach_share_consent_at`), visibilité
  communautaire (`community_visibility`), présence affichée (`show_attendance`),
  nom au pavillon (`pavilion_name_optin`). **Si le site propose un centre de
  préférences, ces colonnes doivent y figurer, ou le pilote aura deux vérités.**

---

### `users.public_handle` — le pseudo partagé

C'est la seule colonne pensée dès l'origine comme partagée. Une note de
coordination lui est déjà consacrée dans notre dépôt :
`docs/COORDINATION_SITE_HANDLE.md`.

**La source unique** : `users.public_handle text`, index unique
`users_public_handle_key` plus un index simple `idx_users_public_handle` (vérifié
en base, `pg_indexes`). Le préfixe `@` est un habillage d'affichage, jamais
stocké.

**Qui peut le changer** : le propriétaire, des deux côtés, sous
`users_update_own_or_admin`. Côté application, l'écriture se fait dans l'écran
Profil via `changerNomPublic` (`src/lib/queries/profil.ts:347-370`).
L'application **ne propose pas de le retirer**, seulement de le remplacer ; si le
site veut autoriser le retour à `NULL`, prévenez-nous — des affichages en
dépendent.

**L'unicité vient de la contrainte, pas d'une pré-vérification.** Un `SELECT` de
contrôle avant écriture est racé. La bonne pratique, appliquée côté application,
est d'écrire puis de traiter l'erreur Postgres **`23505`** (`unique_violation`)
et de rendre exactement **« Ce nom est déjà pris. »** (vérifié dans le code de
l'app, `src/lib/queries/profil.ts:359-361`). Merci d'utiliser la même phrase :
c'est le même champ, ce doit être la même réponse.

**Règles de validation**, à recopier telles quelles (vérifié dans le code de
l'app, `src/utils/validation.ts`) : `HANDLE_REGEX = /^[a-z0-9_-]{3,20}$/`, soit
3 à 20 caractères parmi `a-z`, `0-9`, `-`, `_`. **Normalisation avant validation
et avant écriture** : `trim()`, minuscules, retrait d'un éventuel `@` saisi.

**Le piège de la casse — le point le plus important ici.** L'index unique est un
btree ordinaire sur `text` : il est **sensible à la casse**, et il n'existe
**aucune contrainte `CHECK`** sur `public_handle` (vérifié en base ;
`pg_constraint` ne renvoie que six checks, tous sur d'autres colonnes). Donc
`Gabin` et `gabin` peuvent **coexister**. Or la recherche côté application est
**insensible** à la casse (`.ilike('public_handle', trimmed).limit(1)`, vérifié
dans le code de l'app, `src/services/friendshipsService.ts:181-182`) : avec deux
variantes en base, elle en renvoie une **arbitrairement**. Tant que les deux
côtés normalisent en minuscules, rien ne casse ; le jour où un seul ne le fait
pas, la collision est silencieuse et le mauvais pilote est désigné. Deux réponses
possibles : un index unique fonctionnel sur `lower(public_handle)` avec une
contrainte de format, ou un engagement formel des deux côtés. **Nous préférons la
contrainte : elle survit aux relectures.**

**Un second piège, propre à l'application.** `users_select_own_or_admin` limite
la lecture de `users` à sa propre ligne, mais la recherche d'un pilote par pseudo
(`findUserByPublicHandle`, `src/services/friendshipsService.ts:174-190`)
interroge `users` directement : **elle ne peut structurellement rien trouver**
pour un autre pilote. C'est un défaut de notre côté, à corriger par une RPC
`SECURITY DEFINER` n'exposant que `id`, `public_handle`, `avatar_url`. Nous le
signalons car si le site propose une recherche par pseudo, il rencontre soit la
même limite, soit il l'a contournée d'une façon qu'il faut nous dire.

**État de production** : **2 pseudos sur 11 pilotes** — `laparadd` (le compte
Apple) et `gabin`. Aucun pilote n'a d'`avatar_url`, de `car_number`, de `livery`,
de `socials` ni de `bio` (vérifié en base). L'application **lit** `avatar_url`,
`car_number` et `livery` mais ne les écrit **jamais** (vérifié dans le code de
l'app). **Déduit, à confirmer par le site** : soit c'est à vous de les écrire,
soit personne ne le fait — et le pavillon et les cartes resteront gris.

---

### Ce que nous demandons au site

1. **Publiez l'écran « générer un code d'appairage »** (compte → application),
   qui appelle l'edge `pair-app` avec `action: 'generate'` et le JWT du pilote
   connecté. Toute la moitié application est déployée ; `app_pairing_codes` est à
   **0 ligne**, donc aucun pilote n'a jamais pu lier son compte autrement qu'en
   retapant son mot de passe. Prévoyez aussi le lien profond
   `oxv://lier?code=XXXXXXXX`, déjà géré par l'application.
2. **Confirmez que `capture-membre-fondateur` et `yousign-webhook` sont à vous**
   et partagez leur source. Nous avons lu `yousign-webhook` depuis la plateforme :
   elle écrit `founding_members.statut` et envoie un email. Elle est en
   `verify_jwt: false`, protégée par un HMAC interne — correct, mais nous ne
   pouvons pas le garantir dans la durée sur du code que nous ne voyons pas.
3. **Tranchez la question de `registrations.status`.** L'application pointe la
   présence dans `attended_at` et n'écrit jamais `status` ; le cron
   `oxv-feedback-requests` et la policy `feedback_insert_own` exigent
   `status = 'attended'`. Est-ce votre back-office qui bascule ce statut, et
   quand ? Sinon, préférez-vous que le cron s'appuie sur
   `attended_at is not null` (notre recommandation), ou que l'application écrive
   `status` — ce que nous ne ferons pas sans votre accord écrit ?
4. **Autorisez le correctif de `validate-inscription`** : `profileRow.city` vise
   une colonne inexistante (`public.users` a `address_city`), l'upsert complet
   échoue et le repli perd **téléphone et date de naissance**. Résultat mesuré :
   0 pilote sur 11 a un téléphone. Confirmez la cible `address_city`, et
   dites-nous si nous rattrapons les trois comptes déjà créés depuis leur demande
   d'origine.
5. **Dites-nous qui fait autorité sur `users.role` et `users.is_admin`.** Les
   policies des demandes utilisent `oxv_is_admin()` (`role = 'admin'` strict), le
   reste de la base utilise `is_admin()` (`role = 'admin' OR is_admin`). En
   production, aucun compte ne satisfait les deux : celui qui valide les
   inscriptions n'entre pas dans l'espace admin de l'application, et
   réciproquement.
6. **Statuez sur `public_handle`** : acceptez-vous un index unique fonctionnel
   sur `lower(public_handle)` et une contrainte `CHECK` de format
   (`^[a-z0-9_-]{3,20}$`) ? Sans cela, `Gabin` et `gabin` coexistent et notre
   recherche insensible à la casse en désigne un au hasard. Confirmez aussi que
   vous rendez la violation `23505` avec la phrase **« Ce nom est déjà pris. »**,
   et dites-nous si vous autorisez la remise à `NULL`.
7. **Confirmez qui écrit `users.avatar_url`, `car_number`, `livery`, `socials`,
   `bio`.** L'application les lit et ne les écrit pas ; ils sont vides pour les
   11 pilotes. Si ce n'est pas vous non plus, il faut décider qui s'en charge.
8. **Écrivez ou confirmez `users.last_login_at`** — NULL sur les 14 comptes.
   Personne ne l'alimente ; si vous vous en servez, la valeur est fausse.
9. **Publiez la page `oxvehicle.fr/share/{token}`.** L'application fabrique l'URL
   en dur (`sharesService.ts:58`) et la RPC `get_shared_progression` est déjà
   exécutable par `anon`. Un partage existe en base, expiré, jamais consulté :
   dites-nous si la page existe.
10. **Expliquez-nous deux comptes** — `louis.arnd05@icloud.com` et
    `shadowsresidents@gmail.com` existent dans `public.users` sans compte
    `auth.users` : ils ne peuvent se connecter nulle part. Nous n'y toucherons
    pas.
11. **Dites-nous comment vous traitez le pilote authentifié par Apple.** Un
    pilote sur onze n'a pas de mot de passe et porte une adresse
    `@privaterelay.appleid.com` : il ne peut probablement pas ouvrir son compte
    chez vous, et vos emails passent par le relais. C'est pourtant l'un des deux
    seuls pilotes à avoir un pseudo public et des sessions capturées.
12. **Tranchez la décharge.** Trois mécanismes coexistent —
    `eligibility_items.item_key = 'decharge'` (case admin),
    `pilot_waiver_signatures` (e-sign de l'application, drapeau `pilot_waivers` à
    `false`), et Yousign (qui ne concerne que `founding_members`). Lequel fait
    foi, et qui coche l'item d'éligibilité à partir de lui ?
13. **Confirmez la règle de rapprochement `sessions` ↔ `telemetry_sessions`**, si
    elle existe. `telemetry_sessions.event_id` est NULL sur les 18 lignes : une
    capture n'est aujourd'hui reliée à aucune journée vendue.
14. **Prévenez-nous avant de changer `registrations.offer_type` ou ses valeurs.**
    Cette colonne décide du niveau de détail du QDI affiché au pilote
    (`qdiService.ts:302-313`) : `signature` et `heritage` donnent la lecture
    détaillée, le reste la lecture simple. Un renommage d'offre modifie
    silencieusement ce que le pilote voit.

---

## Rôle COACH — recrutement, consentement, prestation

### Lisez d'abord ceci

Il n'y a **aucun compte coach en production**. `select role, count(*) from
public.users group by role` renvoie `pilot 11`, `admin 2`, `partner 1`. La valeur
`coach` existe dans l'énuméré `user_role` (`pilot, admin, coach, partner,
pro_pilot`, vérifié en base) mais aucune ligne `users` ne la porte.

Un compte l'a portée. Trace dans `admin_audit` (`where action = 'role_changed'`) :

| compte | transition | horodatage UTC |
| --- | --- | --- |
| `6edd7f5c-…` | `coach` → `admin` | 2026-07-18 14:43:48 |
| `6edd7f5c-…` | `admin` → `pilot` | 2026-07-20 15:09:01 |
| `88203298-…` | `admin` → `partner` | 2026-07-07 21:02:23 |

Le compte `6edd7f5c-…` a donc été coach jusqu'au **18 juillet 2026**. Tout ce que
vous lirez ci-dessous décrit une mécanique **complète en base et en code, mais
jamais exercée par un vrai coach**. Les chiffres de production que nous donnons
sont des restes de recette, pas un usage. Sur cet axe, la base ne vous apprendra
presque rien par l'observation : le contrat se lit dans le schéma et dans le
code.

---

### Recrutement — la candidature, que nous pensons vôtre

La table `demandes_inscription` porte un énuméré `oxv_demande_type` dont les
valeurs sont `pilote`, `pilote_pro`, **`coach`**, `partenaire` (vérifié en
base). Elle porte aussi des colonnes qui n'ont de sens que pour une candidature
de coach (vérifié en base, `information_schema.columns`) :

`bpjeps`, `rc_pro`, `pro_status`, `coaching_years`, `coaching_tracks`,
`coaching_pilots`, `coaching_pitch`.

Contenu réel :

```sql
select type_demande::text, statut::text, count(*)
from demandes_inscription group by 1,2;
-- pilote/acceptee 3 | pilote/en_attente 1
```

**Zéro candidature de type `coach`.**

RLS de cette table (vérifié en base, `pg_policies`) : `demandes_insert_public`
autorise l'INSERT aux rôles **`anon` et `authenticated`**, sous condition
`statut = 'en_attente' AND consent_cgv AND consent_rgpd AND consent_contact` ;
la lecture et la mise à jour sont réservées à `oxv_is_admin()`. Le rôle `anon`
est autorisé en écriture : c'est un formulaire public, donc un formulaire web.

**Vérifié dans le code de l'app** : recherche exhaustive de `demandes_inscription`
dans `C:\Users\Julie\OneDrive\Desktop\oxv-app\src\` et
`C:\Users\Julie\OneDrive\Desktop\oxv-app\app\` — **zéro occurrence**.

**Déduit, à confirmer par le site** : le formulaire de candidature coach est une
page du site. Nous ne savons pas s'il est publié, ni s'il expose les champs
BPJEPS / RC pro / pitch.

Trois fonctions Edge servent ce circuit et sont `ACTIVE` en production
(vérifié via l'API Supabase) : `send-application-ack`, `admin-review-inscription`,
`validate-inscription`. **Aucune n'est appelée par l'application.** La liste
exhaustive des invocations côté app (vérifié par
`grep -rhoP "invoke\(\s*'[^']+'" src/ app/`) est : `coach-ai-draft`,
`coach-ai-validate`, `compute-session-insights`, `cron-analyze-pending-sessions`,
`generate-debrief-ai`, `notify-coach-consent-received`,
`notify-pilot-coach-assigned`, `pair-app`, `send-coach-invitation`.

`admin_audit` porte des actions `application_ack_relayed` et
`inscription_accept_relayed` (les plus récentes du 21 juillet 2026) qu'aucun code
de l'app ne produit. **Déduit** : c'est votre back-office qui les écrit.

### Recrutement — l'attribution du rôle

Côté app, un administrateur promeut un pilote depuis
`C:\Users\Julie\OneDrive\Desktop\oxv-app\app\(admin)\preparation.tsx` ligne 91,
qui appelle `promoteToCoach()` —
`C:\Users\Julie\OneDrive\Desktop\oxv-app\src\services\coachAdminService.ts`
ligne 249 : `supabase.from('users').update({ role: 'coach' }).eq('id', userId)`.
Le chemin inverse, `demoteToPilot()`, même fichier ligne 269, écrit
`role: 'pilot'` ; il est branché sur
`C:\Users\Julie\OneDrive\Desktop\oxv-app\app\(admin)\coachs.tsx` ligne 85.

La base garde la porte. Déclencheur `guard_users_privileged_columns` (vérifié en
base, `pg_get_functiondef`) : toute modification de `role` ou `kyc_status` lève
une erreur `42501` sauf si `current_user` vaut
`service_role`/`postgres`/`supabase_admin`/`supabase_auth_admin`, ou si
`is_admin()` est vrai.

**Conséquence pour vous** : une promotion faite avec la clé de service passe,
mais **ne sera attribuée à personne** — les deux lignes `role_changed` de
production ont `metadata.changed_by = null`, ce qui suggère une écriture hors
session admin authentifiée. **À confirmer par le site** : qui a fait ces deux
changements, et par quel canal.

Deux effets automatiques suivent la promotion. D'abord le déclencheur
`ensure_coach_permissions` (vérifié en base), sur `INSERT` et `UPDATE` de
`users` : dès que `role = 'coach'`, il insère
`coach_permissions (user_id, can_view_pilots = true)` en `ON CONFLICT DO NOTHING`.
Ensuite, rien ne nettoie cette ligne à la rétrogradation : `coach_permissions`
contient **1 ligne** en production, celle de `6edd7f5c-…`, avec les trois
permissions à `true`, `updated_at` au 2026-06-17. Le compte n'est plus coach.

### Recrutement — l'invitation par courriel

`sendCoachInvitation()` — `coachAdminService.ts` ligne 220, appelée depuis
`C:\Users\Julie\OneDrive\Desktop\oxv-app\app\(admin)\coachs\[id].tsx` ligne 141 —
invoque la fonction Edge `send-coach-invitation` (statut `ACTIVE`, version 18,
vérifié via l'API), avec `email`, `firstName`, `lastName` et un
`temporaryPassword` optionnel.

---

### L'onboarding propre au coach

Groupe de routes dédié :
`C:\Users\Julie\OneDrive\Desktop\oxv-app\app\(coach-onboarding)\` — trois écrans
(`index.tsx`, `mission.tsx`, `pacte.tsx`). Le troisième fait signer un **pacte de
coaching distinct du pacte de pilotage** (`pacte.tsx` lignes 36-50) :
`acceptCoachPact()`, puis `acceptCguAndPrivacy()`, puis `completeOnboarding()`.

Traces en base, sur `users` : `coach_pact_accepted_at` (timestamptz) et
`coach_pact_version` (text). Version applicative : `COACH_PACT_VERSION = '1.0'` —
`C:\Users\Julie\OneDrive\Desktop\oxv-app\src\services\onboardingService.ts`
ligne 19.

Contenu réel (`select id, role, coach_pact_accepted_at from users where
coach_pact_accepted_at is not null`) : **deux signatures, zéro coach**.
`88203298-…`, aujourd'hui `partner`, signé le 2026-06-08 ; `6edd7f5c-…`,
aujourd'hui `pilot`, signé le 2026-06-17. Les deux en version `1.0`. La signature
n'est jamais effacée par la rétrogradation.

**Ce que nous attendons de vous ici** : si le site fait signer quoi que ce soit
au coach, il doit écrire ces deux colonnes et **pas d'autres**, avec la même
chaîne de version. Une version divergente casse la preuve de consentement.

---

### Le profil public du coach

Table `coach_profiles`, clé primaire `coach_id`. Colonnes qui comptent (vérifié
en base) :

| colonne | type | rôle |
| --- | --- | --- |
| `is_published` | boolean, défaut `false` | **l'interrupteur de visibilité** |
| `headline`, `bio`, `palmares`, `photo_url` | text | vitrine |
| `specialties` (text[]), `circuits` (uuid[]), `media`, `socials` (jsonb) | | vitrine |
| `session_price_eur`, `season_price_eur` | integer | **prix indicatifs, jamais transactionnels** |
| `payment_link` | text | lien de paiement du coach, hors OXV |
| `invoicing_assist_enabled` | boolean, défaut `false` | aide à la facturation acceptée |
| `billing_name`, `billing_address`, `billing_siret`, `billing_legal_form` | text | identité de facturation |
| `vat_regime` (défaut `'franchise'`), `vat_rate` | text / numeric | régime TVA |

RLS (vérifié en base) : `coach_profiles_read_published` (SELECT si
`is_published = true`), `coach_profiles_read_by_linked_pilot` (SELECT si
`is_my_coach(coach_id)`), `coach_profiles_owner_all` (ALL si
`coach_id = auth.uid() AND is_coach()`), `coach_profiles_admin_all`.

Contenu réel : **1 ligne**, `coach_id = 6edd7f5c-…`, `is_published = true`,
`season_price_eur = 300`, `session_price_eur = null`, `billing_siret = null`,
`payment_link` absent, `updated_at` au 2026-07-18 14:58.

Deux faits à retenir. D'abord, **une fiche coach publiée existe pour un compte
qui n'est plus coach** : tout utilisateur authentifié la voit, car
`coach_profiles_read_published` ne regarde pas `users.role`. Si vous bâtissez un
annuaire coach sur cette table, vous afficherez ce profil. Ensuite, **son
propriétaire ne peut plus la dépublier** : `coach_profiles_owner_all` exige
`is_coach()`, faux depuis le 18 juillet. Seul un `is_admin()` peut désormais
mettre `is_published = false`. C'est un cul-de-sac de permission, pas une
décision produit.

Le média du coach vit dans le bucket **`coach-media`, qui est PUBLIC**
(`storage.buckets.public = true`) : la policy `"Anyone can view coach media"`
donne le `SELECT` au rôle `public`. L'écriture, elle, exige
`(storage.foldername(name))[1] = auth.uid()::text AND (is_coach() OR is_admin())`.
Vous pouvez donc servir ces images depuis le site sans signature d'URL, mais pas
y téléverser au nom d'un coach.

---

C'est **la** table de consentement. Tout l'accès d'un coach aux données d'un
pilote en dépend.

### `coach_pilots` — la table de consentement, ses colonnes

| colonne | type | défaut | rôle |
| --- | --- | --- | --- |
| `id` | uuid | `gen_random_uuid()` | |
| `coach_id`, `pilot_id` | uuid | — | contrainte `coach_id <> pilot_id` |
| `active` | boolean | `true` | binôme éteint ou non (levier admin) |
| `pilot_consent_at` | timestamptz | null | **le consentement du pilote** |
| `coach_consent_at` | timestamptz | null | acceptation du coach |
| `initiated_by` | `affiliation_initiator` (`coach`\|`pilot`) | `'coach'` | qui a initié |
| `status` | `affiliation_status` (`pending`\|`active`\|`declined`\|`ended`) | `'pending'` | cycle de vie |
| `level` | `coach_access_level` (`lecture_simple`\|`lecture_detaillee`\|`programme`) | `'lecture_simple'` | **niveau de consentement** |
| `live_sharing_at` | timestamptz | null | consentement au direct |
| `affiliation_price_eur` | integer | null | prix figé au lien |
| `notes`, `created_at`, `created_by` | | | |

### `coach_pilots` — contenu réel : une seule ligne

`select * from coach_pilots;` renvoie un unique binôme, créé le 2026-06-22 07:07 :
`coach_id = 6edd7f5c-…` (rôle `pilot` aujourd'hui), `pilot_id = aad205ed-…`,
`active = true`, `pilot_consent_at = 2026-06-28 13:40`, `initiated_by = coach`,
`level = programme`, et surtout **`status = pending`**, **`coach_consent_at = null`**,
**`live_sharing_at = null`**.

### `coach_pilots` — qui peut créer un binôme

RLS de production (vérifié en base) :

| policy | cmd | condition |
| --- | --- | --- |
| `coach_pilots_insert_by_coach` | INSERT | `coach_id = auth.uid() AND is_coach() AND initiated_by = 'coach'` |
| `coach_pilots_insert_by_pilot` | INSERT | `pilot_id = auth.uid() AND initiated_by = 'pilot'` |
| `coach_pilots_select_own_coach` | SELECT | `coach_id = auth.uid()` |
| `coach_pilots_select_own_pilot` | SELECT | `pilot_id = auth.uid()` |
| `coach_pilots_update_by_coach` | UPDATE | `coach_id = auth.uid()` |
| `coach_pilots_update_own_pilot_consent` | UPDATE | `pilot_id = auth.uid()` |
| `coach_pilots_admin_all` | ALL | `is_admin()` |

**Vérifié dans le code de l'app** : il n'existe qu'**un seul** `insert` sur
`coach_pilots` dans tout le dépôt applicatif —
`C:\Users\Julie\OneDrive\Desktop\oxv-app\src\services\coachAdminService.ts`
ligne 167, `assignPilotToCoach()`, réservé à l'administrateur. Il n'écrit ni
`status`, ni `initiated_by`, ni `coach_consent_at` : les défauts s'appliquent.

Les deux portes « par le coach » et « par le pilote » **ne sont empruntées par
aucun écran**. Un coach ne peut pas ajouter un pilote depuis son espace ; un
pilote ne peut pas s'affilier depuis le sien.

Il existe en base un troisième chemin, **inutilisé par l'app** : la fonction
`redeem_affiliation_code(p_code text)`, `SECURITY DEFINER`, source dans
`C:\Users\Julie\OneDrive\Desktop\oxv-app\supabase\migrations\20260617234112_affiliation_codes.sql`
lignes 55-76. Le coach saisit un code privé porté par `users.affiliation_code`, et
la fonction insère la ligne avec `initiated_by = 'coach'`, `status = 'pending'`,
`coach_consent_at = now()`, `active = false`. **Vérifié dans le code de l'app** :
aucun appel à `redeem_affiliation_code`, `get_or_create_my_affiliation_code` ou
`rotate_my_affiliation_code`.

**Attention** : `users.affiliation_code` est aujourd'hui **réutilisée par un
autre système** — le parrainage d'écurie, via `oxv_get_my_referral_code()` et
`oxv_redeem_referral()`
(`C:\Users\Julie\OneDrive\Desktop\oxv-app\src\services\v2\referralService.ts`
lignes 41 et 59 ; note dans
`C:\Users\Julie\OneDrive\Desktop\oxv-app\docs\architecture\12_CREWS_PROD.md`
lignes 47-51). **Une même colonne, deux usages.**

### `coach_pilots` — le consentement du pilote

Tout passe par
`C:\Users\Julie\OneDrive\Desktop\oxv-app\src\services\pilotConsentService.ts` :
`listMyCoaches()` ligne 75 (lecture seule) ; `giveConsent(id, level)` ligne 117
(écrit `pilot_consent_at = now()` **et** `level`, puis invoque la fonction Edge
`notify-coach-consent-received`, `ACTIVE` en production) ; `setConsentLevel()`
ligne 164 (`level` seul) ; `setLiveSharing()` ligne 182 (`live_sharing_at`) ;
`revokeConsent()` ligne 202 (`pilot_consent_at = null`).

Un chemin de secours administrateur existe : `forcePilotConsent()` —
`coachAdminService.ts` ligne 287 — documenté comme réservé au consentement
recueilli hors application (papier signé).

---

### Les trois niveaux de consentement, et ce que chacun ouvre

L'énuméré `coach_access_level` vaut `lecture_simple`, `lecture_detaillee`,
`programme` (vérifié en base). Libellés montrés au pilote —
`C:\Users\Julie\OneDrive\Desktop\oxv-app\src\services\pilotConsentService.ts`
lignes 23-39 :

| valeur | libellé | promesse affichée |
| --- | --- | --- |
| `lecture_simple` | Sessions seulement | « Votre coach voit vos sessions, vos tours et vos bilans. Pas la donnée brute. » |
| `lecture_detaillee` | Analyse détaillée | « En plus : votre donnée brute et l'analyse virage par virage (Data Lab). » |
| `programme` | Programme | « En plus : un accompagnement suivi dans la durée. » |

Ces promesses sont tenues **par la base**, pas par l'interface. Trois fonctions
`SECURITY DEFINER` (vérifié en base) :

- `is_coach_of(pilot)` : `coach_id = auth.uid() AND pilot_id = … AND active AND
  pilot_consent_at IS NOT NULL`
- `is_detailed_coach_of(pilot)` : idem **et** `level IN ('lecture_detaillee','programme')`
- `is_program_coach_of(pilot)` : idem **et** `level = 'programme'`

Relevé exhaustif des policies de production qui les appellent (vérifié en base,
`pg_policies`) :

**Dès `lecture_simple`** — `telemetry_sessions`, `laps`, `app_session_analyses`,
`session_insights`, `session_intentions`, `session_media`, `vehicles`,
`pilot_notes`, `pilot_signature_snapshots`, `app_progression_shares`,
`coach_annotations`, `coach_queue`, `coach_session_context`,
`coach_pilot_highlight`.

**À partir de `lecture_detaillee`** — `telemetry_frames` (la donnée brute),
`app_segment_analyses` (virage par virage), `biometry_raw` (**donnée de santé,
article 9 RGPD**), `coach_ai_drafts`.

**Seulement en `programme`** — `pilot_development_cycles`, `cycle_steps`.

Le stockage suit : `pilot_media_select` autorise le coach via `is_coach_of()`
**sauf** le sous-dossier `incidents` ; `session_media_storage_select` l'autorise
via `is_coach_of()`.

**Si vous ouvrez un espace coach web, vous héritez de ces trois fonctions
gratuitement.** N'écrivez pas votre propre condition d'accès : appelez-les.

Deux points de vigilance, vérifiés en base. Premièrement, **`is_coach_of()` ne
vérifie pas le rôle de l'appelant** : elle ne regarde que `coach_pilots`. Le
compte `6edd7f5c-…`, rétrogradé le 20 juillet, satisfait toujours
`is_coach_of('aad205ed-…')` et conserve donc, au niveau API, la lecture des
séances, tours et bilans de ce pilote. Le garde de rôle n'existe que dans
l'interface — `C:\Users\Julie\OneDrive\Desktop\oxv-app\app\(coach)\_layout.tsx`
ligne 33. Deuxièmement, le commentaire de `demoteToPilot()`
(`coachAdminService.ts` lignes 259-264) annonce des assignations « dormantes » :
c'est inexact, il faudrait `active = false` et la fonction ne l'écrit pas.

La vue `coach_pilots_view` (`security_invoker = on`, vérifié en base) est le
raccourci de lecture côté coach : `FROM coach_pilots cp JOIN users u ON
u.id = cp.pilot_id WHERE cp.coach_id = auth.uid() AND cp.active AND
cp.pilot_consent_at IS NOT NULL`. Elle expose `first_name`, `last_name`,
`pilot_level`, `avatar_url`, `experience_years`, `ffsa_license`, `vehicle`,
`socials`, `media`. Étant `INVOKER`, elle est sûre à consommer depuis le site
avec la session de l'utilisateur. **Elle ne filtre pas `status`.**

---

### Le point capital : `coach_pilots.status` que personne n'écrit

**Établi, et vérifié des deux côtés.**

Côté code applicatif : recherche exhaustive sur
`C:\Users\Julie\OneDrive\Desktop\oxv-app\src\` et
`C:\Users\Julie\OneDrive\Desktop\oxv-app\app\`. Les seuls `status: 'active'`
trouvés visent `coach_objectives` (`coachObjectivesService.ts` ligne 136) et
`pilot_goals` (`pilotGoalsService.ts` ligne 97). **Aucune ligne de code de
l'application n'écrit jamais `coach_pilots.status`, ni `coach_pilots.coach_consent_at`.**

Côté base : la seule ligne existante est restée à `pending` depuis sa création le
22 juin, alors même que le pilote a consenti le 28 juin.

Or l'application **exige** `status = 'active'` pour amorcer le direct.
`C:\Users\Julie\OneDrive\Desktop\oxv-app\src\services\liveRelayRunner.ts`
lignes 77-85 :

```ts
.from('coach_pilots')
.select('coach_id, level')
.eq('pilot_id', pilotId)
.eq('active', true)
.eq('status', 'active')
.not('pilot_consent_at', 'is', null)
.not('live_sharing_at', 'is', null);
```

Cette quatrième condition a été ajoutée le 26 juillet 2026, commit `29d5cfd`
(« le direct ne partait pas aux bons coachs — 3 constats CRITIQUES »). Le motif
énoncé dans le message de commit : « une demande simplement en attente valait
acceptation ». Le correctif est juste. Sa conséquence, aujourd'hui, est que
**le relais live ne peut structurellement démarrer pour personne**, puisque rien
n'écrit jamais la valeur attendue.

Détail qui compte pour vous : la RLS temps réel, elle, n'exige **pas** `status`.
Migration `20260711181903_live_realtime_authorization.sql` (appliquée en
production) — policies `live_session_recv` et `live_roster_join` sur
`realtime.messages` : elles vérifient `cp.active AND cp.live_sharing_at IS NOT NULL`,
rien de plus. Le verrou `status` vit donc **uniquement dans le client mobile**.

Résumé du désaccord :

| garde | exige `active` | exige `status='active'` | exige `pilot_consent_at` | exige `live_sharing_at` |
| --- | --- | --- | --- | --- |
| `liveRelayRunner` (app) | oui | **oui** | oui | oui |
| RLS `realtime.messages` | oui | non | non | oui |
| `is_coach_of()` (lecture après séance) | oui | non | oui | — |
| vue `coach_pilots_view` | oui | non | oui | — |

### Le site pourrait-il être celui qui écrit `status` ?

**Techniquement, oui.** La policy `coach_pilots_update_by_coach`
(`coach_id = auth.uid()`, sans restriction de colonne) permet à un coach
authentifié de poser `status = 'active'` et `coach_consent_at = now()`. La policy
`coach_pilots_admin_all` le permet à un administrateur. Et le commentaire de la
migration d'origine le dit explicitement —
`C:\Users\Julie\OneDrive\Desktop\oxv-app\supabase\migrations\20260617232606_coach_pilots_bidirectional_affiliation.sql`
ligne 27 : « Le coach peut mettre à jour sa propre relation (accepter, clore)
→ pose `coach_consent_at` / `status` ». Le commentaire de colonne posé en base
dit la même chose : « pending → active (deux consentements) → declined | ended ».

**Le mécanisme a donc été conçu pour être exercé par un écran d'acceptation
côté coach. Cet écran n'existe pas dans l'app.**

**Déduit, à confirmer par le site** : nous ne pouvons pas savoir si votre
back-office écrit cette colonne. La seule ligne de production étant restée à
`pending`, l'observation ne tranche pas — elle suggère seulement que personne ne
l'écrit aujourd'hui. **C'est la question la plus importante de cette section.**

---

Trois tables, toutes lisibles et écrites par l'app —
`C:\Users\Julie\OneDrive\Desktop\oxv-app\src\services\coachMarketplaceService.ts`.

### Place de marché — `coach_availability`, les créneaux

Colonnes : `coach_id`, `circuit_name` (défaut `'Circuit de Haute Saintonge'`),
`starts_at`, `ends_at`, `capacity` (défaut 1), `status` (défaut `'open'`), `notes`.
RLS : `coach_availability_manage_own` (`coach_id = auth.uid()`, **sans**
`is_coach()`), `coach_availability_select_published` (SELECT si le
`coach_profiles` associé est `is_published = true`), `coach_availability_admin_all`.

Contenu réel : **4 lignes**, toutes du compte `6edd7f5c-…`. Trois `cancelled`,
une `open` — 24 décembre 2026 à 13:00 UTC, capacité 3. Cette dernière est
**actuellement visible par tout pilote authentifié**, puisque la fiche du compte
reste publiée.

### Place de marché — `coaching_bookings`, les demandes

Colonnes qui comptent : `pilot_id`, `coach_id`, `availability_id`,
`requested_starts_at`, `circuit_name`, `message`, `pilot_first_name`,
`status` (défaut `'pending'`), `responded_at`, `cancelled_at`, `completed_at`,
`amount_cents`, `billing_status` (défaut `'none'`), `coach_note`.

RLS (vérifié en base) : `coaching_bookings_pilot_insert` exige
`pilot_id = auth.uid() AND status = 'pending'` **et** que la fiche du coach soit
publiée ; `_pilot_select` et `_coach_select` bornent la lecture à sa propre
partie ; `_coach_respond` autorise l'UPDATE au coach ; `_pilot_cancel` n'autorise
au pilote **que** la transition vers `cancelled`.

Statuts manipulés par l'app (`coachMarketplaceService.ts` lignes 130-165) :
`pending`, `accepted`, `declined`, `cancelled`, `paid`, `completed`, `refunded`.
L'app n'en écrit que quatre : `pending` (ligne 384), `accepted`/`declined`
(ligne 503), `cancelled` (ligne 527). **`paid`, `completed` et `refunded` ne sont
écrits par aucun code de l'application** — pourtant une ligne de production porte
`completed`.

Contenu réel : **2 lignes**, toutes deux avec `coach_id = pilot_id = 6edd7f5c-…`
(auto-réservation de recette). Une `completed` du 18 juillet, une `pending` du
20 juillet. `billing_status = 'none'`, `amount_cents = null` sur les deux.

**Fait de schéma à connaître** : contrairement à `coach_pilots`, la table
`coaching_bookings` **n'a aucune contrainte interdisant `coach_id = pilot_id`**.
La preuve est en production.

**Déduit, à confirmer par le site** : le passage à `completed` a probablement été
fait à la main ou par un outil hors app. Les fonctions Edge
`send-booking-confirmation` et `send-payment-confirmed` sont `ACTIVE` en
production et **ne sont appelées par aucun code de l'application**. Nous
supposons qu'elles vous appartiennent.

### Place de marché — `coach_testimonials`, les témoignages

Colonnes : `coach_id`, `author_user_id`, `author_first_name`, `body`,
`published` (défaut `true`). **Aucune colonne de note, de score ou d'étoiles** —
c'est une règle de doctrine, verrouillée par un test applicatif. Merci de ne pas
en ajouter une côté site.

RLS notable : `coach_testimonials_author_write` exige, en plus de
`author_user_id = auth.uid()`, qu'il **existe** une ligne `coaching_bookings`
entre l'auteur et le coach au statut `accepted` ou `completed`. Un témoignage
sans séance est impossible.

Contenu réel : **0 ligne**.

---

### Prestation — messagerie

`coach_messages` — RLS `coach_messages_insert` : l'expéditeur doit être l'un des
deux, **et** il doit exister une ligne `coach_pilots` correspondante avec
`active` et `pilot_consent_at IS NOT NULL` (là encore, **pas** `status`).

Contenu réel : **1 ligne**, du 16 juillet, 5 caractères, jamais lue.

### Prestation — journal d'accès

La fonction `log_coach_view(target_pilot_uuid, action_subtype, target_session_uuid)`
(`SECURITY DEFINER`, vérifié en base) vérifie d'abord que l'appelant est bien
coach du pilote, puis insère dans `admin_audit`. Si l'appelant n'est pas
autorisé, elle **ne lève pas d'erreur** : elle ne fait rien, silencieusement.

Appelée par l'app en trois endroits :
`C:\Users\Julie\OneDrive\Desktop\oxv-app\src\services\coachService.ts` ligne 271,
`…\pilotNotesService.ts` ligne 128 (`carnet_view`),
`…\pilotSignatureSnapshotService.ts` ligne 178 (`empreinte_view`).

Production : deux entrées `coach_view_sessions` seulement (28 juin, 7 juillet).

**Si le site ouvre une lecture coach, il doit appeler cette fonction.** C'est
notre preuve RGPD. Elle est déjà demandée dans le brief du 26 mai — voir
`C:\Users\Julie\OneDrive\Desktop\oxv-app\docs\coach-feature\BRIEF_WEB_PROPAGATION.md`
ligne 118.

### Prestation — facturation

Le coach reste l'émetteur. L'app est un outil, jamais un intermédiaire de
paiement — `C:\Users\Julie\OneDrive\Desktop\oxv-app\src\services\coachBillingService.ts`
lignes 1-12.

L'assistance est **optionnelle** (`coach_profiles.invoicing_assist_enabled`,
défaut `false`). La numérotation est atomique par coach et par année : RPC
`next_coach_invoice_number(p_coach, p_year)` (`coachBillingService.ts` ligne 207),
adossée à `coach_invoice_counters(coach_id, year, next_number)`. La table
`coach_invoices` porte `number`, `lines` (jsonb), `amount_ht`, `vat_rate`,
`vat_amount`, `amount_total`, `vat_note`, `seller` (jsonb, l'émetteur figé),
`buyer_name`, `pdf_path`, `coaching_booking_id` ; la RLS donne au coach ses
factures, au pilote celles qui le concernent, à l'admin toutes. Garde-fou en
code : si `vat_regime <> 'franchise'` et que `vat_rate` est nul, l'émission est
**refusée** plutôt que de sortir une TVA à zéro (lignes 203-205). Les coordonnées
bancaires vivent dans `coach_payout_details` (`iban`, `bic`, `account_holder`,
RLS `coach_id = auth.uid() AND is_coach()`), et les PDF dans le bucket
**`invoices`, privé** (policy `invoices_storage_read_own` : premier segment du
chemin = `auth.uid()`, ou `is_admin()`).

Contenu réel : ces trois tables sont **vides**.

**Point de collision à trancher.** Le schéma contient **deux systèmes de
facturation distincts** : `coach_invoices` + `coach_invoice_counters` d'un côté,
`invoices` + `invoice_counters` de l'autre. La fonction Edge `generate-invoice`
est `ACTIVE` en production et **n'est appelée par aucun code de l'application**.
**Déduit** : elle sert votre facturation d'événements.

### Recensement des tables coach et de leur volume réel

Comptage exhaustif en production : `coach_availability` **4**,
`coaching_bookings` **2**, `coach_pilots` **1**, `coach_profiles` **1**,
`coach_permissions` **1**, `coach_messages` **1**.

**Zéro ligne** pour les dix-huit autres : `coach_ai_drafts`,
`coach_annotations`, `coach_annotation_template`, `coach_corner_reference`,
`coach_invoices`, `coach_invoice_counters`, `coach_objectives`,
`coach_objective_events`, `coach_payout_details`, `coach_pilot_highlight`,
`coach_queue`, `coach_reading_weights`, `coach_roulages`,
`coach_session_context`, `coach_testimonials`, `pilot_development_cycles`,
`pilot_notes`, `pilot_sheets`. Le modèle est entièrement spéculatif à ce jour.

---

### Ce qui casserait si vous touchiez à tel objet

| objet | si vous y touchez | ce qui casse dans l'app |
| --- | --- | --- |
| `coach_pilots.pilot_consent_at` | vous l'effacez | le coach perd **immédiatement** toute lecture : `is_coach_of()`, `is_detailed_coach_of()`, `is_program_coach_of()`, la vue `coach_pilots_view`, la messagerie, le stockage média. C'est voulu. |
| `coach_pilots.active` | vous le passez à `false` | même effet, plus la messagerie. |
| `coach_pilots.level` | vous le modifiez | vous modifiez un **consentement**. Passer de `programme` à `lecture_simple` ferme rétroactivement les cycles de développement ; l'inverse ouvre la donnée brute et la **biométrie** sans que le pilote l'ait décidé. À ne jamais faire côté site. |
| `coach_pilots.status` | vous écrivez `active` | vous **débloquez** le relais live. Vous devenez le seul auteur de cette valeur. Prévenez-nous. |
| `coach_pilots.live_sharing_at` | vous l'écrivez | vous consentez au direct **à la place du pilote**. Ne le faites pas. |
| `coach_profiles.is_published` | vous le passez à `true` | la fiche, les créneaux et la possibilité de demander une séance s'ouvrent d'un coup (trois RLS en dépendent). |
| `users.role` → `coach` | vous promouvez | déclencheur `ensure_coach_permissions` crée la ligne de permissions ; l'app envoie le compte vers `/(coach-onboarding)` à la connexion suivante. |
| `users.role` → autre | vous rétrogradez | l'app ferme l'espace coach, **mais la base continue d'autoriser la lecture** via `is_coach_of()`. Il faut aussi passer `coach_pilots.active` à `false`. |
| `users.affiliation_code` | vous le régénérez | vous invalidez **deux** systèmes à la fois : l'affiliation coach et le parrainage d'écurie. |
| enum `coach_access_level` | vous ajoutez une valeur | l'app est *fail-closed* : un niveau inconnu **n'ouvre rien** (`liveRelayRunner.ts` ligne 91). Elle ne plantera pas, elle refusera. |
| enum `affiliation_status` | vous ajoutez une valeur | l'app ne connaît que `active` pour le direct ; tout le reste est traité comme non-actif. |
| bucket `coach-media` | vous le passez en privé | les vitrines coach de l'app cassent (URL publiques non signées). |
| table `coach_testimonials` | vous ajoutez une note/étoiles | rupture de doctrine, verrouillée par un test applicatif : la mise à jour du dépôt échouera. |

---

### Ce que nous demandons au site

1. **`coach_pilots.status` — écrivez-vous cette colonne ?** C'est la question
   numéro un. Aucune ligne de code de l'application ne pose jamais
   `status = 'active'` ni `coach_consent_at`, alors que l'app exige
   `status = 'active'` pour amorcer le partage en direct
   (`liveRelayRunner.ts` ligne 83). Si vous ne l'écrivez pas non plus, le direct
   est aujourd'hui structurellement impossible et il faut décider **de quel côté**
   se pose l'acceptation du coach.
2. **`coach_consent_at` a-t-il pour vous une valeur juridique ?** Nous le
   traitons comme le symétrique de `pilot_consent_at`, sans l'écrire. Si le pacte
   ou les CGV du site s'appuient dessus, dites-le : nous devrons le poser.
3. **Le formulaire de candidature coach existe-t-il, et sur quelle page ?**
   `demandes_inscription` accepte `type_demande = 'coach'` et porte sept colonnes
   dédiées (BPJEPS, RC pro, statut pro, années, circuits, pilotes suivis, pitch).
   Zéro candidature de ce type en production. Nous voulons savoir si le
   formulaire est publié, quels champs il expose et lesquels sont obligatoires.
4. **Qui promeut un coach, et avec quelles clés ?** Les deux `role_changed` de
   production ont `metadata.changed_by = null`, ce qui suggère une écriture hors
   session admin. Confirmez le canal (back-office web ? clé de service ? SQL
   direct ?) pour que la traçabilité soit exploitable.
5. **Envoyez-vous une invitation coach, et par quel moyen ?** Nous appelons la
   fonction Edge `send-coach-invitation`. Si vous envoyez un second courriel par
   un autre canal, le coach en reçoit deux.
6. **Le compte `6edd7f5c-…` doit-il rester ainsi ?** Sa fiche coach est
   `is_published = true` et un créneau `open` du 24 décembre 2026 est visible par
   tous les pilotes, alors qu'il n'est plus coach. Il ne peut plus dépublier
   lui-même (`coach_profiles_owner_all` exige `is_coach()`). Il faut un
   administrateur, ou une décision de votre côté.
7. **Reproduirez-vous le garde de rôle ?** `is_coach_of()` ne vérifie pas
   `users.role`. Un espace coach web sans garde explicite `role = 'coach'`
   ouvrirait l'accès aux anciens coachs. L'app le garde uniquement dans son
   interface (`app/(coach)/_layout.tsx` ligne 33).
8. **Appellerez-vous `log_coach_view()` ?** À chaque consultation d'un pilote par
   un coach depuis le site. C'est notre seule preuve RGPD, et elle est déjà
   demandée dans le brief du 26 mai 2026.
9. **`users.affiliation_code` : quel usage servez-vous ?** La colonne porte à la
   fois l'ancien code d'affiliation coach↔pilote et le code de parrainage
   d'écurie. Si le site en affiche un, précisez lequel — ou tranchons pour deux
   colonnes distinctes.
10. **Qui fait passer une réservation à `paid`, `completed` ou `refunded` ?**
    L'application n'écrit jamais ces trois statuts, et une ligne de production
    porte `completed`. Les fonctions Edge `send-booking-confirmation` et
    `send-payment-confirmed` sont actives et jamais appelées par l'app.
11. **Deux facturations coexistent** : `coach_invoices` + `coach_invoice_counters`
    (facture émise par le coach, côté app) et `invoices` + `invoice_counters`
    (côté site, servi par la fonction Edge `generate-invoice`). Confirmez que les
    deux séquences de numérotation resteront étanches.
12. **Deux fonctions Edge présentes en production sont absentes de notre dépôt** :
    `capture-membre-fondateur` et `yousign-webhook`, créées le 19 juillet 2026.
    Nous supposons qu'elles sont à vous. Si Yousign doit un jour porter la
    signature du pacte de coaching, il faudra qu'il écrive
    `users.coach_pact_accepted_at` et `users.coach_pact_version` avec la même
    chaîne de version que l'app (`'1.0'`).
13. **Les quatre questions du brief du 26 mai 2026 sont toujours ouvertes** —
    `docs/coach-feature/BRIEF_WEB_PROPAGATION.md` lignes 176-179 : inscription
    coach en libre-service ou sur promotion seule ? courriel d'invitation ?
    notification au pilote lors de l'assignation ? page publique « Devenir coach
    OXV » ? Nous n'avons pas eu de réponse.

---

## Rôle PARTENAIRE — vitrine, offres, médias

Cette section décrit ce que l'application mobile OXV Mirror fait du rôle
`partner` : ce qu'elle lit, ce qu'elle écrit, ce qu'elle ignore, et ce qui
casserait si le site modifiait un objet.

Trois niveaux de certitude sont utilisés, sans exception :

- **[APP]** — vérifié dans le code de l'application (chemin + ligne).
- **[BASE]** — vérifié en base de production `fouvuqkdxarjpjbqnsjq`
  (requête SQL en lecture seule, résultat cité).
- **[DÉDUIT]** — inféré de ce que la base montre et de ce que l'application ne
  fait pas. **À confirmer par le site.**

### 1. L'état réel en production, en cinq chiffres

Requête : `select count(*) from <table>` sur chacune des tables de l'axe,
exécutée le 26/07/2026.

| Table | Lignes en prod | Lecture |
| --- | --- | --- |
| `partner_accounts` | **2** | les deux sont des comptes OXV internes |
| `partner_offers` | **1** | une seule offre, en `draft` |
| `partner_leads` | **0** | aucune demande de contact jamais créée |
| `social_pings` | **0** | aucun point sur la carte, ni OXV ni partenaire |
| `event_partners` | **0** | aucune présence partenaire à un événement |
| `partners` (table homonyme) | **0** | vide, voir §4.6 |
| `corporate_leads` | **0** | formulaire B2B du site, jamais rempli |

Utilisateurs par rôle **[BASE]** : `pilot` 11, `admin` 2, `partner` **1**.
Le seul compte `role = 'partner'` est `gabinfillat@gmail.com`.

Détail des deux `partner_accounts` **[BASE]** :

| `display_name` | `profile_id` → utilisateur | `role` de cet utilisateur | `status` | créé le |
| --- | --- | --- | --- | --- |
| `OXV` | `88203298-…0c3a` → gabinfillat@gmail.com | `partner` | `validated` | 2026-07-07 |
| `OXV · Administration` | `6edd7f5c-…e66e` → administration@oxvehicle.fr | **`pilot`** | `validated` | 2026-07-18 |

**Conséquence directe, à connaître avant toute démonstration** : le second
compte possède bien une fiche entreprise validée, mais son utilisateur n'a pas
le rôle `partner`. L'application le renverra vers l'espace pilote
(`app/(partner)/_layout.tsx:18-20` : `if (profile.role !== 'partner') return
<Redirect href="/(app2)" />`). Il ne verra jamais son espace partenaire. Par
ailleurs `is_partner()` renvoie `false` pour lui **[BASE]**, donc il ne peut
rien téléverser dans le bucket `partner-media` (§6). **[APP + BASE]**

L'axe partenaire est donc **entièrement instrumenté et entièrement vide**.
Toute affirmation sur son comportement réel est une affirmation sur du code,
pas sur du vécu.

### 2. Les neuf écrans de l'espace `app/(partner)/`

2 472 lignes de TSX au total. Tous les écrans sont sombres, en vouvoiement,
sans emoji, et ne montrent **aucune donnée de télémétrie** — garanti non par
le code mais par la RLS : aucune policy `partner` n'existe sur
`telemetry_sessions` ni `telemetry_frames` **[BASE]**.

| Fichier | Lignes | Rôle | Tables touchées |
| --- | --- | --- | --- |
| `_layout.tsx` | 31 | garde stricte `role = 'partner'` | — |
| `index.tsx` | 267 | tableau de bord : statut, compteurs, menu | `partner_accounts`, `partner_offers`, `partner_leads`, `event_partners` |
| `profil.tsx` | 284 | « Ma fiche » : zone, description, documents | `partner_accounts` (UPDATE) |
| `point.tsx` | 530 | « Mon point sur la carte » | `social_pings` (INSERT/UPDATE) |
| `offres.tsx` | 462 | CRUD des offres | `partner_offers` (INSERT/UPDATE/DELETE) |
| `leads.tsx` | 432 | suivi commercial des demandes | `partner_leads` (UPDATE du seul statut) |
| `performance.tsx` | 230 | agrégats dérivés, aucune table nouvelle | lecture `partner_leads` + `partner_offers` |
| `rapports.tsx` | 132 | bilans d'événement partagés par OXV | `b2b_event_reports` (lecture) |
| `facturation.tsx` | 104 | page statique, **aucune requête** | — |

`facturation.tsx` mérite d'être lue par l'équipe du site avant toute
communication commerciale : elle affiche « Rien à régler ici », précise que
les offres « affichent un prix à titre indicatif — OXV ne prélève rien dans
l'application » (`app/(partner)/facturation.tsx:33-35`) et renvoie la
résiliation vers `contact@oxvehicle.fr` (`:46-51`). **Aucun encaissement,
aucun Stripe, aucune facture partenaire n'existe côté app.** **[APP]**

### 3. Le chemin d'entrée d'un partenaire — c'est vous, pas nous

L'application **ne crée jamais** de compte partenaire. Aucun écran, aucun
appel. Vérifié : la seule écriture sur `partner_accounts` dans tout le dépôt
est un `update` (`src/services/partnerService.ts:117-120`), jamais un
`insert`. **[APP]**

La création vient de la fonction edge `validate-inscription`, version 10,
`verify_jwt = true`, protégée par un secret partagé `x-oxv-admin-secret`
**[BASE — code de la fonction lu via l'API Supabase]**. Son commentaire
d'en-tête est explicite :

> `v10 : PARTENAIRE accepté = compte entreprise partner_accounts créé
> 'validated'`

Le flux réel, tel qu'il est écrit dans la fonction :

1. Le prospect remplit un formulaire côté site → ligne dans
   `demandes_inscription` avec `type_demande = 'partenaire'`.
2. Un humain arbitre. L'admin appelle `validate-inscription` avec
   `action = 'accept'`.
3. La fonction crée le compte Auth, insère dans `users` avec
   `role = 'partner'` (mapping `mapRole` : `'partenaire'` → `'partner'`).
4. Elle insère dans `partner_accounts` : `display_name` =
   `demande.company_name` (repli sur prénom + nom, puis « Partenaire OXV »),
   `type = 'autre'`, `contact_email = demande.email`, `status = 'validated'`.
5. Elle envoie un e-mail Resend « Votre inscription est acceptée » avec un
   lien de définition de mot de passe pointant vers
   `${SITE_URL}/?p=reset-password`.

**En base, aucune demande partenaire n'a jamais été traitée** : les 4 lignes
de `demandes_inscription` sont toutes `type_demande = 'pilote'` (3 acceptées,
1 en attente) **[BASE]**. Les deux `partner_accounts` existants ont donc été
créés autrement — vraisemblablement à la main ou par un script d'amorçage.
**[DÉDUIT, à confirmer par le site]**

Le `type` du partenaire est verrouillé par une contrainte **[BASE]** :

```
partner_accounts_type_check CHECK (type IN ('photographe','garage','hotel',
  'restaurant','transport','assurance','loueur','autre'))
```

`validate-inscription` pose systématiquement `'autre'`, et l'app **n'offre
aucun moyen de le changer** — l'écran « Ma fiche » dit d'ailleurs au partenaire
que « le nom, le type et le statut de votre compte sont gérés par OXV »
(`app/(partner)/profil.tsx:137-140`). Aujourd'hui, tous les partenaires
arrivent donc en catégorie « Partenaire » générique côté pilote
(`src/features/club/partenairesLogic.ts:19-32`). **C'est un manque, pas un
choix.** **[APP + BASE]**

### 4. Les tables, une par une

### 4.1 `partner_accounts` — la fiche entreprise (2 lignes)

14 colonnes. Les huit qui comptent :

| Colonne | Type | Écrite par l'app ? | Lue par l'app ? |
| --- | --- | --- | --- |
| `profile_id` | uuid, **UNIQUE**, FK `users(id)` ON DELETE CASCADE | non | oui (clé de résolution) |
| `display_name` | text NOT NULL | non | oui |
| `type` | text NOT NULL, CHECK 8 valeurs, défaut `'autre'` | **non** | oui |
| `status` | text NOT NULL, CHECK `pending`/`validated`/`disabled` | non (sauf admin) | oui |
| `description` | text | **oui** | oui |
| `geo_zone` | text | **oui** | oui |
| `documents` | jsonb | **oui** (liste `{label,url}`) | oui |
| `logo_url` | text | **non** | oui |
| `media` | jsonb | **non** | **non** |
| `contact_email` / `contact_policy` | text | non | oui (fiche pilote) |

L'app n'écrit que trois champs, tous depuis « Ma fiche » :
`src/services/partnerService.ts:109-126` (`geo_zone`, `description`,
`documents`). **[APP]**

Deux colonnes sont un angle mort complet de l'application :

- **`logo_url`** est lue partout (`partnerService.ts:69`, `:273`,
  `app/(app)/partenaire/[id].tsx:148`) mais **jamais écrite**. En prod elle
  contient une URL du bucket `partner-media` **[BASE]**.
- **`media`** (jsonb, ajoutée le 18/07/2026) n'est **ni lue ni écrite** par
  l'app : elle est absente de toutes les listes de colonnes sélectionnées.
  En prod elle contient `[{"url": "…/partner-media/…/media-….webp",
  "type": "image"}]` sur le compte `OXV` **[BASE]**.

**[DÉDUIT]** : le site dispose d'un éditeur de fiche partenaire qui téléverse
logo et galerie dans `partner-media` et écrit `logo_url` + `media`. Les deux
objets ont été créés le 21/07/2026 à 06:09:32 et 06:09:53 UTC, avec
`owner = 88203298-…` (gabinfillat), en `image/webp` de 17 et 20 ko **[BASE]**.
Le format WebP et la conversion sont l'indice le plus net : l'app ne produit
pas de WebP. **À confirmer par le site.**

RLS `partner_accounts` **[BASE]** — noter que ces policies n'ont **aucune
restriction de rôle PostgreSQL** (`polroles` nul), donc elles s'appliquent
aussi à `anon` :

| Policy | Cmd | Expression |
| --- | --- | --- |
| `partner_accounts_select` | SELECT | `profile_id = auth.uid() OR is_admin() OR status = 'validated'` |
| `partner_accounts_insert_self` | INSERT | `profile_id = auth.uid() AND status = 'pending'` |
| `partner_accounts_update_own` | UPDATE | `profile_id = auth.uid() OR is_admin()` |
| `partner_accounts_delete_admin` | DELETE | `is_admin()` |

Le `SELECT` sur `status = 'validated'` est **public au sens fort** : une clé
anon suffit pour lire nom, type, description, logo, zone, e-mail de contact et
politique de contact de tout partenaire validé. C'est probablement voulu (le
site en a besoin pour sa vitrine), mais ce doit être un choix assumé et non
une découverte : `contact_email` est une donnée exposée sans authentification.
**[BASE]**

### 4.2 `partner_offers` — les offres (1 ligne)

14 colonnes. L'app écrit **dix d'entre elles** en un seul appel
(`src/services/partnerService.ts:220-243`) : `partner_id`, `title`,
`description`, `price_eur`, `quota`, `status`, `category`, `valid_until`,
`conditions`, `image_url`.

Points de contrat importants :

- **`price_eur` est un `integer` en EUROS**, pas en centimes. L'app arrondit
  avant écriture (`app/(partner)/offres.tsx:140` : `Math.round(priceEur)`) et
  affiche `« {titre} · {prix} € »`
  (`src/features/club/partenairesLogic.ts:50-52`). Si le site écrit des
  centimes, les pilotes verront des prix ×100.
- **`image_url` est une URL libre saisie au clavier** par le partenaire
  (`app/(partner)/offres.tsx:228-235`, champ « Image (URL) »). Il n'y a
  **aucun téléversement d'image d'offre dans l'app**. Si le site propose un
  upload, il est seul à alimenter cette colonne autrement que par copier-coller.
- **`category` est du texte totalement libre** (placeholder « Ex. Photo,
  hébergement, équipement… »), sans contrainte ni référentiel. La seule offre
  en prod porte `category = 'produit'` **[BASE]**. Aucune valeur commune n'est
  garantie entre les deux produits.
- **`event_id`** (uuid, FK implicite vers `events`) n'est **ni lue ni écrite
  par l'app**. Elle est probablement destinée à rattacher une offre à un
  événement côté site ou back-office. **[DÉDUIT]**

Contrainte **[BASE]** : `status IN ('draft','published','archived')`.

RLS **[BASE]** : lecture si `status = 'published'` **ou** propriétaire **ou**
admin ; écriture réservée au propriétaire (`owns_partner_account(partner_id)`)
ou à l'admin. Là encore, `polroles` est nul : une offre `published` est
lisible par `anon`.

### 4.3 `partner_leads` — les demandes de contact (0 ligne)

C'est la table la plus sensible du dossier, parce qu'elle porte un
consentement RGPD.

RLS d'INSERT **[BASE]**, mot pour mot :

```sql
partner_leads_insert_pilot  WITH CHECK (
  pilot_id = auth.uid()
  AND consent_contact = true
  AND (offer_id IS NULL OR offer_id IN (
        SELECT id FROM partner_offers WHERE status = 'published'))
)
```

Trois verrous à la base : le pilote ne peut créer un lead **que pour
lui-même**, **que s'il consent**, et **que sur une offre publiée**.

Côté app, l'insertion se fait dans
`src/services/partnerService.ts:358-377`, avec `channel: 'app_oxv'` en dur
(`:370`), après une confirmation explicite dont la phrase est verrouillée par
test (`src/features/club/partenairesLogic.ts:112-113`) :

> « Vos coordonnées — jamais vos données de pilotage — seront transmises. »

Le partenaire ne voit du lead **ni le nom, ni l'e-mail, ni rien du pilote** :
`listMyLeads` ne sélectionne que `pilot_id` (un uuid opaque), le statut, le
canal et la date (`partnerService.ts:163-166`). L'écran affiche « La mise en
relation passe par OXV : vous ne voyez pas ses données »
(`app/(partner)/leads.tsx:158`). **[APP]**

Deux frictions à régler avec vous :

1. **Le canal `'web'` n'existe pas.** La contrainte est
   `channel IN ('app_oxv','qr_event','admin')` **[BASE]**. Si le site tente
   d'insérer un lead avec `channel = 'web'`, l'insertion **échouera**.
2. **Le libellé côté app ne correspond à aucune valeur autorisée.** La table
   de traduction de l'écran est `{app, web, event}`
   (`app/(partner)/leads.tsx:55-59`), avec repli sur la valeur brute
   (`:62`). Un lead créé par l'app s'affiche donc littéralement « APP_OXV »
   au partenaire. C'est un défaut de notre côté ; nous le corrigerons, mais
   la liste des canaux doit être arrêtée **ensemble**.

Aucun lead n'ayant jamais été créé, rien de tout cela n'a été observé en
conditions réelles. **[BASE]**

`partner_leads` n'a **aucun rapport** avec `corporate_leads` (13 colonnes,
`company`, `sector`, `contact_name`, `guests`, `target_date`…, RLS
`corp_insert_public` ouverte à `anon`, 0 ligne) : cette dernière est le
formulaire B2B du site et **l'app ne la lit ni ne l'écrit** — aucune
occurrence dans le code applicatif **[APP + BASE]**.

### 4.4 `social_pings` — le point du partenaire sur La carte OXV (0 ligne)

25 colonnes. Le partenaire **validé** peut y créer son établissement depuis
`app/(partner)/point.tsx` : catégorie parmi cinq (`event_partner`, `garage`,
`restaurant`, `hotel`, `autre`), nom, description, adresse, latitude,
longitude — relevables depuis le GPS de l'appareil (`point.tsx:116-140`).

L'écriture est délibérément amputée : `upsertMyPartnerPing`
(`src/services/socialPingsService.ts:330-357`) n'envoie que `partner_id`,
`kind`, `title`, `description`, `address`, `lat`, `lon` et **`is_published:
false` en dur** (`:341`). Les colonnes marketing (`website_url`,
`instagram_url`, `facebook_url`, `youtube_url`, `image_url`, `live_url`,
`event_url`, `starts_at`, `ends_at`, `contact_email`, `media`,
`share_token`) sont **lues** par le mapper (`:88-110`) mais **jamais écrites
par le partenaire**. Soit elles sont réservées à l'admin (l'app a bien un
`upsertPing` admin qui les écrit, `:239-280`), soit le site les alimente.
**[APP ; le reste DÉDUIT, à confirmer.]**

La RLS impose la même discipline **[BASE]** :

```sql
social_pings_partner_insert WITH CHECK (
  partner_id IN (SELECT id FROM partner_accounts
                 WHERE profile_id = auth.uid() AND status = 'validated')
  AND is_published = false )
social_pings_partner_update USING (…validated…)
                            WITH CHECK (… AND is_published = false)
```

Toute modification par le partenaire **repasse en non-publié**. La publication
est l'acte de validation, et elle appartient à l'admin
(`social_pings_admin_all`). L'app le dit au partenaire :
« Chaque enregistrement repasse par la validation OXV avant affichage »
(`point.tsx:288-291`).

**Le piège de visibilité, à connaître.** Un point publié n'est visible que via
`social_pings_select_member : (is_published AND is_validated_member()) OR
is_admin()`, et `is_validated_member()` teste `users.kyc_status = 'validated'`
**[BASE]**. Or en production, **2 utilisateurs sur 14 sont `kyc_status =
'validated'`, les 12 autres sont `pending`** **[BASE]**. Un partenaire qui
publie son point aujourd'hui serait donc invisible pour 12 comptes sur 14.
Si le site affiche la même carte au public, il ne peut pas passer par cette
policy — il lui faut le `service_role` ou une vue dédiée. **[DÉDUIT]**

Enfin, une seconde policy coexiste, `social_pings_partner_manage : is_partner()
AND owner_id = auth.uid()` (ALL), qui n'impose **pas** `is_published = false`.
Elle s'appuie sur `owner_id`, colonne que l'app n'écrit jamais. Deux modèles
de propriété cohabitent donc sur la même table — `partner_id` (utilisé par
l'app) et `owner_id` (inutilisé par l'app). **[BASE + APP]** Une écriture du
site via `owner_id` contournerait la remise en non-publié. **À arbitrer.**

### 4.5 `event_partners` — présence à un événement (0 ligne)

5 colonnes : `event_id`, `partner_id`, `status` (enum
`event_partner_status`, défaut `'invited'`), `created_at`. Unicité sur
`(event_id, partner_id)` **[BASE]**.

L'app est **en lecture seule** de son côté : `listMyEventPartnerships`
(`src/services/eventsService.ts:473-478`) ne fait qu'un `select` joint sur
`events`, affiché en bas du tableau de bord partenaire
(`app/(partner)/index.tsx:188-202`). L'écriture existe dans le service mais
n'est appelée que depuis l'espace admin (`eventsService.ts:451`, `:462`).

RLS **[BASE]** : `event_partners_partner_select : owns_partner_account
(partner_id)` en lecture, `event_partners_admin_all` pour tout le reste.
Un partenaire ne peut donc **pas** s'inscrire lui-même à un événement.

`events` compte **1 ligne, en `status = 'private'`** **[BASE]**.

### 4.6 `partners` — la table homonyme, vide, et le piège de nommage

Il existe une table `partners`, **distincte de `partner_accounts`**, 22
colonnes (`name`, `partner_type`, `logo_url`, `address`, `city`, `region`,
`lat`, `lon`, `url`, `contact_email`, `contact_phone`, `circuit_id`,
`is_official_partner`, `is_premium`, `is_published`, `owner_id`,
`created_by`, `media` jsonb NOT NULL défaut `'[]'`). Créée par la migration
`supabase/migrations/20260613210035_carte_lieux_dedies.sql:12`, aux côtés de
`lodgings` et `restaurants`.

**Elle contient 0 ligne** — comme `lodgings` (0) et `restaurants` (0) et
`circuit_services` (0) **[BASE]**.

L'app ne l'écrit jamais. Elle la lit à un seul endroit :
`src/services/placesService.ts:50-53`, `select … where is_published = true`,
pour l'annuaire de lieux. **[APP]**

C'est le principal risque de malentendu entre nos deux équipes :
`partners` = **annuaire éditorial de lieux** (publié par `is_published`,
propriété `owner_id`/`created_by`, ancré à un circuit) ; `partner_accounts` =
**compte entreprise authentifié** (propriété `profile_id` UNIQUE, publié par
`status = 'validated'`).

Les offres, les leads, les points de carte et les présences événement pointent
**tous** vers `partner_accounts`, jamais vers `partners` — FK vérifiées
**[BASE]** : `partner_offers_partner_id_fkey`, `partner_leads_partner_id_fkey`,
`social_pings_partner_id_fkey`, `event_partners_partner_id_fkey`, toutes
`REFERENCES partner_accounts(id) ON DELETE CASCADE`.

**[DÉDUIT]** : `partners` est un vestige de la phase « carte des lieux » que
`partner_accounts` a remplacé le 28/06/2026 (migration
`20260628130251_partner_marketplace_foundation`). Si le site ne s'en sert pas
non plus, elle est candidate à la suppression. **À confirmer avant toute
décision.**

### 4.7 `partner_media` — cette table n'existe pas

Aucune table `partner_media` dans le schéma `public` **[BASE]**. Ce qui existe :

- la colonne `partner_accounts.media` (jsonb), ajoutée le 18/07/2026 ;
- la colonne `partners.media` (jsonb NOT NULL défaut `'[]'`) ;
- la colonne `social_pings.media` (jsonb NOT NULL défaut `'[]'`) ;
- le **bucket de stockage** `partner-media` (§6).

Les tables `media` (13 colonnes), `session_media` (15) et `media_exports` (6)
existent et sont **toutes vides** **[BASE]** ; elles concernent l'axe photo
pilote, pas le partenaire.

### 5. Les portes de validation — le point le plus délicat du dossier

Deux triggers gouvernent la publication. Ils ont été appliqués en production
**le 18 juillet 2026 sans jamais avoir été versionnés dans notre dépôt** ;
nous les avons reconstitués le 26/07/2026 depuis
`supabase_migrations.schema_migrations` (en-tête explicite dans
`supabase/migrations/20260718111150_validation_admin_coach_partenaire_site.sql`).
Le nom du fichier d'origine contient le mot `site`. **[DÉDUIT]** : ils
viennent de votre côté.

**`trg_partner_offers_publish_gate`** (BEFORE INSERT OR UPDATE) **[BASE]** :

- un non-admin qui insère `status = 'published'` obtient `'draft'` ;
- un non-admin qui modifie une offre déjà `published` la **rétrograde en
  `'draft'`**, sauf s'il l'archive ;
- un non-admin ne peut jamais passer une offre à `'published'`.

Conséquence pratique : **le sélecteur « Publiée » de l'écran offres de l'app
ne publie rien.** Le partenaire peut le choisir (`app/(partner)/offres.tsx:33-37`),
l'écriture part, le trigger la ramène à `'draft'`, et l'écran affiche ensuite
« Brouillon ». C'est cohérent avec la doctrine mais **muet** pour
l'utilisateur. Le seul texte qui s'en approche est « Une offre "publiée" est
visible des pilotes une fois votre compte validé » (`offres.tsx:282-284`) —
qui parle du compte, pas de la validation de l'offre. **Nous devons corriger
ce texte ; il faut d'abord que vous nous confirmiez que le gate reste.**

**`trg_partner_accounts_validation_gate`** (BEFORE INSERT OR UPDATE) : un
non-admin ne peut pas s'auto-valider. Le 18/07 à 14:04, une seconde migration
(`20260718140426_partner_gate_service_role_bypass.sql`) a élargi la condition
à `auth.role() = 'service_role'`, avec ce commentaire : « la création du
compte entreprise par validate-inscription (v10) intervient APRÈS validation
humaine ».

**Attention — ce contournement ne fonctionne qu'à l'INSERT.** Un **second**
trigger existe sur la même table, `trg_guard_partner_account_status`, **BEFORE
UPDATE uniquement**, dont la fonction est **[BASE]** :

```sql
if new.status is distinct from old.status and not is_admin() then
  new.status := old.status;
end if;
```

Il ne connaît pas `service_role`. PostgreSQL exécute les triggers `BEFORE` de
même événement **dans l'ordre alphabétique de leur nom** :
`trg_guard_…` s'exécute **avant** `trg_partner_accounts_validation_gate`.

**Donc : un UPDATE de `partner_accounts.status` fait depuis une fonction edge
en `service_role` est silencieusement annulé.** Aucune erreur n'est levée ;
la valeur revient simplement à l'ancienne. Seul un utilisateur `is_admin()`
peut changer un statut par UPDATE. C'est très probablement un effet de bord
non voulu du correctif du 18/07. **[BASE — déduction de comportement fondée
sur les définitions lues ; nous ne l'avons pas testé en écriture, la consigne
étant lecture seule.]**

### 6. Le bucket `partner-media`

Créé le 19/06/2026, **public** (`storage.buckets.public = true`), sans limite
de taille ni de type MIME **[BASE]**.

Policies `storage.objects` **[BASE]** :

| Policy | Cmd | Expression |
| --- | --- | --- |
| `partner_media_read` | SELECT | `bucket_id = 'partner-media'` — **lecture totalement ouverte** |
| `partner_media_insert` | INSERT | `bucket_id = 'partner-media' AND foldername(name)[1] = auth.uid()::text AND (is_partner() OR is_admin())` |
| `partner_media_update` | UPDATE | idem sans le `OR is_admin()` |
| `partner_media_delete` | DELETE | idem sans le `OR is_admin()` |

La convention de chemin est donc **`<uuid de l'utilisateur>/<fichier>`**, et
non `<id du partner_account>/…`. Elle est imposée par la policy, pas par une
convention documentée.

Contenu réel : **2 objets**, tous deux dans
`88203298-6204-45d9-b6e6-e8d9aa6c0c3a/`, nommés `logo-1784614171286.webp`
(16 974 o) et `media-1784614192652.webp` (20 478 o), créés le 21/07/2026 à
06:09 UTC **[BASE]**.

**L'application ne référence jamais ce bucket** : zéro occurrence de
`partner-media` dans `src/` et `app/` **[APP]**. Elle ne téléverse ni logo ni
photo pour un partenaire ; elle affiche `logo_url` si elle est renseignée,
rien de plus.

**[DÉDUIT]** : le préfixe de nom (`logo-`, `media-`), l'horodatage en
millisecondes et la conversion WebP suggèrent un même code d'upload côté site.
La colonne `partner_accounts.media` a été mise à jour à 06:09:53 — la seconde
même où l'objet `media-…webp` a été créé. **À confirmer par le site.**

Le correctif du 18/07 (`20260718154731_partner_media_et_upload_admin.sql`)
ajoute `OR is_admin()` à l'INSERT : « `is_partner()` strict refusait le compte
multi-casquettes (role=admin) ». **[BASE]**

### 7. Ce que le pilote voit du partenaire, dans l'app

Deux surfaces coexistent, l'une vivante, l'autre orpheline.

**Vivante — `app/(app2)/club/partenaires.tsx`** (459 lignes). Liste des
partenaires `validated` et de leurs offres `published` via `listMarketplace`
(`src/services/partnerService.ts:269-319`), fiche en feuille, puis « ÊTRE MIS
EN RELATION » après confirmation explicite. Catalogue vide en production :
l'écran affiche « Les offres arrivent ». Deux limites qui se verront dès
qu'il y aura du contenu **[APP]** : la puce de catégorie affichée est le
`type` du partenaire et non la `category` de l'offre
(`src/features/club/partenairesLogic.ts:19-32`) ; et la demande de contact est
**toujours rattachée à la première offre** — `offerId: primaryOfferId(partner)`
(`src/features/club/useClubPartenaires.ts:80`), soit `partner.offers[0]`.

**Orpheline — `app/(app)/partenaire/[id].tsx`** (971 lignes). Une vraie
vitrine : logo en grand, galerie des `image_url` des offres, cartes d'offre
avec quota et validité, section contact via `contact_email` et
`contact_policy` (`:148`, `:632-660`). Elle est **actuellement inaccessible** :
elle appartient à l'arbre `(app)`, et depuis le lot L6 l'entrée pilote
redirige vers `(app2)` (`app/index.tsx:104-106`) ; le seul lien qui y mène
part de `app/(app)/coachs.tsx:493`, dans le même arbre déprécié. **[APP]**
Si le site publie une fiche partenaire riche, sachez que l'app en a une
équivalente, écrite mais débranchée.

### 8. Cet espace reste-t-il dans l'app, ou part-il sur le web ?

**Notre position écrite est : il part sur le web.** Elle est datée et sourcée.

`docs/refonte-app/18_APP_VS_WEB.md:35-44`, section « 1.2 Inscription
partenaire — où ? », répond en une ligne — « **Portail web** (à construire) ·
jamais dans l'app pilote » — et développe : l'édition d'une fiche partenaire
est une « opération longue » ; côté app pilote les partenaires apparaissent
« **en lecture seule** dans Club » ; en conclusion : « **l'app mobile ne crée
ni n'édite aucune fiche partenaire. Elle consomme l'annuaire.** » Le tableau
de répartition du même document (`:93-95`) exclut explicitement « édition
fiche partenaire » du mobile et attribue au portail web « espace partenaire
(fiche, offres, leads) ». `docs/refonte-app/00_PLATEFORME_OXV.md:121` dit la
même chose plus court : « web = opérations lourdes + partenaires + business ».

**Il faut cependant dire honnêtement que le code a pris de l'avance sur la
doctrine.** Les neuf écrans existent, écrivent réellement en base, et le
compte du fondateur a été basculé en `role = 'partner'` pour les éprouver —
ce que notre état des lieux documente
(`docs/ETAT_COMPLET_APP_2026-07-26.md:449-452`).

Notre lecture, à valider : **l'espace `(partner)` de l'app est une
préfiguration fonctionnelle, pas la cible.** Il est raisonnable de le geler et
de construire l'expérience partenaire sur le web, à condition que le contrat
de schéma décrit plus haut soit tenu des deux côtés. Ce n'est pas une décision
que nous pouvons prendre seuls. **[DÉDUIT de nos documents — à arbitrer.]**

### 9. Ce qui casse si vous touchez à tel objet

| Objet | Modification | Effet côté app |
| --- | --- | --- |
| `partner_accounts.status` | valeur hors `pending`/`validated`/`disabled` | violation de CHECK ; et `STATUS_LABEL` de `app/(partner)/index.tsx:37-41` renverrait `undefined` → libellé vide |
| `partner_accounts.type` | nouvelle valeur | CHECK à modifier ; côté pilote la catégorie retombe en « Partenaire » (`partenairesLogic.ts:30-32`) |
| `partner_accounts.profile_id` | perte de l'unicité | `maybeSingle()` (`partnerService.ts:72`) lèverait une erreur : le partenaire perdrait tout son espace |
| `partner_accounts` (suppression d'une ligne) | — | CASCADE sur `partner_offers`, `partner_leads`, `social_pings`, `event_partners` |
| `partner_offers.price_eur` | passage en centimes | prix ×100 dans le Club et dans la fiche partenaire |
| `partner_offers.status` | nouvelle valeur | `STATUS_OPTIONS` (`offres.tsx:33-37`) ne la propose pas ; l'offre devient inéditable depuis l'app |
| `partner_leads.channel` | nouvelle valeur | affichée telle quelle au partenaire (repli `leads.tsx:62`) ; valeur hors CHECK = INSERT refusé |
| `partner_leads.consent_contact` | défaut passé à `false` | tous les INSERT pilotes échouent (RLS `consent_contact = true`) |
| `social_pings.kind` | nouvelle valeur | CHECK à étendre ; sinon `PING_KIND_LABELS` (`socialPingsService.ts:75-86`) renvoie `undefined` et `categoryOfKind` la range dans « autres » (`:176-179`) |
| `social_pings.is_published` | publication par le site sans passer par l'admin | contourne la doctrine de validation ; possible aujourd'hui via `owner_id` (§4.4) |
| `is_partner()` / `owns_partner_account()` / `is_validated_member()` | modification | toutes les RLS partenaire en dépendent ; ce sont les trois fonctions pivots |
| Bucket `partner-media` | passage en privé | les logos et médias déjà écrits cessent de s'afficher (l'app utilise l'URL publique brute) |
| Convention de chemin `<uid>/…` | changement | les policies INSERT/UPDATE/DELETE refuseront ; à modifier ensemble |

### Ce que nous demandons au site

1. **Confirmer que le site édite bien `partner_accounts.logo_url` et
   `partner_accounts.media`, et nous donner le format exact de `media`.**
   Nous observons `[{"url": "…", "type": "image"}]` sur une seule ligne. Nous
   avons besoin de la liste fermée des valeurs de `type` et de savoir si
   d'autres clés (légende, ordre, dimensions) peuvent apparaître, avant de
   décider si l'app affiche cette galerie.

2. **Confirmer que le site est bien l'auteur des trois migrations du 18
   juillet 2026** (`…111150_validation_admin_coach_partenaire_site`,
   `…140426_partner_gate_service_role_bypass`,
   `…154731_partner_media_et_upload_admin`). Elles n'avaient jamais été
   versionnées chez nous ; nous les avons reconstituées depuis
   `supabase_migrations.schema_migrations` le 26/07/2026. Si vous les avez
   dans votre dépôt, c'est votre version qui doit faire foi.

3. **Trancher le conflit de triggers sur `partner_accounts.status`.** Le
   trigger `trg_guard_partner_account_status` (BEFORE UPDATE) s'exécute avant
   `trg_partner_accounts_validation_gate` et annule silencieusement tout
   changement de statut fait en `service_role`. Si vous prévoyez de valider ou
   de désactiver un compte depuis une fonction edge, cela ne fonctionnera pas
   aujourd'hui. Confirmez l'intention, nous proposerons une migration.

4. **Arrêter ensemble la liste des canaux de `partner_leads.channel`.** La
   contrainte actuelle est `('app_oxv','qr_event','admin')` : **il n'y a pas de
   canal `web`**. Si le site doit créer des leads partenaire, dites-nous sous
   quel libellé, nous étendrons la contrainte et corrigerons notre table de
   traduction (`app/(partner)/leads.tsx:55-59`).

5. **Décider du sort de la table `partners`.** Elle est vide en production, ne
   porte aucune clé étrangère venant des offres, leads, pings ou événements, et
   l'app ne la lit qu'à un seul endroit (`placesService.ts:50-53`). Si le site
   ne s'en sert pas non plus, nous proposerons sa dépréciation. Si le site s'en
   sert, il faut documenter la frontière avec `partner_accounts` : deux tables
   nommées « partenaire » dans une base partagée est une erreur qui finira par
   coûter cher.

6. **Confirmer que la lecture publique est voulue.** Les policies
   `partner_accounts_select` (`status = 'validated'`) et
   `partner_offers_select` (`status = 'published'`) n'ont aucune restriction
   de rôle : elles s'appliquent à `anon`. Une clé anonyme lit donc nom,
   description, logo, zone, `contact_email` et `contact_policy` de tout
   partenaire validé. Si c'est le socle de votre vitrine publique, très bien —
   mais nous voulons que ce soit écrit noir sur blanc, `contact_email` étant
   une donnée à caractère personnel.

7. **Nous dire comment le site affiche La carte OXV, s'il l'affiche.** La
   policy de lecture `social_pings_select_member` exige
   `users.kyc_status = 'validated'` ; **2 comptes sur 14 seulement** remplissent
   cette condition en production. Un site public ne peut pas passer par là.
   Précisez si vous lisez en `service_role`, via une vue, ou pas du tout.

8. **Confirmer la propriété d'un `social_ping` : `partner_id` ou `owner_id` ?**
   Deux policies coexistent. Celle que l'app utilise (`partner_id`) force
   `is_published = false` à chaque écriture ; l'autre (`owner_id`, jamais
   écrite par l'app) ne le fait pas. Tant que les deux existent, la règle
   « toute modification repasse par la validation OXV » n'est pas garantie au
   niveau de la base.

9. **Confirmer qui alimente les colonnes marketing de `social_pings`** —
   `website_url`, `instagram_url`, `facebook_url`, `youtube_url`, `image_url`,
   `live_url`, `event_url`, `starts_at`, `ends_at`, `contact_email`. L'app les
   lit mais ne les écrit jamais depuis l'espace partenaire. Si personne ne les
   écrit, elles resteront vides.

10. **Nous dire qui doit écrire `partner_offers.event_id`.** L'app l'ignore
    complètement. La colonne existe et laisse penser qu'une offre peut être
    rattachée à un événement. Si c'est un besoin du site ou du back-office,
    précisez-le : cela change ce que l'app doit filtrer côté pilote.

11. **Valider ou invalider l'orientation « espace partenaire sur le web ».**
    Nos documents l'affirment (`docs/refonte-app/18_APP_VS_WEB.md:35-44`), mais
    l'app contient déjà neuf écrans partenaire opérationnels. Nous ne
    supprimerons rien sans arbitrage. Si vous construisez le portail web
    partenaire, dites-nous à quelle échéance : nous gèlerons l'espace `(partner)`
    au lieu de continuer à l'étoffer.

12. **Nous transmettre le formulaire de candidature partenaire du site.**
    `validate-inscription` v10 lit `demande.company_name` pour remplir
    `display_name`, et pose `type = 'autre'` en dur. Aucune candidature
    `type_demande = 'partenaire'` n'existe en base à ce jour. Si votre
    formulaire collecte déjà un secteur d'activité, nous pouvons le mapper vers
    la contrainte `partner_accounts_type_check` et cesser de créer tous les
    partenaires en catégorie générique.

---

## Rôle ADMIN et direction de course

Cette section traite de la question la plus délicate du schéma partagé : qui est administrateur, et
selon quelle définition. Il n'y en a pas une, il y en a trois. Elles ne désignent pas les mêmes
comptes. La production le montre.

Toutes les mesures en base ont été relevées le 26 juillet 2026 sur le projet `fouvuqkdxarjpjbqnsjq`,
en lecture seule. Aucune écriture n'a été faite.

---

### Ce qu'il faut retenir avant d'entrer dans le détail

1. Deux colonnes coexistent sur `public.users` : `role` (énumération) et `is_admin` (booléen).
   Aucune des deux n'est dérivée de l'autre.
2. Trois prédicats d'administration coexistent en base et ne renvoient pas le même ensemble de
   comptes.
3. En production, les deux comptes `role = 'admin'` ont `is_admin = false`, et le seul compte
   `is_admin = true` a `role = 'pilot'`. Le désaccord est total : aucun compte ne porte les deux.
4. La colonne `is_admin` est ouverte en écriture à `authenticated` sur sa propre ligne, et le
   déclencheur de garde ne la couvre pas. Un correctif existe dans le dépôt de l'application, **non
   appliqué**.
5. L'application ne valide aucune demande d'inscription par lecture directe de la table. Ce flux
   est, de notre côté, entièrement relayé.

---

### Les deux colonnes

Relevé sur `information_schema.columns`, table `public.users` (72 colonnes au total) :

| Colonne | Type | Nullable | Défaut |
|---|---|---|---|
| `role` | `public.user_role` | oui | `'pilot'::user_role` |
| `is_admin` | `boolean` | oui | `false` |

L'énumération `public.user_role` vaut, dans l'ordre : `pilot, admin, coach, partner, pro_pilot`.

Les deux colonnes sont nullables. `is_admin` peut donc valoir `NULL`, ce qui n'est pas `false` pour
un test SQL naïf — les prédicats en place s'en protègent par `COALESCE`, un code applicatif écrit
vite ne s'en protégerait pas.

**`role` sert à orienter, `is_admin` sert à ouvrir.** C'est la lecture que nous faisons du code de
l'application, et elle est nette :

- `app/index.tsx` lignes 93 à 107 : l'aiguillage après connexion se fait sur `profile.role`. `coach`
  part vers `/(coach)`, `partner` vers `/(partner)`, `pro_pilot` vers `/(pro)`, tout le reste vers
  le flux pilote. **Le cas `role === 'admin'` n'est pas traité : il tombe dans le flux pilote.**
- `app/(admin)/_layout.tsx` ligne 17 : `if (!profile?.is_admin) return <Redirect href={'/(app2)'}
  />`. La garde de l'espace administrateur de l'application ne regarde **que** `is_admin`. Elle
  ignore `role`.
- `src/components/SpaceSwitcher.tsx` ligne 31 : le sélecteur qui permet de passer d'un espace à
  l'autre teste lui aussi `profile?.is_admin === true`.

*Vérifié dans le code de l'application.* Le profil chargé en mémoire contient bien les deux champs —
`src/store/useAuthStore.ts` ligne 59 sélectionne `is_admin` et `role` dans la même requête.

---

### Les trois prédicats d'administration en base

C'est le point central de cette section. Trois définitions de « administrateur » cohabitent dans le
même projet Supabase.

**1. `public.is_admin()`** — la définition large.

```sql
SELECT COALESCE(
  (SELECT role = 'admin' OR is_admin = true FROM public.users WHERE id = auth.uid()),
  false
);
```

`SECURITY DEFINER`, `STABLE`, `search_path` fixé à `public, pg_temp`.

**2. `public.oxv_is_admin()`** — la définition étroite.

```sql
select exists (
  select 1 from public.users
  where id = auth.uid() and role = 'admin'
);
```

`SECURITY DEFINER`, `STABLE`, `search_path` fixé à `public`. Elle **ignore `is_admin`**.

**3. Un test en clair dans une policy de stockage**, sans passer par une fonction : la policy
`Admins can manage all vehicle photos` sur `storage.objects` (bucket `vehicles`) contient un `EXISTS
(SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')` écrit à la main.

**Poids respectif, mesuré sur `pg_policy` pour le schéma `public` :**

| Prédicat | Policies | Tables distinctes |
|---|---|---|
| `is_admin()` | 150 | 85 |
| `oxv_is_admin()` | 4 | 2 |
| *(total policies du schéma `public`)* | 322 | — |

Les deux seules tables gardées par `oxv_is_admin()` sont **`demandes_inscription`** et
**`corporate_leads`**. *Vérifié en base.*

*Déduit, à confirmer par le site :* ces deux tables, le préfixe `oxv_` de la fonction, et leur objet
(candidatures et prospects entreprise) nous font penser qu'elles ont été posées par le site et non
par l'application. Le code de l'application ne les touche ni l'une ni l'autre — une recherche sur
`demandes_inscription` dans `src/` et `app/` ne renvoie **aucun** résultat, hors types générés
automatiquement (`src/types/database.types.ts`) et fonctions edge.

---

### Le désaccord constaté en production

Répartition réelle de la table `public.users` — **14 lignes** au total :

```sql
select role, is_admin, count(*) from public.users group by 1,2 order by 3 desc;
```

| `role` | `is_admin` | Lignes |
|---|---|---|
| `pilot` | `false` | 10 |
| `admin` | `false` | **2** |
| `pilot` | `true` | **1** |
| `partner` | `false` | 1 |

*Vérifié en base.* Le compte `is_admin = true` est `administration@oxvehicle.fr` (`public_handle` =
`gabin`), créé le 17 juin 2026. C'est le compte du fondateur. Il porte `role = 'pilot'`.

**Aucun compte de la base ne porte à la fois `role = 'admin'` et `is_admin = true`.** Les deux
systèmes désignent des ensembles disjoints.

Conséquences concrètes, par compte :

**Les deux comptes `role = 'admin'`, `is_admin = false`.** Côté serveur ils sont pleinement
administrateurs : `is_admin()` renvoie vrai pour eux, donc les 150 policies et 85 tables leur sont
ouvertes ; `oxv_is_admin()` renvoie vrai aussi, donc `demandes_inscription` et `corporate_leads`
également. Côté application ils sont des pilotes ordinaires : `app/index.tsx` les envoie dans le
flux pilote, `app/(admin)/_layout.tsx` les refoule, le `SpaceSwitcher` reste invisible. **Ils ont
tous les droits et aucune interface.** Ces droits restent accessibles par appel direct à l'API
PostgREST avec leur jeton.

**Le compte fondateur, `role = 'pilot'`, `is_admin = true`.** `is_admin()` renvoie vrai : il ouvre
les 85 tables et l'espace administrateur de l'application. `oxv_is_admin()` renvoie **faux** : il ne
peut ni lire ni écrire `demandes_inscription` et `corporate_leads`, et l'appel à la RPC
`admin_validate_inscription` lui répond `forbidden_not_admin` (`42501`). La policy de stockage sur
le bucket `vehicles` le refuse également. **Il a l'interface et presque tous les droits — sauf
précisément ceux de la validation des inscriptions.**

**L'application, elle, maintient l'accord.** `src/services/adminUsersService.ts` ligne 121 écrit
`.update({ role, is_admin: role === 'admin' })` : toute promotion faite depuis l'écran
`app/(admin)/utilisateurs/[id].tsx` synchronise les deux colonnes. Les trois lignes divergentes en
production n'ont donc **pas** été produites par l'application.

Cette lecture est étayée par l'audit. Les trois seuls événements `role_changed` de
`public.admin_audit` portent tous `metadata.changed_by = null` :

| Date | Ancien rôle | Nouveau rôle | `changed_by` |
|---|---|---|---|
| 2026-07-07 21:02 UTC | `admin` | `partner` | `null` |
| 2026-07-18 14:43 UTC | `coach` | `admin` | `null` |
| 2026-07-20 15:09 UTC | `admin` | `pilot` | `null` |

Le déclencheur `trg_audit_user_role_change` renseigne ce champ avec `auth.uid()`. `null` signifie
qu'il n'y avait **pas de session authentifiée** au moment de l'écriture. *Déduit, à confirmer par le
site :* ces changements ont été faits en `service_role` — console SQL Supabase, script
d'administration, ou back-office du site utilisant la clé de service. Nous ne pouvons pas distinguer
ces trois cas depuis la base.

---

### L'élévation de privilège sur `users.is_admin`

**Statut : ouverte en production au 26 juillet 2026. Correctif écrit, non appliqué.**

Le défaut tient à la composition de quatre faits, chacun vérifié en base séparément.

**Fait 1 — le privilège de colonne.** `information_schema.column_privileges` pour `table_name =
'users'`, `grantee = 'authenticated'` :

| Privilège | Colonnes couvertes |
|---|---|
| `SELECT` | 72 / 72 |
| `INSERT` | 72 / 72 |
| `UPDATE` | **72 / 72** |
| `REFERENCES` | 72 / 72 |

Les 72 incluent `role` **et** `is_admin`. Aucun `GRANT` restreint par colonne n'a été posé sur cette
table.

**Fait 2 — la policy.** Les quatre policies de `public.users`, toutes pour le rôle `authenticated` :

| Policy | Commande | `USING` | `WITH CHECK` |
|---|---|---|---|
| `users_select_own_or_admin` | `SELECT` | `(id = auth.uid()) OR is_admin()` | — |
| `users_insert_own_or_admin` | `INSERT` | — | `(id = auth.uid()) OR is_admin()` |
| `users_update_own_or_admin` | `UPDATE` | `(id = auth.uid()) OR is_admin()` | `(id = auth.uid()) OR is_admin()` |
| `users_delete_admin_only` | `DELETE` | `is_admin()` | — |

Tout compte authentifié peut donc écrire sa propre ligne, sans restriction de colonne au niveau de
la policy.

**Fait 3 — la garde ne couvre pas `is_admin`.** Le déclencheur `trg_guard_users_privileged_columns`
(BEFORE, FOR EACH ROW) appelle `public.guard_users_privileged_columns()`, dont la définition en
production est :

```sql
if (new.role is distinct from old.role
    or new.kyc_status is distinct from old.kyc_status) then
  if current_user not in ('service_role','postgres','supabase_admin','supabase_auth_admin')
     and not coalesce(public.is_admin(), false) then
    raise exception 'OXV: la modification de role/kyc_status est réservée aux administrateurs'
      using errcode = '42501';
  end if;
end if;
```

Deux colonnes protégées : `role` et `kyc_status`. **`is_admin` n'y figure pas.**

**Fait 4 — `is_admin()` accepte le drapeau.** Comme montré plus haut, `public.is_admin()` renvoie
vrai sur `role = 'admin' OR is_admin = true`.

**Composition.** Un compte authentifié quelconque peut exécuter `update public.users set is_admin =
true where id = auth.uid();` : le privilège de colonne l'autorise, la policy l'autorise, la garde ne
le voit pas. À l'issue, `is_admin()` renvoie vrai pour lui, ce qui lui ouvre les 150 policies et 85
tables gardées par ce prédicat, plus les policies de stockage correspondantes (documents, factures,
médias de session, médias pilote, photos du pavillon). Il n'atteint pas `demandes_inscription` ni
`corporate_leads`, gardées par `oxv_is_admin()`.

**Degré de certitude.** Les quatre faits sont vérifiés en base, un par un. La composition n'a
**pas** été exécutée : notre accès est en lecture seule. Nous la présentons comme une conclusion
très forte, pas comme un test réussi. Pour la vérifier vous-mêmes, faites-le depuis une session
`authenticated` non administratrice, sur une branche, jamais en production.

**Aucune trace ne serait laissée.** Le déclencheur `trg_audit_user_role_change` n'observe que
`role`. Une élévation par `is_admin` n'écrirait rien dans `admin_audit`. C'est ce qui nous inquiète
le plus : le défaut est silencieux.

**État des lieux au moment du relevé.** Une seule ligne porte `is_admin = true`, celle du fondateur.
Le drapeau n'a donc pas été utilisé au-delà de ce compte à ce jour. Nous ne pouvons rien dire des
lignes supprimées.

**Le correctif.** Il existe, il est écrit, il n'est pas appliqué :
`supabase/migrations_a_valider/20260726_sec2_guard_is_admin.sql`. Il vit délibérément **hors** de
`supabase/migrations/` pour qu'aucun `db push` ne l'applique par inadvertance. Il fait deux choses :

1. il ajoute `new.is_admin is distinct from old.is_admin` à la condition de
   `guard_users_privileged_columns()`, sans rien changer d'autre — même fonction, même liste de
   rôles techniques exemptés, même code d'erreur `42501` ;
2. il ajoute un déclencheur `trg_audit_user_is_admin_change` qui écrit dans `admin_audit` toute
   modification du drapeau.

Le correctif est purement restrictif, ne modifie aucune donnée, et est réversible en restaurant la
version précédente de la fonction. Il attend l'accord du fondateur, conformément à la règle du dépôt
de l'application (toute modification du schéma de production doit être validée).

**Ce que nous vous demandons ici.** `public.users` est une table partagée. Nous n'appliquerons pas
ce correctif sans vous avoir prévenus, parce qu'il peut casser un flux de votre côté : si votre
back-office écrit `is_admin` avec un jeton `authenticated` plutôt qu'avec la clé de service, il
commencera à recevoir `42501`. Dites-nous si c'est le cas. Un back-office qui écrit en
`service_role` n'est pas concerné : les rôles techniques restent exemptés.

---

### La validation des demandes d'inscription

**La table.** `public.demandes_inscription`, 38 colonnes, **4 lignes** en production. RLS activée, 3
policies.

Colonnes qui comptent : `type_demande` (`public.oxv_demande_type` : `pilote, pilote_pro, coach,
partenaire`), `statut` (`public.oxv_demande_statut` : `en_attente, acceptee, refusee`, défaut
`en_attente`), l'identité (`first_name`, `last_name`, `email`, `phone`, `birth_date`, `city`), le
véhicule, les pièces coach (`ffsa_number`, `bpjeps`, `rc_pro`, `coaching_*`), les pièces société
(`company_name`, `company_siret`, `company_role`, `company_website`), les trois consentements
(`consent_cgv`, `consent_rgpd`, `consent_contact`, tous `NOT NULL DEFAULT false`), et le volet de
traitement : `admin_note`, `reviewed_by`, `reviewed_at`, `created_user_id`, `ack_sent_at`.

État réel des 4 lignes :

| `type_demande` | `statut` | Lignes | `reviewed_by` renseigné | `created_user_id` renseigné | `ack_sent_at` renseigné |
|---|---|---|---|---|---|
| `pilote` | `en_attente` | 1 | 0 | 0 | 1 |
| `pilote` | `acceptee` | 3 | 3 | 3 | 0 |

*Vérifié en base.* La table est **quasi vide** : trois acceptations réelles, une demande en attente.
Tout ce qui suit décrit un mécanisme peu éprouvé — ne lui prêtez pas la solidité d'un flux rodé.

**Les policies :**

| Policy | Commande | Rôles | Expression |
|---|---|---|---|
| `demandes_insert_public` | `INSERT` | `anon`, `authenticated` | `WITH CHECK (statut = 'en_attente' AND consent_cgv AND consent_rgpd AND consent_contact)` |
| `demandes_admin_select` | `SELECT` | `authenticated` | `oxv_is_admin()` |
| `demandes_admin_update` | `UPDATE` | `authenticated` | `oxv_is_admin()` des deux côtés |

L'insertion est ouverte à `anon`. *Déduit, à confirmer par le site :* c'est le formulaire public du
site qui écrit ici, sans compte. La contrainte de consentement est portée par la policy elle-même,
ce qui est un bon réflexe : une demande sans les trois cases cochées est rejetée par la base, pas
seulement par le formulaire.

**Deux RPC, deux gardes différentes.** C'est le second désaccord.

`public.admin_validate_inscription(p_demande_id uuid, p_action text, p_admin_note text, p_dry_run
boolean)` — `SECURITY DEFINER`, `EXECUTE` accordé à `authenticated`. Sa première instruction est `IF
NOT oxv_is_admin() THEN RAISE EXCEPTION 'forbidden_not_admin'`. Elle vérifie que la demande existe
et que son statut est cohérent, lit deux secrets dans le Vault (`edge_functions_base_url`,
`validate_inscription_secret`), et relaie via `net.http_post` vers la fonction edge
`/validate-inscription`. Elle journalise dans `admin_audit` sous l'action
`inscription_<action>_relayed`. Si les secrets sont absents, elle renvoie `not_armed` sans rien
faire.

Deux remarques factuelles. Un jeton `anon` du projet est **écrit en dur dans son corps** ; le
commentaire qui l'accompagne précise que c'est la clé publique, présente dans le HTML du site, et
qu'elle ne sert qu'à franchir `verify_jwt`, l'autorisation réelle étant portée par
`x-oxv-admin-secret` — nous le signalons pour que nul ne le prenne pour une fuite, et pour qu'une
rotation de cette clé n'oublie pas cet endroit. Par ailleurs son bloc `EXCEPTION WHEN OTHERS` avale
toute erreur et renvoie `relay_failed` : un échec de relais ne remonte pas.

`public.admin_review_demande(p_demande_id uuid, p_action text, p_note text)` — `SECURITY DEFINER`,
`EXECUTE` accordé à `authenticated`. Sa première instruction est `if not public.is_admin() then
raise exception 'forbidden'`. Elle traite la demande **directement en SQL** : sur `reject` elle
passe le statut à `refusee` ; sur `accept` elle déduit le rôle cible du `type_demande` (`coach` →
`coach`, `partenaire` → `partner`, tout le reste → `pilot`), cherche un compte existant par
`lower(email)`, met à jour `users.role`, puis passe la demande à `acceptee`. Si aucun compte
n'existe, elle renvoie `needs_account_creation` sans rien créer.

**Le désaccord :** la même opération métier est accessible par deux chemins qui n'acceptent pas les
mêmes comptes. Le fondateur (`role = 'pilot'`, `is_admin = true`) est refusé par
`admin_validate_inscription` et accepté par `admin_review_demande`. Les deux comptes `role =
'admin'` passent les deux. Un même geste réussit ou échoue selon la fonction appelée. Notons au
passage que `admin_review_demande` écrit `users.role` en `SECURITY DEFINER`, contournant donc
légitimement la garde de colonne : c'est un **troisième** chemin d'attribution de rôle, en plus de
l'écran administrateur de l'application et de ce que fait le site.

**Le chemin depuis l'application.** L'application n'appelle **aucune** de ces deux RPC. Recherche
sur `admin_validate_inscription`, `admin_review_demande` et `oxv_is_admin` dans `src/` et `app/` :
aucun résultat hors types générés (`src/types/database.types.ts` lignes 8580, 8585, 8766). L'espace
administrateur de l'application n'a pas d'écran de validation des inscriptions. *Vérifié dans le
code de l'application.*

Il existe en revanche une fonction edge écrite de notre côté et prévue pour cela :
`supabase/functions/admin-review-inscription/index.ts`. Elle vérifie le JWT de l'appelant puis relit
son profil en `service_role` et calcule `role === 'admin' || is_admin === true` (ligne 65) — soit la
définition large, celle de `is_admin()`. Elle délègue ensuite à `validate-inscription` avec le
secret `VALIDATE_INSCRIPTION_SECRET`, et renvoie `503` si ce secret est absent.

**Ce qui reste du côté du site.** *Déduit, à confirmer par le site :* la validation réelle des
demandes se fait chez vous. Notre application n'a ni écran ni appel. Les 3 acceptations en base ont
laissé des traces `inscription_accept_relayed` dans `admin_audit` les 18 et 20 juillet, sans
`ip_address` ni `user_agent` — donc passées par la RPC de relais, pas par un navigateur que nous
puissions identifier.

---

### Modération

**Deux tables, toutes deux vides en production.**

`public.moderation_reports` — **0 ligne**, RLS activée, 3 policies :

| Policy | Commande | Expression |
|---|---|---|
| `moderation_reports_insert` | `INSERT` | `WITH CHECK (auth.uid() = reporter_id AND status = 'nouveau')` |
| `moderation_reports_select` | `SELECT` | `auth.uid() = reporter_id OR is_admin()` |
| `moderation_reports_update_admin` | `UPDATE` | `is_admin()` des deux côtés |

`public.moderation_report_reviews` — **0 ligne**, RLS activée, 1 policy
`moderation_reviews_admin_all` (`ALL`, `is_admin()`). L'énumération `public.moderation_status` vaut
`nouveau, en_cours, resolu, rejete`.

**La règle de confidentialité est portée par le schéma, pas par le code.** Le volet de traitement —
note de résolution, identité du traitant — vit dans une table séparée, visible des seuls
administrateurs. Le signaleur voit le statut de son signalement, jamais ce qui a été écrit dessus.
C'est délibéré (`src/services/moderationService.ts` lignes 1 à 9). **Si le site expose un jour
`moderation_report_reviews`, la confidentialité tombe.**

Côté application : `src/services/moderationService.ts` porte les deux versants. Le versant pilote
(`reportContent`, ligne 61) plafonne à 20 signalements par 24 h et par signaleur — garde
applicative, qui ne remplace pas une garde serveur. Le versant administrateur (lignes 116 à 191)
liste, prend en charge, résout, et alimente l'écran `app/(admin)/moderation.tsx`. Les cibles
signalables sont limitées à `coach_review` et `partner_offer` ; un déclencheur
`moderation_validate_target` vérifie en base que la cible existe et est visible du signaleur.

**Autres gardes de statut, à connaître.** Trois déclencheurs réservent un changement de statut aux
administrateurs, tous au sens large `is_admin()` :

| Table | Déclencheur | Comportement du refus |
|---|---|---|
| `partner_accounts` (2 lignes) | `trg_guard_partner_account_status` | **silencieux** : `new.status := old.status` |
| `scenic_routes` (1 ligne) | `trg_guard_scenic_route_cert` | exception `42501` |
| `ambassador_profiles` | `ambassador_guard_status_trg` | exception, message en clair |

Le cas `partner_accounts` mérite votre attention : une écriture non administratrice sur `status`
renvoie un **succès**, sans que la valeur ait changé. Un client qui ne relit pas la ligne croira
avoir réussi.

---

### La console de direction de course

`app/(admin)/index.tsx` liste **21 entrées**, toutes derrière la garde `is_admin` du layout, en
trois familles.

**Le jour J**, cœur de la direction de course : `tour-controle`, `preparation` (affectations
d'équipement), `en-cours` (état Bluetooth pendant la session), `scan-checkin` (pointage par code de
présence du Pass OXV), `presences`, `devices` (parc de boîtiers), `sessions-media`.

**Administration de la communauté :** `utilisateurs`, `coachs`, `partenaires`, `ambassadeurs`,
`support`, `moderation`, `routes-certification`, `points-carte`.

**Exploitation :** `qualite-data`, `analytique`, `maintenance` (kill-switch et version minimale),
`feature-flags`, `circuit`, `evenements`, `b2b-rapport`.

*Vérifié dans le code de l'application.* Aucune de ces entrées ne concerne la validation des
inscriptions ni les prospects entreprise — cohérent avec le fait que les deux tables correspondantes
sont gardées par `oxv_is_admin()`.

**Ce que fait l'écran `utilisateurs`.** `src/services/adminUsersService.ts` : `listUsers` (ligne 83)
lit `id, email, first_name, last_name, role, is_admin, suspended_at, last_login_at, created_at`,
plafonné à 500 lignes ; `setUserRole` (ligne 118) écrit `{ role, is_admin: role === 'admin' }` ;
`setSuspended` (ligne 127) écrit `suspended_at`, `suspended_by`, `suspension_reason` ;
`setAdminNotes` (ligne 150) écrit `admin_notes`.

Ces quatre colonnes de sanction existent sur `users` et sont partagées. **Une suspension posée
depuis l'application ne bloque rien par elle-même : aucune policy de la base ne teste
`suspended_at`.** C'est un marqueur, pas un verrou. *Déduit, à confirmer par le site :* nous ne
savons pas si votre back-office les lit.

**Feature flags.** `public.app_feature_flags`, **7 lignes**. Deux policies :
`app_feature_flags_read` avec `USING (true)` — **lecture ouverte à tous, y compris `anon`** — et
`app_feature_flags_admin_write` (`ALL`, `is_admin()`). Les 7 clés : `app_payments` (off), `biometry`
(**on**, levé le 25 juillet), `coach_billing` (off), `convoys` (off), `founders` (off),
`pilot_waivers` (off), `video_overlay` (off) ; `updated_by` n'est renseignée sur aucune. Ces
drapeaux pilotent des fonctionnalités de l'application mobile. *Déduit, à confirmer par le site :*
nous supposons que vous ne les lisez pas — si vous les lisez, il faut le dire, car nous les
basculons sans prévenir.

---

### Qualité des données

`public.data_quality_reports` — **0 ligne**, RLS activée, 1 policy `data_quality_reports_admin_all`
(`ALL`, `is_admin()`). Colonnes : `id`, `session_id` (NOT NULL), `severity` (défaut `'warning'`),
`type`, `message`, `status` (défaut `'open'`), `owner_admin_id`, `created_at`, `updated_at`.

Le mécanisme, décrit dans `src/services/adminQualityService.ts` : la détection d'anomalies est
**dérivée**, pas stockée. `detectSessionAnomalies` (ligne 41) lit `telemetry_sessions` et
`app_session_analyses` et calcule à la volée quatre anomalies — `no_frames`, `recording_stuck`
(session jamais clôturée), `analysis_missing`, `no_debrief`. La table ne mémorise que ce qu'un
administrateur a pris en charge ou résolu : zéro ligne signifie « aucun suivi ouvert », pas « aucune
anomalie ».

**Ce périmètre est celui de la télémétrie de l'application** et ne dit rien de la qualité des
données du site. *Déduit, à confirmer par le site :* si vous avez votre propre suivi qualité, il est
ailleurs — nous n'en voyons pas la trace dans le schéma `public`.

---

### Traçabilité : `admin_audit`

Table partagée, **59 lignes**. RLS activée, 3 policies, toutes `is_admin()` — dont une `ALL` et deux
redondantes (`INSERT` et `SELECT`) qui ne changent rien.

Colonnes : `id`, `user_id`, `action`, `ip_address` (`inet`), `user_agent`, `metadata` (`jsonb`),
`created_at`.

Répartition des actions :

| Action | Lignes | Première | Dernière |
|---|---|---|---|
| `login` | 23 | 2026-05-17 | 2026-07-18 |
| `session_analysis_notified` | 13 | 2026-05-25 | 2026-07-02 |
| `contact_ack_relayed` | 7 | 2026-06-16 | 2026-07-04 |
| `coach_annotation_notified` | 3 | 2026-06-18 | 2026-06-18 |
| `application_ack_relayed` | 3 | 2026-07-18 | 2026-07-21 |
| `role_changed` | 3 | 2026-07-07 | 2026-07-20 |
| `inscription_accept_relayed` | 3 | 2026-07-18 | 2026-07-20 |
| `coach_view_sessions` | 2 | 2026-06-28 | 2026-07-07 |
| `inscription_accept_dryrun_relayed` | 2 | 2026-07-18 | 2026-07-18 |

**Trois défauts, à connaître avant de s'y fier.**

**1. `user_id` n'a pas la même signification selon l'action.** Le déclencheur
`audit_user_role_change` y écrit `new.id`, c'est-à-dire la **cible** du changement, et range
l'auteur dans `metadata.changed_by` ; la RPC `admin_validate_inscription` y écrit `auth.uid()`,
c'est-à-dire l'**auteur**. La colonne mélange sujet et acteur : un décompte par `user_id` ne veut
rien dire.

**2. Le contexte manque.** `ip_address` n'est renseignée sur **aucune** des 59 lignes ; `user_agent`
l'est 23 fois, exactement le nombre de `login` ; `user_id` est nul 10 fois.

**3. Aucune trace des changements de `is_admin`** — le seul déclencheur d'audit sur `users` observe
`role`. C'est le point traité par le correctif SEC-2.

*Déduit, à confirmer par le site :* la présence d'actions comme `contact_ack_relayed` et
`application_ack_relayed`, qui ne correspondent à aucun écran de notre application, nous fait penser
que vous écrivez aussi dans cette table. Si c'est le cas, la convention de `user_id` doit être fixée
entre nous, sinon la table restera inexploitable.

**Une collision de nom, enfin.** Deux colonnes `is_admin` existent dans le schéma `public` : celle
de `users`, traitée ici, et celle de `support_messages`, qui marque seulement qu'un message d'un fil
de support a été écrit par un administrateur (`src/services/supportService.ts` ligne 135,
`src/services/supportAdminService.ts` ligne 104). Les deux tables de support sont vides en
production. Une recherche globale sur `is_admin` ramène les deux : ne les confondez pas.

---

### Ce que nous ne savons pas

Les angles morts de cette section, dits franchement. **Quel back-office vous utilisez** : les trois
changements de rôle ont été faits sans session authentifiée, ce peut être votre back-office en
`service_role`, la console SQL de Supabase ou un script, rien en base ne les distingue. **Si vous
lisez `is_admin` ou `role`** — le choix change quels comptes vous laissez entrer. **Si
`demandes_inscription` et `corporate_leads` sont à vous** : nous le pensons — préfixe `oxv_`,
insertion ouverte à `anon`, zéro usage de notre côté — sans l'avoir prouvé. Enfin, les tables de
modération, de support, de qualité et de candidature étant **vides**, tout ce qui en est dit décrit
un mécanisme, pas un usage observé ; et l'élévation de privilège n'a **pas** été exécutée, seulement
composée à partir de quatre faits vérifiés séparément.

---

### Ce que nous demandons au site

1. **Tranchez : `users.role` ou `users.is_admin` ?** L'un des deux doit faire autorité pour l'accès
   administrateur, et l'autre doit devenir dérivé ou disparaître. Tant que les deux coexistent sans
   règle, les deux produits n'admettent pas les mêmes personnes. Notre proposition, si vous n'avez
   pas d'objection : `role` fait autorité, `is_admin` est maintenu en miroir de `role = 'admin'` par
   un déclencheur, et nous corrigeons la garde de l'application pour tester `role === 'admin' ||
   is_admin`. Nous ne l'appliquerons pas sans votre accord.

2. **Confirmez que vous écrivez `users.role` et `users.is_admin` en `service_role`,** et non avec un
   jeton `authenticated`. La réponse détermine si le correctif SEC-2 casse quelque chose chez vous.
   Les rôles techniques (`service_role`, `postgres`, `supabase_admin`, `supabase_auth_admin`)
   restent exemptés de la garde.

3. **Donnez-nous votre feu vert, ou votre refus motivé, sur
   `supabase/migrations_a_valider/20260726_sec2_guard_is_admin.sql`.** Le défaut est ouvert
   aujourd'hui en production : tout compte authentifié peut se déclarer administrateur sur sa propre
   ligne, sans laisser de trace. Nous considérons ce point comme le plus urgent de toute cette
   section.

4. **Confirmez que `demandes_inscription` et `corporate_leads` sont à vous,** et que
   `public.oxv_is_admin()` est votre prédicat. Si oui, dites-nous s'il est volontairement plus
   étroit que `public.is_admin()` ou si c'est un héritage. Le fondateur, en l'état, ne peut pas
   valider une inscription.

5. **Dites-nous laquelle des deux RPC fait foi pour la validation d'une demande** :
   `admin_validate_inscription` (garde `oxv_is_admin()`, relais vers la fonction edge, avec journal)
   ou `admin_review_demande` (garde `is_admin()`, écriture SQL directe, sans journal). Deux chemins
   pour le même geste, avec deux gardes différentes, est une configuration que nous vous proposons
   de réduire à un seul.

6. **Confirmez que le formulaire public du site est bien l'unique écrivain de
   `demandes_inscription`,** et que la contrainte des trois consentements portée par la policy
   `demandes_insert_public` vous convient telle quelle.

7. **Dites-nous si vous lisez `users.suspended_at`, `users.suspension_reason` ou
   `users.admin_notes`.** Aucune policy de la base ne les teste : une suspension posée depuis
   l'application est aujourd'hui un marqueur sans effet. Si vous comptez dessus pour refuser un
   accès, il faut le savoir.

8. **Dites-nous si vous lisez `public.app_feature_flags`.** La lecture y est ouverte à tous, y
   compris `anon`. Nous basculons ces 7 drapeaux au fil des lots, sans prévenir, en considérant
   qu'ils ne pilotent que l'application mobile.

9. **Fixons ensemble la convention de `admin_audit.user_id`** : auteur, ou sujet ? Aujourd'hui c'est
   l'un ou l'autre selon l'écrivain, ce qui rend la table inexploitable pour un décompte. Confirmez
   au passage si vous y écrivez — les actions `contact_ack_relayed` et `application_ack_relayed` ne
   correspondent à rien de notre côté.

10. **Confirmez que la policy de stockage `Admins can manage all vehicle photos`** (bucket
    `vehicles`, test `role = 'admin'` écrit en clair) est à vous. C'est le seul endroit du
    dispositif qui n'utilise ni `is_admin()` ni `oxv_is_admin()`. Elle refuse aujourd'hui le compte
    du fondateur.

11. **Prévenez-nous avant toute modification de `public.users`, de ses policies ou de ses
    déclencheurs.** 85 tables et une bonne part des policies de stockage dépendent de
    `public.is_admin()`, qui lit cette table. Une modification de `is_admin()` ou de
    `oxv_is_admin()` se propage à tout le projet, des deux côtés, sans qu'aucun test de l'un ne
    prévienne l'autre.

---

## Rôle PRO_PILOT, écuries, et le visiteur anonyme

Trois objets que le reste du dossier ne traite pas : un rôle applicatif sans
titulaire, un système d'écuries dont la moitié du mécanisme vit chez vous, et la
surface que la base offre à un visiteur non connecté.

Convention de preuve. « Vérifié dans le code de l'app » renvoie à un fichier et
sa ligne. « Vérifié en base » renvoie à une requête exécutée en lecture seule sur
`fouvuqkdxarjpjbqnsjq` le 26/07/2026, dont le résultat est donné. « Déduit, à
confirmer par le site » signale un raisonnement fondé sur l'absence de code côté
application : nous ne lisons pas votre dépôt et ne pouvons pas conclure seuls.

---

## 1. Le rôle PRO_PILOT

### 1.1 Ce qu'il est, et son poids réel

`pro_pilot` est la cinquième valeur de l'énumération `user_role`.

**Vérifié en base.** `select enumlabel from pg_enum ... where typname='user_role'`
→ `pilot, admin, coach, partner, pro_pilot`.

`select role, count(*) from users group by role` sur les 14 comptes de production :

| `users.role` | lignes |
| --- | --- |
| `pilot` | 11 |
| `admin` | 2 |
| `partner` | 1 |
| `coach` | 0 |
| `pro_pilot` | **0** |

**Le rôle n'a aucun titulaire.** Tout ce qui suit décrit du code livré et testé,
jamais exercé sur un compte réel. C'est la donnée la plus utile de cette
sous-partie : vous pouvez encore peser sur la définition du rôle sans migration
ni reprise d'historique.

### 1.2 Ce qui le distingue du pilote : l'espace, pas les données

**`pro_pilot` ne débloque aucune donnée supplémentaire.** Il ne voit que ses
propres lignes, exactement comme un `pilot`.

**Vérifié en base**, recherche exhaustive dans toutes les policies :

```sql
select tablename, policyname from pg_policies
where schemaname='public'
  and (coalesce(qual,'') ilike '%pro_pilot%' or coalesce(with_check,'') ilike '%pro_pilot%');
```

Résultat : **une seule ligne**, `pro_team_members` / `pro_team_owner_all`. Aucune
table de données pilote (`telemetry_sessions`, `laps`, `app_session_analyses`,
`sessions`, `registrations`) ne mentionne le rôle.

**Vérifié dans le code de l'app**, `app/(pro)/_layout.tsx:2-6` pose la même
chose : « Le pilote pro est un pilote (mêmes données, mêmes RLS own-row) avec un
espace distinct et des outils renforcés. »

La distinction est **de navigation et de mise en scène**, pas de droit.

Le routage est un aiguillage exclusif décidé au démarrage :

- `app/index.tsx:99-101` : `if (profile.role === 'pro_pilot') return <Redirect href={'/(pro)'} />;`
- `app/(pro)/_layout.tsx:26-28` : garde inverse — tout profil non `pro_pilot` est
  renvoyé vers `/(app2)`.

**Conséquence pour vous.** Si vous basculez un compte en `pro_pilot` depuis une
console d'administration, cet utilisateur change d'application entière au
prochain lancement : il perd la barre à cinq onglets du pilote et atterrit dans un
arbre différent. Pas de transition, pas d'écran de bienvenue. L'aller-retour est
réversible sans perte de données, mais brutal pour l'utilisateur.

### 1.3 Les huit fichiers de `app/(pro)/`

Un layout et sept écrans.

| Fichier | Rôle | Ce qu'il lit ou écrit |
| --- | --- | --- |
| `_layout.tsx` | Garde de rôle + barre d'onglets | rien |
| `index.tsx` | Paddock Pro (hub) | `telemetry_sessions`, `laps` (own-row) |
| `performance.tsx` | Lecture comparée descriptive | agrégats déjà calculés |
| `bibliotheque.tsx` | Recherche de séances passées | `telemetry_sessions` (own-row) |
| `media.tsx` | Médias du pilote | `session_media` (own-row) |
| `equipe.tsx` | Entourage déclaré | `pro_team_members` |
| `partage.tsx` | Vitrine publique opt-in | `app_progression_shares` |
| `ambassadeur.tsx` | Candidature ambassadeur | `ambassador_profiles` |

La barre d'onglets pro est séparée de celle du pilote. **Vérifié dans le code**,
`src/lib/proNav.ts:20-27` : `PRO_TAB_ORDER = ['pro-paddock','pro-performance','pro-media','pro-equipe','pro-partage']`.
`src/lib/proNav.ts:2-9` rappelle l'invariant commun : « Compte = icône
haut-droite, JAMAIS un onglet ».

### 1.4 Point structurel : l'espace pro consomme l'ancien arbre pilote comme bibliothèque

**Vérifié dans le code de l'app**, `app/(pro)/index.tsx:29-36`, le tableau `TOOLS`
du Paddock Pro pointe presque entièrement hors de `(pro)` :

| Libellé | Destination |
| --- | --- |
| Mon bilan | `/(app)/bilan` |
| Data Lab | `/(app)/data-lab` |
| Mon passeport | `/(app)/passeport` |
| Ma signature | `/(app)/signature` |
| Mon garage | `/(app)/garage` |
| Ambassadeur OXV | `/(pro)/ambassadeur` |

Cinq destinations sur six entrent dans `app/(app)/`, **l'arbre pilote de première
génération** (80 entrées, `ls app/(app) | wc -l`). Même motif à
`app/(pro)/performance.tsx:34` et `:39` (`/(app)/comparateur`,
`/(app)/progression`) et `app/(pro)/bibliotheque.tsx:177` (`/(app)/bilan`).

Or le pilote ordinaire n'y vit plus : `app/index.tsx:107` le renvoie vers
`/(app2)`, et le commentaire `app/index.tsx:103-106` condamne l'arbre V1 —
« L'arbre v1 reste en place et atteignable […] Il sera retiré après la validation
terrain, pas avant. »

**Ce que cela implique.** L'espace pro n'est pas un produit autonome : c'est une
façade de navigation posée devant un arbre explicitement condamné. Le jour de son
retrait, l'espace pro perdra cinq de ses six outils si personne ne les redirige.
Aucune action en base de votre part — c'est un avertissement de séquencement, au
cas où la décision se prendrait lors d'un chantier commun.

### 1.5 `pro_team_members` : une liste, pas un partage

**Vérifié en base**, colonnes qui comptent :

| Colonne | Type | Défaut |
| --- | --- | --- |
| `pro_user_id` | uuid NOT NULL | — |
| `member_user_id` | uuid NULL | — |
| `member_email` / `member_name` | text NULL | — |
| `role_label` | text NOT NULL | `'Membre'` |
| `access_level` | text NOT NULL | **`'none'`** |
| `invited_at` / `accepted_at` / `revoked_at` | timestamptz | `now()` / NULL / NULL |

RLS active, trois policies :

| Policy | cmd | Expression |
| --- | --- | --- |
| `pro_team_owner_all` | ALL | `USING (pro_user_id = auth.uid())`, `CHECK (pro_user_id = auth.uid() AND is_pro_pilot())` |
| `pro_team_member_read` | SELECT | `member_user_id = auth.uid()` |
| `pro_team_admin_read` | SELECT | `is_admin()` |

`select count(*) from pro_team_members` → **0 ligne.** Le `CHECK` appelant
`is_pro_pilot()`, et aucun compte ne portant ce rôle, **la table est aujourd'hui
physiquement inécrivable.**

`access_level` vaut `'none'` par défaut et l'application n'offre aucun moyen de le
changer. `app/(pro)/equipe.tsx:91-94` l'écrit à l'utilisateur : « Déclarer une
personne ne lui donne aucun accès à vos données — c'est une liste, pas un
partage. » `src/services/proTeamService.ts:4-7` le redit au développeur.

**Ne posez jamais `access_level = 'view'` depuis le site** : la valeur existe dans
le type mais aucun mécanisme de partage n'est branché derrière. Elle afficherait
au pilote un partage qui n'existe pas.

### 1.6 Ce que nous ignorons

**Déduit, à confirmer par le site.** L'application ne sait pas *attribuer* le
rôle : `src/services/adminUsersService.ts:19` l'expose dans une liste
d'administration interne, mais aucun parcours pilote ne permet de devenir pro.
Nous en déduisons une attribution manuelle, chez vous ou en console Supabase.
Nous ignorons s'il existe une contrepartie commerciale attachée au rôle.

---

## 2. Écuries, parrainage et codes d'affiliation

### 2.1 Les deux tables

**Vérifié en base.**

`public.crews` : `id` (uuid PK, `gen_random_uuid()`), `captain_id` (uuid NOT NULL,
le parrain fondateur), `name` (text NULL, nommée après coup), `named_at`
(timestamptz NULL), `created_at` (timestamptz NOT NULL, `now()`).

`public.crew_members` : `crew_id` (uuid NOT NULL), `user_id` (uuid NOT NULL),
`role` (text NOT NULL, défaut `'member'` — sinon `'captain'`), `referred_by`
(uuid NULL), `referral_validated` (boolean NOT NULL, défaut `false` — **voir
2.4**), `joined_at` (timestamptz NOT NULL, `now()`).

Volumétrie : `select (select count(*) from crews), (select count(*) from crew_members)`
→ **`crews` = 0, `crew_members` = 0.** Le système est livré, jamais amorcé.

### 2.2 RLS : lecture seule, écriture interdite en direct

Quatre policies, toutes limitées au rôle `authenticated` :

| Table | Policy | cmd | Expression |
| --- | --- | --- | --- |
| `crews` | `crews_select_member` | SELECT | `is_admin() OR id = oxv_my_crew_id()` |
| `crews` | `crews_admin_all` | ALL | `is_admin()` |
| `crew_members` | `crew_members_select_own_crew` | SELECT | `is_admin() OR crew_id = oxv_my_crew_id()` |
| `crew_members` | `crew_members_admin_all` | ALL | `is_admin()` |

**Aucune policy INSERT ou UPDATE pour un utilisateur ordinaire.** Toute mutation
passe par une fonction `SECURITY DEFINER`. Choix fail-closed délibéré, documenté
dans `docs/architecture/12_CREWS_PROD.md:35-36`.

### 2.3 Les quatre fonctions serveur

**Vérifié en base.**

| Fonction | Retour | `anon` EXECUTE | `authenticated` EXECUTE |
| --- | --- | --- | --- |
| `oxv_get_my_referral_code()` | text | **non** | oui |
| `oxv_redeem_referral(p_code text)` | jsonb | **non** | oui |
| `oxv_my_crew_id()` | uuid | **non** | oui |
| `oxv_name_my_crew(p_name text)` | jsonb | **non** | oui |

Retrait explicite dans
`supabase/migrations/20260704003524_crews_referral_hub03.sql:88-89` :

```sql
revoke execute on function public.oxv_redeem_referral(text) from public, anon;
grant execute on function public.oxv_redeem_referral(text) to authenticated;
```

Règles métier codées en dur dans `oxv_redeem_referral`, qu'aucune écriture directe
ne peut contourner : pas de session → `auth_required` ; code inconnu →
`code_invalide` ; auto-parrainage → `auto_parrainage_interdit` ; **déjà membre →
`deja_dans_une_ecurie`** (un pilote appartient à une écurie et une seule, et
aucune fonction de sortie n'existe) ; si le parrain n'a pas d'écurie, elle est
créée et il en devient capitaine.

Le code de parrainage **est** `users.affiliation_code`, format
`OXV-{PRÉNOM tronqué à 8}-{4 hex}`, généré paresseusement au premier appel — pas
de colonne `referral_code` séparée (`docs/architecture/12_CREWS_PROD.md:47-51`).
`select count(*) from users where affiliation_code is not null` → **0.**

### 2.4 Qui crée, qui rejoint, et de quel côté

**Côté application — vérifié dans le code.** `src/services/v2/referralService.ts`
expose quatre fonctions. Deux sont consommées par des écrans, deux ne le sont pas :

| Fonction du service | Ligne | Appelée par un écran ? |
| --- | --- | --- |
| `getMyCode()` | `referralService.ts:40` | oui — `src/features/vous/useVousHub.ts:201` |
| `getMyCrew()` | `referralService.ts:86` | oui — `useVousHub.ts:202`, `src/features/club/useClubHub.ts:190`, `src/features/club/useClubAmis.ts:134`, `app/(app2)/rec/preparation.tsx:184` |
| `redeem(code)` | `referralService.ts:55` | **non** |
| `nameMyCrew(name)` | `referralService.ts:116` | **non** |

Recherche exhaustive dans `app/` et `src/` : aucune occurrence de `redeem(` ou
`nameMyCrew(` hors du service et de ses tests. Les autres « redeem » du dépôt
concernent l'appairage par code magique (`src/services/pairingService.ts:34`),
sans rapport.

**Conclusion factuelle : l'application affiche un code de parrainage et affiche
l'écurie d'appartenance, mais ne permet ni de rejoindre une écurie, ni de la
nommer.** Le parcours est en lecture seule de bout en bout.

**Déduit, à confirmer par le site.** Trois lectures, indiscernables depuis notre
dépôt : (1) le site porte déjà la saisie de code et l'appel à
`oxv_redeem_referral` ; (2) personne ne le porte encore et la boucle est
inachevée des deux côtés — ce que suggèrent les zéros en base ; (3) le parcours
vise un canal non applicatif (lien d'invitation, page d'inscription). C'est notre
première question ferme.

### 2.5 Le palier de 20 dépend de votre chaîne de paiement

Une écurie devient publique quand elle est nommée **et** compte 20 membres
validés. **Vérifié en base**, corps de `crews_public_rows()` :

```sql
having count(*) filter (where m.referral_validated or m.role = 'captain') >= 20
```

Or `referral_validated` n'est jamais posé à `true` par l'application, mais par un
déclencheur sur la table des paiements. **Vérifié en base** :
`trg_referral_validate`, `AFTER UPDATE OF status ON public.payments`, fonction
`trg_fn_referral_validate()` :

```sql
if new.status = 'succeeded' and old.status is distinct from 'succeeded' then
  update public.crew_members set referral_validated = true where user_id = new.user_id;
end if;
```

Intention documentée en commentaire de table
(`supabase/migrations/20260704003524_crews_referral_hub03.sql:31`) :
« premier paiement validé du filleul (anti-abus : seuls les validés comptent dans
les paliers) ».

État réel : `select count(*), count(*) filter (where status='succeeded'), string_agg(distinct status::text,', ') from payments`
→ **1 ligne, 0 en `succeeded`, seul statut présent `pending`.** Le déclencheur ne
s'est jamais exécuté.

**Vérifié dans le code de l'app :** aucune occurrence de `from('payments')` dans
`src/` ni `app/`. L'application ne touche jamais cette table ; le drapeau
`app_payments` est à `false` en base.

**La validation d'un parrainage est donc un effet de bord de votre pipeline de
paiement.** Trois conséquences :

- un changement de nommage de statut (`paid`, `complete`) **arrête la progression
  des paliers sans erreur visible** — le déclencheur avale ses exceptions
  (`exception when others then raise warning`) ;
- une insertion directe en `succeeded` ne déclenche rien : le trigger est
  `AFTER UPDATE OF status`, pas `AFTER INSERT` ;
- un remboursement ne dévalide rien : le drapeau est irréversible.

Nous ne demandons pas de changement, seulement que ce couplage vous soit connu
avant toute refonte de `payments`.

### 2.6 Ne pas confondre avec l'affiliation coach ↔ pilote

Un second système existe, au vocabulaire proche : `coach_pilots`, l'énumération
`affiliation_initiator` (`coach, pilot`), et les fonctions
`get_or_create_my_affiliation_code`, `redeem_affiliation_code`,
`rotate_my_affiliation_code`. **Il est distinct des écuries et sans interaction
avec elles** (`docs/architecture/12_CREWS_PROD.md:49-51`) : il relie un coach à un
pilote pour le partage de lecture, pas des pilotes entre eux.

---

## 3. Le visiteur anonyme

C'est la surface exposée au monde entier. Quiconque a ouvert une page du site et
lu son code source dispose de la clé publiable `anon` et peut interroger PostgREST
directement. Ce qui suit est public au sens fort.

### 3.1 Trois verrous, pas un

Un lecteur anonyme franchit trois contrôles ; il suffit qu'un seul soit permissif
pour que la donnée sorte :

1. le **`GRANT`** SQL sur la table ou la vue ;
2. la **policy RLS** applicable à `anon` — une policy déclarée `TO public`
   s'applique à `anon`, `public` signifiant en PostgreSQL « tous les rôles » et
   non « visiteur public ». C'est le piège principal ;
3. les **fonctions `SECURITY DEFINER`** exécutables par `anon`, qui **ignorent la
   RLS** et constituent la véritable API publique de la base (3.5).

### 3.2 Les GRANT : très larges par défaut

**Vérifié en base.** `select privilege_type, count(*) from information_schema.role_table_grants where grantee='anon' and table_schema='public' group by 1` :

| Privilège | Objets |
| --- | --- |
| SELECT | 119 |
| INSERT / UPDATE / DELETE / TRUNCATE | 109 chacun |

Ce n'est pas propre à OXV : Supabase accorde cela par défaut sur tout le schéma
`public`. **La RLS est donc le seul rempart réel.** Une table créée en oubliant
`enable row level security` serait immédiatement lisible **et modifiable** par le
monde entier.

Le contrôle qui compte est donc : existe-t-il une table sans RLS que `anon` peut
lire ?

```sql
select c.relname, c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','v','m','p')
  and has_table_privilege('anon', c.oid,'SELECT') and c.relrowsecurity = false;
```

Résultat : **12 objets, tous des vues (`relkind='v'`), aucune table de base.** Le
socle est sain. Les tables sans RLS (`_backup_*`, `founding_members`,
`invoice_counters`) ne sont pas accessibles à `anon`, faute de `GRANT`.

### 3.3 Les 12 vues lisibles par `anon`

Les 14 vues du schéma sont **toutes** déclarées `security_invoker`
(`pg_class.reloptions` porte `security_invoker=true` ou `=on`), donc soumises à la
RLS de l'appelant. Cela ne suffit pas pour la moitié d'entre elles, qui délèguent
leur corps à une fonction `SECURITY DEFINER` (3.5).

Résultat **empirique**, en prenant réellement le rôle (`begin; set local role anon; … rollback;`) :

| Vue | Lignes vues par `anon` | Verdict |
| --- | --- | --- |
| `qdi_public` | **4** | données pilotes — voir 3.5 |
| `sessions_public` | 1 | catalogue commercial, attendu |
| `session_availability` | 1 | taux de remplissage, attendu |
| `crews_public` | 0 | palier 20 jamais atteint |
| `plateau_members_public` | 0 | personne n'a opté pour `nominative` |
| `testimonials_public` | 0 | aucun témoignage publié |
| `pavillon_meteo` | 0 | aucune météo du jour |
| `day_rollups` | **0** | RLS respectée : télémétrie protégée |
| `history_rollups` | **0** | RLS respectée : télémétrie protégée |
| `registration_eligibility` | 0 | RLS respectée |
| `admin_ritual_dispatches_view` | 0 | RLS respectée |
| `stats_dashboard` | ligne de zéros | voir ci-dessous |

**`day_rollups` et `history_rollups` sont sûres.** Elles agrègent
`telemetry_sessions` et `laps` — le cœur de la donnée pilote — et renvoient zéro
ligne à un anonyme. Nous avons vérifié ce point en priorité : **aucune télémétrie
ne fuit.**

**`stats_dashboard` renvoie une ligne entièrement à zéro**, `revenue_this_year` et
`total_pilotes` compris. La RLS protège le chiffre d'affaires, mais la vue ne
renvoie pas *rien*, elle renvoie *zéro* : une page qui l'affiche avec la clé
`anon` montrera « 0 pilote, 0 € » au lieu d'échouer visiblement. Elle n'a de sens
qu'appelée en `service_role`.

### 3.4 Les tables

**Aucune donnée pilote n'est lisible.** Vérifié empiriquement sous rôle `anon` :
`users`, `telemetry_sessions`, `laps`, `app_session_analyses`, `registrations`,
`session_feedback`, `crews`, `crew_members`, `circuits`, `weather_snapshots`,
`app_progression_shares` → **0 ligne chacune**, proprement, sans erreur. Ces
tables n'ont que des policies `TO authenticated`.

Trois tables sont réellement lisibles :

| Table | Lignes vues par `anon` | Policy en cause |
| --- | --- | --- |
| `app_config` | 1 | `app_config_read_all`, `USING (true)` |
| `app_feature_flags` | **7** | `app_feature_flags_read`, `USING (true)` |
| `pricing` | 3 | `pricing_read_all`, `USING (active = true)` |

`pricing` et `app_config` sont défendables (tarifs publics, mode maintenance,
version minimale supportée).

**`app_feature_flags` l'est beaucoup moins — signalement.** Les sept lignes
exposent l'état de chaque fonctionnalité *et* leur champ `description`, rédigé
pour un usage interne. Sont aujourd'hui lisibles par n'importe qui : la feuille de
route commerciale (« réservations/paiements in-app (Stripe/IAP) »), le
dimensionnement d'une offre (« candidatures Membre Fondateur (30 places) »), des
mentions de validation juridique en cours (« activation après relecture avocat »),
un chemin de document interne et l'attribution d'une décision à une personne.
Aucun secret technique, mais rien qui ait été écrit pour être publié.
**Recommandation : restreindre l'exposition à `key` et `enabled`.** L'application
lit cette table au démarrage : le changement doit être coordonné.

### 3.4 bis Défaut à corriger : les tables qui renvoient une erreur 500

Point que vous ne pouvez pas deviner et qui casse probablement des pages chez vous
en ce moment.

Le rôle `anon` **n'a pas le droit d'exécuter `is_admin()`**. **Vérifié en base :**

| Fonction | `anon` peut l'exécuter |
| --- | --- |
| `is_admin()`, `is_coach()`, `is_my_coach(uuid)`, `is_coach_of(uuid)` | **non** |
| `is_partner()`, `is_pro_pilot()`, `owns_partner_account(uuid)`, `is_detailed_coach_of(uuid)` | oui |

Toute table dont une policy applicable à `anon` appelle `is_admin()` ne renvoie
donc pas un ensemble vide — **elle lève une erreur**, que PostgREST retourne en
500. **Vérifié empiriquement**, chaque requête sous `set local role anon` :

| Requête | Résultat réel |
| --- | --- |
| `select count(*) from articles` | `ERROR 42501: permission denied for function is_admin` |
| `select count(*) from events` | `ERROR 42501: permission denied for function is_admin` |
| `select count(*) from partner_offers` | `ERROR 42501: permission denied for function is_admin` |
| `select count(*) from partner_accounts` | `ERROR 42501: permission denied for function is_admin` |
| `select count(*) from coach_profiles` | `ERROR 42501: permission denied for function is_my_coach` |

Ces tables ont pourtant été conçues pour être publiques : `articles` porte
`USING (published = true OR is_admin())`, `partner_offers`
`USING (status = 'published' OR owns_partner_account(...) OR is_admin())`.
L'intention est claire, l'effet est nul : la clause `OR is_admin()` fait échouer
la requête avant tout retour de lignes.

Et il y a de quoi retourner :
`select count(*), count(*) filter (where published) from articles` → **6 articles,
dont 6 publiés — aucun lisible par un visiteur.** `events` contient 1 ligne,
inaccessible.

Pourquoi `pricing` et `app_config` passent-elles malgré une policy
administrateur ? Parce que leur policy de lecture est `USING (true)` : elle est
satisfaite en premier et `is_admin()` n'est jamais évalué. Le comportement dépend
de l'ordre d'évaluation — fragile, à ne pas considérer comme acquis.

**Deux correctifs, à décider ensemble :** (1)
`grant execute on function public.is_admin() to anon;` — l'appel renvoie alors
`false` et la policy se comporte comme prévu, correction minimale sans effet de
bord attendu ; (2) réécrire les policies en isolant la branche publique
(`USING (published = true)`) et en réservant la branche administrateur à
`TO authenticated` — plus propre, plus verbeux. Nous penchons pour la seconde,
mais **c'est votre surface qui est concernée avant la nôtre** : l'application est
toujours authentifiée et n'a jamais rencontré ce mur.

### 3.5 Les fonctions `SECURITY DEFINER` : la vraie API publique

Dix-neuf fonctions `SECURITY DEFINER` sont exécutables par `anon`. Elles
**ignorent la RLS** : leur seule protection est la clause `where` de leur corps.

| Fonction | Ce qu'elle laisse sortir | Garde-fou |
| --- | --- | --- |
| `sessions_public_rows()` | calendrier, capacités, `notes` | `s.is_private is not true` |
| `session_availability_rows()` | places prises par offre | `s.is_private is not true` |
| `pavillon_meteo_rows()` | météo du jour | date du jour |
| `testimonials_public_rows()` | témoignages | `publish_ok and published` — double opt-in |
| `plateau_members_public_rows()` | prénom, initiale, ville | `community_visibility = 'nominative'` — opt-in strict |
| `crews_public_rows()` | nom d'écurie, effectif | palier ≥ 20 |
| `qdi_public_rows()` | **marge de pilotage** | `community_visibility <> 'private'` — **opt-out** |
| `pavillon_pilotes_jour_rows()` | `user_id`, pseudo, véhicule | **aucun opt-in sur le pseudo** |
| `coach_public_card(uuid)` | identité d'un coach | profil publié, ou lien existant |
| `get_shared_progression(token)` et `_values(token)` | contenu d'un partage | jeton non révoqué, non expiré |
| `founders_count()`, `oxv_founding_count()` | un compteur | agrégat seul |
| `is_partner()`, `is_pro_pilot()`, `owns_partner_account()`, `is_detailed_coach_of()`, `oxv_is_admin()` | booléen | `false` sans session |

Deux ne sont pas assez bornées.

**Signalement 1 — `pavillon_pilotes_jour_rows()`.** Corps réel :

```sql
select u.id as user_id, u.car_number, u.public_handle,
       case when u.pavilion_name_optin
            then u.first_name || ' ' || left(u.last_name,1) || '.' else null end as display_name,
       v.brand || ' ' || v.model as vehicle_label, ts.id, ts.status, ts.started_at
from telemetry_sessions ts join users u on u.id = ts.user_id
left join vehicles v on v.id = ts.vehicle_id
where ts.started_at::date = current_date
```

Le drapeau `pavilion_name_optin` ne protège **que** `display_name`. Sortent sans
consentement : l'`user_id` brut, le `public_handle`, la marque et le modèle du
véhicule, l'identifiant de séance télémétrique — pour tout pilote ayant roulé le
jour même.

À noter : la **vue** `pavillon_pilotes_jour` n'est pas accessible à `anon` (pas de
`GRANT`), mais **la fonction l'est**, et PostgREST l'expose sur
`/rest/v1/rpc/pavillon_pilotes_jour_rows`. Fermer la vue ne ferme rien.

Le comptage retourne 0 aujourd'hui uniquement parce qu'aucune séance n'a démarré.
**Le jour d'un roulage, cette fonction devient bavarde** — risque différé, pas
absent, et il se matérialisera précisément quand il y aura du public.

**Signalement 2 — `qdi_public_rows()` et la question du défaut.** Le plus
important de cette section.

L'énumération `community_visibility` vaut `private, anonymous_only, nominative`.
La fonction filtre sur `<> 'private'` : elle inclut donc `anonymous_only`. Or :

```sql
select column_default from information_schema.columns
where table_name='users' and column_name='community_visibility';
```

→ **`'anonymous_only'::community_visibility`**. Et
`select community_visibility, count(*) from users group by 1` →
`anonymous_only` = **14**, `nominative` = 0, `private` = 0. **Aucun utilisateur
n'a jamais fait de choix explicite.**

Résultat lisible par `anon`, vérifié empiriquement :

| `display_name` | `nominative` | `margin_global` | `margin_zone` | `sessions_count` |
| --- | --- | --- | --- | --- |
| Pilote OXV | false | 100.00 | green | 2 |
| Pilote OXV | false | 100.00 | green | 1 |
| Pilote OXV | false | 99.60 | green | 4 |
| Pilote OXV | false | 99.60 | green | 6 |

La pseudonymisation fonctionne : aucun nom ni pseudo ne sort, et le risque de
ré-identification directe est faible à ce volume. Mais **la marge de pilotage est
publiée par défaut, sans que le pilote l'ait demandé.** Deux raisons d'y prêter
attention : *doctrine* — la marge est l'unique chiffre central de l'application et
le produit repose sur l'idée qu'elle appartient au pilote ; *RGPD* — un défaut à
`anonymous_only` place la diffusion sous un régime d'opt-out, alors que pour une
donnée de comportement le consentement explicite est la position défendable. À
volume plus élevé, la combinaison marge + `sessions_count` + `computed_at`
redevient par ailleurs ré-identifiante pour qui connaît le plateau.

### 3.6 Ce que `anon` peut écrire

| Table | Policy | `WITH CHECK` |
| --- | --- | --- |
| `corporate_leads` | `corp_insert_public` (`TO anon, authenticated`) | **`true`** |
| `demandes_inscription` | `demandes_insert_public` (`TO anon, authenticated`) | `statut='en_attente' AND consent_cgv AND consent_rgpd AND consent_contact` |
| `contact_messages` | `contact_messages_insert_public` (`TO public`) | `user_id IS NULL OR user_id = auth.uid()` |

`demandes_inscription` est bien construite : les trois consentements sont exigés
au niveau de la base, pas seulement du formulaire. C'est le modèle à suivre.

`corporate_leads` accepte **n'importe quoi de n'importe qui**, sans consentement
ni limite de débit. Aucune policy `SELECT` ne s'applique à `anon`, donc rien ne
ressort — mais la table est ouverte au dépôt en masse.

### 3.7 Les buckets de stockage

**Vérifié en base**, `storage.buckets` :

| Bucket | Public | Objets |
| --- | --- | --- |
| `avatars` | **oui** | 0 |
| `coach-media` | **oui** | 1 |
| `partner-media` | **oui** | 2 |
| `documents` | non | 9 |
| `telemetry_raw` | non | 3 |
| `vehicles` | non | 8 |
| `audio_briefings`, `founding-members` | non | 1 chacun |
| `coach-audio`, `invoices`, `pavillon-photos`, `pilot-media`, `session-media` | non | 0 |

Trois buckets publics, tous à vocation de vitrine. **`telemetry_raw`,
`pilot-media` et `session-media` sont privés** — point vérifié en priorité, il est
conforme.

Rappel : un bucket public signifie **URL devinable et non authentifiée**. Ne
déposez dans `avatars`, `coach-media` ou `partner-media` rien qui ne soit destiné
au monde entier, et n'y utilisez pas de noms de fichiers contenant des
identifiants ou des noms de personnes.

---

### Ce que nous demandons au site

1. **Qui porte la saisie du code de parrainage ?** L'application expose le code du
   pilote et affiche son écurie, mais n'appelle jamais `oxv_redeem_referral` ni
   `oxv_name_my_crew` (vérifié : aucun appel hors du service et de ses tests).
   Confirmez si le site porte déjà ce parcours, s'il doit le porter, ou si nous
   devons le brancher. Tant que la réponse manque, aucune écurie ne peut naître.

2. **Confirmez le contrat de `payments.status`.** La validation d'un parrainage
   dépend d'un déclencheur `AFTER UPDATE OF status ON payments` testant exactement
   `'succeeded'`. Il ne réagit pas à un `INSERT` direct et avale ses erreurs en
   silence. Prévenez-nous avant tout changement de nommage de statut, passage à un
   `INSERT` unique, ou refonte de cette table.

3. **Décidez du défaut de `users.community_visibility`.** Il vaut aujourd'hui
   `anonymous_only`, ce qui publie la marge de pilotage des 14 comptes vers
   `qdi_public` sans acte positif de leur part. Nous proposons de basculer le
   défaut à `private` et de faire de la publication un opt-in explicite. La
   colonne étant probablement renseignée à l'inscription, la décision vous revient
   en premier.

4. **Tranchez sur `pavillon_pilotes_jour_rows()`.** Exécutable par `anon`, elle
   laisse sortir `user_id`, `public_handle` et le véhicule de tout pilote ayant
   roulé le jour même, sans opt-in — seul `display_name` est protégé. Confirmez
   si une page publique la consomme. Si oui, nous proposons d'étendre la garde
   d'opt-in à toutes les colonnes nominatives et de retirer `user_id`. Elle
   renvoie 0 aujourd'hui seulement parce qu'aucune séance n'a démarré.

5. **Réparez ou faites-nous réparer l'accès anonyme aux contenus publiés.**
   `articles`, `events`, `partner_offers`, `partner_accounts` et `coach_profiles`
   renvoient une **erreur 500** à un visiteur anonyme, leurs policies appelant
   `is_admin()` que `anon` n'a pas le droit d'exécuter. Six articles publiés sur
   six sont illisibles. Dites-nous si vous préférez le correctif minimal
   (`grant execute on function is_admin() to anon`) ou la réécriture des policies.
   Nous ne toucherons à rien sans votre réponse.

6. **Confirmez l'usage de `stats_dashboard`.** Elle renvoie une ligne entièrement
   à zéro avec la clé `anon` : la RLS protège le chiffre d'affaires, mais la vue
   ne signale pas qu'elle est vide. Si une page l'affiche, elle doit être appelée
   en `service_role`.

7. **Confirmez la protection anti-robot de `corporate_leads`.** La policy
   `corp_insert_public` accepte toute insertion anonyme avec `WITH CHECK (true)`,
   sans consentement ni limitation. Comparez avec `demandes_inscription`, qui
   exige les trois consentements au niveau de la base.

8. **Validez le contenu publié de `app_feature_flags`.** Les sept lignes sont
   lisibles par n'importe qui, colonne `description` comprise, laquelle contient
   feuille de route commerciale, dimensionnement d'offre et mentions de validation
   juridique en cours. Nous proposons de n'exposer que `key` et `enabled` ;
   l'application lit cette table au démarrage, le changement doit être coordonné.

9. **N'écrivez pas dans `pro_team_members`, et ne posez jamais
   `access_level = 'view'`.** La table est une liste déclarative sans effet sur les
   droits ; aucun mécanisme de partage n'est branché derrière cette valeur.

10. **Dites-nous ce qu'est commercialement un `pro_pilot`.** Zéro compte en
    production, aucune policy de données ne le mentionne, et l'application ne sait
    pas attribuer le rôle — nous en déduisons une attribution manuelle de votre
    côté, sans pouvoir le confirmer. Précisez s'il existe une contrepartie
    (abonnement, licence, contrat) et qui pose la valeur. Notez qu'un basculement
    de rôle change l'application entière au prochain lancement, sans transition.

---

## Fonction IDENTITÉ — authentification, rôles, consentements

Cette section décrit le seul objet réellement partagé entre le site oxvehicle.fr et l'application OXV Mirror : l'identité. `auth.users` est unique. Un compte créé d'un côté est immédiatement un compte de l'autre côté. Il n'y a aucune API entre les deux produits : la seule interface est le schéma.

Trois marqueurs sont employés partout. **[APP]** = vérifié dans le code de l'application, chemin et ligne donnés. **[BASE]** = vérifié en production (`fouvuqkdxarjpjbqnsjq`), requête et résultat donnés. **[DÉDUIT]** = inféré de ce que la base montre et de ce que l'application ne fait pas, à confirmer par vous. Tous les relevés datent du 2026-07-25, en lecture seule.

### 1. Le pont : `auth.users` et `public.users`

**Volumétrie réelle.**

```sql
select (select count(*) from auth.users)   as auth_users,
       (select count(*) from public.users) as public_users,
       (select count(*) from auth.users a left join public.users u on u.id=a.id
         where u.id is null) as auth_sans_public,
       (select count(*) from public.users u left join auth.users a on a.id=u.id
         where a.id is null) as public_sans_auth,
       (select count(*) from auth.users where email_confirmed_at is not null) as emails_confirmes;
```

**[BASE]** `auth_users = 12`, `public_users = 14`, `auth_sans_public = 0`, `public_sans_auth = 2`, `emails_confirmes = 10`, `last_sign_in_at` renseigné sur 10. La base est petite : aucune conclusion statistique n'est tirée ici, seules les structures (triggers, RLS, colonnes) font contrat.

**Il n'existe aucune clé étrangère entre les deux tables.** **[BASE]** `pg_get_constraintdef` sur `public.users` renvoie treize contraintes : `users_pkey` sur `id`, quatre UNIQUE (`email`, `public_handle`, `stripe_customer_id`, `affiliation_code`), six CHECK, et deux clés étrangères internes à la table (`kyc_validated_by`, `suspended_by` → `users(id)`). Aucune référence à `auth.users`. La colonne porte de surcroît un défaut autonome : `id uuid NOT NULL DEFAULT uuid_generate_v4()`.

Trois conséquences vous concernent directement.

1. On peut insérer une ligne dans `public.users` **sans compte d'authentification**. C'est arrivé deux fois. **[BASE]** Les orphelins sont `f27e56e2-e957-4cd8-bee3-6037ae9731ab` (2026-05-09) et `f936c42c-0612-4aa4-a1af-dc320eb08f3d` (2026-05-11), tous deux `role = 'pilot'`, `profile_completed_at` nul, sans ligne `auth.users`.
2. Supprimer une ligne de `auth.users` **ne supprime pas** le profil, qui reste avec son email, son nom et son historique.
3. La cascade métier est accrochée à `public.users(id)`, pas à `auth.users(id)`. **[BASE]** 51 clés étrangères pointent vers `public.users` en `ON DELETE CASCADE`, 21 en `NO ACTION`, 14 en `SET NULL`.

**[DÉDUIT]** Ces deux orphelins viennent soit d'une insertion directe côté site, soit d'une suppression d'un compte Auth sans nettoyage du profil. Nous ne pouvons pas trancher depuis l'application.

### 2. Le déclencheur qui garde le lien, et ce qu'il ne garde pas

**[BASE]** Un seul trigger existe sur `auth.users` :

```sql
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
-- corps, SECURITY DEFINER, search_path = public, pg_temp :
INSERT INTO public.users (id, email, created_at, updated_at)
VALUES (NEW.id, NEW.email, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;
```

Il garde l'identifiant et l'email, à la création. Il ne garde pas :

- **Le prénom et le nom.** **[BASE]** `raw_user_meta_data` porte pourtant `first_name` et `last_name` sur les 12 comptes (`select distinct jsonb_object_keys(raw_user_meta_data) from auth.users` → `sub, iss, email, first_name, last_name, provider_id, email_verified, phone_verified, custom_claims`). Le trigger les ignore. Sans UPDATE explicite après le `signUp`, `public.users.first_name` reste NULL et l'application affiche un profil sans nom.
- **La confirmation d'email.** Deux colonnes indépendantes coexistent, `auth.users.email_confirmed_at` et `public.users.email_verified`, sans synchronisation. **[BASE]** 10 emails confirmés côté Auth, `count(*) filter (where email_verified) = 1` côté profil. **[APP]** L'application ne lit ni n'écrit jamais `email_verified` (aucune occurrence hors `src/types/database.types.ts`).
- **Un changement d'email ultérieur.** Le trigger est `AFTER INSERT` seulement, et `public.users.email` est UNIQUE : les deux valeurs peuvent diverger durablement.
- **`last_login_at`.** **[BASE]** `count(*) filter (where last_login_at is not null) = 0` sur 14. Personne ne l'écrit. **[APP]** L'application la lit seulement, en écran admin (`src/services/adminUsersService.ts:51` et `:65`).

Le contrat implicite est donc : *celui qui crée le compte Auth complète la ligne `public.users` juste après*. L'application ne crée jamais de compte (§3) : cette charge vous revient intégralement.

### 3. Comment un compte est créé, et par qui

**L'application ne crée jamais de compte.** **[APP]** Recherche exhaustive de `auth.signUp`, `auth.admin.createUser` et `inviteUserByEmail` dans `src/` et `app/` : aucune occurrence de production. La seule est `src/__tests__/rls/setup.ts:78`, utilitaire de test en clé service_role, jamais embarqué. L'écran `app/(auth)/login.tsx` n'offre que deux chemins : email et mot de passe via `supabase.auth.signInWithPassword` (`src/store/useAuthStore.ts:116`), et « Lier mon compte avec un code du site » (`app/(auth)/login.tsx:81`). **Ni création de compte, ni mot de passe oublié, ni réinitialisation.** **[DÉDUIT]** Ces parcours sont entièrement à votre charge, gabarits d'email compris.

**[BASE]** Fournisseurs sur les 12 comptes Auth (`raw_app_meta_data->>'provider'`) : `email` × 11, `apple` × 1. Trois voies de création sont constatées.

**Voie 1 — inscription email et mot de passe sur le site.** **[DÉDUIT]** Cas majoritaire. Preuve indirecte : `raw_user_meta_data` porte `first_name` / `last_name`, ce que seul un `signUp({ options: { data } })` produit, et l'application ne fait jamais de `signUp`.

**Voie 2 — validation d'une demande d'inscription.** Edge function `validate-inscription` (`supabase/functions/validate-inscription/index.ts:325`) :

```ts
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email: demande.email, email_confirm: true,
  user_metadata: { first_name, last_name, source: 'demande_inscription' },
});
```

Elle enchaîne sur un `upsert` de `public.users` qui pose explicitement `role`, `first_name`, `last_name`, `email_verified: true` (lignes 354-380), puis un `generateLink` (ligne 451). Source : `public.demandes_inscription` (**[BASE]** 4 lignes ; colonnes `consent_cgv`, `consent_rgpd`, `consent_contact`, `boolean NOT NULL DEFAULT false`). Le rôle découle de `type_demande` via `mapRole()`.

**Voie 3 — Sign in with Apple.** **[BASE]** un compte, `provider = 'apple'`, email en `@privaterelay.appleid.com`. **[APP]** Aucun code Apple dans l'application : `signInWithIdToken`, `AppleAuthentication`, `expo-apple` — zéro occurrence dans `src/`, `app/` et `package.json`. **[DÉDUIT]** Ce compte a donc été créé depuis le site. Point sensible : un alias de relais privé Apple change si l'utilisateur révoque le partage, et `public.users.email` est UNIQUE.

**L'appairage site → application** est le seul échange de session entre les deux produits. Côté site **[DÉDUIT, code non consultable]** : appel de l'edge `pair-app` avec `action = 'generate'` et le JWT de l'utilisateur connecté ; la fonction (`supabase/functions/pair-app/index.ts`) invalide les codes actifs précédents puis insère dans `public.app_pairing_codes` un code de 8 caractères (alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, sans 0/O/1/I/L), valable 10 minutes, à usage unique. Côté application **[APP]** : `src/services/pairingService.ts:33` invoque `pair-app` avec `action = 'redeem'` **sans JWT** (le pilote n'est pas encore connecté), reçoit un `token_hash` et appelle `supabase.auth.verifyOtp({ type: 'magiclink', token_hash })` (ligne 60) ; le magic link est produit par `admin.auth.admin.generateLink` (`pair-app/index.ts:107`). Garde-fous : `verify_jwt = false` (nécessaire, redeem est pré-authentification), 10 tentatives par minute et par IP hachée en SHA-256 dans `public.app_pairing_redeem_attempts`, consommation atomique du code par `UPDATE ... WHERE used_at IS NULL AND expires_at > now() RETURNING`. **[BASE]** `app_pairing_codes` : 0 ligne ; `app_pairing_redeem_attempts` : 1 ligne. Déployé, quasiment pas exercé.

### 4. Rôles et droits

**Deux colonnes portent le rôle, et elles divergent déjà.** **[BASE]** `public.user_role = (pilot, admin, coach, partner, pro_pilot)`. `role user_role DEFAULT 'pilot'` (nullable) et `is_admin boolean DEFAULT false` (nullable). La fonction d'autorisation les combine par un OU :

```sql
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT COALESCE((SELECT role = 'admin' OR is_admin = true
                   FROM public.users WHERE id = auth.uid()), false); $$;
```

**[BASE]** Répartition réelle : `pilot` × 11, `admin` × 2, `partner` × 1, `coach` × 0. Les deux comptes `role = 'admin'` ont `is_admin = false`, tandis qu'un compte `role = 'pilot'` (`6edd7f5c-f691-49b1-a083-c4cfcce0e66e`) a `is_admin = true`. Les trois sont administrateurs au sens de `is_admin()`, deux seulement au sens de `role`. **[APP]** L'application écrit toujours les deux ensemble : `src/services/adminUsersService.ts:121` fait `.update({ role, is_admin: role === 'admin' })`. **[DÉDUIT]** Les divergences viennent donc d'écritures hors application (SQL direct, tableau de bord Supabase, ou site).

**Les déclencheurs sur `public.users`** **[BASE]**, par `pg_get_triggerdef` :

| Trigger | Moment | Effet |
|---|---|---|
| `trg_guard_users_privileged_columns` | `BEFORE UPDATE OF role, kyc_status` | lève `42501` si l'auteur n'est ni `service_role`/`postgres`/`supabase_admin`/`supabase_auth_admin`, ni `is_admin()` |
| `trg_audit_user_role_change` | `AFTER UPDATE OF role` | insère `admin_audit(action='role_changed')` avec `old_role`, `new_role`, `changed_by = auth.uid()` |
| `users_ensure_coach_permissions` | `AFTER INSERT OR UPDATE OF role` | si `role = 'coach'`, upsert `coach_permissions(user_id, can_view_pilots = true)` |
| `trg_pavilion_optin_at` | `BEFORE UPDATE` | horodate ou efface `pavilion_name_optin_at` selon la bascule |
| `update_users_updated_at` | `BEFORE UPDATE` | `updated_at = now()` |

**[BASE]** Les trois lignes `role_changed` existantes portent toutes `"changed_by": null` : `admin→pilot` (2026-07-20), `coach→admin` (2026-07-18), `admin→partner` (2026-07-07). `auth.uid()` est nul sous `service_role` ou en SQL direct : la trace existe mais ne désigne aucun auteur. Si vous changez un rôle depuis le site, faites-le sous session authentifiée d'administrateur.

Le garde-fou ne couvre que `role` et `kyc_status`. **`is_admin` n'est protégé par aucun trigger** ; seule la RLS « ligne propre » s'applique, ce qui signifie qu'un pilote authentifié peut techniquement écrire `is_admin = true` **sur sa propre ligne**. **[APP]** L'application n'offre aucun chemin pour le faire (`src/lib/queries/profil.ts:279` exclut explicitement `role`, `is_admin` et `kyc_status` des champs modifiables), mais la base ne l'interdit pas.

**RLS de `public.users`.** **[BASE]** RLS active, non forcée. Quatre policies, toutes pour `authenticated` : `users_select_own_or_admin` (SELECT, `id = auth.uid() OR is_admin()`), `users_insert_own_or_admin` (INSERT, même condition en CHECK), `users_update_own_or_admin` (UPDATE, USING et CHECK), `users_delete_admin_only` (DELETE, `is_admin()`).

Vérification empirique **[BASE]**, en transaction annulée :

```sql
begin; set local role authenticated;
set local request.jwt.claims = '{"sub":"aad205ed-...","role":"authenticated"}';
select (select count(*) from public.users) as visibles, public.is_admin(); rollback;
```

→ `visibles = 1`, `is_admin = false`. Sous `role anon` : `visibles = 0`. **Il n'existe donc aucun accès transversal à `public.users`**, ni entre pilotes, ni d'un coach vers son pilote.

**Conséquence sur l'espace coach.** La vue `public.coach_pilots_view` est déclarée `security_invoker = on` **[BASE]** et joint `coach_pilots` à `users` (`WHERE cp.coach_id = auth.uid() AND cp.active AND cp.pilot_consent_at IS NOT NULL`). Exécutée sous les droits de l'appelant, et `users` n'ayant aucune policy « coach », un coach non administrateur voit **zéro ligne**. **[BASE]** Le seul essai possible le confirme indirectement : l'unique ligne de `coach_pilots` a pour `coach_id` un compte dont le `role` est `'pilot'` et le `is_admin` est `true` ; simulé sous son JWT, la vue renvoie 1 ligne, mais parce que `is_admin()` est vrai. Aucun compte n'a `role = 'coach'` en production. **[DÉDUIT]** L'espace coach ne fonctionnera pas pour un vrai coach tant qu'une policy de lecture croisée n'est pas ajoutée sur `users`. Nous ne l'ajouterons pas sans vous prévenir : elle changerait aussi ce que le site expose.

**`coach_permissions`.** **[BASE]** 1 ligne. Colonnes `user_id` (PK, CASCADE), `can_view_pilots` (défaut `true`), `can_manage_own_sessions` (défaut `false`), `can_view_business_dashboard` (défaut `false`), `granted_by`, `updated_at`. RLS : lecture de sa propre ligne, écriture réservée à `is_admin()`. La ligne naît du trigger `ensure_coach_permissions()` et est complétée par `validate-inscription` qui pose `can_manage_own_sessions = true` (`supabase/functions/validate-inscription/index.ts:385-395`).

### 5. Les consentements : colonne, auteur, effet du retrait

Seize consentements distincts existent. Quatorze vivent sur `public.users`, trois sur `public.coach_pilots`, un dernier est une ligne de `public.app_progression_shares`.

| Consentement | Colonne | Table | Défaut | Écrit par | Lignes à « oui » |
|---|---|---|---|---|---|
| Pacte de pilotage | `pact_accepted_at` + `pact_version` | `users` | NULL | app | 2 / 14 |
| Pacte de coaching | `coach_pact_accepted_at` + `_version` | `users` | NULL | app | 2 / 14 |
| CGU | `cgu_accepted_at` + `cgu_version` | `users` | NULL | app | 3 / 14 |
| Confidentialité | `privacy_accepted_at` + `_version` | `users` | NULL | app | 3 / 14 |
| Coaching (maître) | `pilot_consent_at` | `coach_pilots` | NULL | app (pilote), admin | 1 / 1 |
| Coaching (niveau) | `level` | `coach_pilots` | `lecture_simple` | app (pilote) | `programme` |
| Partage en direct | `live_sharing_at` | `coach_pilots` | NULL | app (pilote) | 0 / 1 |
| Biométrie — capture | `biometry_capture_consent_at` | `users` | NULL | app | 0 / 14 |
| Biométrie — partage coach | `biometry_coach_share_consent_at` | `users` | NULL | app | 0 / 14 |
| IA débrief (opt-out) | `ai_debrief_enabled` | `users` | `true` | app | 13 / 14 |
| IA coach (opt-in) | `coach_ai_enabled` | `users` | `false` | app | 0 / 14 |
| Pavillon — nom affiché | `pavilion_name_optin` (+ `_at`) | `users` | `false` | app | 1 / 14 |
| « Qui roule » | `show_attendance` | `users` | `false` | app | 0 / 14 |
| Visibilité communauté | `community_visibility` | `users` | `anonymous_only` | **personne** | 14 au défaut |
| Marketing | `accepts_marketing`, `notif_newsletter`, `notif_offers` | `users` | `false` | **personne côté app** | 0 / 14 |
| Notifications push | `push_notif_enabled` | `users` | `true` | app | 14 au défaut |
| Partage de lien | ligne `app_progression_shares` | table | — | app | 1 ligne |

**Pactes, CGU et confidentialité**

**[APP]** `acceptPact()` (`src/services/onboardingService.ts:77-100`) écrit `pact_accepted_at` et `pact_version` (`PACT_VERSION = '1.0'`, ligne 18), horodatage client. `acceptCoachPact()` (lignes 106-129) écrit le couple `coach_pact_*`, distinct : **[BASE]** le commentaire de colonne précise « uniquement pour les users role=coach ». `acceptCguAndPrivacy()` (lignes 49-75) écrit `cgu_accepted_at`, `cgu_version`, `privacy_accepted_at`, `privacy_version` **dans un même UPDATE**, avec le même horodatage — et porte aussi le consentement IA, particularité à connaître : le pilote arbitre l'IA au moment où il accepte les CGU.

Chemin hors ligne **[APP]** : si l'écriture échoue, l'action est mise en file (`src/services/offlineQueue.ts:119-158`) et rejouée à la reconnexion **avec l'horodatage du tap d'origine** (`new Date(action.createdAt)`), pas celui du rejeu. C'est volontaire : la valeur juridique est celle de l'instant d'acceptation.

Le pacte conditionne l'entrée dans l'application : `isOnboardingComplete()` (`src/services/onboardingService.ts:159-175`) exige `profile_completed_at` **et** `cgu_accepted_at`, puis `pact_accepted_at` pour un pilote ou `coach_pact_accepted_at` pour un coach.

**Retrait** : aucun mécanisme n'existe, ni écran ni RPC. **[DÉDUIT]** Remettre la colonne à NULL renverrait le pilote en onboarding au démarrage suivant. Si vous prévoyez un retrait côté site, prévenez-nous : l'effet est un re-routage complet. **[BASE]** Curiosité à ne pas surinterpréter : les 2 lignes portant `coach_pact_accepted_at` sont un `role = 'partner'` et un `role = 'pilot'`, aucune n'est `coach` — reliquat d'essais de bascule de rôle. La colonne n'est pas un indicateur fiable de « est coach ».

**Coaching : consentement maître, niveau, partage en direct**

`public.coach_pilots` porte l'affiliation. **[BASE]** 1 ligne, 14 colonnes. Commentaires de colonnes en base, qui font foi : `pilot_consent_at` — « Timestamp du consentement RGPD du pilote au coaching. Null = pas consenti = coach ne voit rien. » ; `coach_consent_at` — « Acceptation du coach (symétrique). » ; `level` — « lecture_simple = sessions/tours/bilan ; lecture_detaillee = + frames + métriques de virage ; programme = + suivi. » ; `live_sharing_at` — « Consentement du pilote au partage LIVE (télémétrie temps réel). NULL = non consenti. Distinct de pilot_consent_at. Révocable. »

**[BASE]** Énumérations : `coach_access_level = (lecture_simple, lecture_detaillee, programme)`, `affiliation_status = (pending, active, declined, ended)`, `affiliation_initiator = (coach, pilot)`.

L'application du consentement passe par deux fonctions `SECURITY DEFINER` appelées dans les policies RLS de toute la base :

```sql
is_coach_of(pilot_uuid)          -- coach_id = auth.uid() AND active AND pilot_consent_at IS NOT NULL
is_detailed_coach_of(pilot_uuid) -- idem + level IN ('lecture_detaillee','programme')
```

**[APP]** Écritures côté pilote, `src/services/pilotConsentService.ts` : `giveConsent(id, level)` lignes 117-156 pose `pilot_consent_at` et `level` puis notifie le coach via l'edge `notify-coach-consent-received` ; `setConsentLevel(id, level)` lignes 164-174 change le niveau seul ; `setLiveSharing(id, on)` lignes 182-195 horodate ou efface `live_sharing_at` ; `revokeConsent(id)` lignes 202-215 remet `pilot_consent_at` à NULL.

**Effet du retrait** : immédiat et global. Toute policy appelant `is_coach_of()` cesse de passer. L'affiliation reste en base (`active` inchangé). Pour le direct, le relais exige **les deux** conditions (`src/services/liveRelayRunner.ts:84-85` : `.not('pilot_consent_at','is',null).not('live_sharing_at','is',null)`) et se coupe à la révocation, le runner écoutant `coach_pilots` en temps réel.

Réserve honnête : `revokeConsent()` ne remet **pas** `live_sharing_at` à NULL. Sans effet pratique, mais la ligne reste trompeuse à la lecture.

**[BASE]** L'unique ligne : `pilot_consent_at` posé le 2026-06-28, `level = 'programme'`, `coach_consent_at` NULL, `live_sharing_at` NULL, `initiated_by = 'coach'`, et `status = 'pending'` **alors que le pilote a consenti**. L'application n'écrit jamais `status`. **[DÉDUIT]** Colonne prévue pour un pilotage back-office, non câblée.

**Biométrie — capture et partage coach**

Données de santé (RGPD article 9). Deux colonnes `timestamptz` distinctes, NULL = refusé, opt-in strict. **[BASE]** Commentaires : « BE-1 : horodatage du consentement à la capture FC (santé, art. 9). NULL = OFF (fail-closed) » et « … au partage FC au coach détaillé. NULL = OFF (fail-closed) ».

**[APP]** `src/services/consentService.ts:141-192`. Un invariant est maintenu dans les deux sens : révoquer la capture révoque aussi le partage (lignes 149-152) ; activer le partage active la capture si elle était absente, sans écraser une date de capture antérieure (lignes 183-186).

Le consentement est appliqué **dans la policy**, pas seulement dans l'application. **[BASE]** Sur `public.biometry_raw` :

```sql
biometry_own_all   : ALL    -- auth.uid() = user_id
biometry_coach_read: SELECT -- is_detailed_coach_of(user_id) AND EXISTS (
  SELECT 1 FROM users u WHERE u.id = biometry_raw.user_id
                          AND u.biometry_coach_share_consent_at IS NOT NULL)
```

Le retrait coupe l'accès du coach à la seconde même. Purge automatique **[BASE]** : `cron.job` n° 11, tous les jours à 03:15, `select public.purge_old_biometry();` soit `delete from public.biometry_raw where ts < now() - interval '30 days'`. Rétention dure de 30 jours, indépendante du consentement. **[BASE]** `biometry_raw` : 0 ligne ; aucun consentement biométrie posé.

Réserve signalée par le code lui-même **[APP]**, `src/services/consentService.ts:14-26` : l'écran « Centre de consentement » (`app/(app)/consentements.tsx`) se présente comme exhaustif mais **n'expose pas** la biométrie, réglable uniquement dans les Réglages. Décision produit ouverte côté OXV ; ne présumez pas d'une exhaustivité qui n'existe pas encore.

**Les deux consentements IA**

**[BASE]** `ai_debrief_enabled boolean NOT NULL DEFAULT true` — commentaire : « Opt-out du débrief assisté par IA (OpenAI, US). true = actif (défaut), false = le pilote a désactivé ; l'edge function generate-debrief-ai ne transmet alors rien à OpenAI. » `coach_ai_enabled boolean NOT NULL DEFAULT false` — « Opt-in du pilote : autorise SON coach à déclencher l'assistant IA (transfert hors-UE) sur ses données. Défaut false (fail-closed). »

**[APP]** Deux chemins d'écriture pour le premier, tous deux passant par le même service : à l'onboarding via `acceptCguAndPrivacy(aiDebriefConsent = false)` (`src/services/onboardingService.ts:49` et `:61` — le défaut du paramètre est `false`, donc l'application **ne s'appuie pas** sur le défaut `true` de la colonne), puis `setAiDebriefConsent()` (`src/services/consentService.ts:69-78`), appelé depuis les Réglages et depuis `app/(app)/consentements.tsx:54`. Le second passe par `setCoachAiConsent()` (`consentService.ts:80-89`, écran ligne 60).

**Effet du retrait** : le gate réel est dans les edge functions, pas dans l'application. Mettre la colonne à `false` suffit à couper le transfert hors UE.

**Pavillon, « Qui roule », visibilité communauté**

**[BASE]** `pavilion_name_optin boolean NOT NULL DEFAULT false`, plus `pavilion_name_optin_at` horodaté par trigger (`set_pavilion_optin_at()` : `now()` à l'activation, NULL à la désactivation). L'application n'écrit donc **que le booléen** ; l'horodatage est une garantie de base (**[APP]** `src/components/profil/OptinPavillon.tsx:5`).

Ce que l'opt-in gouverne est plus restreint qu'il n'y paraît. **[BASE]** `public.pavillon_pilotes_jour_rows()`, `SECURITY DEFINER` :

```sql
select u.id, u.car_number, u.public_handle,
       case when u.pavilion_name_optin
            then u.first_name || ' ' || left(u.last_name,1) || '.' else null end as display_name,
       v.brand || ' ' || v.model, ts.id, ts.status, ts.started_at
from telemetry_sessions ts join users u on u.id = ts.user_id
left join vehicles v on v.id = ts.vehicle_id
where ts.started_at::date = current_date
```

L'opt-in ne gouverne que `display_name`. Le **pseudonyme**, le **numéro de voiture** et le **véhicule** sortent dans tous les cas. Point à porter à votre attention **[BASE]** : cette fonction est exécutable par `anon` (`proacl` = `postgres=X | anon=X | authenticated=X | service_role=X`) et, étant `SECURITY DEFINER`, elle contourne la RLS. Toute personne détenant la clé publique anonyme peut lister les pilotes roulant aujourd'hui. `pavillon_meteo_rows()` est dans le même cas. **[APP]** L'application n'appelle ni l'une ni l'autre. **[DÉDUIT]** Ce sont des canaux du site ou des écrans du Pavillon — et le seul endroit de la base où une donnée nominative sort sans authentification.

**[BASE]** `show_attendance boolean NOT NULL DEFAULT false` — « V2-L2 C1 : opt-in "Qui roule" — apparaître (handle + avatar) aux autres inscrits de la même journée. » **[APP]** Lu et basculé dans `src/features/rec/attendancePublicService.ts:51` et `:68`. Appliqué par `session_attendance_public(p_session uuid)`, `SECURITY DEFINER`, **[BASE]** exécutable par `authenticated` seulement (pas `anon`), triplement gatée : `r.status <> 'cancelled'`, `u.show_attendance = true`, `u.suspended_at is null`, plus `public.is_registered_for_session(p_session)` — le demandeur doit lui-même être inscrit. Elle ne renvoie que `public_handle`, `avatar_url`, `crew_id`, jamais le nom.

**[BASE]** `community_visibility` : énumération `(private, anonymous_only, nominative)`, `NOT NULL DEFAULT 'anonymous_only'`, commentaire précis en base (« private = exclu de tout classement/observatoire ; anonymous_only = compte dans les agrégats sans nom ; nominative = nom (public_handle) affiché »). **[APP]** **Aucune lecture, aucune écriture** dans `src/` ni `app/` hors types générés. Les 14 lignes sont au défaut. **[DÉDUIT]** Soit ce réglage est piloté par le site, soit il n'est câblé nulle part. C'est le seul consentement de la table dont nous ne savons rien.

**Marketing, push, partage de lien**

**[BASE]** `accepts_marketing`, `notif_newsletter`, `notif_offers` : `boolean DEFAULT false`, 0 ligne à `true`. `push_notif_enabled boolean NOT NULL DEFAULT true` avec `expo_push_token` et `push_token_updated_at` : 14/14 au défaut, jamais modifié. **[DÉDUIT]** Les trois premières sont des colonnes du site — l'application ne les écrit pas ; `expo_push_token` est strictement application (un token Expo n'a aucun sens sur le web).

**[BASE]** `app_progression_shares` : 1 ligne ; colonnes `share_token`, `share_scope`, `included_metrics` (jsonb), `expires_at`, `revoked_at`, `view_count`, `last_viewed_at`. RLS : insertion, lecture, modification et suppression réservées au propriétaire (`user_id = auth.uid()`), plus une lecture coach par `is_coach_of(user_id)`. **Aucune policy `anon`.** **[DÉDUIT]** Si le site sert les pages de partage public, il le fait en `service_role` ou par une fonction dédiée, et doit vérifier lui-même `revoked_at` et `expires_at` : la base ne le fera pas.

### 6. Effacement du compte

**Ce que fait l'application.** **[APP]** `requestAccountDeletion(userId)` (`src/services/accountService.ts:29-50`) ne supprime rien : elle pose `deletion_requested_at = now()` et `deletion_scheduled_at = now + 30 jours` (`DELETION_GRACE_DAYS = 30`, ligne 16) sur sa propre ligne, et vérifie qu'une ligne a bien été écrite (`.select('id')`, lignes 43-48) pour ne jamais annoncer une suppression non enregistrée. Déclenchée depuis les Réglages (`src/features/vous/useReglages.ts:351`). **[BASE]** 0 compte en attente de suppression.

**Ce que fait la base.** **[BASE]** `cron.job` n° 9, tous les jours à 02:30, appelle `functions/v1/purge-deleted-accounts` avec un Bearer issu de `vault.decrypted_secrets` (`edge_functions_invoke_secret`). **[BASE]** La fonction est `ACTIVE`, version 10, `verify_jwt = false` ; sa source déployée porte l'en-tête « VERSION 5 (SEC-1) — déployée le 19/07/2026 ». Elle sélectionne les comptes dont `deletion_scheduled_at <= now()` et dont l'email n'est pas déjà `deleted-%@oxv.invalid` (idempotence), puis pour chacun :

1. collecte les références Storage portées par des lignes (audio d'annotations coach, `media.file_url`) **avant** de les supprimer ;
2. supprime récursivement les objets de huit buckets préfixés par l'identifiant — `vehicles`, `documents`, `avatars`, `audio_briefings`, `pilot-media`, `session-media`, `telemetry_raw`, `coach-media` — plus `coach-audio` par identifiants collectés. **Le bucket `invoices` est délibérément conservé.** Échec bloquant : si un retrait rate, le compte est laissé pour le passage suivant ;
3. appelle `rpc('purge_user_data', { p_user })` ;
4. appelle `auth.admin.updateUserById()` pour remplacer l'email par `deleted-{uuid}@oxv.invalid`, bannir 876000 heures et vider `user_metadata`.

**Aucun `deleteUser`.** La stratégie est « anonymiser et purger », pas « supprimer », et la raison est écrite dans le code : `payments.user_id` est en `ON DELETE NO ACTION`, un DELETE de `users` échouerait.

**[BASE]** `public.purge_user_data(p_user uuid)` existe bien, `SECURITY DEFINER`, exécutable par `postgres` et `service_role` seulement. En une transaction : `DELETE` sur une cinquantaine de tables ; `UPDATE ... = NULL` sur `coaching_bookings.pilot_first_name`, `duels.opponent_id`, `crew_members.referred_by`, `device_assignments.pilot_id`, `admin_audit.user_id`, `email_log` (`user_id`, `subject`, `metadata`) ; puis scrub de la ligne `users` — email remplacé, et mis à NULL : `first_name`, `last_name`, `birth_date`, `phone`, adresse complète, contact d'urgence, `blood_type`, `medical_notes`, `ffsa_license`, `experience_years`, `avatar_url`, `public_handle`, `admin_notes`, `expo_push_token`, `notification_preferences`, `bio`, `socials`, `media`, `livery`, `vehicle`, `car_number`, `affiliation_code`, `suspension_reason` ; remis à `false` : `pavilion_name_optin`, `accepts_marketing`, `push_notif_enabled` ; remis à NULL : les deux consentements biométrie.

Note de cohérence : le fichier du dépôt applicatif `supabase/functions/purge-deleted-accounts/index.ts` porte encore l'en-tête « PRÉPARÉE, NON DÉPLOYÉE » et affirme qu'aucun cron ne l'invoque. **[BASE]** La production dit le contraire (v5 active, cron n° 9 actif). C'est la production qui fait foi.

**Ce que la purge ne touche pas, et qui vous revient** **[BASE]**, par lecture du corps de la fonction :

| Objet | État après purge | Pourquoi |
|---|---|---|
| `users.stripe_customer_id` | **conservé** | non listé dans le scrub |
| `payments` (1 ligne) | **conservé** | FK `NO ACTION`, obligation comptable |
| `invoices` (0 ligne) | **conservé** | FK `NO ACTION` |
| bucket `invoices` | **conservé** | exclu explicitement |
| `subscriptions` (0 ligne) | non listé | FK `CASCADE` |
| `incident_reports` | anonymisé | `user_id = NULL`, jamais purgé |
| `pilot_waiver_signatures` (0 ligne) | non listé | ni purge ni anonymisation |
| `founding_members` (1 ligne) | non listé | pas de FK vers `users` |
| buckets `founding-members`, `pavillon-photos`, `partner-media` | hors purge | déclaré dans le code |

Le point le plus concret : **`stripe_customer_id` survit à la purge.** La colonne est UNIQUE et reste renseignée sur une ligne anonymisée. **[BASE]** Aucun compte n'a de `stripe_customer_id` aujourd'hui (0 sur 14), donc rien n'est cassé — mais dès votre premier client Stripe, un effacement laissera un identifiant client attaché à une ligne « deleted- ». **[DÉDUIT]** Côté Stripe lui-même, aucun de nos mécanismes n'agit : ni suppression ni anonymisation du `Customer`, des `PaymentMethod`, des `Invoice` ou des `Subscription`. C'est nécessairement à vous, et il n'existe **aucun signal automatique** vous prévenant qu'un compte vient d'être purgé.

**[DÉDUIT]** Autre contradiction à arbitrer : les pièces KYC (permis, identité, assurance) sont dans le bucket `documents`, **qui est purgé à J+30**. Votre politique de confidentialité, telle qu'embarquée dans l'application (`src/legal/legalDocuments.ts`), annonce « Documents KYC : 5 ans après la dernière session ». L'un des deux doit changer.

**[BASE]** Enfin, deux edge functions actives n'existent pas dans le dépôt applicatif : `capture-membre-fondateur` (v7) et `yousign-webhook` (v6), ainsi que le bucket `founding-members` créé le 2026-07-21. **[DÉDUIT]** Elles sont à vous. Si `yousign-webhook` alimente `pilot_waiver_signatures`, dites-le-nous : cette table n'est ni purgée ni anonymisée aujourd'hui.

### 7. Ce qui casse si l'un de ces objets change

1. **Ajouter une colonne `NOT NULL` sans défaut à `public.users`** casse `handle_new_user()`, donc **toute création de compte, des deux côtés**.
2. **Modifier `handle_new_user()`** modifie le premier démarrage de l'application : `fetchProfile()` (`src/store/useAuthStore.ts:55-70`) lit quatorze colonnes précises. Si `role` manque, un repli sur `'pilot'` s'applique (ligne 69) ; mais si `pact_accepted_at` ou `cgu_accepted_at` arrivent pré-remplies, le pilote saute l'onboarding et **n'aura jamais vu le pacte**.
3. **Ajouter une valeur à `user_role`** sans nous prévenir : le type applicatif est figé à cinq valeurs (`src/store/useAuthStore.ts:13`) et la navigation par rôle ne saura pas router le compte.
4. **Ajouter une policy de lecture croisée sur `public.users`** change ce que voient tous les écrans qui joignent `users`, dont `coach_pilots_view`. Souhaitable pour l'espace coach, mais à décider ensemble.
5. **Renommer ou retyper un `*_consent_at` / `*_accepted_at`** casse à la fois des écritures applicatives et des **policies RLS** : `biometry_coach_read` référence `users.biometry_coach_share_consent_at` dans son prédicat.
6. **Écrire `role` ou `kyc_status` sous `service_role`** contourne `guard_users_privileged_columns()` et produit une ligne d'audit sans auteur.
7. **Passer `pilot_consent_at` à NULL** coupe instantanément l'accès du coach à toutes les données du pilote, dans toute la base.
8. **Toucher `deletion_scheduled_at`** met un compte dans la file de purge de 02:30. Il n'y a ni confirmation ni seconde barrière.

### Ce que nous demandons au site

1. **Confirmez qui écrit `public.users.first_name` et `last_name` après l'inscription.** Le trigger ne recopie pas `raw_user_meta_data`, alors que vos comptes le portent. Si personne ne le fait, l'application affiche des profils sans nom — nous préférons que le remplissage reste chez vous, là où l'utilisateur saisit ces champs.
2. **Expliquez les deux lignes `public.users` sans compte `auth.users`** (`f27e56e2-e957-4cd8-bee3-6037ae9731ab`, `f936c42c-0612-4aa4-a1af-dc320eb08f3d`) : insertion directe, ou compte Auth supprimé sans nettoyage ?
3. **Décidez si nous posons une clé étrangère `public.users.id → auth.users(id)`.** Elle rendrait les orphelins impossibles mais interdirait la stratégie actuelle d'anonymisation sans suppression. Nous ne la poserons pas sans votre accord.
4. **Confirmez que création de compte, réinitialisation de mot de passe et Sign in with Apple sont à 100 % de votre côté.** L'application n'expose aucun de ces parcours et n'en ajoutera pas.
5. **Dites-nous ce qui se passe quand un alias de relais privé Apple change.** `public.users.email` est UNIQUE et n'est pas resynchronisé depuis `auth.users` : la rotation créera une divergence silencieuse.
6. **Dites-nous qui écrit `role` et `is_admin`.** Trois lignes `role_changed` sont enregistrées sans auteur et deux comptes `role = 'admin'` ont `is_admin = false`. Si vous changez des rôles, faites-le sous session administrateur authentifiée et écrivez les deux colonnes ensemble, comme l'application.
7. **Statuez sur `community_visibility`.** Colonne `NOT NULL`, trois valeurs, commentaire précis en base, aucun lecteur ni écrivain dans l'application. Soit vous la pilotez et nous devons la respecter, soit personne ne la pilote et il faut le dire.
8. **Statuez sur `coach_pilots.status`.** L'application ne l'écrit jamais : l'unique ligne est restée `pending` alors que le pilote a consenti. Champ de votre back-office ?
9. **Arbitrez l'exposition anonyme du Pavillon.** `pavillon_pilotes_jour_rows()` et `pavillon_meteo_rows()` sont `SECURITY DEFINER` et exécutables par `anon`. La première renvoie pseudonyme, numéro et véhicule de tout pilote roulant aujourd'hui, quel que soit `pavilion_name_optin` — qui ne gouverne que le nom. C'est la seule sortie nominative non authentifiée de la base.
10. **Décrivez comment vous servez les pages publiques de partage (`app_progression_shares`).** Aucune policy `anon` n'existe ; si vous lisez en `service_role`, confirmez que vous vérifiez vous-même `revoked_at` et `expires_at`.
11. **Prenez en charge la part Stripe de l'effacement.** `purge_user_data` ne remet pas `stripe_customer_id` à NULL et ne touche ni `payments`, ni `invoices`, ni le bucket `invoices`. Rien ne vous notifie qu'une purge a eu lieu : dites-nous quel signal vous voulez (webhook, vue des comptes purgés, ou colonne `purged_at`).
12. **Tranchez la contradiction sur les documents KYC.** Votre politique de confidentialité annonce cinq ans ; la purge supprime le bucket `documents` à J+30.
13. **Confirmez la propriété de `capture-membre-fondateur`, `yousign-webhook` et du bucket `founding-members`**, absents de notre dépôt. Si `yousign-webhook` alimente `pilot_waiver_signatures`, dites-le : cette table échappe aujourd'hui à la purge.
14. **Confirmez que vous écrivez `admin_audit(action='login')`.** Les 23 lignes portent `metadata.language = 'fr-FR'`, ce qui ressemble à `navigator.language`. L'application n'écrit jamais cette action.
15. **Décidez du sort de `last_login_at` et `email_verified`.** La première est nulle sur 14 lignes sur 14 ; la seconde est à `true` sur une seule alors que 10 emails sont confirmés côté `auth.users`. Ou l'on branche une synchronisation, ou l'on retire ces colonnes du contrat.
16. **Prévenez-nous avant toute modification de `public.users`, de `handle_new_user()`, des cinq triggers de `users`, ou des fonctions `is_admin()` / `is_coach()` / `is_coach_of()` / `is_detailed_coach_of()`.** Ces objets sont lus par les policies RLS de la quasi-totalité de la base. Nous nous engageons à la réciproque.

---

## Fonction ARGENT — inscriptions, paiements, factures

Cette section dit ce que l'application mobile lit, écrit, n'écrit pas sur l'axe argent, et ce qui casserait
si vous modifiiez tel objet. Trois niveaux de certitude sont employés et jamais mélangés : **vérifié dans le
code de l'app** (chemin de fichier et ligne du dépôt mobile), **vérifié en base** (requête SQL en lecture
seule exécutée sur `fouvuqkdxarjpjbqnsjq` le 26/07/2026, avec son résultat), **déduit, à confirmer par le
site** (inférence tirée de ce que la base montre et de ce que l'app ne fait pas — nous n'avons pas accès à
votre code).

### Résumé exécutif

L'application n'encaisse rien et n'émet aucune facture OXV. Sur cet axe, elle est presque entièrement en
lecture. Ses seules écritures concernent le coaching (demandes de séance, factures émises par le coach
lui-même) et un horodatage de présence sur `registrations`.

Le tunnel de réservation existe et est complet à l'écran, mais il est **inerte** : le drapeau `app_payments`
vaut `false` en production, et même drapeau levé, aucun code de paiement n'est branché.

Trois points appellent une décision commune : la numérotation des factures coach vit dans une série
totalement disjointe de la vôtre ; `coach_profiles` publie des données de facturation à toute personne munie
de la clé anonyme ; la purge RGPD ne vide pas `coach_payout_details`.

### Volumétrie réelle en production

Vérifié en base le 26/07/2026 (`select count(*)` sur chaque table) :

| Table | Lignes | RLS | Écrite par l'app |
| --- | --- | --- | --- |
| `pricing` | 9 | activée | non (lecture seule) |
| `registrations` | 1 | activée | oui, `attended_at` uniquement |
| `payments` | 1 | activée | non |
| `invoices` | 0 | activée | non |
| `invoice_counters` | 0 | activée, **aucune policy** | non |
| `heritage_packs` | 0 | activée | non (lecture seule) |
| `subscriptions` | 0 | activée | non, jamais lue non plus |
| `coaching_bookings` | 2 | activée | oui (insert pilote, update coach/pilote) |
| `coach_invoices` | 0 | activée | oui (insert coach) |
| `coach_invoice_counters` | 0 | activée | oui, via RPC uniquement |
| `coach_payout_details` | 0 | activée | non, aucun code ne la touche |

Conséquence majeure pour la lecture de ce dossier : **aucune facture n'a jamais été émise dans ce projet**,
ni côté OXV (`invoices` = 0, `invoice_counters` = 0), ni côté coach (`coach_invoices` = 0). Tout ce qui suit
sur la numérotation est encore réversible sans reprise de données.

Les deux seules lignes commerciales existantes forment un couple cohérent (vérifié en base) : une
`registrations` du 18/07/2026 15:55, `status=pending`, `offer_type=access`, `price_total=39000`,
`price_deposit=39000`, acompte non payé ; et la `payments` correspondante, `amount=39000`, `card`,
`status=pending`, `reference=OXV-A36CB11E`, aucun `stripe_payment_intent_id`, aucune facture. Déduit, à
confirmer par le site : elle vient de votre tunnel ou d'une saisie admin, l'app n'ayant aucun chemin
d'insertion. La référence est posée par le trigger `trigger_auto_reference`.

### Ce que l'application LIT

#### `pricing` — seule source de prix affichée dans l'app

Lecture unique, `src/services/bookingCatalogService.ts:141-151` :

```ts
supabase.from('pricing')
  .select('season, offer_key, format, price_first_session_cents, price_subsequent_cents, active')
  .eq('active', true);
```

Vérifié dans le code : le filtre `active = true` est **explicite dans la requête**, jamais délégué à la RLS
(le commentaire de tête, lignes 10-13, explique qu'une policy trop permissive laisserait fuir des lignes
archivées). Vérifié en base : unicité `UNIQUE (season, offer_key, format)` ; RLS `pricing_read_all` (SELECT,
rôle `public`, `USING (active = true)`) plus quatre policies d'écriture réservées à `is_admin()`.

Contenu réel des 9 lignes, vérifié en base :

| season | offer_key | format | first_session_cents | active |
| --- | --- | --- | --- | --- |
| 2026 | access | full_day | 69000 | false |
| 2026 | access | half_day | 39000 | false |
| 2026 | heritage | full_day | 249000 | false |
| 2026 | promotion | full_day | 89000 | false |
| 2026 | signature | full_day | 59000 | false |
| 2027 | access | full_day | 69000 | false |
| 2027 | access | half_day | 39000 | **true** |
| 2027 | heritage | full_day | 249000 | **true** |
| 2027 | signature | full_day | 69000 | **true** |

L'app résout un prix par correspondance stricte `(season, offer_key, format)`
(`src/services/bookingCatalogLogic.ts:210-223`). La saison est **l'année de la date de la journée**, pas un
champ de session : `seasonForDate()` fait `isoDate.slice(0, 4)` (`bookingCatalogLogic.ts:176-178`). Les
formats `morning` et `afternoon` sont normalisés vers `half_day` avant résolution, sans repli sur `full_day`
(`bookingCatalogLogic.ts:195-200`) : une demi-journée ne peut pas être surfacturée au tarif plein.

Quatre conséquences à connaître avant de toucher à `pricing` : une journée 2026 affichera « — » pour toutes
ses offres (plus aucune ligne 2026 active) ; une journée 2027 proposant `promotion` affichera « — » (aucune
ligne `promotion` pour 2027) ; `access / full_day` 2027 existe mais est inactive ; `price_subsequent_cents`
est lu mais **jamais utilisé** — l'app affiche toujours `price_first_session_cents` et ignore la notion de
séance suivante. L'app ne fabrique jamais un montant : prix absent, inactif ou réseau en panne, tout retombe
sur « — » (`formatPriceEur(null)`, `bookingCatalogLogic.ts:93-102`).

#### `registrations` — pilote du contenu et des droits dans l'app

L'app lit `registrations` à neuf endroits. Deux usages font de cette table une table de **droits**, pas
seulement de commerce.

**Niveau de restitution.** `src/services/qdiService.ts:300-315` lit les dix dernières inscriptions du pilote,
retient la première dont le statut est dans `{confirmed, attended, pending_payment, pending}`, et rend `full`
si `offer_type` contient `signature` ou `heritage`, sinon `simple`. Autrement dit, **`registrations.offer_type`
décide de la finesse des données affichées au pilote**. Même patron pour le palier Heritage de l'accueil
(`src/features/miroir/miroirHomeLogic.ts:243-247`).

**Journées du pilote.** `src/services/nextTrackDayService.ts:34-45`, `src/features/club/useClubHub.ts:139-145`,
`src/features/vous/useVousHub.ts:155-163`. Ces lectures filtrent avec `.or('status.is.null,status.neq.cancelled')` :
`.neq` seul exclurait les statuts `NULL` en PostgREST (`nextTrackDayService.ts:33`).

Énumérations vérifiées en base (`pg_enum`) : `registration_status_enum` = pending, confirmed, cancelled,
attended, no_show, pending_payment · `offer_type_enum` = access, signature, promotion, heritage ·
`payment_status_enum` = pending, succeeded, failed, refunded · `payment_method_enum` = card, bank_transfer,
paypal · `insurance_option_enum` = personal, oxv · `heritage_pack_status_enum` = active, completed, expired ·
`subscription_status` = active, past_due, canceled · `subscription_scope` = coach, pilot.

Ces libellés sont comparés en dur dans l'app. Renommer une valeur de `offer_type_enum` ou de
`registration_status_enum` ne provoquera **aucune erreur** : l'app rétrogradera silencieusement le pilote en
restitution `simple`, ou ne verra plus sa prochaine journée. C'est la panne la plus discrète de cet axe.

#### `heritage_packs` — un compteur, rien d'autre

Lecture unique, `src/features/miroir/useMiroirHome.ts:213-226` : `sessions_used, sessions_total, status,
valid_until`, filtré `user_id = auth.uid()` et `status = 'active'`. L'app affiche `sessions_used /
sessions_total` sur l'accueil et ne code en dur ni le 4 ni le prix. Vérifié en base : `price_total` a pour
défaut `249000`, `sessions_total` pour défaut `4`, et la table est **vide** — ce compteur n'a jamais été
affiché avec de vraies données.

RLS vérifiée en base : lecture `user_id = auth.uid() OR is_admin()`, mais **INSERT / UPDATE / DELETE
réservés à `is_admin()`**. L'app ne peut donc ni créer ni décrémenter un pack. Déduit, à confirmer par le
site : c'est votre back-office qui décrémente `sessions_used`. Sinon le compteur affiché restera figé.

#### `subscriptions` — jamais lue

Vérifié dans le code : `subscriptions` n'apparaît que dans le fichier de types généré
(`src/types/database.types.ts:7301`). Aucune requête. La seule autre occurrence du mot
(`app/(admin)/en-cours.tsx:6`) désigne les abonnements Realtime, sans rapport. Vérifié en base : 0 ligne,
unicité `(user_id, scope, season)`, colonnes `stripe_customer_id` / `stripe_subscription_id`. Déduit, à
confirmer par le site : table prévue pour un abonnement web qui n'existe pas encore. L'app n'en dépend pas.

### Ce que l'application ÉCRIT

Trois écritures seulement, toutes vérifiées dans le code.

**1. `registrations.attended_at`** — `src/services/attendanceService.ts:111-121` :
`update({ attended_at: ... }).eq('id', registrationId)`. Appelée depuis un seul écran,
`app/(admin)/presences.tsx:64` : le pointage des présences le jour J. Aucune autre colonne de `registrations`
n'est jamais écrite. Aucun `insert` sur `registrations` n'existe dans le code applicatif — la seule
occurrence est un test RLS (`src/__tests__/rls/be1RLS.test.ts:82`) passant par la clé de service.

**2. `coaching_bookings`** — `src/services/coachMarketplaceService.ts` : insert par le pilote (`:375`),
toujours `status = 'pending'` ; update par le coach (`:502`), `accepted` ou `declined` + `responded_at` ;
update par le pilote (`:526`), `cancelled` + `cancelled_at`. L'app **n'écrit jamais** `amount_cents` ni
`billing_status` : recherche exhaustive sur le dépôt, ces colonnes n'apparaissent que dans les types générés
et en lecture (`src/services/pilotCoachBillingService.ts:121`). Les deux lignes existantes portent
`billing_status = 'none'` et `amount_cents = null` (vérifié en base). Elles viennent de
`supabase/migrations/20260706005057_p2_coach_billing_and_invoicing.sql:9-11` (contrainte
`billing_status in ('none','quote','settled')`) et attendent encore leur producteur.

**3. `coach_invoices` + `coach_invoice_counters`** — section dédiée ci-dessous.

Et c'est tout. **L'app n'écrit jamais** dans `payments`, `invoices`, `invoice_counters`, `pricing`,
`heritage_packs` ni `subscriptions`. Les seules écritures sur ces tables dans ce dépôt sont le fait de
fonctions Edge tournant en `service_role` (`supabase/functions/generate-invoice/index.ts:150-153`,
`send-payment-confirmed/index.ts:119`, `send-booking-confirmation/index.ts:148`), déclenchées par des
triggers de base, jamais par le client mobile.

### Le tunnel de réservation : trois écrans, zéro paiement

#### État réel du drapeau

Vérifié en base le 26/07/2026 (`select key, enabled, updated_at from app_feature_flags`) :

| key | enabled | dernière mise à jour |
| --- | --- | --- |
| `app_payments` | **false** | 2026-07-19 02:09:40+00 |
| `coach_billing` | **false** | 2026-07-06 00:50:57+00 |
| `founders` | false | 2026-07-19 02:09:40+00 |
| `biometry` | true | 2026-07-25 17:58:41+00 |
| `convoys`, `pilot_waivers`, `video_overlay` | false | — |

Description portée en base pour `app_payments` : « BE-1 : réservations/paiements in-app (Stripe/IAP). Activé
au lot A1-ON. » La table est lisible par tous (`app_feature_flags_read`, SELECT, `USING (true)`) et écrite
par `is_admin()` seulement. Côté app la lecture est **fail-closed** :
`src/services/featureFlagsService.ts:42-50` rend `false` sur erreur comme sur absence de ligne. Supprimer la
ligne `app_payments` ferme le tunnel, elle ne l'ouvre pas.

#### Les boutons sont-ils inertes ? Oui, deux fois

**Par le drapeau.** Les trois écrans le vérifient chacun avant tout affichage
(`src/features/vous/useReserverCatalog.ts:52`, `useReserverDay.ts:52`, `useReserverPayment.ts:52`). Drapeau
à `false` → `resolveBookingAccess` rend `'closed'` (`bookingCatalogLogic.ts:71-73`) et l'écran affiché est
`ReserverClosedView`, « Réservations à l'ouverture » (`src/features/vous/reserverUi.tsx:111-129`). Aucun
appel réseau commercial n'est fait dans cet état.

**Par l'absence de code de paiement.** Même drapeau levé, l'écran de paiement n'a aucun gestionnaire
d'appui : les méthodes sont des `View` non pressables portant « Bientôt »
(`app/(app2)/reserver/paiement.tsx:56-64`) ; le bouton principal est une `View` avec
`accessibilityState={{ disabled: true }}` et le texte « Paiement à l'ouverture » (`:160-170`) ; l'en-tête du
fichier l'écrit : « boutons INERTES dans ce lot (Stripe PaymentSheet et IAP abonnement branchés au lot
A1-ON) » (`:4-7`).

Le tunnel ne fait que des `SELECT` : `listAvailableDays()` et `getDay()` lisent les vues `sessions_public` et
`session_availability` plus la table `pricing` (`src/services/bookingCatalogService.ts:157-213`). L'en-tête
du service annonce « LECTURE SEULE, ZÉRO WRITE » (ligne 3), ce que la relecture confirme.

Troisième constat, moins attendu : **le tunnel est presque inatteignable**. Le seul point d'entrée est
`app/(app2)/club/pass.tsx:127`, quand le pilote n'a aucune inscription et que `passEmptyCta(paymentsEnabled)`
rend `'reserve'` (`src/features/club/passLogic.ts:136-138`). Depuis l'accueil, `decideReserve()` renvoie
`/(app2)/club` **dans les deux branches**, drapeau ON comme OFF (`src/features/miroir/miroirHomeLogic.ts:236-241`).

Trois événements Plausible sont émis même drapeau fermé, pour mesurer l'intention : `reserve_funnel_1`,
`reserve_funnel_2`, `reserve_funnel_3` (`bookingCatalogLogic.ts:53-57`).

**Ce que cela implique pour vous.** Lever `app_payments` en base n'ouvre aucun encaissement : cela remplace
un écran de fermeture par un catalogue en lecture seule et un bouton mort. Ne le levez pas sans nous
prévenir — la mention CGV de l'écran est encore un texte d'attente
(`app/(app2)/reserver/paiement.tsx:152-156`, marquée `TODO_AVOCAT`).

### Facturation OXV : entièrement de votre côté

L'app ne lit ni n'écrit `invoices` et `invoice_counters` (vérifié dans le code : aucune requête client). La
chaîne complète est serveur.

Numérotation, vérifiée en base (`pg_get_functiondef` sur `oxv_next_invoice_number`) : `SECURITY DEFINER`,
`insert into invoice_counters(year, last_number) values (y, 1) on conflict (year) do update set last_number
= last_number + 1 returning last_number`, puis `return 'OXV-' || y || '-' || lpad(n::text, 4, '0')`. Format
`OXV-2026-0001`, compteur par année, clé primaire `year`. Droits d'exécution vérifiés en base :
`postgres=X, service_role=X` — **ni `anon` ni `authenticated`**. Un client mobile ne peut pas consommer un
numéro. `invoice_counters` a la RLS activée et **aucune policy** : aucune session applicative ne la voit,
seul le `service_role` (qui contourne la RLS) l'atteint. Bon état ; nous demandons qu'il soit préservé.

Chaîne d'émission, vérifiée en base et dans le dépôt : `payments.status` passe à `succeeded` → trigger
`trg_payment_invoice` → `notify_payment_invoice()` → `net.http_post` vers `/generate-invoice` avec le
`payment_id` ; puis `supabase/functions/generate-invoice/index.ts` alloue le numéro (`:130`), construit le
PDF, l'écrit dans le bucket privé `invoices` sous `{user_id}/{number}.pdf` (`:146-147`), insère la ligne
`invoices` (`:150`), met à jour `payments.invoice_pdf_url` (`:153`) et envoie le PDF par Resend (`:158-171`).

Deux garde-fous. **SIRET** : sans le secret `OXV_SIRET`, la fonction répond 503 et n'émet rien (`:71-76`) ;
le vendeur imprimé est en dur (`:20-26`) — « OXV — Only Xtreme Vehicle », adresse Circuit de Haute Saintonge,
mention « TVA non applicable, art. 293 B du CGI ». Déduit, à confirmer par le site : le secret n'est pas
encore posé, ce qui expliquerait `invoices` à 0 ligne malgré une chaîne complète. **Idempotence** : une
facture existante pour le même `payment_id` est renvoyée telle quelle (`:115-116`), un double appel ne crée
pas de doublon.

Bucket `invoices` : privé (vérifié en base, `storage.buckets.public = false`), policy unique
`invoices_storage_read_own` — SELECT pour `authenticated` si le premier segment du chemin vaut `auth.uid()`,
ou `is_admin()`. Un pilote lit ses PDF, personne d'autre. La purge RGPD conserve délibérément ce bucket
(`supabase/functions/purge-deleted-accounts/index.ts:29-31`).

RLS de `invoices` : une seule policy, `invoices_select_own` (`user_id = auth.uid() OR is_admin()`). **Aucune
policy d'écriture** : seul le `service_role` insère. Si l'app devait un jour afficher les factures OXV du
pilote, la lecture serait déjà possible sans changement de schéma — nous ne le faisons pas aujourd'hui.

Effet de bord avant toute reprise de données : un `INSERT` dans `registrations` déclenche
`trg_registration_emails` → `notify_registration_inserted()` → deux appels HTTP (`/send-booking-confirmation`
et `/notify-admin-lead`), vérifié en base. Une réinsertion en masse enverrait autant de courriels.

### Facturation coach : émetteur, numérotation, risques de collision

#### Qui émet

Le coach, jamais OXV. C'est écrit dans le code : « l'émetteur est le COACH. OXV Mirror est un OUTIL d'aide et
n'intervient NI dans l'émission NI dans l'encaissement » (`src/services/coachInvoicePdfService.ts:10-13`).
Côté pilote, même règle : « OXV N'ENCAISSE JAMAIS. Le coach encaisse DIRECTEMENT, hors application »
(`src/services/pilotCoachBillingService.ts:4-8`).

L'identité du vendeur est figée à l'émission dans un `jsonb` `seller` recopié depuis `coach_profiles`
(`src/services/coachBillingService.ts:236-242`) : `billing_name`, `billing_address`, `billing_siret`,
`billing_legal_form`, `vat_regime`. Le nom du destinataire est figé également (`buyer_name`, ajouté par
`supabase/migrations/20260711235159_coach_invoices_buyer_name_snapshot.sql`).

Conditions d'émission (`coachBillingService.ts:183-205`) : `invoicing_assist_enabled = true` **et**
`billing_name` **et** `billing_siret` renseignés (`coachBillingLogic.ts:82-94`) ; et si le coach est assujetti
à la TVA sans taux exploitable, l'émission est **refusée** plutôt que d'imprimer « TVA 0 % » sur un document
légal (`:203-205`). Le tout est masqué par le drapeau `coach_billing`, actuellement `false`
(`app/(coach)/facturation.tsx:104`, `app/(coach)/index.tsx:178`, `src/features/club/useCoaching.ts:117`).
En-tête de l'écran coach : « Gaté par le flag `coach_billing` (INACTIF jusqu'au SIRET d'OXV) »
(`app/(coach)/facturation.tsx:10-11`).

#### Comment le numéro est attribué

Vérifié en base (`pg_get_functiondef` sur `next_coach_invoice_number`), l'essentiel :

```sql
-- SECURITY DEFINER, retourne integer, arguments (p_coach uuid, p_year integer)
declare v_coach uuid := auth.uid();
begin
  if v_coach is null then raise exception 'not_authenticated'; end if;
  -- p_coach est ignoré au profit de l'appelant authentifié
  insert into coach_invoice_counters (coach_id, year, next_number)
    values (v_coach, p_year, 1) on conflict (coach_id) do nothing;
  select * into cur from coach_invoice_counters where coach_id = v_coach for update;
  if cur.year <> p_year then alloc := 1; else alloc := cur.next_number; end if;
  update coach_invoice_counters set year = p_year, next_number = alloc + 1 where coach_id = v_coach;
  return alloc;
end;
```

Points vérifiés en base : droits d'exécution `postgres`, **`authenticated`**, `service_role` — un coach
connecté peut l'appeler, contrairement à `oxv_next_invoice_number` ; l'argument `p_coach` est **ignoré** au
profit de `auth.uid()`, donc un coach ne peut pas consommer la séquence d'un autre ;
`coach_invoice_counters` a pour clé primaire **`coach_id` seul**, pas `(coach_id, year)` — au plus une ligne
par coach, et le changement d'année réinitialise la séquence à 1 en écrasant l'année précédente ;
`SELECT ... FOR UPDATE` sérialise deux émissions simultanées.

Côté app, le numéro est formaté `YYYY-NNNN` (`src/services/coachBillingLogic.ts:77-79`, ex. `2027-0001`), et
une séquence non entière ou inférieure à 1 fait échouer l'émission plutôt que de produire un `ANNÉE-0000`
(`coachBillingService.ts:216-218`). L'unicité en base est `UNIQUE (coach_id, number)` : deux coachs auront
tous deux un `2027-0001`, et c'est voulu — ce sont deux séries indépendantes.

#### Doublon, trou : la réponse honnête

**Doublon entre les deux côtés : impossible en l'état, mais uniquement par chance de format.** Les deux
séries sont disjointes — compteur distinct (`invoice_counters` par année vs `coach_invoice_counters` par
coach), table distincte, fonction distincte, préfixe distinct (`OXV-2026-0001` vs `2027-0001`). Rien dans le
schéma ne les empêche pourtant de converger : si vous passiez le format OXV en `AAAA-NNNN`, ou si un coach
était aussi facturé par OXV, un lecteur humain ne distinguerait plus les deux documents. Il n'existe **aucune
contrainte croisée** entre les deux tables (vérifié en base : `invoices_number_key UNIQUE (number)` d'un
côté, `coach_invoices_coach_id_number_key UNIQUE (coach_id, number)` de l'autre, aucun lien).

**Trou dans la séquence coach : possible, et par construction.** Le numéro est alloué par RPC
(`coachBillingService.ts:207-213`) **avant** l'insertion de la ligne (`:221-245`). Si l'insertion échoue —
réseau coupé, RLS, contrainte — le compteur a déjà été incrémenté et le numéro est perdu. Une numérotation
comptable doit être continue ; il faut soit rendre l'opération atomique côté serveur, soit assumer et
documenter les trous. Aucune facture n'existant encore, la correction est peu coûteuse aujourd'hui.

**Trou par changement d'année** : la ligne unique par coach ne conserve pas l'historique. Un coach émettant
en janvier 2028 repart à `2028-0001` — correct — mais l'information « en 2027 j'étais arrivé à 42 » est
écrasée. Un récapitulatif annuel devra être reconstruit depuis `coach_invoices`, jamais depuis le compteur.

**Ce que le pilote voit.** `src/services/pilotCoachBillingService.ts:140-192` liste les factures qui le
concernent (RLS `coach_invoices_pilot_select`, `pilot_id = auth.uid()`), résout le nom du coach, et ouvre son
`coach_profiles.payment_link` — un simple lien externe. L'état « réglé » n'est affiché que si
`coaching_bookings.billing_status = 'settled'` est positivement lu (`:129`), jamais déduit. Aucune saisie
bancaire, aucun encaissement.

Le PDF de facture coach est généré **sur l'appareil** via `expo-print` et partagé par la feuille de partage
native (`src/services/coachInvoicePdfService.ts:16-18`). Il n'est **pas** déposé dans le bucket `invoices`.
La colonne `coach_invoices.pdf_path` existe mais reste nulle.

### `coach_payout_details` : qui peut lire les coordonnées bancaires

Colonnes vérifiées en base : `coach_id` (clé primaire, FK `users(id) ON DELETE CASCADE`), `iban`, `bic`,
`account_holder`, `created_at`, `updated_at`. **0 ligne en production.**

RLS vérifiée en base (`pg_policies`) :

| policy | cmd | rôles | using / with check |
| --- | --- | --- | --- |
| `coach_payout_details_owner_all` | ALL | `{authenticated}` | `coach_id = auth.uid() AND is_coach()` |
| `coach_payout_details_admin_all` | ALL | `{authenticated}` | `is_admin()` |

GRANT vérifiés en base (`information_schema.role_table_grants`) : `authenticated`, `postgres` et
`service_role` ont l'ensemble des privilèges ; **`anon` n'a aucun GRANT**. C'est le seul objet de tout cet
axe dont `anon` a été révoqué — la migration
`supabase/migrations/20260719011137_sec1_c_coach_payout_details.sql:36-38` fait `revoke all ... from public,
anon` avant de donner les droits à `authenticated`. Toutes les autres tables argent conservent les GRANT
Supabase par défaut, `anon` compris, et ne sont protégées que par la RLS.

Définitions vérifiées en base : `is_coach()` est `SECURITY DEFINER` et teste `users.role = 'coach'` pour
`auth.uid()` ; `is_admin()` est `SECURITY DEFINER` et teste `users.role = 'admin' OR users.is_admin = true`.

**Réponse à « qui peut lire un IBAN » :** le coach propriétaire de la ligne — à condition que son rôle soit
encore `coach` — et tout compte `role = 'admin'` ou `is_admin = true`. Personne d'autre côté client. Le
`service_role` (vos fonctions serveur, notre chaîne Edge) contourne la RLS et lit tout : c'est le point à
surveiller de votre côté, puisque le site détient également cette clé.

Deux conséquences. **Le rôle est un interrupteur** : la policy propriétaire exige `coach_id = auth.uid()`
**et** `is_coach()`. Basculer le rôle d'un compte (par exemple `coach` → `partner`) lui fait **perdre l'accès
à ses propres coordonnées bancaires** ; la ligne reste, invisible pour lui, et seul un admin peut la lire ou
la supprimer. **L'application ne touche jamais cette table** : recherche exhaustive sur le dépôt,
`coach_payout_details` n'apparaît que dans les deux migrations, dans les types générés
(`src/types/database.types.ts:1984`) et dans un commentaire (`src/services/coachBillingLogic.ts:165`). Zéro
requête. Déduit, à confirmer par le site : soit elle a été créée pour un usage web à venir, soit elle est
inutilisée. Tant qu'elle est vide, il n'y a pas d'urgence — mais la question du producteur doit être tranchée
avant la première ligne.

Garde-fou complémentaire vérifié dans le code : l'app refuse d'enregistrer un IBAN dans
`coach_profiles.payment_link`. `isAcceptablePaymentLink()` (`src/services/coachBillingLogic.ts:158-173`)
rejette toute chaîne ressemblant à un IBAN et n'accepte qu'une URL `http(s)` ; la vérification est appliquée
avant l'écriture (`coachBillingService.ts:101-103`). La raison est explicite dans le commentaire :
`payment_link` est publié par la policy `coach_profiles_read_published`.

### Points de vigilance constatés sur cet axe

Ce ne sont pas des reproches : ce sont des faits vérifiés que nous vous devons.

**1. `coach_profiles` publie les données de facturation du coach.** Vérifié en base : la policy
`coach_profiles_read_published` est une policy de **ligne** (`USING (is_published = true)`), pour le rôle
`public`, et `anon` dispose du GRANT `SELECT` sur la table. Or celle-ci porte `billing_name`,
`billing_address`, `billing_siret`, `billing_legal_form`, `vat_regime`, `vat_rate` (vérifié en base). Toute
personne munie de la clé anonyme peut donc lire l'adresse et le SIRET d'un coach dont la fiche est publiée.
Un SIRET est public par nature, une adresse personnelle non. L'exposition réelle est aujourd'hui nulle :
`select count(*) ... from coach_profiles` rend 1 profil publié, `billing_siret` et `payment_link` tous deux
nuls, `invoicing_assist_enabled` à faux. À traiter avant le premier coach réel, par une vue publique ou une
policy en colonnes.

**2. La purge RGPD ne vide pas `coach_payout_details`.** Vérifié en base : `public.purge_user_data(uuid)`
énumère une cinquantaine de tables, ni `coach_payout_details` ni `coach_invoices` n'y figurent. La clause
`ON DELETE CASCADE` de `coach_payout_details.coach_id` ne se déclenchera jamais, la stratégie retenue étant
explicitement « ANONYMISER-ET-PURGER (pas de hard-delete de la ligne users) »
(`supabase/functions/purge-deleted-accounts/index.ts:44-47`), justement parce que `payments.user_id` est en
`NO ACTION`. Un IBAN survivrait donc à une demande d'effacement. La table étant vide, la correction est
encore gratuite. Pour `coach_invoices`, la conservation est probablement légitime (obligation comptable) mais
mérite d'être écrite noir sur blanc plutôt que subie. Le cron existe et tourne :
`purge-deleted-accounts-daily`, `30 2 * * *`, actif (vérifié en base sur `cron.job`) ; un commentaire du
dépôt daté du 19/07 affirme l'inverse (`purge-deleted-accounts/index.ts:5-7`), il est périmé.

**3. Un pilote peut écrire ses propres lignes commerciales.** Vérifié en base :
`registrations_insert_own_or_admin` (`WITH CHECK user_id = auth.uid() OR is_admin()`) et
`registrations_update_own_or_admin` (mêmes termes), sans restriction de colonne. Aucune contrainte `CHECK`
ni trigger ne valide `price_total`, `price_deposit`, `status` ou `deposit_paid_at` — les trois triggers de
`registrations` sont `trg_registration_emails`, `trg_registrations_schedule_rituals`, `trg_seed_eligibility`,
aucun ne contrôle de montant. Un client porteur d'un JWT pilote pourrait créer une inscription à zéro euro,
poser `status = 'confirmed'`, et déclencher au passage l'e-mail de confirmation. L'app n'exploite pas cette
latitude, mais la porte est ouverte côté base, donc côté site aussi. À l'inverse, `payments` n'a **aucune**
policy d'INSERT ni d'UPDATE hors admin : la vérité de l'encaissement est bien verrouillée.

**4. Cohérence des montants.** `registrations.price_total`, `payments.amount`, `invoices.amount_total`,
`heritage_packs.price_total`, `coach_invoices.amount_total` sont tous des `integer` en **centimes** (vérifié
en base). L'app applique la même unité partout (`formatPriceEur`, `bookingCatalogLogic.ts:93-102` ;
`formatInvoiceAmount`, `pilotCoachBillingService.ts:55-68`). Aucune divergence constatée. Une subtilité déjà
traitée : `coach_profiles.vat_rate` est un `numeric` que PostgREST renvoie en **chaîne**, ce qui ramenait
silencieusement le taux de TVA à zéro ; la conversion est faite à la frontière
(`coachBillingLogic.ts:69-74`). Si vous lisez cette colonne côté site, méfiez-vous du même piège.

### Ce que nous demandons au site

1. **`OXV_SIRET`** : confirmez si le secret est posé sur les fonctions Edge. Tant qu'il ne l'est pas,
   `generate-invoice` répond 503 et aucune facture OXV ne peut être émise
   (`supabase/functions/generate-invoice/index.ts:71-76`). Le drapeau `coach_billing` est explicitement
   suspendu à cette même condition.
2. **Numérotation** : confirmez que la série OXV reste préfixée `OXV-AAAA-NNNN` et ne prendra jamais la forme
   `AAAA-NNNN` utilisée par les factures coach. Si un changement de format est envisagé, dites-le : nous
   changerons le nôtre, personne n'ayant encore émis de facture des deux côtés.
3. **Trou de séquence coach** : décidez si la numérotation coach doit être strictement continue. Si oui, nous
   déplaçons allocation et insertion dans une seule fonction serveur transactionnelle. Si non, écrivons
   ensemble que les trous sont assumés, et pourquoi.
4. **`coach_payout_details`** : dites-nous qui écrit dans cette table. L'app ne l'utilise pas. Si c'est le
   site, précisez par quel écran et avec quelle clé. Si personne, nous proposons de la supprimer tant qu'elle
   est vide.
5. **Purge RGPD** : validez l'ajout de `delete from coach_payout_details where coach_id = p_user` dans
   `purge_user_data`, et confirmez la durée de conservation retenue pour `coach_invoices`, `invoices`,
   `payments` et `registrations` (obligation comptable présumée, à écrire).
6. **`coach_profiles`** : validez que `billing_address` et `billing_siret` ne doivent pas être lisibles par
   un client anonyme, et choisissez le remède — vue publique restreinte ou policy en colonnes. Nous
   adapterons nos lectures (`coachMarketplaceService`, `pilotCoachBillingService`) à la vue exposée.
7. **`registrations`** : confirmez que le site est la seule source d'insertion, et dites-nous si vous
   souhaitez restreindre la policy `registrations_insert_own_or_admin` (montant, statut). L'app n'insère rien
   et n'a pas besoin de ce droit.
8. **`pricing`** : quatre trous nous concernent directement — les cinq lignes 2026 sont toutes
   `active = false` ; `promotion` n'existe pas pour 2027 ; `access / full_day` 2027 est inactive ;
   `price_subsequent_cents` n'est jamais utilisé par l'app. Confirmez que c'est délibéré, ou complétez la
   table. Une journée sans ligne active affiche « — », jamais un prix approché.
9. **Énumérations** : engagez-vous à ne pas renommer les valeurs de `offer_type_enum` ni de
   `registration_status_enum` sans nous prévenir. Elles pilotent le niveau de restitution des données du
   pilote (`src/services/qdiService.ts:300-315`) et une modification ne produirait aucune erreur — seulement
   une dégradation silencieuse.
10. **`coaching_bookings.amount_cents` et `billing_status`** : ces colonnes existent, sont contraintes
    (`none | quote | settled`) et ne sont écrites par personne. Dites-nous si le site prévoit de les
    alimenter ; sinon nous câblerons le coach dessus au lot `coach_billing`.
11. **`subscriptions`** : la table est vide et l'app l'ignore. Confirmez qu'elle relève entièrement du web,
    ou décrivez ce que l'app devrait en afficher.
12. **`app_payments`** : prévenez-nous avant de lever le drapeau. Aucun moyen de paiement n'est branché côté
    app, et la mention CGV de l'écran de paiement est encore un texte d'attente
    (`app/(app2)/reserver/paiement.tsx:152-156`).

---

## Fonction MÉDIAS et partages publics

Cette section couvre tout ce qui, dans la base partagée, porte un fichier ou rend une donnée visible hors du compte qui l'a produite : les treize buckets de stockage, les liens de partage de progression, la vue AR servie par le web, et le tableau de marche du direct.

Convention de sourçage, sans exception : **vérifié en base** signifie une requête SQL en lecture seule sur `fouvuqkdxarjpjbqnsjq`, exécutée le 26 juillet 2026. **Vérifié dans le code de l'app** renvoie à un fichier et une ligne du dépôt `oxv-app`. **Déduit, à confirmer par le site** signifie que nous n'avons pas accès à votre dépôt et que notre conclusion repose sur ce que la base montre et sur ce que l'application ne fait pas. Ce n'est alors pas une preuve.

### Les treize buckets en un coup d'œil

Vérifié en base (`storage.buckets` jointe à `storage.objects`, comptage réel).

| Bucket | Visibilité | Objets | Poids | Limite / MIME | Écrit par |
|---|---|---|---|---|---|
| `audio_briefings` | privé | 1 | 664 kB | 10 Mo, `audio/mpeg` | fonction edge |
| `avatars` | **public** | 0 | — | 5 Mo, images | personne |
| `coach-audio` | privé | 0 | — | aucune | app (coach) |
| `coach-media` | **public** | 1 | 31 kB | aucune | site (déduit) |
| `documents` | privé | 9 | 12 Mo | 10 Mo, image + PDF | site (déduit) |
| `founding-members` | privé | 1 | 52 kB | 10 Mo, PDF | site (déduit) |
| `invoices` | privé | 0 | — | aucune | fonction edge |
| `partner-media` | **public** | 2 | 37 kB | aucune | site (déduit) |
| `pavillon-photos` | privé | 0 | — | aucune | personne à ce jour |
| `pilot-media` | privé | 0 | — | 50 Mo, image + vidéo | app (pilote) |
| `session-media` | privé | 0 | — | 50 Mo, image + vidéo | app (admin) |
| `telemetry_raw` | privé | 3 | 49 kB | 50 Mo, binaire | app (pilote) |
| `vehicles` | privé | 8 | 22 Mo | 50 Mo, `image/*` | site (déduit) |

Total réel : **25 objets, environ 35 Mo**. La production de médias est aujourd'hui marginale, et deux buckets alimentés par le site (`documents`, `vehicles`) portent 17 des 25 objets. `storage.objects` a la RLS activée (vérifié : `pg_class.relrowsecurity` vaut vrai) ; les trois buckets publics y échappent en lecture, servis par URL sans jeton ni session.

### `coach-media` — public, une photo, et elle ne vient pas de nous

Policies vérifiées en base : SELECT `TO public` sans autre condition que le bucket ; INSERT réservé à `is_coach() OR is_admin()` dans le dossier `auth.uid()` ; UPDATE et DELETE sur le seul dossier propriétaire.

L'application sait écrire ici — `src/services/coachMediaService.ts:22` (bucket), `:145` (chemin `{coachId}/{uuid}.{ext}`), `:149` (upload), `:40` (URL publique). Mais l'unique objet contredit ce chemin :

```
6edd7f5c-f691-49b1-a083-c4cfcce0e66e/profil-1784386724941.webp   image/webp
```

Trois écarts : le nom est `profil-<horodatage>` et non un UUID ; le format est **WebP**, que le sélecteur de médias iOS ne produit pas ; et `coach_profiles.media` vaut `[]`, jamais renseigné. En revanche `coach_profiles.photo_url` porte l'URL publique exacte de ce fichier.

Déduit, à confirmer par le site : cette photo vient d'un téléversement web qui convertit en WebP et écrit `coach_profiles.photo_url`. Nous en dépendons directement — l'application lit `photo_url` dans la fiche coach (`src/services/coachProfileService.ts:93` et `:112`) et dans le catalogue (`src/services/coachMarketplaceService.ts:250` et `:266`). Si vous changez ce chemin, le portrait disparaît de l'app le jour même.

### `partner-media` — public, deux objets, aucun code app

Lecture `TO public` sans condition ; écriture réservée à `is_partner() OR is_admin()` dans son propre dossier. Les policies UPDATE et DELETE sont déclarées `TO public` plutôt que `TO authenticated` : sans danger, `auth.uid()` étant nul pour un anonyme, mais plus large que l'intention.

Vérifié dans le code : la chaîne `'partner-media'` n'apparaît **nulle part** dans `src/` ni `app/`. Les deux objets (`logo-1784614171286.webp`, `media-1784614192652.webp`) sont référencés par `partner_accounts.logo_url` et `partner_accounts.media`, en URL publique.

Déduit, à confirmer par le site : l'espace partenaire web est le seul producteur. L'application est **lectrice** de ces URL — `src/services/partnerService.ts:69` et `:84`, `src/features/club/partenairesLogic.ts:60` et `:82`.

### `documents` — privé, neuf pièces, et des URL signées d'un an

Policies : le pilote lit, dépose, modifie et supprime dans `{uid}/…` ; `is_admin()` a tout pouvoir.

Vérifié dans le code : **aucun appel storage vers `documents`**, et la table `public.documents` n'est jamais interrogée. L'écran « Licence & documents » (`app/(app2)/vous/documents.tsx`) ne lit que `ffsa_license`, `kyc_status`, `kyc_validated_at` dans `users` (`src/features/vous/useDocuments.ts:52`). Vérifié en base : 9 objets, 9 lignes, types `driving_license`, `id_card`, `insurance_road`, `insurance_track`.

Un point factuel mérite votre attention. `documents.file_url` ne stocke pas un chemin mais une **URL signée complète**, jeton inclus :

```
https://<projet>.supabase.co/storage/v1/object/sign/documents/<uid>/<fichier>?token=…
```

En décodant la charge utile des neuf jetons (vérifié en base), les expirations vont du **9 mai 2027 au 18 juillet 2027**, soit environ **365 jours** après dépôt. Conséquence mécanique : pendant un an, quiconque détient cette chaîne lit la pièce d'identité, sans session et sans RLS. Nous ne qualifions pas la décision ; nous la signalons parce que la colonne est partagée et que nous ne l'avons pas écrite.

### `vehicles` — privé, huit photos, et un doublon fonctionnel

Quatre policies pilote sur `{uid}/…`, plus une policy admin `ALL`. Chemins observés : `{uid}/{vehicleId}/{front|side|rear|interior}.{ext}`, 22 Mo à eux seuls.

Vérifié en base : `public.vehicles` compte 6 lignes, dont 5 portent un `photo_front_url` — **toutes des URL signées**, aucune publique, même durée d'un an (expirations mai à juin 2027).

Vérifié dans le code : aucun appel storage vers `vehicles`, et **aucune lecture de `photo_front_url`** ni des trois colonnes sœurs. Le garage de l'application stocke ses visuels dans `pilot-media`, rattachés par une clé `vehicleId` glissée dans le jsonb `users.media` (`src/services/pilotMediaService.ts:38-43`, `:124-149`).

Il existe donc **deux emplacements parallèles pour la photo d'un même véhicule**, qui ne se voient pas l'un l'autre. Ce n'est pas un bug, c'est une divergence non arbitrée.

### `founding-members` — privé, aucune policy du tout

Vérifié en base : **aucune policy storage ne mentionne ce bucket**. Seul le `service_role` y accède. Cohérent avec `public.founding_members` (migration `20260721060455_founding_members.sql`) : RLS activée, aucune policy, écriture réservée à l'edge function. L'unique objet, `Lettre_Intention_Membre_Fondateur_OXV.pdf`, est à la racine du bucket, sans préfixe utilisateur.

Vérifié dans le code : `founding-members` n'apparaît nulle part dans `src/` ni `app/`. Déduit, à confirmer par le site : brique de la page d'atterrissage web, hors périmètre de l'application.

### `pilot-media` — le seul bucket vraiment « app »

Policies vérifiées en base : écriture sur `foldername[1] = auth.uid()` ; lecture pour le propriétaire, `is_admin()`, ou `is_coach_of(propriétaire)` — cette dernière portant une exclusion explicite, `foldername[2] IS DISTINCT FROM 'incidents'`.

Un coach affilié voit donc la vitrine de son pilote, mais **jamais** le sous-dossier `incidents`, alimenté par le service de signalement (`src/services/v2/incidentService.ts:20` et `:84`). Lecture toujours par **URL signée de 30 minutes** (`src/services/pilotMediaService.ts:27` et `:84`), jamais publique. Vérifié en base : 0 objet, `users.media` vide ou nul sur les 14 comptes. Câblé, pas encore utilisé.

### `session-media` — lecture large, écriture admin

SELECT pour le propriétaire, ses amis (`are_friends`), son coach (`is_coach_of`) ou un admin ; **écriture réservée à `is_admin()`**. La table `public.session_media` reproduit la même géométrie (quatre policies SELECT, écriture admin).

Côté app : `src/services/sessionMediaService.ts:59` (bucket), `:60` (URL signée **15 minutes**), `:172` (chemin `{pilotId}/{sessionId}/{mediaId}.{ext}`). Vérifié en base : **0 objet, 0 ligne**. La galerie pilote (`src/features/club/useGalerie.ts:22`) s'appuie dessus : elle est donc vide à l'écran, ce qui est le comportement correct et non une panne.

### `telemetry_raw` — strictement personnel

Quatre policies identiques dans leur esprit : `foldername[1] = auth.uid()`. Ni coach, ni ami, ni admin. C'est le bucket le plus fermé du projet.

`src/services/telemetryStorage.ts:20`, chemin `{userId}/{telemetrySessionId}.ubx` (`:54`), puis écriture de `telemetry_sessions.raw_data_url` sous la forme `telemetry_raw/{chemin}` (`:64`) — un **chemin**, pas une URL. Vérifié en base : 3 fichiers `.ubx`, 49 kB, déposés entre le 14 juin et le 2 juillet 2026.

### `coach-audio` — nommage sans dossier

Particularité à connaître : les objets ne sont pas rangés dans un dossier utilisateur, le nom de l'objet **est** l'UUID de l'annotation (`src/services/coachAudioService.ts:82`). Les quatre policies passent donc par une jointure `uuid_or_null(objects.name)` vers `coach_annotations` : le coach auteur écrit et supprime ; le pilote lit seulement si l'annotation est non supprimée et `visibility = 'shared'`. Vérifié en base : 0 objet, et `coach_annotations` compte 0 ligne — cohérent.

### Les buckets des fonctions edge, et les buckets morts

`audio_briefings` porte une policy unique, `ALL` au rôle `public`, de prédicat `bucket_id = 'audio_briefings' AND false` : elle interdit tout à tout le monde, seul le `service_role` passe. Producteur : `ritual_dispatcher` (`supabase/functions/ritual_dispatcher/lib/supabase.ts:243` pour le chemin `{userId}/{dispatchId}.mp3`, `:246` pour l'upload), qui délivre ensuite une URL signée de **604 800 secondes, soit 7 jours** (`:256`). Un objet en base, un MP3 de 664 kB du 23 mai 2026.

`invoices` n'a qu'une policy SELECT (`{uid}/…` ou `is_admin()`) ; l'écriture passe par `generate-invoice` en `service_role` (`supabase/functions/generate-invoice/index.ts:147`). 0 objet, 0 ligne. Ce bucket est explicitement **exclu de la purge de compte** pour conservation comptable (`supabase/functions/purge-deleted-accounts/index.ts:60-62`).

`pavillon-photos` : `is_admin()` en `ALL`, SELECT pour tout `authenticated`. La table `public.pavillon_photos` suit la même règle. 0 objet, 0 ligne, aucune référence dans l'application. Hors purge automatique, faute de préfixe utilisateur. Déduit, à confirmer par le site : ce sont les visuels des écrans du Pavillon, donc de votre ressort.

`avatars` est **public, vide et sans usage constaté**. Trois policies d'écriture exigeant `auth.uid() = foldername[1]`, aucune policy SELECT (sans conséquence, le bucket étant public). Vérifié dans le code : la chaîne `'avatars'` n'apparaît que dans la liste de purge (`purge-deleted-accounts/index.ts:67`) ; l'application affiche des initiales calculées, jamais une image (`src/components/CoachRail.tsx:68`). Vérifié en base : `users.avatar_url` est **nul pour les 14 comptes**. Déduit : ce bucket est mort des deux côtés — mais il porte votre nom de colonne autant que le nôtre, donc nous ne le supprimons pas.

### Trois façons de désigner un fichier, et elles ne se valent pas

| Méthode | Où | Durée | Conséquence |
|---|---|---|---|
| Chemin nu, signé à l'affichage | app : `pilot-media` (30 min), `session-media` (15 min), `coach-audio` (1 h), `telemetry_raw` (chemin brut) | à la demande | rien ne fuit d'une ligne volée |
| URL publique stockée | site : `coach_profiles.photo_url`, `partner_accounts.logo_url` | infinie | assumé, ces visuels sont publics |
| **URL signée stockée en base** | site : `documents.file_url`, `vehicles.photo_*_url` | **≈ 365 jours** | la ligne vaut la pièce jointe |

Le troisième cas est le seul qui nous préoccupe : il transforme une donnée d'identité rangée dans un bucket privé en lien porteur d'un an, recopiable. Vérifié en base pour les 14 lignes concernées.

Sur la purge : `supabase/functions/purge-deleted-accounts/index.ts:64-77` énumère les buckets nettoyés par préfixe `{userId}/` — `vehicles`, `documents`, `avatars`, `audio_briefings`, `pilot-media`, `session-media`, `telemetry_raw`, `coach-media` — plus `coach-audio`, traité à part via la liste des annotations du compte. Point d'attention : `vehicles` et `documents` en font partie, donc la purge d'un compte efface des fichiers que **le site a déposés**. Elle n'atteint évidemment pas les URL signées déjà distribuées.

### Partage de progression — la table et son état réel

`public.app_progression_shares`, créée par `supabase/migrations/20260524230007_0011_app_progression_shares.sql`. Colonnes qui comptent : `user_id` (`NOT NULL`, `ON DELETE CASCADE` vers `users`), `share_token` (`text NOT NULL UNIQUE`), `share_scope` (contraint à quatre valeurs), `included_metrics` (`jsonb NOT NULL DEFAULT '[]'`), `expires_at`, `revoked_at`, `view_count` (`DEFAULT 0`), `last_viewed_at`.

**Nombre de lignes réel en production : 1.** Vérifié en base. Portée `last_5_sessions`, une seule métrique cochée (`regularity`), jeton de 32 caractères, `view_count = 0`, et **expirée depuis le 14 juillet 2026**. Le mécanisme n'a jamais servi hors essai.

RLS : quatre policies, toutes `TO authenticated` — SELECT propre ou admin, SELECT coach via `is_coach_of(user_id)`, puis INSERT, UPDATE et DELETE sur ses propres lignes. **Aucune policy ne vise `anon`** : un anonyme ne lit rien de cette table, même en connaissant le jeton.

Nuance importante si vous auditez : les *grants* SQL sont larges (`anon` détient SELECT, INSERT, UPDATE, DELETE — vérifié dans `information_schema.role_table_grants`), motif Supabase par défaut. La protection ne vient pas du grant, elle vient **entièrement de la RLS**.

### Partage de progression — jeton, durées, liste blanche

Le jeton est tiré de 24 octets de `crypto.getRandomValues` encodés en base64url, soit **32 caractères et environ 190 bits d'entropie** (`src/services/sharesService.ts:70-87`).

Trois durées, et trois seulement (`app/(app)/partage.tsx:55-58`) : **7 jours** par défaut, **30 jours**, **sans limite**. La date est calculée côté client puis écrite dans `expires_at` (`sharesService.ts:99-101`). La révocation est manuelle et immédiate : elle pose `revoked_at` (`sharesService.ts:140-150`), et les deux RPC de lecture refusent alors le jeton.

La liste blanche de métriques compte cinq clés, pas une de plus (`sharesService.ts:21-27`) : `best_lap` (Meilleur tour), `regularity` (Régularité), `progression` (Évolution, soi contre soi), `lap_count` (Nombre de tours), `signature` (Signature de pilotage). `sanitizeIncludedMetrics` (`:32-42`) filtre strictement contre cet ensemble et déduplique ; un test verrouille le comportement, y compris sur une clé `service_role` glissée en entrée (`src/services/__tests__/sharesService.test.ts:19`). Le défaut est l'**ensemble vide**, et l'écran refuse la création tant qu'aucune case n'est cochée (`partage.tsx:87`). Aucune marge, aucun score, aucun jugement n'est partageable.

### Partage de progression — comment un jeton se lit

Deux fonctions `SECURITY DEFINER` existent en production (vérifié en base : `prosecdef` vrai, `EXECUTE` accordé à `anon` et `authenticated`).

`get_shared_progression(p_token text)` — migration `20260614005135_secure_progression_share_read.sql` — renvoie **les métadonnées seules** (portée, métriques cochées, dates), incrémente `view_count` et `last_viewed_at`, et ne renvoie aucune ligne si le jeton est inconnu, révoqué ou expiré.

`get_shared_progression_values(p_token text)` — migration `20260622235835_shared_progression_values_rpc.sql` — ajoute un jsonb `metric_values` recalculé à la volée depuis les séances du propriétaire, **uniquement pour les clés cochées** (`v_metrics ? 'best_lap'`, etc.), et ne renvoie jamais `user_id`, ni nom, ni identité.

L'en-tête de la première migration vous est adressé nommément, ligne 13 : « Le site oxvehicle.fr/share/{token} doit lire via cette RPC (plus via SELECT). » Le motif est écrit lignes 1 à 6 : la policy d'origine utilisait `USING(true)` et exposait **toutes** les lignes à `anon`. Elle a été supprimée. Un `select * from app_progression_shares` avec la clé anonyme ne renvoie donc plus rien.

**L'application n'appelle que la première** (`sharesService.ts:167`) et affiche les libellés des métriques partagées, pas leurs valeurs (`app/(app)/share/[token].tsx:112-124`). `get_shared_progression_values` n'a **aucun appelant dans le dépôt de l'application** : elle a été écrite pour vous.

### Partage de progression — le lien ouvre le navigateur, toujours

C'est un fait établi, et il tient en trois vérifications.

**Un.** L'application fabrique l'URL en dur : `src/services/sharesService.ts:58`, `const SHARE_BASE_URL = 'https://oxvehicle.fr/share'`. `shareUrlFor(token)` (`:60-62`) renvoie `https://oxvehicle.fr/share/<token>`. C'est cette chaîne que la feuille de partage native envoie (`app/(app)/partage.tsx:102-103`) et que l'écran affiche sous chaque lien actif (`:267`).

**Deux.** `app.json` ne déclare **aucun domaine associé**. Vérifié par recherche sur l'ensemble du dépôt : `associatedDomains` (iOS), `intentFilters` et `autoVerify` (Android), `applinks`, et toute configuration `prefixes` d'`expo-linking` sont **absentes, sans une seule occurrence**. Le seul schéma déclaré est `"scheme": "oxv"`, c'est-à-dire `oxv://…`, qui ne capte pas les URL `https://`.

**Trois.** Conséquence directe : iOS n'a aucune raison d'associer `oxvehicle.fr` à l'application. Un clic sur le lien ouvre **le navigateur dans tous les cas**, y compris sur le téléphone du pilote qui vient de créer le lien et qui a l'application installée.

Il existe pourtant un écran de lecture in-app, `app/(app)/share/[token].tsx`. Il est doublement inatteignable pour un destinataire : aucun lien universel ne le vise, et il vit dans le groupe `(app)`, dont le layout redirige vers la connexion si la session est absente (`app/(app)/_layout.tsx:17-18`). Un destinataire sans compte OXV ne le verra jamais.

**Tout ce que voit le destinataire d'un partage est donc servi par vous.** Si `oxvehicle.fr/share/<token>` n'existe pas, le pilote partage un lien mort, et l'application n'a aucun moyen de le savoir : `view_count` reste à zéro, ce qui est exactement l'état de l'unique ligne en base.

### La vue AR servie par `app.oxvehicle.fr/ar-view`

> **CETTE VÉRIFICATION EST PÉRIMÉE (02/08/2026).** `AR_VIEW_URL` n'existe plus
> nulle part dans `app/` ni `src/`, pas plus que l'import de `react-native-webview`.
> La WebView a été retirée le 31/07/2026 et le sous-domaine ne sera pas créé.
>
> C'était le marqueur `[APP]` de ce dossier — celui que l'en-tête présente comme
> « vérifié dans le code, chemin et ligne donnés », donc le plus fiable des
> trois. Une vérification datée et chiffrée qui a cessé d'être vraie coûte plus
> cher qu'une absence de vérification : elle est crue sans être recontrôlée.

~~Vérifié dans le code : `app/(coach)/ar.tsx:99`, `const AR_VIEW_URL = 'https://app.oxvehicle.fr/ar-view'`.~~

Cet écran est **réservé au coach** (il vit sous `app/(coach)/`, gardé par rôle) et concerne les lunettes Ray-Ban Display portées **au bord de piste**. L'en-tête du fichier (lignes 5 à 34) pose la doctrine : jamais côté pilote, des faits et jamais une consigne, matériel en avant-première donc marqué « EXPÉRIMENTAL ».

Ce que l'application fait de votre route, exactement : elle l'ouvre dans une `WebView` en lecture seule (`:541`) avec `originWhitelist={['https://*']}` (`:542`) ; **elle n'ajoute aucun paramètre à l'URL** — pas de jeton, pas d'identifiant de séance, pas de nom de pilote, l'URL appelée est littéralement la constante ci-dessus ; et elle gère l'absence de route sans planter, `onError` et `onHttpError` basculant l'aperçu sur « Aperçu indisponible — La vue web arrive bientôt » (`:228-235`, `:557-562`).

Deux points à connaître avant d'écrire cette page.

**Aucune donnée de santé ne vous est transmise.** Quand une séance est réellement en cours, l'application **remplace** la WebView par un rendu natif (`:266-285`, `:583-660`). La fréquence cardiaque, quand elle existe, est affichée par ce rendu natif, et l'en-tête l'explicite lignes 29 à 34 : elle « est rendue EN NATIF et n'est JAMAIS passée à la WebView ni ajoutée à l'URL de la route web ». Si la vue web devait un jour afficher des faits en direct, il faudra un canal explicite, et la santé n'en fera pas partie.

**Le bouton « Lancer la vue AR » ne lance rien** (`:248-253`) : la fonction déclenche un retour haptique et s'arrête, avec le commentaire « Prototype : la mise en route live (push vers les lunettes) sera branchée quand la route web E0.2 et l'appairage seront disponibles ». Rien n'attend votre page hors de l'aperçu.

Déduit, à confirmer par le site : le sous-domaine `app.oxvehicle.fr` est le vôtre et la route `ar-view` n'est pas encore servie — l'application est écrite pour ce cas et l'affiche honnêtement. Nous ne savons pas si ce sous-domaine existe.

### Tableau de marche du direct — le canal et sa charge utile

C'est la partie où la frontière entre nos deux dépôts est la plus nette : **l'émetteur est chez nous, le récepteur est chez vous.**

Vérifié dans le code : `src/services/liveSessionService.ts:35-37`, trois topics Realtime, tous privés (`{ config: { private: true } }`) — `live:roster:<coachId>` (présence, par coach), `live:session:<id>` (flux télémétrique vers le coach), `live:board:<id>` (tableau de marche, audience élargie).

Seul le troisième nous occupe ici. Il est ouvert par le **pilote** en cours de capture (`openBoardBroadcast`, `:374-391`), à raison d'**un message par seconde au maximum** (`src/services/boardLogic.ts:197-201`, intervalle minimal de 1000 ms) : un écran de télévision se lit à six mètres, il n'a aucun besoin du flux brut, et une cadence basse limite mécaniquement ce qui transite.

La charge utile compte six champs, et six seulement (`boardLogic.ts:28-41`) :

| Champ | Type | Sens |
|---|---|---|
| `pilotHandle` | `string` | pseudo public (`users.public_handle`), **jamais l'état civil** |
| `carNo` | `number \| null` | numéro de voiture (`users.car_number`) |
| `lastLapMs` | `number \| null` | dernier tour mesuré |
| `bestLapMs` | `number \| null` | meilleur tour **personnel** |
| `sector` | `number \| null` | secteur en cours |
| `ts` | `number` | horodatage epoch |

Aucun rang, aucun écart au meilleur du plateau, aucun indicateur de progression relative — le commentaire lignes 23 à 26 les qualifie de « formes déguisées de classement ». Un `null` se rend « — » à l'écran, **jamais un 0 de repli** : un tour de 0 ms se lirait comme un tour imbattable (`boardLogic.ts:88-91`). Si vous rendez cette donnée, merci de conserver cette règle.

Le filtre de santé est technique et non déclaratif : `stripHealth` (`src/services/v2/liveHealthGate.ts:76-88`) applique une **liste blanche stricte** de huit clés (`:54-63`), et le service la **réapplique** à l'émission (`liveSessionService.ts:387`) même si l'appelant l'a déjà fait. Le commentaire lignes 38 à 43 en donne la raison : brancher demain un capteur santé quelconque ne crée aucune fuite tant que sa clé n'est pas explicitement inscrite. Enfin, le canal ne s'ouvre pas du tout si le pilote n'a pas de pseudo public (`src/services/liveRelayRunner.ts:232`), avec le commentaire « le prénom ne le remplace PAS — l'état civil n'a rien à faire sur un écran que tout le paddock regarde ».

### Tableau de marche — la règle d'ordre est juridique, pas esthétique

Vérifié dans le code : `src/services/boardLogic.ts:57`, `export const BOARD_MODE: 'A' | 'B' = 'A'`.

`'A'` est le tableau de marche : ordre par **numéro de voiture croissant**, les voitures sans numéro en fin. `'B'` est un classement par chrono, spécifié mais désactivé ; le commentaire lignes 45 à 55 précise qu'il ne peut être activé qu'après avis d'avocat, le risque étant la requalification juridique d'un track day en compétition, ce qui engage l'assurance de la plateforme. Un test verrouille la valeur (`src/services/__tests__/boardLogic.test.ts:23`). `sortBoard` (`:140`) et `compareCarNo` (`:112-131`) sont les seules implémentations de cet ordre, volontairement isolées pour qu'une seconde ne puisse pas réintroduire un tri par performance.

### Tableau de marche — l'écran de télévision vit dans votre dépôt

Ce dépôt-ci ne contient qu'une **maquette statique** : `design-retours/maquettes-tv/tv-accueil.html`, 429 lignes, dont le titre est littéralement « Accueil TV (maquette site web) ». Son en-tête (lignes 10 à 35) énumère les liaisons prévues **côté site** : Realtime sur `telemetry_sessions`, présence live, `weather_snapshots`, `social_pings` publiés, `partner_accounts` validés, rotation des cartes toutes les 12 secondes.

Vérifié dans le code : `subscribeBoard` (`liveSessionService.ts:399`) **n'a aucun appelant** dans l'application, hors tests. Nous émettons ; personne, chez nous, n'écoute.

Deux règles de la maquette sont de doctrine et non de graphisme, et doivent survivre à l'implémentation : le mur des cartes est **chronologique** (ordre d'arrivée en piste), avec le libellé « ordre d'arrivée » affiché à l'écran pour que la nature du mur soit lisible de tous ; et le nom du pilote n'apparaît **que si `users.pavilion_name_optin = true`**, sinon `N°{car_number}`, et à défaut « Pilote OXV », aucune photo de pilote sans opt-in.

L'application écrit cet opt-in, et lui seul (`src/components/profil/OptinPavillon.tsx`, en-tête lignes 4 à 6 : « Écriture : le SEUL champ `users.pavilion_name_optin` »). Il est **désactivé par défaut**. Vérifié en base, sur 14 comptes : `public_handle` renseigné **2 fois**, `car_number` **0 fois**, `pavilion_name_optin` vrai **1 fois**.

Conséquence à connaître avant la première journée : douze pilotes sur quatorze n'ont pas de pseudo public, donc **leur ligne board ne serait pas émise du tout** ; et aucun n'a de numéro de voiture, donc l'ordre d'affichage se replierait entièrement sur le départage alphabétique.

### Tableau de marche — l'obstacle qui bloque votre écran aujourd'hui

Vérifié en base, les policies de `realtime.messages` : `board_recv` (SELECT, `TO authenticated`) et `board_send` (INSERT, `TO authenticated`). `board_recv` autorise la lecture au **pilote propriétaire** de la séance et aux **coachs de son binôme actif** ayant reçu le consentement live. Personne d'autre. Le rôle `anon` n'est pas mentionné.

Un écran de télévision de paddock, ouvert avec la clé anonyme, **ne recevra donc rien**. Ce n'est pas un oubli : la migration `supabase/migrations/20260725185806_live_board_realtime_authorization.sql` l'écrit noir sur blanc, lignes 28 à 50, sous le titre « LIMITE ASSUMÉE ». Le raisonnement, résumé fidèlement : le cahier voulait que **tout inscrit de la journée** puisse lire le board ; or une séance de télémétrie (`public.telemetry_sessions`) **ne porte aucune référence vers la journée de roulage** (`public.sessions`) à laquelle on s'inscrit — seuls `user_id`, `circuit_id` et `started_at` sont renseignés à la création, `event_id` restant nul ; rapprocher les deux par circuit et date « serait une DEVINETTE », et un `circuit_id` nul ferait s'ouvrir la règle en grand ; donc **fail-closed**, l'audience la plus étroite qui soit défendable.

La brique manquante est nommée dans la migration : `public.is_registered_for_session(uuid)` existe déjà et sert les convois ; il ne manque que le chaînon séance vers journée — **par exemple une colonne `telemetry_sessions.day_session_id` vers `public.sessions`**. C'est une décision de schéma partagé, et nous ne la prendrons pas seuls.

Le cas du téléviseur lui-même est explicitement hors périmètre (lignes 47 à 50) : en tant qu'appareil dédié, il lui faudra un **compte de service avec son propre jeton** et son propre chemin d'autorisation, « à écrire le jour où ce compte de service existe ».

### Le journal d'exports, pour mémoire

`public.media_exports` trace, en propre-ligne, quand un pilote sort une image hors de l'application : `user_id`, `export_type` (`image` / `link` / `story` / `pdf`), `session_media_id`, `telemetry_session_id`, `created_at`. RLS : propriétaire en `ALL`, plus une lecture admin. **0 ligne en base.**

Deux appelants seulement, tous deux dans la carte-souvenir (`app/(app)/carte-trophee.tsx:158` pour l'image, `:174` pour le lien). Le « lien » partagé n'est d'ailleurs pas un lien de progression : c'est `https://oxvehicle.fr` tout court (`:55`, `:170`). Aucune donnée n'est envoyée à un tiers — la capture passe par la feuille de partage du système, déclenchée par le pilote. L'application ne publie jamais d'elle-même.

Enfin, la table héritée `public.media` (`file_url`, `visible_to_user`, `published_at`) compte **0 ligne** et n'a **aucun appelant** dans l'application. Déduit, à confirmer par le site : c'est un vestige.

### Ce que nous demandons au site

1. **Confirmez que `oxvehicle.fr/share/<token>` est servi**, et dites-nous quelle RPC la page appelle : `get_shared_progression` ne rend que des libellés de métriques, `get_shared_progression_values` rend les valeurs. L'application affiche cette URL au pilote comme un lien fonctionnel ; si la page n'existe pas, nous devons retirer la fonctionnalité ou changer le texte.

2. **Dites-nous si ce lien doit ouvrir l'application** quand elle est installée. Aujourd'hui il ouvre toujours le navigateur, faute de domaine associé déclaré. Si vous le souhaitez, il nous faut de votre part le fichier `apple-app-site-association` servi sur `oxvehicle.fr`, avec l'identifiant d'équipe et le bundle `fr.oxvehicle.app` ; nous ajouterons `associatedDomains` de notre côté. Sans ce fichier, nous ne pouvons rien faire seuls.

3. **Confirmez l'existence et l'état de `app.oxvehicle.fr/ar-view`.** Existe-t-elle ? Attend-elle des paramètres ? L'application n'en passe aucun et ne compte pas en passer. Rappel de cadre : aucune donnée de santé ne traversera jamais cette WebView.

4. **Tranchez le chaînon séance vers journée**, sans lequel l'écran de télévision ne pourra jamais s'ouvrir aux inscrits. Notre proposition, à discuter : une colonne `telemetry_sessions.day_session_id` référençant `public.sessions`. Modification de schéma partagé : nous ne l'appliquerons pas sans votre accord écrit.

5. **Décidez du compte de service du téléviseur.** Le canal `live:board:<id>` n'est aujourd'hui lisible que du pilote propriétaire et de son coach consenti. Un écran de paddock a besoin d'une identité propre et d'une policy dédiée. Dites-nous si vous créez ce compte, et sous quel rôle.

6. **Confirmez que vous êtes bien l'auteur des dépôts dans `coach-media`, `partner-media`, `documents`, `vehicles` et `founding-members`.** Notre conclusion est déduite de l'absence de code correspondant chez nous et de conventions de nommage que notre application ne produit pas (WebP, `profil-<horodatage>`, `logo-<horodatage>`). Si un troisième outil écrit dans ces buckets, nous devons le savoir.

7. **Statuez sur les URL signées d'un an stockées en base.** `documents.file_url` et `vehicles.photo_*_url` contiennent des liens porteurs valables jusqu'en mai-juillet 2027. Notre préférence est de stocker un chemin et de signer à l'affichage, comme le fait l'application. Si vous conservez le format actuel, dites-le : nous documenterons ce choix plutôt que de le corriger dans votre dos.

8. **Arbitrez le doublon de photos de véhicule.** Vous écrivez dans le bucket `vehicles` et les colonnes `vehicles.photo_*_url` ; nous écrivons dans `pilot-media` avec un `vehicleId` dans `users.media`. Ni l'un ni l'autre ne lit le stockage de son voisin. Il faut une source unique, ou une règle de priorité explicite.

9. **Confirmez que le bucket `avatars` et la table `public.media` peuvent être abandonnés.** Le premier est public, vide, sans code chez nous, et `users.avatar_url` est nul pour les 14 comptes ; la seconde est vide et sans appelant. Si vous ne les utilisez pas non plus, nous proposerons leur suppression dans une migration commune.

10. **Dites-nous qui alimentera `pavillon-photos`** (0 objet, 0 ligne, écriture admin, hors purge automatique) et selon quel processus. L'application ne référence ni ce bucket ni cette table, et n'a pas vocation à le faire.

11. **Engagez-vous sur deux règles de rendu du board**, si vous implémentez l'écran de télévision : l'ordre par numéro de voiture et jamais par chrono (`BOARD_MODE = 'A'`, verrouillé par test chez nous, motivé par le risque de requalification en compétition), et l'affichage de `null` en « — » sans jamais un 0 de repli. Ces règles ne sont pas négociables de notre côté ; elles n'ont d'effet que si elles tiennent aussi du vôtre.

12. **Prenez acte de l'état réel des identités publiques** avant la première journée : 2 pseudos publics et 0 numéro de voiture sur 14 comptes, 1 seul opt-in Pavillon. Sans pseudo, l'application n'émet **aucune** ligne board pour ce pilote. Si vous collectez ces champs à l'inscription web, c'est le bon endroit pour le faire.

---

## Fonction NOTIFICATIONS — e-mails et push

Deux chaînes traversent le projet Supabase partagé `fouvuqkdxarjpjbqnsjq`
(eu-west-1). Elles n'ont ni le même transport, ni le même destinataire. Les
confondre conduit à des erreurs de diagnostic : un e-mail qui ne part pas et un
push qui ne part pas n'ont jamais la même cause.

Convention appliquée à chaque affirmation. **vérifié en base** : requête SQL en
lecture seule sur la production. **vérifié dans le code de l'app** : fichier et
ligne dans le dépôt `oxv-app`. **déduit, à confirmer par le site** : nous n'avons
pas accès à votre dépôt, l'inférence vient de ce que la base montre et de ce que
l'application ne fait pas.

### 1. Vue d'ensemble

Les deux chaînes partagent le même mécanisme bas niveau : un trigger Postgres
appelle une fonction edge par `net.http_post` (extension `pg_net`). Ce qui
change, c'est la sortie de la fonction edge.

| | Chaîne E-MAIL | Chaîne PUSH |
|---|---|---|
| Sortie externe | `https://api.resend.com/emails` | `https://exp.host/--/api/v2/push/send` |
| Destinataire | adresse e-mail | jeton Expo du device |
| Tables déclencheuses | tables du site | tables de l'application |
| Journal en base | `email_log`, `resend_events` | `admin_audit`, `notif_throttle_log` |
| Secret d'appel | `edge_functions_invoke_secret` | `edge_functions_invoke_secret` |

**Correction factuelle.** Le cadrage de cette section annonce « onze déclencheurs
e-mail ». La base montre bien onze triggers appelant `net.http_post`, mais
**sept envoient un e-mail** et **quatre envoient un push**. Le secret est
commun aux onze : c'est ce qui en fait un point de rupture partagé.

Requêtes (vérifié en base) : `pg_trigger` joint à `pg_class` filtré sur
`not tgisinternal`, croisé avec `select proname, prosrc from pg_proc where
prokind='f' and prosrc ilike '%http_post%'`. Douze fonctions ressortent : onze
fonctions de trigger, plus `admin_validate_inscription`, qui est une RPC lancée
à la main par un administrateur et relaie vers `/validate-inscription`.

### 2. Chaîne E-MAIL — les onze déclencheurs

Onze triggers, douze appels HTTP : `notify_registration_inserted` en émet deux.
Tout ce tableau est **vérifié en base** (`pg_trigger` + `pg_proc.prosrc`).

| # | Trigger | Table | Événement | Fonction PL/pgSQL | Fonction edge | Sortie |
|---|---|---|---|---|---|---|
| 1 | `session_analyses_notify_trigger` | `app_session_analyses` | AFTER INSERT | `notify_session_analysis_inserted` | `notify-coach-session-analyzed` | push |
| 2 | `coach_annotations_notify_trigger` | `coach_annotations` | AFTER INSERT | `notify_coach_annotation_inserted` | `notify-pilot-coach-annotated` | push |
| 3 | `pilot_friendships_after_insert` | `pilot_friendships` | AFTER INSERT | `notify_pilot_friend_request_inserted` | `notify-pilot-friend-request` | push |
| 4 | `pilot_friendships_after_update` | `pilot_friendships` | AFTER UPDATE OF status | `notify_pilot_friend_accepted_updated` | `notify-pilot-friend-accepted` | push |
| 5 | `trg_application_ack` | `demandes_inscription` | AFTER INSERT | `notify_application_inserted` | `send-application-ack` | e-mail |
| 6 | `trg_contact_message_ack` | `contact_messages` | AFTER INSERT | `notify_contact_message_inserted` | `send-contact-ack` | e-mail |
| 7 | `trg_corporate_lead_admin` | `contact_messages` | AFTER INSERT | `notify_corporate_lead` | `notify-admin-lead` | e-mail |
| 8 | `trg_document_status_email` | `documents` | AFTER UPDATE | `notify_document_status` | `send-document-status` | e-mail |
| 9 | `trg_payment_confirmed_email` | `payments` | AFTER UPDATE | `notify_payment_confirmed` | `send-payment-confirmed` | e-mail |
| 10 | `trg_payment_invoice` | `payments` | AFTER UPDATE OF status | `notify_payment_invoice` | `generate-invoice` | e-mail + PDF |
| 11 | `trg_registration_emails` | `registrations` | AFTER INSERT | `notify_registration_inserted` | `send-booking-confirmation` **et** `notify-admin-lead` | e-mail ×2 |

### 3. Les quatre déclencheurs qui partent de tables de l'application

Lignes 1 à 4. Ils ne produisent **aucun e-mail** : ils poussent une notification
Expo. Le site n'a pas de raison d'écrire dans ces tables ; s'il le fait, il
déclenche un push chez un pilote ou un coach.

**`app_session_analyses`** — 13 lignes (vérifié en base). Colonnes qui comptent :
`telemetry_session_id`, `user_id`, `margin_global` (numeric), `margin_zone`
(text), `margin_vehicle`, `margin_pilot`, `margin_breakdown` (jsonb),
`next_focus_corner_index`, `next_focus_phrase`, `debrief_text`, `qdi` (jsonb),
`algo_version` (défaut `'v1.0'`), `computed_at`. RLS activée, 6 policies :
`select_own` (`user_id = auth.uid() OR is_admin()`), `coach_select`
(`is_coach_of(user_id)`), `select_friend` (`are_friends(auth.uid(), user_id)`),
`insert_own`, `update_own`, `delete_admin_only`. Le trigger résout le pilote par
`telemetry_sessions.user_id` puis poste `analysis_id`, `telemetry_session_id`,
`pilot_id`, `margin_global`, `margin_zone`.

**`coach_annotations`** — **0 ligne** (vérifié en base). Colonnes : `coach_id`,
`pilot_id`, `telemetry_session_id`, `corner_index`, `body`, `visibility` (défaut
`'shared'`), `lap_index`, `audio_url`, `marker_s_norm`, `ai_assisted`,
`deleted_at`. RLS activée, 3 policies : `coach_all` (`coach_id = auth.uid() AND
is_coach_of(pilot_id)`), `pilot_select` (`pilot_id = auth.uid() AND visibility =
'shared' AND deleted_at IS NULL`), `admin_select`. Le trigger sort si
`visibility <> 'shared'` ou si `deleted_at IS NOT NULL`. La table est vide
aujourd'hui, mais `admin_audit` garde 3 lignes `coach_annotation_notified`, la
dernière au 2026-06-18 12:48 : des annotations ont existé puis ont été
supprimées.

**`pilot_friendships`** — **0 ligne** (vérifié en base). Colonnes : `pilot_a`,
`pilot_b`, `initiator_id`, `status` (défaut `'pending'`), `requested_at`,
`responded_at`. RLS activée, 4 policies, toutes membres-seulement (`pilot_a =
auth.uid() OR pilot_b = auth.uid() OR is_admin()`). Deux triggers : à l'INSERT
uniquement si `status = 'pending'` ; à l'UPDATE uniquement sur la transition
`pending → accepted` (filtre explicite `IF OLD.status = 'accepted' OR NEW.status
!= 'accepted' THEN RETURN NEW`). Le destinataire est « l'autre membre de la
paire », jamais l'initiateur.

Ces trois tables étant vides ou quasi vides, **toute conclusion sur leur
comportement à volume est théorique**. Nous le signalons plutôt que de le taire.

### 4. Les sept déclencheurs qui partent de tables du site

Lignes 5 à 11. **Déduit, à confirmer par le site** : ces tables sont alimentées
par vous et non par l'application. Base de la déduction — une recherche sur tout
le dépôt de l'app (`grep -rn "from('<table>')" src app`) ne trouve **aucune**
écriture sur `contact_messages`, `demandes_inscription`, `documents`,
`payments`. Sur `registrations`, l'app lit, et fait **une seule** écriture : un
`update({ attended_at })` en `src/services/attendanceService.ts:118`. Or le
trigger e-mail y est un AFTER INSERT : l'app ne le déclenche jamais.

Volumes réels (vérifié en base, `select count(*)`) : `contact_messages` 1 ligne
pour 2 triggers, `demandes_inscription` 4 lignes, `documents` 9 lignes,
`payments` 1 ligne pour 2 triggers, `registrations` 1 ligne pour 2 e-mails.

Conditions de déclenchement (vérifié en base, `pg_proc.prosrc`). Elles comptent :
un e-mail « qui ne part pas » vient le plus souvent d'une condition non remplie,
pas d'une panne.

- `notify_corporate_lead` ne part que si `contact_messages.source` vaut
  `corporate_form`, `event_waitlist`, `partner_form` ou `press`. Toute autre
  valeur : `RETURN NEW` silencieux.
- `notify_document_status` exige un vrai changement de `status` **et** une valeur
  d'arrivée dans (`validated`, `rejected`).
- `notify_payment_confirmed` exige `new.paid_at IS NOT NULL AND old.paid_at IS
  NULL` — donc la première confirmation seulement.
- `notify_payment_invoice` exige `new.status = 'succeeded'` et `old.status <>
  'succeeded'`.

### 5. Où vit le secret partagé, et ce qui casse s'il change

Le secret vit **dans Supabase Vault** côté base, et **dans les variables
d'environnement des fonctions edge** côté Deno. Il doit être identique des deux
côtés. Contenu réel du Vault (vérifié en base, `select name, created_at,
updated_at from vault.secrets` — valeurs jamais lues ici) :

| Nom | Créé | Modifié | Rôle |
|---|---|---|---|
| `edge_functions_base_url` | 2026-05-25 20:08 | 2026-05-25 20:08 | préfixe d'URL des fonctions edge |
| `edge_functions_invoke_secret` | 2026-05-25 20:08 | 2026-05-25 20:08 | secret partagé serveur-à-serveur |
| `cron_token` | 2026-05-25 21:47 | 2026-05-25 21:50 | jeton des tâches planifiées |
| `validate_inscription_secret` | 2026-06-16 19:22 | 2026-06-16 19:22 | secret dédié à `validate-inscription` |

La lecture passe par `public.oxv_get_secret(text)` (vérifié en base), qui
interroge `vault.decrypted_secrets` et **renvoie `NULL` sur toute exception**
plutôt que de faire échouer le trigger. Côté edge, le même secret est lu par
`Deno.env.get('EDGE_FUNCTIONS_INVOKE_SECRET')`.

Deux conventions d'en-tête coexistent, ce qui est un piège. Les fonctions
**e-mail** attendent `x-oxv-invoke-secret` — vérifié dans le code :
`supabase/functions/send-application-ack/index.ts:43`,
`send-contact-ack/index.ts:58`, `notify-admin-lead/index.ts:53`,
`send-document-status/index.ts:83`, `send-payment-confirmed/index.ts:64`,
`send-booking-confirmation/index.ts:93` ; toutes répondent `401
{"error":"unauthorized"}` en cas de non-correspondance. Les fonctions **push** de
trigger attendent `Authorization: Bearer <secret>` — vérifié dans
`notify-pilot-coach-annotated/index.ts:53-60` et les blocs équivalents des trois
autres. Les triggers e-mail envoient **les deux** en-têtes simultanément
(visible dans `prosrc`), ce qui rend le système tolérant aux deux conventions.

Trois régimes de panne, **vérifiés dans le code** :

1. **Le secret disparaît du Vault (NULL ou vide).** Toutes les fonctions
   PL/pgSQL testent `IF edge_url IS NULL OR edge_url = '' OR invoke_secret IS
   NULL OR invoke_secret = '' THEN RETURN NEW`. Résultat : **aucun appel HTTP,
   aucune erreur, aucune ligne dans `admin_audit`**. Le système devient dormant
   en silence total — c'est le mode de panne le plus dangereux, rien ne le
   signale. Nuance : les quatre triggers push ne testent que `edge_url` ; si
   seul le secret manque, ils appellent avec `Bearer ` suivi du vide, et la
   fonction edge répond 401.
2. **Le secret change d'un côté seulement.** L'appel part, la fonction edge
   répond 401, et la transaction Postgres réussit quand même : `net.http_post`
   est asynchrone et chaque trigger porte `EXCEPTION WHEN OTHERS THEN RAISE
   WARNING ... RETURN NEW`. L'insertion métier n'est jamais bloquée. Seule
   trace : une ligne dans `net._http_response`, purgée en quelques heures (§8).
3. **`edge_functions_base_url` change.** Les onze triggers concatènent
   `edge_url || '/nom-de-fonction'`. Une valeur avec barre oblique finale
   produit une URL à double barre. Non testé ici ; à ne pas modifier sans essai.

**Point d'attention.** Le secret est unique et partagé par les deux produits. Le
faire tourner casse simultanément vos e-mails et nos push. Il n'existe aucune
procédure de rotation à double secret : Vault et variables edge doivent être mis
à jour dans la même fenêtre.

### 6. Ce que la base montre de la chaîne e-mail

`email_log` — 11 colonnes : `id`, `user_id`, `sent_at`, `email_type`, `subject`,
`template_used`, `status` (type énuméré), `delivered_at`, `opened_at`,
`bounce_reason`, `metadata` (jsonb). **16 lignes**, toutes au statut `sent`
(vérifié en base) :

| `email_type` | Lignes | Première | Dernière |
|---|---|---|---|
| `contact_received` | 4 | 2026-06-16 19:28 | 2026-07-04 01:01 |
| `document_status` | 4 | 2026-07-20 15:09 | 2026-07-20 15:09 |
| `application_received` | 3 | 2026-07-18 13:38 | 2026-07-21 06:07 |
| `inscription_approved` | 3 | 2026-07-18 14:58 | 2026-07-20 15:09 |
| `admin_lead` | 1 | 2026-07-18 15:55 | 2026-07-18 15:55 |
| `booking_confirmation` | 1 | 2026-07-18 15:55 | 2026-07-18 15:55 |

Douze fonctions edge y écrivent (vérifié dans le code : `grep -ln "email_log"
supabase/functions/*/index.ts`). **L'application n'écrit jamais dans
`email_log`** : la seule occurrence dans le dépôt est le type généré
`src/types/database.types.ts:4005`.

`email_templates` — **0 ligne** (vérifié en base). Les fonctions e-mail la
consultent pour surcharger sujet et corps (`send-application-ack/index.ts:69`,
`send-contact-ack/index.ts:87`) puis retombent sur un gabarit codé en dur. Table
vide signifie donc : **les seize e-mails partis à ce jour l'ont été avec le
gabarit codé en dur**. Une première ligne insérée par le site changerait le
contenu réel sans aucun déploiement.

`resend_events` — **49 lignes** (vérifié en base). Alimentée par la fonction edge
`resend_webhook`, qui vérifie une signature Svix avec `RESEND_WEBHOOK_SECRET` et
répond `401 Invalid signature` sinon (`resend_webhook/index.ts:36,92`).

`admin_audit` — 59 lignes. Traces de relais (vérifié en base) :
`session_analysis_notified` 13, `contact_ack_relayed` 7,
`application_ack_relayed` 3, `inscription_accept_relayed` 3,
`coach_annotation_notified` 3, `inscription_accept_dryrun_relayed` 2.

Adresse d'expédition : `OXV <contact@oxvehicle.fr>`, **codée en dur dans dix
fonctions** (vérifié : `const FROM` dans `send-application-ack/index.ts:13`,
`send-booking-confirmation:22`, `send-contact-ack:15`, `send-document-status:19`,
`send-payment-confirmed:20`, `notify-admin-lead:19`, `generate-invoice:18`,
`eligibility-reminders:14`, `feedback-request:12`, `validate-inscription:31`). Un
changement de domaine expéditeur casse les dix à la fois.

### 7. Chaîne PUSH — jetons Expo

**Il n'existe pas de table `push_tokens`.** C'est le point le plus
contre-intuitif de cette section. Le fichier
`supabase/migrations/20260524235514_push_tokens.sql` porte ce nom mais ne crée
aucune table : il ajoute trois colonnes à `public.users` (lignes 13-16).

```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS expo_push_token text,
  ADD COLUMN IF NOT EXISTS push_notif_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_token_updated_at timestamptz;
```

Confirmé en base : `information_schema.columns` ne renvoie rien pour un nom de
table `push_tokens`, et les trois colonnes existent bien sur `public.users`.

**Conséquence directe pour le site.** Le jeton vit sur `users`, table que les
deux produits partagent. `users` porte RLS avec 4 policies (vérifié en base). La
migration note : « Pas de policy nouvelle : users own-row policies couvrent déjà
ces colonnes. » Un `select *` du site sur `users` ramène donc le jeton push. Il
n'y a **qu'un seul jeton par utilisateur** : une deuxième installation écrase la
première, et le device précédent cesse de recevoir.

Opt-in, deux niveaux, tous deux sur `users` (vérifié en base) :
`push_notif_enabled` (boolean NOT NULL, défaut `true`) est l'interrupteur
maître ; `notification_preferences` (jsonb, défaut `'{}'`) porte la préférence
fine par canal. Côté app, `src/services/pushNotificationsService.ts:243-255`
lit les deux : si `push_notif_enabled === false`, retour immédiat `false`.
Côté edge, les fonctions relisent la colonne avant d'envoyer
(`notify-pilot-coach-assigned/index.ts:45`,
`notify-coach-consent-received/index.ts:39`).

Enregistrement du jeton : `src/services/pushNotificationsService.ts:66-127`.
Permission système, puis `Notifications.getExpoPushTokenAsync()`, puis
comparaison au jeton en base et écriture **seulement s'il a changé**
(`expo_push_token` et `push_token_updated_at`). Déclenché après authentification
depuis `app/_layout.tsx:77-82`, et **sauté sous Expo Go** (`if (isExpoGo())
return;`).

Anti-spam : `public.should_send_notif(recipient, source, notif, window_seconds)`
(vérifié en base) lit la dernière ligne de `notif_throttle_log` pour le trio
(destinataire, source, type) ; si la fenêtre est dépassée ou s'il n'y a rien,
elle insère et renvoie `TRUE`. `notif_throttle_log` : `id` (bigint),
`recipient_user_id`, `source_user_id`, `notif_type`, `sent_at` — **0 ligne**, RLS
activée, 3 policies réservées au rôle `service_role`, donc inaccessible à un
client authentifié. `cleanup_old_notif_logs()` purge au-delà de 7 jours. Fenêtre
appliquée aux annotations coach : 900 secondes, soit 15 minutes
(`notify-pilot-coach-annotated/index.ts:94-103`).

### 8. Les huit destinations côté app, qui visent l'arbre V2

Le routeur de tap est unique : `app/_layout.tsx:86-148`. Il lit
`notification.request.content.data.type` et pousse une route. **Vérifié dans le
code de l'app.** Neuf branches `data.type`, **huit destinations distinctes** —
`debrief` et `media_ready` mènent au même écran de bilan.

| # | `data.type` | Route poussée | Lignes | Destinataire |
|---|---|---|---|---|
| 1 | `debrief` | `/(app2)/bilan/[sessionId]` | 103-107 | pilote |
| 2 | `session_reminder` | `/(app2)` | 108-109 | pilote |
| — | `media_ready` | `/(app2)/bilan/[sessionId]` (même cible que 1) | 110-115 | pilote |
| 3 | `coach_annotation` | `/(app2)/data/session/<id>`, repli `/(app2)/data` | 116-123 | pilote |
| 4 | `session_analyzed` | `/(coach)/pilote/[id]` | 124-131 | coach |
| 5 | `coach_assigned` | `/(app2)/club/coaching` | 132-135 | pilote |
| 6 | `pilot_consented` | `/(coach)` | 136-138 | coach |
| 7 | `friend_request` | `/(app2)/club/roulages?tab=amis` | 139-142 | pilote |
| 8 | `friend_accepted` | `/(app2)/data/comparer?friend=<id>` | 143-147 | pilote |

**Ces huit destinations visent désormais l'arbre V2.** Le commentaire du lot L6
est explicite (`app/_layout.tsx:99-102`) : les notifications sont la seule porte
d'entrée de l'app depuis l'extérieur, elles visent l'arbre V2 depuis la bascule ;
les anciens écrans v1 `debrief` et `session-media` sont réunis dans
`/(app2)/bilan/[sessionId]`, qui les sert en sections.

Deux écarts connus, à ne pas découvrir en production. D'abord,
`coach_annotation` perd l'ancre virage : l'écran V2 n'accepte que l'identifiant
de séance, pas l'index de virage — limite assumée en commentaire aux lignes
117-120 ; le pilote arrive sur la séance et descend. Ensuite, le document de
cadrage `docs/refonte-app/14_NOTIFICATIONS.md:71-81` décrit encore les anciennes
routes v1 (`/(app)/debrief`, `/(app)/virage`, `/(app)/amis`,
`/(app)/mon-coach`) : **ce tableau est périmé**, la vérité est
`app/_layout.tsx`. Nous le signalons parce que ce document circule.

Le schéma d'URL natif est `oxv://`, construit dans
`notify-pilot-coach-annotated/index.ts:119-121`.

Règle absolue, vraie dans le code : **un `data.type` absent de
`app/_layout.tsx` produit un tap qui ne mène nulle part.** Toute nouvelle
notification, quel qu'en soit l'émetteur, doit réutiliser un des huit types
ci-dessus ou attendre l'ajout d'une branche côté app — donc une livraison sur
les magasins.

**État réel : la chaîne push n'a jamais rien livré.** Vérifié en base :
`select count(*) from users` → 14 ; `... where expo_push_token is not null` → 0 ;
`... where push_notif_enabled = false` → 0 ; `select count(*) from
notif_throttle_log` → 0. Répartition des 14 comptes : 11 `pilot`, 2 `admin`,
0 `coach`. Aucun utilisateur ne porte de jeton Expo : toutes les fonctions push
sortent donc sur la garde « pas de jeton » et renvoient `{"skipped":"no_token"}`
(`notify-pilot-coach-annotated/index.ts:85-88` et équivalents). Les 13 lignes
`session_analysis_notified` dans `admin_audit` prouvent que le trigger a bien
tourné 13 fois, une par ligne d'`app_session_analyses` : la chaîne fonctionne
**jusqu'à** la fonction edge et s'arrête faute de jeton. C'est attendu — le
jeton n'est produit que par un build natif installé sur un appareil réel, jamais
sous Expo Go. **Aucune conclusion sur la fiabilité de la chaîne push ne peut
être tirée de la production actuelle : elle n'a pas été éprouvée.**

### 9. `compute-insights-hourly` échoue en 401 depuis le 13 juin

Ce point illustre un angle mort du tableau de bord Supabase qui vaut pour toutes
les tâches planifiées du projet, les vôtres comme les nôtres.

Huit tâches actives dans `cron.job` (vérifié en base) : jobid 4
`analyze-pending-sessions` (`0 * * * *`) ; **jobid 5 `compute-insights-hourly`
(`30 * * * *`, vers `compute-session-insights`)** ; jobid 6
`cleanup-telemetry-frames` (`30 3 * * *`, SQL local) ; jobid 7
`oxv-eligibility-reminders` (`0 6 * * *`) ; jobid 8 `oxv-feedback-requests`
(`0 7 * * *`) ; jobid 9 `purge-deleted-accounts-daily` (`30 2 * * *`) ; jobid 10
`ritual_dispatcher_hourly` (`0 16-19 * * *`) ; jobid 11
`biometry-retention-daily` (`15 3 * * *`, SQL local).

Le job 5 envoie un unique en-tête d'authentification, `X-Cron-Token` :

```sql
SELECT net.http_post(
  url := 'https://fouvuqkdxarjpjbqnsjq.supabase.co/functions/v1/compute-session-insights',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'X-Cron-Token', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_token')
  ),
  body := '{"all_pending": true}'::jsonb,
  timeout_milliseconds := 30000
);
```

Or `compute-session-insights` est déployée avec **`verify_jwt: true`** (vérifié
en base dans l'inventaire des fonctions edge, et confirmé par l'absence d'entrée
pour cette fonction dans `supabase/config.toml`, fichier de 33 lignes qui n'en
déclare que sept). Le portail Supabase exige donc un en-tête `Authorization`
**avant** d'atteindre le code de la fonction. Le job n'en envoie pas.

Réponses réelles (vérifié en base, `select id, status_code, content, created from
net._http_response order by id desc`) :

```
2853 | 401 | {"code":"UNAUTHORIZED_NO_AUTH_HEADER","message":"Missing authorization header"} | 2026-07-26 02:30:00
2851 | 401 | idem | 2026-07-26 01:30:00      2849 | 401 | idem | 2026-07-26 00:30:00
2847 | 401 | idem | 2026-07-25 23:30:00      2845 | 401 | idem | 2026-07-25 22:30:00
2843 | 401 | idem | 2026-07-25 21:30:00
2852 | 200 | {"ok":true,"processed":0,"successful":0,"failed":0,"results":[]} | 2026-07-26 02:00:00
```

La régularité est parfaite : **toutes les exécutions à la minute 30 sont en
401**, toutes celles à la minute 0 sont en 200 — le job 4 vise
`cron-analyze-pending-sessions`, déclarée `verify_jwt = false` dans
`supabase/config.toml:3-4`.

Pourquoi le tableau de bord ne le montre pas : deux mécanismes se combinent.
D'abord, **`pg_net` est asynchrone** — `cron.job_run_details` enregistre le
succès de l'ordre SQL, pas celui de la requête HTTP ; l'ordre `SELECT
net.http_post(...)` réussit dès que la requête est mise en file. Résultat
(vérifié en base) : pour le jobid 5, **1015 exécutions, 1015 « succeeded », 0
« failed »**, depuis la toute première le **13 juin 2026 à 20 h 30**. La tâche
est en échec depuis sa première exécution et le journal affiche un succès
intégral. Ensuite, **`net._http_response` est purgée** : la table ne contient que
13 lignes au moment de la rédaction, la plus ancienne datant du 2026-07-25
21:00, soit environ six heures d'historique. Les 1015 échecs ne laissent qu'une
fenêtre glissante de six heures. Qui ne regarde pas cette table le jour même ne
voit rien.

Ce que cela coûte : le corps envoyé est `{"all_pending": true}`, un traitement de
rattrapage sur toutes les sessions en attente d'insights. Il n'a **jamais**
tourné depuis le serveur. `app_session_analyses` compte 13 lignes pour 18
`telemetry_sessions` (vérifié en base) ; nous ne pouvons pas affirmer que l'écart
vient de là, mais il est cohérent. Ce qui a fonctionné, c'est l'appel **depuis
l'application** : `src/services/analyzeSessionService.ts:167` invoque
`compute-session-insights` via `supabase.functions.invoke`, qui joint
automatiquement le JWT du pilote connecté et satisfait `verify_jwt: true`. La
fonction n'est pas cassée ; seul son appel serveur l'est.

Trois correctifs possibles, aucun appliqué ici, cette section étant en lecture
seule. Premièrement, déclarer `[functions.compute-session-insights] verify_jwt =
false` dans `supabase/config.toml` et redéployer — la fonction devrait alors
vérifier elle-même le `X-Cron-Token`, comme le fait
`cron-analyze-pending-sessions`. Deuxièmement, ajouter un en-tête
`Authorization: Bearer <secret>` au job 5, sur le modèle du job 9, qui envoie
bien `'Authorization', 'Bearer ' || (select decrypted_secret ... where name =
'edge_functions_invoke_secret')`. Troisièmement, supprimer le job si
`compute-session-insights-v3` l'a remplacé — cette dernière n'est ciblée par
aucune tâche planifiée ni par aucun appel de l'application (vérifié : aucune
occurrence dans `src/`).

**Point de méthode pour le site.** Le même angle mort vaut pour vos tâches.
`cron.job_run_details` ne prouve rien sur le résultat HTTP. La seule source de
vérité est `net._http_response`, dont la rétention est de quelques heures. Un
contrôle sérieux suppose d'y prélever régulièrement, ou d'écrire le résultat
dans une table permanente.

### 10. Les 34 fonctions edge

Inventaire complet **vérifié en base**. Trente-quatre fonctions, toutes au statut
`ACTIVE`. Neuf sont appelées par l'application, recensées exhaustivement par
`grep -rn "invoke('...')"` sur `src/` et `app/` (**vérifié dans le code**) :

| Fonction edge | Appelée depuis | `verify_jwt` | Objet |
|---|---|---|---|
| `compute-session-insights` | `src/services/analyzeSessionService.ts:167`, `src/services/adminSessionDiagnosticService.ts:109` | true | calcul des insights d'une séance |
| `generate-debrief-ai` | `src/services/analyzeSessionService.ts:258`, `src/services/adminSessionDiagnosticService.ts:124` | true | rédaction du débrief |
| `cron-analyze-pending-sessions` | `src/services/adminSessionDiagnosticService.ts:142` | false | relance manuelle depuis l'écran admin |
| `coach-ai-draft` | `src/services/coachAiService.ts:59` | true | brouillon d'annotation coach |
| `coach-ai-validate` | `src/services/coachAiService.ts:121` | true | contrôle doctrinal d'une annotation |
| `notify-pilot-coach-assigned` | `src/services/coachAdminService.ts:188` | true | push « un coach vous suit » |
| `send-coach-invitation` | `src/services/coachAdminService.ts:226` | true | e-mail d'invitation coach |
| `notify-coach-consent-received` | `src/services/pilotConsentService.ts:142` | true | push « un pilote a consenti » |
| `pair-app` | `src/services/pairingService.ts:33` | false | appairage app / compte site |

`notify-pilot-coach-assigned` et `notify-coach-consent-received` sont les
**seules** notifications push que l'application déclenche elle-même, en
« fire-and-forget » depuis le client, sans trigger. Le commentaire de
`supabase/config.toml:22-32` l'explique : elles portent le JWT de l'utilisateur
connecté, donc `verify_jwt = true` protège au portail. Les quatre fonctions push
déclenchées par trigger sont en `verify_jwt = false`
(`supabase/config.toml:6-24`), parce que le trigger porte un secret personnalisé
et non un JWT Supabase — le portail rejetterait ce dernier. Leur défense est
alors **dans le handler**.

Les vingt-cinq autres. **Déduit, à confirmer par le site** pour la colonne « pour
qui » ; la base de la déduction est le déclencheur réel observé en base et
l'absence d'appel côté application.

- **Chaîne e-mail du site, par trigger (7)** : `send-application-ack`,
  `send-contact-ack`, `notify-admin-lead`, `send-document-status`,
  `send-payment-confirmed`, `send-booking-confirmation`, `generate-invoice`.
- **Chaîne push de l'application, par trigger (4)** :
  `notify-coach-session-analyzed`, `notify-pilot-coach-annotated`,
  `notify-pilot-friend-request`, `notify-pilot-friend-accepted`.
- **Planificateur (4)** : `eligibility-reminders` (job 7), `feedback-request`
  (job 8), `purge-deleted-accounts` (job 9), `ritual_dispatcher` (job 10 —
  rituels J−7 / J−2 / J−1 avant séance, lus depuis `ritual_dispatches`, **0 ligne
  en production**).
- **Administration des inscriptions (3)** : `validate-inscription` (relayée par
  la RPC `admin_validate_inscription`, avec son propre secret Vault),
  `admin-review-inscription`, `ritual_dryrun`.
- **Webhooks entrants (2)** : `resend_webhook` (49 lignes reçues dans
  `resend_events`), `yousign-webhook`.
- **Services et outillage (5)** : `geocode`, `detect-circuit-corners`,
  `compute-session-insights-v3`, `newsletter-push`, `capture-membre-fondateur`.

**Indice fort sur la propriété du code.** Trente-deux des trente-quatre fonctions
ont leur source dans le dépôt de l'application (`supabase/functions/`). Deux n'y
sont pas : **`capture-membre-fondateur`** et **`yousign-webhook`**, toutes deux
créées le 2026-07-19. **Déduit, à confirmer par le site** : elles sont déployées
depuis votre dépôt. Si c'est exact, ce sont les seules fonctions edge dont nous
ne pouvons ni lire ni maintenir le code, donc les seules dont nous ne pouvons pas
garantir le comportement en cas d'évolution du schéma. Par ailleurs, deux
fonctions ne sont ciblées par rien de ce que nous voyons —
`compute-session-insights-v3` et `newsletter-push` : ni tâche planifiée, ni
trigger, ni appel de l'application. **Déduit** : soit le site les appelle
directement, soit elles sont mortes.

### 11. Résumé des points de rupture

| Objet | Ce qui casse | Visible ? |
|---|---|---|
| `edge_functions_invoke_secret` (Vault) | les 11 triggers, e-mails **et** push | non — 401 purgé en 6 h |
| `edge_functions_base_url` (Vault) | les 11 triggers | non |
| `users.expo_push_token` | toute la chaîne push | non — retour `skipped:no_token` |
| `users.push_notif_enabled` | opt-in ; `false` coupe tout push | non |
| `users` (RLS, colonnes) | l'app y lit le jeton et l'opt-in | à la lecture |
| `app_session_analyses` (INSERT) | déclenche un push coach | ligne dans `admin_audit` |
| `coach_annotations` (INSERT `shared`) | déclenche un push pilote | ligne dans `admin_audit` |
| `pilot_friendships` (INSERT / status) | déclenche un push pilote | ligne dans `admin_audit` |
| `email_templates` (première ligne) | change le contenu réel des e-mails | non |
| Domaine expéditeur Resend | les 10 fonctions avec `FROM` codé en dur | à l'envoi |
| `verify_jwt` d'une fonction edge | l'appelant sans le bon en-tête part en 401 | non |

### Ce que nous demandons au site

1. **Confirmez que le site est l'unique auteur des insertions dans
   `contact_messages`, `demandes_inscription`, `documents`, `payments` et
   `registrations`.** Nous l'avons déduit de l'absence totale d'écriture côté
   application ; nous ne l'avons pas vérifié chez vous. Si un autre système écrit
   dans ces tables, il déclenche des e-mails à votre nom.

2. **Confirmez que `capture-membre-fondateur` et `yousign-webhook` sont déployées
   depuis votre dépôt.** Ce sont les deux seules fonctions edge des trente-quatre
   dont le code n'existe pas chez nous. Si elles ne sont pas à vous, personne ne
   les maintient.

3. **Dites-nous si `compute-session-insights-v3` et `newsletter-push` sont
   appelées par le site.** Aucune tâche planifiée, aucun trigger et aucun appel
   de l'application ne les vise. Si vous ne les appelez pas non plus, elles sont
   mortes et nous proposons de les retirer.

4. **Décidez du sort de la tâche `compute-insights-hourly` (jobid 5).** Elle
   échoue en 401 à chaque exécution depuis le 13 juin 2026, 1015 fois. Trois
   correctifs sont décrits au §9. Nous ne toucherons pas au planificateur sans
   votre accord, car il porte aussi vos tâches.

5. **Fournissez une procédure de rotation pour `edge_functions_invoke_secret`.**
   Le secret est unique et partagé. Sa rotation casse simultanément vos e-mails
   et nos push, sans qu'aucun tableau de bord ne le signale. Nous proposons soit
   une fenêtre de rotation coordonnée, soit un second secret accepté en parallèle
   le temps du basculement — cette seconde option demande une modification des
   onze fonctions.

6. **Confirmez l'adresse expéditrice `contact@oxvehicle.fr`.** Elle est codée en
   dur dans dix fonctions edge. Tout changement de domaine ou de réputation côté
   Resend exige dix redéploiements coordonnés.

7. **Dites-nous si vous comptez alimenter `email_templates`.** La table est vide :
   les seize e-mails partis l'ont été avec le gabarit codé en dur. La première
   ligne que vous insérerez changera le contenu réel des e-mails, sans
   déploiement et sans que nous en soyons avertis. Nous demandons à être
   prévenus, pas à décider.

8. **N'écrivez jamais dans `app_session_analyses`, `coach_annotations` ni
   `pilot_friendships`.** Chaque insertion y déclenche une notification push chez
   un pilote ou un coach. Si vous avez un besoin de lecture sur ces tables,
   dites-le : nous préférons vous ouvrir une vue plutôt que découvrir un accès
   direct.

9. **Traitez `users.expo_push_token` comme une donnée d'appareil.** Un seul jeton
   par compte, écrasé à chaque nouvelle installation. Ne le copiez pas, ne le
   journalisez pas, ne l'exportez pas — il permet d'écrire sur l'écran verrouillé
   d'un pilote.

10. **Confirmez que vous n'avez aucun besoin de notification push aujourd'hui.**
    Si le site doit un jour pousser vers l'app, la contrainte est stricte : le
    `data.type` envoyé doit appartenir aux huit destinations listées au §8, sinon
    le tap n'ouvre rien. Un nouveau type suppose une modification de
    `app/_layout.tsx` et une livraison sur les magasins d'applications, donc
    plusieurs semaines de délai. Prévenez-nous en amont, pas au moment de
    l'envoi.

---

## Fonction TEMPS RÉEL — direct coach et tableau de marche

Cette section décrit la seule partie de l'application qui ne passe ni par une
table, ni par une fonction edge : le direct. Trois topics Supabase Realtime, une
autorisation entièrement portée par la RLS de `realtime.messages`, et zéro
persistance. C'est aussi la zone où le contrat implicite entre nos deux produits
est le plus fragile, parce qu'il ne s'écrit nulle part ailleurs que dans six
policies et dans la discipline des deux clients.

Convention de lecture, appliquée à chaque affirmation : **[code app]** = vérifié
dans le dépôt de l'application, chemin et ligne donnés ; **[base]** = vérifié par
requête SQL en production (projet `fouvuqkdxarjpjbqnsjq`), résultat donné ;
**[déduit]** = raisonnement à partir de ce que la base montre et de ce que
l'application ne fait pas — à confirmer par vous.

### Les trois topics, et qui les tient

| Topic | Mécanisme | Émetteur | Audience autorisée | Cadence |
| --- | --- | --- | --- | --- |
| `live:roster:<coachId>` | presence | le pilote (une inscription par coach consenti) | ce coach, et lui seul | à l'événement |
| `live:session:<sessionId>` | broadcast, event `frame` | le pilote propriétaire de la séance | les coachs du binôme actif et consenti au live | ~3–4 Hz |
| `live:bio:<coachId>:<sessionId>` | broadcast, event `biometry` | le pilote propriétaire de la séance | **ce coach seul**, s'il est au niveau détaillé | 0,5 Hz |
| `live:board:<sessionId>` | broadcast, event `board` | le pilote propriétaire de la séance | aujourd'hui : le pilote et les coachs consentis. Rien de plus. | 1 Hz max |

Les trois noms sont construits à un seul endroit, `src/services/liveSessionService.ts:35-37` **[code app]** :

```ts
const rosterTopic  = (coachId: string)   => `live:roster:${coachId}`;
const sessionChannel = (sessionId: string) => `live:session:${sessionId}`;
const boardTopic   = (sessionId: string) => `live:board:${sessionId}`;
```

Le `<sessionId>` est un `public.telemetry_sessions.id` (uuid) — **pas** une
journée de roulage `public.sessions`. Cette distinction porte toute la section
sur le tableau de marche, plus bas.

Les trois canaux sont ouverts avec `{ config: { private: true } }`
(`liveSessionService.ts:68-70`, `:181-183`, `:327-329`) **[code app]**. C'est ce
drapeau qui déclenche la vérification d'autorisation côté serveur. Un client qui
l'oublierait ouvrirait un canal public non contrôlé : c'est le premier point à
répliquer si vous écrivez un client web.

### Le transport ne laisse aucune trace en base

`realtime.messages` contient **0 ligne** ; `realtime.subscription` en contient
**0** également **[base]** :

```sql
select (select count(*) from realtime.messages) as messages_total,
       (select count(*) from realtime.subscription) as subscriptions;
-- messages_total = 0 · subscriptions = 0
```

La table est partitionnée par jour ; les partitions présentes vont de
`messages_2026_07_15` à `messages_2026_07_21` **[base]**. Aucune n'est alimentée.

Conséquences, à tenir pour acquises de votre côté :

1. **Aucun rejeu.** Un écran qui se connecte au milieu d'une séance ne reçoit
   rien tant que le pilote n'a pas émis la ligne suivante. Au maximum une seconde
   d'attente pour le board (throttle 1 Hz), et rien du tout si le pilote est au
   stand. Prévoyez un état « en attente », pas un écran vide définitif.
2. **Aucun historique.** Le direct ne se rejoue pas après coup, ne s'archive pas,
   ne s'audite pas. Ce qui reste après une séance vit dans `public.laps` (1 ligne
   en production) et `public.telemetry_frames` (53 lignes) **[base]**, écrits à la
   clôture de la capture — pas pendant.
3. **Le direct n'est pas une source de vérité.** Une ligne board perdue est
   perdue. Aucun écran ne doit en dériver un compte, un total, ni un cumul.

### L'autorisation : six policies, et rien d'autre

Les six policies suivantes existent bien en production sur `realtime.messages`
**[base]** — requête `select policyname, cmd, roles from pg_policies where
schemaname='realtime'` :

| Policy | Commande | Rôle | Ce qu'elle dit |
| --- | --- | --- | --- |
| `live_roster_read` | SELECT | `authenticated` | le 3ᵉ segment du topic doit être `auth.uid()` : un coach ne lit que SON roster |
| `live_roster_join` | INSERT | `authenticated` | l'appelant doit être un pilote lié à ce coach, `active`, `live_sharing_at` non nul |
| `live_session_recv` | SELECT | `authenticated` | l'appelant doit être coach du propriétaire de la séance, `active`, `live_sharing_at` non nul |
| `live_session_send` | INSERT | `authenticated` | l'appelant doit être le propriétaire de la séance |
| `board_recv` | SELECT | `authenticated` | le propriétaire de la séance, OU un coach consenti au live (même porte que `live_session_recv`) |
| `board_send` | INSERT | `authenticated` | le propriétaire de la séance, et lui seul |

Sources : `supabase/migrations/20260711181903_live_realtime_authorization.sql`
(roster + session) et `supabase/migrations/20260725185806_live_board_realtime_authorization.sql`
(board). Les deux versions figurent dans `supabase_migrations.schema_migrations`
**[base]** : elles sont appliquées, pas seulement écrites.

Quatre points qui ne sautent pas aux yeux et qui vous concernent directement.

**Le rôle `anon` est exclu.** Les six policies ciblent `authenticated`. Le rôle
`anon` dispose pourtant des privilèges SELECT/INSERT/UPDATE sur
`realtime.messages` **[base]** — mais sans policy, la RLS refuse. Un navigateur
non connecté ne reçoit donc **rien**, sur aucun des trois topics. Un téléviseur de
paddock ouvert sur une URL publique n'affichera jamais une ligne. C'est le point
bloquant n°1 du Livrable 2.

**La RLS des tables publiques s'applique en cascade.** Les policies interrogent
`public.telemetry_sessions` et `public.coach_pilots` dans des sous-requêtes. Ces
sous-requêtes s'exécutent avec les droits de l'appelant : la RLS de ces deux
tables filtre donc aussi **[déduit du comportement documenté de PostgreSQL, à
garder en tête]**. En pratique, cela tient :

- `public.telemetry_sessions` a une policy SELECT propriétaire
  (`auth.uid() = user_id`) et une policy coach (`is_coach_of(user_id)`,
  `SECURITY DEFINER`) **[base]** ;
- `public.coach_pilots` a deux policies SELECT : `coach_id = auth.uid()` et
  `pilot_id = auth.uid()` **[base]**.

Chaque chemin d'autorisation a donc bien la visibilité qu'il lui faut. Mais si
quelqu'un resserre la RLS de l'une de ces deux tables, **le direct tombe en
silence**, sans erreur explicite : l'abonnement échoue, l'écran passe
« hors ligne », et rien ne dira pourquoi. C'est le couplage le plus discret entre
vos migrations et notre fonction.

**Le consentement conditionne l'AUDIENCE, pas seulement l'émission.** Les policies
de réception (`live_session_recv`, `live_roster_read`, `board_recv`) exigent
`cp.live_sharing_at IS NOT NULL`. Retirer ce consentement ferme la porte côté
serveur, y compris à un client déjà abonné qui tenterait de se réabonner.

**Le direct est structurellement muet en production aujourd'hui.** `public.coach_pilots`
contient **1 ligne** : `active = true`, `status = 'pending'`, `level = 'programme'`,
`pilot_consent_at` renseigné, `live_sharing_at` **NULL** **[base]**. Aucun compte
n'a `role = 'coach'` : la répartition est 11 `pilot`, 2 `admin`, 1 `partner`
**[base]**. Et `public.telemetry_sessions` contient 18 lignes, dont **0** au
statut `recording` (10 `completed`, 8 `aborted`) **[base]**. Autrement dit : les
policies sont en place, le code est en place, et aucun octet ne circule. Toute
recette du direct commencera par créer un binôme réel.

### Les deux tables qui arbitrent tout

**`public.telemetry_sessions`** — 18 lignes, 4 pilotes distincts, première le
2026-05-16, dernière le 2026-07-15 **[base]**. Colonnes qui comptent pour le
direct :

- `id` (uuid) — le `<sessionId>` des topics `live:session:` et `live:board:` ;
- `user_id` (uuid, NOT NULL) — le propriétaire, seul émetteur autorisé ;
- `status` (text, défaut `'recording'`) — passe à `completed` / `aborted` ;
- `circuit_id` (uuid, nullable) — renseigné sur 14 des 18 lignes **[base]** ;
- `event_id` (uuid, nullable) — renseigné sur **0** des 18 lignes **[base]**.

RLS : SELECT propriétaire, SELECT coach (`is_coach_of`), SELECT ami
(`are_friends`), INSERT/UPDATE/DELETE propriétaire, plus une policy admin
(`is_admin()`) **[base]**.

**`public.coach_pilots`** — 1 ligne **[base]**. Colonnes qui comptent :
`coach_id`, `pilot_id`, `active` (bool), `status` (enum `affiliation_status`),
`pilot_consent_at` (timestamptz), `level` (enum `coach_access_level` :
`lecture_simple` | `lecture_detaillee` | `programme`), `live_sharing_at`
(timestamptz, NULL = pas de direct).

L'application lit ces quatre conditions ensemble avant d'émettre quoi que ce soit
— `src/services/liveRelayRunner.ts:77-94` **[code app]** :

```ts
.eq('active', true)
.eq('status', 'active')
.not('pilot_consent_at', 'is', null)
.not('live_sharing_at', 'is', null)
```

À noter, parce que l'écart est réel : les policies serveur n'exigent que `active`
et `live_sharing_at`. Le client est **plus strict** que la base (il exige en plus
`status = 'active'` et `pilot_consent_at`). L'écart joue en faveur du pilote,
mais il n'est pas garanti par le schéma. Si un jour un autre client émet, il
pourra le faire dans un état que le nôtre refuse.

Le pilote bascule ce consentement depuis l'application seule :
`src/services/pilotConsentService.ts:188` écrit `live_sharing_at` **[code app]**,
sous la policy UPDATE `pilot_id = auth.uid()` **[base]**. Si le site expose un
jour ce réglage, il doit écrire par la même colonne — il n'y en a pas d'autre.

### Le refcomptage côté client, et pourquoi il n'est pas optionnel

`supabase-js` **dédoublonne les canaux par topic** : `client.channel(topic)`
renvoie l'instance déjà ouverte. Depuis que deux consommateurs lisent
`live:session:<id>` (la fiche direct et la pastille cardio du roster), un
`removeChannel` naïf arrache le canal à l'autre.

L'application maintient donc trois registres refcomptés
(`src/services/liveSessionService.ts`) **[code app]** :

- `rosters` (`:63`) — état `{ channel, refs, track, syncCbs }`, libéré par
  `releaseRoster` (`:84-92`) au départ du dernier ;
- `sessions` (`:175`) — `ensureSession` (`:177-207`) / `releaseSession` (`:209-217`) ;
- `boards` (`:321`) — `ensureBoard` (`:323-352`) / `releaseBoard` (`:354-362`).

Trois propriétés en découlent, toutes verrouillées par
`src/services/__tests__/liveSessionServiceRefcount.test.ts` (dont le faux client
reproduit volontairement la déduplication par topic) **[code app]** :

1. **Le statut est rejoué aux retardataires.** Un abonné qui arrive après le
   `SUBSCRIBED` reçoit immédiatement l'état courant (`:243-246`, `:414-417`).
   Sans cela, il s'affiche « hors ligne » sur un flux vivant.
2. **Les désabonnements sont idempotents.** Un `unsub()` appelé deux fois ne
   décrémente qu'une fois (`:251-259`, `:288-292`, `:421-428`).
3. **Board et session sont indépendants.** Fermer le tableau de marche ne coupe
   pas le direct coach, et réciproquement (test « le canal board est INDÉPENDANT
   du canal coach de la même séance »).

Si vous écrivez un client web sur ces mêmes topics, vous héritez exactement du
même piège **[déduit]** : c'est une propriété de la bibliothèque, pas de notre
code.

### Pourquoi le tableau de marche a une audience fail-closed

Le cahier LIVE-B demandait que **tout inscrit de la journée** puisse lire le
board. Cette ouverture **n'est pas écrite**, et le refus est documenté en tête de
la migration (`20260725185806_live_board_realtime_authorization.sql:28-50`)
**[code app]**. La raison est un trou de schéma, pas une réserve de prudence.

**Le chaînon séance → journée n'existe pas.** Une séance de télémétrie ne porte
aucune référence vers la journée de roulage à laquelle on s'inscrit. Vérifié :
aucune colonne `day_session_id` nulle part dans `public` ; `telemetry_sessions`
n'a ni `session_id` ni `registration_id` — la liste complète de ses 28 colonnes ne
contient que `circuit_id` et `event_id` comme rattachements **[base]**.

**Le rattachement hérité est vide.** `telemetry_sessions.event_id` est nul sur les
18 lignes ; `public.event_registrations` contient **0 ligne** **[base]**. La piste
« passer par `events` » est donc morte en pratique.

**Rapprocher par circuit et date serait une devinette.** 4 lignes sur 18 ont un
`circuit_id` nul **[base]** ; une règle d'accès écrite sur `circuit_id` s'ouvrirait
alors en grand. On n'écrit pas une règle d'autorisation sur une jointure devinée.

**La brique côté journée, elle, existe déjà.** `public.is_registered_for_session(uuid)`
est en production, `STABLE SECURITY DEFINER`, `search_path` figé **[base]** :

```sql
select exists (select 1 from public.registrations r
  where r.session_id = p_session and r.user_id = auth.uid()
    and r.status <> 'cancelled');
```

Elle sert déjà ailleurs (convois, « Qui roule »). Il ne manque que le chaînon.
État actuel de la matière : `public.sessions` = 1 ligne (2026-12-24, Haute
Saintonge, `scheduled`), `public.registrations` = 1 ligne **[base]**.

**Conséquence à retenir, et à dire clairement : le canal board n'expose
aujourd'hui rien de plus que le canal coach.** Son audience est exactement la même
— propriétaire plus coachs consentis. Tant que la décision de schéma n'est pas
prise, un écran de paddock branché sur ce canal avec un compte quelconque
n'affichera rien.

### Le contenu du board : une liste blanche, jamais une liste noire

Le SQL ne peut pas inspecter le corps d'un message Realtime. La barrière de
contenu est donc **applicative**, et elle se situe à l'émission :
`src/services/v2/liveHealthGate.ts:54-63` **[code app]**.

```ts
const LIVE_WHITELIST = ['position','lapMs','sector','ts',
                        'pilotHandle','carNo','lastLapMs','bestLapMs'] as const;
```

Huit clés, énumérées en positif. Brancher demain un capteur quelconque ne crée
aucune fuite tant que sa clé n'est pas inscrite ici. `stripHealth` renvoie un
objet neuf ne contenant que les clés blanches réellement présentes ; une entrée
non-objet donne `{}` (`:76-88`) **[code app]**.

La barrière est doublée à trois niveaux **[code app]** :

- **au type** — `openBoardBroadcast.send` n'accepte que `SafeLivePayload`, la
  sortie de `stripHealth` (`liveSessionService.ts:374-392`) ; on ne *peut pas*
  compiler une émission brute ;
- **à l'émission** — `stripHealth` est appliqué par l'appelant
  (`liveRelayRunner.ts:266`) **puis réappliqué** par le service (`:384`), parce
  qu'une barrière qui dépend de la discipline de l'appelant n'en est pas une ;
- **à la réception** — `parseBoardEvent` (`src/services/boardLogic.ts:168-189`)
  reconstruit la ligne champ par champ au lieu de la caster. Toute clé hors des
  six attendues n'est pas recopiée. Une ligne sans pseudo ou sans horodatage réel
  est rejetée en silence : un écran vide est honnête, une ligne inventée ne l'est
  pas.

Trois règles de contenu s'y ajoutent, toutes vérifiables dans le code :

- **Aucun ordre ne voyage sur le canal.** Le tri est décidé au rendu par
  `sortBoard`, sur le numéro de voiture (`boardLogic.ts:140-147`). La constante
  `BOARD_MODE = 'A'` (`:57`) verrouille la variante « tableau de marche » ; un
  test échoue si quelqu'un la bascule en `'B'` (classement).
- **Jamais un zéro de repli.** Sans tour bouclé, `lastLapMs` et `bestLapMs`
  valent `null` et s'affichent « — » (`:93-94`). Un 0 se lirait comme un tour
  imbattable.
- **Jamais l'état civil.** Sans `public_handle`, le canal board n'est même pas
  ouvert (`liveRelayRunner.ts:232`) : le prénom ne remplace pas le pseudo sur un
  écran que tout le paddock regarde.

Deux chiffres qui comptent pour votre côté **[base]** : sur 14 utilisateurs, **2**
ont un `public_handle`, et **0** ont un `car_number` (la colonne existe bien —
migration `profil_pavillon` appliquée — mais elle est vide partout). Aujourd'hui,
un tableau de marche réel afficherait au mieux deux lignes, toutes deux sans
numéro, donc toutes deux triées par le seul départage alphabétique. La clé
d'affichage du board est vide en production.

### La biométrie : article 9, UN CANAL PAR COACH

> **Mis à jour le 01/08/2026** (jalon 6, lot 27a-bis). La section décrivait
> jusque-là un canal partagé et une position « tout ou rien » : les deux ont
> changé. Le code cité alors n'existe plus.

La fréquence cardiaque et la variabilité R-R relèvent de l'article 9 du RGPD.
Elles circulent **uniquement** sur l'event `biometry` d'un canal privé **propre à
chaque coach** — `live:bio:<coachId>:<sessionId>` (`liveSessionService.ts`,
`subscribeBiometry` / `openBiometryBroadcast`) **[code app]**. Elles ne passent
plus par `live:session:<sessionId>`, qui ne transporte plus que les trames.

**Jamais sur la présence, jamais sur le board.** `RosterMeta` porte un booléen
`bioShared` (`liveSessionLogic.ts:64`) — un état de partage, pas une mesure. La
protection y est **structurelle** : aucune FC n'est écrite dans la présence, et
aucun filtre ne s'y exécute (`src/hooks/useRosterBiometry.ts:12-17` le dit
explicitement, pour ne pas laisser croire à une protection inexistante) **[code app]**.
Le roster n'affiche d'ailleurs aucun bpm : une valeur chiffrée en liste
inviterait à comparer les pilotes entre eux.

**Le triple verrou**, re-vérifié à **chaque tick** de 2 s, jamais une seule fois
au démarrage (`liveRelayRunner.ts:297-344`) **[code app]** :

1. consentement biométrie du pilote — capture **et** partage coach ;
2. binôme au niveau détaillé ;
3. drapeau serveur `biometry`.

`canEmitBiometry` exige les trois strictement à `true` ; toute valeur absente ou
douteuse vaut refus (`liveHealthGate.ts:111-114`) **[code app]**.

**Pourquoi un canal par coach.** `live:session:` est **partagé par tous les
coachs consentis** : ce qui y part, part à tout le monde. On ne pouvait donc pas
réserver la biométrie à certains, et la seule position tenable était le **tout ou
rien** — n'émettre que si CHAQUE coach à l'écoute était au niveau détaillé. Un
coach détaillé perdait alors le cardio parce qu'un confrère en `lecture_simple`
s'était connecté.

Le destinataire est désormais **dans le topic**. L'émetteur choisit ses
destinataires un par un (`destinatairesBiometrie`, `liveHealthGate.ts`) et
n'ouvre un canal que vers ceux-là. Un coach non éligible n'est pas filtré à la
réception : le message ne part pas vers lui.

```ts
const destinataires = destinatairesBiometrie(aJour, socleConsenti, flagOn);
for (const c of destinataires) bio.sendTo(c.coachId, event);
```

**Ce qui protège, et ce qui ne protège pas.** Pas le nom du topic — le deviner
est facile. La barrière est la RLS `realtime.messages`, qui exige de l'abonné
qu'il SOIT le coach nommé dans le topic et qu'il soit au niveau détaillé.
**Policies APPLIQUÉES le 01/08/2026** (`20260801140838_l27_...`). Elles
autorisent aussi le pilote propriétaire de la séance : Realtime exige une
autorisation de LECTURE pour REJOINDRE un canal privé, même pour n'y écrire que
des messages — sans cette branche, rien ne serait jamais parti.

Une réserve, établie par revue adversariale le même jour et **fermée le même
jour** : la policy s'appuie sur `coach_pilots.active`, `live_sharing_at` et
`level`, et un compte coach pouvait poser ces trois colonnes lui-même en un seul
INSERT — `coach_pilots_insert_by_coach` n'imposait aucune restriction de colonne,
et le garde-fou SEC-3 était un trigger `BEFORE UPDATE` seulement. Corrigé par
`20260801140905_l28_...` : une affiliation demandée par un coach naît en attente,
et le garde-fou couvre désormais l'insertion.

**Ce qui coupe la biométrie**, dans l'ordre où cela se produit :

- le pilote révoque `biometry_capture_consent_at` ou
  `biometry_coach_share_consent_at` sur `public.users` — révoquer la capture
  révoque aussi le partage (`src/services/consentService.ts`) **[code app]** ;
- un coach passe en `lecture_simple` : **lui seul** cesse de recevoir, ses
  confrères au niveau détaillé continuent. Le niveau est relu à chaque tick
  depuis la base, pas seulement à la réconciliation du canal de révocation ;
- le drapeau serveur `biometry` repasse à `false` ;
- le réseau tombe ou la lecture d'un consentement échoue : les `catch` renvoient
  `{ capture: false, coachShare: false }` et `false` — **fail-closed**
  (`liveRelayRunner.ts:302-306`) ;
- la capture s'arrête : `stopPilotLiveRelay()` ferme tout (`:384-392`) ;
- côté coach, **10 secondes** sans événement effacent l'affichage au lieu de figer
  la dernière valeur (`src/hooks/usePilotLive.ts:36`,
  `src/hooks/useRosterBiometry.ts:43`) **[code app]**. Une FC périmée ne doit
  jamais passer pour du direct.

Le marqueur `bioShared` publié dans la présence suit le consentement en séance et
est re-publié sur changement (`liveRelayRunner.ts:338-342`) **[code app]** : sans
cela, le coach continuerait de voir « Cardio » après une révocation.

**État en base** **[base]** : le drapeau `public.app_feature_flags` de clé
`biometry` est `enabled = true` depuis le 2026-07-25 (levé après validation
avocat du consentement, d'après sa description). Sur 14 utilisateurs, **0** a
`biometry_capture_consent_at` et **0** a `biometry_coach_share_consent_at`.
`public.biometry_raw` contient **0 ligne** ; sa RLS de lecture coach exige
`is_detailed_coach_of(user_id)` **et** un consentement de partage non nul. Le
verrou juridique est ouvert, le verrou du pilote ne l'est nulle part.

Un point d'attention pour vous : `public.app_feature_flags` est **lisible par
tous** (policy SELECT `true`, rôle `public`) et **modifiable par tout admin**
(`is_admin()`) **[base]**. Basculer la clé `biometry` depuis un back-office site
coupe ou rouvre, en production et sans déploiement, un flux de données de santé.
Ce n'est pas un réglage d'affichage.

### Deux canaux `postgres_changes` qui n'émettent rien aujourd'hui

Au-delà des trois topics, l'application ouvre deux abonnements aux changements de
tables **[code app]** :

- `relay-consent:<pilotId>` sur `public.coach_pilots`, filtré
  `pilot_id=eq.<pilotId>` (`liveRelayRunner.ts:361-382`) — c'est le mécanisme de
  **révocation en séance** : un coach retiré sort de son roster, le dernier retiré
  coupe tout ;
- `thread:<coachPilotId>` sur `public.coach_messages`
  (`src/hooks/useCoachThread.ts:38-54`) — la messagerie coach↔pilote.

Or la publication `supabase_realtime` ne contient **aucune table** **[base]** :

```sql
select * from pg_publication_tables;
-- seule la publication supabase_realtime_messages_publication apparaît,
-- sur les partitions de realtime.messages. Zéro table publique.
-- pg_publication : supabase_realtime, puballtables = false.
```

**Conclusion honnête : ces deux abonnements ne reçoivent rien en production.**
La révocation en vol par `postgres_changes` est inerte. Le direct reste
néanmoins coupé par d'autres chemins — le triple verrou biométrie est relu toutes
les 2 s, et l'audience est refusée côté serveur au prochain abonnement — mais le
flux `frame` d'une séance déjà ouverte ne se coupe pas tant que la capture dure
**[déduit du code et de l'état de la publication]**. C'est un défaut de notre
côté ; nous le signalons parce que le correctif est une opération de base, et
qu'elle vous concerne.

Ce qui en découle pour vous : **ajouter une table à la publication
`supabase_realtime` n'est jamais neutre**. Ajouter `public.coach_pilots` activerait
d'un coup un chemin de code jamais exercé en production. Ajouter
`public.coach_messages` allumerait la messagerie temps réel. Prévenez-nous avant,
dans un sens comme dans l'autre.

### Ce qui casserait si vous y touchez

| Objet | Effet sur le direct |
| --- | --- |
| Les six policies de `realtime.messages` | suppression = plus aucun abonnement n'aboutit ; le direct s'éteint sans message d'erreur lisible |
| RLS SELECT de `public.telemetry_sessions` | resserrée, les sous-requêtes des policies échouent : coach « hors ligne » sur un flux vivant |
| RLS SELECT de `public.coach_pilots` | idem, et le pilote ne peut plus rejoindre le roster de son coach |
| `coach_pilots.live_sharing_at` (renommée, supprimée, remplie en masse) | c'est LA porte du direct : la vider coupe tout, la remplir ouvre à des coachs qui n'ont rien demandé |
| `coach_pilots.level` (valeurs de l'enum) | un niveau inconnu est traité fail-closed (`liveRelayRunner.ts:91`) : la biométrie s'arrête |
| `telemetry_sessions.id` / `user_id` | les topics sont bâtis sur `id`, les policies sur `user_id` ; toute réécriture invalide les deux |
| `users.public_handle` | sans pseudo, le canal board n'est pas ouvert : aucune ligne sur l'écran du paddock |
| `users.car_number` | c'est la clé d'ordre du tableau de marche ; vide, l'ordre devient alphabétique |
| `app_feature_flags.biometry` | bascule en production, sans déploiement, un flux de données de santé |
| Publication `supabase_realtime` | y ajouter une table active des chemins de code aujourd'hui inertes |
| `public.is_registered_for_session` | fonction prête pour l'ouverture du board à la journée ; ne pas la modifier sans nous |

### Ce que nous demandons au site

1. **Confirmez que le Livrable 2 — la page `/board/<sessionId>` — est bien chez
   vous, et dites-nous où il en est.** Notre rapport de lot le situe dans le dépôt
   `oxv-site` (`roadmap/rapports/live-b.md`, section « Ce qui reste ») **[code app]**.
   Côté application, **aucun écran ne consomme le canal board** : `subscribeBoard`
   n'a aujourd'hui que des tests pour appelants **[code app]**. Sans votre page,
   le tableau de marche est un émetteur sans récepteur.
2. **Décidez du chaînon séance → journée.** Une colonne
   `telemetry_sessions.day_session_id` vers `public.sessions` suffirait ; le reste
   de la brique existe (`is_registered_for_session`, déjà en production). Sans
   elle, `board_recv` restera limitée au binôme et aucun inscrit de la journée ne
   lira l'écran. C'est une décision de schéma : elle vous appartient autant qu'à
   nous, et nous ne l'écrirons pas seuls.
3. **Décidez du compte du téléviseur.** Un écran de paddock n'est pas un
   utilisateur authentifié, et `anon` est exclu des six policies **[base]**. Il
   faut soit un compte de service dédié avec son propre chemin d'autorisation
   (une septième policy, à écrire), soit un relais serveur côté site qui lise avec
   `service_role` et rediffuse. Dites-nous lequel : les deux ont des conséquences
   différentes sur la RLS.
4. **Dites-nous comment le téléviseur découvrira les séances en cours.** Il n'existe
   aucune vue publique des captures actives : `telemetry_sessions` n'est lisible
   que par son propriétaire, ses coachs, ses amis et les admins **[base]**, et il
   y a 0 ligne au statut `recording` aujourd'hui. Un écran de paddock doit
   pourtant s'abonner à un `<sessionId>` par voiture. Cette liste n'existe nulle
   part : elle est à créer, et elle relève du même arbitrage que le point 2.
5. **Remplissez `users.public_handle` et `users.car_number`.** 2 pseudos sur 14
   comptes, 0 numéro de voiture sur 14 **[base]**. Sans pseudo, aucune ligne
   n'est émise ; sans numéro, l'ordre du tableau de marche n'a plus de clé. Si le
   site est le point de saisie de ces deux champs — c'est notre hypothèse
   **[déduit, à confirmer]** — dites-nous quand ils seront alimentés, et avec
   quelles règles d'unicité pour le numéro.
6. **Confirmez que le site n'écrit ni ne lit `coach_pilots.live_sharing_at`.**
   C'est le consentement au direct, révocable par le pilote depuis l'application
   (`pilotConsentService.ts:188`) **[code app]**. S'il existe un écran site qui le
   touche, nous devons le savoir : deux chemins d'écriture sur un consentement
   RGPD, c'est deux vérités possibles.
7. **Prévenez-nous avant toute modification de la publication
   `supabase_realtime`.** Elle est vide aujourd'hui **[base]** ; y ajouter une
   table réveille des abonnements `postgres_changes` de notre côté.
8. **Dites qui, chez vous, peut basculer `app_feature_flags.biometry`.** La table
   est modifiable par tout compte `is_admin()` **[base]**. Nous demandons que ce
   drapeau ne soit pas exposé dans un back-office générique, ou qu'il le soit avec
   un avertissement explicite : il gouverne un flux de données de santé.
9. **Confirmez qu'aucun écran site n'affiche de classement de track day.** Le
   canal board ne transporte aucun rang et notre rendu trie par numéro de voiture
   (`BOARD_MODE = 'A'`, verrouillé par test) **[code app]**. Un ordre par chrono
   affiché publiquement peut requalifier juridiquement un track day en
   compétition. Si votre page trie par temps, la protection est perdue quel que
   soit le contenu du canal.
10. **Aucune donnée de santé sur la page paddock, jamais.** La liste blanche
    `stripHealth` fait foi côté émission **[code app]** ; nous vous demandons de
    la refléter à la réception plutôt que de rendre le payload tel quel, et de ne
    pas ajouter de clé à cette liste sans nous en parler : toute clé ajoutée
    devient immédiatement visible d'un public, plus seulement du coach.

---

## Fonction DONNÉES PERSONNELLES — rétention, purge, RGPD

### Comment lire cette section

Nous n'avons pas accès au code du site. Tout ce qui suit vient de deux sources,
et nous indiquons systématiquement laquelle :

- **vérifié dans le code de l'app** — un chemin de fichier et une ligne dans le
  dépôt `oxv-app` ;
- **vérifié en base** — une requête SQL en lecture seule sur le projet Supabase
  de production `fouvuqkdxarjpjbqnsjq`, exécutée le 26 juillet 2026 ;
- **déduit, à confirmer par le site** — une conclusion tirée de ce que la base
  montre et de ce que l'application ne fait pas. Ce n'est pas un fait établi.

Les comptages sont ceux du 26 juillet 2026. Une table vide ne prouve pas qu'un
dispositif fonctionne : elle prouve qu'il n'a pas encore été mis à l'épreuve.

Un mot sur l'échelle. La base de production contient **14 comptes
utilisateurs**, **0 demande de suppression en cours** et **0 compte déjà purgé**
(`users.email like 'deleted-%@oxv.invalid'` renvoie 0). Le dispositif de purge
décrit ci-dessous est donc **déployé et planifié, mais jamais encore exercé sur
un compte réel**. Vérifié en base.

### Ce que l'application collecte

L'application écrit dans la base partagée. Voici les familles, avec le nombre de
lignes réel en production.

| Famille | Table(s) | Colonnes qui comptent | RLS | Lignes |
|---|---|---|---|---|
| Profil pilote | `users` | `email`, `first_name`, `last_name`, `birth_date`, `phone`, `address_*`, `emergency_contact_*` | activée, 4 policies (`users_select_own_or_admin`, etc.) | 14 |
| Santé (art. 9) | `users.blood_type`, `users.medical_notes` | texte libre médical | idem `users` | 14 lignes, **0 renseignée** |
| Cardio (art. 9) | `biometry_raw` | `hr`, `rr_ms[]`, `source`, `quality`, `ts` | activée, 2 policies (`biometry_own_all`, `biometry_coach_read`) | **0** |
| Télémétrie | `telemetry_sessions` → `telemetry_frames`, `laps`, `session_insights`, `weather_snapshots` | position GPS, accélérations, vitesses | activée (7 policies sur `telemetry_sessions`, 6 sur `telemetry_frames`) | 18 sessions / 53 trames |
| Lectures dérivées | `app_session_analyses`, `app_segment_analyses`, `session_insights` | analyse qualitative de conduite | activée | 1 ligne d'insight |
| Documents | `documents` (table) + bucket `documents` | permis, licences, certificats | activée, 5 policies | 9 lignes / 9 objets |
| Médias | `session_media`, `media`, buckets `pilot-media`, `session-media`, `vehicles` | photos, captions | activée | 0 / 0 / 8 objets `vehicles` |
| Consentements | `users.*_accepted_at`, `ai_debrief_enabled`, `coach_ai_enabled`, `biometry_*_consent_at` | horodatage de preuve | idem `users` | 3 acceptations confidentialité, 3 CGU, 2 pacte |
| Appairage | `app_pairing_codes` | `used_user_agent` | activée | 0 |
| Incidents | `incident_reports` | `description`, `photo_path` | activée, 2 policies | **0** |

Vérifié en base pour la RLS, les colonnes et les comptages.

Trois points de doctrine à connaître, car ils changent la nature du risque.

**La santé est sous triple verrou côté app.** Le module
`src/services/v2/liveHealthGate.ts:1-16` matérialise une barrière par **liste
blanche** : seules les clés explicitement inscrites peuvent quitter l'app vers un
canal non-coach. Un capteur santé branché demain ne fuite pas tant que sa clé
n'est pas ajoutée. La capture cardio elle-même est double-verrouillée
(`src/services/biometryCaptureRunner.ts:10-18`) : drapeau serveur **et**
consentement de capture du pilote, sinon le module reste dormant, sans aucune
entrée-sortie. Vérifié dans le code de l'app.

**Les consentements sont horodatés, pas booléens, pour la biométrie.**
`src/services/consentService.ts:92-111` : `biometry_capture_consent_at` et
`biometry_coach_share_consent_at` sont des `timestamptz`. NULL vaut refus, une
date vaut consentement daté. C'est la trace exigée par l'article 7-1. Les deux
consentements IA, eux, sont des booléens sans date : `ai_debrief_enabled`
(opt-out, défaut activé) et `coach_ai_enabled` (opt-in, défaut désactivé),
`src/services/consentService.ts:31-36`. **En production, 13 comptes sur 14 ont
`ai_debrief_enabled = true`** — c'est-à-dire par défaut, sans acte positif.
Vérifié en base. Le transfert hors UE associé est traité plus bas.

**La mesure d'audience de l'app pointe sur votre domaine.**
`eas.json:25` et `eas.json:39` fixent `EXPO_PUBLIC_PLAUSIBLE_DOMAIN` à
`oxvehicle.fr` pour les profils preview et production. Les événements de
l'application mobile arrivent donc dans **la même propriété Plausible que le
trafic du site**. L'app ne transmet aucune donnée identifiante : la liste noire
`FORBIDDEN_ANALYTICS_PROP_KEYS` (`src/services/analyticsService.ts`, section
« Garde PII ») rejette `email`, `name`, `first_name`, `last_name`, `handle`,
`phone`, `iban`, et un opt-out local est disponible. Vérifié dans le code de
l'app. Ce que nous ne savons pas : ce que votre bandeau de consentement et votre
politique déclarent au sujet de cette propriété. Déduit, à confirmer par le site.

### Ce que le site collecte, vu depuis la base

Nous ne voyons pas votre code. Nous voyons vos tables et vos fonctions edge.

| Table | Colonnes personnelles | RLS | Lignes | Origine |
|---|---|---|---|---|
| `demandes_inscription` | `first_name`, `last_name`, `email`, `phone`, `birth_date` | activée, 3 policies | 4 | site — aucune référence dans le code de l'app |
| `contact_messages` | `first_name`, `last_name`, `email`, `phone`, **`ip_address`** | activée, 2 policies | 1 | site |
| `corporate_leads` | `email`, `phone` | activée, 3 policies | 0 | site |
| `founding_members` | `prenom`, `nom`, `email`, `fonction_pro`, `vehicule`, `yousign_request_id`, `consent_rgpd` | activée, **0 policy** | 1 | site |
| `email_log` | `user_id`, `subject`, `metadata` | activée, 1 policy | 16 | fonctions edge partagées |
| `payments`, `registrations`, `invoices`, `subscriptions` | `user_id`, montants, références | activée | 1 / 1 / 0 / 0 | site |
| `admin_audit` | `user_id`, `ip_address` | activée, 3 policies | 59 | site et back-office |

Vérifié en base. La colonne « Origine » relève de la déduction : nous avons
cherché ces noms dans tout le code de l'application et ne les trouvons que dans
les fonctions edge du dépôt partagé (`supabase/functions/notify-admin-lead`,
`send-application-ack`, `eligibility-reminders`, `feedback-request`,
`generate-invoice`, `newsletter-push`). L'application mobile, elle, n'écrit dans
aucune de ces tables. **Déduit, à confirmer par le site.**

Deux fonctions edge actives en production n'existent dans aucun code de notre
côté : `capture-membre-fondateur` (version 7) et `yousign-webhook` (version 6),
toutes deux `verify_jwt: false`. Vérifié via l'API Supabase. Elles alimentent
manifestement `founding_members`, qui porte une colonne `yousign_request_id`.

**Conséquence RGPD immédiate : Yousign est un sous-traitant qui traite de la
donnée personnelle, et il ne figure dans aucune de vos listes.** La table des
sous-traitants de la politique de confidentialité
(`docs/juridique/04_POLITIQUE_CONFIDENTIALITE.md:147-154`) énumère Supabase,
Vercel, Resend, OpenAI, ElevenLabs et Stripe. Pas Yousign. Cette même table est
**embarquée telle quelle dans l'application** (`src/legal/legalDocuments.ts:32`,
document `confidentialite`) : ce que le pilote lit dans l'app est incomplet.
Vérifié dans le code de l'app et en base.

**Une colonne de rétention n'est alimentée par personne.** `users.last_login_at`
est **NULL pour les 14 comptes** (vérifié en base). L'application ne fait que la
lire, dans un écran d'administration
(`src/services/adminUsersService.ts:51` et `:65`) ; elle ne l'écrit jamais
(vérifié dans le code de l'app). Or la règle annoncée « compte pilote inactif :
3 ans après la dernière connexion »
(`docs/juridique/04_POLITIQUE_CONFIDENTIALITE.md:178`) repose entièrement sur
cette colonne. **La règle est aujourd'hui inapplicable, faute de donnée.** Si
c'est le site qui doit l'alimenter, il ne le fait pas. Déduit, à confirmer par le
site.

### Durées de conservation : ce qui est annoncé, ce qui est réellement outillé

Le tableau annoncé se trouve en `docs/juridique/04_POLITIQUE_CONFIDENTIALITE.md:175-186`,
et il est repris mot pour mot dans l'application (`src/legal/legalDocuments.ts:32`).
Voici la confrontation avec les mécanismes réels.

| Donnée | Durée annoncée | Mécanisme réel | État |
|---|---|---|---|
| Compte actif | durée d'activité | aucun | conforme par construction |
| Compte inactif | 3 ans après dernière connexion | **aucun**, et `last_login_at` vide | **non outillé** |
| Documents KYC | 5 ans après la dernière session | **aucun cron**, et la purge de compte les supprime à J+30 | **contradiction, voir plus bas** |
| Trames brutes (`telemetry_frames`) | 12 mois | `cleanup_old_telemetry_frames()`, cron `cleanup-telemetry-frames` (jobid 6, `30 3 * * *`) | **actif**, 27 exécutions, toutes réussies, dernière le 25/07/2026 |
| Fichiers `.ubx` bruts (bucket `telemetry_raw`) | non annoncée | **aucun** | **angle mort** : la règle des 12 mois ne couvre que les lignes en base, pas les 3 objets du bucket |
| Cardio (`biometry_raw`) | 30 jours | `purge_old_biometry()`, cron `biometry-retention-daily` (jobid 11, `15 3 * * *`) | **actif**, 7 exécutions réussies, dernière le 25/07/2026 |
| Analyses dérivées | durée d'activité du compte | supprimées en cascade avec `telemetry_sessions` | conforme |
| Factures et comptabilité | 10 ans | conservation volontaire, `payments.user_id` en `NO ACTION` | conforme |
| Logs techniques | 12 mois | **aucun** pour `admin_audit` (59 lignes, depuis le 17/05/2026) ; `cleanup_old_notif_logs()` existe mais **n'est planifié dans aucun cron** | **non outillé** |
| Newsletter | jusqu'à désinscription | `users.accepts_marketing`, remis à `false` par la purge | conforme |

Vérifié en base pour les crons, les fonctions et les comptages ; vérifié dans le
code de l'app pour les migrations d'origine
(`supabase/migrations/20260614124638_app_telemetry_frames_retention.sql:27`,
`supabase/migrations/20260629002350_schedule_telemetry_frames_purge.sql:9`,
`supabase/migrations/20260719020957_be1_biometry.sql:76`).

Deux remarques honnêtes. La règle des **12 mois pour les trames** est sans effet
observable à ce jour : la plus ancienne trame date du 28/06/2026, le cron tourne
mais ne supprime rien encore. La règle des **30 jours pour le cardio** porte sur
une table vide. Dans les deux cas le mécanisme précède la donnée, ce qui est le
bon ordre, mais aucun n'a encore eu à travailler.

### L'état réel des tâches planifiées

Huit tâches sont planifiées dans `cron.job`. Toutes actives, toutes en succès.
Vérifié en base (`cron.job` croisé avec `cron.job_run_details`).

| jobid | Nom | Fréquence | Dernière exécution | Objet |
|---|---|---|---|---|
| 4 | `analyze-pending-sessions` | `0 * * * *` | 26/07/2026 02:00 | traitement, pas de purge |
| 5 | `compute-insights-hourly` | `30 * * * *` | 26/07/2026 02:30 | traitement |
| 6 | `cleanup-telemetry-frames` | `30 3 * * *` | 25/07/2026 03:30 | **rétention 12 mois** |
| 7 | `oxv-eligibility-reminders` | `0 6 * * *` | 25/07/2026 06:00 | e-mails |
| 8 | `oxv-feedback-requests` | `0 7 * * *` | 25/07/2026 07:00 | e-mails |
| 9 | `purge-deleted-accounts-daily` | `30 2 * * *` | 26/07/2026 02:30 | **effacement des comptes** |
| 10 | `ritual_dispatcher_hourly` | `0 16-19 * * *` | 25/07/2026 19:00 | notifications |
| 11 | `biometry-retention-daily` | `15 3 * * *` | 25/07/2026 03:15 | **rétention 30 jours santé** |

Une anomalie mineure, signalée par honnêteté : l'historique
`cron.job_run_details` contient un **jobid 3** (228 exécutions réussies, dernière
le 18/07/2026 à 19:00) qui **ne figure plus dans `cron.job`**. Une tâche a été
déplanifiée ce jour-là. Nous ignorons laquelle et à qui elle appartenait.
Déduit, à confirmer par le site.

Attention à un piège documentaire. Plusieurs de nos propres documents datés du
19/07/2026 affirment qu'**aucun cron de purge n'existe** — notamment
`docs/architecture/14_PURGE_MATRIX.md:21` (« Constat n°1, gravité CRITIQUE ») et
`supabase/functions/purge-deleted-accounts/README.md:3-10`. **C'était vrai ce
jour-là, ce ne l'est plus.** Le job 9 existe et a tourné 8 fois. Ne vous fiez pas
à ces documents sur ce point précis ; fiez-vous à `cron.job`.

### La fonction purge_user_data : ce qu'elle couvre exactement

C'est la pièce centrale du droit à l'effacement. Elle existe bien en production.

Signature vérifiée en base : `public.purge_user_data(p_user uuid) returns void`,
`language plpgsql`, **`security definer`**, `set search_path to 'public',
'pg_temp'`. Source versionnée :
`supabase/migrations/20260719011309_sec1_purge_user_data.sql:12`, appliquée en
production le 19 juillet 2026 à 01:13:09 UTC, étendue par
`supabase/migrations/20260719021126_be1_purge_extend.sql`.

Elle est **transactionnelle** : tout passe ou rien ne passe. C'est ce qui la
distingue de la version précédente, qui enchaînait des `DELETE` séparés et
pouvait laisser un compte à moitié effacé.

**Stratégie : anonymiser-et-purger, jamais de suppression de la ligne `users`.**
La raison est structurelle et mérite d'être comprise côté site :
`payments.user_id` et `invoices.user_id` sont en **`NO ACTION`** (vérifié en
base). Un `DELETE` sur `users` échouerait sur la contrainte. La ligne reste donc,
vidée de son contenu identifiant.

Ce qu'elle **supprime** (`delete`), tel qu'énuméré dans le corps de la fonction
lu en production : `telemetry_sessions` (et par cascade `telemetry_frames`,
`laps`, `session_insights`, `weather_snapshots`, `app_segment_analyses`,
`session_media`, `video_overlays`, `biometry_raw`, `data_quality_reports`),
`vehicles`, `documents`, `app_session_analyses`, `app_progression_shares`,
`circuits`, `heritage_packs`, `ritual_dispatches`, `pilot_goals`,
`session_media`, `coach_permissions`, `coach_pilots`, `coach_session_context`,
`coach_corner_reference`, `coach_reading_weights`, `coach_roulages`,
`roulage_invitations`, `pilot_friendships`, `coach_profiles`,
`coach_annotations`, `coach_annotation_template`, `coach_availability`,
`coach_objectives`, `coach_pilot_highlight`, `coach_messages`,
`coach_testimonials`, `pilot_sheets`, `session_intentions`, `session_feedback`,
`scenic_routes`, `ping_rsvps`, `social_pings`, `duels`, `crew_members`,
**`demandes_inscription`** (par `created_user_id`), **`contact_messages`** (par
`user_id`), `support_tickets` et `support_messages`, `media`, `media_exports`,
`event_registrations`, `partner_accounts`, `partner_leads`, `app_pairing_codes`,
`biometry_raw`, `video_overlays`, `founder_applications`, `convoy_participants`,
`convoys`.

Ce qu'elle **anonymise** (la ligne reste, le lien part) : `coaching_bookings`
(`pilot_first_name` → NULL), `duels.opponent_id`, `crew_members.referred_by`,
`device_assignments.pilot_id`, `admin_audit.user_id`, et **`email_log`**
(`user_id`, `subject` et `metadata` → NULL, le type d'e-mail et les dates
restant pour l'audit de délivrabilité). `incident_reports` est anonymisée sous
condition d'existence de la table (`to_regclass`) — la table existe désormais,
elle est vide.

Ce qu'elle **scrube sur `users`** : `email` remplacé par
`deleted-<uuid>@oxv.invalid`, puis mise à NULL de `first_name`, `last_name`,
`birth_date`, `phone`, `address_*`, `emergency_contact_*`, **`blood_type`**,
**`medical_notes`**, `ffsa_license`, `experience_years`, `avatar_url`,
`public_handle`, `admin_notes`, `expo_push_token`, `notification_preferences`,
`bio`, `socials`, `media`, `livery`, `vehicle`, `car_number`,
`affiliation_code`, `suspension_reason` ; `push_notif_enabled`,
`accepts_marketing` et `pavilion_name_optin` à `false` ; les deux consentements
biométriques remis à NULL.

Ce qui **survit volontairement sur `users`** : `stripe_customer_id`,
`role`, `kyc_status`, `created_at`, `preferred_language`, `pilot_level`, et les
horodatages d'acceptation (`pact/cgu/privacy/coach_pact_accepted_at` et leurs
versions) — ces derniers comme preuve de consentement.

Le volet **Storage** n'est pas dans la fonction SQL : il est porté par la
fonction edge `purge-deleted-accounts`, version 10, statut `ACTIVE`,
`verify_jwt: false`. Elle couvre huit buckets par préfixe `{userId}/`
(`supabase/functions/purge-deleted-accounts/index.ts:64-73` :
`vehicles`, `documents`, `avatars`, `audio_briefings`, `pilot-media`,
`session-media`, `telemetry_raw`, `coach-media`), plus `coach-audio` par liste
d'identifiants d'annotations collectés **avant** la purge en base (ligne 77 et
lignes 120-129). La suppression est **récursive** (lignes 191-213) et
**fail-closed** (lignes 216-229) : un échec de retrait fait échouer le compte
courant, dont les lignes restent en base et seront retentées au run suivant.
Le bucket `invoices` est délibérément conservé. Enfin, l'utilisateur Auth est
anonymisé et banni, sans suppression dure (lignes 143-148).

La récursivité n'est pas théorique : **les 8 objets du bucket `vehicles` sont à
des chemins imbriqués** (vérifié en base, `storage.objects`), donc invisibles
pour une liste non récursive.

**Un piège de lecture, à signaler franchement.** Le fichier du dépôt
`supabase/functions/purge-deleted-accounts/index.ts:4-7` porte encore l'en-tête
« VERSION 5 (SEC-1) — PRÉPARÉE, NON DÉPLOYÉE » et affirme qu'aucun cron ne
l'invoque. **Le code réellement déployé en production porte un en-tête
différent : « déployée le 19/07/2026 après approbation fondateur ».** Le corps
des deux versions est identique ; seul le commentaire diverge. Vérifié en
comparant le fichier local et la source récupérée via l'API Supabase. Si vous
lisez notre dépôt, ne concluez pas de cet en-tête que la purge ne tourne pas.

### Ce que la purge ne couvre pas

C'est la partie la plus utile pour vous, parce qu'elle désigne ce dont
**quelqu'un d'autre** doit se charger.

**Conservations assumées, pour base légale.** `payments`, `registrations`,
`invoices`, `subscriptions`, le bucket `invoices`, et `users.stripe_customer_id`
— obligation comptable de dix ans, documentée en
`docs/architecture/14_PURGE_MATRIX.md:136` et couverte par la ligne 182 de votre
politique. Arbitrage, pas oubli.

**Tables portant un lien utilisateur que la fonction n'énumère pas.** Nous avons
croisé la liste complète des tables `public` portant `user_id`, `pilot_id`,
`coach_id`, `created_by`, `author_user_id` ou `profile_id` avec le corps de
`purge_user_data`. Restent en dehors :

| Table | Lien | Lignes | Remarque |
|---|---|---|---|
| `coach_payout_details` | `coach_id` | 0 | contient **`iban`**, `bic`, `account_holder` |
| `pilot_waiver_signatures` | `user_id` | 0 | preuve de décharge — conservation probablement voulue |
| `pilot_notes` | `user_id` | 0 | notes du pilote |
| `pilot_signature_snapshots` | `user_id` | 0 | |
| `pilot_goal_events` | `user_id` | 0 | |
| `ambassador_profiles` | `user_id` | 0 | |
| `ai_safety_reviews` | `pilot_id` | 0 | |
| `coach_ai_drafts` | `coach_id`, `pilot_id` | 0 | |
| `coach_objective_events` | `coach_id`, `pilot_id` | 0 | |
| `coach_queue` | `coach_id`, `pilot_id` | 0 | partiellement couvert par cascade session |
| `pilot_development_cycles` | `coach_id`, `pilot_id` | 0 | |
| `coach_invoices`, `coach_invoice_counters` | `coach_id`, `pilot_id` | 0 | facturation coach, arbitrage à confirmer |
| `founding_members` | **aucun lien utilisateur**, seulement `email` | 1 | ne peut pas être purgée par `user_id` |
| `corporate_leads` | **aucun lien utilisateur** | 0 | idem |

Vérifié en base pour les liens et les comptages, vérifié dans le code pour
l'absence de ces tables dans la fonction.

Le cas de `coach_payout_details` mérite d'être explicité, car il est
contre-intuitif : sa clé étrangère vers `users` est en **`CASCADE`** (vérifié en
base). On pourrait croire le problème réglé. Il ne l'est pas : **la stratégie
étant l'anonymisation, la ligne `users` n'est jamais supprimée, donc la cascade
ne se déclenche jamais.** Un IBAN de coach survivrait à l'effacement du compte.
La table est vide aujourd'hui, ce qui borne le risque à un risque de règle, pas
de fait.

`founding_members` vous concerne directement : la table porte un `email`, un
`consent_rgpd` et un `yousign_request_id`, elle a **RLS activée mais zéro
policy** (inaccessible via l'API, seul `service_role` l'atteint — vérifié en
base), et **aucune clé ne la relie à un compte**. Une demande d'effacement
exercée dans l'application ne peut pas l'atteindre. C'est à vous de la traiter.

**Storage hors périmètre.** Trois buckets échappent à la purge par préfixe :
`pavillon-photos` (0 objet, procédure manuelle assumée, droit à l'image),
`partner-media` (2 objets, assets partenaires) et surtout **`founding-members`**
(1 objet, **sans préfixe utilisateur** — vérifié en base). Ce dernier n'existait
pas lorsque `PREFIX_BUCKETS` a été écrite et n'y a jamais été ajouté.

**Les fichiers `.ubx` bruts n'ont pas de rétention.** Le bucket `telemetry_raw`
(3 objets, convention `{user_id}/{telemetry_session_id}.ubx`, vérifiée en
`src/services/telemetryStorage.ts:31-33`) est bien purgé lors d'un effacement de
compte, mais **aucune tâche ne l'élague au bout de 12 mois** : cette règle ne
porte que sur `telemetry_frames`.

**Une contradiction franche sur les documents KYC.** La politique annonce cinq
ans de conservation au titre d'une obligation légale
(`docs/juridique/04_POLITIQUE_CONFIDENTIALITE.md:179`). La purge, elle, supprime
la table `documents` **et** les objets du bucket `documents` trente jours après
la demande. Les deux règles ne peuvent pas être vraies en même temps. Neuf
documents sont concernés aujourd'hui. **Cet arbitrage est juridique, pas
technique : il doit être tranché, puis les deux textes alignés.**

**Ce que la purge ne peut structurellement pas atteindre, et qui vous revient :**

1. **Stripe.** `users.stripe_customer_id` est conservé et aucun appel à l'API
   Stripe n'est effectué. En production, cette colonne est vide sur les 14
   comptes et la seule ligne de `payments` ne porte aucun identifiant Stripe
   (vérifié en base). Il n'y a donc **rien à effacer chez Stripe aujourd'hui**,
   mais le jour où le paiement par carte sera activé, l'effacement côté Stripe
   sera un geste que **personne ne fait**. Votre politique le présente encore
   comme « à venir » (ligne 154).
2. **Les e-mails déjà envoyés.** `email_log` est anonymisée, mais le message parti
   chez Resend, et surtout **la boîte du destinataire**, sont hors de portée.
   Aucune procédure n'existe de notre côté. Déduit, à confirmer par le site.
3. **Yousign.** Les demandes de signature référencées par
   `founding_members.yousign_request_id` vivent chez un tiers. Rien dans la base
   ne déclenche leur suppression.
4. **Les sauvegardes Supabase.** Instantanés et point-in-time recovery
   contiennent nécessairement l'état antérieur à toute purge. C'est admis par le
   RGPD sous condition de délai borné et de non-réinjection, mais **cela doit
   être écrit** dans la politique, ce qui n'est pas le cas.
5. **`sessions.private_client_name` et `sessions.private_client_contact`.** Texte
   libre saisi par un administrateur, sans lien vers un compte, donc
   inatteignable par `user_id` (`docs/architecture/14_PURGE_MATRIX.md:144`).
   Table qui semble relever du site : procédure manuelle à définir chez vous.
6. **Les données restées sur l'appareil du pilote.** Tampons locaux MMKV et
   fichiers `.ubx` en attente de synchronisation. La purge serveur ne les touche
   pas ; la désinstallation de l'application, oui.

### Les cinq tables `_backup_*_20260719`

Elles méritent leur propre traitement, parce qu'elles copient de la donnée
personnelle **hors du dispositif de purge**.

| Table | Lignes | RLS | Policies | Colonnes personnelles |
|---|---|---|---|---|
| `_backup_sessions_20260719` | **44** | **activée** | 0 | `private_client_name`, `private_client_contact`, `notes` |
| `_backup_registrations_20260719` | **5** | **désactivée** | 0 | `user_id`, `cancelled_by`, `cancellation_reason`, `notes` |
| `_backup_payments_20260719` | **2** | **désactivée** | 0 | `user_id`, identifiants Stripe, `metadata` |
| `_backup_weather_20260719` | 14 | **désactivée** | 0 | aucune (données météo) |
| `_backup_session_feedback_20260719` | **0** | **désactivée** | 0 | `user_id`, `comment` |

Vérifié en base : comptages exacts, `pg_class.relrowsecurity`, `pg_policies`.

Trois faits à retenir.

**Elles ne sont pas exposées par l'API.** `information_schema.role_table_grants`
ne renvoie que `postgres` et `service_role` : **aucun droit pour `anon` ni pour
`authenticated`**. L'absence de RLS sur quatre d'entre elles est donc moins grave
qu'il n'y paraît — seul du code serveur muni de la clé de service les lit.

**Elles sont invisibles pour `purge_user_data`.** La fonction ne les nomme pas.
Un pilote qui exercerait aujourd'hui son droit à l'effacement resterait présent
dans `_backup_registrations_20260719` et `_backup_payments_20260719`. C'est un
manquement à l'article 17, atténué par le fait qu'aucun effacement n'a encore été
demandé (0 ligne dans `users` avec `deletion_requested_at`).

**Elles semblent relever du site.** Les cinq tables portent sur `sessions`,
`registrations`, `payments`, `session_feedback` et `weather` — des objets dont le
site paraît propriétaire. La seule sécurisation opérée de notre côté est
défensive : `alter table public._backup_sessions_20260719 enable row level
security` en
`supabase/migrations/20260719011108_sec1_b_pii_private_sessions.sql:23`, RLS
activée sans policy, ce qui en PostgreSQL vaut refus total. **Nous ne les
supprimerons pas : elles ne sont pas à nous.** La décision de `DROP` est en
attente depuis le 19 juillet 2026
(`docs/architecture/14_PURGE_MATRIX.md:145`).

### L'hébergement : `eu-west-1`, Irlande

La région réelle du projet Supabase de production, obtenue par l'API de gestion
Supabase : **`eu-west-1`**, c'est-à-dire l'Irlande, Union européenne. Le projet
s'appelle `oxv-platform`, PostgreSQL 17.6, créé le 8 mai 2026. Vérifié.

**Sept documents du dépôt affirment le contraire et disent « Frankfurt » ou
« Francfort », donc l'Allemagne.** C'est faux. La liste, pour que vous puissiez
corriger les vôtres si vous en avez de semblables :

| Fichier | Ligne | Texte |
|---|---|---|
| `docs/juridique/04_POLITIQUE_CONFIDENTIALITE.md` | 149 | « Supabase … Frankfurt, Allemagne (UE) » |
| `docs/juridique/04_POLITIQUE_CONFIDENTIALITE.md` | 316 | « principalement en Allemagne (Frankfurt) chez notre hébergeur Supabase » |
| `docs/juridique/02_CGU_APP_OXV_MIRROR.md` | 206 | « infrastructure technique de Supabase (Frankfurt, Union européenne) » |
| `docs/juridique/03_CGV_PRESTATIONS_OXV.md` | 344 et 402 | « Supabase, Frankfurt (Union européenne) » / « infrastructure située à Frankfurt, Allemagne » |
| `src/legal/legalDocuments.ts` | 25 et 32 | **les mêmes mentions, embarquées dans l'application** |
| `docs/alpha/GUIDE_PILOTE_ALPHA.md` | 218 | « serveurs européens (Frankfurt) » |
| `docs/app_store/KIT_APP_STORE_OXV_MIRROR.md` | 138 | « hébergées en Europe (Frankfurt) » |
| `docs/architecture/03_PARTIE_3_deploiement.md` | 678 | « Supabase est hébergé en Europe (Frankfurt) » |

Vérifié dans le code de l'app pour chacune de ces lignes.

Le point de droit est mesuré : l'Irlande comme l'Allemagne sont dans l'Union
européenne, il n'y a **pas de transfert hors UE** de ce fait, et la conformité de
fond n'est pas atteinte. Mais une politique qui nomme un pays d'hébergement doit
nommer le bon. Les lignes 25 et 32 de `src/legal/legalDocuments.ts` sont celles
que le pilote lit dans l'application : la correction est à faire des deux côtés
en même temps, puisque le même texte est publié par le site et embarqué par
l'app. Un seul document du dépôt dit vrai :
`docs/juridique/consentement_biometrie.md:80`.

**Les transferts hors UE, eux, existent bien et sont ailleurs.** Deux
sous-traitants américains sont déclarés : OpenAI (rédaction du débrief) et
ElevenLabs (synthèse vocale), sous clauses contractuelles types
(`docs/juridique/04_POLITIQUE_CONFIDENTIALITE.md:152-153`). Le consentement
OpenAI est un **opt-out** : `ai_debrief_enabled` vaut `true` par défaut, et **13
comptes sur 14 sont dans cet état** en production. Vérifié en base et dans
`src/services/consentService.ts:32-33`. Si votre analyse juridique conclut que ce
traitement relève du consentement au sens de l'article 6-1-a, un défaut à
« activé » ne le constitue pas. Si elle conclut à l'intérêt légitime ou à
l'exécution du contrat, l'opt-out se défend. **Cette qualification doit être la
même dans votre politique et dans notre app** : aujourd'hui, la politique range
l'IA parmi les transferts avec possibilité de désactivation (ligne 324) sans
nommer la base légale du traitement lui-même.

### Ce que le site doit impérativement aligner sur l'app

Trois textes doivent dire exactement la même chose des deux côtés, parce qu'ils
décrivent **un seul traitement** opéré sur **une seule base**.

**1. Mentions légales.** Le responsable de traitement est unique. Les documents
embarqués dans l'application portent encore des marqueurs non renseignés :
`[SIRET à compléter]`, `[Siège social à compléter]`, `[RCS à compléter]`,
`[DPO à désigner si chiffre d'affaires le justifie]`, et une entrée en vigueur
libellée `[date de mise en service]` (`src/legal/legalDocuments.ts:25`, article
13 et pied de document). Vérifié dans le code de l'app. Si vos mentions légales
publiées portent les vraies valeurs, transmettez-les-nous : nous les
répercuterons à l'identique. Publier deux identités d'éditeur différentes pour un
même service serait un défaut d'information.

**2. Politique de confidentialité.** Elle est **la même** des deux côtés : le
texte de `docs/juridique/04_POLITIQUE_CONFIDENTIALITE.md` est celui embarqué dans
l'application (`src/legal/legalDocuments.ts:32`) et il se présente lui-même comme
couvrant « Site oxvehicle.fr et application OXV Mirror ». Toute modification de
votre côté doit nous être signalée, sans quoi l'application publiera une version
périmée. Quatre corrections sont dues, indépendamment de qui les porte :

- l'hébergeur est en **Irlande**, pas à Francfort (lignes 149 et 316) ;
- **Yousign** manque dans la table des sous-traitants (ligne 147-154) ;
- le **délai d'export** annoncé — « le fichier vous est envoyé par email sous 7
  jours » (ligne 218) — ne correspond pas au comportement réel : l'application
  produit l'export **immédiatement, sur l'appareil**, sans e-mail et sans
  backend (`src/services/dataExportService.ts:1-14` et `:200-223`). La promesse
  est plus lente que la réalité, ce qui est le bon sens de l'erreur, mais elle
  est fausse. Elle est aussi **incomplète** : les trames brutes sont exclues de
  l'export automatique et fournies sur demande, ce que le texte ne dit pas, alors
  qu'un export CSV des trames existe bel et bien
  (`src/services/dataExportService.ts:161`) ;
- la **rétention des documents KYC** (5 ans, ligne 179) contredit la purge à
  J+30. Il faut choisir.

**3. Base légale des traitements.** Le tableau des finalités
(`docs/juridique/04_POLITIQUE_CONFIDENTIALITE.md:118-127`) et l'article 8.2 des
CGU embarquées (`src/legal/legalDocuments.ts:25`) doivent être cohérents avec ce
que la base montre :

- **santé** (`users.medical_notes`, `users.blood_type`, `biometry_raw`) relève de
  l'**article 9**. Aucune ligne du tableau des finalités ne le mentionne. Côté
  app, le consentement biométrique est horodaté et strictement opt-in, ce qui est
  la bonne mécanique ; il lui manque sa base légale écrite ;
- **transfert OpenAI** en opt-out, sur 13 comptes sur 14 : base légale à nommer,
  et à nommer de la même façon des deux côtés ;
- **`contact_messages.ip_address`** et **`admin_audit.ip_address`** : deux
  collectes d'adresse IP visibles en base, qu'aucune ligne du tableau ne couvre
  explicitement au-delà d'un « intérêt légitime — sécurité du site » ;
- **durées** : le tableau annonce des durées que rien n'outille (inactivité 3 ans,
  logs 12 mois). Soit vous les outillez, soit vous les corrigez. Annoncer une
  durée qu'on n'applique pas est en soi un manquement.

### Ce que nous demandons au site

1. **Confirmez la propriété des deux fonctions edge inconnues de notre dépôt** —
   `capture-membre-fondateur` (version 7) et `yousign-webhook` (version 6), toutes
   deux `verify_jwt: false`, actives en production. Si elles sont à vous,
   partagez leur source. Si elles ne le sont pas, dites-le vite.
2. **Confirmez que Yousign est bien un sous-traitant OXV**, fournissez le DPA
   correspondant, et **ajoutez-le à la table des sous-traitants** de la politique
   de confidentialité. Nous répercuterons dans l'app.
3. **Tranchez le sort des cinq tables `_backup_*_20260719`.** Elles portent 51
   lignes de données, dont 44 avec des coordonnées de clients privés, hors de
   tout dispositif de purge. Nous ne les supprimerons pas sans votre accord écrit.
   Dites `DROP`, ou dites pourquoi les garder et sous quelle durée.
4. **Dites qui alimente `users.last_login_at`.** Elle est vide sur les 14 comptes.
   Tant qu'elle l'est, la règle « inactivité 3 ans » est décorative. Si c'est le
   site, corrigez ; si personne ne le fait, retirez la règle de la politique.
5. **Tranchez la contradiction KYC** : cinq ans de conservation, ou suppression à
   J+30 lors d'un effacement de compte. Les deux textes existent, un seul peut
   survivre. Nous appliquerons votre arbitrage dans `purge_user_data`.
6. **Fournissez les mentions légales réelles** : SIRET, siège social, RCS, capital,
   date d'entrée en vigueur des CGU, et l'identité du DPO s'il en existe un. Nos
   documents embarqués portent encore des marqueurs à compléter.
7. **Prenez position sur Plausible.** L'application émet ses événements sur la
   propriété `oxvehicle.fr`. Confirmez que votre déclaration de mesure d'audience
   et votre bandeau de consentement couvrent aussi le trafic applicatif, ou
   demandez-nous un domaine distinct.
8. **Décidez de la base légale du débrief IA** (transfert OpenAI, opt-out, actif
   sur 13 comptes sur 14) et écrivez-la. Nous alignerons le comportement de l'app
   sur votre qualification, y compris en passant à l'opt-in si c'est le
   consentement qui est retenu.
9. **Décrivez votre procédure d'effacement pour les objets hors base** : e-mails
   déjà partis via Resend, demandes de signature Yousign, éventuels exports ou
   CRM. La purge s'arrête à la base et au Storage ; le reste vous revient.
10. **Confirmez la politique de sauvegarde Supabase** (fréquence, rétention des
    instantanés, PITR) afin que nous puissions l'écrire noir sur blanc dans la
    politique de confidentialité, comme l'exige la transparence sur les délais
    d'effacement effectifs.
11. **Identifiez la tâche planifiée `jobid 3`**, déplanifiée le 18 juillet 2026
    après 228 exécutions. Si elle était à vous et qu'elle portait une rétention,
    son retrait a peut-être arrêté une purge sans que personne ne le remarque.
12. **Confirmez le traitement de `founding_members` et `corporate_leads`.** Ces
    deux tables portent des adresses e-mail sans aucun lien vers un compte : une
    demande d'effacement exercée dans l'application ne peut pas les atteindre.
    Elles relèvent d'une procédure manuelle de votre côté.

---

## Fonction SCHÉMA — le contrat implicite et ses ruptures

Le site `oxvehicle.fr` et l'application OXV Mirror n'échangent aucune requête. Aucune API entre eux, aucun webhook, aucun contrat de service. Ils partagent un unique projet Supabase — `fouvuqkdxarjpjbqnsjq`, `eu-west-1`, PostgreSQL 17 — et c'est tout. La seule interface entre les deux produits est donc le schéma de cette base : ses tables, ses colonnes, ses policies, ses déclencheurs, ses migrations.

Ce schéma n'a jamais été écrit comme un contrat. Il a été écrit deux fois, en parallèle, par deux équipes qui ne relisaient pas le travail de l'autre. Cette section établit ce que l'application y fait réellement, en déduit ce que le site y fait, et nomme les endroits où l'absence de contrat coûte déjà quelque chose.

### Comment lire les affirmations de cette section

Trois niveaux de certitude, jamais mélangés. **Vérifié dans le code de l'app** : chemin de fichier et ligne du dépôt `oxv-app` — les seules affirmations dont nous répondons entièrement. **Vérifié en base** : requête SQL exécutée en lecture seule sur la production le 26 juillet 2026, résultat donné ; cela décrit l'état, pas l'intention. **Déduit, à confirmer par le site** : l'application ne touche pas l'objet, or l'objet porte des données ; quelqu'un d'autre y écrit, nous supposons que c'est vous, et nous ne pouvons pas le prouver.

Une précision qui vaut pour tout ce qui suit : `created_by` dans `supabase_migrations.schema_migrations` ne départage pas les deux côtés (188 migrations horodatées portent le même compte, 27 n'ont aucun auteur). L'origine d'un objet ne se lit qu'à son contenu et à son usage.

### Le périmètre mesuré

Relevé du 26 juillet 2026, schéma `public` : **114 tables**, **14 vues** (aucune matérialisée), **215 migrations appliquées**, **34 fonctions edge actives**, **8 tâches `cron.job` actives**, **13 buckets de stockage**.

Côté application, un balayage exhaustif des appels `.from('<table>')` dans `src/` et `app/` (fichiers `.ts` et `.tsx`, tests exclus) donne **78 relations référencées : 75 tables de base et 3 vues** (`coach_pilots_view`, `sessions_public`, `session_availability`). C'est la mesure qui fonde toute la répartition ci-dessous. Elle est exhaustive pour l'accès direct par PostgREST ; elle ne couvre pas les huit fonctions RPC appelées par l'app (`log_coach_view`, `get_shared_progression`, `founders_count`, `coach_ai_consent`, `oxv_redeem_referral`, `oxv_name_my_crew`, `oxv_my_crew_id`, `oxv_get_my_referral_code`), qui touchent des tables sans les nommer côté client.

**39 tables sur 114 ne sont jamais touchées par le code de l'application.** C'est le point de départ de la déduction. L'arithmétique de la répartition proposée boucle :

| Famille | Tables | Fondement |
|---|---|---|
| 1 — l'application seule | 58 | écriture vérifiée dans le code, aucun signe d'un autre écrivain |
| 2 — jamais touchées par l'application | 39 | absence vérifiée dans le code |
| 3 — les deux côtés écrivent | 7 | écriture vérifiée d'un côté, déduite de l'autre |
| 3 bis — lues par l'app, écrites ailleurs | 10 | lecture seule vérifiée dans le code |
| **Total** | **114** | |

### Famille 1 — Ce que seule l'application touche

Cinquante-huit tables portent le domaine propre de l'application : capture télémétrique, lecture de séance, coaching, social entre pilotes. Le site n'a aucune raison connue d'y écrire, et rien en base ne suggère qu'il le fasse.

**Capture et télémétrie** — `telemetry_sessions` (18 lignes), `telemetry_frames` (53), `laps` (1), `weather_snapshots` (0), `session_intentions` (0), `session_media` (0), `biometry_raw` (0), `video_overlays` (0), `media_exports` (0). Écriture vérifiée : `src/services/captureSyncQueue.ts:600-702` (file de synchronisation survivante hors ligne), `src/services/captureSessionService.ts:272` (création de séance), `src/services/weatherService.ts:214` (météo).

**Lecture et analyse** — `app_session_analyses` (13), `app_segment_analyses` (0), `app_progression_shares` (1), `data_quality_reports` (0). Écriture vérifiée : `src/services/analysesService.ts:122`, `src/services/segmentAnalysesService.ts:114`, `src/services/sharesService.ts:104`.

**Coaching** — `coach_profiles` (1), `coach_pilots` (1), `coach_annotations`, `coach_ai_drafts`, `coach_objectives`, `coach_availability` (4), `coach_messages` (1), `coach_invoices`, `coach_queue`, `coach_reading_weights`, `coach_roulages`, `coach_session_context`, `coach_testimonials`, `coaching_bookings` (2), `roulage_invitations`.

**Pilote, social, exploitation** — `pilot_goals`, `pilot_notes`, `pilot_friendships`, `pilot_development_cycles`, `cycle_steps`, `pilot_signature_snapshots`, `pilot_waiver_signatures`, `social_pings`, `convoys`, `convoy_participants`, `incident_reports`, `moderation_reports`, `moderation_report_reviews`, `ambassador_profiles`, `pro_team_members`, `scenic_routes` (1), `vehicle_setups`, `devices`, `device_assignments`, `device_health_logs`, `app_feature_flags` (7), `app_config` (1), `founder_applications`, `support_tickets`, `support_messages`, `b2b_event_reports`.

**Ce que cela implique pour le site.** Ces tables ne sont pas un terrain neutre. `telemetry_frames` et `laps` sont écrites par une file idempotente dont les clés naturelles sont contractuelles — `(session_id, elapsed_ms)` pour les trames, `(session_id, lap_number)` pour les tours (`src/services/captureSyncQueue.ts:600` et `:623`). Supprimer ou modifier ces index uniques ne casse pas une requête : cela crée des doublons silencieux à la prochaine reprise de synchronisation après coupure réseau. Une séance de 12 tours en afficherait 24.

### Famille 2 — Ce que seul le site touche

Trente-neuf tables ne sont jamais référencées par le code de l'application. Il faut les séparer en trois groupes, parce qu'ils appellent des réponses différentes.

**2a — Vivantes, alimentées par un autre côté que nous.**

Ces tables portent des données en production alors que l'application ne les touche pas. Quelqu'un y écrit. Déduit, à confirmer par le site.

| Table | Lignes | Ce que le schéma montre |
|---|---|---|
| `admin_audit` | 59 | Journal d'administration. Alimenté par le déclencheur `trg_audit_user_role_change` sur `users` (vérifié en base) et vraisemblablement par le site. |
| `resend_events` | 49 | Délivrabilité e-mail. Alimenté par la fonction edge `resend_webhook`. |
| `email_log` | 16 | Journal d'envoi. |
| `documents` | 9 | Pièces justificatives : `document_type`, `file_url`, `validity_start/end`, `status`, `validated_by`. Neuf objets correspondants dans le bucket `documents`. |
| `eligibility_items` | 9 | Éligibilité d'une inscription. Semé par `trg_seed_eligibility` sur `registrations`. |
| `demandes_inscription` | 4 | Demandes d'inscription. |
| `articles` | 6 | Éditorial. |
| `payments` | 1 | Cinq déclencheurs actifs : facture, e-mail de confirmation, parrainage, référence automatique, horodatage. |
| `contact_messages` | 1 | Formulaire de contact. |
| `founding_members` | 1 | Voir la rupture n° 2. |
| `app_settings` | 1 | Nom trompeur : l'application lit `app_config`, jamais `app_settings`. |
| `app_pairing_redeem_attempts` | 1 | Anti-force-brute de l'appairage, écrit par la fonction edge `pair-app`. |

**`documents` mérite une mention à part.** L'application ne la lit ni ne l'écrit — vérifié : aucune occurrence de `'documents'` dans `src/` ou `app/`. Or un déclencheur `trg_document_status_email` appelle la fonction edge `send-document-status` à chaque passage en `validated` ou `rejected`, et un second, `trg_docs_eligibility`, propage le statut vers `eligibility_items` (vérifié en base par `pg_get_functiondef`). C'est une chaîne entièrement côté serveur, entièrement invisible depuis notre dépôt. Si le site change une valeur de statut ou renomme l'énumération `document_status_enum`, la chaîne casse sans qu'aucun test de l'application ne s'en aperçoive.

**2a bis — Vides, mais sans ambiguïté de domaine.**

Huit tables sont à zéro ligne et relèvent manifestement du site : `invoices`, `invoice_counters`, `subscriptions`, `corporate_leads`, `session_feedback`, `media`, `pavillon_photos`, `ritual_dispatches`. L'application ne les touche pas et n'a pas de raison de le faire. `ritual_dispatches` est alimentée par la tâche `ritual_dispatcher_hourly` et le déclencheur `trg_registrations_schedule_rituals` : elle est vide parce que les rituels n'ont pas encore tourné, pas parce que le dispositif est absent.

**2b — Dormantes : ni l'application ni, semble-t-il, personne.**

Quatorze tables sont à zéro ligne et référencées nulle part dans le code de l'application, alors même que leur nom relève de notre domaine : `ai_safety_reviews`, `app_pairing_codes`, `coach_annotation_template`, `coach_corner_reference`, `coach_invoice_counters`, `coach_objective_events`, `coach_payout_details`, `coach_pilot_highlight`, `duels`, `notif_throttle_log`, `pilot_goal_events`, `pilot_sheets`, `ping_rsvps`, `email_templates`.

Deux d'entre elles ne sont pas vraiment dormantes : `app_pairing_codes` est écrite par le site (qui génère le code) et lue par la fonction edge `pair-app` — l'application ne la touche jamais directement, elle poste seulement le code à l'edge (`src/services/pairingService.ts:33`). `notif_throttle_log` est écrite par les déclencheurs de notification. Pour les douze autres, la question est ouverte : reste d'un chantier abandonné, ou table préparée pour un usage à venir côté site ? **Nous ne supprimerons rien. Nous demandons un arbitrage.**

**2c — Les cinq tables de sauvegarde.**

`_backup_payments_20260719`, `_backup_registrations_20260719`, `_backup_session_feedback_20260719`, `_backup_sessions_20260719` (44 lignes), `_backup_weather_20260719` (14 lignes). Vérifié en base : quatre d'entre elles n'ont **pas** la RLS activée. Ce n'est pas exploitable en l'état — `has_table_privilege('anon', ...)` renvoie `false` sur les cinq, donc PostgREST ne les expose pas. Mais elles copient de la donnée personnelle hors du dispositif de purge RGPD. Elles portent sur des tables du site ; c'est au site de dire si elles ont fait leur office. **Nous ne les supprimerons pas.**

### Famille 3 — Les tables que les deux côtés écrivent

Sept tables sont réellement partagées. C'est là que le contrat manquant coûte cher.

### `users` — 14 lignes, 72 colonnes

La table pivot. L'application y écrit beaucoup, mais **jamais n'importe quoi** : chaque écriture est un patch explicite sur une liste blanche.

| Colonne écrite par l'app | Où (vérifié) | Sens |
|---|---|---|
| `pilot_level` | `src/services/onboardingService.ts:29`, `src/services/offlineQueue.ts:195` | Niveau déclaré |
| `pact_accepted_at`, `pact_version` | `onboardingService.ts:83` | Pacte de pilotage |
| `cgu_accepted_at`, `cgu_version`, `privacy_accepted_at`, `privacy_version` | `onboardingService.ts:55` | Acceptations légales |
| `coach_pact_accepted_at`, `coach_pact_version` | `onboardingService.ts:112` | Pacte coach |
| `profile_completed_at` | `onboardingService.ts:141` | Fin de parcours |
| `ai_debrief_enabled`, `coach_ai_enabled` | `src/services/consentService.ts:74` et `:85` | Consentements IA |
| `biometry_capture_consent_at`, `biometry_coach_share_consent_at` | `consentService.ts:147` et `:171` | Biométrie, révocation en cascade |
| `expo_push_token`, `push_token_updated_at` | `src/services/pushNotificationsService.ts:115` | Jeton de notification |
| `push_notif_enabled`, `notif_offers`, `notification_preferences` | `src/features/vous/useReglages.ts:162/182/215` | Réglages |
| `bio`, `socials` | `src/lib/queries/profil.ts:329` | Profil public ; `socials` fusionné, jamais écrasé |
| `media` | `src/services/pilotMediaService.ts:225` et `:258` | Médias du pilote |
| `public_handle` | `src/lib/queries/profil.ts:355` | Pseudo public, contrainte UNIQUE |
| `pavilion_name_optin` | `src/lib/queries/profil.ts:258` | Affichage au pavillon |
| `show_attendance` | `src/features/rec/attendancePublicService.ts:67` | Visibilité de présence |
| `vehicle`, `experience_years`, `ffsa_license` | `src/services/pilotProfileService.ts:120-127` | Fiche pilote |
| `deletion_requested_at`, `deletion_scheduled_at` | `src/services/accountService.ts:37` | Droit à l'effacement |
| `role` | `src/services/coachAdminService.ts:250` et `:270` | Bascule pilote ↔ coach, espace admin |
| `is_admin`, `admin_notes`, `suspended_at`, `suspended_by`, `suspension_reason` | `src/services/adminUsersService.ts:120/143/152` | Espace admin de l'app |

**Colonnes que l'application ne touche jamais**, et qui relèvent donc de vous (déduit) : `email`, `first_name`, `last_name`, `birth_date`, `phone`, `address_*`, `emergency_contact_*`, `blood_type`, `medical_notes`, `stripe_customer_id`, `kyc_status`, `kyc_validated_at`, `kyc_validated_by`, `email_verified`, `two_factor_enabled`, `last_login_at`, `accepts_marketing`, `notif_newsletter`, `affiliation_code`, `car_number`, `livery`, `community_visibility`, `preferred_language`, `ritual_jminus7/2/1_enabled`. Vérifié en base : `stripe_customer_id`, `last_login_at` et `expo_push_token` sont nuls sur les 14 lignes. Ces colonnes existent mais personne ne les remplit encore.

**Le garde-fou existant.** Un déclencheur `BEFORE UPDATE`, `trg_guard_users_privileged_columns`, interdit toute modification de `role` ou `kyc_status` à quiconque n'est ni `service_role`, ni `postgres`, ni `supabase_admin`, ni administrateur au sens de `public.is_admin()` (vérifié en base). C'est le seul morceau de contrat réellement écrit dans le schéma. Il est bon. Il devrait servir de modèle.

**Le piège non résolu.** `users.role` et `users.is_admin` sont deux systèmes de droits distincts. L'application ouvre son espace administrateur sur `is_admin`, pas sur `role`. Vérifié en base : les deux comptes `role = 'admin'` ont `is_admin = false`, et le seul compte `is_admin = true` a `role = 'pilot'`. Si le site attribue des rôles, il faut savoir lequel des deux champs fait autorité, et pour qui. **Cette question n'est pas tranchée.**

### `circuits` — 4 lignes

Écrite des deux côtés, et la plus dangereuse des sept, parce que la casse y est silencieuse.

L'application **insère** les tracés créés par le pilote (`src/services/userCircuitsService.ts:116`), avec `user_id`, `name`, `is_official: false`, `is_default: false`, `review_status`, `track_svg_path`, `turns_count`, `length_km`, `bbox_min/max_lat/lon`, `finish_line_lat`, `finish_line_lon`, `finish_line_radius_m`, `finish_line_heading` (`userCircuitsService.ts:85-101`). Elle **lit** en permanence les quatre colonnes `finish_line_*` : ce sont elles qui alimentent la détection de tours en piste (`src/services/captureSessionService.ts:81-96`). La fonction edge `detect-circuit-corners` écrit `corners`, `corners_engine_version`, `corners_computed_at`, `centerline_latlon`.

| Circuit | Officiel | Cap ligne d'arrivée | Virages | Centerline | `user_id` |
|---|---|---|---|---|---|
| Haute Saintonge | oui, par défaut | 298,50° | oui | oui | nul |
| Charente | oui | 53,40° | non | oui | nul |
| Circuit Ricardo Tormo | oui | 55,20° | non | oui | nul |
| La charade | non (pilote) | absent | non | non | renseigné |

Les trois circuits officiels n'ont pas été créés par un pilote : ils viennent d'un import, côté site ou par SQL direct (déduit). **Une modification de `finish_line_*` sur un circuit officiel ne produit aucune erreur : elle produit des séances à zéro tour.** C'est le type même de dégât qu'un contrat écrit aurait évité.

### `registrations` — 1 ligne

Propriété du site : l'inscription commerciale d'un pilote à une journée (`user_id`, `session_id`, `offer_type`, `status`, `price_total`, `price_deposit`, `deposit_paid_at`, `balance_paid_at`, `insurance_option`, `slot_choice`, `cancelled_*`, `refund_amount`).

L'application la **lit** en onze endroits (prochain roulage, galerie, club, présence) et n'y écrit **qu'une seule colonne** : `attended_at`, par `src/services/attendanceService.ts:117`. Le commentaire du code le dit lui-même : « horodatage `attended_at` du site ».

Trois déclencheurs `AFTER` sont actifs (vérifié en base) : `trg_registration_emails`, `trg_registrations_schedule_rituals`, `trg_seed_eligibility`. Une insertion depuis l'application déclencherait donc des e-mails et des rituels du site. **L'application ne fait jamais d'insertion dans `registrations` et ne devrait jamais commencer sans accord explicite.**

### `sessions` — 1 ligne

La journée au calendrier. Lecture seule côté application, en cinq endroits (`src/features/club/useClubHub.ts:151`, `src/services/attendanceService.ts:50`, `src/services/nextTrackDayService.ts:51`, `src/features/rec/attendancePublicService.ts:94`, plus la vue `sessions_public`). La RLS le confirme : `sessions_insert_admin_only`, `sessions_update_admin_only`, `sessions_delete_admin_only`, lecture ouverte aux authentifiés hors journées privées. Voir la rupture n° 1.

### `events` et `event_registrations` — 1 et 0 lignes

Ambiguës. L'application **écrit** `events` (`src/services/eventsService.ts:172` en insertion, `:225` en mise à jour) et `event_registrations` (`:377`, `:288`) depuis son espace administrateur. Mais l'unique ligne d'`events` en production a `created_by` nul — elle n'a donc pas été créée par l'espace admin de l'application, qui renseigne toujours ce champ. Elle vient d'ailleurs : du site, ou d'un insert SQL direct (déduit).

Deux systèmes de « journée » coexistent donc : `sessions` + `registrations` d'un côté, `events` + `event_registrations` de l'autre. **Lequel fait foi ? La question doit être tranchée avant que l'un des deux côtés ne construise davantage dessus.**

### `vehicles` — 6 lignes

L'application insère (`src/services/garageService.ts:106`) et lit. Le site lit au moins, puisque `registrations.vehicle_id` référence cette table. Écriture côté site : déduit, non établi.

### Famille 3 bis — Lues par l'application, écrites par quelqu'un d'autre

Dix tables sont lues par l'application et **jamais écrites par elle** — vérifié par absence de tout `.insert`, `.upsert`, `.update` ou `.delete` dans `src/` et `app/`. Ce sont des dépendances de lecture pures : leur contenu vient d'ailleurs, et l'application en dépend pour afficher.

| Table | Lignes | Lue par | Écrite par |
|---|---|---|---|
| `pricing` | 9 | `src/services/bookingCatalogService.ts:143` | le site (déduit) |
| `heritage_packs` | 0 | `src/features/miroir/useMiroirHome.ts:218` | le site (déduit) |
| `partners` | 0 | `src/services/placesService.ts:52` | le site (déduit) |
| `restaurants` | 0 | `src/services/placesService.ts:60` | le site (déduit) |
| `lodgings` | 0 | `src/services/placesService.ts:56` | le site (déduit) |
| `circuit_services` | 0 | `src/services/ecosystemService.ts:114` | le site (déduit) |
| `crews` | 1 | `src/services/v2/referralService.ts:91` | RPC `oxv_name_my_crew` (vérifié en base) |
| `crew_members` | 1 | `src/services/v2/referralService.ts:99` | RPC `oxv_redeem_referral` **et déclencheur `trg_referral_validate` sur `payments`** (vérifié en base) |
| `coach_permissions` | 1 | `src/services/coachPermissionsService.ts:43` | déclencheur `users_ensure_coach_permissions` (vérifié en base) |
| `session_insights` | 1 | `src/services/sessionInsightsService.ts:23` | edge `compute-session-insights` (vérifié) |

Les six premières sont une **dépendance du site vers l'application** que personne n'a formalisée : si le site vide `pricing` ou renomme une de ses colonnes, le catalogue de réservation de l'application se vide sans erreur. Vérifié en base : `pricing` porte 9 lignes, les cinq autres sont vides — les écrans correspondants de l'application affichent donc aujourd'hui du vide. **Est-ce voulu ?**

Le cas `crew_members` illustre le problème d'ensemble : un paiement enregistré par le site valide un parrainage et modifie une table que l'application affiche, sans qu'aucune ligne de code de part et d'autre ne le dise.

### Ce que la RLS impose déjà aux deux côtés

Vérifié en base sur les 114 tables : **109 ont la RLS activée**. Les cinq exceptions sont les tables de sauvegarde du 19 juillet, exposées à aucun rôle client.

Quatre tables ont la RLS activée mais **zéro policy** : `founding_members`, `invoice_counters`, `app_pairing_redeem_attempts`, `_backup_sessions_20260719`. C'est un verrouillage total pour `anon` et `authenticated` — seul `service_role` y accède. Pour `founding_members`, c'est délibéré et correct : la table n'est écrite que par des fonctions edge en `service_role`.

**Les 14 vues sont toutes en `security_invoker`** (vérifié : `pg_class.reloptions`). Aucune ne contourne la RLS de ses tables sources. C'est un point fort du dispositif actuel et une propriété à préserver : une vue créée sans `security_invoker` s'exécuterait avec les droits de son propriétaire et ouvrirait un trou silencieux.

Les prédicats des tables partagées sont homogènes et lisibles : `(user_id = auth.uid()) OR is_admin()` pour l'écriture propre, `is_coach_of()` et `are_friends()` pour les lectures élargies. Toute nouvelle policy sur une table partagée doit s'aligner sur ce vocabulaire plutôt qu'en inventer un.

### Rupture n° 1 — `sessions` contre `telemetry_sessions`

Il existe deux objets appelés « séance », sans aucun lien entre eux. `sessions` est la journée au calendrier : une date, des horaires, des capacités par offre, un circuit ; on s'y inscrit via `registrations` ; elle est écrite par le site. `telemetry_sessions` est une capture : un pilote, un boîtier, un horodatage de début et de fin, des trames ; elle est écrite par l'application.

**Aucune colonne ne relie les deux.** Vérifié en base : les clés étrangères de `telemetry_sessions` sont `user_id → users`, `circuit_id → circuits`, `vehicle_id → vehicles`, `source_device_id → devices` et `event_id → events`. Il n'y a pas de `session_id`. Et `event_id`, qui pointe vers l'autre système de journée, **est nul sur les 18 lignes** :

```sql
select count(*) n, count(event_id) n_event_id from telemetry_sessions;
-- n = 18, n_event_id = 0
```

Le seul rapprochement existant en production se fait **par la date**. La fonction `pavillon_pilotes_jour_rows()`, qui alimente la vue du pavillon, joint ainsi (vérifié en base) :

```sql
from telemetry_sessions ts
join users u on u.id = ts.user_id
where ts.started_at::date = current_date
```

Une égalité de date. Rien d'autre.

### Rupture n° 1 — ce que l'absence de lien empêche

1. **Personne ne peut dire qui a réellement roulé lors d'une journée donnée à partir de la télémétrie.** La présence se lit uniquement dans `registrations.attended_at`, colonne pointée à la main (`src/services/attendanceService.ts:117`), nulle sur l'unique inscription en base. Une journée peut afficher zéro présent alors que des captures existent le même jour.
2. **Le site ne peut pas montrer à un pilote la trace de la journée qu'il a achetée.** Il connaît l'inscription, pas la capture.
3. **La météo de la journée n'est pas attachable au calendrier.** `weather_snapshots.session_id` pointe vers `telemetry_sessions`, pas vers `sessions` (vérifié en base). La météo est une propriété de la capture, pas du roulage.
4. **Aucun bilan par événement n'est possible côté télémétrie.** `b2b_event_reports` s'appuie sur `event_registrations`, un troisième système encore, vide en production.
5. **Le rapprochement par date est faux dès qu'il y a deux journées le même jour, une capture à cheval sur minuit, ou un pilote qui roule hors événement.** Vérifié en base : les 18 captures se répartissent sur sept dates distinctes (8 le 16 mai, 2 le 17 mai, puis 1 à 4 par jour), dont aucune ne correspond à la seule ligne de `sessions` (24 décembre 2026) ni à la seule ligne d'`events` (5 juillet 2026). **Aujourd'hui, le rapprochement par date ne rapproche rien.**

### Rupture n° 1 — forme de lien proposée, rien n'est appliqué

Nous proposons **une colonne, nullable, jamais devinée** :

```sql
-- PROPOSITION — NON APPLIQUÉE
alter table public.telemetry_sessions
  add column registration_id uuid
  references public.registrations(id) on delete set null;

create index on public.telemetry_sessions (registration_id);
```

Pourquoi `registrations` et non `sessions` : une inscription porte déjà le couple `(user_id, session_id)`. Rattacher la capture à l'inscription donne à la fois le pilote, la journée, l'offre achetée et le créneau (`slot_choice`), sans rien dupliquer. Rattacher à `sessions` donnerait la journée seule et laisserait le rapprochement pilote à refaire.

Trois règles d'usage vont avec, et comptent autant que la colonne. **Un** : nullable, et le restant — une capture hors événement est légitime (essai privé, autre circuit, séance de test), la colonne nulle est un état normal, pas une anomalie à corriger. **Deux** : remplie au démarrage de la capture, par l'application, et seulement s'il n'y a aucune ambiguïté — c'est-à-dire s'il existe exactement une inscription du pilote dont la journée couvre l'instant de départ ; deux candidates, on laisse nul ; zéro candidate, on laisse nul. **Trois** : aucun remplissage rétroactif automatique — les 18 lignes existantes restent nulles, un rattachement historique se fait à la main et sous responsabilité humaine.

Ce que nous ne proposons pas : réutiliser `event_id`. Tant que le doublon `sessions`/`events` n'est pas arbitré, écrire dans `event_id` reviendrait à figer le mauvais système.

### Rupture n° 2 — Deux fonctions edge actives sans propriétaire identifié

Trente-quatre fonctions edge sont déployées et actives. Le dépôt de l'application en contient trente-deux sous `supabase/functions/`. **Deux existent en production et dans aucun dépôt accessible depuis ici :**

| Fonction | Version | `verify_jwt` | Déployée et mise à jour |
|---|---|---|---|
| `capture-membre-fondateur` | 7 | `false` | 21 juillet 2026 |
| `yousign-webhook` | 6 | `false` | 21 juillet 2026 |

Vérifié via l'API de gestion Supabase (`list_edge_functions`), recoupé avec `ls supabase/functions` dans le dépôt `oxv-app`. Leur source a pu être relue en production : elle est cohérente, commentée en français, manifestement écrite avec soin. Ce n'est pas la qualité du code qui pose problème — c'est qu'il ne vive dans aucun dépôt.

**Ce qu'elles font.** `capture-membre-fondateur` accepte un POST public, insère dans `founding_members` (`prenom`, `nom`, `email`, `fonction_pro`, `vehicule`, `session_pref`, `consent_rgpd`), envoie un accusé de réception par Resend, puis télécharge une lettre d'intention depuis le bucket `documents` et ouvre une demande de signature Yousign. `yousign-webhook` reçoit l'événement `signature_request.done`, bascule la ligne en `statut = 'signe'` et envoie l'e-mail de bienvenue, de façon idempotente.

### Rupture n° 2 — la nuance sur « sans vérification de jeton »

`verify_jwt: false` est **normal** pour ces deux points d'entrée : un formulaire public et un webhook tiers n'envoient pas de JWT Supabase. La question n'est pas là. Elle est de savoir ce qui remplace le JWT.

- `yousign-webhook` **vérifie une signature HMAC-SHA256** sur le corps brut, avec comparaison à temps constant, contre le secret `YOUSIGN_WEBHOOK_SECRET`. La conception est correcte. **Mais si le secret n'est pas défini, la vérification ne lève pas d'erreur : elle compare contre une signature calculée avec une clé littérale prévisible.** Le garde-fou devient un décor.
- `capture-membre-fondateur` **ne vérifie un jeton de formulaire que s'il est défini** : le code lit `OXV_FORM_TOKEN` et n'applique le contrôle que si la variable est non vide. Secret absent, l'endpoint est ouvert à quiconque connaît son URL — avec pour effet d'insérer dans `founding_members`, d'envoyer un e-mail depuis `contact@oxvehicle.fr` et de déclencher une procédure de signature électronique facturée.

Les deux utilisent `SUPABASE_SERVICE_ROLE_KEY` et contournent donc toute la RLS. Nous ne pouvons pas lire les secrets déployés : **nous ne pouvons donc pas dire si ces garde-fous sont actifs ou inertes. Le site le peut, et doit le dire.**

**Pourquoi cela nous concerne.** `yousign-webhook` touche la signature électronique. Or l'application gère les décharges de responsabilité des pilotes (`pilot_waiver_signatures`, `pilot_signature_snapshots`) et dépend de la chaîne d'éligibilité issue de `documents`. Si le dispositif de signature du site devait un jour être étendu aux décharges, il écrirait dans un domaine qui est aujourd'hui le nôtre. Cette frontière doit être posée avant, pas après.

### Rupture n° 3 — La divergence des migrations, réconciliée côté application

Au 26 juillet 2026 : **215 migrations appliquées** en production, **121 fichiers seulement** dans le dépôt de l'application, **94 absents de tout dépôt consultable depuis ici**. Près de la moitié de l'histoire de la base ne survivait que dans la base elle-même, dans la colonne `statements` de `supabase_migrations.schema_migrations`.

Deux causes distinctes. Les migrations appliquées depuis le site, qui vivent dans l'autre dépôt — normal, il fallait seulement que nous sachions qu'elles existent. Et les migrations appliquées directement sur la base sans qu'aucun fichier ne soit écrit : l'outillage le permet, la base enregistre, aucun dépôt n'en garde trace. Cette seconde cause nous concerne autant que vous.

Le SQL réellement exécuté a été extrait de `statements` et les 94 fichiers manquants réécrits dans `supabase/migrations/`, chacun **sous le numéro de version exact enregistré en base**. Par ailleurs, 57 fichiers déjà présents portaient un horodatage différent de celui sous lequel ils avaient été appliqués ; ils ont été renommés sur la version réelle. Vérifié : `supabase/migrations/` contient désormais **215 fichiers `.sql`**, un par migration appliquée. Un futur `supabase db push` les reconnaîtra comme déjà appliquées au lieu de vouloir les rejouer.

**Ce que cela ne vaut pas.** Les fichiers reconstitués sont fidèles sur le fond — c'est le SQL qui a tourné — mais la mise en forme d'origine et les commentaires hors instruction sont perdus. Ce sont des témoins, pas les originaux. Et rien ne garantit que le site n'ait pas appliqué quelque chose depuis le relevé.

Le registre de vérité est `supabase/migrations/APPLIQUEES_EN_PRODUCTION.txt` (format `version|nom`, 215 lignes), régénérable en une requête :

```sql
select string_agg(version || '|' || coalesce(name,'(sans nom)'), E'\n' order by version)
from supabase_migrations.schema_migrations;
```

Enfin, quatre fichiers du dépôt de l'application n'avaient aucune migration appliquée à leur nom. Ils ont été sortis vers `supabase/migrations_hors_historique/`. Trois dégraderaient la production s'ils étaient rejoués — dont un qui écraserait la fonction de purge RGPD. **Personne ne doit les appliquer.**

### Autres frictions, moindres mais réelles

**Le calcul de tour est écrit deux fois.** Le déclencheur `on_lap_inserted → update_session_best_lap` recalcule `best_lap_seconds`, `best_lap_number`, `avg_lap_seconds` et `lap_count` sur `telemetry_sessions` à chaque insertion de tour (vérifié en base). Or l'application écrit elle aussi `lap_count` et `best_lap_seconds` à la clôture de séance (`src/services/captureSessionService.ts:789-798`). Les deux sources convergent aujourd'hui parce qu'elles calculent la même chose ; rien ne le garantit demain. Qui fait autorité doit être décidé.

**`telemetry_sessions.distance_km` est lue mais jamais écrite par l'application.** Vérifié : aucune écriture dans `src/`, huit lectures (dont `src/services/bilanPdfExportService.ts:86` et `src/services/statsService.ts:57`). Vérifié en base : 9 lignes sur 18 la portent. Quelque chose la remplit — vraisemblablement la fonction edge `compute-session-insights`, ou du code V1 retiré depuis. **Un champ affiché dans le bilan d'un pilote dont personne ne sait qui l'écrit est un problème de fiabilité, pas de style.**

**Six colonnes de `telemetry_sessions` sont vides sur les 18 lignes** : `weather`, `name`, `custom_name`, `vehicle_label`, `avg_lap_seconds`, `best_lap_number`. Trois ont un écrivain identifié — `custom_name` par l'application (`src/services/sessionsService.ts:361`), `avg_lap_seconds` et `best_lap_number` par le déclencheur `update_session_best_lap` — et sont vides parce que l'usage n'a pas encore eu lieu. Les trois autres n'ont **aucun écrivain connu**. `weather` est le cas gênant : les vues `day_rollups` et `history_rollups` classent la météo par motif textuel sur cette colonne (`ts.weather ~~* '%pluie%'`, vérifié via `pg_get_viewdef`). Ces vues retournent donc une catégorisation météo systématiquement vide, alors que `weather_snapshots` porte l'information réelle.

**Dix vues sur quatorze ne sont utilisées par aucun code de l'application** : `day_rollups`, `history_rollups`, `qdi_public`, `crews_public`, `plateau_members_public`, `pavillon_meteo`, `pavillon_pilotes_jour`, `stats_dashboard`, `registration_eligibility`, `admin_ritual_dispatches_view` n'apparaissent que dans `src/types/database.types.ts` (types générés) et dans la documentation. Si le site les consomme, elles sont un contrat de fait et ne doivent pas être modifiées sans préavis. Si personne ne les consomme, il faut le dire.

**Huit tâches `cron.job` sont actives** et écrivent dans la base sans passer par aucun des deux dépôts clients : `analyze-pending-sessions` (horaire), `compute-insights-hourly` (horaire), `cleanup-telemetry-frames` (03h30), `oxv-eligibility-reminders` (06h00), `oxv-feedback-requests` (07h00), `purge-deleted-accounts-daily` (02h30), `ritual_dispatcher_hourly` (16h–19h), `biometry-retention-daily` (03h15). Trois relèvent du domaine du site. **Toute modification d'une de ces tâches change le comportement du produit de l'autre équipe.**

### Les règles d'engagement que nous proposons d'adopter

Sept règles. Elles ne coûtent rien à appliquer et auraient évité chacune des ruptures décrites ci-dessus.

**1. Aucun DDL sans fichier.** Toute modification de schéma passe par un fichier de migration versionné dans le dépôt qui la porte. Pas d'exception « juste une colonne », pas d'exception « c'est urgent ». C'est la règle qui, seule, aurait évité les 94 disparitions.

**2. Préfixer les migrations par leur origine** — `site_` ou `app_` dans le nom du fichier. Cela vaut mieux que de deviner au contenu six mois plus tard, puisque `created_by` ne distingue rien.

**3. Jamais de `supabase db reset`, jamais de `db push --force` sur ce projet.** Aucun des deux dépôts ne contient à lui seul de quoi reconstruire la base.

**4. Préavis obligatoire sur les sept tables partagées** — `users`, `sessions`, `registrations`, `circuits`, `events`, `event_registrations`, `vehicles` — et sur leurs policies. Un message avant, pas un constat après. Le préavis vaut aussi pour toute suppression de colonne, tout changement d'énumération et tout renommage, y compris sur les dix tables de la famille 3 bis.

**5. Trois objets sont intouchables sans accord écrit des deux côtés,** parce qu'ils cassent en silence : les colonnes `circuits.finish_line_*` (détection de tours), les index uniques `telemetry_frames(session_id, elapsed_ms)` et `laps(session_id, lap_number)` (idempotence de la synchronisation hors ligne), et le déclencheur `trg_guard_users_privileged_columns` (droits).

**6. Toute nouvelle vue est créée en `security_invoker`.** Les quatorze vues actuelles le sont. Une seule exception ouvrirait un contournement de RLS invisible.

**7. Toute fonction edge déployée existe dans un dépôt,** et son mode d'authentification est documenté : soit `verify_jwt: true`, soit un contrôle interne dont le secret est **obligatoire** et non conditionnel. Un garde-fou qui ne s'active que si une variable d'environnement est définie n'est pas un garde-fou.

Nous proposons aussi une pratique, plus légère qu'une règle : **régénérer `APPLIQUEES_EN_PRODUCTION.txt` après chaque campagne de migrations**, des deux côtés, et considérer ce fichier comme la réponse en cas de doute. Pas un dépôt, pas une mémoire.

### Ce que nous demandons au site

1. **Confirmez ou corrigez la répartition en familles.** Nous avons prouvé ce que l'application touche (78 relations, code à l'appui) ; nous avons déduit le reste. Dites-nous quelles tables de la famille 2a sont bien les vôtres, et si vous écrivez dans des tables que nous avons classées en famille 1.
2. **Tranchez `users.role` contre `users.is_admin`.** Lequel fait autorité, pour qui, selon quelle règle ? En production, les deux comptes `role = 'admin'` ont `is_admin = false` et n'atteignent donc pas l'espace administrateur de l'application. Cet écart doit être voulu ou corrigé, pas subi.
3. **Tranchez `sessions` + `registrations` contre `events` + `event_registrations`.** Deux systèmes de journée coexistent. Lequel est le système vivant ? L'autre doit-il être retiré, ou a-t-il un usage que nous ignorons ? L'unique ligne d'`events` a `created_by` nul : d'où vient-elle ?
4. **Validez ou amendez la forme du lien capture ↔ journée** (`telemetry_sessions.registration_id`, nullable, jamais devinée, sans remplissage rétroactif). Si vous connaissez déjà une règle de correspondance utilisée côté site, elle prime sur notre proposition.
5. **Confirmez que `capture-membre-fondateur` et `yousign-webhook` sont à vous, et versionnez leur source dans votre dépôt.** Si elles ne sont pas à vous, il faut le savoir vite : deux points d'entrée non authentifiés opérant en `service_role`, sans propriétaire identifié, ne sont pas acceptables en production.
6. **Confirmez que `OXV_FORM_TOKEN` et `YOUSIGN_WEBHOOK_SECRET` sont définis dans l'environnement Supabase.** Sans eux, les garde-fous internes de ces deux fonctions sont inertes. Nous ne pouvons pas le vérifier.
7. **Identifiez vos migrations parmi les 215.** Comparez `APPLIQUEES_EN_PRODUCTION.txt` à votre dossier. C'est ce qui transformera la répartition proposée en répartition établie.
8. **Dites qui écrit `telemetry_sessions.distance_km`.** L'application l'affiche dans le bilan du pilote et ne l'écrit jamais ; 9 lignes sur 18 la portent.
9. **Confirmez que vous alimentez bien les six tables de la famille 3 bis** (`pricing`, `heritage_packs`, `partners`, `restaurants`, `lodgings`, `circuit_services`), et dites-nous si les cinq qui sont vides doivent le rester. L'application affiche ce qu'elles contiennent, sans filet.
10. **Arbitrez les douze tables dormantes** de la famille 2b (`duels`, `pilot_sheets`, `ping_rsvps`, `coach_corner_reference`, `coach_annotation_template`, `coach_invoice_counters`, `coach_objective_events`, `coach_payout_details`, `coach_pilot_highlight`, `pilot_goal_events`, `ai_safety_reviews`, `email_templates`) : chantier abandonné à supprimer, ou usage à venir à conserver ?
11. **Décidez du sort des cinq tables `_backup_*_20260719`.** Elles portent sur des tables du site et copient de la donnée personnelle hors du dispositif de purge RGPD. **Nous ne les supprimerons pas : elles ne sont pas à nous.**
12. **Dites lesquelles des dix vues non consommées par l'application le sont par le site.** Celles-là deviennent un contrat et ne bougeront plus sans préavis ; les autres peuvent être retirées.
13. **Acceptez ou amendez les sept règles d'engagement.** Une règle que les deux côtés n'ont pas acceptée explicitement n'existe pas.
