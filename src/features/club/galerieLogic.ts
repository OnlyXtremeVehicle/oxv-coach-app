/**
 * galerieLogic — logique PURE de la Galerie (V2-L5 CLUB, Mission D, écran 6/7).
 *
 * Module .ts strictement pur : aucune dépendance React, React Native ou
 * Supabase — testé sous ts-jest node (__tests__/galerieLogic.test.ts). Les
 * lectures vivent dans le hook (useGalerie) ; ici, uniquement les décisions.
 *
 * Règle fondatrice « données réelles câblées » : chaque fonction rend un
 * résultat vide / null quand la donnée manque — jamais une valeur inventée.
 * Le gating C3 Heritage réutilise `heritageOf` de miroirHomeLogic (une seule
 * source de vérité du tier, jamais une reconstruction locale).
 */

import { heritageOf, type HeritageTier } from '@/features/miroir/miroirHomeLogic';

// Le gating du tier passe par la MÊME lecture que l'accueil Miroir : on
// ré-exporte pour que le hook n'ait qu'un point d'import.
export { heritageOf };
export type { HeritageTier, RegistrationRef } from '@/features/miroir/miroirHomeLogic';

// ---------------------------------------------------------------------------
// Types — sous-ensembles structurels (compatibles SessionMediaItem)
// ---------------------------------------------------------------------------

/** Sous-ensemble d'un média consommé par le groupement / la mosaïque. */
export interface GalleryMediaRef {
  id: string;
  telemetrySessionId: string;
  /** 'photo' | 'video'. */
  mediaType: string;
  /** ISO — dépôt du média (repli de date d'en-tête si la séance n'est pas datée). */
  uploadedAt: string;
  widthPx?: number | null;
  heightPx?: number | null;
}

/** Méta d'une séance pour l'en-tête de section (jointure telemetry_sessions). */
export interface SessionMetaRef {
  startedAt: string | null;
  circuitName: string | null;
}

/** Une séance = une section de la grille (en-tête date/circuit + médias). */
export interface GallerySection<T extends GalleryMediaRef> {
  sessionId: string;
  circuitName: string | null;
  /** ISO de l'en-tête : date de séance, repli sur le média le plus récent. */
  dateIso: string | null;
  /** Clé de tri (ms) — dérivée de dateIso ou du média le plus récent, 0 sinon. */
  sortKey: number;
  items: T[];
}

/** Rang aplati pour une FlashList à en-têtes collants (sticky). */
export type GalleryRow<T extends GalleryMediaRef> =
  | {
      kind: 'header';
      sessionId: string;
      circuitName: string | null;
      dateIso: string | null;
      count: number;
    }
  | { kind: 'body'; sessionId: string; columns: T[][] };

// ---------------------------------------------------------------------------
// Groupement par séance
// ---------------------------------------------------------------------------

function toMs(iso: string | null | undefined): number {
  if (iso === null || iso === undefined) return Number.NaN;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : Number.NaN;
}

/**
 * Regroupe les médias par séance et ordonne les sections de la plus récente à
 * la plus ancienne. La date d'en-tête est celle de la SÉANCE (donnée réelle),
 * avec repli honnête sur le média le plus récent quand la séance n'est pas
 * datée — jamais une date inventée. Ordre stable pour les clés égales.
 */
export function getMediaSections<T extends GalleryMediaRef>(
  media: readonly T[],
  metaById: Readonly<Record<string, SessionMetaRef>>
): GallerySection<T>[] {
  const order: string[] = [];
  const groups = new Map<string, T[]>();
  for (const m of media) {
    const sid = m.telemetrySessionId;
    let g = groups.get(sid);
    if (g === undefined) {
      g = [];
      groups.set(sid, g);
      order.push(sid);
    }
    g.push(m);
  }

  const sections: GallerySection<T>[] = order.map((sid) => {
    const items = groups.get(sid) as T[];
    const meta = metaById[sid];
    const startedAt = meta?.startedAt ?? null;
    let latestUpload = Number.NEGATIVE_INFINITY;
    for (const it of items) {
      const t = toMs(it.uploadedAt);
      if (Number.isFinite(t) && t > latestUpload) latestUpload = t;
    }
    const startedMs = toMs(startedAt);
    const hasUpload = Number.isFinite(latestUpload);
    const sortKey = Number.isFinite(startedMs) ? startedMs : hasUpload ? latestUpload : 0;
    const dateIso = startedAt ?? (hasUpload ? new Date(latestUpload).toISOString() : null);
    return {
      sessionId: sid,
      circuitName: meta?.circuitName ?? null,
      dateIso,
      sortKey,
      items,
    };
  });

  return sections
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s.sortKey - a.s.sortKey || a.i - b.i)
    .map((x) => x.s);
}

// ---------------------------------------------------------------------------
// Mosaïque — répartition en colonnes équilibrées (masonry)
// ---------------------------------------------------------------------------

/** Ratio hauteur/largeur estimé d'une tuile (repli carré = 1 si non mesuré). */
function estimatedAspect(it: { widthPx?: number | null; heightPx?: number | null }): number {
  const w = it.widthPx;
  const h = it.heightPx;
  if (
    typeof w === 'number' &&
    typeof h === 'number' &&
    Number.isFinite(w) &&
    Number.isFinite(h) &&
    w > 0 &&
    h > 0
  ) {
    return h / w;
  }
  return 1;
}

/**
 * Répartit les médias en `columnCount` colonnes équilibrées (masonry) : chaque
 * tuile va dans la colonne la plus courte à l'instant (hauteur estimée par le
 * ratio de l'image), départage à la colonne d'index le plus bas (gauche).
 * Déterministe — verrouillé par test.
 */
export function splitIntoColumns<T extends { widthPx?: number | null; heightPx?: number | null }>(
  items: readonly T[],
  columnCount = 2
): T[][] {
  const n = Math.max(1, Math.floor(columnCount));
  const cols: T[][] = Array.from({ length: n }, () => []);
  const heights = new Array<number>(n).fill(0);
  for (const it of items) {
    let target = 0;
    for (let i = 1; i < n; i++) {
      if (heights[i] < heights[target] - 1e-9) target = i;
    }
    cols[target].push(it);
    heights[target] += estimatedAspect(it);
  }
  return cols;
}

/**
 * Aplati les sections en rangs pour une FlashList : un rang d'en-tête (collant)
 * puis un rang de corps (2 colonnes masonry) par séance. Renvoie aussi les
 * index des en-têtes pour `stickyHeaderIndices`.
 */
export function flattenSections<T extends GalleryMediaRef>(
  sections: readonly GallerySection<T>[],
  columnCount = 2
): { rows: GalleryRow<T>[]; stickyHeaderIndices: number[] } {
  const rows: GalleryRow<T>[] = [];
  const stickyHeaderIndices: number[] = [];
  for (const sec of sections) {
    stickyHeaderIndices.push(rows.length);
    rows.push({
      kind: 'header',
      sessionId: sec.sessionId,
      circuitName: sec.circuitName,
      dateIso: sec.dateIso,
      count: sec.items.length,
    });
    rows.push({
      kind: 'body',
      sessionId: sec.sessionId,
      columns: splitIntoColumns(sec.items, columnCount),
    });
  }
  return { rows, stickyHeaderIndices };
}

// ---------------------------------------------------------------------------
// Viewer — liste ordonnée des PHOTOS ouvrables (une vidéo ne se rend pas ici)
// ---------------------------------------------------------------------------

/** Une entrée ouvrable dans le viewer plein écran (photo signée uniquement). */
export interface ViewablePhoto {
  id: string;
  uri: string;
  sessionId: string;
}

/**
 * Aplati, dans l'ORDRE D'AFFICHAGE des sections, les photos disposant d'une
 * URL signée — l'ordre est celui du viewer (swipe horizontal entre photos).
 * Les vidéos et les photos sans URL sont exclues (aucun rendu possible).
 */
export function viewablePhotos<T extends GalleryMediaRef & { signedUrl?: string | null }>(
  sections: readonly GallerySection<T>[]
): ViewablePhoto[] {
  const out: ViewablePhoto[] = [];
  for (const sec of sections) {
    for (const it of sec.items) {
      if (it.mediaType === 'photo' && typeof it.signedUrl === 'string' && it.signedUrl.length > 0) {
        out.push({ id: it.id, uri: it.signedUrl, sessionId: sec.sessionId });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Gating — vidéo (flag) & Carnet Heritage (tier)
// ---------------------------------------------------------------------------

/**
 * La cellule « ◉ VIDÉO DU TOUR » n'apparaît QUE si le flag `video_overlay` est
 * activé (fail-closed). OFF → absente, jamais teasée.
 */
export function videoOverlayCellVisible(flagEnabled: boolean): boolean {
  return flagEnabled === true;
}

/**
 * Le Carnet Heritage (C3) n'apparaît QUE pour le tier Heritage. Sinon la
 * section est ABSENTE (pas teasée) — décision unique, adossée au même tier que
 * l'accueil Miroir (heritageOf).
 */
export function heritageBookVisible(tier: HeritageTier | null | undefined): boolean {
  return tier?.isHeritage === true;
}

// ---------------------------------------------------------------------------
// Décompte factuel — eyebrow honnête
// ---------------------------------------------------------------------------

/** Décompte réel photos / vidéos (trace vers media.length, jamais estimé). */
export function photoVideoCounts(media: readonly GalleryMediaRef[]): {
  photos: number;
  videos: number;
} {
  let photos = 0;
  let videos = 0;
  for (const m of media) {
    if (m.mediaType === 'photo') photos += 1;
    else if (m.mediaType === 'video') videos += 1;
  }
  return { photos, videos };
}
