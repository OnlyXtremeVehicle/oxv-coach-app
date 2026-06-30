import { BRAND_RED, marginZoneExportColor } from '@/services/marginZoneColorLogic';
import { palette } from '@/theme/v2';

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

describe('source unique de l’ambre pilote (§17 — verrou anti-régression)', () => {
  it('theme.palette.pilotAmber est l’ambre canon, distinct du rouge de marque', () => {
    expect(palette.pilotAmber).toBe('#F2792B');
    expect(palette.pilotAmber).not.toBe(palette.red);
    expect(palette.pilotAmber).not.toBe(BRAND_RED);
  });

  it('la zone serrée d’export pointe sur le token partagé (pas un littéral isolé)', () => {
    expect(marginZoneExportColor('red')).toBe(palette.pilotAmber);
    expect(marginZoneExportColor('green')).toBe(palette.green);
  });
});
