/**
 * LES VIRAGES DU CIRCUIT RÉELLEMENT ROULÉ. Logique PURE.
 *
 * ===========================================================================
 * CE QUE CE MODULE REMPLACE, ET CE QUE ÇA COÛTAIT
 * ===========================================================================
 *
 * Jusqu'au 30/08/2026, le bilan interrogeait `BELTOISE_CORNERS` — **sept
 * virages écrits en dur**, ceux de Haute Saintonge. Sur n'importe quelle autre
 * séance, l'application cherchait des notes de coach sur des virages qui
 * n'existent pas là, et nommait « Saintonge 3 » le troisième virage d'un
 * circuit qui n'est pas Haute Saintonge.
 *
 * Les trois circuits du calendrier portent désormais leurs virages en base,
 * mesurés par `corners-v1` : Bouteville 12, le Bugatti 9, Albi 8. Ce module
 * les lit.
 *
 * ===========================================================================
 * IL NE FABRIQUE AUCUN NOM
 * ===========================================================================
 *
 * Le détecteur rend `name: null` — nommer un virage est un acte éditorial, pas
 * un calcul. Un virage sans nom s'appelle donc « Virage N », et c'est honnête :
 * le pilote sait de quel virage on parle sans qu'on lui invente un toponyme.
 *
 * ===========================================================================
 * AUCUN VIRAGE N'EST UN CAS NORMAL
 * ===========================================================================
 *
 * Un circuit peut n'avoir jamais été passé au détecteur — Bouteville était dans
 * ce cas jusqu'au 30/08. La liste est alors VIDE, pas fausse : l'appelant
 * n'interroge aucun virage et n'affiche aucune pastille. C'est le repli sûr,
 * et il se distingue à l'œil d'un circuit qui n'a réellement pas de virage.
 */

/** Un virage tel que la base le porte. */
export interface VirageCircuit {
  /** Numéro du virage, en base 1, dans le sens de la marche. */
  index: number;
  /** Nom éditorial, ou `null` — le détecteur n'en invente pas. */
  nom: string | null;
  /** Sens du virage, tel que mesuré. */
  sens: 'gauche' | 'droite' | null;
  /** Position curviligne de la corde, 0 à 1 depuis la ligne d'arrivée. */
  positionNormalisee: number | null;
  /** Rayon estimé, en mètres. */
  rayonM: number | null;
}

/**
 * Ce que la colonne `circuits.corners` porte, réduit à ce qu'on lit.
 * Volontairement permissif : la charge utile vient de la base, pas d'ici.
 */
interface ChargeVirages {
  n_corners?: unknown;
  corners?: unknown;
}

function nombreFini(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function sensDe(v: unknown): 'gauche' | 'droite' | null {
  if (v === 'left') return 'gauche';
  if (v === 'right') return 'droite';
  return null;
}

/**
 * Lit la charge utile `circuits.corners`.
 *
 * Ne rejette JAMAIS : une charge illisible rend une liste vide. Un bilan ne
 * doit pas tomber parce qu'un circuit porte un `corners` d'une forme qu'on
 * n'attendait pas — il affichera une pastille de moins.
 */
export function lireViragesCircuit(charge: unknown): VirageCircuit[] {
  if (charge === null || typeof charge !== 'object') return [];
  const brut = (charge as ChargeVirages).corners;
  if (!Array.isArray(brut)) return [];

  const virages: VirageCircuit[] = [];
  for (const c of brut) {
    if (c === null || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    const index = nombreFini(o.corner_index);
    // Un virage sans numéro n'est pas adressable : les notes de coach sont
    // classées par index, et un `null` les rattacherait toutes ensemble.
    if (index === null || index < 1) continue;
    virages.push({
      index: Math.round(index),
      nom: typeof o.name === 'string' && o.name.trim().length > 0 ? o.name.trim() : null,
      sens: sensDe(o.direction),
      positionNormalisee: nombreFini(o.apex_s_norm),
      rayonM: nombreFini(o.r_m),
    });
  }
  // L'ordre de la base fait foi, mais on ne s'y fie pas : le tri par index
  // garantit que « virage suivant » veut dire la même chose partout.
  return virages.sort((a, b) => a.index - b.index);
}

/**
 * Le nom à afficher pour un virage.
 *
 * `Virage N` quand la base n'en porte pas — jamais un nom emprunté à un autre
 * circuit, ce que faisait l'ancien chemin.
 */
export function nomVirage(virages: readonly VirageCircuit[], index: number): string {
  const v = virages.find((x) => x.index === index);
  return v?.nom ?? `Virage ${index}`;
}

/** Les numéros à interroger, dans l'ordre. Liste vide = rien à demander. */
export function indexDesVirages(virages: readonly VirageCircuit[]): number[] {
  return virages.map((v) => v.index);
}
