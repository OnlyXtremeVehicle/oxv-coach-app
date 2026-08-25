/**
 * MARQUES DE TOUR — la lecture d'un tour à DEUX VOIX. Logique PURE.
 * Sans React, sans react-native, sans Supabase : testable seule (ts-jest, node).
 *
 * ===========================================================================
 * LA RÈGLE QUE CE MODULE EXISTE POUR TENIR : LA COHABITATION
 * ===========================================================================
 *
 * `validationToursLogic` (M05) rend un FAIT chiffré et refuse de nommer une
 * cause : « 8,4 s au-dessus de la médiane des tours propres ». `lap_marks` rend
 * une DÉCLARATION humaine, qui nomme : « Gêné par le trafic ».
 *
 * Une déclaration ne CORRIGE PAS la machine. Elle ne l'annule pas, ne la
 * remplace pas, ne la masque pas. Les deux se lisent CÔTE À CÔTE, parce
 * qu'elles ne disent pas la même chose : l'une constate un écart, l'autre en
 * propose la raison. Le pilote qui relit sa séance six mois plus tard doit
 * retrouver les deux — le fait ET ce qu'on en avait dit.
 *
 * La tentation inverse est réelle et il faut la nommer pour ne pas y céder :
 * on aurait pu faire disparaître la marque « écart net » dès qu'un humain
 * déclare « Gêné par le trafic », au motif que la question est réglée. Elle ne
 * l'est pas. La déclaration est une lecture, pas une preuve : elle peut être
 * fausse, distraite, ou posée par quelqu'un qui n'était pas dans la voiture.
 * Effacer le fait derrière elle rendrait l'erreur invisible.
 *
 * `cohabitation` marque explicitement les tours où les deux voix parlent : ce
 * n'est pas un état de conflit, c'est l'état NORMAL d'un tour commenté, et
 * l'écran doit pouvoir le montrer comme tel.
 *
 * ===========================================================================
 * CE QUE CE MODULE NE FAIT PAS
 * ===========================================================================
 *
 * Il ne classe pas, ne recalcule rien, ne réordonne pas les faits de la
 * machine : ils traversent VERBATIM. Il ne nomme pas non plus le classement
 * (`propre`, `suspect`, `hors_chrono`) — ce vocabulaire-là appartient à
 * l'écran qui l'affiche, et le dupliquer ici créerait deux tables de libellés
 * qui divergeraient au premier ajustement.
 *
 * Il ne décide pas non plus des DROITS : `retirable` ne fait que refléter la
 * RLS (`DELETE` réservé à l'auteur), il ne l'accorde pas. Le rempart est en
 * base ; ceci évite d'offrir à l'écran une commande qui échouerait toujours.
 *
 * ===========================================================================
 * LES DÉCLARATIONS ORPHELINES NE DISPARAISSENT PAS
 * ===========================================================================
 *
 * Une marque dont le tour n'est pas dans la liste évaluée — tour non chargé,
 * détection rejouée, correspondance perdue — n'est pas jetée en silence : elle
 * ressort dans `orphelines`. Une déclaration humaine qu'on avale sans le dire
 * est exactement le genre d'absence qu'on ne remarque jamais.
 */

import type { ClassementTour, MarqueTour, TourEvalue } from '@/features/data/validationToursLogic';
import type { GenreMarqueTour, MarqueTourPosee } from '@/services/lapMarksService';

// ===========================================================================
// Vocabulaire
// ===========================================================================

/**
 * Les six déclarations, en français d'écran. Cette table est la SEULE source
 * des libellés : aucun écran ne réécrit ces mots.
 *
 * Aucun n'est un verbe, aucun n'ordonne quoi que ce soit — ce sont des états
 * constatés par la personne qui roulait. « Écarté » dit qu'elle met ce tour de
 * côté ; il ne dit pas qu'il fallait le faire.
 */
export const LIBELLE_GENRE_MARQUE: Record<GenreMarqueTour, string> = {
  gene_par_le_trafic: 'Gêné par le trafic',
  tour_de_chauffe: 'Tour de chauffe',
  essai_reglage: 'Essai de réglage',
  incident: 'Incident',
  representatif: 'Tour représentatif',
  ecarte: 'Écarté',
};

export function libelleGenreMarque(genre: GenreMarqueTour): string {
  return LIBELLE_GENRE_MARQUE[genre];
}

/** Qui a déclaré : le lecteur lui-même, ou quelqu'un d'autre. */
export type OrigineDeclaration = 'vous' | 'un tiers';

// ===========================================================================
// Types
// ===========================================================================

/**
 * La correspondance entre un tour évalué (numéroté) et sa ligne en base
 * (identifiant). M05 raisonne en `index` — le `lap_number` — tandis que
 * `lap_marks` pointe un `lap_id`. Sans cette table, rien ne relie les deux, et
 * la deviner à partir du numéro serait un pari.
 */
export interface IdentiteTour {
  index: number;
  lapId: string;
}

/** Une déclaration prête à lire. */
export interface DeclarationLue {
  id: string;
  genre: GenreMarqueTour;
  /** « Gêné par le trafic » — le mot d'écran, jamais la clé technique. */
  libelle: string;
  /** Précision libre laissée par l'auteur, ou `null` — jamais une chaîne vide. */
  motif: string | null;
  /** Vrai quand c'est le LECTEUR qui l'a posée : la distinction visuelle. */
  deMoi: boolean;
  origine: OrigineDeclaration;
  /** Reflet de la RLS : seul l'auteur retire sa déclaration. */
  retirable: boolean;
  poseeLe: string;
}

/** Ce qu'un tour donne à lire, machine et humain compris. */
export interface LectureTour {
  index: number;
  /** `null` quand aucune identité n'a été fournie pour ce tour. */
  lapId: string | null;
  classement: ClassementTour;
  /** Les faits de la machine, VERBATIM et dans l'ordre reçu. */
  faitsMachine: readonly MarqueTour[];
  /** Les déclarations humaines, dans l'ordre où elles ont été posées. */
  declarations: readonly DeclarationLue[];
  /** Les deux voix parlent sur ce tour. État normal, pas un conflit. */
  cohabitation: boolean;
  /** Les faits de la machine en une ligne, ou `null` s'il n'y en a aucun. */
  ligneMachine: string | null;
  /** Les déclarations en une ligne, ou `null` s'il n'y en a aucune. */
  ligneDeclarations: string | null;
  /**
   * Les deux lignes réunies, machine D'ABORD. `null` quand il n'y a rien à
   * dire — l'écran ne remplit pas le silence d'un tour propre et non commenté.
   */
  ligne: string | null;
}

export interface EntreeLecturesTours {
  /** Les tours tels que `evaluerTours` les a rendus. */
  tours: readonly TourEvalue[];
  /** La correspondance numéro ↔ identifiant, pour rattacher les marques. */
  identites: readonly IdentiteTour[];
  /** Les marques de la séance, telles que `listerMarquesSeance` les rend. */
  marques: readonly MarqueTourPosee[];
  /** L'utilisateur courant, ou `null` quand il n'est pas connu. */
  lecteurId: string | null;
}

export interface LecturesTours {
  tours: LectureTour[];
  /**
   * Les déclarations qu'aucun tour de la liste ne réclame. Elles ne sont pas
   * perdues : l'écran doit pouvoir dire qu'il en existe.
   */
  orphelines: DeclarationLue[];
}

// ===========================================================================
// Composition
// ===========================================================================

/** Le séparateur entre deux constats de même nature. */
const LIAISON = ' ; ';

function versDeclaration(marque: MarqueTourPosee, lecteurId: string | null): DeclarationLue {
  // `deMoi` exige un lecteur CONNU. Sans identité, tout est « un tiers » :
  // c'est faux pour l'une des déclarations, et c'est le sens prudent — on
  // n'offre pas un retrait qui serait refusé.
  const deMoi = lecteurId !== null && marque.auteurId === lecteurId;
  const motif =
    marque.motif !== null && marque.motif.trim().length > 0 ? marque.motif.trim() : null;
  return {
    id: marque.id,
    genre: marque.genre,
    libelle: LIBELLE_GENRE_MARQUE[marque.genre],
    motif,
    deMoi,
    origine: deMoi ? 'vous' : 'un tiers',
    retirable: deMoi,
    poseeLe: marque.poseeLe,
  };
}

/** « Gêné par le trafic (voiture lente au 4) — vous ». */
function phraseDeclaration(d: DeclarationLue): string {
  const avecMotif = d.motif !== null ? `${d.libelle} (${d.motif})` : d.libelle;
  return `${avecMotif} — ${d.origine}`;
}

/**
 * Compose, pour chaque tour, ce qu'il y a à lire.
 *
 * Les faits de la machine et les déclarations humaines sont ASSEMBLÉS, jamais
 * arbitrés : aucune déclaration ne retire un fait, aucun fait ne discrédite une
 * déclaration. C'est la règle de cohabitation, et c'est tout ce que fait ce
 * module.
 */
export function composerLecturesTours(entree: EntreeLecturesTours): LecturesTours {
  const { tours, identites, marques, lecteurId } = entree;

  /** index de tour → identifiant de ligne. */
  const lapIdParIndex = new Map<number, string>();
  /** identifiant de ligne → index de tour. */
  const indexParLapId = new Map<string, number>();
  for (const i of identites) {
    lapIdParIndex.set(i.index, i.lapId);
    indexParLapId.set(i.lapId, i.index);
  }

  /** Les index réellement évalués : une marque qui vise ailleurs est orpheline. */
  const indexConnus = new Set(tours.map((t) => t.index));

  const declarationsParIndex = new Map<number, DeclarationLue[]>();
  const orphelines: DeclarationLue[] = [];

  for (const marque of marques) {
    const lue = versDeclaration(marque, lecteurId);
    const index = indexParLapId.get(marque.lapId);
    if (index === undefined || !indexConnus.has(index)) {
      orphelines.push(lue);
      continue;
    }
    const dejaLa = declarationsParIndex.get(index);
    if (dejaLa === undefined) declarationsParIndex.set(index, [lue]);
    else dejaLa.push(lue);
  }

  const lectures: LectureTour[] = tours.map((tour) => {
    const declarations = declarationsParIndex.get(tour.index) ?? [];
    const faitsMachine = tour.marques;

    const ligneMachine =
      faitsMachine.length > 0 ? faitsMachine.map((m) => m.fait).join(LIAISON) : null;
    const ligneDeclarations =
      declarations.length > 0
        ? `Déclaré : ${declarations.map(phraseDeclaration).join(LIAISON)}`
        : null;

    /*
      L'ORDRE EST LE CŒUR DE LA RÈGLE. Le fait mesuré vient d'abord, la lecture
      humaine ensuite — jamais l'inverse, et jamais l'une SANS l'autre quand les
      deux existent. Un écran qui n'afficherait que `ligneDeclarations` ferait
      disparaître la machine ; c'est pour cela que `ligne` les porte ensemble.
    */
    const morceaux = [ligneMachine, ligneDeclarations].filter((m): m is string => m !== null);

    return {
      index: tour.index,
      lapId: lapIdParIndex.get(tour.index) ?? null,
      classement: tour.classement,
      faitsMachine,
      declarations,
      cohabitation: ligneMachine !== null && ligneDeclarations !== null,
      ligneMachine,
      ligneDeclarations,
      ligne: morceaux.length > 0 ? morceaux.join(' · ') : null,
    };
  });

  return { tours: lectures, orphelines };
}
