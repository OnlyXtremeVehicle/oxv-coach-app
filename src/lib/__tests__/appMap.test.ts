import { ROUTE_TO_ZONE, TAB_ORDER, dataLabScreens, shouldShowTabBar, zoneOfRoute } from '../appMap';

describe('appMap', () => {
  it('TAB_ORDER est exact et dans l’ordre verrouillé', () => {
    expect(TAB_ORDER).toEqual(['paddock', 'session', 'bilan', 'progression', 'club']);
  });

  it('compte n’est jamais un onglet', () => {
    expect(TAB_ORDER as readonly string[]).not.toContain('compte');
  });

  it('zoneOfRoute mappe les routes clés', () => {
    expect(zoneOfRoute('/')).toBe('paddock');
    expect(zoneOfRoute('/bilan')).toBe('bilan');
    expect(zoneOfRoute('/virage')).toBe('bilan');
    expect(zoneOfRoute('/insight/abc')).toBe('bilan');
    expect(zoneOfRoute('/mon-coach')).toBe('club');
    expect(zoneOfRoute('/settings')).toBe('compte');
    expect(zoneOfRoute('/progression')).toBe('progression');
    expect(zoneOfRoute('/session')).toBe('session');
  });

  it('zoneOfRoute renvoie null pour une route hors zone', () => {
    expect(zoneOfRoute('/debug-capture')).toBeNull();
  });

  it('dataLabScreens couvre les écrans rangés sous le Bilan', () => {
    const dl = dataLabScreens();
    for (const r of [
      'carte',
      'virage',
      'virage-comparer',
      'tours',
      'heatmap',
      'replay',
      'telemetry',
      'insights',
    ]) {
      expect(dl).toContain(r);
      // cohérence : chaque écran Data Lab est bien rangé sous Bilan
      expect(ROUTE_TO_ZONE[r]).toBe('bilan');
    }
  });

  it('shouldShowTabBar masque la barre en piste et dans le flux capture', () => {
    expect(shouldShowTabBar('/', 'S6_roulage')).toBe(false);
    expect(shouldShowTabBar('/roulage', 'S7_paddock')).toBe(false);
    expect(shouldShowTabBar('/equipement', 'S5_approche')).toBe(false);
    expect(shouldShowTabBar('/bilan', 'S8_atterrissage')).toBe(true);
    expect(shouldShowTabBar('/', 'S1_decouverte')).toBe(true);
  });
});
