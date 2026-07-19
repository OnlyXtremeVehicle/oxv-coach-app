# Overview des 26 écrans OXV Mirror

> Description textuelle détaillée de chaque écran de l'app pour permettre l'implémentation par Claude Code.
> Les maquettes visuelles V3 ont été produites en HTML/SVG dans la conversation chat de référence ; ce document en transcrit l'essentiel.

---

## Principes visuels communs à tous les écrans

### Palette OXV stricte

- **Noir profond** `#050505` — fond par défaut
- **Blanc principal** `#FFFFFF` — texte principal
- **Blanc atténué** `rgba(255,255,255,0.55)` — texte secondaire
- **Rouge OXV** `#C8102E` — accent principal, alertes
- **Vert OXV** `#97C459` — zones vertes (marge confortable)
- **Orange OXV** `#EF9F27` — zones jaunes (marge à explorer)
- **Or Heritage** `#C4A459` — réservé aux écrans Heritage uniquement
- **Bronze admin** `#B87333` — réservé aux 3 vues admin

### Typographie

- **System UI** (SF Pro sur iOS, Roboto sur Android)
- **Weights** : 200 (ultra-light) pour les chiffres centraux, 300-400 pour le texte, 500 pour les labels
- **Letter-spacing** : 0.18em à 0.28em pour les eyebrows et labels en majuscules

### Hiérarchie type

- **Eyebrow** : 10-11px en majuscules, monospace, opacité 0.4-0.5
- **Chiffre central** : 80-120px, weight 200
- **Titre** : 24-28px, weight 200
- **Corps** : 13-14px, weight 300
- **Caption** : 11-12px, weight 300

### Esthétique

- **Mode sombre exclusif** (pas de mode clair)
- **Pas d'emojis** (sauf si explicitement demandé par utilisateur)
- **Pas de gradients clinquants** (sobre type Ferrari/Apple)
- **Espacements généreux** (padding 24-32px sur conteneurs principaux)
- **Bords arrondis subtils** (12-18px sur cards)

---

## SECTION A — Onboarding (écrans #01-06)

### #01 — Accueil philosophique

**Contexte** : tout premier écran à l'ouverture après installation.

**Composition** :

- Insigne OXV grand centré (faucon stylisé rouge sur noir)
- Sous l'insigne, en majuscules letter-spaced : `OXV MIRROR`
- Sous le titre, une phrase manifeste : _"Bienvenue dans le miroir."_
- En bas, bouton discret : `Commencer` (rouge OXV, plein, large)

**Comportement** :

- Tap "Commencer" → écran #02
- Pas de bouton "passer" — l'onboarding est complet ou rien

---

### #02 — Doctrine

**Contexte** : pose la philosophie OXV avant tout le reste.

**Composition** :

- Titre en haut : _"Une app qui vous montre."_
- En dessous, trois phrases empilées :
  - _"Pas un coach."_
  - _"Pas un instructeur."_
  - _"Un miroir."_
- En bas, phrase explicative en italique : _"Les décisions de pilotage vous appartiennent. Toujours."_
- Bouton `Compris` (rouge OXV)

---

### #03 — Méthode

**Contexte** : explique la méthode pédagogique en 3 mots.

**Composition** :

- Eyebrow : `LA MÉTHODE OXV`
- Trois colonnes empilées (mobile) ou en ligne (tablette) :
  - **VOIR** — _"Ce qui s'est passé"_
  - **COMPRENDRE** — _"Ce que vous avez senti"_
  - **QUESTIONNER** — _"Ce que vous voulez explorer"_
- Phrase en bas : _"Jamais d'instruction. Toujours une observation."_
- Bouton `Suivant`

---

### #04 — Niveau pilote

**Contexte** : permet à l'app de calibrer ses analyses.

**Composition** :

- Titre : _"Où vous situez-vous ?"_
- 4 niveaux sélectionnables (cards verticales) :
  - **Débutant** — _"Quelques journées circuit, je découvre"_
  - **Apprivoisé** — _"Je connais Beltoise, je progresse session après session"_
  - **Confirmé** — _"Je tourne régulièrement, je connais mes limites"_
  - **Expert** — _"J'ai un fond compétition, je cherche la précision"_
- Sélection unique
- Bouton `Continuer` activé après sélection

**Note** : ce niveau n'est pas visible aux autres pilotes. Il sert uniquement à calibrer les seuils internes des algorithmes.

---

### #05 — CGU / RGPD consent

**Contexte** : acceptation légale obligatoire.

**Composition** :

- Titre : _"Avant de continuer"_
- Trois cases à cocher (toutes obligatoires) :
  - ☐ _"J'accepte les Conditions Générales d'Utilisation"_ (lien vers texte intégral)
  - ☐ _"J'ai lu la Politique de confidentialité"_ (lien)
  - ☐ _"Je confirme avoir 18 ans révolus et un permis B valide"_
- Bouton `J'accepte` désactivé tant que les 3 cases ne sont pas cochées
- Horodatage côté Supabase à l'activation

---

### #06 — Pacte de pilotage

**Contexte** : LA signature manifeste, le moment le plus important de l'onboarding.

**Composition** :

- Fond noir absolu (signature visuelle)
- Eyebrow : `PACTE DE PILOTAGE`
- Au centre, en grand, deux phrases :
  - _"L'app est un miroir. Elle vous montre. Elle ne vous dirige pas."_
  - _"La piste est à vous. Les décisions aussi."_
- En bas, une seule case à cocher : _"Je m'engage."_
- Bouton `Activer OXV Mirror`

**Important** : ce pacte est consultable à tout moment depuis Settings (#24), affiché en signature en haut.

---

## SECTION B — Paddock et arrivée (écrans #07-09)

### #07 — "Vous y êtes"

**Contexte** : déclenché par géolocalisation à l'arrivée au circuit (état S5 → S7).

**Composition** :

- Eyebrow : `BIENVENUE`
- Titre principal : _"Vous y êtes."_
- Sous-titre : nom du circuit ("Circuit de Haute Saintonge" ou "Bouteville" selon contexte)
- Visualisation discrète : trace satellite du circuit en arrière-plan, désaturée
- Bouton : `Jumeler mon équipement`

---

### #08 — Détection équipement

**Contexte** : scan BLE en cours pour détecter le RaceBox.

**Composition** :

- Animation discrète (pulsation, pas d'animation criarde)
- Texte : _"À la recherche de votre équipement OXV Mirror…"_
- Liste des appareils détectés (généralement 1) :
  - Card "OXV-A47" avec icône discrete + bouton `Sélectionner`
- En cas d'échec après 30 secondes : fallback vers écran #25 (BLE error)

**Note de doctrine** : utiliser "Équipement OXV Mirror" et pas "RaceBox" côté pilote (brand-neutral).

---

### #09 — Placement

**Contexte** : instructions de placement physique du boîtier.

**Composition** :

- Illustration schématique d'un tableau de bord avec emplacement marqué
- Texte explicatif : _"Posez le boîtier sur le support magnétique côté passager."_
- Sous-texte : _"Vous le verrez peu. Il s'occupera du reste."_
- Bouton : `C'est fait`
- Bouton secondaire : `Aide` (popup explicative)

---

## SECTION C — Roulage (état S6, aucun écran)

**Doctrine** : pendant le roulage, **aucun écran n'est valide**. L'app ne s'affiche pas, ne notifie pas, ne sonne pas. Seul le bouton Flic 2 BLE peut être pressé physiquement par le pilote pour marquer un moment.

---

## SECTION D — Retour aux stands (écrans #10-12)

### #10 — "Vous avez piloté"

**Contexte** : détection de la fin de session (geo + vitesse 0 + timer).

**Composition** :

- Visualisation poétique : une horloge qui s'arrête en silence
- Eyebrow : `SESSION TERMINÉE`
- Titre : _"Vous avez piloté."_
- Sous-titre : durée totale, nombre de tours bouclés
- Pas de bouton — transition automatique vers #11 après 4 secondes

---

### #11 — "Vos données sont en sécurité"

**Contexte** : sync en cours vers Supabase.

**Composition** :

- Indicateur de progression discret (pas de pourcentage criard)
- Texte : _"Vos données sont en sécurité."_
- Sous-texte : _"Préservation en cours… X / Y trames"_
- **Mot-clé important** : utiliser "Préservation" et pas "Sauvegarde"

---

### #12 — "Votre bilan est prêt"

**Contexte** : sync terminée, données prêtes à être analysées.

**Composition** :

- Titre : _"Votre bilan est prêt."_
- Sous-titre : _"Quand vous le souhaitez."_
- Deux boutons :
  - `Découvrir` (rouge OXV, principal)
  - `Plus tard` (texte simple, secondaire)

**Doctrine importante** : ne jamais forcer le pilote à consulter immédiatement. Respecter son rythme.

---

## SECTION E — Écrans d'analyse (écrans #13-17, les 5 principaux)

### #13 — Bilan

**LE plus important.** Première chose qu'un pilote voit après une session.

**Composition** :

- Eyebrow : `BILAN DE SESSION`
- **Au centre** : chiffre géant `24%` (la marge composite globale) en weight 200
- **Sous le chiffre** : étiquette humaine selon zone :
  - Vert (> 30%) : _"Confortable"_
  - Orange (15-30%) : _"À explorer"_
  - Rouge (< 15%) : _"Terrain serré"_
- **Phrase manifeste** en dessous : _"Belle séance. Vous avez du terrain à explorer en sécurité."_
- **Navigation vers les autres écrans** en bas (4 cards) :
  - `Carte du circuit` → #14
  - `Détails par virage` → #15
  - `La prochaine fois` → #16
  - `Progression` → #17

**Logique de couleur** : la couleur du chiffre central s'aligne sur la zone (vert/orange/rouge).

---

### #14 — Carte du circuit

**Composition** :

- Tracé Beltoise en SVG, dessiné sobrement
- **14 pastilles colorées** positionnées sur les 14 virages, leur couleur reflétant la marge par virage :
  - Vert : virage maîtrisé
  - Orange : virage à explorer
  - Rouge : virage serré
- Toggle en haut : `Plan` / `Satellite` (image aérienne désaturée)
- Sélecteur de trajectoire (3 options) :
  - _"Mon meilleur tour"_
  - _"Tracé moyen"_
  - _"Tour idéal"_ (calculé)
- Tap sur une pastille → écran #15 (zoom virage)

---

### #15 — Zoom virage

**Composition** :

- En haut : numéro et nom du virage (ex. _"Virage 7 — Le S des chênes"_)
- Indicateur de marge pour ce virage spécifique
- **3 éclairages empilés** :

**Éclairage 1 — Trajectoire**

- Visualisation 2D du virage avec deux courbes : votre tracé (rouge OXV) + tracé idéal (gris)
- Observation : _"Votre point de corde était 12 mètres après l'optimum."_

**Éclairage 2 — Physique**

- Mini graphiques : vitesse à l'entrée, accélération latérale max, transfert de charge
- Observation : _"Votre vitesse mini était stable. Votre voiture était sereine."_

**Éclairage 3 — Question**

- Une seule question ouverte : _"Était-ce volontaire ?"_
- Pas de réponse attendue, juste pour faire réfléchir
- Optionnel : champ libre pour noter une intention

---

### #16 — La prochaine fois

**Composition** :

- Eyebrow : `LA PROCHAINE FOIS`
- **UNE SEULE phrase centrale** : _"Le virage 7 vous tend les bras."_
- **Sous-titre** : _"Vous avez 18% de marge à explorer. La prochaine fois, peut-être un peu plus tôt sur les freins ?"_
- **Important** : formulation interrogative, jamais directive
- Boutons :
  - `Marqué` (confirme avoir lu)
  - `Plus tard` (reporter)
- Phrase de signature : _"Une chose. Pas plus."_

---

### #17 — Progression

**Composition** :

- Eyebrow : `PROGRESSION`
- Graphique principal : courbe de marge globale sur les N dernières sessions
- Granularité ajustable : `Semaine` / `Mois` / `Tout`
- **Pas de comparaison avec d'autres pilotes** (doctrine)
- Phrase manifeste : _"Vous avancez."_
- Stats secondaires en bas (cards) :
  - Nombre de sessions
  - Marge moyenne
  - Marge meilleure session

---

## SECTION F — Hub central (écran #20)

### #20 — Accueil

**Le hub central.** Apparaît à l'ouverture quand on n'est ni à l'onboarding, ni au paddock, ni en debrief.

**3 modes selon contexte** :

**Mode A — Compte à rebours (état S4)**

- Eyebrow : `PROCHAINE SESSION`
- Au centre : nombre de jours avant la session (ex. `5 jours`)
- Nom du circuit, heure
- Bouton : `Voir les détails`

**Mode B — En route (état S5)**

- Eyebrow : `EN ROUTE`
- Au centre : _"Bon trajet vers Beltoise."_
- Sous-texte : _"Couper l'app. Je conduis."_
- L'app se met en sourdine automatiquement
- Pas de bouton (interdit pendant la conduite)

**Mode C — Accueil passif (états S3, S10)**

- Salutation : _"Bonsoir, Gabin."_
- Si dernière session récente : raccourci vers #13 (bilan)
- Si pas de session prévue : invitation discrète à explorer la progression (#17)
- Pas de pression commerciale

---

## SECTION G — Modes off-track (écrans #21-22)

### #21 — Accueil en route

**Identique au mode B de #20.** Considéré comme variante d'écran.

### #22 — Paddock entre runs

**Contexte** : pendant la session, entre deux runs (état S7 actif).

**Composition** :

- Vue compacte du dernier run effectué
- Indicateur de marge du run terminé
- _"À chaud, l'essentiel."_
- Bouton : `Préparer le prochain run` (vide pour relancer le jumelage)

---

## SECTION H — Système (écrans #23-27)

### #23 — Notifications

**Composition** :

- 3 tabs en haut : `À traiter` / `À découvrir` / `Archives`
- Badges rouges uniquement sur "À traiter"
- Liste de notifications avec timestamp
- Tap → navigation contextuelle

---

### #24 — Settings

**Composition** :

- **Pacte affiché en signature en haut** (les 2 phrases manifeste)
- Sections :
  - Compte (email, mot de passe, déconnexion)
  - Préférences (unités, notifications)
  - Données (export, suppression compte)
  - Légal (CGU, Confidentialité, Pacte)
  - À propos (version, contact)

---

### #25 — BLE error

**Contexte** : équipement perdu pendant une session.

**Composition** :

- Illustration orange (pas rouge — pas paniquer)
- Texte : _"Connexion à l'équipement perdue."_
- Sous-texte rassurant : _"Vos données déjà enregistrées sont sauvegardées."_
- Boutons :
  - `Reconnecter`
  - `Continuer sans` (l'app passe en mode dégradé)

---

### #26 — Offline mode

**Composition** :

- Bandeau jaune discret en haut : _"Mode hors-ligne"_
- Liste claire dans l'écran :
  - **Ce qui fonctionne** : visualisation des sessions déjà téléchargées
  - **Ce qui ne fonctionne pas** : nouvelles sessions, partage, MAJ
- Action : `Réessayer` ou attente automatique

---

### #27 — App update V1.1

**Composition** :

- Eyebrow : `MISE À JOUR DISPONIBLE`
- Titre : nouveau numéro de version
- 3 nouveautés expliquées (3 cards) :
  - Nouvelle fonctionnalité X
  - Amélioration Y
  - Correction Z
- Bouton : `Mettre à jour` ou `Plus tard`

---

## SECTION I — Debrief J+1 (écran #19)

### #19 — Debrief J+1

**LE plus littéraire de tous.** Envoyé en notification le lendemain matin.

**Composition en 3 actes** :

**Acte 1 — Récit** (généré par OpenAI)

- _"Hier, vous êtes parti prudent. Au bout du 3ème tour, vous avez commencé à chercher. Le virage 7 vous résistait, mais vous y êtes revenu, et vous avez fini par l'apprivoiser. La marge a grimpé de 18 à 27%. Vous avez ressenti ce changement."_

**Acte 2 — Méta-analyse**

- _"C'est votre 3ème session consécutive où votre régularité s'améliore. Vous construisez quelque chose."_

**Acte 3 — Préparation**

- _"La prochaine fois, vous pourrez peut-être explorer le freinage du virage 7 un peu plus tard. Une invitation, pas une consigne."_

**Signature en bas** :

- _"L'app se taira jusqu'à la veille de votre prochaine session. Profitez de cette pause."_
- _"— OXV MIRROR"_

**Important** : ce contenu est généré par OpenAI côté backend, pas dans l'app. L'app reçoit le texte final.

---

## SECTION J — Comparateur (écran #18)

### #18 — Comparateur 3 modes

**Composition** :

- Sélecteur en haut : 3 modes
  - **Évolution immédiate** : comparer 2 sessions récentes (< 7j)
  - **Évolution récente** : comparer périodes (7j vs 3 mois)
  - **Progression** : vue long terme (> 3 mois)
- Pour chaque mode, **même picker** : deux déroulants pour sélectionner les deux références à comparer
- Visualisation : graphique de comparaison côte à côte
- **Chrono subordonné en bas**, en italique : _"Vos chronos évoluent aussi, mais ce n'est pas l'essentiel."_

---

## SECTION K — Admin OXV (3 vues bronze #B87333)

### Vue Admin 1 — Préparation

**Contexte** : staff OXV avant une session.

**Composition** :

- Liste des pilotes inscrits
- Affectation des équipements (RaceBox + Flic) par pilote
- Vérification documents KYC
- Statut briefing

### Vue Admin 2 — En cours

**Contexte** : pendant une session.

**Composition** :

- État BLE de chaque équipement en temps réel
- Pilotes en piste / au paddock
- Alertes en cas de problème

### Vue Admin 3 — Analytique

**Contexte** : post-session.

**Composition** :

- Métriques globales de la session
- Comparaison entre pilotes (anonymisée)
- Export rapport PDF

---

## Récapitulatif des 26 écrans pilote

| #   | Nom                   | Section     | État machine |
| --- | --------------------- | ----------- | ------------ |
| 01  | Accueil philosophique | Onboarding  | S2           |
| 02  | Doctrine              | Onboarding  | S2           |
| 03  | Méthode               | Onboarding  | S2           |
| 04  | Niveau pilote         | Onboarding  | S2           |
| 05  | CGU/RGPD              | Onboarding  | S2           |
| 06  | Pacte de pilotage     | Onboarding  | S2           |
| 07  | Vous y êtes           | Paddock     | S7           |
| 08  | Détection équipement  | Paddock     | S7           |
| 09  | Placement             | Paddock     | S7           |
| 10  | Vous avez piloté      | Retour      | S8           |
| 11  | Données en sécurité   | Retour      | S8           |
| 12  | Bilan prêt            | Retour      | S8           |
| 13  | Bilan                 | Analyse     | S8/S9/S10    |
| 14  | Carte du circuit      | Analyse     | S8/S9/S10    |
| 15  | Zoom virage           | Analyse     | S8/S9/S10    |
| 16  | La prochaine fois     | Analyse     | S8/S9        |
| 17  | Progression           | Analyse     | S10          |
| 18  | Comparateur           | Analyse     | S10          |
| 19  | Debrief J+1           | Décantation | S9           |
| 20  | Accueil (hub)         | Hub         | S3/S4/S10    |
| 21  | Accueil en route      | Off-track   | S5           |
| 22  | Paddock entre runs    | Off-track   | S7           |
| 23  | Notifications         | Système     | All          |
| 24  | Settings              | Système     | All          |
| 25  | BLE error             | Edge case   | S6/S7        |
| 26  | Offline mode          | Edge case   | All          |
| 27  | App update V1.1       | Edge case   | All          |

Plus 3 vues admin (couleur bronze).

---

## Notes finales pour Claude Code

### Sur les illustrations

Plusieurs écrans mentionnent des illustrations (insigne OXV, horloge arrêtée, tableau de bord schématique). Pour la V1 :

- Utiliser des **SVG sobres et géométriques**
- Pas de photos
- Pas de pictogrammes commerciaux (lucide-react acceptable pour les icônes système)

### Sur les transitions

Privilégier des transitions **subtiles** :

- Fade in/out 200-300ms
- Slide vertical pour les pages (300ms)
- Pas d'animations criardes

### Sur les états vides

Pour chaque écran qui pourrait afficher des données vides (première session, pas de tours, etc.) : prévoir un **état vide pédagogique** qui explique sans culpabiliser.

### Sur l'accessibilité

- Contraste minimum 4.5:1
- Tailles tactiles 44pt minimum
- Support VoiceOver et TalkBack
- Pas de couleur seule pour transmettre une information (toujours doubler avec texte ou icône)

---

_Overview des 26 écrans OXV Mirror — Version 1.0 — Mai 2026_

_Document à utiliser par Claude Code pour l'implémentation React Native._
_Les maquettes visuelles V3 d'origine ont été produites en HTML/SVG dans la conversation chat de référence._
