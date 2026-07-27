/**
 * Service météo OXV — Open-Meteo
 *
 * API gratuite, sans clé : https://open-meteo.com
 * - Pas de limite stricte (10 000+ calls/jour)
 * - Européen (RGPD friendly)
 * - Sources : Météo-France, DWD, ECMWF
 */

import { supabase } from '@/lib/supabase';

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

// Cache simple en mémoire (10 min)
interface CacheEntry {
  data: WeatherData;
  timestamp: number;
}
const cache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

// ============================================================
// TYPES
// ============================================================

export interface WeatherData {
  latitude: number;
  longitude: number;

  // Current weather — A-WEATHER-1 (doctrine Miroir) : une mesure ABSENTE est
  // `null`, JAMAIS un 0 fabriqué. Les écrans rendent « — ». Ne coercez jamais.
  temperatureC: number | null;
  feelsLikeC: number | null;
  humidityPct: number | null;
  pressureHpa: number | null;
  visibilityKm: number | null;

  // Wind
  windSpeedKmh: number | null;
  windDirectionDeg: number | null;
  windGustKmh: number | null;

  // Precipitation
  precipitationMm: number | null;
  precipitationProbabilityPct: number | null;

  // Conditions
  //
  // A-WEATHER-1 s'applique ICI AUSSI, et c'est le repli le plus trompeur du
  // fichier : le code météo absent était converti en `0`, et 0 vaut « Ciel
  // dégagé » chez Open-Meteo. L'application annonçait donc un ciel dégagé
  // qu'elle n'avait jamais mesuré — à un pilote qui prépare sa séance.
  //
  // Un ciel inconnu se dit inconnu. Les trois champs tombent ensemble.
  weatherCode: number | null;
  weatherLabel: string | null;
  weatherIcon: string | null;

  // Sun
  isDay: boolean;
  sunriseAt: string | null;
  sunsetAt: string | null;

  // Métadonnées
  capturedAt: string;
  source: 'open-meteo';
}

// ============================================================
// CODES MÉTÉO WMO → labels FR
// ============================================================

const WMO_LABELS: Record<number, { label: string; icon: string }> = {
  0: { label: 'Ciel dégagé', icon: '☀️' },
  1: { label: 'Globalement clair', icon: '🌤️' },
  2: { label: 'Partiellement nuageux', icon: '⛅' },
  3: { label: 'Couvert', icon: '☁️' },
  45: { label: 'Brouillard', icon: '🌫️' },
  48: { label: 'Brouillard givrant', icon: '🌫️' },
  51: { label: 'Bruine légère', icon: '🌦️' },
  53: { label: 'Bruine modérée', icon: '🌦️' },
  55: { label: 'Bruine dense', icon: '🌦️' },
  56: { label: 'Bruine verglaçante légère', icon: '🌨️' },
  57: { label: 'Bruine verglaçante dense', icon: '🌨️' },
  61: { label: 'Pluie légère', icon: '🌧️' },
  63: { label: 'Pluie modérée', icon: '🌧️' },
  65: { label: 'Pluie forte', icon: '🌧️' },
  66: { label: 'Pluie verglaçante légère', icon: '🌨️' },
  67: { label: 'Pluie verglaçante forte', icon: '🌨️' },
  71: { label: 'Neige légère', icon: '🌨️' },
  73: { label: 'Neige modérée', icon: '🌨️' },
  75: { label: 'Neige forte', icon: '❄️' },
  77: { label: 'Grains de neige', icon: '❄️' },
  80: { label: 'Averses légères', icon: '🌦️' },
  81: { label: 'Averses modérées', icon: '🌧️' },
  82: { label: 'Averses violentes', icon: '⛈️' },
  85: { label: 'Averses de neige', icon: '🌨️' },
  86: { label: 'Averses de neige fortes', icon: '🌨️' },
  95: { label: 'Orage', icon: '⛈️' },
  96: { label: 'Orage avec grêle', icon: '⛈️' },
  99: { label: 'Orage violent avec grêle', icon: '⛈️' },
};

function getWeatherInfo(code: number): { label: string; icon: string } {
  return WMO_LABELS[code] || { label: 'Conditions inconnues', icon: '🌥️' };
}

// ============================================================
// FETCH WEATHER
// ============================================================

/**
 * Récupère la météo actuelle pour une position GPS
 * @param lat - latitude
 * @param lon - longitude
 * @param useCache - utiliser le cache (par défaut true)
 */
export async function fetchCurrentWeather(
  lat: number,
  lon: number,
  useCache = true
): Promise<WeatherData | null> {
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;

  // Vérifier le cache
  if (useCache) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      current: [
        'temperature_2m',
        'apparent_temperature',
        'relative_humidity_2m',
        'pressure_msl',
        'precipitation',
        'weather_code',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'is_day',
        'cloud_cover',
      ].join(','),
      daily: 'sunrise,sunset,precipitation_probability_max',
      timezone: 'Europe/Paris',
      forecast_days: '1',
      wind_speed_unit: 'kmh',
    });

    const response = await fetch(`${OPEN_METEO_BASE}?${params}`);

    if (!response.ok) {
      console.warn('[Weather] Open-Meteo error:', response.status);
      return null;
    }

    const json = await response.json();
    const current = json.current || {};
    const daily = json.daily || {};

    // Le code ABSENT reste absent. Le convertir en 0 annoncerait « Ciel dégagé ».
    const code: number | null = current.weather_code ?? null;
    const info = code !== null ? getWeatherInfo(code) : null;

    const data: WeatherData = {
      latitude: lat,
      longitude: lon,

      // A-WEATHER-1 : absence → `null`, jamais un 0 (ni un 1013, ni un 10) fabriqué.
      temperatureC: current.temperature_2m ?? null,
      feelsLikeC: current.apparent_temperature ?? null,
      humidityPct:
        current.relative_humidity_2m != null ? Math.round(current.relative_humidity_2m) : null,
      pressureHpa: current.pressure_msl != null ? Math.round(current.pressure_msl) : null,
      visibilityKm: null, // Open-Meteo ne donne pas la visibilité en current → absence honnête

      windSpeedKmh: current.wind_speed_10m ?? null,
      windDirectionDeg: current.wind_direction_10m ?? null,
      windGustKmh: current.wind_gusts_10m ?? null,

      precipitationMm: current.precipitation ?? null,
      precipitationProbabilityPct: daily.precipitation_probability_max?.[0] ?? null,

      weatherCode: code,
      weatherLabel: info?.label ?? null,
      weatherIcon: info?.icon ?? null,

      isDay: current.is_day === 1,
      sunriseAt: daily.sunrise?.[0] ?? null,
      sunsetAt: daily.sunset?.[0] ?? null,

      capturedAt: new Date().toISOString(),
      source: 'open-meteo',
    };

    // Cache
    cache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  } catch (error) {
    console.error('[Weather] Erreur fetch:', error);
    return null;
  }
}

// ============================================================
// SAVE WEATHER SNAPSHOT
// ============================================================

export async function saveWeatherSnapshot(
  sessionId: string,
  weather: WeatherData,
  moment: 'before' | 'during' | 'after'
): Promise<boolean> {
  try {
    const { error } = await supabase.from('weather_snapshots').insert({
      session_id: sessionId,
      moment,
      captured_at: weather.capturedAt,
      latitude: weather.latitude,
      longitude: weather.longitude,
      temperature_c: weather.temperatureC,
      feels_like_c: weather.feelsLikeC,
      humidity_pct: weather.humidityPct,
      pressure_hpa: weather.pressureHpa,
      visibility_km: weather.visibilityKm,
      wind_speed_kmh: weather.windSpeedKmh,
      wind_direction_deg: weather.windDirectionDeg,
      wind_gust_kmh: weather.windGustKmh,
      precipitation_mm: weather.precipitationMm,
      precipitation_probability_pct: weather.precipitationProbabilityPct,
      weather_code: weather.weatherCode,
      weather_label: weather.weatherLabel,
    });

    if (error) {
      console.error('[Weather] Save error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[Weather] Exception save:', error);
    return false;
  }
}

// ============================================================
// FETCH WEATHER FOR SESSION (récap)
// ============================================================

export async function fetchSessionWeather(sessionId: string): Promise<WeatherData[]> {
  try {
    const { data, error } = await supabase
      .from('weather_snapshots')
      .select('*')
      .eq('session_id', sessionId)
      .order('captured_at', { ascending: true });

    if (error || !data) return [];

    // `nReq` : colonnes NON affichées comme faits (lat/lon, code catégoriel) —
    // un défaut neutre reste toléré. `n` : A-WEATHER-1 — une mesure affichée
    // comme fait est `null` si absente, JAMAIS 0 (le 0° fabriqué est proscrit).
    const nReq = (v: number | string | null | undefined): number => {
      if (v === null || v === undefined) return 0;
      if (typeof v === 'string') {
        const parsed = parseFloat(v);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return Number.isFinite(v) ? v : 0;
    };
    const n = (v: number | string | null | undefined): number | null => {
      if (v === null || v === undefined) return null;
      if (typeof v === 'string') {
        const parsed = parseFloat(v);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return Number.isFinite(v) ? v : null;
    };
    const s = (v: string | null | undefined): string => v ?? '';

    return data.map(
      (row): WeatherData => ({
        latitude: nReq(row.latitude),
        longitude: nReq(row.longitude),
        temperatureC: n(row.temperature_c),
        feelsLikeC: n(row.feels_like_c),
        humidityPct: n(row.humidity_pct),
        pressureHpa: n(row.pressure_hpa),
        visibilityKm: n(row.visibility_km),
        windSpeedKmh: n(row.wind_speed_kmh),
        windDirectionDeg: n(row.wind_direction_deg),
        windGustKmh: n(row.wind_gust_kmh),
        precipitationMm: n(row.precipitation_mm),
        precipitationProbabilityPct: n(row.precipitation_probability_pct),
        // Même règle à la RELECTURE qu'à la source : `nReq` rendait 0 sur une
        // colonne nulle, donc « Ciel dégagé », et `s` rendait une chaîne vide.
        // La fabrication passait par cette seconde porte.
        weatherCode: n(row.weather_code),
        weatherLabel: row.weather_label ?? null,
        weatherIcon:
          row.weather_code !== null && row.weather_code !== undefined
            ? getWeatherInfo(Number(row.weather_code)).icon
            : null,
        isDay: true,
        sunriseAt: null,
        sunsetAt: null,
        capturedAt: s(row.captured_at),
        source: 'open-meteo',
      })
    );
  } catch (error) {
    console.error('[Weather] Fetch session error:', error);
    return [];
  }
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Cardinal du vent
 */
export function windDirectionCardinal(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;

  if (normalized < 22.5 || normalized >= 337.5) return 'N';
  if (normalized < 67.5) return 'NE';
  if (normalized < 112.5) return 'E';
  if (normalized < 157.5) return 'SE';
  if (normalized < 202.5) return 'S';
  if (normalized < 247.5) return 'SO';
  if (normalized < 292.5) return 'O';
  return 'NO';
}

/**
 * Conditions pour roulage (sec/humide/pluvieux)
 */
export function trackConditions(weather: WeatherData): {
  label: string;
  isDry: boolean;
  isWet: boolean;
  warning: string | null;
} {
  // A-WEATHER-1 : une mesure ABSENTE (null) ne déclenche AUCUN verdict — on ne
  // fabrique pas une « piste mouillée » à partir d'une donnée inconnue ; on
  // retombe sur l'état neutre par défaut.
  if (weather.precipitationMm != null && weather.precipitationMm > 1) {
    return {
      label: 'Piste mouillée',
      isDry: false,
      isWet: true,
      warning: 'Conditions humides — adhérence réduite',
    };
  }
  if (weather.precipitationProbabilityPct != null && weather.precipitationProbabilityPct > 60) {
    return {
      label: 'Pluie probable',
      isDry: true,
      isWet: false,
      warning: 'Pluie probable dans les prochaines heures',
    };
  }
  if (weather.humidityPct != null && weather.humidityPct > 90) {
    return {
      label: 'Piste humide',
      isDry: false,
      isWet: false,
      warning: 'Forte humidité',
    };
  }
  if (weather.windSpeedKmh != null && weather.windSpeedKmh > 30) {
    return {
      label: 'Conditions ventées',
      isDry: true,
      isWet: false,
      warning: 'Vent fort — attention en virage',
    };
  }
  return {
    label: 'Conditions sèches',
    isDry: true,
    isWet: false,
    warning: null,
  };
}
