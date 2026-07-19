// =============================================================================
// handlers/jminus7.ts — Logique du rituel J-7 (confirmation + playlist)
// =============================================================================

import { DispatchContext } from '../lib/supabase.ts';
import { sendEmail, renderTemplate } from '../lib/resend.ts';
import { TEMPLATE_JMINUS7, formatSessionDate } from '../lib/templates.ts';

export interface JMinus7Result {
  resend_message_id: string;
  payload: Record<string, unknown>;
}

const PLAYLIST_URL_DEFAULT = 'https://open.spotify.com/playlist/REPLACE_ME';

export async function handleJMinus7(ctx: DispatchContext): Promise<JMinus7Result> {
  const dates = formatSessionDate(ctx.session.session_date);

  // URL de la playlist : configurable via env var pour pouvoir la changer
  // sans redéployer la function. Fallback en placeholder si pas définie.
  const playlistUrl = Deno.env.get('OXV_PLAYLIST_URL') ?? PLAYLIST_URL_DEFAULT;

  const variables = {
    pilot_first_name: ctx.pilot.first_name,
    session_date_short: dates.short,
    session_date_full: dates.full,
    vehicle_make: ctx.vehicle.make,
    vehicle_model: ctx.vehicle.model,
    session_format: ctx.session.session_format,
    playlist_spotify_url: playlistUrl,
    registration_ref: ctx.registration.ref,
  };

  const html = renderTemplate(TEMPLATE_JMINUS7, variables);
  const subject = `${dates.full.split(' ').slice(0, 3).join(' ')} · La Génétouze`;
  // ex: "Mardi 9 juin · La Génétouze"

  const { resend_message_id } = await sendEmail({
    to: ctx.pilot.email,
    subject,
    html,
    tags: [
      { name: 'ritual_type', value: 'jminus7' },
      { name: 'registration_ref', value: ctx.registration.ref },
    ],
  });

  return {
    resend_message_id,
    payload: {
      variables,
      rendered_subject: subject,
    },
  };
}
