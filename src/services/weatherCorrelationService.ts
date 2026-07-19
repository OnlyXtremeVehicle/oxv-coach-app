/**
 * Service corrélation météo (L3 DATA) — loader fin SELECT-only qui alimente le
 * cœur pur `correlateWeather`.
 *
 * SELF-ONLY : ne lit QUE les séances du pilote courant (`fetchAllSessions` +
 * `weather_snapshots` filtrés par ses `session_id`). Aucun accès coach, aucune
 * donnée d'un autre pilote.
 *
 * DONNÉES RÉELLES : `strict: true` fait REMONTER une panne DB comme une erreur
 * (état erreur + retry côté écran), au lieu de la masquer en agrégat vide qui
 * ressemblerait à « aucune donnée ». On ne fabrique jamais de valeur.
 *
 * La logique d'agrégation vit dans `weatherCorrelationLogic.ts` (pur, testé),
 * ré-exportée ici pour les consommateurs.
 */

import { supabase } from '@/lib/supabase';
import { fetchAllSessions } from '@/services/sessionsService';
import {
  correlateWeather,
  type WeatherCorrelation,
  type WeatherCorrelationRow,
} from '@/services/weatherCorrelationLogic';

export {
  correlateWeather,
  averageOrNull,
  TEMP_BIN_WIDTH,
  HUMIDITY_BIN_WIDTH,
  type WeatherBucket,
  type WeatherCorrelation,
  type WeatherCorrelationRow,
} from '@/services/weatherCorrelationLogic';

/** Ligne brute `weather_snapshots` (colonnes réellement agrégées). */
interface WeatherSnapshotRow {
  session_id: string;
  temperature_c: number | null;
  humidity_pct: number | null;
}

/**
 * Charge la corrélation météo du pilote : chaque séance complétée est jointe à
 * son meilleur tour (`best_lap_seconds * 1000`) et à sa météo capturée, puis
 * agrégée en tranches factuelles.
 *
 * @param userId    pilote courant (SELF-ONLY).
 * @param circuitId restreint à un circuit si fourni.
 */
export async function loadWeatherCorrelation(
  userId: string,
  circuitId?: string
): Promise<WeatherCorrelation> {
  const sessions = await fetchAllSessions(userId, { circuitId, strict: true });
  if (sessions.length === 0) return { byTemp: [], byHumidity: [] };

  const sessionIds = sessions.map((s) => s.id);

  const { data, error } = await supabase
    .from('weather_snapshots')
    .select('session_id, temperature_c, humidity_pct')
    .in('session_id', sessionIds);

  if (error) throw new Error(error.message);

  // Au plus un snapshot exploité par séance (une session peut porter plusieurs
  // « moments » ; on retient le premier rencontré, sans inventer de moyenne).
  const weatherBySession = new Map<
    string,
    { temperatureC: number | null; humidityPct: number | null }
  >();
  for (const row of (data ?? []) as WeatherSnapshotRow[]) {
    if (weatherBySession.has(row.session_id)) continue;
    weatherBySession.set(row.session_id, {
      temperatureC: row.temperature_c !== null ? Number(row.temperature_c) : null,
      humidityPct: row.humidity_pct !== null ? Number(row.humidity_pct) : null,
    });
  }

  const rows: WeatherCorrelationRow[] = sessions.map((s) => {
    const weather = weatherBySession.get(s.id);
    return {
      bestLapMs: s.best_lap_seconds !== null ? Number(s.best_lap_seconds) * 1000 : null,
      temperatureC: weather?.temperatureC ?? null,
      humidityPct: weather?.humidityPct ?? null,
    };
  });

  return correlateWeather(rows);
}
