/**
 * FIL DE SÉANCE — le modèle, pur (jalon 6, phase 5).
 *
 * Module sans I/O : ni React, ni React Native, ni Supabase. Des événements
 * entrent, un fil ordonné sort. Tout ce qui décide de ce qu'on lit est ici et se
 * teste.
 *
 * ---
 *
 * CE QU'IL REMPLACE, ET POURQUOI
 *
 * Quatre écrans coach disent aujourd'hui la même séance, chacun de son côté :
 * `triage` (les virages où la marge est la plus courte), `debrief` (la vue calme
 * qu'on montre au pilote), `lecture` (la pondération du coach), `priorites` (les
 * virages qu'il met en avant). **1 986 lignes** pour quatre fenêtres sur un seul
 * objet.
 *
 * Le fil les réunit : une séance, une colonne, et chaque voix reconnaissable.
 *
 * ---
 *
 * TROIS REGISTRES, RECONNAISSABLES SANS LÉGENDE
 *
 *   `machine` — ce qu'OXV a mesuré. Gris. Il ne conclut pas.
 *   `coach`   — ce qu'un humain a écrit. Rouge de marque. Voix ATTRIBUÉE.
 *   `pilote`  — ce que le pilote a posé lui-même. Trait clair.
 *
 * La distinction n'est pas décorative : elle est la doctrine. Le pilote doit
 * pouvoir dire d'un coup d'œil si une phrase vient d'un calcul, de son coach, ou
 * de lui-même. Une lecture machine présentée comme une parole de coach serait un
 * faux ; l'inverse aussi.
 *
 * ---
 *
 * ON N'INVENTE PAS UN ORDRE QU'ON N'A PAS
 *
 * Certains événements sont horodatés (une annotation posée à 14h32, un tour
 * bouclé). D'autres ne le sont pas : ils portent sur la séance ENTIÈRE — la
 * lecture globale, l'intention du jour, la note d'introduction du coach.
 *
 * Les intercaler demanderait de leur inventer un instant. On les tient donc
 * SÉPARÉS, dans un bandeau de tête, et le fil chronologique ne contient que ce
 * qui est réellement daté. Un fil qui ment sur l'ordre ne vaut pas mieux qu'un
 * chiffre fabriqué.
 */

/** D'où vient cette ligne. Détermine sa couleur et son poids. */
export type RegistreFil = 'machine' | 'coach' | 'pilote';

export interface EvenementFil {
  /** Identifiant stable — sert de clé de rendu et de déduplication. */
  id: string;
  registre: RegistreFil;
  /**
   * Instant de l'événement (ms epoch), ou `null` s'il porte sur la séance
   * entière. Un `null` ne descend PAS dans le fil chronologique.
   */
  instantMs: number | null;
  /** Numéro de tour, base 1. `null` si l'événement ne vise pas un tour. */
  tour: number | null;
  /**
   * Numéro de virage, **base 1** — comme `app_segment_analyses.segment_index`,
   * dont la contrainte SQL impose `>= 1 and <= 7`. Ne jamais y écrire un index
   * de tableau sans l'avoir incrémenté (voir D-21).
   */
  virage: number | null;
  titre: string;
  /** Détail facultatif. `null` quand la ligne se suffit à elle-même. */
  corps: string | null;
}

export interface FilSeance {
  /** Ce qui porte sur la séance entière — non daté, donc non intercalé. */
  entete: EvenementFil[];
  /** Ce qui est réellement horodaté, du plus ancien au plus récent. */
  chronologie: EvenementFil[];
  /** Registres réellement présents — sert à n'afficher une légende que si utile. */
  registresPresents: RegistreFil[];
}

/** Un événement exploitable : identifiant non vide et titre non vide. */
function evenementValide(e: EvenementFil): boolean {
  if (e === null || typeof e !== 'object') return false;
  if (typeof e.id !== 'string' || e.id.length === 0) return false;
  if (typeof e.titre !== 'string' || e.titre.trim().length === 0) return false;
  return e.registre === 'machine' || e.registre === 'coach' || e.registre === 'pilote';
}

/** L'instant est-il une mesure utilisable ? */
function instantUtilisable(v: number | null): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

const ORDRE_REGISTRE: Record<RegistreFil, number> = {
  // À instant égal, la mesure vient avant l'interprétation, et le pilote a le
  // dernier mot sur sa propre séance. Ce n'est pas une hiérarchie de valeur :
  // c'est l'ordre dans lequel les choses se produisent réellement.
  machine: 0,
  coach: 1,
  pilote: 2,
};

/**
 * Assemble le fil d'une séance à partir d'événements de sources diverses.
 *
 * Déduplique par `id` — deux sources peuvent décrire le même fait, et le fil ne
 * doit pas le dire deux fois. Le PREMIER rencontré gagne : l'appelant range ses
 * sources par ordre de confiance.
 *
 * L'ordre chronologique départage à instant égal par tour, puis par virage, puis
 * par registre. Jamais par hasard : un fil qui change d'ordre entre deux
 * affichages est illisible.
 */
export function assembleFil(evenements: readonly EvenementFil[]): FilSeance {
  if (!Array.isArray(evenements)) {
    return { entete: [], chronologie: [], registresPresents: [] };
  }

  const vus = new Set<string>();
  const entete: EvenementFil[] = [];
  const dates: EvenementFil[] = [];

  for (const e of evenements) {
    if (!evenementValide(e)) continue;
    if (vus.has(e.id)) continue;
    vus.add(e.id);
    if (instantUtilisable(e.instantMs)) dates.push(e);
    else entete.push(e);
  }

  dates.sort((a, b) => {
    const da = a.instantMs as number;
    const db = b.instantMs as number;
    if (da !== db) return da - db;
    const ta = a.tour ?? Number.POSITIVE_INFINITY;
    const tb = b.tour ?? Number.POSITIVE_INFINITY;
    if (ta !== tb) return ta - tb;
    const va = a.virage ?? Number.POSITIVE_INFINITY;
    const vb = b.virage ?? Number.POSITIVE_INFINITY;
    if (va !== vb) return va - vb;
    return ORDRE_REGISTRE[a.registre] - ORDRE_REGISTRE[b.registre];
  });

  const presents: RegistreFil[] = [];
  for (const r of ['machine', 'coach', 'pilote'] as const) {
    if (entete.some((e) => e.registre === r) || dates.some((e) => e.registre === r)) {
      presents.push(r);
    }
  }

  return { entete, chronologie: dates, registresPresents: presents };
}

/** Le fil ne porte-t-il rien du tout ? Un fil vide s'affiche, il ne se cache pas. */
export function filEstVide(fil: FilSeance): boolean {
  if (fil === null || typeof fil !== 'object') return true;
  return fil.entete.length === 0 && fil.chronologie.length === 0;
}

/**
 * Étiquette d'ancrage d'un événement — « Tour 3 · Virage 5 », ou ce qu'on sait.
 *
 * Rend `null` quand rien n'est connu : l'appelant n'affiche alors pas de puce
 * d'ancrage, plutôt qu'une puce vide. **Le virage est rendu tel quel** : il est
 * déjà en base 1, l'incrémenter une seconde fois désignerait le virage suivant.
 */
export function ancrage(e: EvenementFil): string | null {
  const bouts: string[] = [];
  if (typeof e.tour === 'number' && Number.isFinite(e.tour) && e.tour > 0) {
    bouts.push(`Tour ${e.tour}`);
  }
  if (typeof e.virage === 'number' && Number.isFinite(e.virage) && e.virage > 0) {
    bouts.push(`Virage ${e.virage}`);
  }
  return bouts.length > 0 ? bouts.join(' · ') : null;
}
