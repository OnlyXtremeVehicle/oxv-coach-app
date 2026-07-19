// =============================================================================
// lib/resend.ts — Envoi d'emails via Resend
// =============================================================================

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export interface SendEmailResult {
  resend_message_id: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('RESEND_API_KEY manquant');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'OXV <contact@oxvehicle.fr>',
      to: [params.to],
      subject: params.subject,
      html: params.html,
      reply_to: params.replyTo ?? 'contact@oxvehicle.fr',
      tags: params.tags ?? [],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Resend API ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  if (!data.id) throw new Error('Resend: ID de message manquant dans la réponse');

  return { resend_message_id: data.id };
}

// -----------------------------------------------------------------------------
// Helper de templating minimaliste : remplace {{var}} dans une chaîne
// -----------------------------------------------------------------------------
// On n'utilise pas Handlebars complet pour éviter une dépendance lourde.
// Suffit pour nos templates qui ne font que de la substitution simple.

export function renderTemplate(template: string, variables: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = variables[key];
    if (value === undefined || value === null) {
      console.warn(`Variable manquante dans template: ${key}`);
      return '';
    }
    return String(value);
  });
}
