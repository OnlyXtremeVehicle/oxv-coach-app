/**
 * LE REPLI SUR CACHE PÉRIMÉ — celui qui n'existait pas.
 *
 * ===========================================================================
 * LE DÉFAUT QUE CE FICHIER EXISTE POUR EMPÊCHER
 * ===========================================================================
 *
 * `circuitsService` annonçait, noir sur blanc dans son commentaire, un « repli
 * en cache stale si Supabase répond avec erreur ». Tout son comportement
 * hors-ligne reposait dessus.
 *
 * **Ce repli n'existait pas.** `cacheGet` faisait `storage.delete(key)` à
 * l'expiration : passé le TTL, la donnée était détruite, et le chemin d'erreur
 * retombait sur `null`. Au circuit, en rase campagne, cela veut dire plus de
 * liste de circuits, plus de tracé, plus rien à armer.
 *
 * C'est la forme la plus pure du défaut dominant du dépôt : une garantie
 * écrite, un mécanisme nommé, et rien qui fonctionne.
 *
 * ===========================================================================
 * CE QUE CES TESTS ÉPROUVENT
 * ===========================================================================
 *
 * Les deux moitiés, ensemble. Une lecture fraîche ne doit pas servir de périmé
 * (sinon le TTL ne sert à rien), et une lecture périmée doit rester
 * RÉCUPÉRABLE (sinon le repli n'existe pas).
 */

import { cacheDelete, cacheGet, cacheGetStale, cacheSet } from '../mmkv';

const CLE = 'test:repli-stale';

describe('cacheGet / cacheGetStale', () => {
  beforeEach(() => cacheDelete(CLE));
  afterAll(() => cacheDelete(CLE));

  it('une entrée fraîche est rendue par les deux', () => {
    cacheSet(CLE, { n: 1 }, 60_000);
    expect(cacheGet<{ n: number }>(CLE)).toEqual({ n: 1 });
    expect(cacheGetStale<{ n: number }>(CLE)).toEqual({ n: 1 });
  });

  it('une entrée périmée n’est PAS rendue par cacheGet', () => {
    cacheSet(CLE, { n: 2 }, -1); // déjà expirée
    expect(cacheGet<{ n: number }>(CLE)).toBeNull();
  });

  /**
   * LE CŒUR DU SUJET. Avant le 13/08/2026, l'appel ci-dessus avait DÉTRUIT
   * l'entrée : celui-ci rendait `null` et le repli hors-ligne était mort.
   */
  it('une entrée périmée reste récupérable APRÈS un cacheGet qui l’a refusée', () => {
    cacheSet(CLE, { n: 3 }, -1);
    expect(cacheGet<{ n: number }>(CLE)).toBeNull(); // refus, sans destruction
    expect(cacheGetStale<{ n: number }>(CLE)).toEqual({ n: 3 });
  });

  it('plusieurs lectures successives ne l’érodent pas', () => {
    cacheSet(CLE, { n: 4 }, -1);
    for (let i = 0; i < 5; i++) cacheGet(CLE);
    expect(cacheGetStale<{ n: number }>(CLE)).toEqual({ n: 4 });
  });

  it('une clé jamais écrite rend null des deux côtés', () => {
    expect(cacheGet(CLE)).toBeNull();
    expect(cacheGetStale(CLE)).toBeNull();
  });

  it('une entrée sans TTL ne périme jamais', () => {
    cacheSet(CLE, { n: 5 });
    expect(cacheGet<{ n: number }>(CLE)).toEqual({ n: 5 });
  });
});
