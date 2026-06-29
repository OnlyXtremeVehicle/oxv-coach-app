import { BRAND_RED, marginZoneExportColor } from '@/services/marginZoneColorLogic';

describe('marginZoneExportColor (PR-69 — rouge = marque, jamais la perf)', () => {
  it('aucune zone de marge ne sort en rouge de marque', () => {
    for (const zone of ['green', 'yellow', 'red', null] as const) {
      expect(marginZoneExportColor(zone)).not.toBe(BRAND_RED);
    }
  });

  it('la zone serrée est rendue en ambre neutralisé, pas en rouge', () => {
    expect(marginZoneExportColor('red')).toBe('#F2792B');
  });

  it('vert et jaune restent factuels', () => {
    expect(marginZoneExportColor('green')).toBe('#97C459');
    expect(marginZoneExportColor('yellow')).toBe('#EF9F27');
  });
});
