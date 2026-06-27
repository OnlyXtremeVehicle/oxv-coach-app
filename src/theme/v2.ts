// Charte OXV Mirror V2 / refonte (docs/refonte-app) — thème du kit UI (@/ui/*).
// Polices Geist / Geist Mono (chargées dans app/_layout.tsx via @/theme/fonts).
// Couleurs strictement codées : gold = quotidien/données, heritageGold = virage +
// offre Heritage, red = marque, green = tendance positive.
export const palette = {
  night: '#050505', // fond
  nightCard: '#121214',
  card: '#0B0B0D', // cartes
  card2: '#121214', // cartes secondaires / pills
  cream: '#F8F9FA', // texte
  creamSoft: '#E5E5E5',
  creamMute: '#9A9AA3', // texte secondaire
  faint: '#5A5A62', // texte tertiaire (eyebrows, méta discrète)
  legend: '#B4B4BC',
  line: '#1E1E22', // filets
  edge: 'rgba(255,255,255,0.20)',
  gold: '#FFB703', // quotidien + données
  copper: '#FFC93C', // traînées G-G UNIQUEMENT
  red: '#C8102E', // rouge de marque (insigne, bande coach)
  heritageGold: '#C4A459', // Heritage STRICT + registre référence (numéros de virage)
  green: '#4ADE80', // tendance positive
  coach: '#E5E5E5', // repère coach neutre (la bande coach utilise red)
} as const;

// Couleurs de donnée (piliers / vues). Toujours doublées d'un libellé.
export const dataColors = {
  trajectory: '#E63946',
  flow: '#FFB703',
  brake: '#60A5FA',
  accel: '#4ADE80',
  regularity: '#C084FC',
} as const;

// Familles de polices = noms exposés par @expo-google-fonts (Geist).
export const fonts = {
  display: 'Geist_600SemiBold', // titres
  displayReg: 'Geist_500Medium',
  body: 'Geist_400Regular',
  bodyLight: 'Geist_300Light',
  bodyMedium: 'Geist_500Medium',
  bodySemi: 'Geist_600SemiBold',
  mono: 'GeistMono_400Regular', // CHIFFRES = voix de l'instrument
  monoMedium: 'GeistMono_500Medium',
} as const;

export const fontSize = {
  eyebrow: 11,
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
export const radius = { sm: 10, md: 12, lg: 14, xl: 18, pill: 999 } as const;
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
