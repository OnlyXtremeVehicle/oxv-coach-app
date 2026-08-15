# PROGRAMME V4 — Audit complet et plan d'exécution

> **15/08/2026.** Ce document remplace le fil des points ouverts par un
> programme exécutable. Il est écrit pour être lu par Claude Code en tête de
> session, comme le V3 l'était.
>
> **Règle n° 1, héritée et payée quatre fois cette semaine : MESURER AVANT DE
> CROIRE.** Ce document date du 15/08 au soir. Toute affirmation de plus de
> deux semaines se remesure (base, dépôt, journaux) avant d'être traitée.
> Quatre chantiers de cette semaine étaient déjà faits quand on a mesuré.

---

## 0 · AUDIT — l'état réel au 15/08, mesuré

### Volumétrie

| | mesuré |
|---|---|
| Écrans (`app/`) | 150 fichiers `.tsx` |
| Modules (`src/`, hors tests) | 519 |
| Tests | 286 fichiers · **3 358 cas** (tsc 0 · lint 0) |
| Gardes `*.guard.test.ts` | 35 — **toutes lexicales, zéro AST** (§ F1) |
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

Doctrine outillée (35 gardes, honnête-vide généralisé, rouge de marque
testé) · autorisation unifiée sur `role` (base + app + site vérifiés, colonne
`is_admin` supprimée) · garde pilote sur `registrations` (un pilote ne peut
plus se pointer ni valider son paiement) · cron `v2.0` à critère de version
dans le dépôt · flux e-sign décharges complet (gaté avocat) · récupération de
trames au lancement · BLE arrière-plan complet (à prouver au circuit).

### Santé — les cinq faiblesses structurelles

1. **Restitution sans grammaire** : 40 objets visuels, 5 socles concurrents,
   4 radars, 4 polyline→path, 3 rampes — livraison A1 posée, pas appliquée.
2. **Gardes lexicales** : 4 verdicts faux en 2 jours ; `DEFAULT_VEHICLE`
   invisible par construction à une garde texte.
3. **Code écrit sans appelant** (motif récurrent) : socle `render/` (7 modules,
   `ribbon` jamais branché), `DebriefMirror` 1 235 l., moteurs dupliqués
   app/edge, 4 logiques sans service. La garde orphelins ne voit pas les morts
   de 2ᵉ rang (5 modules).
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

Gardes → AST (commencer par : « paramètre optionnel jamais renseigné par
aucun appelant » — celle qui aurait vu `DEFAULT_VEHICLE`) · garde orphelins
transitive · trancher les orphelins (brancher ou supprimer, jamais dormir) ·
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
