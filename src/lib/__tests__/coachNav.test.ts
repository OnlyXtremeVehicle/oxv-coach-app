import * as fs from 'fs';
import * as path from 'path';

import {
  COACH_ROUTE_TO_ZONE,
  COACH_TAB_MAIN_ROUTE,
  COACH_TAB_ORDER,
  coachZoneOfRoute,
  shouldShowCoachTabBar,
} from '../coachNav';

/** Segments de route RÉELS sous app/(coach) (fichiers .tsx + dossiers), hors système. */
function realCoachSegments(): string[] {
  const dir = path.join(process.cwd(), 'app', '(coach)');
  const out = new Set<string>();
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = e.isDirectory() ? e.name : e.name.replace(/\.tsx$/, '');
    if (!e.isDirectory() && !e.name.endsWith('.tsx')) continue;
    if (name === '_layout' || name === '+not-found') continue;
    if (name.startsWith('[') || name.startsWith('(')) continue;
    if (name === 'index') continue; // l'index correspond à '' (Poste, sous Pilotes)
    out.add(name);
  }
  return [...out];
}

describe('coachNav', () => {
  it('COACH_TAB_ORDER est exact (5 zones du handoff Coach Mobile)', () => {
    expect(COACH_TAB_ORDER).toEqual(['live', 'pilotes', 'messages', 'agenda', 'moi']);
  });

  it('coachZoneOfRoute mappe les racines d’onglet', () => {
    expect(coachZoneOfRoute('/')).toBe('pilotes');
    expect(coachZoneOfRoute('/en-direct')).toBe('live');
    expect(coachZoneOfRoute('/messages')).toBe('messages');
    expect(coachZoneOfRoute('/calendrier')).toBe('agenda');
    expect(coachZoneOfRoute('/profil')).toBe('moi');
  });

  it('les sous-écrans surlignent le bon onglet', () => {
    expect(coachZoneOfRoute('/studio')).toBe('pilotes');
    expect(coachZoneOfRoute('/en-direct/sim-session')).toBe('live');
    expect(coachZoneOfRoute('/facturation')).toBe('moi');
    expect(coachZoneOfRoute('/roulages')).toBe('agenda');
  });

  it('shouldShowCoachTabBar n’affiche la barre que sur une route mappée', () => {
    expect(shouldShowCoachTabBar('/')).toBe(true);
    expect(shouldShowCoachTabBar('/studio')).toBe(true);
    expect(shouldShowCoachTabBar('/inconnu')).toBe(false);
  });
});

describe('coachNav — cohérence avec les routes réelles', () => {
  const real = realCoachSegments();

  it('chaque écran (coach) est mappé à une zone (pas d’orpheline)', () => {
    const orphans = real.filter((seg) => !(seg in COACH_ROUTE_TO_ZONE));
    expect(orphans).toEqual([]);
  });

  it('aucune entrée coachNav ne pointe vers une route inexistante', () => {
    const realSet = new Set(real);
    const dangling = Object.keys(COACH_ROUTE_TO_ZONE).filter(
      (seg) => seg !== '' && seg !== 'index' && !realSet.has(seg)
    );
    expect(dangling).toEqual([]);
  });

  it('chaque onglet coach pointe vers une route racine existante', () => {
    const realSet = new Set(real);
    for (const [tab, route] of Object.entries(COACH_TAB_MAIN_ROUTE)) {
      const seg = route.replace('/(coach)', '').replace(/^\/+/, '');
      if (tab === 'pilotes') expect(seg).toBe('');
      else expect(realSet.has(seg)).toBe(true);
    }
  });
});
