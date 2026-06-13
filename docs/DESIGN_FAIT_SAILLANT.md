# Design — Le « fait saillant » central du Bilan (écran 20.1)

> **STATUT (2026-06-13)** : décision Gabin = adopter **les 3 concepts** comme **un seul héros progressif**
> (« Le Sillage qui s'ancre » : moteur *Fait Élu* sans badge I→IV → présentation *Sillage* maintenant →
> *Tour Tracé* ancré post-capture). **Phase S livrée et vérifiée** dans [`bilan.tsx`](../app/(app)/bilan.tsx) :
> l'ancien score « marge globale % » colorié vert/jaune/rouge + manifeste « Vous avez touché vos limites »
> est **remplacé** par le héros Sillage (meilleur tour + situation soi-contre-soi dans le fil des séances),
> couleur donnée crème (jamais rouge-verdict). Phases M (frise SVG animée + delta côté Supabase) et L
> (tracé ancré post-Valence) restent à faire.

> Étude produite le 2026-06-13 (panel de 5 concepteurs sur angles distincts → 3 juges indépendants
> → synthèse → critique adversariale doctrine/faisabilité). Remplace l'actuel **« marge globale % »**
> de [`bilan.tsx`](../app/(app)/bilan.tsx) — qui affiche un **score global coloré vert/jaune/rouge** + le
> manifeste jugeant « Vous avez touché vos limites » (`computeMargin`/`colorForZone`/`manifestForMargin`),
> exactement ce que le contrat (`00_CLAUDE §1/§2`, règle MetricHero `01:69`) proscrit. **Le remplacer corrige
> donc une vraie violation existante**, pas seulement un point de style.

## Contrainte de réalité (vérifiée dans le code)
`telemetry_frames` est **vide** en prod (1ʳᵉ capture juillet 2026). Seuls les faits dérivés de la table
**`laps`** (peuplée par `lapDetectionRunner`, indépendamment des frames) sont calculables aujourd'hui :
chrono, régularité (`computeRegularity`), `best_lap`, écart-type, delta inter-sessions. Tout fait **spatial**
(faisceau, tracé allumé) et toute **corrélation P4** (jerk × lacet — le jerk est un `TODO` non codé,
`analysis.ts:85`) sont **post-capture**. Toute proposition doit dégrader proprement.

---

## Les 5 concepts étudiés

### 1. Le Fait Élu *(élection algorithmique)*
L'app élit, à chaque session, **le fait le plus révélateur calculable** (parcours P4→P1), avec une ligne
« POURQUOI CE FAIT » et un badge de profondeur I·II·III·IV. Le héros **change de nature** d'une session à
l'autre → l'app se sent vivante.
- **Innovation** : la plus haute, anti-usure maximale. **« Je me revois »** : bon.
- **Faisabilité aujourd'hui** : ~nulle (dépend de P4 jerk inexistant, map-matching per-lap non câblé, élection serveur + colonnes + Edge Function).
- **Doctrine** : **risquée** — le badge I→IV ressemble à une **note de niveau** (proscrite §2) ; « pourquoi ce fait » est un point de fuite vers la cause. Effort **L**.

### 2. Le Tour Tracé *(le fait ancré sur la géographie)*
Fusion MetricHero + TrackStage : le chiffre ne flotte pas, il **s'allume sur le tracé là où le fait se
produit** (faisceau de cordes au V4, secteur qui loge le temps…).
- **Innovation** : haute. **« Je me revois » : 9-10/10** (le jury produit le classe n°1) — le miroir littéral, Pattern 4a pur.
- **Faisabilité aujourd'hui** : **nulle** (100 % dépendant des frames + map-matching per-lap absent).
- **Doctrine** : pure sur le principe, mais le rouge `#E63946` (pilier trajectoire) sur le tracé se lit comme une **alerte** ; « 80 % du temps perdu » flirte avec le jugement. Effort **L** (sous-évalué « M »).

### 3. Face-à-Face *(diptyque soi-contre-soi)*
Deux colonnes jumelles (votre référence vs aujourd'hui), chronos **crème identiques**, le **delta** au centre
en bleu data. Le delta EST le fait.
- **Innovation** : moyenne. Sobre et symétrique.
- **Faisabilité** : servie par l'existant, **mais s'effondre à la 1ʳᵉ session** sur un circuit (mono-colonne, inerte jusqu'à la 2ᵉ capture).
- **Doctrine** : sobre, mais un duel de chronos **invite la lecture compétitive** ; le signe +/− est un risque permanent. Effort **M**. → meilleur comme **module greffé** que comme héros.

### 4. La Dépêche *(éditorial typographique)*
Le fait mis en page comme une **dépêche d'agence** (Bloomberg/F1 TV) : eyebrow mono (date·circuit), une
phrase-titre avec un **token data géant serti**, dateline factuelle. La mise en forme EST la valeur (Pattern 3).
- **Innovation** : moyenne. **La plus conforme** (bornée P1-P2, dégradation + mode DÉMONSTRATION exemplaires).
- **Faisabilité** : partielle — promotion d'un fait à câbler **et polices de charte non chargées** (`tokens.ts` mappe encore `Menlo`, pas Syncopate/JetBrains/Inter).
- **Faiblesse** : **statique** (usure rapide), token serti peu lisible à bout de bras. Effort **M**. → excellent **registre typographique** à réutiliser partout.

### 5. Le Sillage *(un fait qui porte son temps)* — **recommandé**
Le **tour le plus régulier** (chrono animé), **situé dans le fil de vos séances** ici : une micro-frise où le
point courant s'allume, + le delta vs votre dernière venue. Soi-contre-soi diachronique.
- **Innovation** : bonne (whaou sobre, temporel). **« Je me revois » : 8-9/10**.
- **Faisabilité aujourd'hui** : **la seule « oui »** — sort des `laps` via des services qui existent déjà (`computeRegularity`, `fetchPreviousSessions`, `calculateEvolution`). Seule dette : un composant `CountUpLapTime` (format `m:ss.s`).
- **Doctrine** : propre. Risque unique : « en hausse/en baisse » → « bon progrès » (à verrouiller par copie figée). Effort **M** (la 1ʳᵉ marche immédiate est **S**).

---

## Verdict du jury (3 juges : doctrine / produit / faisabilité)

| Concept | Doctrine | Innovation | Faisable **aujourd'hui** | Premium | Je me revois |
|---|---|---|---|---|---|
| Le Fait Élu | 6-7 | **9-10** | 2 | 8-9 | 7-8 |
| Le Tour Tracé | 7-9 | 8-9 | 2-6 | **9-10** | **9-10** |
| Face-à-Face | 8-9 | 6 | 4-7 | 8 | 6-9 |
| La Dépêche | **9** | 6 | 5-6 | 7-9 | 5-6 |
| **Le Sillage** | 8-9 | 7 | **7-9** | 8 | 8-9 |

**Convergence** : *le Sillage est le seul à franchir les deux portes éliminatoires* — conformité **et**
faisabilité alpha — tout en gardant un fort « je me revois ». Le Tour Tracé est la meilleure destination
émotionnelle, mais **n'a aucune donnée à montrer avant juillet 2026**.

---

## Recommandation — « Le Sillage qui s'ancre » *(hybride, à deux étages)*

Adopter **Le Sillage** comme héros V1, **conçu dès le départ comme un réceptacle à deux étages** : un chiffre
central + une zone « situation » sous le chiffre. On livre du réel **maintenant** (le Sillage sort des laps),
et la zone « situation » accueillera **après la 1ʳᵉ capture** le **mini-tracé ancré du Tour Tracé** sans
refondre l'écran. On greffe :
- **Diptyque** → la situation soi-contre-soi en **texte** (« Votre 4ᵉ séance ici · précédente 1:43.1 · −0,3 s »), sans le duel de colonnes (on évite la lecture compétitive).
- **Dépêche** → le **registre typographique** (eyebrow mono, token data, dateline) + sa **discipline d'état vide / DÉMONSTRATION estampillée**.
- **Tour Tracé** *(différé, post-Valence)* → le mini-tracé/faisceau dans la zone situation.
- **Fait Élu** *(très différé, sous validation)* → l'idée d'élection par profondeur, **sans** le badge I→IV ni « pourquoi ce fait » tant que la doctrine n'est pas tranchée.

### Croquis d'implémentation — `app/(app)/bilan.tsx`
**Données (zéro frame requis)** : `fetchSessionLaps` → `computeRegularity` (tour régulier, écart-type, nb tours) ;
fallback `session.best_lap_seconds` ; `fetchPreviousSessions(userId, circuit_id, …)` pour le fil ;
delta = `calculateEvolution().bestLapDelta`. **À retirer du rendu** : `computeMargin`/`colorForZone`/`marginLabelOf`/`manifestForMargin` (la marge %, sa couleur-verdict, son manifeste jugeant).

**Structure** : eyebrow `BILAN DE SESSION` → `<SillageHero>` (eyebrow mono « VOTRE TOUR LE PLUS RÉGULIER » +
`<CountUpLapTime>` Syncopate ~64px **crème** + ligne de situation + micro-frise SVG 6 pts max, courant en
bleu data + ligne « tient dans X s sur N tours ») → bandeaux coach **inchangés** → nav/CTA inchangés.

**État vide** : frames vides + laps présents = cas nominal ; 0 lap = `BilanEmpty` ; 1 seule séance = frise à
1 point + « Première séance ici. Le fil commence ici. » ; pré-Valence = bandeau **DÉMONSTRATION** estampillé.

**Effort** : **S** (cette semaine, sans frames) — substituer le bloc marge par le SillageHero + situation
textuelle + état vide ; écrire `CountUpLapTime`. **M** (après 1ʳᵉ capture) — frise animée sur ≥2 séances.
**L** (post-Valence, validation Gabin) — insérer le mini-tracé ancré (map-matching per-lap + arbitrage `#E63946`).

---

## Conditions doctrine/archi avant build (critique adversariale)
1. **Requalifier la dispo** : « disponible aujourd'hui » n'est vrai **que si la table `laps` est peuplée en prod** ; sinon le Sillage est lui aussi en **mode démonstration estampillé**. Ne rien présenter de fictif comme réel.
2. **Calcul côté Supabase dès la phase S** : le **delta** et le **choix du chrono-héros** doivent être pré-calculés en base (champ sur `app_session_analyses`), pas assemblés dans l'app (`00_CLAUDE §4/§7-2`).
3. **Verrouiller la copie** : delta et ligne de situation en **copie figée**, passées au **test anti-verbes-interdits côté serveur** ; **frise strictement décorative** (pas d'axes, pas de grille) pour ne pas devenir un graphe-verdict.

## Micro-choix qui restent à Gabin
- Badge profondeur I→IV + « POURQUOI CE FAIT » (Fait Élu) : un jour autorisés sous garde-fous, ou proscrits comme note de niveau ?
- Couleur du tracé ancré (post-Valence) : tolérer `#E63946` + label « TRAJECTOIRE », ou réserver le surlignage aux piliers bleu/régularité ?
- Pré-Valence : montrer un Sillage en **mode DÉMONSTRATION** estampillé, ou s'en tenir à l'état vide strict ?
- Plafond de lisibilité de la frise à bout de bras avec gants (6 points ?).
