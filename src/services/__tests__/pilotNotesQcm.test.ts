/**
 * LE QCM D'ENTRE-RUNS, RELU — ce que le moteur reçoit vraiment.
 *
 * La donnée était écrite depuis le 12/08 et le moteur de composition recevait
 * `null` : la troisième fois dans ce dépôt qu'une colonne est écrite,
 * transportée, puis perdue au dernier maillon. Ces tests tiennent le maillon.
 */

import { supabase } from '@/lib/supabase';

import { lireQcmSeance } from '../pilotNotesService';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { getUser: jest.fn() } } }));

const depuis = supabase.from as unknown as jest.Mock;

function chaine(reponse: unknown) {
  const maillon: Record<string, unknown> = {};
  for (const nom of ['select', 'eq', 'not', 'order', 'limit']) {
    maillon[nom] = jest.fn(() => maillon);
  }
  (maillon as { then: unknown }).then = (resoudre: (v: unknown) => unknown) =>
    Promise.resolve(reponse).then(resoudre);
  return maillon;
}

beforeEach(() => depuis.mockReset());

describe('lireQcmSeance', () => {
  it('rend les deux réponses quand elles sont licites', async () => {
    depuis.mockReturnValue(
      chaine({ data: [{ theme: 'freinage', ressenti: 'serre' }], error: null })
    );
    await expect(lireQcmSeance('s1')).resolves.toEqual({
      theme: 'freinage',
      ressenti: 'serre',
    });
  });

  /**
   * `ressenti` n'est PAS contraint côté Postgres — la colonne est un `text`
   * libre. Une valeur hors liste ne doit pas départager des fiches.
   */
  it('un ressenti hors liste devient null, le thème reste', async () => {
    depuis.mockReturnValue(
      chaine({ data: [{ theme: 'rythme', ressenti: 'euphorique' }], error: null })
    );
    await expect(lireQcmSeance('s1')).resolves.toEqual({ theme: 'rythme', ressenti: null });
  });

  it('un thème hors liste devient null lui aussi', async () => {
    depuis.mockReturnValue(
      chaine({ data: [{ theme: 'aerodynamique', ressenti: 'confortable' }], error: null })
    );
    await expect(lireQcmSeance('s1')).resolves.toEqual({
      theme: null,
      ressenti: 'confortable',
    });
  });

  it('aucune note structurée sur la séance rend deux null', async () => {
    depuis.mockReturnValue(chaine({ data: [], error: null }));
    await expect(lireQcmSeance('s1')).resolves.toEqual({ theme: null, ressenti: null });
  });

  it('une panne rend deux null, jamais une exception', async () => {
    depuis.mockReturnValue(chaine({ data: null, error: { message: 'timeout' } }));
    await expect(lireQcmSeance('s1')).resolves.toEqual({ theme: null, ressenti: null });
  });

  it('un identifiant vide ne part même pas en requête', async () => {
    await expect(lireQcmSeance('')).resolves.toEqual({ theme: null, ressenti: null });
    expect(depuis).not.toHaveBeenCalled();
  });

  /**
   * La dernière réponse est celle qui vaut. On ne moyenne pas des ressentis —
   * les réponses successives sont les états d'un même geste, pas des avis.
   */
  it('demande la plus récente, et une seule', async () => {
    const c = chaine({ data: [{ theme: 'voiture', ressenti: 'a_creuser' }], error: null });
    depuis.mockReturnValue(c);
    await lireQcmSeance('s1');
    expect((c.order as jest.Mock).mock.calls[0]).toEqual([
      'created_at',
      { ascending: false },
    ]);
    expect((c.limit as jest.Mock).mock.calls[0]).toEqual([1]);
  });

  /** Une note LIBRE n'a pas de thème : elle n'est pas une réponse au QCM. */
  it('écarte les notes libres à la requête', async () => {
    const c = chaine({ data: [], error: null });
    depuis.mockReturnValue(c);
    await lireQcmSeance('s1');
    expect((c.not as jest.Mock).mock.calls[0]).toEqual(['theme', 'is', null]);
  });
});
