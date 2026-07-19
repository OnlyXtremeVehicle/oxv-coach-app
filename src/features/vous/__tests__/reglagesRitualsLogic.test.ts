/**
 * Tests du mapping des rituels B3 (V2-L4, mission D) : clés JSONB réelles,
 * lecture défaut-ON, écriture préservant les autres clés.
 */

import {
  RITUAL_CHANNELS,
  readRitualPref,
  ritualDef,
  writeRitualPref,
} from '../reglagesRitualsLogic';

describe('RITUAL_CHANNELS (mapping B3)', () => {
  it('mappe chaque rituel vers sa clé notification_preferences réelle', () => {
    const byId = Object.fromEntries(RITUAL_CHANNELS.map((r) => [r.id, r.prefKey]));
    expect(byId).toEqual({
      bilan: 'debrief',
      j3: 'ritual_j3',
      records: 'ritual_records',
    });
  });

  it('« bilan » réutilise un canal déjà programmé (debrief)', () => {
    expect(ritualDef('bilan').scheduled).toBe(true);
  });
});

describe('readRitualPref (défaut-ON)', () => {
  it('absent → actif', () => {
    expect(readRitualPref({}, 'j3')).toBe(true);
    expect(readRitualPref(null, 'records')).toBe(true);
  });

  it('false explicite → coupé', () => {
    expect(readRitualPref({ ritual_j3: false }, 'j3')).toBe(false);
  });

  it('lit via la clé mappée (bilan → debrief)', () => {
    expect(readRitualPref({ debrief: false }, 'bilan')).toBe(false);
  });
});

describe('writeRitualPref (préserve les autres clés)', () => {
  it('écrit la bonne clé sans écraser les autres', () => {
    const next = writeRitualPref({ debrief: true, reminder: false }, 'records', false);
    expect(next).toEqual({ debrief: true, reminder: false, ritual_records: false });
  });

  it('ne mute pas l’objet source', () => {
    const src = { reminder: true };
    writeRitualPref(src, 'j3', false);
    expect(src).toEqual({ reminder: true });
  });
});
