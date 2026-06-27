/**
 * OXV Mirror — Design Tokens
 *
 * Référence unique pour tous les choix visuels de l'app.
 * Voir docs/screens/01_DESIGN_TOKENS.md pour la documentation complète.
 *
 * RÈGLES STRICTES :
 * - Or Heritage (#C4A459) : RÉSERVÉ aux écrans Heritage uniquement
 * - Bronze admin (#B87333) : RÉSERVÉ aux 3 vues admin uniquement
 * - Pas de gradient criard, pas d'emoji, vouvoiement systématique
 */

// ============================================================
// COULEURS
// ============================================================

export const colors = {
  background: {
    primary: '#050505',
    secondary: '#0A0A0A',
    elevated: '#101010',
  },

  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.55)',
    tertiary: 'rgba(255, 255, 255, 0.35)',
    disabled: 'rgba(255, 255, 255, 0.20)',
  },

  accent: {
    red: '#C8102E',
    gold: '#C4A459', // Heritage uniquement
    bronze: '#B87333', // Admin uniquement
    coach: '#1E3A5F', // Coach uniquement — bleu nuit, posture d'écoute
  },

  margin: {
    green: '#97C459',
    yellow: '#EF9F27',
    red: '#C8102E',
  },

  border: {
    subtle: 'rgba(255, 255, 255, 0.08)',
    medium: 'rgba(255, 255, 255, 0.15)',
    strong: 'rgba(255, 255, 255, 0.30)',
  },

  system: {
    success: '#97C459',
    warning: '#EF9F27',
    error: '#C8102E',
    info: 'rgba(255, 255, 255, 0.55)',
  },
} as const;

// ============================================================
// TYPOGRAPHIE
// ============================================================

export const fontWeight = {
  ultralight: '200',
  light: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

// Polices de la charte V2 (chargées dans app/_layout.tsx via @/theme/fonts).
// Noms = familles exposées par @expo-google-fonts.
export const fonts = {
  display: 'Geist_600SemiBold', // titres (charte refonte Geist)
  displayRegular: 'Geist_500Medium',
  body: 'Geist_400Regular',
  bodyLight: 'Geist_300Light',
  bodyMedium: 'Geist_500Medium',
  bodySemibold: 'Geist_600SemiBold',
  mono: 'GeistMono_400Regular', // chiffres = voix de l'instrument + labels
  monoMedium: 'GeistMono_500Medium',
} as const;

export const fontSize = {
  eyebrow: 10,
  caption: 12,
  body: 14,
  bodyLarge: 16,
  title: 18,
  titleLarge: 24,
  headline: 32,
  display: 48,
  hero: 80,
  heroLarge: 120,
} as const;

export const letterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  eyebrow: 2.5,
  monospace: 1.5,
} as const;

export const lineHeight = {
  tight: 1.1,
  normal: 1.4,
  relaxed: 1.6,
  loose: 1.8,
} as const;

// Combinaisons pré-définies pour usage rapide
export const typography = {
  eyebrow: {
    fontSize: fontSize.eyebrow,
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.eyebrow,
    textTransform: 'uppercase' as const,
    color: colors.text.secondary,
    fontFamily: fonts.mono,
  },

  screenTitle: {
    fontSize: fontSize.titleLarge,
    fontWeight: fontWeight.ultralight,
    letterSpacing: letterSpacing.normal,
    lineHeight: fontSize.titleLarge * lineHeight.tight,
    color: colors.text.primary,
  },

  heroNumber: {
    fontSize: fontSize.heroLarge,
    fontWeight: fontWeight.ultralight,
    letterSpacing: -2,
    lineHeight: fontSize.heroLarge,
    color: colors.text.primary,
    fontFamily: fonts.mono,
  },

  manifest: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.light,
    fontStyle: 'italic' as const,
    lineHeight: fontSize.title * lineHeight.relaxed,
    color: 'rgba(255, 255, 255, 0.85)',
    fontFamily: fonts.bodyLight,
  },

  body: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.light,
    lineHeight: fontSize.body * lineHeight.normal,
    color: colors.text.primary,
    fontFamily: fonts.body,
  },

  caption: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
    color: colors.text.secondary,
    fontFamily: fonts.body,
  },
} as const;

// ============================================================
// ESPACEMENTS
// ============================================================

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
} as const;

// ============================================================
// BORDURES ET RAYONS
// ============================================================

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  pill: 999,
} as const;

export const borderWidth = {
  none: 0,
  hairline: 0.5,
  thin: 1,
  medium: 2,
  thick: 3,
} as const;

// ============================================================
// OMBRES
// ============================================================

export const shadows = {
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
} as const;

// ============================================================
// OPACITÉS
// ============================================================

export const opacity = {
  invisible: 0,
  ghost: 0.05,
  faint: 0.2,
  subtle: 0.35,
  medium: 0.55,
  strong: 0.85,
  opaque: 1.0,
} as const;

// ============================================================
// ANIMATIONS
// ============================================================

export const animation = {
  duration: {
    instant: 0,
    fast: 150,
    normal: 250,
    slow: 400,
    deliberate: 600,
  },

  easing: {
    standard: 'ease-out' as const,
    accelerate: 'ease-in' as const,
    decelerate: 'ease-out' as const,
  },
} as const;

// ============================================================
// ICÔNES
// ============================================================

export const iconSize = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ============================================================
// LAYOUT
// ============================================================

export const layout = {
  screenPadding: {
    horizontal: spacing.xl,
    top: spacing.xxl,
    bottom: spacing.huge,
  },

  maxWidth: {
    content: 600,
    text: 480,
  },
} as const;

// ============================================================
// EXPORT
// ============================================================

export const tokens = {
  colors,
  fontWeight,
  fonts,
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
} as const;

export type Theme = typeof tokens;

// Hook pour accéder au theme (à enrichir si besoin)
export function useTheme(): Theme {
  return tokens;
}

export default tokens;
