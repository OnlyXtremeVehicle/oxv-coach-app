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
  // Un ciel inconnu se dit inconnu. Les deux champs tombent ensemble.
  //
  // `weatherIcon` A ÉTÉ SUPPRIMÉ le 12/08/2026 : c'était un EMOJI (☀️, 🌦️),
  // proscrit par le principe 4 de la doctrine — « pas d'emojis sauf si
  // explicitement demandé ». Aucun écran ne le lisait, et c'est bien le
  // problème : un champ prêt à l'emploi, nommé exactement comme le besoin,
  // qu'un futur écran aurait affiché sans savoir qu'il violait la charte.
  // Le repli était de surcroît un emoji « ciel voilé » posé sur un code
  // INCONNU — une condition affirmée par défaut.
  weatherCode: number | null;
  weatherLabel: string | null;

  // Sun
  //
  // `isDay` VAUT `null` QUAND ON NE SAIT PAS — depuis le 12/08/2026. À la
  // relecture d'un instantané en base, il était forcé à `true` : une séance de
  // fin de journée se relisait « de jour » sans que rien ne l'ait mesuré. Le
  // champ n'a aujourd'hui aucun consommateur ; le laisser mentir garantissait
  // qu'il mentirait au premier écran qui le lirait.
  isDay: boolean | null;
  sunriseAt: string | null;
  sunsetAt: string | null;

  // Métadonnées
  capturedAt: string;
  source: 'open-meteo';
}

// ============================================================
// CODES MÉTÉO WMO → labels FR
// ============================================================

const WMO_LABELS: Record<number, string> = {
  0: 'Ciel dégagé',
  1: 'Globalement clair',
  2: 'Partiellement nuageux',
  3: 'Couvert',
  45: 'Brouillard',
  48: 'Brouillard givrant',
  51: 'Bruine légère',
  53: 'Bruine modérée',
  55: 'Bruine dense',
  56: 'Bruine verglaçante légère',
  57: 'Bruine verglaçante dense',
  61: 'Pluie légère',
  63: 'Pluie modérée',
  65: 'Pluie forte',
  66: 'Pluie verglaçante légère',
  67: 'Pluie verglaçante forte',
  71: 'Neige légère',
  73: 'Neige modérée',
  75: 'Neige forte',
  77: 'Grains de neige',
  80: 'Averses légères',
  81: 'Averses modérées',
  82: 'Averses violentes',
  85: 'Averses de neige',
  86: 'Averses de neige fortes',
  95: 'Orage',
  96: 'Orage avec grêle',
  99: 'Orage violent avec grêle',
};

/**
 * Libellé d'un code WMO, ou `null` pour un code que la table ne connaît pas.
 *
 * `null`, PAS « Conditions inconnues ». Cette chaîne-là était affichable : un
 * écran l'aurait posée à côté d'une température réelle, et le pilote y aurait
 * lu une mesure. Un code non répertorié est une absence, et une absence rend
 * « — » à l'écran, comme toutes les autres.
 */
function weatherLabelOf(code: number): string | null {
  return WMO_LABELS[code] ?? null;
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
      // UNE SEULE JOURNÉE, CELLE DE L'APPEL. Ce chemin ne sait donc pas dater :
      // appliqué à un réimport, il estamperait le ciel du jour d'ingestion et
      // non celui du roulage.
      //
      // Ce qu'il faudrait est mesuré, le 02/09/2026, et ne demande aucun
      // nouveau destinataire sortant : `api.open-meteo.com/v1/forecast` — l'hôte
      // déjà déclaré dans `hotesDistants.guard` — accepte `start_date` et
      // `end_date` et rend le passé. La requête du 12/08 a bien renvoyé ses deux
      // journées. `archive-api.open-meteo.com` n'est donc pas nécessaire ici.
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
    const label = code !== null ? weatherLabelOf(code) : null;

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
      weatherLabel: label,

      // `is_day` absent → `null`. Le tester avec `=== 1` rendait `false` sur
      // une absence, c'est-à-dire « il fait nuit » — affirmé, jamais mesuré.
      isDay: current.is_day === undefined || current.is_day === null ? null : current.is_day === 1,
      // ATTENTION SI CES DEUX CHAMPS SONT UN JOUR ÉCRITS EN BASE.
      //
      // Avec `timezone: 'Europe/Paris'` ci-dessus, Open-Meteo rend une heure
      // MURALE LOCALE SANS DÉCALAGE. Mesuré le 02/09/2026 sur la position du
      // circuit de Bouteville, date du 12/08 :
      //
      //     "sunrise": ["2026-08-12T06:57"]     "utc_offset_seconds": 7200
      //
      // Posée telle quelle dans un `timestamptz`, Postgres la lit en UTC : deux
      // heures d'erreur l'été, silencieuses, sur une colonne qui se relirait
      // comme une mesure. La réponse porte `utc_offset_seconds` — c'est avec lui
      // qu'on recompose l'instant, pas avec une hypothèse de fuseau.
      //
      // Aucune colonne ne les reçoit aujourd'hui, et c'est délibéré : aucun
      // écran ne les lit (voir le champ `isDay` plus haut).
      sunriseAt: daily.sunrise?.[0] ?? null,
      sunsetAt: daily.sunset?.[0] ?? null,

      capturedAt: new Date().toISOString(),
      source: 'open-meteo',
    };

    /**
     * UNE RÉPONSE SANS AUCUNE MESURE N'EST PAS UNE MÉTÉO.
     *
     * `json.current || {}` accepte silencieusement une réponse 200 sans bloc
     * `current` — changement d'API, réponse tronquée, erreur applicative rendue
     * en 200. Chaque champ tombait alors à `null` par `?? null`, et l'objet
     * était rendu NON-NUL et mis en cache dix minutes.
     *
     * Pour l'appelant, c'est indiscernable d'une météo réussie : l'écran de
     * préparation teste `weather && conditions`, la ligne MÉTÉO PISTE
     * s'affiche, et se prononce sur une piste dont rien n'a été lu.
     *
     * Une absence totale de mesure rend donc `null` — le canal que tous les
     * appelants savent déjà traiter, et le seul honnête.
     */
    const aUneMesure =
      data.temperatureC != null ||
      data.windSpeedKmh != null ||
      data.humidityPct != null ||
      data.precipitationMm != null ||
      data.pressureHpa != null ||
      data.weatherCode != null;

    if (!aUneMesure) {
      console.warn('[Weather] réponse 200 sans aucune mesure exploitable — traitée comme absente');
      return null;
    }

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
        // `isDay` N'EST PAS STOCKÉ : on ne le sait donc pas à la relecture. Il
        // valait `true` en dur — une séance de fin de journée se relisait
        // « de jour » sans que rien ne l'ait mesuré.
        isDay: null,
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

export interface TrackConditions {
  label: string;
  isDry: boolean;
  isWet: boolean;
  warning: string | null;
  /**
   * Une mesure a-t-elle réellement été lue ? `false` → `label` DÉCRIT UNE
   * ABSENCE et n'est pas un verdict ; `isDry` et `isWet` valent tous deux
   * `false`, ce qui est la seule façon honnête de dire « on ne sait pas ».
   */
  mesure: boolean;
}

/**
 * Conditions pour roulage (sec / humide / pluvieux) — ou l'aveu qu'on ne sait pas.
 *
 * ===========================================================================
 * CETTE FONCTION AFFIRMAIT « CONDITIONS SÈCHES » SUR ZÉRO MESURE
 * ===========================================================================
 *
 * Les quatre verdicts étaient bien gardés par `!= null`. Mais le REPLI en était
 * un cinquième, non gardé : `{ label: 'Conditions sèches', isDry: true }`. Son
 * commentaire l'appelait « l'état neutre par défaut ». Il n'a rien de neutre —
 * il affirme l'adhérence de la piste.
 *
 * Conséquence à l'écran de préparation, ligne MÉTÉO PISTE : le pilote lit
 * « Conditions sèches » à côté d'un « — » en température. L'application avoue
 * ne pas connaître le degré et, dans la même ligne, se prononce sur l'état de
 * la piste qu'elle n'a pas mesuré.
 *
 * C'est le « 0 fabriqué » que la consigne fondateur interdit — sous forme de
 * phrase plutôt que de chiffre, donc plus difficile à repérer et plus facile à
 * croire. Et cela touche le principe 1 : sécurité avant performance.
 *
 * `isDry: true` était le plus dangereux des quatre champs : un appelant qui
 * conditionnerait quoi que ce soit dessus recevrait un feu vert inventé.
 */
export function trackConditions(weather: WeatherData): TrackConditions {
  // A-WEATHER-1 : une mesure ABSENTE (null) ne déclenche AUCUN verdict — on ne
  // fabrique pas une « piste mouillée » à partir d'une donnée inconnue.
  if (weather.precipitationMm != null && weather.precipitationMm > 1) {
    return {
      label: 'Piste mouillée',
      isDry: false,
      isWet: true,
      warning: 'Conditions humides — adhérence réduite',
      mesure: true,
    };
  }
  if (weather.precipitationProbabilityPct != null && weather.precipitationProbabilityPct > 60) {
    return {
      label: 'Pluie probable',
      isDry: true,
      isWet: false,
      warning: 'Pluie probable dans les prochaines heures',
      mesure: true,
    };
  }
  if (weather.humidityPct != null && weather.humidityPct > 90) {
    return {
      label: 'Piste humide',
      isDry: false,
      isWet: false,
      warning: 'Forte humidité',
      mesure: true,
    };
  }
  if (weather.windSpeedKmh != null && weather.windSpeedKmh > 30) {
    return {
      label: 'Conditions ventées',
      isDry: true,
      isWet: false,
      warning: 'Vent fort — attention en virage',
      mesure: true,
    };
  }
  /**
   * AUCUN SEUIL FRANCHI — reste à savoir si c'est parce que la piste est sèche,
   * ou parce qu'on n'a rien mesuré. Les deux menaient au même verdict.
   */
  const mesuré =
    weather.precipitationMm != null ||
    weather.precipitationProbabilityPct != null ||
    weather.humidityPct != null ||
    weather.windSpeedKmh != null;

  if (!mesuré) {
    return {
      label: 'Conditions non mesurées',
      // NI sec NI mouillé. Ne pas savoir n'est pas « sec » : un appelant qui
      // conditionnerait quoi que ce soit sur `isDry` recevrait un feu vert
      // inventé, sur un écran qui prépare une sortie en piste.
      isDry: false,
      isWet: false,
      warning: null,
      mesure: false,
    };
  }

  return {
    label: 'Conditions sèches',
    isDry: true,
    isWet: false,
    warning: null,
    mesure: true,
  };
}
