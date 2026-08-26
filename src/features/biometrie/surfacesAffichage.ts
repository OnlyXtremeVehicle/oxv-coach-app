/**
 * surfacesAffichage — où un fait peut être LU, par qui, et sous quelles
 * conditions (lot 10a).
 *
 * Module PUR : aucune I/O, aucun React, aucun natif.
 *
 * ===========================================================================
 * LES LUNETTES NE SONT PAS UNE SOURCE. C'EST TOUT L'OBJET DE CE FICHIER.
 * ===========================================================================
 *
 * La demande du lot nommait « montre Apple, ceinture cardio, lunettes Meta »
 * dans une même phrase. Les deux premières mesurent un cœur. La troisième n'a
 * aucun capteur que cette application lise : elle AFFICHE. Les ranger ensemble
 * conduirait, tôt ou tard, à une ligne de code qui demande aux lunettes « quelle
 * est la fréquence cardiaque » — et à une réponse fabriquée.
 *
 * D'où deux registres, jamais un seul :
 *   - `sourcesBiometrie.ts` : ce qui MESURE (ceinture BLE, montre Apple) ;
 *   - ce fichier : ce qui MONTRE (téléphones, lunettes, écran de paddock).
 *
 * Une garde vérifie que les deux ensembles d'identifiants restent disjoints.
 *
 * ===========================================================================
 * ET LE PRINCIPE 3 — LE SILENCE EN PISTE
 * ===========================================================================
 *
 * « Pendant que le véhicule est en mouvement, aucun écran n'est affiché. »
 *
 * Les lunettes Meta Ray-Ban Display sont donc admises à UNE seule condition, et
 * elle n'est pas négociable : elles sont portées par le COACH, au BORD de la
 * piste. Jamais par le pilote, jamais au volant, jamais comme afficheur tête
 * haute. Ce que le dépôt fait déjà — `app/(coach)/ar.tsx` vit sous le rôle
 * coach et le dit dans son en-tête — mais ne VÉRIFIAIT nulle part.
 *
 * Ici, cela devient une donnée du registre (`visibleEnRoulage`) et une garde :
 * aucune surface déclarée n'est visible d'un pilote en roulage. Le jour où
 * quelqu'un ajoute une surface qui l'est, le test devient rouge, et la décision
 * se prend sciemment au lieu d'arriver par la porte de service.
 *
 * Et ce que les lunettes montrent reste ce que `ar.tsx` montre déjà : des FAITS
 * déjà mesurés — chrono, écart à la référence personnelle du pilote, fréquence
 * cardiaque si le partage est consenti. Jamais une consigne. Le coach lit, le
 * coach décide, sous sa responsabilité.
 */

/** Les surfaces d'AFFICHAGE reconnues. Aucune ne mesure quoi que ce soit. */
export type IdSurface = 'telephone_pilote' | 'telephone_coach' | 'lunettes_coach' | 'ecran_paddock';

/** Qui porte la surface — et donc de qui elle est l'outil. */
export type Porteur = 'pilote' | 'coach' | 'public';

export interface SurfaceAffichage {
  id: IdSurface;
  porteur: Porteur;
  libelle: string;
  /**
   * Cette surface peut-elle porter une donnée de santé, partage consenti mis à
   * part ? `false` est une interdiction de PLACE, que le consentement ne lève
   * pas : l'écran du paddock est public, et aucun accord ne rend une donnée de
   * l'article 9 publique.
   */
  admetSante: boolean;
  /**
   * Cette surface est-elle sous les yeux d'un pilote pendant qu'il roule ?
   *
   * Toutes valent `false`, et une garde le vérifie. Le champ existe pour que
   * l'ajout d'un afficheur tête haute soit un acte visible, pas un oubli.
   */
  visibleEnRoulage: boolean;
  /** Matériel encore en avant-première : à marquer « EXPÉRIMENTAL » à l'écran. */
  experimentale: boolean;
}

/**
 * Le téléphone du pilote — la surface de la restitution, à l'ARRÊT.
 *
 * `visibleEnRoulage: false` n'est pas une propriété du matériel, c'est le
 * Principe 3 : pendant le roulage, l'application dort. Le flux REC n'affiche
 * rien au volant, le bilan attend la fin de la séance.
 */
export const SURFACE_TELEPHONE_PILOTE: SurfaceAffichage = {
  id: 'telephone_pilote',
  porteur: 'pilote',
  libelle: 'Votre téléphone',
  admetSante: true,
  visibleEnRoulage: false,
  experimentale: false,
};

/** Le téléphone du coach — canal privé du binôme, à l'arrêt comme au bord de piste. */
export const SURFACE_TELEPHONE_COACH: SurfaceAffichage = {
  id: 'telephone_coach',
  porteur: 'coach',
  libelle: 'Téléphone du coach',
  admetSante: true,
  visibleEnRoulage: false,
  experimentale: false,
};

/**
 * Les lunettes Meta Ray-Ban Display, portées par le COACH au bord de la piste.
 *
 * Elles ne mesurent rien. Elles rendent des faits déjà mesurés, sur le canal
 * privé du binôme consenti — le même que le téléphone du coach, pas le canal
 * public du paddock. `experimentale` reflète l'état réel : le matériel est en
 * developer preview Meta, l'écran de configuration le marque déjà ainsi, et
 * l'appairage n'existe pas encore (`ar.tsx` affiche « Non appairées — aperçu »
 * plutôt que de simuler une connexion).
 */
export const SURFACE_LUNETTES_COACH: SurfaceAffichage = {
  id: 'lunettes_coach',
  porteur: 'coach',
  libelle: 'Lunettes du coach',
  admetSante: true,
  visibleEnRoulage: false,
  experimentale: true,
};

/**
 * L'écran du paddock — public par destination.
 *
 * `admetSante: false`, et aucun consentement ne le retourne. C'est la même
 * frontière que `liveHealthGate.stripHealth` tient à l'émission ; la porter
 * aussi dans le registre permet de la lire là où l'on décide quoi afficher.
 */
export const SURFACE_ECRAN_PADDOCK: SurfaceAffichage = {
  id: 'ecran_paddock',
  porteur: 'public',
  libelle: 'Écran du paddock',
  admetSante: false,
  visibleEnRoulage: false,
  experimentale: false,
};

export const SURFACES: readonly SurfaceAffichage[] = [
  SURFACE_TELEPHONE_PILOTE,
  SURFACE_TELEPHONE_COACH,
  SURFACE_LUNETTES_COACH,
  SURFACE_ECRAN_PADDOCK,
];

/** Une surface par identifiant. Inconnue → `null` (jamais une surface inventée). */
export function surfaceParId(id: string): SurfaceAffichage | null {
  return SURFACES.find((s) => s.id === id) ?? null;
}

/**
 * Les lunettes sont-elles une source de mesure ? Non, et cette fonction existe
 * pour que la réponse soit citable depuis un test plutôt que depuis un
 * commentaire. Aucune surface d'affichage ne mesure quoi que ce soit.
 */
export function estUneSourceDeMesure(_surface: SurfaceAffichage): false {
  return false;
}

export interface ContexteAffichage {
  /** Le pilote a-t-il consenti le partage de sa santé à ce coach ? */
  partageCoachConsenti: boolean;
}

/**
 * Cette surface peut-elle afficher une donnée de santé, maintenant ?
 * FAIL-CLOSED : entrée douteuse → refus.
 *
 * Trois marches :
 *   1. la surface admet-elle la santé PAR PLACE ? (le paddock : jamais) ;
 *   2. est-elle sous les yeux d'un pilote en roulage ? (aucune ne l'est —
 *      la marche existe pour que l'ajout d'une telle surface soit refusé par
 *      défaut, sans qu'on ait à y penser) ;
 *   3. si elle appartient au coach, le partage doit être consenti. La surface
 *      du pilote, elle, n'a besoin d'aucun partage : ce sont SES données.
 */
export function peutAfficherSante(
  surface: SurfaceAffichage | null,
  contexte: ContexteAffichage
): boolean {
  if (surface === null || typeof surface !== 'object') return false;
  if (surface.admetSante !== true) return false;
  if (surface.visibleEnRoulage === true) return false;
  if (surface.porteur === 'public') return false;
  if (surface.porteur === 'coach') return contexte?.partageCoachConsenti === true;
  return true;
}
