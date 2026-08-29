# QDI 5 branches — cartographie et plan (Lot M1, PROPOSITION à valider)

> **Le calcul est fait, et il est décrit ailleurs.** Ce document reste la
> cartographie du lot et les définitions du fondateur (elles font foi). La
> correspondance branche → formule effectivement implémentée, ses seuils et sa
> version vivent dans `docs/architecture/21_QDI_METHODOLOGIE.md` — qui absorbe
> aussi l'ancien `docs/site/QDI_METHODOLOGIE.md` du dépôt site, supprimé le
> 29/08/2026. Les définitions ci-dessous sont celles d'un pilote ; les formules
> mesurent les CONSÉQUENCES (point 3), et l'écart entre les deux se lit là-bas.

> Décision fondateur 2026-07-04 : QDI réintroduit, visible pilote, self-only.
> Branches définies par le fondateur (font foi) :
>
> | Branche | Définition |
> |---------|------------|
> | **Trajectoire** | Précision des lignes, points de corde, gestion des zones de freinage |
> | **Fluidité** | Régularité des inputs volant, absence de corrections brusques, transitions |
> | **Freinage** | Points d'attaque, progressivité, modulation, relâche au corde |
> | **Accélération** | Progressivité à la remise des gaz, anticipation, traction en sortie |
> | **Régularité** | Écart-type entre les tours, stabilité de performance sur la durée |

## 1. Ce qui existe déjà (à réutiliser, pas dupliquer)

- **`QdiDimension`** (`src/components/insights/catalogue.ts`) : le type
  `'trajectory' | 'flow' | 'brake' | 'accel' | 'regularity'` existe — mêmes 5
  branches. Les couleurs canon `theme.dataColors` portent déjà une couleur par
  branche (toujours doublée d'un libellé).
- **`app_session_analyses`** : porte déjà `algo_version`, `computed_at`,
  `margin_breakdown jsonb` → la persistance QDI est **purement additive**.
- **Pipeline** : `analyzeSessionService` (app, post-session) +
  `compute-session-insights` (edge, appelée par l'app et le diagnostic admin) +
  `cron-analyze-pending-sessions` (rattrapage, calcule déjà régularité et
  lissage). Le calcul QDI s'insère LÀ. ⚠️ `compute-session-insights-v3`
  (déployée côté site) à réconcilier — question site posée au lot M0.
- **Empreinte signature** (`pilotSignatureService`, écran `signature.tsx`) :
  radar 5 axes existant qui mesure déjà freinage, engagement latéral,
  réaccélération, régularité — **fort recouvrement avec le QDI** (question 1).
- **Piliers factuels** : régularité (`regularityService`), progression vs soi,
  heatmap — chacun est un zoom naturel d'une branche.

## 2. Cartographie proposée (à valider)

| Branche QDI | Mesure V1 (déterministe, versionnée) | Vue détaillée (pilier/écran existant) |
|-------------|--------------------------------------|----------------------------------------|
| Trajectoire | dispersion latérale des lignes aux virages entre tours (GPS) | carte + heatmap + virage |
| Fluidité | douceur des transitions latérales (dérivée de G_lat, IMU) | lectures Insight « Flow » |
| Freinage | phases de G_long négatif : point d'attaque (distance au virage), progressivité (pente), stabilité inter-tours | virage (entrée) + heatmap freinage |
| Accélération | phases de G_long positif en sortie : progressivité de la remise des gaz, stabilité | virage (sortie) |
| Régularité | écart-type des tours valides (existant, `regularityService`) | pilier régularité |

**Principe** : le radar QDI devient la restitution centrale du Bilan ; chaque
branche s'ouvre sur la vue détaillée existante. Les piliers ne sont pas
supprimés — ils deviennent les zooms des branches (zéro perte, zéro doublon).

**Self-only strict** : le radar compare la session à l'HISTORIQUE DU PILOTE
(médiane de ses N dernières sessions sur le même circuit), jamais à un autre
pilote. Tri par récence. Aucun classement, aucun partage de score inter-pilotes.

**Gating offres** : Signature/Heritage = radar complet + détail des branches +
rapport sous 48 h. Access = radar seul, sans détail des branches (prompt v2).

## 3. Honnêteté capteurs (à assumer dans le bloc méthode)

Le RaceBox fournit GPS + centrale inertielle à 25 Hz. Il n'y a **ni capteur de
volant, ni capteur de pédales**. Les branches Fluidité / Freinage /
Accélération sont donc calculées à partir des CONSÉQUENCES mesurées
(accélérations subies par le véhicule), pas des gestes du pilote. Le bloc
« source et méthode » (obligatoire, charte transparence) le dira tel quel.
`algo_version` estampille chaque calcul ; toute évolution de formule est un
changement tracé.

## 4. Schéma (additif, STOP validation avant application)

Option A (recommandée) — une colonne jsonb sur `app_session_analyses` :
```sql
alter table app_session_analyses
  add column if not exists qdi jsonb;        -- { trajectoire, fluidite, freinage, acceleration, regularite,
                                              --   algo_version, computed_at, reference:{sessions:n, circuit} }
```
Zéro table nouvelle (garde-fou 4), RLS existante inchangée (own-row + coach
consenti + admin), évolutif sans migration à chaque ajustement de formule.

Option B — 5 colonnes numériques + `qdi_algo_version text` (plus SQL-lisible,
plus rigide).

## 5. Livraison sous 48 h

Le calcul est synchrone post-session (analyzeSessionService) ; le cron de
rattrapage couvre les sessions en attente. La « notification sous 48 h » =
notification locale/push « Votre rapport est prêt » quand `qdi` est posé —
s'appuie sur l'infra notifications existante. Le rapport EST l'écran Bilan/QDI
(pas un PDF distinct en V1).

## 6. Décisions fondateur (2026-07-04, VALIDÉES — ce document fait foi)

- ✅ Branches et définitions : fournies par le fondateur (ci-dessus).
- ✅ Q1 — **Le radar QDI ABSORBE l'empreinte signature** : une seule vérité,
  l'écran signature devient la vue d'évolution QDI self-only ; l'ancien radar
  5 axes disparaît côté pilote (les snapshots coach existants suivront dans un
  lot ultérieur, sans casse).
- ✅ Q2 — **Stockage Option A** : colonne `qdi jsonb` sur `app_session_analyses`.
- ✅ Q3 — **Proxy GPS+IMU assumé** pour Fluidité/Freinage/Accélération, dit tel
  quel dans le bloc méthode. Piste matérielle en parallèle : test d'un dongle
  OBD-II BLE (~120 €) à Valence pour mesurer ce que les CAN clients exposent ;
  si concluant, bascule proxy → mesure directe par bump d'`algo_version`.
- ✅ Q4 (post-vérif adversariale) — **Exposition amis ASSUMÉE** : un ami accepté
  (double consentement) peut lire les branches via l'API ; l'app n'affiche
  aucun comparatif inter-pilotes. Couverture cron : recalcul PARESSEUX à la
  lecture (`getOrComputeQdiForSession`) plutôt que porter le moteur en Deno.
