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

// Liste alignée avec le test focusCorner — toute évolution doctrinale
// doit être appliquée des deux côtés.
const FORBIDDEN_VERBS = [
  'freinez',
  'freine ',
  'accélérez',
  'accélère ',
  'ouvrez les gaz',
  'tracez',
  'évitez',
  'il faut',
  'vous devez',
  'vous devriez',
  'tu dois',
  'tu peux',
  'pousse',
];

function expectNonDirective(text: string): void {
  const lower = text.toLowerCase();
  for (const verb of FORBIDDEN_VERBS) {
    expect(lower).not.toContain(verb);
  }
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
    expect(out.recit).toMatch(/^Hier, vous/);
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

describe('generateDebrief — équilibre vehicle/pilot', () => {
  it("identifie l'équilibre quand véhicule et pilote sont proches (|delta| < 8)", () => {
    const out = generateDebrief({
      ...baseInput,
      marginVehicle: 35,
      marginPilot: 32,
    });
    expect(out.meta.toLowerCase()).toContain('équilibre');
  });

  it('parle de la voiture quand sa marge est plus grande', () => {
    const out = generateDebrief({
      ...baseInput,
      marginVehicle: 60,
      marginPilot: 20,
    });
    expect(out.meta.toLowerCase()).toContain('voiture');
  });

  it('parle du pilote quand sa marge est plus grande', () => {
    const out = generateDebrief({
      ...baseInput,
      marginVehicle: 20,
      marginPilot: 60,
    });
    expect(out.meta.toLowerCase()).toContain('pilote');
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
  it('formate le best lap au format m:ss.mmm', () => {
    const out = generateDebrief({ ...baseInput, bestLapSeconds: 87.234 });
    expect(out.recit).toContain('1:27.234');
  });

  it('omet le temps si bestLapSeconds est null', () => {
    const out = generateDebrief({ ...baseInput, bestLapSeconds: null });
    expect(out.recit).not.toMatch(/\d+:\d+/);
  });
});
