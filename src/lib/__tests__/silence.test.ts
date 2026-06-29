import { ALL_PILOT_STATES, isSilentState } from '../../types/state';
import { isSilenced, setSilenceMode } from '../silence';

describe('isSilentState', () => {
  it('vrai uniquement en roulage (S6) — silence en piste', () => {
    for (const state of ALL_PILOT_STATES) {
      expect(isSilentState(state)).toBe(state === 'S6_roulage');
    }
  });
});

describe('drapeau runtime silence', () => {
  beforeEach(() => setSilenceMode(false));
  afterEach(() => setSilenceMode(false));

  it('par défaut, l’app n’est pas silencée', () => {
    expect(isSilenced()).toBe(false);
  });

  it('setSilenceMode bascule le drapeau lu par les primitives', () => {
    setSilenceMode(true);
    expect(isSilenced()).toBe(true);
    setSilenceMode(false);
    expect(isSilenced()).toBe(false);
  });
});
