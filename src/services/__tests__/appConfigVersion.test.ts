import { isVersionBelow } from '@/services/appConfigVersionLogic';

describe('isVersionBelow', () => {
  it('détecte une version inférieure', () => {
    expect(isVersionBelow('1.2.0', '1.3.0')).toBe(true);
    expect(isVersionBelow('1.2.9', '1.3.0')).toBe(true);
    expect(isVersionBelow('0.9.0', '1.0.0')).toBe(true);
    expect(isVersionBelow('1.2.3', '1.2.4')).toBe(true);
  });

  it('accepte une version égale ou supérieure', () => {
    expect(isVersionBelow('1.3.0', '1.3.0')).toBe(false);
    expect(isVersionBelow('1.3.1', '1.3.0')).toBe(false);
    expect(isVersionBelow('2.0.0', '1.9.9')).toBe(false);
  });

  it('gère les longueurs inégales et les valeurs non numériques', () => {
    expect(isVersionBelow('1.2', '1.2.0')).toBe(false);
    expect(isVersionBelow('1.2', '1.2.1')).toBe(true);
    expect(isVersionBelow('1', '1.0.0')).toBe(false);
    expect(isVersionBelow('1.0.0-beta', '1.0.0')).toBe(false);
  });
});
