// Charte OXV — REFONTE V3 (2026-07-10, handoff design complet Pilote+Coach).
// Thème unique sombre. Typo Hanken Grotesk (texte/UI) + JetBrains Mono
// (données + CHIFFRE ROI). Système couleur QDI par branche (§4 handoff) : chaque
// donnée a SA couleur ; l'OR est réservé au CHRONO/RECORD/RYTHME uniquement.
// Les clés de tokens sont conservées (compat 159 écrans) ; seules les valeurs
// changent. Rôles inchangés. Cf. design-retours/refonte-v2 §5 Design tokens.
export const palette = {
  night: '#0B0B0D', // --bg fond app
  nightCard: '#111113', // --surface
  card: '#111113', // --surface : carte standard
  card2: '#141416', // --surface-2 : carte alt / boutons ronds
  surface3: '#16161A', // --surface-3 : tuiles internes
  cream: '#F5F5F7', // --text primaire
  creamSoft: '#E5E5E8', // --text-2 secondaire fort
  secondary: '#C9C9CE', // --text-3 secondaire
  creamMute: '#9A9AA3', // --text-muted labels
  eyebrow: '#6E6E76', // --text-faint captions/axes/eyebrows
  faint: '#55555C', // --text-faint-2 inactif
  legend: '#8A8A92', // --text-muted-2 sous-labels
  line: '#1E1E22', // --border bordure carte
  cardBorderProminent: '#232326', // --border-2 bordure bouton/tuile
  separator: '#17171A', // --border-hair séparateur fin
  borderHair: '#1A1A1D', // --hair-soft cadre graphe
  edge: 'rgba(255,255,255,0.20)',
  gold: '#FFB703', // CHRONO / RECORD / RYTHME UNIQUEMENT (jamais une donnée QDI)
  goldText: '#D9AE00', // or lisible sur fond clair
  red: '#C8102E', // rouge de marque / coach (insigne, bande coach)
  coachAccent: '#E23A4E', // accent UI coach (boutons, liserés)
  coachAlert: '#E2685A', // alerte douce coach (lien « retirer l'accès »)
  heritageGold: '#C4A459', // Heritage STRICT (offre)
  green: '#4FC98A', // = accél / état connecté / validé (QDI accélération)
  pilotAmber: '#F2792B', // legacy (marge serrée historique) — la marge passe au dégradé rouge→or→vert
  coach: '#E6E6E8', // citation coach neutre (bande coach utilise red)
} as const;

// Système couleur QDI (§4 handoff — CŒUR de la refonte). CHAQUE branche a une
// couleur FIXE, utilisée PARTOUT où sa donnée apparaît (radar, barres, points
// sur la piste, chips, annotations). Une couleur = une donnée. L'or n'est PAS
// ici : il est réservé au chrono/record (palette.gold).
export const dataColors = {
  trajectory: '#4F9DF7', // Trajectoire — bleu
  brake: '#F65B5B', // Freinage — rouge
  accel: '#4FC98A', // Accélération — vert
  flow: '#F2CE3B', // Fluidité — jaune (texte sur fond clair : goldText/#B58F00)
  regularity: '#A783F2', // Régularité — violet (barres inactives #3A2E52)
} as const;

// Rampe de chaleur VITESSE (froid → chaud) : bleu → cyan → vert → jaune. SANS or
// ni rouge — la vitesse n'est ni un chrono/record (or) ni une alarme (rouge).
// Source UNIQUE partagée par la carte (TrajectoryLayer), la heatmap (TrackStage)
// et leurs légendes, pour qu'elles ne divergent jamais.
export const speedHeat = ['#4F9DF7', '#3FD0D8', '#4FC98A', '#F2CE3B'] as const;

// Polices — REFONTE V3. Hanken Grotesk = texte/titres/UI ; JetBrains Mono =
// données/labels/axes ET le CHIFFRE ROI (mono, tabular-nums, letter-spacing
// négatif). Plus de Rajdhani ni Instrument Serif. Noms = exports
// @expo-google-fonts (chargés dans src/theme/fonts.ts).
export const fonts = {
  display: 'HankenGrotesk_600SemiBold', // titres
  displayReg: 'HankenGrotesk_500Medium',
  displayBold: 'HankenGrotesk_700Bold',
  heavy: 'HankenGrotesk_800ExtraBold',
  body: 'HankenGrotesk_400Regular',
  bodyLight: 'HankenGrotesk_300Light',
  bodyMedium: 'HankenGrotesk_500Medium',
  bodySemi: 'HankenGrotesk_600SemiBold',
  king: 'JetBrainsMono_700Bold', // CHIFFRE ROI : mono, grand, tabular-nums
  kingMedium: 'JetBrainsMono_500Medium',
  mono: 'JetBrainsMono_400Regular', // données, labels, eyebrows, chronos, axes
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemi: 'JetBrainsMono_600SemiBold', // chrono/record accentué
  serif: 'HankenGrotesk_400Regular', // éditorial (plus de serif : Hanken)
  serifItalic: 'HankenGrotesk_400Regular_Italic',
} as const;

// Couleurs d'IDENTITÉ DE RÔLE (navigation, badges, hubs — jamais de la donnée).
// Décision fondateur 2026-07-06 : on adopte les couleurs des maquettes Claude
// Design. Le pilote reste NEUTRE (crème) — jamais l'or, réservé à la donnée
// (SPEC_BUILD §5 « couleur d'identité par rôle, jamais l'or »). Le coach porte le
// rouge de marque (coach = marque OXV) ; partenaire = bleu ; admin = cyan.
export const roleColors = {
  pilot: '#F5F5F7', // blanc (= palette.cream) : identité neutre du pilote
  coach: '#C8102E', // rouge de marque (= palette.red)
  partner: '#5B8DEF', // bleu partenaire (site web)
  admin: '#22D3EE', // cyan admin (site web)
} as const;
export type RoleKey = keyof typeof roleColors;

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
// `hud` (6px) = angle d'instrument des panneaux cockpit NG (refonte) — plus sec
// que les cartes web arrondies. Cf. CockpitPanel, GUIDE_INTEGRATION §2.
export const radius = { hud: 6, sm: 10, md: 12, lg: 14, xl: 18, pill: 999 } as const;
export const motion = { fast: 160, base: 240, slow: 420, reveal: 640 } as const;
export const easing = [0.22, 1, 0.36, 1] as const;
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;

export const theme = {
  palette,
  dataColors,
  speedHeat,
  roleColors,
  fonts,
  fontSize,
  spacing,
  radius,
  motion,
  easing,
  hitSlop,
};
export type ThemeV2 = typeof theme;

// ─────────────────────────────────────────────────────────────────────────────
// LOT PROFIL & PANEL DE CARTES (spec fondateur 17/07/2026) — tokens ADDITIFS.
// Palette et typos imposées par les références HTML du lot (profil.html,
// panel-cartes.html). N'altère AUCUN token v2 existant ; réservé aux écrans
// du lot (profil, profil-edition, cartes). L'or Heritage reste INTERDIT sur
// ces écrans ; les écarts de temps y sont en gris NEUTRE (deltaNeutre).
// Polices : Syncopate / Inter / JetBrains Mono (déjà en dépendances,
// chargées dans src/theme/fonts.ts).
export const lotProfilTokens = {
  noir: '#0A0A0A', // fond global
  blanc: '#FFFFFF', // texte principal
  rouge: '#C8102E', // insigne, liseré, sélection, CTA
  surface: '#141414', // cartes, blocs
  surface2: '#1C1C1C', // éléments imbriqués
  ligne: '#262626', // bordures
  gris: '#8A8A8A', // texte secondaire
  grisSombre: '#555555', // labels, légendes
  deltaNeutre: '#D6D6D6', // écarts de temps — gris NEUTRE, jamais un jugement
  fonts: {
    display: 'Syncopate_700Bold', // titres, nom du pilote, dates, bouton Comparer
    displayReg: 'Syncopate_400Regular',
    corps: 'Inter_400Regular', // corps, bio
    corpsItalique: 'Inter_400Regular_Italic', // manifeste
    corpsMedium: 'Inter_500Medium',
    corpsSemi: 'Inter_600SemiBold',
    mono: 'JetBrainsMono_400Regular', // données chiffrées, eyebrows, labels
    monoMedium: 'JetBrainsMono_500Medium',
    monoBold: 'JetBrainsMono_700Bold', // odomètre, valeurs
  },
} as const;
export type LotProfilTokens = typeof lotProfilTokens;
