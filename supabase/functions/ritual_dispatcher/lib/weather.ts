// =============================================================================
// lib/weather.ts — Récupération météo Open-Meteo pour La Génétouze
// =============================================================================
// Open-Meteo est gratuit, sans clé API requise.
// Coordonnées La Génétouze (17360) : 45.36° N, -0.18° E
// =============================================================================

const LAT_LA_GENETOUZE = 45.36;
const LON_LA_GENETOUZE = -0.18;

export interface WeatherForecast {
  temperature_celsius: number;      // ex: 19
  wind_kmh: number;                  // ex: 8
  weather_code: number;              // code WMO (0-99)
  weather_label: string;             // "Ciel dégagé", "Pluie légère", etc.
  weather_icon_slug: string;         // "sun", "cloud-sun", "cloud", "rain", "storm"
  ground_condition: string;          // "sol sec", "sol mouillé"
  tire_recommendation: string;       // phrase complète à injecter dans l'email
  weather_summary: string;           // "Ciel dégagé. 19 degrés." pour préheader
  fetched_at: string;                // ISO timestamp
}

/**
 * Récupère la météo prévue pour le jour de la session.
 * `forecastDate` au format ISO "2026-06-09".
 * Retourne null si l'API est down — l'appelant doit fallback gracieusement.
 */
export async function fetchWeatherForDate(forecastDate: string): Promise<WeatherForecast | null> {
  // Open-Meteo : on demande une plage horaire 8h-13h le jour J, on agrège
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(LAT_LA_GENETOUZE));
  url.searchParams.set('longitude', String(LON_LA_GENETOUZE));
  url.searchParams.set('start_date', forecastDate);
  url.searchParams.set('end_date', forecastDate);
  url.searchParams.set('hourly', 'temperature_2m,wind_speed_10m,weather_code,precipitation');
  url.searchParams.set('timezone', 'Europe/Paris');

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error(`Open-Meteo ${response.status}`);
      return null;
    }
    const data = await response.json();

    // On prend la tranche 9h-13h (heures index 9, 10, 11, 12)
    const hourly = data.hourly;
    if (!hourly?.temperature_2m || !hourly?.weather_code) {
      console.error('Open-Meteo: structure de réponse inattendue');
      return null;
    }

    // Moyennes 9h-12h pour température et vent
    const sliceStart = 9, sliceEnd = 13;
    const tempSlice = hourly.temperature_2m.slice(sliceStart, sliceEnd) as number[];
    const windSlice = hourly.wind_speed_10m.slice(sliceStart, sliceEnd) as number[];
    const codeSlice = hourly.weather_code.slice(sliceStart, sliceEnd) as number[];
    const precipSlice = hourly.precipitation.slice(sliceStart, sliceEnd) as number[];

    const avgTemp = Math.round(tempSlice.reduce((a, b) => a + b, 0) / tempSlice.length);
    const avgWind = Math.round(windSlice.reduce((a, b) => a + b, 0) / windSlice.length);
    // Pour le code météo, on prend le pire (max) — si une averse est prévue à 11h, on l'annonce
    const worstCode = Math.max(...codeSlice);
    const totalPrecip = precipSlice.reduce((a, b) => a + b, 0);

    const { label, icon } = mapWeatherCode(worstCode);
    const groundCondition = totalPrecip > 1 ? 'sol potentiellement humide' : 'sol sec';
    const tireRec = buildTireRecommendation(worstCode, totalPrecip);

    return {
      temperature_celsius: avgTemp,
      wind_kmh: avgWind,
      weather_code: worstCode,
      weather_label: label,
      weather_icon_slug: icon,
      ground_condition: groundCondition,
      tire_recommendation: tireRec,
      weather_summary: `${label}. ${avgTemp} degrés.`,
      fetched_at: new Date().toISOString(),
    };
  } catch (e) {
    console.error(`Erreur fetch Open-Meteo: ${(e as Error).message}`);
    return null;
  }
}

/**
 * Mapping des codes WMO Open-Meteo vers libellés FR et slugs d'icônes.
 * Référence : https://open-meteo.com/en/docs#weathervariables
 */
function mapWeatherCode(code: number): { label: string; icon: string } {
  if (code === 0) return { label: 'Ciel dégagé', icon: 'sun' };
  if (code === 1) return { label: 'Ciel peu nuageux', icon: 'cloud-sun' };
  if (code === 2) return { label: 'Partiellement nuageux', icon: 'cloud-sun' };
  if (code === 3) return { label: 'Couvert', icon: 'cloud' };
  if (code === 45 || code === 48) return { label: 'Brouillard', icon: 'cloud' };
  if (code >= 51 && code <= 57) return { label: 'Bruine', icon: 'rain' };
  if (code >= 61 && code <= 65) return { label: 'Pluie', icon: 'rain' };
  if (code >= 66 && code <= 67) return { label: 'Pluie verglaçante', icon: 'rain' };
  if (code >= 71 && code <= 77) return { label: 'Neige', icon: 'rain' };
  if (code >= 80 && code <= 82) return { label: 'Averses', icon: 'rain' };
  if (code >= 85 && code <= 86) return { label: 'Averses de neige', icon: 'rain' };
  if (code >= 95) return { label: 'Orages', icon: 'storm' };
  return { label: 'Variable', icon: 'cloud' };
}

function buildTireRecommendation(code: number, totalPrecip: number): string {
  if (code === 0 || code === 1) {
    return 'Le ciel sera dégagé. Pneus de route adaptés, pas besoin de pluie.';
  }
  if (code === 2 || code === 3) {
    return 'Ciel couvert sans pluie annoncée. Pneus de route adaptés.';
  }
  if (totalPrecip > 0 && totalPrecip < 2) {
    return 'Possibilité d\'averse en matinée. Surveillez la piste à votre arrivée.';
  }
  if (totalPrecip >= 2) {
    return 'Pluie annoncée. Pneus pluie recommandés si vous en disposez, sinon prudence sur les premiers tours.';
  }
  return 'Conditions météo à confirmer sur place à votre arrivée.';
}
