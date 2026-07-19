/**
 * Tests galerieLogic (V2-L5 CLUB, Mission D) — logique PURE de la Galerie.
 * ts-jest node. Verrouille : groupement par séance, mosaïque équilibrée,
 * aplatissement (sticky), sélection des photos ouvrables, et les DEUX gatings
 * doctrinaux du lot pour cet écran (cellule vidéo = flag ; Carnet = tier).
 */

import {
  flattenSections,
  getMediaSections,
  heritageBookVisible,
  photoVideoCounts,
  splitIntoColumns,
  videoOverlayCellVisible,
  viewablePhotos,
  type GalleryMediaRef,
  type SessionMetaRef,
} from '../galerieLogic';

interface Media extends GalleryMediaRef {
  signedUrl?: string | null;
}

function media(over: Partial<Media> & { id: string; telemetrySessionId: string }): Media {
  return {
    mediaType: 'photo',
    uploadedAt: '2026-07-10T10:00:00.000Z',
    widthPx: null,
    heightPx: null,
    ...over,
  };
}

describe('getMediaSections', () => {
  it('groupe par séance et ordonne de la plus récente à la plus ancienne', () => {
    const metaById: Record<string, SessionMetaRef> = {
      a: { startedAt: '2026-07-10T09:00:00.000Z', circuitName: 'Haute Saintonge' },
      b: { startedAt: '2026-07-15T09:00:00.000Z', circuitName: 'Val de Vienne' },
    };
    const items = [
      media({ id: 'b1', telemetrySessionId: 'b' }),
      media({ id: 'a1', telemetrySessionId: 'a' }),
      media({ id: 'a2', telemetrySessionId: 'a' }),
      media({ id: 'b2', telemetrySessionId: 'b' }),
    ];
    const sections = getMediaSections(items, metaById);
    expect(sections.map((s) => s.sessionId)).toEqual(['b', 'a']);
    expect(sections[0].circuitName).toBe('Val de Vienne');
    expect(sections[0].items.map((i) => i.id)).toEqual(['b1', 'b2']);
    expect(sections[0].dateIso).toBe('2026-07-15T09:00:00.000Z');
    expect(sections[1].items).toHaveLength(2);
  });

  it("replie sur la date du média le plus récent quand la séance n'a pas de méta", () => {
    const items = [
      media({ id: 'x1', telemetrySessionId: 'x', uploadedAt: '2026-06-01T08:00:00.000Z' }),
      media({ id: 'x2', telemetrySessionId: 'x', uploadedAt: '2026-06-03T08:00:00.000Z' }),
    ];
    const sections = getMediaSections(items, {});
    expect(sections).toHaveLength(1);
    expect(sections[0].circuitName).toBeNull();
    // repli honnête : le média le plus récent, jamais une date inventée
    expect(sections[0].dateIso).toBe('2026-06-03T08:00:00.000Z');
  });

  it('rend un tableau vide sans média', () => {
    expect(getMediaSections([], {})).toEqual([]);
  });
});

describe('splitIntoColumns', () => {
  it('répartit en alternance les tuiles carrées (départage à gauche)', () => {
    const items = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }].map((x) => ({
      ...x,
      widthPx: 100,
      heightPx: 100,
    }));
    const cols = splitIntoColumns(items, 2);
    expect(cols[0].map((i) => i.id)).toEqual([0, 2]);
    expect(cols[1].map((i) => i.id)).toEqual([1, 3]);
  });

  it('équilibre selon le ratio des images (une tuile haute pèse plus)', () => {
    const tall = { id: 'tall', widthPx: 100, heightPx: 300 }; // aspect 3
    const s1 = { id: 's1', widthPx: 100, heightPx: 100 };
    const s2 = { id: 's2', widthPx: 100, heightPx: 100 };
    const cols = splitIntoColumns([tall, s1, s2], 2);
    // La haute part seule dans col0 ; les deux carrées comblent col1.
    expect(cols[0].map((i) => i.id)).toEqual(['tall']);
    expect(cols[1].map((i) => i.id)).toEqual(['s1', 's2']);
  });

  it('respecte au moins une colonne', () => {
    const cols = splitIntoColumns([{ widthPx: 1, heightPx: 1 }], 0);
    expect(cols).toHaveLength(1);
    expect(cols[0]).toHaveLength(1);
  });
});

describe('flattenSections', () => {
  it('produit header/body par séance et les index sticky des en-têtes', () => {
    const sections = getMediaSections(
      [media({ id: 'a1', telemetrySessionId: 'a' }), media({ id: 'b1', telemetrySessionId: 'b' })],
      {
        a: { startedAt: '2026-07-10T09:00:00.000Z', circuitName: 'A' },
        b: { startedAt: '2026-07-11T09:00:00.000Z', circuitName: 'B' },
      }
    );
    const { rows, stickyHeaderIndices } = flattenSections(sections, 2);
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.kind)).toEqual(['header', 'body', 'header', 'body']);
    expect(stickyHeaderIndices).toEqual([0, 2]);
  });
});

describe('viewablePhotos', () => {
  it("ne retient que les photos avec URL signée, dans l'ordre d'affichage", () => {
    const sections = getMediaSections(
      [
        media({ id: 'p1', telemetrySessionId: 's', signedUrl: 'https://x/p1' }),
        media({ id: 'v1', telemetrySessionId: 's', mediaType: 'video', signedUrl: 'https://x/v1' }),
        media({ id: 'p2', telemetrySessionId: 's', signedUrl: null }),
        media({ id: 'p3', telemetrySessionId: 's', signedUrl: 'https://x/p3' }),
      ],
      { s: { startedAt: '2026-07-10T09:00:00.000Z', circuitName: 'S' } }
    );
    const photos = viewablePhotos(sections);
    expect(photos.map((p) => p.id)).toEqual(['p1', 'p3']);
    expect(photos[0].uri).toBe('https://x/p1');
    expect(photos[0].sessionId).toBe('s');
  });
});

describe('gating doctrinal', () => {
  it('cellule vidéo : présente seulement si le flag est actif (fail-closed)', () => {
    expect(videoOverlayCellVisible(true)).toBe(true);
    expect(videoOverlayCellVisible(false)).toBe(false);
  });

  it('Carnet Heritage : visible pour le tier Heritage uniquement', () => {
    expect(heritageBookVisible({ isHeritage: true })).toBe(true);
    expect(heritageBookVisible({ isHeritage: false })).toBe(false);
    expect(heritageBookVisible(null)).toBe(false);
    expect(heritageBookVisible(undefined)).toBe(false);
  });
});

describe('photoVideoCounts', () => {
  it('compte réellement photos et vidéos', () => {
    const counts = photoVideoCounts([
      media({ id: '1', telemetrySessionId: 's' }),
      media({ id: '2', telemetrySessionId: 's', mediaType: 'video' }),
      media({ id: '3', telemetrySessionId: 's' }),
    ]);
    expect(counts).toEqual({ photos: 2, videos: 1 });
  });
});
