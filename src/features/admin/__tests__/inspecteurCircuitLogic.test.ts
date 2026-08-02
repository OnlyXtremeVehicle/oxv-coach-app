/**
 * L'INSPECTEUR MULTI-CIRCUIT — la traduction depuis la base.
 *
 * LES DONNÉES DE CES TESTS SONT COPIÉES DE LA PRODUCTION, relevées le
 * 02/08/2026. Elles ne sont pas inventées pour arranger le module : c'est le
 * module qui doit s'adapter à ce que la table contient réellement.
 *
 * Le piège principal : `corners` est un OBJET `{ params, corners: [...] }`, pas
 * un tableau. Un parseur qui l'attendrait en tableau rendrait une liste vide sur
 * le SEUL circuit qui possède des virages — et l'écran afficherait « virages non
 * calculés » sur Haute Saintonge, ce qui est faux.
 */

import {
  circuitParDefaut,
  geometrieDuCircuit,
  pointsDuTrace,
  resumeCircuit,
  viragesDuCircuit,
} from '@/features/admin/inspecteurCircuitLogic';

/** Extrait réel de `circuits.centerline_latlon` (Haute Saintonge). */
const CENTERLINE_REELLE = [
  { lat: 45.242873, lon: -0.095874 },
  { lat: 45.242844, lon: -0.095563 },
  { lat: 45.242652, lon: -0.094129 },
];

/** Extrait réel de `circuits.corners` (Haute Saintonge) — un OBJET. */
const CORNERS_REELS = {
  params: { k: 4, ds: 4, thr: 0.012, smooth: 1, merge_gap_pct: 5.5 },
  corners: [
    {
      r_m: 12.5,
      name: null,
      direction: 'left',
      apex_s_norm: 0.3198,
      calibration: 'schematic_svg',
      corner_index: 1,
    },
    {
      r_m: 30.6,
      name: null,
      direction: 'right',
      apex_s_norm: 0.4337,
      calibration: 'schematic_svg',
      corner_index: 2,
    },
  ],
};

describe('pointsDuTrace', () => {
  it('lit la forme réelle de la base', () => {
    expect(pointsDuTrace(CENTERLINE_REELLE)).toEqual(CENTERLINE_REELLE);
  });

  it('un point corrompu est écarté, pas rendu faux', () => {
    // Un NaN dans une polyline ne produit pas un point approximatif : il rend le
    // tracé ENTIER illisible. On perd le point, on garde la piste.
    const points = pointsDuTrace([
      { lat: 45.24, lon: -0.09 },
      { lat: NaN, lon: -0.09 },
      { lat: 45.25, lon: null },
      { lat: '45.26', lon: -0.09 },
      { lat: 45.27, lon: -0.1 },
    ]);
    expect(points).toEqual([
      { lat: 45.24, lon: -0.09 },
      { lat: 45.27, lon: -0.1 },
    ]);
  });

  it('refuse ce qui n’existe pas sur Terre', () => {
    // Accepter une longitude de 200° dessinerait une piste partant à l'infini,
    // et masquerait une corruption au lieu de la révéler.
    expect(pointsDuTrace([{ lat: 91, lon: 0 }])).toEqual([]);
    expect(pointsDuTrace([{ lat: 0, lon: 200 }])).toEqual([]);
    expect(pointsDuTrace([{ lat: -91, lon: 0 }])).toEqual([]);
  });

  it('rien d’exploitable → tableau vide, jamais une exception', () => {
    expect(pointsDuTrace(null)).toEqual([]);
    expect(pointsDuTrace(undefined)).toEqual([]);
    expect(pointsDuTrace('une chaîne')).toEqual([]);
    expect(pointsDuTrace({ lat: 1, lon: 2 })).toEqual([]);
    expect(pointsDuTrace([null, 3, 'x'])).toEqual([]);
  });
});

describe('viragesDuCircuit', () => {
  it('LE PIÈGE — `corners` est un objet, pas un tableau', () => {
    const v = viragesDuCircuit(CORNERS_REELS);
    expect(v).toHaveLength(2);
    expect(v[0]).toEqual({
      index: 1,
      nom: null,
      direction: 'left',
      apexProgression: 0.3198,
      rayonM: 12.5,
    });
  });

  it('accepte aussi un tableau nu, au cas où la forme changerait', () => {
    expect(viragesDuCircuit(CORNERS_REELS.corners)).toHaveLength(2);
  });

  it('un circuit sans virages calculés rend une liste vide', () => {
    // Charente et Ricardo Tormo sont dans ce cas en production. C'est l'état
    // honnête : « virages non calculés », pas « zéro virage ».
    expect(viragesDuCircuit(null)).toEqual([]);
    expect(viragesDuCircuit({ params: {} })).toEqual([]);
  });

  it('un virage sans numéro est écarté — il ne se rattache à rien', () => {
    const v = viragesDuCircuit({
      corners: [
        { direction: 'left', apex_s_norm: 0.2 },
        { corner_index: 0, direction: 'left' },
        { corner_index: 3, direction: 'right' },
      ],
    });
    expect(v.map((x) => x.index)).toEqual([3]);
  });

  it('trie par numéro : la base ne garantit pas l’ordre', () => {
    const v = viragesDuCircuit({
      corners: [{ corner_index: 5 }, { corner_index: 2 }, { corner_index: 9 }],
    });
    expect(v.map((x) => x.index)).toEqual([2, 5, 9]);
  });

  it('un nom vide vaut absence, pas une chaîne vide affichée', () => {
    const v = viragesDuCircuit({ corners: [{ corner_index: 1, name: '   ' }] });
    expect(v[0].nom).toBe(null);
  });
});

describe('geometrieDuCircuit', () => {
  it('traduit une ligne complète', () => {
    const g = geometrieDuCircuit({
      name: 'Haute Saintonge',
      centerline_latlon: CENTERLINE_REELLE,
      corners: CORNERS_REELS,
    });
    expect(g.points).toHaveLength(3);
    expect(g.virages).toHaveLength(2);
  });

  it('une ligne absente ne fait rien tomber', () => {
    expect(geometrieDuCircuit(null)).toEqual({ points: [], virages: [] });
    expect(geometrieDuCircuit(undefined)).toEqual({ points: [], virages: [] });
  });
});

describe('resumeCircuit', () => {
  it('dit les faits comptés', () => {
    expect(resumeCircuit({ points: [{ lat: 1, lon: 2 }], virages: [] })).toBe(
      '1 points GPS · virages non calculés'
    );
  });

  it('l’absence s’écrit « — », jamais « 0 »', () => {
    // Zéro virage MESURÉ et zéro virage CALCULÉ sont deux états différents ;
    // le second n'est pas une mesure et ne doit pas s'afficher comme telle.
    const phrase = resumeCircuit({ points: [], virages: [] });
    expect(phrase).toContain('—');
    expect(phrase).not.toMatch(/\b0\b/);
  });
});

describe('circuitParDefaut', () => {
  const geo = (c: { p: number; v: number }) => ({
    points: Array.from({ length: c.p }, () => ({ lat: 0, lon: 0 })),
    virages: Array.from({ length: c.v }, (_, i) => ({
      index: i + 1,
      nom: null,
      direction: null,
      apexProgression: null,
      rayonM: null,
    })),
  });

  it('ouvre le circuit le plus documenté', () => {
    const liste = [
      { p: 135, v: 0 },
      { p: 26, v: 0 },
      { p: 65, v: 7 },
    ];
    // Ricardo Tormo a le plus de points, mais Haute Saintonge a les virages —
    // et c'est ce que l'inspecteur sert à inspecter.
    expect(circuitParDefaut(liste, geo)).toEqual({ p: 65, v: 7 });
  });

  it('à égalité, l’ordre de la liste tranche — jamais le hasard', () => {
    const liste = [
      { p: 10, v: 0 },
      { p: 10, v: 0 },
    ];
    expect(circuitParDefaut(liste, geo)).toBe(liste[0]);
  });

  it('aucune liste → null, et l’écran affiche son état vide', () => {
    expect(circuitParDefaut([], geo)).toBe(null);
    expect(circuitParDefaut(null as never, geo)).toBe(null);
  });
});
