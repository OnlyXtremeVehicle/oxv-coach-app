/**
 * Le trajet d'une sortie d'écurie — la part qui se teste.
 *
 * ===========================================================================
 * CE QUE ÇA RELIE, ET QUI EXISTAIT DÉJÀ SÉPARÉMENT
 * ===========================================================================
 *
 * Quatre briques étaient en place sans se parler :
 *
 *   • `convoys.meeting_point` — un texte libre, jamais un lieu ;
 *   • `convoys.restaurant_id` — posé par la migration, aucun appelant ;
 *   • `planScenicRoute` — accepte des `waypoints` depuis toujours ;
 *   • le géocodage — arrivé le 17/08, qui donne un point à une adresse.
 *
 * Ce module les compose : le rendez-vous, l'étape restaurant, et le circuit
 * comme destination. Rien de neuf n'est inventé — c'est du câblage, et c'est
 * exactement ce qui manquait.
 *
 * ===========================================================================
 * LE SENS DU TRAJET N'EST PAS ARBITRAIRE
 * ===========================================================================
 *
 * Rendez-vous → restaurant → circuit. Dans cet ordre, et pas un autre.
 *
 * L'écurie se retrouve, roule ensemble jusqu'à la table, puis rejoint la piste.
 * Mettre le restaurant après le circuit décrirait une autre journée — celle où
 * l'on mange après avoir roulé — et c'est un choix de produit, pas un détail
 * d'implémentation. Si vous voulez les deux, il faudra une colonne pour le dire,
 * pas une inversion silencieuse ici.
 *
 * ===========================================================================
 * CE QUI EST REFUSÉ, ET POURQUOI ON LE DIT
 * ===========================================================================
 *
 * Un trajet ne se calcule pas sans point de départ ni sans circuit. Plutôt que
 * de rendre `null`, ce module rend une RAISON : le capitaine doit savoir ce
 * qu'il lui manque. « Impossible » sans motif est le message qui fait
 * abandonner.
 *
 * Zéro dépendance React Native : testé en node.
 */

import type { GeoPoint, ScenicRouteRequest } from '@/services/routing/types';

/** Un lieu nommé et projetable — restaurant, rendez-vous, circuit. */
export interface LieuSortie {
  readonly nom: string;
  readonly point: GeoPoint;
}

export interface CompositionSortie {
  /** Où l'écurie se retrouve. Sans lui, rien ne se calcule. */
  readonly rendezVous: LieuSortie | null;
  /** L'étape à table, si le capitaine en a choisi une. */
  readonly restaurant: LieuSortie | null;
  /** La destination — la piste. Sans elle, rien ne se calcule. */
  readonly circuit: LieuSortie | null;
}

export type RefusTrajet = 'sans_rendez_vous' | 'sans_circuit' | 'meme_point';

/** Message affichable d'un refus. Une raison, jamais un « impossible » nu. */
export function messageRefus(r: RefusTrajet): string {
  switch (r) {
    case 'sans_rendez_vous':
      return 'Indiquez d’abord le point de rendez-vous de votre écurie.';
    case 'sans_circuit':
      return 'La journée n’a pas de circuit connu — le trajet ne peut pas être tracé.';
    case 'meme_point':
      return 'Le rendez-vous et le circuit sont au même endroit : il n’y a pas de trajet à tracer.';
  }
}

/** Un point est-il exploitable ? Deux coordonnées finies, et dans les bornes. */
export function pointValide(p: GeoPoint | null | undefined): boolean {
  if (!p) return false;
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return false;
  // Des bornes hors monde viennent d'une colonne mal remplie, jamais d'un GPS.
  return Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
}

/** Deux points sont-ils le même endroit ? Cinq décimales ≈ un mètre. */
function memeEndroit(a: GeoPoint, b: GeoPoint): boolean {
  return a.lat.toFixed(5) === b.lat.toFixed(5) && a.lon.toFixed(5) === b.lon.toFixed(5);
}

export type PlanTrajet =
  | { readonly ok: true; readonly requete: ScenicRouteRequest; readonly etapes: string[] }
  | { readonly ok: false; readonly refus: RefusTrajet };

/**
 * Compose la requête d'itinéraire de la sortie.
 *
 * `etapes` rend les NOMS dans l'ordre du parcours, pour que l'écran raconte le
 * trajet sans avoir à le recomposer — et sans jamais afficher une durée ni une
 * distance, que l'écurie n'a pas à lire comme une performance.
 *
 * `avoidMotorways` reste à `true` : une sortie d'écurie passe par les routes,
 * pas par l'autoroute. C'est le même parti pris que le composeur de belles
 * routes, et il est ici explicite plutôt que laissé au défaut du service.
 */
export function planifierTrajet(c: CompositionSortie): PlanTrajet {
  if (!c.rendezVous || !pointValide(c.rendezVous.point)) {
    return { ok: false, refus: 'sans_rendez_vous' };
  }
  if (!c.circuit || !pointValide(c.circuit.point)) {
    return { ok: false, refus: 'sans_circuit' };
  }
  if (memeEndroit(c.rendezVous.point, c.circuit.point)) {
    return { ok: false, refus: 'meme_point' };
  }

  // Le restaurant n'est une étape que s'il est projetable. Une ligne de la table
  // `restaurants` peut avoir `lat`/`lon` à NULL : on l'ignore SILENCIEUSEMENT
  // pour l'itinéraire — le trajet reste juste, il passe simplement sans détour —
  // mais on ne le nomme pas non plus dans les étapes, pour ne pas annoncer un
  // passage qui n'aura pas lieu.
  const etapeResto = c.restaurant && pointValide(c.restaurant.point) ? c.restaurant : null;

  return {
    ok: true,
    requete: {
      start: c.rendezVous.point,
      end: c.circuit.point,
      waypoints: etapeResto ? [etapeResto.point] : undefined,
      avoidMotorways: true,
    },
    etapes: [c.rendezVous.nom, ...(etapeResto ? [etapeResto.nom] : []), c.circuit.nom],
  };
}

/**
 * Le trajet, dit en une ligne : « Place de Pons → La Table du Cognac → Circuit ».
 *
 * Aucune durée, aucune distance, aucun « le plus rapide ». La sortie d'écurie
 * suit la même règle que le reste de l'écurie : des faits, jamais un chiffre de
 * performance.
 */
export function resumeTrajet(etapes: readonly string[]): string {
  return etapes.filter((e) => e.trim().length > 0).join(' → ');
}
