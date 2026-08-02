/**
 * Rapport coach — génération PDF (P-rapport). Réintégration coach__rapport.
 *
 * Le coach produit un document de synthèse d'une séance : QDI 5 branches, faits
 * clés, et SON bilan écrit. Rendu via expo-print (même patron que
 * bilanPdfExportService), partagé via la share sheet native (= « envoi pilote »).
 *
 * Doctrine : des faits + la voix ATTRIBUÉE du coach. QDI en 5 branches, jamais
 * un composite (T6). Aucun chiffre inventé — une branche non calculée reste
 * « — ». Le bilan est écrit par le coach (humain) ; l'app ne prescrit pas.
 */

// eslint-disable-next-line import/no-unresolved -- expo-print installé au build (cf. bilanPdfExportService)
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { getStudioSession } from '@/services/coachStudioService';
import type { QdiBranches } from '@/services/qdiLogic';
import { formatDateLong, formatLapTime } from '@/utils/format';

export interface CoachReportInput {
  sessionId: string;
  /** Bilan écrit par le coach (attribué). Peut être vide. */
  coachBilan: string;
  /** Date de séance (ISO) pour l'en-tête ; résolue si absente. */
  startedAt?: string | null;
  /**
   * Marqueurs RETENUS par le coach, déjà résolus en phrases de faits.
   *
   * *« Il a vu, la machine dit où et quoi, personne n'interprète. »* Ce sont des
   * mesures, pas des consignes : le document les pose, il n'en tire aucune
   * conclusion. Vide ou absent → la section n'existe pas.
   */
  marqueurs?: string[];
}

export interface CoachReportResult {
  ok: boolean;
  error?: string;
}

const BRANCH_LABEL: Record<keyof QdiBranches, string> = {
  trajectoire: 'Trajectoire',
  fluidite: 'Fluidité',
  freinage: 'Freinage',
  acceleration: 'Accélération',
  regularite: 'Régularité',
};

/** Génère et partage le rapport PDF d'une séance, avec le bilan du coach. */
export async function exportAndShareCoachReport(
  input: CoachReportInput
): Promise<CoachReportResult> {
  try {
    const studio = await getStudioSession(input.sessionId);
    if (!studio) return { ok: false, error: 'Séance introuvable' };

    const html = buildReportHtml({
      circuitName: studio.circuitName ?? 'Séance',
      startedAt: input.startedAt ?? null,
      bestLapSeconds: studio.bestLapSeconds,
      lapCount: studio.lapCount,
      marginGlobal: studio.margins.global,
      branches: studio.qdi
        ? {
            trajectoire: studio.qdi.trajectoire,
            fluidite: studio.qdi.fluidite,
            freinage: studio.qdi.freinage,
            acceleration: studio.qdi.acceleration,
            regularite: studio.qdi.regularite,
          }
        : null,
      coachBilan: input.coachBilan.trim(),
      // Les marqueurs RETENUS. Vides ou absents → la section n'existe pas :
      // un document ne porte pas de titre sur du néant.
      marqueurs: (input.marqueurs ?? []).map((m) => m.trim()).filter((m) => m.length > 0),
    });

    const { uri } = await Print.printToFileAsync({ html, base64: false, width: 595, height: 842 });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Rapport de séance OXV',
        UTI: 'com.adobe.pdf',
      });
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[OXV][pdf] rapport coach :', message);
    return { ok: false, error: message };
  }
}

interface ReportHtmlData {
  circuitName: string;
  startedAt: string | null;
  bestLapSeconds: number | null;
  lapCount: number;
  marginGlobal: number | null;
  branches: QdiBranches | null;
  coachBilan: string;
  marqueurs: string[];
}

function buildReportHtml(d: ReportHtmlData): string {
  const dateStr = d.startedAt ? formatDateLong(d.startedAt) : '';
  const branchRows = (Object.keys(BRANCH_LABEL) as (keyof QdiBranches)[])
    .map((k) => {
      const v = d.branches ? d.branches[k] : null;
      const pct = v == null ? 0 : Math.max(0, Math.min(100, Math.round(v)));
      const val = v == null ? '—' : String(Math.round(v));
      return `
      <div class="branch">
        <div class="branch-head">
          <span class="branch-name">${BRANCH_LABEL[k]}</span>
          <span class="branch-val mono">${val}</span>
        </div>
        <div class="branch-track"><div class="branch-fill" style="width:${pct}%"></div></div>
      </div>`;
    })
    .join('');

  return `
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 0; size: A4 portrait; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0; padding: 40px 48px;
    background: #050505; color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif; font-weight: 300;
  }
  .eyebrow { font-size: 9px; font-weight: 500; letter-spacing: 2.5px; text-transform: uppercase; color: rgba(255,255,255,0.35); margin: 0 0 8px; }
  h1 { font-size: 32px; font-weight: 200; letter-spacing: -0.5px; line-height: 1.1; margin: 0 0 4px; }
  .date { font-size: 13px; color: rgba(255,255,255,0.55); margin: 0 0 32px; }
  .section-title { font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase; color: rgba(255,255,255,0.35); margin: 24px 0 12px; }
  .mono { font-family: 'Menlo','Monaco',monospace; }
  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat-cell { padding: 16px; border: 0.5px solid rgba(255,255,255,0.08); border-radius: 8px; }
  .stat-label { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 6px; }
  .stat-value { font-family: 'Menlo','Monaco',monospace; font-size: 16px; font-weight: 400; }
  .branch { margin-bottom: 12px; }
  .branch-head { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
  .branch-name { color: rgba(255,255,255,0.8); }
  .branch-val { color: #FFB703; }
  .branch-track { height: 5px; border-radius: 3px; background: rgba(255,255,255,0.08); overflow: hidden; }
  .branch-fill { height: 5px; border-radius: 3px; background: #FFB703; }
  /* LES MOMENTS RETENUS. Un <ul> nu héritait du navigateur : 16 px, blanc plein,
     puces rondes, marges par défaut — le seul bloc du document à parler une
     autre langue que le reste. Relevé par la revue adversariale du 02/08/2026. */
  .moments { list-style: none; margin: 0; padding: 0; }
  .moments li {
    font-size: 12px; line-height: 1.6; font-weight: 300;
    color: rgba(255,255,255,0.82);
    padding: 8px 0 8px 14px; border-left: 1px solid rgba(255,255,255,0.14);
    margin-bottom: 6px;
  }
  .moments li:last-child { margin-bottom: 0; }
  .coach-band { margin-top: 24px; padding: 16px 18px; border-left: 2px solid #C8102E; background: rgba(200,16,46,0.06); border-radius: 4px; }
  .coach-band .label { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #C8102E; margin-bottom: 8px; }
  .coach-band p { font-size: 13px; line-height: 1.6; color: rgba(255,255,255,0.9); margin: 0; white-space: pre-wrap; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 0.5px solid rgba(255,255,255,0.08); font-size: 10px; color: rgba(255,255,255,0.35); line-height: 1.6; }
  .signature { font-family: 'Menlo','Monaco',monospace; letter-spacing: 2.5px; font-size: 8px; margin-top: 12px; text-align: center; color: rgba(255,255,255,0.35); }
</style>
</head>
<body>
  <p class="eyebrow">Rapport de séance · coach</p>
  <h1>${escapeHtml(d.circuitName)}</h1>
  ${dateStr ? `<p class="date">${dateStr}</p>` : '<div style="height:24px"></div>'}

  <p class="section-title">Faits clés</p>
  <div class="stats-grid">
    <div class="stat-cell"><div class="stat-label">Tours</div><div class="stat-value">${d.lapCount || '—'}</div></div>
    <div class="stat-cell"><div class="stat-label">Meilleur tour</div><div class="stat-value">${d.bestLapSeconds != null ? formatLapTime(d.bestLapSeconds) : '—'}</div></div>
    <div class="stat-cell"><div class="stat-label">Marge globale</div><div class="stat-value">${d.marginGlobal != null ? Math.round(d.marginGlobal) + ' %' : '—'}</div></div>
  </div>

  <p class="section-title">QDI · 5 branches</p>
  ${branchRows}

  ${
    Array.isArray(d.marqueurs) && d.marqueurs.length > 0
      ? `<p class="section-title">Les moments retenus</p><ul class="moments">${d.marqueurs
          .map((m) => `<li>${escapeHtml(m)}</li>`)
          .join('')}</ul>`
      : ''
  }

  ${
    d.coachBilan
      ? `<div class="coach-band"><div class="label">Le bilan de votre coach</div><p>${escapeHtml(d.coachBilan)}</p></div>`
      : ''
  }

  <div class="footer">
    <p>L'app est un miroir. Elle vous montre. Elle ne vous dirige pas. La piste est à vous. Les décisions aussi.</p>
    <p class="signature">— OXV MIRROR</p>
  </div>
</body>
</html>
  `.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
