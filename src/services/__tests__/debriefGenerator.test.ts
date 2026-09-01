/**
 * Tests du générateur de debrief J+1 (sem 13 J2).
 *
 * Couvre :
 *   - Test anti-verbes-interdits sur les 3 actes pour les 3 zones
 *   - Personnalisation prénom / sans prénom
 *   - Format 3 paragraphes séparés par "---"
 *   - Fallback gracieux quand segments[] est vide
 *   - Cas équilibre vehicle/pilot
 */

import { isDoctrineSafe } from '../aiSafetyFilter';
import { generateDebrief, generateSafeDebrief } from '../debriefGenerator';
import type { SegmentAnalysisRow } from '../segmentAnalysesService';
import type { MarginZone } from '@/types/domain';

// Source UNIQUE du lexique proscrit : le filtre doctrinal (T-1). Plus de liste
// dupliquée ici — toute évolution se fait dans aiSafetyFilter (+ son snapshot).
function expectNonDirective(text: string): void {
  expect(isDoctrineSafe(text)).toBe(true);
}

function makeSegment(
  index: number,
  marginPercent: number,
  maxGLateral: number,
  name = `Virage ${index}`
): SegmentAnalysisRow {
  const zone: MarginZone = marginPercent >= 30 ? 'green' : marginPercent >= 15 ? 'yellow' : 'red';
  return {
    id: `s-${index}`,
    telemetrySessionId: 'sess-1',
    userId: 'user-1',
    segmentIndex: index,
    segmentName: name,
    kind: 'turn',
    startProgress: 0,
    endProgress: 1,
    sampleCount: 50,
    durationSeconds: 5,
    entrySpeedKmh: 120,
    apexSpeedKmh: 100,
    exitSpeedKmh: 130,
    minSpeedKmh: 100,
    maxSpeedKmh: 130,
    avgSpeedKmh: 115,
    maxGLateral,
    maxGBraking: 0.8,
    maxGAccel: 0.5,
    avgLateralErrorM: 1.5,
    maxLateralErrorM: 3.0,
    marginPercent,
    marginZone: zone,
    algoVersion: 'trackviz-v1.0',
    computedAt: '2026-05-25T10:00:00Z',
  };
}

const baseInput = {
  firstName: 'Gabin',
  circuitName: 'Beltoise',
  sessionStartedAt: '2026-05-25T10:00:00Z',
  marginGlobal: 35,
  marginZone: 'green' as MarginZone,
  marginVehicle: 40,
  marginPilot: 32,
  lapCount: 5,
  bestLapSeconds: 87.234,
  segments: [
    makeSegment(1, 45, 0.7, 'Saintonge 1'),
    makeSegment(2, 25, 0.95, 'Variante'),
    makeSegment(3, 12, 1.15, 'Épingle'),
  ],
};

describe('generateDebrief — structure et format', () => {
  it('renvoie 3 paragraphes non vides', () => {
    const out = generateDebrief(baseInput);
    expect(out.recit.length).toBeGreaterThan(20);
    expect(out.meta.length).toBeGreaterThan(20);
    expect(out.preparation.length).toBeGreaterThan(20);
  });

  it('concatène les 3 paragraphes séparés par "---"', () => {
    const out = generateDebrief(baseInput);
    const parts = out.text.split('\n---\n');
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe(out.recit);
    expect(parts[1]).toBe(out.meta);
    expect(parts[2]).toBe(out.preparation);
  });

  it('inclut le prénom si fourni', () => {
    const out = generateDebrief(baseInput);
    expect(out.recit).toContain('Gabin');
  });

  it("commence par 'Hier' sans prénom si firstName est null", () => {
    const out = generateDebrief({ ...baseInput, firstName: null });
    expect(out.recit).toMatch(/^Hier, la marge globale/);
  });
});

describe('generateDebrief — doctrine (verbes interdits)', () => {
  for (const zone of ['green', 'yellow', 'red'] as const) {
    it(`reste non directif pour zone ${zone}`, () => {
      const out = generateDebrief({
        ...baseInput,
        marginGlobal: zone === 'green' ? 45 : zone === 'yellow' ? 22 : 8,
        marginZone: zone,
      });
      expectNonDirective(out.recit);
      expectNonDirective(out.meta);
      expectNonDirective(out.preparation);
      expectNonDirective(out.text);
    });
  }

  it('ne contient pas de score chiffré sous forme x/100', () => {
    const out = generateDebrief(baseInput);
    expect(out.text).not.toMatch(/\d+\s*\/\s*100/);
  });
});

describe('generateDebrief — utilisation des segments', () => {
  it('mentionne le virage au plus fort G_lat dans le récit', () => {
    const out = generateDebrief(baseInput);
    // Le segment "Épingle" a maxGLateral = 1.15, le plus haut
    expect(out.recit).toContain('Épingle');
  });

  it("met en focus le segment à plus faible marge dans l'acte 3", () => {
    const out = generateDebrief(baseInput);
    // Le segment "Épingle" a marginPercent = 12, le plus bas
    expect(out.preparation).toContain('Épingle');
  });

  it('fonctionne sans segments (fallback gracieux)', () => {
    const out = generateDebrief({ ...baseInput, segments: [] });
    expect(out.recit.length).toBeGreaterThan(20);
    expect(out.preparation.length).toBeGreaterThan(20);
    // Pas de référence à un virage spécifique
    expect(out.recit).not.toMatch(/Virage \d/);
  });
});

/**
 * LES DEUX MARGES, SANS LE TRAIT QUI LES RELIAIT.
 *
 * Les trois phrases d'origine EXPLIQUAIENT l'écart : « votre lecture du jour
 * était la variable », « la machine portait son lot », « un équilibre rare ».
 * Deux causes et un jugement, là où la base ne porte que deux nombres.
 */
describe('generateDebrief — les deux marges', () => {
  it('les pose côte à côte, avec leurs valeurs', () => {
    const out = generateDebrief({ ...baseInput, marginVehicle: 35, marginPilot: 32 });
    expect(out.meta).toContain('Marge véhicule 35 %');
    expect(out.meta).toContain('marge pilote 32 %');
  });

  it('ne relie jamais les deux — aucune cause, aucun jugement', () => {
    for (const [v, p] of [
      [35, 32],
      [60, 20],
      [20, 60],
    ] as const) {
      const meta = generateDebrief({ ...baseInput, marginVehicle: v, marginPilot: p }).meta;
      for (const interdit of ['parce que', 'variable', 'portait son lot', 'équilibre rare']) {
        expect(meta.toLowerCase()).not.toContain(interdit);
      }
    }
  });

  it('se tait quand une seule des deux est mesurée', () => {
    const out = generateDebrief({ ...baseInput, marginVehicle: 35, marginPilot: null });
    expect(out.meta).not.toContain('Marge véhicule');
  });
});

describe('generateSafeDebrief — garde-fou doctrinal (T-1)', () => {
  it('laisse passer une sortie nominale (safety=clean) et reste conforme', () => {
    const out = generateSafeDebrief(baseInput);
    expect(out.safety).toBe('clean');
    expect(isDoctrineSafe(out.text)).toBe(true);
    // Identique au générateur nominal quand rien n'est piégé.
    expect(out.text).toBe(generateDebrief(baseInput).text);
  });

  it('retire le détail segment quand un nom de virage porte une tournure proscrite', () => {
    const piege = makeSegment(3, 12, 1.15, 'Freinez plus tôt');
    const out = generateSafeDebrief({ ...baseInput, segments: [piege] });
    expect(out.safety).toBe('stripped-segments');
    expect(isDoctrineSafe(out.text)).toBe(true);
    expect(out.text.toLowerCase()).not.toContain('freinez');
  });

  it('retombe sur le débrief générique conforme si même la version sans segment échoue', () => {
    // Vecteur résiduel : un prénom portant une tournure proscrite.
    const out = generateSafeDebrief({ ...baseInput, firstName: 'Freinez', segments: [] });
    expect(out.safety).toBe('generic');
    expect(isDoctrineSafe(out.text)).toBe(true);
    expect(out.text.split('\n---\n').length).toBe(3);
  });
});

describe('generateDebrief — formatage temps tour', () => {
  it('formate le best lap au format m:ss,mmm', () => {
    const out = generateDebrief({ ...baseInput, bestLapSeconds: 87.234 });
    expect(out.recit).toContain('1:27,234');
  });

  it('omet le temps si bestLapSeconds est null', () => {
    const out = generateDebrief({ ...baseInput, bestLapSeconds: null });
    expect(out.recit).not.toMatch(/\d+:\d+/);
  });
});

/**
 * LE CLIQUET DU TON — tout ce que l'APPLICATION énonce passe le filtre en
 * portée `application`, pas seulement en portée humaine.
 *
 * C'est le test qui manquait. Les gabarits étaient réputés « statiques et
 * testés conformes », et ils l'étaient — contre le lexique DIRECTIF. Personne
 * ne vérifiait le ton, et « vous avez piloté avec aisance » est sorti pendant
 * des mois sur la séance de référence.
 */
describe('debrief — aucun gabarit ne juge le pilote', () => {
  const zones: MarginZone[] = ['green', 'yellow', 'red'];

  it.each(zones)('les trois actes restent neutres en zone %s', (zone) => {
    const out = generateDebrief({ ...baseInput, marginZone: zone });
    for (const acte of [out.recit, out.meta, out.preparation]) {
      expect(isDoctrineSafe(acte, 'application')).toBe(true);
    }
  });

  it('sans segment ni marge détaillée non plus', () => {
    const out = generateDebrief({
      ...baseInput,
      segments: [],
      marginVehicle: null,
      marginPilot: null,
    });
    expect(isDoctrineSafe(out.text, 'application')).toBe(true);
  });

  it('le repli générique aussi — c’est le dernier filet', () => {
    const out = generateSafeDebrief({ ...baseInput, firstName: 'Freinez' });
    expect(isDoctrineSafe(out.text, 'application')).toBe(true);
  });

  /** « Le Épingle » sortait tel quel : les noms de virage viennent de la base. */
  it('élide devant un nom de virage à initiale vocalique', () => {
    const out = generateDebrief(baseInput);
    expect(out.recit).not.toContain('Le Épingle');
    expect(out.recit).toContain("L'Épingle");
  });
});
