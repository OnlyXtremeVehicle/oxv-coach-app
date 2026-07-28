# État complet de l'application OXV Mirror

**26 juillet 2026** · branche `feat/site-document-emails` · dernier commit `f8ed177`

Ce document a été écrit en lisant le dépôt fichier par fichier et en interrogeant
la base de production en lecture seule. Huit enquêtes parallèles, une par
dimension, puis assemblage. Chaque affirmation renvoie à un chemin précis. Ce qui
n'a pas pu être vérifié est dit comme tel — la dernière section liste
honnêtement tous les angles morts.

Il est long parce que vous avez demandé à tout savoir. Cette ouverture suffit si
vous ne lisez qu'une page.

---

## À traiter en priorité

> **FERMÉE LE 28/07/2026 — cette fois en armant le déclencheur, et voici comment le vérifier.**
>
> Migration `20260728161300_sec3_garde_is_admin_et_l8_role_autorite.sql`,
> appliquée sur accord explicite du fondateur. Le déclencheur est recréé **sans
> clause `OF`** : plus aucune colonne privilégiée ne pourra lui échapper par
> omission. Et `is_admin()` ne consulte plus la colonne du tout — elle est
> annotée INERTE.
>
> **Le contrôle qui compte reste à faire sur appareil** : depuis une session
> pilote réelle, `update public.users set is_admin = true where id = auth.uid()`
> doit échouer avec 42501. La console SQL tourne en `postgres` et serait
> exemptée — elle ne prouverait rien. C'est exactement le contrôle que SEC-2
> avait omis.
>
> Le récit de l'erreur est conservé ci-dessous : il dit pourquoi il ne faut pas
> conclure d'une migration appliquée qu'elle est effective.
>
> ---
>
> **CE QUI S'ÉTAIT PASSÉ — rectification du 28/07/2026.**
>
> Cet encadré affirmait, depuis le 27/07, que l'élévation de privilège était
> fermée. **C'était faux, et je l'avais écrit.**
>
> Le raisonnement d'alors : la migration `20260726152049_sec2_guard_is_admin.sql`
> figure dans les migrations appliquées, donc le correctif est en place. La
> migration a bien été appliquée. **Elle ne fait pas ce qu'elle annonce.**
>
> Elle exécute `create or replace function guard_users_privileged_columns()`,
> qui met à jour le CORPS de la garde — celui-ci couvre bien `is_admin`. Mais le
> DÉCLENCHEUR n'a jamais été recréé. Il date du 20/06 et se lit toujours :
>
>     BEFORE UPDATE OF role, kyc_status ON public.users
>
> `is_admin` n'y figure pas. En PostgreSQL, `UPDATE OF <liste>` ne déclenche que
> si une colonne de la liste figure au `SET`. Un ordre qui ne touche que
> `is_admin` passe donc à côté de la garde. **Le correctif est inerte depuis le
> jour de sa pose.**
>
> Le protocole de vérification de SEC-2 prévoyait deux contrôles. Le premier —
> « la définition de la fonction contient-elle `is_admin is distinct from` » —
> passe, et ne prouve rien sur le déclencheur. Le second — tenter réellement
> l'écriture depuis une session pilote — l'aurait attrapé. **C'est celui qui n'a
> pas été fait.**
>
> **Ce dépôt est PUBLIC et la RLS est la seule barrière.** Le passage ci-dessous
> est donc rétabli tel qu'il était : il décrit un risque réel.
>
> **Ce qui atténue, factuellement.** Le déclencheur d'audit posé par la même
> migration, lui, est correctement armé (`after update on public.users`, sans
> liste de colonnes). `admin_audit` ne contient **aucune** ligne
> `user_is_admin_change` depuis le 26/07. Et en base, un seul compte porte
> `is_admin = true` — `administration@oxvehicle.fr`, depuis le 17/06, ce qui est
> légitime. Rien n'indique une exploitation. Sur la période antérieure au 26/07,
> aucun audit n'existait : rien ne peut en être dit.
>
> Correctif proposé, non appliqué :
> `supabase/migrations/PROPOSITION_SEC3_garde_is_admin_inerte.sql`.

**Une élévation de privilège est ouverte en production.** N'importe quel compte
authentifié pouvait exécuter `update public.users set is_admin = true where id =
auth.uid()` et devenir administrateur au sens de la base — ce qui ouvrait toutes
les policies gardées par `is_admin()`. Trois faits se combinaient : le privilège
UPDATE sur la colonne était accordé à `authenticated`, la policy
`users_update_own_or_admin` autorisait l'écriture de sa propre ligne, et le
déclencheur `guard_users_privileged_columns` ne protégeait que `role` et
`kyc_status` — `is_admin` n'y figurait pas. Aucun audit ne l'aurait tracé : le
déclencheur d'audit n'observait que `role`.

Vérifié le 26 juillet 2026 par lecture directe du corps du déclencheur et des
privilèges de colonne. Un seul compte porte aujourd'hui le drapeau :
`administration@oxvehicle.fr`, le vôtre.

Le correctif **a été appliqué le 26/07/2026** :
`supabase/migrations/20260726152049_sec2_guard_is_admin.sql`. Il étend la garde
existante à `is_admin` et ajoute la trace d'audit manquante. Purement
restrictif, réversible.

---

## Les huit faits à retenir avant tout le reste

**1. Aucune séance de piste réelle n'a jamais été enregistrée.** La production
compte 18 séances de télémétrie : des essais à pied de mai — vitesse maximale
entre 0,30 et 8,49 km/h, zéro tour — et huit séances abandonnées à zéro trame.
Au total 53 trames, toutes issues d'une seule séance abandonnée du 28 juin à
0,83 km/h. Un seul tour existe en base, de 0,022 seconde. Zéro boîtier en flotte,
zéro donnée cardiaque. Tout ce que l'application sait faire de la donnée réelle
attend donc encore sa première séance.

**2. Le calcul des lectures échoue en silence depuis le 13 juin.** La tâche
planifiée `compute-insights-hourly` envoie un en-tête `X-Cron-Token` sans
`Authorization` vers une fonction edge déployée en `verify_jwt: true` : elle
reçoit un 401 toutes les demi-heures. Le tableau de bord affiche pourtant plus de
mille exécutions « réussies », parce qu'il ne rapporte que la mise en file, jamais
la réponse. C'est la raison pour laquelle aucune ligne d'insights réelle n'existe.

**3. Le pilote arrive désormais dans l'application neuve.** La bascule L6 est
faite : `app/index.tsx` envoie vers `(app2)`. L'ancien arbre reste embarqué et
atteignable — douze points d'entrée y mènent encore, et ouvrir n'importe lequel
remonte toute l'ancienne barre d'onglets. Il n'est pas supprimé parce que le neuf
y renvoie pour trois écrans non portés et que l'espace professionnel le consomme
comme bibliothèque.

**4. Environ 5 600 lignes d'écrans V2 ne sont atteignables par aucun lien.**
`data/saison`, `club/territoire` et `club/galerie` n'ont aucun lien entrant ;
`club/roulages` n'est atteignable que par notification. Toute la zone de
réservation reste fermée derrière un drapeau. Ces écrans existent, ils sont
soignés, personne ne peut les ouvrir.

**5. L'espace coach n'est atteignable par personne, et son direct ne peut pas
s'amorcer.** Aucun compte n'a le rôle coach en base. Par ailleurs le relais live
exige `coach_pilots.status = 'active'`, valeur qu'aucune ligne de code n'écrit
jamais : l'unique binôme de production est resté à `pending`. Les douze tables du
travail coach sont vides.

**6. Le dépôt raconte enfin toute l'histoire de la base.** 215 migrations
appliquées, 215 fichiers, zéro écart. Les 94 qui manquaient ont été reconstituées
depuis le SQL conservé en base, fidélité vérifiée par empreinte. Onze fichiers
dangereux ou en doublon ont été sortis du chemin d'application — dont un qui
aurait cassé le droit à l'effacement au premier exercice réel.

**7. Trois défauts d'écriture viennent d'être corrigés côté coach, et un de
doctrine côté pilote.** Une note écrite depuis la fiche pilote était classée sur
le virage 1 sans que le coach l'ait choisi ; depuis l'écran direct
l'enregistrement ne faisait rien du tout, en silence ; un échec effaçait le texte
du coach en passant pour un succès. Côté pilote, quatre des six lectures
approfondies affichaient des chiffres de démonstration sans le dire.

**8. Rien n'a été observé en fonctionnement.** Aucun simulateur, aucun téléphone.
Tout ce qui est dit du rendu, des gestes, des transitions, de VoiceOver, du
Bluetooth ou de la fluidité est une lecture de code, pas une observation. C'est
la limite majeure de ce document, et elle recoupe la vôtre : les builds attendent
toujours un verdict sur appareil.

---

## Ce qui protège la chaîne de capture

Quatre fichiers — la machine à états, le service de capture, la file de
synchronisation, le Bluetooth — sont sous gel explicite : ils ne peuvent être
modifiés qu'avec votre accord. Deux dérogations ont été accordées cette année,
toutes deux purement additives et vérifiées par diff.

Une nuance à connaître : `setActiveRecording` n'est appelée nulle part dans
l'application. L'état `S6_roulage` n'est donc jamais atteint et le garde-fou
runtime du silence en piste ne se déclenche jamais. Le silence est tenu par
l'écran de roulage lui-même, pas par la machine à états — ce qui marche, mais
repose sur un seul point au lieu de deux.

---

## Ce que l'application est aujourd'hui

824 fichiers TypeScript, 159 fichiers de tests pour 1 853 tests verts, 215
migrations, 149 documents. Une base Supabase PostgreSQL 17 en `eu-west-1`
(Irlande), partagée avec le site : l'application n'a pas de base à elle.

Neuf espaces de routes coexistent — pilote V2, pilote V1, coach, admin,
partenaire, professionnel, authentification, onboarding pilote, onboarding
coach — dont trois sont destinés à migrer vers le web. Deux systèmes de design
cohabitent sans se mélanger : le kit « DA Instrument » pour le pilote V2,
l'ancien pour tout le reste.

La cible de build est **iOS**.

---

## Comment lire la suite

Huit sections, dans cet ordre :

1. **La connexion et les données** — Supabase, rôles, tables, policies, fonctions
   edge, tâches planifiées, purge RGPD, et ce que le site partage.
2. **La chaîne de capture** — du boîtier à la base, et ce qui se passe quand ça
   casse.
3. **L'application du pilote (arbre V2)** — les 38 écrans, ce que chacun montre
   et d'où vient chaque valeur.
4. **L'ancien arbre pilote** — ce qu'il en reste, pourquoi, et ce qu'il faudrait
   pour le supprimer.
5. **L'espace coach** — 37 écrans, à lire en sachant que personne ne peut y
   entrer aujourd'hui.
6. **Les autres espaces** — admin, partenaire, professionnel, authentification,
   onboarding.
7. **Le langage visuel et l'accessibilité** — les deux kits, la loi couleur, les
   contrastes.
8. **Où en est le programme** — lots livrés, verrous non techniques, décisions
   qui vous attendent.

---

## La connexion et les données

### Avertissement de méthode

Rien n'a été exécuté. Aucune application n'a été lancée, aucun appareil n'a été
branché, aucun écran n'a été affiché. Ce qui suit vient de deux sources
seulement : la lecture du code du dépôt, et des requêtes en **lecture seule**
sur la base de production. Quand j'écris « l'application fait X », il faut
comprendre « le code de l'application dit qu'elle fait X ». Quand j'écris « la
base contient Y », c'est une mesure, et je donne la requête ou le chemin.

Ce qui n'a pas pu être vérifié est signalé comme tel, à la fin de chaque
partie et dans une section dédiée en clôture.

---

### Le projet Supabase

| | |
|---|---|
| Identifiant | `fouvuqkdxarjpjbqnsjq` |
| Nom | `oxv-platform` |
| Région | `eu-west-1` — Irlande, Union européenne |
| Moteur | PostgreSQL 17.6 |
| Statut | `ACTIVE_HEALTHY` |
| Créé le | 8 mai 2026 |

Mesuré via l'outil d'administration Supabase, pas d'après un document.

**Un écart de documentation à corriger.** Le commentaire en tête du client
Supabase de l'application annonce Francfort :

`C:/Users/Julie/OneDrive/Desktop/oxv-app/src/lib/supabase.ts:5`
> « Typé contre le schéma Supabase de production (fouvuqkdxarjpjbqnsjq, Frankfurt). »

C'est faux. La région réelle est `eu-west-1`, l'Irlande. Le fond n'en est pas
affecté — les deux sont dans l'Union, et la politique de confidentialité qui
promet un hébergement européen reste exacte. Mais c'est un commentaire qui ment
au prochain lecteur, et il traîne aussi dans d'autres documents. Le document de
raccordement avec le site le signale déjà :
`C:/Users/Julie/OneDrive/Desktop/oxv-app/docs/architecture/09_HANDOFF_SITE_BASE_PARTAGEE.md:34`

---

### Le client Supabase et le stockage du jeton

#### Un client unique

Toute l'application passe par un seul client, construit une fois dans
`C:/Users/Julie/OneDrive/Desktop/oxv-app/src/lib/supabase.ts`.

Il n'y a pas de second client caché. Le fichier `src/supabase/client.ts` que
mentionne encore `CLAUDE.md` (section « Code V1 récupéré ») **n'existe plus** :
le dossier `src/supabase/` est absent du dépôt. C'est une entrée de
documentation périmée, sans conséquence technique.

#### Les identifiants de connexion

`C:/Users/Julie/OneDrive/Desktop/oxv-app/src/lib/supabase.ts:15-22`

L'URL et la clé publique sont lues dans l'environnement, sous les noms
`EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Si l'une des
deux manque, le module **lève une exception au chargement** — l'application ne
démarre pas, avec un message explicite. C'est un choix sain : pas de démarrage
silencieux sur une base absente.

Le fichier `.env` local existe et porte bien ces deux noms (valeurs non
reproduites ici), plus le DSN Sentry et deux clés de calcul d'itinéraire.
`.env` est ignoré par Git : `C:/Users/Julie/OneDrive/Desktop/oxv-app/.gitignore:11`

**Un piège dans le fichier d'exemple.**
`C:/Users/Julie/OneDrive/Desktop/oxv-app/.env.example` propose les noms
`SUPABASE_URL` et `SUPABASE_ANON_KEY`, **sans le préfixe `EXPO_PUBLIC_`**.
Quelqu'un qui suivrait l'exemple à la lettre obtiendrait une application qui
refuse de démarrer. Le même fichier propose aussi une ligne
`SUPABASE_SERVICE_ROLE_KEY` : elle est commentée comme « ne jamais exposer côté
client », et de fait le code de l'application ne la lit nulle part — mais sa
seule présence dans le modèle est une invitation à l'erreur.

#### Les identifiants au moment du build

`C:/Users/Julie/OneDrive/Desktop/oxv-app/eas.json` ne contient **pas** l'URL ni
la clé Supabase. Les trois profils (`development`, `preview`, `production`)
déclarent seulement un champ `environment` et, pour deux d'entre eux, le
domaine Plausible. Les variables Supabase viennent donc des jeux
d'environnement stockés côté EAS.

**Je n'ai pas pu vérifier leur contenu** : ils vivent sur les serveurs Expo, pas
dans le dépôt. Un build qui partirait avec un jeu d'environnement vide donnerait
une application qui plante au démarrage — bruyamment, ce qui est préférable à
silencieusement, mais c'est un point à vérifier avant toute soumission.

#### Le stockage du jeton de session

`C:/Users/Julie/OneDrive/Desktop/oxv-app/src/lib/supabase.ts:24-40`

Le jeton de session est confié à `expo-secure-store` par un adaptateur de trois
méthodes (`getItem` / `setItem` / `removeItem`). Sur iOS — la cible de build —
cela signifie le trousseau (Keychain) du système, chiffré par l'appareil. Il
n'y a **ni `localStorage` ni `AsyncStorage`** pour le jeton, ce qui est conforme
à la consigne du projet.

Trois options complètent le client :

- `autoRefreshToken: true` — le jeton se renouvelle seul ;
- `persistSession: true` — la session survit à la fermeture de l'application ;
- `detectSessionInUrl: false` — correct en mobile, où il n'y a pas d'URL de
  retour à analyser.

Un en-tête `X-Client-Info: oxv-coach-mobile` est joint à chaque requête. Il
permet, côté serveur, de distinguer le trafic de l'application de celui du
site. Je n'ai pas vérifié qu'il soit effectivement exploité quelque part.

Le client est typé : `createClient<Database>` s'appuie sur
`C:/Users/Julie/OneDrive/Desktop/oxv-app/src/types/database.types.ts`, un
fichier généré de 9 275 lignes, daté du 19 juillet 2026, qui décrit
**113 tables**. La base en compte 130 (hors sauvegardes : 125). L'écart
mesurable est d'une seule table réellement manquante — `founding_members`,
créée le 21 juillet (migration `20260721060455_founding_members`), donc après
la génération des types. Toute écriture applicative sur cette table serait non
typée. En pratique l'application ne la lit pas.

---

### L'authentification

#### Le chemin normal : identifiant et mot de passe

`C:/Users/Julie/OneDrive/Desktop/oxv-app/src/store/useAuthStore.ts:114-129`

L'écran de connexion appelle `signInWithPassword`. En cas d'échec, le message
d'erreur est traduit en français par `translateAuthError`
(`src/store/useAuthStore.ts:149-161`), qui couvre trois cas : identifiants
incorrects, adresse non confirmée, réseau indisponible. Les autres erreurs
remontent en anglais, telles que Supabase les renvoie.

#### Le chargement du profil

`C:/Users/Julie/OneDrive/Desktop/oxv-app/src/store/useAuthStore.ts:55-70`

Après connexion, l'application lit une ligne de `public.users` restreinte à
quatorze colonnes : identité, `pilot_level`, `is_admin`, `role`, et les six
horodatages d'acceptation (profil complété, pacte pilote, pacte coach, CGU,
confidentialité). Si la lecture échoue, le profil vaut `null` et l'erreur part
en `console.warn` — l'application ne bloque pas.

Une garde de repli existe ligne 69 : si `role` est absent, le profil est traité
comme `pilot`. C'est prudent, mais cela masquerait une régression de schéma
plutôt que de la signaler.

#### La persistance et le réveil

`C:/Users/Julie/OneDrive/Desktop/oxv-app/src/store/useAuthStore.ts:75-112`

Au démarrage, `initialize()` interroge `getSession()`, puis pose un écouteur
`onAuthStateChange` qui recharge le profil à chaque changement. L'appel est
déclenché une fois depuis la racine :
`C:/Users/Julie/OneDrive/Desktop/oxv-app/app/_layout.tsx:43`

**Une remarque de code.** L'écouteur `onAuthStateChange` est posé *à l'intérieur*
de `initialize()`. Le garde-fou d'entrée (`if (get().status === 'loading') return`,
ligne 76) empêche deux appels concurrents, mais pas deux appels successifs :
un second `initialize()` après stabilisation poserait un second écouteur. En
l'état, la racine n'appelle qu'une fois, sauf si le pilote presse « Réessayer »
sur l'écran d'erreur (`app/index.tsx:52`). Effet pratique attendu : des
rechargements de profil en double. Je ne l'ai pas observé.

#### Le second chemin : l'appairage depuis le site

`C:/Users/Julie/OneDrive/Desktop/oxv-app/src/services/pairingService.ts`

Un pilote peut entrer un code obtenu sur `oxvehicle.fr` et se retrouver
connecté sans mot de passe. Le mécanisme :

1. l'application poste `{ action: 'redeem', code }` à la fonction edge
   `pair-app`, **sans jeton** (l'utilisateur n'est pas encore authentifié) ;
2. la fonction vérifie et consomme le code, puis renvoie un `token_hash` ;
3. l'application appelle `verifyOtp({ type: 'magiclink', token_hash })` et
   obtient sa session.

`pair-app` est déployée et active en production, `verify_jwt: false` — ce qui
est nécessaire, puisque l'appel est pré-authentification. Le commentaire du
service annonce un anti-force-brute côté serveur (10 tentatives par minute et
par adresse IP) et la table `app_pairing_redeem_attempts` existe bien en base
pour le porter.

**Ce que je n'ai pas vérifié** : la source de `pair-app` telle qu'elle tourne,
et donc l'effectivité réelle de la limitation. La table
`app_pairing_codes` porte **0 ligne** et `app_pairing_redeem_attempts` **1**.
Aucun appairage n'a donc abouti récemment, et le chemin n'a jamais été
exercé en volume.

#### Ce qui suit la connexion : le routage

`C:/Users/Julie/OneDrive/Desktop/oxv-app/app/index.tsx:71-107`

L'ordre est le suivant :

- non authentifié → `/(auth)/login` ;
- profil absent ou onboarding incomplet → `/(coach-onboarding)` si `role = coach`,
  `/(partner)` si `role = partner`, sinon `/(onboarding)` ;
- puis, par rôle : `coach` → `/(coach)`, `partner` → `/(partner)`,
  `pro_pilot` → `/(pro)`, **tout le reste** → `/(app2)`.

« Tout le reste » inclut `admin`. Un compte `role = 'admin'` atterrit donc dans
l'espace pilote. C'est délibéré et commenté ligne 92 : « admin a accès en plus
à `/(admin)` ». Mais l'accès en question n'est pas gardé par `role`.

---

### Les rôles : `users.role` et `users.is_admin`

C'est le point le plus important de cette section, et il n'est pas tranché.

#### Deux champs, deux systèmes

La table `public.users` porte **72 colonnes**. Deux d'entre elles décident de
qui voit quoi :

| Champ | Type | Ce qu'il commande |
|---|---|---|
| `role` | texte | Le **routage de l'application** : quel espace s'ouvre à la connexion |
| `is_admin` | booléen | L'**espace administrateur de l'application** |

Et une troisième autorité, invisible dans l'application : la fonction SQL
`public.is_admin()`, qui garde les policies RLS.

#### Ce que garde `role`

Le routage, lu ci-dessus (`app/index.tsx:80-101`). Et, en base, trois fonctions
d'aide :

- `public.is_coach()` → `role = 'coach'` ;
- `public.is_partner()` → `role = 'partner'` ;
- `public.is_admin()` → **`role = 'admin'` OU `is_admin = true`**.

Cette dernière définition est le nœud. Texte exact, relevé en production :

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  SELECT COALESCE(
    (SELECT role = 'admin' OR is_admin = true FROM public.users WHERE id = auth.uid()),
    false
  );
$function$
```

#### Ce que garde `is_admin`

L'espace administrateur de l'application, et lui seul :

`C:/Users/Julie/OneDrive/Desktop/oxv-app/app/(admin)/_layout.tsx`
```tsx
if (!profile?.is_admin) {
  return <Redirect href={'/(app2)' as never} />;
}
```

Le champ `role` n'est pas consulté ici. Un `role = 'admin'` avec
`is_admin = false` est **redirigé vers l'espace pilote**.

#### Le décompte réel en production

Requête sur `public.users`, 26 juillet 2026 :

| `role` | `is_admin` | Comptes |
|---|---|---|
| `pilot` | `false` | 10 |
| `pilot` | `true` | 1 |
| `admin` | `false` | 2 |
| `partner` | `false` | 1 |
| **Total** | | **14** |

Aucun compte n'a `role = 'coach'`. Aucun n'a `role = 'pro_pilot'`.

`auth.users` compte **12 lignes**, contre 14 dans `public.users`. Deux profils
n'ont **aucun compte d'authentification** en face : `louis.arnd05@icloud.com`
et `shadowsresidents@gmail.com`. Ce sont des lignes orphelines : elles ne
peuvent pas se connecter, et aucune policy RLS ne les fera jamais correspondre
à un `auth.uid()`.

#### Les quatre incohérences, nommées

**1. Le compte du fondateur est un pilote qui est admin.**
`administration@oxvehicle.fr` porte `role = 'pilot'` et `is_admin = true`.
Conséquence : il est routé vers l'espace pilote (`/(app2)`), il **peut** ouvrir
`/(admin)`, et en base `is_admin()` lui renvoie `true` — il voit toutes les
sessions, toutes les trames, toutes les analyses.

**2. Les deux comptes `role = 'admin'` n'atteignent pas l'espace admin.**
`julie.huet.perso@gmail.com` et `bitaube.p@gmail.com` ont `role = 'admin'` et
`is_admin = false`. Dans l'application : espace pilote, et le layout `(admin)`
les renvoie dehors. **En base, en revanche, `is_admin()` leur renvoie `true`** :
ils lisent toutes les sessions de télémétrie, toutes les trames, tous les
profils, et peuvent supprimer des lignes. C'est le pire des deux mondes — sans
interface pour l'assumer, avec le pouvoir quand même.

**3. Le compte principal du fondateur est en rôle partenaire.**
`gabinfillat@gmail.com` porte `role = 'partner'`, `is_admin = false`. Il est
donc routé vers `/(partner)` et n'a aucun droit administrateur en base. C'est
cohérent avec un test volontaire de l'espace partenaire, et réversible.

**4. Le seul coach du système n'a pas le rôle coach.**
`public.coach_profiles` porte **1 ligne**, `is_published = true`, rattachée à
`administration@oxvehicle.fr`. `public.coach_pilots` porte **1 ligne** :
`administration@oxvehicle.fr → fillatgabin@gmail.com`, niveau `programme`,
consentement du pilote horodaté au 28 juin 2026, `active = true`.

Or le compte coach a `role = 'pilot'`. Deux conséquences distinctes :

- **Le routage** : à la connexion, il part vers `/(app2)`, pas vers `/(coach)`.
  L'espace coach n'est atteignable par personne aujourd'hui.
- **Les policies** : `is_coach_of()` et `is_detailed_coach_of()` ne regardent
  **pas** le rôle — seulement la ligne `coach_pilots` (active, avec
  consentement, et le niveau pour la seconde). Ces deux-là fonctionnent donc.
  En revanche `coach_profiles_owner_all` exige `is_coach()`, qui teste
  `role = 'coach'` : **le coach ne peut pas modifier sa propre fiche**. Il la
  lit seulement par `coach_profiles_read_published`, comme n'importe qui.

#### Un point de sécurité à traiter : `is_admin` n'est pas verrouillé

Ceci est une lecture de code et de schéma. **Je ne l'ai pas exécuté** — le
faire aurait été une écriture en production.

Trois faits, chacun vérifié séparément :

**a) La policy de mise à jour de `users` n'a aucune restriction de colonne.**

| Policy | Commande | Rôle | Condition |
|---|---|---|---|
| `users_update_own_or_admin` | UPDATE | `authenticated` | `(id = auth.uid()) OR is_admin()` |

**b) Le rôle `authenticated` détient le droit `UPDATE` sur la colonne
`is_admin`.** Relevé dans `information_schema.column_privileges` : `is_admin`,
`role` et `kyc_status` sont toutes trois en `INSERT, UPDATE, SELECT` pour
`authenticated`.

**c) Le déclencheur de garde ne couvre pas `is_admin`.**

```sql
CREATE TRIGGER trg_guard_users_privileged_columns
  BEFORE UPDATE OF role, kyc_status ON public.users
  FOR EACH ROW EXECUTE FUNCTION guard_users_privileged_columns()
```

Et le corps de la fonction ne teste que `new.role is distinct from old.role or
new.kyc_status is distinct from old.kyc_status`.

Mis bout à bout : un `UPDATE public.users SET is_admin = true WHERE id =
auth.uid()` passerait la policy (c'est bien sa propre ligne), passerait le
droit de colonne, et ne réveillerait pas le déclencheur — qui ne se déclenche
que sur `role` ou `kyc_status`. Le compte deviendrait ensuite administrateur au
sens de `is_admin()`, donc de toutes les policies qui s'y appuient, et l'espace
`(admin)` de l'application s'ouvrirait à lui.

Il existe par ailleurs un déclencheur d'audit — `trg_audit_user_role_change` —
mais il ne journalise que les changements de `role`. Un passage en `is_admin`
ne laisserait **aucune trace** dans `admin_audit`.

Le déclencheur protège donc `role` correctement, et laisse `is_admin` ouvert
alors que les deux ouvrent exactement la même porte. Correctif de forme :
ajouter `is_admin` à la liste `BEFORE UPDATE OF …` **et** à la condition
interne, ou retirer le droit `UPDATE` sur cette colonne à `authenticated`.

#### La question qui reste à trancher

Lequel de `role` et de `is_admin` fait autorité, et pour qui ? Le site partage
la même table. La question est déjà posée au site, sans réponse à ce jour :
`C:/Users/Julie/OneDrive/Desktop/oxv-app/docs/architecture/09_HANDOFF_SITE_BASE_PARTAGEE.md:148-152`
et `:203`.

---

### Les tables réellement présentes

#### Le décompte

`public` contient **130 tables de base** et **14 vues**. Sur les 130, cinq sont
des sauvegardes datées (`_backup_*_20260719`) : il reste **125 tables de
travail**.

`auth` en compte 23 (gérées par Supabase), `storage` 8.

#### Ce que portent réellement les tables principales

Comptages exacts (`select count(*)`), 26 juillet 2026. C'est ce qui décide de ce
que le fondateur peut essayer aujourd'hui, et de ce qu'il ne peut pas.

| Table | Lignes | Ce que cela veut dire |
|---|---|---|
| `users` | 14 | 12 connectables, 2 orphelines |
| `telemetry_sessions` | 18 | voir ci-dessous |
| `telemetry_frames` | 53 | pour **une seule** session |
| `laps` | 1 | aucun tour réellement détecté |
| `app_session_analyses` | 13 | la lecture après séance |
| `app_segment_analyses` | **0** | aucune analyse virage par virage |
| `session_insights` | 1 | |
| `session_intentions` | **0** | l'intention avant séance n'a jamais servi |
| `biometry_raw` | **0** | aucune fréquence cardiaque enregistrée |
| `circuits` | 4 | |
| `vehicles` | 6 | |
| `devices` | **0** | aucun boîtier déclaré |
| `device_assignments` | **0** | |
| `weather_snapshots` | **0** | aucune météo archivée |
| `coach_profiles` | 1 | |
| `coach_pilots` | 1 | |
| `coach_annotations` | **0** | aucune note de coach |
| `sessions` (calendrier du site) | 1 | |
| `registrations` | 1 | |
| `events` | 1 | |
| `documents` | 9 | |
| `eligibility_items` | 9 | |
| `pricing` | 9 | |
| `payments` | 1 | |
| `app_pairing_codes` | **0** | |
| `app_progression_shares` | 1 | |
| `admin_audit` | 59 | |
| `email_log` | 16 | |
| `resend_events` | 49 | |

**Plus de 80 tables sur 125 sont vides.** Le schéma décrit un produit bien plus
large que ce qui a jamais tourné.

#### Le point qui compte le plus : aucune vraie séance en piste

Les 18 lignes de `telemetry_sessions` se répartissent ainsi :

- **10 sessions « completed »**, toutes du 16 et 17 mai 2026, avec des vitesses
  maximales de **0,30 à 8,49 km/h**, des distances de 0,01 à 0,05 km, et
  `lap_count = 0` (sauf une à 1). Ce sont des essais à pied ou à l'arrêt.
  Elles portent un `total_frames` non nul (93 à 1 206) mais **aucune ligne
  correspondante dans `telemetry_frames`** : les trames ont été supprimées ou
  n'ont jamais été écrites.
- **8 sessions « aborted »**, de juin et juillet 2026, avec
  `total_frames = 0`, aucune vitesse, aucun tour. Trois d'entre elles portent
  un `raw_data_url` (fichier brut déposé), les autres non.
- Une seule session porte réellement des trames : `7f40d5ad-…` du 28 juin,
  **53 trames**, pour 5 secondes — et elle est marquée `aborted`.

Aucune session ne dépasse la marche. Aucun tour complet n'a jamais été bouclé
et enregistré. `laps` porte une ligne unique. La chaîne capture → analyse →
bilan n'a jamais été exercée sur des données de piste.

Les 13 analyses de `app_session_analyses` confirment : `margin_global` vaut 60,
62, 99,6 ou 100 selon les lignes, `margin_zone` vaut `green` partout, `qdi` est
`null` partout. Douze ont été produites en lot le 25 mai à 21h55 par le cron
(`algo_version = 'cron-v1.0'`), la dernière le **2 juillet**. Il ne s'est rien
produit depuis — voir la section sur les tâches planifiées, qui explique
pourquoi.

#### Les circuits

| Circuit | Officiel | Ligne d'arrivée | Tracé SVG | Ligne centrale | Virages détectés | Statut |
|---|---|---|---|---|---|---|
| Haute Saintonge | oui | oui | **oui** | oui | **oui** (`corners-v1`) | approuvé |
| Charente | oui | oui | non | oui | non | approuvé |
| Circuit Ricardo Tormo | oui | oui | non | oui | **non** | privé |
| La charade | non (perso) | oui | non | non | non | privé |

Seul **Haute Saintonge** est complet. Le circuit de Valence (Ricardo Tormo)
a sa ligne d'arrivée et sa ligne centrale, mais **aucun virage détecté** et un
statut `private` : tout écran qui suppose des virages y sera vide.
`total_sessions` vaut 0 sur les quatre.

#### Les tables de sauvegarde

Cinq tables `_backup_*_20260719`, créées lors des travaux de sécurité du
19 juillet, portant sur des données du site : `payments` (2 lignes),
`registrations` (5), `sessions` (44), `session_feedback` (0), `weather` (14).

Quatre des cinq ont **RLS désactivé**. C'est moins grave qu'il n'y paraît :
j'ai vérifié qu'**aucune de ces tables n'accorde de droit à `anon` ou à
`authenticated`** (`information_schema.role_table_grants` renvoie zéro ligne
pour ce filtre). Elles ne sont donc pas exposées par l'API. Seul le
`service_role` les atteint.

Cela reste de la donnée personnelle recopiée **hors du dispositif de purge** :
la fonction `purge_user_data` ne les connaît pas. Un pilote qui exercerait son
droit à l'effacement resterait présent dans `_backup_registrations_20260719`.
Le dépôt de l'application refuse de les supprimer parce qu'elles paraissent
relever du site (`09_HANDOFF_SITE_BASE_PARTAGEE.md:192-198`). La décision est
en attente, et elle est datée du 19 juillet.

---

### Les policies RLS qui comptent

#### Le principe, et sa fragilité

**Toutes les tables de travail ont RLS activé** (vérifié sur `pg_class`, 125
sur 125). Aucune n'a `FORCE ROW LEVEL SECURITY`, ce qui est normal.

Mais il faut comprendre sur quoi cela repose. Le rôle `anon` — celui que porte
la clé publique de l'application avant connexion — détient des droits
`SELECT, INSERT, UPDATE, DELETE` sur **presque toutes les tables de `public`**.
Sur `users`, `payments` et `registrations`, il n'a que `SELECT`. Sur les autres,
il a tout.

**RLS est donc la seule et unique barrière.** Une table à laquelle on
ajouterait une policy trop large, ou dont on désactiverait RLS par mégarde,
deviendrait immédiatement lisible — voire modifiable — par n'importe qui
possédant la clé publique de l'application, qui est par nature distribuée avec
le binaire.

Ce n'est pas une faille en soi : c'est le modèle Supabase par défaut. Mais cela
veut dire que la revue des policies n'est pas un détail d'hygiène — c'est la
sécurité du produit.

#### `users`

Quatre policies, toutes sur `authenticated` :

| Policy | Commande | Condition |
|---|---|---|
| `users_select_own_or_admin` | SELECT | `(id = auth.uid()) OR is_admin()` |
| `users_insert_own_or_admin` | INSERT | `(id = auth.uid()) OR is_admin()` |
| `users_update_own_or_admin` | UPDATE | `(id = auth.uid()) OR is_admin()` |
| `users_delete_admin_only` | DELETE | `is_admin()` |

Aucune n'est ouverte à `anon` : le droit `SELECT` que `anon` détient sur la
table ne donne rien, faute de policy qui le vise. C'est correct.

Le défaut est ailleurs, et il est décrit plus haut : **aucune restriction de
colonne** en écriture.

#### `telemetry_sessions` — sept policies

| Policy | Commande | Condition |
|---|---|---|
| `Users can view own sessions` | SELECT | `auth.uid() = user_id` |
| `Users can insert own sessions` | INSERT | `auth.uid() = user_id` |
| `Users can update own sessions` | UPDATE | `auth.uid() = user_id` |
| `Users can delete own sessions` | DELETE | `auth.uid() = user_id` |
| `telemetry_sessions_coach_select` | SELECT | `is_coach_of(user_id)` |
| `telemetry_sessions_select_friend` | SELECT | `are_friends(auth.uid(), user_id)` |
| `telemetry_sessions_admin_all` | ALL | `is_admin()` |

Le pilote est propriétaire de sa donnée. Le coach lit s'il est lié **et
consenti**. Un ami lit si l'amitié est acceptée des deux côtés. L'administrateur
lit tout.

#### `telemetry_frames` — six policies

Même architecture, en passant par la session : chaque condition est de la forme
`session_id IN (SELECT id FROM telemetry_sessions WHERE …)`. Une différence
notable :

| Policy | Condition |
|---|---|
| `telemetry_frames_coach_select` | `is_detailed_coach_of(…)` |

C'est `is_detailed_coach_of`, pas `is_coach_of`. La donnée brute exige un
consentement de niveau `lecture_detaillee` ou `programme`. Le niveau
`lecture_simple` ne donne accès qu'aux sessions et aux bilans. C'est la
traduction en SQL des trois niveaux décrits dans
`C:/Users/Julie/OneDrive/Desktop/oxv-app/src/services/pilotConsentService.ts:24-40`.
Le découpage est propre.

#### `app_session_analyses` et `app_segment_analyses` — six policies chacune

Même schéma : propriétaire, coach, ami, admin. Avec la même distinction de
finesse : `app_session_analyses` accepte `is_coach_of` (le bilan),
`app_segment_analyses` exige `is_detailed_coach_of` (le virage par virage).

À noter : la suppression est **réservée à l'administrateur**
(`app_session_analyses_delete_admin_only`). Un pilote peut effacer sa session
brute mais pas son analyse. C'est un point à vérifier au regard du droit à
l'effacement — en pratique la purge RGPD passe par `service_role` et ne s'y
heurte pas.

#### `biometry_raw` — la table la plus sensible

Deux policies seulement :

| Policy | Commande | Condition |
|---|---|---|
| `biometry_own_all` | ALL | `auth.uid() = user_id` |
| `biometry_coach_read` | SELECT | `is_detailed_coach_of(user_id)` **ET** `users.biometry_coach_share_consent_at IS NOT NULL` |

La lecture par le coach exige **deux** conditions cumulées : un lien de coaching
détaillé, et un consentement explicite au partage biométrique. C'est le
verrouillage le plus strict de la base, et il est justifié : la fréquence
cardiaque est une donnée de santé au sens du RGPD.

La table porte **0 ligne**, et les deux colonnes de consentement
(`biometry_capture_consent_at`, `biometry_coach_share_consent_at`) sont
**nulles pour les 14 comptes**. Personne n'a jamais consenti, rien n'a jamais
été capturé.

#### Les fonctions d'aide

Cinq fonctions, toutes `SECURITY DEFINER` avec `search_path` fixé — la bonne
pratique est respectée :

| Fonction | Ce qu'elle vérifie |
|---|---|
| `is_admin()` | `role = 'admin'` **ou** `is_admin = true` |
| `is_coach()` | `role = 'coach'` |
| `is_partner()` | `role = 'partner'` |
| `is_coach_of(pilot)` | `coach_pilots` : lien actif **et** `pilot_consent_at` non nul |
| `is_detailed_coach_of(pilot)` | idem **et** `level IN ('lecture_detaillee','programme')` |
| `is_my_coach(coach)` | la réciproque, vue du pilote |
| `are_friends(a,b)` | `pilot_friendships` en ordre canonique, `status = 'accepted'` |

`are_friends` normalise la paire par `LEAST`/`GREATEST` avant de chercher, ce
qui évite le classique doublon symétrique. `pilot_friendships` porte **0 ligne**
— la comparaison entre amis n'a jamais servi.

#### Ce qui est réellement ouvert au public

Trois policies portent `USING (true)` ou équivalent, sur le rôle `public`
(qui inclut `anon`) :

| Table | Policy | Portée |
|---|---|---|
| `app_config` | `app_config_read_all` | `true` — tout le monde |
| `app_feature_flags` | `app_feature_flags_read` | `true` — tout le monde |
| `app_settings` | `app_settings_read_authenticated` | `auth.uid() IS NOT NULL` |

Les deux premières sont lisibles **sans être connecté**. Le contenu n'est pas
sensible (un booléen de maintenance, sept drapeaux). Mais cela expose la
feuille de route : n'importe qui peut lire que `app_payments` existe et est
éteint, ou lire la description du drapeau `biometry`, qui mentionne en clair
une décision du fondateur et un test non tenu.

**Une policy mérite un examen.** Sur `events` :

```
events_select_private   SELECT   {public}   USING (status = 'private')
```

Une policy nommée « private » qui rend lisibles à **tout le monde, y compris
non connecté**, exactement les événements marqués privés. La table `events`
porte les colonnes `location_address` et `internal_notes`. Il y a une ligne en
base, `status = 'private'`, nommée « Balade Découverte OXV — 5 juillet 2026 ».
Je n'ai pas exécuté de requête anonyme pour le confirmer de bout en bout —
c'est une lecture du texte de la policy. Si l'intention était « visible par les
membres », la condition devrait au minimum porter `auth.uid() IS NOT NULL`.

Dans le même registre, `partner_accounts_select` autorise
`status = 'validated'` sans condition d'authentification, et
`coach_profiles_read_published` ouvre les fiches publiées. Les deux sont
probablement voulus (vitrine), mais méritent d'être confirmés comme tels.

#### Les tables sans aucune policy

Trois tables ont RLS activé et **zéro policy** : `founding_members`,
`invoice_counters`, `app_pairing_redeem_attempts`, plus la sauvegarde
`_backup_sessions_20260719`. En PostgreSQL, RLS activé sans policy = refus
total pour tout le monde sauf `service_role`. C'est un verrouillage complet,
volontaire ou non, mais sûr.

---

### Les fonctions edge déployées

**34 fonctions sont actives en production.** Le dépôt en contient 32 sous
`C:/Users/Julie/OneDrive/Desktop/oxv-app/supabase/functions/`.

#### Les 34, par famille

**Analyse et calcul** — `compute-session-insights` (`verify_jwt: true`),
`compute-session-insights-v3` (`true`), `detect-circuit-corners` (`true`),
`cron-analyze-pending-sessions` (`false`), `generate-debrief-ai` (`true`),
`coach-ai-draft` (`true`), `coach-ai-validate` (`true`).

**Notifications pilote et coach** — `notify-pilot-coach-assigned` (`true`),
`notify-coach-consent-received` (`true`), `notify-pilot-coach-annotated`
(`false`), `notify-coach-session-analyzed` (`false`),
`notify-pilot-friend-request` (`false`), `notify-pilot-friend-accepted`
(`false`), `notify-admin-lead` (`false`).

**Cycle commercial et administratif (côté site)** — `validate-inscription`
(`true`), `admin-review-inscription` (`true`), `send-booking-confirmation`
(`false`), `send-payment-confirmed` (`false`), `send-document-status` (`false`),
`send-contact-ack` (`false`), `send-application-ack` (`false`),
`send-coach-invitation` (`true`), `generate-invoice` (`false`),
`newsletter-push` (`false`), `resend_webhook` (`false`).

**Rituels et rappels** — `ritual_dispatcher` (`false`), `ritual_dryrun`
(`true`), `eligibility-reminders` (`false`), `feedback-request` (`false`).

**Divers** — `geocode` (`true`), `pair-app` (`false`),
`purge-deleted-accounts` (`false`).

**Sans propriétaire identifié** — `capture-membre-fondateur` (`false`),
`yousign-webhook` (`false`).

#### Deux fonctions non authentifiées et sans source connue

`capture-membre-fondateur` (version 7) et `yousign-webhook` (version 6) ont été
déployées le **24 juillet 2026**. Elles n'existent dans aucun fichier du dépôt
de l'application. Toutes deux acceptent les requêtes **sans vérification de
jeton**.

Pour un webhook, `verify_jwt: false` est normal — à condition que la fonction
vérifie elle-même une signature. **Je ne peux pas le vérifier** : leur source
n'est pas dans ce dépôt, et je n'ai pas lu leur code déployé.

`yousign-webhook` touche la signature électronique, donc les décharges de
responsabilité des pilotes (`pilot_waiver_signatures`, 0 ligne, drapeau
`pilot_waivers` éteint). C'est un sujet juridique. La demande est déjà formulée
au site : `09_HANDOFF_SITE_BASE_PARTAGEE.md:170-184`. Elle est sans réponse.

Deux points d'entrée non authentifiés sans propriétaire identifié, c'est une
question ouverte en production.

#### Un écart entre le dépôt et la production

Le fichier
`C:/Users/Julie/OneDrive/Desktop/oxv-app/supabase/functions/purge-deleted-accounts/index.ts`
porte en tête, lignes 4-7 :

> « /!\ VERSION 5 (SEC-1) — PRÉPARÉE, NON DÉPLOYÉE — approbation fondateur
> requise. […] AUCUN cron ne l'invoque (constat du 19/07/2026 […]) »

J'ai lu le code **réellement déployé**. Il porte en tête :

> « VERSION 5 (SEC-1) — déployée le 19/07/2026 après approbation fondateur. »

Le corps des deux versions est identique. Le fichier du dépôt est donc à jour
sur le fond et **périmé sur son propre en-tête** : la v5 est bien en
production (version 10 de la fonction, `verify_jwt: false`), la fonction SQL
`public.purge_user_data(p_user uuid)` **existe** en base, et la tâche planifiée
`purge-deleted-accounts-daily` **existe et tourne**.

Ce n'est pas un défaut technique, c'est un défaut de vérité : le dépôt affirme
qu'une chose n'est pas déployée alors qu'elle l'est depuis une semaine. Deux
lignes de commentaire à corriger.

---

### Les tâches planifiées

`pg_cron` 1.6.4 et `pg_net` 0.20.0 sont installés. **Huit tâches, toutes
actives.**

| # | Nom | Cadence | Cible |
|---|---|---|---|
| 4 | `analyze-pending-sessions` | toutes les heures, à `:00` | edge `cron-analyze-pending-sessions` |
| 5 | `compute-insights-hourly` | toutes les heures, à `:30` | edge `compute-session-insights` |
| 6 | `cleanup-telemetry-frames` | 03h30 chaque jour | SQL `cleanup_old_telemetry_frames()` |
| 7 | `oxv-eligibility-reminders` | 06h00 chaque jour | edge `eligibility-reminders` |
| 8 | `oxv-feedback-requests` | 07h00 chaque jour | edge `feedback-request` |
| 9 | `purge-deleted-accounts-daily` | 02h30 chaque jour | edge `purge-deleted-accounts` |
| 10 | `ritual_dispatcher_hourly` | 16h à 19h, chaque heure | edge `ritual_dispatcher` |
| 11 | `biometry-retention-daily` | 03h15 chaque jour | SQL `purge_old_biometry()` |

Les secrets d'invocation sont lus dans Vault, soit directement
(`vault.decrypted_secrets`), soit par la fonction `public.oxv_get_secret()`.
Cette dernière avale toutes les exceptions et renvoie `NULL` en cas d'échec :
si Vault devenait indisponible, les tâches partiraient **sans en-tête
d'authentification** au lieu d'échouer bruyamment. C'est un choix documenté
dans le corps de la fonction, mais qui transforme une panne en silence.

#### Historique d'exécution

| Tâche | Exécutions | « succeeded » | Première | Dernière |
|---|---|---|---|---|
| `analyze-pending-sessions` | 1 467 | 1 467 | 25/05 | 26/07 00:00 |
| `compute-insights-hourly` | 1 013 | 1 013 | 13/06 | 26/07 00:30 |
| `cleanup-telemetry-frames` | 27 | 27 | 29/06 | 25/07 |
| `oxv-eligibility-reminders` | 22 | 22 | 04/07 | 25/07 |
| `oxv-feedback-requests` | 22 | 22 | 04/07 | 25/07 |
| `purge-deleted-accounts-daily` | 7 | 7 | 19/07 | 25/07 |
| `ritual_dispatcher_hourly` | 28 | 28 | 19/07 | 25/07 |
| `biometry-retention-daily` | 7 | 7 | 19/07 | 25/07 |

**Attention à ce que « succeeded » signifie.** `cron.job_run_details` rapporte
le succès de l'**instruction SQL**, c'est-à-dire de la mise en file de la
requête HTTP par `pg_net`. Il ne dit **rien** de ce que la fonction edge a
répondu. Une tâche peut afficher 1 013 succès d'affilée en n'ayant jamais rien
accompli.

#### Une tâche est en échec silencieux

C'est le cas ici, et c'est mesurable. La table `net._http_response` conserve les
réponses HTTP réelles sur une fenêtre courte. Sur les treize dernières
enregistrées :

- les sept appels de **`:00`** (`cron-analyze-pending-sessions`) répondent
  **200**, avec le corps `{"ok":true,"processed":0,"successful":0,"failed":0,"results":[]}` ;
- les six appels de **`:30`** (`compute-session-insights`) répondent **401**,
  avec le corps `{"code":"UNAUTHORIZED_NO_AUTH_HEADER","message":"Missing authorization header"}`.

La cause est identifiable dans les deux artefacts :

1. `compute-session-insights` est déployée avec **`verify_jwt: true`**. C'est
   assumé par son propre code :
   `C:/Users/Julie/OneDrive/Desktop/oxv-app/supabase/functions/compute-session-insights/index.ts:20`
   > « Sécurité : verify_jwt = true (déclenché par l'app authentifiée, après l'analyse). »
2. La tâche planifiée n° 5 envoie un en-tête `X-Cron-Token` et **aucun
   `Authorization`**. La passerelle Supabase rejette donc l'appel **avant** que
   le code de la fonction ne s'exécute.

Il y a un second désaccord, indépendant du premier : la tâche envoie
`{"all_pending": true}`, alors que la fonction attend `{ sessionId }` et
répond 400 si celui-ci manque (`index.ts:42-45`). Même authentifiée, elle
n'aurait rien fait.

**Conséquence concrète** : `compute-session-insights` n'a **jamais rien
calculé par ce chemin**, à chaque demi-heure, depuis le 13 juin — soit environ
1 000 appels. `session_insights` porte **1 ligne**.

C'est une panne qui ne se voit nulle part : la tâche est verte, le tableau de
bord ne dit rien, et personne n'a d'alerte.

Quant à la tâche de `:00`, elle répond bien 200 mais traite `processed: 0` —
il n'y a plus de session en attente d'analyse. La dernière analyse produite
date du **2 juillet**.

#### Ce que je n'ai pas pu vérifier sur les autres tâches

`net._http_response` ne conserve que quelques heures. Je n'ai **pas** de trace
HTTP pour les cinq tâches quotidiennes (`purge-deleted-accounts`,
`eligibility-reminders`, `feedback-request`, `ritual_dispatcher`) qui tournent
la nuit ou en fin d'après-midi. Elles visent des fonctions en
`verify_jwt: false`, donc l'obstacle qui bloque `compute-session-insights` ne
les concerne pas ; mais leur réponse effective n'est pas vérifiée. Les deux
tâches purement SQL (`cleanup-telemetry-frames`, `biometry-retention-daily`)
n'ont pas ce problème : elles s'exécutent dans la base.

---

### Les drapeaux fonctionnels

#### Le mécanisme

Table `public.app_feature_flags`, quatre colonnes utiles : `key`, `enabled`,
`value` (jsonb, pour des versions d'algorithme), `description`.

Lecture par `C:/Users/Julie/OneDrive/Desktop/oxv-app/src/services/featureFlagsService.ts:42-50` :

```ts
export async function isFlagEnabled(key: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('app_feature_flags').select('enabled').eq('key', key).maybeSingle();
  if (error || !data) return false;
  return Boolean((data as Record<string, unknown>).enabled);
}
```

**La fonction est verrouillée par défaut** : une erreur réseau, une clé absente,
une RLS qui refuse — tout renvoie `false`. Une fonctionnalité ne peut jamais
s'ouvrir par accident. C'est le bon sens du paramètre.

L'écriture est réservée par RLS à `is_admin()`.

#### L'état réel, mesuré en production

| Clé | `enabled` | Dernière modification | Ce qu'elle commande |
|---|---|---|---|
| `biometry` | **`true`** | 25/07/2026 17:58 | capture et affichage de la fréquence cardiaque |
| `app_payments` | `false` | 19/07/2026 | réservation et paiement dans l'application |
| `coach_billing` | `false` | 06/07/2026 | suivi et aide à la facture, côté coach |
| `convoys` | `false` | 19/07/2026 | convois vers une journée |
| `founders` | `false` | 19/07/2026 | candidatures Membre Fondateur |
| `pilot_waivers` | `false` | 12/07/2026 | décharge de responsabilité signée |
| `video_overlay` | `false` | 19/07/2026 | vidéo du tour synchronisée à la télémétrie |

**Un seul drapeau sur sept est allumé.** Six fonctionnalités sont présentes dans
le code et inaccessibles.

#### Le cas `biometry`

Sa description en base, mot pour mot :

> « BE-1 : capture et affichage FC (Polar/Watch). Gate consentement biometry par
> pilote (capture + partage coach) TOUJOURS requis. Levé le 2026-07-25 sur
> décision fondateur, après validation avocat du consentement
> (docs/juridique/consentement_biometrie.md). **Reste non tenu à la levée :
> smoke test 2 appareils reels.** »

C'est le seul drapeau allumé, il l'a été **hier** (25 juillet), et la base
elle-même consigne que le test à deux appareils réels n'a pas eu lieu.

En face : `biometry_raw` porte **0 ligne**, et **aucun des 14 comptes** n'a
rempli `biometry_capture_consent_at` ni `biometry_coach_share_consent_at`. La
fonctionnalité est ouverte, et elle n'a encore jamais servi.

#### Où les drapeaux sont réellement consommés

Chaque appel a été relevé dans le dépôt (recherche sur `isFlagEnabled`) :

| Drapeau | Écran ou service |
|---|---|
| `biometry` | `app/(app2)/rec/equipement.tsx:519`, `app/(app2)/rec/entre-runs.tsx:123`, `app/(app2)/rec/fin.tsx:114`, `app/(coach)/debrief.tsx:108` |
| `app_payments` | `app/(app2)/club/pass.tsx:107`, `src/features/vous/useReserverDay.ts:52`, `src/features/vous/useReserverPayment.ts:52` |
| `founders` | `app/(app2)/vous/fondateur.tsx:77`, `src/features/vous/useReserverPayment.ts:59` |
| `pilot_waivers` | `app/(app2)/vous/decharge.tsx:68`, `app/(app)/decharge.tsx:58` |
| `convoys` | `app/(app2)/club/territoire.tsx:159`, `app/(app2)/rec/preparation.tsx:186` |
| `coach_billing` | `app/(coach)/index.tsx:178`, `app/(coach)/facturation.tsx:104` |
| `video_overlay` | aucun appel trouvé dans le code de l'application |

`video_overlay` est déclaré en base et **n'est lu nulle part**. La table
`video_overlays` existe (8 colonnes, 0 ligne) avec une policy. C'est une
réservation de place, pas une fonctionnalité.

Deux drapeaux (`coach_billing`) ne gardent que des écrans de l'espace coach,
qui n'est aujourd'hui atteignable par aucun compte — voir la section sur les
rôles.

#### La configuration d'application

Table `public.app_config`, **une seule ligne**, contrainte à une seule par
construction (`id` booléen) :

```
id = true, maintenance_mode = false, maintenance_message = null,
min_supported_version = null, updated_at = 2026-06-29
```

Le mode maintenance est éteint et aucune version minimale n'est imposée.
`MaintenanceGate` est monté à la racine
(`C:/Users/Julie/OneDrive/Desktop/oxv-app/app/_layout.tsx:169`) : le levier
existe et n'a jamais été tiré. `min_supported_version` à `null` signifie
qu'aucune version installée ne sera jamais refusée — utile à savoir avant de
publier une version qui casserait un contrat de données.

---

### La rétention et la purge RGPD

#### Ce que le pilote peut demander depuis l'application

`C:/Users/Julie/OneDrive/Desktop/oxv-app/src/services/accountService.ts:29-50`

`requestAccountDeletion(userId)` horodate `deletion_requested_at` et pose
`deletion_scheduled_at` à **J+30**. Rien d'autre : aucun effacement immédiat.
Le délai de grâce de 30 jours correspond à la politique de confidentialité
(§7.3), citée dans le commentaire du fichier.

Un détail de qualité qui mérite d'être signalé, parce qu'il est rare : l'appel
ajoute `.select('id')` et **vérifie qu'une ligne a bien été écrite** (lignes
46-48). Sans cela, un `UPDATE` que RLS aurait silencieusement filtré aurait
renvoyé un succès, et le pilote aurait cru sa suppression enregistrée alors que
rien ne l'était. Le commentaire l'explique. C'est du soin.

En production : `deletion_requested_at` est renseigné pour **0 compte sur 14**.
Personne n'a jamais demandé la suppression de son compte. Le chemin n'a donc
jamais été exercé en conditions réelles.

#### Ce que fait la purge, une fois le délai écoulé

La fonction edge `purge-deleted-accounts` (version 5, déployée le 19 juillet,
`verify_jwt: false`) est appelée chaque nuit à 02h30 avec un `Bearer` égal au
secret interne. Elle refuse tout appel qui n'a pas ce jeton exact.

Sa stratégie est **anonymiser puis purger**, pas supprimer. La raison est
explicitée dans son en-tête : `payments.user_id` est en `NO ACTION`, la
facturation étant légalement conservée dix ans — un `DELETE` sur `users`
échouerait sur cette contrainte.

Pour chaque compte dont la grâce est écoulée, dans cet ordre :

1. collecte des références de stockage portées par des lignes de base (audios
   d'annotations coach, `media.file_url`) **avant** de les supprimer ;
2. suppression **récursive** des objets de stockage, sur **huit** compartiments
   préfixés par l'identifiant du pilote : `vehicles`, `documents`, `avatars`,
   `audio_briefings`, `pilot-media`, `session-media`, `telemetry_raw`,
   `coach-media`, plus `coach-audio` par identifiants collectés. Le
   compartiment `invoices` est **volontairement conservé** ;
3. appel de `public.purge_user_data(p_user)` — purge et anonymisation
   transactionnelles, tout ou rien, avec nettoyage des colonnes personnelles de
   `users` ;
4. anonymisation et bannissement du compte d'authentification
   (`email → deleted-{id}@oxv.invalid`, bannissement de 876 000 heures),
   sans suppression matérielle.

L'étape 2 est **fail-closed** : si un retrait de stockage échoue, le compte
entier échoue et les lignes de base restent — la nuit suivante retentera. C'est
le bon sens : on préfère réessayer que d'effacer à moitié.

`public.purge_user_data(p_user uuid)` **existe bien** en production (vérifié
sur `pg_proc`), posée par la migration `20260719011309_sec1_purge_user_data`.

**Ce que je n'ai pas vérifié** : le corps de `purge_user_data`, table par table.
La liste des ~20 tables couvertes vient de l'en-tête de la fonction edge, pas
d'une lecture du SQL. Et la purge n'a **jamais tourné sur un compte réel** :
aucune demande de suppression n'existe. Sept exécutions du cron depuis le
19 juillet, toutes avec zéro cible.

#### Les purges automatiques réellement en place

Deux, et elles sont dans la base — donc pas exposées au problème
d'authentification décrit plus haut.

**`cleanup_old_telemetry_frames()`**, chaque nuit à 03h30 :
```sql
DELETE FROM public.telemetry_frames WHERE created_at < now() - INTERVAL '12 months';
```
Conforme à la politique de confidentialité, qui annonce 12 mois pour les trames
brutes (`docs/juridique/04_POLITIQUE_CONFIDENTIALITE.md:180`).

**Limite à connaître** : la fonction ne touche **que** `telemetry_frames`. Elle
ne purge ni `telemetry_sessions` (les métadonnées de séance restent
indéfiniment), ni le compartiment de stockage `telemetry_raw`, qui porte
aujourd'hui **3 objets**. Un fichier brut déposé il y a treize mois est
toujours là. La promesse de 12 mois porte sur la donnée en base, pas sur le
fichier.

**`purge_old_biometry()`**, chaque nuit à 03h15 :
```sql
DELETE FROM public.biometry_raw WHERE ts < now() - interval '30 days';
```
Trente jours pour une donnée de santé. C'est strict, et cohérent avec la
sensibilité de la donnée. Sept exécutions depuis le 19 juillet, sur une table
vide.

#### Ce que la politique promet et qui n'est pas outillé

`C:/Users/Julie/OneDrive/Desktop/oxv-app/docs/juridique/04_POLITIQUE_CONFIDENTIALITE.md:175-184`
annonce six durées de conservation. Voici ce qui les porte réellement :

| Promesse | Durée annoncée | Mécanisme en place |
|---|---|---|
| Trames télémétriques brutes | 12 mois | **oui** — `cleanup_old_telemetry_frames()` |
| Compte pilote inactif | 3 ans après dernière connexion | **aucun** |
| Documents KYC | 5 ans après dernière session | **aucun** |
| Factures et comptabilité | 10 ans | conservation, pas de purge — cohérent |
| Logs techniques | 12 mois | **aucun** identifié |
| Délai de grâce suppression | 30 jours | **oui** — `purge-deleted-accounts` |

Deux engagements sur six n'ont **aucun mécanisme**. La colonne
`users.last_login_at` existe, ce qui rendrait la purge des comptes inactifs
mécanisable. La table `documents` porte 9 lignes. Rien ne les expire
aujourd'hui.

Ce n'est pas urgent — l'application a deux mois et demi, aucun compte n'atteint
trois ans d'inactivité. Mais c'est un écart entre ce que le document juridique
affirme au pilote et ce que la machine fait. Il vaut mieux le savoir avant
qu'un pilote ne le demande.

#### Les données de santé résiduelles

Les colonnes `blood_type` et `medical_notes` **existent toujours** sur
`public.users`, malgré une migration historique nommée
`0002_remove_medical_data.sql`
(`C:/Users/Julie/OneDrive/Desktop/oxv-app/supabase/_archive_pre_timestamp/`).

Elles sont **vides** : 0 ligne renseignée sur 14 pour chacune. Le risque est
donc nul aujourd'hui. Mais des colonnes de santé ouvertes en écriture à
`authenticated` sont une invitation : la prochaine personne qui construit un
écran de profil pourrait les remplir sans savoir ce qu'elle déclenche
juridiquement. À supprimer, ou à documenter explicitement comme interdites.

De même, `ffsa_license`, `phone`, `stripe_customer_id`, `expo_push_token` sont
**vides pour les 14 comptes**. Deux comptes seulement portent une date de
naissance et un contact d'urgence.

#### Les compartiments de stockage

Treize compartiments, dont trois publics :

| Compartiment | Public | Limite de taille | Objets |
|---|---|---|---|
| `avatars` | **oui** | 5 Mo | 0 |
| `coach-media` | **oui** | — | 1 |
| `partner-media` | **oui** | — | 2 |
| `documents` | non | 10 Mo | 9 |
| `vehicles` | non | 50 Mo | 8 |
| `telemetry_raw` | non | 50 Mo | 3 |
| `audio_briefings` | non | 10 Mo | 1 |
| `founding-members` | non | 10 Mo | 1 |
| `pilot-media` | non | 50 Mo | 0 |
| `session-media` | non | 50 Mo | 0 |
| `coach-audio` | non | — | 0 |
| `invoices` | non | — | 0 |
| `pavillon-photos` | non | — | 0 |

Trois compartiments sont **publics** : tout objet qui s'y trouve est accessible
par son URL, sans authentification. Aujourd'hui ils portent 3 objets au total.
`pavillon-photos` et `partner-media` sont explicitement **hors du périmètre de
purge automatique** (commentaire de `purge-deleted-accounts/index.ts:62-63`).

`coach-media` et `partner-media` sont publics **et** contiennent des objets. Je
n'ai pas regardé ce que sont ces objets.

---

### Ce que le site partage avec l'application

#### Le fait de base

Il n'y a **pas deux bases**. Le site `oxvehicle.fr` et l'application écrivent
dans le même projet Supabase, avec les mêmes tables, les mêmes policies et le
même historique de migrations. C'est ce qui permet qu'un pilote inscrit sur le
site retrouve sa place dans l'application. C'est aussi la principale source de
risque de ce document.

Le raccordement est décrit en détail dans
`C:/Users/Julie/OneDrive/Desktop/oxv-app/docs/architecture/09_HANDOFF_SITE_BASE_PARTAGEE.md`
et les règles du dossier de migrations dans
`C:/Users/Julie/OneDrive/Desktop/oxv-app/supabase/migrations/README.md`.

#### Ce que l'application lit du côté site

Relevé par recherche sur `.from('…')` dans `src/` :

| Table ou vue du site | Lue par |
|---|---|
| `sessions_public` (vue) | `src/services/bookingCatalogService.ts:160,194` |
| `sessions` (table) | `src/services/attendanceService.ts:50`, `src/services/nextTrackDayService.ts:51`, `src/features/club/useClubHub.ts:151`, `src/features/rec/attendancePublicService.ts:94` |
| `registrations` | `src/services/attendanceService.ts:69,117`, `src/services/nextTrackDayService.ts:35`, `src/services/qdiService.ts:302`, `src/features/vous/useVousHub.ts:157`, `src/features/miroir/useMiroirHome.ts:195`, `src/features/club/useClubHub.ts:140`, `src/features/club/useGalerie.ts:114`, `src/features/rec/attendancePublicService.ts:84`, `src/services/heritageBookExportService.ts:134` |
| `pricing` | `src/services/bookingCatalogService.ts:143` |
| `events` | `src/services/eventsService.ts` (six appels), `src/services/adminAnalyticsService.ts:65-66` |

L'application dépend donc du site pour : le calendrier des journées, les
inscriptions du pilote, les tarifs, les événements. Ce ne sont pas des lectures
décoratives — `useMiroirHome`, `useVousHub` et `useClubHub` sont des écrans
d'accueil.

Note de sécurité côté site, déjà résolue : `public.sessions` porte
`private_client_name` et `private_client_contact`. Une vue
`public.sessions_public` a été créée pour exposer le calendrier **sans ces deux
colonnes** (définition vérifiée en base : elle passe par une fonction
`sessions_public_rows()` et n'expose ni l'un ni l'autre). Le brouillon de
correctif alternatif a été explicitement abandonné parce qu'il aurait cassé
l'écran admin Médias du site :
`C:/Users/Julie/OneDrive/Desktop/oxv-app/supabase/_pending_site_coordination/README.md:8-24`

#### Ce que l'application partage vers le web

`public.app_progression_shares` (**1 ligne**) porte un `share_token`, un
`share_scope`, une liste de métriques incluses, une date d'expiration, une date
de révocation et un compteur de vues. C'est le mécanisme par lequel un pilote
publie une page de progression consultable sur le web. Cinq policies le
gardent : lecture et écriture réservées au propriétaire, lecture
supplémentaire pour le coach lié.

Une seule ligne existe. Le mécanisme n'a pas été exercé.

#### L'historique des migrations

**215 migrations sont appliquées** en production (`supabase_migrations.schema_migrations`),
de `20260524000001` à `20260725185806`. Le dépôt de l'application en contient
désormais **215 fichiers**, après un travail de reconstitution : 94 d'entre
elles n'existaient dans **aucun** dépôt consultable et ont été réécrites depuis
la colonne `statements` de la table de registre.

Le registre de référence :
`C:/Users/Julie/OneDrive/Desktop/oxv-app/supabase/migrations/APPLIQUEES_EN_PRODUCTION.txt`

Onze fichiers supplémentaires sont rangés dans
`C:/Users/Julie/OneDrive/Desktop/oxv-app/supabase/migrations_hors_historique/`.
Ils sont **hors du chemin de `db push`**, volontairement, parce qu'ils sont
préparés mais non appliqués — ou appliqués sous un autre numéro. C'est le cas
de `20260719_sec1_purge_sante.sql` : la fonction qu'il définit existe en
production, posée par `20260719011309_sec1_purge_user_data`. Le fichier hors
historique en est un doublon désynchronisé.

#### Les risques que le partage crée, nommés

**1. La question du rôle n'est pas tranchée.** `users.role` et `users.is_admin`
sont écrits des deux côtés, avec deux significations. L'application garde son
espace admin derrière `is_admin`, la base garde ses policies derrière un `OU`
des deux. Si le site attribue des rôles sans le savoir, il donne ou retire des
droits en base sans le vouloir. **Question ouverte, sans réponse.**

**2. `circuits` est écrit des deux côtés.** L'application y pose les tracés,
les lignes d'arrivée et les virages détectés. Une modification côté site sur
`finish_line_lat` / `finish_line_lon` / `corners` **casserait la détection de
tours**. Il n'y a aucune barrière technique : les policies de `circuits` (huit
au total) ne distinguent pas l'origine de l'écriture.

**3. `sessions` et `telemetry_sessions` ne se rejoignent pas.** La première est
la journée au calendrier, la seconde une capture. Aucune règle de
correspondance n'existe, et une migration récente a **refusé de la deviner**
plutôt que de poser un lien faux. C'est le bon choix, mais cela veut dire que
l'application ne sait pas rattacher une capture à la journée qui l'a produite.

**4. Deux points d'entrée non authentifiés sans propriétaire.**
`capture-membre-fondateur` et `yousign-webhook`, déployés le 24 juillet, sans
source connue de ce côté-ci, `verify_jwt: false` tous les deux, dont un qui
touche la signature électronique des décharges.

**5. Cinq tables de sauvegarde hors du dispositif de purge.** Elles copient de
la donnée personnelle du site et `purge_user_data` ne les connaît pas. Aucun
des deux côtés ne se déclare propriétaire.

**6. Aucun des deux dépôts ne peut reconstruire la base seul.** Un
`supabase db reset` ou un `db push --force` détruirait la moitié du travail de
l'autre. C'est écrit noir sur blanc dans le README des migrations, règle n° 3.

**7. Le rôle `anon` a des droits d'écriture sur presque toutes les tables.**
Seules les policies RLS l'en empêchent. Une policy trop large posée d'un côté
ouvre la donnée de l'autre.

---

### Ce que je n'ai pas pu vérifier

Par honnêteté, la liste complète des angles morts de cette section.

**Rien n'a été exécuté.** Aucun écran affiché, aucun appareil connecté, aucun
boîtier RaceBox branché, aucun capteur cardiaque appairé. Tout ce qui touche au
rendu, au geste ou au matériel est une lecture de code.

**Les variables d'environnement des builds EAS.** Elles vivent sur les serveurs
Expo. Je ne sais pas ce que contiennent les jeux `development`, `preview` et
`production`, ni si les trois pointent vers la même base.

**La source réelle de la plupart des fonctions edge.** J'ai lu le code déployé
d'une seule (`purge-deleted-accounts`) et le code du dépôt de deux autres. Pour
les 31 restantes, je n'ai que le fichier du dépôt — qui peut différer du
déployé, comme l'en-tête périmé de `purge-deleted-accounts` vient de le
démontrer.

**La source de `capture-membre-fondateur` et `yousign-webhook`.** Introuvable
de ce côté.

**Le corps de `purge_user_data`.** La liste des tables qu'elle couvre vient
d'un commentaire, pas d'une lecture du SQL.

**L'efficacité réelle de l'anti-force-brute de `pair-app`.** Annoncée dans un
commentaire, non vérifiée dans le code déployé.

**L'exploitabilité de l'escalade `is_admin`.** Trois faits vérifiés
séparément (policy, droit de colonne, portée du déclencheur) construisent le
chemin. **Je ne l'ai pas exécuté** : cela aurait été une écriture en production.

**Le comportement anonyme sur `events_select_private`.** Le texte de la policy
dit ce qu'il dit ; je n'ai pas émis de requête sans jeton pour le confirmer.

**Les cinq tâches nocturnes.** `net._http_response` ne conserve que quelques
heures ; je n'ai de preuve HTTP que pour les deux tâches horaires.

**Le contenu des trois compartiments de stockage publics.** Je sais qu'ils
portent trois objets. Je ne sais pas lesquels.

**Le sens métier des tables du site.** Je décris ce que le schéma montre, pas
ce que le produit veut dire.

---

## La chaîne de capture, du boîtier à la base

### Avertissement de méthode

Tout ce qui suit est une **lecture du code source** du dépôt
`C:/Users/Julie/OneDrive/Desktop/oxv-app`, branche `feat/site-document-emails`,
et une **interrogation en lecture seule** de la base de production
`fouvuqkdxarjpjbqnsjq`.

Aucune application n'a été lancée. Aucun boîtier RaceBox, aucune ceinture Polar,
aucun téléphone n'a été mis en service. Quand j'écris « l'écran affiche » ou
« le boîtier envoie », je décris ce que le code prévoit de faire, pas ce que
j'ai vu se produire.

Une seule chose a été **exécutée** : la suite de tests unitaires de la chaîne de
capture (voir la fin de section). Les tests s'exécutent sur des simulacres de
Bluetooth, de disque et de réseau — ils prouvent la logique, pas le matériel.

---

## Le résumé en une page

La chaîne existe, elle est complète de bout en bout, elle est fortement testée,
et elle n'a **jamais tourné pour de vrai**.

| Fait | Source |
|---|---|
| La chaîne compte 9 maillons, du Bluetooth à l'écriture Supabase | `src/ble/bluetoothService.ts`, `src/ubx/parser.ts`, `src/services/captureSessionService.ts`, `src/services/captureSyncQueue.ts` |
| 127 tests unitaires couvrent la chaîne, tous au vert | exécution du 26/07/2026, 7 suites |
| La base de production contient **53 trames** de télémétrie, au total, depuis toujours | `select count(*) from telemetry_frames` |
| Ces 53 trames viennent d'une seule séance, du 28/06/2026, vitesse maximale **0,83 km/h** | `telemetry_frames`, session `7f40d5ad-4697-44ac-861c-13b7d0cc9878` |
| La table `laps` contient **1 ligne**, datée du 16/05/2026, d'une durée de **0,022 seconde** | `select * from laps` |
| 18 séances existent : 10 « completed », 8 « aborted », 0 en cours | `telemetry_sessions` |
| Aucun boîtier n'est déclaré dans la flotte | `select count(*) from devices` → 0 |
| Aucune donnée cardiaque n'existe en base | `select count(*) from biometry_raw` → 0 |

Autrement dit : **le code de capture est mûr, la preuve terrain est absente.**
La séance de piste réelle qui validerait la chaîne n'a pas encore eu lieu.

---

## La chaîne, maillon par maillon

Le trajet complet d'une mesure, du capteur à la ligne SQL :

```
RaceBox Mini S (25 Hz, Bluetooth LE)
  │
  ├─1─ bluetoothService.subscribeToData()      src/ble/bluetoothService.ts:372
  │      notification BLE → base64 → octets
  │
  ├─2─ UbxFrameBuffer.push()                   src/ubx/parser.ts:106
  │      resynchronisation, découpe des trames
  │
  ├─3─ parseRaceBoxDataMessage()               src/ubx/parser.ts:55
  │      88 octets → objet RaceBoxData
  │
  ├─4─ emitData() → tous les abonnés           src/ble/bluetoothService.ts:241
  │      ├── lapDetectionRunner (abonné EN PREMIER)
  │      ├── captureSessionService.onData
  │      ├── captureMode (flux brut, fichier .ubx)
  │      ├── liveRelayRunner (relais coach, si consenti)
  │      └── initBle → useTelemetryStore
  │
  ├─5─ raceBoxToFrameInsert()                  src/services/captureFrameMapping.ts:75
  │      RaceBoxData → ligne telemetry_frames
  │
  ├─6─ flush() par lots de 50 ou toutes les 4 s  src/services/captureSessionService.ts:584
  │      insert direct Supabase
  │      └── en cas d'échec → enqueue('frames')
  │
  ├─7─ captureSyncQueue : fichiers JSON sur disque  src/services/captureSyncQueue.ts
  │      FIFO strict, rejeu, quarantaine
  │
  ├─8─ processQueue() → Supabase                src/services/captureSyncQueue.ts:861
  │
  └─9─ telemetry_sessions / telemetry_frames / laps / bucket telemetry_raw
```

---

## Maillon 1 — Le boîtier et le lien Bluetooth

### Ce que l'app cherche

Le service BLE est un singleton, instancié au chargement du module :
`src/ble/bluetoothService.ts:833`.

Le scan RaceBox filtre sur **deux critères cumulés**
(`src/ble/bluetoothService.ts:289-309`) :

- le service BLE annoncé `6E400001-B5A3-F393-E0A9-E50E24DCCA9E` (UART Nordic),
  déclaré dans `src/types/telemetry.ts:14` ;
- le nom du périphérique commençant par `RaceBox` (`src/types/telemetry.ts:23`).

Les trames arrivent en notification sur la caractéristique
`6E400003-...` (TX), abonnée dans `subscribeToData`
(`src/ble/bluetoothService.ts:378`).

### Les permissions

`src/ble/permissions.ts` distingue trois cas :

- iOS : `PERMISSIONS.IOS.BLUETOOTH`, une seule demande ;
- Android 12 et plus : `BLUETOOTH_SCAN` + `BLUETOOTH_CONNECT` ;
- Android antérieur : `ACCESS_FINE_LOCATION` (le scan BLE y est traité comme
  une géolocalisation).

Les libellés de permission iOS sont dans `app.json:20-31`. La cible de build
étant iOS, c'est le premier chemin qui compte.

### Le point dur : pas de Bluetooth en arrière-plan

`app.json:75-82` déclare le module BLE avec **`"isBackgroundEnabled": false`**.
Aucun `UIBackgroundModes` n'est déclaré dans `infoPlist`.

Conséquence, telle qu'assumée dans le code
(`src/services/captureSessionService.ts:101-109`) : la capture ne tourne que
**premier plan, écran allumé**. Pour tenir un relais de vingt minutes sans que
l'auto-verrouillage coupe la radio, le service pose un verrou d'écran
`expo-keep-awake` avec le tag `oxv-capture`
(`src/services/captureSessionService.ts:112-125`), armé au démarrage
(ligne 411) et relâché à l'arrêt (lignes 739, 834, 495, 554).

Si le pilote quitte l'application ou verrouille manuellement son téléphone
pendant un run, **le système peut couper la radio**. Le code le dit lui-même
en commentaire ; je n'ai pas pu l'observer.

### La reconnexion : deux étages, et ils se coordonnent

**Étage 1 — dans le service BLE.** Déclenché par `device.onDisconnected`
(`src/ble/bluetoothService.ts:362`), aiguillé par `handleDeviceDisconnected`
(ligne 422). Une coupure volontaire (drapeau `userInitiatedDisconnect`) ne
déclenche rien ; une coupure inattendue lance `handleUnexpectedDisconnection`
(ligne 480).

Le délai suit un palier géométrique plafonné, isolé dans un module pur
`src/ble/reconnectPolicy.ts:39` : 2 s, 4 s, 8 s, 16 s, puis **30 s au maximum**.

Deux modes de renoncement (`src/ble/reconnectPolicy.ts:52`) :

- **borné** (défaut, hors capture) : abandon après 5 tentatives
  (`RECONNECT_MAX_ATTEMPTS`, ligne 17), phase terminale `lost` ;
- **illimité** : armé pendant une capture par
  `bluetoothService.setUnlimitedReconnect(true)`
  (`src/services/captureSessionService.ts:410`), désarmé à la clôture
  (lignes 494, 553, 738, 833). En illimité, on retente **sans fin**, au même
  palier plafonné.

**Étage 2 — le chien de garde applicatif.** `src/ble/initBle.ts:134` garde un
second cycle de reconnexion (2 s, 5 s, 10 s, 20 s, seuil d'erreur 30 s) et la
modale paddock. La coordination est explicite : sur `disconnected`, si
`bluetoothService.isReconnecting()` est vrai, le chien de garde **ne programme
pas** un second appel concurrent (`src/ble/initBle.ts:122-126`).

### En Expo Go, le BLE n'existe pas

`loadBleManagerCtor` (`src/ble/bluetoothService.ts:43`) charge
`react-native-ble-plx` par `require` protégé. Si le module natif est absent, le
service passe en mode inerte : `isAvailable()` renvoie `false` et chaque appel
émet une erreur « Bluetooth indisponible dans ce runtime (Expo Go) ».
`app/_layout.tsx:51-56` n'appelle `initBle()` que hors Expo Go.

---

## Maillon 2 — Le parser UBX

`src/ubx/parser.ts`, 153 lignes. C'est le **seul fichier de la chaîne qui n'a
jamais été modifié depuis l'initialisation du dépôt** (dernier commit
`f7fe331`, « chore: initialisation projet »).

### La reconstruction du flux

Le Bluetooth ne livre pas des trames, il livre des paquets d'octets.
`UbxFrameBuffer` (`src/ubx/parser.ts:106`) accumule et découpe :

- il cherche l'en-tête `0xB5 0x62` et **jette octet par octet** tant qu'il ne
  le trouve pas (ligne 123) — c'est la resynchronisation ;
- il lit la longueur de charge utile aux octets 4-5, calcule la taille totale
  `6 + longueur + 2` (ligne 128) ;
- il refuse toute trame annoncée à plus de 512 octets (ligne 130), garde
  contre un octet de longueur corrompu ;
- il attend d'avoir la trame entière avant de la livrer (ligne 135).

### La validation

`isRaceBoxDataMessage` (ligne 35) exige **quatre conditions** : taille exacte
de 88 octets, en-tête correct, classe `0xFF` / identifiant `0x01`, et checksum
Fletcher-8 valide (`computeChecksum`, ligne 15). Une trame qui échoue est
silencieusement ignorée.

### Ce qui est extrait, et à quelle unité

`parseRaceBoxDataMessage` (ligne 55) lit en little-endian :

| Champ | Décalage | Conversion |
|---|---|---|
| iTOW (temps GPS) | 6 | uint32, millisecondes |
| date/heure | 10-16, 22 | champs séparés |
| fix GPS | 26 | `0` aucun, `2` 2D, `3` 3D (`src/types/telemetry.ts:26`) |
| satellites | 29 | uint8 |
| longitude | 30 | int32 ÷ 1e7 |
| latitude | 34 | int32 ÷ 1e7 |
| altitude | 42 | int32 ÷ 1000 → mètres |
| précision GPS | 46 | uint32 ÷ 1000 → mètres |
| vitesse | 54 | uint32 × 3,6 ÷ 1000 → km/h |
| cap | 58 | uint32 ÷ 1e5 → degrés |
| g X / Y / Z | 74, 76, 78 | int16 ÷ 1000 → g |
| rotation X / Y / Z | 80, 82, 84 | int16 ÷ 100 → °/s |
| batterie | 73 | bit 7 = en charge, bits 0-6 = niveau |

Le cap n'est retenu que si le bit 5 des drapeaux de fix est posé
(`headingValid`, ligne 86).

### Ce que le parser ne lit pas

Les colonnes `pdop`, `speed_accuracy` et `heading_accuracy` **existent en base**
(vérifié sur `information_schema.columns`) mais ne sont ni extraites par le
parser ni écrites par le mapper `src/services/captureFrameMapping.ts:75`.
Elles resteront `null` sur toute trame produite par cette chaîne.

---

## Maillon 3 — La ceinture cardio Polar

### Un chemin entièrement séparé

Ajouté le 25/07/2026 (commit `8ba669d`). Le code est explicite
(`src/ble/bluetoothService.ts:26-31`) : périphérique, abonnements et
reconnexion **propres**, aucun couplage d'échec avec le RaceBox.

- Service GATT standard `0000180d-...` (Heart Rate), caractéristique
  `00002a37-...` en notification (`src/ble/bluetoothService.ts:32-36`).
- Filtre de nom sur le préfixe `Polar` (ligne 675).
- Scan dédié `startPolarScan` (ligne 653), connexion `connectPolar` (ligne 693).
- Reconnexion **bornée**, jamais illimitée : `shouldGiveUpReconnect(attempt,
  false)` en dur ligne 767 — « la ceinture est secondaire ».

### Le décodage

`src/services/v2/heartRateParser.ts:68`, fonction pure, sans entrée-sortie.
Elle lit l'octet de drapeaux, gère la fréquence sur 8 ou 16 bits, l'état de
contact des électrodes (`ok` / `poor` / `unsupported`, lignes 113-114), saute
le champ « énergie dépensée » si présent, et décode les intervalles R-R en
unités de 1/1024 s converties en millisecondes **sans arrondi** (ligne 109) —
l'arrondi fausserait la variabilité cardiaque.

Toute trame tronquée renvoie `null` (lignes 70, 85, 89, 97, 106). Rien n'est
inventé.

### Les verrous de consentement

`src/services/biometryCaptureRunner.ts:174` arme la capture cardio locale
**seulement si** :

1. le drapeau serveur `biometry` est actif (ligne 187) ;
2. le pilote a donné son consentement de **capture** (ligne 189).

Sans l'un des deux, le module est dormant : aucun abonnement, aucune
entrée-sortie. Le troisième verrou (partage coach) ne concerne que le relais
live, pas la conservation de ses propres données.

Les échantillons vont dans un registre MMKV **séparé** de la file de capture
(`src/features/rec/biometryCaptureBuffer.ts`), persistés toutes les 10 secondes
(`PERSIST_INTERVAL_MS`, ligne 36). Une séance **abandonnée** purge le local sans
jamais rien conserver (`discardBiometryCapture`, ligne 222), appelée depuis
`src/services/captureSessionService.ts:837`.

### L'état réel en production

- Le drapeau `biometry` est **actif** depuis le 25/07/2026 17:58 UTC
  (table `app_feature_flags`). Son propre commentaire en base indique :
  « Reste non tenu à la levée : smoke test 2 appareils reels ».
- La table `biometry_raw` contient **0 ligne**.

Le chemin cardio n'a donc jamais produit de donnée.

---

## Maillon 4 — La machine à états du pilote

`src/store/useAppStateStore.ts`, 122 lignes. C'est la source de vérité de
l'état `S1..S10` du pilote, recalculé par `determineState`
(`src/types/state.ts:267`) à chaque changement de contexte.

### Le lien avec le silence en piste

`recompute()` (`src/store/useAppStateStore.ts:96`) pose un drapeau global de
silence : `setSilenceMode(isSilentState(next))` (ligne 112).
`isSilentState` ne renvoie vrai que pour `S6_roulage`
(`src/types/state.ts:230`). Le drapeau est lu par les primitives basses
(haptique) via `src/lib/silence.ts`.

### Un constat qu'il faut connaître

`determineState` bascule en `S6_roulage` uniquement si `ctx.activeRecording`
est renseigné **et** que la vitesse moyenne récente dépasse 60 km/h
(`src/types/state.ts:271-274`).

Or **`setActiveRecording` n'est appelé nulle part dans l'application.** Une
recherche sur tout le dépôt ne renvoie que sa déclaration et son implémentation
dans le store (`src/store/useAppStateStore.ts:46` et `:80`), plus une mention
dans un document de tickets (`docs/refonte-app/11_DEV_TICKETS.md:190`). Ni
`captureSessionService`, ni les écrans de capture ne le posent.

Conséquences, lues dans le code :

- l'état `S6_roulage` n'est jamais atteint ;
- `setSilenceMode(true)` n'est donc jamais déclenché par la machine à états ;
- le silence en piste est en pratique tenu par **l'écran** — `rec/roulage.tsx`
  n'affiche qu'un point et le mot « REC » — et non par le garde-fou runtime
  prévu au commit `9f1f3f0`.

Je n'ai pas pu vérifier si un autre mécanisme compense. Le point mérite une
décision de votre part.

### Le store de session, lui, est bien piloté

`src/store/useSessionStore.ts` est un store distinct, qui porte les compteurs
vivants (`lapCount`, `bestLapMs`, `status`). Celui-là est bien appelé par la
capture : `startSession` (`captureSessionService.ts:381`), `pauseSession`
(ligne 455), `resumeSession` (ligne 464), `endSession` (ligne 760),
`abortSession` (ligne 853), `registerLap` (`lapDetectionRunner.ts:116`).

---

## Maillon 5 — Le service de capture

`src/services/captureSessionService.ts`, 869 lignes. C'est le chef d'orchestre.

### Le démarrage : rien n'attend le réseau

`startCaptureSession` (ligne 260) suit un ordre précis :

1. **Identifiant généré côté client** : `newUuid()` (ligne 263), un UUID v4
   fabriqué localement (`captureSyncQueue.ts:158`). L'app ne demande pas au
   serveur la permission d'enregistrer.
2. **Création de séance mise en file**, pas envoyée :
   `enqueue({ type: 'create_session', ... })` (ligne 282). Si le disque est
   indisponible, on avertit en console et **on démarre quand même** (ligne 284).
3. **Rattachement d'intention**, si le pilote en a posé une en préparation
   (lignes 301-317). L'identifiant est lu **localement**
   (`peekPendingIntentionId`) — une requête réseau échouerait précisément en
   mode avion. L'ordre d'enfilement (après `create_session`) est verrouillé par
   un test (`captureSessionService.test.ts:520`).
4. **Drain en arrière-plan** : `void processQueue()` (ligne 321). Si le réseau
   est là, l'insert part tout de suite ; sinon il attend.
5. **Ligne d'arrivée** : `input.finishLine`, ou le repli `BELTOISE_FINISH`
   (ligne 96) avec un avertissement console explicite (ligne 325).
6. **Capture .ubx locale** démarrée (ligne 359), jamais bloquante.
7. **Détection de tours** démarrée (ligne 373) — et l'ordre est porteur, voir
   maillon 6.
8. **Abonnement au flux BLE** (ligne 391).
9. **Reconnexion illimitée armée** + verrou d'écran (lignes 410-411).
10. **Suivi de reconnexion** abonné (ligne 416).
11. **Relais live coach** lancé si consenti (ligne 424), muet côté pilote.
12. **Capture cardio** lancée si les verrous passent (ligne 433).

`startCaptureSession` **ne renvoie jamais d'échec pour cause de réseau absent**.
Le seul refus possible est « Une capture est déjà active » (ligne 261).

### Le cœur : `elapsed_ms` strictement croissant

C'est l'invariant le plus important de toute la chaîne.

`nextElapsedMs` (`src/services/captureFrameMapping.ts:43`) :

```ts
return Math.max(nowMs - startMs, lastElapsed + 1);
```

Le `+ 1` n'est pas une coquetterie. `elapsed_ms` est la **clé d'idempotence**
des trames : `UNIQUE (session_id, elapsed_ms)` en base, `ON CONFLICT DO NOTHING`
côté file. Une suite seulement non-décroissante produirait des ex æquo, et
deux trames **réelles et distinctes** partageraient une clé — l'une serait
détruite en silence.

Trois causes réelles d'ex æquo sont documentées lignes 21-28 : plusieurs trames
livrées dans la même notification BLE, un blocage du fil JavaScript qui délivre
les notifications dos à dos, et un **recul d'horloge** (resynchronisation NTP au
retour du réseau).

L'arbitrage est assumé : pendant un recul d'horloge, l'horodatage avance de 1 ms
par trame, le minutage est temporairement comprimé, mais **aucune trame n'est
détruite**. `itow_ms` reste stocké sur chaque ligne pour le temps GPS exact.

### Le vidage du tampon : deux régimes

`flush` (ligne 584) est non réentrant : un appel concurrent renvoie la promesse
en cours (ligne 585).

- **Régime courant** (`final = false`) : on ne traite que le **retard présent à
  l'entrée** (`remaining = state.buffer.length`, ligne 589), par lots de 50.
  Les trames arrivées pendant l'écriture attendent le déclencheur suivant.
  La raison est écrite lignes 566-574 : drainer aussi celles-là faisait courir
  la boucle derrière un producteur à 25 Hz, la taille de lot s'effondrait vers
  4 lignes en 4G, et une séance de vingt minutes tirait des dizaines de milliers
  de requêtes d'une poignée de lignes.
- **Régime final** (`final = true`, ligne 635) : on vide tout. Sûr parce que
  `drain()` n'est appelé qu'**après** `state.unsubData()` — plus aucune trame
  n'arrive.

Déclencheurs : 50 trames accumulées (`FLUSH_EVERY_FRAMES`, ligne 98) ou
4 secondes (`FLUSH_INTERVAL_MS`, ligne 99, minuterie ligne 405).

### Quand l'insert direct échoue

Ligne 597-611 : le lot n'est **pas perdu**. Il est remis en file sur fichier
(`enqueue({ type: 'frames' })`) et compté dans `state.requeued`. Si même le
disque est indisponible, on avertit et le fichier `.ubx` local reste le filet
ultime.

### Les maxima, accumulés à la source

Deux jeux d'accumulateurs :

- **par séance** : `updateMaxima` (`captureFrameMapping.ts:122`) — vitesse max,
  |g latéral| max, |g longitudinal| max ;
- **par tour** : `updateLapMaxima` (ligne 187) — vitesse max, latéral max,
  freinage max (part positive de `gForceX`), accélération max (part positive de
  `−gForceX`), somme et compte des vitesses pour la moyenne.

La convention d'axes est verrouillée : **`gForceY` = latéral, `gForceX` =
longitudinal avec x positif = freinage** (ligne 181-185).

Le point de doctrine est explicite lignes 130-141 : ces colonnes existaient en
base depuis la migration `0004` mais n'étaient **jamais écrites**, et aucun
déclencheur ne les calculait. `computeSmoothness` lisait `max_g_lateral ?? 0`
sur tous les tours, l'écart-type tombait à zéro, et la fluidité valait 100 sur
100 % des séances réelles. Un quart de la marge globale ne venait d'aucune
mesure.

Depuis la correction, un tour sans trame rattachée reste `null` de bout en bout
(`lapMaximaToColumns`, ligne 216). On écrit du réel, ou rien.

### L'arrêt : l'ordre compte

`stopCaptureSession` (ligne 723) :

1. `current = null` **synchrone**, avant tout `await` (ligne 726) — un second
   appel concurrent court-circuite.
2. Statut de lien remis à `idle` (ligne 730).
3. Désabonnements flux + reconnexion (lignes 734-735).
4. Reconnexion illimitée désarmée, verrou d'écran relâché, minuterie
   d'interruption annulée (lignes 738-740).
5. Relais live coupé (741), cardio préservé (742), minuterie de vidage arrêtée
   (743).
6. **Vidage final** attendu (`await drain`, ligne 744).
7. Gel du dernier tour (`freezeCurrentLap`, ligne 754) — sans lui, le tour en
   cours partirait avec des colonnes vides alors qu'il a bien été mesuré.
8. Arrêt de la détection, relevé des tours et des compteurs (755-760).
9. Fermeture du `.ubx` local (765).
10. Mise en file, **dans l'ordre FIFO** : `laps` (779), puis `complete` (785),
    puis `ubx_upload` (806).
11. Drain en arrière-plan (819).

### L'abandon

`abortCaptureSession` (ligne 825) suit le même démontage, mais :
`discardBiometryCapture()` purge le cardio local (837), aucun tour n'est
persisté, et une op `complete` avec `status: 'aborted'` est mise en file
(ligne 860). Le commentaire lignes 855-859 explique pourquoi c'est
indispensable : hors ligne, le `create_session` dort peut-être encore dans la
file ; sans cette clôture rejouée, il ressusciterait une séance en `recording`
fantôme.

---

## Maillon 6 — La détection des tours et la ligne d'arrivée

### L'ordre d'abonnement est une garantie

`lapDetectionRunner` s'abonne au flux BLE **avant** le service de capture
(`captureSessionService.ts:373` précède `:391`). Pour une trame donnée, le
runner a donc déjà arbitré le franchissement quand la capture lit
`getCurrentLapNumber()` (`lapDetectionRunner.ts:168`). C'est ce qui permet de
rattacher chaque trame au bon tour **sans redétecter**.

Le commentaire `captureSessionService.ts:366-369` désigne cet ordre comme
porteur. Il n'est protégé par rien d'autre que ce commentaire et l'ordre
d'écriture des lignes.

### Deux horloges, deux usages

`lapDetectionRunner.ts:94-105` :

- `wallNow` = `Date.now()`, horloge **murale**, sert à horodater les dates de
  début et de fin de tour (`startedAtMs` / `endedAtMs` → ISO) ;
- `monoNow` = base **monotone** (`nextMonotonic`, `src/utils/monotonicClock.ts:25`),
  sert à **mesurer** la durée et à appliquer le délai de garde.

Une durée est toujours la différence de deux instants monotones (ligne 114),
donc toujours positive, jamais faussée par un recul d'horloge.

### Deux modes de détection

`src/utils/lapDetection.ts` implémente deux algorithmes, choisis par la présence
ou l'absence d'un **cap** de franchissement.

**Mode PORTE** (dès qu'un cap est fourni, ligne 289) : la porte est un segment
perpendiculaire à la piste, centré sur la ligne, de demi-longueur
`finishLineRadius`. Un tour est compté quand le segment
[point précédent → point courant] coupe ce segment, **dans le sens du cap**
(`processGateCrossing`, ligne 195).

Trois garde-fous dans ce mode :

- `MAX_STEP_M = 50` (ligne 93) : après un trou de données (reconnexion BLE,
  perte de fix), les deux points encadrent plusieurs centaines de mètres et le
  segment qui les relie n'est pas une trajectoire. Au-delà de 50 m, on
  **n'évalue pas** le franchissement. « Un tour manqué se voit ; un faux tour
  corrompt le bilan en silence. »
- sens obligatoire (ligne 222) : un retour aux stands à contresens ne boucle pas
  un tour ;
- délai de garde de 10 s (`COOLDOWN_MS`, ligne 81).

La justification du mode porte est chiffrée sur des relevés réels
(lignes 17-20) : à Haute Saintonge, la voie des stands est à 22,9 m de la ligne
avec 2,3° d'écart de cap ; à Ricardo Tormo, 16,2 m et 0,4° d'écart. En mode
rayon, la fenêtre admissible à Valence est de 20 centimètres — et vide dès que
la voie des stands fait sa largeur normale. **Aucun rayon ne peut à la fois
couvrir la piste et exclure les stands.**

**Mode RAYON** (repli, ligne 292) : entrée dans un disque autour de la ligne.
Comportement historique, sans aucune vérification de direction.

### Le premier passage ne compte pas

`lapDetectionRunner.ts:130-135` : le premier franchissement clôt l'outlap. Il
mémorise le point de départ du premier tour chronométré **sans le compter**.
`getCurrentLapNumber()` renvoie `0` tant que ce premier passage n'a pas eu lieu
(ligne 169), et `freezeCurrentLap` n'archive que les numéros ≥ 1
(`captureSessionService.ts:668`). Les trames d'approche ne sont donc jamais
attribuées au tour 1.

### La résolution de la ligne d'arrivée

`src/services/captureFinishLineLogic.ts:35`, fonction pure :

- coordonnées non finies → `undefined` (ligne 40) ;
- **0/0 → `undefined`** (ligne 43), parce que le mapping circuit met 0 par
  défaut : « on ne détecte pas de tours sur une fausse ligne plutôt que d'en
  inventer » ;
- rayon non renseigné ou négatif → 40 m par défaut (ligne 33) ;
- cap non relevé → la clé est simplement **absente**, jamais inventée
  (ligne 51) : la détection reste en mode rayon.

### Ce qui manque pour un circuit non renseigné

C'est la question directe posée. La réponse est nette.

Si `captureFinishLineFor` renvoie `undefined`, `startCaptureSession` retombe sur
`BELTOISE_FINISH` (`captureSessionService.ts:96`) :
`{ lat: 45.6004, lon: -0.141, radiusM: 40 }`. Le commentaire ligne 91-95 est
sans ambiguïté : **« Ces coordonnées ne correspondent à aucun circuit réel :
si on retombe dessus, les tours ne seront PAS comptés. »** Un avertissement
console est émis (ligne 325).

Il manque donc, pour un circuit non renseigné :

1. **Les coordonnées de la ligne d'arrivée** (`finish_line_lat`,
   `finish_line_lon`). Sans elles : zéro tour détecté, `lap_count = 0`,
   `best_lap_seconds = null`, table `laps` vide, et tout ce qui en dérive
   (régularité, fluidité par tour, records) est absent.
2. **Le cap de franchissement** (`finish_line_heading`). Sans lui, mode rayon :
   la voie des stands compte comme un passage sur tout circuit où elle est
   parallèle à la ligne — c'est-à-dire à peu près tous.
3. **Le rayon / la demi-largeur** (`finish_line_radius_m`). À défaut, 40 m est
   appliqué, ce qui est large en mode porte.

### L'état réel des circuits en production

Quatre circuits en base, tous interrogés le 26/07/2026 :

| Circuit | Officiel | Ligne | Rayon | Cap | Mode de détection |
|---|---|---|---|---|---|
| Charente | oui | 45,627473 / −0,2767456 | 35 m | 53,40° | porte |
| Circuit Ricardo Tormo | oui | 39,483568 / −0,631076 | 10 m | 55,20° | porte |
| Haute Saintonge | oui | 45,240578 / −0,094391 | 15 m | 298,50° | porte |
| La charade | non | 45,5988038 / −0,1338882 | 30 m | **null** | **rayon** |

Les trois circuits officiels sont renseignés cap compris. « La charade » n'a pas
de cap : elle tombe en mode rayon, sans exclusion de voie des stands.

Il existe deux fichiers SQL de calibration prêts à l'emploi dans le dépôt :
`docs/SQL_CALIBRATION_HAUTE_SAINTONGE.sql` et
`docs/SQL_CALIBRATION_RICARDO_TORMO.sql`.

---

## Maillon 7 — La file de synchronisation hors ligne

`src/services/captureSyncQueue.ts`, 1 234 lignes. C'est la pièce la plus dense
du dépôt et la plus défensive.

### Pourquoi un fichier et pas MMKV

Écrit ligne 4-8 : la file MMKV d'`offlineQueue` porte de petites actions
unitaires. La capture produit des dizaines de milliers de trames par séance,
plusieurs mégaoctets. Chaque **opération** est donc un fichier JSON sous
`${documentDirectory}capture-queue/`.

### L'ordre FIFO est dans le nom du fichier

`nextFileName` (ligne 228) :
`${horodatage sur 15}-${séquence sur 6}-${type}.json`.

L'horodatage est rendu non décroissant dans un run (`Math.max` avec le dernier,
ligne 229), la séquence casse les ex æquo. **Le tri lexicographique des noms
équivaut à l'ordre d'insertion.** Au redémarrage (séquence remise à zéro), les
opérations d'un run précédent portent un horodatage antérieur et passent donc
en premier.

### L'écriture est atomique

`writeEnvelopeAtomic` (ligne 338) écrit un `.tmp` puis le renomme. Le `.tmp` ne
finit pas par `.json`, le drain ne le voit donc jamais ; le renommage rend le
fichier visible d'un coup, complet ou pas du tout.

La raison est nommée ligne 334-336 : sur Android, `writeAsStringAsync` écrit en
flux hors du fil JavaScript — un fichier à demi écrit y était listable, donc
lisible tronqué. iOS écrit déjà atomiquement ; on unifie pour ne pas dépendre du
système.

Un `.tmp` orphelin (crash pendant une écriture) est balayé au démarrage par
`sweepOrphanTmp` (ligne 362) et mis en quarantaine, jamais supprimé.

### Les six opérations

| Type | Effet | Idempotence |
|---|---|---|
| `create_session` | upsert `telemetry_sessions` | `onConflict: 'id'` (ligne 636) |
| `attach_intention` | update `session_intentions.session_id` | idempotent par nature (ligne 651) |
| `frames` | upsert lot `telemetry_frames` | `(session_id, elapsed_ms)`, ignore doublons (ligne 601) |
| `laps` | upsert lot `laps` | `(session_id, lap_number)`, ignore doublons (ligne 624) |
| `complete` | update `telemetry_sessions` | idempotent, **recompte** `total_frames` (ligne 679) |
| `ubx_upload` | upload Storage | `upsert: true` (`telemetryStorage.ts:58`) |

### La classification des erreurs : liste blanche d'abandon

C'est le point le plus important du module, et il a une histoire. Le commentaire
ligne 440 le dit : « l'ancienne règle *tout code ⇒ abandon* faisait détruire une
séance entière par un 503 ».

La règle actuelle (`isDroppableCode`, ligne 442) :

- **Transitoire explicite** : PostgREST `PGRST000/001/002` (ligne 414 —
  `PGRST002` survient dans les secondes qui suivent une migration, soit
  exactement la manœuvre prévue en production le jour J) ; SQLSTATE classes
  `08` connexion, `40` sérialisation, `53` ressources épuisées (dont le
  « too many clients » de fin de roulage), `57` intervention opérateur
  (ligne 422).
- **Abandon** : SQLSTATE classes `22` donnée invalide, `23` intégrité, `42`
  syntaxe/privilège ; PostgREST `PGRST202/205` ; fichier source absent
  (ligne 490).
- **Deux exceptions dans la classe 23** :
  - `23503` (violation de clé étrangère) n'est **pas** une erreur de donnée,
    c'est un signal d'**ordonnancement** — le `create_session` n'est pas encore
    passé. On conserve et on laisse le FIFO rejouer (ligne 448).
  - `23505` (violation d'unicité) : les lignes sont déjà en base ou le lot doit
    être absorbé en upsert. « Jeter 50 trames pour une collision sur une seule
    serait absurde » (ligne 452).
- **Défaut pour tout code inconnu : TRANSITOIRE** (ligne 456). C'est
  l'inversion de charge de la preuve : « un code qu'on ne sait pas lire
  n'autorise pas à détruire la donnée d'un pilote ».

**Garde dure** (ligne 488) : une opération `create_session` n'est **jamais**
abandonnée, même sur une erreur parfaitement logique. La ligne de séance porte
la clé étrangère de toutes les trames et de tous les tours en `ON DELETE
CASCADE` : l'abandonner ferait tomber la séance entière, en silence. « Mieux
vaut une file bloquée — visible, réparable — que des heures de piste effacées. »

**Cas Storage** (ligne 471) : `storage-js` n'expose que `status`, jamais `.code`.
On n'abandonne que 400, 413 et 415. Surtout pas 401/403 (jeton expiré, mauvais
pilote connecté) ni 404 (bucket absent) — ce sont des erreurs réparables.

### La quarantaine, jamais la suppression

Une opération abandonnée est **déplacée** sous `capture-queue/quarantine/`
(`quarantineOp`, ligne 316), jamais détruite. « La file repart, mais la donnée du
pilote reste inspectable et rejouable à la main. » Chaque mise en quarantaine
est remontée à Sentry (lignes 326, 766, 786, 807).

### La bascule 42P10 et son ré-armement

`writeIdempotent` (ligne 541) gère le cas où la contrainte UNIQUE n'existe pas
encore en production :

1. upsert nominal ;
2. sur `42P10` (« no unique or exclusion constraint matching the ON CONFLICT
   specification »), bascule sur un `insert` simple, avec un avertissement émis
   **une seule fois** ;
3. si un `23505` survient **en mode repli**, c'est la preuve que la contrainte
   est apparue entre-temps : on ré-arme la bascule et on rejoue en upsert.

**État réel en production** : les deux contraintes existent.
`telemetry_frames_session_elapsed_unique` sur `(session_id, elapsed_ms)` et
`laps_session_lap_number_unique` sur `(session_id, lap_number)`, appliquées par
les migrations `20260716165100_valencia_telemetry_frames_unique.sql` et
`20260716165129_valencia_laps_unique.sql`. Le chemin de repli est donc dormant.

### Le drain, et son rejeu coalescé

`processQueue` (ligne 861) n'est pas réentrant, mais un appel concurrent n'est
pas **avalé** : il est mémorisé (`rerunRequested`, ligne 736) et la passe est
rejouée avant de rendre la main.

Deux cas réels justifient ce mécanisme (lignes 846-850) : le retour de réseau
pendant l'upload `.ubx` de fin de séance (le déclencheur était perdu, plus rien
ne partait), et le `create_session` de la séance **suivante** enfilé pendant ce
même upload (toute la séance 2 partait alors en `23503`, lot par lot, sur
disque).

Le rejeu ne couvre **que** la fin de liste normale, **jamais** un arrêt réseau
(ligne 875) : rejouer après un échec réseau ferait boucler en marteau sur un
réseau absent.

`drainOnce` (ligne 752) s'arrête au premier échec transitoire et **garde ce
fichier et tous les suivants** (ligne 825), FIFO préservé.

### L'upload `.ubx` est une opération feuille

Ligne 795-823 : contrairement à `create_session`, aucune autre opération ne
dépend d'un upload. Arrêter le drain entier ferait bloquer à vie toutes les
séances suivantes derrière un upload durablement en échec. On le **saute**, on le
garde sur disque, on compte la tentative, et au bout de
`MAX_UPLOAD_ATTEMPTS = 10` (ligne 222) on le met en quarantaine.

### Le ménage des `.ubx` : trois verrous

`gcOldCaptures` (ligne 1002), rétention 7 jours (`UBX_MAX_AGE_MS`, ligne 935) :

1. **File non vide ⇒ aucun ménage** (ligne 1004). Une opération en attente peut
   être le `create_session` d'une séance non confirmée ; son `.ubx` est alors le
   seul exemplaire du brut.
2. **Référencé ⇒ conservé** (ligne 1015). Un `ubx_upload` en file **ou en
   quarantaine** protège son fichier par URI.
3. **Âge illisible ⇒ conservé** (ligne 1012). « Un nom qu'on ne sait pas dater
   n'autorise pas à détruire la donnée d'un pilote. »

Le fichier n'est **pas** supprimé à l'upload : il reste le filet de reprise.

### La reprise au lancement

`resumeUnsyncedCaptures` (ligne 1034) est appelée dans `app/_layout.tsx:48`, en
« fire-and-forget », au tout premier effet du montage. Elle balaie les `.tmp`
orphelins, draine si la file n'est pas vide, puis fait le ménage des `.ubx`.

**Point que je n'ai pas pu trancher** : cet appel n'attend pas
`useAuthStore.initialize()`, lancé à la ligne précédente. Le client Supabase est
configuré avec `persistSession: true` et un adaptateur SecureStore
(`src/lib/supabase.ts:30-36`), et `supabase-js` (^2.45.4) résout sa session avant
chaque requête PostgREST — le jeton devrait donc être présent. Je n'ai pas
observé l'ordonnancement réel au démarrage. Si un drain partait sans jeton, RLS
répondrait `42501` (classe 42, abandonnable) et les opérations `frames`, `laps`
et `complete` partiraient en quarantaine ; seul `create_session` est protégé par
la garde dure. Cela mérite une vérification sur appareil.

---

## Maillon 8 — Le filet `.ubx` et le réimport

### La capture brute locale

`src/ble/captureMode.ts` s'abonne au flux **brut** (`onRawData`,
`bluetoothService.ts:221`), avant toute resynchronisation et tout parsing. Les
chunks sont accumulés en mémoire (ligne 59-62) puis concaténés et écrits en
base64 à l'arrêt (`stopCapture`, ligne 65).

Nom de fichier : `racebox-capture-<ISO tronqué à 19 caractères>.ubx` sous
`${documentDirectory}fixtures/` (ligne 87-94).

Deux remarques factuelles :

- l'accumulation est **entièrement en mémoire** jusqu'à l'arrêt. Une séance de
  vingt minutes à 25 Hz représente environ 2,6 Mo selon le commentaire
  `captureSyncQueue.ts:933`. Je n'ai pas mesuré l'empreinte réelle.
- `stopCapture` **lève** si aucune donnée n'a été capturée (ligne 74). L'appelant
  attrape et met `ubxUri` à `null` (`captureSessionService.ts:765-768`).

Le chemin `fixtures/` est dupliqué dans `captureSyncQueue.ts:915` avec un
commentaire d'avertissement : les deux doivent rester synchrones. C'est une
dépendance implicite, non protégée par un test.

### L'upload

`src/services/telemetryStorage.ts:37`. Chemin Storage :
`{user_id}/{telemetry_session_id}.ubx` dans le bucket `telemetry_raw`, en
`upsert: true`. Puis mise à jour de `telemetry_sessions.raw_data_url`
(ligne 62), dont l'échec est seulement journalisé.

**État réel du bucket** : `telemetry_raw` existe, privé, limite 50 Mo, type MIME
`application/octet-stream`. Il contient **3 objets**, de 5,6 Ko, 13,0 Ko et
31,1 Ko, déposés les 14/06, 22/06 et 02/07/2026.

### Le réimport, et pourquoi il a failli détruire des séances

`reimportUbxToFrames` (`captureSyncQueue.ts:1139`) rejoue un `.ubx` local dans
`telemetry_frames`. Le défaut historique est décrit lignes 1096-1105 : le
réimport dérivait son `elapsed_ms` de l'iTOW du premier échantillon du fichier,
quand le chemin live le dérive de l'horloge murale depuis l'armement. Deux bases
de temps sans rapport : la clé d'idempotence ne faisait coïncider **aucune**
trame. Réimporter une séance à moitié synchronisée **ajoutait** les 10 000 trames
du fichier aux 8 000 déjà en base. Le filet de secours détruisait la séance qu'il
devait sauver.

La version actuelle réconcilie sur `itow_ms` — l'identité physique de la trame —
avec trois garanties (lignes 1112-1128) : anti-jointure multi-ensemble sur
l'iTOW, recalage de la base de temps sur une ancre déjà en base, et allocation
d'`elapsed_ms` strictement croissante **et garantie libre**.

Refus explicite (ligne 1169) : si la séance porte des trames sans `itow_ms`,
l'appariement est impossible et le réimport dupliquerait. La fonction **lève**
plutôt que de corrompre en silence.

Limite assumée (ligne 1135) : lecture puis insertion ne sont pas atomiques.
C'est un outil de secours **manuel**, à lancer sur une séance close.

### Pourquoi `itow_ms` n'est pas la clé d'unicité

L'argumentaire est en tête de module, lignes 58-83, et il vaut d'être connu :

1. L'iTOW est un temps GPS produit par le RaceBox. Avant fix il peut se répéter
   ou rester à 0, et il se réenroule chaque dimanche à 00:00 UTC. Sous
   `ON CONFLICT DO NOTHING`, toute répétition détruirait une trame réelle en
   silence. « On ne fonde pas l'identité d'une donnée de pilote sur une valeur
   qu'on ne contrôle pas. »
2. `itow_ms` est **nullable** (vérifié en base : `is_nullable = YES`). En
   PostgreSQL, les NULL sont distincts : un index total ne dédoublonnerait pas
   les lignes à iTOW nul.

---

## Maillon 9 — L'écriture en base

### Les colonnes réellement écrites

`telemetry_frames` — écrites par `raceBoxToFrameInsert`
(`captureFrameMapping.ts:80-102`) : `session_id`, `elapsed_ms`, `latitude`,
`longitude`, `altitude_m`, `speed_kmh`, `speed_ms` (dérivée : km/h ÷ 3,6),
`heading` (null si le cap n'est pas valide), `gps_fix`, `fix_valid`
(vrai si fix ≥ 3D), `gps_accuracy_m`, `satellites`, `g_force_x/y/z`,
`rotation_x/y/z`, `battery_level`, `itow_ms`.

**Jamais écrites** : `pdop`, `speed_accuracy`, `heading_accuracy`. Elles
existent en base et resteront nulles.

`laps` — écrites par `buildLapRows` (`captureSessionService.ts:690-704`) :
`session_id`, `lap_number`, `duration_seconds`, `started_at`, `ended_at`,
`start_lat/lon`, `end_lat/lon`, `is_best_lap` (le minimum du lot),
`is_outlap: false`, `is_inlap: false`, plus les cinq colonnes statistiques.

**Jamais écrite** : `distance_meters`.

`telemetry_sessions` — à la création (`captureSessionService.ts:272-280`) :
`id`, `user_id`, `status: 'recording'`, `started_at`, `circuit_id`,
`circuit_name`, `vehicle_id`. À la clôture (lignes 789-799) : `status`,
`ended_at`, `duration_seconds`, `lap_count`, `best_lap_seconds`,
`max_speed_kmh`, `max_g_lateral`, `max_g_longitudinal`, `total_frames`.

**Jamais écrites par la capture** : `distance_km`, `weather`, `notes`,
`best_lap_number`, `avg_lap_seconds`, `source_device_id`, `event_id`,
`vehicle_label`.

### La réconciliation de `total_frames`

`execComplete` (`captureSyncQueue.ts:668`) ne se contente pas de recopier le
total émis. Pour un statut `completed` seulement (ligne 679), il **recompte les
trames réelles en base** (`count: 'exact', head: true`) et écrit ce compte.
Grâce au FIFO, toutes les opérations `frames` de la séance ont déjà été
insérées. Si un lot a été définitivement abandonné, `total_frames` reflète ce
qui existe vraiment. Un abandon ne recompte pas.

### Les politiques de sécurité

Vérifiées sur `pg_policies` le 26/07/2026.

`telemetry_frames` : insertion et lecture limitées aux séances dont
`user_id = auth.uid()` ; lecture supplémentaire pour un coach détaillé
(`is_detailed_coach_of`) et pour un ami (`are_friends`) ; accès complet admin ;
suppression réservée au propriétaire.

`laps` : insertion et lecture propriétaire, lecture coach.

`telemetry_sessions` : insertion, lecture, mise à jour et suppression
propriétaire ; lecture coach et ami ; accès complet admin.

La mise à jour de clôture est doublement filtrée `.eq('id').eq('user_id')`
(`captureSyncQueue.ts:692-693`).

### La rétention

`cleanup_old_telemetry_frames()` supprime les trames de plus de **12 mois**
(migration `20260614124638_app_telemetry_frames_retention.sql`), planifiée par
`pg_cron` à 03h30 UTC (job `cleanup-telemetry-frames`, actif, vérifié dans
`cron.job`). Les dérivés — analyses, segments, insights, `laps` — sont
conservés.

Un second job `biometry-retention-daily` purge le cardio à 03h15 UTC.

---

## Ce qui se passe quand ça tourne mal

### Le réseau tombe

Rien ne s'arrête. L'insert direct échoue, le lot part sur disque
(`captureSessionService.ts:603`), le drain s'interrompt au premier échec réseau
et **garde tout** (`captureSyncQueue.ts:825`). La capture continue, le `.ubx`
local continue de s'écrire.

Au retour du réseau, la file repart dans l'ordre : `create_session`, puis
`attach_intention`, puis les lots `frames`, puis `laps`, puis `complete`, puis
`ubx_upload`. Le test `captureSyncQueue.test.ts:364` verrouille ce cycle.

Le mode avion complet est un cas nominal, pas une exception : c'est écrit
lignes 291-295 de `captureSessionService.ts` à propos de l'intention.

### L'application est tuée

Les opérations déjà enfilées sont sur disque, dans `documentDirectory`, qui
survit à la fermeture. Au relancement, `resumeUnsyncedCaptures`
(`app/_layout.tsx:48`) balaie les `.tmp` orphelins puis draine. Un test couvre
explicitement le redémarrage (`captureSyncQueue.test.ts:1143`).

Ce qui est **perdu** : le tampon en mémoire non encore vidé (au pire 50 trames
ou 4 secondes), les maxima par tour accumulés depuis le dernier gel, et — c'est
le plus lourd — **tout le fichier `.ubx` de la séance en cours**, puisque
`captureMode` accumule en mémoire et n'écrit qu'à `stopCapture()`
(`src/ble/captureMode.ts:65-104`).

Ce qui **reste ouvert** : la séance garde le statut `recording` en base tant
qu'aucun `complete` n'a été enfilé. Aucune reprise automatique de capture n'est
prévue : le code ne rouvre pas une séance interrompue par un crash. Je n'ai
trouvé aucun chemin de réconciliation pour ce cas.

### Le boîtier se déconnecte

Trois régimes successifs, décrits par `CaptureLinkStatus`
(`captureSessionService.ts:151`) :

- `recording` : lien stable ;
- `interrupted` : lien tombé, reconnexion **illimitée** en cours, capture en
  pause, **session toujours ouverte**, trou horodaté (`handleReconnect`,
  ligne 452 ; `gapStartMs` posé ligne 458) ;
- `lost` : abandon prolongé ou repli défensif, capture finalisée proprement.

Le seuil d'abandon est de **15 minutes** (`LONG_INTERRUPT_TIMEOUT_MS`,
ligne 137). En deçà, une coupure de piste — stands, tunnel radio, boîtier qui
redémarre — ne tue plus la capture. Au-delà, la séance est clôturée par le même
chemin qu'un arrêt pilote (`finalizeOnLostLink`, ligne 526).

Pendant le trou, **aucune trame n'est insérée** : il y a un vrai vide dans la
donnée. La durée du trou est tracée en console à la reprise (`logLinkGap`,
ligne 513) — console uniquement, pas d'écran, pas de son.

Côté pilote, `rec/roulage.tsx` affiche alors un message sobre, sans rouge :
« LIEN INTERROMPU · Reconnexion au boîtier en cours » ou « LIEN PERDU · Le
boîtier ne répond plus. Votre session a été enregistrée jusqu'ici »
(`src/services/captureLinkStatusLogic.ts:29-46`). Le point REC ne pulse en rouge
que si l'enregistrement tient réellement (`rec/roulage.tsx:96`).

Effet secondaire à connaître sur la détection de tours : après un trou, les deux
points GPS encadrant le vide sont trop éloignés, et `MAX_STEP_M` fait qu'aucun
franchissement n'est évalué sur ce pas (`src/utils/lapDetection.ts:217`). Un
tour peut donc manquer à l'appel après une reconnexion. C'est un choix assumé.

### Deux séances se chevauchent

Trois protections indépendantes.

**Premièrement**, `startCaptureSession` refuse net : `if (current) return
{ ok: false, error: 'Une capture est déjà active.' }` (ligne 261).

**Deuxièmement**, `stopCaptureSession` fait un « capture-and-null » synchrone
(lignes 725-726) : `current` est mis à `null` avant le premier `await`. Un
second appel concurrent tombe sur « Aucune capture active » et ne fait rien.

**Troisièmement**, et c'est le cas subtil : puisque `current` est libéré dès
l'entrée de l'arrêt, une **capture suivante peut démarrer pendant le vidage de
la précédente**. Le chemin terminal `finalizeOnLostLink` porte donc une **garde
de génération** (lignes 537-550) : les trois effets globaux — reconnexion
illimitée, verrou d'écran, statut de lien — ne sont appliqués que si
`current === null`, c'est-à-dire si aucune autre capture n'a pris la main.

Sans cette garde, finir la séance A désarmerait la reconnexion de la séance B,
relâcherait son verrou d'écran, et afficherait « liaison perdue » sur une séance
qui enregistre. Ce comportement est verrouillé par un test
(`captureSessionService.test.ts:274`).

Le même idiome `if (current !== state) return` protège `onData` (ligne 392),
`onReconnectChange` (ligne 417) et la minuterie d'interruption (ligne 486).

### L'horloge recule

Traité à trois endroits, avec la même convention.

- Les trames : `nextElapsedMs` impose la stricte croissance
  (`captureFrameMapping.ts:43`). Le minutage est comprimé, aucune trame n'est
  perdue.
- Les tours : `nextMonotonic` (`src/utils/monotonicClock.ts:25`) sépare la mesure
  (monotone) de l'affichage (mural). Une durée de tour ne peut pas devenir
  négative.
- La file : `nextFileName` (`captureSyncQueue.ts:229`) rend l'horodatage non
  décroissant pour préserver le FIFO.

### La ceinture cardio tombe

Aucun effet sur la capture télémétrique. Chemins BLE séparés, reconnexion cardio
bornée et indépendante (`bluetoothService.ts:753-791`). Le commentaire ligne 750
est explicite : « la ceinture est secondaire : si elle ne revient pas, la capture
télémétrique continue sans elle, aucun couplage ».

---

## La règle cardinale : quatre fichiers gelés

### Où c'est écrit

Deux documents de cadrage du programme V2 la posent noir sur blanc :

- `design-retours/programme-v2/PROMPT_CLAUDE_CODE_V2_L2_REC.md:7` —
  « **RÈGLE CARDINALE inchangée : `useAppStateStore`, `captureSessionService`,
  `captureSyncQueue`, `bluetoothService` = zéro diff.** »
- `design-retours/programme-v2/OXV_APP_V2_DOSSIER_MAITRE.md:147` — « La machine
  S5/S6 de `useAppStateStore` et `captureSessionService`/`captureSyncQueue` ne
  bougent pas d'une ligne. Seule la coque change. »

Les quatre fichiers sont :

| Fichier | Lignes |
|---|---|
| `src/store/useAppStateStore.ts` | 122 |
| `src/services/captureSessionService.ts` | 869 |
| `src/services/captureSyncQueue.ts` | 1 234 |
| `src/ble/bluetoothService.ts` | 833 |

### Pourquoi ces quatre-là

Parce que la refonte visuelle V2 réécrivait 38 écrans, et que ces quatre
fichiers sont les seuls dont une régression **détruit de la donnée de pilote au
lieu d'abîmer un pixel**. L'historique de chacun le montre — les titres de
commit disent exactement ce qui a failli être perdu :

- `b6c1ee2` — « 2 critiques de la vérif adversariale — séance détruite par
  erreur passagère, marge 100 % fabriquée » ;
- `5cb86ba` — « critique 2 : la contrainte d'unicité aurait détruit des trames
  réelles » ;
- `3c89996` — « concurrence & cycle de vie — 6 derniers findings de la vérif
  adversariale » ;
- `c409dcc` — « la fluidité devient réelle — maxima par tour écrits à la
  capture » ;
- `0a201d7` — « idempotence des trames + chronos de tours monotones ».

Le gel protège quatre invariants qu'aucun travail d'habillage n'a le droit de
rouvrir :

1. la **stricte croissance** d'`elapsed_ms` (sans elle, des trames réelles
   disparaissent en silence) ;
2. la **classification conservatrice** des erreurs de la file (sans elle, un 503
   détruit une séance) ;
3. la **garde de génération** sur le cycle de vie de la capture (sans elle, une
   séance en désarme une autre) ;
4. la **séparation des horloges** murale et monotone (sans elle, un chrono peut
   devenir négatif).

### Le gel a-t-il tenu ?

Réponse par l'historique Git, vérifiée le 26/07/2026 :

| Fichier | Dernier commit | Date | Verdict |
|---|---|---|---|
| `useAppStateStore.ts` | `9f1f3f0` | 29/06/2026 | **tenu** — antérieur au programme V2 |
| `captureSyncQueue.ts` | `b4748a2` | 19/07/2026 | **tenu** — SEC-1, remontée Sentry |
| `captureSessionService.ts` | `a2560da` | 25/07/2026 | **dérogé** — « dégel cardinal ciblé », 3 lignes d'appel cardio |
| `bluetoothService.ts` | `8ba669d` | 25/07/2026 | **dérogé** — extension Polar, revendiquée additive |

Les deux dérogations datent du même jour et du même lot (BIO-2, ceinture
cardio). Elles sont revendiquées comme purement additives.

Ce que j'ai pu vérifier dans le code : les trois lignes ajoutées à
`captureSessionService` sont bien des appels en `void ... .catch()`
non bloquants (lignes 433, 742, 837), et l'extension Polar de
`bluetoothService` vit dans un bloc séparé (lignes 618-817) sans toucher au
chemin RaceBox. Le scan RaceBox (ligne 289) et l'abonnement aux données
(ligne 372) sont inchangés.

Ce que je n'ai **pas** pu vérifier : que l'ajout d'un second périphérique BLE
simultané ne dégrade pas le débit du RaceBox sur le matériel réel. C'est
précisément le « smoke test 2 appareils reels » que le commentaire du drapeau
`biometry` en base déclare non tenu.

---

## Ce qui n'a jamais été observé en fonctionnement

C'est la partie la plus importante de cette section.

### Les chiffres de la production

Interrogée en lecture seule le 26/07/2026 :

| Table | Lignes |
|---|---|
| `telemetry_sessions` | 18 |
| `telemetry_frames` | **53** |
| `laps` | **1** |
| `biometry_raw` | 0 |
| `devices` | 0 |
| `device_assignments` | 0 |
| `incident_reports` | 0 |
| `session_intentions` | 0 |
| `app_session_analyses` | 13 |
| `app_segment_analyses` | 0 |
| objets dans `telemetry_raw` | 3 |

### Ce que ces chiffres veulent dire

**Les 53 trames.** Elles viennent toutes de la séance
`7f40d5ad-4697-44ac-861c-13b7d0cc9878`, du 28/06/2026, circuit « Charente »,
statut `aborted`, durée déclarée 5 secondes. Leur `elapsed_ms` va de 36 à
2 093 ms — deux secondes de données. La vitesse maximale enregistrée est de
**0,83 km/h**. Fix 3D, 8 satellites. Toutes portent un `itow_ms`, une latitude,
une vitesse, les trois accélérations et les trois rotations : le mapping écrit
bien tout ce qu'il annonce. C'est un essai d'établi, boîtier posé, pas un tour
de piste.

**Le tour unique.** Session `f13545a1`, 16/05/2026, circuit « La charade »,
durée **0,022 seconde**, `start_lat` et `start_lon` à 0, `is_outlap: true`.
La chaîne actuelle écrit toujours `is_outlap: false`
(`captureSessionService.ts:702`) : cette ligne ne vient donc **pas** du code
d'aujourd'hui, c'est un vestige du proof of concept de mai.

**Les séances de mai.** Les dix séances `completed` déclarent toutes un
`total_frames` non nul (93, 168, 223, 258, 276, 489, 750, 966, 1 145, 1 206)
mais comptent **zéro trame réelle** en base. Ce n'est pas la purge de rétention : elle ne s'applique
qu'au-delà de 12 mois. C'est que le chemin d'écriture des trames n'existait pas
encore — il a été livré le 14/06/2026 (commit `0ebe59b`, « write path de bout en
bout (P0 Valence) »). Ces séances viennent d'un chemin antérieur qui écrivait
l'agrégat sans les mesures.

**Aucun boîtier en flotte.** `devices` est vide. `getMyAssignedDevice`
(`src/services/deviceHealthService.ts:31`) ne peut donc rien renvoyer, et
l'écran d'équipement n'a aucun boîtier affecté à présenter.

**Aucune intention rattachée.** `session_intentions` est vide : le chemin
`attach_intention`, pourtant testé et verrouillé dans son ordre d'enfilement,
n'a jamais été emprunté en production.

### La liste de ce qui n'a jamais tourné en conditions réelles

- Une séance complète, du démarrage à la clôture, avec un vrai RaceBox en
  mouvement.
- La détection de tours en mode porte, sur un circuit réel, avec une voie des
  stands parallèle.
- La reconnexion illimitée après une vraie coupure BLE en piste.
- Le seuil d'abandon de 15 minutes.
- Le fonctionnement hors ligne complet suivi d'un retour de réseau, en piste.
- L'upload d'un `.ubx` produit par une séance de roulage réelle (les 3 objets du
  bucket font 5 à 31 Ko, soit quelques secondes de flux).
- Le réimport `.ubx` de secours.
- La capture cardio Polar, de bout en bout.
- La double connexion RaceBox + Polar simultanée.
- Le relais live vers un coach pendant un run.
- Le verrou d'écran sur la durée d'un relais de vingt minutes.

Il existe deux documents de procédure prêts dans le dépôt :
`docs/SMOKE_TEST_DEVICE.md` et `docs/SMOKE_TEST_MEDIA.md`. Je n'ai aucun élément
indiquant qu'ils aient été exécutés.

---

## Ce qui est prouvé par les tests

Les tests, eux, ont été exécutés. Le 26/07/2026, sept suites couvrant la chaîne
de capture :

| Suite | Objet |
|---|---|
| `src/ubx/__tests__/parser.test.ts` | checksum, resynchronisation, décodage |
| `src/ble/__tests__/reconnectPolicy.test.ts` | palier de reconnexion, décision d'abandon |
| `src/services/__tests__/captureFrameMapping.test.ts` | mapping, `elapsed_ms`, maxima |
| `src/services/__tests__/captureFinishLineLogic.test.ts` | résolution de ligne d'arrivée |
| `src/services/__tests__/captureSessionService.test.ts` | garde de génération, régimes de vidage, maxima par tour, intention |
| `src/services/__tests__/captureSyncQueue.test.ts` | FIFO, classification, idempotence, quarantaine, ménage, réimport |
| `src/services/__tests__/biometryCaptureRunner.test.ts` | verrous de consentement, préservation, purge |

**Résultat : 7 suites, 127 tests, tous au vert, en 39,7 secondes.**

Ce que ces tests prouvent : la logique tient. Ce qu'ils ne prouvent pas : que la
radio Bluetooth d'un iPhone tienne 25 Hz pendant vingt minutes avec deux
périphériques connectés, que la 4G d'un paddock absorbe les lots, que le
`documentDirectory` d'iOS accepte les fichiers de file au rythme prévu, ou que
le GPS du RaceBox produise le cap valide dont dépend la détection par porte.

---

## Ce que je n'ai pas pu vérifier

Par honnêteté, la liste des points laissés ouverts :

1. **La cadence réelle du RaceBox.** Le code et les commentaires supposent
   25 Hz. Je n'ai aucune mesure directe. La seule donnée réelle en base couvre
   2,06 secondes avec 53 trames, soit environ 25 Hz — cohérent, mais sur un
   échantillon dérisoire et véhicule à l'arrêt.
2. **L'ordonnancement au démarrage** entre `resumeUnsyncedCaptures` et la
   restauration de session Supabase (voir maillon 7).
3. **L'empreinte mémoire** de `captureMode`, qui accumule tout le flux brut en
   mémoire jusqu'à l'arrêt.
4. **Le comportement iOS réel** quand l'écran est verrouillé manuellement
   pendant une capture, malgré le verrou `expo-keep-awake`.
5. **L'effet de la double connexion BLE** sur le débit du RaceBox.
6. **L'absence d'appel à `setActiveRecording`** : je constate que la fonction
   n'est appelée nulle part, mais je n'ai pas pu déterminer si c'est un oubli ou
   une décision assumée depuis que la coque V2 pilote le silence par l'écran.
7. **La reprise après un crash en pleine séance** : aucun chemin de
   réconciliation trouvé pour une séance restée en `recording`, ni pour le
   `.ubx` perdu avec le processus.
8. **La synchronisation du chemin `fixtures/`** entre `captureMode.ts:87` et
   `captureSyncQueue.ts:917`, dépendance implicite non couverte par un test.

---

## L'application du pilote (arbre V2)

### Avertissement de méthode

Rien n'a été exécuté pour écrire cette section. Aucun simulateur, aucun appareil,
aucun build. Tout ce qui suit est une **lecture du code source** du dépôt
`C:/Users/Julie/OneDrive/Desktop/oxv-app`, croisée avec des **requêtes en lecture
seule** sur la base de production `fouvuqkdxarjpjbqnsjq`.

Conséquence : quand j'écris « l'écran affiche », il faut lire « le code écrit pour
afficher ». Le rendu réel, les gestes, la fluidité des animations, le
comportement du Bluetooth et le résultat des redirections n'ont **jamais été
observés**. Là où le doute existe, il est nommé.

---

### Le périmètre exact

Le dossier `app/(app2)/` contient **38 fichiers `.tsx`**. L'un d'eux,
`app/(app2)/_layout.tsx`, n'est pas un écran mais la coquille qui les porte. Il
reste donc **37 routes** destinées au pilote.

Répartition par zone :

| Zone | Dossier | Routes |
|---|---|---|
| Paddock (accueil) | `app/(app2)/index.tsx` | 1 |
| Signature | `app/(app2)/signature.tsx` | 1 |
| Bilan | `app/(app2)/bilan/[sessionId].tsx` | 1 |
| Session | `app/(app2)/rec/` | 8 |
| Progression | `app/(app2)/data/` | 4 |
| Club | `app/(app2)/club/` | 7 |
| Compte | `app/(app2)/vous/` | 12 |
| Réservation | `app/(app2)/reserver/` | 3 |
| Validation du kit (dev) | `app/(app2)/dev-galerie.tsx` | 1 |

Volume : 27 666 lignes dans `app/(app2)/`, plus 15 969 lignes de logique et de
chargement dans `src/features/` (club, data, miroir, rec, vous).

Les noms de zone employés par le code ne sont pas ceux du cahier des charges. La
barre de navigation nomme les quatre portes `miroir`, `data`, `club`, `vous`
(`src/ui/v2/shellLogic.ts:208-213`). « Paddock » n'est qu'un sur-titre de
l'accueil ; « Progression » s'appelle « Data » ; « Compte » s'appelle « Vous ».

---

### Comment le pilote y entre

`app/index.tsx:107` redirige tout pilote authentifié et onboardé vers `/(app2)`.
C'est la bascule dite L6, faite le 26 juillet 2026 (commit `29e34f9`).

Le routage par rôle vit juste au-dessus, `app/index.tsx:93-101` : un coach part
vers `/(coach)`, un partenaire vers `/(partner)`, un pilote professionnel vers
`/(pro)`. Seuls les rôles `pilot` et `admin` atteignent l'arbre V2.

`app/(app2)/_layout.tsx:63-66` porte une note importante : le garde
`if (!__DEV__) return <Redirect href="/" />` qui rendait le groupe orphelin a été
**retiré** au moment de la bascule. Le laisser aurait produit une boucle de
redirection visible en production seulement. Ce point n'a pas été vérifié sur
appareil.

La seule autre porte d'entrée depuis l'extérieur est la **notification push**,
routée dans `app/_layout.tsx:103-147`. Huit destinations pilote y visent
désormais l'arbre V2 : débrief et médias prêts ouvrent `/(app2)/bilan/[sessionId]`,
le rappel de séance ouvre `/(app2)`, une note de coach ouvre
`/(app2)/data/session/[id]`, l'affectation d'un coach ouvre `/(app2)/club/coaching`,
une demande d'ami ouvre `/(app2)/club/roulages?tab=amis`, une amitié acceptée
ouvre `/(app2)/data/comparer?friend=…`.

---

## Paddock — l'accueil Miroir

Fichier : `app/(app2)/index.tsx` (1 067 lignes).
Chargement : `src/features/miroir/useMiroirHome.ts` (475 lignes).
Décisions pures : `src/features/miroir/miroirHomeLogic.ts` (369 lignes, testé).

### Trois visages selon l'état du pilote

L'écran commence par regarder l'état de la machine v1 (`useAppStateStore`), qui
n'est **pas** modifiée par l'arbre V2.

**S5 approche et S6 roulage** (`app/(app2)/index.tsx:154-165`) : l'écran de données
disparaît entièrement. Il ne reste qu'un sur-titre (« EN PISTE » ou « EN ROUTE »),
un titre (« L'app s'efface. » / « Bon trajet. ») et une ligne (« Aucun écran.
Aucun son. Conduisez. »). Aucun chrono, aucun radar, aucune statistique. C'est
l'application du Principe 3.

**S4 anticipation** (`app/(app2)/index.tsx:167-196`) : un écran de compte à rebours
sobre, avec le prénom du pilote s'il est connu, et une seule pastille d'action
décidée par `src/services/paddockHeroLogic.ts:49-104`.

**Tous les autres états** : le Miroir complet, décrit ci-dessous.

### Le héros, trois variantes

`decideHomeMode` tranche entre « après-séance » (dernière séance de moins de sept
jours) et « entre-journées ».

1. **Après séance** (`app/(app2)/index.tsx:429-485`) — photo de la séance en fond,
   sur-titre « DERNIÈRE SÉANCE · {circuit} », le chrono du meilleur tour en
   chiffre roi, la date pleine. Un appui ouvre le Bilan avec une transition de
   morphing du chrono. Sans photo, un tracé de circuit dessiné en Skia sert de
   fond. Sans chrono mesuré, un tiret : jamais un zéro.
   - photo : `listSessionMedia` → table `session_media` ;
   - chrono : le meilleur tour lu dans `laps`, à défaut
     `telemetry_sessions.best_lap_seconds` ;
   - circuit et date : `telemetry_sessions.circuit_name` / `started_at`.

2. **Entre journées** (`app/(app2)/index.tsx:487-537`) — photo de **sa** voiture en
   fond (première photo du premier véhicule du garage), cadran des jours restants,
   nom du circuit, date courte, météo, pastille « PRÉPARER ».
   - véhicule : `garageService.listMyVehicles` (table `vehicles`) + couverture via
     `pilotMediaService.getMyVehicleCovers`, qui lit la colonne JSONB `users.media` ;
   - journée : `nextTrackDayService.getMyNextTrackDay`, qui croise `registrations`
     et `sessions` ;
   - météo : `useMiroirHome.ts:229-247`. Elle n'est demandée que si la journée est
     à sept jours ou moins, et **uniquement** si le nom du circuit correspond
     exactement à une ligne `circuits` porteuse de coordonnées valides. Le libellé
     affiché dit « Météo actuelle », pas une prévision du jour J — c'est
     `weatherService.fetchCurrentWeather` (Open-Meteo, `current`). Si la
     température revient nulle, le bloc météo entier disparaît plutôt que
     d'afficher un « 0° » fabriqué (`app/(app2)/index.tsx:515-522`).

3. **Aucune journée au calendrier** (`app/(app2)/index.tsx:539-560`) — une carte
   vide et une pastille « RÉSERVER ».
   **Point à connaître** : `decideReserve` (`src/features/miroir/miroirHomeLogic.ts:236-241`)
   renvoie `/(app2)/club` **dans les deux branches**, drapeau de paiement activé ou
   non. Le commentaire l'assume et un test verrouille ce comportement. Autrement
   dit, depuis l'accueil, « RÉSERVER » ouvre le Club, jamais le tunnel de
   réservation.

### Le bandeau rituel J-3

`app/(app2)/index.tsx:200-207` et `341-396`. Il n'apparaît que pour une journée
réelle à trois jours ou moins, non encore écartée. Il s'écarte au glissement
horizontal, et l'oubli est persisté par journée dans le stockage local MMKV. Une
action d'accessibilité « Écarter ce rappel » double le geste. Il mène vers
`/(app2)/rec/preparation`.

### La signature compacte

`app/(app2)/index.tsx:566-624`. Un radar QDI en petit format, avec la légende des
cinq branches. **La carte entière disparaît si aucune branche n'est mesurée**
(`measured === 0`) : pas de radar inventé. Les cinq notes chiffrées ne sont
délibérément **pas** affichées ni annoncées — un seul chiffre par écran.

Source : `qdiService.getQdiForSession`, filtré sur la version d'algorithme
courante `qdi-1.1.0` (`src/services/qdiLogic.ts:25`). Un QDI persisté sous une
version antérieure (1.0.x, axes G inversés, documenté invalide) n'est jamais
affiché (`useMiroirHome.ts:270-277`).

### Le fait

`app/(app2)/index.tsx:630-639`. Une seule phrase, nue. Après séance, c'est le récit
narratif de `traceNarrativeService.loadTraceOfDay` ; sinon un fait de saison
calculé par `seasonFact` à partir des statistiques cumulées. Absent, le bloc
disparaît.

### La rangée de statistiques

`app/(app2)/index.tsx:645-729`. Trois cellules séparées par des filets :

| Cellule | Source | Absence |
|---|---|---|
| Record | `statsService.loadPilotStats().bestLapSeconds` | « — » |
| Saison | `loadPilotStats().totalDistanceKm`, en km entiers | « — » |
| Heritage **ou** Séances | `heritage_packs.sessions_used / sessions_total` du pack actif, sinon `totalSessions` | « — » |

Le compteur Heritage lit les vraies colonnes du pack actif
(`useMiroirHome.ts:213-226`) — il n'y a plus de « /4 » codé en dur. Les chiffres
défilent en compteur au premier passage à l'écran, sauf si le réglage système
« animations réduites » est actif.

### Le canal d'erreur

`useMiroirHome.ts:297-321`. Trois sources sont dites *primaires* : dernière
séance, statistiques, prochaine journée. Elles sont lues en mode strict — une
erreur de base **rejette** au lieu de se déguiser en vide. Si les trois échouent
ensemble, l'écran bascule sur un état d'erreur avec bouton Réessayer, jamais sur
un écran calme qui affirmerait « Aucune journée » sans avoir lu.

### Ce que cet écran affiche aujourd'hui en production

Vérifié en base :

- `telemetry_sessions` : 18 lignes, dont 10 en statut `completed`. **Aucune** ne
  porte de `best_lap_seconds`. Les distances vont de 0,01 à 0,05 km.
- `laps` : **1 seule ligne**, d'une durée de 0,022 s.
- `app_session_analyses` : 13 lignes, colonne `qdi` **nulle partout**, versions
  `v1.0` et `cron-v1.0` — donc aucune à la version courante `qdi-1.1.0`.
- `session_media` : 0 ligne. `users.media` : 0 utilisateur renseigné.
  `users.avatar_url` : 0 sur 14 comptes.
- `heritage_packs` : 0 ligne.
- `registrations` : 1 ligne (offre `access`, statut `pending`, journée du
  24 décembre 2026 à Haute Saintonge).

Conséquence, pour le seul compte concerné : héros « entre journées » avec le
cadran vers le 24 décembre, sans photo de véhicule (repli sur le tracé dessiné),
carte Signature **absente**, cellule Record à « — », cellule Séances chiffrée. Pour
les treize autres comptes, l'écran affiche la carte « Aucune journée au
calendrier ».

---

## Signature

Fichier : `app/(app2)/signature.tsx` (464 lignes).
Chargement : `src/features/miroir/useSignature.ts`.
Décisions : `src/features/miroir/signatureLogic.ts` (testé).

Le grand radar QDI en plein écran, avec cinq sommets nommés selon un arbitrage
explicite du fondateur du 19 juillet 2026, verrouillé par test
(`src/features/miroir/signatureLogic.ts:50-56`) :

| Branche technique | Libellé Signature |
|---|---|
| trajectoire | Cap |
| regularite | Trajectoire |
| freinage | Visée |
| acceleration | Plongée |
| fluidite | Anticipation |

Le fichier documente lui-même la conséquence assumée : sur cet écran,
« Trajectoire » ne désigne pas la même branche que sur l'accueil et le Bilan.

Sous le radar, l'**Empreinte** : une bande horizontale de mini-radars mensuels
(`qdiService.listMonthlyQdi`, six mois). Toucher un mois fait morpher le grand
radar vers les valeurs de ce mois ; un second toucher revient à la fenêtre de
trente jours.

La ligne de base est la **médiane par branche** des QDI valides des trente
derniers jours, plafonnée à douze séances lues. Si aucune n'est valide, un seul
recalcul paresseux est tenté sur la plus récente — jamais toute la fenêtre.

Section **pilier physiologique** : rendue seulement si le drapeau `biometry` est
actif **et** le consentement de capture posé **et** au moins trois séances portent
des données. Même visible, la valeur du pilier est affichée à « — » : elle n'est
pas encore calculée (`app/(app2)/signature.tsx:327-334`).

Erreur et vide sont distingués (`signatureStatusFromSources`) : un écran vide
n'est jamais affiché sur une panne réseau.

**État en production** : aucun QDI à la version courante n'existe. L'écran affiche
donc pour tous : « Votre signature se dessine à partir de vos tours. Elle
apparaîtra après votre premier roulage analysé. »

**Point de navigation** : le lien de bas d'écran « Voir la saison complète » pointe
vers `/(app2)/data` et non vers `/(app2)/data/saison`
(`app/(app2)/signature.tsx:342`). Le commentaire juste au-dessus le signale comme
une cible provisoire du lot L1 que le lot L3 devait remplacer ; ce n'a pas été
fait.

---

## Bilan de séance

Fichier : `app/(app2)/bilan/[sessionId].tsx` (1 180 lignes).
Chargement : `src/features/miroir/useBilan.ts` (382 lignes).
Décisions : `src/features/miroir/bilanLogic.ts` (545 lignes, testé).

C'est l'écran le plus dense de l'arbre. Il réunit trois écrans v1 distincts (trace
du jour, débrief, bilan).

### Les sections, dans l'ordre

1. **Héros** — photo de la séance ou tracé du circuit en filigrane à 8 %, avec le
   chrono du meilleur tour en chiffre roi et la ligne « X tours · Y km ». C'est la
   cible du morphing venu de l'accueil. Le bloc est monté **dès le chargement**,
   pour que la transition parte au bon endroit.
2. **Le tracé** — `TraceCircuit` alimenté par la centerline **stricte** du circuit
   réel de la séance (`fetchSessionCircuitCenterlineExact`). Si la séance n'a pas
   de circuit rattaché, l'écran écrit « Tracé indisponible pour cette séance. » et
   ne dessine **jamais** la silhouette d'un autre circuit.
3. **Quatre piliers** — barres des branches QDI. Un QDI d'une version antérieure
   affiche « — » plutôt que la fausse mesure.
4. **Moments-clés** — calculés par `keyMomentsLogic` à partir des tours et des
   analyses de segment. Un appui ouvre `/(app2)/data/session/[id]`. Limite écrite
   dans le code (`app/(app2)/bilan/[sessionId].tsx:355-360`) : l'ancre sur le moment
   précis est impossible, l'écran de séance ne lit que l'identifiant. Le pilote
   arrive en haut de sa séance.
5. **Fréquence cardiaque** — section entièrement absente sans drapeau `biometry`,
   sans consentement de capture, ou sans échantillon. La lecture elle-même est
   gatée : sans consentement, aucune requête de santé n'est émise.
6. **Debrief J+1** — trois actes, ou l'attente dite en une phrase unique. Quand le
   texte est généré, la provenance est écrite en toutes lettres : « RÉCIT GÉNÉRÉ
   AUTOMATIQUEMENT À PARTIR DE VOTRE SÉANCE ».
7. **Fil avec le coach** — bulles des trois derniers messages, plus un champ de
   réponse. N'apparaît que si un binôme existe **où l'utilisateur courant est le
   pilote**. Le titre dit « VOTRE FIL AVEC X » et non « fil de la séance », parce
   que le fil couvre tous les échanges.
8. **Souvenirs** — photos réelles de la séance en liste horizontale ; une cellule
   « ◉ VIDÉO DU TOUR » n'apparaît que sous le drapeau `video_overlay`.
9. **Pied** — « Ouvrir dans Data ».

### La bande d'annotation du coach

Elle est attribuée : « NOTE DU COACH · {nom} », ou « REPÈRE GÉNÉRAL » quand la note
n'est pas rattachée à cette séance. Jamais la voix de l'application.

### Le partage

Une feuille propose « Partager en PDF » (service v1) et « Carte trophée », qui
**sort de l'arbre V2** vers `/(app)/carte-trophee?sessionId=…`
(`app/(app2)/bilan/[sessionId].tsx:577`).

### Le record

`useBilan.ts` lit la liste complète des séances en mode strict. Si la liste rejette,
ou si elle est vide alors que la séance existe, le record est déclaré
**indéterminé** — jamais fabriqué, et la garde de célébration n'est pas posée. La
célébration d'un record se joue **une seule fois par séance, tous écrans
confondus** (module partagé `recordCelebration`).

**État en production** : aucune séance complétée ne porte de chrono, aucune n'a de
QDI courant, aucune n'a de média. Un bilan ouvert aujourd'hui affiche donc : un
héros sans chrono, un tracé (Haute Saintonge a bien sa centerline en base), quatre
piliers à « — », zéro moment-clé, pas de cardio, un débrief seulement pour les
trois séances qui en ont un (`app_session_analyses.debrief_text` non nul sur 3
lignes), aucun souvenir.

---

## Session — le flux de capture (`rec/*`)

Huit écrans. La règle cardinale écrite partout : **la machine à états et les
fichiers de capture ne sont pas modifiés**. Les écrans V2 sont une peau sur les
mêmes services que la v1.

La table de correspondance état → écran vit dans
`src/features/rec/captureStepLogic.ts:78-99` :

| État pilote | Écran |
|---|---|
| S1, S2, S3, S4, S8, S9, S10 | le hub reste sur lui-même |
| S5 approche | `rec/arrivee` |
| S6 roulage | `rec/roulage` |
| S7 paddock | `rec/entre-runs` |

### 1. Hub — `app/(app2)/rec/index.tsx` (260 lignes)

Cible du bouton central de la barre. Deux visages : le jour J, il **redirige** vers
l'écran de l'étape ; hors jour J, il rend son propre contenu (photo de la voiture,
cadran de compte à rebours, entrée « Préparation »), ou un état « RÉSERVER » si le
calendrier est vide. Il réutilise `useMiroirHome` — pas de second chargement écrit.

### 2. Préparation — `app/(app2)/rec/preparation.tsx` (1 080 lignes)

Sept blocs, tous branchés sur des sources réelles :

- en-tête condensable ;
- héros de la journée : photo du circuit, cadran de compte à rebours ou badge
  « AUJOURD'HUI » pulsé, nom du circuit et créneau (`nextTrackDayService`) ;
- météo réelle (`weatherService`) — **absente, la ligne disparaît** ;
- check-list cochable de **quatre** items, persistée en MMKV par pilote. Le fichier
  `src/features/rec/preparationLogic.ts:15-31` note honnêtement que le cahier des
  charges parlait de six items, que la v1 en a quatre, et que la barre affiche donc
  « x/4 » — jamais un dénominateur inventé. Les items : « Boîtier OXV chargé »,
  « Casque et gants », « Licence et papiers du véhicule », « Niveaux et pression
  des pneus » ;
- QR du Pass, plein écran clair, geste de fermeture ;
- « Qui roule » : opt-in du pilote et liste des inscrits opt-in, via une fonction
  serveur gatée, avec filtre « Mon groupe » si une écurie existe ;
- Convoi, gaté par le drapeau `convoys` (fermé par défaut).

### 3. Arrivée — `app/(app2)/rec/arrivee.tsx` (229 lignes)

Écran cérémoniel : l'insigne OXV se dessine au trait pendant 2 s, une seule fois
par jour (garde MMKV). Le nom réel du circuit, « Vous y êtes », un seul bouton
« JE SUIS AU PADDOCK ». **Aucune écriture dans la machine à états** — l'appui
navigue vers l'équipement, la bascule S5→S7 reste portée par la géolocalisation.

### 4. Équipement — `app/(app2)/rec/equipement.tsx` (1 145 lignes)

L'appairage Bluetooth, sur les services v1 intacts.

- Scan théâtralisé : anneau radar Skia, boîtiers trouvés en cascade, délai
  d'expiration du scan. Carte du boîtier appairé avec batterie en compteur et
  numéro de série.
- Ceinture cardio (BIO-2) : l'état est **séparé** de celui du boîtier. Le scan
  Polar ne s'ouvre que si le drapeau `biometry` est actif **et** le consentement de
  capture est posé (`app/(app2)/rec/equipement.tsx:452-484`). Sans consentement,
  rien n'écoute la santé.
- Feuille de consentement biométrie : deux cases distinctes (capter / partager au
  coach), avec l'invariant « partager suppose capter » côté interface et côté
  service. Le texte est repris de `docs/juridique/consentement_biometrie.md`.
  « Refuser » écrit explicitement les deux consentements à faux — ce n'est pas une
  simple fermeture.
- Rappel Apple Watch : gaté par quatre conditions simultanées.

Le fichier porte un commentaire long sur un piège de cible tactile : les zones
d'« Accorder » et « Refuser » ne sont élargies que vers l'extérieur, parce qu'un
recouvrement aurait fait révoquer le consentement en appuyant sur le bas
d'« Accorder ».

**Non vérifié** : rien de ce chemin Bluetooth n'a été exécuté. Le drapeau
`biometry` est passé à `true` en production le 25 juillet 2026 ; la description du
drapeau en base indique elle-même : « Reste non tenu à la levée : smoke test
2 appareils reels ».

### 5. Placement — `app/(app2)/rec/placement.tsx` (423 lignes)

Sélection du circuit (`fetchCircuits` / `getDefaultCircuit`), carte du circuit en
tracé Skia avec le marqueur de ligne d'arrivée posé aux **coordonnées réelles**
(repli au départ du tracé si elles manquent).

L'armement est un geste : appui long de 600 ms avec jauge circulaire qui se
remplit, puis vibration et départ. Un relâchement précoce annule — aucune session
n'est créée. `startCaptureSession` est appelé avec exactement les mêmes arguments
que la v1.

### 6. Roulage — `app/(app2)/rec/roulage.tsx` (274 lignes)

Le plus sobre de l'application, et c'est délibéré : fond uni, un point REC qui
pulse, le mot « REC » en monospace. **Aucun chrono, aucun chiffre, aucune
biométrie.** Seule exception d'honnêteté, reprise de la v1 : si le lien Bluetooth
décroche, l'écran le dit sobrement, sans rouge — jamais laisser croire qu'on
enregistre quand le boîtier a lâché.

« Terminer le run » appelle exactement `stopCaptureSession` ; l'annulation discrète
appelle `abortCaptureSession`.

### 7. Entre-runs — `app/(app2)/rec/entre-runs.tsx` (430 lignes)

La pause au stand. Le cadran du break au centre — affiché **uniquement** pour un
vrai départ du jour à venir, sinon masqué (aucun compte fabriqué). Le meilleur tour
du jour, célébré une fois s'il bat le précédent. Une note rapide écrite dans le
carnet réel (`pilotNotesService.addNote`). La biométrie y est fermée par défaut.

Le commentaire d'en-tête explicite la nuance doctrinale : ici on est au stand, pas
en piste, donc les chiffres sont autorisés.

### 8. Fin — `app/(app2)/rec/fin.tsx` (677 lignes)

Fusionne trois écrans v1 (pilotage fini, préservation, bilan prêt) plus un état
d'erreur, en quatre phases fondues.

- La préservation rebranche **exactement** `analyzeAndPersistSession` de la v1, avec
  un délai minimal d'affichage de 3,5 s et un filet de sécurité à 30 s.
- Déclencheur BIO-1 à l'entrée en phase « fini » : lecture Apple Watch, idempotent,
  fermé par défaut et **jamais bloquant**. Le code note qu'il est aujourd'hui sans
  effet, HealthKit étant absent du binaire.
- Rejeu des incidents hors-ligne, dans un registre **séparé** de la file de capture
  durcie.
- Lien « Déclarer un incident » toujours accessible.
- Aucune célébration de record ici : le commentaire explique que la doubler
  fabriquerait une célébration sur un run ordinaire.

Le résumé de fin ne montre que ce que le store a mesuré (tours, minutes). La
distance absente reste absente.

---

## Progression — `data/*`

Quatre écrans. Doctrine écrite en tête de chacun : **self-only**, aucune donnée
d'un autre pilote côté brut.

### Hub — `app/(app2)/data/index.tsx` (744 lignes)

La liste des séances du pilote.

- En-tête condensable « DATA », sur-titre « VOS SÉANCES ».
- Filtres en puces : « Tous », une puce par circuit réellement présent
  (`circuitFilters`), « Cette saison ».
- Cartes de séance avec le chrono au millième et un **badge d'honnêteté de la
  donnée** (`confidenceBadge` : complète / partielle / absente, calculé sur le
  nombre de tours, la présence de trames et la distance). Le code précise que le
  badge qualifie **la donnée**, jamais le pilote.
- Mode comparaison : appui long, sélection bornée à **deux**, barre flottante qui
  ressort en ressort, puis `compareHref`
  (`src/features/data/dataHubLogic.ts:183-187`).
- Export de ses données via `dataExportService`, avec un cadran de progression.
  Le code dit franchement que le service est atomique et que la progression est
  **indéterminée** — un minuteur monte jusqu'à 90 % puis attend.

Lecture stricte : une erreur de base donne un état d'erreur avec Réessayer, jamais
une liste vide muette.

### Séance — `app/(app2)/data/session/[id].tsx` (2 044 lignes)

L'écran pivot. Un seul défilement, sept ancres dans un rail horizontal collant
(`app/(app2)/data/session/[id].tsx:109-117`) : Résumé · Tours · Tracé · Télémétrie ·
Constats · Cœur · Conditions.

| Section | Source réelle | Comportement si vide |
|---|---|---|
| Résumé | `telemetry_sessions` + `laps` | chrono « — » |
| Tours | `fetchSessionLaps` (strict) | « Aucun tour complet capté pour cette séance. » |
| Tracé & virages | `app_segment_analyses` + trames GPS | « Tracé indisponible — aucune trame GPS pour cette lecture. » |
| Télémétrie | `telemetry_frames` | « Aucune trame du boîtier pour cette séance — la télémétrie s'affichera dès la première vraie capture. » |
| Constats | `session_insights` + nuage g-g réel | voir ci-dessous |
| Cœur | **aucune** | vide assumé, texte explicite |
| Conditions | `weather_snapshots` (température et humidité, nullables) | « Aucune météo capturée pour cette séance. » |

**La section Cœur est un vide écrit dans le code**
(`app/(app2)/data/session/[id].tsx:1636-1648`) : la table `telemetry_frames` ne porte
pas de fréquence cardiaque. L'écran le dit au pilote : « La fréquence cardiaque
n'est pas mesurée pour cette séance. Elle apparaîtra avec un capteur compatible et
votre accord. » Aucune valeur n'est inventée.

**La section Constats mérite une attention particulière.** Six lectures sont
proposées en liste ; chacune ouvre une feuille avec sa visualisation. Le
sous-libellé affiché est le **niveau** de la lecture, pas les anciens constats de
maquette qui portaient des chiffres fabriqués — le commentaire
(`app/(app2)/data/session/[id].tsx:1597-1599`) le dit explicitement. Une seule
lecture, « Cohérence du flow », porte un bandeau « Démonstration — données réelles
dès Valence » (`src/components/insights/catalogue.ts:54`), parce qu'aucune source
de fluidité n'existe encore.

**Mais** : les cinq autres lectures consomment `fetchSessionInsights`, qui lit la
table `session_insights` **sans filtrer la version du moteur**
(`src/services/sessionInsightsService.ts:19-49`). Le commentaire du service le dit :
« La ligne de démo `mirror-insights-demo` (7 virages) est renvoyée telle quelle
pour la session Haute Saintonge de démonstration. »

La production contient **exactement une** ligne dans `session_insights`, et son
`engine_version` vaut `mirror-insights-demo`. Elle porte sept virages, 11 800
trames et huit tours — alors que la séance en question (`b62ab3af`, « Haute
Saintonge BACKUP ») n'a **aucune** trame réelle en base. Sur cette séance-là,
quatre lectures sur six (Anatomie de virage, Dispersion, Tour idéal, Transfert de
charge) afficheront donc des chiffres de démonstration **sans bandeau qui le
signale**. C'est le seul endroit de l'arbre V2 où j'ai trouvé de la donnée
fabriquée présentée comme réelle.

### Saison — `app/(app2)/data/saison.tsx` (1 307 lignes)

Quatre lectures :

1. **Tour de référence** — courbe dorée de la progression du meilleur tour par
   circuit, points tappables qui ouvrent le bilan, ligne pointillée du record.
   Source : `fetchAllSessions` → `bestLapCurve`.
2. **Régularité** — histogramme de la distribution des écarts au tour de référence,
   plus le fait « X % de vos tours à moins d'une seconde ». Ce pourcentage vaut
   `null` — donc rien d'affiché — plutôt que 0 en l'absence de tour.
3. **Vos faits** — grille de statistiques consolidées, chiffres en compteur.
4. **Circuits** — cartes des circuits roulés (record personnel, nombre de séances)
   et silhouettes pointillées des circuits OXV à découvrir.

Les services sont appelés en mode strict pour distinguer « panne de lecture » de
« compte vide ».

**Point de navigation, à connaître** : `/(app2)/data/saison` **n'a aucun lien
entrant** dans tout l'arbre V2. Une recherche sur `data/saison` et `/saison` dans
`app/` et `src/` ne remonte que la définition de la route elle-même et le
commentaire de `signature.tsx`. L'écran existe, il est complet, il est
inatteignable par la navigation. Seul un lien profond ou une URL directe y mène.

### Comparer — `app/(app2)/data/comparer.tsx` (1 626 lignes)

La mise en regard de deux lectures, sans gagnant. Le fichier consacre 40 lignes
d'en-tête à la doctrine : deux colonnes strictement symétriques, l'écart est un
signe orienté neutre (« + », « - », « ± »), les deux valeurs sont dans la même
couleur de texte, l'or est **banni** de cet écran parce qu'il peindrait un côté en
étalon.

Trois modes : Séances · Tours · Ami.

- **Séances** : deux cartes de séance remplaçables, plus un tableau de quatre
  lignes (meilleur tour, régularité, vitesse maxi, distance).
- **Tours** : sélecteurs de tour, tracés superposés (A en accent, B en crème),
  canaux de vitesse superposés avec un curseur partagé lisant les deux côtés.
- **Ami** (`?friend=`) : s'appuie sur les règles de sécurité d'amitié qui n'ouvrent
  que les **faits** de séance de l'ami (meilleur tour, vitesse max) — jamais ses
  tours ni ses trames. Ce qui n'est pas lisible reste « — ».

Un test lexical relit la source du module de logique pour verrouiller le
vocabulaire neutre (`src/features/data/comparerLogic.ts:9-15`).

Accès : par sélection de deux séances au hub, et par la notification
« ami accepté » (`app/_layout.tsx:146`). Le bouton « Comparer côte à côte » de
l'écran Amis, lui, renvoie vers le hub Data et non vers le comparateur en mode ami
(`app/(app2)/club/roulages.tsx:576`).

---

## Club

Sept écrans. Le hub est un fil vertical de blocs ; **un bloc sans contenu réel
n'est pas rendu**.

### Hub — `app/(app2)/club/index.tsx` (645 lignes)

Cinq blocs, dans l'ordre :

1. **Mon coaching** — binôme (avatar, nom, prochaine séance, aperçu du dernier
   message) ou découverte (rail de visages des coachs publiés). Mène à
   `club/coaching`.
2. **Mon groupe** — nom de l'écurie, nombre de pilotes, avatars, et un fil de
   **faits** : « X a roulé le … ». Le seul canal autorisé est
   `session_attendance_public`, opt-in, réservé aux inscrits d'une même journée.
   La fonction serveur ne renvoie **aucun chrono**, et `crewFactFeed` l'exclut
   structurellement.
3. **Roulages à venir** — invitations avec Accepter / Décliner.
4. **Pass** — prochaine inscription. Mène à `club/pass`.
5. **Partenaires** — rail de logos. Mène à `club/partenaires`.

**Incohérence de source, vérifiée** : le bloc Pass du hub lit
`getMyNextTrackDay` (`src/features/club/useClubHub.ts:324-329`), qui interroge
`registrations` + `sessions`. L'écran Pass qu'il ouvre lit
`listMyRegistrations` (`src/services/eventsService.ts:336-354`), qui interroge
`event_registrations` + `events`. Ce sont **deux tables différentes**. En
production, `registrations` a 1 ligne et `event_registrations` en a 0. Le hub peut
donc annoncer « Prochaine inscription — Haute Saintonge », et l'écran ouvert
répondre « Aucune inscription pour l'instant ».

### Coaching — `app/(app2)/club/coaching.tsx` (1 266 lignes)

Trois onglets, parcourus en puces et au glissement.

- **Trouver** : cartes de coach, fiche en feuille avec bio, avis **en citations**
  — zéro étoile, zéro score, c'est la doctrine —, créneaux, demande de séance.
- **Mon coach** : le binôme et ses consentements granulaires (interrupteurs
  neutres, révocation immédiate), les factures gatées par le drapeau
  `coach_billing` (fermé), la fin de binôme derrière une confirmation sobre.
- **Demandes** : chronologie des états et avis post-séance en **texte libre**.

État en production : `coach_profiles` 1 ligne, `coach_pilots` 1 ligne,
`coach_availability` 4 lignes, `coaching_bookings` 2 lignes,
`coach_testimonials` 0 ligne.

### Roulages & amis — `app/(app2)/club/roulages.tsx` (1 032 lignes)

Deux onglets.

- **Roulages** : invitations à venir avec réponse, « roulé ensemble ×{n} » par
  coach, historique factuel.
- **Amis** : recherche par pseudonyme public en direct, liste des amis avec leur
  **dernier circuit** — jamais un chrono d'autrui, verrouillé dans `amisLogic` qui
  dépouille les séances de tout chrono avant qu'elles ne touchent l'interface —,
  badge « groupe » pour les membres de l'écurie.

**Aucun lien entrant depuis l'arbre V2.** Le seul accès est la notification
« demande d'ami » (`app/_layout.tsx:142`). Le hub Club ne l'ouvre pas.

État en production : `roulage_invitations` 0, `pilot_friendships` 0, `crews` 0.

### Territoire — `app/(app2)/club/territoire.tsx` (1 427 lignes)

Trois onglets : Carte · Routes · Créer.

- **Carte** plein écran (module cartographique v1), avec un garde : sans build
  natif, la carte est remplacée par une liste honnête. Repères : circuits OXV,
  pings sociaux publiés, départs des belles routes certifiées (anneau or).
  Panneau bas synchronisé au déplacement de la carte.
- **Routes** : cartes de route avec badge « CERTIFIÉE OXV », détail en feuille,
  bloc Convoi si la route est liée à une journée à venir (drapeau `convoys`,
  fermé).
- **Créer** : deux entrées vers les planificateurs **v1**, `/(app)/creer-route` et
  `/(app)/creer-trace` (`app/(app2)/club/territoire.tsx:622` et `629`).

Divergence assumée et écrite en tête du fichier : `scenicRoutesService` n'expose
pas la géométrie du tracé. Aucune polyligne n'est donc dessinée. Sur la carte, une
route certifiée n'apparaît que par son **point de départ réel** ; dans les cartes
et le détail, le motif de tracé est le circuit-repère générique, pas la géométrie
de cette route. La durée n'est pas affichée.

**Aucun lien entrant depuis l'arbre V2.** L'écran est inatteignable par la
navigation.

État en production : `social_pings` 0, `scenic_routes` 1, `convoys` 0.

### Partenaires — `app/(app2)/club/partenaires.tsx` (459 lignes)

Liste de cartes partenaire, puis fiche en feuille : visuel, description, offres,
et « ÊTRE MIS EN RELATION » qui exige un **consentement explicite en une phrase**
avant l'appel. Le garde-fou v1 est conservé mot pour mot : la mise en relation
transmet **uniquement** les coordonnées du pilote, jamais de donnée de pilotage
(`PARTNER_CONSENT_SENTENCE`).

État en production : `partner_accounts` a 2 lignes validées, toutes deux OXV
elle-même (« OXV » et « OXV · Administration »). `partner_offers` a 1 ligne en
statut `draft`, donc non publiée. Le rail du hub affichera deux tuiles OXV ; la
fiche n'aura aucune offre.

### Pass — `app/(app2)/club/pass.tsx` (495 lignes)

Inscriptions à venir en cartes (date, circuit, offre en puce), avec QR de présence
plein écran au toucher. Historique en lignes dessous. Aucune inscription →
illustration et bouton d'appel : `/(app2)/reserver` si le drapeau `app_payments`
est actif, sinon `/(app2)/club` (`app/(app2)/club/pass.tsx:127`,
`src/features/club/passLogic.ts:136-138`).

Le drapeau étant fermé, ce bouton renvoie aujourd'hui vers le Club.

État en production : `event_registrations` 0 ligne. L'écran est vide pour tous.

### Galerie — `app/(app2)/club/galerie.tsx` (1 002 lignes)

Deux onglets.

- **Galerie** : mosaïque à deux colonnes de tous les médias, groupés par séance
  avec en-têtes collants, visionneuse plein écran (pincement, glissement
  horizontal, fermeture vers le bas). Cellule vidéo seulement sous le drapeau
  `video_overlay`.
- **Partages** : la carte-souvenir (chrono et tracé or sur titane, capturée en
  image puis partagée par la feuille du système), le Carnet Heritage **réservé au
  palier Heritage** — sinon la section est absente, pas teasée —, et les liens de
  partage révocables (table `app_progression_shares`).

**Aucun lien entrant depuis l'arbre V2.**

État en production : `session_media` 0 ligne, `app_progression_shares` 1 ligne.
La galerie afficherait « Vos photos et vidéos de roulage apparaîtront ici. Elles
sont déposées par OXV après chaque journée sur circuit. »

---

## Compte — `vous/*`

Douze écrans. Le hub en liste sept, plus trois blocs propres.

### Hub — `app/(app2)/vous/index.tsx` (642 lignes)

- **Héros passeport** : photo du véhicule principal (repli sur l'insigne), avatar
  bordé d'or si le palier est Heritage, nom, pseudonyme public, et une ligne
  d'identité en monospace qui défile au premier passage : « {palier} · {n} records
  · {km} km ». Chaque segment n'apparaît que s'il trace vers une source réelle
  (`src/features/vous/vousHubLogic.ts:44-56` et `70-80`).
- **Carte Membre Fondateur** : gatée par le drapeau `founders` (fermé) — la carte
  est **absente** si le drapeau est fermé. Jauge x/30 réelle, jamais un « 12/30 »
  codé en dur.
- **Code de parrainage** et ligne « écurie ».
- **Sept sections d'accès** (`app/(app2)/vous/index.tsx:63-70`) : Profil public,
  Garage, Carnet, Équipement, Licence & documents, Réglages, Support.

Déviation doctrinale consignée dans l'en-tête : la jauge fondateur, décrite
« remplie or » dans le cahier des charges, est rendue en gris neutre — l'or reste
réservé au palier Heritage.

Canal d'erreur : l'**identité** est la source primaire. Son échec bascule l'écran
en erreur. Tout le reste est best-effort.

### Profil public — `app/(app2)/vous/profil.tsx` (829 lignes)

Deux visages sur un écran : consultation (ce que voient les autres) et édition en
ligne. Couverture, avatar chevauchant, nom, pseudonyme, bio, puces véhicules,
réseaux, opt-in Pavillon.

Honnêtetés de schéma écrites en tête :

- il n'existe pas de colonne de couverture dédiée : la couverture est la photo de
  profil la plus récente, avec repli sur la couverture du véhicule principal, puis
  sur un dessin — jamais une image de banque ;
- l'avatar n'a **aucun chemin d'écriture** dans l'application, il est géré hors
  application, donc non éditable ;
- bio, numéro de course et opt-in Pavillon sont masqués tant que la migration
  correspondante n'est pas appliquée.

**Vérifié en base** : les colonnes `bio`, `car_number` et `pavilion_name_optin`
**existent** dans `public.users`. La migration est donc appliquée en production et
ces trois champs seront visibles. Sur 14 comptes, 2 ont un pseudonyme public, 0 ont
un avatar.

### Garage — `app/(app2)/vous/garage.tsx` (978 lignes)

Liste verticale de cartes véhicule plein cadre. Un toucher ouvre la fiche :
carrousel de photos, spécifications, journal de réglages daté avec composeur.
Ajout de véhicule par carte pointillée.

Honnêtetés de schéma écrites en tête :

- il n'y a **pas** de colonne « véhicule principal » : le véhicule qui illustre
  l'accueil est le premier enregistré, non modifiable. Aucun bouton « Définir
  principal » n'a été inventé, seulement une mention factuelle ;
- le sélecteur n'ajoute **qu'une photo à la fois**, limite du service.

Sources : `vehicles` (6 lignes en production), photos dans `users.media` (0 compte
renseigné), `vehicle_setups` (0 ligne).

### Carnet — `app/(app2)/vous/carnet.tsx` (914 lignes)

Quatre onglets parcourus au glissement, avec un indicateur qui suit le doigt.

- **Notes** : `pilot_notes` datées, avec la météo **réelle du jour de la note**
  quand elle existe. Le hook lit `weather_snapshots` en direct pour garder la
  température nullable — le service partagé la ramènerait à 0, ce qui fabriquerait
  un « 0° du jour » (`src/features/vous/useCarnet.ts:13-18`). Composeur en bas,
  partage au coach en opt-in par note.
- **Intentions** : une carte par intention liée à sa séance, état honorée / en
  attente factuel (`session_intentions`).
- **Objectifs** : personnels, **invisibles du coach**, mention explicite en tête.
  Barre de progression seulement si l'objectif porte une mesure.
- **Programme** : cycles partagés par le coach, lus tels quels — c'est le seul
  espace prescriptif autorisé.

État en production : `pilot_notes` 0, `session_intentions` 0, `pilot_goals` 0,
`pilot_development_cycles` 0. Les quatre onglets sont vides.

### Équipement — `app/(app2)/vous/equipement.tsx` (422 lignes)

À ne pas confondre avec `rec/equipement`. Ici, aucun scan : c'est l'écran d'**état**.

- Carte boîtier : visuel au trait, pastille d'état, batterie en **cadran** (le seul
  de l'écran), numéro de série, dernier contact (`deviceHealthService`).
- Carte ceinture pour les coachés : « gérée au paddock ».
- Carte Apple Watch, **iOS uniquement** : statut HealthKit et bouton « Autoriser »
  gaté par consentement + drapeau + plateforme. Sur Android, la carte est absente.

État en production : `devices` 0, `device_assignments` 0, `device_health_logs` 0.
L'écran affichera « Aucun boîtier affecté. Il vous est remis au paddock. »

### Licence & documents — `app/(app2)/vous/documents.tsx` (504 lignes)

Trois blocs.

1. **Carte licence FFSA** au ratio d'une carte bancaire, alimentée par les vraies
   colonnes de `users` (`ffsa_license`, `kyc_status`, `kyc_validated_at`) — zéro
   champ inventé. Toucher l'ouvre en grand et permet le partage par capture. Note
   honnête dans l'en-tête : `expo-brightness` est absent du projet, il n'y a donc
   pas de montée de luminosité, la carte est simplement présentée en grand.
2. **Décharge**, gatée par le drapeau `pilot_waivers` (fermé) : la ligne dit
   « disponible prochainement » et n'est pas tappable.
3. **Documents légaux** bundlés : Pacte de pilotage, CGU, Politique de
   confidentialité.

État en production : 0 compte sur 14 porte un `ffsa_license`. L'écran affichera
« Votre licence apparaîtra dès que votre profil sera renseigné. »

### Décharge — `app/(app2)/vous/decharge.tsx` (502 lignes)

Flux de signature électronique v1 rhabillé. Le drapeau `pilot_waivers` est
**revérifié sur l'écran lui-même**. Tant qu'il est fermé — parce que le texte n'a
pas été relu par un avocat —, l'écran affiche « Bientôt » : rien de légalement
effectif n'est présenté. Ouvert, le pilote lit, saisit son nom, coche et signe ;
l'application horodate et scelle l'empreinte du texte.

État en production : drapeau fermé, `pilot_waiver_signatures` 0 ligne.

### Lecteur légal — `app/(app2)/vous/document/[doc].tsx` (198 lignes)

Rendu markdown minimal des textes bundlés dans `src/legal/legalDocuments.ts`.
Corps en 15 points, interligne 1,65. Accès permanent, exigence RGPD.

### Réglages — `app/(app2)/vous/reglages.tsx` (674 lignes)

Quatre groupes.

1. **Notifications** : interrupteur maître, rituels (bilan, J-3, records), rappel
   de la veille, offres partenaires. Colonnes réelles de `users`, JSONB préservé.
2. **Consentements** : débrief assisté par IA, assistant IA du coach, statistiques
   d'usage, partage en direct avec le coach, rythme cardiaque (capture puis
   partage). Chaque bascule porte un sous-texte factuel d'une ligne.
3. **Données & sécurité** : export avec cadran d'état, suppression à J+30 en double
   confirmation.
4. **Session** : déconnexion.

Point d'honnêteté important (`src/features/vous/useReglages.ts:15-25`) : les
écritures sont optimistes, **mais** chaque bascule inspecte le retour et **annule**
l'état si l'écriture a échoué, puis affiche un bandeau. Aucune bascule n'affiche
« activé » sur une écriture ratée. Une exception pessimiste : la **révocation de la
capture cardio** ne passe à l'arrêt qu'**après** confirmation du serveur — on ne
prétend pas avoir coupé une collecte de santé qui resterait horodatée.

### Support — `app/(app2)/vous/support.tsx` (505 lignes)

Liste des demandes avec pastille de statut ; un toucher ouvre le fil dans une
feuille. Composeur pour une nouvelle demande (catégorie en puce, objet, message).
Services v1 inchangés.

État en production : `support_tickets` 0, `support_messages` 0.

### Membre fondateur — `app/(app2)/vous/fondateur.tsx` (472 lignes)

Insigne qui se dessine, manifeste « 30 membres. Jamais plus. », jauge x/30 réelle,
champ de motivation (20 à 2 000 caractères, compteur), code de parrain optionnel.

Le drapeau `founders` est **revérifié sur l'écran** : fermé, l'écran affiche « Les
candidatures Membre Fondateur ouvriront prochainement » et aucune écriture n'est
possible.

Déviation doctrinale assumée et écrite : l'insigne et la jauge sont en tons titane
neutres, **pas en or** — l'or reste exclusif au palier Heritage.

État en production : drapeau fermé, `founder_applications` 0 ligne.

---

## Réservation — `reserver/*`

Trois écrans, tous gatés par le drapeau `app_payments`, **fermé par défaut et
fermé en production**.

### Catalogue — `app/(app2)/reserver/index.tsx` (205 lignes)

Liste de cartes journée : photo du circuit, date pleine, offres en puces, jauge de
places en 20 segments (« la rareté se voit »), et « LISTE D'ATTENTE » si complet.
Données du site via `bookingCatalogService`, en lecture seule sur les vues
`sessions_public`, `session_availability` et la table `pricing`.

### Détail & offre — `app/(app2)/reserver/[sessionId].tsx` (369 lignes)

Héros circuit plein, programme de la journée en chronologie, sélection d'offre en
cartes radio avec prix TTC en monospace, récapitulatif. Prix absent → « — ».

### Paiement — `app/(app2)/reserver/paiement.tsx` (292 lignes)

Récapitulatif (circuit, date, offre, total TTC) puis méthodes de paiement.

**Les boutons sont inertes.** `MethodRow` est une simple vue non tappable annoncée
« bientôt disponible », et le bouton de bas d'écran est une vue marquée désactivée
portant « Paiement à l'ouverture » (`app/(app2)/reserver/paiement.tsx:160-172`).
Stripe et l'achat intégré sont prévus pour un lot ultérieur.

Une mention légale porte un marqueur explicite dans le code : le texte des
Conditions générales de vente reste à rédiger.

### Accessibilité de la zone

Le tunnel émet des événements de mesure (`reserve_funnel_1/2/3`) **que l'accès soit
ouvert ou fermé** — c'est délibéré, pour mesurer l'intention avant l'ouverture.

Mais la zone est aujourd'hui **inatteignable** :

- depuis l'accueil et le hub Session, `decideReserve` renvoie vers le Club dans les
  deux branches ;
- depuis le Pass, le bouton ne mène à `/(app2)/reserver` que si `app_payments` est
  actif — il est fermé.

Aucun autre lien ne pointe vers `reserver/`.

---

## L'écran de validation du kit

`app/(app2)/dev-galerie.tsx` (763 lignes). Il redirige vers la racine et ne rend
**rien** hors développement (`app/(app2)/dev-galerie.tsx:579`). Toutes ses valeurs
sont des constantes de démonstration locales au fichier, jamais exportées. Il
présente les composants du kit, les vingt icônes, les primitives d'animation
rejouables et le vocabulaire tactile.

---

## La navigation

### La barre à cinq zones

`src/ui/v2/TabBar.tsx`, table dans `src/ui/v2/shellLogic.ts:208-213`.

Quatre portes latérales, iconographiques, et un bouton central inséré au milieu :

| Position | Clé | Icône | Route |
|---|---|---|---|
| 1 | miroir | `miroir` | `/(app2)` |
| 2 | data | `data` | `/(app2)/data` |
| 3 | — | bouton central | selon l'état |
| 4 | club | `club` | `/(app2)/club` |
| 5 | vous | `casque` | `/(app2)/vous` |

Hauteur du contenu : 56 points, plus la zone sûre du bas, avec un plancher de 8.
La formule unique `tabBarSpace()` est celle que chaque écran utilise pour son
espacement bas — le commentaire précise que toute formule ad hoc finirait par
diverger.

Fond flou sur iOS ; sur Android, un aplat opaque délibéré, parce que le flou
Android se recalcule à chaque image sous un contenu qui défile.

Le bouton central déborde de 12 points au-dessus de la barre, et ce débord est
**inclus dans les limites de la barre** : sans cela, le haut du cercle serait une
zone morte tactile sur Android.

La porte active est en texte clair et grossie de 6 % par ressort ; les inactives
sont en gris. Un retour tactile accompagne chaque appui.

### Le bouton central, trois états

`src/ui/v2/centralButtonLogic.ts:78-87` :

| Condition | Mode | Rendu |
|---|---|---|
| une capture est en cours | `rec` | cercle plein accent, point pulsant, tactile « armer » |
| une journée circuit à venir | `countdown` | cercle bordé, libellé « J-3 », « J-0 » le jour J |
| sinon | `reserve` | cercle bordé, icône drapeau à damier |

Le compte de jours va de minuit local à minuit local ; l'arrondi absorbe les
bascules d'heure d'été. La journée est relue à la connexion, à la fin d'une
capture, et au retour de l'application au premier plan — un « J-x » calculé la
veille ne reste pas figé (`src/ui/v2/useCentralButtonState.ts:40-69`).

**Câblage à connaître** : `app/(app2)/_layout.tsx:105-108` route l'appui du bouton
central vers `/(app2)/club` en mode `reserve` et vers `/(app2)/rec` dans les deux
autres modes. Le commentaire le qualifie de « câblage provisoire (lot L0) » en
attendant le vrai flux de réservation. Il n'a pas été mis à jour.

### Le silence en piste

Deux mécanismes se cumulent dans `app/(app2)/_layout.tsx:78` :

```
const showTabBar = shouldShowTabBar(pathname, pilotState) && !isV2CaptureFlowPath(pathname);
```

1. `shouldShowTabBar` (`src/lib/appMap.ts:175-179`) masque la barre dès que l'état
   pilote vaut `S6_roulage`, **quel que soit l'écran**, et sur les segments v1 du
   flux de capture (`src/lib/appMap.ts:161-169`).
2. `isV2CaptureFlowPath` (`src/ui/v2/centralButtonLogic.ts:106-111`) masque la barre
   sous `/rec/<segment>` pour cinq segments seulement
   (`src/ui/v2/centralButtonLogic.ts:98`) : `arrivee`, `equipement`, `placement`,
   `roulage`, `fin`.

`rec/preparation` et `rec/entre-runs` **gardent la barre** — c'est un choix
documenté du lot L0 : on est au paddock, pas en piste.

Le silence ne se limite pas à la barre. L'accueil lui-même se vide en S5 et S6
(`app/(app2)/index.tsx:154-165`), et l'écran de roulage n'affiche aucun chiffre. Un
retour par geste depuis le flux de capture pendant le roulage ne montre donc
jamais un chrono, un radar ou une statistique.

### Le garde d'authentification

`app/(app2)/_layout.tsx:71-73` : si la session expire en cours d'usage, le magasin
passe en « non authentifié » et tout le groupe redirige vers `/(auth)/login`.
Même garde que l'arbre v1.

---

## Les trois écrans v1 vers lesquels (app2) renvoie encore

C'est écrit noir sur blanc dans `app/index.tsx:103-106` : l'arbre v1 n'est pas
supprimé, et l'arbre V2 y renvoie **volontairement** pour trois écrans non portés.

| Écran v1 | Appelé depuis | Ligne |
|---|---|---|
| `/(app)/carte-trophee` | feuille de partage du Bilan | `app/(app2)/bilan/[sessionId].tsx:577` |
| `/(app)/creer-route` | onglet Créer de Territoire | `app/(app2)/club/territoire.tsx:622` |
| `/(app)/creer-trace` | onglet Créer de Territoire | `app/(app2)/club/territoire.tsx:629` |

Ce sont les trois seules sorties vers l'arbre v1 dans tout `app/(app2)/` — une
recherche de `(app)/` dans le dossier ne remonte rien d'autre que des commentaires.

Le premier est la carte trophée à partager ; les deux autres sont le planificateur
de route (moteur GraphHopper) et l'import de tracé OSM. Le commentaire de commit
est explicite : le moteur v1 est réutilisé tel quel, jamais réécrit. La suppression
de l'arbre v1 est prévue **après validation terrain, pas avant**.

Le même commit consigne quatre écrans v1 supplémentaires sans équivalent V2
(`mes-routes`, `regularite`, `data-lab-canvas`, `share/[token]`) et quatre
capacités perdues à l'intérieur d'écrans par ailleurs couverts : l'inscription à un
événement ouvert, la certification et la suppression d'une belle route, le
catalogue d'offres par catégorie, l'écart-type de séance. Ce sont des arbitrages
produit en attente de décision, pas des oublis techniques.

---

## Ce qui n'a jamais été observé, et ce qui reste ouvert

### Jamais exécuté

- **Aucune exécution sur appareil ni en simulateur** dans le cadre de ce document.
  Le rendu, les gestes, la fluidité et le comportement Bluetooth sont des lectures
  de code.
- Le commit de bascule L6 signale lui-même que **trois chemins sont produits par les
  deux arbres** — `/`, `/club`, `/signature` — et que « lequel gagne n'a pas été
  observé, faute d'exécution ». C'est le premier point à tester sur appareil.
- Le drapeau `biometry` a été ouvert en production le 25 juillet 2026. Sa propre
  description en base indique : « Reste non tenu à la levée : smoke test 2
  appareils reels ». L'appairage de la ceinture Polar n'a donc jamais été observé.
- Le déclencheur BIO-1 (Apple Watch) est décrit dans le code comme sans effet
  aujourd'hui, HealthKit étant absent du binaire.

### Écrans complets mais sans porte d'entrée

Quatre écrans, entièrement écrits, n'ont **aucun lien entrant** dans l'arbre V2 :

| Écran | Lignes | Seul accès existant |
|---|---|---|
| `app/(app2)/data/saison.tsx` | 1 307 | aucun |
| `app/(app2)/club/territoire.tsx` | 1 427 | aucun |
| `app/(app2)/club/galerie.tsx` | 1 002 | aucun |
| `app/(app2)/club/roulages.tsx` | 1 032 | notification « demande d'ami » uniquement |

À quoi s'ajoute la zone `reserver/*` (3 écrans, 866 lignes), atteignable seulement
si le drapeau `app_payments` est ouvert, depuis l'écran Pass.

Cela représente **environ 5 600 lignes d'écran** qu'un pilote ne peut pas atteindre
aujourd'hui par la navigation.

### Points de donnée à trancher

1. **La ligne de démonstration `session_insights`.** Une ligne unique, marquée
   `engine_version = 'mirror-insights-demo'`, est lue et affichée sans filtre par
   `src/services/sessionInsightsService.ts`. Quatre des six « lectures approfondies »
   afficheront ses chiffres **sans bandeau de démonstration**, sur la séance
   `b62ab3af` (« Haute Saintonge BACKUP »). Seule la lecture « Cohérence du flow »
   porte le bandeau.
2. **Les deux tables d'inscription.** Le bloc Pass du hub Club et l'écran Pass
   lisent deux tables différentes (`registrations` contre `event_registrations`).
   L'un peut annoncer une inscription que l'autre ne connaît pas.
3. **« RÉSERVER » ne réserve pas.** Depuis l'accueil et le hub Session, le bouton
   ouvre le Club, drapeau ouvert ou fermé, par décision explicite verrouillée par
   test.
4. **Le bouton central en mode `reserve`** ouvre également le Club, sur un câblage
   qualifié de provisoire depuis le lot L0.

### Ce qui est réellement alimenté par de vraies données aujourd'hui

Alimenté et vérifiable en base :

- l'accueil : prochaine journée (1 inscription réelle au 24/12/2026), météo réelle
  du circuit, nombre de séances, nom du circuit, dates ;
- le hub Data et l'écran de séance : les 10 séances complétées et leurs métadonnées
  (statut, circuit, date, distance) ;
- le Bilan : les 3 débriefs et les 13 marges globales de `app_session_analyses` ;
- les Réglages : toutes les préférences, sur les vraies colonnes de `users` ;
- le Coaching : 1 profil coach, 1 binôme, 4 créneaux, 2 demandes ;
- les Partenaires : 2 comptes validés (tous deux OXV), 0 offre publiée ;
- le Garage : 6 véhicules ;
- les documents légaux : bundlés, donc toujours lisibles.

Vide par absence de donnée, avec état vide honnête :

- chronos, tours, trames, QDI, radar Signature, Empreinte, courbe de saison,
  régularité, comparateur, biométrie ;
- photos, galerie, souvenirs, carte-souvenir, avatars ;
- notes, intentions, objectifs, programme ;
- pass événementiel, amis, écurie, roulages, pings, convois, support ;
- boîtier affecté, licence FFSA, décharge, candidature fondateur, pack Heritage.

Fermé par drapeau, donc volontairement absent :

- réservation et paiement (`app_payments`) ;
- convois (`convoys`) ;
- vidéo du tour (`video_overlay`) ;
- décharge e-sign (`pilot_waivers`) ;
- candidatures fondateur (`founders`) ;
- facturation coach (`coach_billing`).

Un seul drapeau est ouvert : `biometry`, depuis le 25 juillet 2026.

---

## L ancien arbre pilote, ce qui en reste

Avertissement de méthode, valable pour toute la section. Rien n a été exécuté :
ni l application, ni le compilateur, ni la suite de tests. Tout ce qui suit est
une lecture du code du dépôt et des données de production en lecture seule.
Quand je décris un rendu, un geste ou un enchaînement d écrans, je décris ce que
le code prescrit, pas ce que j ai vu. Les endroits où seule une exécution
trancherait sont signalés comme tels.

### Ce que contient exactement le dossier

Le dossier `app/(app)/` contient 83 fichiers `.tsx`. Trois d entre eux ne sont
pas des écrans mais des enveloppes de navigation :

- `app/(app)/_layout.tsx` (41 lignes)
- `app/(app)/cote-a-cote/_layout.tsx` (15 lignes)
- `app/(app)/session-media/_layout.tsx` (15 lignes)

Il reste donc **80 écrans**, pour 38 274 lignes de code au total.

À titre de comparaison, l arbre V2 `app/(app2)/` compte 38 fichiers, dont
1 layout (`app/(app2)/_layout.tsx`), soit 37 routes — et l une d elles,
`app/(app2)/dev-galerie.tsx`, se coupe hors développement
(`app/(app2)/dev-galerie.tsx:579`). Cela fait **36 écrans de production**, pour
27 666 lignes.

L ancien arbre est donc plus de deux fois plus fourni en écrans que le nouveau,
et pèse 1,4 fois plus de code.

### Ce qui a changé le 26 juillet, et ce qui n a pas changé

La bascule s appelle L6. Elle tient dans une ligne de `app/index.tsx` :

- `app/index.tsx:107` — `return <Redirect href={'/(app2)' as never} />;`

Avant ce commit (`29e34f9`, 26/07/2026), cette ligne renvoyait vers `/(app)`.
Le commentaire posé juste au-dessus dit lui-même ce qui n a pas été fait :

- `app/index.tsx:103-106` — « L arbre v1 reste en place et atteignable :
  (app2) y renvoie encore volontairement pour trois écrans non portés. »

Le même lot a retiré une garde de `app/(app2)/_layout.tsx` qui, hors mode
développeur, renvoyait tout le groupe V2 vers la racine. La raison du retrait
est écrite sur place :

- `app/(app2)/_layout.tsx:63-66` — la conserver aurait produit une boucle de
  redirection en production, et seulement en production.

Ce qui n a pas changé : **aucun fichier de `app/(app)/` n a été supprimé**. Le
dernier commit qui a touché ce dossier est `e05796b` du 25/07/2026 (correctif
météo sur `app/(app)/carnet.tsx`, `app/(app)/conditions.tsx` et
`app/(app)/preparation.tsx`). L arbre v1 est donc gelé depuis la veille de la
bascule, pas depuis des mois.

### Il est toujours embarqué dans l application

Le point d entrée du projet est `expo-router/entry` (`package.json:4`), et
`metro.config.js` n applique aucun filtrage de routes. Expo Router construit sa
table de navigation en parcourant l intégralité du dossier `app/`. Les
80 écrans v1 sont donc **compilés et embarqués dans le binaire iOS**, qu on les
ouvre ou non. Je n ai pas mesuré le poids exact que cela représente dans le
bundle — cela demanderait un build.

Ils sont aussi tenus par l outillage : `package.json:15` fait tourner ESLint sur
`app/**/*.{ts,tsx}`, `package.json:10` fait tourner `tsc --noEmit` sur tout le
projet, et les deux scripts de garde doctrinale
(`scripts/check-doctrine.ts:176`, `scripts/check-accessibility.ts:91`) scannent
le dossier `app/` entier. Chaque passe de qualité paie donc encore le prix des
80 écrans.

Détail de dette, mentionné pour être complet : `app/(app)/profil.tsx` est le
**seul** fichier des deux arbres pilote à porter des fins de ligne Windows
(CRLF). C est la source des erreurs Prettier signalées dans le message du
commit L6. Aucun fichier de `app/(app2)/` n est dans ce cas.

## Pourquoi il n a pas été supprimé

Cinq raisons distinctes, toutes vérifiables dans le code. Les deux premières
sont celles que le lot L6 a consignées ; les trois suivantes s y ajoutent et
n avaient pas été énoncées.

### Raison 1 — l arbre V2 y renvoie pour trois écrans qu il ne sait pas faire

Ce sont les seuls liens de `(app2)` vers `(app)`, et ils sont volontaires.

| Depuis | Ligne | Vers |
| --- | --- | --- |
| `app/(app2)/bilan/[sessionId].tsx` | 577 | `/(app)/carte-trophee?sessionId=…` |
| `app/(app2)/club/territoire.tsx` | 622 | `/(app)/creer-route` |
| `app/(app2)/club/territoire.tsx` | 629 | `/(app)/creer-trace` |

Dans le bilan V2, l entrée s appelle « Carte trophée · La carte à partager de la
séance » et vit dans la feuille « PARTAGER », à côté de l export PDF
(`app/(app2)/bilan/[sessionId].tsx:562-580`).

Dans l écran Territoire, les deux entrées vivent dans un onglet « Créer », et le
commentaire dit pourquoi elles n ont pas été réécrites :

- `app/(app2)/club/territoire.tsx:614-616` — « La logique v1 (GraphHopper /
  Overpass, import OSM) reste intacte : ces entrées ouvrent les planificateurs
  existants plutôt que de dupliquer leur moteur. »

Conséquence de navigation, et c est le point important. Quand le pilote suit
l un de ces trois liens, il quitte le groupe `(app2)` et entre dans le groupe
`(app)`. Le layout de l ancien arbre se monte alors
(`app/(app)/_layout.tsx:32-39`) et pose **sa** barre d onglets à cinq zones
(`src/components/AppTabBar.tsx:45-80`) — Miroir, Data Lab, Carnet, Découverte,
Compte. Cette barre navigue vers `TAB_MAIN_ROUTE` (`src/lib/appMap.ts:27-33`),
c est-à-dire vers `/(app)`, `/(app)/data-lab`, `/(app)/carnet`,
`/(app)/coachs`, `/(app)/compte`. Autrement dit : d un seul écran emprunté à
l ancien arbre, **la totalité de l ancienne application redevient accessible en
un tap**, dans son ancien langage graphique. Je n ai pas pu l observer : c est
la lecture du code de layout et de barre d onglets.

### Raison 2 — l espace pilote professionnel s en sert comme bibliothèque

`app/(pro)/` (8 fichiers, 1 870 lignes) n a jamais eu ses propres écrans de
données. Il pointe directement dans l arbre v1 :

| Fichier | Ligne | Route v1 appelée |
| --- | --- | --- |
| `app/(pro)/index.tsx` | 30 | `/(app)/bilan` |
| `app/(pro)/index.tsx` | 31 | `/(app)/data-lab` |
| `app/(pro)/index.tsx` | 32 | `/(app)/passeport` |
| `app/(pro)/index.tsx` | 33 | `/(app)/signature` |
| `app/(pro)/index.tsx` | 34 | `/(app)/garage` |
| `app/(pro)/index.tsx` | 122 | `/(app)/bilan` (dernière séance) |
| `app/(pro)/performance.tsx` | 34 | `/(app)/comparateur` |
| `app/(pro)/performance.tsx` | 39 | `/(app)/progression` |
| `app/(pro)/bibliotheque.tsx` | 177 | `/(app)/bilan` |

À quoi s ajoute l icône de compte. `src/ui/AccountButton.tsx:17` pointe en dur
vers `/(app)/compte`, et ce composant est monté par cinq écrans de l espace pro
(`app/(pro)/index.tsx`, `app/(pro)/equipe.tsx`, `app/(pro)/media.tsx`,
`app/(pro)/partage.tsx`, `app/(pro)/performance.tsx`).

Supprimer `app/(app)/` casserait donc **dix points d entrée** de l espace pro.

Nuance de production, importante pour hiérarchiser : la table `users` ne
contient aujourd hui **aucun compte de rôle `pro_pilot`** (répartition réelle
mesurée en base : 11 `pilot`, 2 `admin`, 1 `partner`). L espace pro est un
espace vide de titulaires. La dépendance est réelle dans le code, pas dans
l usage.

### Raison 3 — l espace coach y renvoie aussi

Ce point ne figurait pas dans le bilan du lot L6. Deux liens :

- `app/(coach)/pilote/[id].tsx:759` — la carte d une séance de son pilote ouvre
  `/(app)/bilan`.
- `app/(coach)/pilote/[id].tsx:797` — le bouton « Annoter » ouvre
  `/(app)/virage`, précisément pour que le coach choisisse le virage avant
  d écrire. Le commentaire au-dessus explique que passer directement à
  l éditeur envoyait la note sur le virage 1
  (`app/(coach)/pilote/[id].tsx:790-796`).

Autrement dit, **la boucle de travail du coach passe encore par l ancien
arbre**. Là aussi, aucun compte de rôle `coach` n existe en base aujourd hui,
mais une affiliation existe (`coach_pilots` : 1 ligne).

### Raison 4 — la table de navigation v1 est encore lue par la V2

`src/lib/appMap.ts` est présentée dans son propre en-tête comme la « source
unique de vérité de la navigation pilote » et mappe « chaque route réelle de
`app/(app)/*` » (`src/lib/appMap.ts:1-18`).

Or le layout V2 l importe :

- `app/(app2)/_layout.tsx:26` — `import { shouldShowTabBar } from '@/lib/appMap';`
- `app/(app2)/_layout.tsx:78` — `shouldShowTabBar(pathname, pilotState) && !isV2CaptureFlowPath(pathname)`

C est cette fonction v1 (`src/lib/appMap.ts:175-179`) qui décide du **silence en
piste** dans l arbre V2 : elle masque la barre d onglets quand l état pilote est
`S6_roulage`. Le complément V2 (`src/ui/v2/centralButtonLogic.ts`) ne couvre que
les segments `/rec/*`. Supprimer l ancien arbre sans traiter `appMap` reviendrait
donc à toucher au principe 3.

### Raison 5 — un test lit physiquement le dossier v1

`src/lib/__tests__/appMap.test.ts:14-26` ouvre le dossier `app/(app)` avec
`fs.readdirSync` et vérifie deux invariants : qu aucun écran v1 n est sans zone,
et qu aucune entrée de la table ne pointe vers un fichier inexistant
(lignes 96-107). Le test tomberait dès la suppression du dossier.

Une liste d exemptions y est maintenue à la main
(`src/lib/__tests__/appMap.test.ts:32-38`) : `debug-capture`, `debug-circuit`,
`session-media`, `share`, `decharge`.

## Les sept écrans orphelins

« Orphelin » signifie ici : aucun écran de l arbre V2 ne rend cette fonction. Ce
n est pas la même chose qu inatteignable — trois des sept sont au contraire
appelés depuis la V2.

### 1. `app/(app)/carte-trophee.tsx` — la carte-souvenir (342 lignes)

Ce que fait l écran : il lit `?sessionId=`, charge la séance et ses tours, en
tire le meilleur tour réel via `computeRegularity` (repli `best_lap_seconds`) et
la géométrie du tracé, puis rend le composant `<TrophyCard>` en 4:5, capturable
(`app/(app)/carte-trophee.tsx:2-14`, `:120`, `:221`). Deux actions ancrées en
bas : capture de l image via `react-native-view-shot` puis feuille de partage
système.

Il est **appelé depuis la V2** (`app/(app2)/bilan/[sessionId].tsx:577`).

Nuance : le composant `src/components/TrophyCard.tsx` est, lui, réutilisé dans
la V2 — `app/(app2)/club/galerie.tsx:74` et `:408` le montent dans l onglet
« Partages ». C est donc **l écran** qui manque, pas la carte. La V2 sait
afficher une carte-souvenir de galerie ; elle ne sait pas ouvrir celle d une
séance précise depuis son bilan.

Dépendance propre à cet écran : `@/services/mediaExportsService`, importé
uniquement ici dans tout le dépôt.

### 2. `app/(app)/creer-route.tsx` — le planificateur de balade (818 lignes)

Le plus gros des sept. Il pilote trois services de routage :
`scenicRouteService` (appel GraphHopper avec un modèle de sinuosité
personnalisé), `scenicPoiService` (Overpass / OpenStreetMap) et
`scenicRoutesService.saveRoute` (`app/(app)/creer-route.tsx:1-14`, `:57`).

Les deux premiers ne sont importés **que** par cet écran :
`@/services/routing/scenicRouteService`, `@/services/routing/scenicPoiService`,
et le module de types `@/services/routing/types`.

Il est **appelé depuis la V2** (`app/(app2)/club/territoire.tsx:622`).

### 3. `app/(app)/creer-trace.tsx` — l import OpenStreetMap (213 lignes)

Saisie d un identifiant de « way » OSM, récupération des points, génération de
géométrie, prévisualisation, puis écriture dans la table `circuits` avec un
statut de visibilité (privé, ou proposé à OXV via `review_status='submitted'`)
et l attribution obligatoire aux contributeurs OpenStreetMap
(`app/(app)/creer-trace.tsx:1-14`).

Il est **appelé depuis la V2** (`app/(app2)/club/territoire.tsx:629`).

### 4. `app/(app)/mes-routes.tsx` — mes belles routes (220 lignes)

Liste les routes de balade enregistrées par le pilote, avec leur statut de
certification, et porte deux actions d écriture :

- `requestCertification(id)` — demander la certification OXV
  (`app/(app)/mes-routes.tsx:57`)
- `deleteRoute(id)` — supprimer la route (`app/(app)/mes-routes.tsx:71`)

Il affiche aussi les quatre statuts réels (`Brouillon`, `En revue OXV`,
`Certifiée OXV`, `Non retenue`) et, en cas de refus, la note de l administrateur
(`app/(app)/mes-routes.tsx:30-35`, `:131-133`).

Aucun écran ne l ouvre plus, sauf `app/(app)/coachs.tsx:830` — c est-à-dire un
autre écran v1.

### 5. `app/(app)/regularite.tsx` — l écart-type de séance (296 lignes)

L écran mesure la dispersion des tours autour de la médiane : un chiffre central
(l écart-type), une bande descriptive, une barre par tour. Il s appuie sur
`computeRegularity` (`src/services/regularityService.ts`), qui expose
`medianSeconds`, `bestSeconds`, `stdDevSeconds`, `spreadSeconds` et une bande
neutre `resserré / régulier / dispersé`
(`src/services/regularityService.ts:24-40`).

Son seul point d entrée était `app/(app)/progression.tsx:67`.

Aucun fichier de `app/(app2)/` n importe `computeRegularity` ni
`regularityService` — je l ai vérifié par recherche sur tout le sous-arbre V2 et
sur `src/features/`. La V2 mesure la régularité autrement (voir plus bas).

### 6. `app/(app)/data-lab-canvas.tsx` — la vue unifiée Skia (230 lignes)

Aperçu technique qui monte `DataLabCanvas` (rendu natif Skia) derrière une garde
Expo Go, via un `require()` synchrone
(`app/(app)/data-lab-canvas.tsx:2-15`, `:42-46`). Son en-tête le qualifie
lui-même d « APERÇU TECHNIQUE, à valider au build ».

Il était référencé depuis l index du Data Lab v1
(`app/(app)/data-lab.tsx:305`, `:702`, `:764`). Plus rien ne l ouvre depuis la
bascule.

### 7. `app/(app)/share/[token].tsx` — la progression partagée (194 lignes)

Écran de consultation d un lien de partage. Il appelle la RPC sécurisée
`get_shared_progression` (`app/(app)/share/[token].tsx:53`) et n affiche que les
métriques présentes dans la liste blanche du lien. Token inconnu, révoqué ou
expiré : « Partage terminé. »

Trois faits à connaître sur cet écran.

D abord, il ne montre **que les libellés** des métriques partagées, jamais leurs
valeurs (`app/(app)/share/[token].tsx:117-124`). La base porte pourtant une
seconde fonction, `get_shared_progression_values`, qui renverrait un champ
`metric_values` — je l ai vue en production, et aucune ligne de code ne
l appelle (migration `supabase/migrations/20260622235835_shared_progression_values_rpc.sql`).

Ensuite, le lien distribué n est pas cette route. `src/services/sharesService.ts`
construit `https://oxvehicle.fr/share/{token}` (`SHARE_BASE_URL` ligne 58,
`shareUrlFor` lignes 60-61). Or `app.json` ne déclare **ni**
`associatedDomains` iOS **ni** `intentFilters` Android : un lien
`oxvehicle.fr/share/...` ouvre le navigateur, pas l application. Seul le schéma
personnalisé `oxv://` (`app.json` : `"scheme": "oxv"`) atteindrait cet écran, et
rien dans le dépôt ne génère une telle adresse.

Enfin, l usage réel : la table `app_progression_shares` contient **une seule
ligne** en production, créée le 07/07/2026, expirée le 14/07/2026, avec une
seule métrique (`regularity`) et `view_count = 0`. Cet écran n a, à ma
connaissance de la base, jamais servi.

### Deux écrans de plus, sans équivalent, mais gardés par `__DEV__`

Ils ne comptent pas dans les sept parce qu ils ne s affichent pas en
production, mais ils n ont pas non plus de pendant V2 :

- `app/(app)/debug-capture.tsx` (656 lignes) — capture d octets UBX bruts depuis
  un RaceBox, détection de tours en direct, simulation d un bouton Flic 2.
  Garde : `app/(app)/debug-capture.tsx:54`.
- `app/(app)/debug-circuit.tsx` (81 lignes) — prévisualisation du tracé 3D.
  Garde : `app/(app)/debug-circuit.tsx:24`.

Deux remarques. Leur repli hors développement renvoie vers `'/(app)'`, donc vers
l **ancien** arbre — ces deux lignes n ont pas été mises à jour au lot L6. Et
leur seul point d entrée était `app/(app)/index.tsx:196`, l accueil v1 : depuis
la bascule, un développeur qui veut capturer une fixture UBX n a plus de chemin
depuis l accueil réel. `app/(app2)/dev-galerie.tsx` est une galerie de
composants, pas un outil de capture.

## Les capacités perdues à l intérieur d écrans par ailleurs couverts

Ce sont des fonctions qui existaient dans un écran v1, dont l écran V2
équivalent existe bien, mais qui n ont pas été portées. Le message du lot L6 en
signale quatre. J en ai trouvé cinq autres. Je sépare clairement les deux
listes.

### Les quatre consignées au lot L6

**a. S inscrire à un événement ouvert.** `app/(app)/pass-oxv.tsx` importe
`listOpenEvents` et `registerForEvent` (`app/(app)/pass-oxv.tsx:26-28`), filtre
les événements auxquels le pilote n est pas déjà inscrit (`:75-76`) et affiche
un bouton « S inscrire » (`:147`). L écran V2 `app/(app2)/club/pass.tsx:33`
n importe que `listMyRegistrations` : il montre les passes, il ne permet plus
d en prendre un.

Nuance de production : la table `events` contient **un seul événement**, de
statut `private`. Or `listOpenEvents` filtre sur `status = 'public'`
(`src/services/eventsService.ts:361`). La section « événements ouverts » de
l écran v1 est donc **vide aujourd hui**, y compris avant la bascule. La
capacité est perdue dans le code ; elle ne l est pas encore dans les faits.

**b. Certifier et supprimer une belle route.** L écran V2
`app/(app2)/club/territoire.tsx` appelle bien `listMyRoutes` et
`listCertifiedRoutes` (`:145-146`) — il liste donc vos routes. Mais il n appelle
ni `requestCertification` ni `deleteRoute`, et n affiche que le binaire
« certifiée / pas certifiée » (`:545`, `:566-570`). Sont donc perdus, en plus
des deux actions : la lecture des statuts intermédiaires (`Brouillon`,
`En revue OXV`, `Non retenue`) et la note de refus de l administrateur.

Nuance : `scenic_routes` contient **une ligne** en production, nommée
« Belle route · 50 km », de statut `draft`, sans distance renseignée. Elle
n apparaîtrait donc pas dans la carte V2, qui ne place que les routes certifiées.

**c. Le catalogue d offres par catégorie.** `app/(app)/catalogue.tsx`
(867 lignes) aplatit toutes les offres publiées de tous les partenaires validés
et les **regroupe par catégorie d offre** (`offer.category`), avec un filtre de
catégorie (`app/(app)/catalogue.tsx:172-202`). L écran V2
`app/(app2)/club/partenaires.tsx` liste des **partenaires**, et la puce de
catégorie qu il affiche est le `type` du partenaire, pas la catégorie de
l offre (`src/features/club/partenairesLogic.ts:30-32`, `:81`).

**d. L écart-type de séance.** La V2 mesure la régularité comme la part des
tours à moins d une seconde du tour de référence, plus un histogramme à cinq
seaux (`src/features/data/seasonLogic.ts:47-92`, notamment `withinOneSecPct`).
C est un fait honnête, mais ce n est pas la même mesure : l écart-type de
population calculé par `src/services/regularityService.ts:51-60` a disparu de
l arbre pilote V2, ainsi que la médiane, l amplitude et la bande descriptive.

### Les cinq que j ai trouvées en plus

**e. Écrire une intention.** Le service `intentionsService` expose
`savePendingIntention` (`src/services/intentionsService.ts:160`) et
`setIntentionShared` (`:211`). Ces deux écritures ne sont appelées que depuis
`app/(app)/prochaine-fois.tsx:142` et depuis
`src/components/IntentionCard.tsx:53` — un composant importé uniquement par
`app/(app)/preparation.tsx` et `app/(app)/prochaine-fois.tsx`.

Le carnet V2 lit les intentions et ne fait que cela : `src/features/vous/useCarnet.ts`
n importe que `getPendingIntention` et `getIntentionForSession` (`:31-34`), et
n expose que `addNote` et `toggleNoteShared` (`:245`). Le composant
`IntentionCard` de `app/(app2)/vous/carnet.tsx:447` est un composant **local**
de rendu, homonyme, sans écriture.

Conséquence : dans l arbre V2, le pilote peut lire ses intentions passées mais
**ne peut plus en écrire une nouvelle**. C est la fonctionnalité décidée en V9
(« Intention → table `session_intentions` »). La table contient 0 ligne en
production.

**f. Créer un objectif et l auto-évaluer.** Même schéma.
`src/services/pilotGoalsService.ts` expose `createGoal` (`:84`),
`updateGoalStatus` (`:112`) et `deleteGoal` (`:138`). Aucune de ces trois
fonctions n est appelée hors de `app/(app)/objectifs.tsx:61` et `:68`. Le carnet
V2 n importe que `listMyGoals` (`src/features/vous/useCarnet.ts:35`) et son
panneau Objectifs est une simple `FlashList` sans composeur
(`app/(app2)/vous/carnet.tsx:488-512`).

L auto-évaluation « atteint / à continuer / lâcher » (les statuts
`achieved / continued / abandoned` de `src/services/pilotGoalsService.ts:11`)
n existe donc plus nulle part dans l arbre pilote V2. La table `pilot_goals`
contient 0 ligne en production.

**g. Le virage désigné « à surveiller ».** C est le mécanisme du principe 1 —
une seule zone à explorer par séance. Il est porté par
`src/services/focusCorner.ts:41` (`selectFocusCorner` : le virage à plus faible
marge, rouge d abord, sinon jaune, sinon rien). Cette fonction n est appelée que
depuis `app/(app)/carte.tsx:113`, qui en tire la carte « Le virage à
surveiller ».

La V2 affiche bien la marge **par virage** dans sa section VIRAGE, avec les
étiquettes doctrinales « Confortable / À explorer / Terrain serré »
(`app/(app2)/data/session/[id].tsx:1036-1046`). Ce qu elle ne fait plus, c est
**désigner un virage** parmi les autres.

De la même famille : la colonne `app_session_analyses.next_focus_phrase` n est
rendue que par `src/components/DebriefMirror.tsx:518` — composant qui n est
importé par aucun écran (`app/(app)/debrief-presentiel.tsx:19` ne fait que le
citer en commentaire). Ce code est donc déjà mort avant la bascule.

Nuance de production, décisive ici : `app_segment_analyses` contient **0 ligne**,
et aucune des 13 lignes de `app_session_analyses` ne porte de
`next_focus_corner_index`. Ni l écran v1 ni l écran V2 n auraient quoi que ce
soit à montrer aujourd hui.

**h. La vitrine du partenaire et le contact par offre.**
`app/(app)/partenaire/[id].tsx` (971 lignes) rend le logo en grand, la
description, puis les **images réelles des offres publiées** (`image_url`) en
grille, et enfin les offres avec leur description. `app/(app)/catalogue.tsx`
attache le contact à l offre précise touchée (`offerId: item.offer.id`,
`app/(app)/catalogue.tsx:281-283`).

La fiche V2 (`app/(app2)/club/partenaires.tsx:195-280`) montre le logo, la
description du partenaire, et les offres en lignes de texte « titre · prix ».
Pas d image d offre, pas de description d offre. Et la mise en relation est
toujours rattachée à la **première** offre du partenaire :
`src/features/club/useClubPartenaires.ts:80` passe
`offerId: primaryOfferId(partner)`, défini comme `partner.offers[0]?.id ?? null`
(`src/features/club/partenairesLogic.ts:102-104`).

Nuance de production : `partner_offers` contient **une offre**, de statut
`draft`, donc non publiée. `partner_leads` contient 0 ligne. Ni le catalogue v1
ni l écran V2 n affichent quoi que ce soit aujourd hui.

**i. Le paramétrage du lien de partage.** C est le point le plus sensible des
cinq, parce qu il touche au RGPD.

L écran v1 `app/(app)/partage.tsx:89-92` crée un lien avec trois arguments : le
périmètre, une **durée** (`expiresInDays`) et une **liste blanche de métriques**
(`includedMetrics`, cochées par le pilote).

L écran V2 `app/(app2)/club/galerie.tsx:148` appelle `createShare({ scope })` —
et rien d autre. Or le service applique deux valeurs par défaut :

- `src/services/sharesService.ts:110` — `included_metrics: sanitizeIncludedMetrics(opts.includedMetrics ?? [])`,
  soit **une liste vide**.
- `src/services/sharesService.ts:99-101` — `expiresAt` vaut `null` sans
  `expiresInDays`, soit **aucune expiration**.

Un lien créé depuis la V2 est donc, si je lis correctement : vide de contenu
(l écran de consultation afficherait « Aucune métrique n a été incluse dans ce
partage », `app/(app)/share/[token].tsx:112-115`) et **perpétuel**. Je n ai pas
pu l exécuter ; c est une lecture des deux appels et des valeurs par défaut du
service. La seule ligne existante en base porte bien une métrique et une
expiration, mais elle date du 07/07, donc d avant l écran V2.

**Un mot sur `conditions`, pour ne pas surcompter.**
`app/(app)/conditions.tsx` juxtaposait les faits météo d une séance et le
ressenti écrit du pilote, côte à côte, sans tracer le lien. La V2 fait les deux
choses, mais séparément : la météo de la séance vit dans
`app/(app2)/data/session/[id].tsx:1676-1695` (avec, en plus, une corrélation
tour de référence / conditions), et les notes datées avec leur météo du jour
vivent dans `app/(app2)/vous/carnet.tsx`. C est la mise en regard elle-même qui
n existe plus. Je le signale comme une perte de mise en scène, pas de donnée.

## La carte de correspondance, écran par écran

Lecture de la table : « couvert » signifie qu un écran V2 rend la même fonction
sur les mêmes services. Les réserves sont dans la colonne de droite.

### Miroir et lecture de soi

| Écran v1 | Équivalent V2 | Réserve |
| --- | --- | --- |
| `index.tsx` (Paddock) | `app/(app2)/index.tsx` | couvert |
| `bilan.tsx` | `app/(app2)/bilan/[sessionId].tsx` | couvert |
| `signature.tsx` | `app/(app2)/signature.tsx` | couvert |
| `trace.tsx` | `app/(app2)/index.tsx` (le fait narratif) | la phrase est sur l accueil (`src/features/miroir/useMiroirHome.ts:45`, `:376-380`), pas dans le bilan — or c est le bilan qu ouvre le bouton « Découvrir ma trace du jour » (`src/services/paddockHeroLogic.ts:75-77`) |
| `debrief.tsx` | section DEBRIEF J+1 du bilan V2 (`app/(app2)/bilan/[sessionId].tsx:389`) | couvert |
| `debrief-presentiel.tsx` | section fil coach du bilan V2 (`:418-441`) | couvert |
| `bilan-pret.tsx` | `app/(app2)/rec/fin.tsx` | fusion des 3 écrans, dite en tête du fichier (`:4-6`) |
| `pilotage-fini.tsx` | `app/(app2)/rec/fin.tsx` | idem |
| `preservation.tsx` | `app/(app2)/rec/fin.tsx` | idem |
| `progression.tsx` | `app/(app2)/data/saison.tsx` | l écart-type devient un pourcentage |
| `regularite.tsx` | **aucun** | orphelin |
| `stats.tsx` | section « VOS FAITS » de `data/saison.tsx` | couvert |
| `comparateur.tsx` | `app/(app2)/data/comparer.tsx` | couvert |
| `empreinte-saison.tsx` | bloc Empreinte de `app/(app2)/signature.tsx` | couvert |
| `passeport.tsx` | héros de `app/(app2)/vous/index.tsx` + section Circuits de `data/saison.tsx` | couvert |
| `carte-licence.tsx` | `app/(app2)/vous/documents.tsx` | couvert, la source est citée dans l en-tête V2 |
| `cartes.tsx` | `app/(app2)/data/index.tsx` | couvert, avec le mode comparaison |
| `pass-oxv.tsx` | `app/(app2)/club/pass.tsx` | inscription perdue (voir a.) |
| `paddock.tsx` | `app/(app2)/rec/arrivee.tsx` | couvert |
| `session/index.tsx` | `app/(app2)/rec/index.tsx` | couvert |
| `preparation.tsx` | `app/(app2)/rec/preparation.tsx` | couvert ; le composeur d intention n est pas porté (voir e.) |
| `equipement.tsx` | `app/(app2)/rec/equipement.tsx` | couvert |
| `placement.tsx` | `app/(app2)/rec/placement.tsx` | couvert |
| `roulage.tsx` | `app/(app2)/rec/roulage.tsx` | couvert |
| `entre-runs.tsx` | `app/(app2)/rec/entre-runs.tsx` | couvert |

### Data Lab

| Écran v1 | Équivalent V2 | Réserve |
| --- | --- | --- |
| `data-lab.tsx` | `app/(app2)/data/index.tsx` + `data/session/[id].tsx` | l index de navigation devient un scroll unique |
| `data-lab-canvas.tsx` | **aucun** | orphelin |
| `carte.tsx` | section TRACÉ & VIRAGES (`app/(app2)/data/session/[id].tsx:501`) | le virage désigné et le sélecteur de couches ne sont pas portés |
| `virage.tsx` | section VIRAGE (`:1005`) | pas d ancre : l écran V2 n accepte que l identifiant de séance |
| `virage-comparer.tsx` | mode « Tours » de `data/comparer.tsx` | couvert |
| `tours.tsx` | section TOURS (`:489`) | couvert |
| `heatmap.tsx` | onglet Heatmap de la section TÉLÉMÉTRIE (`:1149`, `:1430`) | couvert |
| `replay.tsx` | onglet Replay (`:1150`, `:1498`) | couvert |
| `telemetry.tsx` | onglets G-G et Canaux (`:1101`) | couvert |
| `insights.tsx` | section CONSTATS (`:519`) | montée sous bandeau DÉMO, l en-tête V2 le dit (`:401-403`) |
| `insight/[reading].tsx` | idem | idem |
| `conditions.tsx` | section CONDITIONS (`:535`) | la juxtaposition faits / ressenti n est pas reprise |

### Carnet

| Écran v1 | Équivalent V2 | Réserve |
| --- | --- | --- |
| `carnet.tsx` | `app/(app2)/vous/carnet.tsx` onglet Notes | couvert, écriture comprise |
| `prochaine-fois.tsx` | onglet Intentions | lecture seule (voir e.) |
| `objectifs.tsx` | onglet Objectifs | lecture seule (voir f.) |
| `programme.tsx` | onglet Programme | couvert, lecture seule des deux côtés |

### Découverte et Club

| Écran v1 | Équivalent V2 | Réserve |
| --- | --- | --- |
| `club/index.tsx` | `app/(app2)/club/index.tsx` | couvert |
| `coachs.tsx` | onglet Trouver de `club/coaching.tsx` | couvert |
| `coach/[id].tsx` | feuille fiche de `club/coaching.tsx` | couvert |
| `mon-coach.tsx` | onglet Mon coach | couvert |
| `mes-demandes.tsx` | onglet Demandes | couvert |
| `amis.tsx` | onglet Amis de `club/roulages.tsx` | couvert |
| `cote-a-cote/[friendId].tsx` | mode Ami de `data/comparer.tsx` | couvert |
| `roulages.tsx` | onglet Roulages | couvert |
| `partenaires.tsx` | `club/partenaires.tsx` | couvert |
| `partenaire/[id].tsx` | feuille fiche | vitrine photo perdue (voir h.) |
| `catalogue.tsx` | `club/partenaires.tsx` | groupement par catégorie perdu (voir c.) |
| `carte-oxv.tsx` | onglet Carte de `club/territoire.tsx` | couvert |
| `belle-route.tsx` | onglet Routes | couvert |
| `creer-route.tsx` | **aucun** | orphelin, appelé depuis la V2 |
| `creer-trace.tsx` | **aucun** | orphelin, appelé depuis la V2 |
| `mes-routes.tsx` | partiel dans l onglet Routes | actions d écriture perdues (voir b.) |
| `galerie.tsx` | `club/galerie.tsx` | couvert |
| `session-media/[sessionId].tsx` | section SOUVENIRS du bilan V2 (`:481`) | couvert |
| `partage.tsx` | onglet Partages de `club/galerie.tsx` | paramétrage perdu (voir i.) |
| `carte-trophee.tsx` | **aucun** | orphelin, appelé depuis la V2 |
| `circuits.tsx` | section CIRCUITS de `data/saison.tsx` | couvert |
| `circuit/[id].tsx` | feuille écosystème de `data/saison.tsx` | couvert |

### Compte

| Écran v1 | Équivalent V2 | Réserve |
| --- | --- | --- |
| `compte/index.tsx` | `app/(app2)/vous/index.tsx` | couvert |
| `profil.tsx` | `app/(app2)/vous/profil.tsx` (consultation) | couvert |
| `profil-edition.tsx` | même écran, mode édition | couvert |
| `settings.tsx` | `app/(app2)/vous/reglages.tsx` | couvert |
| `notifications.tsx` | groupe 1 de `reglages.tsx` | couvert |
| `consentements.tsx` | groupe 2 de `reglages.tsx` | couvert |
| `donnees-securite.tsx` | groupe 3 de `reglages.tsx` | couvert |
| `garage.tsx` | `app/(app2)/vous/garage.tsx` | couvert |
| `garage/[vehicleId].tsx` | feuille véhicule | couvert |
| `mon-equipement.tsx` | `app/(app2)/vous/equipement.tsx` | couvert |
| `support/index.tsx` | `app/(app2)/vous/support.tsx` | couvert |
| `support/[id].tsx` | feuille fil du ticket | couvert |
| `legal/[doc].tsx` | `app/(app2)/vous/document/[doc].tsx` | couvert |
| `decharge.tsx` | `app/(app2)/vous/decharge.tsx` | couvert, même drapeau `pilot_waivers` |
| `share/[token].tsx` | **aucun** | orphelin |
| `debug-capture.tsx` | **aucun** | garde `__DEV__` |
| `debug-circuit.tsx` | **aucun** | garde `__DEV__` |

## Les chemins produits par les deux arbres

### Trois collisions dans le périmètre pilote

Expo Router ne fait pas apparaître le nom d un groupe dans l adresse. Les
dossiers `(app)` et `(app2)` produisent donc trois adresses identiques :

| Adresse | Fichier v1 | Fichier V2 |
| --- | --- | --- |
| `/` | `app/(app)/index.tsx` | `app/(app2)/index.tsx` |
| `/club` | `app/(app)/club/index.tsx` | `app/(app2)/club/index.tsx` |
| `/signature` | `app/(app)/signature.tsx` | `app/(app2)/signature.tsx` |

L adresse `/` est en réalité produite par **neuf** sources : les huit groupes
qui ont un `index.tsx` — `(admin)`, `(app)`, `(app2)`, `(coach)`,
`(coach-onboarding)`, `(onboarding)`, `(partner)`, `(pro)` — plus le fichier
racine `app/index.tsx`. Dans les faits ce dernier est le routeur de rôle, et les
gardes de chaque groupe redirigent les rôles qui ne leur appartiennent pas. Mais
la table de routage, elle, porte bien neuf entrées pour la même adresse.

Hors périmètre pilote, douze autres adresses sont produites par deux ou trois
groupes : `/coachs`, `/debrief`, `/facturation`, `/pacte`, `/partage`,
`/partenaires`, `/performance`, `/preparation`, `/profil`, `/roulages`,
`/support`, `/support/[id]`. Elles n opposent jamais `(app)` à `(app2)`.

**Lequel gagne, je ne le sais pas.** Cela dépend de l ordre de construction de
la table de routage par `expo-router` 3.5.23, et il faudrait lancer
l application pour l observer. C est le premier point à tester sur appareil.

### Une seule navigation sans groupe dans tout le dépôt

J ai passé en revue tous les appels `router.push`, `router.navigate`,
`router.replace`, tous les `pathname:` et tous les `href` du dépôt. Un seul
navigue vers une adresse en collision **sans préciser le groupe** :

- `app/(app2)/data/saison.tsx:522` — `router.push('/signature' as never)`

C est le lien de pied de page « Votre signature · La forme de votre saison, d un
seul tenant » (`app/(app2)/data/saison.tsx:519-533`). Toutes les autres
navigations vers la Signature sont qualifiées : `app/(app2)/index.tsx:581`
utilise `'/(app2)/signature'`, `app/(pro)/index.tsx:33` utilise
`'/(app)/signature'`.

Si la résolution favorise le groupe v1, ce lien fait sortir le pilote de l arbre
V2, en plein cœur de son écran de saison, sans le lui dire. Il faut le
qualifier, quelle que soit la résolution observée — c est une correction d une
ligne.

Les trois autres navigations sans groupe visent `/` et sont légitimes :
`app/(onboarding)/pacte.tsx:45`, `app/(coach-onboarding)/pacte.tsx:57` et
`app/+not-found.tsx:27` retournent au routeur de rôle.

### Le typage des routes ne protège de rien

`app.json` active `experiments.typedRoutes: true`. Mais le fichier généré
`.expo/types/router.d.ts` de cette copie de travail date du 22 juin 2026 : il
liste encore `/(app)/lieux`, `/(app)/social` et `/(app)/social-carte`, routes
supprimées depuis, et **ne connaît ni `(app2)`, ni `(pro)`, ni `(partner)`**. Ce
fichier est ignoré par Git (`.gitignore:38`), donc régénéré localement — mais il
ne l a pas été depuis un mois ici.

C est la raison pour laquelle le dépôt compte **207 casts `as never`** sur des
routes dans `app/`. Le compilateur ne voit donc pas les adresses de navigation.
Il ne peut pas signaler un lien qui atterrirait dans le mauvais arbre.

### Un effet de bord de la bascule : l accueil v1 renvoie vers la V2

`src/services/paddockHeroLogic.ts` est partagé par les deux accueils
(`app/(app)/index.tsx:32` et `app/(app2)/index.tsx:48`). Ses six destinations
ont été réécrites au lot L6 pour viser `/(app2)/...`
(`src/services/paddockHeroLogic.ts:42-103`).

Conséquence : si le pilote se retrouve dans l accueil v1 — par la barre
d onglets v1, par une collision, ou par l espace pro — son bouton principal le
ramène dans l arbre V2. Les deux arbres se renvoient donc mutuellement des
pilotes, dans les deux sens. Je n ai pas pu observer l enchaînement.

## Ce que l ancien arbre coûte aujourd hui

Un chiffrage sec, sans interprétation.

- **38 274 lignes** de code d écran embarquées dans le binaire, jamais ouvertes
  par le parcours nominal.
- **41 modules** de `src/` ne sont importés que par `app/(app)/` et par personne
  d autre. Parmi eux, quatre services entiers de fonctionnalité :
  `@/services/routing/scenicRouteService`, `@/services/routing/scenicPoiService`,
  `@/services/dataLabService`, `@/services/mediaExportsService` ; deux services
  d analyse : `@/services/cornerDeepDiveService`, `@/services/focusCorner` ; le
  module de circuit `@/circuit/CircuitTrace`, `@/circuit/CircuitTraceHero`,
  `@/circuit/hauteSaintonge` ; l ancien kit `@/ui/Chip`, `@/ui/Cockpit`,
  `@/ui/QdiBars` ; et le service Flic 2 `@/ble/flic2Service`.
- **Du code déjà mort avant la bascule** : `src/components/DebriefMirror.tsx`
  n est importé par aucun écran.
- **Deux langages graphiques** maintenus en parallèle : `src/ui/` (20 fichiers,
  ancien kit) et `src/ui/v2/` (26 fichiers plus quatre sous-dossiers `icons`,
  `media`, `motion`, `__tests__` — kit Instrument). Les deux sont compilés,
  lintés et typés à chaque passe.
- **Un fichier en CRLF** qui pollue la sortie Prettier : `app/(app)/profil.tsx`.

## Ce qu il faudrait pour pouvoir le supprimer

Six chantiers, dans cet ordre. Aucun n est purement technique : les deux
premiers demandent un arbitrage de votre part.

### 1. Trancher le sort des sept orphelins

Pour chacun : porter, ou abandonner. Ce sont des décisions produit.

- `carte-trophee` — la carte-souvenir d une séance. Le composant existe déjà
  côté V2 ; il ne manque qu un écran ou une feuille dans le bilan.
- `creer-route` — le planificateur GraphHopper. C est le plus gros morceau
  (818 lignes plus trois services). Vous l aviez explicitement demandé au
  retour du build 23.
- `creer-trace` — l import OpenStreetMap.
- `mes-routes` — la gestion de vos routes, y compris demander la certification
  et supprimer.
- `regularite` — l écart-type. À arbitrer contre la mesure V2 (« part des tours
  à moins d une seconde »). Les deux sont honnêtes ; ce n est pas la même
  question posée au pilote.
- `data-lab-canvas` — aperçu technique jamais validé au build. Candidat évident
  à l abandon.
- `share/[token]` — la progression partagée. À trancher en même temps que le
  point i. ci-dessus : aujourd hui la V2 crée des liens vides et perpétuels que
  seul cet écran orphelin saurait lire.

### 2. Trancher le sort des neuf capacités perdues

Quatre consignées au lot L6, cinq trouvées ici. Deux d entre elles me semblent
devoir passer avant la suppression, parce qu elles portent une écriture du
pilote : **écrire une intention** (point e.) et **créer un objectif** (point f.).
Ce sont deux fonctions de l espace intime, et elles sont aujourd hui muettes
dans l arbre où atterrit le pilote.

Une troisième relève du juridique plus que du produit : le **paramétrage du lien
de partage** (point i.), qui produit aujourd hui des liens sans expiration.

### 3. Recâbler les liens entrants

Douze au total, tous identifiés plus haut :

- 3 depuis l arbre V2 : `app/(app2)/bilan/[sessionId].tsx:577`,
  `app/(app2)/club/territoire.tsx:622` et `:629`.
- 2 depuis l espace coach : `app/(coach)/pilote/[id].tsx:759` et `:797` — à
  faire pointer vers `/(app2)/bilan/[sessionId]` et `/(app2)/data/session/[id]`.
- 6 depuis l espace pro : `app/(pro)/index.tsx:30-34` et `:122`,
  `app/(pro)/performance.tsx:34` et `:39`, `app/(pro)/bibliotheque.tsx:177`.
- 1 partagé : `src/ui/AccountButton.tsx:17`, qui alimente cinq écrans pro.

Plus deux replis de développement à corriger :
`app/(app)/debug-capture.tsx:54` et `app/(app)/debug-circuit.tsx:24`, qui
renvoient encore vers `'/(app)'`.

### 4. Remplacer `appMap`

`src/lib/appMap.ts` est la carte des routes v1, et la V2 en dépend pour le
silence en piste (`app/(app2)/_layout.tsx:26`, `:78`). Il faut donc, avant toute
suppression, déplacer la logique `shouldShowTabBar` vers un module V2 — la place
naturelle est `src/ui/v2/centralButtonLogic.ts`, qui porte déjà
`isV2CaptureFlowPath`.

Le test `src/lib/__tests__/appMap.test.ts` lit physiquement le dossier `app/(app)`
(lignes 14-26) : il devra être réécrit sur `app/(app2)` ou supprimé avec le
module.

À vérifier au passage : `src/components/AppTabBar.tsx` n est plus utilisé que par
`app/(app)/_layout.tsx` et `app/(app)/data-lab.tsx`, et disparaîtrait avec eux.

### 5. Nettoyer les 41 modules devenus orphelins

Ils ne cassent rien s ils restent, mais ils continueront d être compilés, lintés
et typés. Attention à trois faux amis dans la liste, qui ne sont pas réellement
morts parce qu ils sont importés en chemin relatif à l intérieur de `src/` :
`marginCalculator` est appelé par `src/services/analyzeSessionService.ts:40`
(le calcul de marge du pipeline de capture, que `app/(app2)/rec/fin.tsx`
rebranche tel quel), et `intentionsService` est appelé par
`src/services/captureSessionService.ts:56` et
`src/services/traceNarrativeService.ts:17`.

### 6. Vérifier sur appareil avant de toucher à quoi que ce soit

Deux observations à faire, dans cet ordre, sur un build de prévisualisation iOS.

**a.** Quelle route gagne pour `/`, `/club` et `/signature`. C est la seule façon
de savoir si un pilote peut aujourd hui basculer sans le vouloir dans l ancienne
application. Le test le plus direct : depuis l écran Saison, toucher « Votre
signature » (`app/(app2)/data/saison.tsx:522`) et regarder quel écran s ouvre —
le radar V2 grand format, ou l ancien écran Signature.

**b.** Si le lien vers la carte trophée (`app/(app2)/bilan/[sessionId].tsx:577`)
fait bien apparaître la barre d onglets de l ancienne application. Si oui, tout
l ancien arbre est à un tap de votre bilan, et cela devient le premier problème
à traiter — avant même les orphelins.

Tant que ces deux points ne sont pas observés, la suppression est prématurée : on
ne sait pas encore ce que l ancien arbre fait réellement sous le doigt d un
pilote.

---

## L'espace coach

### Avertissement de méthode

Rien n'a été exécuté sur un appareil. Aucun écran coach n'a été ouvert, aucune
manipulation n'a été faite. Tout ce qui suit est une lecture du code source du
dépôt et une interrogation en lecture seule de la base de production
`fouvuqkdxarjpjbqnsjq`. Quand j'écris qu'un écran « affiche » quelque chose, je
décris ce que le code demande d'afficher, pas ce que j'ai vu.

Une exception : la suite de tests unitaires a été lancée. Résultat plus bas.

---

### Le fait qui commande tout le reste : il n'existe aucun compte coach

Requête sur la table `users` de production, ce jour :

| rôle | nombre de comptes |
| --- | --- |
| `pilot` | 11 |
| `admin` | 2 |
| `partner` | 1 |
| **`coach`** | **0** |

Le rôle `coach` existe bien dans le type énuméré `user_role` de la base
(`pilot, admin, coach, partner, pro_pilot`). Aucun compte ne le porte.

Or l'espace coach est verrouillé sur ce rôle, à deux endroits :

- `C:\Users\Julie\OneDrive\Desktop\oxv-app\app\index.tsx` ligne 93 : après
  connexion, seul un profil `role === 'coach'` est redirigé vers `/(coach)`.
- `C:\Users\Julie\OneDrive\Desktop\oxv-app\app\(coach)\_layout.tsx` lignes 33-35 :
  `if (profile.role !== 'coach') return <Redirect href="/(app2)" />`. Toute
  personne qui atteindrait une route `(coach)` par un autre chemin en est
  éjectée immédiatement.

**Conséquence : aujourd'hui, en production, aucun être humain ne peut ouvrir un
seul des 37 écrans coach.** Ce n'est pas une opinion, c'est une conséquence
mécanique de la table `users` et du garde de `_layout.tsx`.

Tout le reste de cette section doit se lire ainsi : je décris un espace complet,
volumineux, souvent bien construit — et actuellement injoignable.

#### Ce n'a pas toujours été le cas

La table `admin_audit` conserve la trace des changements de rôle (déclencheur
`trg_audit_user_role_change` sur `users`). Trois lignes existent :

| date | changement |
| --- | --- |
| 2026-07-07 | `admin` → `partner` |
| 2026-07-18 | **`coach` → `admin`** |
| 2026-07-20 | `admin` → `pilot` |

Un compte a donc bien porté le rôle `coach` jusqu'au 18 juillet 2026. Il s'agit
du compte de pseudo public `gabin` (`6edd7f5c-…`), aujourd'hui `role = 'pilot'`
et `is_admin = true`. C'est ce compte qui a produit toutes les données coach
présentes en base (fiche publique, créneaux, message, demandes).

#### Volumétrie du code concerné

- 37 fichiers d'écrans sous `app/(coach)/`, **26 528 lignes**.
- 33 services `src/services/coach*.ts` + `pilotCoachBillingService.ts`,
  **4 951 lignes**.
- Soit environ 31 500 lignes de code pour un espace que personne n'atteint.

---

### Comment on devient coach

#### Le chemin prévu

1. Une candidature arrive par la table `demandes_inscription`, dont le type
   énuméré `oxv_demande_type` accepte la valeur `coach`
   (`pilote, pilote_pro, coach, partenaire`). **En production, cette table ne
   contient que des demandes de type `pilote` : 3 acceptées, 1 en attente.
   Zéro demande de type `coach`.**
2. Un administrateur promeut le compte :
   `C:\Users\Julie\OneDrive\Desktop\oxv-app\src\services\coachAdminService.ts`
   ligne 249, `promoteToCoach()` — un simple `update users set role = 'coach'`.
   Appelé depuis `app/(admin)/preparation.tsx` ligne 18.
3. La base autorise cette écriture par le déclencheur
   `guard_users_privileged_columns` : toute modification de `role` est refusée
   sauf pour `service_role`/`postgres` ou pour un `is_admin()`.
4. Un second déclencheur, `ensure_coach_permissions` (sur `INSERT` et `UPDATE`
   de `users`), crée automatiquement la ligne `coach_permissions` avec
   `can_view_pilots = true` dès que le rôle passe à `coach`.
5. Un courriel d'invitation peut être envoyé via la fonction Edge
   `send-coach-invitation` (statut `ACTIVE` en production), appelée par
   `coachAdminService.sendCoachInvitation()` ligne 220.
6. À la première connexion, un coach dont l'onboarding n'est pas complet est
   envoyé vers `/(coach-onboarding)` (`app/index.tsx` lignes 80-82). Ce groupe
   existe : `app/(coach-onboarding)/` contient `_layout.tsx`, `index.tsx`,
   `mission.tsx`, `pacte.tsx` — un pacte de coaching distinct du pacte pilote.

#### Le chemin inverse

`demoteToPilot()` (`coachAdminService.ts` ligne 269) repasse le compte en
`pilot`. Le commentaire du fichier affirme que « les assignations coach_pilots
existantes deviennent dormantes ». **C'est inexact, et c'est important** — voir
plus bas la section sur `is_coach_of`.

---

### Le binôme coach-pilote

#### La table

`coach_pilots` porte la relation. Colonnes réelles en production :

| colonne | type | défaut |
| --- | --- | --- |
| `id` | uuid | `gen_random_uuid()` |
| `coach_id` | uuid | — |
| `pilot_id` | uuid | — |
| `active` | boolean | `true` |
| `notes` | text | null |
| `pilot_consent_at` | timestamptz | null |
| `coach_consent_at` | timestamptz | null |
| `initiated_by` | `affiliation_initiator` (`coach`/`pilot`) | `'coach'` |
| `status` | `affiliation_status` (`pending`/`active`/`declined`/`ended`) | `'pending'` |
| `level` | `coach_access_level` | `'lecture_simple'` |
| `live_sharing_at` | timestamptz | null |
| `affiliation_price_eur` | integer | null |
| `created_at`, `created_by` | — | — |

Une contrainte `coach_pilots_check` interdit `coach_id = pilot_id`.

#### Le contenu réel en production

Une seule ligne :

| champ | valeur |
| --- | --- |
| `coach_id` | `6edd7f5c-…` — compte dont le rôle est **`pilot`** aujourd'hui |
| `pilot_id` | `aad205ed-…` — rôle `pilot` |
| `status` | **`pending`** |
| `level` | **`programme`** |
| `initiated_by` | `coach` |
| `active` | `true` |
| `pilot_consent_at` | 2026-06-28 |
| `coach_consent_at` | **null** |
| `live_sharing_at` | **null** |
| `created_at` | 2026-06-22 |

Autrement dit : un seul binôme, dont le « coach » n'est plus coach, resté au
statut `pending`, sans partage live.

#### Qui peut créer un binôme

La base prévoit deux portes (policies `pg_policies` sur `coach_pilots`) :

- `coach_pilots_insert_by_coach` : `coach_id = auth.uid() AND is_coach() AND
  initiated_by = 'coach'`.
- `coach_pilots_insert_by_pilot` : `pilot_id = auth.uid() AND initiated_by = 'pilot'`.
- `coach_pilots_admin_all` : tout pour `is_admin()`.

**Dans le code de l'application, il n'existe qu'un seul `insert` sur
`coach_pilots`** : `coachAdminService.ts` ligne 167, `assignPilotToCoach()`,
réservé à l'administrateur. Recherche exhaustive sur `src/` et `app/` : aucun
autre écrivain. Les deux policies « par le coach » et « par le pilote » ne sont
donc empruntées par aucun écran. Un coach ne peut pas ajouter un pilote depuis
son espace ; un pilote ne peut pas s'affilier à un coach depuis le sien.

`assignPilotToCoach()` n'écrit ni `status` ni `initiated_by` ni
`affiliation_price_eur` : les valeurs par défaut s'appliquent (`pending`,
`coach`). Le commentaire du code (lignes 171-173) est explicite : le
consentement pilote reste à null volontairement.

#### Le consentement du pilote

Côté pilote, tout passe par
`C:\Users\Julie\OneDrive\Desktop\oxv-app\src\services\pilotConsentService.ts` :

- `listMyCoaches()` ligne 75 — lit `coach_pilots` filtré par RLS
  (`coach_pilots_select_own_pilot`).
- `giveConsent(assignmentId, level)` ligne 117 — écrit `pilot_consent_at = now()`
  **et** le niveau choisi, puis appelle la fonction Edge
  `notify-coach-consent-received` (statut `ACTIVE` en production).
- `setConsentLevel()` ligne 164 — change le niveau sans rompre le binôme.
- `setLiveSharing()` ligne 182 — horodate ou efface `live_sharing_at`.
- `revokeConsent()` ligne 202 — remet `pilot_consent_at` à null. Le coach cesse
  immédiatement de voir quoi que ce soit, puisque `is_coach_of` exige cette
  colonne non nulle.

Deux écrans pilote consomment ce service :
`app/(app)/mon-coach.tsx` (arbre v1) et `app/(app2)/club/coaching.tsx` via
`src/features/club/useCoaching.ts` (arbre v2, celui où arrive le pilote
aujourd'hui — `app/index.tsx` ligne 107 redirige vers `/(app2)`).

Il existe aussi un chemin administrateur de secours,
`forcePilotConsent()` (`coachAdminService.ts` ligne 287), documenté comme
réservé au consentement recueilli hors application (papier signé).

#### Deux colonnes que personne n'écrit

Recherche exhaustive dans `src/` et `app/` : **aucune ligne de code n'écrit
jamais `coach_pilots.status = 'active'`, ni `coach_pilots.coach_consent_at`.**
Ces deux champs restent donc à leur valeur initiale (`pending`, `null`) pour
toujours, quel que soit le parcours.

Cela n'a aucune conséquence sur la lecture après séance, parce que la fonction
de sécurité `is_coach_of(pilot_uuid)` ne regarde pas `status` :

```
coach_id = auth.uid() AND pilot_id = … AND active = true
  AND pilot_consent_at IS NOT NULL
```

Cela a en revanche une conséquence **totale sur le direct** — détaillée plus bas.

#### Une faille d'autorisation à connaître

`is_coach_of()` ne vérifie pas non plus que l'appelant a le rôle `coach`. Elle
ne regarde que la table `coach_pilots`. Le garde de rôle vit uniquement dans
l'interface (`app/(coach)/_layout.tsx` ligne 33).

Conséquence factuelle : le compte `6edd7f5c-…`, rétrogradé en `pilot` le
20 juillet, **satisfait toujours `is_coach_of('aad205ed-…')`** et conserve donc,
au niveau de la base, l'accès en lecture aux séances, tours, bilans, notes
partagées et vues associées de ce pilote. Il ne peut plus ouvrir les écrans
coach, mais l'API le laisserait lire. Le commentaire de `demoteToPilot()` qui
annonce des assignations « dormantes » ne décrit pas le comportement réel — il
faudrait `active = false` pour cela, et la fonction ne le fait pas.

Je le signale comme un fait vérifié en base ; je n'ai rien modifié.

---

### Les trois niveaux de consentement

Le type énuméré `coach_access_level` vaut
`lecture_simple`, `lecture_detaillee`, `programme`. Les libellés affichés au
pilote sont dans `src/services/pilotConsentService.ts` lignes 23-39 :

| valeur | libellé pilote | promesse affichée |
| --- | --- | --- |
| `lecture_simple` | « Sessions seulement » | « Votre coach voit vos sessions, vos tours et vos bilans. Pas la donnée brute. » |
| `lecture_detaillee` | « Analyse détaillée » | « En plus : votre donnée brute et l'analyse virage par virage (Data Lab). » |
| `programme` | « Programme » | « En plus : un accompagnement suivi dans la durée. » |

Ces trois promesses sont tenues **par la base**, pas seulement par l'interface.
Trois fonctions `SECURITY DEFINER` en production :

- `is_coach_of(pilot)` — binôme actif + consentement, quel que soit le niveau.
- `is_detailed_coach_of(pilot)` — idem **et** `level IN ('lecture_detaillee','programme')`.
- `is_program_coach_of(pilot)` — idem **et** `level = 'programme'`.

#### Ce que chaque niveau ouvre exactement

Relevé des policies de production qui mentionnent le coach :

**Dès `lecture_simple` (`is_coach_of`)**

| table | policy |
| --- | --- |
| `telemetry_sessions` | `telemetry_sessions_coach_select` |
| `laps` | `laps_coach_select` |
| `app_session_analyses` | `app_session_analyses_coach_select` |
| `session_insights` | `session_insights_coach_select` |
| `app_progression_shares` | `app_progression_shares_coach_select` |
| `vehicles` | `vehicles_coach_select` |
| `session_media` | `session_media_select_coach` |
| `pilot_notes` | `pilot_notes_coach_select` — **et** `shared_with_coach = true` |
| `session_intentions` | `session_intentions_coach_select` — **et** `shared_with_coach = true` |
| `pilot_signature_snapshots` | `pilot_sig_snap_coach_select` — **et** `shared_with_coach = true` |
| `coach_annotations`, `coach_queue`, `coach_session_context`, `coach_pilot_highlight` | écriture par le coach sur ses propres lignes |

**À partir de `lecture_detaillee` (`is_detailed_coach_of`)**

| table | policy | ce que cela ouvre |
| --- | --- | --- |
| `telemetry_frames` | `telemetry_frames_coach_select` | la donnée brute, trame par trame |
| `app_segment_analyses` | `app_segment_analyses_coach_select` | l'analyse virage par virage |
| `coach_ai_drafts` | 4 policies (`select`/`insert`/`update`/`delete`) | l'assistant IA |
| `biometry_raw` | `biometry_coach_read` | la fréquence cardiaque, **et seulement si** `users.biometry_coach_share_consent_at` est renseigné — un second verrou, distinct |

**Uniquement en `programme` (`is_program_coach_of`)**

| table | policy |
| --- | --- |
| `pilot_development_cycles` | `dev_cycles_coach_all` |
| `cycle_steps` | `cycle_steps_coach_all` |

C'est net : les programmes de développement sont réellement réservés au niveau
le plus ouvert, et un retour en arrière du pilote (`setConsentLevel` vers
`lecture_simple`) coupe la donnée brute à la requête suivante, sans casser le
binôme.

#### Le consentement au direct, à part

`live_sharing_at` est une quatrième décision, indépendante du niveau. Le
commentaire de `pilotConsentService.ts` lignes 52-58 est explicite : plus
sensible, désactivé par défaut, révocable, et le relais se coupe immédiatement.

#### Le consentement à l'IA, à part lui aussi

La fonction `coach_ai_consent(pilot)` en base exige **deux** choses :
`is_detailed_coach_of(pilot)` **et** `users.coach_ai_enabled = true`.

En production : **0 compte sur 14 a `coach_ai_enabled = true`.** L'assistant IA
est donc fermé pour tout le monde, indépendamment du problème de rôle.

De même, **0 compte sur 14 a `biometry_coach_share_consent_at` renseigné** : la
lecture cardio côté coach n'a aucune source, alors même que le drapeau
fonctionnel `biometry` a été activé le 2026-07-25.

#### Tests de sécurité : écrits, mais non exécutés ici

Quatre suites couvrent précisément ces règles :
`src/__tests__/rls/coachGradedAccessRLS.test.ts` (lecture_simple voit les
séances mais pas les trames ni les virages ; lecture_detaillee voit en plus),
`coachAiRLS.test.ts`, `coachAnnotationsRLS.test.ts`, `coachSessionsRLS.test.ts`,
plus `developmentCyclesRLS.test.ts` pour le niveau `programme`.

Elles s'auto-désactivent : `src/__tests__/rls/setup.ts` ligne 23 exige
`TEST_SUPABASE_URL` et `TEST_SUPABASE_SERVICE_KEY`. Ces variables ne sont pas
dans le `.env` du dépôt. **Ces règles de consentement ne sont donc jamais
vérifiées en local ;** elles ne le sont que dans le job `rls` de
`.github/workflows/check.yml` (ligne 85), qui ne se déclenche que sur `main`.

---

### La navigation de l'espace

`C:\Users\Julie\OneDrive\Desktop\oxv-app\src\lib\coachNav.ts` définit deux
présentations d'un même arbre, choisies à la largeur d'écran
(`COACH_CONSOLE_MIN_WIDTH`), décision datée du 2026-07-13 dans le fichier :

- **Console tablette** : rail vertical de 198 px à gauche — Poste, File de
  lecture, Studio, Pilotes, Agenda, Business, plus l'avatar
  (`COACH_RAIL_ORDER`, `COACH_RAIL_MAIN_ROUTE`).
- **Compagnon téléphone** : cinq onglets bas — EN DIRECT, PILOTES, MESSAGES,
  AGENDA, MOI (`COACH_TAB_ORDER`, `COACH_TAB_LABEL`).

Le `Stack` est identique dans les deux cas ; la barre ou le rail est un simple
recouvrement (`app/(coach)/_layout.tsx` lignes 48-63). Aucun fichier n'a été
déplacé pour cette refonte : `COACH_ROUTE_TO_ZONE` range les 30 routes
existantes sous les cinq zones.

Un test vérifie la cohérence entre les onglets et les routes réelles :
`src/lib/__tests__/coachNav.test.ts`. Il passe.

Chaque route est atteignable depuis au moins un point de l'interface (relevé
des `router.push` : 30 routes distinctes référencées). Deux entrées viennent
d'ailleurs que du hub : `annoter` est aussi ouvert depuis l'écran pilote
`app/(app)/virage.tsx` ligne 718 et depuis `en-direct/[sessionId].tsx`
ligne 590.

---

### Écran par écran

Pour chaque écran : à quoi il sert, sur quoi il s'appuie, et son état réel. La
mention « injoignable » est sous-entendue partout (aucun compte coach) ; je ne
la répète que quand un second obstacle s'ajoute.

#### Zone Pilotes — le poste et la lecture

**`app/(coach)/index.tsx` — Poste de pilotage (1 238 lignes)**
Le hub. C'est aussi la liste des binômes : cartes pilote issues de
`coach_pilots_view`, état de lecture issu de `coach_queue`, activité récente,
« à faire », et la grille d'outils. Charge en parallèle `listMyPilots()`,
`loadCoachQueue()`, `loadCoachDashboardSummary()` (lignes 190-192).
La grille d'outils est conditionnée (lignes 300-345) : « Comparer deux pilotes »
n'apparaît qu'à partir de 2 pilotes ; « Mes roulages » exige
`can_manage_own_sessions` ; « Tableau de bord » exige
`can_view_business_dashboard` ; « Facturation » exige le drapeau `coach_billing`.
**Données réelles.** Avec un seul binôme en base et 1 séance pour ce pilote, le
poste serait quasi vide.

**`app/(coach)/file-lecture.tsx` — File de lecture (590 lignes)**
Les séances des pilotes consentis avec un statut de lecture explicite et
persistant : à lire / lues / archivées. S'appuie sur `coach_queue` via
`coachQueueService.ts`, qui superpose le statut explicite au statut dérivé
(« annotée ou non ») calculé par `loadReadingQueue()`
(`src/services/coachService.ts` ligne 176).
**Table `coach_queue` : 0 ligne en production.**

**`app/(coach)/studio.tsx` — Studio télémétrique (870 lignes)**
L'atelier de lecture d'une séance, en trois colonnes sur tablette : signature
QDI, trajectoire et marge par virage, triage et liste des tours. Alimenté par
`getStudioSession()` (`src/services/coachStudioService.ts` ligne 53), qui
agrège six sources : triage, QDI, analyse de séance, tours, analyses de segment,
liste des pilotes.
**Point critique : `app_segment_analyses` contient 0 ligne en production.** Le
triage, les marges par virage et les moments-clés dérivés des segments n'ont
donc aucune matière. `telemetry_frames` ne contient que 53 lignes au total, et
`laps` une seule.

**`app/(coach)/triage.tsx` — Triage (376 lignes)**
Les virages où le pilote a le moins de marge sur une séance, classés. Logique
pure `rankTriageCorners` dans `coachTriageLogic.ts`, testée
(`src/services/__tests__/coachTriageLogic.test.ts`, passe). Le service
`coachTriageService.ts` lit `app_segment_analyses`.
**Logique correcte, source vide en production.**

**`app/(coach)/annoter.tsx` — Annoter un virage (1 112 lignes)**
Le cœur du travail écrit du coach : note texte, mémo vocal, brouillon
(`visibility = 'private'`) ou partage au pilote (`visibility = 'shared'`).
Table `coach_annotations`, service `coachAnnotationsService.ts`.

Trois garde-fous réels :
- Côté application, `isDoctrineSafe()` refuse une note partagée prescriptive
  (`coachAnnotationsService.ts` ligne 155).
- Côté base, le déclencheur `coach_annotations_doctrine_guard` (INSERT et
  UPDATE) lève une exception si `is_prescriptive(body)` est vrai. La fonction
  `is_prescriptive` est une expression régulière sur 18 termes : `freinez`,
  `accélérez`, `ouvrez les gaz`, `tracez`, `évitez`, `poussez`, `corrigez`,
  `améliorez`, `optimisez`, `gagnez`, `il faut`, `vous devez`, `vous devriez`,
  `vous pouvez`, `tu dois`, `tu peux`, `je vous conseille`, `je vous recommande`.
- Un troisième déclencheur, `coach_annotations_notify_trigger`, appelle la
  fonction Edge `notify-pilot-coach-annotated` dès qu'une note partagée est
  insérée, et journalise l'envoi dans `admin_audit`.

Cet écran a été corrigé le jour même (commit `93f0638`, 2026-07-26 02:53). Trois
défauts d'écriture y ont été réparés, dont deux faisaient perdre le travail du
coach en silence : la note partait sur le virage 1 quand le paramètre manquait ;
l'enregistrement depuis le direct ne faisait rien sans le dire ; un échec
effaçait le texte en passant pour un succès. Le message de commit consigne aussi
deux défauts non corrigés, que je confirme en base :

- `coach_annotations_corner_index_check` impose `corner_index BETWEEN 1 AND 7`.
  Or `circuits` contient « Circuit Ricardo Tormo » avec `turns_count = 14`.
  **Annoter un virage au-delà du septième à Valence serait refusé par la base.**
  L'écran, lui, accepte tout indice ≥ 1 (`annoter.tsx` lignes 104-108) : l'échec
  arriverait à l'insertion.
- `src/lib/circuitTopology.ts` est une topologie statique du seul circuit de
  Haute Saintonge. Le nom de virage affiché est donc un nom Beltoise quel que
  soit le circuit réel de la séance.

**`app/(coach)/priorites.tsx` — Priorités du bilan (551 lignes)**
Le coach désigne, pour un pilote, les virages à regarder en premier et une note
d'introduction. Table `coach_pilot_highlight`, service `coachCurationService.ts`
(`upsertHighlight`). Le pilote les voit sur son bilan, attribués.
**Table : 0 ligne en production.**

**`app/(coach)/rapport.tsx` — Rapport de séance PDF (666 lignes)**
Le coach rédige son bilan d'une séance et génère un PDF (QDI 5 branches, faits
clés, bilan attribué), partagé par la feuille de partage native.
`coachReportPdfService.ts` s'appuie sur `expo-print` et `expo-sharing`, tous deux
présents dans `package.json` (lignes 70 et 73).
**Le bilan écrit n'est pas stocké** — il ne vit que dans le document produit
(commentaire du fichier, ligne 6). Il n'y a donc aucune trace en base d'un
rapport émis.

**`app/(coach)/reperes.tsx` (899 lignes) et `app/(coach)/repere/[index].tsx` (641 lignes)**
Le coach choisit d'abord un circuit, puis pose par virage un point de freinage
repère et une vitesse d'apex repère. Table `coach_corner_reference`, clé
`(coach_id, circuit_id, corner_index)`. Les repères se superposent chez ses
pilotes consentis, attribués à lui (policy `coach_corner_reference_pilot_select`
= `is_my_coach(coach_id)`).
La liste des virages est réelle et dépend du circuit
(`src/circuit/circuitCorners.ts`) : 7 virages nommés à Haute Saintonge,
14 virages dérivés du tracé à Ricardo Tormo. **Contrairement aux annotations, la
table `coach_corner_reference` ne porte aucune contrainte 1..7** — les repères
supportent bien les 14 virages.
**Table : 0 ligne en production.** L'écriture exige `is_coach()` (policy
`coach_corner_reference_coach_manage`), donc impossible aujourd'hui.

**`app/(coach)/lecture.tsx` — « Ma lecture » (529 lignes)**
Le coach pondère quatre sous-composantes déjà calculées par OXV : véhicule,
pilote, régularité, fluidité. Une ligne par coach dans `coach_reading_weights`.
L'app en dérive « la lecture de votre coach », présentée séparément chez le
pilote, jamais à la place de la marge OXV.
**Table : 0 ligne. Écriture gatée `is_coach()`.**

**`app/(coach)/gabarits.tsx` — Gabarits de commentaire (898 lignes)**
CRUD de modèles de texte réutilisables, table `coach_annotation_template`.
Refonte « plus intuitive » demandée au build 23 : composer en expansion douce,
amorces de structure éditables.
**Table : 0 ligne. Écriture gatée `is_coach()`.**

**`app/(coach)/assistant.tsx` — Assistant IA (1 301 lignes, le plus gros écran)**
L'IA pré-rédige une observation descriptive sur un virage ; le coach relit,
édite, puis valide vers le pilote ou écarte. Table `coach_ai_drafts`, service
`coachAiService.ts`, fonctions Edge `coach-ai-draft` et `coach-ai-validate`
(toutes deux `ACTIVE` en production).

J'ai lu le code de `coach-ai-draft`. Il est sérieux :
- il exige `coach_ai_consent(pilotId)` — donc niveau détaillé **et**
  `users.coach_ai_enabled` ;
- il lit les faits mesurés dans `app_segment_analyses` et refuse en 404
  `segment_not_found` si le virage n'est pas analysé ;
- il impose une consigne système doctrinale (vouvoiement, descriptif, liste des
  verbes interdits) ;
- il **relit sa propre sortie** avec les 18 motifs interdits, relance une fois
  le modèle en cas de faute, et si la seconde tentative échoue encore, refuse en
  422 `doctrine_violation` en journalisant dans `admin_audit`.

Trois obstacles cumulés le rendent inopérant aujourd'hui : 0 compte avec
`coach_ai_enabled`, 0 ligne dans `app_segment_analyses`, et un `cornerIndex`
borné à 1..7 dans la fonction Edge elle-même. Un quatrième point n'a pas pu être
vérifié : la fonction exige la variable d'environnement `OPENAI_API_KEY`
(sinon 500) ; **je n'ai pas accès aux secrets du projet et ne peux pas dire si
elle est renseignée.** Le modèle appelé est `gpt-4o-mini`.

**`app/(coach)/contexte.tsx` — Contexte de séance (332 lignes)**
Le coach renseigne ce que le capteur ne capte pas : niveau du pilote ce jour,
objectif travaillé, matériel, météo vécue. Table `coach_session_context`, une
ligne par coach et par séance. Le pilote le lit sur son bilan
(`coach_session_context_pilot_select`).
La consigne doctrinale est portée par l'écran : cadrage sportif uniquement,
jamais de donnée personnelle, avec un encart « Vie privée » à l'écran.
**Table : 0 ligne.**

**`app/(coach)/plan.tsx` — Plan d'objectifs (673 lignes)**
Le coach pose des objectifs mesurables pour son pilote : métrique + direction +
cible. Table `coach_objectives`, dont les types énumérés sont réels :
`objective_metric` (`regularity, personal_best, corner_braking, corner_speed,
top_speed, qualitative, avg_lap, lap_count, sessions`),
`objective_direction` (`below, above, reach`),
`objective_status` (`active, achieved, archived`).
Deux déclencheurs en base rendent l'objet vivant : `trg_capture_baseline`
capture automatiquement la valeur de départ via `measure_metric_now()`, et
`trg_obj_log_insert`/`trg_obj_log_update` journalisent chaque changement d'état
dans `coach_objective_events`.
Le commentaire du service note honnêtement qu'il n'y a **pas d'échéance**, parce
que le schéma n'en porte pas — rien n'est inventé.
**Tables : 0 ligne (`coach_objectives`, `coach_objective_events`). Écriture
gatée `is_coach()`.**

**`app/(coach)/cycles.tsx` (868 lignes) et `app/(coach)/cycles/[id].tsx` (859 lignes) — Programmes**
Un programme = un cycle qualitatif que le coach écrit pour un pilote. Tables
`pilot_development_cycles` et `cycle_steps`, service
`src/services/developmentCycleService.ts`. Partage au pilote opt-in
(`is_shared`), avec garde-fou doctrinal côté application
(`isDoctrineSafe`) **et** côté base (déclencheurs `dev_cycles_doctrine_guard` et
`cycle_steps_doctrine_guard`).
Réservé au niveau `programme` (`is_program_coach_of`). L'unique binôme en base
est bien au niveau `programme`.
**Tables : 0 ligne chacune.**

**`app/(coach)/comparer.tsx` — Comparer deux séances d'un pilote (550 lignes)**
Deux lectures côte à côte, jamais un gagnant. `loadSessionSnapshot()`
(`coachService.ts` ligne 40) charge trajectoire GPS (jusqu'à 1 000 trames) et
zones de marge par virage.
**Dépend de `telemetry_frames` (53 lignes en tout) et
`app_segment_analyses` (0 ligne) — donc du niveau `lecture_detaillee`.**

**`app/(coach)/comparer-pilotes.tsx` — Comparer deux pilotes (801 lignes)**
Même principe entre deux pilotes distincts. N'apparaît dans les outils du hub
qu'à partir de deux binômes (`index.tsx` ligne 301).
**En production il n'existe qu'un binôme : cet écran ne serait même pas proposé.**

**`app/(coach)/debrief.tsx` — Débrief, mode présentation (518 lignes)**
Une vue calme, en lecture seule, à montrer au pilote au stand : un fait
dominant, le chiffre roi, la trajectoire avec le virage mis en évidence. Aucune
action d'édition. Charge `getStudioSession()`, la trajectoire, et — si le
drapeau `biometry` est actif (ligne 108) — la biométrie de séance.
**Le drapeau `biometry` est actif en production depuis le 2026-07-25**, mais
`biometry_raw` n'est lisible par le coach que si le pilote a coché le partage,
ce que personne n'a fait.

**`app/(coach)/pilote/[id].tsx` — Fiche pilote (1 089 lignes)**
Le CRM en lecture seule : identité, véhicule, empreinte partagée, historique de
séances, et les points d'entrée vers les outils de guidance (comparaison,
bilan, contexte, annoter, priorités, plan). Le périmètre est celui du
consentement : la vue `coach_pilots_view` n'expose ni courriel, ni téléphone, ni
adresse — seulement `first_name, last_name, pilot_level, avatar_url,
experience_years, ffsa_license, vehicle, socials, media`.
Chaque consultation est journalisée : `logCoachView()` (`coachService.ts`
ligne 266) appelle la fonction `log_coach_view`, qui **revérifie elle-même** que
l'appelant est bien coach consenti avant d'écrire dans `admin_audit`, et
n'écrit rien silencieusement sinon (pour ne pas renseigner un attaquant).
C'est un bon dispositif, réellement en place en base.

#### Zone En direct

**`app/(coach)/en-direct.tsx` — Roster (706 lignes)**
Qui est en piste, depuis quand, en piste ou au stand, sur quel circuit. Source :
présence Supabase Realtime via `useLiveRoster` → `subscribeRoster`
(`src/services/liveSessionService.ts` ligne 68), canal par coach.
Le drapeau `ready` distingue « connexion en cours » de « personne en piste » —
l'écran ne ment pas sur l'attente.
Une pastille cardio par pilote vient de `useRosterBiometry`, jamais de la
présence : la FC n'emprunte que le canal privé du binôme.
Un déclencheur de simulation existe, strictement `__DEV__`
(`en-direct.tsx` lignes 175 et 421-451) : il permet de développer sans RaceBox.
Il ne peut pas s'afficher dans un build de production.

**`app/(coach)/en-direct/[sessionId].tsx` — Focus pilote (942 lignes)**
Le coach suit un pilote : chrono du tour en cours (le chiffre roi, en or),
secteur, liste des tours, vitesse et forces G en relevés neutres, état de
connexion honnête (`live` → `stale` → `offline`, dérivé chaque seconde par
`usePilotLive`, `src/hooks/usePilotLive.ts` lignes 102-119).
La biométrie s'efface au bout de 10 secondes sans événement plutôt que de figer
une valeur périmée (lignes 36 et 112-118). C'est une décision de conception
rigoureuse, lisible dans le code.

**Le direct ne peut pas fonctionner aujourd'hui, pour une raison précise.**
L'émission côté pilote est décidée par `consentedCoaches()`
(`src/services/liveRelayRunner.ts` ligne 77), qui exige **quatre** conditions :
`active = true`, **`status = 'active'`**, `pilot_consent_at` non nul,
`live_sharing_at` non nul.
Or, comme établi plus haut, aucun code n'écrit jamais `status = 'active'` : la
valeur par défaut `pending` reste. **Le relais live ne trouvera donc jamais un
seul coach à qui émettre, même avec un compte coach et un pilote consentant.**
C'est un blocage de bout en bout, pas une question de matériel.

À noter que ce même fichier documente le durcissement du 26/07 : sans la
condition `pilot_consent_at`, retirer son consentement ne coupait pas le direct.
Le correctif est en place.

**`app/(coach)/ar.tsx` — Vue AR au bord de piste (1 009 lignes)**
Configuration d'une vue destinée à des lunettes Ray-Ban Display, portée **par le
coach**, jamais par le pilote. La doctrine est écrite en tête de fichier et
paraît respectée dans le code : faits seuls, jamais de consigne ; aucune
connexion lunettes simulée ; état neutre « non appairées — aperçu » (ligne 414).
Les pilotes proposés viennent de `listMyPilots()`, donc du consentement.
L'aperçu in-lens est une `WebView` pointant sur `https://app.oxvehicle.fr/ar-view`
(ligne 99). **Cette page web ne vit pas dans ce dépôt : je ne peux pas dire si
elle existe ni ce qu'elle affiche.** L'écran gère explicitement le chargement et
l'erreur/404, donc l'absence de la route ne provoquerait pas de plantage.
La dépendance `react-native-webview` est bien dans `package.json` (ligne 93).
L'écran est marqué EXPÉRIMENTAL dans l'interface, les lunettes étant en
developer preview.

#### Zone Messages

**`app/(coach)/messages.tsx` (657 lignes) et `app/(coach)/messages/[coachPilotId].tsx` (617 lignes)**
Fil de discussion coach↔pilote, table `coach_messages`, temps réel par
`postgres_changes` (`src/hooks/useCoachThread.ts`).
La table ne porte que `coach_pilot_id, sender_id, body, session_id, created_at,
read_at` : **aucune coordonnée**, ce qui est cohérent avec la promesse
« in-app, sans coordonnées » affichée dans l'interface.
La policy d'insertion est stricte : l'expéditeur doit être `auth.uid()`, être
l'un des deux membres, et le binôme doit être `active` **et** consenti.
**Production : 1 message, « Salut », envoyé le 2026-07-16 par le compte
fondateur sur son propre binôme.**

#### Zone Agenda

**`app/(coach)/calendrier.tsx` — Agenda (831 lignes)**
Vue semaine sur tablette, liste sur téléphone. Deux sources réelles, aucune
inventée : les demandes `accepted` datées (`listCoachBookings`) et les créneaux
`open` (`listMyAvailability`). Le fichier précise qu'une demande n'a pas de fin
en base : son bloc est ancré à l'heure de début avec une hauteur minimale,
jamais une durée fabriquée.

**`app/(coach)/disponibilites.tsx` — Disponibilités (901 lignes)**
Le coach ouvre des créneaux (circuit, début, capacité, notes) qui deviennent
réservables sur sa fiche publique. `createAvailability()`
(`src/services/coachMarketplaceService.ts` ligne 545) insère avec
`status: 'open'`.

**Un point que l'écran ne dit pas au coach.** Le déclencheur
`trg_coach_availability_open_gate` (INSERT et UPDATE sur `coach_availability`)
exécute `oxv_coach_availability_open_gate()`, qui **force silencieusement
`status` à `closed`** pour tout appelant non administrateur, et interdit de
rouvrir un créneau. L'ouverture est réservée à OXV. Un vrai coach créerait donc
un créneau qui n'apparaîtrait pas sur sa fiche, sans explication à l'écran.
Les 4 lignes présentes en base appartiennent au compte fondateur, qui est
`is_admin` — d'où l'unique créneau réellement `open` (24 décembre 2026, Haute
Saintonge, capacité 3) ; les 3 autres sont `cancelled`.

**`app/(coach)/demandes.tsx` — Demandes reçues (556 lignes)**
Table `coaching_bookings`, RLS `coaching_bookings_coach_select` /
`_coach_respond`. Les demandes `pending` passent en tête. L'identité du pilote
n'est **jamais** lue dans la table `users` : le prénom est dénormalisé sur la
demande (`pilot_first_name`), avec repli « Pilote ». C'est une décision RGPD
explicite, documentée en tête de `coachMarketplaceService.ts` lignes 24-29.
Les états possibles sont contraints en base : `pending, accepted, declined,
cancelled, paid, completed, refunded`.
**Production : 2 lignes, toutes deux avec `coach_id = pilot_id` (le fondateur
se réservant lui-même), `pilot_first_name` null, aucun montant.** Ce sont des
essais, pas de la matière.

**`app/(coach)/roulages/index.tsx` (437), `nouveau.tsx` (537), `[id].tsx` (671)**
Les roulages organisés par le coach : liste à venir/passés, création (titre,
date, lieu, places, prix, notes), détail avec roster d'invitations.
Tables `coach_roulages` et `roulage_invitations`, service `roulagesService.ts`.
L'accès entier est gaté par la permission `can_manage_own_sessions`
(`roulages/index.tsx` ligne 125) **et** par la policy
`coach_roulages_manage_own`, qui appelle `coach_has_permission(auth.uid(),
'manage_own_sessions')` — le verrou est donc doublé côté base, pas seulement
côté interface. Bon point.
**Tables : 0 ligne chacune.**

#### Zone Moi — compte professionnel

**`app/(coach)/profil.tsx` — Fiche publique (828 lignes)**
Le coach édite sa fiche `coach_profiles` : présentation, biographie, palmarès,
spécialités, circuits, prix de session (le prix affiché, décision fondateur du
2026-07-16) et prix de saison, liens, médias, publication. Un aperçu réel de ce
que voient les pilotes est présenté en regard.
Les médias passent par `coachMediaService.ts` : bucket public `coach-media`
(existant en production, créé le 2026-06-18), convention `{coachId}/{uuid}.{ext}`,
métadonnées dans le jsonb `coach_profiles.media`.

**La fiche existante n'est plus éditable par son propriétaire.** La policy
`coach_profiles_owner_all` exige `coach_id = auth.uid() AND is_coach()`. Le
compte fondateur étant repassé `pilot`, il ne peut plus écrire sa propre fiche —
sauf par la policy `coach_profiles_admin_all`, dont il bénéficie par ailleurs.
Contenu réel de la fiche : `headline = "Coach"`, `is_published = true`,
`season_price_eur = 300`, `session_price_eur` null, `specialties` et `circuits`
vides, aucun lien de paiement, aucun SIRET. C'est la seule fiche coach publiée
de la plateforme.

**`app/(coach)/business.tsx` — Tableau de bord (641 lignes)**
Suivi factuel de l'activité : nombre de pilotes suivis, roulages organisés,
présences confirmées, revenu cumulé des roulages tarifés. Le service
`coachBusinessService.ts` documente les arbitrages : aucune commission, aucun
chiffre d'affaires OXV global, aucune remise dégressive — tous écartés par
décision du 2026-06-07. Le revenu n'existe que si le coach a renseigné un prix.
Gaté par `can_view_business_dashboard` (ligne 166).
**Sans roulage en base, cet écran afficherait des zéros.**

**`app/(coach)/facturation.tsx` — Facturation (678 lignes)**
Le principe est posé sans ambiguïté dans le code : **l'émetteur est le coach,
le paiement va directement au coach, hors OXV** ; l'application n'est qu'un
outil d'aide. Le modèle de « déverrouillage payant » est explicitement abandonné
(commentaire lignes 5-9).
L'écran est gaté par le drapeau `coach_billing` (ligne 104).
**Ce drapeau est `enabled = false` en production**, avec la description
« Prestation coach : suivi + aide à la facture (par coach) », inchangé depuis le
2026-07-06. Le commentaire du fichier précise « INACTIF jusqu'au SIRET » — la
facturation attend le SIRET d'OXV.
Quand le drapeau est faux, le lien n'apparaît même pas dans le hub
(`index.tsx` lignes 172-174) : pas de « bientôt disponible » affiché, ce qui est
un choix cohérent.

**`app/(coach)/facture-nouvelle.tsx` — Émettre une facture (696 lignes)**
Saisie des lignes, choix d'un destinataire parmi les binômes, date. Le calcul
HT/TVA/TTC est une logique pure testée (`coachBillingLogic.ts`, régimes
`franchise` avec mention « TVA non applicable, art. 293 B du CGI » ou
`assujetti`). Le numéro est alloué par la fonction serveur atomique
`next_coach_invoice_number`, qui **ignore volontairement le paramètre
`p_coach` au profit de l'appelant authentifié** — garde-fou d'autorisation
correct.
Le PDF est rendu en blanc professionnel, choix délibéré et documenté
(`coachInvoicePdfService.ts` lignes 5-9) : une facture est un document externe,
pas un écran de l'application.
**Tables `coach_invoices` et `coach_invoice_counters` : 0 ligne.**

**`app/(coach)/facturation-identite.tsx` — Identité de facturation (395 lignes)**
Nom, forme juridique, adresse, SIRET, régime de TVA. Ces valeurs sont copiées en
instantané sur chaque facture émise. Le SIRET est validé en douceur (Luhn) :
indice, jamais bloquant.
Les colonnes existent bien sur `coach_profiles` (`billing_name`,
`billing_address`, `billing_siret`, `billing_legal_form`, `vat_regime`
défaut `franchise`, `vat_rate`).
**Aucune n'est renseignée en production.**

Le pendant pilote existe : `pilotCoachBillingService.ts` lit les factures qui
concernent le pilote et résout le lien de paiement du coach depuis
`coach_profiles.payment_link` pour l'ouvrir. Le fichier rappelle en tête :
« OXV n'encaisse jamais ». Aucune coordonnée bancaire n'est saisie dans
l'application. Un test dédié verrouille l'acceptabilité du lien
(`src/services/__tests__/coachPaymentLinkGuard.test.ts`, passe).

---

### Les services : ce qui est réellement câblé

33 fichiers `src/services/coach*.ts`. Voici, pour chacun, la source de données
constatée par lecture du code :

| service | tables / appels | lignes en production |
| --- | --- | --- |
| `coachService.ts` | `coach_pilots_view`, `telemetry_sessions`, `telemetry_frames`, `coach_annotations`, rpc `log_coach_view` | vue : 1 binôme visible |
| `coachAdminService.ts` | `coach_pilots`, `users`, fn `send-coach-invitation` | — |
| `coachAnnotationsService.ts` | `coach_annotations` | **0** |
| `coachAudioService.ts` | `coach_annotations` + bucket `coach-audio` | bucket existe, privé |
| `coachQueueService.ts` | `coach_queue` | **0** |
| `coachTriageService.ts` | `app_segment_analyses` (via `segmentAnalysesService`) | **0** |
| `coachStudioService.ts` | `telemetry_sessions` + 6 services agrégés | 18 séances, dont 10 complétées |
| `coachConsoleService.ts` | `telemetry_sessions`, `app_session_analyses` | 13 analyses de séance |
| `coachSessionContextService.ts` | `coach_session_context` | **0** |
| `coachCurationService.ts` | `coach_pilot_highlight`, `coach_annotation_template` | **0** et **0** |
| `coachReadingService.ts` | `coach_reading_weights` | **0** |
| `coachReferenceService.ts` | `coach_corner_reference` | **0** |
| `coachObjectivesService.ts` | `coach_objectives` | **0** |
| `developmentCycleService.ts` | `pilot_development_cycles`, `cycle_steps` | **0** et **0** |
| `coachAiService.ts` | `coach_ai_drafts`, fn `coach-ai-draft` / `coach-ai-validate` | **0** |
| `coachMessagesService.ts` | `coach_messages`, `coach_pilots` | **1** |
| `coachMarketplaceService.ts` | `coach_profiles`, `coach_availability`, `coaching_bookings`, `coach_testimonials` | 1 / 4 / 2 / **0** |
| `coachProfileService.ts` | `coach_profiles` | 1 |
| `coachMediaService.ts` | `coach_profiles.media` + bucket `coach-media` | vide |
| `coachBillingService.ts` | `coach_invoices`, `coach_profiles` | **0** |
| `coachInvoicePdfService.ts` | rendu local (expo-print) | — |
| `coachReportPdfService.ts` | rendu local (expo-print) | — |
| `pilotCoachBillingService.ts` | `coach_invoices`, `coach_profiles`, `coaching_bookings` | **0** |
| `coachBusinessService.ts` | `coach_roulages`, `roulage_invitations` | **0** et **0** |
| `coachPermissionsService.ts` | `coach_permissions` | 1 |
| `coachAdminService`, `coachTriageLogic`, `coachQueueLogic`, `coachConsoleLogic`, `coachContextLogic`, `coachCurationLogic`, `coachReadingLogic`, `coachReferenceLogic`, `coachObjectivesLogic`, `coachBillingLogic` | logique pure, sans base | — |

La séparation « logique pure » / « accès base » est systématique et propre : dix
fichiers `*Logic.ts` sans aucun appel Supabase, tous testés.

#### Les permissions modulaires

Trois indicateurs dans `coach_permissions` : `can_view_pilots` (défaut vrai),
`can_manage_own_sessions` (défaut faux), `can_view_business_dashboard` (défaut
faux). Le repli du service est explicitement « fail-safe » : en cas d'erreur ou
d'absence de ligne, on retourne les permissions minimales
(`coachPermissionsService.ts` lignes 21-25 et 48-51).
**Une seule ligne existe en production, celle du compte fondateur, avec les
trois indicateurs à `true`.**

---

### Ce qui est branché sur du réel, et ce qui ne l'est pas

#### Branché sur des données réelles

- La liste des binômes, filtrée par consentement (`coach_pilots_view`).
- Les séances, tours et bilans des pilotes consentis (`telemetry_sessions`,
  `laps`, `app_session_analyses`).
- La messagerie (`coach_messages`, temps réel).
- L'agenda : demandes acceptées et créneaux ouverts.
- Les demandes reçues (`coaching_bookings`).
- La fiche publique du coach (`coach_profiles`).
- Le calcul de facture (logique pure testée) et la numérotation atomique.
- Le roster du direct (présence Supabase Realtime).
- Le journal d'accès coach (`log_coach_view` → `admin_audit`).

#### Structurellement branché, mais sans matière en base

Tout ce qui produit le travail du coach : annotations, file de lecture,
priorités, gabarits, repères, pondérations de lecture, contexte de séance,
objectifs, programmes, brouillons IA, roulages, factures. **Ces douze tables
contiennent zéro ligne en production.** Le code est écrit, la base est prête,
rien n'a jamais été saisi.

#### Non branché, ou bloqué

- **Le direct** : bloqué par la condition `status = 'active'` que rien n'écrit
  (`liveRelayRunner.ts` ligne 82).
- **L'assistant IA** : bloqué par `coach_ai_enabled` (0 compte), par
  `app_segment_analyses` (0 ligne), et éventuellement par `OPENAI_API_KEY`
  (non vérifiable).
- **La facturation** : drapeau `coach_billing` à `false`.
- **Le studio virage par virage et le triage** : `app_segment_analyses` vide.
- **La biométrie côté coach** : 0 pilote a donné le consentement de partage.
- **L'ouverture de créneaux** : ramenée à `closed` par un déclencheur, sans
  message à l'écran.
- **La vue AR** : dépend d'une page web hors dépôt, non vérifiable ici, et de
  lunettes en developer preview.
- **L'enregistrement vocal des annotations** : le code est complet
  (`coachAudioService.ts`) et `expo-av` est bien dans `package.json` ligne 50,
  mais le fichier avertit qu'il exige un module natif fonctionnel à partir du
  prochain build natif. **Aucun enregistrement n'a été observé.**

#### Aucune donnée fabriquée

C'est un point à porter au crédit de l'espace. Recherche systématique de valeurs
de démonstration dans les 37 écrans : **aucun jeu de données factice, aucune
valeur codée en dur présentée comme mesurée.** Le seul simulateur trouvé est
strictement `__DEV__` (`en-direct.tsx` ligne 175). Plusieurs fichiers
documentent explicitement le refus de simuler (`ar.tsx` lignes 20 et 414,
`gabarits.tsx` ligne 37 : « L'écran le dit en clair au lieu de le simuler »).

---

### Les tests

Suite lancée sur le motif `coach` :

```
Test Suites: 4 skipped, 13 passed, 13 of 17 total
Tests:       22 skipped, 106 passed, 128 total
```

Les 13 suites qui passent couvrent la logique pure : facturation, console,
contexte, curation, navigation, objectifs, file, lecture, repères, triage,
absence de score (`coachDomainNoScore.test.ts`), garde du lien de paiement,
logique de coaching côté pilote.

Les 4 suites ignorées sont les tests de sécurité RLS
(`coachAiRLS`, `coachAnnotationsRLS`, `coachGradedAccessRLS`,
`coachSessionsRLS`). Elles exigent un projet Supabase de test dont les variables
d'environnement ne sont pas présentes. **Toute la surface de consentement gradué
est donc écrite, mais non vérifiée hors CI.**

À noter aussi : `jest.config.js` ligne 21 n'accepte que `*.test.ts`. Aucun
fichier `.tsx` n'est testé — donc **aucun écran coach n'est couvert par un
test**, seulement les services et la logique.

---

### Les défauts que cette section établit

Par ordre de gravité, tous vérifiés.

1. **Zéro compte coach en production.** L'espace entier est injoignable.
   Source : table `users`, `app/(coach)/_layout.tsx:33`.
2. **Le direct ne peut pas s'amorcer.** `liveRelayRunner.ts:82` exige
   `status = 'active'` sur `coach_pilots` ; aucun code n'écrit jamais cette
   valeur. Deux écrans (706 et 942 lignes) et un canal Realtime en dépendent.
3. **Un coach rétrogradé conserve l'accès aux données au niveau de la base.**
   `is_coach_of()` ne regarde pas `users.role`, et `demoteToPilot()`
   (`coachAdminService.ts:269`) ne désactive pas les affiliations. Le compte
   `6edd7f5c-…` est aujourd'hui dans ce cas.
4. **Les annotations sont bornées à 7 virages** par
   `coach_annotations_corner_index_check`, alors que la base contient un circuit
   à 14 virages (Ricardo Tormo). L'écran accepte l'indice, l'insertion
   échouerait. Signalé par le commit `93f0638` et non corrigé — c'est une
   modification de schéma en production, qui demande votre accord.
5. **Le nom de virage affiché est toujours celui de Haute Saintonge**
   (`src/lib/circuitTopology.ts`), quel que soit le circuit de la séance.
6. **Un créneau créé par un vrai coach serait fermé sans le lui dire** :
   `createAvailability` insère `open`, le déclencheur
   `oxv_coach_availability_open_gate` le ramène à `closed`, l'écran ne
   l'explique pas.
7. **`app_segment_analyses` est vide.** Le studio virage par virage, le triage,
   l'assistant IA et les comparaisons de marges n'ont aucune source. C'est le
   goulot d'étranglement le plus large de l'espace.
8. **Les policies d'affiliation par le coach et par le pilote ne sont empruntées
   par aucun écran.** Seul l'administrateur peut créer un binôme.
9. **Aucun test ne couvre les 26 528 lignes d'écrans coach**, et les 4 suites de
   sécurité RLS ne s'exécutent pas hors CI.

---

### Ce que je n'ai pas pu vérifier

Je les liste plutôt que de combler.

- **Le rendu.** Aucun écran n'a été affiché. Je ne peux rien dire de la mise en
  page réelle, de la lisibilité, des animations, de la bascule console/téléphone
  au seuil `COACH_CONSOLE_MIN_WIDTH`.
- **Les gestes.** Aucun appui, aucun défilement, aucun formulaire soumis.
- **Le matériel.** Aucun RaceBox, aucune ceinture cardio, aucunes lunettes
  Ray-Ban Display. Tout ce qui touche au direct, à la biométrie et à l'AR est
  une lecture de code.
- **Les secrets du projet Supabase.** Je ne peux pas dire si `OPENAI_API_KEY`
  est renseignée pour les fonctions `coach-ai-draft` et `coach-ai-validate`, ni
  si `edge_functions_base_url` (nécessaire au déclencheur de notification
  d'annotation) est bien dans le vault.
- **La page web `https://app.oxvehicle.fr/ar-view`.** Elle n'est pas dans ce
  dépôt et je n'y ai pas accédé.
- **L'enregistrement vocal.** `expo-av` est déclaré, le code est écrit, aucun
  enregistrement n'a été produit ni relu.
- **Les policies Storage** des buckets `coach-audio` et `coach-media` : les
  buckets existent bien en production (respectivement privé et public), je n'ai
  pas déroulé leurs règles d'accès objet par objet.
- **Le comportement effectif des RLS.** Je les ai lues, pas éprouvées : les
  seuls tests qui le feraient sont ignorés faute de projet de test configuré.

---

## Les autres espaces : admin, partenaire, pro, authentification, onboarding

### Préambule de méthode

Tout ce qui suit est une **lecture de code** et une **lecture de la base de production**. Rien n'a été exécuté : ni l'application, ni un build, ni un test. Aucun rendu, aucun geste, aucun matériel n'a été observé. Quand j'écris « l'écran affiche », il faut lire « le code de l'écran produit ».

La base interrogée est le projet Supabase `fouvuqkdxarjpjbqnsjq` (eu-west-1), en **lecture seule**, le 26 juillet 2026. Les comptages de lignes sont ceux de ce jour-là.

Les chemins de fichiers sont donnés depuis la racine du dépôt `C:/Users/Julie/OneDrive/Desktop/oxv-app`.

---

### 1. Vue d'ensemble : six espaces, un seul aiguillage

| Groupe de routes | Fichiers | Écrans (hors `_layout`) | Rôle requis | Atteignable aujourd'hui |
|---|---:|---:|---|---|
| `app/(admin)/` | 30 | 29 | `users.is_admin = true` | Oui, par un détour (§5.2) |
| `app/(partner)/` | 9 | 8 | `users.role = 'partner'` | Oui, 1 compte en base |
| `app/(pro)/` | 8 | 7 | `users.role = 'pro_pilot'` | **Non**, 0 compte en base |
| `app/(auth)/` | 3 | 2 | aucun (pré-session) | Oui |
| `app/(onboarding)/` | 7 | 6 | session valide, profil incomplet | Oui |
| `app/(coach-onboarding)/` | 4 | 3 | `users.role = 'coach'` | **Non**, 0 compte en base |

Le comptage de fichiers est celui du dépôt (`find app/(admin) -type f` → 30 fichiers, dont `_layout.tsx`).

L'aiguillage unique est `app/index.tsx`. C'est le seul endroit du dépôt qui décide où va un utilisateur après connexion. Sa logique, lignes 71 à 107 :

1. `status !== 'authenticated'` → `/(auth)/login` (ligne 72).
2. Profil absent **ou** onboarding incomplet (ligne 79) :
   - `role === 'coach'` → `/(coach-onboarding)` (ligne 81) ;
   - `role === 'partner'` → `/(partner)` (ligne 85) — **le partenaire saute l'onboarding** ;
   - sinon → `/(onboarding)` (ligne 87).
3. Onboarding complet :
   - `coach` → `/(coach)` (ligne 94) ;
   - `partner` → `/(partner)` (ligne 97) ;
   - `pro_pilot` → `/(pro)` (ligne 100) ;
   - tout le reste, y compris `admin` → `/(app2)` (ligne 107).

Conséquence directe, lisible dans le code : **l'espace admin n'est la destination d'aucune redirection**. Un compte administrateur arrive dans l'arbre pilote V2 comme tout le monde.

L'écran gère aussi un état `error` explicite (lignes 32 à 69) : « Connexion impossible. » avec un bouton « Réessayer » qui relance `initialize()`. Il n'envoie pas vers le login en silence. C'est un choix visible dans le commentaire ligne 30.

---

### 2. Les rôles tels qu'ils existent en base

#### 2.1 L'énumération

Le type `public.user_role` compte cinq valeurs, dans cet ordre : `pilot`, `admin`, `coach`, `partner`, `pro_pilot`. La colonne `users.role` a pour défaut `'pilot'::user_role`. Il n'existe **aucune contrainte CHECK** sur `role` (les seules contraintes CHECK de `users` portent sur `bio`, `blood_type`, `car_number`, `emergency_contact_relation`, `experience_years`, `pilot_level`).

Le type TypeScript correspondant est déclaré à `src/store/useAuthStore.ts:13` et couvre les mêmes cinq valeurs.

#### 2.2 Les 14 comptes de production

| `role` | `is_admin` | Nombre | Onboarding complet | Pacte pilote | Pacte coach | CGU |
|---|---|---:|---:|---:|---:|---:|
| `pilot` | `false` | 10 | 2 | 1 | 0 | 1 |
| `pilot` | `true` | 1 | 1 | 1 | 1 | 1 |
| `admin` | `false` | 2 | 0 | 0 | 0 | 0 |
| `partner` | `false` | 1 | 1 | 0 | 1 | 1 |

Faits qui en découlent, tous vérifiés en base :

- **Aucun compte `role = 'coach'`.** L'espace `app/(coach-onboarding)/` et l'espace coach ne sont donc atteignables par personne aujourd'hui. La seule relation coach existante (`coach_pilots`, 1 ligne) a pour `coach_id` le compte du fondateur (`6edd7f5c…`), qui est aujourd'hui `role = 'pilot'`. Idem pour `coach_profiles` (1 ligne) et `coach_permissions` (1 ligne).
- **Aucun compte `role = 'pro_pilot'`.** L'espace `app/(pro)/` (7 écrans, environ 1 800 lignes) n'a jamais pu être ouvert par un utilisateur en production.
- **Les deux comptes `role = 'admin'` ont `is_admin = false`.** Voir §4.1 : ils passent les gardes serveur mais échouent la garde client. Ils ne peuvent pas ouvrir `app/(admin)/`.
- **Le seul compte qui peut ouvrir l'admin est `6edd7f5c…`** (`public_handle = 'gabin'`), qui porte `role = 'pilot'` et `is_admin = true`.

#### 2.3 Comment le fondateur a perdu `role = 'admin'`

La table `admin_audit` (59 lignes) trace trois `role_changed` :

- 2026-07-07 : `88203298…` passe de `admin` à `partner`.
- 2026-07-18 : `6edd7f5c…` passe de `coach` à `admin`.
- 2026-07-20 15:09:01 : `6edd7f5c…` passe de `admin` à **`pilot`**.

Cette dernière ligne suit d'une seconde un `inscription_accept_relayed` sur la demande `8ecad273…` (email `administration@oxvehicle.fr`, `type_demande = 'pilote'`). La fonction `public.admin_review_demande` fait, à l'acceptation, `update public.users set role = v_role where lower(email) = lower(d.email)` avec `v_role = 'pilot'` pour une demande de type `pilote`. **Valider une demande d'inscription pilote sur un email déjà administrateur rétrograde cet administrateur.** Le compte a conservé `is_admin = true`, ce qui l'a sauvé.

C'est un effet de bord de la base, pas de l'application. Il n'est pas signalé dans le code de l'app.

---

### 3. Ce qui garde l'accès, côté application

Chaque groupe porte sa propre garde dans son `_layout.tsx`. Elles sont toutes du même type : lire le profil dans le store Zustand, comparer, rediriger.

| Fichier | Condition testée | Redirection |
|---|---|---|
| `app/(admin)/_layout.tsx:17` | `!profile?.is_admin` | `/(app2)` |
| `app/(partner)/_layout.tsx:18` | `profile.role !== 'partner'` | `/(app2)` |
| `app/(pro)/_layout.tsx:26` | `profile.role !== 'pro_pilot'` | `/(app2)` |
| `app/(coach-onboarding)/_layout.tsx:19` | `profile.role !== 'coach'` | `/(app2)` |
| `app/(coach)/_layout.tsx:33` | `profile.role !== 'coach'` | `/(app2)` |
| `app/(auth)/_layout.tsx:13` | `status === 'authenticated'` | `/` |
| `app/(app)/_layout.tsx:17` | `status === 'unauthenticated'` | `/(auth)/login` |
| `app/(app2)/_layout.tsx:71` | `status === 'unauthenticated'` | `/(auth)/login` |

Trois remarques factuelles :

1. **`app/(onboarding)/_layout.tsx` n'a aucune garde de rôle ni de session.** Il ne fait que poser un `Stack` avec `gestureEnabled: false` (ligne 17). L'écran est protégé uniquement en amont, par `app/index.tsx`. Le commentaire du fichier assume ce choix : le flux est « strictement linéaire », le retour par geste est coupé pour ne pas laisser un profil « partiellement signé ».
2. **`app/(app)/_layout.tsx` (l'arbre pilote v1, 80 entrées) ne vérifie que la session.** Aucune vérification de rôle, aucune vérification d'onboarding. Un partenaire, un pro ou un administrateur qui atteint une route `/(app)/…` voit l'arbre pilote complet.
3. **La garde admin est la seule qui ne teste pas `role`.** Elle teste `is_admin`. Les deux comptes `role = 'admin'` de production sont donc bloqués, alors que la base les considère administrateurs (§4.1).

Le profil qui alimente ces gardes est chargé par `fetchProfile()` dans `src/store/useAuthStore.ts:55-70`. En cas d'échec de lecture, la fonction retourne `null` et le store passe `profile: null` — les layouts `(partner)`, `(pro)`, `(coach)`, `(coach-onboarding)` retournent alors `null` (écran vide) plutôt qu'une redirection. Le layout `(admin)`, lui, redirige. Comportements divergents, non harmonisés.

Ligne 69 du même fichier : si la colonne `role` est absente de la réponse, le code retombe sur `'pilot'`. Filet de sécurité côté client, jamais côté serveur.

---

### 4. Ce qui garde l'accès, côté base

#### 4.1 Deux définitions de « administrateur »

Deux fonctions coexistent en production :

- `public.is_admin()` : `role = 'admin' OR is_admin = true`.
- `public.oxv_is_admin()` : `role = 'admin'` seulement.

Presque toutes les policies RLS utilisent `is_admin()`. `admin_validate_inscription` utilise `oxv_is_admin()`.

Conséquence vérifiée : le compte du fondateur (`role='pilot'`, `is_admin=true`) satisfait `is_admin()` mais **pas** `oxv_is_admin()`. Il ne peut donc plus appeler `admin_validate_inscription` depuis le 20 juillet 2026, alors qu'il conserve tous les autres droits admin. Aucune surface de l'app n'expose cette fonction — c'est un outil du site — mais la divergence est réelle et non documentée.

Inversement, les deux comptes `role='admin'` / `is_admin=false` satisfont les deux fonctions serveur mais échouent la garde client `app/(admin)/_layout.tsx:17`.

#### 4.2 Les policies des tables d'espace

Relevé depuis `pg_policies` :

- `users` : `users_select_own_or_admin` = `(id = auth.uid()) OR is_admin()` ; `users_update_own_or_admin` = idem ; `users_delete_admin_only` = `is_admin()`.
- `admin_audit`, `devices`, `social_pings`, `ambassador_profiles`, `app_config`, `app_feature_flags` : écriture `is_admin()`.
- `app_config` et `app_feature_flags` sont en **lecture publique** (`qual = true`) — nécessaire, le `MaintenanceGate` les lit avant authentification.
- `partner_accounts` : lecture `profile_id = auth.uid() OR is_admin() OR status = 'validated'` ; écriture limitée au propriétaire ou à l'admin.
- `partner_offers` : lecture `status = 'published' OR owns_partner_account(partner_id) OR is_admin()`.
- `partner_leads` : lecture `owns_partner_account(partner_id) OR is_admin() OR pilot_id = auth.uid()` ; **aucune policy coach**.
- `pro_team_members` : `pro_user_id = auth.uid()` pour tout, plus lecture par le membre et par l'admin.

Trois déclencheurs verrouillent les statuts sensibles, indépendamment de l'app :

- `oxv_partner_accounts_validation_gate` : un non-admin ne peut pas poser `status = 'validated'` (retombe en `pending`).
- `oxv_partner_offers_publish_gate` : un non-admin ne peut pas publier une offre (retombe en `draft`) ; toute modification d'une offre publiée la repasse en `draft`.
- `oxv_coach_availability_open_gate` : un non-admin ne peut pas ouvrir un créneau.

Ces garde-fous sont serveur. Ils tiennent même si l'écran se trompe.

#### 4.3 Ce qui n'est pas verrouillé

- **`users.is_admin` n'est protégé par rien.** Le déclencheur `trg_guard_users_privileged_columns` (fonction `guard_users_privileged_columns`) ne surveille que `role` et `kyc_status`. Le rôle `authenticated` détient le privilège `UPDATE` sur la colonne `is_admin` (`information_schema.column_privileges`), et la policy `users_update_own_or_admin` autorise un utilisateur à modifier sa propre ligne. Lu de bout en bout, cela signifie qu'un compte authentifié peut se poser `is_admin = true` sur lui-même, ce qui rend `is_admin()` vrai et ouvre l'ensemble des policies admin. Je n'ai **pas** exécuté cette écriture — c'est une lecture des policies, des privilèges de colonne et des déclencheurs, pas un test.
- **`users.suspended_at` n'est jamais lu.** L'écran `app/(admin)/utilisateurs/[id].tsx` écrit la suspension via `setSuspended` (`src/services/adminUsersService.ts:125-146`). Aucune policy RLS ne référence `suspended` (requête sur `pg_policies` : 0 résultat), et aucun fichier de `src/` ou `app/` ne lit `suspended_at` en dehors du service admin et des types générés. **Suspendre un compte ne l'empêche donc de rien.**
- **Les tests RLS ne tournent pas par défaut.** `src/__tests__/rls/setup.ts:22` désactive toute la suite si `TEST_SUPABASE_URL` / `TEST_SUPABASE_SERVICE_KEY` sont absents ; `.github/workflows/check.yml:85` teste explicitement ces variables et saute l'étape sinon. Ces tests couvrent la règle cardinale « le partenaire ne voit jamais la télémétrie » (`src/__tests__/rls/roleMatrixRLS.test.ts:30-44`). S'ils ne s'exécutent pas dans la CI, cette garantie n'est pas vérifiée automatiquement. Je n'ai pas pu contrôler si les secrets GitHub sont renseignés.

---

### 5. L'espace d'authentification — `app/(auth)/`, 2 écrans

#### 5.1 `login.tsx` (116 lignes)

Un formulaire, deux champs, un bouton.

- « Adresse email » (`Field`, clavier email, autocapitalisation coupée) — lignes 43-54.
- « Mot de passe » (saisie masquée) — lignes 56-67. L'erreur d'authentification s'affiche sous ce champ.
- Bouton « Entrer » / « Connexion… », actif seulement si les deux champs sont remplis (ligne 22).
- Un lien secondaire « Lier mon compte avec un code du site » vers `/(auth)/lier` (lignes 80-88).

L'appel est `supabase.auth.signInWithPassword` (`src/store/useAuthStore.ts:116`). Les erreurs sont traduites en français par `translateAuthError` (lignes 149-161) : « Identifiants incorrects. », « Adresse non confirmée… », « Connexion impossible. Vérifiez votre réseau. »

Ce que l'écran **ne fait pas**, vérifié par recherche sur tout le dépôt : aucun `supabase.auth.signUp(`, aucun `resetPasswordForEmail`, aucun libellé « mot de passe oublié ». **Il n'existe ni création de compte ni réinitialisation de mot de passe dans l'application.** Les comptes se créent ailleurs (site, back-office), et un mot de passe perdu ne se récupère pas depuis le mobile.

#### 5.2 `lier.tsx` (143 lignes)

Appairage site → app par code court, livré au lot M3.

- Le pilote génère un code sur oxvehicle.fr, le saisit ici : 8 caractères, alphabet sans `0/O/1/I/L`, validité annoncée « dix minutes » (texte ligne 72-75).
- La normalisation est pure et testée : `normalizePairingCode` et `isPairingCodeComplete` (`src/services/pairingLogic.ts:21-27`), couvertes par `src/services/__tests__/pairingLogic.test.ts`.
- L'échange passe par la fonction edge `pair-app` (`src/services/pairingService.ts:33-35`), puis `supabase.auth.verifyOtp({ type: 'magiclink', token_hash })` (ligne 60). Aucun mot de passe n'est retapé.
- Un lien profond `oxv://lier?code=XXXXXXXX` préremplit le champ (lignes 38-40). Le schéma `oxv` est déclaré dans `app.json:8`.
- Les erreurs sont typées et traduites : code invalide/expiré, `rate_limited` (« Trop de tentatives. Patientez une minute »), échec de liaison, réseau (`src/services/pairingLogic.ts:37-51`).

État en production : la fonction edge `pair-app` est **déployée et active** (version 6, `verify_jwt = false`). La table `app_pairing_codes` contient **0 ligne**. La table `app_pairing_redeem_attempts` contient **1 ligne**, datée du 3 juillet 2026. Autrement dit : le mécanisme a été touché une fois, il y a trois semaines, et aucun code n'est en circulation. Je ne peux pas dire si cette tentative a abouti.

---

### 6. L'onboarding pilote — `app/(onboarding)/`, 6 écrans

C'est le seul passage obligé entre la connexion et l'application. Six écrans, numérotés 1/6 à 6/6 par une barre de progression en or (`palette.gold`), sans bouton « passer ». Le commentaire de `app/(onboarding)/index.tsx:5-6` l'énonce : « Pas de bouton "passer" : l'onboarding est complet ou rien. »

Le `Stack` coupe le retour par geste (`app/(onboarding)/_layout.tsx:17`).

#### Étape 1/6 — Accueil (`index.tsx`, 121 lignes)

Icône de l'application (160 × 160, `assets/icon.png`), sur-titre « OXV MIRROR », une phrase : « Bienvenue dans le miroir. » Bouton « Commencer » → `/(onboarding)/doctrine`.

#### Étape 2/6 — Doctrine (`doctrine.tsx`, 127 lignes)

Titre « Une app qui vous montre. » puis trois lignes empilées : « Pas un coach. » / « Pas un instructeur. » / « Un miroir. » Manifeste de bas d'écran : « Les décisions de pilotage vous appartiennent. Toujours. » Bouton « Compris » → `/(onboarding)/methode`.

Aucune écriture en base à cette étape.

#### Étape 3/6 — Méthode (`methode.tsx`, 140 lignes)

Trois mots en monospace, chacun avec une phrase (constante `STEPS`, lignes 19-23) :

- VOIR — « Ce qui s'est passé. »
- COMPRENDRE — « Ce que vous avez senti. »
- QUESTIONNER — « Ce que vous voulez explorer. »

Manifeste : « Jamais d'instruction. Toujours une observation. » Bouton « Suivant » → `/(onboarding)/niveau`.

#### Étape 4/6 — Niveau pilote (`niveau.tsx`, 183 lignes)

Quatre cartes, une seule sélectionnable (constante `LEVELS`, lignes 28-45) :

| Valeur écrite | Libellé affiché | Description |
|---|---|---|
| `debutant` | Débutant | « Quelques journées circuit, je découvre. » |
| `intermediaire` | **Apprivoisé** | « Je connais mon circuit, je progresse session après session. » |
| `confirme` | Confirmé | « Je tourne régulièrement, je connais mes limites. » |
| `expert` | Expert | « J'ai un fond compétition, je cherche la précision. » |

Le libellé « Apprivoisé » pour la valeur `intermediaire` est un choix de vocabulaire doctrinal assumé. La colonne `users.pilot_level` porte une contrainte CHECK en base limitée à ces quatre valeurs exactement (`users_pilot_level_check`) : l'écran et la base sont alignés.

Texte sous le titre : « Cette information reste privée. Elle calibre vos analyses. » Écriture via `setPilotLevel` (`src/services/onboardingService.ts:25-41`) : un `update` sur `users.pilot_level`. En cas d'échec réseau, l'action part dans la file hors-ligne (`enqueueAction`, kind `update_pilot_level`) et l'écran continue quand même vers l'étape suivante.

Répartition en production : 3 comptes sur 14 ont un `pilot_level` (`debutant` ×2, `intermediaire` ×2 — soit 4 valeurs pour 4 comptes, un compte partenaire inclus).

#### Étape 5/6 — CGU et confidentialité (`cgu.tsx`, 233 lignes)

Quatre cases. Trois obligatoires (ligne 37 : `allChecked = cgu && privacy && age`) :

1. « J'accepte les Conditions Générales d'Utilisation. »
2. « J'ai lu la Politique de confidentialité. »
3. « Je confirme avoir 18 ans révolus et un permis B valide. »

Une case **optionnelle**, sous un sur-titre « OPTIONNEL » : « J'autorise le débrief enrichi par une IA (transfert de données non nominatives hors UE). Sans cela, votre débrief reste rédigé localement. Modifiable à tout moment. »

Puis : « Les documents complets sont consultables à tout moment depuis vos paramètres. »

L'écriture est `acceptCguAndPrivacy(aiDebriefConsent)` (`src/services/onboardingService.ts:49-75`), qui pose en une fois `cgu_accepted_at`, `cgu_version`, `privacy_accepted_at`, `privacy_version` et `ai_debrief_enabled`. Les versions sont des constantes du code : `CGU_VERSION = '1.0'`, `PRIVACY_VERSION = '1.0'` (lignes 20-21). En cas d'échec, une alerte « Acceptation non enregistrée » bloque la progression — l'écran ne laisse pas passer un consentement non écrit.

Trois observations factuelles sur cet écran :

- **Les documents ne sont pas consultables depuis l'écran de consentement.** Les trois libellés sont du texte simple, sans lien. Le lecteur juridique existe (`app/(app2)/vous/document/[doc].tsx`, alimenté par `src/legal/legalDocuments.ts` qui embarque `pacte`, `cgu`, `confidentialite`, `decharge`) mais il n'est atteignable qu'**après** l'onboarding, depuis `app/(app2)/vous/documents.tsx:184`. Le pilote accepte donc des documents qu'il ne peut pas lire à ce moment-là dans l'application.
- **La déclaration d'âge et de permis n'est pas vérifiée.** C'est une case à cocher, rien d'autre. Aucune colonne dédiée n'est écrite : les trois cases obligatoires alimentent deux horodatages (`cgu_accepted_at`, `privacy_accepted_at`), la troisième ne laisse aucune trace propre.
- **Le défaut de la colonne `ai_debrief_enabled` est `true` en base**, alors que le code de l'application passe `false` par défaut (`acceptCguAndPrivacy(aiDebriefConsent = false)`, ligne 49). En production, 13 comptes sur 14 ont `ai_debrief_enabled = true` — c'est-à-dire la valeur par défaut, jamais un consentement recueilli par cet écran. Un seul compte est à `false`. Le commentaire du service (lignes 43-48) affirme « aucun transfert vers OpenAI (US) tant que le pilote ne l'a pas autorisé ici » ; cette affirmation est vraie du chemin applicatif, pas de l'état de la table.

#### Étape 6/6 — Pacte de pilotage (`pacte.tsx`, 183 lignes)

L'écran de signature. Barre de progression pleine, deux phrases en grand :

> « L'app est un miroir. Elle vous montre. Elle ne vous dirige pas. »
> « La piste est à vous. Les décisions aussi. »

Une case « Je m'engage. », un bouton « Activer OXV Mirror ».

Au tap (lignes 26-46), dans cet ordre :

1. `acceptPact()` → `pact_accepted_at` + `pact_version = '1.0'`. Échec : alerte « Pacte non enregistré », rejeu par la file hors-ligne, on n'avance pas.
2. `completeOnboarding()` → `profile_completed_at`. Échec : alerte « Finalisation impossible », on n'avance pas.
3. `router.replace('/')` — retour à l'aiguillage, qui route enfin par rôle.

`completeOnboarding` émet aussi l'événement analytique `onboardingTermine()` (`src/services/onboardingService.ts:150`), présenté en commentaire comme le KPI d'activation pilote.

Le document source est `docs/juridique/01_PACTE_DE_PILOTAGE.md`, version 1.0. Il porte encore trois marqueurs à compléter en en-tête : « [date de mise en service] », « [SIRET à compléter] », « [Adresse à compléter] ». Le texte embarqué dans l'application (`src/legal/legalDocuments.ts`) est généré depuis ce fichier ; les marqueurs y sont donc aussi.

#### La porte de sortie de l'onboarding

`isOnboardingComplete` (`src/services/onboardingService.ts:159-175`) est la seule condition d'entrée dans l'application :

```
base = profile_completed_at ET cgu_accepted_at
coach  → base ET coach_pact_accepted_at
autres → base ET pact_accepted_at
```

Trois conséquences lisibles :

- `privacy_accepted_at` n'entre pas dans le calcul, alors qu'il est écrit par la même fonction.
- `pilot_level` n'entre pas dans le calcul : l'étape 4 est franchissable sans écriture réussie.
- Le rôle `partner` retombe dans la branche « autres » et exigerait `pact_accepted_at`, mais `app/index.tsx:84` l'intercepte avant. **Un partenaire n'a donc jamais à signer quoi que ce soit dans l'application.**

État en production : 3 comptes sur 14 ont `profile_completed_at`, 2 ont `pact_accepted_at`, 2 ont `cgu_accepted_at`. Autrement dit, **onze comptes sur quatorze n'ont jamais terminé l'onboarding**. Ils seraient renvoyés sur `/(onboarding)` à leur prochaine connexion.

Aucun test unitaire ne couvre `onboardingService` : la recherche `isOnboardingComplete` ne renvoie que `app/index.tsx`, `src/services/offlineQueue.ts` et le service lui-même. Rien dans `src/services/__tests__/`.

---

### 7. L'onboarding coach — `app/(coach-onboarding)/`, 3 écrans

Garde de rôle stricte (`_layout.tsx:19`), retour par geste coupé, barre de progression sur trois pas.

#### 1/3 — Accueil (`index.tsx`, 127 lignes)

« Vous êtes coach OXV. » puis : « Votre rôle est d'accompagner les pilotes qui vous sont assignés et qui ont consenti au partage de leurs données. » et « Avant de commencer, deux pages à lire calmement. »

#### 2/3 — Mission (`mission.tsx`, 175 lignes)

Quatre principes, en dur dans la constante `POINTS` (lignes 19-40). Résumé de chacun :

- **POSTURE** — « Vous observez, vous n'instruisez pas. » L'application ne génère pas d'instructions à transmettre.
- **CONSENTEMENT** — « Le pilote contrôle ce que vous voyez. » Sans consentement explicite du pilote, ses données restent invisibles ; le retrait est immédiat et sans justification.
- **CONFIDENTIALITÉ** — « Vous voyez les données. Jamais l'identité. » Pas d'email, pas de téléphone, pas de documents administratifs.
- **TRACE** — « Vos accès sont journalisés. » Date, heure, pilote consulté ; conservé par OXV ; consultable par le pilote sur demande.

Ces quatre promesses ont un pendant serveur réel : `is_coach_of()` exige `active = true AND pilot_consent_at IS NOT NULL` ; `log_coach_view()` écrit dans `admin_audit` et ne fait rien si l'appelant n'est pas coach du pilote ; `coach_annotation_doctrine_guard()` lève une exception `doctrine_violation` si une note partagée contient un terme prescriptif. La table `admin_audit` contient 2 lignes `coach_view_sessions` (28 juin et 7 juillet 2026) et 3 lignes `coach_annotation_notified` (18 juin 2026) : la journalisation a bien fonctionné, au moins ces jours-là.

Pas de case à cocher sur cet écran. Bouton « Continuer vers le pacte ».

#### 3/3 — Pacte de coaching (`pacte.tsx`, 195 lignes)

Deux phrases :

> « Je respecte la confidentialité du pilote, sans condition. »
> « Je n'instruis pas. Je propose un regard. »

Case « Je m'engage. », bouton « Activer mon compte coach ». Au tap (lignes 30-58) : `acceptCoachPact()` (→ `coach_pact_accepted_at`, `coach_pact_version = '1.0'`), puis `acceptCguAndPrivacy()` **sans argument** — donc `ai_debrief_enabled = false` pour un coach — puis `completeOnboarding()`, puis `router.replace('/')`.

Le commentaire lignes 32-35 justifie le regroupement : « Pour V1 : on accepte le pacte coach + les CGU/RGPD en un seul flow. Le pacte coach contient déjà les engagements RGPD spécifiques au coach ». Le document de référence est `docs/juridique/06_PACTE_DE_COACHING.md`.

**Ce flux n'est atteignable par personne aujourd'hui** : aucun compte `role = 'coach'` en base. Deux comptes portent pourtant `coach_pact_accepted_at` : `6edd7f5c…` (l'ancien coach devenu `pilot`) et `88203298…` (l'actuel partenaire, ancien `admin`). Ce sont des résidus de rôles antérieurs — la colonne n'est jamais effacée à un changement de rôle.

---

### 8. L'espace admin — `app/(admin)/`, 29 écrans

#### 8.1 Ce que c'est

Le plus gros espace du dépôt après l'arbre pilote : 29 écrans, environ 8 300 lignes. Accent de rôle cyan (`#22D3EE`, déclaré `app/(admin)/index.tsx:20` avec un commentaire qui garde encore le mot « bronze » de la version précédente).

#### 8.2 Comment on y entre — et pourquoi c'est un problème

Recherche exhaustive sur `app/` et `src/` : **une seule référence de navigation** vers `/(admin)` existe, dans `src/components/SpaceSwitcher.tsx:27`. Ce composant ne s'affiche que si `profile.is_admin === true` (ligne 31-32) et n'est monté qu'à deux endroits :

- `app/(app)/index.tsx:193` — le hub pilote **v1** ;
- `app/(coach)/index.tsx:523` — le hub coach.

Or `app/index.tsx:107` envoie désormais le pilote sur `/(app2)`, l'arbre V2. Et `app/(app2)/` ne contient **aucun lien vers `/(app)/index`** : la seule ouverture vers l'arbre v1 est `app/(app2)/club/territoire.tsx:622` et `:629`, vers `creer-route` et `creer-trace`.

Le chemin d'accès réel, tel qu'il se lit dans le code, est donc :

`/(app2)` → onglet Club → Territoire → « créer une route » → `/(app)/creer-route` → la barre d'onglets v1 réapparaît (`app/(app)/_layout.tsx:38`, `shouldShowTabBar` ne la masque que pendant le roulage et le flux de capture) → onglet « Miroir » → `/(app)` → `SpaceSwitcher` → `/(admin)`.

Six gestes, en passant par un écran de création de route. **Il n'existe aucune entrée directe vers l'espace admin depuis l'application que le fondateur ouvre aujourd'hui.** Un lien profond `oxv:///(admin)` fonctionnerait vraisemblablement, la garde étant sur `is_admin`, mais je ne l'ai pas exécuté.

Le hub admin propose une sortie explicite : « Sortir de l'admin » → `router.replace('/(app2)')` (`app/(admin)/index.tsx:166`). **Il n'y a pas de bouton de déconnexion dans l'espace admin**, contrairement aux espaces partenaire et pro.

#### 8.3 Le hub

`app/(admin)/index.tsx` liste **21 entrées** (constante `VIEWS`, lignes 22-128), chacune avec un libellé et une description d'une ligne. Les 8 écrans restants ne sont pas listés : `index` lui-même, les cinq détails paramétrés (`coachs/[id]`, `evenements/[id]`, `evenements/nouveau`, `support/[id]`, `utilisateurs/[id]`), `analyse-session/[id]` (atteint depuis `qualite-data.tsx:143`) et `b2b-rapport` (atteint depuis `evenements/[id].tsx:257`).

#### 8.4 Inventaire écran par écran

Toutes les données sont réelles : chaque écran passe par un service qui interroge Supabase. Aucun jeu de données factice n'a été trouvé dans `app/(admin)/`.

| Écran | Lignes | Source de données | Lignes en prod | Écrit ? |
|---|---:|---|---:|---|
| `tour-controle.tsx` | 330 | `adminControlTowerService` → `events`, `event_registrations`, `telemetry_sessions` | 1 / 0 / 18 | non |
| `preparation.tsx` | 251 | `supabase.from('users').eq('role','pilot')` (ligne 51) | 11 | oui (promotion coach) |
| `en-cours.tsx` | 185 | `telemetry_sessions` où `status='recording'` (ligne 49) | 0 en cours | non |
| `devices.tsx` | 334 | `adminDevicesService` → `devices`, `device_assignments` | **0 / 0** | oui |
| `evenements.tsx` | 168 | `eventsService` → `events` | 1 | non |
| `evenements/[id].tsx` | 455 | `eventsService` + `adminDevicesService` | 1 | oui (statut, check-in) |
| `evenements/nouveau.tsx` | 276 | `eventsService.createEvent` | — | oui |
| `scan-checkin.tsx` | 161 | `expo-camera` + `setRegistrationStatus` → `event_registrations` | **0** | oui |
| `presences.tsx` | 264 | `attendanceService` → `sessions`, `registrations` (tables **site**) | 1 / 1 | oui (`attended_at`) |
| `qualite-data.tsx` | 298 | `adminQualityService` → `telemetry_sessions`, `app_session_analyses`, `data_quality_reports` | 18 / 13 / **0** | oui |
| `analyse-session/[id].tsx` | 366 | `adminSessionDiagnosticService` | — | relances serveur |
| `support.tsx` | 234 | `supportAdminService` → `support_tickets` | **0** | non |
| `support/[id].tsx` | 307 | `supportAdminService` → `support_messages` | **0** | oui |
| `moderation.tsx` | 243 | `moderationService` → `moderation_reports` | **0** | oui |
| `analytique.tsx` | 198 | `adminAnalyticsService` → 6 tables agrégées | — | non |
| `maintenance.tsx` | 200 | `appConfigService` → `app_config` | 1 | oui |
| `feature-flags.tsx` | 241 | `featureFlagsService` → `app_feature_flags` | 7 | oui |
| `circuit.tsx` | 618 | `HAUTE_SAINTONGE_TRACK` + `BELTOISE_CORNERS` + `app_segment_analyses` | **0** | non |
| `utilisateurs.tsx` | 224 | `adminUsersService.listUsers` → `users` | 14 | non |
| `utilisateurs/[id].tsx` | 326 | `adminUsersService` | 14 | oui (rôle, suspension, notes) |
| `coachs.tsx` | 243 | `coachAdminService.listCoaches` → `users` où `role='coach'` | **0** | oui (rétrogradation) |
| `coachs/[id].tsx` | 439 | `coach_pilots` | 1 | oui |
| `partenaires.tsx` | 222 | `partnerService` → `partner_accounts`, `partner_leads` | 2 / **0** | oui (validation) |
| `ambassadeurs.tsx` | 224 | `ambassadorService` → `ambassador_profiles` | **0** | oui |
| `sessions-media.tsx` | 523 | `sessionMediaService` + `expo-image-picker` → `session_media` | **0** | oui (upload) |
| `routes-certification.tsx` | 202 | `scenicRoutesService` → `scenic_routes` | 1 | oui |
| `points-carte.tsx` | 732 | `socialPingsService` → `social_pings` | **0** | oui |
| `b2b-rapport.tsx` | 255 | `b2bReportService` → `b2b_event_reports` | **0** | oui |

**Douze de ces écrans lisent une table vide en production.** Ils ne sont pas cassés — leur état « vide » est géré par `StateWrapper` — mais ils n'ont jamais eu de matière à afficher.

#### 8.5 Détails qui méritent d'être connus

**Préparation.** Le docblock annonce « données réelles à wirer avec une vraie session OXV (table `registrations`) ». Dans les faits (ligne 51-56), l'écran liste **tous** les comptes `role='pilot'`, triés par nom, plafonnés à 50, avec leur email et leur `kyc_status`. Ce n'est pas la liste des inscrits d'une session : c'est l'annuaire pilote. Le bouton de promotion « ↦ coach » ouvre une `Alert` de confirmation qui explique les conséquences avant d'agir (lignes 78-99).

**En cours.** Le docblock annonce « le live state vient des subscriptions Supabase Realtime […] à câbler ». C'est exact : l'écran fait une requête ponctuelle sur `telemetry_sessions.status = 'recording'`, avec un bouton de rechargement. **Il n'y a aucun abonnement temps réel.** Le titre affiche « N session(s) active(s) ».

**Inspecteur circuit.** L'écran est **codé en dur sur un seul circuit**, Haute Saintonge (`HAUTE_SAINTONGE_TRACK` de `src/trackviz/hauteSaintonge`, virages `BELTOISE_CORNERS` de `src/lib/circuitTopology`). La base contient pourtant quatre circuits : Haute Saintonge, Charente, La charade, Circuit Ricardo Tormo. Les trois autres n'ont pas d'inspecteur. La colorisation « par marge moyenne historique » repose sur `app_segment_analyses`, qui contient **0 ligne** : cette bascule n'a rien à colorer.

**Deux systèmes de présence en parallèle.** `scan-checkin.tsx` pointe `event_registrations.status = 'checked_in'` (via `setRegistrationStatus`), tandis que `presences.tsx` pointe `registrations.attended_at` — la table du **site**. Le docblock de `presences.tsx` l'assume : « Complémentaire du scan QR […] convergence au lot M4 ». Les deux tables ne se parlent pas. `event_registrations` est vide, `registrations` a une ligne.

**Maintenance.** L'écran écrit `app_config.maintenance_mode` et `min_supported_version`, lus par `src/components/MaintenanceGate.tsx` monté dans le layout racine (`app/_layout.tsx`). En production : `maintenance_mode = false`, `min_supported_version = null`, dernière modification le 29 juin 2026. Le coupe-circuit existe donc et n'a jamais été armé.

**Feature flags.** Sept drapeaux en base. Six sont éteints : `app_payments`, `coach_billing`, `convoys`, `founders`, `pilot_waivers`, `video_overlay`. Un seul est allumé : `biometry`, levé le 25 juillet 2026, avec une description qui note en clair ce qui reste dû : « Reste non tenu à la levée : smoke test 2 appareils reels. »

**Utilisateurs.** `setUserRole` (`src/services/adminUsersService.ts:117-123`) synchronise `is_admin` avec `role === 'admin'`. Les deux comptes `role='admin'` / `is_admin=false` de la base n'ont donc **pas** été créés par cet écran — ils viennent du site ou d'une écriture SQL directe. C'est la source de la divergence du §4.1.

**Scan de présence.** Le docblock note que « la caméra ne se teste que sur device → validation au build ». Aucune trace d'un tel test dans le dépôt. Le check-in manuel reste possible depuis `evenements/[id].tsx`.

---

### 9. L'espace partenaire — `app/(partner)/`, 8 écrans

#### 9.1 Qui y accède

Un seul compte en production : `88203298…`, `role = 'partner'`, créé le 9 mai 2026, passé de `admin` à `partner` le 7 juillet 2026. Il possède un `partner_accounts` nommé « OXV », type `autre`, statut `validated`.

Un second `partner_accounts` existe, « OXV · Administration », rattaché au compte du fondateur — qui est `role = 'pilot'`. Ce compte-là **ne peut pas ouvrir l'espace partenaire** (garde `role !== 'partner'`), alors qu'il détient une fiche partenaire validée. La fiche est visible ailleurs (lecture publique des comptes `validated`), pas son tableau de bord.

Le partenaire est redirigé vers `/(partner)` **avant** toute vérification d'onboarding (`app/index.tsx:84-86`). Il n'a signé ni CGU ni pacte via l'application.

#### 9.2 Les écrans

**`index.tsx` (267 lignes) — tableau de bord.** Charge en parallèle le compte, les offres, les leads et les partenariats d'événement. Affiche le statut du compte avec trois libellés explicites (lignes 36-40) : « En attente de validation OXV », « Compte validé », « Compte désactivé ». Puis les compteurs : offres publiées, nouveaux leads. Sept cartes de navigation (lignes 134-181) et un lien « Se déconnecter » (lignes 211-219).

**`profil.tsx` (284 lignes) — ma fiche.** Le partenaire édite sa zone géographique et sa description. Le nom, le type et le statut restent gérés par OXV : le docblock le dit, et la RLS le confirme (`oxv_partner_accounts_validation_gate` empêche l'auto-validation).

**`offres.tsx` (462 lignes) — mes offres.** Création, édition, publication, archivage. Champs : titre, description, prix en euros, quota, catégorie, date de validité, conditions, image. **Le prix est affiché, jamais encaissé** — le docblock l'énonce, et le drapeau `app_payments` est éteint. En production : 1 offre, « PASS », 390 €, statut `draft`. Le déclencheur `oxv_partner_offers_publish_gate` fait retomber toute tentative de publication par un non-admin en `draft`, et repasse en `draft` toute offre publiée qui serait modifiée. L'offre existante est donc en attente d'une validation admin, conformément au dispositif.

**`leads.tsx` (432 lignes) — mes leads.** Suivi d'un statut commercial sur cinq valeurs : `new`, `contacted`, `booked`, `lost`, `archived`. Le docblock est catégorique : « ne voit JAMAIS la télémétrie ni l'identité du pilote […] Le contact réel passe par OXV ». La RLS `partner_leads_select` autorise le propriétaire du compte, l'admin, et le pilote concerné — jamais un coach. **0 lead en production.**

**`performance.tsx` (230 lignes) — agrégats.** Dérivés des leads et des offres, sans nouvelle table et sans donnée pilote. Le docblock exclut explicitement tout classement entre partenaires. Sans lead ni offre publiée, l'écran n'a rien à agréger aujourd'hui.

**`point.tsx` (530 lignes) — mon point sur la carte.** Le plus riche des écrans partenaire. Le partenaire validé crée son point sur La carte OXV : titre, catégorie, adresse, position par géolocalisation de l'appareil ou saisie manuelle, description. L'insertion porte `partner_id` et la RLS force `is_published = false` : le point part « En attente de validation OXV », l'admin le publie depuis `app/(admin)/points-carte.tsx`. Toute modification repasse par la validation. Un partenaire non validé voit un état explicatif. **`social_pings` contient 0 ligne : ce cycle complet n'a jamais été parcouru.**

**`rapports.tsx` (132 lignes) — mes rapports B2B.** Lecture seule des rapports d'événement partagés par OXV : participation agrégée, temps forts média, conclusion. Aucune donnée pilote individuelle. **`b2b_event_reports` contient 0 ligne.**

**`facturation.tsx` (104 lignes) — un espace réservé honnête.** Ce n'est pas une fausse facture : le docblock (lignes 3-8) dit franchement qu'« OXV n'encaisse rien dans l'app pour l'instant », que le paiement Stripe viendra dans une phase dédiée, et l'écran explique comment résilier. C'est le bon comportement quand la fonction n'existe pas.

#### 9.3 La règle cardinale

« Le partenaire ne voit jamais la télémétrie » n'est pas seulement une phrase de docblock. Elle est codifiée dans `src/__tests__/rls/roleMatrixRLS.test.ts:30-44`, qui vérifie qu'un client authentifié comme partenaire lit zéro ligne dans `telemetry_sessions` et `telemetry_frames`. Ce test ne s'exécute que si les secrets Supabase de test sont fournis (§4.3). Côté base, aucune policy de `telemetry_sessions` ou `telemetry_frames` ne mentionne `is_partner()` : la garantie tient structurellement.

---

### 10. L'espace pilote professionnel — `app/(pro)/`, 7 écrans

#### 10.1 Personne n'y accède

**Zéro compte `role = 'pro_pilot'` en production.** L'espace est complet, testé unitairement pour sa navigation (`src/lib/__tests__/proNav.test.ts` vérifie que chaque fichier de `app/(pro)` a bien une zone d'onglet), et n'a jamais été ouvert.

Le rôle est pourtant prévu partout : dans l'énumération Postgres (`user_role`), dans `USER_ROLES` (`src/services/adminUsersService.ts:19`, libellé « Pilote pro »), dans le type `UserRole` du store, et dans le type `oxv_demande_type` de la base (`pilote_pro`). Un admin peut l'attribuer depuis `app/(admin)/utilisateurs/[id].tsx`.

#### 10.2 La navigation

`app/(pro)/_layout.tsx` pose une barre d'onglets **distincte** de celle du pilote, définie dans `src/lib/proNav.ts` : PADDOCK, PERFORMANCE, MÉDIA, ÉQUIPE, PARTAGE. Le fichier rappelle deux invariants (lignes 6-8) : « Compte = icône haut-droite, JAMAIS un onglet », et « L'or est interdit sur la nav ».

Point notable : **les outils de données du pro pointent vers l'arbre pilote v1**, pas vers V2. `app/(pro)/index.tsx:30-34` renvoie vers `/(app)/bilan`, `/(app)/data-lab`, `/(app)/passeport`, `/(app)/signature`, `/(app)/garage` ; `app/(pro)/performance.tsx:34,39` vers `/(app)/comparateur` et `/(app)/progression`. Ces sept routes existent bien dans `app/(app)/`. Mais quitter `(pro)` pour `(app)` fait disparaître la barre pro et apparaître la barre pilote v1 : la navigation change de langage en cours de route.

#### 10.3 Les écrans

**`index.tsx` (309 lignes) — Paddock Pro.** Hub contextuel : dernière séance avec sa régularité au tour, circuits fréquentés, accès aux six outils ci-dessus, lien vers la candidature ambassadeur, bouton « Se déconnecter » (lignes 197-205).

**`performance.tsx` (223 lignes).** Agrégats de séances, circuits, tours, distance, régularité par circuit, puis trois outils de comparaison. Le docblock exclut explicitement « aucune tendance prédictive, aucun classement, aucun conseil de pilotage ».

**`bibliotheque.tsx` (315 lignes).** Recherche multi-critères dans les séances passées, par circuit et par période, paginée par 20. Tri chronologique par défaut, « jamais un classement "meilleure séance" ».

**`media.tsx` (115 lignes).** Regroupe les médias OXV du pilote. Rien n'y est exposé publiquement ; la mise en vitrine se décide dans Partage.

**`partage.tsx` (406 lignes).** Vitrine publique **opt-in**. Le pilote crée un lien à jeton et choisit métrique par métrique ce qu'il expose, via une liste blanche `SHAREABLE_METRICS` (`src/services/sharesService.ts:21`). Jamais de télémétrie brute, jamais de classement, jamais les données d'un autre pilote. Lien révocable. Table `app_progression_shares` : **1 ligne** en production — c'est la seule surface « pro » qui a une trace, et elle est partagée avec l'espace pilote.

**`equipe.tsx` (237 lignes).** Le pro déclare coach, préparateur, assistant. Le docblock est explicite : « déclarer un membre ne lui donne AUCUN accès à vos données — c'est une liste, pas un partage ». Table `pro_team_members` : **0 ligne**.

**`ambassadeur.tsx` (219 lignes).** Candidature + bio ; OXV valide le statut. « Un rôle factuel, jamais un rang ni un classement. » Table `ambassador_profiles` : **0 ligne**. L'écran admin correspondant (`app/(admin)/ambassadeurs.tsx`) n'a donc rien à traiter.

---

### 11. Le langage visuel : deux applications dans une

C'est une différence structurelle, pas cosmétique. Le dépôt contient **deux systèmes de composants** :

| | Kit historique | Kit NG / refonte |
|---|---|---|
| Thème | `src/theme/v2.ts` | `src/ui/v2/tokens.ts` |
| Composants | `src/ui/AppBar.tsx`, `Card.tsx`, `Screen.tsx`, `Field.tsx`, `StateWrapper.tsx`… | `src/ui/v2/` (`PressScale`, `ListRow`, `Sheet`, `Dial`, `StateView`, `TabBar`…) |
| Police de titre | `HankenGrotesk_600SemiBold` (`src/theme/v2.ts:68`) | `Michroma_400Regular` (`src/ui/v2/tokens.ts:56`) |
| Police monospace | `JetBrainsMono_400Regular` | `JetBrainsMono_500Medium` |

Recherche des fichiers important `@/ui/v2` sous `app/` : uniquement `app/(app2)/…` et `app/(coach)/…`.

**Les six espaces de cette section — admin, partenaire, pro, authentification, onboarding pilote, onboarding coach — sont tous sur le kit historique.** Ils n'ont pas été repris par la refonte. Concrètement, un administrateur ou un partenaire ouvre une application dont la typographie et les composants diffèrent de ceux que voit le pilote.

Dernier commit substantiel par espace (le commit `29e34f9` du 26 juillet ne fait que changer une cible de redirection d'une ligne dans quatre layouts) :

- `app/(pro)/` : `328b568`, 29 juin 2026.
- `app/(auth)/` : `2b515ad`, 4 juillet 2026.
- `app/(onboarding)/` : `73f2c19`, 5 juillet 2026.
- `app/(coach-onboarding)/` : `7cf3f34`, 5 juillet 2026.
- `app/(admin)/` et `app/(partner)/` : `0e701b1`, 17 juillet 2026.

---

### 12. Ce qui est destiné au web plutôt qu'à l'application

Le dépôt contient une décision écrite sur ce sujet : `docs/refonte-app/18_APP_VS_WEB.md` (181 lignes, commit `5bc19de`), statut « cadrage, avant code ». Sa phrase de répartition :

> Le site fait venir et fait payer. Le mobile fait vivre la journée et lire la session. Le web fait tourner les opérations et le business.

Ce que ce document tranche, appliqué aux écrans qui existent réellement aujourd'hui :

**À migrer vers le portail web (§1.2 et §1.4 du document) — tout l'espace partenaire.**
Les huit écrans de `app/(partner)/` sont, selon ce cadrage, du ressort du portail web : « L'app mobile ne crée ni n'édite aucune fiche partenaire. Elle consomme l'annuaire. » Le §4 est plus net encore : « Aucune création/édition de fiche partenaire », « Aucun CRM / gestion de leads partenaires ». Le tableau §2 place le compte Partenaire à « — » sur la colonne App mobile.

Il y a ici un **écart entre le cadrage et le code** : le document parle d'un espace `(partner)` « net-neuf » à construire côté web, adossé à une table `partners` (0 ligne en base). L'application, elle, a déjà construit `app/(partner)/` en mobile, sur `partner_accounts` (2 lignes), `partner_offers` (1 ligne) et `partner_leads` (0 ligne). Le document décrit un futur qui existe déjà ailleurs qu'où il l'attendait.

**À migrer vers le web — l'admin lourd.**
Le document distingue l'« admin terrain le jour J » (à garder en mobile) de l'« admin lourd » (à construire en web). Rapporté aux 29 écrans :

- *Restent mobiles, terrain* : `tour-controle`, `preparation`, `en-cours`, `scan-checkin`, `presences`, `devices`, `sessions-media`, `circuit`.
- *Vont au web* : `qualite-data` et `analyse-session/[id]` (le §3 les note « ○ mobile / ● web »), `analytique` et `b2b-rapport` (« Aucun reporting / dashboard business lourd »), `partenaires` et `ambassadeurs` (validation administrative longue), `evenements/nouveau` et `evenements/[id]` (« Aucune création d'événement track day » — §4.3), `utilisateurs` et `utilisateurs/[id]`, `support` et `support/[id]`, `moderation`, `routes-certification`, `feature-flags`, `maintenance`.

**Restent au mobile, sans ambiguïté** : l'authentification, l'onboarding pilote, l'onboarding coach, et l'espace coach. Le §1.3 est explicite : « le profil coach reste éditable en mobile (usage terrain). Aucun "espace pro coach" web n'est requis en V1. »

**L'espace pilote pro n'est pas traité par ce document.** Il n'apparaît ni dans le tableau des quatre comptes (§2 : Pilote, Coach, Admin, Partenaire), ni dans le tableau Fonction × Canal. Sept écrans construits, zéro compte, zéro cadrage. C'est le point le plus flou de cette section.

**Ce qui n'entrera jamais dans le mobile**, selon le §4 du même document : aucun formulaire de carte bancaire (motif explicite : commissions de store d'environ 30 % et conformité PCI), aucune création d'événement, aucun reporting comptable, aucune validation administrative longue. Le drapeau `app_payments = false` en base est cohérent avec cette ligne.

---

### 13. Ce qui n'a jamais été observé en fonctionnement

Liste des affirmations que je **ne peux pas** faire, faute d'exécution ou faute de données :

- Aucun écran de ces six espaces n'a été rendu. Tout ce qui précède décrit le code, pas l'écran.
- L'espace `app/(pro)/` n'a jamais été ouvert : aucun compte n'a le rôle qui y donne accès.
- L'espace `app/(coach-onboarding)/` n'a jamais été ouvert : aucun compte `coach` n'existe.
- Les deux comptes `role='admin'` n'ont jamais pu ouvrir `app/(admin)/` : ils échouent la garde `is_admin`.
- Douze écrans admin lisent une table vide : `devices`, `scan-checkin` (`event_registrations`), `qualite-data` (`data_quality_reports`), `support`, `support/[id]`, `moderation`, `coachs`, `ambassadeurs`, `sessions-media`, `points-carte`, `b2b-rapport`, et la heatmap de `circuit` (`app_segment_analyses`).
- La caméra de `scan-checkin.tsx` ne peut pas être testée hors appareil ; aucune trace de validation sur device dans le dépôt.
- L'appairage par code (`lier.tsx`) a une seule tentative enregistrée, le 3 juillet 2026 ; je ne sais pas si elle a abouti. Aucun code n'est actif.
- Le coupe-circuit de maintenance n'a jamais été armé (`maintenance_mode = false` depuis le 29 juin 2026).
- Le cycle complet « partenaire crée un point → admin le valide → il apparaît sur La carte » n'a jamais été parcouru (`social_pings` vide).
- Les tests RLS qui codifient la séparation partenaire / télémétrie sont sautés si les secrets de test manquent ; je n'ai pas pu vérifier l'état des secrets GitHub.

---

### 14. Points à trancher

Neuf constats, classés par ce qu'ils coûtent s'ils restent en l'état.

1. **`users.is_admin` est modifiable par son propriétaire.** Privilège `UPDATE` accordé à `authenticated` sur la colonne, policy `users_update_own_or_admin` permissive, aucun déclencheur de garde. `guard_users_privileged_columns` couvre `role` et `kyc_status`, pas `is_admin`. Lecture seule, non testé.
2. **Deux comptes `role='admin'` sont administrateurs en base mais pas dans l'application.** La garde client teste `is_admin`, la base teste `role='admin' OR is_admin`. À aligner dans un sens ou dans l'autre.
3. **Valider une demande d'inscription pilote peut rétrograder un administrateur.** `admin_review_demande` écrit `role` par correspondance d'email. C'est arrivé le 20 juillet 2026 sur le compte du fondateur.
4. **La suspension d'un compte n'a aucun effet.** `suspended_at` est écrit, jamais lu, jamais dans une policy.
5. **L'espace admin n'a plus d'entrée directe.** Six gestes en passant par l'arbre v1 et un écran de création de route. Le `SpaceSwitcher` vit encore dans `app/(app)/index.tsx`, que le pilote n'atteint plus.
6. **Le partenaire n'accepte aucun document.** `app/index.tsx:84` court-circuite l'onboarding pour ce rôle. Aucune CGU, aucune politique de confidentialité, aucun pacte.
7. **Les CGU sont acceptées sans être lisibles.** L'écran de consentement ne propose aucun lien vers les documents embarqués, qui n'existent qu'après l'onboarding.
8. **`ai_debrief_enabled` vaut `true` par défaut en base** alors que l'application le pose à `false`. Treize comptes sur quatorze sont à `true` sans avoir jamais coché la case.
9. **Sept écrans pro construits pour un rôle sans titulaire ni cadrage.** À arbitrer : les activer, ou les retirer.

---

## Le langage visuel et l'accessibilité

### Avertissement de méthode

Tout ce qui suit est une **lecture du code source**, pas une observation de
l'application en fonctionnement. Aucun écran n'a été affiché, aucun appareil
n'a été branché, aucun geste n'a été effectué. Quand j'écris « le point
pulse » ou « la barre s'efface », je décris ce que le code demande à
React Native de faire, pas ce que j'ai vu.

Trois choses seulement ont été **exécutées**, toutes en lecture :

- la suite de tests du kit et du contraste
  (`npx jest src/theme/__tests__/contrastTokens.test.ts src/ui/v2/__tests__`) —
  **153 tests, 8 suites, tous au vert** ;
- le scanner d'accessibilité (`scripts/check-accessibility.ts`) — **0 défaut
  sur 222 fichiers** ;
- le scanner doctrinal (`scripts/check-doctrine.ts`) — **75 signalements,
  sortie en échec** (détail plus bas).

J'ai également recalculé moi-même, hors du dépôt, les rapports de contraste
WCAG 2.1 de chaque couleur de texte sur chaque fond où elle peut se poser.
Les chiffres cités dans ce chapitre sont ces mesures, pas des estimations.

Ce que je **n'ai pas pu** établir : le rendu réel des polices sur écran
Retina, la fluidité effective des animations, la perception du blur iOS
face au repli opaque Android, ce que VoiceOver **prononce** réellement
(j'ai lu les libellés fournis, pas écouté la synthèse), et la lisibilité en
plein soleil sur circuit.

---

## Deux systèmes visuels cohabitent — et un troisième, plus discret

### Le décompte

L'arbre `app/` contient **222 fichiers d'écran**. Ils se répartissent ainsi :

| Espace | Fichiers | Système visuel |
|---|---|---|
| `app/(app2)` — pilote V2 | 38 | kit DA Instrument |
| `app/(app)` — pilote historique | 83 | ancien système |
| `app/(coach)` | 37 | ancien système |
| `app/(admin)` | 30 | ancien système |
| `app/(partner)` | 9 | ancien système |
| `app/(pro)` | 8 | ancien système |
| `app/(onboarding)` | 7 | ancien système |
| `app/(coach-onboarding)` | 4 | ancien système |
| `app/(auth)` | 3 | ancien système |

Vu du côté des imports : **50 fichiers** importent `@/ui/v2` (le nouveau
kit), **274 fichiers** importent `@/theme/v2` (l'ancien).

### La séparation est propre

C'est le fait le plus rassurant de ce chapitre. Les **38 fichiers** de
`app/(app2)` importent tous `@/ui/v2`, et **aucun** n'importe `@/theme/v2`.
Le kit lui-même (`src/ui/v2/`) n'importe rien de `src/theme/` ni de
`src/components/`. L'isolation est explicite et documentée :

> `src/ui/v2/tokens.ts:4-6` — « Périmètre : arbre `app/(app2)` et kit
> `src/ui/v2/` UNIQUEMENT. Les espaces v1 (pilote actuel, coach, admin,
> partner, pro) restent sur `src/theme/v2.ts` jusqu'à la bascule V2-L6. »

Il n'y a donc **pas de mélange à l'intérieur d'un écran**. Un écran est
entièrement dans un système ou entièrement dans l'autre.

### Le pilote est déjà passé au nouveau système

`app/index.tsx:103-107` route désormais le pilote vers l'arbre V2 :

```
// Lot L6 — le pilote arrive désormais dans l'arbre V2. L'arbre v1 reste en
// place et atteignable : (app2) y renvoie encore volontairement pour trois
// écrans non portés (planificateur de route, import de tracé, carte trophée).
return <Redirect href={'/(app2)' as never} />;
```

Le garde de build qui rendait `(app2)` inaccessible en production a été
retiré (`app/(app2)/_layout.tsx:63-67`). Concrètement : **un pilote qui
ouvre l'application aujourd'hui voit le kit DA Instrument**. Le coach,
l'administrateur, le partenaire et le pilote professionnel voient l'ancien.

### Le troisième système

Il existe un troisième jeu de jetons, plus discret, déclaré dans
`src/theme/v2.ts:143-165` sous le nom `lotProfilTokens`. Il porte sa
propre palette (`noir #0A0A0A`, `surface #141414`, `ligne #262626`) et ses
propres polices (**Syncopate** en display, **Inter** en corps). Il est
utilisé par **10 fichiers** : trois écrans de l'ancien arbre pilote
(`app/(app)/profil.tsx`, `app/(app)/profil-edition.tsx`,
`app/(app)/cartes.tsx`) et sept composants
(`src/components/profil/*`, `src/components/cartes/*`).

Ce lot a ses propres règles, contradictoires avec celles des deux autres :
l'or Heritage y est **interdit**, et les écarts de temps y sont en gris
neutre (`deltaNeutre #D6D6D6`) « jamais un jugement »
(`src/theme/v2.ts:139-141`).

Si l'on compte les familles typographiques de titre, il n'y a donc pas deux
langages mais **trois** : Michroma (V2), Hanken Grotesk (v1), Syncopate
(lot profil).

---

## Ce qui distingue les deux systèmes principaux

| | Kit DA Instrument (`src/ui/v2/`) | Ancien système (`src/ui/`, `src/theme/v2.ts`) |
|---|---|---|
| Fond de base | `#14151A` (titane froid) | `#0B0B0D` (noir quasi pur) |
| Fond de carte | `#1B1D24` / `#232630` | `#111113` / `#141416` / `#16161A` |
| Accent | rouge de marque `#C8102E` | crème `#F5F5F7` (boutons), or `#FFB703` (donnée) |
| Titre | Michroma | Hanken Grotesk |
| Corps | Inter | Hanken Grotesk |
| Données | JetBrains Mono | JetBrains Mono |
| Rendu graphique | Skia (`@shopify/react-native-skia`) | SVG (`react-native-svg`) |
| Animation | Reanimated, worklets UI thread | mélange Reanimated / `Animated` RN |
| Rayons | 12 / 18 / 24 px | 6 / 10 / 12 / 14 / 18 px |
| Chargement | Shimmer aux formes du contenu | barres grises statiques |
| État vide | tracé de circuit qui se dessine | encadré texte |
| Cadran | oui (`Dial`, un par écran) | non |
| Haptique | vocabulaire fermé de 5 mots | 4 fonctions libres |

La différence de **matière** est la plus visible : le nouveau système est
titane et froid (bleuté : sur ses gris, R = G−4 et B = G+14), l'ancien est
noir et neutre (R = G, B = G+8). Les deux fonds ne sont pas le même noir.

Une troisième valeur existe encore : `app.json:13` et `app.json:58` fixent
le fond du splash natif et de l'icône adaptative Android à **`#050505`**,
qui n'est le fond ni de l'un ni de l'autre système. Il y a donc, en théorie,
une marche de couleur au démarrage entre l'écran de lancement natif et le
premier écran React Native. Je ne l'ai pas observée.

---

## La palette : ce que chaque couleur a le droit de signifier

### Les fonds et les surfaces

**Kit V2** (`src/ui/v2/tokens.ts:21-22`) :

| Jeton | Valeur | Emploi déclaré |
|---|---|---|
| `bg.base` | `#14151A` | fond d'écran |
| `bg.card` | `#1B1D24` | carte |
| `bg.card2` | `#232630` | tuile interne, chip active |
| `bg.scrim` | `rgba(10,11,14,0.72)` | **uniquement** sur photo |
| `border.card` | `#2A2D38` | bordure de carte |
| `border.strong` | `#3A3E4C` | bordure appuyée, graduations |
| `border.hairline` | `#22242C` | filet, grille de radar |

Le commentaire d'en-tête pose une règle anti-dégradé : `bg.scrim` est la
**seule exception autorisée**, réservée à la lisibilité d'un texte posé sur
une photo (`src/ui/v2/tokens.ts:16-17`).

**Ancien système** (`src/theme/v2.ts:8-12`) : `night #0B0B0D`,
`card #111113`, `card2 #141416`, `surface3 #16161A`. Les filets sont
`line #1E1E22`, `cardBorderProminent #232326`, `separator #17171A`,
`borderHair #1A1A1D`, plus un `edge rgba(255,255,255,0.20)` réservé à
l'état sélectionné.

Mesures de contraste des bordures V2 sur `bg.card` : `border.card` **1,23**,
`border.strong` **1,58**. Ce sont des filets, pas des porteurs
d'information ; WCAG demande 3,0 pour un élément d'interface qui porte du
sens à lui seul. Une bordure qui distingue une chip active d'une chip
inactive tombe dans ce cas. Le point n'est pas couvert par un test.

### Les gris de texte

Le 25 juillet 2026, les gris les plus faibles ont été relevés sur décision
du fondateur (« on assouplit »). C'est le seul geste d'accessibilité du
dépôt qui soit chiffré, documenté et verrouillé par un test.

**Kit V2** — mesures sur le pire des trois fonds (`src/ui/v2/tokens.ts:44`) :

| Jeton | Valeur | Contraste | Avant le 25/07 |
|---|---|---|---|
| `text.hi` | `#E8E9ED` | **12,44** | inchangé |
| `text.mid` | `#A9ADBB` | **6,74** | inchangé |
| `text.low` | `#9195A3` | **5,05** | `#7A7E8C` → 3,73 |
| `text.dim` | `#787C8A` | **3,63** | `#5A5E6C` → 2,34 |

**Ancien système** — mesures sur le pire des cinq fonds
(`src/theme/v2.ts:13-28`) :

| Jeton | Valeur | Contraste |
|---|---|---|
| `cream` | `#F5F5F7` | **14,39** |
| `creamSoft` | `#E5E5E8` | **12,47** |
| `secondary` | `#C9C9CE` | **9,50** |
| `creamMute` | `#9A9AA3` | **5,62** |
| `legend` | `#8A8A92` | **4,58** |
| `eyebrow` | `#898991` | **4,52** (était `#6E6E76` → 3,10) |
| `faint` | `#797981` | **3,63** (était `#55555C` → 2,12) |

Le commentaire du code assume l'arbitrage : `dim` et `faint` restent sous
4,5 parce que les porter plus haut les collerait au palier supérieur et
effacerait la hiérarchie (`src/ui/v2/tokens.ts:37-39`). Ils sont
« réservés au texte secondaire et aux états inactifs, jamais à une
information essentielle isolée ». Cette réserve est une **convention
d'écriture**, pas une contrainte technique : rien n'empêche un futur écran
de poser une information capitale en `dim`.

**Le lot Profil n'a pas eu ce relèvement.** `lotProfilTokens.grisSombre`
(`#555555`, `src/theme/v2.ts:151`) mesure **2,47** sur `surface #141414` et
**2,29** sur `surface2 #1C1C1C`. Il est utilisé 15 fois, dont **trois fois
comme couleur de placeholder de saisie** (`app/(app)/profil.tsx:361`,
`app/(app)/profil-edition.tsx:189` et `:217`). Un texte de placeholder à
2,3:1 sur fond sombre est illisible pour une part importante des
utilisateurs. Le test de contraste ne couvre pas ces jetons.

### Le rouge

Il y a **deux rouges**, et la distinction est doctrinale.

- **Rouge de marque `#C8102E`** — `palette.red` (`src/theme/v2.ts:36`) et
  `colors.accent` (`src/ui/v2/tokens.ts:23`). Même valeur des deux côtés.
  La règle écrite : insigne, bande coach, point d'enregistrement. Jamais
  un statut, jamais une marge (`docs/refonte-app/REGLES_COULEUR.md:8`).
- **Rouge de donnée `#E63946`** (V2) / `#F65B5B` (v1) — le freinage, par
  convention télémétrique.

Deux dérivés côté coach : `coachAccent #E23A4E` (boutons, liserés) et
`coachAlert #E2685A` (lien « retirer l'accès »).

**Le rouge de marque contraste mal.** Mesures : **2,86** sur `bg.card`,
**3,10** sur `bg.base`, **3,21** sur `card` de l'ancien système. C'est en
dessous du seuil texte (4,5) et, sur carte, en dessous du seuil élément
d'interface (3,0).

Or, dans le kit V2, ce rouge n'est pas qu'un liseré :

- il **remplit** l'arc de progression du cadran (`src/ui/v2/Dial.tsx:148`) ;
- il colore les **millièmes du chrono** dans `RollingCounter`
  (`src/ui/v2/motion/RollingCounter.tsx:101`, `accentColor = colors.accent`),
  utilisé par `ChronoHero` avec `accentMillis`
  (`src/ui/v2/ChronoHero.tsx:70`) ;
- il forme le cercle du bouton central en mode enregistrement
  (`src/ui/v2/CentralButton.tsx:130`).

Le chiffre le plus fin du chrono — les millièmes — est donc posé en rouge à
**2,86:1** quand le chrono est sur une carte. Aux grandes tailles (le
`ChronoHero` monte à 56 px, `src/ui/v2/uiLogic.ts:38-42`) le seuil
applicable est 3,0, et il n'est pas tenu sur fond de carte. À la petite
taille (22 px) le seuil est 4,5, et il ne l'est pas non plus.

Point positif : le texte blanc posé **sur** le rouge (le libellé du bouton
central) mesure **4,85** — celui-là passe.

### L'or : trois ors, et trois lois qui ne disent pas la même chose

C'est le point le plus embrouillé de la palette. Il y a trois valeurs d'or
dans le dépôt et **trois règles distinctes** selon le fichier consulté.

| Valeur | Jeton | Règle écrite | Où |
|---|---|---|---|
| `#FFB703` | `palette.gold` | « CHRONO / RECORD / RYTHME UNIQUEMENT (jamais une donnée QDI) » | `src/theme/v2.ts:34` |
| `#FFB703` | `colors.qdi.fluidite` | teinte de la branche Fluidité — donc **une donnée QDI** | `src/ui/v2/tokens.ts:48` |
| `#C4A459` | `palette.heritageGold` / `colors.heritage.gold` | « tier Heritage EXCLUSIVEMENT » | `src/theme/v2.ts:39`, `src/ui/v2/tokens.ts:11` |
| `#D9AE00` | `palette.goldText` | or lisible sur fond clair | `src/theme/v2.ts:35` |

Les deux premières lignes sont la **même valeur hexadécimale** avec deux
lois opposées. L'ancien système réserve `#FFB703` au chrono et l'interdit
formellement aux données QDI ; le kit V2 en fait précisément la couleur
d'une donnée QDI. Un pilote qui passerait d'un écran à l'autre verrait la
même teinte signifier deux choses différentes.

**Dans le kit V2, le chrono n'est plus doré du tout.** La célébration de
record (`src/ui/v2/motion/RecordFlash.tsx:60`) pulse vers
`colors.heritage.gold` `#C4A459` — l'or Heritage — alors que le
commentaire du même fichier des jetons dit que cet or est réservé au tier
Heritage et « jamais un chrome générique »
(`src/ui/v2/tokens.ts:11`). Un record personnel n'est pas une offre
commerciale. La contradiction est interne au kit.

**Dans l'ancien système, la règle « l'or ne colore que de la donnée » n'est
pas tenue.** `palette.gold` compte **142 références** dans le dépôt. Parmi
elles, des emplois qui ne sont pas de la donnée :

- barre de progression d'onboarding : `app/(onboarding)/index.tsx:45`,
  `app/(onboarding)/cgu.tsx:75`, `app/(onboarding)/doctrine.tsx:39`,
  `app/(onboarding)/methode.tsx:46`, `app/(onboarding)/niveau.tsx:79`,
  `app/(onboarding)/pacte.tsx:63` ;
- fond de bouton de modale d'erreur : `src/components/BleErrorModal.tsx:77`,
  `src/components/ErrorBoundary.tsx:72`, `src/components/UpdateModal.tsx:97` ;
- bandeau hors ligne : `src/components/OfflineBanner.tsx:33` ;
- bordure de champ au focus, côté coach : `app/(coach)/lecture.tsx:295` ;
- bordure de sélection de date : `app/(coach)/roulages/nouveau.tsx:456` ;
- filet décoratif à gauche du pied doctrinal : `src/ui/DoctrineFooter.tsx:20` ;
- couleur de statut administratif « en cours » :
  `app/(admin)/moderation.tsx:45`.

Aucun de ces sept cas n'est un chiffre, une jauge, une courbe ou un point
de mesure. La règle existe, elle est écrite noir sur blanc dans
`docs/refonte-app/REGLES_COULEUR.md:7`, et le code s'en écarte
régulièrement. Aucun test ni scanner ne la vérifie.

Contraste de l'or : `#FFB703` mesure **10,80** sur carte, `#C4A459`
**7,91**, `#D9AE00` **8,99**. La lisibilité n'est pas le problème ; la
sémantique l'est.

### Les teintes QDI

Cinq branches, une couleur fixe par branche, « une couleur = une donnée ».
Mais les deux systèmes ne s'accordent sur **aucune** des cinq valeurs.

| Branche | Kit V2 (`src/ui/v2/tokens.ts:46-52`) | contraste | Ancien (`src/theme/v2.ts:49-55`) | contraste |
|---|---|---|---|---|
| Trajectoire | `#60A5FA` | 6,62 | `#4F9DF7` | 6,73 |
| Fluidité | `#FFB703` | 9,64 | `#F2CE3B` | 12,27 |
| Freinage | `#E63946` | **4,04** | `#F65B5B` | 5,90 |
| Accélération | `#4ADE80` | 9,66 | `#4FC98A` | 9,03 |
| Régularité | `#C084FC` | 6,37 | `#A783F2` | 6,44 |

Le freinage V2 à **4,04** est sous le seuil texte. Dans le radar, cette
couleur ne porte qu'un point de 5 px de rayon
(`src/ui/v2/RadarQdi.tsx:50`), donc pas du texte — mais dans `PillarBar`
elle remplit la barre, et dans les écrans elle peut colorer un libellé.

Le kit V2 impose une discipline que l'ancien n'a pas : dans `RadarQdi`, les
couleurs QDI vivent **uniquement sur les sommets** ; la grille, les axes et
le polygone sont en jetons neutres (`src/ui/v2/RadarQdi.tsx:11-13` et
`:128`, `:139`, `:151`). Dans l'ancien `QdiBars`
(`src/ui/QdiBars.tsx:81-84`), les libellés eux-mêmes sont colorés, en
**8,5 px**.

Un détail doctrinal bien tenu des deux côtés : une branche **non mesurée**
est masquée, pas tirée à zéro. `radarLayout`
(`src/ui/v2/vizMath.ts:134-140`) ignore la branche : ni axe, ni point, ni
sommet de polygone. `QdiBars` la rend en gris à 3 % de hauteur, « la
COULEUR distingue mesuré/absent, pas la hauteur »
(`src/ui/QdiBars.tsx:57-60`).

### La rampe de vitesse

`speedHeat` (`src/theme/v2.ts:61`) : bleu `#4F9DF7` → cyan `#3FD0D8` →
vert `#4FC98A` → jaune `#F2CE3B`. **Sans or ni rouge**, par construction :
« la vitesse n'est ni un chrono/record (or) ni une alarme (rouge) ». C'est
une source unique partagée par la carte, la carte de chaleur et leurs
légendes, pour qu'elles ne divergent pas. Contrastes sur fond `night` :
7,02 / 10,51 / 9,41 / 12,80. Aucun équivalent dans le kit V2.

### Les couleurs de rôle

`roleColors` (`src/theme/v2.ts:90-95`) : pilote `#F5F5F7` (crème neutre),
coach `#C8102E` (rouge de marque), partenaire `#5B8DEF` (6,09),
administrateur `#22D3EE` (10,88). Règle : ce sont des couleurs de
**navigation et de badge**, jamais de la donnée. Le pilote reste
volontairement neutre. Le kit V2 n'a pas de couleurs de rôle — l'arbre
`(app2)` est mono-rôle.

### La documentation normative a divergé du code

`docs/refonte-app/REGLES_COULEUR.md` se présente comme « référence
normative » et affirme en tête : « Valeurs = `src/theme/v2.ts` ». Ce n'est
plus vrai. Comparaison ligne à ligne :

| Jeton | Doc `REGLES_COULEUR.md` | Code `src/theme/v2.ts` |
|---|---|---|
| `night` | `#050505` (ligne 15) | `#0B0B0D` (ligne 8) |
| `card` | `#0B0B0D` (ligne 16) | `#111113` (ligne 10) |
| `card2` | `#121214` (ligne 17) | `#141416` (ligne 11) |
| `cream` | `#F8F9FA` (ligne 23) | `#F5F5F7` (ligne 13) |
| `eyebrow` | `#6E6E76` (ligne 27) | `#898991` (ligne 26) |
| `faint` | `#54545C` (ligne 28) | `#797981` (ligne 27) |
| `green` | `#97C459` (ligne 45) | `#4FC98A` (ligne 40) |
| Trajectoire | `#F2792B` (ligne 53) | `#4F9DF7` (ligne 50) |
| Fluidité | `#FFB703` (ligne 54) | `#F2CE3B` (ligne 53) |

La doc dit aussi que « le bleu `#60A5FA` n'est plus un pilier »
(`REGLES_COULEUR.md:59`) alors que c'est exactement la trajectoire du kit
V2. Elle laisse enfin deux décisions ouvertes qui n'ont pas été tranchées
depuis : un jeton d'erreur dédié (« rouge d'alerte assumé, ou rester au
neutre »), et lequel du duo régularité / meilleur tour est le chiffre
dominant du Bilan (`REGLES_COULEUR.md:88-91`).

Aujourd'hui, l'état d'erreur reste neutre : `StateWrapper`
(`src/ui/StateWrapper.tsx:14-15`) le pose explicitement — « l'erreur
n'emprunte PAS le rouge de marque ; une erreur technique n'est pas la
marque ».

---

## Les polices

### Ce qui est chargé

`src/theme/fonts.ts:53-89` charge **29 graisses** au démarrage, réparties
en neuf familles :

| Famille | Graisses | Statut |
|---|---|---|
| Hanken Grotesk | 7 | actif — ancien système, texte et titres |
| JetBrains Mono | 4 | actif — données, chiffres, chronos, dans les deux systèmes |
| Inter | 4 | actif — corps du kit V2 et du lot Profil |
| Syncopate | 2 | actif — display du lot Profil |
| Michroma | 1 | actif — display du kit V2 |
| Geist | 5 | reliquat |
| Geist Mono | 2 | reliquat |
| Rajdhani | 2 | reliquat |
| Instrument Serif | 2 | reliquat |

Les quatre dernières familles (**11 graisses**) sont explicitement
« conservées en secours (anciens tokens éventuels non migrés) »
(`src/theme/fonts.ts:76`). Recherche dans le code : Geist Mono, Rajdhani et
Instrument Serif ne sont référencés nulle part hors du fichier de
chargement. Geist l'est **deux fois**, en dur, dans
`src/components/DebriefMirror.tsx:54-55`.

Onze graisses sont donc téléchargées et gardées en mémoire pour deux lignes
de code. L'application retient le splash tant que les polices ne sont pas
chargées (`app/_layout.tsx:71-75`) : ce poids se paie au démarrage. Je n'ai
pas mesuré le délai.

### La répartition des rôles

**Kit V2** (`src/ui/v2/tokens.ts:55-62`) — cinq rôles seulement :
`display` Michroma, `body` / `bodyMedium` / `bodySemi` Inter,
`mono` / `monoSemi` JetBrains Mono.

**Ancien système** (`src/theme/v2.ts:67-83`) — seize rôles, dont deux
alias qui trahissent l'histoire : `serif` et `serifItalic` pointent
maintenant vers Hanken Grotesk (« plus de serif : Hanken »). Le code qui
appelle `fonts.serif` obtient donc une grotesque.

### Le chiffre roi

C'est le principe le plus visible de la doctrine : un seul indicateur
dominant par écran, en mono, chiffres à chasse fixe.

- **Ancien système** : `src/ui/KingNumber.tsx`. JetBrains Mono Bold,
  taille 48 par défaut, `letterSpacing: -1.5`,
  `fontVariant: ['tabular-nums']` — « les chiffres ne dansent pas quand la
  valeur change » (`:85`). Sa couleur est celle de sa **donnée**, passée en
  prop ; défaut : or.
- **Kit V2** : `src/ui/v2/ChronoHero.tsx`. JetBrains Mono SemiBold, trois
  tailles 22 / 34 / 56 px (`src/ui/v2/uiLogic.ts:38-42`), millièmes en
  accent, hauteur réservée par `minHeight` pour que la permutation vers la
  célébration de record ne fasse pas sauter la mise en page (`:60`).

Les échelles de corps de l'ancien système sont figées dans
`src/theme/v2.ts:98-110` : `eyebrow`/`micro` 11, `small` 12, `body` 14,
`bodyLg` 15, `h3` 17, `h2` 21, `value` 25, `display` 28, `serifTitle` 44,
`hud` 62. Le kit V2 n'a **pas d'échelle typographique déclarée** : chaque
composant pose son `fontSize` en dur (11, 13, 14, 15…). C'est une
différence structurelle : l'ancien système a une échelle, le nouveau a des
habitudes.

### Les très petits corps

Plusieurs composants de l'ancien système descendent sous 10 px :

- `src/ui/Chip.tsx:29` — libellé de chip à **8 px**, majuscules,
  `letterSpacing: 1.3`, en `creamMute` ;
- `src/ui/Segmented.tsx:56` — onglet segmenté à **8 px** ;
- `src/ui/QdiBars.tsx:97` et `:105` — « point fort » à **8 px**, libellés
  de branche à **8,5 px** ;
- `src/ui/Fact.tsx:44` et `src/ui/KpiCard.tsx:47` — notes à **9 px** et
  **8 px** ;
- `src/components/instruments/EmptyState.tsx` — mention de champ à
  **9,5 px** ;
- `src/ui/DoctrineFooter.tsx:26` — mention de fiabilité à **8 px**.

À 8 px en majuscules espacées, la lisibilité dépend entièrement de l'écran
et de la vue de l'utilisateur. Le kit V2 ne descend pas sous 9 px (le plus
petit est le libellé du cadran en taille `s`,
`src/ui/v2/shellLogic.ts:46`).

---

## Espacements, rayons, géométrie

**Kit V2** (`src/ui/v2/tokens.ts:64-66`) :
`space` = 4 / 8 / 12 / 18 / 24 / 36 ;
`radius` = `card` 18, `cell` 12, `hero` 24, `pill` 999.

**Ancien système** (`src/theme/v2.ts:112-115`) :
`spacing` = 4 / 8 / 12 / 16 / 22 / 28 ;
`radius` = `hud` 6, `sm` 10, `md` 12, `lg` 14, `xl` 18, `pill` 999.

Le rayon `hud` de 6 px est justifié comme « angle d'instrument des panneaux
cockpit — plus sec que les cartes web arrondies »
(`src/theme/v2.ts:113-114`). Le kit V2 fait le choix inverse : ses cartes
sont **nettement plus arrondies** (18 à 24 px). Deux écrans côte à côte
n'auront pas la même dureté d'angle.

Le composant qui incarne le plus l'ancien langage est `CockpitPanel`
(`src/ui/CockpitPanel.tsx`) : une carte à rayon 6 px avec quatre équerres
d'angle de 14 px, dorées par défaut. Les équerres sont correctement
retirées de l'arbre d'accessibilité (`:44-45`) — décoratif, donc muet. Il
n'a pas d'équivalent dans le kit V2.

---

## Le mouvement

### Le vocabulaire du kit V2

Onze primitives, toutes dans `src/ui/v2/motion/`, plus la logique de calcul
isolée dans `motionMath.ts` (234 lignes, testée sous Node).

| Primitive | Fichier | Rôle |
|---|---|---|
| `useDoorTransition` | `useDoorTransition.ts` | l'entrée d'écran : fondu + 12 px de translation, 260 ms |
| `Stagger` / `staggerEntering` | `Stagger.tsx` | cascade des enfants, 45 ms de pas, plafonnée à 450 ms |
| `useCondensingHeader` | `useCondensingHeader.tsx` | le grand titre se condense au-delà de 64 px de défilement |
| `HeroMorph` | `HeroMorph.tsx` | la carte tapée « voyage » vers l'écran de détail |
| `PullToRefreshDial` | `PullToRefreshDial.tsx` | tirer la liste fait tourner une aiguille de cadran |
| `RollingCounter` | `RollingCounter.tsx` | chiffres d'odomètre, chaque digit roule |
| `Shimmer` | `Shimmer.tsx` | squelette balayé par une lumière froide |
| `RecordFlash` | `RecordFlash.tsx` | célébration de record, 900 ms, double pulse |
| `NeedleSweep` | `NeedleSweep.tsx` | l'aiguille rejoint son angle en ressort |
| `PressScale` | `PressScale.tsx` | contraction à 0,97 au toucher |
| `GlowStroke` | `GlowStroke.tsx` | trait lumineux Skia, deux passes |

Les durées sont centralisées (`src/ui/v2/tokens.ts:68-77`) : `door` 260 ms,
`stagger` 45 ms, `radar` 600 ms, `pulse` 1200 ms, `needle` 800 ms, plus deux
ressorts (`spring` amortissement 18 / raideur 180 ; `springSoft` 22 / 120).

L'ancien système a ses propres durées (`src/theme/v2.ts:116-117`) :
`fast` 160, `base` 240, `slow` 420, `reveal` 640, avec une courbe
`[0.22, 1, 0.36, 1]`. Aucune valeur n'est commune aux deux tables.

### Deux règles de motion tenues avec soin

**Le mouvement ne ment pas sur la donnée.** `RecordFlash` ne joue qu'une
fois, sur front montant, et ne peut pas boucler
(`src/ui/v2/motion/RecordFlash.tsx:12-14`). `NeedleSweep` ne déclenche son
retour haptique que sur un **vrai** mouvement : au montage, ou si la cible
ne change pas, ni animation ni vibration (`:7-11`).

**Le mouvement reste sur le fil graphique.** Presque toute l'interpolation
tourne en worklet Reanimated. `useFirstViewport`
(`src/ui/v2/useFirstViewport.ts`) échantillonne la visibilité toutes les
120 ms sur le fil UI plutôt que de dépendre du défilement de l'écran hôte.

**Un cas documenté de repli.** Sur Android, le flou d'`expo-blur` est
remplacé par un aplat opaque à 92 % d'opacité, aussi bien dans la barre
d'onglets (`src/ui/v2/TabBar.tsx:116-125`) que dans l'en-tête condensé
(`src/ui/v2/motion/useCondensingHeader.tsx:22-27`). La raison est écrite :
`dimezisBlurView` re-floute à chaque image sous un contenu qui défile en
permanence — coûteux, artefacts connus. **L'aspect de la barre d'onglets
n'est donc pas le même sur iOS et sur Android.** La cible de build étant
iOS, c'est le vrai flou qui s'appliquera ; je ne l'ai pas vu.

### Le mouvement réduit : couverture

Le réglage système « Réduire les animations » est respecté par deux hooks
distincts.

Le kit V2 utilise `useReducedMotion()` de Reanimated, **lu de façon
synchrone** dès la première image (`src/ui/v2/motion/useReduceMotion.ts`).
Le commentaire explique pourquoi c'est un correctif : l'ancien hook
(`src/components/motion/useReduceMotion.ts`) résout
`AccessibilityInfo.isReduceMotionEnabled()` de façon **asynchrone**, donc
au premier montage il répond `false` pendant quelques images — « toute
l'entrée d'un écran JOUE avant de claquer à l'état final : WCAG 2.3.3 non
tenu au premier rendu ». **L'ancien système garde ce défaut** ; il est
toujours utilisé par les huit primitives de `src/components/motion/`.

Limite connue et écrite : la valeur est lue au montage du hook, sans
re-rendu si l'utilisateur change le réglage en cours de session
(`src/ui/v2/motion/useReduceMotion.ts:15-18`).

Composants qui animent **sans** consulter ce réglage (recherche sur
`withRepeat`, `Animated.loop`, `withTiming`, `withSpring`) :

- `src/ui/StatusPill.tsx` — le point « live » respire en boucle infinie via
  l'`Animated` de React Native, sans garde ;
- `src/components/CircuitMap/TrackStage.tsx` ;
- `src/components/DebriefMirror.tsx` ;
- les six visualisations d'insight : `AnatomieViz`, `DispersionViz`,
  `FlowViz`, `GGViz`, `TourIdealViz`, `TransfertViz`
  (`src/components/insights/`) ;
- `app/(app)/roulage.tsx` — l'écran de roulage de l'ancien arbre.

`src/ui/v2/SpringDot.tsx` apparaît dans la même recherche mais reçoit un
drapeau `still` de ses appelants, qui eux consultent le réglage
(`src/ui/v2/RadarQdi.tsx:167`). Il n'est pas en défaut.

Le kit V2 est donc **couvert**, l'ancien système ne l'est que
partiellement.

---

## Les états vides, de chargement, d'erreur et hors ligne

Les deux systèmes traitent la question, différemment.

### Kit V2 — `StateView`

`src/ui/v2/StateView.tsx` (221 lignes) couvre quatre états.

**Chargement.** Aucun indicateur circulaire, jamais. Le squelette prend la
**forme réelle** de la section attendue, décidée par
`skeletonBlocksFor(shape)` (`src/ui/v2/uiLogic.ts:71-97`) :

| Forme | Blocs |
|---|---|
| `hero` | photo 220 px + titre 58 % + sous-titre 36 % |
| `list` | 5 rangées de 56 px |
| `radar` | disque de 240 px + légende 52 % |
| `card` | carte 120 px + légende 64 % |

Chaque bloc est un `Shimmer`, masqué des lecteurs d'écran — « un squelette
n'est pas un contenu » (`src/ui/v2/motion/Shimmer.tsx:9-10`, `:90-91`).

**Vide.** Une illustration SVG maison : un tracé de circuit stylisé, 18
points posés à la main, qui se dessine en boucle de 8 secondes
(`src/ui/v2/uiLogic.ts:130-162`). La longueur du tracé est **calculée**,
pas estimée à la main (`polylineLength`), et sert au `strokeDasharray`.
L'illustration est retirée de l'arbre d'accessibilité
(`src/ui/v2/StateView.tsx:95-96`). En mouvement réduit, elle est rendue
complète, sans boucle.

**Erreur.** Icône `incident` + message + pastille « Réessayer ». Le message
par défaut est factuel : « Le chargement a échoué. »

**Hors ligne.** Un bandeau `accessibilityRole="alert"` — « Hors ligne —
dernier contenu affiché » — et **le dernier contenu connu reste affiché en
dessous** (`:162-170`). C'est un choix local-first assumé, pas un écran
vide.

### Ancien système — `StateWrapper` + `EmptyState`

`src/ui/StateWrapper.tsx` couvre **cinq** états : nominal, chargement,
vide, hors ligne, erreur. Le squelette est un jeu de barres grises
statiques de largeurs dégressives (72 %, 60 %, 48 %…), sans animation —
« squelette calme, pas d'animation nerveuse » (`:115`).

L'état hors ligne y est plus riche : il affiche « Voici votre dernière
lecture. » suivi d'un horodatage passé par l'écran (`lastReadLabel`), avec
un bouton « Reconnecter ». L'état d'erreur affiche la cause et « Réessayer ».

`src/components/instruments/EmptyState.tsx` ajoute une honnêteté que le kit
V2 n'a pas : il affiche **le nom du champ de données attendu**
(`champ · gg_envelope`), « pour que l'attente soit traçable plutôt que
vague ». Message par défaut : « Cette lecture apparaîtra après votre
première séance. »

### La règle qui vaut des deux côtés : l'absence n'est pas un zéro

C'est appliqué avec constance, et c'est vérifiable :

- `dialDisplayValue(null)` renvoie `'—'` — « une valeur absente ne devient
  JAMAIS un zéro d'apparence mesurée » (`src/ui/v2/shellLogic.ts:88-94`) ;
- le cadran n'affiche **pas** l'unité à côté d'un tiret, « elle donnerait au
  tiret l'air mesuré » (`src/ui/v2/Dial.tsx:157`) ;
- `formatPillarValue` renvoie `'—'` (`src/ui/v2/vizMath.ts:362-366`) ;
- `radarLayout` masque la branche non mesurée
  (`src/ui/v2/vizMath.ts:136`) ;
- `centerlineToTrace` renvoie un chemin vide plutôt qu'une silhouette
  inventée (`src/ui/v2/vizMath.ts:298`) ;
- `msToLapLabel` renvoie `'—'` pour une valeur non finie
  (`src/ui/v2/uiLogic.ts:26`).

Côté médias, même logique : sans photo, `HeroPhoto` rend un tracé Skia ou
un monogramme, « JAMAIS d'image stock générique »
(`src/ui/v2/media/HeroPhoto.tsx:19-20`).

**Une réserve sur les photos.** `Photo` prévoit un blurhash stocké en base,
avec repli sur `TITANE_BLURHASH`, un aplat titane réellement encodé
(`src/ui/v2/media/blurhash.ts:11`). J'ai interrogé la base de production :
**aucune table ne porte de colonne blurhash**. Les tables `media` et
`session_media` n'en ont pas. Et aucun écran ne passe la prop : la seule
occurrence de `photoBlurhash=` hors du kit est
`app/(app2)/dev-galerie.tsx:358`, la galerie de développement. En pratique,
**toutes les photos de l'application affichent le même placeholder
titane**. Le chemin « vrai blurhash » est écrit mais n'est branché sur
rien.

---

## Le retour haptique et son coupe-circuit

### Un vocabulaire fermé (kit V2)

`src/ui/v2/haptics.ts` expose **un seul point d'entrée**, `haptic(kind)`,
et cinq mots seulement :

| Mot | Effet iOS | Quand |
|---|---|---|
| `tap` | sélection | tout élément pressable, via `PressScale` |
| `arm` | impact lourd | armer la capture (bouton central en mode enregistrement) |
| `record` | notification succès | record personnel (`RecordFlash`) |
| `doorSnap` | impact léger | fin de balayage d'aiguille, section franchie |
| `warn` | notification avertissement | erreurs |

La règle est explicite : « Jamais d'appel expo-haptics dispersé dans les
écrans (app2) » (`src/ui/v2/haptics.ts:11-12`).

L'ancien système garde quatre fonctions libres — `tap`, `confirm`,
`success`, `warning` (`src/lib/haptics.ts`) — sans point d'entrée unique.

### Le coupe-circuit en piste

C'est le Principe 3 de la doctrine, et il est **câblé à trois niveaux**.

1. Un drapeau runtime central, `src/lib/silence.ts`, volontairement sans
   aucune dépendance pour éviter tout cycle d'import.
2. La machine à états le pose : `useAppStateStore` appelle
   `setSilenceMode(isSilentState(next))` à chaque recalcul
   (`src/store/useAppStateStore.ts:112`), et le remet à faux au démontage
   (`:117`). `isSilentState` est vrai pour un seul état :
   `S6_roulage` (`src/types/state.ts:230-232`).
3. Les deux modules haptiques le lisent avant toute vibration :
   `src/ui/v2/haptics.ts:27-33` et `src/lib/haptics.ts:26-28`. Même
   fonction `muted()` des deux côtés, qui coupe aussi sous Expo Go.

En complément, l'interface elle-même s'efface : la barre d'onglets
disparaît si l'état pilote est `S6_roulage` ou si le chemin appartient au
flux de capture (`src/lib/appMap.ts:175-179`, appelé par
`app/(app2)/_layout.tsx:78`).

L'écran de roulage V2 pousse le principe jusqu'au bout
(`app/(app2)/rec/roulage.tsx:5-10`) : fond nu, un point qui pulse, le mot
« REC » en mono. **Aucun chrono, aucun chiffre, aucune biométrie.** Une
seule exception d'honnêteté est admise : si le lien Bluetooth décroche, on
le dit — et sans rouge, « le rouge reste au REC actif ».

Un test unitaire couvre le drapeau (`src/lib/__tests__/silence.test.ts`).
Je n'ai pas vérifié sur appareil qu'aucune vibration ne franchit ce filtre.

### Le mot « tap » fait échouer la porte doctrinale

Le dépôt possède un scanner qui interdit certains mots dans les fichiers
d'écran : verbes de pilotage directifs, impératifs paternalistes, jugements
gratuits, **et anglicismes** (`scripts/check-doctrine.ts:63-66` interdit
`tap`, `swipe`, `click`).

Ce scanner est branché en intégration continue, sans tolérance
(`.github/workflows/check.yml:53`). Je l'ai exécuté :

```
Scan doctrinal : 222 fichiers .tsx dans app/
KO — 75 violation(s) doctrinale(s)
```

Décompte par mot : **70 fois « tap »**, **5 fois « swipe »**. J'ai vérifié
la nature de chacun : ce ne sont **pas** des textes affichés au pilote, ce
sont des identifiants de code — `haptic('tap')`, `haptic="tap"`, le nom
d'une variable de geste, un commentaire. Le vocabulaire haptique du kit V2
emploie littéralement le mot que le scanner interdit.

La liste d'exemptions du scanner contient bien `/haptics\.tap/`
(`scripts/check-doctrine.ts:113`) — écrite pour l'ancienne API
`haptics.tap()`. Elle ne couvre pas la nouvelle forme `haptic('tap')`.

**Conséquence factuelle : l'étape doctrinale de la CI échoue aujourd'hui**,
non pas sur un vrai écart de ton, mais sur un motif de nommage. Le scanner
ne dit donc plus rien d'utile tant qu'il n'est pas ajusté : soit on renomme
le vocabulaire haptique en français, soit on élargit l'exemption.

---

## L'accessibilité

### Le contraste : le test qui verrouille

`src/theme/__tests__/contrastTokens.test.ts` (119 lignes) est le seul
verrou chiffré du dépôt en matière d'accessibilité. Il :

1. réimplémente la luminance relative WCAG 2.1 et le rapport de contraste
   (`:24-38`) ;
2. calcule le **pire** contraste de chaque gris sur l'ensemble des fonds où
   il peut se poser (`worstOn`, `:41-43`) ;
3. exige ≥ 4,5 pour `hi`, `mid`, `low` du kit V2, et pour `cream`,
   `creamSoft`, `secondary`, `creamMute`, `legend`, `eyebrow` de l'ancien ;
4. exige ≥ 3,0 pour `dim` et `faint` ;
5. **exige que la hiérarchie reste strictement décroissante** — sans quoi
   « quatre gris lisibles mais indistinguables ne hiérarchisent plus rien,
   et l'écran perd sa lecture » (`:65-67`).

Ce cinquième point est le plus intelligent du fichier : il empêche de
« résoudre » un problème de contraste en aplatissant la hiérarchie
visuelle. Le test passe.

Sa raison d'être est écrite en tête : « Un thème s'ajuste souvent à l'œil,
sur un écran neuf, en pleine lumière : c'est exactement là qu'on assombrit
un gris sans s'en apercevoir. Ici, la règle est chiffrée. »

### Ce que ce test ne couvre pas

Le fichier le déclare lui-même (`:13-17`) : il ne juge **pas** les couleurs
sémantiques — or, rouge de marque, teintes QDI, Heritage. L'argument est
défendable : leur contraste dépend de la taille et du poids réels du texte
concerné. Mais cela laisse quatre zones sans filet :

1. **Le rouge de marque**, à 2,86 sur carte, alors qu'il porte les
   millièmes du chrono et remplit l'arc du cadran (voir plus haut).
2. **Le freinage QDI V2** (`#E63946`) à 4,04.
3. **Les jetons du lot Profil** : `grisSombre #555555` à 2,47 / 2,29, dont
   trois emplois comme placeholder de saisie. Ce jeu de jetons n'est même
   pas importé par le test — `lotProfilTokens` n'est pas dans l'objet
   `theme` exporté.
4. **Les bordures**, à 1,23 et 1,58, quand elles sont le seul signal d'un
   état sélectionné.

### Les cibles tactiles

Le seuil usuel est 44 × 44 points sur iOS. Ce qui est vérifiable dans le
code :

**Respecté par construction :**

- `src/ui/Button.tsx:67` — `minHeight: 48`, avec le commentaire
  « cible tactile ≥ 44 px » ;
- `src/ui/Card.tsx:52` — `minHeight: 44` dès que la carte porte une action ;
- `src/ui/v2/ListRow.tsx:128` — `minHeight: 52` ;
- `src/ui/v2/shellLogic.ts:216` — barre d'onglets de 56 px de haut, chaque
  porte en `flex: 1` sur toute la largeur disponible ;
- `src/ui/v2/shellLogic.ts:147` — bouton central de 60 px ;
- `src/ui/AccountButton.tsx` — pastille de 34 px **plus** le `hitSlop`
  global de 8 px sur chaque bord, soit 50 px.

**Rattrapé par `hitSlop` :**

- `src/ui/v2/Chip.tsx:33` — la pastille fait ~32 px, complétée de 6 px en
  haut et en bas, soit 44 ;
- `src/ui/v2/StateView.tsx:147-151` — la pastille « Réessayer » fait ~36 px,
  complétée de 4 px de chaque côté, soit 44 ;
- `src/ui/Segmented.tsx:29` et `:49-51` — pastille « volontairement
  compacte », étendue d'environ 16 px par le `hitSlop` du thème.

Le dépôt compte **329 usages de `hitSlop`** et **181 déclarations** de
hauteur ou hauteur minimale à 44 ou 48 px.

**Le piège documenté.** Un point de vigilance est inscrit dans la mémoire
projet et se lit dans le code de `PressScale`
(`src/ui/v2/motion/PressScale.tsx:5-12`) : le style **visuel** va sur la
vue animée interne, le style de **mise en page** sur le `Pressable`
externe. Si l'on inverse, des cibles jointives voient leurs `hitSlop` se
recouvrir et le dernier frère rafle le toucher. La règle est écrite dans le
contrat d'API du composant ; elle n'est vérifiée par aucun test.

**Un cas résolu explicitement** : sur Android, le test de contact est
découpé aux limites de chaque ancêtre. Le bouton central débordant de la
barre, le haut du cercle était une zone morte. Un débord de 12 px
(`TAB_BAR_OVERHANG`, `src/ui/v2/shellLogic.ts:218-224`) a été ajouté aux
limites de la barre, le fond flouté restant décalé d'autant pour que la
hauteur visuelle ne change pas. Correction non observée sur appareil.

### Ce que VoiceOver entend

Volumétrie sur `app/` et `src/` : **806** `accessibilityLabel`, **680**
`accessibilityRole`, **158** `accessibilityState`, **143**
`accessibilityElementsHidden`, **26** `accessibilityHint`, **25**
`accessibilityLiveRegion`, **12** `accessibilityActions`.

Le scanner `scripts/check-accessibility.ts` vérifie qu'aucun `<Pressable>`
avec `onPress` n'est dépourvu de `accessibilityRole`. Exécuté sur les 222
fichiers : **aucun défaut**. Il est branché en CI en mode strict
(`.github/workflows/check.yml:56`). C'est un filet réel, mais étroit : il
ne vérifie ni la présence ni la **qualité** des libellés.

Les soins concrets que j'ai relevés dans le kit V2 :

- **Le contexte prime sur le raccourci.** Le bouton central ne dit jamais
  « J-3 » tout seul ; `centralButtonAccessibilityLabel`
  (`src/ui/v2/shellLogic.ts:126-144`) compose « Prochain track day · J-3 »,
  parce qu'« un “J-3” nu est cryptique au lecteur d'écran ». Fonction pure,
  testée.
- **Le regroupement étiquette + chiffre.** `StatCell`
  (`src/ui/v2/StatCell.tsx:31-38`) lit « Record : 1:41.203 » d'un seul
  tenant — « sans quoi le lecteur d'écran énonce “Record” puis, au balayage
  suivant, “1:41.203”, le lien perdu ».
- **L'absence est dite, pas montrée.** Le tiret « — » n'est pas un mot :
  `StatCell` annonce « non mesuré », et `Dial` construit
  « Marge : non mesuré » (`src/ui/v2/Dial.tsx:116-118`).
- **Le radar est résumé, pas décrit.** `RadarQdi`
  (`src/ui/v2/RadarQdi.tsx:104-111`) compose « Radar QDI — Trajectoire 72,
  Freinage 64… », et ajoute « — 3 axes mesurés sur 5 » quand la mesure est
  partielle.
- **Un élément inerte n'est pas annoncé comme un bouton.** Sans `onPress`,
  `Chip` prend le rôle `text` et perd son état sélectionné — « annoncer
  “bouton” sur un élément inerte est un mensonge d'interface »
  (`src/ui/v2/Chip.tsx:27-30`).
- **Le décoratif est muet.** L'illustration d'état vide, le squelette
  `Shimmer`, les équerres du `CockpitPanel` et le `Canvas` du cadran sont
  tous retirés de l'arbre d'accessibilité.
- **Les gestes ont un chemin non gestuel.** `PressScale` expose
  `accessibilityActions` / `onAccessibilityAction`
  (`src/ui/v2/motion/PressScale.tsx:61-66`) pour « le chemin non gestuel
  d'une action qui n'existe qu'au geste ». Utilisé douze fois, notamment
  pour incrémenter/décrémenter un curseur de tour
  (`app/(app2)/data/session/[id].tsx:771`,
  `app/(app2)/data/comparer.tsx:965`), écarter un rappel
  (`app/(app2)/index.tsx:382`) et armer la capture
  (`app/(app2)/rec/placement.tsx:159`, où le commentaire précise que
  c'est « le SEUL chemin non gestuel vers l'armement »).
- **Les messages qui apparaissent sont annoncés.** 25 usages de
  `accessibilityLiveRegion`, en `polite` pour les erreurs de formulaire, en
  `assertive` pour quelques retours immédiats
  (`app/(app2)/rec/entre-runs.tsx:273`, `app/(app)/equipement.tsx:159`).

**Ce que je n'ai pas vérifié** : l'ordre de lecture réel des éléments, la
présence d'un libellé sur *chaque* image ou icône porteuse de sens, et le
comportement du rotor iOS. Ces points demandent un appareil.

### La taille de texte système

C'est la lacune la plus nette. React Native applique par défaut la
taille de texte système ; sept endroits la **désactivent** explicitement
avec `allowFontScaling={false}` :

- `src/ui/KingNumber.tsx:60` — le chiffre roi de l'ancien système ;
- `src/ui/v2/motion/RollingCounter.tsx:86` et `:147` — l'odomètre, donc
  tout chrono du kit V2 ;
- `src/ui/v2/motion/RecordFlash.tsx:139` — le chrono en célébration ;
- `src/ui/v2/Dial.tsx:161` et `:171` — la valeur et le libellé du cadran ;
- `src/ui/v2/CentralButton.tsx:101` — le libellé du bouton central.

Le motif technique est compréhensible : ce sont des chiffres calés au pixel
dans des géométries fixes (bande d'odomètre, centre de cadran, cercle de
60 px), qu'un agrandissement casserait. La conséquence est réelle : un
utilisateur qui a grossi le texte de son iPhone **ne verra pas grossir les
chiffres les plus importants de l'application**. Aucun palier
intermédiaire, aucun `maxFontSizeMultiplier`, aucune mise en page
alternative n'est prévue.

Partout ailleurs, l'agrandissement s'applique. Comme le kit V2 pose ses
`fontSize` en dur, sans échelle centrale, l'effet d'un agrandissement fort
sur des cartes de 120 px de haut ou des rangées de 52 px n'est pas
prévisible depuis le code seul. Je ne l'ai pas testé.

### Le thème et l'orientation

L'application est **verrouillée en sombre** : `userInterfaceStyle: "dark"`
et `orientation: "portrait"` (`app.json:6-9`), barre d'état claire
(`app/_layout.tsx:158`). Il n'existe aucun thème clair, aucun jeu de
jetons alternatif, et la base de production ne stocke **aucune préférence
d'affichage** (vérifié : aucune colonne `theme`, `locale` ou
d'accessibilité dans le schéma public ; seule `vehicles.color` porte le mot
« color », et c'est la couleur d'une voiture).

Cela simplifie beaucoup, mais implique qu'un utilisateur en mode « contraste
élevé » ou en inversion de couleurs système n'a **aucun chemin d'adaptation
dans l'application**.

---

## Récapitulatif : ce qui est solide, ce qui est fragile

### Solide

- La séparation des deux systèmes est étanche : 38 écrans sur le nouveau
  kit, zéro import croisé.
- Le contraste des gris de texte est mesuré, corrigé et **verrouillé par un
  test qui passe**, hiérarchie comprise.
- Le coupe-circuit haptique en piste est câblé à trois niveaux, avec un
  drapeau sans dépendance et un test unitaire.
- La règle « une absence n'est pas un zéro » est appliquée avec constance,
  dans six fonctions différentes au moins.
- Les libellés de lecteur d'écran du kit V2 sont composés avec soin :
  contexte ajouté, valeurs regroupées, décoratif muet, gestes doublés d'un
  chemin non gestuel.
- Le scanner d'accessibilité passe sur 222 fichiers, en CI stricte.
- 153 tests couvrent la géométrie, les conversions et le contraste — dont
  la conversion millisecondes → chrono, verrouillée.

### Fragile

- **Le rouge de marque à 2,86:1** porte les millièmes du chrono et l'arc du
  cadran. Sous tous les seuils, sur carte.
- **Trois lois de l'or se contredisent** : `#FFB703` est à la fois « chrono
  uniquement, jamais une donnée QDI » et la couleur de la branche Fluidité ;
  l'or Heritage, déclaré exclusif au tier commercial, sert la célébration de
  record.
- **142 emplois de l'or dans l'ancien arbre**, dont au moins sept
  clairement décoratifs (onboarding, modales, bandeau hors ligne) —
  contraires à la règle écrite, non vérifiés par aucun outil.
- **Le lot Profil échappe au verrou de contraste** : `#555555` à 2,3:1, en
  placeholder de saisie sur trois écrans.
- **La CI doctrinale échoue** sur 75 occurrences du mot « tap » qui sont du
  code, pas du texte affiché.
- **Les chiffres majeurs ne grossissent pas** avec la taille de texte
  système : sept désactivations explicites, sans repli.
- **Le mouvement réduit n'est pas couvert dans l'ancien système** : le hook
  y est asynchrone (l'animation joue avant de s'effacer), et dix composants
  animent sans le consulter du tout.
- **La documentation normative de la couleur a divergé du code** sur au
  moins neuf jetons ; deux décisions couleur y sont ouvertes depuis
  plusieurs semaines (jeton d'erreur, chiffre dominant du Bilan).
- **Le placeholder de photo « intelligent » n'est branché sur rien** :
  aucune colonne blurhash en base, donc toutes les photos partagent le même
  aplat titane.
- **Trois familles typographiques de titre** et **onze graisses inutilisées
  mais chargées** au démarrage.

### Jamais observé

Rien de ce chapitre n'a été vu sur un appareil. La procédure de recette sur
matériel existe (`docs/SMOKE_TEST_DEVICE.md`) : elle compte **105 points de
contrôle, dont zéro coché**. Le fond du splash natif diffère du fond des
deux systèmes ; le flou de la barre d'onglets diffère entre iOS et Android ;
les corps de 8 px, les cibles complétées par `hitSlop` et l'ordre de lecture
VoiceOver ne peuvent se juger qu'en main. Tant qu'une session sur appareil
n'a pas eu lieu, tout le contenu de ce chapitre reste une lecture de
l'intention du code.

---

## Où en est le programme, et ce qui bloque

Cette section répond à trois questions : ce qui a été livré, ce qui reste, et ce
qui empêche d'avancer. Elle distingue systématiquement deux choses : ce que j'ai
**mesuré** en lançant une commande ou en interrogeant la base de production, et
ce que j'ai seulement **lu** dans le code ou dans un rapport.

Rien n'a été exécuté sur un téléphone. Aucun simulateur, aucun appareil, aucun
boîtier RaceBox, aucune ceinture Polar, aucun écran de paddock. Tout ce qui
concerne le rendu, les gestes, les animations, VoiceOver, le Bluetooth ou le
direct est une lecture de code. La dernière partie de cette section liste
franchement tout ce qui est dans ce cas.

### Ce que j'ai réellement exécuté pour écrire cette section

| Commande | Résultat |
|---|---|
| `npx tsc --noEmit` | code de sortie **0**, aucune sortie |
| `npx jest --ci --coverage=false` | **1 847 tests verts**, 98 ignorés, 1 945 au total · 140 suites passées, 18 ignorées, 158 au total · 57,6 s |
| `npx eslint "src/**" "app/**"` | code de sortie **1**, **756 remarques** |
| `npx prettier --check` | code de sortie **1**, **un seul fichier** signalé |
| `npx tsx scripts/check-doctrine.ts` | code de sortie **1**, **75 violations** |
| `npx tsx scripts/check-accessibility.ts --strict` | code de sortie **0**, 222 fichiers scannés |
| Requêtes SQL en lecture seule sur `fouvuqkdxarjpjbqnsjq` | voir §« Le verrou terrain, chiffré » |

Le détail de chacun est en §7.

---

## 1. Le document qui fait foi

L'ordre des travaux est fixé par
`design-retours/programme-v2/OXV_APP_V2_DOSSIER_MAITRE.md`, daté du 18/07/2026.
Il définit treize lots (§10, lignes 254-273) et quatre verrous externes (§0,
lignes 19-25). Tout ce qui a été livré depuis le 19 juillet suit ce document.

L'ordre canonique, tel qu'écrit dans
`design-retours/programme-v2/PROMPT_CLAUDE_CODE_LOTS_CLOTURE.md:49`, est :

```
BE-1 → L0 → L1 → L2 (+L2-B) → L4 → L5 → [SMOKE TEST TERRAIN] → L3
→ BIO-2 → [DÉCISION CLASSEMENT] → LIVE-B → BIO-3 → B1 → [SIRET]
→ A1-ON → L6 → App Store
```

Les quatre verrous externes déclarés dès le départ, avec ce qu'ils bloquent
(dossier maître, §0) :

| Verrou | Bloque | Levée prévue |
|---|---|---|
| SIRET → Stripe | A1 paiement, facturation coach | août 2026 |
| Validation avocat | décharge, consentement biométrie, CGV | RDV semaine du 21/07 |
| Décision classement | écran paddock TV | fondateur |
| Smoke test terrain | tous les lots dépendants des trames | 1 journée piste |

Deux de ces quatre verrous ont été levés (avocat sur l'annexe A, décision
classement). Deux restent fermés (SIRET, terrain). Le terrain est le plus
structurant : il conditionne à lui seul quatre lots.

---

## 2. Les lots livrés, et ce que chacun a apporté

Quatorze livraisons sont identifiables par un commit et, pour la plupart, par un
rapport. Voici ce que chacune a réellement apporté.

### SEC-1 — sécurité et supervision (19/07, `b4748a2` puis `b9896ff`)

Préparé puis appliqué en production dans la même nuit. Documenté dans
`docs/architecture/SEC1_PROD_APPLY.md`. Le lot a durci `ritual_dispatcher`,
figé les `search_path` de fonctions, et rendu le job CI des tests RLS
**fail-closed** — il échoue désormais franchement au lieu de sauter en silence
(`.github/workflows/check.yml`, job `rls`).

Reste ouvert et écrit noir sur blanc à `SEC1_PROD_APPLY.md:245` : la suppression
des tables `_backup_*` (décision fondateur, la RLS a été activée en défense),
l'effacement côté Stripe, le point avocat sur `incident_reports`, le DSN Sentry
et les secrets CI.

### BE-1 — socle backend (19/07, `d920d2f`)

État détaillé dans `docs/architecture/13_BE1_ETAT.md`. Ce lot a créé, en
production :

- les cinq drapeaux `app_payments`, `biometry`, `founders`, `video_overlay`,
  `convoys`, tous fermés à la création ;
- la table `biometry_raw` (donnée de santé, article 9 du RGPD), avec RLS
  own-row plus lecture coach conditionnée au binôme détaillé et au consentement ;
- deux colonnes de consentement horodatées sur `users`
  (`biometry_capture_consent_at`, `biometry_coach_share_consent_at`) — `NULL`
  vaut refus, une date vaut consentement, ce qui donne la piste d'audit ;
- la table `founder_applications` avec un déclencheur anti-auto-validation ;
- la table `incident_reports`, **immuable** (aucun update, aucun delete) ;
- la table `video_overlays`, qui attend toujours son usage (lot B1) ;
- la rétention 30 jours de la biométrie, planifiée en cron.

**Vérifié en base ce jour** : le cron `biometry-retention-daily` existe bien
(jobid 11, `15 3 * * *`), il est actif, comme les sept autres.

### V2-L0 — fondations visuelles (19/07, `52bb7bd`)

Rapport : `roadmap/rapports/v2-l0.md`. C'est le kit « DA Instrument » :
`src/ui/v2/tokens.ts` (palette, typographies Michroma / Inter / JetBrains Mono),
20 icônes dessinées à la main, 11 primitives de mouvement, 18 composants dont le
`Dial` signature, la `TabBar`, le `Sheet`, le `StateView`.

Deux points méritent d'être retenus. D'abord, une règle a été posée à ce
moment-là et n'a plus bougé : `Dial` accepte `value: number | null` et affiche
« — » plutôt qu'un zéro fabriqué. Ensuite, la vérification adversariale a rendu
**28 constats, tous corrigés**, dont sept majeurs.

L'écran `app/(app2)/dev-galerie.tsx` a été créé comme **écran de validation
fondateur** : les 18 composants, les 20 icônes et les primitives rejouables y
sont réunis. Il n'a jamais été ouvert sur un appareil.

### V2-L1 — porte Miroir (19/07, `87ab0e6`)

Rapport : `roadmap/rapports/v2-l1.md`. Trois écrans :
`app/(app2)/index.tsx` (1 067 lignes), `app/(app2)/bilan/[sessionId].tsx`
(1 182 lignes), `app/(app2)/signature.tsx` (464 lignes).

34 constats traités, dont 17 majeurs. Ceux qui comptent sont tous de la même
famille : des valeurs fabriquées. « 0 km / 0 séances » affichés sur une panne
réseau, une célébration de record posée sur des données partielles, un pack
Heritage reconstruit au lieu d'être lu, des QDI d'une version d'algorithme
périmée affichés comme courants, et surtout **le tracé d'un autre circuit
présenté comme celui de la séance** — corrigé par une lecture stricte
(`fetchSessionCircuitCenterlineExact`, sans repli).

C'est aussi ce lot qui a produit deux décisions durables du fondateur : le
mapping des libellés Signature (Cap, Trajectoire, Visée, Plongée, Anticipation),
verrouillé par test dans `src/features/miroir/signatureLogic.ts:46` ; et la
consigne A-WEATHER-1, qui n'est pas un correctif de bug mais une règle de
doctrine — un service expose `null`, jamais un nombre placebo.

### V2-L2 — porte REC, le jour J (19/07, `f151fab`)

Rapport : `roadmap/rapports/v2-l2.md`. Huit écrans sous `app/(app2)/rec/`.

La règle cardinale du lot était le gel de la chaîne de capture. Elle est tenue
et prouvée : `git diff` vide sur `src/store/useAppStateStore.ts`,
`src/services/captureSessionService.ts`, `src/services/captureSyncQueue.ts` et
`src/ble/bluetoothService.ts`. Les huit écrans sont une peau posée sur des
services inchangés.

Apports concrets : l'armement de la capture par appui long de 600 ms,
l'écran de roulage réduit à un point pulsant et rien d'autre (principe 3), la
feuille de consentement biométrie, le registre hors-ligne des incidents,
séparé de la file de capture.

Une migration a été appliquée en production dans la foulée (`6d2b453`) :
`users.show_attendance` et la RPC `session_attendance_public`, pour la présence
du jour J.

**Reporté à ce lot et jamais repris** : L2-B, la Live Activity iOS. Le rapport
le dit explicitement (`v2-l2.md:79-82`) : plus d'une journée de travail natif.

### V2-L4 — porte VOUS (19/07, `650b029`)

Rapport : `roadmap/rapports/v2-l4.md`. Onze écrans plus le flux de réservation
gaté. Le lot a introduit `bookingCatalogService`, **en lecture seule
uniquement** (aucune écriture, vérifié par recherche), et le catalogue des
journées lu depuis les tables du site.

Trois divergences ont été remontées comme des manques de schéma, pas des bugs :
pas de colonne de rang pour les fondateurs, donc pas de « FONDATEUR N° 07 » ;
pas de véhicule principal choisi dans `garageService` ; `expo-clipboard` absent,
donc partage natif au lieu d'un bouton « copier ».

### V2-L5 — porte CLUB (19/07, `79aabbb`)

Rapport : `roadmap/rapports/v2-l5.md`. Sept écrans plus un service d'export.
Le cœur du lot est doctrinal : le fil d'amis restitue **le fait de rouler**,
jamais un chrono ni un rang, garanti par liste blanche et par tests.

La vérification a attrapé le défaut le plus visible du lot : la carte-souvenir
partageable peignait la silhouette de Haute Saintonge sous le nom d'un autre
circuit. Corrigé par la même lecture stricte que le Bilan.

### V2-L5-B — suppression des notes coach (19/07, `eb46c00`)

Rapport : `roadmap/rapports/v2-l5b.md`. Sur décision du fondateur, la table
`coach_reviews` (note 1-5, NOT NULL) a été supprimée et remplacée par
`coach_testimonials` : des citations, aucun agrégat.

Ce lot mérite d'être signalé parce qu'il a **causé puis corrigé une régression
en production**. Postgres ne suit pas les références depuis un corps PL/pgSQL :
le `DROP` a réussi en silence, laissant deux fonctions orphelines. L'une était
`purge_user_data()`, la fonction du droit à l'effacement — la purge RGPD
avortait entièrement. Corrigée par un correctif appliqué le même jour.

Un garde-fou automatisé a été posé dans la foulée :
`src/services/__tests__/coachDomainNoScore.test.ts` échoue si une colonne
`rating` / `score` / `stars` réapparaît quelque part dans le domaine coach.

### V2-L3 — porte DATA (19/07, `c07d0b7` → `6bea17d`)

Rapport : `roadmap/rapports/v2-l3.md`. Quatre écrans, dont l'écran pivot
`app/(app2)/data/session/[id].tsx`.

**Ce lot a été exécuté malgré son verrou ouvert.** Le rapport l'écrit dès la
quatrième ligne : le gate « trames réelles » n'était pas rempli, et le fondateur
a demandé d'enchaîner. Conséquence assumée : la structure existe, les données
non.

Cinq des six lectures Insight ont été « dé-mockées » dans la même nuit. Un
second passage a dû retirer les courbes de démonstration restées codées en dur —
elles se lisaient comme la mesure réelle. La sixième, FlowViz, reste une
démonstration : aucune source de fluidité n'existe dans `session_insights`.

Trois bugs de fond ont été trouvés parce que PostgREST rend les colonnes
`numeric` en **chaînes** au moment de l'exécution, alors que le type TypeScript
annonce `number` : un plantage au rendu du pivot, un tri de tours faux, et un
plantage Skia sur une séance sans force G.

### BIO-2 — ceinture Polar et cardio coach (25/07, quatre commits)

Rapport : `roadmap/rapports/bio-2.md`, le plus détaillé du dépôt.

Quatre incréments : le parser de la mesure Bluetooth 0x2A37, l'extension BLE
Polar (chemin **entièrement séparé** du RaceBox, purement additive, zéro ligne
retirée), la capture cardio locale hors-ligne, et le relais vers le coach à
0,5 Hz sous triple verrou.

La vérification adversariale a trouvé un défaut invisible à la lecture :
`supabase-js` déduplique ses canaux par sujet, donc deux écrans abonnés au même
sujet partageaient une seule instance, et fermer l'un tuait l'autre. Le
comptage de références est désormais obligatoire, verrouillé par neuf tests.

Le rapport dit aussi une chose qu'il faut retenir : `stripHealth` était écrit et
testé mais **n'avait aucun appelant** ; la protection réelle était structurelle,
pas active.

**Décision du 25/07** : le drapeau `biometry` a été levé en production, le
fondateur étant informé que le smoke test à deux appareils n'avait pas eu lieu.

### LIVE-B — tableau de marche (25/07, `dccbe25`)

Rapport : `roadmap/rapports/live-b.md`. Débloqué par l'arbitrage du fondateur :
**variante A**, liste ordonnée par numéro de voiture, jamais par chrono. Le
motif est juridique et il est écrit : un classement compétitif peut requalifier
un track day en compétition.

`stripHealth` a gagné ici son premier appelant réel, et la barrière est rendue
infranchissable par le typage : `openBoardBroadcast.send` n'accepte que la
sortie de `stripHealth`.

La vérification a trouvé quatre défauts, dont un canal public qui survivait à la
fin de séance, et un miroir Meta qui ne pouvait structurellement jamais être en
direct (il ne listait que des séances terminées).

Les policies `board_recv` / `board_send` sont appliquées en production. Le
rapport précise ce qu'elles refusent de faire : ouvrir la lecture « à tout
inscrit de la journée », **parce que le lien n'existe pas au schéma**. Écrire
une règle d'accès sur une devinette a été refusé.

### BIO-1 — HealthKit (25/07, `8d5bc2a`)

Câblé en lecture seule, consentement en tête. La dépendance
`react-native-health` `^1.19.0` est bien dans `package.json:80` et installée
dans `node_modules`. **Aucun rapport de lot n'existe pour BIO-1.**

### A-FLOW-1 — service de fluidité (19/07 puis 25/07, `5a7bed7`)

Défini dans `docs/architecture/A-FLOW-1_flowService_definition.md`, validé par
quatre décisions du fondateur. `src/services/flowLogic.ts` (44 tests) et
`src/services/flowService.ts` existent.

Ce qui est écrit, c'est **la forme et les invariants, pas le calage** : le seuil
de fluidité doit émerger des percentiles réels, il n'est pas décrété (§3 du
document). Le document signale par ailleurs une **limite connue non résolue**
(§7) : `gSustained` est lu sur le |g| mesuré, la boucle est donc partiellement
fermée et un pilote brusque bénéficie d'une indulgence mémorisée. La sortie non
circulaire — la courbure géométrique déduite du GPS — n'est pas implémentée.

### Passe d'accessibilité et contraste (25/07, `5685704`, `0222d94`)

Environ 40 écrans pilote audités, 81 constats. Puis relèvement des gris faibles
sur décision du fondateur (« on assouplit »), verrouillé par huit tests dans
`src/theme/__tests__/contrastTokens.test.ts`. **Aucun rapport de lot.**

### Réconciliation des migrations (26/07, `202018c`)

Le dépôt ne contenait que 121 des 215 migrations réellement appliquées : le site
oxvehicle.fr écrit dans le même projet Supabase. Les 94 manquantes ont été
extraites de la base et réécrites, fidélité vérifiée par empreinte md5 sur les
94.

**Vérifié ce jour** : `supabase/migrations/` contient bien 215 fichiers, et
`supabase_migrations.schema_migrations` compte 215 lignes en production. L'écart
est refermé.

Onze fichiers ont été sortis du chemin d'application vers
`supabase/migrations_hors_historique/`. Trois d'entre eux **dégraderaient la
production** s'ils étaient rejoués, dont un qui réinstallerait une version
périmée de `purge_user_data`, contenant un `delete from coach_reviews` sur une
table supprimée. La panne n'aurait été découverte qu'au premier effacement
réellement demandé par un pilote.

### V2-L6 — la bascule (26/07, `29e34f9`)

**Ce lot est postérieur aux deux documents d'état du 26/07**, qui le décrivent
encore comme non commencé. Il a bien eu lieu, et je l'ai vérifié dans le code :

- `app/index.tsx:107` renvoie désormais `<Redirect href="/(app2)" />` ;
- la garde de build qui rendait `(app2)` orphelin hors développement a été
  retirée de `app/(app2)/_layout.tsx` — le commentaire de remplacement, à partir
  de la ligne 63, explique qu'elle aurait produit une boucle de redirection
  **visible en production seulement** ;
- les huit destinations pilote du routage des notifications, les gardes de rôle
  des cinq espaces, `SpaceSwitcher` et `paddockHeroLogic` pointent vers V2.

Trois réserves, écrites dans le message du commit :

1. **L'arbre V1 n'est pas supprimé.** `(app2)` y renvoie volontairement pour
   trois écrans non portés, et l'espace `(pro)` le consomme comme bibliothèque.
2. **Sept écrans V1 restent sans équivalent V2** : `carte-trophee`,
   `creer-route`, `creer-trace`, `mes-routes`, `regularite`, `data-lab-canvas`,
   `share/[token]`. Vérifié : les six premiers sont bien présents dans
   `app/(app)/`, et `app/(app)/share/[token].tsx` aussi.
3. **Trois chemins sont produits par les deux arbres** : `/`, `/club`,
   `/signature`. Lequel gagne n'a pas été observé, faute d'exécution.

Quatre capacités disparaissent au passage à l'intérieur d'écrans par ailleurs
couverts : l'inscription à un événement ouvert, la certification et la
suppression d'une belle route, le catalogue d'offres par catégorie, et
l'écart-type de séance. Ce sont des arbitrages produit en attente.

**Aucun rapport de lot n'existe pour L6.**

Un détail à corriger un jour : l'en-tête de `app/(app2)/_layout.tsx`, lignes 3
à 9, décrit toujours le groupe comme « ORPHELIN » et documente la garde de
build retirée. La documentation du fichier contredit maintenant son code.

### Correctif d'annotation coach (26/07, `93f0638`)

Le dernier commit du dépôt. Trois défauts d'écriture sur le même chemin, dont
deux faisaient **perdre le travail du coach en silence** : une note classée sur
le virage 1 par défaut, un enregistrement sans effet depuis l'écran direct, et
un échec d'enregistrement qui effaçait le texte en passant pour un succès.

Deux problèmes ont été signalés sans être corrigés, faute d'autorisation :
la contrainte `corner_index BETWEEN 1 AND 7` en base (modification de schéma en
production), et `src/lib/circuitTopology.ts`, topologie statique du seul circuit
de Haute Saintonge, dont l'en-tête admet lui-même que les noms de virages sont
« à confirmer ».

**Vérifié en base ce jour** : la contrainte existe bien
(`coach_annotations_corner_index_check`, `CHECK corner_index >= 1 AND <= 7`), et
le circuit Ricardo Tormo est enregistré avec `turns_count = 14`. Un coach ne
peut donc pas annoter les virages 8 à 14 de Valence : l'insertion serait
refusée par la base.

---

## 3. Les lots restants

| Lot | État vérifié | Ce qui le bloque |
|---|---|---|
| **L2-B** — Live Activity iOS | non commencé | travail natif Swift. Vérifié : **zéro occurrence** de `ActivityKit` ou `LiveActivity` dans `app/`, `src/` et `app.json` |
| **BIO-3** — mini-app watchOS | non commencé | dépend de BIO-1 « en production et validé une journée réelle ». Vérifié : zéro occurrence de `WCSession`, `HKWorkoutSession` ou `watchOS` |
| **B1** — vidéo synchronisée | non commencé | trames réelles, drapeau `video_overlay` fermé, coût de stockage à valider |
| **A1-ON** — activation des paiements | non commencé | SIRET. Vérifié : ni `@stripe/stripe-react-native` ni `react-native-iap` dans `package.json` |
| **Purge de l'arbre V1** | non commencé | validation terrain, plus sept arbitrages produit |
| **Coach / Admin en V2** | reporté | « après pilote ». L'espace coach n'a jamais été refondu et n'a **aucune maquette** de référence |
| **Canal biométrie par coach** | non commencé | désigné dans `29d5cfd` comme « la réponse propre, à faire avant d'élargir l'usage » |
| **M4** — migration `events` → `sessions` | non fait | vérifié : **29 appels** à `.from('events')` / `.from('event_registrations')` dans `src/`, et deux écrans **V2** les consomment (`app/(app2)/club/pass.tsx:33`, `app/(app2)/rec/preparation.tsx:46`) — en contradiction avec la règle 6 du dossier maître |
| **26 constats** de l'audit coach du 26/07 | non traités | dont un critique. Ils ne sont documentés **nulle part** dans le dépôt en dehors du message de `29d5cfd` |

Sur ce dernier point, il faut être précis : le message de `29d5cfd` indique
« 1 critique sur l'annotation, des majeurs sur la fabrication de valeurs et des
boutons sans effet ». Le critique sur l'annotation a été traité le lendemain par
`93f0638`. Les 25 autres ne sont ni listés, ni qualifiés, ni datés dans le
dépôt. Je ne peux pas dire ce qu'ils contiennent.

---

## 4. Les verrous qui ne sont pas techniques

C'est le cœur de la question. Rien de ce qui suit ne se résout en écrivant du
code.

### 4.1 Le verrou terrain, chiffré

Le smoke test terrain est le verrou le plus structurant : il conditionne le
calage de `flowService`, l'alimentation des lectures Insight, la mesure du
défilement à 60 images/seconde, le lot B1 et la validation de L6.

J'ai interrogé la base de production en lecture seule. Voici l'état réel :

| Mesure | Valeur en production |
|---|---|
| Séances de télémétrie, toutes statuts | **18** |
| dont `completed` | **10** |
| dont `aborted` | **8** |
| Tours enregistrés, toutes séances confondues | **1** |
| Trames de télémétrie, toutes séances confondues | **53** |
| Relevés météo | **0** |
| Lignes d'insight calculées | **1** |
| Analyses de séance | **13** |

Trois faits en découlent, et ils sont plus durs que ce que disent les rapports.

**Premièrement, aucune séance ne possède à la fois des trames et un tour.** La
seule séance porteuse de 53 trames (`7f40d5ad…`, 28/06) compte **zéro tour**.
La seule séance porteuse d'un tour (`f13545a1…`, 16/05) compte **zéro trame**.
Il n'existe donc, à ce jour, aucun jeu de données complet sur lequel une lecture
Insight puisse s'appuyer.

**Deuxièmement, la dernière séance close remonte au 17 mai 2026.** Toutes les
séances postérieures — 14 juin, 22 juin, quatre le 28 juin, 2 juillet, 15
juillet — sont en statut `aborted`. Je ne peux pas dire pourquoi depuis le code :
`aborted` est le statut posé par `abortCaptureSession`, mais la cause réelle
(annulation volontaire, perte du boîtier, sortie de l'application) n'est pas
enregistrée.

**Troisièmement, zéro relevé météo en base.** Toutes les sections « conditions »
des écrans, qui lisent `weather_snapshots`, sont donc vides en production.

Le rapport L3 parlait de « 10 séances closes, 1 seule avec 1 tour ». Le chiffre
est exact, et il n'a pas bougé depuis le 19 juillet.

### 4.2 Le verrou matériel

Quatre choses demandent du matériel que je n'ai pas :

1. **Un roulage réel avec un RaceBox Mini.** C'est la seule validation que le
   code ne peut pas couvrir, et `roadmap/RUNBOOK_VALENCE.md` le dit en
   conclusion.
2. **Un smoke test à deux appareils** (un pilote, un coach) pour BIO-2. Le
   drapeau `biometry` a été levé sans lui.
3. **Un écran de paddock et deux téléphones** pour LIVE-B. Le rapport le classe
   franchement en « non tenu ».
4. **Un appareil iOS pour mesurer le défilement à 60 images/seconde.** Le
   marqueur `// TODO device-tune` est posé dans le code depuis L3.

Il faut y ajouter une contrainte de compilation. Le dépôt n'a **ni dossier
`ios/` ni dossier `android/`** : la compilation passe par EAS et une génération
native à la volée. Toute dépendance native ajoutée exige donc une nouvelle
compilation, pas une mise à jour à distance. C'est le cas de
`react-native-health` (BIO-1) : le code est écrit, il ne peut pas fonctionner
avant recompilation.

Le dernier état de compilation que je trouve écrit dans le dépôt est
`roadmap/BUILD_DEVICE_CHECKLIST_2026-07-01.md`, qui mentionne un « build #18 »
installé et déjà antérieur aux livraisons de l'époque. L'affirmation « six
builds attendent un verdict », dans `docs/ETAT_APP_2026-07-26.md:154`, n'est
vérifiable depuis aucun fichier du dépôt : je la rapporte, je ne la confirme
pas.

### 4.3 Le verrou des comptes et des rôles

Un point que la lecture du code seule ne révèle pas. J'ai compté les comptes en
production :

| Rôle | `is_admin` | Nombre |
|---|---|---|
| `pilot` | faux | 10 |
| `pilot` | **vrai** | 1 |
| `admin` | **faux** | 2 |
| `partner` | faux | 1 |

Soit **14 comptes**, et **aucun compte `coach`**. Les 37 écrans de l'espace
coach ne s'ouvrent aujourd'hui pour personne. La table `coach_pilots` contient
une ligne, mais aucun utilisateur ne porte le rôle qui donne accès à l'espace.

Les deux comptes `role = 'admin'` ont `is_admin = false`, alors que l'espace
admin est gardé par ce drapeau : ces deux comptes atterrissent dans l'arbre
pilote.

Conséquence directe sur le programme : la procédure de
`roadmap/RUNBOOK_VALENCE.md` (§A, étapes 1 à 4) — créer les comptes, promouvoir
un coach, lier le binôme — **n'a pas été exécutée**. Sans elle, la moitié coach
d'un essai terrain est impossible.

### 4.4 Le verrou SIRET

Le SIRET conditionne A1-ON, donc l'activation des paiements et la facturation
coach. Le dossier maître l'annonce pour août 2026. Il entraîne, en cascade :
l'ouverture d'un compte Stripe en production, la distinction juridique entre
Stripe (journées de piste, service physique) et achat in-app (abonnement
annuel, règle Apple), et la rédaction des CGV.

Le flux de réservation existe déjà, entièrement écrit et entièrement fermé :
`app/(app2)/reserver/index.tsx`, `[sessionId].tsx`, `paiement.tsx`. Le drapeau
`app_payments` est vérifié **sur chaque écran**, pas seulement à l'entrée de
navigation. Vérifié en base : `app_payments` est bien `enabled = false`, avec la
description « Activé au lot A1-ON ».

### 4.5 Le verrou avocat

Trois dossiers, à des stades différents.

**Fait.** L'annexe A, le consentement biométrie, a été validée le 25/07.
`docs/juridique/consentement_biometrie.md` est passé de « VALIDATION AVOCAT
REQUISE » à validé, et la localisation d'hébergement y a été corrigée : Supabase
`eu-west-1`, Irlande, donc dans l'Union européenne. Les notes antérieures
disaient « Frankfurt », c'était faux.

**Ouvert — les CGV.** Marqueur `TODO_AVOCAT CGV` dans
`app/(app2)/reserver/paiement.tsx:152`. Bloque A1-ON avec le SIRET.

**Ouvert — la rétention des incidents.** Marqueur `TODO_AVOCAT E5`, présent à
quatre endroits dont `supabase/functions/purge-deleted-accounts/index.ts:23`.
Le sujet est une contradiction réelle : l'immuabilité probatoire demandée par
l'assurance s'oppose au droit à l'effacement de l'article 17. La position
provisoire retenue est d'anonymiser (`user_id` → `NULL`) plutôt que de
supprimer. Elle n'est pas validée.

**Ouvert — la décharge e-sign.** Le drapeau `pilot_waivers` est fermé en
production, avec la description « activation après relecture avocat ».

À cela s'ajoute un point soulevé par la réconciliation des migrations : deux
fonctions edge sont **déployées et actives en production sans exister dans
aucun code connu ici** — `capture-membre-fondateur` et `yousign-webhook`, toutes
deux avec `verify_jwt: false`. La seconde touche la signature électronique,
donc les décharges. Vérifié : le dépôt contient 32 fonctions locales.

### 4.6 Les actions administratives en attente

Cinq gestes, courts, qui bloquent chacun quelque chose.

1. **Le DSN Sentry.** `docs/architecture/16_SENTRY_SETUP.md` est explicitement
   marqué « ACTION FONDATEUR ». Le code est câblé (`src/lib/sentry.ts`) mais
   inactif. Conséquence : le critère de sortie de L6 — « taux sans plantage
   ≥ 99,5 % sur deux semaines » — est **immesurable**.
2. **Les secrets CI des tests RLS.** `docs/architecture/17_CI_RLS_SETUP.md`,
   environ dix minutes, coût nul (un projet Supabase gratuit suffit). Sans eux,
   85 tests de sécurité ne tournent jamais. Voir §7.
3. **Le document protocole de la ceinture Polar.**
   `OXV_Ceinture_Protocole_Connexion_Biometrie.md` n'a jamais été livré. Le
   parser dérive donc de la spécification publique Bluetooth SIG, chaque vecteur
   de test dérivé à la main. À confronter au document quand il existera.
4. **L'attribution des premiers numéros de voiture.** Geste administrateur
   nécessaire avant la prochaine journée : LIVE-B ordonne le tableau de marche
   par ce numéro, et le rapport précise qu'aucune émission n'a lieu sans pseudo
   publiable.
5. **La suppression des tables `_backup_*`.** 44 lignes portant des données
   personnelles ; la RLS a été activée en défense, la suppression attend un
   accord.

---

## 5. Les décisions en attente, par famille

### 5.1 Arbitrages produit ouverts dans le code

| Marqueur | Emplacement | Sujet |
|---|---|---|
| `TODO_ARBITRAGE` | `src/features/miroir/signatureLogic.ts:8` | conservé **à votre demande** : le mapping Signature reste renégociable mot à mot |
| `TODO_ARBITRAGE D2` | `src/features/miroir/signatureLogic.ts:278` | nom du pilier physiologique BIO-4 — « Aplomb » est provisoire |
| `TODO_ARBITRAGE` | `app/(app)/profil.tsx:385` | statut Fondateur en V1 ; tranché au niveau produit, le marqueur subsiste dans l'écran V1 |

### 5.2 Décisions de schéma, identifiées et chiffrées

1. **Rang fondateur** — `founder_applications` n'a pas de colonne de rang. Un
   « FONDATEUR N° 07 » est donc impossible sans fabriquer une valeur. Affiché
   aujourd'hui « MEMBRE FONDATEUR », sans ordinal.
2. **Véhicule principal** — `garageService` n'a ni `is_primary` ni
   `setPrimary`. « EN TÊTE » désigne le premier véhicule créé, non modifiable.
3. **Chaînon séance → journée** — une colonne
   `telemetry_sessions.day_session_id` vers `public.sessions`. Sans elle, le
   tableau de marche reste lisible du seul binôme coach, alors qu'il devrait
   l'être par tout inscrit de la journée. La migration LIVE-B a **refusé de
   deviner** ce lien.
4. **Compte de service du téléviseur de paddock** — un écran TV n'est pas un
   utilisateur authentifié ; il lui faut son propre chemin d'autorisation.
5. **Bornes des virages annotables** — la contrainte `corner_index BETWEEN 1 AND
   7` empêche d'annoter les virages 8 à 14 de Valence. Signalé, non modifié :
   c'est un changement de schéma en production.
6. **RIB / QR SEPA coach** — schéma IBAN à trancher.
7. **`coach_annotations` et les circuits** — `src/lib/circuitTopology.ts` est
   une topologie **statique de Haute Saintonge** ; `getCorner` renvoie donc un
   nom Beltoise quel que soit le circuit. Annoter une séance à Valence affiche
   « L'épingle Sud ». Consigné, non bricolé.

### 5.3 Calages en attente de données réelles

1. **Le seuil de fluidité.** Reporté au post-piste par décision explicite : il
   doit émerger des percentiles réels. Le service existe, il n'est pas calé.
2. **La circularité de `gSustained`.** Limite connue, écrite, non résolue.
3. **Le défilement à 60 images/seconde.** Marqueur `// TODO device-tune`.
4. **FlowViz.** Reste une démonstration tant que le calage n'a pas eu lieu.

### 5.4 Sept arbitrages produit ouverts par L6

Les sept écrans V1 sans équivalent V2, et les quatre capacités qui disparaîtraient
à la suppression de l'arbre V1. Le commit `29e34f9` les qualifie explicitement
d'« arbitrages produit, pas des oublis techniques — ils attendent Gabin ».

---

## 6. Trois écarts entre l'ordre écrit et l'ordre exécuté

Ils expliquent la forme actuelle du produit.

**L0 avant SEC-1 et BE-1.** L'audit prescrivait l'inverse
(`OXV_V2_AUDIT_EXHAUSTIVITE_SECURITE.md:45`). Le rapport L0 le reconnaît
(`v2-l0.md:64`). Sans conséquence visible : les trois lots sont tombés dans la
même fenêtre de quelques heures.

**L3 avant le verrou terrain.** Sur demande explicite. Conséquence assumée : six
lectures Insight construites puis à moitié dé-mockées dans la même nuit, et
FlowViz qui reste une démonstration.

**Le drapeau `biometry` levé avant le smoke test à deux appareils.** Le coût
s'est matérialisé cinq heures plus tard : les deux fuites de fréquence cardiaque
corrigées par `29d5cfd` étaient armées en production pendant cet intervalle, sur
une donnée relevant de l'article 9.

L'atténuation est réelle et je l'ai **vérifiée en base ce jour**, un jour après
les faits :

| Contrôle | Valeur en production |
|---|---|
| Consentements de capture biométrie posés | **0** |
| Consentements de partage coach posés | **0** |
| Lignes dans `biometry_raw` | **0** |
| Candidatures fondateur | **0** |
| Témoignages coach | **0** |
| Signalements d'incident | **0** |

Rien n'a circulé, rien n'a été stocké. Le drapeau ouvre une capacité, il ne
déclenche aucune collecte.

---

## 7. Tests, typage, lint : les chiffres mesurés

### 7.1 Le typage — vert

`npx tsc --noEmit` sort avec le code **0** et n'imprime rien. Le mode strict est
actif. C'est le contrôle le plus sain du dépôt.

### 7.2 Les tests — 1 847 verts, 98 jamais exécutés

Sortie réelle de `npx jest --ci --coverage=false` :

```
Test Suites: 18 skipped, 140 passed, 140 of 158 total
Tests:       98 skipped, 1847 passed, 1945 total
Snapshots:   1 passed, 1 total
Time:        57.605 s
```

Les 18 suites ignorées sont **exactement** les 18 fichiers de
`src/__tests__/rls/`. Elles couvrent l'accès coach gradué, la télémétrie, les
amitiés, les notes pilote, l'espace partenaire, la modération, le support, la
matrice des rôles, la biométrie, les rapports B2B, les cycles de développement.
Elles s'auto-désactivent : `src/__tests__/rls/setup.ts:22` définit
`RLS_TEST_ENABLED` à partir de `TEST_SUPABASE_URL` et `TEST_SUPABASE_SERVICE_KEY`.
Sans ces variables, `describe` devient `describe.skip`.

**Conséquence : toute la surface de sécurité de la base n'est jamais vérifiée.**
Ce sont 85 tests, et ce sont ceux qui protègent le plus.

### 7.3 Ce que les tests couvrent réellement

La configuration `jest.config.js` est décisive, et elle est explicite dans son
propre en-tête sur ce qu'elle exclut :

- `testMatch: ['**/__tests__/**/*.test.ts']` — **seulement `.ts`, jamais
  `.tsx`** ;
- `testEnvironment: 'node'`, `preset: 'ts-jest'` — aucun rendu React Native,
  aucun DOM.

Ce qui est bien couvert, et solidement : les fonctions pures et les logiques
métier. `src/services` (69 fichiers de test), `src/features/rec`,
`src/features/club`, `src/features/vous`, `src/circuit`, `src/utils`, `src/ubx`,
`src/lib`, `src/ui/v2` pour ses seules logiques calculatoires.

Ce qui est bien couvert, dans le détail, ce sont surtout des **invariants
doctrinaux verrouillés** : l'absence de note dans tout le domaine coach
(`coachDomainNoScore.test.ts`), l'impossibilité de basculer le tableau de marche
en classement (`src/services/boardLogic.ts:57`, constante `BOARD_MODE` figée sur
`'A'`), le dépouillement de tout chrono dans le fil
d'amis, le mapping Signature, les contrastes de couleurs, le comptage de
références des canaux temps réel, la convention des axes G. Ce sont des tests
qui empêchent une régression de doctrine, pas des tests qui prouvent que l'écran
s'affiche.

### 7.4 Ce que les tests ne couvrent pas, et pourquoi

| Domaine | Fichiers | Tests qui l'exercent |
|---|---:|---|
| Écrans (`app/`) | 222 `.tsx` | **0** |
| `src/components` | ~87 | **0** |
| `src/ui` (kit coach/admin) | ~19 | **0** |
| `src/store` (Zustand) | 5 | 1, indirectement |
| `src/hooks` | 8 | 1, sur une logique pure extraite |

**Aucun écran, aucun composant, aucune barre d'onglets, aucun formulaire, aucun
magasin d'état n'est jamais monté par un test.** La raison est structurelle et
assumée : l'environnement Jest est `node`, il n'y a pas de moteur de rendu.
Monter un écran demanderait `jest-expo`, un environnement de rendu, et des
simulacres pour toute la chaîne native.

Cinq familles de code sont, elles, **intestables en l'état** :

1. **Le Bluetooth.** `src/ble/bluetoothService.ts` parle à un boîtier physique.
   Seul le parser binaire (`src/ubx/parser.ts`) et le parser cardio sont
   testables, sur des vecteurs d'octets écrits à la main.
2. **Le temps réel.** Les canaux Supabase Realtime demandent un serveur et deux
   clients. Ce qui est testé, ce sont les logiques pures autour
   (`liveSessionLogic`, `boardLogic`, `stripHealth`, le comptage de références),
   pas le transport.
3. **Le rendu et le mouvement.** Reanimated et Skia s'exécutent sur un fil
   d'exécution natif. Les mathématiques du mouvement sont testées
   (`motionMath`, `vizMath`), pas leur effet visuel.
4. **Les RLS.** Elles vivent dans PostgreSQL, pas dans le code. D'où les 18
   suites qui exigent une vraie base — et qui ne tournent pas.
5. **HealthKit et les Live Activities.** Modules natifs iOS, sans équivalent en
   environnement `node`.

Le seuil de couverture de 70 % déclaré dans `jest.config.js` ne s'applique qu'à
quatre chemins : `src/ubx/**`, `src/utils/**`, `src/types/state.ts`,
`src/types/domain.ts`. Il ne dit rien du reste du dépôt.

### 7.5 Le lint — rouge localement, propre en réalité

`npx eslint` sort en **1** avec **756 remarques**. Le détail compte :

- **751 sont `Delete ␍`**, toutes dans **un seul fichier**,
  `app/(app)/profil.tsx`. J'ai vérifié l'objet Git lui-même :
  `git cat-file blob HEAD:app/(app)/profil.tsx` ne contient **aucun** caractère
  retour chariot. La configuration locale porte `core.autocrlf = true`. C'est
  donc un artefact du poste de travail, pas une dette du dépôt : sur une machine
  Linux d'intégration continue, ces 751 remarques n'existeraient pas.
- **5 sont des avertissements réels** : quatre `react-hooks/exhaustive-deps` sur
  `app/(app)/cartes.tsx:98`, et un `import/first` sur
  `src/services/sessionTelemetryService.ts:27`. Des avertissements ne font pas
  échouer ESLint.

`npx prettier --check` sort également en **1**, et ne signale que ce même
fichier `app/(app)/profil.tsx`, pour la même raison.

### 7.6 Le scan doctrinal — rouge, et il ferait échouer l'intégration continue

`npx tsx scripts/check-doctrine.ts` sort en **1** avec **75 violations**. J'ai
compté leur nature : **70 fois le mot « tap », 5 fois le mot « swipe »**. Aucun
verbe prescriptif interdit — pas un seul « freinez », « accélérez », « vous
devriez ». **La doctrine de fond tient.**

Ce sont des faux positifs structurels, et la cause est identifiable à la ligne
près : la liste d'exceptions du script (`scripts/check-doctrine.ts:112`) ne
blanchit que `haptics.tap`, alors que le code écrit `haptic('tap')` et
`haptic="tap"`. Les violations sont réparties sur les deux arbres pilote et
l'espace partenaire.

**Le fait reste que l'étape « Scan doctrinal » de `.github/workflows/check.yml`
échouerait aujourd'hui sur cette branche.**

### 7.7 Le scan d'accessibilité — vert

`npx tsx scripts/check-accessibility.ts --strict` sort en **0** :
« 222 fichiers scannés — toutes les Pressables avec onPress ont
accessibilityRole ». C'est un contrôle statique : il vérifie la présence d'un
attribut, pas la qualité de l'expérience au lecteur d'écran.

---

## 8. Le travail n'est ni poussé, ni passé par l'intégration continue

Point vérifié par commandes Git, et il n'est pas anodin.

| Référence | Tête | Date |
|---|---|---|
| `origin/main` | `1a803f3` | 29 juin 2026 |
| `origin/feat/site-document-emails` | `21f7dab` | 7 juillet 2026 |
| `feat/site-document-emails` (local, HEAD) | `93f0638` | 26 juillet 2026 |

**130 commits n'ont jamais été poussés.** **251 commits séparent la tête locale
d'`origin/main`.** Concrètement : toute la refonte, la console coach, le
durcissement Valencia, la calibration des circuits, l'intégralité du programme
V2, BIO-1, BIO-2, LIVE-B et L6 n'existent que dans ce clone.

L'arbre de travail est propre — `git status` ne rend rien — donc rien n'est
perdu au niveau du fichier. Mais rien n'est sauvegardé ailleurs.

Second effet : `.github/workflows/check.yml` ne se déclenche que sur un `push`
vers `main` ou une demande de fusion vers `main`. **Ce travail n'est donc jamais
passé par l'intégration continue.** Les contrôles que je viens de lancer à la
main sont les seuls qui aient jamais tourné dessus.

---

## 9. Ce qui n'a jamais été vérifié autrement que par lecture de code

Liste franche, sans atténuation.

**Le produit, tel qu'un pilote le verrait.**

1. Aucun des 38 écrans de l'arbre V2 n'a été affiché. Ni sur appareil, ni sur
   simulateur.
2. La bascule L6 elle-même : `app/index.tsx` renvoie vers `(app2)`, je l'ai lu.
   Que l'application s'ouvre effectivement sur le nouvel arbre n'a pas été
   observé.
3. Les trois chemins produits par les deux arbres — `/`, `/club`, `/signature` —
   n'ont pas été départagés. Lequel gagne est inconnu. Le commit L6 le dit :
   « à tester en premier sur appareil ».
4. `app/(app2)/dev-galerie.tsx`, l'écran de validation prévu pour vous, n'a
   jamais été ouvert.
5. Aucune animation, aucune transition, aucun retour haptique n'a été perçu. Le
   `Dial`, le morphing du héros vers le bilan, le compteur roulant des millièmes,
   les squelettes de chargement : tous écrits, aucun vu.
6. Aucun geste n'a été fait : appui long d'armement, glissement des onglets du
   carnet, pincement du visionneur d'images, tiré-pour-rafraîchir.
7. Le flou iOS et son repli opaque Android n'ont jamais été comparés.
8. VoiceOver n'a jamais été lancé. Le scan d'accessibilité vérifie la présence
   d'attributs, pas ce que le lecteur d'écran annonce.

**Le matériel.**

9. Aucune connexion à un RaceBox Mini réel depuis l'écriture des écrans V2.
10. Aucune connexion à une ceinture Polar H10. Le parser cardio est dérivé de la
    spécification publique Bluetooth SIG, jamais confronté à un appareil ni au
    document protocole, qui n'existe pas.
11. La double connexion Bluetooth simultanée — RaceBox et Polar — n'a jamais été
    éprouvée. La séparation des deux chemins est structurelle dans le code.
12. La reconnexion en piste après une perte de lien n'a jamais été observée.
13. La lecture HealthKit n'a jamais tourné : la dépendance native est présente,
    l'application n'a pas été recompilée depuis.

**Le direct.**

14. Aucun direct à deux appareils. Ni le roster, ni la fiche de focus, ni la
    bande cardio.
15. L'écran de paddock n'existe pas : il vit dans le dépôt du site. Le tableau
    de marche n'a donc jamais été affiché nulle part.
16. La vue Meta Display n'a jamais été portée.
17. Le comptage de références des canaux est verrouillé par neuf tests et
    validé par mutation, mais jamais observé sur deux appareils réels.

**Les données.**

18. Aucune séance dense n'existe en production. Les six lectures Insight n'ont
    jamais eu de matière : je l'ai vérifié en base, aucune séance ne porte à la
    fois des trames et un tour.
19. `flowService` n'a jamais tourné sur des trames réelles. Son seuil n'est pas
    calé, et sa limite de circularité n'est pas résolue.
20. Le défilement à 60 images/seconde n'a jamais été mesuré.
21. La détection de tours par franchissement de porte n'a jamais été validée à
    Valence. La calibration **est** en base — j'ai vérifié : cap 55,20°,
    demi-largeur 10 m, 14 virages — mais la validation prévue le jour J
    (remonter la voie des stands sans déclencher de tour) n'a pas eu lieu.

**L'organisation.**

22. Aucun compte coach n'existe. L'espace coach n'a jamais été ouvert par
    personne.
23. La procédure du runbook Valence — créer les comptes, promouvoir un coach,
    lier le binôme — n'a jamais été exécutée.
24. Les 85 tests RLS n'ont jamais tourné, ni localement ni en intégration
    continue.
25. L'intégration continue n'a jamais vu ce travail : 130 commits non poussés.
26. Sentry n'a jamais reçu un seul événement, faute de DSN.
27. Aucune soumission App Store, aucun TestFlight vérifié dans cette session.

**Ce que je n'ai pas pu établir depuis le dépôt.**

28. L'état réel des compilations EAS. L'affirmation « six builds attendent un
    verdict » vient d'un document du dépôt, pas d'un artefact vérifiable.
29. Le contenu des 25 constats restants de l'audit coach du 26/07. Ils ne sont
    écrits nulle part.
30. La cause des huit séances en statut `aborted` depuis le 14 juin. Le statut
    est enregistré, le motif ne l'est pas.
31. L'origine et le contenu des deux fonctions edge déployées en production sans
    code connu ici — dont `yousign-webhook`, qui touche la signature électronique
    des décharges.
32. L'état des buckets `coach-media` et `partner-media` (lot M5), que je n'ai pas
    interrogé.
