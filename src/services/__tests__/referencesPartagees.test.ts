/**
 * LES RÉFÉRENCES PARTAGÉES — les trois adjectifs de M09, tenus.
 *
 * *« Partage inter-pilotes autorisé, ÉQUITABLE, RÉVOCABLE et ANONYMISABLE. »*
 * Ces tests ne vérifient pas Supabase : ils vérifient que le service demande
 * bien ce que la limite exige, et qu'il ne rend jamais ce qu'elle interdit.
 */

import { supabase } from '@/lib/supabase';

import {
  consentirReference,
  mesReferences,
  publierReference,
  referenceDisponible,
  referencesVivantes,
  revoquerReference,
} from '../referencesPartageesService';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getUser: jest.fn() } },
}));

const depuis = supabase.from as unknown as jest.Mock;
const getUser = supabase.auth.getUser as unknown as jest.Mock;

function chaine(reponse: unknown) {
  const maillon: Record<string, unknown> = {};
  for (const nom of [
    'select',
    'eq',
    'not',
    'is',
    'order',
    'limit',
    'insert',
    'update',
    'maybeSingle',
  ]) {
    maillon[nom] = jest.fn(() => maillon);
  }
  (maillon as { then: unknown }).then = (resoudre: (v: unknown) => unknown) =>
    Promise.resolve(reponse).then(resoudre);
  return maillon;
}

const LIGNE = {
  id: 'r1',
  session_id: 's1',
  lap_number: 2,
  demontre: 'Tour de référence sur piste sèche.',
  portee: 'coach_seul',
  anonyme: true,
  consent_owner_at: '2026-09-01T10:00:00Z',
  revoked_at: null,
  created_at: '2026-09-01T09:00:00Z',
};

beforeEach(() => {
  depuis.mockReset();
  getUser.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: 'coach-1' } } });
});

describe('référenceDisponible — le fait du moteur', () => {
  it('vrai quand une référence vivante est visible', async () => {
    depuis.mockReturnValue(chaine({ data: [{ id: 'r1' }], error: null }));
    await expect(referenceDisponible()).resolves.toBe(true);
  });

  /**
   * ÉQUITABLE et RÉVOCABLE, dans la requête elle-même. Sans consentement ou
   * après révocation, la référence n'existe pour personne — et l'écrire ici,
   * plutôt que de s'en remettre à la seule politique, le dit à qui lit ce code.
   */
  it('exige le consentement ET l’absence de révocation', async () => {
    const c = chaine({ data: [], error: null });
    depuis.mockReturnValue(c);
    await referenceDisponible();
    expect((c.not as jest.Mock).mock.calls[0]).toEqual(['consent_owner_at', 'is', null]);
    expect((c.is as jest.Mock).mock.calls[0]).toEqual(['revoked_at', null]);
  });

  it('une panne rend faux, jamais une exception', async () => {
    depuis.mockReturnValue(chaine({ data: null, error: { message: 'RLS' } }));
    await expect(referenceDisponible()).resolves.toBe(false);
  });
});

describe('ce que le service rend', () => {
  it('ne rend JAMAIS l’identité du propriétaire', async () => {
    depuis.mockReturnValue(chaine({ data: [LIGNE], error: null }));
    const [r] = await referencesVivantes();
    expect(Object.keys(r)).not.toContain('ownerId');
    expect(Object.keys(r)).not.toContain('publishedBy');
    expect(JSON.stringify(r)).not.toContain('owner');
  });

  it('porte ce que la référence démontre — la phrase est le sujet', async () => {
    depuis.mockReturnValue(chaine({ data: [LIGNE], error: null }));
    const [r] = await referencesVivantes();
    expect(r.demontre).toBe('Tour de référence sur piste sèche.');
    expect(r.anonyme).toBe(true);
  });
});

describe('mesReferences — ce que le propriétaire voit', () => {
  /**
   * Il voit AUSSI celles qui attendent son accord. Une référence en attente
   * qu'on ne montrerait pas serait un accord arraché par le silence.
   */
  it('ne filtre ni sur le consentement ni sur la révocation', async () => {
    const c = chaine({ data: [LIGNE], error: null });
    depuis.mockReturnValue(c);
    await mesReferences('p1');
    expect((c.not as jest.Mock).mock.calls).toHaveLength(0);
    expect((c.is as jest.Mock).mock.calls).toHaveLength(0);
    expect((c.eq as jest.Mock).mock.calls[0]).toEqual(['owner_id', 'p1']);
  });

  it('un identifiant vide ne part pas en requête', async () => {
    await expect(mesReferences('')).resolves.toEqual([]);
    expect(depuis).not.toHaveBeenCalled();
  });
});

describe('publierReference', () => {
  /**
   * « Provenance obligatoire », dit le catalogue. Une référence sans phrase
   * serait un chrono nu, donc un classement — ce que le brief interdit.
   */
  it('refuse une référence sans phrase, avant même la requête', async () => {
    const r = await publierReference({
      sessionId: 's1',
      ownerId: 'p1',
      lapNumber: null,
      demontre: '   ',
      portee: 'coach_seul',
      anonyme: true,
    });
    expect(r.ok).toBe(false);
    expect(depuis).not.toHaveBeenCalled();
  });

  /** Elle naît SANS consentement : c'est le propriétaire qui l'accordera. */
  it('n’écrit aucun consentement à la création', async () => {
    const c = chaine({ data: { id: 'r1' }, error: null });
    depuis.mockReturnValue(c);
    await publierReference({
      sessionId: 's1',
      ownerId: 'p1',
      lapNumber: null,
      demontre: 'Ce qu’elle démontre.',
      portee: 'coach_seul',
      anonyme: true,
    });
    const ecrit = (c.insert as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(ecrit).not.toHaveProperty('consent_owner_at');
    expect(ecrit.published_by).toBe('coach-1');
    expect(ecrit.owner_id).toBe('p1');
  });
});

describe('consentir et révoquer', () => {
  it('consentir efface une révocation antérieure', async () => {
    const c = chaine({ error: null });
    depuis.mockReturnValue(c);
    await consentirReference('r1');
    const patch = (c.update as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(patch.revoked_at).toBeNull();
    expect(typeof patch.consent_owner_at).toBe('string');
  });

  /**
   * Sans condition, sans délai, sans motif à donner. Une révocation qu'il faut
   * justifier n'en est pas une — le service n'accepte donc aucun motif.
   */
  it('révoquer n’écrit qu’un instant, et rien d’autre', async () => {
    const c = chaine({ error: null });
    depuis.mockReturnValue(c);
    await revoquerReference('r1');
    const patch = (c.update as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(patch)).toEqual(['revoked_at']);
  });

  it('une panne remonte son message plutôt qu’un succès muet', async () => {
    depuis.mockReturnValue(chaine({ error: { message: 'insufficient_privilege' } }));
    await expect(revoquerReference('r1')).resolves.toEqual({
      ok: false,
      error: 'insufficient_privilege',
    });
  });
});
