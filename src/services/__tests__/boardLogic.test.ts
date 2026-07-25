import {
  BOARD_MODE,
  buildBoardEvent,
  parseBoardEvent,
  shouldEmitBoard,
  sortBoard,
  type BoardEvent,
} from '../boardLogic';
import { stripHealth } from '../v2/liveHealthGate';

/** Fabrique une ligne board complète, pour éprouver le tri et la barrière santé. */
function ligne(over: Partial<BoardEvent> & Pick<BoardEvent, 'pilotHandle' | 'carNo'>): BoardEvent {
  return {
    lastLapMs: 92000,
    bestLapMs: 91000,
    sector: 1,
    ts: 1_700_000_000_000,
    ...over,
  };
}

describe('BOARD_MODE', () => {
  it("vaut 'A' (tableau de marche) — bascule en 'B' interdite sans avis avocat", () => {
    // Verrou juridique : 'B' affiche un classement, qui peut requalifier le track
    // day en compétition. Si ce test tombe, c'est que quelqu'un a basculé la
    // constante — la question n'est pas technique, elle est assurantielle.
    expect(BOARD_MODE).toBe('A');
  });
});

describe('sortBoard — invariant ANTI-CLASSEMENT', () => {
  it('trie par numéro de voiture, et surtout PAS par chrono', () => {
    // Jeu construit pour que l'ordre des chronos contredise l'ordre des numéros :
    // par meilleur tour on aurait 3 (88s) · 12 (91s) · 7 (95s).
    const rows: BoardEvent[] = [
      ligne({ pilotHandle: 'alpha', carNo: 7, lastLapMs: 96000, bestLapMs: 95000 }),
      ligne({ pilotHandle: 'bravo', carNo: 3, lastLapMs: 89000, bestLapMs: 88000 }),
      ligne({ pilotHandle: 'charlie', carNo: 12, lastLapMs: 92000, bestLapMs: 91000 }),
    ];

    const ordre = sortBoard(rows).map((r) => r.carNo);

    expect(ordre).toEqual([3, 7, 12]);
    // L'ordre par performance est un ordre DIFFÉRENT : on verrouille qu'il n'est
    // jamais produit, ni par hasard ni par régression.
    const ordreChrono = [...rows]
      .sort((a, b) => (a.bestLapMs as number) - (b.bestLapMs as number))
      .map((r) => r.carNo);
    expect(ordreChrono).toEqual([3, 12, 7]);
    expect(ordre).not.toEqual(ordreChrono);
  });

  it('le pilote le plus rapide ne remonte pas en tête', () => {
    const rows: BoardEvent[] = [
      ligne({ pilotHandle: 'lent', carNo: 2, bestLapMs: 120000 }),
      ligne({ pilotHandle: 'rapide', carNo: 88, bestLapMs: 70000 }),
    ];
    expect(sortBoard(rows).map((r) => r.pilotHandle)).toEqual(['lent', 'rapide']);
  });

  it('les voitures sans numéro passent en fin, départagées par pseudo', () => {
    const rows: BoardEvent[] = [
      ligne({ pilotHandle: 'zoe', carNo: null }),
      ligne({ pilotHandle: 'marc', carNo: null }),
      ligne({ pilotHandle: 'ana', carNo: 21 }),
    ];
    expect(sortBoard(rows).map((r) => r.pilotHandle)).toEqual(['ana', 'marc', 'zoe']);
  });

  it('à numéro identique, départage par pseudo (ordre stable, non performant)', () => {
    const rows: BoardEvent[] = [
      ligne({ pilotHandle: 'yann', carNo: 5, bestLapMs: 70000 }),
      ligne({ pilotHandle: 'bea', carNo: 5, bestLapMs: 110000 }),
    ];
    expect(sortBoard(rows).map((r) => r.pilotHandle)).toEqual(['bea', 'yann']);
  });

  it('ne mute pas le tableau d’entrée', () => {
    const rows: BoardEvent[] = [
      ligne({ pilotHandle: 'b', carNo: 9 }),
      ligne({ pilotHandle: 'a', carNo: 1 }),
    ];
    const copie = [...rows];
    sortBoard(rows);
    expect(rows).toEqual(copie);
  });

  it('liste vide → liste vide', () => {
    expect(sortBoard([])).toEqual([]);
  });
});

describe('buildBoardEvent', () => {
  it('dernier tour et meilleur tour personnel à partir des tours mesurés', () => {
    const ev = buildBoardEvent({
      pilotHandle: 'ana',
      carNo: 21,
      lapsMs: [95000, 91000, 93000],
      sector: 2,
      nowMs: 1_700_000_000_000,
    });
    expect(ev).toEqual({
      pilotHandle: 'ana',
      carNo: 21,
      lastLapMs: 93000,
      bestLapMs: 91000,
      sector: 2,
      ts: 1_700_000_000_000,
    });
  });

  it('aucun tour → lastLapMs ET bestLapMs à null (jamais 0)', () => {
    const ev = buildBoardEvent({
      pilotHandle: 'ana',
      carNo: 21,
      lapsMs: [],
      sector: null,
      nowMs: 1_700_000_000_000,
    });
    expect(ev?.lastLapMs).toBeNull();
    expect(ev?.bestLapMs).toBeNull();
    // Un 0 se lirait comme une mesure — et comme un tour imbattable.
    expect(ev?.lastLapMs).not.toBe(0);
    expect(ev?.bestLapMs).not.toBe(0);
  });

  it('durées non finies ou <= 0 ignorées', () => {
    const ev = buildBoardEvent({
      pilotHandle: 'ana',
      carNo: 21,
      lapsMs: [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 94000, 0],
      sector: 1,
      nowMs: 1,
    });
    // Le dernier tour RÉEL est 94000, pas le 0 qui le suit.
    expect(ev?.lastLapMs).toBe(94000);
    expect(ev?.bestLapMs).toBe(94000);
  });

  it('que des durées invalides → deux chronos à null', () => {
    const ev = buildBoardEvent({
      pilotHandle: 'ana',
      carNo: 21,
      lapsMs: [0, -5, Number.NaN],
      sector: null,
      nowMs: 1,
    });
    expect(ev?.lastLapMs).toBeNull();
    expect(ev?.bestLapMs).toBeNull();
  });

  it('pilotHandle vide ou blanc → null, aucune émission', () => {
    const base = { carNo: 21, lapsMs: [92000], sector: 1, nowMs: 1 };
    expect(buildBoardEvent({ ...base, pilotHandle: '' })).toBeNull();
    expect(buildBoardEvent({ ...base, pilotHandle: '   ' })).toBeNull();
  });

  it('carNo null est acceptable : la ligne est émise quand même', () => {
    const ev = buildBoardEvent({
      pilotHandle: 'ana',
      carNo: null,
      lapsMs: [92000],
      sector: 3,
      nowMs: 7,
    });
    expect(ev).not.toBeNull();
    expect(ev?.carNo).toBeNull();
  });

  it('secteur indéterminé → null (jamais un secteur inventé)', () => {
    const ev = buildBoardEvent({
      pilotHandle: 'ana',
      carNo: 21,
      lapsMs: [92000],
      sector: Number.NaN,
      nowMs: 7,
    });
    expect(ev?.sector).toBeNull();
  });

  it('horodatage non réel → null, aucune émission', () => {
    expect(
      buildBoardEvent({
        pilotHandle: 'ana',
        carNo: 21,
        lapsMs: [92000],
        sector: 1,
        nowMs: Number.NaN,
      })
    ).toBeNull();
  });
});

describe('barrière santé du canal board (invariant SANTÉ)', () => {
  it('un BoardEvent complet traverse stripHealth INTACT', () => {
    const ev = buildBoardEvent({
      pilotHandle: 'ana',
      carNo: 21,
      lapsMs: [95000, 91000],
      sector: 2,
      nowMs: 1_700_000_000_000,
    });
    expect(ev).not.toBeNull();
    // Spread : stripHealth attend un Record indexable, BoardEvent est une interface.
    expect(stripHealth({ ...(ev as BoardEvent) })).toEqual(ev);
  });

  it('le même payload enrichi de biométrie ressort SANS ces clés', () => {
    const ev = buildBoardEvent({
      pilotHandle: 'ana',
      carNo: 21,
      lapsMs: [95000, 91000],
      sector: 2,
      nowMs: 1_700_000_000_000,
    }) as BoardEvent;

    const pollue = {
      ...ev,
      hr: 172,
      hrBpm: 172,
      rrTrend: 'en hausse',
      rrMs: [812, 799],
      contact: 'ok',
      spo2: 98,
    };

    const out = stripHealth(pollue);

    expect(out).toEqual(ev);
    const serialise = JSON.stringify(out);
    expect(serialise).not.toContain('hr');
    expect(serialise).not.toContain('rr');
    expect(serialise).not.toContain('contact');
    expect(serialise).not.toContain('spo2');
    expect(serialise).not.toContain('172');
  });
});

describe('parseBoardEvent (ce qui ARRIVE du canal public est étranger)', () => {
  it('relit une ligne board émise (aller-retour fidèle)', () => {
    const ev = buildBoardEvent({
      pilotHandle: 'ana',
      carNo: 21,
      lapsMs: [95000, 91000],
      sector: 2,
      nowMs: 1_700_000_000_000,
    }) as BoardEvent;
    expect(parseBoardEvent(JSON.parse(JSON.stringify(ev)))).toEqual(ev);
  });

  it('écarte toute clé hors des six attendues, santé comprise', () => {
    const out = parseBoardEvent({
      pilotHandle: 'ana',
      carNo: 21,
      lastLapMs: 93000,
      bestLapMs: 91000,
      sector: 2,
      ts: 1_700_000_000_000,
      hrBpm: 172,
      rrTrend: 'en hausse',
      contact: 'ok',
    });
    // Un émetteur mal intentionné peut mettre ce qu'il veut dans le message :
    // l'objet rendu est NEUF, donc il ne peut pas contenir ce qu'on n'y met pas.
    expect(out).toEqual({
      pilotHandle: 'ana',
      carNo: 21,
      lastLapMs: 93000,
      bestLapMs: 91000,
      sector: 2,
      ts: 1_700_000_000_000,
    });
    expect(JSON.stringify(out)).not.toContain('172');
  });

  it('ligne sans identité publiable ou sans horodatage réel → rejetée', () => {
    expect(parseBoardEvent({ pilotHandle: '  ', ts: 1 })).toBeNull();
    expect(parseBoardEvent({ pilotHandle: 'ana' })).toBeNull();
    expect(parseBoardEvent({ pilotHandle: 'ana', ts: 'hier' })).toBeNull();
    expect(parseBoardEvent(null)).toBeNull();
    expect(parseBoardEvent('ana')).toBeNull();
  });

  it('champs douteux → null, jamais une valeur réparée', () => {
    const out = parseBoardEvent({
      pilotHandle: 'ana',
      carNo: 'douze',
      lastLapMs: 0,
      bestLapMs: -1,
      sector: null,
      ts: 7,
    });
    expect(out).toEqual({
      pilotHandle: 'ana',
      carNo: null,
      lastLapMs: null,
      bestLapMs: null,
      sector: null,
      ts: 7,
    });
  });
});

describe('shouldEmitBoard', () => {
  it('première émission toujours autorisée', () => {
    expect(shouldEmitBoard(null, 0)).toBe(true);
  });

  it('plafonne à 1 Hz par défaut', () => {
    expect(shouldEmitBoard(1000, 1999)).toBe(false);
    expect(shouldEmitBoard(1000, 2000)).toBe(true);
    expect(shouldEmitBoard(1000, 5000)).toBe(true);
  });

  it('intervalle minimal paramétrable', () => {
    expect(shouldEmitBoard(1000, 1500, 400)).toBe(true);
    expect(shouldEmitBoard(1000, 1300, 400)).toBe(false);
  });
});
