import { decidePaddockAction, type PaddockHeroInput } from '../paddockHeroLogic';
import { ALL_PILOT_STATES } from '@/types/state';

function input(over: Partial<PaddockHeroInput> = {}): PaddockHeroInput {
  return { state: 'S10_repos', hasRecentSession: true, recentSessionId: 'sess-1', ...over };
}

describe('decidePaddockAction', () => {
  it('en piste / en route : aucune action (silence)', () => {
    expect(decidePaddockAction(input({ state: 'S5_approche' }))).toBeNull();
    expect(decidePaddockAction(input({ state: 'S6_roulage' }))).toBeNull();
  });

  it('séance fraîche (S8) → la séance, dans l arbre V2', () => {
    const a = decidePaddockAction(input({ state: 'S8_atterrissage' }));
    expect(a?.label).toContain('trace du jour');
    expect(a?.href).toBe('/(app2)/bilan/sess-1');
    expect(a?.hint).toBeTruthy();
  });

  it('lendemain (S9) → débrief, même écran de séance V2', () => {
    const a = decidePaddockAction(input({ state: 'S9_decantation' }));
    expect(a?.href).toBe('/(app2)/bilan/sess-1');
  });

  it('au circuit (S7) → Pass du jour', () => {
    const a = decidePaddockAction(input({ state: 'S7_paddock' }));
    expect(a?.href).toBe('/(app2)/club/pass');
  });

  it('anticipation (S4) → préparation', () => {
    const a = decidePaddockAction(input({ state: 'S4_anticipation' }));
    expect(a?.href).toBe('/(app2)/rec/preparation');
  });

  it('repos (S10) avec séance → dernier bilan', () => {
    const a = decidePaddockAction(input({ state: 'S10_repos' }));
    expect(a?.href).toBe('/(app2)/bilan/sess-1');
  });

  it('aucune séance → préparer (jamais un lien de bilan vide)', () => {
    const a = decidePaddockAction(input({ state: 'S10_repos', hasRecentSession: false }));
    expect(a?.href).toBe('/(app2)/rec');
    expect(a?.label).toContain('Préparer');
  });

  it('séance fraîche sans id → liste des séances, jamais une route à segment vide', () => {
    const a = decidePaddockAction(
      input({ state: 'S8_atterrissage', hasRecentSession: true, recentSessionId: null })
    );
    expect(a?.href).toBe('/(app2)/data');
  });

  it('aucune destination ne pointe plus vers l arbre v1', () => {
    for (const state of ALL_PILOT_STATES) {
      for (const recentSessionId of ['sess-1', null]) {
        for (const hasRecentSession of [true, false]) {
          const a = decidePaddockAction(input({ state, recentSessionId, hasRecentSession }));
          if (!a) continue;
          expect(a.href.startsWith('/(app2)/')).toBe(true);
          // Un segment de chemin vide produirait une route morte.
          expect(a.href).not.toMatch(/\/$/);
          expect(a.href).not.toContain('//');
        }
      }
    }
  });

  it('chaque état hors piste produit une action (jamais de cul-de-sac)', () => {
    for (const state of ALL_PILOT_STATES) {
      const a = decidePaddockAction(input({ state }));
      if (state === 'S5_approche' || state === 'S6_roulage') {
        expect(a).toBeNull();
      } else {
        expect(a?.href).toBeTruthy();
        expect(a?.label).toBeTruthy();
      }
    }
  });

  it('ne formule jamais de consigne de pilotage (doctrine miroir)', () => {
    const forbidden = /freinez|accélérez|prenez|vous devriez|il faut|évitez/i;
    for (const state of ALL_PILOT_STATES) {
      const a = decidePaddockAction(input({ state }));
      if (!a) continue;
      expect(forbidden.test(`${a.label} ${a.hint ?? ''}`)).toBe(false);
    }
  });
});
