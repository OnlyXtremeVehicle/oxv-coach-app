/**
 * Tests bilanLogic (V2-L1, écran Bilan) — ts-jest node, zéro rendu.
 *
 * Couvre les exigences du lot :
 *   - gating biométrie STRICTEMENT fail-closed (flag OFF, consentement
 *     absent, données vides → false) ;
 *   - mapPillars : branche absente → null EXPLICITE, jamais un zéro ;
 *   - bande annotation coach : mapping présent/absent (nom réel du coach,
 *     nom du virage, [] si aucune note), notes de SÉANCE avant les repères
 *     GÉNÉRIQUES (flag `generic` verrouillé) ;
 *   - debrief : provenance PURE (générés seuls ou fallback intégral),
 *     marge non mesurée → récit neutre sans intensité, tournures épicènes ;
 *   - record personnel, chrono en ms, positions curvilignes.
 * (La garde de célébration une-seule-fois vit dans recordCelebration.ts —
 *  I/O MMKV partagée accueil/bilan, hors périmètre ts-jest node.)
 */

import { colors } from '@/ui/v2/tokens';

import {
  BILAN_PILLAR_KEYS,
  bestLapMsOf,
  bilanHeroMorphId,
  arbitrerBiometrie,
  biometryQualityOf,
  biometryVisible,
  buildCoachNotes,
  buildTraceMarkers,
  centerlineRatioForLatLon,
  debriefModel,
  engagedSegmentRatio,
  isPersonalRecord,
  lastThreadMessages,
  libelleIntention,
  mapPillars,
  momentColor,
  sessionMetaLine,
  toBiometrySamples,
  validLapsOf,
  viewerShouldDismiss,
} from '../bilanLogic';

// ---------------------------------------------------------------------------
// Gating biométrie — fail-closed
// ---------------------------------------------------------------------------

describe('biometryVisible — fail-closed', () => {
  it('flag OFF → false, même avec consentement et données', () => {
    expect(biometryVisible({ flagEnabled: false, captureConsent: true, sampleCount: 40 })).toBe(
      false
    );
  });

  it('consentement absent → false, même flag ON et données présentes', () => {
    expect(biometryVisible({ flagEnabled: true, captureConsent: false, sampleCount: 40 })).toBe(
      false
    );
  });

  it('données vides → false, même flag ON et consentement posé', () => {
    expect(biometryVisible({ flagEnabled: true, captureConsent: true, sampleCount: 0 })).toBe(
      false
    );
  });

  it('tout réuni (flag ET consentement ET données) → true', () => {
    expect(biometryVisible({ flagEnabled: true, captureConsent: true, sampleCount: 1 })).toBe(true);
  });
});

describe('toBiometrySamples', () => {
  it('convertit ts ISO → ms epoch et filtre les invalides', () => {
    const rows = [
      { ts: '2026-07-18T10:00:00.000Z', hr: 96, source: 'polar_h10', quality: 80 },
      { ts: 'pas-une-date', hr: 100, source: 'polar_h10', quality: null },
      { ts: '2026-07-18T10:00:01.000Z', hr: 0, source: 'polar_h10', quality: null },
    ];
    const samples = toBiometrySamples(rows, 'polar_h10');
    expect(samples).toHaveLength(1);
    expect(samples[0]).toEqual({ ts: Date.parse('2026-07-18T10:00:00.000Z'), hr: 96 });
  });

  /**
   * LOT 10a — LA COURBE NE MÊLE PLUS DEUX CAPTEURS.
   *
   * `toBiometrySamples` versait toutes les lignes dans une seule série, sans
   * regarder leur source. Deux capteurs, deux sites de mesure, deux horloges,
   * et plus aucun point dont on sache d'où il vient.
   */
  it('ne garde QUE les lignes de la source retenue', () => {
    const rows = [
      { ts: '2026-07-18T10:00:00.000Z', hr: 96, source: 'polar_h10', quality: 80 },
      { ts: '2026-07-18T10:00:01.000Z', hr: 150, source: 'apple_watch', quality: 80 },
    ];
    expect(toBiometrySamples(rows, 'polar_h10')).toEqual([
      { ts: Date.parse('2026-07-18T10:00:00.000Z'), hr: 96 },
    ]);
    expect(toBiometrySamples(rows, 'apple_watch')).toEqual([
      { ts: Date.parse('2026-07-18T10:00:01.000Z'), hr: 150 },
    ]);
  });
});

describe('arbitrerBiometrie — remplace le vote à la majorité', () => {
  const toutConsenti = () => true;

  function ligne(source: string, quality: number | null = 80) {
    return { ts: '2026-07-18T10:00:00.000Z', hr: 120, source, quality };
  }

  it('LE DÉFAUT FERMÉ — la montre majoritaire ne l’emporte plus par le nombre', () => {
    // Trois lignes montre contre une ceinture : l'ancien `biometrySourceOf`
    // rendait « montre ». La règle explicite retient la CADENCE, et le dit.
    const arb = arbitrerBiometrie(
      [ligne('apple_watch'), ligne('apple_watch'), ligne('apple_watch'), ligne('polar_h10')],
      toutConsenti
    );
    expect(arb?.badge).toBe('ceinture');
    expect(arb?.cleSource).toBe('polar_h10');
    expect(arb?.motif).toContain('cadence plus fine');
  });

  it('une source unique est retenue sans motif à produire', () => {
    const arb = arbitrerBiometrie([ligne('polar_h10')], toutConsenti);
    expect(arb).toEqual({ cleSource: 'polar_h10', badge: 'ceinture', motif: null });
  });

  it('une source NON consentie n’est pas retenue', () => {
    const arb = arbitrerBiometrie(
      [ligne('polar_h10'), ligne('apple_watch')],
      (id) => id === 'montre_apple'
    );
    expect(arb?.cleSource).toBe('apple_watch');
  });

  it('aucune source reconnue ou consentie → null (jamais un badge inventé)', () => {
    expect(arbitrerBiometrie([ligne('inconnu')], toutConsenti)).toBeNull();
    expect(arbitrerBiometrie([], toutConsenti)).toBeNull();
    expect(arbitrerBiometrie([ligne('polar_h10')], () => false)).toBeNull();
  });
});

describe('biometryQualityOf', () => {
  it('qualité : moyenne des valeurs mesurées, undefined sans mesure', () => {
    expect(biometryQualityOf([{ quality: 90 }, { quality: 70 }])).toBe('haute');
    expect(biometryQualityOf([{ quality: 50 }])).toBe('moyenne');
    expect(biometryQualityOf([{ quality: 10 }])).toBe('basse');
    expect(biometryQualityOf([{ quality: null }])).toBeUndefined();
    expect(biometryQualityOf([])).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Quatre piliers — null explicite
// ---------------------------------------------------------------------------

describe('mapPillars', () => {
  it('branche absente ou nulle → value null EXPLICITE (jamais 0)', () => {
    const pillars = mapPillars({ trajectoire: 72, freinage: null });
    const byKey = new Map(pillars.map((p) => [p.key, p]));
    expect(byKey.get('trajectoire')?.value).toBe(72);
    expect(byKey.get('freinage')?.value).toBeNull();
    expect(byKey.get('acceleration')?.value).toBeNull();
    expect(byKey.get('fluidite')?.value).toBeNull();
  });

  it('analyse absente (null) → 4 piliers, tous null', () => {
    const pillars = mapPillars(null);
    expect(pillars).toHaveLength(4);
    expect(pillars.every((p) => p.value === null)).toBe(true);
    expect(pillars.map((p) => p.key)).toEqual([...BILAN_PILLAR_KEYS]);
  });

  it('la couleur de chaque pilier est SA couleur QDI (la couleur est une donnée)', () => {
    const pillars = mapPillars({});
    const byKey = new Map(pillars.map((p) => [p.key, p]));
    expect(byKey.get('trajectoire')?.color).toBe(colors.qdi.trajectoire);
    expect(byKey.get('freinage')?.color).toBe(colors.qdi.freinage);
    expect(byKey.get('acceleration')?.color).toBe(colors.qdi.acceleration);
    expect(byKey.get('fluidite')?.color).toBe(colors.qdi.fluidite);
  });

  it('valeur non finie (NaN) → null', () => {
    const pillars = mapPillars({ trajectoire: Number.NaN });
    expect(pillars.find((p) => p.key === 'trajectoire')?.value).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Chrono — meilleur tour, record, célébration une-seule-fois
// ---------------------------------------------------------------------------

describe('bestLapMsOf / validLapsOf', () => {
  const lap = (n: number, s: number, out = false, inl = false) => ({
    lap_number: n,
    duration_seconds: s,
    is_outlap: out,
    is_inlap: inl,
  });

  it('meilleur tour VALIDE en millisecondes (out/inlap exclus)', () => {
    const laps = [lap(1, 95.2, true), lap(2, 91.724), lap(3, 92.1), lap(4, 89.9, false, true)];
    expect(validLapsOf(laps)).toHaveLength(2);
    expect(bestLapMsOf(laps, null)).toBe(91724);
  });

  it('sans tour valide → agrégat de session ; sans rien → null', () => {
    expect(bestLapMsOf([], 91.724)).toBe(91724);
    expect(bestLapMsOf([], null)).toBeNull();
    expect(bestLapMsOf([lap(1, 0)], null)).toBeNull();
  });
});

describe('isPersonalRecord', () => {
  const sessions = [
    { id: 'a', best_lap_seconds: 92.5 },
    { id: 'b', best_lap_seconds: 91.0 },
    { id: 'c', best_lap_seconds: null },
  ];

  it('bat strictement toutes les AUTRES séances → record', () => {
    expect(isPersonalRecord(90900, 'a', sessions)).toBe(true);
  });

  it('égal ou plus lent que le meilleur des autres → pas record', () => {
    expect(isPersonalRecord(91000, 'a', sessions)).toBe(false);
    expect(isPersonalRecord(91500, 'a', sessions)).toBe(false);
  });

  it('sa propre séance ne se compare pas à elle-même', () => {
    // 'b' détient 91.0 : comparé aux autres (92.5), 91.0 reste un record.
    expect(isPersonalRecord(91000, 'b', sessions)).toBe(true);
  });

  it('première séance chiffrée → record (le meilleur jamais réalisé)', () => {
    expect(isPersonalRecord(91724, 'a', [{ id: 'a', best_lap_seconds: 91.724 }])).toBe(true);
  });

  it('chrono absent → jamais record', () => {
    expect(isPersonalRecord(null, 'a', sessions)).toBe(false);
  });
});

/**
 * ===========================================================================
 * LE DÉFAUT QUE LES TESTS CI-DESSUS N'ONT PAS VU, ET NE POUVAIENT PAS VOIR
 * ===========================================================================
 *
 * Ils passent `best_lap_seconds: 92.5` — un NOMBRE, ce que le type annonce.
 * Le fil, lui, envoie `"92.5"` : PostgREST sérialise `numeric` en chaîne, et
 * `fetchAllSessions` ne convertissait rien.
 *
 * Le filtre `typeof s.best_lap_seconds === 'number'` écartait donc TOUTES les
 * autres séances, `others` était toujours vide, et la fonction tombait sur son
 * `return true`. **Chaque séance était célébrée comme record personnel** —
 * flash et retour haptique — y compris la plus lente jamais roulée. Et
 * `markCelebrated` consommait au passage la garde une-fois-par-séance : un
 * vrai record ultérieur n'aurait plus rien déclenché.
 *
 * Huit tests verts au-dessus, et le défaut vivait entre eux, parce qu'aucun
 * n'employait le format que la base envoie vraiment.
 */
describe('le record, avec le format que PostgREST envoie vraiment', () => {
  /** Ce que la conversion de `@/lib/numeriquesPostgrest` produit désormais. */
  const converties = [
    { id: 'a', best_lap_seconds: 92.5 },
    { id: 'b', best_lap_seconds: 88.0 },
  ];

  it('une séance plus lente que ses aînées n’est PAS un record', () => {
    expect(isPersonalRecord(92500, 'a', converties)).toBe(false);
  });

  /**
   * LE CAS QUI FABRIQUAIT LA CÉLÉBRATION. Si la conversion venait à sauter,
   * les chronos redeviendraient des chaînes ; on exige alors le SILENCE, pas
   * un record. Être sans comparaison n'est pas être le meilleur.
   */
  it('des chronos illisibles ferment la célébration, ils ne l’ouvrent pas', () => {
    const brutes = [
      { id: 'a', best_lap_seconds: '92.5' },
      { id: 'b', best_lap_seconds: '88.0' },
    ] as unknown as { id: string; best_lap_seconds: number | null }[];
    expect(isPersonalRecord(92500, 'a', brutes)).toBe(false);
  });

  it('des autres séances toutes sans chrono ferment aussi la célébration', () => {
    const sansChrono = [
      { id: 'a', best_lap_seconds: 92.5 },
      { id: 'b', best_lap_seconds: null },
      { id: 'c', best_lap_seconds: null },
    ];
    expect(isPersonalRecord(92500, 'a', sansChrono)).toBe(false);
  });

  /**
   * ET LA VRAIE PREMIÈRE SÉANCE RESTE UN RECORD. Une garde qui refuserait tout
   * passerait les trois tests précédents sans rien protéger.
   */
  it('la toute première séance du pilote reste un record', () => {
    expect(isPersonalRecord(92500, 'a', [{ id: 'a', best_lap_seconds: 92.5 }])).toBe(true);
    expect(isPersonalRecord(92500, 'a', [])).toBe(true);
  });

  it('et un vrai record en reste un', () => {
    expect(isPersonalRecord(87000, 'c', converties)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Bande annotation coach — présente / absente, séance avant générique
// ---------------------------------------------------------------------------

describe('buildCoachNotes', () => {
  const threads = [{ coachId: 'coach-1', otherName: 'Marc Delage' }];

  it('aucune annotation → [] (la bande est ABSENTE)', () => {
    expect(buildCoachNotes([], threads)).toEqual([]);
  });

  /**
   * LA NOTE DE SÉANCE N'EST PAS UNE NOTE DE VIRAGE.
   *
   * Depuis le 14/08/2026, `coach_annotations` accepte une note qui porte sur la
   * séance entière : `cornerIndex` nul, pas d'instant. Elle arrive par la même
   * requête que les notes de virage et doit être ÉCARTÉE ici — sinon la bande
   * afficherait « Virage null », et le tri comparerait des `null`.
   *
   * Elle a sa propre place dans le bilan, sous son propre libellé.
   */
  it('une note de séance (sans virage) est écartée de la bande des virages', () => {
    const notes = buildCoachNotes(
      [
        {
          id: 'seance',
          coachId: 'coach-1',
          cornerIndex: null,
          body: 'Belle constance sur les trois tours.',
          telemetrySessionId: 's1',
        },
        {
          id: 'virage',
          coachId: 'coach-1',
          cornerIndex: 4,
          body: 'Appui franc observé ici.',
          telemetrySessionId: 's1',
        },
      ],
      threads
    );
    expect(notes.map((n) => n.id)).toEqual(['virage']);
  });

  it('une bande faite QUE de notes de séance est vide, pas remplie de « Virage null »', () => {
    const notes = buildCoachNotes(
      [
        {
          id: 'seance',
          coachId: 'coach-1',
          cornerIndex: null,
          body: 'Un bilan de séance.',
          telemetrySessionId: 's1',
        },
      ],
      threads
    );
    expect(notes).toEqual([]);
  });

  it('annotation présente → note mappée : virage réel + nom réel du coach', () => {
    const notes = buildCoachNotes(
      [
        {
          id: 'n1',
          coachId: 'coach-1',
          cornerIndex: 3,
          body: 'Appui franc observé ici.',
          telemetrySessionId: 's1',
        },
      ],
      threads
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]).toEqual({
      id: 'n1',
      cornerIndex: 3,
      cornerName: "L'épingle Est",
      body: 'Appui franc observé ici.',
      coachName: 'Marc Delage',
      generic: false,
      audioUrl: null,
    });
  });

  it('coach hors binôme résolu → coachName null (jamais un nom inventé)', () => {
    const notes = buildCoachNotes(
      [
        {
          id: 'n2',
          coachId: 'coach-inconnu',
          cornerIndex: 2,
          body: 'Note.',
          telemetrySessionId: 's1',
        },
      ],
      threads
    );
    expect(notes[0].coachName).toBeNull();
  });

  /**
   * P36 — LA VOIX SUIT SA NOTE.
   *
   * `coach_annotations.audio_url` existait, `coachAnnotationsService` la rendait
   * déjà, et ce modèle la laissait tomber : le pilote n'entendait que la note de
   * SÉANCE, jamais celle posée sur le virage qu'il regarde. La fiche demande
   * l'inverse — « réécoutable au bon endroit ».
   */
  it('la voix du coach suit le virage sur lequel elle a été posée', () => {
    const notes = buildCoachNotes(
      [
        {
          id: 'v1',
          coachId: 'coach-1',
          cornerIndex: 3,
          body: 'Ici.',
          telemetrySessionId: 's1',
          audioUrl: 'coach-audio/v1.m4a',
        },
        { id: 'v2', coachId: 'coach-1', cornerIndex: 5, body: 'Là.', telemetrySessionId: 's1' },
      ],
      threads
    );
    expect(notes[0].audioUrl).toBe('coach-audio/v1.m4a');
    // ABSENCE DE CLÉ ET ABSENCE DE VOIX SE RENDENT PAREIL : `null`. L'écran
    // teste une valeur ; `undefined` y aurait produit un lecteur fantôme.
    expect(notes[1].audioUrl).toBeNull();
  });

  it('notes triées par virage ; virage hors topologie → « Virage N »', () => {
    const notes = buildCoachNotes(
      [
        { id: 'n3', coachId: 'coach-1', cornerIndex: 12, body: 'B', telemetrySessionId: 's1' },
        { id: 'n4', coachId: 'coach-1', cornerIndex: 1, body: 'A', telemetrySessionId: 's1' },
      ],
      threads
    );
    expect(notes.map((n) => n.cornerIndex)).toEqual([1, 12]);
    expect(notes[1].cornerName).toBe('Virage 12');
  });

  it('notes de SÉANCE d’abord, repères GÉNÉRIQUES ensuite (flag generic)', () => {
    const notes = buildCoachNotes(
      [
        { id: 'g1', coachId: 'coach-1', cornerIndex: 1, body: 'Repère.', telemetrySessionId: null },
        { id: 's5', coachId: 'coach-1', cornerIndex: 5, body: 'Séance.', telemetrySessionId: 's1' },
        { id: 'g3', coachId: 'coach-1', cornerIndex: 3, body: 'Repère.', telemetrySessionId: null },
      ],
      threads
    );
    // La note rattachée à la séance passe AVANT les génériques, même si son
    // virage est plus loin — la parole du coach n'est pas datée faussement.
    expect(notes.map((n) => n.id)).toEqual(['s5', 'g1', 'g3']);
    expect(notes.map((n) => n.generic)).toEqual([false, true, true]);
  });
});

// ---------------------------------------------------------------------------
// Tracé — positions curvilignes réelles
// ---------------------------------------------------------------------------

describe('engagedSegmentRatio', () => {
  it('milieu du segment au G latéral max (progress réels)', () => {
    const t = engagedSegmentRatio([
      { segmentIndex: 1, maxGLateral: 0.8, startProgress: 0.1, endProgress: 0.2 },
      { segmentIndex: 2, maxGLateral: 1.3, startProgress: 0.5, endProgress: 0.6 },
    ]);
    expect(t).toBeCloseTo(0.55, 5);
  });

  it('segment qui enjambe la ligne (end < start) → milieu modulaire', () => {
    const t = engagedSegmentRatio([
      { segmentIndex: 7, maxGLateral: 1.1, startProgress: 0.9, endProgress: 0.1 },
    ]);
    expect(t).toBeCloseTo(0, 5);
  });

  it('sans G mesuré ou sans position → null (aucune puce inventée)', () => {
    expect(engagedSegmentRatio([])).toBeNull();
    expect(
      engagedSegmentRatio([
        { segmentIndex: 1, maxGLateral: null, startProgress: 0.1, endProgress: 0.2 },
      ])
    ).toBeNull();
    expect(
      engagedSegmentRatio([
        { segmentIndex: 1, maxGLateral: 1.0, startProgress: null, endProgress: 0.2 },
      ])
    ).toBeNull();
  });
});

describe('centerlineRatioForLatLon', () => {
  // Carré ~1 km de côté autour de lat 45 : 4 sommets, boucle fermée.
  const square = [
    { lat: 45.0, lon: 0.0 },
    { lat: 45.009, lon: 0.0 },
    { lat: 45.009, lon: 0.0127 },
    { lat: 45.0, lon: 0.0127 },
  ];

  it('point proche du premier sommet → ratio 0', () => {
    expect(centerlineRatioForLatLon(square, 45.0001, 0.0001)).toBeCloseTo(0, 2);
  });

  it('point proche du 3e sommet → ratio ~0.5 (mi-parcours du carré)', () => {
    const t = centerlineRatioForLatLon(square, 45.009, 0.0127);
    expect(t).toBeGreaterThan(0.4);
    expect(t).toBeLessThan(0.6);
  });

  it('centerline inexploitable → null', () => {
    expect(centerlineRatioForLatLon(null, 45, 0)).toBeNull();
    expect(centerlineRatioForLatLon([{ lat: 45, lon: 0 }], 45, 0)).toBeNull();
  });
});

describe('buildTraceMarkers', () => {
  const beltoiseLoop = [
    { lat: 45.2390749, lon: -0.0908906 },
    { lat: 45.2424763, lon: -0.0967393 },
    { lat: 45.2418313, lon: -0.0881423 },
    { lat: 45.2390839, lon: -0.0889951 },
  ];

  it('puce engagée (donnée) + puce OR par virage annoté', () => {
    const markers = buildTraceMarkers({
      segments: [{ segmentIndex: 2, maxGLateral: 1.2, startProgress: 0.3, endProgress: 0.4 }],
      annotatedCornerIndexes: [1],
      centerline: beltoiseLoop,
    });
    expect(markers).toHaveLength(2);
    expect(markers[0]).toMatchObject({ kind: 'engaged', color: colors.qdi.freinage });
    expect(markers[1].kind).toBe('coach');
    expect(markers[1].color).toBe(colors.heritage.gold);
    expect(markers[1].t).toBeGreaterThanOrEqual(0);
    expect(markers[1].t).toBeLessThanOrEqual(1);
  });

  it('sans centerline : les puces coach n’ont pas de position → absentes', () => {
    const markers = buildTraceMarkers({
      segments: [],
      annotatedCornerIndexes: [1, 2],
      centerline: null,
    });
    expect(markers).toEqual([]);
  });

  it('virage annoté en double → une seule puce', () => {
    const markers = buildTraceMarkers({
      segments: [],
      annotatedCornerIndexes: [1, 1],
      centerline: beltoiseLoop,
    });
    expect(markers).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Moments-clés — couleur par nature
// ---------------------------------------------------------------------------

describe('momentColor', () => {
  it('référence → or (chrono), engagé → rouge de donnée, variation → violet', () => {
    expect(momentColor('reference')).toBe(colors.heritage.gold);
    expect(momentColor('engaged')).toBe(colors.qdi.freinage);
    expect(momentColor('variation')).toBe(colors.qdi.regularite);
  });
});

// ---------------------------------------------------------------------------
// Debrief J+1 — 3 actes, garde doctrinale
// ---------------------------------------------------------------------------

describe('debriefModel', () => {
  it('analyse absente → pending (rien de meublé)', () => {
    expect(debriefModel(null, 'Gabin')).toEqual({ kind: 'pending' });
  });

  it('debrief_text présent et sûr → 3 actes générés', () => {
    const model = debriefModel(
      {
        debriefText: 'Votre séance racontée.\n---\nLe temps long observé.\n---\nUne invitation.',
        marginGlobal: 40,
      },
      'Gabin'
    );
    expect(model.kind).toBe('generated');
    if (model.kind !== 'pending') {
      expect(model.acts.map((a) => a.title)).toEqual(['Récit', 'Méta-analyse', 'Préparation']);
      expect(model.acts[0].body).toBe('Votre séance racontée.');
      expect(model.acts[2].body).toBe('Une invitation.');
    }
  });

  it('texte prescriptif persisté → REFUSÉ, repli pédagogique (fail-closed)', () => {
    const model = debriefModel(
      { debriefText: 'Freinez plus tard au virage 3.\n---\nMéta.\n---\nPrépa.', marginGlobal: 40 },
      null
    );
    expect(model.kind).toBe('fallback');
    if (model.kind !== 'pending') {
      expect(model.acts[0].body).not.toContain('Freinez');
    }
  });

  it('debrief_text vide → repli pédagogique v1 (3 actes descriptifs)', () => {
    const model = debriefModel({ debriefText: null, marginGlobal: 10 }, null);
    expect(model.kind).toBe('fallback');
    if (model.kind !== 'pending') {
      expect(model.acts).toHaveLength(3);
      expect(model.acts.every((a) => a.body.length > 0)).toBe(true);
    }
  });

  it('generated INCOMPLET → actes générés SEULS, jamais comblés au gabarit (provenance pure)', () => {
    const model = debriefModel(
      { debriefText: 'Votre séance racontée, un seul acte.', marginGlobal: 40 },
      null
    );
    expect(model.kind).toBe('generated');
    if (model.kind !== 'pending') {
      expect(model.acts).toHaveLength(1);
      expect(model.acts[0].title).toBe('Récit');
      // Aucun texte de gabarit maison sous la bannière « généré ».
      expect(model.acts[0].body).toBe('Votre séance racontée, un seul acte.');
    }
  });

  it('marge NON mesurée (null) → récit neutre, sans qualification d’intensité', () => {
    const model = debriefModel({ debriefText: null, marginGlobal: null }, null);
    expect(model.kind).toBe('fallback');
    if (model.kind !== 'pending') {
      expect(model.acts[0].body).toContain("n'a pas été mesurée");
      // Aucune intensité fabriquée depuis une valeur inexistante.
      expect(model.acts[0].body).not.toContain('dense');
      expect(model.acts[0].body).not.toContain('rétractée');
      expect(model.acts[0].body).not.toContain('aisance');
    }
  });

  it('repli marge faible : tournure épicène (aucun accord masculin « allé »)', () => {
    const model = debriefModel({ debriefText: null, marginGlobal: 5 }, null);
    expect(model.kind).toBe('fallback');
    if (model.kind !== 'pending') {
      // « \b » regex ne gère pas les accents en JS — assertion par sous-chaîne.
      expect(model.acts[0].body).not.toContain('allé');
      expect(model.acts[0].body).toContain('vous avez cherché loin');
    }
  });
});

// ---------------------------------------------------------------------------
// Divers — ligne méta, fil, viewer, morph id
// ---------------------------------------------------------------------------

describe('sessionMetaLine', () => {
  it('« 22 tours · 87 km », singulier, absents retirés, rien → null', () => {
    expect(sessionMetaLine(22, 87.2)).toBe('22 tours · 87 km');
    expect(sessionMetaLine(1, null)).toBe('1 tour');
    expect(sessionMetaLine(0, 12)).toBe('12 km');
    expect(sessionMetaLine(0, null)).toBeNull();
    expect(sessionMetaLine(0, 0)).toBeNull();
  });
});

describe('lastThreadMessages', () => {
  it('les 3 dernières bulles, ordre chronologique conservé', () => {
    expect(lastThreadMessages([1, 2, 3, 4, 5])).toEqual([3, 4, 5]);
    expect(lastThreadMessages([1, 2])).toEqual([1, 2]);
    expect(lastThreadMessages([], 3)).toEqual([]);
  });
});

describe('viewerShouldDismiss', () => {
  it('tirage franc ou flick rapide → ferme ; sinon non', () => {
    expect(viewerShouldDismiss(140, 0)).toBe(true);
    expect(viewerShouldDismiss(30, 1200)).toBe(true);
    expect(viewerShouldDismiss(30, 200)).toBe(false);
    expect(viewerShouldDismiss(10, 2000)).toBe(false);
  });
});

describe('bilanHeroMorphId', () => {
  it('identifiant stable partagé accueil → bilan', () => {
    expect(bilanHeroMorphId('s1')).toBe('bilan-hero:s1');
  });
});

// ===========================================================================
// L'ÉTIQUETTE DE L'INTENTION SUIT LA DATE
// ===========================================================================

/**
 * Mesuré le 30/08/2026 sur la séance de Bouteville : l'intention rattachée y a
 * été écrite à 23:56:00, soit une minute cinquante-deux APRÈS la fin de la
 * séance (23:54:08) — et l'écran l'annonçait « CE QUE VOUS AVIEZ POSÉ ».
 *
 * Le rattachement était juste. C'est l'étiquette qui affirmait une antériorité
 * que la donnée contredit.
 */
describe('libelleIntention', () => {
  const DEBUT = '2026-08-12T23:35:54Z';

  it('écrite avant le départ : elle a bien été posée', () => {
    expect(libelleIntention('2026-08-12T22:00:00Z', DEBUT)).toBe('CE QUE VOUS AVIEZ POSÉ');
  });

  it('écrite après la séance : l’étiquette ne revendique plus rien', () => {
    expect(libelleIntention('2026-08-12T23:56:00Z', DEBUT)).toBe('CE QUE VOUS EN AVEZ DIT');
  });

  /** Le cas réel de Bouteville, en toutes lettres. */
  it('le cas de Bouteville rend la formulation neutre', () => {
    expect(libelleIntention('2026-08-12T23:56:00.388Z', DEBUT)).not.toContain('AVIEZ POSÉ');
  });

  /**
   * SANS DATE, ON NE REVENDIQUE PAS. Une antériorité qu'on ne peut pas
   * vérifier ne s'affirme pas — c'est le repli sûr, pas le repli commode.
   */
  it('date manquante ou illisible → jamais l’antériorité', () => {
    expect(libelleIntention(null, DEBUT)).toBe('CE QUE VOUS EN AVEZ DIT');
    expect(libelleIntention('2026-08-12T22:00:00Z', null)).toBe('CE QUE VOUS EN AVEZ DIT');
    expect(libelleIntention('pas-une-date', DEBUT)).toBe('CE QUE VOUS EN AVEZ DIT');
  });

  /** Aucune des deux formulations n'évalue l'intention. Le miroir ne juge pas. */
  it('aucune des deux étiquettes ne juge', () => {
    for (const d of ['2026-08-12T22:00:00Z', '2026-08-13T02:00:00Z']) {
      expect(libelleIntention(d, DEBUT)).not.toMatch(/tenu|réussi|atteint|manqué|échec/i);
    }
  });
});
