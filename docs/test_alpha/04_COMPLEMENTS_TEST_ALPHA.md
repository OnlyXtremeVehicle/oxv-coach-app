# Compléments au test alpha OXV

**Quatre angles complémentaires aux trois livrables principaux**
**Pour préparer la Balade Découverte du 5 juillet 2026**
**Version 1.0 — Mai 2026**

---

## Préambule

Les trois livrables précédents couvrent l'essentiel du test alpha :

- **Livrable 1** — Plan opérationnel de la journée
- **Livrable 2** — Spécification admin pour créer l'événement
- **Livrable 3** — Grille d'observation et méthodologie

Ce document complète ces livrables sur **quatre angles spécifiques** qui méritent leur traitement à part :

1. L'usage du bouton BLE de marquage dans le contexte balade
2. La gestion RGPD des données du test alpha
3. Le plan de contingence en cas d'échec partiel ou total
4. La séquence de fidélisation des 12 amis ambassadeurs après le test

---

## Partie 1 — Le bouton BLE de marquage en balade

### 1.1 — Contexte

Dans le dispositif OXV Coach classique, le **bouton Flic 2 de marquage** sert au pilote en piste pour signaler manuellement des moments intéressants au cours de la session. Les trois usages prévus sont :

- **Clic simple** : marqueur libre (« je veux retrouver ce moment dans mon bilan »)
- **Double-clic** : incident (« sortie de piste, blocage de roue, événement inhabituel »)
- **Triple-clic** : question pour debrief (« cette zone m'a surpris, je veux y revenir »)

En contexte de **balade touristique**, ces sémantiques ne sont pas pleinement transposables. Mais le bouton reste **utile** pour deux raisons :

- Tester la chaîne BLE complète (l'app détecte-t-elle le bouton sur 1h30 de roulage ?)
- Recueillir des marqueurs émotionnels du pilote qui enrichissent le bilan

### 1.2 — Sémantique adaptée pour la balade

Je propose une **sémantique réduite et adaptée** pour le test du 5 juillet :

| Action | Sémantique balade | Affichage dans le bilan |
|---|---|---|
| Clic simple | « Beau moment » | Marqueur étoile sur la trajectoire |
| Double-clic | « À discuter » | Marqueur question pour le débrief |
| Triple-clic | Réservé pour usage futur (V2) | — |

L'idée est de réduire à deux usages clairs, plus mémorisables qu'un système à trois niveaux dans un contexte décontracté.

### 1.3 — Annonce du bouton lors du briefing

Le briefing à 9h30 doit inclure une **explication courte du bouton** :

```
Sur le tableau de bord, à côté du boîtier, vous trouverez un petit
bouton rond. C'est votre marqueur de souvenirs.

- Une pression brève : « beau moment » — un virage qui vous plaît,
  un paysage marquant, un instant que vous voulez retrouver dans le
  bilan.
- Deux pressions courtes : « à discuter » — quelque chose qui vous
  intrigue, à reprendre au déjeuner.

Vous n'êtes pas obligés de l'utiliser. Mais si l'envie vient, un
clic suffit.
```

### 1.4 — Distribution effective

Sur les 12 boîtiers OXV Coach que vous distribuez, **prévoyez 12 boutons Flic 2** appairés au préalable. Le coût d'achat est d'environ 35-45 € par bouton, soit **420-540 € de boutons** pour le test alpha.

Si cet investissement vous paraît trop important, vous pouvez :

- N'équiper que **6 boutons sur 12** (un sur deux), pour tester techniquement
- Choisir des amis « techniques curieux » pour les recevoir
- Comparer les bilans avec et sans bouton à la fin du test

### 1.5 — Bénéfice technique attendu

Ce qu'on apprend en distribuant les boutons :

- **Robustesse de la chaîne BLE** : un bouton supplémentaire à connecter avec le RaceBox + le téléphone = trois liens BLE simultanés par pilote. Si ça tient sur 1h30, c'est validé.
- **Comportement vibratoire** : le bouton tient-il sur le tableau de bord pendant 50 km de route ? Décolle-t-il ? Glisse-t-il ?
- **Réception de l'action** : les amis utilisent-ils spontanément le bouton, ou l'oublient-ils complètement ?

Le dernier point est crucial : si 0 ami sur 12 utilise spontanément le bouton, c'est que la fonctionnalité **manque d'incitation visible**. Ce sera un signal fort pour la V1.1.

### 1.6 — Récupération des boutons

Comme pour les boîtiers RaceBox, les boutons Flic 2 vous appartiennent. Récupérez-les à la fin de la journée. Ils sont réutilisables sur plusieurs centaines de sessions.

---

## Partie 2 — Gestion RGPD des données du test alpha

### 2.1 — Le contexte juridique spécifique

Vos 12 amis vont s'inscrire sur oxvehicle.fr, accepter les CGU, le Pacte de pilotage et la Politique de confidentialité — exactement comme un pilote classique. **Sur le plan juridique, ils sont des pilotes inscrits.**

Mais le contexte « test alpha » introduit deux spécificités qui méritent une clause explicite :

- Les données collectées seront **utilisées pour améliorer l'app** au-delà du simple usage personnel
- Les retours qualitatifs (questionnaires, observations) seront **conservés à des fins d'amélioration produit**

Ces deux usages dépassent la finalité « fourniture du service » prévue dans les CGU classiques. Il faut donc **un consentement supplémentaire explicite**.

### 2.2 — Clause additionnelle à faire signer

Je propose une **clause additionnelle « test alpha »** à intégrer dans le parcours d'inscription des amis, ou à signer séparément le jour J au paddock.

```
CLAUSE COMPLÉMENTAIRE — PARTICIPATION AU TEST ALPHA OXV

En participant à la Balade Découverte OXV du 5 juillet 2026,
j'accepte expressément que :

1. Les données télémétriques collectées par l'équipement OXV Coach
   pendant la balade puissent être analysées par OXV à des fins
   d'amélioration de ses algorithmes et de son application.

2. Les retours qualitatifs que je fournis (questionnaire écrit,
   commentaires oraux, observations) puissent être conservés et
   analysés par OXV pour améliorer le produit.

3. Aucune de ces données ne sera transmise à un tiers commercial,
   ni publiée nominativement sans mon accord écrit préalable.

4. Je peux à tout moment demander la suppression de mes données
   de test alpha en écrivant à contact@oxvehicle.fr, sans avoir
   à justifier ma demande.

5. Mes données seront conservées pendant deux ans maximum à compter
   du 5 juillet 2026, sauf demande de suppression anticipée de ma
   part ou prolongation explicite acceptée par écrit.

Date et signature :
```

### 2.3 — Modalité de signature

Deux options :

**Option A — Signature électronique dans le parcours d'inscription**

Lors de l'inscription en ligne, ajouter une case à cocher dédiée « J'accepte les conditions du test alpha » avec lien vers le texte ci-dessus. C'est l'option la plus propre juridiquement.

Implémentation technique : une nouvelle colonne `alpha_test_consent_at` dans la table `users` ou un enregistrement spécifique dans une table `test_consents`.

**Option B — Signature papier au paddock**

Imprimer 12 copies de la clause et faire signer chaque ami à l'arrivée. Plus convivial, juridiquement valable, mais demande une logistique manuelle.

Recommandation : **Option A** pour la robustesse juridique, **Option B en sauvegarde** au cas où l'option A n'est pas prête techniquement à temps.

### 2.4 — Plan de gestion des données après le test

| Phase | Données concernées | Action |
|---|---|---|
| J+0 (5 juillet, soir) | Données télémétriques + questionnaires | Sauvegarde complète sur Supabase, copie locale |
| J+7 (vers le 12 juillet) | Données télémétriques | Première analyse, identification des bugs |
| J+30 (vers le 5 août) | Données complètes | Synthèse produit, décisions V1.1 |
| J+90 (vers le 5 octobre) | Données utilisées | Anonymisation des questionnaires (suppression des noms) |
| J+730 (5 juillet 2028) | Tout | Suppression complète sauf consentement explicite renouvelé |

### 2.5 — Cas particulier des données dérivées

Si vous publiez des **résultats agrégés** issus du test (par exemple un article de blog OXV : « ce que nous a appris notre test alpha »), assurez-vous que :

- Aucun nom d'ami n'est mentionné sans accord écrit préalable
- Aucune donnée individuelle identifiable n'est exposée
- Les retours qualitatifs cités sont soit anonymisés, soit attribués avec accord
- Les chiffres présentés sont agrégés (« 8 amis sur 12 ont préféré l'écran X ») et non individuels

C'est important non seulement pour le RGPD, mais aussi pour conserver la **confiance** de vos premiers ambassadeurs.

### 2.6 — Cas particulier des photos prises pendant la journée

Si vous (ou un photographe ami) prenez des photos pendant la balade et que vous voulez les utiliser plus tard pour la communication OXV, faites signer une **autorisation d'usage d'image** distincte. Voici un modèle court :

```
AUTORISATION D'USAGE D'IMAGE

Je soussigné(e) [nom prénom], autorise OXV (SASU) à utiliser
les photographies et vidéos sur lesquelles je figure, prises
lors de la Balade Découverte du 5 juillet 2026, pour la
communication interne et externe d'OXV (site web, réseaux
sociaux, supports marketing).

Cette autorisation est accordée pour une durée de cinq ans
à compter de ce jour, et peut être révoquée à tout moment
par simple email à contact@oxvehicle.fr.

Date et signature :
```

---

## Partie 3 — Plan de contingence

### 3.1 — Pourquoi anticiper l'échec

Un test alpha sans plan de contingence est un test fragile. Si quelque chose tourne mal le jour J, votre objectif est de **ne pas perdre l'investissement** des 21 jours de préparation et de l'engagement de vos 12 amis.

Un bon plan de contingence couvre **trois types d'échec** :

- **Échec partiel** (un élément du dispositif ne fonctionne pas)
- **Échec massif** (plusieurs éléments simultanés)
- **Échec catastrophique** (impossibilité de tenir l'événement)

Et pour chacun, identifie :
- Le **signal d'alerte** (comment savoir qu'on y est)
- La **réponse immédiate** (que faire dans l'heure)
- La **communication aux amis** (que leur dire)
- L'**apprentissage à conserver** (transformer l'échec en donnée utile)

### 3.2 — Catalogue des scénarios d'échec

**Scénario A — Météo défavorable la veille**

| Détail | Action |
|---|---|
| Signal | Météo France annonce > 80% de pluie continue le 5 juillet, alerte orage |
| Décision | À J-2 (3 juillet), reporter au dimanche 6 juillet en backup |
| Communication | « La météo prévue n'est pas optimale. Nous reportons à demain dimanche, même heure, même lieu. Confirmez votre présence avant ce soir. » |
| Si dimanche aussi mauvais | Reporter au samedi 12 juillet ou abandonner pour cette session |
| Apprentissage | Tester le dispositif de notification de report (email + WhatsApp) |

**Scénario B — Désistement massif (8 amis sur 12 annulent à J-3)**

| Détail | Action |
|---|---|
| Signal | Annulations en cascade vers le mardi 1er juillet |
| Décision A | Maintenir avec les 4 confirmés (test moins exhaustif mais utile) |
| Décision B | Reporter d'une semaine avec relance |
| Décision C | Recruter en express 4 nouveaux amis (votre cercle proche peut-il fournir ?) |
| Communication aux confirmés | Honnête : « Plusieurs personnes ont eu un imprévu. Nous maintenons à 4 ou 5, ce sera plus intime mais tout aussi utile. Tu confirmes ? » |
| Apprentissage | Mesurer le taux de désistement pour calibrer les futures sessions |

**Scénario C — Equipement OXV Coach indisponible (RaceBox non livrés)**

| Détail | Action |
|---|---|
| Signal | À J-7, les boîtiers commandés ne sont pas arrivés |
| Plan B | Faire la balade quand même, **sans** l'équipement, comme un focus group enrichi |
| Plan C | Si vous avez 2-3 RaceBox seulement, équiper 2-3 amis seulement |
| Communication | « L'équipement définitif n'arrive pas à temps. On maintient la balade pour le côté convivial et on testera l'app en mode démo sur l'app classique. » |
| Apprentissage | Vous testez quand même les rituels J-7/J-2/J-1, l'inscription, le briefing, et le ressenti général |

**Scénario D — App OXV Coach pas prête à temps**

| Détail | Action |
|---|---|
| Signal | Le développement de l'app n'a pas avancé au point d'être testable |
| Décision | Faire la balade en utilisant l'app web (oxvehicle.fr) comme proxy |
| Adaptation | Au lieu de tester l'app, tester le **parcours complet de réservation et restitution** sur le web |
| Communication aux amis | « L'app mobile arrive plus tard. Aujourd'hui on teste l'expérience web OXV, et on se reverra plus tard pour tester l'app dédiée. » |
| Apprentissage | Validation du parcours web classique sans intervention de l'app |

**Scénario E — Resend ou Supabase down le jour J**

| Détail | Action |
|---|---|
| Signal | Le matin du 5 juillet, vous découvrez qu'une notification ne part pas |
| Décision | Improvisation immédiate : communication WhatsApp/SMS à la place |
| Plan B | Continuer la balade sans rituels in-app, observer manuellement |
| Communication | Pas nécessaire d'alerter les amis si vous compensez en direct |
| Apprentissage | Mesurer votre temps de réaction et de bascule en mode dégradé |

**Scénario F — Accident pendant la balade**

| Détail | Action |
|---|---|
| Signal | Sortie de route, collision, blessure d'un ami |
| Réponse immédiate | Sécuriser la zone, appeler les secours (15 / 18), prévenir les autres voitures du convoi |
| Documentation | Photos de la scène, témoignages écrits, déclarations d'assurance |
| Communication | Aux autres amis présents : transparence totale et soutien immédiat |
| Aux amis absents | Communication brève le soir même ou le lendemain |
| Apprentissage | Réévaluer la pertinence du format « balade en convoi » et les distances de sécurité |

**Scénario G — Désaffection émotionnelle (la journée se passe « bien » mais sans enthousiasme)**

| Détail | Action |
|---|---|
| Signal | Les retours sont polis, neutres, sans grande passion |
| Réflexion | Le concept OXV ne génère peut-être pas l'enthousiasme attendu sur ce format |
| Décision | Approfondir avec 2-3 amis très honnêtes en discussion individuelle |
| Communication | Pas de drame, juste « j'aimerais te poser quelques questions plus précises » |
| Apprentissage | Possible réorientation du positionnement ou du parcours client |

### 3.3 — Outils de communication d'urgence

Préparez à l'avance :

- **Groupe WhatsApp** « Balade Découverte 5 juillet » avec tous les amis confirmés
- **Liste téléphonique imprimée** des 12 amis (numéros + emails)
- **Email type de report** pré-rédigé (à personnaliser en 30 secondes)
- **SMS type de report** pré-rédigé (idem)
- **Vos coordonnées** affichées clairement pour que les amis vous joignent

### 3.4 — La règle des 3 heures

Si un problème survient le jour J, **donnez-vous 3 heures maximum** pour décider :

- 1ère heure : évaluation de la gravité, options possibles
- 2ème heure : décision et préparation de la communication
- 3ème heure : exécution (envoi des messages, ajustements)

Au-delà de 3 heures, vous risquez de perdre le contrôle de la situation et la confiance des amis. Décider vite, même imparfaitement, vaut mieux que décider parfaitement trop tard.

---

## Partie 4 — Séquence de fidélisation des 12 amis ambassadeurs

### 4.1 — Pourquoi penser à l'après

Vos 12 amis qui auront participé au test alpha sont vos **premiers ambassadeurs naturels**. Ils auront vécu OXV avant tout le monde, ils auront un sentiment de privilège, ils auront des opinions à partager.

Si vous ne faites rien après le 5 juillet, cet investissement s'évapore. Si vous construisez une **séquence de fidélisation**, vous transformez ces 12 personnes en :

- Promoteurs spontanés auprès de leur cercle
- Bêta-testeurs réguliers pour les V1.1, V1.2, V2
- Premiers acheteurs payants quand le lancement commercial démarre
- Source de témoignages pour la communication OXV

### 4.2 — Séquence en 5 temps

**Temps 1 — Le soir du 5 juillet (à chaud)**

Avant de vous coucher, envoyez à chaque ami un **message personnel court** par WhatsApp ou SMS :

```
[Prénom], merci pour aujourd'hui. Ta présence m'a beaucoup
apporté. Je prends le temps de digérer tout ce que vous m'avez
dit. À très vite,
Gabin
```

Pas de communication marketing. Pas de questionnaire supplémentaire. Juste un mot personnel. C'est le geste qui marque.

**Temps 2 — Le lundi 7 juillet (debrief J+1 automatique)**

Le système OXV envoie automatiquement le **debrief J+1** à chaque ami. C'est le moment-clé : c'est la première fois qu'un ami reçoit un debrief OXV, et il est unique à sa balade.

Observez les réactions sur le groupe WhatsApp. Notez qui ouvre, qui commente, qui partage.

**Temps 3 — Le vendredi 11 juillet (synthèse personnalisée)**

Une semaine après le test, envoyez à chaque ami un **message personnel** avec ses retours intégrés. Quelque chose comme :

```
[Prénom],

Une semaine après notre balade, voici ce que j'ai retenu de
ce que tu m'as dit :

- Tu m'as fait remarquer que [point précis] : j'ai noté, on
  va travailler dessus.
- Tu m'as aimé [point positif] : ça me confirme ce qu'on veut
  pousser.
- Tu m'as suggéré [idée] : je l'ai mise dans ma liste.

Encore merci. Tu fais partie des premiers à avoir vu OXV
prendre vie, et ton regard compte pour la suite.

Gabin
```

Cette personnalisation demande du temps (peut-être 30 minutes par ami, soit 6 heures pour les 12), mais c'est ce qui transforme un participant en ambassadeur.

**Temps 4 — Le mois suivant (les nouveautés)**

Quand vous aurez intégré quelques retours et qu'une V1.1 (même partielle) sera prête, envoyez un message au groupe :

```
Bonjour à tous,

Trois choses ont changé dans OXV depuis notre balade,
grâce à vos retours :

1. [Point 1]
2. [Point 2]
3. [Point 3]

Vous êtes parmi les premiers à le voir. Si vous voulez tester
la nouveauté, je peux vous envoyer un lien d'accès anticipé.

À bientôt,
Gabin
```

Vous démontrez que **leurs retours ont eu un impact réel**. C'est ce qui crée l'attachement.

**Temps 5 — Avant le vrai lancement (privilège ambassadeur)**

Quand vous lancerez commercialement OXV (premier track day payant à Beltoise), proposez aux 12 amis un **privilège ambassadeur** :

- Première session offerte sur leur premier engagement payant
- Ou réduction significative sur la première session
- Ou accès anticipé aux dates les plus convoitées
- Ou un statut « Membre fondateur » avec un badge dans leur profil pilote

Le coût de ces avantages est faible (10-12 sessions offertes à coût marginal), mais l'effet est puissant : ces 12 personnes deviennent des **multiplicateurs** dans leur cercle.

### 4.3 — Outils pour faire vivre la communauté

Quelques pistes pour matérialiser cette communauté de 12 ambassadeurs :

- **Groupe WhatsApp/Signal permanent** « OXV Membres fondateurs » conservé après la balade
- **Évenement annuel** (anniversaire du 5 juillet) en commémoration de cette balade
- **Badge ou mention** dans leur profil pilote sur oxvehicle.fr
- **Newsletter dédiée** (différente de la newsletter publique OXV)
- **Accès anticipé** aux fonctionnalités V1.1, V1.2 et au-delà

Ces gestes n'ont rien à voir avec du marketing classique. Ils créent **un sentiment d'appartenance** qui dépasse la transaction commerciale.

### 4.4 — Le retour sur investissement

Si vous mettez en place cette séquence rigoureusement, vous pouvez raisonnablement attendre :

| Indicateur | Estimation conservatrice |
|---|---|
| Sur 12 amis testeurs, combien deviennent pilotes payants ? | 6-8 |
| Combien recommandent OXV à au moins un ami ? | 8-10 |
| Combien ramènent au moins un nouveau pilote payant ? | 4-6 |
| Total pilotes acquis grâce au test alpha | 10-14 |

Soit l'équivalent économique de **2 à 4 sessions complètes** dès la première année d'exploitation. Pour un investissement de 600-1000 € en logistique le 5 juillet + 6h de votre temps en post-événement, c'est **un des meilleurs ROI** que vous puissiez espérer en marketing initial.

### 4.5 — La vraie valeur

Au-delà du calcul économique, ces 12 personnes seront celles qui pourront **témoigner authentiquement** d'OXV quand vous parlerez à un investisseur, à un partenaire, à un journaliste. Ces témoignages valent infiniment plus que n'importe quel slogan marketing.

> *« J'étais là le 5 juillet 2026. J'ai vu OXV avant tout le monde. C'était déjà différent de tout ce que j'avais essayé. »*

C'est cette phrase, dans la bouche d'un de vos amis, qui transformera des prospects sceptiques en pilotes engagés.

---

## En une phrase

> *Un test alpha n'est pas un événement, c'est le début d'une communauté. Ce document vous donne les outils pour ne pas laisser cette communauté s'éparpiller après la dernière voiture qui repart de Bouteville.*

---

*Compléments au test alpha OXV — Version 1.0 — Mai 2026*

*À utiliser avec les trois livrables principaux (plan opérationnel, spécification admin, grille d'observation).*
