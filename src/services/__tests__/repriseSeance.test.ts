/**
 * LA REPRISE D'UNE SÉANCE RESTÉE OUVERTE.
 *
 * ===========================================================================
 * CE QUE CES TESTS PROTÈGENT
 * ===========================================================================
 *
 * Une séance peut rester en `recording` sans que rien ne le signale :
 * application tuée en piste, plantage, clôture partie en quarantaine. C'est
 * arrivé la nuit du 13/08/2026 — 26 999 trames et trois tours parfaitement
 * écrits, et une séance invisible parce que son statut n'avait jamais bougé.
 *
 * Le diagnostic existait ; la réparation n'avait jamais été écrite.
 *
 * Trois propriétés, et il faut les trois : elle clôt sur des données RÉELLES,
 * elle ne touche PAS une capture en cours, et elle n'invente RIEN sur une
 * séance vide.
 */

import { reprendreSeancesOuvertes } from '../repriseSeanceService';

interface Ligne {
  [k: string]: unknown;
}

const etat: {
  seances: Ligne[];
  trames: Ligne[];
  maj: { table: string; patch: Ligne; id: unknown }[];
  erreurSeances: boolean;
} = { seances: [], trames: [], maj: [], erreurSeances: false };

jest.mock('@/lib/supabase', () => {
  /** Chaîne PostgREST simulée : on retient les filtres pour servir la bonne table. */
  const faire = (table: string) => {
    const f: Record<string, unknown> = {};
    let sessionId: string | null = null;
    let patch: Ligne | null = null;
    const chaine: Record<string, unknown> = {
      select: () => chaine,
      update: (p: Ligne) => {
        patch = p;
        return chaine;
      },
      eq: (col: string, val: unknown) => {
        if (col === 'session_id' || col === 'id') sessionId = String(val);
        return chaine;
      },
      order: () => chaine,
      limit: () => chaine,
      range: (from: number, to: number) => {
        f.from = from;
        f.to = to;
        return chaine;
      },
      then: (resolve: (v: unknown) => unknown) => {
        if (patch !== null) {
          etat.maj.push({ table, patch, id: sessionId });
          return Promise.resolve({ data: null, error: null }).then(resolve);
        }
        if (table === 'telemetry_sessions') {
          if (etat.erreurSeances) {
            return Promise.resolve({ data: null, error: { message: 'boom' } }).then(resolve);
          }
          return Promise.resolve({ data: etat.seances, error: null }).then(resolve);
        }
        const toutes = etat.trames.filter((t) => t.session_id === sessionId);
        const from = typeof f.from === 'number' ? f.from : 0;
        const to = typeof f.to === 'number' ? f.to : toutes.length;
        return Promise.resolve({ data: toutes.slice(from, to + 1), error: null }).then(resolve);
      },
    };
    return chaine;
  };
  return { supabase: { from: (t: string) => faire(t) } };
});

const MAINTENANT = new Date('2026-08-13T12:00:00Z').getTime();
/** Bien au-delà des trois heures d'âge minimal. */
const VIEUX = new Date('2026-08-13T00:00:00Z').toISOString();

function trame(sessionId: string, ms: number, v: number, gy: number, gx = 0.1): Ligne {
  return { session_id: sessionId, elapsed_ms: ms, speed_kmh: v, g_force_y: gy, g_force_x: gx };
}

beforeEach(() => {
  etat.seances = [];
  etat.trames = [];
  etat.maj = [];
  etat.erreurSeances = false;
});

describe('une séance ouverte AVEC des trames est clôturée sur ses données', () => {
  beforeEach(() => {
    etat.seances = [{ id: 's1', started_at: VIEUX }];
    etat.trames = [
      trame('s1', 0, 0, 0.1),
      trame('s1', 1000, 72, 0.5),
      trame('s1', 2000, 108, 0.62),
      trame('s1', 3000, 90, 0.4),
    ];
  });

  it('elle passe en completed', async () => {
    const b = await reprendreSeancesOuvertes('u1', MAINTENANT, () => null);
    expect(b.cloturees).toEqual(['s1']);
    expect(etat.maj[0].patch.status).toBe('completed');
  });

  it('les agrégats viennent des trames, pas d’une estimation', async () => {
    await reprendreSeancesOuvertes('u1', MAINTENANT, () => null);
    const p = etat.maj[0].patch;
    expect(p.total_frames).toBe(4);
    expect(p.max_speed_kmh).toBe(108);
    expect(p.max_g_lateral).toBeCloseTo(0.62, 5);
    // 3 s à ~20/30/25 m/s → une distance strictement positive, jamais nulle.
    expect(p.distance_km as number).toBeGreaterThan(0);
  });

  it('`ended_at` se déduit du dernier elapsed_ms', async () => {
    await reprendreSeancesOuvertes('u1', MAINTENANT, () => null);
    const fin = new Date(etat.maj[0].patch.ended_at as string).getTime();
    expect(fin - new Date(VIEUX).getTime()).toBe(3000);
  });

  /**
   * `duration_seconds` est GÉNÉRÉE. L'écrire lève 428C9, et c'est exactement ce
   * qui envoyait toutes les clôtures en quarantaine.
   */
  it('`duration_seconds` n’est JAMAIS écrite', async () => {
    await reprendreSeancesOuvertes('u1', MAINTENANT, () => null);
    expect('duration_seconds' in etat.maj[0].patch).toBe(false);
  });
});

describe('ce que la reprise refuse de faire', () => {
  /**
   * LE GARDE-FOU LE PLUS IMPORTANT. Une capture légitime EST en `recording` :
   * la clore reviendrait à couper le pilote en pleine piste.
   */
  it('ne touche pas une séance récente — c’est peut-être une capture en cours', async () => {
    etat.seances = [{ id: 's1', started_at: new Date(MAINTENANT - 60_000).toISOString() }];
    etat.trames = [trame('s1', 0, 50, 0.2)];
    const b = await reprendreSeancesOuvertes('u1', MAINTENANT, () => null);
    expect(b.cloturees).toEqual([]);
    expect(etat.maj).toEqual([]);
  });

  /**
   * Rien à conclure d'un enregistrement vide. `completed` prétendrait qu'il a
   * produit quelque chose, et ferait entrer une séance creuse dans la Saison.
   */
  it('une séance SANS trame est abandonnée, pas terminée', async () => {
    etat.seances = [{ id: 's2', started_at: VIEUX }];
    const b = await reprendreSeancesOuvertes('u1', MAINTENANT, () => null);
    expect(b.abandonnees).toEqual(['s2']);
    expect(b.cloturees).toEqual([]);
    expect(etat.maj[0].patch.status).toBe('aborted');
  });

  /**
   * ===========================================================================
   * LA GARDE ANNONCÉE ET LA GARDE POSÉE N'ÉTAIENT PAS LA MÊME
   * ===========================================================================
   *
   * L'en-tête du service dit « jamais pendant une capture active — clore la
   * séance qu'on est en train d'enregistrer serait le comble ». Le code ne
   * consultait jamais l'état de capture : sa seule protection était le seuil de
   * trois heures. `isCaptureSessionActive()` existait, exporté, sans un seul
   * appelant hors des tests.
   *
   * Trois heures ne suffisent pas : une journée de roulage les dépasse, pause
   * déjeuner comprise. Et depuis l'activation de l'arrière-plan BLE, l'appli-
   * cation peut rester VIVANTE et capturante pendant qu'un changement d'état
   * d'authentification relance la reprise — le risque a grandi, pas diminué.
   */
  it('la séance EN COURS DE CAPTURE est épargnée, quel que soit son âge', async () => {
    etat.seances = [{ id: 'en-cours', started_at: VIEUX }];
    etat.trames = [trame('en-cours', 0, 80, 0.3), trame('en-cours', 1000, 90, 0.4)];
    const b = await reprendreSeancesOuvertes('u1', MAINTENANT, () => 'en-cours');
    expect(b).toEqual({ cloturees: [], abandonnees: [] });
    expect(etat.maj).toEqual([]);
  });

  /**
   * LE CONTRE-TEST. Une garde qui refuserait TOUT dès qu'une capture tourne
   * passerait le cas ci-dessus sans rien protéger de plus — et laisserait les
   * séances réellement abandonnées ouvertes pour toujours. L'exemption est
   * nominative, pas globale.
   */
  it('les AUTRES séances restent réparables pendant une capture', async () => {
    etat.seances = [
      { id: 'en-cours', started_at: VIEUX },
      { id: 'orpheline', started_at: VIEUX },
    ];
    etat.trames = [trame('orpheline', 0, 70, 0.2), trame('orpheline', 1000, 90, 0.5)];
    const b = await reprendreSeancesOuvertes('u1', MAINTENANT, () => 'en-cours');
    expect(b.cloturees).toEqual(['orpheline']);
    expect(etat.maj.every((m) => m.id !== 'en-cours')).toBe(true);
  });

  it('sans capture active, le comportement est inchangé', async () => {
    etat.seances = [{ id: 's1', started_at: VIEUX }];
    etat.trames = [trame('s1', 0, 80, 0.3), trame('s1', 1000, 90, 0.4)];
    const b = await reprendreSeancesOuvertes('u1', MAINTENANT, () => null);
    expect(b.cloturees).toEqual(['s1']);
  });

  it('une lecture en erreur ne lève pas et ne touche à rien', async () => {
    etat.erreurSeances = true;
    const b = await reprendreSeancesOuvertes('u1', MAINTENANT, () => null);
    expect(b).toEqual({ cloturees: [], abandonnees: [] });
    expect(etat.maj).toEqual([]);
  });

  it('aucune séance ouverte : rien ne se passe', async () => {
    const b = await reprendreSeancesOuvertes('u1', MAINTENANT, () => null);
    expect(b).toEqual({ cloturees: [], abandonnees: [] });
  });
});

describe('la pagination des trames', () => {
  /**
   * PostgREST plafonne ses réponses. Une séance de vingt minutes porte 27 000
   * trames : sans pagination, la distance et les maxima seraient calculés sur
   * le premier millier — une donnée FAUSSE, ce qui est pire qu'une absente.
   */
  it('lit au-delà de la première page', async () => {
    etat.seances = [{ id: 's3', started_at: VIEUX }];
    etat.trames = Array.from({ length: 2500 }, (_, i) =>
      trame('s3', i * 40, i === 2400 ? 200 : 80, 0.3)
    );
    await reprendreSeancesOuvertes('u1', MAINTENANT, () => null);
    const p = etat.maj[0].patch;
    expect(p.total_frames).toBe(2500);
    // Le maximum se trouve dans la TROISIÈME page : sans pagination, il serait
    // resté à 80.
    expect(p.max_speed_kmh).toBe(200);
  });
});
