# Tester un écran

*Posé le 13/08/2026, après un plantage que 3 078 tests verts n'avaient pas vu.*

---

## Ce qui manquait

`jest.config.js` portait cette ligne, et elle était invisible :

```js
testMatch: ['**/__tests__/**/*.test.ts']
```

Micromatch exige que le chemin **finisse** par `.test.ts`. Un fichier `.test.tsx`
ne finit pas par `.test.ts` : il n'était pas ignoré, il n'était pas **cherché**.
148 fichiers `.tsx` dans `app/`, zéro test de composant — et jest n'annonce
jamais les fichiers qu'il n'a pas cherchés.

Le commentaire du fichier affirmait que les composants étaient « testés
manuellement en build dev ». La nuit du 13/08, l'application est morte à
l'ouverture de l'écran Data, dans un build qui avait passé toutes les portes.

---

## Comment on écrit un test d'écran

**Emplacement** : `src/__tests__/ecrans/*.test.tsx`. **Jamais sous `app/`** — le
`require.context` d'expo-router y capture tout `.tsx`, et un fichier de test
deviendrait une route dans le bundle de production.

```tsx
import { render, screen } from '@testing-library/react-native';
import { ChronoHero } from '@/ui/v2/ChronoHero';

it('un chrono non mesuré affiche un tiret, pas un zéro', () => {
  render(<ChronoHero chronoMs={Number.NaN} size="l" />);
  expect(screen.getByText('—')).toBeTruthy();
});
```

Lancer un seul monde :

```bash
npx jest --selectProjects "écrans"
```

---

## Ce que ce harnais attrape

- un composant qui **lève** au montage, en boucle ou au démontage ;
- une valeur absente qui **arrive à l'écran en zéro** au lieu d'un tiret ;
- une donnée réelle qui **n'atteint pas** l'écran alors que la logique la
  produit — la garde posée-non-armée, appliquée à l'interface.

C'est cette dernière classe qui justifie le harnais. La logique pure est déjà
testée ; ce qu'aucun test node ne voit, c'est le trajet entre la fonction juste
et le pixel.

---

## Ce qu'il n'attrape PAS — vérifié, pas supposé

**Il n'y a pas de fil UI, et aucun harnais de test n'en a.**

J'ai rétabli l'état d'avant le correctif du 13/08 — `useFirstViewport` armé
inconditionnellement dans `SectionBande`, la condition exacte qui tuait
l'application — et **les sept tests sont restés verts**.

Conséquences à connaître avant d'écrire une assertion :

| Mécanisme | Sous test |
|---|---|
| `useFrameCallback` | n'appelle **jamais** son callback |
| `measure()` | rend `null` |
| `withTiming(v)` | rend `v`, instantanément |
| Tout ce qui dépend de `useFirstViewport` | reste **invisible** |

Un test qui affirmerait « la bande s'affiche » échouerait — non parce que le
code est faux, mais parce que ce faux ne peut pas le montrer. **N'assouplissez
pas l'assertion** : testez le composant interne directement.

Ce qui protège réellement du plantage du 13/08 est ailleurs, et s'exécute :
`refMesurable.test.ts` appelle la décision avec les valeurs que Reanimated rend
vraiment (`null`, `-1`, `NaN`), et `firstViewportRefAttache.guard.test.ts` fige
la condition d'armement.

**Et un test d'écran ne prouve rien sur les types** : il passe par babel.
`tsc --noEmit` reste la seule garde de types sur les 148 `.tsx`.

---

## Le piège du faux vert

Un faux de trop coûte aussi cher qu'un faux manquant.

Sans le `jestSetup` de FlashList, une liste se rend **sans erreur et sans aucun
item** — les mesures natives valent zéro. Un test « la liste montre trois
séances » passerait au vert en n'affichant rien. C'est la forme la plus
dangereuse du défaut que ce harnais existe pour attraper : **un test qui
confirme une absence.**

`jest/setupAfterEnv.ecrans.js` nomme la raison de chaque faux, et dit lesquels
sont volontairement absents (`react-native-mmkv` livre le sien, `react-native-svg`
se rend en composants hôtes interrogeables).

---

## Prouver qu'un test a des dents

Cassez le code, et regardez le test hurler. C'est la règle du dépôt, et elle
s'applique ici plus qu'ailleurs : un test de rendu qui passe peut ne rien
vérifier du tout.

Exemple, mené sur `chronoAbsent.test.tsx` : remplacer `return '—'` par
`return '0:00,000'` dans `msToLapLabel` fait échouer **2 tests sur 7**. Le test
tient.
