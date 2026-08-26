/**
 * LES DEUX LECTURES DU LOT 10c, ET CE QU'ELLES REFUSENT DE LIRE.
 *
 * Ce fichier ne vérifie pas que du SQL « marche » — un mock ne le prouverait
 * pas. Il verrouille les DÉCISIONS de lecture, celles qui se perdent en
 * silence quand quelqu'un simplifie la requête six mois plus tard :
 *
 *   • un acquis se lit sur `status = 'atteint'`, jamais sur autre chose ;
 *   • une voix PRIVÉE du coach n'ouvre pas la fiche du pilote ;
 *   • une annotation supprimée non plus ;
 *   • une erreur de base rend `false`, elle ne fait pas tomber le débrief ;
 *   • aucune des deux fonctions ne rend un COMPTE.
 */

import {
  lireAcquisValide,
  lireFaitsHumains,
  lireVoixCoach,
} from '@/features/presentations/sourcesCompositionService';

interface Reponse {
  data: unknown;
  error: { message: string } | null;
}

/** Une réponse par table, réécrite avant chaque cas. */
const mockReponses: Record<string, Reponse> = {};

/** Ce que chaque requête a réellement demandé : table + filtres, en clair. */
const mockAppels: { table: string; filtres: string[] }[] = [];

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const trace = { table, filtres: [] as string[] };
      mockAppels.push(trace);
      const maillon: Record<string, unknown> = {};
      const etape =
        (nom: string) =>
        (...args: unknown[]) => {
          trace.filtres.push(`${nom}(${args.map((a) => JSON.stringify(a)).join(',')})`);
          return maillon;
        };
      for (const nom of ['select', 'eq', 'in', 'is', 'not', 'order', 'limit']) {
        maillon[nom] = etape(nom);
      }
      maillon.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve(mockReponses[table] ?? { data: [], error: null }).then(resolve);
      return maillon;
    },
  },
}));

/** La forme que rend PostgREST pour `pilot_development_cycles`. */
function ligneCycle(id: string) {
  return {
    id,
    coach_id: 'coach-1',
    pilot_id: 'pilote-1',
    title: 'Freinage tardif',
    intention: null,
    status: 'active',
    is_shared: true,
    created_at: '2026-08-20T10:00:00Z',
  };
}

function reinitialiser() {
  for (const cle of Object.keys(mockReponses)) delete mockReponses[cle];
  mockAppels.length = 0;
}

function filtresDe(table: string): string[] {
  return mockAppels.filter((a) => a.table === table).flatMap((a) => a.filtres);
}

describe('lireAcquisValide', () => {
  beforeEach(reinitialiser);

  it('sans aucun programme, ne touche jamais aux axes', async () => {
    mockReponses.pilot_development_cycles = { data: [], error: null };

    expect(await lireAcquisValide('pilote-1')).toBe(false);
    expect(mockAppels.some((a) => a.table === 'cycle_steps')).toBe(false);
  });

  it('un axe atteint suffit', async () => {
    mockReponses.pilot_development_cycles = { data: [ligneCycle('c1')], error: null };
    mockReponses.cycle_steps = { data: [{ id: 'a1' }], error: null };

    expect(await lireAcquisValide('pilote-1')).toBe(true);
  });

  it('des axes tous en cours ne font pas un acquis', async () => {
    mockReponses.pilot_development_cycles = { data: [ligneCycle('c1')], error: null };
    // La base a filtré sur `status = 'atteint'` : elle ne rend rien.
    mockReponses.cycle_steps = { data: [], error: null };

    expect(await lireAcquisValide('pilote-1')).toBe(false);
  });

  it('interroge « atteint », et les axes de TOUS les programmes du pilote', async () => {
    mockReponses.pilot_development_cycles = {
      data: [ligneCycle('c1'), ligneCycle('c2')],
      error: null,
    };
    mockReponses.cycle_steps = { data: [{ id: 'a1' }], error: null };

    await lireAcquisValide('pilote-1');

    const filtres = filtresDe('cycle_steps').join(' ');
    expect(filtres).toContain('eq("status","atteint")');
    expect(filtres).toContain('"c1"');
    expect(filtres).toContain('"c2"');
    // Le programme du pilote, pas celui d'un autre.
    expect(filtresDe('pilot_development_cycles').join(' ')).toContain('eq("pilot_id","pilote-1")');
  });

  it('ne lit NI pilot_goals NI coach_objectives — ce ne sont pas des acquis', async () => {
    mockReponses.pilot_development_cycles = { data: [ligneCycle('c1')], error: null };
    mockReponses.cycle_steps = { data: [], error: null };

    await lireAcquisValide('pilote-1');

    const tables = mockAppels.map((a) => a.table);
    expect(tables).not.toContain('pilot_goals');
    expect(tables).not.toContain('coach_objectives');
    expect(tables).not.toContain('coach_corner_reference');
  });

  it('une erreur de base rend false, elle ne rejette pas', async () => {
    mockReponses.pilot_development_cycles = { data: [ligneCycle('c1')], error: null };
    mockReponses.cycle_steps = { data: null, error: { message: 'timeout' } };

    await expect(lireAcquisValide('pilote-1')).resolves.toBe(false);
  });

  it('un identifiant vide ne déclenche aucune requête', async () => {
    expect(await lireAcquisValide('')).toBe(false);
    expect(mockAppels).toHaveLength(0);
  });
});

describe('lireVoixCoach', () => {
  beforeEach(reinitialiser);

  it('une voix partagée sur la capture ouvre le fait', async () => {
    mockReponses.coach_annotations = { data: [{ id: 'n1' }], error: null };

    expect(await lireVoixCoach({ piloteId: 'pilote-1', captureId: 'cap-1' })).toBe(true);
  });

  it('exige partagée, non supprimée, et porteuse d’un audio', async () => {
    mockReponses.coach_annotations = { data: [{ id: 'n1' }], error: null };

    await lireVoixCoach({ piloteId: 'pilote-1', captureId: 'cap-1' });

    const filtres = filtresDe('coach_annotations').join(' ');
    expect(filtres).toContain('eq("visibility","shared")');
    expect(filtres).toContain('is("deleted_at",null)');
    expect(filtres).toContain('not("audio_url","is",null)');
    expect(filtres).toContain('eq("telemetry_session_id","cap-1")');
    expect(filtres).toContain('eq("pilot_id","pilote-1")');
  });

  it('aucune annotation retenue : le fait reste faux', async () => {
    mockReponses.coach_annotations = { data: [], error: null };

    expect(await lireVoixCoach({ piloteId: 'pilote-1', captureId: 'cap-1' })).toBe(false);
  });

  it('une erreur de base rend false', async () => {
    mockReponses.coach_annotations = { data: null, error: { message: 'rls' } };

    await expect(lireVoixCoach({ piloteId: 'pilote-1', captureId: 'cap-1' })).resolves.toBe(false);
  });

  it('une capture vide ne déclenche aucune requête', async () => {
    expect(await lireVoixCoach({ piloteId: 'pilote-1', captureId: '' })).toBe(false);
    expect(mockAppels).toHaveLength(0);
  });
});

describe('lireFaitsHumains', () => {
  beforeEach(reinitialiser);

  it('rend les deux faits, et RIEN d’autre — aucun chiffre', async () => {
    mockReponses.pilot_development_cycles = { data: [ligneCycle('c1')], error: null };
    mockReponses.cycle_steps = { data: [{ id: 'a1' }], error: null };
    mockReponses.coach_annotations = { data: [{ id: 'n1' }], error: null };

    const faits = await lireFaitsHumains({ piloteId: 'pilote-1', captureId: 'cap-1' });

    expect(faits).toEqual({ acquis: true, voixCoach: true });
    for (const valeur of Object.values(faits)) {
      expect(typeof valeur).toBe('boolean');
    }
  });

  it('une séance sans rien : deux faux, jamais un null déguisé en zéro', async () => {
    mockReponses.pilot_development_cycles = { data: [], error: null };
    mockReponses.coach_annotations = { data: [], error: null };

    expect(await lireFaitsHumains({ piloteId: 'pilote-1', captureId: 'cap-1' })).toEqual({
      acquis: false,
      voixCoach: false,
    });
  });
});
