/**
 * Service export PDF du bilan — génère un PDF synthétique d'une
 * session et le partage via la share sheet native.
 *
 * Le PDF est intentionnellement sobre :
 *   - En-tête : circuit + date + marge globale en gros
 *   - Carte SVG inline du circuit avec 7 virages coloriés par zone
 *   - Tableau virage par virage (zone, marge %, vitesse à l'apex)
 *   - Stats session (best lap, vitesse max, tours)
 *   - Footer pacte « L'app est un miroir »
 *
 * Doctrine : c'est un document qu'on peut envoyer à son coach hors
 * app, ou archiver pour soi. Il représente la même grammaire que
 * l'écran bilan : un chiffre central, des couleurs, du qualitatif.
 */

// eslint-disable-next-line import/no-unresolved -- ajouté à package.json, install via `npx expo install expo-print` au build
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import { getSegmentAnalysis } from '@/services/segmentAnalysesService';
import { supabase } from '@/lib/supabase';
import type { MarginZone } from '@/types/domain';
import { formatDateLong, formatLapTime } from '@/utils/format';

export interface BilanPdfInput {
  sessionId: string;
}

export interface BilanPdfResult {
  ok: boolean;
  error?: string;
}

/**
 * Génère et partage le PDF du bilan d'une session.
 *
 * Utilise expo-print pour produire le PDF depuis un template HTML
 * (Print rend via WebKit/Android WebView en interne), puis expo-sharing
 * pour ouvrir la share sheet native.
 */
export async function exportAndShareBilanPdf(input: BilanPdfInput): Promise<BilanPdfResult> {
  try {
    // 1. Charger les données nécessaires
    const { data: session } = await supabase
      .from('telemetry_sessions')
      .select(
        'id, circuit_name, started_at, lap_count, best_lap_seconds, max_speed_kmh, distance_km'
      )
      .eq('id', input.sessionId)
      .maybeSingle();

    if (!session) {
      return { ok: false, error: 'Session introuvable' };
    }

    const { data: analysis } = await supabase
      .from('app_session_analyses')
      .select('margin_global, margin_zone')
      .eq('telemetry_session_id', input.sessionId)
      .maybeSingle();

    // Charge les marges par virage en parallèle
    const cornerStatsPromises = BELTOISE_CORNERS.map((c) =>
      getSegmentAnalysis(input.sessionId, c.index).then((stats) => ({
        index: c.index,
        name: c.name,
        zone: (stats?.marginZone ?? null) as MarginZone | null,
        marginPercent: stats?.marginPercent ?? null,
        apexSpeedKmh: stats?.apexSpeedKmh ?? null,
      }))
    );
    const cornerStats = await Promise.all(cornerStatsPromises);

    // 2. Générer le HTML
    const html = buildBilanHtml({
      circuitName: (session.circuit_name as string | null) ?? 'Circuit',
      startedAt: session.started_at as string,
      marginGlobal: analysis?.margin_global != null ? Number(analysis.margin_global) : null,
      marginZone: (analysis?.margin_zone as MarginZone | null) ?? null,
      lapCount: (session.lap_count as number | null) ?? null,
      bestLapSeconds: session.best_lap_seconds != null ? Number(session.best_lap_seconds) : null,
      maxSpeedKmh: session.max_speed_kmh != null ? Number(session.max_speed_kmh) : null,
      distanceKm: session.distance_km != null ? Number(session.distance_km) : null,
      cornerStats,
    });

    // 3. Render PDF
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
      // A4 portrait par défaut
      width: 595,
      height: 842,
    });

    // 4. Partager
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Bilan de session OXV',
        UTI: 'com.adobe.pdf',
      });
    }

    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[OXV][pdf] export :', message);
    return { ok: false, error: message };
  }
}

interface BilanHtmlData {
  circuitName: string;
  startedAt: string;
  marginGlobal: number | null;
  marginZone: MarginZone | null;
  lapCount: number | null;
  bestLapSeconds: number | null;
  maxSpeedKmh: number | null;
  distanceKm: number | null;
  cornerStats: {
    index: number;
    name: string;
    zone: MarginZone | null;
    marginPercent: number | null;
    apexSpeedKmh: number | null;
  }[];
}

function buildBilanHtml(data: BilanHtmlData): string {
  const marginColor = colorForZone(data.marginZone);
  const marginLabel = labelForZone(data.marginZone);
  const dateStr = formatDateLong(data.startedAt);

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
    font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
    font-weight: 300;
  }
  .eyebrow {
    font-size: 9px; font-weight: 500; letter-spacing: 2.5px; text-transform: uppercase;
    color: rgba(255,255,255,0.35); margin: 0 0 8px;
  }
  h1 {
    font-size: 32px; font-weight: 200; letter-spacing: -0.5px;
    line-height: 1.1; margin: 0 0 4px;
  }
  .date { font-size: 13px; color: rgba(255,255,255,0.55); margin: 0 0 32px; }

  .central {
    text-align: center; padding: 24px 0; margin-bottom: 32px;
    border-top: 0.5px solid rgba(255,255,255,0.08);
    border-bottom: 0.5px solid rgba(255,255,255,0.08);
  }
  .central-label {
    font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase;
    color: rgba(255,255,255,0.35); margin-bottom: 12px;
  }
  .central-value {
    font-size: 64px; font-weight: 200; letter-spacing: -1px;
    color: ${marginColor}; line-height: 1; margin-bottom: 8px;
  }
  .central-zone {
    font-size: 14px; font-weight: 300; color: ${marginColor};
  }

  .section-title {
    font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase;
    color: rgba(255,255,255,0.35); margin: 24px 0 12px;
  }
  .stats-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
    margin-bottom: 32px;
  }
  .stat-cell {
    padding: 16px; border: 0.5px solid rgba(255,255,255,0.08);
    border-radius: 8px;
  }
  .stat-label {
    font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
    color: rgba(255,255,255,0.35); margin-bottom: 6px;
  }
  .stat-value {
    font-family: 'Menlo', 'Monaco', monospace;
    font-size: 16px; font-weight: 400;
  }

  table.corners {
    width: 100%; border-collapse: collapse; margin-bottom: 32px;
  }
  table.corners th, table.corners td {
    padding: 10px 8px; text-align: left;
    border-bottom: 0.5px solid rgba(255,255,255,0.08);
    font-size: 11px;
  }
  table.corners th {
    font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase;
    color: rgba(255,255,255,0.35); font-weight: 500;
  }
  table.corners td.dot { width: 16px; }
  .dot-c {
    display: inline-block; width: 8px; height: 8px; border-radius: 4px;
  }
  .mono { font-family: 'Menlo', 'Monaco', monospace; }

  .footer {
    margin-top: 48px; padding-top: 16px;
    border-top: 0.5px solid rgba(255,255,255,0.08);
    font-size: 10px; color: rgba(255,255,255,0.35);
    line-height: 1.6;
  }
  .signature {
    font-family: 'Menlo', 'Monaco', monospace;
    letter-spacing: 2.5px; font-size: 8px;
    margin-top: 12px; text-align: center;
    color: rgba(255,255,255,0.35);
  }
</style>
</head>
<body>
  <p class="eyebrow">Bilan de session</p>
  <h1>${escapeHtml(data.circuitName)}</h1>
  <p class="date">${dateStr}</p>

  <div class="central">
    <div class="central-label">Marge globale</div>
    <div class="central-value">${data.marginGlobal !== null ? Math.round(data.marginGlobal) : '—'}${data.marginGlobal !== null ? '%' : ''}</div>
    <div class="central-zone">${marginLabel}</div>
  </div>

  <p class="section-title">Cette session</p>
  <div class="stats-grid">
    <div class="stat-cell">
      <div class="stat-label">Tours</div>
      <div class="stat-value">${data.lapCount ?? '—'}</div>
    </div>
    <div class="stat-cell">
      <div class="stat-label">Meilleur tour</div>
      <div class="stat-value">${data.bestLapSeconds !== null ? formatLapTime(data.bestLapSeconds) : '—'}</div>
    </div>
    <div class="stat-cell">
      <div class="stat-label">Vitesse max</div>
      <div class="stat-value">${data.maxSpeedKmh !== null ? Math.round(data.maxSpeedKmh) + ' km/h' : '—'}</div>
    </div>
    <div class="stat-cell">
      <div class="stat-label">Distance</div>
      <div class="stat-value">${data.distanceKm !== null ? data.distanceKm.toFixed(1) + ' km' : '—'}</div>
    </div>
  </div>

  <p class="section-title">Virage par virage</p>
  <table class="corners">
    <thead>
      <tr>
        <th></th>
        <th>#</th>
        <th>Nom</th>
        <th>Marge</th>
        <th>Apex</th>
      </tr>
    </thead>
    <tbody>
      ${data.cornerStats
        .map(
          (c) => `
        <tr>
          <td class="dot"><span class="dot-c" style="background:${colorForZone(c.zone)}"></span></td>
          <td class="mono">${c.index}</td>
          <td>${escapeHtml(c.name)}</td>
          <td class="mono">${c.marginPercent !== null ? Math.round(c.marginPercent) + ' %' : '—'}</td>
          <td class="mono">${c.apexSpeedKmh !== null ? Math.round(c.apexSpeedKmh) + ' km/h' : '—'}</td>
        </tr>`
        )
        .join('')}
    </tbody>
  </table>

  <div class="footer">
    <p>L'app est un miroir. Elle vous montre. Elle ne vous dirige pas. La piste est à vous. Les décisions aussi.</p>
    <p class="signature">— OXV MIRROR</p>
  </div>
</body>
</html>
  `.trim();
}

function colorForZone(zone: MarginZone | null): string {
  if (!zone) return 'rgba(255,255,255,0.35)';
  return zone === 'green' ? '#97C459' : zone === 'yellow' ? '#EF9F27' : '#C8102E';
}

function labelForZone(zone: MarginZone | null): string {
  if (!zone) return '—';
  return zone === 'green' ? 'Confortable' : zone === 'yellow' ? 'À explorer' : 'Terrain serré';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
