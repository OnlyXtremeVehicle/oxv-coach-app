/**
 * Le consentement au direct — « aucun coach » et « je n'ai pas pu lire ».
 *
 * ===========================================================================
 * LE BUG QUE CE FICHIER EXISTE POUR EMPÊCHER
 * ===========================================================================
 *
 * `consentedCoaches` ne lisait que `data` et ignorait `error` : sur panne
 * réseau elle rendait `[]`, indiscernable d'un pilote qui n'a consenti à
 * personne.
 *
 * Quand la réconciliation périodique a été posée — le 12/08/2026, pour tenir
 * la promesse « coupez quand vous voulez » que l'abonnement temps réel ne
 * tenait pas —, cette confusion est devenue une coupure : un réseau qui tousse
 * au circuit faisait voir zéro coach, donc `stopPilotLiveRelay()`.
 *
 * **Le commentaire posé au-dessus certifiait le contraire**, et un test
 * vérifiait la présence de ce commentaire. Les deux étaient verts pendant que
 * le code coupait.
 *
 * ===========================================================================
 * POURQUOI CE TEST EXÉCUTE AU LIEU DE LIRE
 * ===========================================================================
 *
 * Une garde lexicale ne pouvait pas voir ce défaut : le `.catch` ÉTAIT écrit,
 * la phrase ÉTAIT là. Ce qui manquait était que la promesse rejette. Seule
 * l'exécution le montre — d'où l'export de `consentedCoaches`, qui n'a pas
 * d'autre appelant.
 */

// L'import précède le `jest.mock` ci-dessous, et c'est sans effet : Babel
// remonte les `jest.mock` au-dessus des imports. L'ordre lu n'est pas l'ordre
// exécuté.
import { consentedCoaches } from '../liveRelayRunner';

/** Réponse que la chaîne de requête simulée rendra au prochain appel. */
let reponse: { data: unknown; error: { message: string } | null } = { data: [], error: null };

/**
 * Client Supabase simulé. La chaîne réelle est
 * `.from().select().eq().eq().eq().not().not()` : chaque maillon se rend
 * lui-même, et l'objet final est « thenable » — c'est `await` sur le dernier
 * maillon qui livre la réponse.
 */
jest.mock('@/lib/supabase', () => {
  const maillon: Record<string, unknown> = {};
  maillon.select = () => maillon;
  maillon.eq = () => maillon;
  maillon.not = () => maillon;
  maillon.maybeSingle = () => Promise.resolve({ data: null, error: null });
  maillon.then = (resolve: (v: unknown) => unknown) => Promise.resolve(reponse).then(resolve);
  return {
    supabase: {
      from: () => maillon,
      channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
      removeChannel: () => Promise.resolve(),
    },
  };
});

const PILOTE = '00000000-0000-4000-8000-000000000001';

describe('la lecture du consentement distingue le vide de la panne', () => {
  /**
   * LE CŒUR DU SUJET. Sans le mode strict, les deux cas rendent `[]` et
   * l'appelant ne peut pas les séparer — c'est ce qui coupait le direct.
   */
  it('une panne REJETTE en mode strict', async () => {
    reponse = { data: null, error: { message: 'network request failed' } };
    await expect(consentedCoaches(PILOTE, true)).rejects.toThrow('network request failed');
  });

  it('la MÊME panne rend une liste vide en mode non strict', async () => {
    reponse = { data: null, error: { message: 'network request failed' } };
    await expect(consentedCoaches(PILOTE, false)).resolves.toEqual([]);
  });

  /**
   * L'autre moitié du contrat, et sans elle la première ne vaut rien : un
   * `strict` qui rejetterait TOUJOURS passerait le test du haut et empêcherait
   * tout direct de démarrer.
   */
  it('un pilote sans coach consentant rend une liste vide, même en strict', async () => {
    reponse = { data: [], error: null };
    await expect(consentedCoaches(PILOTE, true)).resolves.toEqual([]);
  });

  it('les coachs consentants sont rendus dans les deux modes', async () => {
    reponse = {
      data: [
        { coach_id: 'c1', level: 'observation' },
        { coach_id: 'c2', level: null },
      ],
      error: null,
    };
    const strict = await consentedCoaches(PILOTE, true);
    const souple = await consentedCoaches(PILOTE, false);
    expect(strict).toHaveLength(2);
    expect(strict).toEqual(souple);
    expect(strict.map((c) => c.coachId)).toEqual(['c1', 'c2']);
  });

  /**
   * LE CAS QUI A COÛTÉ LE DÉFAUT. `data: null` avec `error: null` n'est pas une
   * panne — c'est PostgREST qui filtre à vide. Il doit rendre `[]` sans
   * rejeter, y compris en strict, sans quoi le démarrage échouerait pour un
   * pilote parfaitement ordinaire.
   */
  it('une réponse vide sans erreur ne rejette jamais', async () => {
    reponse = { data: null, error: null };
    await expect(consentedCoaches(PILOTE, true)).resolves.toEqual([]);
  });
});

/**
 * ===========================================================================
 * CE QUE CE FICHIER NE PROUVE PAS, ET IL FAUT LE DIRE
 * ===========================================================================
 *
 * Il éprouve la LECTURE du consentement, pas le comportement du relais qui
 * l'emploie : que la réconciliation appelle bien la variante stricte est tenu
 * par `realtimePublication.guard.test.ts`, qui lit le câblage. C'est plus
 * faible qu'une exécution, et c'est écrit ici plutôt que sous-entendu.
 *
 * La vérification qui compte vraiment est au circuit : couper le réseau
 * pendant un direct, et constater que le flux ne s'arrête pas. Elle est
 * inscrite au dossier d'acceptation terrain.
 */
