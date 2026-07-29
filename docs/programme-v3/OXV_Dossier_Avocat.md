# OXV — Dossier de consultation juridique

**27 juillet 2026** · Document préparatoire à destination du conseil

---

# CONTEXTE

**OXV** est un club privé de journées de circuit destiné à des propriétaires de GT et de supercars. Structure : **SASU** en cours de constitution. Offres de **390 € à 2 490 €** par journée.

**L'activité** : organisation de roulages libres sur circuit fermé — Circuit de Haute Saintonge (tracé Beltoise), et à terme Valence, Charente et Le Vigeant.

**Le produit numérique** : une application mobile iOS qui restitue au pilote la télémétrie de ses séances, mesurée par un boîtier GPS et centrale inertielle à 25 Hz.

## La position réglementaire retenue

L'article **R331-20 du code du sport** dispose qu'un roulage libre sur circuit fermé, **sans spectateurs et sans chronométrage**, ne constitue ni une concentration ni une manifestation sportive, et échappe donc au régime d'autorisation correspondant.

**Toute l'architecture du produit est construite pour préserver cette qualification.** L'application ne publie aucun classement, aucun ordre par chronomètre. Le tableau de marche du paddock est explicitement configuré pour n'afficher aucun temps comparatif.

L'article **L321-1 du code du sport** fait peser sur l'organisateur une obligation d'assurance de responsabilité civile couvrant les participants.

**Plusieurs des questions ci-dessous portent précisément sur les limites de ces deux positions.**

---

# PIÈCE 1 — LA DÉCHARGE DE RESPONSABILITÉ

## Ce qui existe

Un texte de décharge est rédigé et intégré à l'application, derrière un drapeau de fonctionnalité **fermé, en attente de votre relecture**. Aucun pilote ne l'a signé à ce jour.

## Le mécanisme prévu

Signature **dans l'application**, avec horodatage. La décharge conditionne l'accès à la piste : elle figure parmi les neuf items d'une liste d'éligibilité contrôlée au paddock par un administrateur.

## Ce que nous avons décidé

**Une signature vaut définitivement**, sans resignature imposée en cas d'évolution du texte.

**Mais la version signée est enregistrée.** Motif : en cas de litige, il faut pouvoir produire le texte exact accepté par le pilote, et une date seule ne le permet pas.

## Nos questions

1. Le texte est-il opposable en l'état ? Quelles clauses sont réputées non écrites au regard du droit de la consommation ?
2. Une signature électronique simple dans l'application suffit-elle, ou faut-il un procédé de signature avancée ?
3. La conservation de la version signée est-elle suffisante comme preuve, ou faut-il un horodatage qualifié ?
4. Que doit contenir la décharge que le texte actuel ne contient pas ?

---

# PIÈCE 2 — LE PACTE MUTUEL D'ONBOARDING

## Ce que c'est

À sa première ouverture de l'application, le pilote lit un **pacte à engagements réciproques**. Ce n'est pas un texte de marque : **OXV s'y engage**.

## Les trois engagements d'OXV

**Ne jamais vous dire quoi faire au volant.**
**Ne jamais vous classer contre un autre pilote.**
**Ce que vous écrivez n'est vu de personne sans votre accord.**

## La réserve que nous avons identifiée

Le troisième engagement est **contredit par le fonctionnement du produit** si sa rédaction ne distingue pas ce qui reste privé de ce qui alimente le débrief.

Le pilote répond à un questionnaire de ressenti après chaque séance, et **ce ressenti est transmis à son coach** — c'est le cœur de la boucle pédagogique. Son carnet personnel, en revanche, n'est partagé qu'au niveau de consentement le plus élevé.

## Nos questions

1. Un engagement unilatéral d'OXV formulé ainsi crée-t-il une obligation juridique, et laquelle ?
2. Comment le rédiger pour qu'il soit tenable, sans le vider de sa force ?
3. Quelle articulation avec les CGU et la politique de confidentialité ?
4. Le premier engagement — « ne jamais vous dire quoi faire au volant » — nous protège-t-il en cas d'accident, ou nous expose-t-il davantage ?

---

# PIÈCE 3 — LE MANDAT D'ENCAISSEMENT DES COACHS

## Le modèle retenu

**Place de marché.** Un pilote réserve une séance de coaching dans l'application ; **OXV encaisse et reverse au coach**.

Le revenu d'OXV n'est pas une commission mais une **licence de saison de 550 €** par coach. Hypothèses : deux coachs en année 1, quatre en année 2, huit en année 3 — soit environ **917 € HT** la première année. **C'est un mécanisme d'accès, pas un revenu.**

## La construction juridique

Les coachs sont des **indépendants disposant de leur propre SIRET**. La facture est émise **au nom du coach** ; OXV n'est que collecteur.

Le schéma de base porte à cet effet, sur le profil du coach : SIRET, nom et adresse de facturation, forme juridique, régime et taux de TVA.

## Le verrou anti-contournement

Trois éléments : une **charte coach** interdisant de facturer hors plateforme, sanctionnée par l'exclusion · le **masquage des coordonnées** jusqu'à la réservation · et l'affiliation.

## Nos questions

1. Le mandat d'encaissement est-il la construction correcte, ou faut-il un statut d'agent commercial, de commissionnaire, voire d'établissement de paiement ?
2. Quelles obligations déclaratives pèsent sur OXV au titre des revenus versés aux coachs ?
3. Le seuil réglementaire d'agrément d'établissement de paiement est-il franchi, et à partir de quels volumes ?
4. La TVA : OXV la collecte-t-il, la refacture-t-il, ou reste-t-il transparent ?

---

# PIÈCE 4 — LA CHARTE COACH

## Ce qu'elle contient

**L'interdiction de facturer hors plateforme**, sanctionnée par l'exclusion. Le respect de la doctrine du produit — le coach est le seul autorisé à formuler une prescription, et elle lui est attribuée. Les règles de confidentialité sur les données du pilote.

## Le contexte de données

Un coach accède, selon le niveau de consentement du pilote : à ses séances et sa télémétrie · à sa **fréquence cardiaque** au niveau détaillé · à son **carnet personnel** au même niveau.

Un coach peut également **comparer deux de ses propres élèves** — voir pièce 6.

## Nos questions

1. Quelle est la nature du contrat entre OXV et un coach — prestation, franchise, contrat-cadre de place de marché ?
2. L'exclusion pour facturation hors plateforme est-elle une clause valide, ou une entrave à la liberté du commerce ?
3. Quelle responsabilité OXV porte-t-il pour les conseils donnés par un coach à un pilote ?
4. Le coach doit-il justifier d'une qualification, d'une assurance propre, d'un diplôme d'État ?

---

# PIÈCE 5 — LA COMPARAISON ENTRE PILOTES DE LA MÊME JOURNÉE

## Le mécanisme

Deux pilotes **amis** — l'amitié étant réciproque et explicitement acceptée des deux côtés — peuvent comparer leurs données de télémétrie.

**L'affichage est strictement non classant** : deux colonnes, aucun vainqueur désigné, aucun écart coloré, aucune flèche. Aucune trace n'est conservée de la comparaison.

## La zone grise que nous avons identifiée

L'article R331-20 protège OXV parce qu'un roulage libre **sans chronométrage ni classement** échappe au régime des manifestations sportives.

Or une comparaison chronométrée entre deux participants **de la même journée**, fournie par l'organisateur, entre dans une zone incertaine : **OXV ne classe pas, mais il outille la comparaison des participants de son propre événement.**

Une comparaison entre deux journées différentes, ou entre deux saisons, ne pose pas ce problème.

## Nos questions

1. Cette comparaison compromet-elle la qualification de roulage libre au sens de R331-20 ?
2. Faut-il l'interdire entre pilotes d'une même journée, ou l'absence de classement affiché suffit-elle ?
3. Le fait que la comparaison soit **privée, bilatérale et consentie** change-t-il l'analyse ?
4. Existe-t-il une jurisprudence sur la frontière entre chronométrage privé et chronométrage d'organisateur ?

---

# PIÈCE 6 — LA COMPARAISON D'ÉLÈVES PAR UN COACH

## Le mécanisme

Un coach peut afficher côte à côte les données de **deux de ses propres élèves**.

## La réserve

Les deux pilotes ont consenti à « mon coach voit mes données ». **Ils n'ont pas consenti à ce qu'il les montre à côté de celles d'un autre.** Et ils ne se connaissent pas nécessairement.

## La correction envisagée

Modifier la phrase de consentement pour qu'elle le dise explicitement : *« il voit vos séances, votre télémétrie, votre cardio et votre carnet, et peut les comparer à celles de ses autres pilotes. »*

## Nos questions

1. Cette mention suffit-elle au regard du RGPD, ou faut-il un consentement distinct ?
2. Le coach étant responsable de traitement ou sous-traitant — lequel — quelles obligations lui incombent ?
3. La comparaison d'élèves entre eux relève-t-elle du même régime que la comparaison entre amis ?

---

# PIÈCE 7 — LA RÉTENTION DES SIGNALEMENTS D'INCIDENT

## Le mécanisme

Un pilote peut signaler un incident à tout moment de la journée : **sortie de piste, contact, casse mécanique, malaise**.

Le signalement est vu par **l'administrateur et par le coach du pilote**. Il porte un état suivi — reçu, traité, clos — avec auteur et date.

## Le point sensible

**Le malaise est une donnée de santé au sens de l'article 9 du RGPD.**

Nous avons donc décidé que l'accès du coach à un signalement ne peut pas reposer sur la seule relation de coaching : il exige le niveau de consentement détaillé, comme la fréquence cardiaque.

## Nos questions

1. Quelle durée de conservation pour un signalement d'incident ? Elle doit concilier la prescription en matière de responsabilité civile et la minimisation RGPD.
2. Un signalement mentionnant un malaise impose-t-il un régime distinct ?
3. OXV a-t-il une **obligation de déclaration** d'un incident à un tiers — assureur, circuit, autorité ?
4. Le signalement peut-il être opposé au pilote lui-même, ou constitue-t-il un aveu ?

---

# PIÈCE 8 — LA RESPONSABILITÉ D'ORGANISATEUR SUR LES ROULAGES DE COACH

## Le mécanisme

Un coach peut **organiser ses propres journées** dans l'application : créer un roulage, inviter des pilotes, en suivre le déroulement.

**Nous avons décidé qu'un roulage de coach est une journée OXV** — mêmes règles, même table d'événements, même processus d'éligibilité.

## La conséquence que nous avons identifiée

**Si le roulage d'un coach est une journée OXV, OXV en porte les obligations d'organisateur** : l'assurance de l'article L321-1, et la protection de R331-20 qui suppose l'absence de chronométrage et de classement.

**Le coach organise, OXV répond.**

## Nos questions

1. Cette lecture est-elle correcte ? OXV peut-il être organisateur d'un événement qu'il n'a pas conçu ?
2. Le contrat de coach doit-il encadrer cette délégation, et comment ?
3. L'assurance d'OXV couvre-t-elle ces journées, ou faut-il une extension ?
4. Existe-t-il un montage où le coach reste organisateur et OXV simple prestataire technique — et est-il souhaitable ?

---

# ANNEXE — LES DEUX PIÈCES CONNEXES

## Les CGV

L'application prévoit un tunnel de réservation, aujourd'hui **fermé** en attendant l'obtention du SIRET et l'ouverture d'un compte Stripe.

**Le modèle retenu** : le dossier de réservation est constitué **dans l'application** — qui connaît le pilote, son véhicule, ses documents — puis **le paiement a lieu sur le site**, l'authentification étant partagée.

**Motif** : aucun paiement n'a lieu dans l'application, ce qui évacue la question de la commission d'Apple sur les achats intégrés.

**Une exception** : l'administrateur pourra encaisser **en présence au paddock**, par Tap to Pay on iPhone. Une journée de circuit étant un service physique consommé hors de l'application, la collecte par un tiers y est permise.

**Question** : cette analyse est-elle correcte, et les CGV doivent-elles distinguer les deux canaux ?

## La visibilité par défaut

Un pilote est, par défaut, **visible des autres membres du club** : sa présence à une journée est publique au sein du club.

**L'article 25 du RGPD** impose la protection des données par défaut, et vise l'accessibilité « à un nombre indéterminé de personnes sans l'intervention de la personne physique ».

**Notre position** : un club fermé n'est pas un nombre indéterminé de personnes. **Question** : est-elle défendable ?

---

# CE QUE NOUS ATTENDONS

Pour chaque pièce : **ce qui est tenable en l'état**, ce qui doit être réécrit, et ce qui doit être abandonné.

**Et un ordre de priorité.** Deux pièces bloquent aujourd'hui le produit : la **décharge**, sans laquelle aucun pilote ne peut rouler, et le **mandat d'encaissement**, sans lequel l'économie coach ne peut pas s'ouvrir.
