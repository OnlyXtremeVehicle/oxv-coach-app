# OXV Mirror — Refonte gaming v3 · Index du dossier

> Refonte **strictement visuelle** des 80 écrans de l'app, dans le langage **« cockpit d'hypercar »** (école sim premium : Gran Turismo 7 / F1 — jamais arcade).
> 14 maquettes HTML autonomes = 14 archétypes. Chaque écran réel se range sous l'une d'elles.
> Le mètre-étalon est `maquette_debrief_gaming.html` : tous les autres écrans s'y alignent.

---

## 1. Démarche

Les 80 écrans ne sont pas dessinés un à un (redondant) mais ramenés à **14 grammaires**. La doctrine, la palette et le vocabulaire OXV ne bougent pas : le gaming intensifie le **traitement** (instruments, glow, mise sous tension), pas le fond.

Principe directeur : **pas plus de texte ni plus de couleurs — plus d'instrument.** Un seul chiffre domine chaque écran. La bande coach reste le seul espace prescriptif.

---

## 2. Grammaire gaming (système de design)

Tout fichier reprend la même base. Les valeurs ci-dessous sont **normatives**.

### Fond cockpit
```
background:
  radial-gradient(halo gold diffus, centré sur l'instrument)   /* présence */
  radial-gradient(dégradé sombre #0E0E14 → #040406)            /* profondeur */
  grille HUD (repeating-linear-gradient, opacité .016–.018, pas 26px)
+ ::after vignette radiale (assombrit les bords)
```

### Tokens (inchangés)
| token | hex | usage |
|---|---|---|
| night / fond | `#040406`–`#0E0E14` | fond cockpit |
| line | `#1C1C20` | bordures |
| cream | `#F8F9FA` | texte primaire |
| mute / faint | `#9A9AA3` / `#54545C` | texte secondaire / labels |
| **gold** | **`#FFB703`** | **données quotidiennes** (chiffre dominant, jauges, traces) |
| **heritage** | **`#C4A459`** | **tier Heritage UNIQUEMENT** + virage signature. Jamais ailleurs. |
| **red** | **`#C8102E`** | **marque + bande coach (prescriptif) UNIQUEMENT** |
| green | `#4ADE80` | tendance positive, secteur le plus fort |
| polices | Geist / Geist Mono | mono pour tous les chiffres et labels HUD |

### Composants de la grammaire
- **Status bar HUD** : pastille pulsante + label mono `letter-spacing:.24em` UPPERCASE + méta à droite.
- **Instrument central** (écrans data) : arc gradué (270°) en **or** + ticks (compteur) + **repère heritageGold** optionnel (record, étalon) + chiffre géant à halo. **Cockpit factuel : aucune zone vert/jaune/rouge de jugement, pas de redline rouge** — le rouge reste réservé marque + bande coach. Implémenté par le composant `GaugeInstrument` (`src/components/instruments/`). Arc = `stroke-dasharray` + `rotate(135°)`.
- **Secteurs F1** : S1/S2/S3 colorés (vert = le plus fort, gold = correct, faint = plus lent) + barre de remplissage.
- **Trace de télémétrie** : sparkline lumineux (`drop-shadow` gold) qui se dessine.
- **Barres lumineuses** : jauges horizontales (`box-shadow` couleur) pour piliers, KPIs, remplissages.
- **Bande coach** : panneau rouge bordé, marqué « De votre coach » / « Espace coach ». Seul lieu impératif.

### Mise sous tension (séquence d'animation)
À l'ouverture, l'écran « démarre » par couches échelonnées :
| effet | keyframe | cible |
|---|---|---|
| arc qui se remplit | `fillArc` (dashoffset → 0) | jauge centrale |
| ticks en balayage | `tickIn` opacity + delay `i*0.01s` | graduations |
| trace qui se dessine | `draw` (dashoffset → 0) | sparkline, trajectoires, tracé circuit |
| barres qui montent | `grow` (width → var(--w)) | piliers, secteurs, KPIs |
| chiffre qui surgit | `popIn` (scale .9→1 + opacity) | chiffre dominant |
| blocs qui apparaissent | `fadeUp` / `fadeDown` + delays | sections |
| halo qui pulse | `halo`, `blink` (boucle) | présence, indicateurs REC |

### Glow
`filter:drop-shadow(0 0 Npx rgba(token,alpha))` sur les éléments SVG, `text-shadow` sur les chiffres. Réservé aux éléments porteurs (chiffre dominant, arc, trace, indicateurs). Jamais décoratif partout.

---

## 3. Les 14 maquettes

| # | Fichier | Archétype | Spécificité gaming |
|---|---|---|---|
| 01 | `maquette_debrief_gaming.html` | **Analyse riche** (mètre-étalon) | Instrument central + redline + secteurs + trace + piliers, séquence complète |
| 02 | `maquette_accueil_gaming.html` | **Hub / navigation** | Menu de cockpit : hero à mini-instrument + tuiles HUD |
| 03 | `maquette_insight_gg_gaming.html` | **Insight approfondi** | Radar de traction (anneaux gradués, scatter qui s'allume, creux d'enveloppe) |
| 04 | `maquette_live_gaming.html` | **Live en piste** | Doctrine du silence : cockpit éteint, onde d'enregistrement seule |
| 05 | `maquette_comparaison_ab_gaming.html` | **Comparaison A/B** | Duel : trajectoires superposées qui se dessinent, barres divergentes |
| 06 | `maquette_heatmap_gaming.html` | **Carte de chaleur** | Tracé coloré par la vitesse (froid→chaud), scan séquentiel |
| 07 | `maquette_fiche_circuit_gaming.html` | **Fiche circuit** | Tracé hero qui se dessine, virage signature heritage, sessions |
| 08 | `maquette_espace_coach_gaming.html` | **Espace coach** | Miroir factuel + **frontière constat/consigne visible** + bande prescriptive |
| 09 | `maquette_mon_coach_gaming.html` | **Mon coach** | Réception lecture seule, rappel de doctrine (symétrie avec 08) |
| 10 | `maquette_liste_roulages_gaming.html` | **Liste / historique** | Journal de bord, un chiffre + tendance par ligne |
| 11 | `maquette_reglages_gaming.html` | **Formulaire / réglages** | Interrupteurs HUD, « Silence en piste » en premier rang |
| 12 | `maquette_admin_gaming.html` | **Admin / régie** | Poste de commande : KPIs lumineux, file d'inscriptions, sessions |
| 13 | `maquette_onboarding_gaming.html` | **Onboarding** | Étape doctrine, barre segmentée, titre dominant |
| 14 | `maquette_partage_gaming.html` | **Carte de partage** | Carte trophée 4:5, or quotidien (jamais heritage) |

---

## 4. Mapping des 80 écrans → archétypes

**Pilote (44)**
- *Analyse riche (01)* : debrief, signature, regularite, progression, virage, tours, stats, replay, telemetry, bilan, prochaine-fois
- *Hub (02)* : index, paddock, lieux, carte, circuits
- *Insight (03)* : insight G-G, enveloppe, galerie insights
- *Live (04)* : roulage, entre-runs, pilotage-fini
- *Comparaison (05)* : comparateur, cote-a-cote, virage-comparer
- *Heatmap (06)* : heatmap, carte (pilier)
- *Fiche circuit (07)* : circuit/[id]
- *Mon coach (09)* : mon-coach
- *Liste (10)* : roulages, amis, notifications, social, objectifs
- *Réglages (11)* : settings, equipement, donnees-securite, creer-trace, placement
- *Partage (14)* : partage, share/[token], social-carte

**Coach (15)** → *Espace coach (08)* + *Comparaison (05)* (comparer-pilotes) : toutes les vues de suivi pilote, annotation, objectifs, comparaison.

**Admin (8)** → *Admin / régie (12)* : dashboard, inscriptions, sessions, pilotes, circuits, articles, gestion.

**Onboarding (6 + coach 3)** → *Onboarding (13)* : index, doctrine, methode, niveau, pacte, cgu + coach-onboarding (index, mission, pacte).

---

## 5. Règles non négociables (doctrine)

1. **Un seul chiffre domine** par écran. Le reste est contexte.
2. **Silence en piste** : l'écran live ne montre aucune donnée tant que la voiture roule.
3. **Bande coach = seul espace prescriptif.** Verbes d'ordre, causalité, orientation : uniquement là, en rouge, marqué.
4. **Frontière constat/consigne.** Partout ailleurs = constats factuels (mesures, écarts : « dispersion V7 ±1,4 m »). Jamais « vous perdez 0,3 s parce que… ».
5. **Heritage `#C4A459` réservé** au tier Heritage + virage signature. La carte de partage quotidienne utilise le gold `#FFB703`.
6. **Le faucon est un totem interne.** Jamais nommé dans le contenu client.

---

## 6. Dépôt & transposition

- Destination dépôt : `docs/refonte-app-gaming/` (extraire l'archive ici).
- Transposition React Native : suivre `PROMPT_TRANSPOSITION_RN_GAMING.md`.
- Ordre conseillé : Débrief (étalon) → Hub → Liste → Insight → Comparaison → Heatmap → Fiche circuit → Réglages → Onboarding → Partage → Espace coach → Mon coach → Admin → Live.
- Un commit par archétype.
