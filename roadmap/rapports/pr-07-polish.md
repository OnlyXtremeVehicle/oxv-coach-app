# Rapport — PR 7 · Polish canon

> Réaligner `src/theme/v2.ts` sur `docs/refonte-app/04_DESIGN_CANON` (loi), ajouter
> Instrument Serif, traiter le flou de la barre. Recon scouté en amont (tokens / font /
> blur) puis appliqué sur findings vérifiés.

## Ce que j'ai fait

### 1. `src/theme/v2.ts` — réalignement palette (canon §1, ligne 20)
- **Corrections de valeur** : `line` `#1E1E22`→**`#1C1C20`** · `faint` `#5A5A62`→**`#54545C`** ·
  `green` `#4ADE80`→**`#97C459`** (tendance positive / connecté) · `coach` `#E5E5E5`→**`#E6E6E8`** (citation).
- **Tokens ajoutés** (absents, le code réutilisait `faint`/`line`) : `eyebrow` **`#6E6E76`** ·
  `secondary` **`#C9C9CE`** (2ᵉ niveau de texte distinct de `creamMute` muted) ·
  `cardBorderProminent` **`#232326`** (carte hero) · `separator` **`#161618`** (ligne de liste).
- **Supprimé** : `copper` `#FFC93C` — **mort** (zéro référence) **et hors-canon** (§7 interdit les couleurs hors liste). Si des traînées G-G arrivent un jour, la couleur canon est `gold` (= donnée).

### 2. Instrument Serif (canon §2)
- Dep `@expo-google-fonts/instrument-serif` installée ; `src/theme/fonts.ts` charge
  `InstrumentSerif_400Regular` + `_Italic` (même chaîne que Geist, splash gate déjà couvrant — aucun changement de `_layout.tsx`).
- Exposé dans `v2.ts > fonts` : `serif` + `serifItalic` ; `fontSize.serifTitle = 44` (titre hero, line-height 1).
- **Infrastructure seulement** : `fonts.display` (Geist) est utilisé dans **93 fichiers** ; repointer vers le serif basculerait *tous* les titres de l'app d'un coup, à l'aveugle. L'application **délibérée** du serif (titres hero, mot qualitatif du bilan en italique, citation coach, dates hero) se fait écran par écran, **validée au build**.

### 3. Barre d'onglets — `src/components/AppTabBar.tsx`
- Fond `rgba(5,5,5,0.92)`→**`rgba(5,5,5,0.9)`** (canon §4) + commentaires corrigés.
- **Flou reporté** (et pourquoi) : le `BlurView` n'a d'effet que si la barre **chevauche** du contenu scrollable (barre en `position: absolute`). L'archi actuelle pose la barre dans la **colonne flex** du `_layout` → inset automatique parfait, zéro calcul, zéro risque que le bas d'un écran passe sous la barre. Passer en overlay pour le flou réintroduit l'inset manuel sur chaque écran non-`Screen` / `scroll={false}` (cartes, live) — **invérifiable sans device**, et purement esthétique. Plan d'intégration consigné dans le code pour le prochain build.

## Doctrine
- Aucun or sur la nav (inchangé). `or = donnée` renforcé (retrait de `copper`). Palette stricte = celle du canon §1. Pas d'emoji, vouvoiement intacts.

## Non fait (volontairement, build requis)
- Surface carte `#0B0B0D` → `rgba(255,255,255,0.025)` (canon §4) : change *toutes* les cartes (translucide vs opaque) — à valider sur device.
- Application du serif aux titres hero (sweep visuel) · flou de la barre (refonte overlay + inset).

## Testé (statique)
- `tsc` 0 · `eslint` 0 · `jest` 797/797.
