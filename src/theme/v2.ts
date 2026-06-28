// Charte OXV Mirror V2 / refonte (docs/refonte-app) — thème du kit UI (@/ui/*).
// Polices Geist / Geist Mono (chargées dans app/_layout.tsx via @/theme/fonts).
// Couleurs strictement codées : gold = quotidien/données, heritageGold = virage +
// offre Heritage, red = marque, green = tendance positive.
// Aligné sur `docs/refonte-app/04_DESIGN_CANON §1` (PR 7). Valeurs exactes.
export const palette = {
  night: '#050505', // fond base
  nightCard: '#121214',
  card: '#0B0B0D', // cartes (canon vise rgba(255,255,255,0.025) — surface translucide, migrée au build)
  card2: '#121214', // cartes secondaires / pills
  cream: '#F8F9FA', // texte primaire
  creamSoft: '#E5E5E5',
  secondary: '#C9C9CE', // texte secondaire (canon)
  creamMute: '#9A9AA3', // texte muted
  eyebrow: '#6E6E76', // eyebrows / sur-titres (canon — distinct de faint)
  faint: '#54545C', // texte tertiaire / inactif
  legend: '#B4B4BC',
  line: '#1C1C20', // filets / bordure ligne
  cardBorderProminent: '#232326', // bordure carte hero
  separator: '#161618', // séparateur interne / ligne de liste
  edge: 'rgba(255,255,255,0.20)',
  gold: '#FFB703', // DONNÉE uniquement (jauge, chiffre, points, barres)
  red: '#C8102E', // rouge coach / REC (insigne, bande coach)
  heritageGold: '#C4A459', // Heritage STRICT + registre référence (numéros de virage)
  green: '#97C459', // tendance positive / état connecté
  coach: '#E6E6E8', // citation coach (bande coach utilise red)
} as const;

// Couleurs de donnée (piliers / vues). Toujours doublées d'un libellé.
export const dataColors = {
  trajectory: '#E63946',
  flow: '#FFB703',
  brake: '#60A5FA',
  accel: '#4ADE80',
  regularity: '#C084FC',
} as const;

// Familles de polices = noms exposés par @expo-google-fonts (Geist + Instrument Serif).
export const fonts = {
  display: 'Geist_600SemiBold', // titres (sans)
  displayReg: 'Geist_500Medium',
  body: 'Geist_400Regular',
  bodyLight: 'Geist_300Light',
  bodyMedium: 'Geist_500Medium',
  bodySemi: 'Geist_600SemiBold',
  mono: 'GeistMono_400Regular', // CHIFFRES = voix de l'instrument
  monoMedium: 'GeistMono_500Medium',
  serif: 'InstrumentSerif_400Regular', // touches éditoriales (titres hero, dates) — JAMAIS un chiffre
  serifItalic: 'InstrumentSerif_400Regular_Italic', // mot qualitatif du bilan, citation coach
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
  serifTitle: 44, // grand titre hero serif (line-height 1) — canon §2
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
