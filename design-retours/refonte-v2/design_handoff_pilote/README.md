# Handoff — OXV · Refonte (Pilote · Coach · Partenaire · Admin)

> Généré le 9 juillet 2026, mis à jour le 10 juillet 2026. Destiné à une implémentation dans l'app **Expo / React Native** OXV par Claude Code.
> Couvre les **4 rôles** : **Pilote** (mobile, §7 & §7bis) · **Coach** (tablette + téléphone, §12) · **Partenaire** (site web, §13) · **Admin** (site web, §14).
>
> **Architecture plateforme (contrainte).** Deux surfaces distinctes : l'**app mobile (Expo / React Native)** porte **uniquement** les rôles **Pilote** et **Coach** ; le **site web (navigateur, responsive)** porte **uniquement** les rôles **Partenaire** et **Admin**. Les fonctionnalités Partenaire &amp; Admin **ne sont jamais embarquées dans l'app mobile** — le partenaire « au stand » ouvre le **site pro responsive sur son téléphone** (navigateur), pas une app native.

---

## 1. Vue d'ensemble

OXV est une app de **télémétrie sur circuit** pensée comme un **miroir de conduite** — elle *décrit* ce qui s'est passé, elle ne *prescrit* jamais. Ce dossier couvre la refonte complète de l'**espace Pilote** (le rôle central), soit **14 écrans** organisés en 5 zones de navigation.

La refonte poursuit 4 objectifs donnés par le client :
1. **Réorganiser** l'architecture (53 écrans Pilote dispersés → 5 zones claires).
2. **Hiérarchiser** : un seul chiffre dominant par écran, le reste au scroll.
3. **Rendre la donnée lisible** via un système de **couleur QDI** (voir §4).
4. **Simplifier le texte** — public cible **30-40 ans**, ton direct, 2ᵉ personne, zéro jargon.

---

## 2. À propos des fichiers de ce bundle

Les fichiers HTML de ce dossier sont des **références de design** — des prototypes qui montrent l'aspect et le comportement voulus. **Ce ne sont pas des fichiers de production à copier tels quels.**

La tâche est de **recréer ces écrans dans l'app Expo / React Native existante**, avec ses patterns, sa navigation et ses libs établies (React Navigation, Reanimated, react-native-svg, etc.). Les graphiques SVG des maquettes doivent être portés en `react-native-svg` ou en composants de charting natifs ; les couleurs, typographies, espacements et copies ci-dessous sont, eux, **à respecter au pixel** (fidélité **haute**).

- `OXV Pilote.dc.html` + `support.js` — le prototype complet (ouvre `OXV Pilote.dc.html` dans un navigateur depuis ce dossier). C'est un « design canvas » : les écrans sont groupés par tours d'itération, le plus récent en haut. **Les écrans canoniques (définitifs) sont listés au §5.**
- `screens/` — une capture PNG par écran canonique.
- `sources/` — la cartographie fonctionnelle d'origine (analyse du code réel) et le schéma des rôles/connexions.

---

## 3. Fidélité

**Haute fidélité (hifi).** Couleurs, typographie, espacements, hiérarchie et copies sont définitifs. Recréer l'UI fidèlement avec les composants de l'app. Les data (chronos, °C, %) sont des **exemples réalistes** — à brancher sur les vraies sources (boîtier RaceBox, Supabase).

---

## 4. Le système de couleur QDI — CŒUR DE LA REFONTE

Le **QDI** (portrait de conduite en 5 branches) structure tout le langage visuel. **Chaque branche a une couleur fixe, utilisée partout** où la donnée correspondante apparaît (radar, barres, points sur la piste, chips, annotations) :

| Branche | Couleur | Hex | Variante texte sur fond clair |
|---|---|---|---|
| **Trajectoire** | Bleu | `#4F9DF7` | — |
| **Freinage** | Rouge | `#F65B5B` | — |
| **Accélération** | Vert | `#4FC98A` | — |
| **Fluidité** | Jaune | `#F2CE3B` | `#D9AE00` / `#B58F00` |
| **Régularité** | Violet | `#A783F2` | `#7A54C9` (deep), barres inactives `#3A2E52` |

**Règle d'or** : l'**or `#FFB703` est réservé au chrono / au rythme / au record** (meilleur tour, courbe de progression, tour « en or »). Il ne concurrence jamais les 5 couleurs QDI. Aucune couleur n'est décorative — une couleur = une donnée.

**Doctrine miroir** (à respecter dans les copies et l'UX) :
- Décrit, ne prescrit jamais. Un fait, pas une note (« Tu freines 8 m plus tard qu'en juin », pas « Freine plus tard »).
- **Self-only** : la référence, c'est l'empreinte du pilote lui-même (tracé pointillé). **Aucun classement, aucun rang entre pilotes.**
- Sécurité > performance. Pas d'alarme rouge agressive ; le rouge QDI reste factuel.
- Un chiffre dominant par écran.

---

## 5. Design tokens

### Couleurs — surfaces & texte (thème sombre, unique)
```
--bg            #0B0B0D   fond app
--surface       #111113   carte standard
--surface-2     #141416   carte alt / boutons ronds
--surface-3     #16161A   tuiles internes
--border        #1E1E22   bordure carte
--border-2      #232326   bordure bouton/tuile
--border-hair   #17171A   séparateur fin
--hair-soft     #1A1A1D   séparateur / cadre graphe
--text          #F5F5F7   primaire
--text-2        #E5E5E8   secondaire fort
--text-3        #C9C9CE   secondaire
--text-muted    #9A9AA3   labels
--text-muted-2  #8A8A92   sous-labels
--text-faint    #6E6E76   captions / axes
--text-faint-2  #55555C / #54545C   inactif
```

### Couleurs — données
```
--gold          #FFB703   chrono / record / rythme  (SEULEMENT)
--gold-text     #D9AE00 / #B58F00 / #8A6A00
QDI : voir §4
```

### Couleurs de rôle (identité, pour les autres rôles à venir)
```
Pilote     #F5F5F7 (blanc)
Coach      #C8102E   (accent UI utilisé : #E23A4E ; alerte douce : #E2685A)
Partenaire #5B8DEF
Admin      #22D3EE
```

### Typographie
- **Hanken Grotesk** — lecture, titres, UI. Poids 400 / 500 / 600 / 700 / 800.
- **JetBrains Mono** — données, labels courts, chronos, axes. Poids 400 / 500 / 600 / 700.
- Échelle observée : chiffre roi 46–54px (mono, letter-spacing −1.5px), titres 17–22px, corps 13–14px, labels 10–12px, eyebrow 10px mono uppercase letter-spacing 1.6px.
- Chronos toujours en mono, `font-variant-numeric: tabular-nums`.

### Rayons, espacements, ombres
```
radius : boutons 12–13 · cartes 11–16 · chips 6–9 · tuiles 8–10 · écran téléphone 36 · toggles/pills 13–20
padding écran : 24px horizontal (26 sur Paddock)
gap grilles : 10–12px
ombre : n'existe quasi pas (thème sombre plat). Élévation = surface plus claire, pas d'ombre.
bordure d'accent : 2px à gauche ou en haut de carte, dans la couleur du contexte (or / QDI / rôle)
```

### Barre d'onglets (5 zones — identique sur tous les écrans)
Ordre fixe : **Miroir · Data Lab · Carnet · Découverte · Compte**. Onglet actif `#F5F5F7`, inactif `#55555C`. Fond `#0C0C0E`, bordure haute `#191A1D`. Labels 9px JetBrains Mono. Icône ~21px. Hauteur ≈ padding `12px 6px 24px`.

---

## 6. Architecture de l'information — 53 écrans → 5 zones

| Zone | Rôle | Contenu |
|---|---|---|
| **Miroir** | La lecture de soi | Paddock (accueil), Bilan de séance, Signature/QDI, Progression & Constance |
| **Data Lab** | L'analyse | Menu, Carte du circuit, Zoom virage, Tour par tour, Carte de chaleur, Rejouer, Télémétrie |
| **Carnet** | Espace perso (sans donnée ni couleur) | Ressenti, conditions, repères/objectifs |
| **Découverte** | Marketplace / social | Coachs, Partenaires, Roulages, Mon coach (consentement) |
| **Compte** | Réglages | Profil, Garage, Boîtier, Données & sécurité, Notifications, Support, Journée sur circuit |

---

## 7. Écrans canoniques

> Correspondances vers le prototype (`OXV Pilote.dc.html`) entre parenthèses. Les tours 2→4 sont définitifs ; le tour 1 (ids `1b`–`1e`) est une **première version superseded** — l'ignorer sauf `1a` (carte système de référence).

### 7.0 — Carte système de référence (`#1a`, `screens/00-systeme.png`)
Planche récapitulative (fond `#0B0B0D`, largeur 760) : logo OXV, 5 principes, palette, typo, IA 5 zones. **Non applicative** — sert de référence visuelle.

### 7.1 — Paddock · accueil Miroir (`#2a`, `screens/01-paddock.png`)
- **But** : rentrer, voir en un coup d'œil l'état de la dernière séance, une seule action.
- **Layout** (haut→bas) : header (logo OXV gauche + avatar rond droite) · phrase d'accueil 20px (« Bonsoir Adrien. Ta séance de vendredi est **prête.** ») · eyebrow « Régularité au tour · Haute-Saintonge » · **chiffre roi `±0.42 s`** en violet `#A783F2` 54px · sous-label mono `#6E6E76` · **aperçu QDI en 5 barres colorées** (traj/flui/frein/accél/régul ; hauteurs 57/63/46/52/74%, la régul violette marquée « point fort » en 8px au-dessus) + rangée de labels colorés 8.5px · carte meilleur tour (pastille or + `1:24.318` or) · bouton plein `#F5F5F7` texte `#0B0B0D` « Lire le bilan » → Bilan · séparateur · bloc « Prochaine journée » (Sam. 19 juil. + chevron « Préparer »).
- **Chiffre dominant** = régularité (violet). Le chrono record reste or, discret.

### 7.2 — Bilan de séance (`#2b`, `screens/02-bilan.png`)
- **But** : la première vraie lecture après une séance.
- **Layout** : header (retour ‹ + titre « Bilan de séance » + icône partage) · eyebrow centré « Haute-Saintonge · Ven. 4 juil. · 18 tours » · eyebrow violet « Régularité au tour » + **`±0.42 s`** 46px violet · **mini-graphe de dispersion** (SVG) : axe `#232326`, ticks gris `#6E6E76`, bande médiane violette translucide, marqueur or « meilleur tour » vertical · carte **meilleur tour** (pastille or + `1:24.318` or + « Ton meilleur · T7 » + « 0.6 s sous ta moyenne ») · eyebrow « Quatre piliers » · **4 lignes de pilier** : chacune = pastille couleur QDI + nom + **chip factuel court coloré** à droite + barre horizontale avec repère médian `#54545C` et point coloré positionné. Copies chips : Trajectoire `#4F9DF7` « 3× hors trajectoire » · Freinage `#F65B5B` « tu freines plus tard » · Accélération `#4FC98A` « gaz plus doux » · Fluidité `#D9AE00` « volant plus stable » · 3 chips « moments » colorés (T7 or / V3 rouge / S2 violet) · bouton bordé « Ouvrir le Data Lab ».
- **Pas de paragraphes** : la donnée se lit en couleur + fait de 3-4 mots.

### 7.3 — Signature de pilotage · QDI (`#2c`, `screens/03-signature-qdi.png`)
- **But** : le portrait de conduite, neutre, soi contre soi.
- **Layout** : header (retour + « Signature de pilotage ») · eyebrow centré « Ton style, rien que le tien » · **radar pentagonal SVG** (viewBox `-50 0 312 220`, `overflow:visible` pour ne pas couper les labels) : grille `#232326`/`#1A1A1D`, 5 axes teintés dans leur couleur QDI à 35% d'opacité, **polygone empreinte** en pointillé `#54545C`, **polygone séance** tracé blanc `#F5F5F7` avec un **point de couleur QDI à chaque sommet**, labels d'axe colorés + **2 annotations perso** intégrées (`FREINAGE` → « tu freines tard », `RÉGUL.` → « ton point fort ») · légende (trait plein blanc = cette séance / pointillé = ton empreinte) · **carte « ta lecture » = 3 lignes** pastille+phrase (« Tu es plus **régulier** quand la piste chauffe » / « Tu **freines tard** et gardes ta vitesse » / « 3 **trajectoires** à revoir en S2 ») · bloc « Ton style au fil des séances » = 3 mini-radars juxtaposés MAI / JUIN / JUIL (le dernier surligné). **Jamais un score unique.**

### 7.4 — Progression & Constance (`#3a`, `screens/04-progression.png`)
- **But** : voir l'évolution, soi contre soi.
- **Layout** : header « Progression » · **Module 1 — Meilleur tour** : eyebrow, `1:24.3` or 40px, **courbe en aire SVG** or (gradient sous la ligne, points cerclés, dernier point plein + label « ton record »), axes MARS→JUIL, phrase « Tu gagnes du temps, séance après séance. Juste toi, pas de classement. » · séparateur · **Module 2 — Constance** : eyebrow violet, `±0.42 s` violet 40px, **histogramme** 12 barres violet sombre `#3A2E52`, la barre du meilleur tour en **or**, légende T1 / « ◆ ton meilleur » / T18, phrase « Des barres presque égales = tu es régulier. »

### 7.5 — Data Lab · menu (`#3b`, `screens/05-datalab.png`)
- **But** : point d'entrée de l'analyse approfondie.
- **Layout** : header « Data Lab » · titre « Va voir de plus près. » · ligne d'état vert `#4FC98A` « Données fiables sur cette séance » · **grille 2 colonnes de 6 tuiles** (icône couleur + titre + sous-titre) : Carte du circuit (or) · Zoom virage (bleu) · Tour par tour · Carte de chaleur (grille multicolore) · Rejouer un tour · Télémétrie (or) · puis 2 tuiles larges « Comparer » / « Insights ».

### 7.6 — Carte du circuit (`#3c`, `screens/06-carte-circuit.png`)
- **But** : lire la trajectoire réelle, virage par virage.
- **Layout** : header « Carte du circuit » · eyebrow « trajectoire réelle » · **tracé du circuit SVG** (bande `#1E1E22` large + pointillé central + ligne d'arrivée blanche) avec **6 pastilles de virage numérotées, colorées selon la marge** (rouge=serré → or → vert=large) · **barre de légende dégradée** `linear-gradient(90deg,#F65B5B,#FFB703,#4FC98A)` « MARGE : faible → large » · carte accent rouge « Le virage à surveiller » (n°3, factuel : « Tu passes très près du bord à la sortie ») · bouton « Ouvrir le virage 3 ».

### 7.7 — Zoom virage (`#3d`, `screens/07-zoom-virage.png`)
- **But** : décortiquer un virage (entrée/apex/sortie).
- **Layout** : header « Virage 3 » (retour + chevron suivant) · **encart graphe** fond `#0E0E10` : trajectoire réelle bleue `#4F9DF7`, référence en pointillé `#3A3A40`, **segment de freinage rouge** + **segment de sortie vert**, 3 points labellisés `FREIN`(rouge) `APEX`(bleu) `SORTIE`(vert) · **3 tuiles vitesse** ENTRÉE 128 (rouge) / APEX 84 (bleu) / SORTIE 142 (vert) km/h · 2 lignes factuelles (pastille + phrase) : « Tu freines **8 m plus tard** qu'en juin » (rouge), « **1.2 G** au point le plus fort » (bleu).

### 7.8 — Télémétrie (`#3e`, `screens/08-telemetrie.png`)
- **But** : les canaux bruts, pour les curieux.
- **Layout** : header « Télémétrie » · eyebrow « Forces · tour 7 » · **diagramme G-G** (cercles concentriques, nuage de points or, point extrême rouge « 1.4G », axes accél./frein) + explication courte · séparateur · **3 canaux empilés** avec label coloré : VITESSE (courbe or), FREIN (aires rouges), GAZ (aires vertes).

### 7.9 — Carnet (`#4a`, `screens/09-carnet.png`)
- **But** : espace perso — **volontairement sans donnée ni couleur QDI**.
- **Layout** : header « Carnet » (+ bouton +) · eyebrow « Conditions du jour » + chips météo (22°C / Piste sèche / Vent faible) · eyebrow « Ce que tu as ressenti » + **zone de note libre** fond `#0E0E10` (texte exemple + petit trait vert d'accent discret) · eyebrow « Tes repères » + **checklist perso** (case cochée verte + case vide) · action « Ajouter un repère ». Ton neutre, aucune suggestion imposée.

### 7.10 — Découverte (`#4b`, `screens/10-decouverte.png`)
- **But** : trouver coachs / offres partenaires.
- **Layout** : header « Découverte » · **onglets pills** (Coachs actif / Partenaires / Roulages) · eyebrow « Coachs près de chez toi » · **carte coach** accent haut rouge `#E23A4E` (avatar initiales, nom, spécialité, prix `60 €`, boutons « Voir la fiche » / « Contacter » rouge) · eyebrow « Une offre pour toi » · **carte partenaire** accent haut bleu `#5B8DEF` (badge « PHOTOGRAPHE », titre, prix, bouton « Demander le contact » bleu + note de confidentialité « Tu choisis de partager. Ni ta télémétrie, ni ton identité. »).

### 7.11 — Mon coach · consentement (`#4c`, `screens/11-mon-coach.png`)
- **But** : l'écran de confiance — le pilote contrôle ce que son coach voit (RGPD).
- **Layout** : header « Mon coach » · **carte coach** accent gauche rouge (avatar, « Ton coach depuis mai », badge vert ACTIF) · eyebrow « Ce qu'il peut voir » · **liste de 3 toggles** : Ta télémétrie (ON vert), Tes analyses & QDI (ON vert), Tes notes présentielles (OFF gris) · **encart vert** « Il ne verra jamais : ton email, ton téléphone, ton adresse » · lien « Retirer l'accès à Julien » (`#E2685A`).

### 7.12 — Compte (`#4d`, `screens/12-compte.png`)
- **But** : profil, matériel, réglages.
- **Layout** : header « Compte » · **bloc profil** (avatar initiales AM, nom, `@handle · 24 séances`) · **carte boîtier OXV** : icône, « RaceBox · #A3F1 », badge vert CONNECTÉ, 3 tuiles d'état (82% batterie / à jour firmware / bon signal vert) · **liste de réglages** (Garage « 2 autos » · Données & sécurité · Notifications · Support), chaque ligne icône + label + chevron `#4A4A50`.

### 7.13 — Journée sur circuit (`#4e`, `screens/13-journee-circuit.png`)
- **But** : le jour J — préparation et check-in.
- **Layout** : eyebrow « Aujourd'hui » + météo (soleil jaune « 18–24°C · sec ») · titre « Samedi 19 juillet » + lieu/heure · **carte préparation** (compteur « 2/4 » vert) = checklist 4 items (2 cochés verts barrés, 2 à faire) · 2 tuiles (Ton placement « Paddock B / voie 3 » · Sessions « 4 × 20 min ») · **carte Pass OXV** fond clair `#F5F5F7` avec **QR code** + « Montre ce code à l'entrée pour ton check-in ».

---

## 7bis. Écrans complémentaires — la traîne (30 écrans)

> Ces écrans complètent les 5 zones. Même système visuel, même doctrine. Réfs proto entre parenthèses (tours 5→9 du canvas). PNG dans `screens/`.

### Zone MIROIR — compléments
- **Trace narrative** (`#5a`, `14-trace-narrative.png`) — un **seul fait dominant** plein écran (« Au 7ᵉ tour, ton meilleur temps ») + chrono or `1:24.3`, 3 portes (Bilan / Signature / Data Lab). Zéro donnée secondaire.
- **Paddock · silence** (`#5b`, `15-paddock-silence.png`) — état hors-séance : logo mi-plein grisé, « Rien à lire pour l'instant », rappel calme de la prochaine date + carte « Boîtier prêt » (82 %). Le miroir se tait quand on ne roule pas.
- **Paddock · compte à rebours** (`#5c`, `16-paddock-countdown.png`) — J-2 : chiffre géant `2 jours` (mono 72px), date/lieu, tuiles météo prévue + prépa `2/4`, CTA « Préparer ma journée ». Rituel J-7/J-2/veille.
- **Empreinte saison** (`#5d`, `17-empreinte-saison.png`) — **constats juxtaposés** MAI/JUIN/JUIL : 3 lignes = mini-radar + label mois + fait court. Le dernier mois en violet. **Jamais une courbe d'évolution.**
- **Passeport piste** (`#5e`, `18-passeport.png`) — carte d'identité cumulative (dégradé sombre) : nom, palier « Signature », 3 stats (24 séances / 3 circuits / 412 tours) + records par circuit en or. Soi seul, aucun autre pilote.

### Zone DATA LAB — compléments
- **Tour par tour** (`#6a`, `19-tour-par-tour.png`) — récap (meilleur or / moyenne) + liste des tours : n°, barre de delta, chrono, écart ; **le meilleur tour surligné or**.
- **Carte de chaleur** (`#6b`, `20-carte-chaleur.png`) — tracé coloré par **vitesse froid→chaud** (dégradé bleu→cyan→vert→jaune) ; **jamais de rouge** (pas d'alarme). Légende LENT→RAPIDE.
- **Rejouer un tour** (`#6c`, `21-rejouer.png`) — tracé + point mobile, chrono `0:41.2`, **scrubber manuel** (pas d'autoplay), tuiles live (km/h, G, gaz), commandes ‹ ⏸ ›.
- **Comparer un virage** (`#6d`, `22-comparer-virage.png`) — 2 tracés superposés (T7 or vs T12 bleu) sur le même virage + 3 tuiles apex/écart. Deux faits côte à côte.
- **Insights** (`#6e`, `23-insights.png`) — 3 cartes qualitatives à liseré couleur QDI (Régularité violet / Freinage rouge / Accélération vert). Des constats, jamais des consignes.
- **Comparateur** (`#6f`, `24-comparateur.png`) — 2 séances du pilote (A or / B bleu) : tableau meilleur tour, régularité, tours, vitesse max. **Sans gagnant.**

### Zone CARNET & SOCIAL — compléments
- **Prochaine fois** (`#7a`, `25-prochaine-fois.png`) — intentions perso numérotées (« Regarder plus loin au 3 »), + ajout libre. Tes mots, pas ceux de l'app.
- **Entre-runs** (`#7b`, `26-entre-runs.png`) — pause stand : compte à rebours `32 min`, run précédent (or) + état pneus (jaune « chauds »), note rapide.
- **Pilotage fini** (`#7c`, `27-pilotage-fini.png`) — clôture de journée : coche verte, « Belle journée », 3 stats (4 sessions / 61 tours / meilleur or), « bilans prêts ce soir ».
- **Débrief présentiel** (`#7d`, `28-debrief-presentiel.png`) — fil de notes partagées coach↔pilote (bulles attribuées, coach = liseré/pastille rouge, moi = gris), ajout de note.
- **Amis** (`#7e`, `29-amis.png`) — liste par **@handle**, avatars initiales, « roulé ensemble ×3 ». **Aucun score, aucun classement.**
- **Côte-à-côte** (`#7f`, `30-cote-a-cote.png`) — 2 amis (toi or / Thomas cyan), 2 tracés superposés + tableau meilleur tour/vmax. **Aucun gagnant.**

### Zone DÉCOUVERTE / JOUR J / MÉDIAS
- **Roulages** (`#8a`, `31-roulages.png`) — invitation coach (liseré rouge) : date/lieu/places, boutons Accepter (rouge) / Décliner ; roulage libre dispo dessous.
- **Fiche coach publique** (`#8b`, `32-fiche-coach.png`) — avatar cerclé rouge, stats (expérience / circuits / prix or), bio, dispo verte, CTA « Demander une séance » rouge.
- **Carte licence** (`#8c`, `33-carte-licence.png`) — licence numérique (carte sombre) : nom, n° FFSA, groupe sanguin, validité, QR, badge VALIDE vert.
- **Carte OXV live** (`#8d`, `34-carte-oxv-live.png`) — piste **temps réel** (badge LIVE rouge) : ta position en or, autres pilotes en points cyan (position, **pas classement**), temps restant + nb voitures.
- **Galerie séance** (`#8e`, `35-galerie.png`) — grille photos (1 grande + vignettes + « +8 »), crédit partenaire bleu « PixTrack, déposées par l'organisateur ».
- **Carte-trophée** (`#8f`, `36-carte-trophee.png`) — souvenir partageable (carte ambrée, halo or) : meilleur tour `1:24.318` géant + médaille, boutons Partager / exporter.
- **Belles routes** (`#8g`, `37-belles-routes.png`) — routes touristiques (hors chrono) : cartes avec tracé, distance/durée, badges « CERTIFIÉE OXV » / « POPULAIRE ».

### Zone COMPTE — compléments
- **Profil** (`#9a`, `38-profil.png`) — avatar éditable, nom/@handle, liste de champs (nom affiché, identifiant, ville, niveau). Seuls nom + @handle visibles des amis.
- **Garage** (`#9b`, `39-garage.png`) — véhicule principal (carte avec silhouette auto + badge PRINCIPALE) + 2ᵉ véhicule en ligne, année/puissance/plaque.
- **Données & sécurité** (`#9c`, `40-donnees-securite.png`) — RGPD : 2FA (toggle vert), mot de passe, **exporter mes données**, appareils connectés, **supprimer le compte** (rouge doux), rappel « ta télémétrie t'appartient ».
- **Notifications** (`#9d`, `41-notifications.png`) — 4 toggles (bilan prêt / rituel / message coach = ON vert ; offres partenaires = OFF). « On te parle peu, et seulement quand ça compte. »
- **Circuits** (`#9e`, `42-circuits.png`) — tracés connus (mini-plan + record or) + circuit « pas encore roulé » en pointillé.
- **Support** (`#9f`, `43-support.png`) — 2 tuiles (Nous écrire / Aide & FAQ) + tes demandes avec statut (EN COURS jaune / RÉSOLU vert).

---

## 8. Interactions & comportement

- **Navigation** : barre d'onglets 5 zones persistante. Chaque écran de détail a un retour ‹ en haut à gauche. Paddock « Lire le bilan » → Bilan → « Ouvrir le Data Lab » → Data Lab → tuile → détail (Carte → « Ouvrir le virage 3 » → Zoom virage). Découverte → carte coach → Mon coach.
- **Toggles consentement** (7.11) : état persistant côté serveur (Supabase), effet immédiat sur ce que le coach voit. Retrait d'accès = confirmation.
- **Checklists** (Carnet, Jour J) : cochage local persistant ; item coché → barré + case verte.
- **Graphes** : entrée en fondu/tracé progressif possible (Reanimated), mais **pas d'animation d'alarme**. Respecter le calme.
- **Chiffre roi** : toujours l'élément le plus grand de l'écran, en mono.
- **États** : vide (« Pas encore de séance — connecte ton boîtier »), chargement (skeleton sombre), boîtier déconnecté (badge gris au lieu de vert). À décliner selon les patterns de l'app.

---

## 9. État / données

- **Séance** : chrono par tour, meilleur tour, écart-type (régularité), trajectoire GPS, canaux (vitesse, G, frein, gaz), marge par virage. Source : boîtier RaceBox → Supabase.
- **QDI** : 5 valeurs (trajectoire, freinage, accélération, fluidité, régularité) + historique par mois pour la juxtaposition.
- **Profil** : nom, handle, nб de séances, garage (véhicules), état boîtier (batterie/firmware/signal).
- **Consentement coach** : relation pilote↔coach + flags de visibilité (télémétrie / analyses / notes). **Jamais** de données de contact partagées.
- **Journée** : date, lieu, sessions, placement, checklist prépa, Pass (QR).

---

## 10. Assets

- **Polices** : Hanken Grotesk & JetBrains Mono (Google Fonts). Dans Expo : `@expo-google-fonts/hanken-grotesk` et `@expo-google-fonts/jetbrains-mono`.
- **Icônes** : toutes en SVG inline dans le proto (stroke 1.5–1.7). Les porter en `react-native-svg` ou remplacer par le pack d'icônes de l'app en gardant le trait fin.
- **Graphiques** : tous faits main en SVG (radar, tracé circuit, courbes, histogrammes, G-G). À reconstruire avec `react-native-svg` (ou Skia) à partir des vraies données.
- **QR** : placeholder ; générer le vrai code de check-in.
- Aucune image bitmap ni logo externe : le logo OXV est un cercle mi-plein dessiné en CSS/SVG (voir `#1a`).

---

## 11. Fichiers de ce bundle

```
design_handoff_pilote/
├── README.md                ← ce document (auto-suffisant)
├── OXV Pilote.dc.html       ← prototype PILOTE (mobile) — ouvrir dans un navigateur
├── OXV Coach.dc.html        ← prototype COACH (tablette) — ouvrir dans un navigateur
├── OXV Coach Mobile.dc.html ← compagnon COACH (téléphone) — suivi en direct au bord de piste
├── OXV Partenaire.dc.html   ← prototype PARTENAIRE (site web responsive : bureau + téléphone) — B2B marketplace
├── OXV Admin.dc.html        ← prototype ADMIN (site web, bureau) — la régie
├── support.js               ← runtime requis par les .html
├── screens/                 ← Pilote : 44 PNG (00 système, 01–13 boucle, 14–43 traîne)
│   ├── coach/               ← Coach tablette : 34 PNG (01-poste … 25-vue-ar + 26–34 modules pro)
│   ├── coach-mobile/        ← Coach téléphone : 14 PNG (En direct, pilote live, note, états, Pilotes, Messages, Moi, fil, agenda, fiche, alertes push/réglage, débrief stand)
│   ├── partenaire/          ← Partenaire : 17 PNG (01-tableau-de-bord … 13-abonnement-pro + 14–17 mobile)
│   └── admin/               ← Admin : 10 PNG (01-tour-de-controle … 07-devices, 08-qualite-data, 09-rapports-b2b, 10-support)
└── sources/
    ├── 0_LISEZMOI.md
    ├── 1_Cartographie_fonctionnelle.md
    └── 2_Schema_connexions_roles_supabase_site.svg
```

> **Statut** : **les 4 rôles sont couverts et complets.** **Pilote** (mobile, §7/§7bis) · **Coach** (tablette + téléphone, §12) · **Partenaire** (site web responsive, 17 écrans, §13) · **Admin** (bureau, 10 écrans, §14). Prototypes Partenaire &amp; Admin : ouvrir les `.dc.html`. **Captures PNG incluses** pour les 4 rôles : `screens/partenaire/` (17) et `screens/admin/` (10) ajoutées.

---

## 12. Rôle COACH — « le miroir de guidance » (console tablette)

Le coach lit les séances de **ses pilotes consentis**, annote et oriente — **sans jamais remplacer le miroir**. Sa voix apparaît chez le pilote **attribuée** (bande rouge), jamais comme une consigne de l'app. Prototype : `OXV Coach.dc.html`.

### Décisions de conception propres au Coach
- **Surface = tablette paysage** (console ~1200×800), pas téléphone : le coach *lit et oriente*, il ne roule pas. Cela distingue visuellement le rôle du Pilote (mobile).
- **Identité rouge** : rail actif et accents `#E23A4E` (marque `#C8102E`, alerte douce `#E2685A`). Le reste du système est identique au Pilote (fond `#0B0B0D`, surfaces `#111113`, **couleurs QDI** inchangées, **or `#FFB703` = chrono**, mono pour la donnée).
- **Shell** : rail vertical gauche (198px) — Poste · File de lecture · Studio · Pilotes · Agenda · Business + avatar coach en bas ; zone principale = header (`.thead`) + corps (`.tbody`).
- **Garde-fous** (à respecter à l'implémentation, cf. RLS Supabase §5 sources) : le coach ne voit **jamais** email/téléphone/adresse du pilote ; l'assistant IA **ne publie rien** seul (le coach valide) ; **aucun classement** entre pilotes ; la voix du coach est toujours **attribuée**.

### Écrans canoniques Coach (réfs proto = tours 1→3 de `OXV Coach.dc.html`)

**Colonne vertébrale**
- **Poste de pilotage** (`#1a`, `coach/01-poste.png`) — hub : cartes de ses pilotes (stats QDI en couleur), fil des dernières 24 h, à-faire.
- **File de lecture** (`#1b`, `coach/02-file-lecture.png`) — tableau des séances à lire (statuts à lire / lues / archivées), entrée directe Studio.
- **Studio** (`#1c`, `coach/03-studio.png`) — **P0** : lecture dense = radar QDI couleur + trajectoire colorée par marge + « où regarder » + liste des tours. CTA « Rédiger le rapport ».
- **Triage** (`#1d`, `coach/04-triage.png`) — carte + virages **classés par marge** (rouge→vert), factuel (« un fait, pas une consigne »).
- **Rapport PDF** (`#1e`, `coach/05-rapport.png`) — éditeur (sections) à gauche + **aperçu PDF** clair à droite ; rappel « apparaît attribué à toi, jamais comme consigne ».

**Outils de guidance**
- **Annoter** (`#2a`, `coach/06-annoter.png`) — note sur un virage : texte + **mémo vocal** (waveform) + toggle « partager avec le pilote ».
- **Priorités** (`#2b`, `coach/07-priorites.png`) — choisir les virages/moments mis en avant sur le bilan du pilote + aperçu côté pilote (bande rouge attribuée).
- **Repères de virage** (`#2c`, `coach/08-reperes.png`) — poser un point de freinage (rouge) + vitesse d'apex cible (bleu), superposés chez le pilote ; « des repères, pas une obligation ».
- **Ma lecture** (`#2d`, `coach/09-ma-lecture.png`) — pondération 4 composantes (traj/frein/accél/fluidité) → sa grille (ex. B+), **affichée à côté** du QDI neutre.
- **Gabarits** (`#2e`, `coach/10-gabarits.png`) — bibliothèque de phrases réutilisables, taguées par couleur QDI.
- **Assistant IA** (`#2f`, `coach/11-assistant-ia.png`) — brouillons factuels **proposés** ; Valider / Modifier / Rejeter. Rien n'est publié automatiquement.
- **Plan d'objectifs** (`#2g`, `coach/12-plan-objectifs.png`) — objectifs mesurables (métrique + direction + cible) avec progression ; formulaire d'assignation.
- **Contexte** (`#2h`, `coach/13-contexte.png`) — cadrage sportif non-confidentiel (niveau, objectif, conditions) ; « aucune donnée personnelle ».
- **Programmes** (`#2i`, `coach/14-programmes.png`) — cycle de progression qualitatif en étapes (franchies / en cours / à venir), jamais une note qui monte.

**CRM & business**
- **Fiche pilote / CRM** (`#3a`, `coach/15-fiche-pilote.png`) — profil (véhicule, empreinte, séances, notes partagées) en **lecture seule** ; badge « consenti », rappel « jamais ses coordonnées ».
- **Comparer 2 séances** (`#3b`, `coach/16-comparer-seances.png`) — deux séances d'un pilote, tableau factuel, **aucun gagnant**.
- **Comparer 2 pilotes** (`#3c`, `coach/17-comparer-pilotes.png`) — deux radars côte à côte, « deux styles, pas un meilleur » ; **aucun classement**.
- **Débrief** (`#3d`, `coach/18-debrief.png`) — vue calme lecture seule à montrer au pilote (un fait dominant + virage), mode plein écran.
- **Profil public** (`#3e`, `coach/19-profil-public.png`) — sa fiche vue par les pilotes : photo, bio, circuits, formules/tarifs (or).
- **Disponibilités** (`#3f`, `coach/20-disponibilites.png`) — grille semaine, créneaux ouverts (vert) / réservés (rouge) + ajout.
- **Demandes** (`#3g`, `coach/21-demandes.png`) — boîte de réception (accent bleu) : Accepter / Proposer un créneau / Décliner.
- **Calendrier** (`#3h`, `coach/22-calendrier.png`) — agenda semaine : séances confirmées (rouge) + créneaux ouverts (vert translucide).
- **Facturation** (`#3i`, `coach/23-facturation.png`) — **le coach est l'émetteur** : liste de factures (payée / envoyée), numérotation auto ; OXV n'encaisse rien.
- **Business / Roulages** (`#3j`, `coach/24-business.png`) — revenus cumulés, histogramme mensuel, roulages-coach organisés (places).
- **Vue AR** (`#3k`, `coach/25-vue-ar.png`) — aperçu expérimental (lunettes Ray-Ban) : faits au bord de piste pour le coach ; **jamais pour le pilote au volant** (sécurité).

### Modules pro ajoutés (réfs proto = tours 4→9 de `OXV Coach.dc.html`) — ce qui justifie l'abonnement 750 €/an

Au-delà des 25 fonctions de la cartographie, le Coach a été étoffé avec un module **« En direct »** (temps réel) et des outils pro. Une **version téléphone** complète la tablette : `OXV Coach Mobile.dc.html` (compagnon au bord de piste — vue d'ensemble live, pilote live, note express, états vide/hors-ligne).

- **En direct · centre de contrôle** (`#4a`, `coach/26-en-direct-centre.png`) — carte piste **temps réel** (position des pilotes), horloge de session, chrono live de chaque pilote (secteurs colorés + delta) et fil d'alertes.
- **En direct · focus pilote** (`#4b`, `coach/27-en-direct-focus.png`) — cockpit live d'un pilote : tour en cours, secteurs qui tombent, trace de vitesse qui défile, G, alerte virage, actions rapides.
- **Multi-live** (`#5a`, `coach/28-multi-live.png`) — **plusieurs pilotes en piste en même temps**, chacun son mini-cockpit (chrono, sparkline, secteur, alerte) ; grille 2×2, un slot « au stand ».
- **Messagerie** (`#5b`, `coach/29-messagerie.png`) — fil coach↔pilote **attribué**, in-app, **sans coordonnées** ; notes/repères partagés intégrés au fil.
- **Récap post-séance** (`#6a`, `coach/30-recap-post-seance.png`) — boucle Coach→Pilote : faits pré-remplis + mot du coach + objectif + note vocale ; aperçu de ce que le pilote reçoit sur son téléphone (signé du coach).
- **Séance de groupe** (`#7a`, `coach/31-seance-groupe.png`) — roulage coach : roster (niveaux + focus), objectif partagé, briefing ; se branche sur le multi-live le jour J. Aucun classement de groupe.
- **Comparatif live** (`#8a`, `coach/32-comparatif-live.png`) — 2 pilotes suivis en direct côte à côte (chrono, sparkline, style) ; « deux styles, aucun rang ».
- **Comparatif détaillé** (`#8b`, `coach/33-comparatif-detail.png`) — trajectoires superposées, vitesses en surimpression, split par secteur, virage 3 au détail (apex/freinage/marge). Factuel.
- **Abonnement Pro** (`#9a`, `coach/34-abonnement-pro.png`) — « Mon compte » : carte 750 €/an + **argument ROI** (facturation de la saison = 8,5× le prix), liste des inclus, stats de saison, gestion paiement/factures. C'est l'écran qui vend la valeur pro.

> **Version téléphone Coach** (`OXV Coach Mobile.dc.html`) — nav bas : En direct · Pilotes · Messages · Agenda · Moi. Le direct au bord de piste (téléphone en main), la tablette au stand. Même système, même identité rouge.

### Tokens spécifiques Coach (le reste = §5)
```
--coach-brand   #C8102E   identité de rôle
--coach-accent  #E23A4E   rail actif, CTA, bandes attribuées
--coach-soft    #E2685A   texte/alerte douce
tablette : largeur ~1200, hauteur écran ~800, rail 198px, cartes .card = surface #111113 / bord #1E1E22
```

---

## 13. Rôle PARTENAIRE — B2B marketplace (bureau + téléphone)

Un partenaire (garage, photographe, hôtel, école…) publie des offres et reçoit des **leads consentis** — **sans jamais voir la télémétrie ni l'identité** du pilote. Prototype : `OXV Partenaire.dc.html`.

### Conception
- **Surface = site web** (navigateur), **responsive** : bureau (back-office, ~1240) + **version téléphone** pour le stand — **pas d'app native partenaire**, le mobile est le site pro responsive (chrome navigateur). **Identité bleue** `#5B8DEF` (rail/accents `#3E6FCB`→`#5B8DEF`, texte doux `#7BA5F5`). Reste du système identique (fond sombre, or = prix/CA, mono).
- **Garde-fous** : leads uniquement si le pilote a **explicitement** demandé le contact ; jamais d'identité, de coordonnées ni de données de conduite ; offres visibles seulement après **validation admin** ; OXV **n'encaisse pas** (prix affiché, paiement direct).

### Écrans (réfs proto `OXV Partenaire.dc.html`)
- **Tableau de bord** (`#1a`) — leads récents, offres en ligne, vues de fiche, taux de contact + graphe.
- **Mes offres** (`#1b`) — CRUD offres (prix, statut en ligne/brouillon, nb demandes).
- **Mes leads** (`#1c`) — demandes consenties ; badge « sans identité ni télémétrie ».
- **Ma fiche** (`#1d`) — vitrine vue des pilotes (bio, zone, offres), validée admin.
- **Catalogue produit détaillé** (`#2a`) — fiche produit riche (galerie, délai/quota/circuits/validité).
- **Point de vente sur la carte** (`#2b`) — stand épinglé sur le plan du paddock ; toggle « visible carte OXV ».
- **Mise en avant Pilote &amp; Coach** (`#2c`) — aperçus : fiche sponsorisée dans la Découverte pilote (téléphone) + encart partenaires du Poste coach (tablette).
- **Carte de France publique** (`#3a`) — événements (or) + points de vente (bleu) + circuits (gris), visible de tous ; aucun pilote géolocalisé.
- **Performance** (`#4a`) · **Facturation** (`#4b`, non encaissée) · **Rapports B2B** (`#4c`, partagés par l'admin).
- **Réservation &amp; QR au stand** (`#5a`) — le pilote scanne, réserve un créneau, paie en direct ; suivi live des créneaux.
- **Abonnement Pro 750 €/saison** (`#5b`) — argument ROI (3 240 € réservés = 4,3×), inclus, stats.
- **Téléphone** : Au stand (`#6a`, QR + créneaux), Leads (`#6b`), Tableau de bord (`#7a`), Carte (`#7b`).

```
--partner-accent  #5B8DEF   rail/CTA        --partner-deep #3E6FCB        --partner-soft #7BA5F5
```

---

## 14. Rôle ADMIN — la régie (bureau)

Opère la plateforme (`is_admin()` contourne la RLS). Prototype : `OXV Admin.dc.html`. **Surface = site web** (navigateur, bureau dense) — **jamais embarqué dans l'app mobile**. **Identité cyan** `#22D3EE` (rail/accents ; sur fond clair `#0E7C8B`).

### Écrans (réfs proto `OXV Admin.dc.html`)
- **Tour de contrôle** (`#1a`) — jour J en direct : inscrits / présents / en piste / boîtiers actifs, sessions, alertes régie.
- **Check-in QR** (`#1b`) — scan du Pass OXV (ou n° licence), pointages ; alimente le KPI présence partagé avec le site (`attended_at`).
- **Validation partenaires** (`#1c`) — comptes à valider (SIRET/assurance) ; un partenaire n'apparaît qu'une fois validé.
- **Événements** (`#2a`) — créer/gérer une journée (`circuit_id`), publication = ajout à la carte publique.
- **Utilisateurs &amp; modération** (`#2b`) — signalements (avis coach, offre partenaire), annuaire par rôle, promotion coach.
- **Système** (`#2c`) — **feature-flags** (Assistant IA, Vue AR, réservation QR) + **maintenance** (kill-switch, version minimale).
- **Devices — parc RaceBox** (`#3a`) — santé des boîtiers : batterie, signal, firmware, alias ; alertes (batterie faible, sans signal) à traiter avant qu'un pilote perde sa télémétrie.
- **Qualité data** (`#4a`) — intégrité de l'ingestion RaceBox → Supabase : sessions ingérées / complètes / en anomalie + contrôles automatiques (cohérence GPS, continuité chrono, firmware homogène, doublons). Une séance en anomalie **n'alimente pas le Data Lab** du pilote tant qu'elle n'est pas vérifiée.
- **Éditeur de rapports B2B** (`#4b`) — rapport d'**audience agrégée &amp; anonymisée** partagé à un partenaire (vues de fiche, taux de contact, offres les plus vues), avec aperçu clair du document reçu ; **jamais d'identité pilote ni de télémétrie**.
- **Support · régie** (`#4c`) — boîte de réception des demandes (pilote / coach / partenaire, bordure d'avatar en couleur de rôle) avec **SLA**, statut EN COURS / RÉSOLU et lien vers le profil ; **miroir** de « Mes demandes » côté pilote/coach.

> **Traîne Admin terminée** — plus aucun écran en option. Captures PNG des 4 rôles incluses dans `screens/` (pilote · coach · coach-mobile · partenaire · admin).
>
> **Hors périmètre (cartographie §4, non maquettés)** — routes admin secondaires jamais retenues dans la refonte : `sessions-media` (dépôt médias), `analytique` (métriques business), `circuit` (éditeur topologie), `ambassadeurs`, `routes-certification`, `points-carte` (éditeur dédié — la carte publique est déjà couverte par Partenaire `#3a` + Événements `#2a`). À ouvrir seulement si le client les priorise.

```
--admin-accent  #22D3EE   rail/CTA        --admin-deep #0E7C8B (badge sur fond clair)
```
