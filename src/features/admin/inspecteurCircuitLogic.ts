/**
 * L'INSPECTEUR DE CIRCUIT, POUR N'IMPORTE LEQUEL (jalon 7, phase 6).
 *
 * *« L'inspecteur est codé en dur sur Haute Saintonge alors qu'il devient
 * l'éditeur des trois circuits. »* — Plan de montage, Jalon 7.
 *
 * Module PUR : aucune dépendance React, RN ni Supabase. Il traduit une ligne de
 * la table `circuits` en géométrie affichable.
 *
 * ---
 *
 * CE QUI ÉTAIT EN PLACE
 *
 * `app/(admin)/circuit.tsx` importait `HAUTE_SAINTONGE_TRACK`,
 * `HAUTE_SAINTONGE_SEGMENTS` et `BELTOISE_CORNERS` — trois constantes locales.
 * L'écran ne pouvait donc montrer qu'un seul circuit, et le titre affichait son
 * nom en dur.
 *
 * La production en compte quatre, dont **Ricardo Tormo (Valence)**, celui où la
 * première capture réelle doit avoir lieu. L'administrateur ne pouvait pas
 * l'ouvrir.
 *
 * ---
 *
 * LES FORMES SONT CELLES DE LA BASE, PAS CELLES QUE J'IMAGINAIS
 *
 * Relevées le 02/08/2026 sur la table réelle :
 *
 *   `centerline_latlon` — un TABLEAU de `{ lat, lon }`.
 *       Charente 26 points · Ricardo Tormo 135 · Haute Saintonge 65.
 *
 *   `corners` — un OBJET `{ params: {...}, corners: [...] }`, et non un tableau.
 *       Chaque virage porte `corner_index`, `direction`, `apex_s_norm`, `r_m`,
 *       `calibration`, et un `name` qui vaut `null` en base.
 *       **Seul Haute Saintonge en possède.**
 *
 * ---
 *
 * ON NE FABRIQUE RIEN
 *
 * Un circuit sans virages calculés rend une liste VIDE, et l'écran le dit. Il
 * n'invente ni un virage, ni un nom, ni une position. Une forme inattendue vaut
 * absence — jamais une valeur par défaut qui se ferait passer pour une mesure.
 */

/** Un point du tracé. Même forme que `TrackPoint` de `@/trackviz`. */
export interface PointTrace {
  lat: number;
  lon: number;
}

/** Un virage tel que la base le décrit, sans rien y ajouter. */
export interface VirageCircuit {
  /** Numéro de virage, base 1 — comme partout ailleurs dans le dépôt. */
  index: number;
  /** Le nom vaut `null` en base aujourd'hui. On le porte tel quel. */
  nom: string | null;
  /** 'left' | 'right' tel que stocké, ou `null` si absent. */
  direction: string | null;
  /** Position de l'apex sur le tour, 0..1. `null` si absente. */
  apexProgression: number | null;
  /** Rayon estimé en mètres. `null` si absent. */
  rayonM: number | null;
}

/** Ce que l'inspecteur sait d'un circuit, une fois la base traduite. */
export interface GeometrieCircuit {
  points: PointTrace[];
  virages: VirageCircuit[];
}

function nombreFini(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Le tracé, depuis `centerline_latlon`.
 *
 * Rejette silencieusement tout point dont la latitude ou la longitude n'est pas
 * un nombre fini : un `NaN` dans une polyline ne produit pas un point faux, il
 * produit un tracé entier illisible.
 *
 * Les bornes terrestres sont vérifiées. Une longitude de 200° n'existe pas ;
 * l'accepter dessinerait une piste qui part à l'infini et masquerait une
 * corruption de données au lieu de la révéler.
 */
export function pointsDuTrace(brut: unknown): PointTrace[] {
  if (!Array.isArray(brut)) return [];
  const points: PointTrace[] = [];
  for (const p of brut) {
    if (p === null || typeof p !== 'object') continue;
    const { lat, lon } = p as { lat?: unknown; lon?: unknown };
    if (!nombreFini(lat) || !nombreFini(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    points.push({ lat, lon });
  }
  return points;
}

/**
 * Les virages, depuis `corners`.
 *
 * ATTENTION À LA FORME : `corners` est un OBJET dont le champ `corners` porte
 * le tableau. Une première lecture qui traiterait la colonne comme un tableau
 * rendrait une liste vide sur le SEUL circuit qui en possède — et l'écran
 * afficherait « aucun virage » sur Haute Saintonge, ce qui est faux.
 *
 * Un tableau nu est accepté aussi : si la forme stockée change un jour, on ne
 * veut pas perdre les données en silence.
 */
export function viragesDuCircuit(brut: unknown): VirageCircuit[] {
  const tableau = Array.isArray(brut)
    ? brut
    : brut !== null &&
        typeof brut === 'object' &&
        Array.isArray((brut as { corners?: unknown }).corners)
      ? (brut as { corners: unknown[] }).corners
      : null;
  if (tableau === null) return [];

  const virages: VirageCircuit[] = [];
  for (const v of tableau) {
    if (v === null || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    const index = o.corner_index;
    // Sans numéro, un virage n'est rattachable à rien : ni à une annotation, ni
    // à un segment. On le laisse tomber plutôt que de lui en inventer un.
    if (!nombreFini(index) || index < 1) continue;
    virages.push({
      index,
      nom: typeof o.name === 'string' && o.name.trim().length > 0 ? o.name : null,
      direction: typeof o.direction === 'string' && o.direction.length > 0 ? o.direction : null,
      apexProgression: nombreFini(o.apex_s_norm) ? o.apex_s_norm : null,
      rayonM: nombreFini(o.r_m) ? o.r_m : null,
    });
  }
  return virages.sort((a, b) => a.index - b.index);
}

/** Traduit une ligne de `circuits` en géométrie affichable. */
export function geometrieDuCircuit(row: unknown): GeometrieCircuit {
  if (row === null || typeof row !== 'object') return { points: [], virages: [] };
  const o = row as Record<string, unknown>;
  return {
    points: pointsDuTrace(o.centerline_latlon),
    virages: viragesDuCircuit(o.corners),
  };
}

/**
 * Ce que l'écran annonce de la richesse d'un circuit.
 *
 * Une seule phrase, faite de FAITS comptés. Chaque absence se dit « — » et
 * jamais « 0 » : zéro virage mesuré et zéro virage calculé sont deux états
 * différents, et le second n'est pas une mesure.
 */
export function resumeCircuit(g: GeometrieCircuit): string {
  const points = g.points.length > 0 ? `${g.points.length} points GPS` : '— point GPS';
  const virages = g.virages.length > 0 ? `${g.virages.length} virages` : 'virages non calculés';
  return `${points} · ${virages}`;
}

/**
 * Le circuit à ouvrir en arrivant.
 *
 * Le plus documenté d'abord — celui qui a des virages, puis le plus de points.
 * L'administrateur qui ouvre l'inspecteur veut voir quelque chose ; le laisser
 * tomber sur un circuit sans géométrie donne l'impression d'un écran cassé.
 *
 * À égalité, l'ordre de la liste tranche : le résultat ne dépend jamais du
 * hasard, sans quoi deux ouvertures successives montreraient deux circuits.
 */
export function circuitParDefaut<T>(
  circuits: readonly T[],
  geometrie: (c: T) => GeometrieCircuit
): T | null {
  if (!Array.isArray(circuits) || circuits.length === 0) return null;
  let meilleur = circuits[0];
  let meilleurScore = -1;
  for (const c of circuits) {
    const g = geometrie(c);
    // Les virages pèsent plus que les points : ils sont ce que l'inspecteur
    // sert à inspecter.
    const score = g.virages.length * 10000 + g.points.length;
    if (score > meilleurScore) {
      meilleurScore = score;
      meilleur = c;
    }
  }
  return meilleur;
}
