import { HAUTE_SAINTONGE_POINTS } from '@/circuit/hauteSaintonge';

import { buildUserCircuitInsert } from '../userCircuitsService';

// Le service importe le client Supabase (throw sans env) ; on le mocke.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('buildUserCircuitInsert', () => {
  it('dérive un circuit insérable depuis les points OSM (Haute Saintonge)', () => {
    const ins = buildUserCircuitInsert(HAUTE_SAINTONGE_POINTS, '  Mon tracé  ', {
      userId: 'u1',
      visibility: 'private',
    });
    expect(ins.turns_count).toBe(7);
    expect(ins.length_km).toBeGreaterThan(2);
    expect(ins.length_km).toBeLessThan(2.4);
    expect(ins.track_svg_path.startsWith('M ')).toBe(true);
    expect(ins.is_official).toBe(false);
    expect(ins.review_status).toBe('private');
    expect(ins.name).toBe('Mon tracé'); // trim appliqué
    expect(ins.finish_line_lat).toBe(HAUTE_SAINTONGE_POINTS[0].lat);
    expect(ins.bbox_min_lat).toBeLessThan(ins.bbox_max_lat);
    expect(ins.finish_line_heading).toBeGreaterThanOrEqual(0);
    expect(ins.finish_line_heading).toBeLessThan(360);
  });

  it('« proposer à OXV » → review_status submitted', () => {
    const ins = buildUserCircuitInsert(HAUTE_SAINTONGE_POINTS, 'T', {
      userId: 'u',
      visibility: 'submitted',
    });
    expect(ins.review_status).toBe('submitted');
  });

  it('refuse un tracé de moins de 3 points', () => {
    expect(() =>
      buildUserCircuitInsert([{ lat: 1, lon: 1 }], 'x', { userId: 'u', visibility: 'private' })
    ).toThrow();
  });
});
