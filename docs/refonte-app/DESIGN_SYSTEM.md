# OXV Mirror — Design system du kit `src/ui`

> Référence du système de présentation après durcissement (phase 1).
> Périmètre : présentation seule. Aucune couleur sémantique modifiée, aucune
> API cassée, aucun call site touché. La doctrine prime sur toute considération
> esthétique : miroir et non coach, silence en piste, un seul chiffre dominant.

Source unique des valeurs : `src/theme/v2.ts`. Le kit ne réinvente jamais le
thème ; il consomme `theme.palette`, `theme.fonts`, `theme.fontSize`,
`theme.spacing`, `theme.radius`, `theme.motion`, `theme.easing`, `theme.hitSlop`.

---

## 1. Couleurs (codées, jamais décoratives)

Chaque couleur porte un sens. Une couleur de donnée est toujours doublée d'un
libellé ; le mono est réservé aux chiffres.

| Jeton          | Valeur      | Emploi exclusif                                    |
| -------------- | ----------- | -------------------------------------------------- |
| `gold`         | `#FFB703`   | Quotidien et données (actif, point de statut)      |
| `copper`       | `#FFC93C`   | Traînées G-G uniquement                            |
| `heritageGold` | `#C4A459`   | Heritage strict et numéros de virage signature     |
| `red`          | `#C8102E`   | Marque et marqueur d'acte (jamais « performance ») |
| `green`        | `#4ADE80`   | Tendance positive                                  |
| `dataColors.*` | (5 teintes) | Piliers et vues, toujours étiquetés                |

Surfaces et textes : `night` (fond), `card` / `card2` (cartes, pills),
`cream` / `creamSoft` / `creamMute` / `faint` (texte décroissant), `line` /
`edge` (filets). Le gris d'état désactivé du bouton (`#2A2A2E` fond, `#6A6A73`
libellé) est volontairement hors palette de données : c'est un gris neutre, il
n'emprunte aucune couleur sémantique.

---

## 2. Typographie

Deux familles. **Geist** pour le texte, **Geist Mono** pour les chiffres — la
voix de l'instrument. Le mono ne porte jamais un libellé.

| Rôle          | Famille (`fonts.*`)       |
| ------------- | ------------------------- |
| Titres        | `display` (Geist 600)     |
| Texte courant | `body` (Geist 400)        |
| Accent texte  | `bodyMedium` / `bodySemi` |
| Chiffres      | `mono` (GeistMono 400)    |

Échelle (`fontSize`) : `eyebrow`/`micro` 11 · `small` 12 · `body` 14 ·
`bodyLg` 15 · `h3` 17 · `h2` 21 · `value` 25 · `display` 28 · `hud` 62.
Le `hud` n'apparaît que sur le chiffre dominant d'un écran (jamais en piste).

---

## 3. Espacement et formes

Grille de 4 / 8. `spacing` : `xs` 4 · `sm` 8 · `md` 12 · `lg` 16 · `xl` 22 ·
`xxl` 28. `radius` : `sm` 10 · `md` 12 · `lg` 14 · `xl` 18 · `pill` 999.
Les primitives consomment ces jetons plutôt que des littéraux.

---

## 4. Mouvement

Réglages via `theme.motion` (`fast` 160 · `base` 240 · `slow` 420 ·
`reveal` 640) et `theme.easing` `[0.22, 1, 0.36, 1]` uniquement. Les retours
d'état sont sobres (atténuation d'opacité), sans ressort, sans rebond, sans
boucle. **Aucune animation pendant la conduite.**

Cibles tactiles : tout primitif interactif vise ≥ 44 px, par `minHeight` ou par
`hitSlop` (`theme.hitSlop` = 8 px sur chaque bord).

---

## 5. Matrice d'états par primitive (après durcissement)

Légende : ● couvert · ◐ partiel · — sans objet.

| Primitive (`src/ui`)       | default | pressed | disabled | loading | empty / error |
| -------------------------- | :-----: | :-----: | :------: | :-----: | :-----------: |
| `Button`                   |    ●    |    ●    |    ●     |    ●    |       —       |
| `Card` (conteneur)         |    ●    |    —    |    —     |    —    |       —       |
| `Card` (actionnable)       |    ●    |    ●    |    ●     |    —    |       —       |
| `Field`                    |    ●    |    —    |    ●     |    —    |       ●       |
| `Segmented`                |    ●    |    ●    |    ●     |    —    |       —       |
| `Chip` (affichage)         |    ●    |    —    |    —     |    —    |       —       |
| `SectionLabel` (affichage) |    ●    |    —    |    —     |    —    |       —       |
| `AppBar` (retour)          |    ●    |    ●    |    —     |    —    |       —       |
| `KpiCard` / `Fact` (aff.)  |    ●    |    —    |    —     |    —    |       —       |

États vides et erreur des conteneurs : `EmptyState`
(`src/components/instruments`) couvre l'attente honnête (message factuel +
champ de données attendu). `Field` couvre l'erreur en ligne. Aucun nouveau
primitif d'état n'a été créé : la couverture existante suffit.

---

## 6. Détail des états interactifs

### `Button`

- **default** : `primary` (fond `cream`, libellé noir) ou `ghost` (filet `edge`,
  fond `card2`).
- **pressed** : atténuation sobre (opacité 0.85), sans déplacement.
- **disabled** : surface atténuée, non cliquable, `accessibilityState.disabled`.
- **loading** (optionnel) : indicateur d'activité + libellé conservé, non
  cliquable, `accessibilityState.busy`. Le libellé reste lisible.
- Cible ≥ 44 px (`minHeight` 48). Variantes `primary` / `ghost` inchangées.

### `Card`

- **conteneur** : comportement d'origine, simple `View`.
- **actionnable** (si `onPress` fourni) : `Pressable`, rôle bouton, retour
  pressé sobre (opacité + filet `edge`), `disabled` atténue et neutralise,
  cible ≥ 44 px. L'absence d'`onPress` laisse la carte strictement inerte.

### `Field`

- **focus** : bordure or (or = actif). **error** : bordure et message rouges,
  masquent l'aide. **disabled** : `editable={false}`, texte atténué. Inchangé.

### `Segmented`

- **default / selected** : pastille compacte, segment actif surligné.
- **pressed** : atténuation brève. **disabled** (optionnel) : ensemble atténué
  et neutralisé. Chaque segment porte `accessibilityRole="tab"` et son état
  `selected`. Cible étendue par `hitSlop`.

---

## 7. Garde-fous doctrine

- Côté pilote : aucun verbe prescriptif. Les libellés décrivent, ils n'ordonnent
  pas. Le seul espace prescriptif reste la bande coach.
- Un seul chiffre dominant par écran ; les primitives de contenu restent
  qualitatives autour de lui.
- Vouvoiement, aucun emoji, aucune couleur sémantique détournée.
