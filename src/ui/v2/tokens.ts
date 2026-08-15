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
  /**
   * `card2` VALAIT `#232630` JUSQU'AU 13/08/2026 — et il tenait le plancher de
   * justesse en dessous.
   *
   * `text.mid` (`#A9ADBB`) y mesurait **6,74**, sous les 7:1 que ce dépôt
   * s'impose. Sur les deux autres fonds il passait largement — 8,14 sur `base`,
   * 7,52 sur `card`. **Un seul fond posait problème, et c'est celui-là qu'on
   * corrige.**
   *
   * L'arbitrage du 13/08 pose la raison : relever `mid` écraserait la hiérarchie
   * des gris, employée partout ; assombrir un fond utilisé à trois endroits ne
   * coûte rien. Quatre centièmes se comblent avec trois points de luminance.
   *
   * `#202329` mesure **7,03**, et la hiérarchie des fonds est intacte —
   * luminances 0,0076 < 0,0124 < 0,0167. L'écart est invisible à l'œil nu ;
   * le déplacement d'un gris de texte ne l'aurait pas été.
   */
  bg: { base: '#14151A', card: '#1B1D24', card2: '#202329', scrim: 'rgba(10,11,14,0.72)' },
  border: { card: '#2A2D38', strong: '#3A3E4C', hairline: '#22242C' },
  accent: '#C8102E',
  accentGlow: 'rgba(200,16,46,0.35)',
  /**
   * Gris de texte — RELEVÉS le 25/07/2026 (décision fondateur « on assouplit »)
   * pour que la hiérarchie reste lisible sans cesser d'être une hiérarchie.
   *
   * Contraste WCAG mesuré sur le PIRE des trois fonds (bg.base, bg.card, bg.card2) :
   *   hi  #E8E9ED — 12.44  (inchangé)
   *   mid #A9ADBB —  7.03  (était 6.74 : `bg.card2` a été assombri le 13/08,
   *                         cf. la note sur `bg` — c'est le fond qui a bougé,
   *                         pas le gris)
   *   low #9195A3 —  5.05  (était #7A7E8C à 3.73 : échouait sur les cartes)
   *   dim #787C8A —  3.63  (était #5A5E6C à 2.34 : échouait partout, y compris
   *                         le seuil bas de 3.0 — or `dim` porte de vrais textes
   *                         et les placeholders de saisie, qu'il faut pouvoir lire)
   *
   * `dim` reste sous 4.5 : le porter plus haut le collerait à `low` et effacerait
   * le palier. C'est un arbitrage assumé — il est réservé au texte secondaire et
   * aux états inactifs, jamais à une information essentielle isolée.
   *
   * La teinte froide d'origine est conservée (R = G−4, B = G+14) : on a relevé la
   * luminance, pas changé la couleur. Verrouillé par contrastTokens.test.ts.
   */
  text: { hi: '#E8E9ED', mid: '#A9ADBB', low: '#9195A3', dim: '#787C8A' },
  heritage: { gold: '#C4A459', text: '#E8DCB8', glow: 'rgba(196,164,89,0.30)' },
  qdi: {
    trajectoire: '#60A5FA',
    fluidite: '#FFB703',
    freinage: '#E63946',
    acceleration: '#4ADE80',
    regularite: '#C084FC',
  },
} as const;

/**
 * LES CINQ FAMILLES N'ÉTAIENT PAS UN HISTORIQUE — DEUX SYSTÈMES COEXISTAIENT.
 *
 * ===========================================================================
 * CE QUE LA MESURE A MONTRÉ, LE 13/08/2026
 * ===========================================================================
 *
 * Le dépôt porte DEUX tables de jetons typographiques :
 *
 *   `src/theme/v2.ts`      Hanken Grotesk + JetBrains Mono   — 170 fichiers
 *   `src/ui/v2/tokens.ts`  Michroma + Inter + JetBrains Mono —  57 fichiers
 *
 * La première est le système V3 adopté ; la seconde est l'ancien kit, que le
 * commentaire du baril annonce migrer « jusqu'à la bascule L6 » — bascule qui
 * n'a jamais eu lieu. Cinq familles ne décrivent donc pas une accumulation de
 * goûts : elles décrivent une migration à l'arrêt.
 *
 * ===========================================================================
 * CE QUI EST FAIT ICI, ET CE QUI ATTEND UN ŒIL
 * ===========================================================================
 *
 * **Inter sort.** L'arbitrage du 13/08 est explicite : « une redondance pure, à
 * retirer sans regarder — il fait exactement le travail de Hanken Grotesk ». Les
 * trois graisses de corps basculent, et 66 fichiers suivent sans être touchés.
 *
 * **Michroma est sorti le 15/08/2026** (décision fondateur, QCM — consolidation
 * complète, au-delà de la recommandation « regarder d'abord »). `typo.display`
 * est employé par 39 écrans : la bascule change l'identité visuelle de
 * l'application pilote entière, et elle N'A PAS ÉTÉ VUE — le quota de builds
 * iOS est épuisé jusqu'au 1er septembre. Premier geste du premier build :
 * regarder PROFIL, les cartes et un écran du flux REC. Réversion : une ligne.
 */
export const type = {
  display: 'HankenGrotesk_600SemiBold',
  body: 'HankenGrotesk_400Regular',
  bodyMedium: 'HankenGrotesk_500Medium',
  bodySemi: 'HankenGrotesk_600SemiBold',
  mono: 'JetBrainsMono_500Medium',
  monoSemi: 'JetBrainsMono_600SemiBold',
} as const;

/**
 * Échelle d'espacement — base 8, demi-pas 4.
 *
 * `lg` VALAIT 18 JUSQU'AU 12/08/2026, et c'était la seule valeur hors du pas
 * comme du demi-pas. Employée 236 fois, couverte par aucun test : elle avait
 * échappé à la règle sans que rien ne le dise.
 *
 * Passée à 16, elle rentre dans le rythme et resserre les marges de deux
 * points. Tranché en autonomie : 18 n'était pas un choix, c'était un oubli —
 * aucune note, aucun test, aucun document ne la justifiait. Pour renverser, il
 * suffit de la remettre à 18 et d'écrire pourquoi.
 *
 * `xl` reste à 24, `xxl` à 36 : tous deux sont des multiples de 4, et 36 est
 * délibérément un demi-pas au-dessus de 32 pour ouvrir les grandes respirations.
 */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 36 } as const;

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
