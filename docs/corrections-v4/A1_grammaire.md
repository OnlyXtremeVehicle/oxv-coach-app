# PROPOSITION — grammaire de restitution (banc d'essai du 14/08)

> Trois fichiers neufs, cinq remplacements exacts, zéro migration. Aucun écran
> ne change de code : `speedHeat` garde quatre pas et ses index `[0..3]`
> survivent — seules les valeurs deviennent une rampe qui se lit dans un seul
> sens. Le banc d'essai (`oxv-banc-essai-restitution.html`) montre l'avant /
> l'après sur le tour 2 de Bouteville.

---

## 1 · Fichiers neufs (livrés dans cette archive)

| fichier | rôle |
|---|---|
| `src/ui/v2/grammaireViz.ts` | Les quatre rôles de couleur + le type `Mesure<T>` (zéro mesuré ≠ non mesuré) |
| `src/ui/v2/__tests__/grammaireViz.test.ts` | 12 cas, purs, node |
| `src/__tests__/rampeMagnitude.guard.test.ts` | La garde qui **calcule** la monotonie — elle importe les rampes réelles, ne lit aucun texte |

La garde échoue tant que le remplacement 2a n'est pas appliqué : c'est voulu —
elle est la preuve que l'ancien `speedHeat` était fautif, puis le verrou qui
empêche son retour.

---

## 2 · Remplacements exacts

### 2a — `src/theme/v2.ts` : la rampe elle-même

```
CHERCHER :
// Rampe de chaleur VITESSE (froid → chaud) : bleu → cyan → vert → jaune. SANS or
// ni rouge — la vitesse n'est ni un chrono/record (or) ni une alarme (rouge).
// Source UNIQUE partagée par la carte (TrajectoryLayer), la heatmap (TrackStage)
// et leurs légendes, pour qu'elles ne divergent jamais.
export const speedHeat = ['#4F9DF7', '#3FD0D8', '#4FC98A', '#F2CE3B'] as const;

REMPLACER PAR :
// Rampe de chaleur VITESSE : UNE teinte (bleu instrument), sombre → clair,
// clair = rapide. SANS or ni rouge — la vitesse n'est ni un chrono/record (or)
// ni une alarme (rouge). L'ancienne rampe 4 teintes (bleu → cyan → vert →
// jaune) s'INVERSAIT au milieu : luminosités 0,688 → 0,786 → 0,751 → 0,858,
// le 3ᵉ pas plus sombre que le 2ᵉ — une zone à 85 km/h paraissait plus foncée
// qu'une zone à 70. La monotonie est désormais CALCULÉE par
// rampeMagnitude.guard.test.ts. Source UNIQUE partagée par la carte
// (TrajectoryLayer), la heatmap (TrackStage) et leurs légendes.
export const speedHeat = ['#1E5178', '#2C7CAE', '#4AA3D8', '#7FC4EE'] as const;
```

### 2b — `src/components/CircuitMap/layers/TrajectoryLayer.tsx` : l'en-tête

```
CHERCHER :
 * vitesse (rampe froid → chaud `theme.speedHeat` : bleu → cyan → vert → jaune).
 * SANS or (réservé au chrono) ni rouge (réservé alarme) : la vitesse est une
 * donnée, pas un verdict. Le plus chaud = jaune fluidité.

REMPLACER PAR :
 * vitesse (rampe `theme.speedHeat` : une teinte, sombre → clair, clair = rapide).
 * SANS or (réservé au chrono) ni rouge (réservé alarme) : la vitesse est une
 * donnée, pas un verdict.
```

### 2c — même fichier, le commentaire du calcul (l. 79-80)

```
CHERCHER :
        // Rampe froid → chaud partagée (theme.speedHeat) : bleu → cyan → vert →
        // jaune. Aucun or (chrono) ni rouge (alarme) sur une donnée de vitesse.

REMPLACER PAR :
        // Rampe partagée (theme.speedHeat) : une teinte, sombre → clair,
        // clair = rapide. Aucun or (chrono) ni rouge (alarme) sur une vitesse.
```

### 2d — `src/components/CircuitMap/TrackStage.tsx` (l. 235-236 et 250)

```
CHERCHER :
/** Carte de chaleur vitesse : rampe froid → chaud partagée (theme.speedHeat),
 *  bleu → cyan → vert → jaune. Aucun or (chrono) ni rouge (alarme). */

REMPLACER PAR :
/** Carte de chaleur vitesse : rampe partagée (theme.speedHeat), une teinte,
 *  sombre → clair, clair = rapide. Aucun or (chrono) ni rouge (alarme). */
```

```
CHERCHER :
        // Rampe vitesse froid → chaud (source unique speedHeat) : jamais d'or.

REMPLACER PAR :
        // Rampe vitesse sombre → clair (source unique speedHeat) : jamais d'or.
```

### 2e — `src/services/cardioZoneLogic.ts` : les trois arrêts

```
CHERCHER :
  if (zone === 'bas') return speedHeat[0]; // bleu — froid
  if (zone === 'median') return speedHeat[2]; // vert — intermédiaire
  return speedHeat[3]; // jaune — chaud

REMPLACER PAR :
  if (zone === 'bas') return speedHeat[0]; // pas sombre — intensité basse
  if (zone === 'median') return speedHeat[2]; // pas clair — intermédiaire
  return speedHeat[3]; // pas le plus clair — intensité haute
```

Le raisonnement du module tient mieux qu'avant : son en-tête refuse déjà la
lecture « alarme » et revendique une MAGNITUDE — c'est exactement ce qu'une
rampe monochrome dit, et que quatre teintes ne disaient pas. Son commentaire
d'en-tête (« bleu, vert, jaune ») est à toiletter au passage, même geste.

### 2f — `src/services/__tests__/cardioZoneLogic.test.ts` : les hex en dur

**Le remplacement 2a casse ce test, et c'est le seul.** Les lignes 131-133
codent les anciennes valeurs en littéral :

```
CHERCHER :
    expect(cardioZoneColor('bas')).toBe('#4F9DF7');
    expect(cardioZoneColor('median')).toBe('#4FC98A');
    expect(cardioZoneColor('haut')).toBe('#F2CE3B');

REMPLACER PAR :
    expect(cardioZoneColor('bas')).toBe('#1E5178');
    expect(cardioZoneColor('median')).toBe('#4AA3D8');
    expect(cardioZoneColor('haut')).toBe('#7FC4EE');
```

Le second bloc du même test (l. 137-139) compare par référence à
`speedHeat[i]` : lui survit sans modification, et c'est lui qui porte le vrai
invariant. Les trois littéraux ci-dessus ne re-testent que la valeur du jour —
ils valent d'être conservés uniquement comme témoins d'un changement
délibéré, ce que ce remplacement est.

---

## 3 · Ce que cette livraison ne fait pas, et pourquoi

- **Elle ne touche pas aux quatre radars ni aux quatre polyline→path.** Le
  dédoublonnage est un lot à part ; la grammaire d'abord, pour que la
  consolidation converge vers une règle et non vers une implémentation.
- **Elle ne migre pas AnatomieViz vers `Mesure<T>`.** Le correctif immédiat
  (`!= null` au lieu de `Number.isFinite`) tient en une ligne et peut partir
  avant ; la migration de type est le geste durable, à faire écran par écran.
- **Elle ne redéfinit pas les couleurs d'état.** `marginZoneColorLogic` les
  porte, avec l'invariant du rouge de marque déjà testé. Reproduire, ne pas
  réinventer.

## 4 · Vérification après application

`jest` : les 12 cas de `grammaireViz.test.ts` passent ; les assertions de
`rampeMagnitude.guard.test.ts` passent **après** 2a (et échouent avant — la loi
a été exécutée sur les deux rampes : l'ancienne rend `0,325 → 0,511 → 0,453 →
0,633`, non monotone au 3ᵉ pas ; la nouvelle `0,075 → 0,180 → 0,326 → 0,502`,
strictement croissante). Un seul autre test dépend des hex : le 2f le couvre.
J'avais d'abord écrit ici qu'aucun test ne les codait en dur — c'était faux,
et c'est la mesure qui l'a dit. Balayer les consommateurs d'une valeur qu'on
change inclut les tests.
