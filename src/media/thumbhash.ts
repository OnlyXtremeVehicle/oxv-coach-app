/**
 * ThumbHash — placeholder d'image tenant en une vingtaine d'octets.
 *
 * Lot T2. *« Aujourd'hui toutes les images partagent le même aplat titane. »*
 * Ce module produit, pour chaque média, un aperçu qui lui est propre.
 *
 * ---
 *
 * POURQUOI THUMBHASH ET PAS BLURHASH
 *
 * Le kit emploie aujourd'hui BlurHash, avec un aplat titane commun en repli.
 * ThumbHash le remplace pour trois raisons concrètes :
 *
 *   — il porte le **rapport d'aspect**, que BlurHash ignore : un portrait ne
 *     s'affiche plus dans le cadre d'un paysage le temps du chargement ;
 *   — il gère la **transparence**, ce que BlurHash ne fait pas ;
 *   — à taille égale, il restitue mieux les dégradés — ce qui compte sur des
 *     photos de piste, souvent un ciel au-dessus d'un bitume.
 *
 * L'ALGORITHME EST PORTÉ DANS LE DÉPÔT, pas réécrit de mémoire : voir
 * `thumbhashCodec.ts`, portage fidèle de l'implémentation MIT d'Evan Wallace, et
 * le motif de ce portage — le paquet npm est en ESM pur et faisait s'effondrer
 * la suite de tests.
 *
 * ---
 *
 * CE MODULE NE DÉCODE AUCUNE IMAGE
 *
 * Il travaille sur du **RGBA déjà décodé**. Obtenir ces pixels est le travail de
 * l'appelant, et c'est là que se situe la vraie contrainte du lot — voir
 * `docs/T2_THUMBHASH.md`. Confondre les deux ferait croire que la chaîne est
 * complète alors que sa moitié amont manque.
 */

/**
 * ===========================================================================
 * ⚠ CE MODULE N'EST EXÉCUTÉ PAR AUCUN CODE DE PRODUCTION — MESURÉ LE 14/08/2026
 * ===========================================================================
 *
 * Ses 17 tests passent, et ils ne couvrent RIEN de ce qui tourne :
 *
 *   • l'encodage réel se fait côté serveur, dans la fonction Edge
 *     `generate-thumbhash`, avec `esm.sh/thumbhash@0.1.1` ;
 *   • le décodage réel est natif, dans `expo-image` — `Photo.tsx` relaie une
 *     chaîne base64 sans passer par ici ;
 *   • le seul importeur de ce fichier est son propre test.
 *
 * Le dossier T2 promettait « UNE implémentation, sans divergence entre ce que
 * l'application exécute et ce que le banc vérifie ». Il y en a deux, et la
 * divergence annoncée comme évitée est exactement celle qui existe.
 *
 * **Conséquence à retenir : un défaut de l'encodeur SERVEUR resterait vert
 * ici.** Ces tests ne sont pas un filet pour la production.
 *
 * Le module est conservé plutôt que supprimé : c'est du code correct, et la
 * règle du fondateur réserve la suppression franche à ce qui CONTREDIT la
 * doctrine. Sa suppression reste un arbitrage ouvert ; `modulesOrphelins.guard`
 * le surveille en attendant.
 */

import {
  rgbaToThumbHash,
  thumbHashToApproximateAspectRatio,
  thumbHashToAverageRGBA,
  thumbHashToRGBA,
} from './thumbhashCodec';

/**
 * Taille maximale acceptée par l'algorithme, en pixels.
 *
 * ThumbHash exige une image d'au plus 100×100. Ce n'est pas une
 * recommandation : au-delà, l'encodage échoue. L'appelant réduit AVANT.
 */
export const THUMBHASH_MAX_DIM = 100;

/** Pixels bruts, quatre octets par pixel, ordre RGBA. */
export interface RgbaImage {
  width: number;
  height: number;
  /** Longueur attendue : `width × height × 4`. */
  data: Uint8Array | Uint8ClampedArray;
}

/**
 * Encode une image en ThumbHash, rendu en base64.
 *
 * Rend `null` plutôt que de lever : un placeholder est un agrément, jamais une
 * raison d'interrompre un envoi de média. Un `null` fait retomber l'affichage
 * sur l'aplat titane, ce qui reste correct.
 */
export function encodeThumbHash(image: RgbaImage): string | null {
  const { width, height, data } = image;

  if (!Number.isInteger(width) || !Number.isInteger(height)) return null;
  if (width <= 0 || height <= 0) return null;
  if (width > THUMBHASH_MAX_DIM || height > THUMBHASH_MAX_DIM) return null;
  if (data.length !== width * height * 4) return null;

  try {
    const octets = rgbaToThumbHash(width, height, data);
    return octets ? base64FromBytes(octets) : null;
  } catch {
    return null;
  }
}

/**
 * Décode un ThumbHash en vignette RGBA d'environ 32 px de côté.
 *
 * Sert au rendu hors `expo-image` — une carte de partage, un export d'image —
 * là où le composant natif n'est pas disponible. L'encodeur PNG de la
 * bibliothèque d'origine n'a PAS été porté : soixante lignes de CRC et de flux
 * zlib pour un besoin qui n'existe pas encore.
 */
export function thumbHashToPixels(hash: string): RgbaImage | null {
  const octets = bytesFromBase64(hash);
  if (!octets) return null;
  try {
    return thumbHashToRGBA(octets);
  } catch {
    return null;
  }
}

/** Rapport largeur/hauteur porté par le hash. `null` si illisible. */
export function thumbHashAspectRatio(hash: string): number | null {
  const octets = bytesFromBase64(hash);
  if (!octets || octets.length < 5) return null;
  const r = thumbHashToApproximateAspectRatio(octets);
  return Number.isFinite(r) && r > 0 ? r : null;
}

/**
 * Couleur moyenne d'un ThumbHash, en `#rrggbb`.
 *
 * Utile pour teinter un cadre AVANT même que le placeholder ne s'affiche —
 * l'octet est déjà là, autant s'en servir.
 */
export function thumbHashAverageColor(hash: string): string | null {
  const octets = bytesFromBase64(hash);
  if (!octets) return null;
  try {
    const { r, g, b } = thumbHashToAverageRGBA(octets);
    const o = (x: number) =>
      Math.round(Math.max(0, Math.min(1, x)) * 255)
        .toString(16)
        .padStart(2, '0');
    return `#${o(r)}${o(g)}${o(b)}`;
  } catch {
    return null;
  }
}

/**
 * Dimensions cibles pour réduire une image sous la borne de 100 px, en
 * préservant son rapport d'aspect.
 *
 * L'appelant s'en sert avec `expo-image-manipulator` avant d'encoder. Rend
 * `null` sur des dimensions absurdes plutôt qu'un couple inventé.
 */
export function fitWithinThumbHashBounds(
  width: number,
  height: number
): { width: number; height: number } | null {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;
  if (width <= THUMBHASH_MAX_DIM && height <= THUMBHASH_MAX_DIM) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const facteur = THUMBHASH_MAX_DIM / Math.max(width, height);
  // Le côté réduit ne descend jamais sous 1 px : une image très allongée
  // donnerait sinon une dimension nulle, et l'encodage échouerait.
  return {
    width: Math.max(1, Math.round(width * facteur)),
    height: Math.max(1, Math.round(height * facteur)),
  };
}

// ============================================================================
// Base64 — sans dépendre de `btoa`/`atob`, absents de Hermes
// ============================================================================

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64FromBytes(octets: Uint8Array): string {
  let out = '';
  for (let i = 0; i < octets.length; i += 3) {
    const a = octets[i];
    const b = i + 1 < octets.length ? octets[i + 1] : undefined;
    const c = i + 2 < octets.length ? octets[i + 2] : undefined;

    out += ALPHABET[a >> 2];
    out += ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? '=' : ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? '=' : ALPHABET[c & 63];
  }
  return out;
}

function bytesFromBase64(s: string): Uint8Array | null {
  const propre = s.replace(/=+$/, '');
  if (propre.length === 0) return null;

  const out: number[] = [];
  let tampon = 0;
  let bits = 0;
  for (const ch of propre) {
    const v = ALPHABET.indexOf(ch);
    // Un caractère hors alphabet signale une chaîne qui n'est pas un
    // ThumbHash : on rend `null` plutôt que de décoder du bruit.
    if (v < 0) return null;
    tampon = (tampon << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((tampon >> bits) & 0xff);
    }
  }
  return out.length > 0 ? Uint8Array.from(out) : null;
}
