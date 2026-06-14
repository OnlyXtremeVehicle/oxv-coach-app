# Charte graphique OXV Mirror — Design Tokens

> Référence unique et complète pour tous les choix visuels de l'app.
> Claude Code doit implémenter ces tokens dans un fichier `src/theme/tokens.ts` et s'y référer partout.

---

## Philosophie visuelle

OXV Mirror s'inspire de **trois univers** :

- **Ferrari** pour la sobriété sèche et l'absence de superflu
- **Apple** pour la qualité d'exécution et le mode sombre maîtrisé
- **Magazines de luxe** pour la typographie et la mise en page

Le résultat doit ressembler à du **cinéma silencieux** : nuit profonde, accents cuivre/rouge, crème de phare, silences typographiques.

---

## 1. Couleurs

### 1.1 — Palette principale

```typescript
export const colors = {
  // Fonds
  background: {
    primary: '#050505',      // Noir profond, fond par défaut
    secondary: '#0A0A0A',    // Légèrement plus clair pour cards/sections
    elevated: '#101010',     // Éléments élevés (modales, sheets)
  },
  
  // Textes
  text: {
    primary: '#FFFFFF',                    // Blanc pur, titres et chiffres
    secondary: 'rgba(255, 255, 255, 0.55)', // Texte secondaire
    tertiary: 'rgba(255, 255, 255, 0.35)',  // Texte de support
    disabled: 'rgba(255, 255, 255, 0.20)',  // Texte désactivé
  },
  
  // Accents OXV
  accent: {
    red: '#C8102E',          // Rouge OXV — accent principal, alertes
    gold: '#C4A459',         // Or Heritage — RÉSERVÉ Heritage uniquement
    bronze: '#B87333',       // Bronze admin — RÉSERVÉ vues admin uniquement
  },
  
  // Indicateurs de marge (sémantiques)
  margin: {
    green: '#97C459',        // Marge confortable (>30%)
    yellow: '#EF9F27',       // Marge à explorer (15-30%)
    red: '#C8102E',          // Terrain serré (<15%)
  },
  
  // Bordures et séparateurs
  border: {
    subtle: 'rgba(255, 255, 255, 0.08)',   // Bordures discrètes
    medium: 'rgba(255, 255, 255, 0.15)',   // Bordures visibles
    strong: 'rgba(255, 255, 255, 0.30)',   // Bordures marquées
  },
  
  // États système
  system: {
    success: '#97C459',      // Confirmation, succès
    warning: '#EF9F27',      // Alertes non bloquantes
    error: '#C8102E',        // Erreurs critiques
    info: 'rgba(255, 255, 255, 0.55)',  // Information neutre
  },
} as const
```

### 1.2 — Règles strictes d'usage

**RÈGLE 1 — Or Heritage** (`#C4A459`)
- À utiliser EXCLUSIVEMENT sur les écrans Heritage (pack 4 sessions à 3500€)
- INTERDIT sur Access, Signature, Promotion
- Symbolise le "club privilégié"

**RÈGLE 2 — Bronze admin** (`#B87333`)
- À utiliser EXCLUSIVEMENT sur les 3 vues admin OXV
- INTERDIT sur les écrans pilote
- Distingue visuellement le mode admin

**RÈGLE 3 — Rouge OXV** (`#C8102E`)
- Accent principal pour boutons primaires
- Couleur des alertes et zones "Terrain serré"
- Couleur de l'insigne OXV

**RÈGLE 4 — Sans variation de marque**
- Pas de "rouge clair", "rouge foncé", etc.
- Le rouge OXV est `#C8102E`, point.
- Pour les états (hover, pressed), utiliser l'opacité plutôt que des variantes

---

## 2. Typographie

### 2.1 — Familles de police

```typescript
export const fontFamily = {
  // System UI — par défaut sur iOS (SF Pro) et Android (Roboto)
  // Pas besoin de charger de fonts custom pour la V1
  system: undefined,  // React Native default
  
  // Monospace — pour eyebrows, labels techniques, codes
  mono: 'Menlo',     // iOS : Menlo, Android : monospace
  
  // Italic — pour les citations, signatures, manifestes
  italic: undefined,  // System italic
} as const
```

### 2.2 — Poids (font-weight)

```typescript
export const fontWeight = {
  ultralight: '200',  // Chiffres centraux (le 24% du bilan)
  light: '300',       // Corps de texte principal
  regular: '400',     // Corps de texte courant
  medium: '500',      // Labels en majuscules
  semibold: '600',    // Rarement utilisé (états actifs uniquement)
  bold: '700',        // Quasi jamais (pas la grammaire OXV)
} as const
```

### 2.3 — Tailles (font-size)

```typescript
export const fontSize = {
  // Eyebrows et labels
  eyebrow: 10,        // "BILAN DE SESSION"
  caption: 12,        // Légendes, métadonnées
  
  // Corps de texte
  body: 14,           // Texte standard
  bodyLarge: 16,      // Texte d'introduction
  
  // Titres
  title: 18,          // Titres de section
  titleLarge: 24,     // Titres d'écran
  
  // Chiffres et impact
  headline: 32,       // Titres forts
  display: 48,        // Phrases manifestes
  hero: 80,           // Chiffre central bilan
  heroLarge: 120,     // Chiffre central très grand
} as const
```

### 2.4 — Letter-spacing

```typescript
export const letterSpacing = {
  tight: -0.5,        // Chiffres très grands (hero)
  normal: 0,          // Texte courant
  wide: 0.5,          // Texte d'emphase
  eyebrow: 2.5,       // Eyebrows en majuscules (équivalent 0.18-0.28em)
  monospace: 1.5,     // Codes et labels mono
} as const
```

### 2.5 — Hauteur de ligne (line-height)

```typescript
export const lineHeight = {
  tight: 1.1,         // Chiffres et titres
  normal: 1.4,        // Corps de texte
  relaxed: 1.6,       // Paragraphes longs
  loose: 1.8,         // Manifestes
} as const
```

### 2.6 — Combinaisons typographiques recommandées

```typescript
export const typography = {
  // Eyebrow (au-dessus des titres)
  eyebrow: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.55)',
    fontFamily: 'Menlo',
  },
  
  // Titre d'écran
  screenTitle: {
    fontSize: 24,
    fontWeight: '200',
    letterSpacing: 0,
    lineHeight: 1.2,
    color: '#FFFFFF',
  },
  
  // Chiffre central (bilan)
  heroNumber: {
    fontSize: 120,
    fontWeight: '200',
    letterSpacing: -2,
    lineHeight: 1,
    color: '#FFFFFF',  // Peut être overridé selon zone
  },
  
  // Phrase manifeste
  manifest: {
    fontSize: 18,
    fontWeight: '300',
    fontStyle: 'italic',
    lineHeight: 1.6,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  
  // Corps de texte
  body: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 1.5,
    color: '#FFFFFF',
  },
  
  // Caption (métadonnée)
  caption: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.55)',
  },
} as const
```

---

## 3. Espacements

```typescript
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
  giant: 96,
} as const
```

### Règles d'espacement

- **Padding interne d'écran** : 24px horizontal, variable vertical
- **Espacement entre sections** : 32px ou 48px
- **Espacement entre éléments d'une liste** : 12px ou 16px
- **Padding des cards** : 16px ou 24px selon densité
- **Marges entre paragraphes** : 16px

---

## 4. Bordures et rayons

```typescript
export const borderRadius = {
  none: 0,
  sm: 4,              // Boutons compacts
  md: 8,              // Inputs, badges
  lg: 12,             // Cards standards
  xl: 16,             // Cards élevées
  xxl: 24,            // Modales, sheets
  pill: 999,          // Boutons pill, badges arrondis
} as const

export const borderWidth = {
  none: 0,
  hairline: 0.5,      // Bordures très fines (iOS hairline)
  thin: 1,            // Bordures standards
  medium: 2,          // Bordures emphasis
  thick: 3,           // Bordures fortes (états actifs)
} as const
```

---

## 5. Ombres et élévation

```typescript
export const shadows = {
  // Pas d'ombres flashy. OXV est minimaliste.
  
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  
  subtle: {
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  
  medium: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  
  strong: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const
```

**Doctrine OXV** : utiliser les ombres avec parcimonie. Préférer les bordures subtiles pour distinguer les éléments.

---

## 6. Opacités

```typescript
export const opacity = {
  invisible: 0,
  ghost: 0.05,         // Pour les hover discrets
  faint: 0.20,         // Texte désactivé
  subtle: 0.35,        // Texte tertiaire
  medium: 0.55,        // Texte secondaire
  strong: 0.85,        // Texte presque opaque
  opaque: 1.0,
} as const
```

---

## 7. Animations

```typescript
export const animation = {
  // Durées (en millisecondes)
  duration: {
    instant: 0,
    fast: 150,           // Hover, état pressé
    normal: 250,         // Transitions standard
    slow: 400,           // Transitions d'écran
    deliberate: 600,     // Apparitions importantes (chiffre du bilan)
  },
  
  // Easing
  easing: {
    standard: 'ease-out',
    accelerate: 'ease-in',
    decelerate: 'ease-out',
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
  },
} as const
```

### Règles d'animation OXV

1. **Pas d'animations criardes** (rebonds, élastiques exagérés)
2. **Privilégier les fade** in/out (250ms) pour la sobriété
3. **Animer les chiffres** au montage du bilan (incrément progressif)
4. **Pas d'animation continue** (boucles infinies)

---

## 8. Iconographie

### 8.1 — Source des icônes

- **Bibliothèque** : `lucide-react-native` (cohérent avec le web)
- **Style** : ligne fine, pas de remplissage par défaut
- **Taille** : 16, 20, 24, 32 px selon contexte

### 8.2 — Tailles standard

```typescript
export const iconSize = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const
```

### 8.3 — Couleur d'icône

Par défaut, suit la couleur de texte parent (`currentColor`). Pour les accents :
- Boutons primaires : icône en blanc
- Boutons secondaires : icône en `text.secondary`
- États actifs : icône en `accent.red`

---

## 9. Composants standards

### 9.1 — Bouton primaire

```typescript
export const PrimaryButton = {
  height: 52,
  borderRadius: borderRadius.lg,
  paddingHorizontal: spacing.xl,
  backgroundColor: colors.accent.red,
  textColor: colors.text.primary,
  fontSize: fontSize.body,
  fontWeight: fontWeight.medium,
  letterSpacing: 0.5,
}
```

### 9.2 — Bouton secondaire

```typescript
export const SecondaryButton = {
  height: 52,
  borderRadius: borderRadius.lg,
  paddingHorizontal: spacing.xl,
  backgroundColor: 'transparent',
  borderWidth: 1,
  borderColor: colors.border.medium,
  textColor: colors.text.primary,
  fontSize: fontSize.body,
  fontWeight: fontWeight.regular,
}
```

### 9.3 — Card

```typescript
export const Card = {
  backgroundColor: colors.background.secondary,
  borderRadius: borderRadius.lg,
  padding: spacing.lg,
  borderWidth: 0.5,
  borderColor: colors.border.subtle,
}
```

### 9.4 — Input

```typescript
export const Input = {
  height: 52,
  borderRadius: borderRadius.md,
  paddingHorizontal: spacing.lg,
  backgroundColor: colors.background.secondary,
  borderWidth: 1,
  borderColor: colors.border.subtle,
  textColor: colors.text.primary,
  fontSize: fontSize.body,
  placeholderColor: colors.text.tertiary,
  focusBorderColor: colors.accent.red,
}
```

---

## 10. Layout

### 10.1 — Grilles d'écran

```typescript
export const layout = {
  screenPadding: {
    horizontal: spacing.xl,    // 24px
    top: spacing.xxl,           // 32px
    bottom: spacing.huge,       // 64px (safe area iPhone)
  },
  
  maxWidth: {
    content: 600,               // Largeur max sur tablette
    text: 480,                  // Largeur max pour le texte lisible
  },
  
  safeArea: {
    // Géré automatiquement par react-native-safe-area-context
  },
} as const
```

---

## 11. Implémentation TypeScript

À créer dans `src/theme/tokens.ts` :

```typescript
// Export tous les tokens définis ci-dessus
export const tokens = {
  colors,
  fontFamily,
  fontWeight,
  fontSize,
  letterSpacing,
  lineHeight,
  typography,
  spacing,
  borderRadius,
  borderWidth,
  shadows,
  opacity,
  animation,
  iconSize,
  layout,
} as const

// Type helper
export type Theme = typeof tokens

// Hook pour accéder au theme
export function useTheme() {
  return tokens
}
```

---

## 12. Règles transversales

### 12.1 — Mode sombre exclusif

L'app est en mode sombre uniquement. Aucune option de mode clair en V1.

Raisons :
- Cohérent avec l'univers OXV (cinéma silencieux)
- Meilleur pour les longues lectures de données
- Ferrari et apps premium font ce choix

### 12.2 — Pas d'emojis

Sauf si l'utilisateur en utilise lui-même en premier. Aucun emoji dans les textes natifs OXV.

### 12.3 — Vouvoiement systématique

Tous les textes UI sont au vouvoiement. Pas d'exception.

### 12.4 — Pas de gradients criards

Si gradient nécessaire (rarement), utiliser des dégradés très subtils (max 15% de variation entre les deux couleurs).

### 12.5 — Pas de couleur seule pour porter une information

Toute information critique (zone verte/jaune/rouge) doit être doublée par un texte ou une icône. Accessibilité essentielle.

---

## 13. Validation visuelle

À chaque nouvel écran codé, vérifier :

- [ ] Fond `#050505` partout sauf exception justifiée
- [ ] Aucun emoji dans le contenu
- [ ] Vouvoiement respecté
- [ ] Tokens utilisés (pas de couleurs hardcodées hors tokens)
- [ ] Contraste minimum 4.5:1 pour le texte
- [ ] Tailles tactiles 44pt minimum sur les zones cliquables
- [ ] Bouton primaire en `accent.red` quand action principale
- [ ] Pas plus d'un seul chiffre central par écran
- [ ] Manifeste italique aux moments-clés

---

## 14. Exemples concrets

### Écran #13 — Bilan

```typescript
<View style={{ backgroundColor: colors.background.primary, padding: spacing.xl }}>
  
  {/* Eyebrow */}
  <Text style={typography.eyebrow}>BILAN DE SESSION</Text>
  
  {/* Chiffre central */}
  <Text style={[
    typography.heroNumber,
    { color: colors.margin.yellow, marginTop: spacing.xxl }
  ]}>
    24%
  </Text>
  
  {/* Étiquette humaine */}
  <Text style={[typography.screenTitle, { color: colors.margin.yellow }]}>
    À explorer
  </Text>
  
  {/* Manifeste */}
  <Text style={[typography.manifest, { marginTop: spacing.xl }]}>
    Belle séance. Vous avez du terrain à explorer en sécurité.
  </Text>
  
  {/* CTA */}
  <PrimaryButton onPress={...}>Explorer les détails</PrimaryButton>
  
</View>
```

---

*Charte graphique OXV Mirror — Design Tokens — Mai 2026*

*Tokens à implémenter dans `src/theme/tokens.ts` et à utiliser partout dans l'app.*
*Toute exception à ces tokens doit être justifiée dans le rapport hebdomadaire de Claude Code.*
