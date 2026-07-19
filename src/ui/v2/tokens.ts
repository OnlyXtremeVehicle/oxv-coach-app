/**
 * Tokens V2 — DA Instrument (programme V2, 18/07/2026).
 *
 * Périmètre : arbre `app/(app2)` et kit `src/ui/v2/` UNIQUEMENT. Les espaces
 * v1 (pilote actuel, coach, admin, partner, pro) restent sur `src/theme/v2.ts`
 * jusqu'à la bascule V2-L6.
 *
 * Règles d'usage (non négociables, héritées du prompt L0) :
 * - UN accent rouge par zone d'écran, pas plus.
 * - `heritage.gold` = tier Heritage EXCLUSIVEMENT (jamais un chrome générique).
 * - Couleurs QDI = données uniquement, jamais des fonds ni du chrome.
 * - Cadran (Dial) : un seul par écran, jamais décoratif ; aiguille = valeur
 *   instantanée, arc = cumul ; zéro texture métal.
 * - `accentGlow` / `heritage.glow` = UNIQUEMENT ombres portées Skia de traits
 *   (tracé, aiguille), jamais des fonds.
 * - `bg.scrim` = uniquement sur photo, pour la lisibilité du texte superposé
 *   (patron Airbnb) — seule exception autorisée à la règle anti-dégradé.
 */

export const colors = {
  bg: { base: '#14151A', card: '#1B1D24', card2: '#232630', scrim: 'rgba(10,11,14,0.72)' },
  border: { card: '#2A2D38', strong: '#3A3E4C', hairline: '#22242C' },
  accent: '#C8102E',
  accentGlow: 'rgba(200,16,46,0.35)',
  text: { hi: '#E8E9ED', mid: '#A9ADBB', low: '#7A7E8C', dim: '#5A5E6C' },
  heritage: { gold: '#C4A459', text: '#E8DCB8', glow: 'rgba(196,164,89,0.30)' },
  qdi: {
    trajectoire: '#60A5FA',
    fluidite: '#FFB703',
    freinage: '#E63946',
    acceleration: '#4ADE80',
    regularite: '#C084FC',
  },
} as const;

export const type = {
  display: 'Michroma_400Regular',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  mono: 'JetBrainsMono_500Medium',
  monoSemi: 'JetBrainsMono_600SemiBold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 18, xl: 24, xxl: 36 } as const;

export const radius = { card: 18, cell: 12, hero: 24, pill: 999 } as const;

export const motion = {
  door: 260,
  stagger: 45,
  radar: 600,
  pulse: 1200,
  needle: 800,
  // Le spring maison, partout.
  spring: { damping: 18, stiffness: 180 },
  springSoft: { damping: 22, stiffness: 120 },
} as const;
