# Synthèse juridique OXV — Brief pour l'avocat

**Trois documents complémentaires pour cadrer OXV et OXV Coach**
**Date de rédaction : Mai 2026**
**Statut : V1 à valider par un avocat spécialisé en droit du sport mécanique**

---

## L'architecture juridique en trois documents

OXV opère désormais sur deux dimensions complémentaires :

- **Une prestation de track day premium** (la journée de roulage au Circuit de Haute Saintonge)
- **Une application mobile de visualisation télémétrique** (OXV Coach)

Ces deux dimensions appellent **trois documents juridiques distincts**, qui se complètent sans se chevaucher :

| Document | Nature | Quand le pilote l'accepte | Effet juridique |
|---|---|---|---|
| **CGV prestations OXV** | Contrat de prestation de services | À la réservation d'une session | Définit les conditions commerciales (prix, paiement, annulation, sécurité piste) |
| **CGU app OXV Coach** | Contrat de fourniture de service numérique | À la première activation de l'app | Définit l'usage de l'app, le traitement RGPD, la responsabilité éditeur |
| **Pacte de pilotage** | Déclaration unilatérale d'engagement | À la première activation de l'app | Reconnaît expressément la nature et les limites de l'app |

---

## Pourquoi trois documents distincts

C'est une question de **portée juridique** et de **lisibilité contractuelle**.

**Les CGV** couvrent l'**acte d'achat** d'une prestation tangible (la journée track day). Elles sont un contrat synallagmatique classique : OXV s'engage à fournir un service contre paiement.

**Les CGU** couvrent l'**usage d'un outil numérique**. Elles ne créent pas d'obligation de paiement (l'app est gratuite pour le lancement) mais définissent l'usage, le traitement des données, et la responsabilité de l'éditeur logiciel.

**Le pacte** n'est ni un contrat de vente, ni un contrat de service. C'est une **déclaration unilatérale du pilote** qui reconnaît qu'il a compris quelque chose. Sa valeur est probatoire : en cas de litige, OXV pourra démontrer que le pilote avait connaissance de la nature non-instructionnelle de l'app.

Cette séparation a une vertu protectrice : **si une clause d'un document est jugée nulle, les deux autres restent valides**. C'est l'inverse de regrouper tout dans un document unique qui peut tomber d'un seul coup.

---

## Décisions stratégiques actées

Lors de la rédaction, trois décisions de fond ont été prises avec l'éditeur :

### Décision 1 — Forme juridique : SASU

OXV est constituée sous forme de **SASU (Société par Actions Simplifiée à associé unique)**.

Cette forme a été préférée à l'EURL pour deux raisons :
- Plus souple sur les statuts et la gouvernance, adaptée à un projet en évolution
- Mieux perçue par les partenaires numériques (investisseurs, plateformes, banques en ligne)
- Permet une cession ou un partage de capital ultérieur plus simple

### Décision 2 — App gratuite au lancement

L'application OXV Coach est **gratuite pour tous les pilotes inscrits aux prestations OXV** pendant la phase de lancement.

Aucun abonnement séparé n'est facturé. L'usage de l'app est inclus implicitement dans la prestation track day.

Une évolution du modèle commercial reste possible (CGU article 3.4) sous réserve de préavis de trente jours.

### Décision 3 — Responsabilité pédagogique déclinée, responsabilité technique conservée

C'est le point le plus délicat juridiquement. Trois questions :

**OXV peut-elle décliner toute responsabilité ?** Non. Le droit français rend nulles les clauses qui suppriment toute réparation pour le consommateur (article L212-1 du Code de la consommation). Une clause « OXV décline toute responsabilité » serait réputée non écrite, et aggraverait la situation d'OXV.

**OXV peut-elle décliner sa responsabilité pédagogique ?** Oui, et c'est essentiel. L'app n'est pas un coach diplômé, ne donne aucune instruction, n'est pas un dispositif d'aide à la conduite. Cette nature non-instructionnelle est répétée trois fois dans les documents (CGU article 4.2, pacte article 1, CGV article 9.4).

**OXV doit-elle assumer sa responsabilité technique ?** Oui, et c'est obligatoire. L'app doit fonctionner, ses calculs doivent être honnêtes, ses données doivent être préservées. Cette responsabilité est conservée et limitée à 12 mois de prestation par pilote (CGU article 7.3).

---

## Points à arbitrer avec l'avocat

Cette V1 est utilisable comme base de travail. Mais plusieurs points nécessitent l'arbitrage d'un avocat spécialisé en droit du sport mécanique :

### Point 1 — Compétence juridictionnelle envers les consommateurs

L'article 16 des CGV indique que tout litige est porté devant le ressort du siège d'OXV. Cette clause peut être considérée comme **abusive** envers un consommateur (article R632-1 du Code de la consommation). L'avocat devra arbitrer entre :

- Maintenir la clause et risquer son annulation devant une juridiction prud'hommale
- Insérer une clause permettant au consommateur de choisir entre le ressort du siège d'OXV et son propre domicile

### Point 2 — Couverture assurance et lien avec les CGV

Les CGV de l'article 8 indiquent que le pilote doit disposer d'une assurance individuelle responsabilité civile circuit. Mais la rédaction laisse au pilote la responsabilité de cette souscription.

À discuter avec l'avocat :

- OXV doit-elle vérifier elle-même l'assurance avant chaque session ?
- Une indemnité forfaitaire de 35 € peut-elle être incluse automatiquement dans les prestations (Access notamment) pour couvrir le pilote ?
- Une clause de subrogation en cas de défaut d'assurance pilote doit-elle être ajoutée ?

### Point 3 — Article L321-3-1 du Code du sport — Activité de loisir motorisé

Les track days sont parfois requalifiés par l'administration comme des **manifestations sportives** au sens de l'article L321-3-1 du Code du sport. Cette qualification entraîne :

- Une obligation d'agrément FFSA ou d'autorisation préfectorale
- Une assurance organisateur obligatoire avec montants minimum
- Une formation imposée aux dirigeants

À vérifier avec l'avocat : sous quelle qualification OXV opère-t-elle ? « Activité de loisir mécanique » non régulée, ou « manifestation sportive » régulée ?

### Point 4 — Stockage des consentements et preuve

Le pacte de pilotage et les CGU sont acceptés par cases à cocher dans l'app. Pour être juridiquement opposable, cette acceptation doit être :

- **Datée et horodatée** (timestamp serveur)
- **Reliée à un identifiant pilote** vérifié (email validé, KYC effectué)
- **Conservée dans des conditions garantissant son intégrité** (logs immuables, audit trail)

À discuter avec l'avocat : Supabase suffit-il pour cette conservation ? Faut-il un service d'horodatage qualifié (tel que ChamberSign ou Universign) pour les acceptations sensibles ?

### Point 5 — Données télémétriques et droit de la concurrence

Le pilote peut télécharger ses données télémétriques et les partager. Cela soulève deux questions :

- Si un pilote A partage publiquement son comparatif avec un pilote B (sans son accord), quelle est la responsabilité d'OXV ?
- Si OXV publie des classements ou comparatifs entre pilotes, faut-il un consentement de chaque pilote au sens du RGPD ?

À cadrer avec l'avocat. La rédaction actuelle des CGU (article 6.1) interdit la collecte de données d'autres pilotes sans accord, mais ne couvre pas tous les cas.

### Point 6 — DPO et obligations CNIL

OXV traite des données personnelles de plusieurs centaines de pilotes par an. Selon le chiffre d'affaires et le volume de traitement, OXV peut être tenue de désigner un **Délégué à la Protection des Données (DPO)**.

À vérifier avec l'avocat ou un consultant RGPD :

- Désignation obligatoire ou optionnelle dans le cas d'OXV ?
- Si optionnelle, recommandée pour rassurer les pilotes premium ?
- Coordonnées à compléter dans les CGU (article 13)

### Point 7 — Médiateur de la consommation

L'article L612-1 du Code de la consommation impose à OXV d'adhérer à un dispositif de médiation de la consommation pour les litiges avec ses clients consommateurs.

Le médiateur compétent doit être désigné et son nom porté dans les CGV (article 16) et sur oxvehicle.fr.

Options courantes : Médicys, CM2C, CNPM Médiation. Coût : environ 250 à 600 € par an.

### Point 8 — Conditions d'usage des images de pilote

Les CGV article 12.1 prévoient une captation d'images sur le Circuit. La rédaction actuelle est large.

L'avocat devra vérifier :

- Le consentement par case à cocher est-il suffisant pour les images commerciales ?
- Faut-il une autorisation d'usage d'image séparée et signée pour chaque pilote ?
- Quelle durée d'exploitation maximale ?
- Quels supports précisément (web, réseaux sociaux, presse, télévision) ?

---

## Recommandations pour l'avocat à choisir

### Profil idéal du cabinet

L'idéal est un **cabinet ou avocat spécialisé en deux domaines simultanément** :

1. **Droit du sport mécanique** (peu de cabinets, mais quelques uns existent en France : barreau de Paris, barreau du Mans en raison des 24 Heures, barreau de Magny-Cours)
2. **Droit du numérique** (RGPD, CGU, contrats SaaS)

Ces deux compétences sont rarement réunies. À défaut, deux avocats peuvent être consultés :

- Un spécialiste sport mécanique pour les CGV et la responsabilité organisateur
- Un spécialiste numérique pour les CGU et le RGPD

### Estimation budgétaire

Sur la base de cette V1 structurée, le travail d'un avocat consistera à :

- Relire et adapter le vocabulaire juridique
- Compléter les coordonnées et mentions légales après création SIRET
- Arbitrer les huit points identifiés ci-dessus
- Valider la conformité finale

Estimation indicative : **800 à 1 500 €** pour ce travail d'adaptation, contre 3 000 à 5 000 € si l'avocat partait d'une page blanche.

### Délai recommandé

L'idéal est de **valider les documents avant la première session OXV**. Une fois les pilotes inscrits et roulant, modifier les CGV nécessite un préavis de trente jours et l'accord (ou la non-opposition) des pilotes déjà inscrits.

---

## Articulation avec les autres documents OXV

Ces trois documents juridiques s'articulent avec d'autres pièces du projet OXV :

- **Politique de confidentialité OXV** : document complémentaire à publier sur oxvehicle.fr/privacy, déjà mentionné dans les CGU (article 8) et les CGV (article 13). À rédiger séparément ou à demander à l'avocat dans la même mission.
- **Mentions légales** : courte page à publier sur oxvehicle.fr/mentions-legales, reprenant les informations de l'article 17 des CGV.
- **Charte d'usage du Circuit de Haute Saintonge** : règlement intérieur de l'exploitant, à mentionner explicitement dans les CGV (article 10.1).

---

## Le pacte en deux phrases

Au-delà du droit, le **pacte de pilotage** vit dans deux phrases qui résument toute la philosophie OXV Coach :

> **L'app est un miroir. Elle vous montre. Elle ne vous dirige pas.**
>
> **La piste est à vous. Les décisions aussi.**

Ces deux phrases sont la pierre angulaire du dispositif juridique. Elles posent en quelques mots ce que des dizaines de pages de CGV expriment en termes techniques.

L'avocat qui prendra ce dossier doit comprendre que **ces deux phrases ne sont pas un slogan**. Elles sont le **principe juridique fondateur** qui structure la répartition des responsabilités entre OXV et le pilote.

Toute modification rédactionnelle des CGV ou CGU devra être validée à l'aune de ces deux phrases : si une nouvelle clause les contredit, c'est qu'elle est mal rédigée.

---

*Document à transmettre à l'avocat avec les trois documents juridiques (Pacte, CGU, CGV).*

*OXV — Synthèse juridique V1 — Mai 2026*
