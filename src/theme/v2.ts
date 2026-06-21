// Charte OXV Mirror V2 — thème du système de design porté depuis oxv-mirror-app.
// Source unique des tokens V2 pour le kit UI (@/ui/*). Les écrans peuvent aussi
// l'utiliser directement. Les polices = noms exposés par @expo-google-fonts
// (chargées dans app/_layout.tsx via @/theme/fonts).
export const palette = {
  night: '#050505', // Noir Abysse (fond)
  nightCard: '#121214',
  card: 'rgba(20,20,24,0.80)',
  card2: '#0B0B0D',
  cream: '#F8F9FA',
  creamSoft: '#E5E5E5',
  creamMute: '#9A9AA3',
  legend: '#B4B4BC',
  line: 'rgba(255,255,255,0.10)',
  edge: 'rgba(255,255,255,0.20)',
  gold: '#FFB703', // or quotidien + donnée fluidité
  copper: '#FFC93C', // traînées G-G UNIQUEMENT
  red: '#C8102E', // rouge de marque (insigne)
  heritageGold: '#C4A459', // Heritage STRICT + registre référence (numéros de virage)
  coach: '#E5E5E5', // repère coach (accent neutre, jamais une couleur de donnée)
} as const;

// Couleurs de donnée (piliers / vues). Toujours doublées d'un libellé.
export const dataColors = {
  trajectory: '#E63946',
  flow: '#FFB703',
  brake: '#60A5FA',
  accel: '#4ADE80',
  regularity: '#C084FC',
} as const;

// Familles de polices = noms exposés par @expo-google-fonts.
export const fonts = {
  display: 'Syncopate_700Bold', // titres
  displayReg: 'Syncopate_400Regular',
  body: 'Inter_400Regular',
  bodyLight: 'Inter_300Light',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  mono: 'JetBrainsMono_400Regular', // CHIFFRES = voix de l'instrument
  monoMedium: 'JetBrainsMono_500Medium',
} as const;

export const fontSize = {
  eyebrow: 9,
  micro: 11,
  small: 12,
  body: 14,
  bodyLg: 15,
  h3: 17,
  h2: 21,
  value: 25,
  display: 28,
  hud: 62,
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 28 } as const;
export const radius = { sm: 10, md: 12, lg: 14, xl: 16, pill: 999 } as const;
export const motion = { fast: 160, base: 240, slow: 420, reveal: 640 } as const;
export const easing = [0.22, 1, 0.36, 1] as const;
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;

export const theme = {
  palette,
  dataColors,
  fonts,
  fontSize,
  spacing,
  radius,
  motion,
  easing,
  hitSlop,
};
export type ThemeV2 = typeof theme;
