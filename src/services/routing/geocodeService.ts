/**
 * Géocodage GraphHopper — l'appel réseau, et rien d'autre.
 *
 * La règle vit dans `geocodeLogic` (validation, libellés, déduplication), qui se
 * teste en node. Ici : une requête, un parse défensif, un message français.
 *
 * ===========================================================================
 * LA MÊME CLÉ, LE MÊME HÉBERGEUR
 * ===========================================================================
 *
 * `EXPO_PUBLIC_GRAPHHOPPER_KEY` sert déjà au calcul d'itinéraire. Le géocodage
 * n'ajoute donc ni compte, ni fournisseur, ni juridiction : une adresse saisie
 * par un pilote reste dans le même périmètre européen que le reste du routage.
 *
 * Sans clé, les deux fonctions rendent `null` SANS APPELER. L'écran le dit
 * plutôt que de faire tourner un indicateur devant une requête qui ne partira
 * pas — c'est déjà le motif de `HAS_ROUTING_KEY` dans le composeur.
 */

import { nettoyerResultats, type AdresseTrouvee, type HitGeocode } from './geocodeLogic';
import type { GeoPoint } from './types';

const BASE = 'https://graphhopper.com/api/1/geocode';

/** Nombre de propositions rendues. Au-delà, la liste couvre la carte. */
const LIMITE = 6;

/**
 * Délai au bout duquel on renonce.
 *
 * Une recherche d'adresse se fait au clavier, sous les yeux du pilote : passé
 * quelques secondes, il a déjà retapé sa requête. Mieux vaut abandonner et le
 * dire que laisser deux appels se courir après.
 */
const DELAI_MS = 8000;

function cle(): string | null {
  const k = process.env.EXPO_PUBLIC_GRAPHHOPPER_KEY;
  return typeof k === 'string' && k.trim().length > 0 ? k.trim() : null;
}

/** `true` si le géocodage est utilisable — l'écran s'en sert pour ne rien promettre. */
export function geocodageDisponible(): boolean {
  return cle() !== null;
}

async function appeler(params: Record<string, string>): Promise<HitGeocode[] | null> {
  const k = cle();
  if (k === null) return null;

  const url = new URL(BASE);
  for (const [nom, valeur] of Object.entries(params)) url.searchParams.set(nom, valeur);
  url.searchParams.set('locale', 'fr');
  url.searchParams.set('key', k);

  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);
  try {
    const rep = await fetch(url.toString(), { signal: controleur.signal });
    if (!rep.ok) {
      console.warn('[OXV][geocode] HTTP', rep.status);
      return null;
    }
    const json: unknown = await rep.json();
    const hits = (json as { hits?: unknown })?.hits;
    // Parse DÉFENSIF : une réponse mal formée ne doit pas jeter dans un écran.
    return Array.isArray(hits) ? (hits as HitGeocode[]) : [];
  } catch (e) {
    console.warn('[OXV][geocode]', e);
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}

/**
 * Cherche une adresse ou un lieu. `null` = la recherche n'a pas pu aboutir
 * (pas de clé, réseau, délai) — distinct d'une liste VIDE, qui veut dire « rien
 * ne correspond ». L'écran ne dit pas la même chose dans les deux cas.
 *
 * `pres` biaise les résultats autour d'un point, sans les y borner : cherchant
 * « la poste », un pilote veut celle d'à côté, pas la première de France.
 */
export async function chercherAdresse(
  q: string,
  pres?: GeoPoint
): Promise<AdresseTrouvee[] | null> {
  const params: Record<string, string> = { q: q.trim(), limit: String(LIMITE) };
  if (pres && Number.isFinite(pres.lat) && Number.isFinite(pres.lon)) {
    params.point = `${pres.lat},${pres.lon}`;
  }
  const hits = await appeler(params);
  return hits === null ? null : nettoyerResultats(hits);
}

/**
 * Nomme un point — le sens qu'on oublie de demander.
 *
 * Un appui long posait jusqu'ici un départ muet, étiqueté « point choisi » : le
 * pilote ne pouvait ni le vérifier, ni le raconter à quelqu'un. Un appel, et
 * l'écran dit « D145, Saint-Dizant-du-Gua ».
 *
 * `null` si le service n'aboutit pas OU si aucun lieu ne correspond. Dans les
 * deux cas l'appelant garde son libellé de repli : nommer un point est un
 * CONFORT, jamais une condition pour composer sa route.
 */
export async function adresseDuPoint(point: GeoPoint): Promise<AdresseTrouvee | null> {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) return null;
  const hits = await appeler({
    reverse: 'true',
    point: `${point.lat},${point.lon}`,
    limit: '1',
  });
  if (hits === null) return null;
  return nettoyerResultats(hits)[0] ?? null;
}
