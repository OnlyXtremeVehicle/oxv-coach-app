// Charte OXV — REFONTE V3 (2026-07-10, handoff design complet Pilote+Coach).
// Thème unique sombre. Typo Hanken Grotesk (texte/UI) + JetBrains Mono
// (données + CHIFFRE ROI). Système couleur QDI par branche (§4 handoff) : chaque
// donnée a SA couleur ; l'OR est réservé au CHRONO/RECORD/RYTHME uniquement.
// Les clés de tokens sont conservées (compat 159 écrans) ; seules les valeurs
// changent. Rôles inchangés. Cf. design-retours/refonte-v2 §5 Design tokens.
//
// CE MODULE NE DÉPEND DE RIEN. Pas de `react-native`, pas de hook, pas de
// contexte : il est importé par la couche logique pure, qui tourne sur un banc
// sans chaîne native. Une première version de `spacing.screen` lisait
// `Dimensions` — elle a cassé deux suites d'un coup. Le test
// `themeSansRuntime.test.ts` monte la garde.
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
  // Gris faibles RELEVÉS le 25/07/2026 (décision fondateur « on assouplit »).
  // Contraste WCAG sur le pire fond de cette palette (card / card2 / surface3 /
  // cardBorderProminent) :
  //   eyebrow  #898991 — 4.52  (était #6E6E76 à 3.10 : sous le seuil texte, or il
  //                             porte les captions, les axes et les eyebrows)
  //   faint    #797981 — 3.63  (était #55555C à 2.12 : échouait même le seuil bas)
  // creamMute (5.62) et legend (4.58) passaient déjà : NON touchés.
  // Teinte neutre d'origine conservée (R = G, B = G+8) — luminance relevée, pas
  // la couleur. Verrouillé par src/theme/__tests__/contrastTokens.test.ts.
  eyebrow: '#898991', // --text-faint captions/axes/eyebrows
  faint: '#797981', // --text-faint-2 inactif
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

/**
 * Variantes typographiques du CHIFFRE ROI — jalon 2, phase 1.
 *
 * Le dossier demande « JetBrains Mono ligatures désactivées ». La table de la
 * fonte a été lue (`node_modules/@expo-google-fonts/jetbrains-mono/700Bold`)
 * plutôt que supposée :
 *
 * - `calt` PRÉSENT → c'est par les alternatives contextuelles que JetBrains Mono
 *   livre ses ligatures de code (`->`, `!=`, `//`). `no-contextual` est donc le
 *   levier juste, et le seul qui morde.
 * - `dlig`, `ss01`, `ss02` ABSENTS → rien à désactiver de ce côté.
 * - `tnum` ABSENT → `tabular-nums` n'a aucun effet sur cette fonte. C'est sans
 *   conséquence : une fonte à chasse fixe est tabulaire par construction. La
 *   valeur est conservée parce qu'elle dit l'intention, et qu'elle protégerait
 *   un jour un repli sur une fonte proportionnelle.
 *
 * **Le « zéro non pointé » du dossier n'est PAS atteignable ici.** La fonte
 * expose bien un tag `zero`, mais `fontVariant` de React Native est une
 * énumération fermée qui ne le contient pas, et RN n'offre pas de
 * `fontFeatureSettings`. Il faudrait une autre fonte ou un sous-ensemble
 * construit au build — décision fondateur, notée en dette (D-12).
 */
export const monoVariant = ['tabular-nums', 'no-contextual'] as const;

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

/**
 * Rythme vertical — base 8 pt, demi-pas 4 pt (dossier de conception §IV.2).
 *
 * Toute valeur tombe sur le demi-pas. `xl` valait 22 : ni un pas, ni un
 * demi-pas. Désalignement invisible à l'œil sur un bloc isolé, visible dès que
 * deux blocs voisins l'emploient — et il l'était sur 386 emplacements.
 *
 * `screen` est la MARGE LATÉRALE D'ÉCRAN (§IV.1). Elle vaut 20 pt : le palier
 * qui couvre 320 à 414 pt, c'est-à-dire tout iPhone du SE au 16 Pro.
 *
 * **Le palier de 24 pt au-delà de 414 pt n'est PAS porté par ce jeton**, et c'est
 * délibéré : le lire demanderait `Dimensions`, donc une dépendance native dans un
 * module que la couche logique importe. Le composant qui connaît sa largeur
 * obtient la bonne valeur par `margeEcran()` — c'est ce que fait `KingNumber`
 * pour calculer son budget. Conséquence assumée et mesurée : 4 pt de marge en
 * moins sur Plus et Pro Max, jamais l'inverse. Noté en dette (D-10).
 */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 28, screen: 20 } as const;
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
  monoVariant,
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
