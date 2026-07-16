/**
 * parsePilotMedia — rétrocompatibilité du jsonb `users.media`.
 *
 * Retour fondateur build 23 : `vehicleId` (optionnel, zéro schéma) rattache un
 * média à un véhicule du garage. Garanties testées : les items historiques sans
 * vehicleId restent des médias de profil (champ absent), le rattachement est
 * préservé au round-trip, et le parse reste tolérant aux entrées mal formées.
 */

import { parsePilotMedia } from '../pilotMediaService';

// Le service importe le client Supabase (throw sans env) et des modules Expo
// natifs ; on les mocke — seul le parse pur est testé ici.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-file-system', () => ({}));
jest.mock('expo-image-picker', () => ({}));

describe('parsePilotMedia (jsonb tolérant)', () => {
  it('items historiques sans vehicleId → médias de profil (champ absent)', () => {
    const out = parsePilotMedia([{ id: 'a', path: 'u/a.jpg', type: 'photo' }]);
    expect(out).toEqual([{ id: 'a', path: 'u/a.jpg', type: 'photo' }]);
    expect(Object.keys(out[0] ?? {})).not.toContain('vehicleId');
  });

  it('préserve vehicleId quand présent (round-trip garage)', () => {
    const out = parsePilotMedia([{ id: 'b', path: 'u/b.jpg', type: 'photo', vehicleId: 'veh-1' }]);
    expect(out).toEqual([{ id: 'b', path: 'u/b.jpg', type: 'photo', vehicleId: 'veh-1' }]);
  });

  it('ignore un vehicleId non-string ou vide', () => {
    const out = parsePilotMedia([
      { id: 'c', path: 'u/c.jpg', type: 'photo', vehicleId: 42 },
      { id: 'd', path: 'u/d.jpg', type: 'photo', vehicleId: '' },
    ]);
    expect(out.map((m) => m.vehicleId)).toEqual([undefined, undefined]);
  });

  it('reste tolérant : entrées mal formées ignorées, type inconnu → photo', () => {
    const out = parsePilotMedia([
      null,
      'texte',
      { id: 'e' },
      { id: 'f', path: 'u/f.mp4', type: 'video' },
      { id: 'g', path: 'u/g.bin', type: 'autre' },
    ]);
    expect(out).toEqual([
      { id: 'f', path: 'u/f.mp4', type: 'video' },
      { id: 'g', path: 'u/g.bin', type: 'photo' },
    ]);
  });

  it('non-tableau → tableau vide', () => {
    expect(parsePilotMedia(null)).toEqual([]);
    expect(parsePilotMedia({})).toEqual([]);
    expect(parsePilotMedia(undefined)).toEqual([]);
  });
});
