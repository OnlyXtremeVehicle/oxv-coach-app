/**
 * STRIP MAP — le développement linéaire du tour. Logique PURE.
 *
 * *« Dérouler le tracé fermé en un axe distance droit, en préservant la
 * position curviligne, pour empiler les bandes de grandeurs. C'est la base
 * distance déjà acquise, mais AVEC LE TRACÉ LUI-MÊME COMME RÈGLE GRADUÉE. »*
 * — banque de télémétrie V3, forme 3.
 *
 * ===========================================================================
 * CE QUE LA RÈGLE GRADUÉE CHANGE
 * ===========================================================================
 *
 * Une courbe en base distance a déjà un axe des abscisses en mètres. Mais
 * « 840 m » ne dit rien à personne : le pilote ne connaît pas son circuit en
 * mètres, il le connaît en virages. La règle, ici, c'est le tracé — les
 * segments posés à leur vraie place et à leur vraie longueur, nommés. On lit
 * « l'épingle », pas « 840 m ».
 *
 * ===========================================================================
 * TROIS FAÇONS DE MENTIR AVEC UN STRIP, ÉCARTÉES ICI
 * ===========================================================================
 *
 * 1. **Étirer les segments pour remplir la bande.** Si l'analyse n'a couvert
 *    que 70 % du tour, une bande pleine affirme une couverture qui n'existe
 *    pas. Les trous restent des trous, et `couverture` les chiffre.
 *
 * 2. **Jeter en silence les segments non situés.** Un segment sans position
 *    exploitable ne peut pas être placé — mais son absence doit se compter,
 *    pas disparaître. D'où `nonSitues`.
 *
 * 3. **Sommer les longueurs pour annoncer la couverture.** Deux segments qui
 *    se recouvrent donneraient une somme supérieure au tour entier. On mesure
 *    donc l'UNION des intervalles, jamais leur somme.
 *
 * ===========================================================================
 * CE QUE CE STRIP NE MONTRE PAS
 * ===========================================================================
 *
 * Le SENS des virages. `app_segment_analyses` ne porte pas de gauche/droite, et
 * la seule table qui en porterait est propre à un circuit codé en dur — que ce
 * dépôt est en train de retirer. Un strip qui inventerait le sens serait plus
 * joli et faux. Il montre donc : où sont les virages, lesquels, et sur quelle
 * longueur.
 */

/** Le strict nécessaire d'une ligne d'analyse de segment pour être située. */
export interface SegmentSituable {
  segmentIndex: number;
  segmentName: string | null;
  kind: string | null;
  /** Début du segment sur le tracé, dans `[0, 1]`. */
  startProgress: number | null;
  /** Fin du segment sur le tracé, dans `[0, 1]`. */
  endProgress: number | null;
}

export type GenreCase = 'turn' | 'chicane' | 'straight' | 'inconnu';

export interface CaseStrip {
  /** Clé de rendu — un segment qui franchit la ligne donne DEUX cases. */
  cle: string;
  segmentIndex: number;
  nom: string;
  genre: GenreCase;
  /** Début et fin en fraction du tour, `0 ≤ debut < fin ≤ 1`. */
  debut: number;
  fin: number;
}

export interface Strip {
  cases: CaseStrip[];
  /** Segments écartés faute de position exploitable — à annoncer, jamais à taire. */
  nonSitues: number;
  /** Part du tour effectivement couverte, dans `[0, 1]` (union, pas somme). */
  couverture: number;
}

const GENRES: ReadonlySet<string> = new Set(['turn', 'chicane', 'straight']);

function genreDe(kind: string | null): GenreCase {
  const k = (kind ?? '').trim().toLowerCase();
  return GENRES.has(k) ? (k as GenreCase) : 'inconnu';
}

/** « V3 » quand le circuit n'a pas nommé son segment — jamais une invention. */
function nomDe(s: SegmentSituable): string {
  const brut = s.segmentName?.trim();
  if (brut) return brut;
  return `V${s.segmentIndex + 1}`;
}

function fractionValide(v: number | null): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
}

/**
 * Mesure de l'UNION d'intervalles, dans `[0, 1]`.
 *
 * C'est le seul calcul honnête de couverture : sommer les longueurs ferait
 * dépasser 100 % dès que deux segments se recouvrent, et une couverture de
 * 118 % n'apprendrait rien à personne.
 */
export function mesureUnion(intervalles: readonly { debut: number; fin: number }[]): number {
  if (intervalles.length === 0) return 0;
  const tries = [...intervalles].sort((a, b) => a.debut - b.debut);
  let total = 0;
  let curDebut = tries[0].debut;
  let curFin = tries[0].fin;
  for (let i = 1; i < tries.length; i++) {
    const it = tries[i];
    if (it.debut > curFin) {
      total += curFin - curDebut;
      curDebut = it.debut;
      curFin = it.fin;
    } else if (it.fin > curFin) {
      curFin = it.fin;
    }
  }
  total += curFin - curDebut;
  return Math.min(1, Math.max(0, total));
}

/**
 * Déroule les segments en cases posées sur l'axe du tour.
 *
 * Un segment dont la fin précède le début FRANCHIT LA LIGNE : c'est un cas
 * réel — le dernier segment d'un tour fermé. Il donne deux cases, `[debut, 1]`
 * et `[0, fin]`, qui portent le même nom. Le recoller en une seule case
 * l'étalerait sur presque tout le tour, à l'envers.
 *
 * Un segment de longueur nulle est écarté : il n'a pas d'étendue à poser, et
 * une case de largeur zéro se rendrait comme un trait parasite.
 */
export function construireStrip(segments: readonly SegmentSituable[]): Strip {
  const cases: CaseStrip[] = [];
  let nonSitues = 0;

  for (const s of segments) {
    const d = s.startProgress;
    const f = s.endProgress;
    if (!fractionValide(d) || !fractionValide(f) || d === f) {
      nonSitues++;
      continue;
    }
    const nom = nomDe(s);
    const genre = genreDe(s.kind);
    if (f > d) {
      cases.push({
        cle: `${s.segmentIndex}`,
        segmentIndex: s.segmentIndex,
        nom,
        genre,
        debut: d,
        fin: f,
      });
    } else {
      // Franchit la ligne d'arrivée — deux morceaux, un seul segment.
      cases.push({
        cle: `${s.segmentIndex}-fin`,
        segmentIndex: s.segmentIndex,
        nom,
        genre,
        debut: d,
        fin: 1,
      });
      cases.push({
        cle: `${s.segmentIndex}-debut`,
        segmentIndex: s.segmentIndex,
        nom,
        genre,
        debut: 0,
        fin: f,
      });
    }
  }

  cases.sort((a, b) => a.debut - b.debut);
  return { cases, nonSitues, couverture: mesureUnion(cases) };
}

// ===========================================================================
// Bandes de grandeurs
// ===========================================================================

export interface BandeNormalisee {
  /** Position de chaque valeur dans `[0, 1]` — `null` quand la valeur manque. */
  positions: (number | null)[];
  min: number;
  max: number;
}

/**
 * Ramène une série de valeurs à `[0, 1]` sur SON PROPRE min/max.
 *
 * L'échelle est propre à la bande, et c'est voulu : deux bandes empilées ne
 * mesurent pas la même chose (des km/h et des g), il n'y a pas d'échelle
 * commune à partager. C'est la différence avec les petits multiples, où les
 * panneaux mesurent tous la même grandeur — là, l'échelle commune est
 * obligatoire.
 *
 * `null` quand rien n'est mesurable : l'appelant affiche l'absence plutôt
 * qu'une bande uniforme qui se lirait comme une valeur constante.
 *
 * Série constante : tout se pose à mi-hauteur. La coller en haut suggérerait
 * un maximum que la donnée ne porte pas.
 */
export function normaliserBande(valeurs: readonly (number | null)[]): BandeNormalisee | null {
  const finies = valeurs.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (finies.length === 0) return null;

  const min = Math.min(...finies);
  const max = Math.max(...finies);
  const etendue = max - min;

  return {
    min,
    max,
    positions: valeurs.map((v) => {
      if (typeof v !== 'number' || !Number.isFinite(v)) return null;
      return etendue === 0 ? 0.5 : (v - min) / etendue;
    }),
  };
}
