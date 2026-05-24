# Plan hebdomadaire — Développement OXV Coach

> Feuille de route pour Claude Code, du démarrage à la soumission App Store.
> 14 semaines de développement par incréments validés.

---

## Vue d'ensemble

| Phase | Semaines | Livrable |
|---|---|---|
| **Phase 1 — Fondations** | 1-2 | Projet React Native + Supabase + Auth |
| **Phase 2 — Hardware** | 3-4 | Intégration BLE RaceBox + parser UBX |
| **Phase 3 — Cœur** | 5-7 | 5 écrans principaux + algorithmes V1 |
| **Phase 4 — Écrans secondaires** | 8-10 | Onboarding, settings, comparateur, partage |
| **Phase 5 — Polish** | 11-12 | Edge cases, tests, performance |
| **Phase 6 — Publication** | 13-14 | TestFlight + soumission stores |

---

## Semaine 0 — Onboarding de Claude Code

**Durée** : 1-2 heures (pas une vraie semaine de travail)

**Objectif** : s'assurer que Claude Code a compris le projet avant de coder.

**Tâches** :
- Lire `CLAUDE.md` intégralement
- Lire les documents dans l'ordre indiqué (étapes 1 à 5)
- Lister les questions de clarification
- Produire le rapport `roadmap/rapports/semaine-0-onboarding.md`

**Livrable** : rapport d'onboarding démontrant la compréhension de la doctrine OXV, de l'architecture, et du plan.

**Validation par Gabin** : relecture du rapport + réponses aux questions de clarification.

---

## Semaine 1 — Setup du projet

**Objectifs** :
- Initialiser le projet React Native Expo + TypeScript
- Configurer Supabase (récupérer les credentials du project existant de Gabin)
- Mettre en place la structure de dossiers
- Configurer Git + GitHub Actions (CI basique)

**Tâches détaillées** :

```
Jour 1 : Init projet
- npx create-expo-app oxv-coach-app --template
- Configuration TypeScript strict
- Setup ESLint + Prettier
- Structure src/ initiale (screens/, components/, lib/, hooks/, types/)

Jour 2 : Supabase
- Installation @supabase/supabase-js
- Configuration variables d'environnement (.env)
- Test de connexion
- Génération des types TypeScript depuis le schéma existant

Jour 3 : Navigation
- Setup react-navigation
- Stack navigators pour les flux principaux
- Mode sombre forcé (cohérent avec la doctrine OXV)

Jour 4 : Auth basique
- Écran de login (email + mot de passe Supabase)
- Persistance de la session (AsyncStorage chiffré)
- Logout

Jour 5 : Build de validation
- expo prebuild
- Premier build iOS et Android via EAS
- Test sur simulateur
```

**Livrables** :
- Code source initial poussé sur GitHub
- README de setup pour reproduire l'environnement
- Build TestFlight interne fonctionnel (écran de login uniquement)

**Validation** : l'app se lance, on peut se connecter avec un compte Supabase existant, on voit "Bienvenue Gabin".

---

## Semaine 2 — Schéma de données et state management

**Objectifs** :
- Mettre en place Zustand pour la gestion d'état
- Setup WatermelonDB pour la persistance offline
- Définir tous les types TypeScript du domaine OXV

**Tâches détaillées** :

```
Jour 1-2 : Zustand stores
- AuthStore (utilisateur connecté)
- SessionStore (session active)
- DataStore (données télémétriques)
- UIStore (état d'interface)

Jour 3-4 : WatermelonDB
- Modèles correspondant aux tables Supabase
- Sync bidirectionnelle Supabase ↔ local
- Gestion des conflits last-write-wins

Jour 5 : Types TypeScript exhaustifs
- Types métier (Pilot, Session, Lap, Sector, Margin)
- Types BLE (RaceBoxDevice, UbxFrame)
- Types UI (Theme, Screen states)
```

**Livrables** :
- Stores fonctionnels et testés
- WatermelonDB sync opérationnelle (vérifiable en coupant le réseau)
- Documentation TypeScript complète

**Validation** : on peut créer une session en local, la couper du réseau, la modifier, la reconnecter, et voir la sync se faire automatiquement.

---

## Semaine 3 — BLE RaceBox

**Objectifs** :
- Implémenter la connexion BLE avec un RaceBox Mini
- Recevoir les trames UBX en streaming
- Stocker les données brutes localement

**Notes importantes** :
- Bibliothèque : `react-native-ble-plx`
- Permissions à demander : Bluetooth + Location (Android)
- RaceBox Mini : service UUID `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`

**Tâches détaillées** :

```
Jour 1 : Scan BLE
- Permissions iOS et Android
- Scan des appareils RaceBox visibles
- Écran de sélection (#08 — détection équipement)

Jour 2-3 : Connexion et streaming
- Pairing avec le RaceBox
- Subscription aux caractéristiques notify
- Reception du flux UBX (25 Hz par défaut)

Jour 4 : Stockage brut
- Écriture des trames UBX en streaming dans un fichier local
- Une session = un fichier .ubx
- Compression au moment de la sync vers Supabase Storage

Jour 5 : Reconnexion automatique
- Détection des coupures BLE
- Reconnexion transparente
- Écran #25 (BLE error) en cas de coupure persistante
```

**Livrables** :
- Connexion BLE fonctionnelle avec un vrai RaceBox (Gabin doit en avoir un)
- Fichier .ubx de session enregistré
- Tests : couper le BLE pendant 30 secondes, le voir se reconnecter

**Validation** : on peut connecter un RaceBox, démarrer un enregistrement, voir les données arriver, et terminer la session avec un fichier .ubx valide.

---

## Semaine 4 — Parser UBX et bouton BLE

**Objectifs** :
- Parser les trames UBX (positions GPS, accélérations, vitesses)
- Intégrer le bouton Flic 2 pour le marquage manuel
- Préparer les données pour les algorithmes

**Tâches détaillées** :

```
Jour 1-2 : Parser UBX
- Décodage du format UBX (header, classe, ID, payload, checksum)
- Extraction des messages NAV-PVT (position) et HNR-INS (inertiel)
- Conversion vers types TypeScript propres
- Tests unitaires sur des fichiers UBX d'exemple

Note : démarrer avec un parser JavaScript pur. Le passage à Rust+WASM
peut être fait plus tard si nécessaire pour les performances.

Jour 3 : Calcul de trajectoire
- Reconstruction de la trajectoire 2D sur le circuit
- Détection des tours (passage de ligne de start/finish)
- Découpage en secteurs

Jour 4 : Bouton Flic 2
- Pairing avec un Flic 2 (sa propre lib BLE)
- Détection des clic simple / double-clic / triple-clic
- Stockage des marqueurs avec timestamp précis

Jour 5 : Visualisation rapide
- Écran temporaire de debug montrant les données parsées
- Vérification visuelle de la trajectoire sur le circuit
```

**Livrables** :
- Parser UBX testé avec couverture > 80%
- Bouton Flic 2 connecté et marqueurs enregistrés
- Trajectoire visible (même brute) sur un écran de debug

**Validation** : on peut prendre un fichier UBX de session réelle, le parser, et reconstruire la trajectoire sur le circuit Beltoise.

---

## Semaine 5 — Écran #20 (Accueil) + Écran #13 (Bilan)

**Objectifs** :
- Implémenter l'écran d'accueil (hub central) dans ses 3 modes
- Implémenter le premier écran d'analyse : le bilan global

**Tâches détaillées** :

```
Jour 1-2 : Écran #20 — Accueil
- Mode A : compte à rebours session à venir
- Mode B : "Bon trajet vers Beltoise" en route
- Mode C : accueil passif hors-piste
- Détection du mode selon contexte (state machine S4, S5, S10)

Jour 3 : Algorithme de marge V1
- Calcul de la marge composite (vehicle × pilot)
- 3 zones : Verte > 30%, Jaune 15-30%, Rouge < 15%
- Version simplifiée pour V1 (pas de Pacejka complet)

Jour 4-5 : Écran #13 — Bilan
- Indicateur central unique (la marge en %)
- Étiquette humaine ("Confortable", "À explorer", "Terrain serré")
- Phrase d'introduction manifeste
- Navigation vers les autres écrans
```

**Livrables** :
- Écran #20 dans ses 3 modes, testable selon contexte
- Écran #13 fonctionnel avec données réelles d'une session

**Validation** : après une session, on ouvre l'app et on voit son bilan avec le bon chiffre central et la bonne couleur.

---

## Semaine 6 — Écran #14 (Carte) + Écran #15 (Zoom virage)

**Objectifs** :
- Implémenter la carte du circuit avec les pastilles colorées par virage
- Implémenter le zoom sur un virage spécifique

**Tâches détaillées** :

```
Jour 1-2 : Écran #14 — Carte du circuit
- SVG du tracé Beltoise (à demander à Gabin ou à dessiner)
- 14 pastilles colorées pour les 14 virages
- Toggle vue plan / vue satellite
- Sélection multi-trajectoires (meilleur tour, moyen, idéal)

Jour 3-4 : Écran #15 — Zoom virage
- Vue détaillée d'un virage avec ses 3 éclairages :
  - Trajectoire (votre tracé vs trajectoire idéale)
  - Physique (transferts de charge, vitesse, accélération)
  - Question (observation qualitative, pas instruction)

Jour 5 : Tests et polish
- Tests sur plusieurs sessions
- Animations de transition entre carte et zoom
- Gestes (swipe entre virages)
```

**Livrables** :
- Écran #14 avec carte interactive
- Écran #15 avec 3 éclairages par virage
- Navigation fluide entre les deux

**Validation** : on peut explorer ses 14 virages, voir leurs marges, et drill-down dans un virage spécifique.

---

## Semaine 7 — Écran #16 (Prochaine fois) + Écran #17 (Progression)

**Objectifs** :
- Implémenter "La prochaine fois" (la suggestion centrale)
- Implémenter "Progression" (suivi dans le temps long)

**Tâches détaillées** :

```
Jour 1-2 : Écran #16 — La prochaine fois
- Identification automatique de UNE zone à creuser
- Phrase contextuelle ("La prochaine fois, dans le virage 7...")
- Formulation interrogative ou observationnelle (jamais directive)
- Bouton pour marquer "Compris" ou "Reporter"

Jour 3-4 : Écran #17 — Progression
- Graphique de marge globale sur les N dernières sessions
- Granularité semaine / mois / global
- Phrase manifeste "Vous avancez"
- Pas de comparaison avec d'autres pilotes

Jour 5 : Tests fin de phase 3
- Tests bout-en-bout sur les 5 écrans principaux
- Performance : temps de chargement < 1s par écran
- Premier rapport de mi-parcours (semaine 7)
```

**Livrables** :
- Écran #16 avec suggestion contextuelle
- Écran #17 avec courbe de progression
- App fonctionnelle de bout en bout sur les 5 écrans principaux

**Validation** : un parcours pilote complet est possible : ouvrir l'app → voir le bilan → explorer la carte → zoomer sur un virage → voir la suggestion → consulter la progression.

**Recommandation** : à ce stade, **audit par un développeur senior humain** (1-2 jours, 800-1500 €). C'est le bon moment pour détecter les problèmes architecturaux avant de continuer.

---

## Semaine 8 — Onboarding (écrans #01-06)

**Objectifs** :
- Implémenter le flux d'onboarding complet
- Connecter avec les CGU/Pacte/Confidentialité

**Tâches détaillées** :

```
Jour 1 : Écran #01 — Accueil philosophique
Jour 2 : Écran #02 — Doctrine + Écran #03 — Méthode
Jour 3 : Écran #04 — Niveau pilote (4 niveaux)
Jour 4 : Écran #05 — CGU/RGPD consent (case à cocher horodatée)
Jour 5 : Écran #06 — Pacte de pilotage (signature engagement)
```

**Livrables** :
- Flux d'onboarding testé end-to-end
- Acceptations stockées en base avec horodatage
- Documents juridiques consultables depuis l'app

**Validation** : un nouvel utilisateur peut s'inscrire, comprendre OXV, accepter le pacte, et arriver à l'accueil S3 (attente).

---

## Semaine 9 — Paddock + Retour stands (#07-12)

**Objectifs** :
- Implémenter le jumelage paddock
- Implémenter le retour aux stands

**Tâches détaillées** :

```
Jour 1 : Écran #07 — "Vous y êtes"
Jour 2 : Écran #08 — Détection équipement
Jour 3 : Écran #09 — Placement
Jour 4 : Écran #10 — "Vous avez piloté"
Jour 5 : Écran #11 — "Données en sécurité" + #12 — "Bilan prêt"
```

**Livrables** :
- Flux complet paddock → retour stands
- Détection automatique de la fin de session (geo + vitesse)

---

## Semaine 10 — Comparateur + Settings + Notifications

**Objectifs** :
- Implémenter le comparateur de sessions
- Implémenter les paramètres
- Implémenter les notifications in-app

**Tâches détaillées** :

```
Jour 1-2 : Écran #18 — Comparateur 3 modes
- Évolution immédiate (<7j)
- Évolution récente (7j-3mois)
- Progression (>3mois)

Jour 3 : Écran #24 — Settings
- Pacte affiché en signature en haut
- Préférences (notifications, unités)
- Comptes, déconnexion

Jour 4 : Écran #23 — Notifications
- 3 tabs : À traiter / À découvrir / Archives
- Badges rouges uniquement sur actions requises

Jour 5 : Partage social (#28 si numéroté)
- 4 scopes (progression/bilan/virage/carte)
- 3 durées (7j/30j/sans limite)
- Génération de lien sécurisé
```

**Livrables** : écrans secondaires complets et fonctionnels.

---

## Semaine 11 — Debrief J+1 + Modes off-track + Edge cases

**Objectifs** :
- Implémenter le debrief J+1 (écran le plus littéraire)
- Modes paddock entre runs, en route, accueil
- Écrans d'erreur (BLE error, offline, MAJ disponible)

**Tâches détaillées** :

```
Jour 1-2 : Écran #19 — Debrief J+1
- Génération du contenu via OpenAI (côté backend)
- 3 actes : Récit / Méta-analyse / Préparation
- Signature manifeste

Jour 3 : Modes off-track (#21 #22)
- Paddock entre runs ("À chaud, l'essentiel")
- En route ("Bon trajet vers Beltoise")

Jour 4 : Edge cases
- Écran #25 — BLE error
- Écran #26 — Offline mode (bandeau jaune)
- Écran #27 — App update V1.1

Jour 5 : 3 vues admin OXV
- Préparation (pilotes + assignations équipement)
- En cours (live BLE state)
- Analytique (post-session metrics)
```

**Livrables** : tous les 26 écrans + 3 admin implémentés.

---

## Semaine 12 — Polish + Performance + Tests

**Objectifs** :
- Performance : tous les écrans < 1s de chargement
- Animations fluides à 60fps
- Tests utilisateurs internes

**Tâches détaillées** :

```
Jour 1 : Profiling React Native
- Identification des bottlenecks
- Optimisation des re-renders
- Lazy loading des écrans secondaires

Jour 2 : Animations
- Transitions entre écrans
- Animations sur le bilan (chiffre qui s'incrémente)
- Feedback haptique sur les actions critiques

Jour 3-4 : Tests internes
- Build TestFlight pour Gabin
- Test sur iPhone et Android réel
- Liste des bugs prioritaires

Jour 5 : Corrections critiques
- Bugs bloquants uniquement
- Validation finale
```

**Livrables** : app stable, fluide, prête pour bêta-test élargi.

---

## Semaine 13 — TestFlight et bêta

**Objectifs** :
- Distribution TestFlight aux 12 amis du test alpha
- Recueil des retours
- Corrections rapides

**Tâches détaillées** :

```
Jour 1 : Setup TestFlight
- Build de production iOS
- Internal Testing puis External Testing
- Distribution aux 12 amis

Jour 2-3 : Distribution Google Play Internal Testing
- Build AAB
- Compte testeurs configuré
- Distribution Android

Jour 4-5 : Recueil retours + corrections
- Hot-fixes des bugs bloquants
- Pas de nouvelles features à ce stade
```

**Livrables** : app testée par 12 utilisateurs réels.

---

## Semaine 14 — Soumission App Store et Google Play

**Objectifs** :
- Soumission officielle aux deux stores
- Préparation de la communication de lancement

**Tâches détaillées** :

```
Jour 1 : Captures d'écran (avec un designer ou Gabin)
- 6 captures iOS selon storyboard
- 6 captures Android selon storyboard
- Conformes au kit App Store

Jour 2 : Métadonnées
- Saisie dans App Store Connect (Apple)
- Saisie dans Google Play Console
- URL politique de confidentialité OK

Jour 3 : Notes pour reviewers
- Compte de test pré-chargé
- Vidéo de démonstration si demandée
- Soumission Apple

Jour 4 : Soumission Google
- Submission via Play Console
- Réponse aux questions de classification

Jour 5 : Préparation lancement
- Communication aux 12 amis
- Préparation newsletter OXV
- Prêt pour publication officielle
```

**Livrables** : app soumise aux deux stores, en attente de validation.

**Délai post-soumission** :
- Apple : 24-48h de review
- Google : 1-7 jours de review

**Publication officielle** : dès validation des deux stores.

---

## Après la semaine 14

### Phase de maintenance et V1.1

- **Mois 1 après publication** : monitoring intensif, hot-fixes
- **Mois 2-3** : V1.1 intégrant les retours utilisateurs des 12 amis
- **Mois 4-6** : V1.2 et nouvelles fonctionnalités selon roadmap produit

### Points d'attention permanents

- **Surveillance des crashes** : Sentry ou équivalent
- **Métriques d'usage** : usage des écrans, taux de complétion onboarding
- **Feedback utilisateur** : canal direct contact@oxvehicle.fr

---

## Rappels essentiels

### Doctrine respectée à chaque semaine

- Sécurité avant performance (toute feature peut-elle pousser le pilote à dépasser ses limites ?)
- L'app est un miroir, pas un coach (verbes interdits respectés ?)
- Silence en piste (aucun écran pendant le roulage)
- Ton OXV (vouvoiement, sec, sans emoji)
- Un seul chiffre par écran

### Communication entre vous

À chaque fin de semaine, **Claude Code produit un rapport** dans `roadmap/rapports/semaine-N.md` et **attend la validation de Gabin** avant de démarrer la suivante.

Si une semaine déborde, c'est normal. Mieux vaut une semaine de plus que sacrifier la qualité.

---

## Estimation finale

- **Durée totale** : 14 semaines de dev (3,5 mois)
- **Soumission stores** : fin semaine 14
- **Publication officielle** : semaine 15-16
- **Lancement commercial** : septembre-octobre 2026 (réaliste si démarrage juin 2026)

---

*Plan hebdomadaire OXV Coach — Version 1.0 — Mai 2026*

*Conçu pour Claude Code avec validation hebdomadaire par Gabin Dupont.*
