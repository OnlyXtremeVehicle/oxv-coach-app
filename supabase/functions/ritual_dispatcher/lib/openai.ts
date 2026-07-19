// =============================================================================
// lib/openai.ts — Appel GPT-4o pour générer les scripts audio
// =============================================================================

import { SYSTEM_PROMPT, buildUserPrompt, RitualUserPromptInputs } from './prompt.ts';

export interface GeneratedScript {
  script: string;
  word_count: number;
  estimated_duration_sec: number;
  personalization_level_used: 'B' | 'C';
  downgraded_from_c: boolean;
  notes: string;
  tokens_used: number;
}

export async function generateAudioScript(inputs: RitualUserPromptInputs): Promise<GeneratedScript> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY manquant');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0.7,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(inputs) },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Réponse OpenAI vide ou mal formée');

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`JSON invalide retourné par OpenAI: ${(e as Error).message}`);
  }

  // Validation minimale du JSON retourné
  if (typeof parsed.script !== 'string' || parsed.script.length < 100) {
    throw new Error(`Script généré trop court ou manquant: ${JSON.stringify(parsed).slice(0, 200)}`);
  }

  return {
    script: parsed.script,
    word_count: (parsed.word_count as number) ?? parsed.script.split(/\s+/).length,
    estimated_duration_sec: (parsed.estimated_duration_sec as number) ?? Math.round(parsed.script.split(/\s+/).length / 2.8),
    personalization_level_used: (parsed.personalization_level_used as 'B' | 'C') ?? 'B',
    downgraded_from_c: (parsed.downgraded_from_c as boolean) ?? false,
    notes: (parsed.notes as string) ?? '',
    tokens_used: data.usage?.total_tokens ?? 0,
  };
}
