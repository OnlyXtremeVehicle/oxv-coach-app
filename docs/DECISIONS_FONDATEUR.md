# Ce qui attend une décision de votre part

> Ouvert le 04/08/2026. Un seul endroit pour tout ce qui est arrêté faute d'un
> arbitrage, à travers les neuf jalons du programme V3 et la coordination avec
> le site.
>
> **Ce document ne remplace pas `docs/DETTE.md`.** La dette recense ce qui est
> constaté ; celui-ci recense ce qui est *bloqué*, et par quoi.
>
> Il est tenu à jour au fil des jalons. Une décision prise est déplacée en bas,
> dans « Décidé », avec sa date — pour que la liste raccourcisse au lieu de
> gonfler.

---

## Comment lire ce document

Trois natures, et il ne faut pas les confondre.

**DÉCISION** — un choix entre deux options défendables. Personne d'autre que
vous ne peut le trancher, parce qu'il engage le produit, le droit ou l'argent.

**GESTE** — aucune décision à prendre, mais une action que seul votre compte
peut faire : un secret à créer, un compte à ouvrir, dix minutes sur un iPhone.
Ce sont les plus faciles, et ce sont ceux qui traînent le plus longtemps.

**AVIS D'UN TIERS** — un avocat, un expert-comptable. Ni vous ni moi.

Chaque entrée porte ce qu'il en coûte de ne pas trancher. Certaines ne coûtent
rien aujourd'hui, et c'est écrit aussi.

---

# 1 · CE QUI ARRÊTE DU TRAVAIL AUJOURD'HUI

## 1.1 — DÉCISION · La typographie : trois questions liées

**Jalon 2, Phase 1.** C'est le seul point de la Phase 1 encore ouvert.

**Ce qui est mesuré.** Le dépôt porte **cinq** familles de caractères, là où le
plan en nomme trois : Hanken Grotesk, JetBrains Mono, Inter, Syncopate,
Michroma. Trois tables de jetons concurrentes, trois langages de titre.

**a. Le trio du plan a-t-il été refusé par vous, ou par moi ?**

Le plan de montage (27/07) nomme *Söhne Breit · SF Pro · JetBrains Mono*.
L'adoption de Hanken Grotesk date du **10/07** — donc le plan est le document
le plus récent, et il nomme un trio que le dépôt ne porte pas. Ce qui vient
après, c'est le refus : `DETTE.md` D-12, le 28/07, motivé — Söhne est une fonte
commerciale sous licence Klim, SF Pro est réservée à Apple.

Le motif est solide. Mais D-12 porte la mention « traité par : décision
fondateur », et **je n'ai trouvé aucune trace de cet arbitrage hors du dépôt**.
Si cette mention est une auto-attribution, le point n'est pas tranché.

> *Ma recommandation :* confirmer le refus. Les deux fontes du plan sont
> juridiquement indisponibles ; le sujet n'est pas esthétique.

**b. Michroma et Syncopate : on consolide, ou on assume par écrit ?**

Toutes deux sont **antérieures** au plan (Programme V2 le 18/07, lot
PROFIL_CARTES le 17/07). Ce ne sont donc pas des décisions postérieures qui
excuseraient l'écart : ce sont précisément les systèmes que le plan voulait
consolider. Aucune entrée de dette ne les consigne.

> *Ma recommandation :* consolider vers Hanken. Trois langages de titre sur une
> application de cinq onglets, c'est un accident d'historique, pas une intention.

**c. Le point ou la virgule pour les chronos ?**

Deux règles écrites se contredisent. Le plan : *« séparateur décimal : virgule.
`1:41,203`, jamais `1:41.203`. Corriger partout. »* Et
`src/lib/queries/cartesLogic.ts:44` : *« POINT décimal (jamais de virgule —
norme chronométrage) »*, avec un test qui le verrouille. Aucune source n'est
citée pour cette norme.

J'ai converti 27 chaînes vues par le pilote à la virgule le 04/08, et **laissé
`cartesLogic` intact** — j'avais commencé par renverser son test au passage, je
l'ai rétabli.

> *Ma recommandation :* la virgule partout dans le produit. C'est une
> application française pour des clients français. Si une norme de chronométrage
> impose le point sur un document officiel, elle concerne ce document, pas
> l'écran d'un pilote.

**Coût de l'attente :** la Phase 1 ne peut pas être déclarée close, et le
Jalon 2 ne peut pas passer en Phase 2.

---

## 1.2 — DÉCISION · Le rythme de la grille : `space.lg = 18`

**Jalon 2, Phase 1.**

Le dossier pose une base de 8 avec demi-pas à 4. `src/ui/v2/tokens.ts:64` porte
`space.lg = 18` — hors du pas comme du demi-pas. Il est employé **236 fois** et
couvert par **aucun test**.

Le corriger déplace 236 mises en page. Ce n'est pas un correctif qu'on glisse :
ça se regarde sur un écran avant de se décider.

> *Ma recommandation :* passer à 16 après un build, en regardant trois écrans
> denses. 18 n'est pas un choix, c'est une valeur qui a échappé à la règle.

**Coût de l'attente :** faible. Le rythme est imparfait, rien ne casse.

---

## 1.3 — DÉCISION · La Phase 2 touche l'autorisation : j'y vais ou pas ?

**Jalon 2, Phase 2.** Le plan l'écrit lui-même : *« ce lot touche
l'autorisation. Une erreur ici verrouille des comptes. »*

Il s'agit de faire de `role` la source d'autorité et de `is_admin` un miroir
maintenu par déclencheur. Avec une exemption obligatoire dans la même migration :
`administration@oxvehicle.fr` porte `role = 'pilot'` et `is_admin = true` — le
miroir le rétrograderait et **le verrouillerait hors de son propre espace
d'administration**.

Je peux préparer la migration et vous la soumettre sans l'appliquer, comme
`PROPOSITION_mark_attendance.sql`. Je ne l'appliquerai pas sans votre mot.

> *Ma recommandation :* oui, préparer. Mais l'appliquer un jour où vous êtes
> disponible pour vous reconnecter juste après et confirmer votre accès — c'est
> l'acceptation que le plan exige, et elle ne se délègue pas.

**Coût de l'attente :** le Jalon 2 s'arrête là.

---

## 1.4 — DÉCISION · La purge RGPD : 55 couples sans statut

**Jalon 2, Phase 3, lot 10.** Le sujet le plus lourd du jalon.

`supabase/verifications/couverture_purge.sql` se rejoue. Rejoué le 04/08 :

| | 28/07 | 04/08 | écart |
|---|---|---|---|
| couples totaux | 119 | 129 | +10 |
| couverts | 67 | 66 | −1 |
| **non couverts** | **52** | **63** | **+11** |

Huit des 63 sont des tables internes de Supabase, hors de notre ressort. **Le
trou applicatif réel est de 55**, et il s'est creusé de onze en sept jours.

La matrice de rétention (`docs/architecture/14_PURGE_MATRIX.md`) justifie les
27 du référentiel `public.users` — rétention comptable de dix ans, colonnes
d'acteur administratif, une décision produit. **Les autres ne sont statués nulle
part.** Parmi eux : `pilot_notes`, `pilot_waiver_signatures`,
`pilot_signature_snapshots`, `coach_invoices`, `pilot_development_cycles`.

Toutes ces tables sont à zéro ligne aujourd'hui. Le préjudice est nul. **Elles
se rempliront à la première journée réelle.**

Ce que j'attends de vous : pour chacune, **effacer ou conserver**, et si
conserver, sur quel fondement. Je peux vous préparer la liste en tableau à
cocher si c'est plus simple.

> *Ma recommandation :* effacer tout ce qui n'a pas d'obligation légale de
> conservation. Une signature de décharge relève probablement de la prescription
> — c'est le point à poser à l'avocat (§3.1).

**Coût de l'attente :** nul jusqu'à la première journée réelle. Non nul après.

---

## 1.5 — RIEN À DÉCIDER · Les Insights : c'était déjà fait

**Entrée ouverte puis refermée le 04/08/2026, le jour même.** Je l'avais posée
comme une décision en attente. Vérification faite, le lot 13 est livré et
branché — il n'y a rien à trancher.

`src/components/insights/disponibilite.ts` porte les trois états `disponible` ·
`absent` · `demo`, avec `productionAutorise` qui interdit le rendu du troisième
hors développement. `src/services/sessionInsightsService.ts` filtre par
`engine_version` sur une liste blanche de moteurs réels, avec un second verrou
côté client au cas où le filtre serveur sauterait. Et
`app/(app2)/data/session/[id].tsx:99` consomme `etatLecture` et
`sectionAffichable`.

La conséquence annoncée par le plan tient toujours : tant que rien n'est mesuré,
la section s'efface. C'est le comportement voulu, et il est en place.

Consigné plutôt que supprimé : une entrée qui disparaît sans trace laisse penser
qu'on l'a oubliée.

---

## 1.6 — L'ÉTAT RÉEL DE LA PHASE 3, vérifié le 04/08

Le plan décrit cinq lots bloquants. Trois n'en sont plus.

| Lot | État vérifié |
|---|---|
| 10 · Purge RGPD | **Ouvert** — 55 couples sans statut. Voir §1.4. |
| 11 · `registrations.status` | **Ouvert** — la RPC attend votre mot. Voir §2.1. |
| 12 · `registration_id` jamais devinée | **Tenu par construction.** La colonne n'existe pas sur `telemetry_sessions`, et rien ne l'écrit. Consigné en D-45 : le jour où ce lien sera voulu, le chemin facile sera le rapprochement par date, et il se trompera. |
| 13 · Insights, liste blanche | **Fait.** Voir §1.5. |
| 27bis · Déclencheur `coach_availability` | **Fait, les deux moitiés.** Le déclencheur pose `pending_validation` et non plus `closed` ; `creneauMessageLogic.ts` le dit à l'écran — « Créneau proposé », « en attente de validation ». |

Autrement dit : **le Jalon 2 tient en trois arbitrages** — la typographie
(§1.1), la migration d'autorisation (§1.3), et la rétention RGPD (§1.4) — plus
la RPC de pointage côté site (§2.1).

---

# 2 · CE QUI ATTEND LE SITE

Ces points sont bloqués par une équipe qui attend une réponse de vous, ou par
un geste sur l'autre dépôt.

## 2.1 — DÉCISION · `PROPOSITION_mark_attendance.sql`, et son ordre

Le site s'apprête à révoquer `UPDATE` colonne par colonne sur `registrations`.
Sa liste contient `attended_at` mais pas `attended_by` ni
`attendance_updated_at` — or l'application écrit les trois d'un coup, et
**Postgres refuse l'instruction entière dès qu'une colonne manque au droit**.
Le pointage des présences tomberait net, le jour d'un roulage, au circuit. Et
pour les administrateurs aussi, les grants se vérifiant avant la RLS.

La contrepartie est écrite et non appliquée. L'ordre est contraignant : RPC,
puis bascule de l'application, puis REVOKE. **Notre étape intermédiaire passe
par une revue App Store** — ce n'est pas un déploiement web.

> *Ma recommandation :* appliquer la RPC. Elle ne casse rien à elle seule, et
> elle ferme au passage un défaut de notre côté : la garde qui interdit de
> pointer une inscription annulée tourne aujourd'hui dans l'application, donc
> n'importe quel jeton authentifié peut l'ignorer.

## 2.2 — DÉCISION · Les cinq contradictions relevées par le site

Ils attendent votre arbitrage, pas le mien. Rappel de leur formulation :

1. `events` conservé pour les balades, alors que la base porte
   `DEPRECATED — À SUPPRIMER`, écrit le 30/06 ;
2. le prix se calcule dans le navigateur, et tout pilote peut réécrire
   `price_total` sur sa propre ligne ;
3. `is_premium` : le site s'en sert à quatre endroits, sa suppression casse
   l'annuaire partenaires ;
4. le parrainage est décrit comme « symbolique, sans avantage commercial », mais
   le site promet déjà trois paliers dont deux sont opérationnels ;
5. l'homonymie D-22 — levée, et notre dossier est corrigé.

## 2.3 — DÉCISION · L'URL de paiement `/paiement/{registration_id}`

Techniquement, elle s'intègre sans obstacle : le statut `pending_payment` est
déjà libellé, l'identifiant est en portée, et l'application ouvre déjà
`oxvehicle.fr/compte-sessions`.

**Ce n'est pas pour autant une validation.** Ouvrir un parcours de paiement
depuis l'application touche la revue App Store sur les services vendus hors
application. C'est votre arbitrage, pas le mien.

## 2.4 — GESTE · Le merge de leur branche sur `main`

Leur branche est poussée, `main` n'a pas bougé, et Vercel ne déploie que `main`.
Tant que le merge n'a pas lieu, `/share/{jeton}` ouvre la page d'accueil : le
lien de partage de l'application ne mène nulle part. Second registre de D-22,
toujours ouvert.

## 2.5 — DÉCISION · Les trois énumérations partenaires

Ils attendent les valeurs exactes. Je n'ai pas d'avis : c'est du vocabulaire
produit.

---

# 2bis · JALON 3 — LE FLUX REC

Relevé le 05/08/2026 par inventaire adversarial des huit écrans.

## 2bis.1 — DÉCISION · Le plan demande deux écrans que la dette dit inutiles

`OXV_Mirror_V3_Arbre_Pilote.md:197` et `:218-224` réclament deux écrans neufs,
`rec/appairage` et `rec/consentement`. Aucun n'existe.

Ce n'est pas un oubli : votre décision du 01/08 (`DETTE.md:761`, commit `ea637f0`)
a replié le consentement en feuille sur `equipement`, et maintenu le flux à huit
étapes. Les deux textes coexistent, et se contredisent.

**Conséquence pratique :** une relecture du plan conclut « il manque deux
écrans » ; une relecture de la dette conclut « c'est fait ». Le prochain qui
lira l'un sans l'autre se trompera.

> *Ma recommandation :* amender le plan, pas le code. Votre décision est plus
> récente et mieux motivée — le pilote vient de connecter son boîtier, c'est là
> que la question du cardio a un sens.

## 2bis.2 — DÉCISION · Le chrono en roulage : le code est plus strict que le plan

`Arbre_Pilote.md:240` dit que l'écran de roulage « affiche le chrono et le
dernier tour bouclé ». `roulage.tsx` n'affiche **aucun chrono** — et le revendique
en en-tête, au nom du Principe 3.

Je m'attendais à trouver une violation. C'est l'inverse : l'implémentation est
plus silencieuse que ce que le plan autorise.

> *Ma recommandation :* garder le silence total et amender le plan. Un chiffre
> qui bouge en piste appelle le regard, et c'est exactement ce que le Principe 3
> refuse. Le chrono figé existe déjà un écran plus loin.

## 2bis.3 — DÉCISION · La barre d'onglets : deux règles écrites s'opposent

`Plan_Montage.md:229` : « barre masquée en roulage seulement ».
`centralButtonLogic.ts:98` la masque sur **cinq** segments du flux.

L'une des deux doit céder.

## 2bis.4 — DÉCISION · Le « passable » du QCM, en haut à droite

`Arbre_Pilote.md:262` place l'action « passer » en haut à droite. La règle des
cibles du même jalon dit : « aucune action critique dans le tiers supérieur ».
À trancher **avant** de dessiner l'écran, pas après.

## 2bis.5 — DÉCISION · La ceinture cardio réservée aux pilotes coachés

`equipement.tsx:894` applique cette règle. Elle est assumée en commentaire et
n'apparaît dans aucun document de cadrage.

## 2bis.6 — SCHÉMA · Trois changements, à soumettre sans appliquer

- **`pilot_notes` structuré.** La table ne porte qu'un `body text`. Le plan le
  dit : « un texte libre ne se croise pas ». Le QCM de l'entre-runs ne peut pas
  être livré proprement avant. Le vocabulaire des options devra rester aligné
  sur celui de la variable coach.
- **`declared_at` sur `eligibility_items`.** Absente ; dix occurrences dans le
  dépôt, toutes documentaires.
- **Une policy d'écriture pilote sur `eligibility_items`.** Même avec la
  colonne, le pilote ne pourrait rien déclarer : l'`UPDATE` y est réservé à
  `is_admin()`. Second changement, second accord.

## 2bis.7 — DÉCISION PRODUIT puis SCHÉMA · Qui possède la ligne d'éligibilité

Question D-13 de `docs/CE_QUI_ME_MANQUE.md:91`, jamais tranchée : le site ou
l'application. Elle bloque le bloc d'éligibilité en tête de préparation.

À savoir avant de trancher : **le pilote n'est pas aveugle aujourd'hui.** La
fonction serveur `eligibility-reminders` lui envoie à J-14, J-7 et J-2 la liste
nominative de ce qui manque, avec renvoi vers le site. Le défaut est un défaut
de rapatriement dans l'application, pas une absence d'information.

## 2bis.8 — DÉCISION · La préséance pilote : il n'y a rien à arbitrer, encore

Le plan demande que le ressenti du pilote prime sur « la variable posée par le
coach ». **Aucun producteur de cette variable n'existe.** Le coach écrit des
objectifs que rien dans l'espace pilote ne lit, et ce n'est pas le même objet.

Il faut d'abord trancher **quel objet** est cette variable. C'est un lot, pas un
correctif.

---

# 3 · CE QUI ATTEND UN TIERS

## 3.1 — AVIS · L'avocat

Trois sujets, et ils se posent ensemble :

- les **décharges de responsabilité** (lot P3) : le logiciel est livré et gaté
  hors ligne, il attend une relecture avant d'être allumé ;
- la **durée de conservation** d'une signature de décharge — c'est la question
  qui débloque §1.4 ;
- le **dossier avocat** du programme V3 (`docs/programme-v3/OXV_Dossier_Avocat.md`),
  jamais transmis.

## 3.2 — GESTE · Le SIRET

Bloque l'activation de l'économie coach : facturation, versements, et la
validation des créneaux.

---

# 4 · DES GESTES, PAS DES DÉCISIONS

Aucun arbitrage à rendre. Seul votre compte peut les faire.

## 4.1 — Les secrets d'intégration continue

**85 tests de politique de sécurité n'ont jamais tourné.** Ils sont écrits,
ils attendent des secrets qui n'ont jamais été créés. Procédure dans
`docs/architecture/17_CI_RLS_SETUP.md`.

**Ne les pointez jamais vers la production.** Ces tests écrivent.

Le même geste débloque la vérification de couverture de purge (§1.4), qui
devrait faire échouer la chaîne quand un couple non couvert apparaît, et qui ne
le peut pas faute d'accès base. Deux gardes, une cause.

## 4.2 — Dix minutes sur l'iPhone, cinq écrans

C'est la dernière condition pour clore T0 du Jalon 1. La liste est prête :
`docs/T0_ACCEPTATION_VISUELLE.md`, cinq écrans qui couvrent les douze familles
d'animation.

**Coupez d'abord « Réduire les animations »** dans les réglages d'accessibilité.
Cinquante fichiers du dépôt s'y conforment : s'il est actif, tout sera figé,
correctement, et indistinguable d'une migration cassée.

## 4.3 — Un exécuteur à appareil dans la chaîne

Bloque T3 du Jalon 1 — la mesure des temps d'image sur appareil réel. Le
workflow existe, désactivé, en attente d'une étiquette d'exécuteur qui n'existe
pas. Ce n'est pas réglable depuis un poste Windows.

## 4.4 — Une séance réelle à Valence

Bloque, en cascade : la calibration de tous les seuils du socle de calcul, la
fermeture du delta sur une trace enregistrée, le remplissage des six lectures
d'Insight, et la vérification de la célébration de record — seule famille
d'animation qu'aucune liste de bureau ne peut couvrir.

## 4.5 — La publication de `origin/main`

`main` est **68 commits derrière** la branche de travail. Ce n'est pas un
problème technique ; c'est une décision de publication qui n'a jamais été prise.

---

# 5 · CE QUI DÉRIVE SANS RIEN BLOQUER

Ces points n'arrêtent aucun travail. Ils s'aggravent doucement.

## 5.1 — DÉCISION · La chaîne de freinage : l'armer ou la retirer

Elle est morte de bout en bout, à une prop près. Un layer entier qui ne peut
pas s'allumer parce qu'aucun appelant ne passe la prop qui le déclenche.
Deux issues, et c'est un choix produit : l'armer, ou la retirer franchement.

## 5.2 — DÉCISION · Réveiller le socle de calcul T1bis ?

Cinq modules purs et testés dorment sans appelant. `DETTE.md` D-40 a conclu
« laisser dormir », avec un critère explicite : un module ne vaut d'être branché
que s'il **remplace** du code qui fait moins bien.

Rouvrir cette décision n'est pas une tâche de lot : brancher le socle changerait
les valeurs publiées au pilote et au coach.

## 5.3 — Deux propositions en attente, sans urgence

- `supabase/migrations/PROPOSITION_L34_realtime_seances.sql`
- `docs/PROPOSITION_POLITIQUE_8_3.md`

## 5.4 — À enquêter avant Valence, et ce n'est pas une décision

`DETTE.md` D-43 : les apex de Haute Saintonge sont posés en fraction d'**indice**
de polyline et lus en fraction de **distance**. Écart mesuré jusqu'à **371 m sur
un circuit de 2231 m**. Ce chemin tourne à la fin de chaque séance et persiste
son résultat.

Ce qui n'est **pas** établi, et qu'il ne faut pas déduire : si cette analyse est
bornée au circuit de Haute Saintonge, et ce qu'elle devient sur une séance à
Valence. À traiter comme sujet propre.

---

# 6 · DÉCIDÉ

*Les décisions rendues, avec leur date. Cette section grossit ; celles du haut
raccourcissent.*

| Date | Sujet | Décision |
|---|---|---|
| 03/08 | Fonction de détection des virages | Déployer et calculer |
| 03/08 | Rayon de Valence | Délégué — « je te laisse réfléchir au mieux » |
| 03/08 | La Charade | Détacher puis supprimer |
| 03/08 | Contrainte `corner_index` | Autorisée |
| 01/08 | Dépôt GitHub public | Assumé — la RLS est la seule barrière |
