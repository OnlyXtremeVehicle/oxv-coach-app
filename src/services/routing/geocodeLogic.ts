/**
 * Géocodage — la part qui se teste, sans un appel réseau.
 *
 * ===========================================================================
 * CE QUE ÇA OUVRE
 * ===========================================================================
 *
 * Jusqu'ici, une route se composait au doigt : appui long pour le départ,
 * appui pour l'arrivée. C'est juste sur une carte qu'on connaît, et impraticable
 * dès qu'on veut partir d'une adresse — un hôtel, une place de village, le
 * domicile d'un pilote.
 *
 * GraphHopper fait le géocodage avec **la même clé** que le calcul
 * d'itinéraire : `EXPO_PUBLIC_GRAPHHOPPER_KEY`. Rien de nouveau à souscrire, et
 * l'hébergement européen déjà retenu pour le routage vaut ici aussi — une
 * adresse saisie est une donnée personnelle, elle ne part pas ailleurs.
 *
 * ===========================================================================
 * DEUX SENS, ET LE SECOND EST CELUI QU'ON OUBLIE
 * ===========================================================================
 *
 * **Direct** : « Château de Beaulon » → un point. C'est ce qu'on demande.
 *
 * **Inverse** : un point → « D145, Saint-Dizant-du-Gua ». C'est ce dont on a
 * besoin sans le formuler. Un appui long posait un départ muet, désigné par
 * « point choisi » — le pilote ne pouvait ni le vérifier ni le raconter. Nommer
 * ce qu'il vient de toucher coûte un appel et change la nature de l'écran.
 *
 * Zéro dépendance React Native : testé en node.
 */

import type { GeoPoint } from './types';

/** Longueur minimale d'une recherche. En deçà, le service répond n'importe quoi. */
export const RECHERCHE_MIN = 3;

/** Une réponse de géocodage, réduite à ce dont l'application se sert. */
export interface AdresseTrouvee {
  readonly point: GeoPoint;
  /** Ce qui s'affiche dans la liste — déjà composé, jamais reconstruit à l'écran. */
  readonly libelle: string;
  /** Le nom seul, pour porter celui de l'étape ou de l'arrivée. */
  readonly nom: string;
}

/** Un « hit » GraphHopper, tel que l'API le rend. Champs tous optionnels chez eux. */
export interface HitGeocode {
  readonly point?: { lat?: number; lng?: number };
  readonly name?: string;
  readonly housenumber?: string;
  readonly street?: string;
  readonly postcode?: string;
  readonly city?: string;
  readonly state?: string;
  readonly country?: string;
}

/**
 * Valide une recherche AVANT l'appel. Rend le message à afficher, ou `null`.
 *
 * Deux caractères rendent des centaines de résultats sans rapport ; l'utilisateur
 * croit alors que le service fonctionne mal, alors qu'il n'a pas assez dit.
 */
export function validerRecherche(q: string): string | null {
  const propre = q.trim();
  if (propre.length === 0) return 'Saisissez une adresse ou un lieu.';
  if (propre.length < RECHERCHE_MIN) return `${RECHERCHE_MIN} caractères au minimum.`;
  return null;
}

/**
 * Compose le libellé d'un résultat : « 12 rue des Vignes, 17240 Saint-Fort ».
 *
 * L'ORDRE DES SEGMENTS EST CELUI D'UNE ADRESSE FRANÇAISE, et les vides sautent
 * plutôt que de laisser des virgules orphelines. Un `name` qui répète déjà la
 * rue n'est pas dupliqué — GraphHopper rend souvent les deux.
 */
export function libelleAdresse(h: HitGeocode): string {
  const rue = [h.housenumber, h.street].filter(Boolean).join(' ').trim();
  const ville = [h.postcode, h.city].filter(Boolean).join(' ').trim();
  const nom = (h.name ?? '').trim();

  // Le pays ne s'affiche qu'à l'étranger : « France » sur chaque ligne d'une
  // liste française est du bruit qui pousse le reste hors de l'écran.
  const pays = h.country && h.country !== 'France' ? h.country : '';

  /**
   * LA DÉDUPLICATION SE FAIT SUR LA LISTE ENTIÈRE, et pas par comparaisons deux
   * à deux. Une première écriture excluait le nom quand il valait la rue, et la
   * rue quand elle valait le nom : sur `name === street` — le cas le plus
   * FRÉQUENT chez GraphHopper — les deux conditions s'annulaient et la rue
   * disparaissait purement et simplement.
   *
   * Filtrer les répétitions d'une liste ordonnée traite ce cas et celui, tout
   * aussi courant, du nom qui redit la ville (« Pons, Pons »).
   */
  const vus = new Set<string>();
  return [nom, rue, ville, pays]
    .filter((s) => {
      if (!s || vus.has(s)) return false;
      vus.add(s);
      return true;
    })
    .join(', ');
}

/**
 * Convertit un hit en adresse utilisable, ou `null` s'il n'est pas projetable.
 *
 * Un hit sans coordonnées finies est écarté : le tracer reviendrait à inventer
 * sa position, et GraphHopper en rend parfois sur des entités administratives.
 */
export function versAdresse(h: HitGeocode): AdresseTrouvee | null {
  const lat = h.point?.lat;
  const lng = h.point?.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const libelle = libelleAdresse(h);
  if (libelle.length === 0) return null;

  return {
    point: { lat: lat as number, lon: lng as number },
    libelle,
    nom: (h.name ?? '').trim() || libelle,
  };
}

/**
 * Nettoie une liste de résultats : écarte l'improjetable, puis les doublons.
 *
 * LE DÉDOUBLONNAGE SE FAIT SUR LA POSITION ARRONDIE, pas sur le libellé.
 * GraphHopper rend volontiers le même lieu sous deux noms — « Mairie » et
 * « Hôtel de ville » — au même point. Comparer les textes les garderait tous
 * les deux ; cinq décimales valent environ un mètre, ce qui suffit largement à
 * dire « c'est le même endroit ».
 */
export function nettoyerResultats(hits: readonly HitGeocode[]): AdresseTrouvee[] {
  const vus = new Set<string>();
  const out: AdresseTrouvee[] = [];

  for (const h of hits) {
    const a = versAdresse(h);
    if (a === null) continue;
    const cle = `${a.point.lat.toFixed(5)},${a.point.lon.toFixed(5)}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push(a);
  }
  return out;
}
