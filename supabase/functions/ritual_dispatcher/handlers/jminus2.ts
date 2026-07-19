// =============================================================================
// handlers/jminus2.ts — Logique du rituel J-2 (audio briefing)
// =============================================================================
// C'est le handler le plus complexe : 5 étapes en série.
// 1) Charger le contexte de personnalisation (B ou C)
// 2) Générer le script via GPT-4o
// 3) Synthétiser l'audio via Eleven Labs
// 4) Uploader le MP3 dans Supabase Storage
// 5) Envoyer l'email avec l'URL signée
// =============================================================================

import { DispatchContext, uploadAudioFile, getSupabaseClient } from '../lib/supabase.ts';
import { generateAudioScript } from '../lib/openai.ts';
import { RitualUserPromptInputs } from '../lib/prompt.ts';
import { generateAudioFile, estimateAudioDurationSec } from '../lib/elevenlabs.ts';
import { sendEmail, renderTemplate } from '../lib/resend.ts';
import { TEMPLATE_JMINUS2, formatSessionDate, formatAudioDuration, scriptToHtml } from '../lib/templates.ts';

export interface JMinus2Result {
  resend_message_id: string;
  audio_storage_path: string;
  audio_duration_sec: number;
  openai_tokens_used: number;
  elevenlabs_chars: number;
  payload: Record<string, unknown>;
}

export async function handleJMinus2(ctx: DispatchContext): Promise<JMinus2Result> {
  const dates = formatSessionDate(ctx.session.session_date);

  // -------- 1. Préparer les inputs du prompt --------
  // Niveau de personnalisation : par défaut B en an 1.
  // Quand l'app B5 alimentera qdi_scores, on basculera vers C automatiquement
  // si l'historique est suffisant (>= 1 session passée).
  const { sessionCount, history } = await loadPilotHistory(ctx.pilot.id);
  const personalizationLevel: 'B' | 'C' = history ? 'C' : 'B';

  const promptInputs: RitualUserPromptInputs = {
    pilot_first_name: ctx.pilot.first_name,
    pilot_session_number: sessionCount + 1, // sessionCount = passées ; +1 = celle à venir
    session_date_human: dates.full.toLowerCase().replace(/^./, c => c.toUpperCase()),
    session_format: ctx.session.session_format,
    days_until_session: 2,
    vehicle_make: ctx.vehicle.make,
    vehicle_model: ctx.vehicle.model,
    vehicle_year: ctx.vehicle.year,
    personalization_level: personalizationLevel,
    history: history,
  };

  // -------- 2. Génération du script --------
  const script = await generateAudioScript(promptInputs);

  // -------- 3. Génération de l'audio --------
  const audio = await generateAudioFile(script.script);
  const audioDurationSec = estimateAudioDurationSec(audio.audioBuffer);

  // -------- 4. Upload + URL signée --------
  const { path: audioPath, signedUrl } = await uploadAudioFile(
    ctx.dispatch.id,
    ctx.pilot.id,
    audio.audioBuffer
  );

  // -------- 5. Envoi de l'email --------
  const variables = {
    pilot_first_name: ctx.pilot.first_name,
    session_day_name: dates.dayName,
    audio_duration_label: formatAudioDuration(audioDurationSec),
    audio_url: signedUrl,
    registration_ref: ctx.registration.ref,
    script_html: scriptToHtml(script.script),
  };

  const html = renderTemplate(TEMPLATE_JMINUS2, variables);

  const { resend_message_id } = await sendEmail({
    to: ctx.pilot.email,
    subject: 'Un message à écouter',
    html,
    tags: [
      { name: 'ritual_type', value: 'jminus2' },
      { name: 'registration_ref', value: ctx.registration.ref },
      { name: 'personalization_level', value: script.personalization_level_used },
    ],
  });

  return {
    resend_message_id,
    audio_storage_path: audioPath,
    audio_duration_sec: audioDurationSec,
    openai_tokens_used: script.tokens_used,
    elevenlabs_chars: audio.charsUsed,
    payload: {
      variables,
      script_text: script.script,
      script_word_count: script.word_count,
      script_estimated_duration_sec: script.estimated_duration_sec,
      personalization_level_used: script.personalization_level_used,
      downgraded_from_c: script.downgraded_from_c,
      notes: script.notes,
    },
  };
}

// -----------------------------------------------------------------------------
// Helper : charge l'historique du pilote pour décider niveau B vs C
// -----------------------------------------------------------------------------
// En an 1, qdi_scores est vide → retourne { sessionCount: 0, history: null }
// Quand l'app B5 alimentera la table, on bascule en C.

interface PilotHistory {
  sessionCount: number;
  history: RitualUserPromptInputs['history'];
}

async function loadPilotHistory(userId: string): Promise<PilotHistory> {
  const supabase = getSupabaseClient();

  // Compte les sessions passées du pilote (registrations dont session_date < today)
  const today = new Date().toISOString().split('T')[0];

  const { data: pastRegs } = await supabase
    .from('registrations')
    .select('id, session:sessions!inner(session_date)')
    .eq('user_id', userId)
    .lt('session.session_date', today);

  const sessionCount = pastRegs?.length ?? 0;

  // Si aucune session passée → niveau B forcé
  if (sessionCount === 0) {
    return { sessionCount: 0, history: null };
  }

  // Sinon : on tente de charger les qdi_scores (table à venir avec l'app B5)
  // Si la table n'existe pas ou est vide → fallback niveau B
  try {
    const { data: scores, error } = await supabase
      .from('qdi_scores')
      .select('session_date, qdi_score, weak_sector_label, weak_sector_delta_sec, weak_sector_pattern')
      .eq('user_id', userId)
      .order('session_date', { ascending: false })
      .limit(10);

    if (error || !scores || scores.length === 0) {
      // Pas de data exploitable → niveau B
      return { sessionCount, history: null };
    }

    const lastScore = scores[0];
    const bestScore = Math.max(...scores.map(s => s.qdi_score));
    const lastDate = new Date(lastScore.session_date);
    const weeksSince = Math.floor((Date.now() - lastDate.getTime()) / (7 * 24 * 3600 * 1000));

    return {
      sessionCount,
      history: {
        last_session_date_human: formatSessionDate(lastScore.session_date).full.toLowerCase(),
        last_qdi_score: lastScore.qdi_score,
        best_qdi_score: bestScore,
        weak_sector_label: lastScore.weak_sector_label,
        weak_sector_delta_sec: lastScore.weak_sector_delta_sec,
        weak_sector_pattern: lastScore.weak_sector_pattern,
        sessions_count: sessionCount,
        weeks_since_last_session: weeksSince,
      },
    };
  } catch {
    // Table qdi_scores probablement inexistante (an 1) → niveau B
    return { sessionCount, history: null };
  }
}
