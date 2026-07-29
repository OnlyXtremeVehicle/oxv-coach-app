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

/**
 * Segments de route RÉELS, sur les DEUX arbres.
 *
 * ---
 *
 * POURQUOI LES DEUX, ET POURQUOI EN PROFONDEUR
 *
 * Ce balayage ne connaissait que `app/(app)`. À mesure que les écrans migrent
 * vers `app/(app2)`, il devenait aveugle : une entrée d'`appMap` pointant vers
 * un écran porté était déclarée orpheline, et la seule issue était de retirer
 * l'entrée — donc de désarmer la carte au lieu de la corriger.
 *
 * Constaté le 29/07/2026 en portant `mes-routes` vers `app/(app2)/club/routes`.
 *
 * La descente est RÉCURSIVE parce que l'arbre app2 range ses écrans en
 * sous-dossiers (`club/`, `data/`, `bilan/`, `rec/`) : un segment d'`appMap`
 * est un nom, pas un chemin, et il peut vivre à n'importe quelle profondeur.
 */
function segmentsDeArbre(dir: string, out: Set<string>): void {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = e.isDirectory() ? e.name : e.name.replace(/\.tsx$/, '');
    if (!e.isDirectory() && !e.name.endsWith('.tsx')) continue;
    if (name === '_layout' || name === '+not-found') continue;
    if (name.startsWith('[')) continue;
    // Un groupe `(xxx)` ne produit pas de segment d'URL — on le TRAVERSE.
    if (name.startsWith('(')) {
      if (e.isDirectory()) segmentsDeArbre(path.join(dir, e.name), out);
      continue;
    }
    if (name !== 'index') out.add(name);
    if (e.isDirectory()) segmentsDeArbre(path.join(dir, e.name), out);
  }
}

/**
 * TOUS les segments atteignables, les deux arbres confondus.
 *
 * Sert à vérifier qu'aucune entrée d'`appMap` ne pointe dans le vide — un écran
 * porté vers app2 reste un écran, et la carte doit pouvoir le désigner.
 */
function realRouteSegments(): string[] {
  const out = new Set<string>();
  segmentsDeArbre(path.join(process.cwd(), 'app', '(app)'), out);
  segmentsDeArbre(path.join(process.cwd(), 'app', '(app2)'), out);
  return [...out];
}

/**
 * Les segments du SEUL arbre V1.
 *
 * `appMap` est une carte des ZONES V1 : elle range les écrans de `app/(app)`
 * dans les cinq zones de sa barre d'onglets. L'arbre app2 a sa propre
 * structure, et exiger qu'`appMap` le couvre lui ferait dire ce pour quoi elle
 * n'existe pas.
 *
 * Le test d'orphelines porte donc sur V1 seul. Le jour où l'arbre V1 disparaît
 * (lot 21), c'est `appMap` entière qui part avec.
 */
function segmentsV1(): string[] {
  const out = new Set<string>();
  segmentsDeArbre(path.join(process.cwd(), 'app', '(app)'), out);
  return [...out];
}

// Routes volontairement HORS zones d'onglets : debug (gated __DEV__), médias de
// session, vue de partage publique (deep-link), et la décharge (écran contextuel
// signé à la réservation via param, gaté par le flag pilot_waivers). Documentées
// ici pour que le test reste un garde-fou contre les VRAIES orphelines.
const UNMAPPED_ALLOWLIST = new Set([
  'debug-capture',
  // 'debug-circuit' est parti au lot T0 : son unique objet était de prévisualiser
  // le tracé three.js, retiré avec le moteur.
  'session-media',
  'share',
  'decharge',
]);

describe('appMap', () => {
  it('TAB_ORDER = les 5 zones des maquettes refonte-v2', () => {
    expect(TAB_ORDER).toEqual(['miroir', 'datalab', 'carnet', 'decouverte', 'compte']);
  });

  it('Compte est désormais le 5e onglet (maquettes refonte-v2)', () => {
    expect(TAB_ORDER as readonly string[]).toContain('compte');
    expect(TAB_ORDER[TAB_ORDER.length - 1]).toBe('compte');
  });

  it('zoneOfRoute mappe les routes clés', () => {
    expect(zoneOfRoute('/')).toBe('miroir');
    expect(zoneOfRoute('/bilan')).toBe('miroir');
    expect(zoneOfRoute('/signature')).toBe('miroir');
    expect(zoneOfRoute('/progression')).toBe('miroir');
    expect(zoneOfRoute('/virage')).toBe('datalab');
    expect(zoneOfRoute('/carnet')).toBe('carnet');
    expect(zoneOfRoute('/mon-coach')).toBe('decouverte');
    expect(zoneOfRoute('/settings')).toBe('compte');
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
      // `insights` et `insight/[reading]` ont été supprimés : c'étaient les deux
      // écrans de DÉMONSTRATION v1, alimentés par des constantes fabriquées et
      // sans aucun lien entrant. Les lectures approfondies vivent désormais dans
      // /(app2)/data/session/[id], sur données mesurées.
    ]) {
      expect(dl).toContain(r);
      // cohérence : chaque écran Data Lab est bien rangé sous la zone Data Lab
      expect(ROUTE_TO_ZONE[r]).toBe('datalab');
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
    // V1 SEUL : appMap range les écrans de la barre d'onglets V1. L'arbre app2
    // a sa propre structure et n'est pas de son ressort.
    const orphans = segmentsV1().filter(
      (seg) => !(seg in ROUTE_TO_ZONE) && !UNMAPPED_ALLOWLIST.has(seg)
    );
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
      // miroir = index ('/(app)' → ''), les autres ont un segment réel.
      if (tab === 'miroir') expect(seg).toBe('');
      else expect(realSet.has(seg)).toBe(true);
    }
  });
});
