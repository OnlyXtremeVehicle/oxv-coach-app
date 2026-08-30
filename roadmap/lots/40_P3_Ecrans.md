# Lot P3 — le lot des écrans

*Brancher ce qui existe. C'est le plus gros lot du dossier, et il ne contient
presque aucune écriture de logique.*

---

## Ce que ce lot est

Quarante modules sont écrits, testés et dormants. Le commentaire du lot 9a le dit
sans détour :

> *« Le catalogue des 65 présentations et le moteur qui les compose sont écrits
> et testés avant qu'aucune surface ne les rende : c'est l'ordre demandé, et
> l'inscription ici est la contrepartie. **Ils sortiront de cette liste au lot
> des écrans.** »*

Voici ce lot.

**Règle du lot, sans exception : un module branché sort de `CONNUS` dans le
commit qui le branche.** Le second test de `modulesOrphelins.guard.test.ts`
(« aucune entrée périmée ») l'impose déjà. Ne visez jamais « zéro orphelin » :
le premier test exige `mesures.length > 0`, pour qu'un résolveur cassé ne rende
pas la liste artificiellement verte.

**Vérifiez sur la séance de référence** `ff384ace-d6ce-414b-8338-cef030218ee0`
(Bouteville, 12/08, 26 999 trames, 3 tours). Les cinq niveaux de restitution y
sont ouverts : aucun de ces écrans n'a d'excuse pour rester vide.

---

## Ordre — du plus utile au Mans au moins urgent

### P3.1 · `DataConfidenceBanner`

**Deux appelants : le Bilan et la Séance.**
`app/(app2)/bilan/[sessionId].tsx` · `app/(app2)/data/session/[id].tsx`

Porte la mesure d'écart, donc c'est le prérequis de la preuve P-1 au Mans —
« nos tours face aux feuilles de chronométrage officielles ».

**Avant d'écrire** : lire `src/components/DataConfidenceBanner.tsx` et
`src/features/data/confianceLogic.ts` + `confianceSource.ts`. Je n'ai pas lu ses
props ; ne les devinez pas non plus.

**Sur Bouteville, il doit afficher une confiance réelle** : 100 % de fixes
valides, 15,4 satellites, 0,23 m. Si le bandeau sort « confiance faible » sur
cette séance, c'est le calcul de confiance qu'il faut regarder, pas le bandeau.

**Feuille de données** : mots-clés seuls.

---

### P3.2 · `LapScrubber`

**Deux appelants : la Séance et Comparer.**
`app/(app2)/data/session/[id].tsx` · `app/(app2)/data/comparer.tsx`

C'est ce qui rend la séance lisible tour par tour, debout au camion, à une main.

**Ses props, vérifiées :**

```ts
export interface ScrubFrame {
  lat: number | null;
  lon: number | null;
  speedKmh: number | null;
  gLat: number | null;
  gLong: number | null;
  elapsedMs: number | null;
}

export interface LapScrubberProps {
  frames: ScrubFrame[];
  /** Circuit de la séance affichée. OBLIGATOIRE — voir CircuitMap. */
  circuitName: string | null;
  showGs?: boolean;      // défaut false
  mapHeight?: number;    // défaut 280
}
```

**`circuitName` est obligatoire et c'est voulu** : `CircuitMap` refuse de
dessiner une trace hors d'un tracé connu (`gardeFouMultiCircuit` lève
`/hors du tracé connu/i`), pour ne pas publier une marge fabriquée. Sur
Bouteville, passez `'Bouteville'`.

**Attention à la volumétrie** : 26 999 trames pour la séance, ~9 000 par tour.
`src/render/decimate.ts` existe et est lui-même dormant — c'est probablement son
appelant. Le vérifier avant d'écrire une décimation neuve.

**Requête** : trier sur `elapsed_ms`, jamais `created_at` (R5).

---

### P3.3 · `DebriefMirror`

**Deux appelants : le Bilan et la notification J+1.**

Alimente le Débrief J+1, donc nécessaire de toute façon pour C-1.

**Avant d'écrire** : lire `src/components/DebriefMirror.tsx` et
`src/services/debriefRenderGuard.ts` — ce dernier est la ceinture doctrinale de
dernier mètre, dormant sous ce composant. Le Bilan tient déjà la sienne
(`isDoctrineSafe`) : **ne créez pas une troisième**. Décidez laquelle des deux
survit, et retirez l'autre.

**Feuille de récit** : la prose y est autorisée, sous le filtre des 52 termes.
C'est la seule surface de restitution dans ce cas.

---

### P3.4 · Le moteur d'insights sur la séance réelle

`compute-session-insights-v3` (fonction active, v11) **n'a jamais tourné sur la
séance de Bouteville**. `session_insights` ne contient qu'une ligne de
démonstration.

1. Lancer la fonction sur `ff384ace…`.
2. Vérifier que la ligne produite porte `engine_version` **`mirror-insights-v3`**
   — sinon `insightsMesures` la refusera, et ce sera juste.
3. Vérifier la forme de `ideal_lap` : le moteur de production écrit une forme
   **imbriquée** (`{theoretical_day, theoretical_record}`) que `chronosLisibles`
   ne lit pas, car elle attend `ideal_time_s` / `real_best_s` **à plat**. Le
   commentaire de `disponibilite.ts` le dit et refuse volontairement de choisir :
   *« quel potentiel montrer, celui du jour ou celui du record — revient au
   fondateur, pas à cette liste blanche. »* **Signalez, ne tranchez pas.**
4. Brancher `sessionInsightsEngine` (le moteur app-side) et le sortir de `CONNUS`.

**Attendu sur Bouteville** : `anatomy` non vide (douze virages, voir P2),
`data_quality.pct_valid` à 100, `ideal_lap` = meilleur tour réel 327,542 s avec
`gap_s` à 0 — le moteur app-side est honnête, il n'invente aucun gain.

---

### P3.5 · `RadarEmpreinte`

**Deux appelants : Signature et Studio.**

Il prend cinq axes, chacun `value: number | null`, et ne trace l'empreinte que si
les cinq sont renseignés (`complete`). **Les cinq axes gardent leur nom figé :
Cap, Visée, Plongée, Trajectoire, Anticipation.**

**Il sera incomplet au Mans.** Son état vide doit nommer son entrée manquante et
compter : `SIGNATURE · 1 / 3 SÉANCES`. Jamais un radar à cinq branches plates.

Bien traité, c'est la démonstration la plus courte de la doctrine devant un
professionnel : un outil qui refuse de conclure sur une séance. Mal traité, c'est
un écran cassé.

---

### P3.6 · La surface du moteur de composition

C'est la pièce qui fait exister les 65 fiches. Elle a **cinq obligations et rien
de plus** :

1. Appeler `composerPresentations` avec `surface`, `experience`, `souhait`,
   `disponibilite`, `travailActif`.
2. Rendre `presentations` **dans l'ordre donné** — ne jamais retrier.
3. Ouvrir d'elles-mêmes celles dont `parDefaut` est vrai ; les autres restent
   dans la liste, à un geste.
4. Afficher `motifs` et `ecartees` **en mots-clés** (lot P4).
5. Écrire dans `pilot_presentation_views` à l'ouverture, et dans
   `pilot_presentation_work` à l'ouverture et à la clôture d'une opportunité.

**Ce qu'elle ne fait pas : décider.** Aucun tri, aucun score, aucun rang. Le
moteur a tranché, et `ecartees` est ce qui rend le choix lisible.

**Résultat attendu sur la séance de Bouteville**, calculé à la main le 30/08
(9 séances · 5 journées · 3 circuits · aucun coach ⇒ plafond niveau 2, budget
5 cartes) :

> **27 fiches composables sur 65. 38 écartées.**
>
> Cartes du débrief, dans cet ordre exact :
> **P09** Réussite du run · **P16** Meilleur passage répétable ·
> **P50** Album des forces · **P10** Opportunité principale ·
> **P08** Verdict du run.
>
> Plus cinq fiches d'avant-run sur leur propre écran : P03 à P07.
>
> Dix-sept à un geste : P11 P13 P15 P17 P18 P19 P20 P21 P24 P25 P26 P27 P28
> P29 P30 P31 P49.
>
> Écartées : 16 pour surface coach ou Lab · 5 sans consigne du coach ·
> 4 sans coach rattaché · 4 sans acquis · 2 sans ressenti · 2 sans vidéo ·
> 2 par la règle d'une seule zone (P12, P14) · P01 sans intention ·
> P02 sans santé de chaîne · P38 sans repère de piste.

**Si votre sortie diffère de cette liste, l'une des deux lectures est fausse et
il faut trouver laquelle avant d'aller plus loin.** C'est la meilleure recette
dont dispose ce lot.

**Trois réussites avant l'opportunité, une seule opportunité** : la règle
« force d'abord » du §00 sort de `RANG_ROLE`, pas d'une mise en scène. Ne
l'aidez pas.

---

## Les deux défauts à corriger dans ce lot

**L'intention orpheline.** `session_intentions` porte une ligne écrite le 12/08
sur le circuit de Bouteville, dont le `session_id` est **nul**. P01 est donc
écartée pour absence d'intention, alors que le pilote a écrit la sienne.
Rattacher la ligne à la séance, ou décider que les intentions se rattachent au
circuit et adapter `donneesDisponibles`. **La première est plus simple et plus
juste** — mais c'est un choix, dites-le.

**Les commentaires périmés.** `sourcesCompositionService.ts` et
`modulesOrphelins.guard.test.ts` affirment que la migration du lot 10c n'est
« pas appliquée ». Elle l'est depuis le 29/08
(`20260829163749 lot10c_presentations_vues_travail_actif_repere_memoire`), et
`pilot_presentation_views` / `pilot_presentation_work` existent. Corriger les
deux commentaires : ce dépôt corrige partout ailleurs les descriptions que le
code a quittées, et la valeur de ses commentaires tient à cela.

---

## Ce que ce lot ne fait pas

- Il ne dérive pas le cap (P7, après Le Mans).
- Il ne touche pas aux seuils du QDI (décision fondateur).
- Il ne crée pas le compte écurie (après Le Mans).
- Il n'écrit aucun nouveau moteur. **S'il faut en écrire un, c'est que quelque
  chose n'a pas été cherché.**

---

## Recette du lot

```
npx tsc --noEmit
npm test
npx tsx scripts/check-doctrine.ts
```

Et, écran par écran, ouvert sur `ff384ace…` : ce qui s'affiche réellement,
écrit. Le calcul dit ce qui devrait apparaître ; seule l'ouverture dira si c'est
le cas.
