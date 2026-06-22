# OXV Mirror — Refonte des écrans · Index de référence

> Document d'entrée du dossier `docs/refonte-app/`.
> Charte : `src/theme/v2.ts` + `src/theme/tokens.ts` — polices Geist / Geist Mono.
> Doctrine : l'app est un miroir. Elle montre, elle ne dirige pas.

---

## 1. Démarche

Les **80 écrans** de l'application ne sont pas 80 designs distincts. Sept **archétypes** en couvrent la majorité ; sept **cas particuliers** sortent de la grammaire et reçoivent leur propre maquette. Au total, **14 maquettes de référence** — autonomes, auto-documentées — figent le langage de toute l'app, sans aucun écran laissé de côté. Chaque écran est une application du système, déclinable en série ou générée directement en React Native.

---

## 2. Les quatorze maquettes de référence

| # | Type | Fichier | Couvre |
|---|------|---------|--------|
| 1 | Analyse riche | `maquette_debrief_refondu.html` | 13 écrans pilote |
| 2 | Hub / navigation | `maquette_accueil_refondu.html` | 5 écrans pilote |
| 3 | Insight approfondi | `maquette_insight_gg_refondu.html` | galerie + 6 lectures (post-Valence) |
| 4 | Liste / historique | `maquette_liste_roulages_refondu.html` | 6 écrans pilote |
| 5 | Formulaire / réglages | `maquette_reglages_refondu.html` | 8 écrans de saisie et capture |
| 6 | Espace coach | `maquette_coach_pilote_refondu.html` | 13 écrans coach |
| 7 | Admin / régie | `maquette_admin_refondu.html` | 8 écrans admin |
| 8 | Écran live en piste | `maquette_live_piste_refondu.html` | 3 écrans de flux |
| 9 | Comparaison A/B | `maquette_comparaison_ab_refondu.html` | 5 écrans (pilote + coach) |
| 10 | Onboarding | `maquette_onboarding_refondu.html` | 9 écrans (6 + 3) |
| 11 | Carte de chaleur | `maquette_heatmap_refondu.html` | pilier + carte |
| 12 | Carte de partage | `maquette_partage_refondu.html` | 3 écrans |
| 13 | Fiche circuit | `maquette_fiche_circuit_refondu.html` | circuit détail |
| 14 | Mon coach (pilote) | `maquette_mon_coach_refondu.html` | réception des repères |

---

## 3. Mapping intégral des 80 écrans

Chaque écran est rangé une seule fois, sous la maquette qui le décrit le mieux.

### 1 — Analyse riche
`debrief` · `debrief-presentiel` · `bilan` · `bilan-pret` · `signature` · `regularite` · `progression` · `virage` · `tours` · `stats` · `replay` · `telemetry` · `prochaine-fois`

### 2 — Hub / navigation
`index` · `paddock` · `lieux` · `carte` · `circuits`

### 3 — Insight approfondi *(à construire après Valence)*
galerie des lectures · anatomie du freinage · diagramme G-G · transferts de charge · fluidité · dispersion · tour idéal

### 4 — Liste / historique
`roulages` · `amis` · `notifications` · `social` · `objectifs` · `session-media/[sessionId]`

### 5 — Formulaire / réglages / capture
`settings` · `equipement` · `donnees-securite` · `creer-trace` · `placement` · `legal/[doc]` · `debug-capture` · `debug-circuit`

### 6 — Espace coach
`index` · `pilote/[id]` · `annoter` · `priorites` · `reperes` · `repere/[index]` · `lecture` · `contexte` · `gabarits` · `business` · `roulages/index` · `roulages/[id]` · `roulages/nouveau`

### 7 — Admin / régie
`index` · `en-cours` · `preparation` · `coachs` · `coachs/[id]` · `circuit` · `sessions-media` · `analytique`

### 8 — Écran live en piste *(silence en piste)*
`roulage` · `entre-runs` · `pilotage-fini`

### 9 — Comparaison A/B
`comparateur` · `cote-a-cote/[friendId]` · `virage-comparer` · coach `comparer` · coach `comparer-pilotes`

### 10 — Onboarding
`(onboarding)/index` · `doctrine` · `methode` · `niveau` · `pacte` · `cgu` · `(coach-onboarding)/index` · `mission` · `pacte`

### 11 — Carte de chaleur *(pilier factuel)*
`heatmap` · `carte` (couche chaleur) · pilier « carte de chaleur » du débrief

### 12 — Carte de partage
`partage` · `share/[token]` · `social-carte`

### 13 — Fiche circuit
`circuit/[id]` (+ détail depuis lieux / circuits)

### 14 — Mon coach *(côté pilote)*
`mon-coach`

---

## 4. Système de design

### Tokens couleur — source `src/theme/v2.ts`
| Rôle | Token | Hex |
|------|-------|-----|
| Fond | night | `#050505` |
| Carte | card | `#0B0B0D` |
| Carte 2 | card2 | `#121214` |
| Filet | line | `#1E1E22` |
| Texte | cream | `#F8F9FA` |
| Texte secondaire | mute | `#9A9AA3` |
| Texte tertiaire | faint | `#5A5A62` |
| Marque | red | `#C8102E` |
| Quotidien / données | gold | `#FFB703` |
| Virage / Heritage | heritageGold | `#C4A459` |
| Tendance positive | green | `#4ADE80` |

### Polices
- **Geist** — titres et corps de texte
- **Geist Mono** — eyebrows, données, méta (le registre HUD / télémétrie)

### Composants partagés
- **eyebrow** — mono, 11 px, lettrage `.22em`, capitales, faint
- **hero chiffré** — un seul chiffre dominant par écran, en mono
- **carte** — fond `card`, filet `line`, rayon 14–18
- **tracé / graphe central** — circuit, G-G, carte de chaleur
- **lecture factuelle** — bloc à filet gold + tag « un constat, pas une consigne »
- **trois primitives de ligne** — bascule, valeur, action (tous les écrans de saisie)
- **bande coach** — bloc rouge marqué « Espace coach » / « De votre coach », seul lieu prescriptif

### Composants propres aux cas particuliers
- **indicateur de capture** — point rouge pulsant + manifeste (écran live)
- **barre de progression** — segments d'étape (onboarding)
- **double colonne A/B** — codage gold (A) / cream (B), du bandeau aux chiffres
- **gradient de chaleur** — sombre → heritage → gold → rouge, le long du tracé
- **carte trophée** — format 4:5, logotype + chiffre + tracé + signature (partage)
- **carte coach** — insigne initiales + rôle ; bande coach en lecture (mon coach)

### Règles non négociables
1. **Un seul chiffre dominant** par écran. Le reste est secondaire.
2. **Couleurs strictement codées** : gold = quotidien, heritage = virage et offre Heritage uniquement, rouge = marque, vert = tendance. Jamais d'or décoratif hors Heritage.
3. **Côté pilote : factuel exclusivement.** Aucun impératif, aucune prescription.
4. **Le prescriptif est cantonné à la bande coach.** Verbes d'ordre interdits partout ailleurs.
5. **Silence en piste.** Aucune sollicitation pendant le roulage.

---

## 5. Dépôt

Chemin suggéré : **`docs/refonte-app/`**

Y déposer les 14 fichiers `.html` + le présent index. Chaque maquette porte en tête un bloc de documentation reliant la maquette à ses écrans React Native cibles — la traçabilité spec → écran est dans le fichier lui-même.

---

## 6. Transposition React Native

À exécuter par Claude Code, sur le dépôt à jour. Pour chaque écran :

1. **Lire** la maquette de référence de son archétype + les tokens existants (`src/theme/v2.ts`, `tokens.ts`) + l'écran RN actuel.
2. **Réécrire** la présentation en appliquant la grammaire de la maquette (composants, hiérarchie, chiffre dominant unique).
3. **Ne pas toucher** la logique de données — services, hooks, requêtes Supabase restent inchangés. La refonte est strictement visuelle.
4. **Réutiliser** les composants existants déjà conformes (`CircuitTraceHero`, etc.) plutôt que les réécrire.

**Ordre conseillé :** un écran par archétype d'abord (le plus simple), validé sur device, puis déclinaison des autres écrans du même archétype en série.

**Garde-fous :**
- Ne jamais réintroduire de langage prescriptif côté pilote.
- Respecter les couleurs codées (§4).
- Vérifier chaque libellé contre le vocabulaire figé : QDI, marges, Cap, Trajectoire, Anticipation, Visée, Plongée, combiné, adhérence.

---

## 7. Doctrine préservée

- **Miroir, pas coach.** L'app montre des faits ; la décision appartient au pilote.
- **Sécurité avant performance.** On parle de marge, pas de limite.
- **Bande coach = seul espace prescriptif.** OXV n'est pas agréé ; le coach humain prescrit, jamais le miroir.
- **Silence en piste.** L'app se tait au volant ; la donnée se lit au débrief.
- **Un constat, pas une consigne.**
