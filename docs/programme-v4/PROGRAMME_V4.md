# PROGRAMME V4 — Audit complet et plan d'exécution

> **15/08/2026.** Ce document remplace le fil des points ouverts par un
> programme exécutable. Il est écrit pour être lu par Claude Code en tête de
> session, comme le V3 l'était.
>
> **Règle n° 1, héritée et payée quatre fois cette semaine : MESURER AVANT DE
> CROIRE.** Ce document date du 15/08 au soir. Toute affirmation de plus de
> deux semaines se remesure (base, dépôt, journaux) avant d'être traitée.
> Quatre chantiers de cette semaine étaient déjà faits quand on a mesuré.
>
> **ET LA RÈGLE S'EST APPLIQUÉE À LUI EN QUELQUES HEURES.** L'audit § 0 a été
> écrit dans la journée du 15/08 ; les lots V4-L1 à L5 ont été appliqués le
> soir même, et cinq de ses affirmations sont devenues fausses avant minuit —
> le compte de tests, celui des gardes, « toutes lexicales, zéro AST », le cron
> « v2.0 », et la première ligne de la dette § 6. Elles sont corrigées
> ci-dessous, datées. Deux semaines était une borne prudente ; la vraie borne
> est « avant de traiter la ligne ».

---

## 0 · AUDIT — l'état réel au 15/08, mesuré

### Volumétrie

| | mesuré |
|---|---|
| Écrans (`app/`) | 150 fichiers `.tsx` |
| Modules (`src/`, hors tests) | ~~519~~ → **523** (15/08 soir, +5 du paquet V4) |
| Tests | ~~286 fichiers · 3 358 cas~~ → **292 fichiers · 3 436 cas** (tsc 0 · lint 0) |
| Gardes `*.guard.test.ts` | ~~35, toutes lexicales, zéro AST~~ → **40**, dont **3 lisent un arbre syntaxique** et 14 s'appuient sur l'analyseur pour ne plus confondre code et commentaire |
| Migrations appliquées | 256 (+ 6 `PROPOSITION_` en attente d'un mot) |
| Fonctions Edge | 33 déployées |
| TODO hors juridique | 8 (+ 3 `TODO_AVOCAT`/`ARBITRAGE`, bloqués tiers) |

### Données de production (projet `fouvuqkdxarjpjbqnsjq`)

- **1 séance réelle** (Bouteville 13/08, 26 999 trames, 3 tours valides),
  10 séances closes sans tours. 14 comptes, **0 coach**, affiliation coach
  `pending` depuis le 22/06.
- `laps.distance_meters` : **renseigné le 15/08** — 5 875,49 · 5 873,68 ·
  5 874,72 m (écart 1,81 m ; contrôle croisé ≤ 1,4 m). Le 5ᵉ niveau de
  restitution est ouvert.
- `margin_global` Bouteville = **60,40** (marge pilote pure — la fabrication
  `DEFAULT_VEHICLE` est sortie du serveur le 15/08).
- ⚠ `telemetry_frames.created_at` est un **ordre d'insertion**. Toute requête
  de trajectoire trie sur **`elapsed_ms`**. (Mesuré : trié sur `created_at`,
  les points s'entremêlent.)
- ⚠ La migration `20260814210000` (w_consistency) avait été appliquée **hors
  historique** ; `schema_migrations` réparé le 15/08. Ne plus appliquer de
  SQL de migration hors chaîne.

### Santé — ce qui est solide

Doctrine outillée (40 gardes, honnête-vide généralisé, rouge de marque
testé) · autorisation unifiée sur `role` (base + app + site vérifiés, colonne
`is_admin` supprimée) · garde pilote sur `registrations` (un pilote ne peut
plus se pointer ni valider son paiement) · cron **`v3.0` DÉPLOYÉ** (v2.0 dans le dépôt au
matin ; le balayage a repris les 11 lignes, zéro marge véhicule fabriquée) · flux e-sign décharges complet (gaté avocat) · récupération de
trames au lancement · BLE arrière-plan complet (à prouver au circuit).

### Santé — les cinq faiblesses structurelles

1. **Restitution sans grammaire** : 40 objets visuels, 5 socles concurrents,
   4 radars, 4 polyline→path, 3 rampes. ~~Livraison A1 posée, pas appliquée.~~
   **A1 APPLIQUÉE le 15/08 au soir** : `speedHeat` est monochrome et sa
   monotonie est calculée par test. Le dédoublonnage (4 radars, 4
   polyline→path) reste entier — c'est le gros du lot.
2. **Gardes lexicales** : 4 verdicts faux en 2 jours ; `DEFAULT_VEHICLE`
   invisible par construction à une garde texte. **La première garde AST est
   posée** (§ 6, premier point : fait), plus deux autres. Trente-sept restent
   lexicales.
3. **Code écrit sans appelant** (motif récurrent) : socle `render/` (7 modules,
   `ribbon` jamais branché), `DebriefMirror` 1 235 l., moteurs dupliqués
   app/edge, 4 logiques sans service. ~~La garde orphelins ne voit pas les
   morts de 2ᵉ rang (5 modules).~~ **Elle les voit depuis le 15/08 au soir** :
   la mesure part des racines `app/` et suit les imports. 35 → **40**, et les
   cinq nommés — dont `debriefRenderGuard`, la ceinture doctrinale de dernier
   mètre, dormante sous un composant jamais monté (le bilan tient la sienne :
   doublon, pas trou). Les trancher reste à faire.
4. **Le commerce est en base, pas à l'écran** : partner_offers/plans/leads,
   coaching marketplace, activity_facts — zéro écran de catalogue.
5. **Observabilité** : Sentry DSN absent de tous les profils EAS — aveugle aux
   plantages ; supervision cron corrigée (function_edge_logs, jamais
   job_run_details).

---

## 1 · PHASE IMMÉDIATE — appliquer ce qui est prêt (aucune décision)

**Les lots V4-L1/L2/L3 s'appliquent par UN script, plus à la main.**
L'archive `oxv_v4_complet.zip` s'extrait À LA RACINE du dépôt (elle apporte
les 5 modules neufs + `docs/` + le script), puis :

```
python3 scripts/appliquer_corrections_v4.py              # simulation
python3 scripts/appliquer_corrections_v4.py --appliquer  # écrit
```

Le script lit les 20 remplacements dans `docs/corrections-v4/A*.md`, exige
chaque ancre exacte ET unique, refuse d'écrire si un seul bloc échoue, et se
rejoue sans danger (« déjà en place »). Vérifié le 15/08 sur copie du dépôt :
20 appliqués · relance = 0 à appliquer, 20 déjà · jest/tsc à passer ensuite.

| lot | contenu | vérification après application |
|---|---|---|
| V4-L1 | `grammaireViz.ts` + garde `rampeMagnitude` + speedHeat monochrome (7 blocs) | la garde passe APRÈS le remplacement, échoue avant (voulu) |
| V4-L2 | Polices 18→11 · AnatomieViz `> 0` · **invocation `compute-session-insights-v3`** (6 blocs) | `policesChargees` : 0 manquante, 0 inemployée ; GGViz/FlowViz/TransfertViz/DispersionViz cessent d'être vides |
| V4-L3 | `margeLogic.ts` + section MARGE au bilan + marqueur `focus` (7 blocs) | 7 tests ; Bouteville affiche 60 %, Constance 34, Fluidité 100 |
| V4-L4 | Deux déploiements CLI : `cron-analyze-pending-sessions` (v2.0) puis `ritual_dispatcher` | 10 séances vides rattrapées UNE fois puis file fermée ; « Prévision indisponible » remplace le 0 °C |
| V4-L5 | (option) garde « jamais de radar sur une vue de séance » | un grep |

### Fait le 15/08 au soir — avec la preuve

| lot | état | preuve |
|---|---|---|
| V4-L1 | **appliqué** | `speedHeat` monochrome ; `rampeMagnitude.guard` verte — l'ancienne rampe rendait 0,325 → 0,511 → **0,453** → 0,633, recalculé indépendamment avant d'appliquer |
| V4-L2 | **appliqué**, à un bloc près | polices 18 → **11** (Michroma sorti aussi) ; v3 invoquée après v1 dans `analyzeSessionService`. Le bloc AnatomieViz `(x ?? 0) > 0` est REFUSÉ : superseded par le correctif du 14/08 qui va à la source, et `> 0` jetterait une distance de freinage de 0 m réellement mesurée (cf. A2 § 2) |
| V4-L3 | **appliqué** | section MARGE au bilan, décomposition pondérée, marqueur `focus` ; la note équivalente posée sous le débrief la veille est retirée — elle faisait doublon |
| V4-L4 | **moitié faite** | `cron-analyze-pending-sessions` déployé en **v3.0** et rejoué : 11 lignes reprises, 0 marge véhicule fabriquée, Bouteville 51,44 → **60,40** base `pilote-seul`. `ritual_dispatcher` : NON déployé, non tranché |
| V4-L5 | **fait, et en AST** | `radarHorsSeance.guard` lit l'arbre JSX plutôt qu'un grep : un grep aurait accusé le commentaire qui explique pourquoi on ne monte pas le radar. Témoin inclus — la garde vérifie d'abord qu'elle SAIT voir un radar là où il est monté (`studio.tsx`) |

**Trois défauts dans le paquet livré**, corrigés au passage : l'extracteur du
script gardait le saut de ligne de tête des ancres (un `if` s'est retrouvé
collé à la fin d'un commentaire, donc commenté) ; le bloc 1c réémettait `body:`
et dupliquait la propriété ; `rampeMagnitude.guard` renversait `RAMPE_ORDRE`
avant de la juger, alors qu'elle est déjà croissante — quatre échecs sur un
défaut inexistant. **Une garde ne transforme pas ce qu'elle juge.**

## 2 · PHASE ÉCRANS — les 4 lots d'interaction (spec transmise)

Spec : `SPEC_V3_interactions_seance.md` (projet Claude). Ordre conseillé :

1. **Mode Stand** — le moins cher : machine à 3 seuils, hystérésis 5/15
   OBLIGATOIRE, 3 chiffres gants, zéro toucher. Principe 3 intact : rien tant
   que ça roule. (Coach en roulage = fil live + lunettes — décision 15/08.)
2. **Sélecteur de tours** — habillage : `selectedLap` existe déjà dans
   `data/session/[id]`.
3. **Rejeu au doigt** — un état (`progress`), deux consommateurs (tracé +
   courbe delta), readout `POLES_DELTA`, bande morte 0,05 s.
4. **Zoom virage** — pinch/pan ; **au-delà de ×3, charger les trames pleine
   résolution bornées bbox + fenêtre du tour, tri `elapsed_ms`** ; jusqu'à
   3 tours superposés, `non-scaling-stroke` ; points blancs `v < 2 km/h`
   (fait mesuré : le tour 1 s'arrête ≈ 2,6 s dans l'épingle).

## 3 · PHASE RESTITUTION — le produit qui capte (bancs v2/v3 validés)

| lot | quoi | socle |
|---|---|---|
| R1 | **Tour recomposé** — meilleur passage par secteur, recollé ; « chaque secteur a été roulé » | `app_segment_analyses` (virages) ou secteurs curvilignes tant que la topologie manque |
| R2 | **Récit de séance** — frise de faits horodatés, apparition séquencée, chaque fait ancré au tracé | keyMoments + marqueur `focus` + faits de secteur |
| R3 | **Records par virage** — soi contre soi, datés ; rend la célébration légitime | une vue SQL sur `app_segment_analyses` cumulé |
| R4 | **Carte partageable** — tracé vitesse + chrono + insigne ; 3 faits max, jamais marge/QDI ; le lien = `/share/{token}` | bloqué par C6/D7 (merge site) |
| R5 | **Signature évolutive** — fantôme N séances en retrait ; état honnête tant qu'1 séance | `BASELINE_MAX_SESSIONS` |

Règles transverses (banc v1, gardées « on garde tous ») : marge pilote tant
que le véhicule n'est pas caractérisé par la mesure · radar = Saison, barres =
séance · zéro mesuré ≠ non mesuré, partout (`Mesure<T>`, migration écran par
écran) · le rouge ne code jamais une donnée.

## 4 · PHASE COMMERCE — catalogue & coach (banc v3)

- **Carnet d'adresses** : annuaire par circuit, plan d'engagement VISIBLE,
  rang jamais achetable (la garde existe — en faire une politique affichée).
  Prérequis : enums (C5), vocabulaire site.
- **Fiche coach** : `coach_activity_facts` (3 nombres + date) à la place des
  témoignages ; placement UNIQUEMENT au bilan d'une séance close sans coach —
  jamais en piste, jamais dans REC.
- Bloquants réels : SIRET (facturation), 2 comptes coach, affiliation D6.

## 5 · DÉCISIONS FONDATEUR EN ATTENTE (rappel — voir registre du 15/08)

C1 comptes admin (3 jours d'attente, 10 s) · C2 quatre écrans coach · C3
comptes coach · C4 parrainage (seul point exposant) · C5 enums · C6/D7
publication site · C7 « Cap » à l'écran · C8 focusCorner→breakdown.
Gestes : Sentry DSN · secrets CI · T0 iPhone · avocat (art. 2226) · SIRET.

## 6 · DETTE PLANIFIÉE (ne bloque pas, se programme)

~~Gardes → AST (commencer par : « paramètre optionnel jamais renseigné par
aucun appelant » — celle qui aurait vu `DEFAULT_VEHICLE`)~~ **FAIT le 14/08** :
`entreeOptionnelleMorte.guard` parse tout le dépôt et fige 83 entrées, dont
`computeMargin(vehicle?)`. Deux pièges en l'écrivant, tous deux rendant l'outil
aveugle à son propre cas d'origine — compter les clés globalement, et compter
les TESTS parmi les appelants. Le reste du chantier AST demeure : 37 gardes
lexicales · ~~garde orphelins transitive~~ **FAIT le 15/08** : la mesure part
des racines `app/`, 35 → 40, cinq morts de 2ᵉ rang nommés · trancher les
orphelins (brancher ou supprimer, jamais dormir) — **c'est devenu le point le
plus mûr de cette liste : quarante modules attendent un verdict** ·
dédoublonnage viz vers `vizMath`+`grammaireViz` · purge RGPD familles 1 et 3
(PROPOSITION_A14 prête) · `Mesure<T>` au fil des écrans.

## 7 · CE QUI ATTEND LE MONDE

Build 1ᵉʳ sept. (valider : polices, MARGE, lots écrans, `space.lg`) ·
terrain (BLE verrouillé 10 min, célébration, 6 Insights) · 3 séances circuit
fermé (calibration, caractérisation véhicule → la marge globale revient,
D-40) · **D-43 avant Valence** · exécuteur T3.

---

*Un lot terminé se coche ici avec sa date et sa preuve (test, capture,
requête). Un lot qui traîne deux semaines se remesure avant reprise.*
