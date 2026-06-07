# Plan opérationnel — Balade Découverte OXV

**Événement test alpha**
**Date : Samedi 5 juillet 2026 (alternative : dimanche 6 juillet)**
**Lieu : Bouteville (Charente)**
**Participants : Gabin + 10 à 12 amis pilotes**
**Format : Demi-journée — Rallye touristique en convoi**

---

## Préambule

Cet événement n'est **pas une session OXV commerciale**. C'est un **test alpha** du parcours client complet et de l'application OXV Mirror, organisé entre amis dans un cadre privé.

Il n'engage aucune transaction financière, ne fait l'objet d'aucune déclaration administrative (groupe de moins de 50 véhicules, pas de classement, pas de chronométrage public), et se déroule **dans le strict respect du Code de la route**.

Son objectif est triple :

1. Valider le parcours client de A à Z (inscription, rituels, jumelage équipement, restitution)
2. Tester l'équipement OXV Mirror (RaceBox) en conditions de campagne
3. Recueillir les retours qualitatifs d'amis bienveillants mais critiques

---

## 1. Vue d'ensemble — Le programme en une phrase

> *Une demi-journée de balade automobile entre amis dans la campagne charentaise, en utilisant l'application OXV Mirror comme si c'était une vraie session, suivie d'un déjeuner-débrief pour partager les retours.*

---

## 2. Composition du groupe

### Profil souhaité des invités

Cherchez à inviter **10 à 12 amis** correspondant aux trois profils suivants, pour avoir un panel représentatif :

- **3 à 4 « passionnés non-techniques »** : aiment les belles voitures, n'ont jamais roulé en circuit, peuvent juger du parcours client comme un vrai pilote OXV débutant
- **3 à 4 « techniques curieux »** : ingénieurs, geeks, développeurs, qui aimeront tester l'app de fond en comble et signaler les bugs
- **3 à 4 « pilotes expérimentés »** : amis qui ont déjà roulé sur circuit, qui pourront juger de la pertinence des observations OXV même en conditions de rallye touristique

### Critères pratiques

- Tous majeurs avec permis B valide
- Disponibilité confirmée 48h avant
- Véhicule personnel utilisable (préférence pour voitures sportives ou plaisantes, mais une berline familiale est acceptable)
- Assurance auto en cours de validité (vérification visuelle au point de RV)
- Smartphone iOS ou Android compatible OXV Mirror

---

## 3. Préparation en amont

### J-21 (vers le 14 juin) — Annonce

Envoi d'une invitation par email ou message personnel à chaque ami. Texte type :

> Salut [prénom],
>
> Tu sais que je travaille sur OXV depuis quelque temps. J'aimerais te faire vivre un test alpha de tout le parcours client le samedi 5 juillet.
>
> Le programme : rendez-vous matinal à Bouteville, balade automobile en convoi dans la campagne (conduite normale, on n'est pas sur un circuit !), démonstration de l'équipement de télémétrie OXV, et déjeuner pour échanger sur l'expérience.
>
> Tu serais partant pour me donner ton retour honnête ?
>
> À noter : c'est gratuit, c'est entre amis, et c'est une vraie répétition générale avant le vrai lancement.
>
> Gabin

### J-14 (21 juin) — Création de l'événement dans l'admin

Modifications de l'admin oxvehicle.fr (voir Livrable 2) pour créer :
- Le circuit temporaire « Bouteville — Balade Découverte »
- La session du 5 juillet
- L'offre « Balade Découverte » à 0 €

### J-7 (28 juin) — Ouverture des inscriptions

Envoi du lien d'inscription à tous les amis ayant confirmé.

Lien type : `oxvehicle.fr/reservation/balade-decouverte-5juillet` (ou parcours classique avec offre Balade Découverte visible)

À partir de ce moment, **les rituels J-7 s'enclenchent automatiquement** pour les amis inscrits (email de confirmation, playlist OXV). C'est exactement ce que vous voulez tester.

### J-2 (3 juillet) — Rituel audio

L'audio personnalisé GPT-4o + ElevenLabs est généré pour chaque ami. C'est un moment crucial du test : observez les réactions reçues.

### J-1 (4 juillet) — Rappel et logistique

Email automatique de rappel (rituel J-1). Vous envoyez en complément un message personnel avec :
- Le point de RV exact (coordonnées GPS et adresse)
- L'heure précise
- La liste des participants confirmés
- Un rappel : "Conduite normale, on respecte le Code de la route, on est entre amis"

---

## 4. Déroulé de la demi-journée

### 9h00 — Arrivée au point de rendez-vous

**Lieu suggéré** : place ou parking de Bouteville pouvant accueillir 10-12 voitures. Si Bouteville-centre est trop petit, alternative : parking en bordure du village.

Coordonnées GPS à confirmer une fois le lieu précis choisi.

### 9h00-9h30 — Accueil et café

- Accueil informel des amis
- Café, petit-déjeuner léger
- Distribution des équipements OXV Mirror (un boîtier par voiture)
- Présentation de l'objectif de la journée

### 9h30-9h45 — Briefing

Briefing court (15 minutes) en plein air :

1. **Rappel du cadre** : ce n'est pas un track day, c'est une balade, on respecte le Code de la route en permanence
2. **Présentation du parcours** : itinéraire affiché sur un panneau ou carte papier
3. **Consignes de sécurité** :
   - Distances de sécurité respectées
   - Pas de dépassement risqué
   - Respect des limitations de vitesse
   - Si quelqu'un veut sortir du convoi, il sort
4. **Présentation rapide de l'app** : 5 minutes max
   - Comment installer le boîtier OXV Mirror
   - Comment l'app va détecter l'arrivée et démarrer
   - "Vous ne touchez plus à votre téléphone pendant la conduite"

### 9h45-10h00 — Installation de l'équipement

Chaque ami installe son boîtier OXV Mirror sur son tableau de bord avec le support magnétique. Vérification du jumelage Bluetooth. Cette étape est cruciale pour tester l'écran de jumelage paddock (#07-09).

### 10h00 — Départ du convoi

**Itinéraire suggéré** : boucle d'environ 40-50 km dans la campagne charentaise, durée 1h-1h30 en conduite normale.

Exemple de tracé (à finaliser selon votre connaissance du terrain) :

```
Bouteville → Saint-Preuil → Bonneuil → Bouteville (point bas)
            → Ambleville → Saint-Médard → Bouteville (retour)
```

Choisir des routes avec :
- Quelques virages plaisants (pour générer des données intéressantes)
- Pas trop de circulation
- Bon revêtement
- Beaux paysages (pour la photo souvenir)

**Vitesse moyenne attendue** : 50-70 km/h selon les sections. Conduite tranquille, presque touristique.

Le convoi peut se séparer en deux pelotons de 5-6 voitures si vous êtes 12, pour ne pas créer de bouchon sur les départementales.

### 11h30-12h00 — Pause à mi-parcours

À mi-chemin, faites un arrêt dans un village ou point pittoresque (15-20 min). Cela permet :
- Une pause photo souvenir
- Un premier débrief informel
- Une vérification du jumelage BLE qui doit tenir

### 12h00-13h00 — Fin du convoi et retour à Bouteville

Retour au point de RV initial. Les amis stationnent, retirent l'équipement, l'app détecte la fin de session (écrans #10-12 retour aux stands).

C'est ici que les premières observations de l'app sur les écrans Bilan, Carte, Zoom virage doivent apparaître. **C'est le moment-clé du test technique**.

### 13h00-15h00 — Déjeuner-débrief

Réservation préalable dans un restaurant de Bouteville ou des environs pouvant accueillir le groupe.

Pendant le déjeuner :
- Repas convivial classique
- Mais avec un **temps structuré de retour** : faites un tour de table où chacun donne ses impressions sur l'app
- Notez les retours (ou enregistrez avec accord oral)
- Distribuez la grille d'observation (Livrable 3) si vous voulez des retours écrits

### 15h00 — Clôture

Restitution des équipements OXV Mirror. Remerciements. Promesse de partager les analyses détaillées dans les jours qui suivent (test du Debrief J+1 le lundi 6 juillet).

---

## 5. Logistique matérielle

### Équipements à apporter (vous)

- **12 boîtiers OXV Mirror** (RaceBox + support magnétique) — à acheter ou louer
- **12 supports magnétiques** ou kits d'installation
- **2-3 boîtiers de réserve** en cas de panne
- **Câbles de recharge** type USB-C pour les RaceBox si besoin
- **Téléphone de secours** pour faire des photos / vidéos
- **Sacs plastique** pour ranger les équipements à la fin

### Communication

- Groupe WhatsApp ou Signal "Balade Découverte OXV — 5 juillet" créé J-7
- Vous y postez les coordonnées GPS, l'horaire, les rappels
- Vous y rappelez les consignes la veille au soir
- Pendant le convoi, le groupe sert de canal de communication entre les voitures (utilisé uniquement à l'arrêt)

### Restauration

- Café/petit-déjeuner du matin : 50 € environ (croissants, thermos café, jus de fruits)
- Déjeuner pour 12-13 personnes : compter 25-35 €/personne, soit 350-450 € total
- Budget total restauration : environ 450-500 €

### Autres dépenses prévisibles

- Location/achat des RaceBox : à voir avec votre planning d'acquisition de l'équipement OXV Mirror
- Carburant pour vous (essence + déplacement) : 50 €
- Imprévus : 100 €

**Budget total estimatif** : 600 à 1000 € pour la demi-journée (hors équipement OXV Mirror déjà acquis pour le développement de l'app).

---

## 6. Documents à préparer

### Pour chaque ami invité

- **Lien d'inscription** sur oxvehicle.fr (l'offre Balade Découverte sera visible)
- **Mot de bienvenue** personnel par message direct
- **Plan du parcours** envoyé par WhatsApp/Signal la veille

### Sur place

- **Liste des participants** imprimée avec téléphones
- **Carte papier du parcours** (au cas où le GPS lâche)
- **Décharge de responsabilité signée** par chaque participant (modèle ci-dessous)

### Modèle de décharge à signer sur place

```
DÉCHARGE DE RESPONSABILITÉ

Je soussigné(e) [nom prénom], reconnais participer librement à
la « Balade Découverte OXV » du 5 juillet 2026 à Bouteville,
organisée à titre privé et entre amis par Gabin Dupont.

Je reconnais que :
- Cet événement n'est pas une manifestation sportive
- Je m'engage à respecter le Code de la route en permanence
- Mon assurance auto personnelle couvre ma participation
- Je suis seul responsable de mon véhicule et de ma conduite
- L'organisateur ne peut être tenu responsable d'aucun
  incident résultant de mon comportement de conducteur

Date et signature :
```

Ce document est **important juridiquement**. Il atteste que chacun participe en pleine connaissance du caractère privé et non sportif de l'événement.

---

## 7. Risques et points de vigilance

### Risque 1 — Météo défavorable

Si la météo est mauvaise (orage, pluie continue), reportez la balade. La journée perd son intérêt convivial sous la pluie.

**Date alternative** : dimanche 6 juillet, voire 12-13 juillet en cas de pluie persistante.

### Risque 2 — Désistement de dernière minute

Si moins de 8 amis confirment à J-3, vous avez deux options :
- Maintenir avec moins de monde (6-7 personnes) : le test reste valide
- Reporter d'une semaine ou deux

### Risque 3 — Panne d'un équipement OXV Mirror

Vous emportez 2-3 boîtiers de secours. Si un boîtier lâche en route, vous le remplacez à la pause de mi-parcours.

### Risque 4 — App qui plante en conditions réelles

C'est paradoxalement **ce que vous voulez découvrir**. Notez précisément :
- Quels écrans plantent et dans quelles conditions
- Les messages d'erreur affichés
- Les actions que vous avez dû faire pour récupérer

Ces bugs sont la matière première de la V1.1.

### Risque 5 — Amis qui n'aiment pas l'expérience

Possible. Acceptez-le. Notez précisément ce qu'ils n'ont pas aimé. C'est très précieux.

---

## 8. Ce que la journée doit valider

### Objectifs techniques

- L'inscription oxvehicle.fr fonctionne pour 10+ pilotes en parallèle
- Les rituels J-7, J-2, J-1 partent correctement
- L'audio personnalisé est de qualité (10-12 voix générées sans bug)
- L'app détecte l'arrivée à Bouteville (géolocalisation)
- Le jumelage BLE fonctionne pour 10+ équipements simultanément
- L'enregistrement de session tient sur 1h30 sans perte
- Les données sont remontées correctement à la fin
- Les algorithmes produisent quelque chose de cohérent même hors-circuit

### Objectifs expérientiels

- Le parcours client est-il fluide pour des non-initiés ?
- Le ton OXV (sec, premium, Ferrari) est-il bien reçu ?
- Le pacte de pilotage est-il compris ?
- L'app est-elle perçue comme un coach ou comme un miroir ?
- Le debrief J+1 (le lundi 6 juillet) génère-t-il de l'enthousiasme ou de l'indifférence ?

### Objectifs commerciaux

- Vos amis seraient-ils prêts à payer pour cette expérience en vrai ?
- Si oui, à quel prix maximum ?
- Quel est le mot le plus utilisé pour décrire OXV après l'expérience ?

---

## 9. Après la journée

### Le soir du 5 juillet

- Récupération de toutes les fiches d'observation signées
- Sauvegarde des données télémétriques côté backend
- Premier point à chaud : ce qui a marché, ce qui n'a pas marché

### Le lundi 7 juillet

- **Envoi automatique du debrief J+1** à chaque participant
- Observation des réactions (l'audio, le ton littéraire, etc.)
- Premier feedback à recueillir 24-48h après

### La semaine du 7-13 juillet

- Synthèse écrite des observations
- Identification des bugs prioritaires
- Plan de correction V1.1 si nécessaire avant lancement commercial

### Communication post-événement

Vous pouvez profiter de cet événement pour :
- Prendre quelques photos professionnelles (avec accord des amis)
- Faire un teaser vidéo court (sans nommer "test alpha")
- Publier sur les réseaux d'OXV en présentant ça comme un "moment entre passionnés" — c'est plus chaleureux que "test alpha"

---

## 10. En une phrase

> *Une demi-journée d'amitié et de validation, où OXV passe pour la première fois entre les mains de gens qui ne sont pas vous, dans un contexte où vous pouvez tout observer et tout apprendre.*

C'est exactement ce qu'il faut faire avant le vrai lancement.

---

*Document à imprimer et à conserver. Une checklist J-1 sera utile pour ne rien oublier.*

*Plan opérationnel — Balade Découverte OXV — Version 1.0 — Mai 2026*
