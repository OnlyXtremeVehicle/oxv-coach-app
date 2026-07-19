/**
 * Iconographie OXV V2 — registre pur (programme V2, lot L0, livrable 3).
 *
 * 20 icônes « instrument », dessinées à la main sur une grille 24×24,
 * en rapport avec la piste. Chaque entrée est une liste de paths SVG
 * (attribut `d` uniquement) : AUCUNE couleur ici, aucun attribut de style —
 * le trait (1.5, terminaisons rondes) et la couleur sont appliqués par le
 * composant `OxvIcon`. Seule `rec` est pleine (fill), toutes les autres
 * sont au trait.
 *
 * Module .ts pur, sans dépendance native : testable sous jest node.
 */

export const OXV_ICON_NAMES = [
  'miroir',
  'data',
  'club',
  'vous',
  'rec',
  'chrono',
  'circuit',
  'casque',
  'gants',
  'drapeau-damier',
  'cle',
  'coeur',
  'montre',
  'ceinture',
  'camera',
  'convoi',
  'groupe',
  'insigne',
  'meteo-piste',
  'incident',
] as const;

export type OxvIconName = (typeof OXV_ICON_NAMES)[number];

/** Icônes rendues pleines (fill) par le composant — le reste est au trait. */
export const OXV_FILLED_ICONS: readonly OxvIconName[] = ['rec'] as const;

export const OXV_ICONS: Record<OxvIconName, string[]> = {
  // Rétroviseur intérieur galbé : tige de fixation, coque aux angles bas
  // très arrondis, reflet courbe du verre.
  miroir: [
    'M12 3.5 L12 6.5',
    'M10 3.5 L14 3.5',
    'M3.5 9.5 C3.5 7.8 4.8 6.5 6.5 6.5 L17.5 6.5 C19.2 6.5 20.5 7.8 20.5 9.5 L20.5 12.5 C20.5 15.2 18 16.5 15.5 16.5 L8.5 16.5 C6 16.5 3.5 15.2 3.5 12.5 Z',
    'M7 13 C8.5 10.5 11 9.3 14 9.5',
  ],
  // Courbe de télémétrie sur grille : cadre, croisée d'axes, trace.
  data: [
    'M3.5 6.5 C3.5 5.4 4.4 4.5 5.5 4.5 L18.5 4.5 C19.6 4.5 20.5 5.4 20.5 6.5 L20.5 17.5 C20.5 18.6 19.6 19.5 18.5 19.5 L5.5 19.5 C4.4 19.5 3.5 18.6 3.5 17.5 Z',
    'M12 4.5 L12 19.5',
    'M3.5 12 L20.5 12',
    'M6 16 C7.8 16 8.2 8.8 10.2 8.8 C12.2 8.8 12 14.5 14 14.5 C16 14.5 16.2 10.5 18 10.5',
  ],
  // Fanion de paddock : hampe et flamme triangulaire.
  club: ['M6.5 3.5 L6.5 20.5', 'M6.5 5 L18.5 8.25 L6.5 11.5 Z'],
  // Casque de profil, mentonnière et fente de visière vers l'avant.
  vous: [
    'M4.5 13.5 C4.5 8 8.5 4.5 13 4.5 C16.6 4.5 19.5 7.4 19.5 11 L19.5 12.5 C19.5 13.6 18.6 14.5 17.5 14.5 L16.5 14.5 L16.5 17.5 C16.5 18.6 15.6 19.5 14.5 19.5 L6.5 19.5 C5.4 19.5 4.5 18.6 4.5 17.5 Z',
    'M11.5 9.5 C13.5 8.6 16.5 8.6 19.2 9.6',
  ],
  // Cercle plein — la SEULE icône remplie du set (enregistrement).
  rec: ['M5 12 A7 7 0 1 0 19 12 A7 7 0 1 0 5 12 Z'],
  // Chronographe : boîtier, couronne, deux poussoirs, aiguille.
  chrono: [
    'M5.5 13.5 A6.5 6.5 0 1 0 18.5 13.5 A6.5 6.5 0 1 0 5.5 13.5 Z',
    'M12 7 L12 3.8',
    'M10.3 3.8 L13.7 3.8',
    'M7.2 8.7 L5.6 7.1',
    'M16.8 8.7 L18.4 7.1',
    'M12 13.5 L14.6 10.9',
  ],
  // Tracé bouclé fermé, avec repère de ligne de départ.
  circuit: [
    'M8.5 19.5 C5.5 19.5 3.8 17.3 4.6 15.1 C5.4 12.9 8.2 13.3 9.8 11.7 C11.4 10.1 9.6 7.6 11.4 5.9 C13.1 4.3 16.2 4.4 18.1 6.1 C20 7.8 20.3 10.4 18.6 11.9 C16.9 13.4 14.4 12.4 13.5 14.6 C12.6 16.8 14.8 17.4 13.2 19 C12.2 20 10.5 19.5 8.5 19.5 Z',
    'M8.5 20.5 L8.5 18.5',
  ],
  // Casque de face : calotte, bandeau de visière, aération mentonnière.
  casque: [
    'M4.5 12 C4.5 7 7.8 3.5 12 3.5 C16.2 3.5 19.5 7 19.5 12 L19.5 17 C19.5 18.9 17.9 20.5 16 20.5 L8 20.5 C6.1 20.5 4.5 18.9 4.5 17 Z',
    'M6.5 10.3 C9.5 9.4 14.5 9.4 17.5 10.3 L17.5 12.4 C14.5 13.3 9.5 13.3 6.5 12.4 Z',
    'M9.5 17 L14.5 17',
  ],
  // Gant : trois doigts, pouce et paume.
  gants: [
    'M9 11.5 L9 6 C9 5.2 9.7 4.5 10.5 4.5 C11.3 4.5 12 5.2 12 6 L12 10.5',
    'M12 10.5 L12 4.5 C12 3.7 12.7 3 13.5 3 C14.3 3 15 3.7 15 4.5 L15 10.5',
    'M15 10.5 L15 6 C15 5.2 15.7 4.5 16.5 4.5 C17.3 4.5 18 5.2 18 6 L18 13.5',
    'M9 11.5 L9 13.2 L7.2 10.9 C6.7 10.2 5.7 10.1 5.1 10.7 C4.5 11.3 4.5 12.2 5 12.9 L8 17.6 C9.2 19.4 11.3 20.5 13.5 20.5 L14 20.5 C16.5 20.5 18 18.5 18 15.8 L18 13.5',
  ],
  // Drapeau damier : hampe, flamme ondulée, découpes du damier.
  'drapeau-damier': [
    'M5 3.5 L5 20.5',
    'M5 4.8 C7.5 3.4 10 6 12.5 5 C15 4 17 4.2 19.5 5.2 L19.5 12.7 C17 11.7 15 11.5 12.5 12.5 C10 13.5 7.5 10.9 5 12.3 Z',
    'M5 8.55 C7.5 7.15 10 9.75 12.5 8.75 C15 7.75 17 7.95 19.5 8.95',
    'M9.8 5.2 L9.8 12.7',
    'M14.7 4.7 L14.7 12.2',
  ],
  // Clé à molette fine : tête ouverte, manche en trait simple.
  cle: ['M16.6 3.7 A4.6 4.6 0 1 0 20.3 7.4 L18.5 9.2 L14.8 5.5 Z', 'M12.4 11.6 L4.6 19.4'],
  // Biométrie : coeur et trace de pouls.
  coeur: [
    'M12 20 C7.2 16.4 3.5 13.2 3.5 9.3 C3.5 6.5 5.6 4.5 8.2 4.5 C9.8 4.5 11.2 5.3 12 6.6 C12.8 5.3 14.2 4.5 15.8 4.5 C18.4 4.5 20.5 6.5 20.5 9.3 C20.5 13.2 16.8 16.4 12 20 Z',
    'M6.8 11.5 L9.3 11.5 L10.8 8.9 L12.8 13.9 L14.3 11.5 L17.2 11.5',
  ],
  // Montre connectée : boîtier, brins, couronne et bouton latéral.
  montre: [
    'M7 7.5 C7 6.4 7.9 5.5 9 5.5 L15 5.5 C16.1 5.5 17 6.4 17 7.5 L17 16.5 C17 17.6 16.1 18.5 15 18.5 L9 18.5 C7.9 18.5 7 17.6 7 16.5 Z',
    'M9 5.5 L9.5 3 L14.5 3 L15 5.5',
    'M9 18.5 L9.5 21 L14.5 21 L15 18.5',
    'M17 9.6 L18.6 9.6',
    'M17 13 L18.3 13',
  ],
  // Ceinture cardio : sangle deux brins, capteur central, pouls.
  ceinture: [
    'M3.5 12 C3.5 10.9 4.4 10 5.5 10 L8.5 10 L8.5 14 L5.5 14 C4.4 14 3.5 13.1 3.5 12 Z',
    'M20.5 12 C20.5 10.9 19.6 10 18.5 10 L15.5 10 L15.5 14 L18.5 14 C19.6 14 20.5 13.1 20.5 12 Z',
    'M8.5 9.5 C8.5 8.4 9.4 7.5 10.5 7.5 L13.5 7.5 C14.6 7.5 15.5 8.4 15.5 9.5 L15.5 14.5 C15.5 15.6 14.6 16.5 13.5 16.5 L10.5 16.5 C9.4 16.5 8.5 15.6 8.5 14.5 Z',
    'M10 12 L11 12 L12 10.4 L12.9 13.6 L13.6 12 L14 12',
  ],
  // Caméra embarquée : corps à épaulement, objectif.
  camera: [
    'M3.5 9 C3.5 7.9 4.4 7 5.5 7 L7.6 7 L9.2 5 L14.8 5 L16.4 7 L18.5 7 C19.6 7 20.5 7.9 20.5 9 L20.5 17 C20.5 18.1 19.6 19 18.5 19 L5.5 19 C4.4 19 3.5 18.1 3.5 17 Z',
    'M8.8 12.8 A3.2 3.2 0 1 0 15.2 12.8 A3.2 3.2 0 1 0 8.8 12.8 Z',
  ],
  // Convoi : trois chevrons de route.
  convoi: [
    'M4.5 6.5 L10 12 L4.5 17.5',
    'M9.75 6.5 L15.25 12 L9.75 17.5',
    'M15 6.5 L20.5 12 L15 17.5',
  ],
  // Groupe : trois casques, celui du centre au premier plan.
  groupe: [
    'M8.5 16.5 L8.5 12.5 C8.5 10.3 10 8.8 12 8.8 C14 8.8 15.5 10.3 15.5 12.5 L15.5 16.5 Z',
    'M10 12 L14 12',
    'M3.5 16.5 L3.5 13 C3.5 11.1 4.7 9.7 6.4 9.7 C7.2 9.7 7.9 10 8.4 10.6',
    'M20.5 16.5 L20.5 13 C20.5 11.1 19.3 9.7 17.6 9.7 C16.8 9.7 16.1 10 15.6 10.6',
  ],
  // Bouclier OXV : écu et chevron V.
  insigne: [
    'M12 3.5 L19.5 6.2 L19.5 11.5 C19.5 15.9 16.6 19.2 12 20.5 C7.4 19.2 4.5 15.9 4.5 11.5 L4.5 6.2 Z',
    'M9 9.5 L12 13.8 L15 9.5',
  ],
  // Météo piste : soleil et rayons au-dessus du bitume marqué.
  'meteo-piste': [
    'M9 8.5 A3 3 0 1 0 15 8.5 A3 3 0 1 0 9 8.5 Z',
    'M12 2.7 L12 4.4',
    'M16.4 4.4 L15.2 5.6',
    'M7.6 4.4 L8.8 5.6',
    'M16.1 8.5 L17.9 8.5',
    'M6.1 8.5 L7.9 8.5',
    'M3.5 15 L20.5 15',
    'M5 18 L7.6 18',
    'M10.7 18 L13.3 18',
    'M16.4 18 L19 18',
  ],
  // Triangle fin de signalisation, point d'exclamation.
  incident: [
    'M10.7 5.2 C11.3 4.2 12.7 4.2 13.3 5.2 L20.6 17.9 C21.2 18.9 20.4 20.2 19.3 20.2 L4.7 20.2 C3.6 20.2 2.8 18.9 3.4 17.9 Z',
    'M12 9.8 L12 14',
    'M12 17 L12 17.01',
  ],
};
