/**
 * ThumbHash — codec porté dans le dépôt.
 *
 * ---
 *
 * ORIGINE ET LICENCE
 *
 * Portage fidèle de `thumbhash` d'Evan Wallace (MIT), version 0.1.1.
 * https://github.com/evanw/thumbhash — l'algorithme et ses constantes sont les
 * siens ; seuls le typage, les noms internes et les commentaires sont d'ici.
 *
 * ---
 *
 * POURQUOI PORTÉ PLUTÔT QU'IMPORTÉ
 *
 * Le paquet npm est publié en **ESM pur**. Metro le consomme sans peine côté
 * application, mais le banc d'essai tourne sous ts-jest en CommonJS et échoue
 * sur `export`.
 *
 * La correction évidente — ajouter une transformation Babel pour `node_modules` —
 * a été essayée, mesurée, et ABANDONNÉE : elle faisait passer tous les fichiers
 * JS du projet par `babel-preset-expo`, qui tire la chaîne Expo entière par
 * ouvrier Jest. La suite complète s'effondrait sur un dépassement de mémoire
 * (`FATAL ERROR: JavaScript heap out of memory`), là où le test ciblé passait.
 *
 * Déstabiliser deux mille tests pour un paquet de deux kilo-octets était un
 * mauvais échange. Le portage donne UNE implémentation, éprouvée par les tests
 * du dépôt, sans divergence entre ce que l'application exécute et ce que le banc
 * vérifie.
 *
 * ---
 *
 * CE QUI N'A PAS ÉTÉ PORTÉ, ET POURQUOI
 *
 * `thumbHashToDataURL` encode un PNG à la main — soixante lignes de CRC et de
 * flux zlib. `expo-image` consomme le hash directement ; le rendu personnalisé
 * se contente du RGBA. Porter un encodeur PNG pour un besoin qui n'existe pas
 * aurait ajouté de la surface sans usage.
 */

/** Pixels bruts, quatre octets par pixel, RGBA non prémultiplié. */
export interface RgbaBuffer {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

/**
 * Encode une image RGBA en ThumbHash.
 *
 * L'image doit tenir dans 100×100 — au-delà, l'encodage est lent sans bénéfice,
 * et l'auteur lève. Ici on rend `null` : un placeholder ne fait pas échouer un
 * envoi de média.
 */
export function rgbaToThumbHash(w: number, h: number, rgba: ArrayLike<number>): Uint8Array | null {
  if (w > 100 || h > 100 || w < 1 || h < 1) return null;
  const { PI, round, max, cos, abs } = Math;

  // Couleur moyenne, pondérée par l'alpha.
  let avgR = 0;
  let avgG = 0;
  let avgB = 0;
  let avgA = 0;
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    const alpha = rgba[j + 3] / 255;
    avgR += (alpha / 255) * rgba[j];
    avgG += (alpha / 255) * rgba[j + 1];
    avgB += (alpha / 255) * rgba[j + 2];
    avgA += alpha;
  }
  if (avgA) {
    avgR /= avgA;
    avgG /= avgA;
    avgB /= avgA;
  }

  const hasAlpha = avgA < w * h;
  // Moins de bits de luminance quand il faut loger un canal alpha.
  const lLimit = hasAlpha ? 5 : 7;
  const lx = max(1, round((lLimit * w) / max(w, h)));
  const ly = max(1, round((lLimit * h) / max(w, h)));

  const l: number[] = [];
  const p: number[] = [];
  const q: number[] = [];
  const a: number[] = [];

  // RGBA → LPQA, composé au-dessus de la couleur moyenne.
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    const alpha = rgba[j + 3] / 255;
    const r = avgR * (1 - alpha) + (alpha / 255) * rgba[j];
    const g = avgG * (1 - alpha) + (alpha / 255) * rgba[j + 1];
    const b = avgB * (1 - alpha) + (alpha / 255) * rgba[j + 2];
    l[i] = (r + g + b) / 3;
    p[i] = (r + g) / 2 - b;
    q[i] = r - g;
    a[i] = alpha;
  }

  // DCT : un terme constant, des termes variables normalisés.
  const encodeChannel = (channel: number[], nx: number, ny: number): [number, number[], number] => {
    let dc = 0;
    const ac: number[] = [];
    let scale = 0;
    const fx: number[] = [];
    for (let cy = 0; cy < ny; cy++) {
      for (let cx = 0; cx * ny < nx * (ny - cy); cx++) {
        let f = 0;
        for (let x = 0; x < w; x++) fx[x] = cos(((PI / w) * cx * (x + 0.5)) as number);
        for (let y = 0; y < h; y++) {
          const fy = cos((PI / h) * cy * (y + 0.5));
          for (let x = 0; x < w; x++) f += channel[x + y * w] * fx[x] * fy;
        }
        f /= w * h;
        if (cx || cy) {
          ac.push(f);
          scale = max(scale, abs(f));
        } else {
          dc = f;
        }
      }
    }
    if (scale) for (let i = 0; i < ac.length; i++) ac[i] = 0.5 + (0.5 / scale) * ac[i];
    return [dc, ac, scale];
  };

  const [lDc, lAc, lScale] = encodeChannel(l, max(3, lx), max(3, ly));
  const [pDc, pAc, pScale] = encodeChannel(p, 3, 3);
  const [qDc, qAc, qScale] = encodeChannel(q, 3, 3);
  const alphaCanal = hasAlpha ? encodeChannel(a, 5, 5) : null;

  const isLandscape = w > h;
  const header24 =
    round(63 * lDc) |
    (round(31.5 + 31.5 * pDc) << 6) |
    (round(31.5 + 31.5 * qDc) << 12) |
    (round(31 * lScale) << 18) |
    ((hasAlpha ? 1 : 0) << 23);
  const header16 =
    (isLandscape ? ly : lx) |
    (round(63 * pScale) << 3) |
    (round(63 * qScale) << 9) |
    ((isLandscape ? 1 : 0) << 15);

  const hash: number[] = [
    header24 & 255,
    (header24 >> 8) & 255,
    header24 >> 16,
    header16 & 255,
    header16 >> 8,
  ];
  const acStart = hasAlpha ? 6 : 5;
  let acIndex = 0;
  if (alphaCanal) hash.push(round(15 * alphaCanal[0]) | (round(15 * alphaCanal[2]) << 4));

  const canaux = alphaCanal ? [lAc, pAc, qAc, alphaCanal[1]] : [lAc, pAc, qAc];
  for (const ac of canaux) {
    for (const f of ac) {
      const idx = acStart + (acIndex >> 1);
      hash[idx] = (hash[idx] ?? 0) | (round(15 * f) << ((acIndex++ & 1) << 2));
    }
  }
  return Uint8Array.from(hash);
}

/** Rapport largeur/hauteur approché, lu directement dans l'en-tête. */
export function thumbHashToApproximateAspectRatio(hash: ArrayLike<number>): number {
  const header = hash[3];
  const hasAlpha = hash[2] & 0x80;
  const isLandscape = hash[4] & 0x80;
  const lx = isLandscape ? (hasAlpha ? 5 : 7) : header & 7;
  const ly = isLandscape ? header & 7 : hasAlpha ? 5 : 7;
  return lx / ly;
}

/** Couleur moyenne, composantes dans `[0, 1]`. */
export function thumbHashToAverageRGBA(hash: ArrayLike<number>): {
  r: number;
  g: number;
  b: number;
  a: number;
} {
  const { min, max } = Math;
  const header = hash[0] | (hash[1] << 8) | (hash[2] << 16);
  const l = (header & 63) / 63;
  const p = ((header >> 6) & 63) / 31.5 - 1;
  const q = ((header >> 12) & 63) / 31.5 - 1;
  const hasAlpha = header >> 23;
  const a = hasAlpha ? (hash[5] & 15) / 15 : 1;
  const b = l - (2 / 3) * p;
  const r = (3 * l - b + q) / 2;
  const g = r - q;
  return {
    r: max(0, min(1, r)),
    g: max(0, min(1, g)),
    b: max(0, min(1, b)),
    a: max(0, min(1, a)),
  };
}

/** Décode un ThumbHash en une vignette RGBA d'environ 32 px de côté. */
export function thumbHashToRGBA(hash: ArrayLike<number>): RgbaBuffer {
  const { PI, min, max, cos, round } = Math;

  const header24 = hash[0] | (hash[1] << 8) | (hash[2] << 16);
  const header16 = hash[3] | (hash[4] << 8);
  const lDc = (header24 & 63) / 63;
  const pDc = ((header24 >> 6) & 63) / 31.5 - 1;
  const qDc = ((header24 >> 12) & 63) / 31.5 - 1;
  const lScale = ((header24 >> 18) & 31) / 31;
  const hasAlpha = header24 >> 23;
  const pScale = ((header16 >> 3) & 63) / 63;
  const qScale = ((header16 >> 9) & 63) / 63;
  const isLandscape = header16 >> 15;
  const lx = max(3, isLandscape ? (hasAlpha ? 5 : 7) : header16 & 7);
  const ly = max(3, isLandscape ? header16 & 7 : hasAlpha ? 5 : 7);
  const aDc = hasAlpha ? (hash[5] & 15) / 15 : 1;
  const aScale = (hash[5] >> 4) / 15;

  const acStart = hasAlpha ? 6 : 5;
  let acIndex = 0;
  // La saturation est relevée de 25 % pour compenser la quantification —
  // constante de l'auteur, conservée telle quelle.
  const decodeChannel = (nx: number, ny: number, scale: number): number[] => {
    const ac: number[] = [];
    for (let cy = 0; cy < ny; cy++) {
      for (let cx = cy ? 0 : 1; cx * ny < nx * (ny - cy); cx++) {
        ac.push(
          (((hash[acStart + (acIndex >> 1)] >> ((acIndex++ & 1) << 2)) & 15) / 7.5 - 1) * scale
        );
      }
    }
    return ac;
  };

  const lAc = decodeChannel(lx, ly, lScale);
  const pAc = decodeChannel(3, 3, pScale * 1.25);
  const qAc = decodeChannel(3, 3, qScale * 1.25);
  const aAc = hasAlpha ? decodeChannel(5, 5, aScale) : [];

  const ratio = thumbHashToApproximateAspectRatio(hash);
  const w = round(ratio > 1 ? 32 : 32 * ratio);
  const h = round(ratio > 1 ? 32 / ratio : 32);
  const rgba = new Uint8Array(w * h * 4);
  const fx: number[] = [];
  const fy: number[] = [];

  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      let l = lDc;
      let p = pDc;
      let q = qDc;
      let a = aDc;

      for (let cx = 0, n = max(lx, hasAlpha ? 5 : 3); cx < n; cx++)
        fx[cx] = cos((PI / w) * (x + 0.5) * cx);
      for (let cy = 0, n = max(ly, hasAlpha ? 5 : 3); cy < n; cy++)
        fy[cy] = cos((PI / h) * (y + 0.5) * cy);

      for (let cy = 0, j = 0; cy < ly; cy++) {
        const fy2 = fy[cy] * 2;
        for (let cx = cy ? 0 : 1; cx * ly < lx * (ly - cy); cx++, j++) l += lAc[j] * fx[cx] * fy2;
      }
      for (let cy = 0, j = 0; cy < 3; cy++) {
        const fy2 = fy[cy] * 2;
        for (let cx = cy ? 0 : 1; cx < 3 - cy; cx++, j++) {
          const f = fx[cx] * fy2;
          p += pAc[j] * f;
          q += qAc[j] * f;
        }
      }
      if (hasAlpha) {
        for (let cy = 0, j = 0; cy < 5; cy++) {
          const fy2 = fy[cy] * 2;
          for (let cx = cy ? 0 : 1; cx < 5 - cy; cx++, j++) a += aAc[j] * fx[cx] * fy2;
        }
      }

      const b = l - (2 / 3) * p;
      const r = (3 * l - b + q) / 2;
      const g = r - q;
      rgba[i] = max(0, 255 * min(1, r));
      rgba[i + 1] = max(0, 255 * min(1, g));
      rgba[i + 2] = max(0, 255 * min(1, b));
      rgba[i + 3] = max(0, 255 * min(1, a));
    }
  }
  return { width: w, height: h, data: rgba };
}
