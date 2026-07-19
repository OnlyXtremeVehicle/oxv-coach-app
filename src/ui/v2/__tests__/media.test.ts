/**
 * Tests du système d'images V2 — logique pure uniquement (pas de rendu).
 */

import { photoRecyclingKey, TITANE_BLURHASH } from '@/ui/v2/media/blurhash';
import {
  PARALLAX_BLEED,
  PARALLAX_FACTOR,
  parallaxTranslateY,
  PHOTO_FADE_MS,
  SCRIM_HEIGHT_RATIO,
  scrimGradientColors,
  scrimHeight,
  toTransparent,
} from '@/ui/v2/media/mediaMath';
import { colors } from '@/ui/v2/tokens';

// Alphabet base83 de woltapp/blurhash.
const B83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';

describe('TITANE_BLURHASH', () => {
  it('est non vide et ne contient que des caractères base83', () => {
    expect(TITANE_BLURHASH.length).toBeGreaterThan(0);
    for (const c of TITANE_BLURHASH) {
      expect(B83.includes(c)).toBe(true);
    }
  });

  it('a une longueur cohérente avec son en-tête de composantes', () => {
    const sizeFlag = B83.indexOf(TITANE_BLURHASH[0]);
    const numX = (sizeFlag % 9) + 1;
    const numY = Math.floor(sizeFlag / 9) + 1;
    // 1 (taille) + 1 (max AC) + 4 (DC) + 2 par composante AC.
    expect(TITANE_BLURHASH.length).toBe(4 + 2 * numX * numY);
  });

  it("a une couleur moyenne (DC) sombre et froide, cohérente avec l'aplat titane", () => {
    const dc = TITANE_BLURHASH.slice(2, 6)
      .split('')
      .reduce((acc, c) => acc * 83 + B83.indexOf(c), 0);
    const r = (dc >> 16) & 255;
    const g = (dc >> 8) & 255;
    const b = dc & 255;
    // Sombre (aplat bg.base → bg.card2)…
    expect(r).toBeLessThan(64);
    expect(g).toBeLessThan(64);
    expect(b).toBeLessThan(64);
    // …et froid : dominante bleutée, jamais chaude.
    expect(b).toBeGreaterThanOrEqual(r);
  });
});

describe('photoRecyclingKey', () => {
  it("prime l'id quand il est fourni", () => {
    expect(photoRecyclingKey('https://oxv.app/a.jpg?token=abc', 'media-42')).toBe('media-42');
  });

  it("retombe sur l'URI quand l'id est vide", () => {
    expect(photoRecyclingKey('https://oxv.app/a.jpg', '')).toBe('https://oxv.app/a.jpg');
  });

  it('retire la query string (token des URLs signées Supabase)', () => {
    expect(
      photoRecyclingKey('https://x.supabase.co/storage/v1/object/sign/garage/a.jpg?token=eyJhbGci')
    ).toBe('https://x.supabase.co/storage/v1/object/sign/garage/a.jpg');
  });

  it('retire le fragment', () => {
    expect(photoRecyclingKey('https://oxv.app/a.jpg#zone')).toBe('https://oxv.app/a.jpg');
  });

  it('laisse une URI sans query ni fragment inchangée', () => {
    expect(photoRecyclingKey('https://oxv.app/a.jpg')).toBe('https://oxv.app/a.jpg');
  });
});

describe('parallaxe HeroPhoto', () => {
  it('applique le facteur 0.3', () => {
    expect(PARALLAX_FACTOR).toBe(0.3);
    expect(parallaxTranslateY(0)).toBe(0);
    expect(parallaxTranslateY(100)).toBeCloseTo(30);
    expect(parallaxTranslateY(-80)).toBeCloseTo(-24);
  });

  it('hero hors tête de scroll : parallaxOffset rend la course neutre à son offset', () => {
    expect(parallaxTranslateY(300, 300)).toBe(0);
    expect(parallaxTranslateY(340, 300)).toBeCloseTo(12);
    expect(parallaxTranslateY(260, 300)).toBeCloseTo(-12);
  });

  it('borne la course à ±PARALLAX_BLEED — le débord de la couche photo', () => {
    expect(PARALLAX_BLEED).toBe(40);
    expect(parallaxTranslateY(1000)).toBe(PARALLAX_BLEED);
    expect(parallaxTranslateY(-1000)).toBe(-PARALLAX_BLEED);
    expect(parallaxTranslateY(1000, 300)).toBe(PARALLAX_BLEED);
  });
});

describe('scrim et constantes média', () => {
  it('fond en 220 ms', () => {
    expect(PHOTO_FADE_MS).toBe(220);
  });

  it('dérive la borne transparente du token scrim, sans couleur en dur', () => {
    expect(toTransparent(colors.bg.scrim)).toBe('rgba(10,11,14,0)');
  });

  it('construit le dégradé transparent → scrim plein', () => {
    expect(scrimGradientColors(colors.bg.scrim)).toEqual(['rgba(10,11,14,0)', colors.bg.scrim]);
  });

  it('borne le scrim à 45 % de la hauteur du hero', () => {
    expect(SCRIM_HEIGHT_RATIO).toBe(0.45);
    expect(scrimHeight(320)).toBe(144);
    expect(scrimHeight(0)).toBe(0);
  });

  it('reste entièrement transparent face à une couleur inattendue', () => {
    expect(toTransparent('not-a-rgba')).toBe('transparent');
  });
});
