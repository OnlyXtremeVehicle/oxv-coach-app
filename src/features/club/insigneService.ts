/**
 * Le téléversement d'un insigne d'écurie — la moitié du geste qui touche au réseau.
 *
 * ===========================================================================
 * POURQUOI CE FICHIER EXISTE À CÔTÉ DE `insigneLogic`
 * ===========================================================================
 *
 * `insigneLogic` est pur : il tient les règles (formats, borne de taille,
 * fail-closed) et se teste en node. Ici vivent les trois choses qu'on ne peut
 * pas tester sur un banc — le sélecteur de fichiers, la lecture du fichier, et
 * l'envoi vers le bucket. Le découpage est celui qu'impose le cadre Jest, et
 * c'est le même que `bookingCatalogLogic` / `bookingCatalogService`.
 *
 * ===========================================================================
 * L'ORDRE DES DEUX ÉCRITURES, ET POURQUOI IL EST DANS CE SENS
 * ===========================================================================
 *
 * On envoie le fichier D'ABORD, on pose le chemin en base ENSUITE.
 *
 * Dans ce sens, un échec du second temps laisse un objet orphelin dans le
 * bucket : quelques kilo-octets que personne ne voit, et que le prochain envoi
 * remplacera (`upsert: true`, chemin déterministe). Dans l'autre sens, un échec
 * du second temps laisserait `crews.insigne_image_path` pointer vers un fichier
 * inexistant — l'écurie afficherait un cadre cassé à tous ses membres.
 *
 * Entre un déchet invisible et une image morte, on choisit le déchet.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Buffer } from 'buffer';

import { cheminInsigne, extensionDe, validerTeleversement } from './insigneLogic';
import { setCrewInsigne } from '@/services/v2/referralService';
import { supabase } from '@/lib/supabase';

const BUCKET = 'crew-insignes';

export type ResultatInsigne =
  | { ok: true; chemin: string; moderationRequise: boolean }
  | { ok: false; error: string }
  | { ok: false; annule: true };

/**
 * Ouvre la photothèque, valide, envoie, puis pose le chemin.
 *
 * L'annulation N'EST PAS une erreur : elle se distingue dans le type de retour,
 * pour que l'écran ne fasse pas surgir un message rouge quand le capitaine
 * ferme simplement le sélecteur.
 */
export async function televerserInsigne(crewId: string): Promise<ResultatInsigne> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    return { ok: false, error: 'Autorisez l’accès à vos photos pour choisir un insigne.' };
  }

  const choix = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    // Un insigne est un emblème : le carré est sa forme, et recadrer ici évite
    // de déformer l'image au rendu.
    aspect: [1, 1],
    quality: 0.9,
  });
  if (choix.canceled) return { ok: false, annule: true };

  const asset = choix.assets[0];
  if (!asset) return { ok: false, error: 'Aucune image n’a été retenue.' };

  // La règle pure décide. Elle est appelée AVANT la lecture du fichier : refuser
  // un fichier de quatre méga-octets ne doit pas coûter sa lecture complète.
  const refus = validerTeleversement({
    mimeType: asset.mimeType ?? null,
    octets: asset.fileSize ?? null,
  });
  if (refus) return { ok: false, error: refus };

  const mime = asset.mimeType ?? 'image/jpeg';

  // Même contournement que `pilotMediaService` : le typage RN du Blob est plus
  // étroit que son runtime. Cast type-only, aucun changement de comportement.
  const BlobCtor = Blob as unknown as new (parts: Uint8Array[], options: { type: string }) => Blob;
  let blob: Blob;
  try {
    const base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    blob = new BlobCtor([Buffer.from(base64, 'base64')], { type: mime });
  } catch (e) {
    console.warn('[OXV][insigne] lecture :', e);
    return { ok: false, error: 'Cette image n’a pas pu être lue. Réessayez avec une autre.' };
  }

  // Chemin DÉTERMINISTE : `<crew_id>/insigne.<ext>`. Une écurie n'a qu'un
  // insigne, donc un seul fichier — et `upsert` remplace le précédent au lieu
  // d'accumuler des orphelins à chaque changement d'avis.
  //
  // Le premier segment n'est pas décoratif : `crew_insignes_capitaine_ecrit`
  // compare `(storage.foldername(name))[1]` à l'écurie du capitaine.
  const chemin = cheminInsigne(crewId, `insigne.${extensionDe(mime)}`);

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(chemin, blob, { contentType: mime, upsert: true });
  if (upErr) {
    console.warn('[OXV][insigne] envoi :', upErr.message);
    return { ok: false, error: 'L’envoi de l’insigne a échoué. Réessayez dans un instant.' };
  }

  const pose = await setCrewInsigne(null, chemin);
  if (!pose.ok) {
    return { ok: false, error: pose.error ?? 'L’insigne n’a pas pu être enregistré.' };
  }

  return { ok: true, chemin, moderationRequise: pose.moderationRequise === true };
}

/**
 * URL signée d'un insigne, ou `null`.
 *
 * Le bucket n'est PAS public : la politique `crew_insignes_lecture` décide, à
 * chaque demande, si le lecteur a le droit de voir cette image. Un `null` ici
 * n'est donc pas forcément une panne — c'est souvent la règle qui s'applique,
 * et l'écran doit le traiter comme une absence, pas comme une erreur.
 */
export async function urlInsigne(chemin: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(chemin, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
