/**
 * D-1 — la rétrogradation doit couper les affiliations, et dans le bon ordre.
 *
 * Le défaut n'était pas une ligne manquante mais une ligne de COMMENTAIRE :
 * `demoteToPilot` affirmait que « les assignations deviennent dormantes » alors
 * que rien ne mettait `active` à false. Qui relisait ce code repartait rassuré.
 *
 * Deux garanties sont fixées ici, et l'ordre en est une à part entière.
 */

import { demoteToPilot } from '../coachAdminService';

const updates: { table: string; payload: Record<string, unknown> }[] = [];
let echecAffiliations = false;

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      update: (payload: Record<string, unknown>) => {
        updates.push({ table, payload });
        const echoue = table === 'coach_pilots' && echecAffiliations;
        const resultat = Promise.resolve({
          error: echoue ? { message: 'réseau' } : null,
        });
        // Chaîne `.eq()` fluide, terminée par un thenable.
        const chaine = {
          eq: () => chaine,
          then: (r: (v: unknown) => unknown) => resultat.then(r),
        };
        return chaine;
      },
    }),
  },
}));

beforeEach(() => {
  updates.length = 0;
  echecAffiliations = false;
});

describe('demoteToPilot — D-1', () => {
  it('coupe les affiliations ET change le rôle', async () => {
    const r = await demoteToPilot('u-1');
    expect(r.ok).toBe(true);

    const tables = updates.map((u) => u.table);
    expect(tables).toContain('coach_pilots');
    expect(tables).toContain('users');

    const aff = updates.find((u) => u.table === 'coach_pilots');
    expect(aff?.payload).toEqual({ active: false });
    const role = updates.find((u) => u.table === 'users');
    expect(role?.payload).toEqual({ role: 'pilot' });
  });

  // L'ordre EST la garantie : sans transaction depuis le client, l'état
  // intermédiaire doit être le plus sûr des deux.
  it('coupe les affiliations AVANT de changer le rôle', async () => {
    await demoteToPilot('u-1');
    expect(updates[0].table).toBe('coach_pilots');
    expect(updates[1].table).toBe('users');
  });

  // Le point qui compte : échouer FERMÉ. Un coach encore coach est inoffensif ;
  // un ex-coach qui garde l'accès sans que personne ne le sache, non.
  it('ne rétrograde PAS si les affiliations n’ont pas pu être coupées', async () => {
    echecAffiliations = true;
    const r = await demoteToPilot('u-1');

    expect(r.ok).toBe(false);
    expect(updates.map((u) => u.table)).not.toContain('users');
  });
});
