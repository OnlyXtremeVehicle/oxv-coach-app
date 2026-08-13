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

  /**
   * ===========================================================================
   * LE « 0 DEGRÉ FABRIQUÉ » VIVAIT ICI, ET SON COMMENTAIRE INVENTAIT SA GARDE
   * ===========================================================================
   *
   * Ce repli écrivait `temperature_celsius: 0` et `wind_kmh: 0` avec, en bout
   * de ligne, « sera caché par CSS si valeur 0 ». Aucune règle CSS du template
   * ne cible cette valeur — le bloc `<style>` ne contient que du `body`, du
   * `table`, du `img`, du `a` et une requête média sur trois classes de
   * largeur. Et le moteur de rendu (`renderTemplate`) ne saute que `undefined`
   * et `null` : un 0 est rendu tel quel.
   *
   * Trois lignes plus bas, le fichier l'admettait lui-même : « si la météo est
   * down, le template affichera 0°C · Conditions à confirmer ce qui n'est pas
   * idéal. À considérer en v2. » Le défaut était donc CONNU, DOCUMENTÉ, et
   * laissé en place derrière un commentaire qui affirmait le contraire.
   *
   * Ce que le pilote recevait la veille de sa journée de piste : « 0°C ·
   * Conditions à confirmer » et « Vent 0 km/h » — deux mesures inventées,
   * présentées dans le bloc « Météo prévue » exactement comme des mesures
   * réelles. C'est la consigne fondateur A-WEATHER-1 violée au mot près.
   *
   * ---
   *
   * LA CORRECTION NE PASSE PAS PAR UN CHIFFRE PLUS PRUDENT
   *
   * Le template composait la ligne lui-même (`{{temperature_celsius}}°C ·
   * {{weather_label}}`), et le moteur de substitution ne sait pas conditionner.
   * Toute valeur passée là-dedans DEVIENT une mesure affichée.
   *
   * La ligne entière est donc construite ici, où l'on sait s'il y a une mesure.
   * Sans météo, aucun nombre n'est écrit : la phrase dit l'absence.
   */
  if (!weather) {
    return {
      pilot_first_name: ctx.pilot.first_name,
      weather_summary: 'À demain.',
      weather_icon_slug: 'cloud',
      weather_label: 'Conditions à confirmer',
      weather_headline: 'Prévision indisponible',
      weather_detail: 'Les conditions seront précisées sur place demain matin.',
      ground_condition: 'à confirmer sur place',
      tire_recommendation: 'Vérifiez les conditions à votre arrivée demain matin.',
      emergency_phone_tel: emergencyTel,
      emergency_phone_display: emergencyDisplay,
      registration_ref: ctx.registration.ref,
    };
  }

  return {
    pilot_first_name: ctx.pilot.first_name,
    weather_summary: weather.weather_summary,
    weather_icon_slug: weather.weather_icon_slug,
    weather_label: weather.weather_label,
    weather_headline: `${weather.temperature_celsius}°C · ${weather.weather_label}`,
    weather_detail: `Vent ${weather.wind_kmh} km/h · ${weather.ground_condition}`,
    ground_condition: weather.ground_condition,
    tire_recommendation: weather.tire_recommendation,
    emergency_phone_tel: emergencyTel,
    emergency_phone_display: emergencyDisplay,
    registration_ref: ctx.registration.ref,
  };
}
