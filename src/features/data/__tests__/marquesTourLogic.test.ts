/**
 * MARQUES DE TOUR — la cohabitation tient-elle sous pression ?
 *
 * Le seul défaut que ce module puisse vraiment produire, et le seul qu'on ne
 * verrait pas à l'écran, c'est l'EFFACEMENT : une déclaration humaine qui fait
 * disparaître le fait de la machine. Il est tentant — « le pilote a dit que
 * c'était le trafic, la question est réglée » — et il est faux : la déclaration
 * est une lecture, pas une preuve.
 *
 * Ces tests le verrouillent explicitement, pour les six genres, y compris les
 * deux qui portent le plus de tentation : `representatif` (qui semble annuler
 * un doute) et `ecarte` (qui semble annuler un tour).
 */

import {
  LIBELLE_GENRE_MARQUE,
  composerLecturesTours,
  libelleGenreMarque,
  type IdentiteTour,
} from '../marquesTourLogic';
import type { TourEvalue } from '../validationToursLogic';
import type { GenreMarqueTour, MarqueTourPosee } from '@/services/lapMarksService';

// ===========================================================================
// Fabriques
// ===========================================================================

const MOI = 'utilisateur-courant';
const AUTRUI = 'coach-du-pilote';

function tour(index: number, classement: TourEvalue['classement'], faits: string[]): TourEvalue {
  return {
    index,
    classement,
    marques: faits.map((fait) => ({ code: 'ecart_net' as const, fait })),
  };
}

function identites(...index: number[]): IdentiteTour[] {
  return index.map((i) => ({ index: i, lapId: `lap-${i}` }));
}

function marque(
  id: string,
  lapIndex: number,
  genre: GenreMarqueTour,
  auteurId: string,
  motif: string | null
): MarqueTourPosee {
  return {
    id,
    lapId: `lap-${lapIndex}`,
    sessionId: 'seance-1',
    auteurId,
    genre,
    motif,
    poseeLe: `2026-08-25T10:0${id.length}:00Z`,
  };
}

// ===========================================================================
// LE CŒUR — une marque humaine ne supprime jamais le fait de la machine
// ===========================================================================

describe('cohabitation — les deux voix se lisent côte à côte', () => {
  it('le fait de la machine SURVIT à une déclaration humaine', () => {
    const { tours } = composerLecturesTours({
      tours: [tour(4, 'suspect', ['8,4 s au-dessus de la médiane des tours propres'])],
      identites: identites(4),
      marques: [marque('m1', 4, 'gene_par_le_trafic', MOI, null)],
      lecteurId: MOI,
    });

    const lu = tours[0];
    expect(lu.faitsMachine).toHaveLength(1);
    expect(lu.faitsMachine[0].fait).toBe('8,4 s au-dessus de la médiane des tours propres');
    expect(lu.declarations).toHaveLength(1);
    expect(lu.cohabitation).toBe(true);
    // La ligne porte LES DEUX, et la machine vient d'abord.
    expect(lu.ligne).toBe(
      '8,4 s au-dessus de la médiane des tours propres · Déclaré : Gêné par le trafic — vous'
    );
    expect(lu.ligne?.indexOf('8,4 s')).toBeLessThan(lu.ligne?.indexOf('Déclaré') as number);
  });

  it('le classement de la machine n’est pas retouché par une déclaration', () => {
    const { tours } = composerLecturesTours({
      tours: [tour(4, 'suspect', ['arrêt observé (vitesse descendue à 3,0 km/h, sous 5 km/h)'])],
      identites: identites(4),
      // « Tour représentatif » : la déclaration qui semble le plus lever le doute.
      marques: [marque('m1', 4, 'representatif', MOI, null)],
      lecteurId: MOI,
    });

    expect(tours[0].classement).toBe('suspect');
    expect(tours[0].ligneMachine).toBe('arrêt observé (vitesse descendue à 3,0 km/h, sous 5 km/h)');
  });

  it('« Écarté » n’efface ni le fait, ni le tour', () => {
    const { tours } = composerLecturesTours({
      tours: [tour(7, 'propre', []), tour(8, 'suspect', ['2,1 s en dessous de la médiane'])],
      identites: identites(7, 8),
      marques: [marque('m1', 8, 'ecarte', MOI, 'je ne le compte pas')],
      lecteurId: MOI,
    });

    expect(tours).toHaveLength(2);
    expect(tours[1].index).toBe(8);
    expect(tours[1].faitsMachine).toHaveLength(1);
    expect(tours[1].ligne).toBe(
      '2,1 s en dessous de la médiane · Déclaré : Écarté (je ne le compte pas) — vous'
    );
  });

  it('les six genres laissent le fait intact', () => {
    const genres: GenreMarqueTour[] = [
      'gene_par_le_trafic',
      'tour_de_chauffe',
      'essai_reglage',
      'incident',
      'representatif',
      'ecarte',
    ];
    for (const genre of genres) {
      const { tours } = composerLecturesTours({
        tours: [tour(1, 'suspect', ['5,0 s au-dessus de la médiane des tours propres'])],
        identites: identites(1),
        marques: [marque('m1', 1, genre, MOI, null)],
        lecteurId: MOI,
      });
      expect(tours[0].faitsMachine).toHaveLength(1);
      expect(tours[0].cohabitation).toBe(true);
      expect(tours[0].ligne).toContain('5,0 s au-dessus de la médiane des tours propres');
      expect(tours[0].ligne).toContain(LIBELLE_GENRE_MARQUE[genre]);
    }
  });

  it('une machine muette n’invente pas de fait pour accompagner la déclaration', () => {
    const { tours } = composerLecturesTours({
      tours: [tour(2, 'propre', [])],
      identites: identites(2),
      marques: [marque('m1', 2, 'tour_de_chauffe', MOI, null)],
      lecteurId: MOI,
    });

    expect(tours[0].ligneMachine).toBeNull();
    expect(tours[0].cohabitation).toBe(false);
    expect(tours[0].ligne).toBe('Déclaré : Tour de chauffe — vous');
  });

  it('un tour propre et non commenté ne dit rien — le silence est sa réponse', () => {
    const { tours } = composerLecturesTours({
      tours: [tour(3, 'propre', [])],
      identites: identites(3),
      marques: [],
      lecteurId: MOI,
    });

    expect(tours[0].ligne).toBeNull();
    expect(tours[0].ligneMachine).toBeNull();
    expect(tours[0].ligneDeclarations).toBeNull();
    expect(tours[0].cohabitation).toBe(false);
  });
});

// ===========================================================================
// Distinction visuelle — la mienne, celle d'un tiers
// ===========================================================================

describe('l’auteur se distingue, sans exposer d’identité', () => {
  it('ma déclaration est mienne et retirable ; celle d’un tiers ne l’est pas', () => {
    const { tours } = composerLecturesTours({
      tours: [tour(5, 'suspect', ['3,0 s au-dessus de la médiane des tours propres'])],
      identites: identites(5),
      marques: [
        marque('m1', 5, 'gene_par_le_trafic', MOI, null),
        marque('m22', 5, 'essai_reglage', AUTRUI, null),
      ],
      lecteurId: MOI,
    });

    const [mienne, tierce] = tours[0].declarations;
    expect(mienne.deMoi).toBe(true);
    expect(mienne.origine).toBe('vous');
    expect(mienne.retirable).toBe(true);
    expect(tierce.deMoi).toBe(false);
    expect(tierce.origine).toBe('un tiers');
    expect(tierce.retirable).toBe(false);
  });

  it('aucune identité d’auteur ne fuit dans ce qui s’affiche', () => {
    const { tours } = composerLecturesTours({
      tours: [tour(5, 'propre', [])],
      identites: identites(5),
      marques: [marque('m1', 5, 'incident', AUTRUI, 'tête-à-queue au 6')],
      lecteurId: MOI,
    });

    const ligne = tours[0].ligne as string;
    expect(ligne).not.toContain(AUTRUI);
    expect(ligne).toBe('Déclaré : Incident (tête-à-queue au 6) — un tiers');
  });

  it('sans lecteur connu, rien n’est « à moi » ni retirable', () => {
    const { tours } = composerLecturesTours({
      tours: [tour(5, 'propre', [])],
      identites: identites(5),
      marques: [marque('m1', 5, 'incident', MOI, null)],
      lecteurId: null,
    });

    expect(tours[0].declarations[0].deMoi).toBe(false);
    expect(tours[0].declarations[0].retirable).toBe(false);
  });

  it('l’ordre de déclaration est conservé — un registre ne se réordonne pas', () => {
    const { tours } = composerLecturesTours({
      tours: [tour(9, 'propre', [])],
      identites: identites(9),
      marques: [
        marque('m1', 9, 'tour_de_chauffe', MOI, null),
        marque('m22', 9, 'essai_reglage', AUTRUI, null),
        marque('m333', 9, 'incident', MOI, null),
      ],
      lecteurId: MOI,
    });

    expect(tours[0].declarations.map((d) => d.id)).toEqual(['m1', 'm22', 'm333']);
    expect(tours[0].ligneDeclarations).toBe(
      'Déclaré : Tour de chauffe — vous ; Essai de réglage — un tiers ; Incident — vous'
    );
  });
});

// ===========================================================================
// Motifs et libellés
// ===========================================================================

describe('motifs et libellés', () => {
  it('un motif vide ou blanc devient `null`, jamais une parenthèse creuse', () => {
    const { tours } = composerLecturesTours({
      tours: [tour(1, 'propre', [])],
      identites: identites(1),
      marques: [marque('m1', 1, 'incident', MOI, '   ')],
      lecteurId: MOI,
    });

    expect(tours[0].declarations[0].motif).toBeNull();
    expect(tours[0].ligne).toBe('Déclaré : Incident — vous');
  });

  it('les six libellés sont ceux du cahier, au mot près', () => {
    expect(libelleGenreMarque('gene_par_le_trafic')).toBe('Gêné par le trafic');
    expect(libelleGenreMarque('tour_de_chauffe')).toBe('Tour de chauffe');
    expect(libelleGenreMarque('essai_reglage')).toBe('Essai de réglage');
    expect(libelleGenreMarque('incident')).toBe('Incident');
    expect(libelleGenreMarque('representatif')).toBe('Tour représentatif');
    expect(libelleGenreMarque('ecarte')).toBe('Écarté');
  });

  it('aucun libellé n’ordonne quoi que ce soit', () => {
    const proscrits = /\b(freinez|accélérez|évitez|vous devriez|il faut|limite)\b/i;
    for (const libelle of Object.values(LIBELLE_GENRE_MARQUE)) {
      expect(proscrits.test(libelle)).toBe(false);
    }
  });
});

// ===========================================================================
// Rattachement
// ===========================================================================

describe('rattachement des marques aux tours', () => {
  it('chaque marque va sur SON tour, pas sur le voisin', () => {
    const { tours } = composerLecturesTours({
      tours: [tour(1, 'propre', []), tour(2, 'propre', []), tour(3, 'propre', [])],
      identites: identites(1, 2, 3),
      marques: [
        marque('m1', 2, 'gene_par_le_trafic', MOI, null),
        marque('m22', 3, 'ecarte', MOI, null),
      ],
      lecteurId: MOI,
    });

    expect(tours[0].declarations).toHaveLength(0);
    expect(tours[1].declarations.map((d) => d.genre)).toEqual(['gene_par_le_trafic']);
    expect(tours[2].declarations.map((d) => d.genre)).toEqual(['ecarte']);
    expect(tours.map((t) => t.lapId)).toEqual(['lap-1', 'lap-2', 'lap-3']);
  });

  it('une marque sans tour correspondant ressort ORPHELINE, jamais avalée', () => {
    const { tours, orphelines } = composerLecturesTours({
      tours: [tour(1, 'propre', [])],
      identites: identites(1),
      marques: [
        marque('m1', 1, 'incident', MOI, null),
        // Le tour 42 n'est ni évalué ni identifié : la déclaration existe quand même.
        marque('m22', 42, 'gene_par_le_trafic', MOI, null),
      ],
      lecteurId: MOI,
    });

    expect(tours[0].declarations).toHaveLength(1);
    expect(orphelines).toHaveLength(1);
    expect(orphelines[0].id).toBe('m22');
    expect(orphelines[0].libelle).toBe('Gêné par le trafic');
  });

  it('un tour sans identité connue reste lisible, `lapId` à `null`', () => {
    const { tours } = composerLecturesTours({
      tours: [tour(1, 'suspect', ['1,9 s au-dessus de la médiane des tours propres'])],
      identites: [],
      marques: [],
      lecteurId: MOI,
    });

    expect(tours[0].lapId).toBeNull();
    expect(tours[0].ligne).toBe('1,9 s au-dessus de la médiane des tours propres');
  });

  it('aucune séance, aucune marque : une sortie vide, pas une exception', () => {
    const { tours, orphelines } = composerLecturesTours({
      tours: [],
      identites: [],
      marques: [],
      lecteurId: null,
    });
    expect(tours).toEqual([]);
    expect(orphelines).toEqual([]);
  });
});
