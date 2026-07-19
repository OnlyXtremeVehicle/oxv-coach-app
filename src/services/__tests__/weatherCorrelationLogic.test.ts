import {
  averageOrNull,
  correlateWeather,
  type WeatherCorrelationRow,
} from '@/services/weatherCorrelationLogic';

describe('averageOrNull (garde-fou anti-fabrication)', () => {
  it('liste vide → null, JAMAIS 0', () => {
    expect(averageOrNull([])).toBeNull();
    expect(averageOrNull([])).not.toBe(0);
  });

  it('moyenne réelle sur liste non vide', () => {
    expect(averageOrNull([90_000, 92_000])).toBe(91_000);
    expect(averageOrNull([100_000])).toBe(100_000);
  });
});

describe('correlateWeather — bucketing factuel', () => {
  it('range les séances par tranches de 5 °C / 10 % et moyenne les meilleurs tours', () => {
    const rows: WeatherCorrelationRow[] = [
      { bestLapMs: 90_000, temperatureC: 12, humidityPct: 55 }, // temp 10–15 / hum 50–60
      { bestLapMs: 92_000, temperatureC: 13, humidityPct: 58 }, // temp 10–15 / hum 50–60
      { bestLapMs: 100_000, temperatureC: 21, humidityPct: 40 }, // temp 20–25 / hum 40–50
    ];

    const { byTemp, byHumidity } = correlateWeather(rows);

    expect(byTemp).toEqual([
      { label: '10–15 °C', loInclusive: 10, hiExclusive: 15, avgLapMs: 91_000, count: 2 },
      { label: '20–25 °C', loInclusive: 20, hiExclusive: 25, avgLapMs: 100_000, count: 1 },
    ]);

    // Trié par borne basse croissante (40 avant 50).
    expect(byHumidity).toEqual([
      { label: '40–50 %', loInclusive: 40, hiExclusive: 50, avgLapMs: 100_000, count: 1 },
      { label: '50–60 %', loInclusive: 50, hiExclusive: 60, avgLapMs: 91_000, count: 2 },
    ]);
  });

  it('gère les tranches négatives (Math.floor sur température < 0)', () => {
    const rows: WeatherCorrelationRow[] = [
      { bestLapMs: 95_000, temperatureC: -3, humidityPct: 20 },
    ];
    const { byTemp } = correlateWeather(rows);
    expect(byTemp).toEqual([
      { label: '-5–0 °C', loInclusive: -5, hiExclusive: 0, avgLapMs: 95_000, count: 1 },
    ]);
  });
});

describe('correlateWeather — honnêteté (null, jamais 0)', () => {
  it('une tranche peuplée mais sans tour mesuré rend avgLapMs = null (pas 0)', () => {
    const rows: WeatherCorrelationRow[] = [
      { bestLapMs: null, temperatureC: 30, humidityPct: 70 },
      { bestLapMs: null, temperatureC: 31, humidityPct: 72 },
    ];
    const { byTemp } = correlateWeather(rows);
    expect(byTemp).toHaveLength(1);
    expect(byTemp[0].count).toBe(2); // séances comptées
    expect(byTemp[0].avgLapMs).toBeNull(); // mais aucun tour → null
    expect(byTemp[0].avgLapMs).not.toBe(0);
  });

  it('les bestLapMs nuls sont exclus de la moyenne mais la séance reste comptée', () => {
    const rows: WeatherCorrelationRow[] = [
      { bestLapMs: null, temperatureC: 12, humidityPct: 55 },
      { bestLapMs: 80_000, temperatureC: 13, humidityPct: 56 },
    ];
    const { byTemp } = correlateWeather(rows);
    expect(byTemp).toEqual([
      { label: '10–15 °C', loInclusive: 10, hiExclusive: 15, avgLapMs: 80_000, count: 2 },
    ]);
  });

  it("une valeur d'axe nulle n'est pas rangée sur cet axe (mais peut l'être sur l'autre)", () => {
    const rows: WeatherCorrelationRow[] = [
      { bestLapMs: 90_000, temperatureC: null, humidityPct: 55 },
    ];
    const { byTemp, byHumidity } = correlateWeather(rows);
    expect(byTemp).toEqual([]); // température absente → aucune tranche
    expect(byHumidity).toEqual([
      { label: '50–60 %', loInclusive: 50, hiExclusive: 60, avgLapMs: 90_000, count: 1 },
    ]);
  });
});

describe('correlateWeather — entrée vide', () => {
  it('aucune ligne → aucune tranche', () => {
    expect(correlateWeather([])).toEqual({ byTemp: [], byHumidity: [] });
  });
});
