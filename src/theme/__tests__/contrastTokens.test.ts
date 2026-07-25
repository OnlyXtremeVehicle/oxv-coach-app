/**
 * Verrou de CONTRASTE sur les gris de texte des deux palettes.
 *
 * Le 25/07/2026, le fondateur a tranché « on assouplit » : les gris les plus
 * faibles ont été relevés parce qu'ils passaient sous les seuils WCAG — `dim`
 * était à 2.34 sur fond de carte, soit illisible, alors qu'il porte de vrais
 * textes et les placeholders de saisie.
 *
 * Ce test existe pour que ce gain ne se reperde pas en silence. Un thème s'ajuste
 * souvent à l'œil, sur un écran neuf, en pleine lumière : c'est exactement là
 * qu'on assombrit un gris sans s'en apercevoir. Ici, la règle est chiffrée.
 *
 * Ce qu'il NE fait PAS : juger les couleurs SÉMANTIQUES (or du chrono, rouge de
 * marque, teintes QDI, Heritage). Elles obéissent à la loi couleur du dépôt —
 * une couleur = une donnée — et leur contraste se traite au cas par cas, à la
 * taille et au poids réels du texte concerné. Les toucher ici serait déplacer un
 * arbitrage de doctrine dans un test d'accessibilité.
 */

import { colors } from '@/ui/v2/tokens';
import { theme } from '@/theme/v2';

/** Luminance relative WCAG 2.1 (sRGB, composantes linéarisées). */
function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => {
    const v = parseInt(c.substr(i, 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Rapport de contraste WCAG entre deux couleurs opaques. */
function contrast(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Pire contraste d'une couleur sur l'ensemble des fonds où elle peut poser. */
function worstOn(color: string, backgrounds: readonly string[]): number {
  return Math.min(...backgrounds.map((bg) => contrast(color, bg)));
}

describe('contraste — palette pilote (app2)', () => {
  // Tous les fonds sur lesquels un texte peut se poser dans (app2).
  const FONDS = [colors.bg.base, colors.bg.card, colors.bg.card2] as const;

  it('hi et mid tiennent le seuil texte AA (4.5) sur tous les fonds', () => {
    expect(worstOn(colors.text.hi, FONDS)).toBeGreaterThanOrEqual(4.5);
    expect(worstOn(colors.text.mid, FONDS)).toBeGreaterThanOrEqual(4.5);
  });

  it('low tient le seuil texte AA (4.5) — il porte du texte secondaire réel', () => {
    expect(worstOn(colors.text.low, FONDS)).toBeGreaterThanOrEqual(4.5);
  });

  it('dim tient au moins le seuil 3.0 (large / UI) — il porte les placeholders', () => {
    // Palier assumé sous 4.5 : le porter plus haut le collerait à `low` et
    // effacerait la hiérarchie. Il reste réservé au secondaire et à l'inactif.
    expect(worstOn(colors.text.dim, FONDS)).toBeGreaterThanOrEqual(3.0);
  });

  it('la hiérarchie reste STRICTEMENT décroissante (hi > mid > low > dim)', () => {
    // Sans cet invariant, relever un gris pour l'accessibilité pourrait aplatir
    // les paliers : quatre gris lisibles mais indistinguables ne hiérarchisent
    // plus rien, et l'écran perd sa lecture.
    const l = [colors.text.hi, colors.text.mid, colors.text.low, colors.text.dim].map(luminance);
    expect(l[0]).toBeGreaterThan(l[1]);
    expect(l[1]).toBeGreaterThan(l[2]);
    expect(l[2]).toBeGreaterThan(l[3]);
  });
});

describe('contraste — palette coach', () => {
  const { palette } = theme;
  const FONDS = [
    palette.night,
    palette.card,
    palette.card2,
    palette.surface3,
    palette.cardBorderProminent,
  ] as const;

  it('cream, creamSoft, secondary, creamMute et legend tiennent le seuil texte AA', () => {
    for (const c of [
      palette.cream,
      palette.creamSoft,
      palette.secondary,
      palette.creamMute,
      palette.legend,
    ]) {
      expect(worstOn(c, FONDS)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('eyebrow tient le seuil texte AA — il porte captions, axes et eyebrows', () => {
    expect(worstOn(palette.eyebrow, FONDS)).toBeGreaterThanOrEqual(4.5);
  });

  it('faint tient au moins le seuil 3.0 (large / UI)', () => {
    expect(worstOn(palette.faint, FONDS)).toBeGreaterThanOrEqual(3.0);
  });

  it('la hiérarchie des gris reste strictement décroissante', () => {
    const l = [
      palette.cream,
      palette.creamSoft,
      palette.secondary,
      palette.creamMute,
      palette.legend,
      palette.eyebrow,
      palette.faint,
    ].map(luminance);
    for (let i = 1; i < l.length; i++) {
      expect(l[i - 1]).toBeGreaterThan(l[i]);
    }
  });
});
