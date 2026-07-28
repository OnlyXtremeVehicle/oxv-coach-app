/**
 * La machine d'état pilote doit être ALIMENTÉE, pas seulement écrite.
 *
 * ---
 *
 * LE DÉFAUT QUE CE TEST EMPÊCHE DE REVENIR
 *
 * `useAppStateStore` expose six setters. Trois — `setUser`, `setSessions`,
 * `setActiveRecording` — n'avaient **aucun appelant en production**. Les
 * occurrences apparentes étaient des `useState` homonymes dans un écran admin,
 * ce qu'un simple `grep` ne distingue pas.
 *
 * La chaîne des conséquences :
 *
 *   `hasAccount` reste faux → `determineState` rend toujours `S1_decouverte`
 *   → `captureStepLogic` le mappe sur `route: null` → l'aiguilleur ne redirige
 *   jamais → `setSilenceMode(isSilentState(S1))` vaut toujours faux
 *   → **le silence en piste ne s'est jamais armé.**
 *
 * Le Principe 3 était écrit, testé dans sa logique pure, et inerte à
 * l'exécution. Trois gardes le lisaient correctement — `pushNotificationsService`,
 * `BleErrorModal`, `OfflineBanner` — et attendaient un état qui n'arrivait pas.
 *
 * ---
 *
 * CE TEST VÉRIFIE L'APPEL, PAS LA DÉFINITION
 *
 * Une logique pure ne peut pas attraper ce défaut : elle est juste, et elle
 * l'était. Ce qui manquait était un appelant. Le test lit donc le code de
 * production et exige que le câblage existe — et qu'il soit monté.
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { determineState, isSilentState, STATE_THRESHOLDS } from '@/types/state';

const RACINE = join(__dirname, '..', '..', '..', '..');

function lire(...p: string[]): string {
  return readFileSync(join(RACINE, ...p), 'utf8');
}

/** Retire les commentaires : l'en-tête d'un correctif nomme ce qu'il corrige. */
function codeSeul(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function fichiers(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!/node_modules|__tests__/.test(e.name) && !e.name.startsWith('.')) fichiers(p, out);
    } else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const PONT = codeSeul(lire('src', 'lib', 'initEtatPilote.ts'));
const LAYOUT = codeSeul(lire('app', '_layout.tsx'));

describe('les setters ont un appelant', () => {
  /**
   * On cherche l'appel sur le store, pas le nom nu : `setUser(` seul attrape
   * les `useState` homonymes. C'est exactement le faux positif qui a masqué le
   * défaut pendant des mois.
   */
  it.each(['setUser', 'setActiveRecording'])('%s est appelé par le pont', (setter) => {
    expect(PONT).toContain(`${setter}(`);
  });

  it('le pont passe bien par useAppStateStore', () => {
    expect(PONT).toContain('useAppStateStore');
    expect(PONT).toContain('recompute()');
  });

  // Un pont qu'on n'appelle pas est un pont qu'on n'a pas construit.
  it('le pont est monté au démarrage de l’application', () => {
    expect(LAYOUT).toContain('initEtatPilote');
    expect(LAYOUT).toContain('teardownEtatPilote');
  });

  /**
   * ET LA GARDE CONTRE MOI-MÊME : aucun autre module ne doit poser
   * `setActiveRecording`. Deux sources pour un même champ, c'est deux vérités
   * qui divergent au premier écart de timing.
   */
  it('un seul module alimente activeRecording', () => {
    const porteurs = [...fichiers(join(RACINE, 'src')), ...fichiers(join(RACINE, 'app'))].filter(
      (f) => {
        if (/useAppStateStore\.ts$/.test(f)) return false;
        return codeSeul(readFileSync(f, 'utf8')).includes('setActiveRecording(');
      }
    );
    expect(porteurs.map((f) => f.replace(RACINE, '').replace(/\\/g, '/'))).toEqual([
      '/src/lib/initEtatPilote.ts',
    ]);
  });
});

describe('la chaîne jusqu’au silence', () => {
  const base = {
    hasAccount: true,
    onboardingComplete: true,
    upcomingSessions: [],
    pastSessions: [],
    position: null,
    conditions: {},
    now: new Date('2026-07-28T10:00:00Z'),
  } as unknown as Parameters<typeof determineState>[0];

  function avecVitesse(kmh: number) {
    return determineState({
      ...base,
      activeRecording: {
        sessionId: 's',
        startedAt: new Date('2026-07-28T09:00:00Z'),
        status: 'recording',
        recentAverageSpeedKmh: kmh,
      },
    } as Parameters<typeof determineState>[0]);
  }

  // L'arbitrage du fondateur (28/07/2026) : le silence s'arme au SEUIL DE
  // VITESSE, pas sur « capture en cours ».
  it('au-dessus du seuil, l’état est le roulage et le silence s’arme', () => {
    const etat = avecVitesse(STATE_THRESHOLDS.drivingMinSpeedKmh + 1);
    expect(etat).toBe('S6_roulage');
    expect(isSilentState(etat)).toBe(true);
  });

  it('sous le seuil, on est au paddock et le silence ne s’arme pas', () => {
    const etat = avecVitesse(STATE_THRESHOLDS.drivingMinSpeedKmh - 1);
    expect(etat).toBe('S7_paddock');
    expect(isSilentState(etat)).toBe(false);
  });

  /**
   * LE CAS D'ORIGINE. Sans compte posé, tout le reste est ignoré : la première
   * ligne de `determineState` sort avant même de regarder `activeRecording`.
   */
  it('sans compte, aucune vitesse ne mène au roulage', () => {
    const etat = determineState({
      ...base,
      hasAccount: false,
      activeRecording: {
        sessionId: 's',
        startedAt: new Date(),
        status: 'recording',
        recentAverageSpeedKmh: 200,
      },
    } as Parameters<typeof determineState>[0]);
    expect(etat).toBe('S1_decouverte');
    expect(isSilentState(etat)).toBe(false);
  });
});
