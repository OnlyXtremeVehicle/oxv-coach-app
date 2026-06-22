# OXV Mirror — Refonte des écrans · Index de référence

> Document d'entrée du dossier `docs/refonte-app/`.
> Charte : `src/theme/v2.ts` + `src/theme/tokens.ts` — polices Geist / Geist Mono.
> Doctrine : l'app est un miroir. Elle montre, elle ne dirige pas.

---

## 1. Démarche

Les **80 écrans** de l'application ne sont pas 80 designs distincts : ce sont **7 archétypes** déclinés. Cette refonte fige la grammaire commune au travers de 7 maquettes de référence, autonomes et auto-documentées. Chaque écran restant n'est plus qu'une application du système — déclinable en série ou généré directement en React Native à partir de ces références.

Refaire toutes les pages, c'est fixer leur langage commun une fois, au lieu de redessiner la même grammaire quatre-vingts fois.

---

## 2. Les sept maquettes de référence

| # | Archétype | Fichier | Écrans couverts |
|---|-----------|---------|------------------|
| 1 | Analyse riche | `maquette_debrief_refondu.html` | 15 écrans pilote |
| 2 | Hub / navigation | `maquette_accueil_refondu.html` | 6 écrans pilote |
| 3 | Insight approfondi | `maquette_insight_gg_refondu.html` | galerie + 6 lectures (post-Valence) |
| 4 | Liste / historique | `maquette_liste_roulages_refondu.html` | 8 écrans pilote |
| 5 | Formulaire / réglages | `maquette_reglages_refondu.html` | écrans de saisie, capture, états de flux |
| 6 | Espace coach | `maquette_coach_pilote_refondu.html` | 15 écrans coach |
| 7 | Admin / régie | `maquette_admin_refondu.html` | 8 écrans admin |

---

## 3. Mapping intégral des 80 écrans

### Archétype 1 — Analyse riche
`debrief` · `debrief-presentiel` · `bilan` · `bilan-pret` · `signature` · `regularite` · `progression` · `virage` · `virage-comparer` · `tours` · `heatmap` · `comparateur` · `stats` · `replay` · `telemetry` · `prochaine-fois`

### Archétype 2 — Hub / navigation
`index` · `paddock` · `lieux` · `carte` · `circuits` · `circuit/[id]`

### Archétype 3 — Insight approfondi *(écrans à construire après Valence)*
galerie des lectures · anatomie du freinage · diagramme G-G · transferts de charge · fluidité · dispersion · tour idéal

### Archétype 4 — Liste / historique
`roulages` · `amis` · `notifications` · `social` · `social-carte` · `objectifs` · `partage` · `share/[token]` · `session-media/[sessionId]`

### Archétype 5 — Formulaire / réglages / capture / états de flux
`settings` · `equipement` · `donnees-securite` · `creer-trace` · `placement` · `mon-coach` · `cote-a-cote/[friendId]` · `legal/[doc]` · `roulage` *(live)* · `entre-runs` *(live)* · `pilotage-fini` *(transition)* · `debug-capture` · `debug-circuit`

### Archétype 6 — Espace coach
`index` · `pilote/[id]` · `annoter` · `priorites` · `reperes` · `repere/[index]` · `lecture` · `contexte` · `comparer` · `comparer-pilotes` · `gabarits` · `business` · `roulages/index` · `roulages/[id]` · `roulages/nouveau`

### Archétype 7 — Admin / régie
`index` · `en-cours` · `preparation` · `coachs` · `coachs/[id]` · `circuit` · `sessions-media` · `analytique`

### Parcours à part — onboarding *(6 + 3 écrans)*
Les écrans `(onboarding)` et `(coach-onboarding)` réutilisent l'archétype 5 (saisie séquentielle). Un passage dédié pourra être maquetté si le parcours d'entrée mérite un traitement propre.

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
- **Geist Mono** — eyebrows, données, méta (le registre HUD/télémétrie)

### Composants partagés
- **eyebrow** — mono, 11 px, lettrage `.22em`, capitales, faint
- **hero chiffré** — un seul chiffre dominant par écran, en mono
- **carte** — fond `card`, filet `line`, rayon 14–18
- **tracé / graphe central** — quand il y a de la donnée spatiale (circuit, G-G)
- **lecture factuelle** — bloc à filet gold + tag « un constat, pas une consigne »
- **trois primitives de ligne** — bascule, valeur, action (tous les écrans de saisie)
- **bande coach** — bloc rouge marqué « Espace coach », seul lieu prescriptif

### Règles non négociables
1. **Un seul chiffre dominant** par écran. Le reste est secondaire.
2. **Couleurs strictement codées** : gold = quotidien, heritage = virage et offre Heritage uniquement, rouge = marque, vert = tendance. Jamais d'or décoratif hors Heritage.
3. **Côté pilote : factuel exclusivement.** Aucun impératif, aucune prescription.
4. **Le prescriptif est cantonné à la bande coach.** Verbes d'ordre interdits partout ailleurs.
5. **Silence en piste.** Aucune sollicitation pendant le roulage.

---

## 5. Dépôt

Chemin suggéré : **`docs/refonte-app/`**

Y déposer les 7 fichiers `.html` + le présent index. Chaque maquette porte en tête un bloc de documentation reliant la maquette à ses écrans React Native cibles — la traçabilité spec → écran est dans le fichier lui-même.

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
- **Un constat, pas une consigne.**
