/**
 * Corrélation météo pure (L3 DATA) — agrège les meilleurs tours du SEUL pilote
 * courant par tranches factuelles de température (air) et d'humidité.
 *
 * Doctrine d'honnêteté :
 *   - Aucune prédiction, aucune tendance, aucun « optimal » : on ne fait que
 *     RANGER des faits déjà mesurés dans des cases fixes et en donner la moyenne.
 *   - Une case sans aucun tour mesuré rend `avgLapMs = null`, JAMAIS 0 : un 0
 *     serait un chiffre fabriqué. `averageOrNull` verrouille cette frontière.
 *   - Les colonnes agrégées existent réellement dans `weather_snapshots`
 *     (temperature_c = air, humidity_pct). On n'invente aucun canal (pas de
 *     température piste, pas de fréquence cardiaque : ces colonnes n'existent
 *     pas).
 *
 * Module PUR : aucune dépendance React / React Native / Supabase. Les entrées
 * sont déjà normalisées par le loader (`weatherCorrelationService.ts`), ce qui
 * rend l'agrégation testable sans I/O (ts-jest node).
 */

/** Un point de mesure : le meilleur tour d'une séance et sa météo au moment. */
export interface WeatherCorrelationRow {
  /** Meilleur tour de la séance, en millisecondes. `null` = non mesuré. */
  bestLapMs: number | null;
  /** Température de l'AIR en °C (jamais la piste, colonne inexistante). */
  temperatureC: number | null;
  /** Humidité relative en %. */
  humidityPct: number | null;
}

/** Une tranche factuelle [loInclusive, hiExclusive) et son agrégat. */
export interface WeatherBucket {
  /** Étiquette lisible, ex. « 15–20 °C ». */
  label: string;
  /** Borne basse incluse de la tranche. */
  loInclusive: number;
  /** Borne haute exclue de la tranche. */
  hiExclusive: number;
  /** Moyenne des meilleurs tours mesurés dans la tranche. `null` si aucun. */
  avgLapMs: number | null;
  /** Nombre de séances rangées dans la tranche (axe renseigné). */
  count: number;
}

export interface WeatherCorrelation {
  byTemp: WeatherBucket[];
  byHumidity: WeatherBucket[];
}

/** Largeur des tranches de température, en °C. */
export const TEMP_BIN_WIDTH = 5;
/** Largeur des tranches d'humidité, en points de %. */
export const HUMIDITY_BIN_WIDTH = 10;

/**
 * Moyenne honnête : `null` (et jamais 0) sur une liste vide. C'est LE garde-fou
 * doctrinal contre le chiffre fabriqué — une absence de tour mesuré ne doit
 * jamais se lire comme un tour parfait à 0 ms.
 */
export function averageOrNull(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

/**
 * Range les séances dans des tranches fixes sur un axe météo, puis moyenne les
 * meilleurs tours mesurés de chaque tranche.
 *
 * Règles :
 *   - Une séance dont la valeur d'axe est `null`/non finie n'est pas rangée sur
 *     CET axe (elle peut l'être sur l'autre).
 *   - `count` compte toutes les séances rangées dans la tranche.
 *   - `avgLapMs` ne moyenne que les `bestLapMs` réellement mesurés (non nuls,
 *     finis) ; une tranche sans aucun tour mesuré rend `avgLapMs = null`.
 *   - Seules les tranches contenant ≥ 1 séance sont retournées, triées par
 *     borne basse croissante.
 */
function bucketize(
  rows: WeatherCorrelationRow[],
  axis: 'temperatureC' | 'humidityPct',
  binWidth: number,
  formatLabel: (lo: number, hi: number) => string
): WeatherBucket[] {
  // Clé = borne basse de la tranche (loInclusive).
  const bins = new Map<number, { lo: number; laps: number[]; count: number }>();

  for (const row of rows) {
    const value = row[axis];
    if (value === null || !Number.isFinite(value)) continue; // axe absent → non rangé
    const lo = Math.floor(value / binWidth) * binWidth;
    let bin = bins.get(lo);
    if (!bin) {
      bin = { lo, laps: [], count: 0 };
      bins.set(lo, bin);
    }
    bin.count += 1;
    if (row.bestLapMs !== null && Number.isFinite(row.bestLapMs)) {
      bin.laps.push(row.bestLapMs);
    }
  }

  return Array.from(bins.values())
    .sort((a, b) => a.lo - b.lo)
    .map((bin) => ({
      label: formatLabel(bin.lo, bin.lo + binWidth),
      loInclusive: bin.lo,
      hiExclusive: bin.lo + binWidth,
      avgLapMs: averageOrNull(bin.laps),
      count: bin.count,
    }));
}

/**
 * Agrège les meilleurs tours par tranches de température et d'humidité.
 * Faits bruts uniquement — aucune interprétation.
 */
export function correlateWeather(rows: WeatherCorrelationRow[]): WeatherCorrelation {
  return {
    byTemp: bucketize(rows, 'temperatureC', TEMP_BIN_WIDTH, (lo, hi) => `${lo}–${hi} °C`),
    byHumidity: bucketize(rows, 'humidityPct', HUMIDITY_BIN_WIDTH, (lo, hi) => `${lo}–${hi} %`),
  };
}
