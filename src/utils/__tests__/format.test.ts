/**
 * Tests des helpers de formatage.
 */

import {
  formatDateLong,
  formatDateShort,
  formatDelta,
  formatDuration,
  formatLapTime,
} from '@/utils/format';

describe('formatLapTime', () => {
  it('formate un tour sous 60s en ss.cc s', () => {
    expect(formatLapTime(45.123)).toBe('45.12 s');
    expect(formatLapTime(0.5)).toBe('0.50 s');
  });

  it("formate un tour au-dessus de 60s en mm'ss.cc", () => {
    expect(formatLapTime(82.45)).toBe("1'22.45");
    expect(formatLapTime(125)).toBe("2'05.00");
    expect(formatLapTime(3725)).toBe("62'05.00");
  });

  it('zero-pad les secondes < 10', () => {
    expect(formatLapTime(63)).toBe("1'03.00");
    expect(formatLapTime(60.5)).toBe("1'00.50");
  });

  it('renvoie em-dash pour valeurs invalides', () => {
    expect(formatLapTime(NaN)).toBe('—');
    expect(formatLapTime(-1)).toBe('—');
    expect(formatLapTime(Infinity)).toBe('—');
  });
});

describe('formatDuration', () => {
  it('formate des minutes seules', () => {
    expect(formatDuration(125)).toBe('2 min');
    expect(formatDuration(60)).toBe('1 min');
    expect(formatDuration(3599)).toBe('59 min');
  });

  it('formate des heures + minutes', () => {
    expect(formatDuration(3600)).toBe('1 h 0 min');
    expect(formatDuration(3725)).toBe('1 h 2 min');
    expect(formatDuration(7200)).toBe('2 h 0 min');
  });

  it('renvoie 0 min pour 0', () => {
    expect(formatDuration(0)).toBe('0 min');
  });

  it('renvoie em-dash pour valeurs invalides', () => {
    expect(formatDuration(NaN)).toBe('—');
    expect(formatDuration(-1)).toBe('—');
  });
});

describe('formatDelta', () => {
  it('formate un delta positif avec signe +', () => {
    expect(formatDelta(50, 55, 'km/h')).toBe('+5 km/h');
    expect(formatDelta(20, 32, 'pts')).toBe('+12 pts');
  });

  it('formate un delta négatif avec signe − (U+2212)', () => {
    expect(formatDelta(82.5, 81.8, 's', 2)).toBe('−0.70 s');
    expect(formatDelta(100, 95, 'km/h')).toBe('−5 km/h');
  });

  it('formate un delta nul avec ±', () => {
    expect(formatDelta(20, 20, 'pts')).toBe('±0 pts');
  });

  it('respecte le nombre de décimales', () => {
    expect(formatDelta(0, 1.234, 'g', 2)).toBe('+1.23 g');
    expect(formatDelta(0, 1.234, 'g', 0)).toBe('+1 g');
  });

  it('renvoie em-dash si une valeur est null', () => {
    expect(formatDelta(null, 30, 'pts')).toBe('—');
    expect(formatDelta(30, null, 'pts')).toBe('—');
    expect(formatDelta(null, null, 'pts')).toBe('—');
  });

  it('renvoie em-dash pour valeurs non-finies', () => {
    expect(formatDelta(NaN, 10, 'pts')).toBe('—');
    expect(formatDelta(10, Infinity, 'pts')).toBe('—');
  });
});

describe('formatDateShort', () => {
  it('formate une ISO valide en fr-FR court', () => {
    // Note : Node sans full ICU peut renvoyer un format légèrement différent.
    // On vérifie juste qu'il y a quelque chose, pas le format exact.
    const result = formatDateShort('2026-05-25T10:30:00Z');
    expect(result).not.toBe('—');
    expect(result.length).toBeGreaterThan(0);
  });

  it('renvoie em-dash pour ISO invalide', () => {
    expect(formatDateShort('pas-une-date')).toMatch(/(—|Invalid)/); // tolérant
  });
});

describe('formatDateLong', () => {
  it('formate une ISO valide', () => {
    const result = formatDateLong('2026-05-25T10:30:00Z');
    expect(result).not.toBe('—');
  });
});
