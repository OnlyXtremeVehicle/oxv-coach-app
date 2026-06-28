import * as fs from 'fs';
import * as path from 'path';

import {
  ROUTE_TO_ZONE,
  TAB_MAIN_ROUTE,
  TAB_ORDER,
  dataLabScreens,
  shouldShowTabBar,
  zoneOfRoute,
} from '../appMap';

/** Segments de route RÉELS sous app/(app) (fichiers .tsx + dossiers), hors système. */
function realRouteSegments(): string[] {
  const dir = path.join(process.cwd(), 'app', '(app)');
  const out = new Set<string>();
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = e.isDirectory() ? e.name : e.name.replace(/\.tsx$/, '');
    if (!e.isDirectory() && !e.name.endsWith('.tsx')) continue;
    if (name === '_layout' || name === '+not-found') continue;
    if (name.startsWith('[') || name.startsWith('(')) continue;
    if (name === 'index') continue; // l'index correspond à '' (paddock)
    out.add(name);
  }
  return [...out];
}

// Routes volontairement HORS zones d'onglets : debug (gated __DEV__), médias de
// session, vue de partage publique (deep-link). Documentées ici pour que le test
// reste un garde-fou contre les VRAIES orphelines (ex. un nouvel écran oublié).
const UNMAPPED_ALLOWLIST = new Set(['debug-capture', 'debug-circuit', 'session-media', 'share']);

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

describe('appMap — cohérence avec les routes réelles', () => {
  const real = realRouteSegments();

  it('chaque écran (app) est mappé à une zone (pas d’orpheline)', () => {
    const orphans = real.filter((seg) => !(seg in ROUTE_TO_ZONE) && !UNMAPPED_ALLOWLIST.has(seg));
    expect(orphans).toEqual([]);
  });

  it('aucune entrée appMap ne pointe vers une route inexistante', () => {
    const realSet = new Set(real);
    const dangling = Object.keys(ROUTE_TO_ZONE).filter(
      (seg) => seg !== '' && seg !== 'index' && !realSet.has(seg)
    );
    expect(dangling).toEqual([]);
  });

  it('chaque onglet pointe vers une route racine existante', () => {
    const realSet = new Set(real);
    for (const [tab, route] of Object.entries(TAB_MAIN_ROUTE)) {
      const seg = route.replace('/(app)', '').replace(/^\/+/, '');
      // paddock = index ('/(app)' → ''), les autres ont un segment réel.
      if (tab === 'paddock') expect(seg).toBe('');
      else expect(realSet.has(seg)).toBe(true);
    }
  });
});
