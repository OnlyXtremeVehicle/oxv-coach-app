import * as fs from 'fs';
import * as path from 'path';

import {
  PRO_ROUTE_TO_ZONE,
  PRO_TAB_MAIN_ROUTE,
  PRO_TAB_ORDER,
  proZoneOfRoute,
  shouldShowProTabBar,
} from '../proNav';

/** Segments de route RÉELS sous app/(pro) (fichiers .tsx + dossiers), hors système. */
function realProSegments(): string[] {
  const dir = path.join(process.cwd(), 'app', '(pro)');
  const out = new Set<string>();
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = e.isDirectory() ? e.name : e.name.replace(/\.tsx$/, '');
    if (!e.isDirectory() && !e.name.endsWith('.tsx')) continue;
    if (name === '_layout' || name === '+not-found') continue;
    if (name.startsWith('[') || name.startsWith('(')) continue;
    if (name === 'index') continue; // l'index correspond à '' (paddock pro)
    out.add(name);
  }
  return [...out];
}

describe('proNav', () => {
  it('PRO_TAB_ORDER est exact et dans l’ordre métier', () => {
    expect(PRO_TAB_ORDER).toEqual([
      'pro-paddock',
      'pro-performance',
      'pro-media',
      'pro-equipe',
      'pro-partage',
    ]);
  });

  it('compte n’est jamais un onglet pro', () => {
    expect(PRO_TAB_ORDER as readonly string[]).not.toContain('compte');
  });

  it('proZoneOfRoute mappe les routes clés', () => {
    expect(proZoneOfRoute('/')).toBe('pro-paddock');
    expect(proZoneOfRoute('/performance')).toBe('pro-performance');
    expect(proZoneOfRoute('/media')).toBe('pro-media');
    expect(proZoneOfRoute('/equipe')).toBe('pro-equipe');
    expect(proZoneOfRoute('/partage')).toBe('pro-partage');
  });

  it('shouldShowProTabBar n’affiche la barre que sur les racines d’onglet', () => {
    expect(shouldShowProTabBar('/')).toBe(true);
    expect(shouldShowProTabBar('/performance')).toBe(true);
    expect(shouldShowProTabBar('/inconnu')).toBe(false);
  });
});

describe('proNav — cohérence avec les routes réelles', () => {
  const real = realProSegments();

  it('chaque écran (pro) est mappé à une zone (pas d’orpheline)', () => {
    const orphans = real.filter((seg) => !(seg in PRO_ROUTE_TO_ZONE));
    expect(orphans).toEqual([]);
  });

  it('aucune entrée proNav ne pointe vers une route inexistante', () => {
    const realSet = new Set(real);
    const dangling = Object.keys(PRO_ROUTE_TO_ZONE).filter(
      (seg) => seg !== '' && seg !== 'index' && !realSet.has(seg)
    );
    expect(dangling).toEqual([]);
  });

  it('chaque onglet pro pointe vers une route racine existante', () => {
    const realSet = new Set(real);
    for (const [tab, route] of Object.entries(PRO_TAB_MAIN_ROUTE)) {
      const seg = route.replace('/(pro)', '').replace(/^\/+/, '');
      if (tab === 'pro-paddock') expect(seg).toBe('');
      else expect(realSet.has(seg)).toBe(true);
    }
  });
});
