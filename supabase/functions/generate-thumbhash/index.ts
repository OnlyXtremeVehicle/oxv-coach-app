// @ts-nocheck — runtime Deno, pas Node
//
// Edge Function : generate-thumbhash (lot T2)
//
// Body : { mediaId?: string, limit?: number }
//   — `mediaId` fourni  : traite CE média (appelée après un envoi).
//   — `mediaId` absent  : rattrape jusqu'à `limit` médias sans hash (défaut 25).
//
// ---------------------------------------------------------------------------
// POURQUOI CETTE FONCTION EXISTE PLUTÔT QU'UN TRAITEMENT DANS L'APPLICATION
// ---------------------------------------------------------------------------
//
// L'encodage ThumbHash a besoin des PIXELS BRUTS. React Native ne les expose
// pas : `expo-image-manipulator` rend un PNG encodé, qu'il faudrait ensuite
// décoder en JavaScript sur l'appareil, au moment précis où le pilote attend que
// son envoi se termine.
//
// Surtout, le chemin applicatif ne peut RIEN pour les médias déjà déposés. Les
// traiter demanderait de faire renvoyer leurs photos aux pilotes. Le chemin
// serveur les rattrape sans que personne ne s'en aperçoive.
//
// ---------------------------------------------------------------------------
// LE HASH EST UN AGRÉMENT, JAMAIS UNE CONDITION
// ---------------------------------------------------------------------------
//
// Un média sans ThumbHash s'affiche parfaitement : le kit retombe sur l'aplat
// titane. Cette fonction ne doit donc JAMAIS faire échouer un envoi, ni bloquer
// une file. Chaque média est traité isolément ; un échec est compté et rapporté,
// il n'interrompt pas le lot.
//
// ---------------------------------------------------------------------------
// CE QU'ELLE NE TRAITE PAS
// ---------------------------------------------------------------------------
//
// Les VIDÉOS. Il faudrait en extraire une image, ce qui demande un décodeur
// vidéo — hors de portée d'une fonction Edge. `media_type <> 'photo'` est donc
// écarté explicitement, et compté à part pour que le rapport le dise.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.114.0';
import { decode as decodeJpeg } from 'https://esm.sh/jpeg-js@0.4.4';
import { decode as decodePng } from 'https://esm.sh/fast-png@6.2.0';
import { rgbaToThumbHash } from 'https://esm.sh/thumbhash@0.1.1';

const BUCKET = 'session-media';

/** ThumbHash exige au plus 100×100 : au-delà, l'encodage échoue. */
const MAX_DIM = 100;

/** Lot par défaut. Assez pour avancer, assez court pour ne pas expirer. */
const LOT_DEFAUT = 25;

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

/**
 * Décode une image en RGBA. JPEG et PNG seulement — ce que produisent les
 * appareils photo et les captures d'écran.
 *
 * Rend `null` sur un format inconnu plutôt que de deviner : un décodage
 * approximatif produirait un aperçu qui ne ressemble pas au média.
 */
function decodeToRgba(
  octets: Uint8Array,
  mime: string | null
): { width: number; height: number; data: Uint8Array } | null {
  try {
    if (mime?.includes('png')) {
      const img = decodePng(octets);
      // fast-png rend parfois du RGB ou du 16 bits : on n'accepte que le cas
      // droit plutôt que de convertir à l'aveugle.
      if (img.channels !== 4 || img.depth !== 8) return null;
      return { width: img.width, height: img.height, data: new Uint8Array(img.data) };
    }
    // Défaut JPEG : c'est ce que produit un téléphone.
    const img = decodeJpeg(octets, { useTArray: true });
    return { width: img.width, height: img.height, data: new Uint8Array(img.data) };
  } catch {
    return null;
  }
}

/**
 * Réduit une image RGBA sous la borne de 100 px, par échantillonnage au plus
 * proche voisin.
 *
 * Un rééchantillonnage bilinéaire serait plus propre, mais ThumbHash applique
 * ensuite une DCT sur une poignée de coefficients : la différence disparaît dans
 * le résultat. Le plus proche voisin est dix fois plus rapide, ce qui compte sur
 * un lot de rattrapage.
 */
function reduire(
  src: { width: number; height: number; data: Uint8Array },
): { width: number; height: number; data: Uint8Array } {
  const { width: sw, height: sh, data } = src;
  if (sw <= MAX_DIM && sh <= MAX_DIM) return src;

  const facteur = MAX_DIM / Math.max(sw, sh);
  const dw = Math.max(1, Math.round(sw * facteur));
  const dh = Math.max(1, Math.round(sh * facteur));
  const out = new Uint8Array(dw * dh * 4);

  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / dh));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor((x * sw) / dw));
      const si = (sy * sw + sx) * 4;
      const di = (y * dw + x) * 4;
      out[di] = data[si];
      out[di + 1] = data[si + 1];
      out[di + 2] = data[si + 2];
      out[di + 3] = data[si + 3];
    }
  }
  return { width: dw, height: dh, data: out };
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    // Clé de service : la colonne `thumbhash` n'est pas écrite par les pilotes.
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let mediaId: string | null = null;
  let limite = LOT_DEFAUT;
  try {
    const body = await req.json();
    mediaId = body?.mediaId ?? null;
    if (Number.isFinite(body?.limit)) limite = Math.max(1, Math.min(200, body.limit));
  } catch {
    // Corps absent ou illisible : on part sur un rattrapage par défaut.
  }

  let requete = supabase
    .from('session_media')
    .select('id, storage_path, mime_type, media_type')
    .is('thumbhash', null)
    .is('deleted_at', null);

  requete = mediaId
    ? requete.eq('id', mediaId)
    : requete.order('uploaded_at', { ascending: true }).limit(limite);

  const { data: medias, error } = await requete;
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let traites = 0;
  let ecartesVideo = 0;
  let echecs = 0;

  for (const m of medias ?? []) {
    // Une vidéo demanderait un décodeur vidéo : hors de portée ici. On l'écarte
    // et on le COMPTE, pour que le rapport ne laisse pas croire à un traitement.
    if (m.media_type !== 'photo') {
      ecartesVideo++;
      continue;
    }

    try {
      const { data: fichier, error: dlErr } = await supabase.storage
        .from(BUCKET)
        .download(m.storage_path);
      if (dlErr || !fichier) {
        echecs++;
        continue;
      }

      const octets = new Uint8Array(await fichier.arrayBuffer());
      const rgba = decodeToRgba(octets, m.mime_type);
      if (!rgba) {
        echecs++;
        continue;
      }

      const petit = reduire(rgba);
      const hash = rgbaToThumbHash(petit.width, petit.height, petit.data);
      const b64 = base64FromBytes(hash);

      const { error: upErr } = await supabase
        .from('session_media')
        .update({ thumbhash: b64 })
        .eq('id', m.id);

      if (upErr) echecs++;
      else traites++;
    } catch {
      // Un média qui résiste ne bloque pas les suivants. Le hash est un
      // agrément : son absence n'a aucune conséquence pour le pilote.
      echecs++;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      traites,
      ecartesVideo,
      echecs,
      candidats: medias?.length ?? 0,
      // `reste` n'est pas calculé ici : un COUNT sur toute la table à chaque
      // appel coûterait plus que le lot lui-même. La requête de dimensionnement
      // est dans la migration proposée.
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
