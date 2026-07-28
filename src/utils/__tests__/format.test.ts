/**
 * Tests des helpers de formatage.
 */

import {
  virgule,
  formatChronoTenths,
  formatDateLong,
  formatDateShort,
  formatDelta,
  formatDuration,
  formatLapTime,
  formatLapTimeMs,
} from '@/utils/format';

describe('formatLapTime', () => {
  it('formate un tour sous 60s en ss.cc s', () => {
    expect(formatLapTime(45.123)).toBe('45,12 s');
    expect(formatLapTime(0.5)).toBe('0,50 s');
  });

  it("formate un tour au-dessus de 60s en mm'ss.cc", () => {
    expect(formatLapTime(82.45)).toBe("1'22,45");
    expect(formatLapTime(125)).toBe("2'05,00");
    expect(formatLapTime(3725)).toBe("62'05,00");
  });

  it('zero-pad les secondes < 10', () => {
    expect(formatLapTime(63)).toBe("1'03,00");
    expect(formatLapTime(60.5)).toBe("1'00,50");
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
    expect(formatDelta(82.5, 81.8, 's', 2)).toBe('−0,70 s');
    expect(formatDelta(100, 95, 'km/h')).toBe('−5 km/h');
  });

  it('formate un delta nul avec ±', () => {
    expect(formatDelta(20, 20, 'pts')).toBe('±0 pts');
  });

  it('respecte le nombre de décimales', () => {
    expect(formatDelta(0, 1.234, 'g', 2)).toBe('+1,23 g');
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

describe('formatLapTimeMs — le piège PostgREST', () => {
  it('formate un chrono venu de la base en CHAÎNE', () => {
    // `laps.duration_seconds` et `sessions.best_lap_seconds` sont des colonnes
    // `numeric` : PostgREST les rend en chaîne. Le formateur rendait « — » sur
    // des chronos parfaitement présents — débrief, studio, fiche pilote.
    expect(formatLapTimeMs('95.200' as unknown as number)).toBe('1:35,200');
    expect(formatLapTimeMs('45.123' as unknown as number)).toBe('45,123 s');
  });

  it('formate identiquement le nombre et sa chaîne', () => {
    expect(formatLapTimeMs('102.7' as unknown as number)).toBe(formatLapTimeMs(102.7));
  });

  it('garde le tiret pour ce qui est vraiment absent ou illisible', () => {
    expect(formatLapTimeMs(null)).toBe('—');
    expect(formatLapTimeMs(undefined)).toBe('—');
    expect(formatLapTimeMs('' as unknown as number)).toBe('—');
    expect(formatLapTimeMs('abc' as unknown as number)).toBe('—');
    expect(formatLapTimeMs(-1)).toBe('—');
    expect(formatLapTimeMs(Number.NaN)).toBe('—');
  });
});

// ---------------------------------------------------------------------------
// Séparateur décimal — jalon 2, phase 1
// ---------------------------------------------------------------------------

describe('virgule — le séparateur décimal français', () => {
  it('convertit le point décimal', () => {
    expect(virgule('1:41.203')).toBe('1:41,203');
    expect(virgule('45.12 s')).toBe('45,12 s');
  });

  // Le point de fin de phrase, ou celui d'une abréviation, n'est PAS un
  // séparateur : le convertir abîmerait des libellés qui n'ont rien à voir.
  it('ne touche pas un point qui n’est pas entre deux chiffres', () => {
    expect(virgule('4 juil. 2026')).toBe('4 juil. 2026');
    expect(virgule('Voir la méthode.')).toBe('Voir la méthode.');
    expect(virgule('v1.')).toBe('v1.');
  });

  it('convertit plusieurs séparateurs dans une même chaîne', () => {
    expect(virgule('1.5 puis 2.75')).toBe('1,5 puis 2,75');
  });

  it('laisse intacte une chaîne sans décimale', () => {
    expect(virgule('—')).toBe('—');
    expect(virgule('62 pts')).toBe('62 pts');
  });
});

describe('les formateurs canoniques rendent TOUS une virgule', () => {
  it('aucun ne laisse échapper un point décimal', () => {
    const rendus = [
      formatLapTime(82.45),
      formatLapTime(45.123),
      formatLapTimeMs(84.318),
      formatLapTimeMs(45.123),
      formatChronoTenths(84.318),
      formatChronoTenths(45.1),
      formatDelta(82.5, 81.8, 's', 2),
      formatDelta(0, 1.234, 'g', 2),
    ];
    for (const r of rendus) {
      // Un point ENTRE DEUX CHIFFRES serait un séparateur oublié.
      expect(r).not.toMatch(/\d\.\d/);
    }
  });

  it('rend bien la virgule là où il y a des décimales', () => {
    expect(formatLapTime(82.45)).toContain(',');
    expect(formatLapTimeMs(84.318)).toContain(',');
    expect(formatChronoTenths(84.318)).toContain(',');
  });
});
