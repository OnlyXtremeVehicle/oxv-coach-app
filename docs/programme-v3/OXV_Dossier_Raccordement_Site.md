# OXV — Dossier de raccordement application ↔ site

**27 juillet 2026** · Document de coordination technique

---

# LE PRINCIPE

**L'application et le site partagent une base Supabase unique** — projet `fouvuqkdxarjpjbqnsjq` — et **la même authentification**. Il n'existe aucune API entre eux : **le schéma est l'interface**.

Cela impose une règle : **toute table écrite des deux côtés doit avoir un propriétaire déclaré**, et l'autre côté n'y touche que par transitions gardées.

## L'état de la répartition

| Domaine | Propriétaire | L'autre côté |
|---|---|---|
| `registrations` | **site** | l'application transitionne et crée — voir D-04 et D-05 |
| `sessions` — les journées | **site** | l'application lit |
| `users` | partagé | à trancher champ par champ — voir D-08 |
| `telemetry_*` | **application** | le site ne touche pas |
| `app_*` | **application** | le site ne touche pas |
| `partner_*` | à trancher | voir D-14 |
| `coach_*` | **application** | le site ne touche pas |

---

# BLOQUANT — À TRAITER EN PREMIER

## D-01 · Les 43 journées disparues

**Constat.** La table des journées ne contient qu'**une ligne** en production, alors qu'une sauvegarde antérieure en portait **44**.

**Ce qu'il faut établir** : que s'est-il passé, quand, et par quelle opération ? Les 43 lignes manquantes sont-elles récupérables depuis une sauvegarde ?

**Enjeu.** Sans journées, l'application n'a rien à afficher : ni prochaine journée ouverte, ni réservation, ni préparation. **C'est le premier blocage du produit.**

**Impératif** : ne lancer **aucun `DROP`** ni aucune migration destructive avant d'avoir tranché ce point.

## D-02 · Les cinq sauvegardes

**Constat.** Cinq sauvegardes existent, de dates différentes, sans qu'on sache laquelle fait référence.

**Ce qu'il faut établir** : leur date, leur contenu, et **laquelle est la référence** en cas de restauration.

## D-03 · L'annotation de dépréciation d'`events`

**Constat.** La table `events` est lue par plusieurs écrans de l'application — dont la préparation d'une journée de circuit et le Pass — alors qu'elle est réservée aux **balades et rassemblements**.

**Décision prise côté application** : la préparation lira `sessions` pour le circuit et `events` pour les balades. Le Pass lira `registrations` et `sessions`.

**Ce qu'il faut du site** : **une annotation de dépréciation explicite** sur les usages `events` qui concernent le circuit, pour que le nettoyage puisse se faire sans casser le site.

---

# LA RÉSERVATION — LE MODÈLE RETENU

## D-04 · L'application constitue le dossier, le site facture

**Le modèle.** L'application **connaît le pilote** — son garage, ses documents, son éligibilité, son numéro — et constitue un dossier complet en trois gestes. **Le site sait encaisser.**

**Le parcours** : le pilote remplit sa demande dans l'application · l'authentification étant partagée, **il retrouve sa demande déjà rédigée en se connectant au site** · il paie sur le site.

**Motif.** Aucun paiement n'a lieu dans l'application, ce qui évacue la question de la commission d'Apple.

**Ce qu'il faut du site.**

1. **Accepter des lignes de `registrations` qu'il n'a pas créées.**
2. **Un état de transmission** — « dossier complet, en attente de paiement ». Ni `pending`, ni `confirmed` : un troisième état.
3. **Afficher au pilote sa demande pré-remplie** dès qu'il se connecte.
4. **Le prix se calcule côté serveur**, jamais côté application — sinon il devient modifiable par le client.

**Question ouverte** : l'application écrit-elle directement dans `registrations`, ou le site crée-t-il la ligne à partir d'un signal ? **À trancher ensemble.**

## D-05 · La règle de propriété

**Le dossier appartient à l'application tant qu'il n'est pas payé, au site une fois payé.**

Avant paiement, le pilote modifie dans l'application et la ligne se met à jour. Après, il passe par le site. Cela évite qu'une modification arrive pendant une facturation.

## D-06 · Le chemin de retour vers le paiement

Le pilote doit atteindre le paiement par **trois canaux** : un lien profond depuis l'application, un courriel, et une notification.

**Ce qu'il faut du site** : l'URL exacte et stable de la page de paiement d'une demande donnée.

## D-07 · `registrations.status` — la transition gardée

**L'application n'écrit `attended` que depuis `pending` ou `confirmed`.** Jamais depuis un autre état, jamais en écrasement.

**Ce qu'il faut du site** : la **liste exhaustive des états** de `registrations.status` et leurs transitions autorisées côté site, pour vérifier qu'aucune collision n'est possible.

---

# LES CHAMPS PARTAGÉS

## D-08 · `users.car_number` — le numéro de voiture

**Décision** : le numéro est **choisi par le pilote et collecté par le site à l'inscription**.

**Ce qu'il faut établir** : le site le collecte-t-il effectivement aujourd'hui ? Sinon, où et quand ?

**Et la résolution de collision** : deux pilotes qui choisissent le même numéro sur la même journée. Le site arbitre-t-il ? L'administrateur arbitre-t-il au paddock — l'application prévoit ce geste — ou les deux ?

**Trois colonnes existent en base et ne sont câblées nulle part** : `bio`, `car_number`, `pavilion_name_optin`. La migration est appliquée ; le code de l'application garde un repli inutile.

## D-09 · `users.role` fait autorité

**Décision côté application** : `role` fait autorité, `is_admin` devient un miroir maintenu par déclencheur.

**Exception nommée** : le compte fondateur `administration@oxvehicle.fr` est **exempté du miroir** — il couvre tous les rôles.

**Ce qu'il faut du site** : confirmer qu'il n'écrit pas `is_admin` directement, faute de quoi le miroir entrerait en conflit.

## D-10 · `public_handle`

Collecté par le site. **Ce qu'il faut établir** : à quel moment, avec quelles règles d'unicité et de format ?

## D-11 · `users.notification_preferences`

**Le stockage existe** — JSONB. L'application y écrira les préférences de quatre canaux et les « rituels ».

**Ce qu'il faut du site** : confirmer qu'il ne l'écrase pas, et déclarer les clés qu'il y utilise déjà.

## D-12 · Le fuseau horaire du pilote

L'application doit stocker le fuseau du pilote pour calculer le report nocturne des notifications **côté serveur**, entre 22 h et 8 h.

**Ce qu'il faut** : une colonne, et l'accord sur qui la renseigne.

---

# L'ÉLIGIBILITÉ

## D-13 · Qui écrit `eligibility_items`

**Constat.** La table existe — neuf items, quatre statuts, clé sur `registration_id`. Elle porte `validated_by`, `validated_at` et un `document_id` vers `documents`.

Son commentaire attribue l'écriture à **l'administration et au système**. **Aucun écran de l'application ne l'écrit aujourd'hui.**

**Ce qu'il faut établir** : le site l'écrit-il ? Une tâche automatique la remplit-elle depuis les documents déposés ?

**Ce que l'application ajoutera** : **une seule colonne, `declared_at`** — la date de déclaration par le pilote, distincte de la date de validation par l'administration.

**Enjeu.** L'article L321-1 fait peser l'obligation d'assurance sur l'organisateur. En cas d'incident, « le pilote a déclaré son assurance valide le 3 avril, nous avons contrôlé le 14 » n'a pas la même valeur qu'une case cochée.

---

# LES PARTENAIRES ET LE TERRITOIRE

## D-14 · Le vocabulaire à figer

L'application fixe trois énumérations, à partager avec le site :

**`type`** — privilège, prestataire, vitrine. Plus une quatrième nature à créer : **le partenaire technique**, qui écrit dans le carnet d'entretien d'un véhicule.
**`contact_policy`** — cinq modes : médiée, directe, externe, réservation, aucune.
**`channel`** — cinq origines : catalogue, éligibilité, garage, territoire, journée.

## D-15 · La suppression d'`is_premium`

**Décision** : `is_premium` est supprimé des quatre tables du Territoire — services de circuit, hébergements, restaurants, annonces.

**Motif** : c'est un vestige d'un modèle abandonné. Le modèle financier porte, ligne 49 : *« PLV — emplacements vendus (0 : décision fondateur, régie 100 % saison) »*, datée du **12 juillet 2026**.

**Ce qu'il faut du site** : confirmer qu'il ne s'en sert pas.

## D-16 · `social_pings` réservée aux partenaires

**Décision** : les annonces sont réservées aux partenaires, avec des règles éditoriales portées par le contrat — ni compétition, ni chronométrage, ni classement annoncés.

**Ce qu'il faut du site** : la modération, si elle existe, vit côté site.

---

# LE STATUT FONDATEUR

## D-17 · La jonction entre candidature et signature

**Constat.** Deux tables existent et **ne se rejoignent pas** : `founder_applications`, côté application, clé `user_id` · `founding_members`, côté site, clé **email**, alimentée par la signature Yousign.

**Ce que l'application ajoutera** : `users.founder_since`, un `founder_number` attribué **par séquence dédiée**, et un `user_id` sur `founding_members`.

**Le mécanisme** : le numéro s'attribue **à la signature**, dans l'ordre réel ; il est propagé au compte lors du rattachement, par correspondance d'adresse. **Le numéro reste celui de la signature, jamais celui de l'inscription.**

**Ce qu'il faut du site** : écrire `user_id` sur `founding_members` quand il est connu, et **ne jamais réattribuer un numéro**.

---

# LES ÉCURIES

## D-18 · Le parrainage et le paiement

**Constat.** Un déclencheur sur `public.payments` bascule `crew_members.referral_validated` quand un statut passe à `succeeded`. **Un filleul qui s'inscrit sans payer ne compte pas.**

**Ce qu'il faut du site** : confirmer que `payments.status` prend bien la valeur `succeeded`, et à quel moment exact du parcours.

## D-19 · L'avantage du parrain

**Constat.** Aucun avantage n'existe en base : `referral_validated` n'est qu'un booléen.

**Décision** : l'avantage est **symbolique** — le nom de l'écurie, l'appartenance. Aucun avantage commercial.

**Ce qu'il faut du site** : confirmer qu'il n'a pas prévu d'avantage commercial de son côté.

---

# LES SORTIES SERVEUR

## D-20 · Ce qui doit être généré côté serveur

Quatre sorties **ne peuvent pas être produites correctement sur mobile** :

**La vidéo synchronisée** — `expo-video` ne garantit aucun décodage image-exact ni incrustation fiable. Rendu par ffmpeg.
**Le PDF de bilan** — `expo-print` est limité, et l'export Skia hors écran reste en sRGB.
**La carte-souvenir** — même motif, qualité d'impression.
**Le livret de saison** — adossé à `heritageBookExportService`.

**Ce qu'il faut établir** : où ces générations tournent — fonctions Edge Supabase, ou infrastructure du site ?

## D-21 · Le curve boxplot de la mémoire du circuit

Le calcul de profondeur pour l'agrégation des trajectoires demande **environ une minute pour cinquante trajectoires**. **Ce n'est pas un calcul temps réel.**

**Ce qu'il faut** : un emplacement pour ce pré-calcul, périodique, et une fonction `security definer` qui **ne retourne que des agrégats**, jamais une ligne individuelle.

---

# L'APPAIRAGE APPLICATION-SITE

## D-22 · `app_pairing_codes`

> **NUMÉRO PARTAGÉ.** « D-22 » désigne aussi, dans `docs/DETTE.md`, une dette
> sans rapport (les liens de l'app vers le site). Préciser le registre en
> parlant de « D-22 ». Ici : **le registre des décisions**, l'appairage.

**Constat.** La table existe et compte **zéro ligne**. Le mécanisme n'a jamais fonctionné.

**Bonne nouvelle** : le modèle de réservation retenu — panier pré-rempli, authentification partagée — **rend l'appairage moins critique**. Le pilote se connecte simplement au site avec son compte.

**Ce qu'il faut établir** : l'appairage reste-t-il nécessaire à l'onboarding, ou peut-il être abandonné ?

---

# CE QUE NOUS ATTENDONS

**Par ordre d'urgence.**

**Aujourd'hui** : D-01 les 43 journées · D-02 les sauvegardes. **Rien ne peut avancer sans elles.**

**Cette semaine** : D-04 à D-07, le modèle de réservation — c'est ce qui conditionne le tunnel entier.

**Avant le premier développement d'écran** : D-08 à D-13, les champs partagés et l'éligibilité.

**Le reste** peut suivre le rythme des jalons.

---

# RÈGLE DE SÉCURITÉ, VALABLE DÈS MAINTENANT

**Aucune migration destructive** — `DROP`, `TRUNCATE`, `DELETE` massif — **tant que D-01 et D-02 ne sont pas tranchés.**

Une table à une ligne alors qu'une sauvegarde en porte quarante-quatre est le signe qu'une opération s'est mal passée. **Il ne faut pas en ajouter une seconde.**
