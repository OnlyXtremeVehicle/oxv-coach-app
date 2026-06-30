/**
 * Journal d'exports média (table `media_exports`, V9). Trace, en own-row, quand
 * le pilote sort un OXV Moment de l'app (image, lien, story, pdf). Best-effort :
 * jamais bloquant pour le partage. Aucun accès partenaire (RLS own-row + §148).
 */

import { supabase } from '@/lib/supabase';

export type MediaExportType = 'image' | 'link' | 'story' | 'pdf';

export async function logMediaExport(input: {
  exportType: MediaExportType;
  telemetrySessionId?: string | null;
  sessionMediaId?: string | null;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return;
  const { error } = await supabase.from('media_exports').insert({
    user_id: uid,
    export_type: input.exportType,
    telemetry_session_id: input.telemetrySessionId ?? null,
    session_media_id: input.sessionMediaId ?? null,
  } as never);
  if (error) console.warn('[OXV][media] logMediaExport :', error.message);
}
