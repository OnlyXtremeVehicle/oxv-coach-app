// =============================================================================
// lib/elevenlabs.ts — Appel Eleven Labs pour générer le MP3
// =============================================================================

export interface GeneratedAudio {
  audioBuffer: ArrayBuffer;
  charsUsed: number;
}

export async function generateAudioFile(scriptText: string): Promise<GeneratedAudio> {
  const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
  const voiceId = Deno.env.get('ELEVENLABS_VOICE_ID');

  if (!apiKey) throw new Error('ELEVENLABS_API_KEY manquant');
  if (!voiceId) throw new Error('ELEVENLABS_VOICE_ID manquant');

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: scriptText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          // Réglages calibrés pour OXV : voix posée et premium MAIS avec
          // variation tonale et expression. stability basse = plus de prosodie
          // naturelle ; style élevé = lecture moins plate, plus engageante.
          stability: 0.42,
          similarity_boost: 0.78,
          style: 0.40,
          use_speaker_boost: true,
        },
        output_format: 'mp3_44100_192',
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Eleven Labs API ${response.status}: ${errText.slice(0, 300)}`);
  }

  const audioBuffer = await response.arrayBuffer();
  if (audioBuffer.byteLength < 1000) {
    throw new Error(`Audio généré suspicieusement petit: ${audioBuffer.byteLength} bytes`);
  }

  return {
    audioBuffer,
    charsUsed: scriptText.length,
  };
}

/**
 * Estime la durée du MP3 en secondes à partir de sa taille.
 * MP3 192 kbps = 24 Ko/s. Approximation : byteLength / 24000.
 * Pas parfait mais évite d'embarquer un parser MP3 dans la function.
 */
export function estimateAudioDurationSec(audioBuffer: ArrayBuffer): number {
  return Math.round(audioBuffer.byteLength / 24000);
}
