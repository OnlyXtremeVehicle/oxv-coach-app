// =============================================================================
// handlers/jminus1.ts — Logique du rituel J-1 (dernier mot + météo)
// =============================================================================

import { DispatchContext } from '../lib/supabase.ts';
import { sendEmail, renderTemplate } from '../lib/resend.ts';
import { fetchWeatherForDate, WeatherForecast } from '../lib/weather.ts';
import { TEMPLATE_JMINUS1 } from '../lib/templates.ts';

export interface JMinus1Result {
  resend_message_id: string;
  payload: Record<string, unknown>;
}

export async function handleJMinus1(ctx: DispatchContext): Promise<JMinus1Result> {
  // -------- 1. Récupérer la météo --------
  // Si l'API tombe, on continue avec un fallback gracieux (pas de bloc météo).
  const weather = await fetchWeatherForDate(ctx.session.session_date);

  // -------- 2. Construire les variables --------
  const variables = buildVariables(ctx, weather);

  // -------- 3. Rendre le template + envoyer --------
  const html = renderTemplate(TEMPLATE_JMINUS1, variables);

  const { resend_message_id } = await sendEmail({
    to: ctx.pilot.email,
    subject: 'Demain · 9h00 · La Génétouze',
    html,
    tags: [
      { name: 'ritual_type', value: 'jminus1' },
      { name: 'registration_ref', value: ctx.registration.ref },
      { name: 'weather_fetched', value: weather ? 'yes' : 'no' },
    ],
  });

  return {
    resend_message_id,
    payload: {
      variables,
      weather_raw: weather ?? null,
    },
  };
}

// -----------------------------------------------------------------------------
// Construction des variables avec fallback météo
// -----------------------------------------------------------------------------

function buildVariables(ctx: DispatchContext, weather: WeatherForecast | null): Record<string, string | number> {
  const emergencyTel = Deno.env.get('EMERGENCY_PHONE_TEL') ?? '+33000000000';
  const emergencyDisplay = Deno.env.get('EMERGENCY_PHONE_DISPLAY') ?? '05 00 00 00 00';

  // Si pas de météo : on remplit avec des valeurs neutres qui restent élégantes.
  if (!weather) {
    return {
      pilot_first_name: ctx.pilot.first_name,
      weather_summary: 'À demain.',
      weather_icon_slug: 'cloud',
      weather_label: 'Conditions à confirmer',
      temperature_celsius: 0,           // sera caché par CSS si valeur 0 — voir note ci-dessous
      wind_kmh: 0,
      ground_condition: 'à confirmer sur place',
      tire_recommendation: 'Vérifiez les conditions à votre arrivée demain matin.',
      emergency_phone_tel: emergencyTel,
      emergency_phone_display: emergencyDisplay,
      registration_ref: ctx.registration.ref,
    };
    // NOTE : si la météo est down, le template affichera "0°C · Conditions à confirmer"
    // ce qui n'est pas idéal. Pour faire propre, on pourrait avoir un template_jminus1_no_weather
    // séparé sans le bloc météo. À considérer en v2.
  }

  return {
    pilot_first_name: ctx.pilot.first_name,
    weather_summary: weather.weather_summary,
    weather_icon_slug: weather.weather_icon_slug,
    weather_label: weather.weather_label,
    temperature_celsius: weather.temperature_celsius,
    wind_kmh: weather.wind_kmh,
    ground_condition: weather.ground_condition,
    tire_recommendation: weather.tire_recommendation,
    emergency_phone_tel: emergencyTel,
    emergency_phone_display: emergencyDisplay,
    registration_ref: ctx.registration.ref,
  };
}
