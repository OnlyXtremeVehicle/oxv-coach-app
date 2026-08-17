/**
 * heritageBookExportService — génération du CARNET HERITAGE (V2-L5 CLUB,
 * Mission D, C3). Service NOUVEAU (autorisé par le lot) qui ÉTEND la grammaire
 * PDF de bilanPdfExportService : même chaîne expo-print → expo-sharing, même
 * matière (fond titane, chrono mono, filets fins), poussée au livret luxe.
 *
 * Le livret : couverture insigne or, une page « Signature » par séance Heritage
 * RÉELLE (chrono · tracé or · piliers · photo), une page évolution (soi contre
 * soi), un colophon. La STRUCTURE (quelles pages) est décidée par le plan pur
 * `planHeritageBook` (heritageBookLogic, testé) — ici on ne fait que RÉUNIR les
 * données réelles et peindre le HTML.
 *
 * Doctrine « données réelles » : réservé au tier Heritage (heritageOf), autant
 * de Signatures que de séances réelles (jamais une page fabriquée), chaque
 * élément absent rendu « — » ou masqué. Aucun classement, aucun « mieux que » :
 * l'évolution est le pilote face à lui-même.
 */

// eslint-disable-next-line import/no-unresolved -- résolu au build (npx expo install expo-print)
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { heritageOf, type RegistrationRef } from '@/features/miroir/miroirHomeLogic';
import {
  planHeritageBook,
  type HeritageBookPlan,
  type HeritageBookSessionInput,
  type HeritagePillar,
} from '@/features/club/heritageBookLogic';
import type { LatLon } from '@/circuit/circuitGenerator';
import { fetchSessionCircuitCenterline } from '@/services/circuitsService';
import { getQdiForSession } from '@/services/qdiService';
import { listSessionMedia, type SessionMediaItem } from '@/services/sessionMediaService';
import { supabase } from '@/lib/supabase';
import { dataColors } from '@/theme/v2';
import { formatDateLong, formatLapTimeMs } from '@/utils/format';

export { planHeritageBook } from '@/features/club/heritageBookLogic';
export type {
  HeritageBookPlan,
  HeritageBookPage,
  HeritageBookSessionInput,
} from '@/features/club/heritageBookLogic';

export type HeritageBookOutcome =
  | { ok: true; uri: string; plan: HeritageBookPlan }
  | {
      ok: false;
      reason: 'not_heritage' | 'no_sessions' | 'no_auth' | 'error';
      message?: string;
    };

/** Garde-fou : borne haute du nombre de séances gravées (une saison réaliste). */
const SEASON_SESSION_LIMIT = 24;

// Palette du livret (héritée des tokens V2 — figée en hex pour le HTML, pas
// d'import RN dans un service). L'or Heritage est EXCLUSIF au tier.
const GOLD = '#C4A459';
const GOLD_SOFT = '#E8DCB8';
const TITANE = '#101015';
const LINE = 'rgba(232,220,184,0.16)';
const INK = '#EDEBE4';
const INK_MUTE = 'rgba(237,235,228,0.55)';
const INK_DIM = 'rgba(237,235,228,0.32)';

/**
 * TROISIÈME COPIE DE LA PALETTE QDI, ÉLIMINÉE LE 17/08/2026.
 *
 * Ces cinq hex étaient figés à la main, avec le motif « pas d'import RN dans un
 * service ». Le motif ne tient pas : `src/theme/v2.ts` ne dépend de rien — ni
 * `react-native`, ni hook, ni contexte —, c'est écrit en tête du module et
 * vérifié par `themeSansRuntime.test.ts`. Rien n'empêchait de l'importer.
 *
 * Le livret Heritage peignait donc la Fluidité en `#FFB703`, l'or réservé au
 * chrono, et la Régularité en `#C084FC` quand l'app affichait `#A783F2`. Un
 * export PDF remis au pilote ne montrait pas les couleurs de son application.
 */
const PILLAR_COLORS: Record<string, string> = {
  trajectoire: dataColors.trajectory,
  freinage: dataColors.brake,
  acceleration: dataColors.accel,
  fluidite: dataColors.flow,
  regularite: dataColors.regularity,
};

interface SeasonSessionRow {
  id: string;
  started_at: string | null;
  circuit_name: string | null;
  best_lap_seconds: number | null;
  lap_count: number | null;
}

interface QdiBranchesLike {
  trajectoire: number | null;
  fluidite: number | null;
  freinage: number | null;
  acceleration: number | null;
  regularite: number | null;
}

/** Piliers canoniques du livret — mêmes 4 que le Bilan, dans le même ordre. */
const PILLAR_DEFS: { key: keyof QdiBranchesLike; label: string }[] = [
  { key: 'trajectoire', label: 'Trajectoire' },
  { key: 'freinage', label: 'Freinage' },
  { key: 'acceleration', label: 'Accélération' },
  { key: 'fluidite', label: 'Fluidité' },
];

function pillarsFromQdi(qdi: QdiBranchesLike | null): HeritagePillar[] {
  return PILLAR_DEFS.map(({ key, label }) => {
    const raw = qdi ? qdi[key] : null;
    const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
    return { key: key as string, label, value };
  });
}

function pickPhotoUrl(media: readonly SessionMediaItem[]): string | null {
  for (const m of media) {
    if (m.mediaType === 'photo' && typeof m.signedUrl === 'string' && m.signedUrl.length > 0) {
      return m.signedUrl;
    }
  }
  return null;
}

/**
 * Génère le Carnet Heritage de la saison en cours et ouvre la feuille de
 * partage native. `onProgress` (0..1) alimente le Dial de génération.
 *
 * Ne produit RIEN hors du tier Heritage (reason 'not_heritage') ni sans séance
 * réelle (reason 'no_sessions') — jamais un livret fabriqué.
 */
export async function generateAndShareHeritageBook(opts?: {
  onProgress?: (fraction: number) => void;
  now?: Date;
}): Promise<HeritageBookOutcome> {
  const onProgress = opts?.onProgress ?? (() => undefined);
  try {
    onProgress(0.02);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return { ok: false, reason: 'no_auth' };

    // 1. Gating tier — MÊME lecture que l'accueil Miroir (heritageOf).
    const { data: regs } = await supabase
      .from('registrations')
      .select('offer_type, status')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(10);
    const tier = heritageOf((regs ?? []) as RegistrationRef[]);
    if (!tier.isHeritage) return { ok: false, reason: 'not_heritage' };
    onProgress(0.08);

    // 2. Séances RÉELLES de la saison (année civile en cours), chronologiques.
    const now = opts?.now ?? new Date();
    const year = now.getFullYear();
    const yearStart = new Date(year, 0, 1).toISOString();
    const yearEnd = new Date(year + 1, 0, 1).toISOString();
    const { data: sessionRows } = await supabase
      .from('telemetry_sessions')
      .select('id, started_at, circuit_name, best_lap_seconds, lap_count')
      .eq('user_id', uid)
      .eq('status', 'completed')
      .gte('started_at', yearStart)
      .lt('started_at', yearEnd)
      .order('started_at', { ascending: true })
      .limit(SEASON_SESSION_LIMIT);
    const rows = (sessionRows ?? []) as SeasonSessionRow[];
    if (rows.length === 0) return { ok: false, reason: 'no_sessions' };
    onProgress(0.15);

    // 3. Données de chaque page Signature (best-effort, une source en panne ne
    //    prive pas la page des autres). Progression rapportée aux séances.
    const sessions: HeritageBookSessionInput[] = [];
    const traceById: Record<string, LatLon[] | null> = {};
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const [mediaR, qdiR, traceR] = await Promise.allSettled([
        listSessionMedia(r.id),
        getQdiForSession(r.id),
        fetchSessionCircuitCenterline(r.id),
      ]);
      const media = mediaR.status === 'fulfilled' ? mediaR.value : [];
      const qdi = qdiR.status === 'fulfilled' ? qdiR.value : null;
      const trace = traceR.status === 'fulfilled' ? traceR.value : null;
      traceById[r.id] = trace;

      const bestSeconds =
        r.best_lap_seconds !== null && Number.isFinite(Number(r.best_lap_seconds))
          ? Number(r.best_lap_seconds)
          : null;
      sessions.push({
        sessionId: r.id,
        startedAt: r.started_at,
        circuitName: r.circuit_name,
        bestLapMs: bestSeconds !== null && bestSeconds > 0 ? Math.round(bestSeconds * 1000) : null,
        lapCount: r.lap_count,
        pillars: pillarsFromQdi((qdi as unknown as QdiBranchesLike | null) ?? null),
        photoUrl: pickPhotoUrl(media),
        hasTrace: Array.isArray(trace) && trace.length > 3,
      });
      onProgress(0.15 + 0.55 * ((i + 1) / rows.length));
    }

    // 4. Plan pur (structure) — gating dur rejoué (tier + séances réelles).
    const plan = planHeritageBook({ isHeritage: true, year, sessions });
    if (plan === null) return { ok: false, reason: 'no_sessions' };
    onProgress(0.75);

    // 5. HTML luxe multi-pages.
    const html = buildHeritageBookHtml(plan, sessions, traceById);
    onProgress(0.82);

    // 6. Rendu PDF + partage natif.
    const { uri } = await Print.printToFileAsync({ html, base64: false, width: 595, height: 842 });
    onProgress(0.96);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Carnet Heritage ${year}`,
        UTI: 'com.adobe.pdf',
      });
    }
    onProgress(1);
    return { ok: true, uri, plan };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[OXV][heritageBook] export :', message);
    return { ok: false, reason: 'error', message };
  }
}

// ---------------------------------------------------------------------------
// HTML — matière luxe (fond titane, or Heritage, filets fins)
// ---------------------------------------------------------------------------

function buildHeritageBookHtml(
  plan: HeritageBookPlan,
  sessions: readonly HeritageBookSessionInput[],
  traceById: Readonly<Record<string, LatLon[] | null>>
): string {
  const byId = new Map<string, HeritageBookSessionInput>(
    sessions.map((s) => [s.sessionId, s] as const)
  );
  const total = plan.sessionCount;

  const pagesHtml = plan.pages
    .map((page) => {
      if (page.kind === 'cover') return coverPage(page.year, page.sessionCount);
      if (page.kind === 'signature') {
        const s = byId.get(page.sessionId);
        if (!s) return '';
        return signaturePage(s, page.index + 1, total, traceById[s.sessionId] ?? null);
      }
      if (page.kind === 'evolution') return evolutionPage(sessions);
      return colophonPage(plan.year);
    })
    .join('\n');

  return `
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 0; size: A4 portrait; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0; color: ${INK};
    font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
    font-weight: 300;
  }
  .page {
    position: relative; width: 100%; min-height: 100vh;
    padding: 54px 52px; background: ${TITANE};
    page-break-after: always; overflow: hidden;
  }
  .page:last-child { page-break-after: auto; }
  .eyebrow {
    font-family: 'Menlo','Monaco',monospace;
    font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: ${GOLD};
    margin: 0 0 10px;
  }
  .mono { font-family: 'Menlo','Monaco',monospace; }
  .rule { height: 1px; background: ${LINE}; border: 0; margin: 18px 0; }
  .gold-rule { height: 2px; width: 64px; background: ${GOLD}; border: 0; margin: 14px 0; }

  /* Couverture */
  .cover { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .cover .seal { margin-bottom: 34px; }
  .cover h1 {
    font-size: 40px; font-weight: 200; letter-spacing: 1px; margin: 6px 0 2px; color: ${INK};
  }
  .cover .year { font-size: 66px; font-weight: 200; letter-spacing: 2px; color: ${GOLD}; line-height: 1; margin: 8px 0 20px; }
  .cover .count { font-family:'Menlo','Monaco',monospace; font-size: 11px; letter-spacing: 2px; color: ${INK_MUTE}; }

  /* Signature */
  .sig-head { display: flex; justify-content: space-between; align-items: baseline; }
  .sig-date { font-family:'Menlo','Monaco',monospace; font-size: 10px; letter-spacing: 1.6px; color: ${INK_MUTE}; }
  .chrono { font-family:'Menlo','Monaco',monospace; font-size: 58px; letter-spacing: -1px; color: ${GOLD}; line-height: 1; margin: 8px 0 2px; }
  .chrono-label { font-family:'Menlo','Monaco',monospace; font-size: 9px; letter-spacing: 2px; color: ${INK_DIM}; text-transform: uppercase; }
  .trace-wrap { display: flex; justify-content: center; margin: 26px 0; }
  .pillars { margin-top: 6px; }
  .pillar { margin: 12px 0; }
  .pillar-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px; }
  .pillar-name { font-size: 11px; letter-spacing: 0.5px; color: ${INK}; }
  .pillar-val { font-family:'Menlo','Monaco',monospace; font-size: 11px; color: ${INK_MUTE}; }
  .pillar-track { height: 3px; background: ${LINE}; border-radius: 2px; overflow: hidden; }
  .pillar-fill { height: 3px; border-radius: 2px; }
  .photo { margin-top: 26px; border-radius: 10px; overflow: hidden; border: 1px solid ${LINE}; }
  .photo img { display: block; width: 100%; height: 220px; object-fit: cover; }

  /* Évolution */
  .evo-caption { font-size: 13px; line-height: 1.6; color: ${INK_MUTE}; max-width: 380px; margin: 4px 0 26px; }
  table.evo { width: 100%; border-collapse: collapse; }
  table.evo td { padding: 11px 4px; border-bottom: 1px solid ${LINE}; font-size: 12px; }
  table.evo td.i { font-family:'Menlo','Monaco',monospace; color: ${GOLD}; width: 26px; }
  table.evo td.v { font-family:'Menlo','Monaco',monospace; text-align: right; color: ${INK}; }
  table.evo td.c { color: ${INK_MUTE}; }

  /* Colophon */
  .colophon { display: flex; flex-direction: column; justify-content: flex-end; min-height: 100vh; }
  .pacte { font-size: 16px; font-weight: 200; line-height: 1.75; color: ${INK}; max-width: 400px; }
  .sign { font-family:'Menlo','Monaco',monospace; font-size: 9px; letter-spacing: 3px; color: ${GOLD}; margin-top: 28px; }
</style>
</head>
<body>
${pagesHtml}
</body>
</html>
  `.trim();
}

function goldSealSvg(): string {
  // Insigne or : deux cercles concentriques + monogramme OXV (gravé, statique).
  return `
  <svg class="seal" width="118" height="118" viewBox="0 0 118 118" fill="none">
    <circle cx="59" cy="59" r="56" stroke="${GOLD}" stroke-width="1"/>
    <circle cx="59" cy="59" r="47" stroke="${GOLD}" stroke-width="0.5" opacity="0.55"/>
    <text x="59" y="68" text-anchor="middle" font-family="Menlo,Monaco,monospace" font-size="26" letter-spacing="1" fill="${GOLD_SOFT}">OXV</text>
  </svg>`;
}

function coverPage(year: number, sessionCount: number): string {
  const count = `${sessionCount} ${sessionCount > 1 ? 'séances gravées' : 'séance gravée'}`;
  return `
  <section class="page cover">
    ${goldSealSvg()}
    <p class="eyebrow">Carnet Heritage</p>
    <h1>Votre saison</h1>
    <div class="year">${year}</div>
    <div class="count">${escapeHtml(count)}</div>
  </section>`;
}

function signaturePage(
  s: HeritageBookSessionInput,
  position: number,
  total: number,
  trace: LatLon[] | null
): string {
  // Absence honnête « — » (jamais un libellé générique fabriqué) : même
  // traitement que la page Évolution et le contrat du service (en-tête l.15).
  const circuit = s.circuitName ?? '—';
  const date = s.startedAt !== null ? formatDateLong(s.startedAt) : '—';
  const chrono = s.bestLapMs !== null ? formatLapTimeMs(s.bestLapMs / 1000) : '—';
  const laps =
    s.lapCount !== null && s.lapCount > 0 ? `${s.lapCount} tour${s.lapCount > 1 ? 's' : ''}` : null;
  const sub = laps !== null ? `Meilleur tour · ${laps}` : 'Meilleur tour';

  const traceHtml =
    s.hasTrace && trace !== null ? `<div class="trace-wrap">${traceSvg(trace, 260, 22)}</div>` : '';

  const pillarsHtml = s.pillars
    .map((p) => {
      const color = PILLAR_COLORS[p.key] ?? GOLD;
      const measured = p.value !== null && Number.isFinite(p.value);
      const pct = measured ? Math.max(0, Math.min(100, p.value as number)) : 0;
      const valLabel = measured ? String(Math.round(p.value as number)) : '—';
      return `
      <div class="pillar">
        <div class="pillar-top">
          <span class="pillar-name">${escapeHtml(p.label)}</span>
          <span class="pillar-val">${valLabel}</span>
        </div>
        <div class="pillar-track"><div class="pillar-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>`;
    })
    .join('');

  const photoHtml =
    s.photoUrl !== null ? `<div class="photo"><img src="${escapeAttr(s.photoUrl)}" /></div>` : '';

  return `
  <section class="page">
    <div class="sig-head">
      <p class="eyebrow">Signature ${position} / ${total} · ${escapeHtml(circuit)}</p>
      <span class="sig-date">${escapeHtml(date)}</span>
    </div>
    <hr class="gold-rule" />
    <div class="chrono-label">${escapeHtml(sub)}</div>
    <div class="chrono">${escapeHtml(chrono)}</div>
    ${traceHtml}
    <div class="pillars">${pillarsHtml}</div>
    ${photoHtml}
  </section>`;
}

function evolutionPage(sessions: readonly HeritageBookSessionInput[]): string {
  const rows = sessions
    .map((s, i) => {
      const circuit = s.circuitName ?? '—';
      const chrono = s.bestLapMs !== null ? formatLapTimeMs(s.bestLapMs / 1000) : '—';
      return `
      <tr>
        <td class="i">${i + 1}</td>
        <td class="c">${escapeHtml(circuit)}</td>
        <td class="v">${escapeHtml(chrono)}</td>
      </tr>`;
    })
    .join('');

  const spark = sparklineSvg(sessions);

  return `
  <section class="page">
    <p class="eyebrow">Évolution</p>
    <hr class="gold-rule" />
    <p class="evo-caption">Vous, contre vous. Séance après séance — le fil de votre saison.</p>
    ${spark}
    <table class="evo">${rows}</table>
  </section>`;
}

function colophonPage(year: number): string {
  return `
  <section class="page colophon">
    <div>
      <p class="eyebrow">Le pacte</p>
      <hr class="gold-rule" />
      <p class="pacte">L'app est un miroir. Elle vous montre. Elle ne vous dirige pas. La piste est à vous. Les décisions aussi.</p>
      <p class="sign">— OXV · CARNET HERITAGE ${year}</p>
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Tracé & sparkline SVG (projection maison, données réelles)
// ---------------------------------------------------------------------------

/** Projette une centerline lat/lon en polyline or centrée dans un carré. */
function traceSvg(points: LatLon[], size: number, pad: number): string {
  if (points.length < 2) return '';
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  const spanLat = maxLat - minLat || 1e-6;
  const spanLon = maxLon - minLon || 1e-6;
  const inner = size - pad * 2;
  const scale = Math.min(inner / spanLon, inner / spanLat);
  const offX = (size - spanLon * scale) / 2;
  const offY = (size - spanLat * scale) / 2;
  const pts = points
    .map((p) => {
      const x = offX + (p.lon - minLon) * scale;
      // y inversé : la latitude monte, le plan SVG descend.
      const y = size - (offY + (p.lat - minLat) * scale);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">
    <polyline points="${pts}" fill="none" stroke="${GOLD}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/**
 * Sparkline des meilleurs tours (soi contre soi) : un tour plus RAPIDE monte
 * (valeur inversée) — un fait, jamais un classement. Renvoie '' si moins de 2
 * points mesurés.
 */
function sparklineSvg(sessions: readonly HeritageBookSessionInput[]): string {
  const vals = sessions.map((s) => (s.bestLapMs !== null ? s.bestLapMs : null));
  const measured = vals.filter((v): v is number => v !== null);
  if (measured.length < 2) return '';
  const min = Math.min(...measured);
  const max = Math.max(...measured);
  const span = max - min || 1;
  const w = 420;
  const h = 90;
  const pad = 10;
  const stepX = vals.length > 1 ? (w - pad * 2) / (vals.length - 1) : 0;
  const pts: string[] = [];
  vals.forEach((v, i) => {
    if (v === null) return;
    const x = pad + i * stepX;
    // Inversé : plus rapide (min) → plus HAUT.
    const y = pad + ((v - min) / span) * (h - pad * 2);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  return `
  <svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" fill="none" style="margin-bottom:22px">
    <polyline points="${pts.join(' ')}" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Échappe une valeur d'attribut (URL signée) — les URLs signées Supabase
 *  n'ont pas de guillemets, mais on reste strict par principe. */
function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
