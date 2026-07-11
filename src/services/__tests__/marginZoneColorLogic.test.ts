import { BRAND_RED, marginZoneExportColor } from '@/services/marginZoneColorLogic';
import { dataColors, palette } from '@/theme/v2';

describe('marginZoneExportColor (V3 — rouge de DONNÉE ok, rouge de MARQUE jamais)', () => {
  it('aucune zone de marge ne sort en rouge de MARQUE (#C8102E)', () => {
    for (const zone of ['green', 'yellow', 'red', null] as const) {
      expect(marginZoneExportColor(zone)).not.toBe(BRAND_RED);
    }
  });

  it('la zone serrée est rendue en rouge de DONNÉE (#F65B5B), pas le rouge de marque', () => {
    expect(marginZoneExportColor('red')).toBe(dataColors.brake);
    expect(marginZoneExportColor('red')).toBe('#F65B5B');
  });

  it('dégradé de marge : moyen = or, large = vert', () => {
    expect(marginZoneExportColor('green')).toBe(palette.green);
    expect(marginZoneExportColor('yellow')).toBe(palette.gold);
  });
});

describe('invariant : rouge de donnée ≠ rouge de marque (verrou anti-régression)', () => {
  it('dataColors.brake (freinage/serré) est distinct du rouge de marque', () => {
    expect(dataColors.brake).toBe('#F65B5B');
    expect(dataColors.brake).not.toBe(palette.red);
    expect(dataColors.brake).not.toBe(BRAND_RED);
  });

  it('les zones pointent sur les tokens partagés (pas des littéraux isolés)', () => {
    expect(marginZoneExportColor('red')).toBe(dataColors.brake);
    expect(marginZoneExportColor('green')).toBe(palette.green);
    expect(marginZoneExportColor('yellow')).toBe(palette.gold);
  });
});
