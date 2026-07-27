import {
  encodeThumbHash,
  fitWithinThumbHashBounds,
  THUMBHASH_MAX_DIM,
  thumbHashAspectRatio,
  thumbHashAverageColor,
  thumbHashToPixels,
  type RgbaImage,
} from '../thumbhash';

/** Image unie de `w×h` pixels, opaque. */
function aplat(w: number, h: number, r: number, g: number, b: number): RgbaImage {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}

/** Dégradé vertical, du sombre au clair — le cas typique ciel / bitume. */
function degrade(w: number, h: number): RgbaImage {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const v = Math.round((y / Math.max(1, h - 1)) * 255);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

describe('encodeThumbHash', () => {
  it('encode un aplat en une chaîne courte', () => {
    const h = encodeThumbHash(aplat(32, 32, 200, 60, 40));
    expect(h).not.toBeNull();
    expect(typeof h).toBe('string');
    // Une vingtaine d'octets, donc une trentaine de caractères en base64.
    expect(h!.length).toBeLessThan(64);
  });

  it('donne des empreintes DIFFÉRENTES pour des images différentes', () => {
    const rouge = encodeThumbHash(aplat(32, 32, 220, 40, 30));
    const bleu = encodeThumbHash(aplat(32, 32, 30, 60, 220));
    expect(rouge).not.toBeNull();
    expect(rouge).not.toEqual(bleu);
  });

  it('est déterministe — même image, même empreinte', () => {
    const a = encodeThumbHash(degrade(40, 30));
    const b = encodeThumbHash(degrade(40, 30));
    expect(a).toEqual(b);
  });

  it('distingue un portrait d’un paysage — ce que BlurHash ne fait pas', () => {
    const portrait = encodeThumbHash(degrade(30, 90));
    const paysage = encodeThumbHash(degrade(90, 30));
    expect(portrait).not.toEqual(paysage);
  });
});

describe('encodeThumbHash — l’échec est une absence, jamais une exception', () => {
  // Un placeholder est un agrément : il ne doit JAMAIS interrompre un envoi.
  it('rend null au-delà de la borne de 100 px, sans lever', () => {
    expect(encodeThumbHash(aplat(200, 50, 0, 0, 0))).toBeNull();
    expect(encodeThumbHash(aplat(50, 200, 0, 0, 0))).toBeNull();
  });

  it('rend null sur des dimensions absurdes', () => {
    expect(encodeThumbHash(aplat(0, 10, 0, 0, 0))).toBeNull();
    expect(encodeThumbHash({ width: 1.5, height: 10, data: new Uint8Array(60) })).toBeNull();
  });

  it('rend null si le tampon ne fait pas w × h × 4', () => {
    expect(encodeThumbHash({ width: 10, height: 10, data: new Uint8Array(100) })).toBeNull();
  });
});

describe('décodage', () => {
  it('fait l’aller-retour vers une vignette RGBA', () => {
    const h = encodeThumbHash(degrade(40, 40))!;
    const px = thumbHashToPixels(h);
    expect(px).not.toBeNull();
    expect(px!.width).toBeGreaterThan(0);
    expect(px!.height).toBeGreaterThan(0);
    expect(px!.data.length).toBe(px!.width * px!.height * 4);
  });

  // Le dégradé va du sombre en haut au clair en bas : la vignette décodée doit
  // le restituer, sinon le codec ne transporte pas ce qu'il prétend.
  it('restitue le SENS du dégradé', () => {
    const px = thumbHashToPixels(encodeThumbHash(degrade(60, 60))!)!;
    const lig = (y: number) => {
      let s = 0;
      for (let x = 0; x < px.width; x++) s += px.data[(y * px.width + x) * 4];
      return s / px.width;
    };
    expect(lig(px.height - 2)).toBeGreaterThan(lig(1) + 40);
  });

  it('porte le rapport d’aspect', () => {
    const paysage = thumbHashAspectRatio(encodeThumbHash(degrade(90, 30))!)!;
    const portrait = thumbHashAspectRatio(encodeThumbHash(degrade(30, 90))!)!;
    expect(paysage).toBeGreaterThan(1);
    expect(portrait).toBeLessThan(1);
  });

  it('restitue une couleur moyenne proche de l’original', () => {
    const c = thumbHashAverageColor(encodeThumbHash(aplat(32, 32, 200, 60, 40))!);
    expect(c).not.toBeNull();
    expect(c).toMatch(/^#[0-9a-f]{6}$/);
    // Le rouge domine : c'est ce que l'aplat porte.
    const r = parseInt(c!.slice(1, 3), 16);
    const b = parseInt(c!.slice(5, 7), 16);
    expect(r).toBeGreaterThan(b);
  });

  it('rend null sur une chaîne qui n’est pas un ThumbHash', () => {
    expect(thumbHashToPixels('')).toBeNull();
    expect(thumbHashToPixels('pas du base64 !!')).toBeNull();
    expect(thumbHashAspectRatio('')).toBeNull();
    expect(thumbHashAverageColor('###')).toBeNull();
  });
});

describe('fitWithinThumbHashBounds', () => {
  it('laisse une petite image intacte', () => {
    expect(fitWithinThumbHashBounds(80, 60)).toEqual({ width: 80, height: 60 });
  });

  it('réduit sous la borne en préservant le rapport d’aspect', () => {
    const r = fitWithinThumbHashBounds(4000, 3000)!;
    expect(Math.max(r.width, r.height)).toBeLessThanOrEqual(THUMBHASH_MAX_DIM);
    expect(r.width / r.height).toBeCloseTo(4 / 3, 1);
  });

  // Sans plancher, une image très allongée donnerait un côté à zéro et
  // l'encodage échouerait sans qu'on sache pourquoi.
  it('garde au moins 1 px sur le côté écrasé', () => {
    const r = fitWithinThumbHashBounds(10000, 20)!;
    expect(r.height).toBeGreaterThanOrEqual(1);
    expect(r.width).toBeLessThanOrEqual(THUMBHASH_MAX_DIM);
  });

  it('rend null sur des dimensions absurdes', () => {
    expect(fitWithinThumbHashBounds(0, 10)).toBeNull();
    expect(fitWithinThumbHashBounds(NaN, 10)).toBeNull();
  });

  it('produit des dimensions réellement encodables', () => {
    const r = fitWithinThumbHashBounds(1920, 1080)!;
    const img = aplat(r.width, r.height, 100, 100, 100);
    expect(encodeThumbHash(img)).not.toBeNull();
  });
});
