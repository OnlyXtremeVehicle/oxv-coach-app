/**
 * Sous-ensemble des design tokens OXV nécessaires au pack web.
 *
 * Synchronisé avec src/theme/tokens.ts de l'app RN. Ne PAS modifier ici
 * sans mettre à jour le fichier source RN — la cohérence visuelle entre
 * les 3 surfaces dépend de l'unicité des valeurs.
 */

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
  },

  accent: {
    red: '#C8102E',
  },

  margin: {
    green: '#97C459',
    yellow: '#EF9F27',
    red: '#C8102E',
  },

  border: {
    subtle: 'rgba(255, 255, 255, 0.08)',
    medium: 'rgba(255, 255, 255, 0.15)',
  },
} as const;

export const fontWeight = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;
