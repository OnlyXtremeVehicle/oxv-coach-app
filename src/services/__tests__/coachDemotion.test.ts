/**
 * D-1 puis D-2 — la rétrogradation doit couper les affiliations, dans le bon
 * ordre, EN ÉCRIVANT LA COLONNE QUI COMMANDE.
 *
 * D-1 (le défaut d'origine) n'était pas une ligne manquante mais une ligne de
 * COMMENTAIRE : `demoteToPilot` affirmait que « les assignations deviennent
 * dormantes » alors que rien ne mettait `active` à false. Qui relisait ce code
 * repartait rassuré.
 *
 * D-2 (mesuré le 02/09/2026) : la coupure était REDEVENUE inopérante, sans que
 * personne ne touche à cette fonction. Depuis L32 (02/08), `active` n'est plus
 * une colonne qu'on écrit — c'est une VUE de `status`, entretenue par
 * `trg_aligner_active_sur_status`, et son commentaire en base dit « ne pas
 * écrire à la main ». `update({active:false})` réussissait donc sans erreur, et
 * le déclencheur réécrivait `active` depuis un `status` inchangé.
 *
 * LA LEÇON QUE CE TEST DOIT PORTER : ce test-ci existait, il était vert, et il
 * n'a rien vu — parce qu'il épinglait la VALEUR écrite (`{active: false}`) et
 * non la colonne qui commande l'accès. Un test qui recopie l'implémentation
 * suit ses régressions au lieu de les arrêter. Il épingle désormais `status`,
 * et interdit explicitement d'écrire la colonne dérivée.
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
    expect(aff?.payload).toEqual({ status: 'ended' });
    const role = updates.find((u) => u.table === 'users');
    expect(role?.payload).toEqual({ role: 'pilot' });
  });

  /**
   * LE CLIQUET DE D-2. Écrire `active` ne coupe rien depuis le 02/08 : le
   * déclencheur le réécrit. Ce test échoue le jour où quelqu'un le remet — y
   * compris « pour faire bonne mesure », en plus de `status`, ce qui donnerait
   * l'illusion d'une double sécurité là où il n'y en a qu'une.
   */
  it('n’écrit JAMAIS `active` — c’est une colonne dérivée', async () => {
    await demoteToPilot('u-1');
    const aff = updates.find((u) => u.table === 'coach_pilots');
    expect(Object.keys(aff?.payload ?? {})).not.toContain('active');
  });

  /**
   * `ended` et non `declined` : le pilote n'a rien refusé, c'est le lien qui
   * prend fin. L'énumération porte les quatre valeurs et elles ne sont pas
   * interchangeables — `declined` raconterait un refus qui n'a pas eu lieu.
   */
  it('clôt par `ended`, jamais par `declined`', async () => {
    await demoteToPilot('u-1');
    const aff = updates.find((u) => u.table === 'coach_pilots');
    expect(aff?.payload.status).toBe('ended');
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
