/**
 * Pilier §3.1 — Signature de pilotage.
 *
 * Un portrait FACTUEL et NEUTRE du style du pilote, dérivé des données
 * mesurées (app_segment_analyses + temps de tour). Aucune note, aucun
 * jugement, aucune comparaison aux autres : on décrit ce que les capteurs
 * ont mesuré, le pilote interprète seul.
 *
 * C'est l'élément le plus innovant du cahier OXV Mirror : « personne ne le
 * propose sur ce marché ». Le miroir descriptif par excellence.
 *
 * Doctrine :
 *   - Chaque trait est un CONSTAT mesuré, jamais un conseil
 *   - Vocabulaire neutre : "appuyé", "mesuré", "progressif", "soutenu"
 *   - Pas de "bon"/"mauvais", pas de "à améliorer"
 *
 * La logique est PURE (pas de Supabase) → testable unitairement.
 */

/** Sous-ensemble des champs segment nécessaires au calcul (découplé du service DB). */
export interface SignatureSegmentInput {
  segmentIndex: number;
  segmentName: string | null;
  kind: string | null; // 'turn' | 'straight' | 'chicane'
  entrySpeedKmh: number | null;
  apexSpeedKmh: number | null;
  exitSpeedKmh: number | null;
  maxGLateral: number | null;
  maxGBraking: number | null;
  marginPercent: number | null;
}

export interface SignatureTrait {
  /** Clé stable pour les tests / l'affichage. */
  key: 'braking' | 'lateral' | 'reaccel' | 'regularity';
  /** Intitulé du trait (ex : « Freinage »). */
  label: string;
  /** Valeur factuelle descriptive (ex : « appuyé »). */
  value: string;
  /** Détail mesuré optionnel (ex : « pic moyen 1,1 g »). */
  detail: string | null;
}

export interface ComfortCorner {
  segmentIndex: number;
  segmentName: string | null;
  marginPercent: number;
}

/** Les 5 axes de l'empreinte (maquette 20.2). Évocateurs mais FACTUELS. */
export type SignatureAxisKey = 'cap' | 'visee' | 'plongee' | 'trajectoire' | 'anticipation';

/**
 * Un axe du radar empreinte. `value` est une POSITION normalisée 0–1 (silhouette),
 * PAS une note — chaque axe est adossé à une mesure réelle (`detail`). `value` est
 * `null` quand la donnée est absente : on ne fabrique jamais une fausse valeur (le
 * radar marque alors « donnée à venir » sur cet axe).
 */
export interface SignatureAxis {
  key: SignatureAxisKey;
  label: string;
  value: number | null;
  detail: string | null;
}

export interface PilotSignature {
  traits: SignatureTrait[];
  /** Empreinte 5 axes (radar). Silhouette factuelle, pas un score. */
  axes: SignatureAxis[];
  /** Les virages où la marge est la plus haute (= les plus confortables). */
  comfortCorners: ComfortCorner[];
  /** Nombre de segments de type virage exploités pour le calcul. */
  turnSampleCount: number;
  /** Une phrase manifeste neutre résumant la signature, ou null si pas assez de données. */
  manifest: string | null;
}

function avg(values: number[]): number | null {
  const clean = values.filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (clean.length === 0) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

function stdDev(values: number[]): number | null {
  const clean = values.filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (clean.length < 2) return null;
  const mean = clean.reduce((a, b) => a + b, 0) / clean.length;
  const variance = clean.reduce((acc, v) => acc + (v - mean) ** 2, 0) / clean.length;
  return Math.sqrt(variance);
}

/**
 * Nature du freinage à partir du pic de décélération moyen (en g).
 * Seuils factuels, pas de jugement de valeur.
 */
function brakingTrait(turns: SignatureSegmentInput[]): SignatureTrait | null {
  const peaks = turns.map((t) => t.maxGBraking).filter((g): g is number => g !== null);
  const mean = avg(peaks);
  if (mean === null) return null;
  let value: string;
  if (mean >= 1.0) value = 'appuyé';
  else if (mean >= 0.6) value = 'mesuré';
  else value = 'progressif';
  return {
    key: 'braking',
    label: 'Freinage',
    value,
    detail: `pic moyen ${mean.toFixed(2).replace('.', ',')} g`,
  };
}

/** Engagement latéral à partir du G latéral max moyen. */
function lateralTrait(turns: SignatureSegmentInput[]): SignatureTrait | null {
  const peaks = turns.map((t) => t.maxGLateral).filter((g): g is number => g !== null);
  const mean = avg(peaks);
  if (mean === null) return null;
  let value: string;
  if (mean >= 1.1) value = 'soutenu';
  else if (mean >= 0.7) value = 'mesuré';
  else value = 'prudent';
  return {
    key: 'lateral',
    label: 'Engagement latéral',
    value,
    detail: `${mean.toFixed(2).replace('.', ',')} g en moyenne`,
  };
}

/**
 * Style de réaccélération : rapport vitesse de sortie / vitesse à la corde.
 * Plus le ratio est élevé, plus la reprise de gaz est précoce.
 */
function reaccelTrait(turns: SignatureSegmentInput[]): SignatureTrait | null {
  const ratios = turns
    .map((t) =>
      t.apexSpeedKmh && t.exitSpeedKmh && t.apexSpeedKmh > 0
        ? t.exitSpeedKmh / t.apexSpeedKmh
        : null
    )
    .filter((r): r is number => r !== null);
  const mean = avg(ratios);
  if (mean === null) return null;
  let value: string;
  if (mean >= 1.25) value = 'précoce';
  else if (mean >= 1.1) value = 'franche';
  else value = 'posée';
  return {
    key: 'reaccel',
    label: 'Réaccélération',
    value,
    detail: `sortie ${Math.round((mean - 1) * 100)} % au-dessus de la corde`,
  };
}

/** Régularité des temps de tour (écart-type, en secondes). */
function regularityTrait(lapTimesSeconds: number[]): SignatureTrait | null {
  const sd = stdDev(lapTimesSeconds);
  if (sd === null) return null;
  let value: string;
  if (sd <= 0.5) value = 'très réguliers';
  else if (sd <= 1.5) value = 'réguliers';
  else value = 'variables';
  return {
    key: 'regularity',
    label: 'Tours',
    value,
    detail: `écart-type ${sd.toFixed(2).replace('.', ',')} s`,
  };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Position normalisée 0–1 d'une mesure dans une plage factuelle (silhouette, pas note). */
function norm(v: number | null, min: number, max: number): number | null {
  if (v === null || max <= min) return null;
  return clamp01((v - min) / (max - min));
}

function fmtG(v: number): string {
  return v.toFixed(2).replace('.', ',');
}

/**
 * Les 5 axes de l'empreinte (maquette 20.2), chacun adossé à une MESURE RÉELLE
 * dérivée des segments. Plages neutres = échelle de la silhouette, jamais un
 * « idéal » à atteindre. Donnée absente → `value: null` (jamais inventée).
 *
 *   - Cap          : engagement latéral (G latéral max moyen)
 *   - Visée        : reproductibilité des entrées (faible écart des vitesses d'entrée)
 *   - Plongée      : intensité du freinage (G de frein max moyen)
 *   - Trajectoire  : vitesse portée (rapport vitesse d'apex / vitesse d'entrée)
 *   - Anticipation : précocité de la réaccélération (rapport sortie / apex)
 */
function computeAxes(turns: SignatureSegmentInput[]): SignatureAxis[] {
  const latMean = avg(turns.map((t) => t.maxGLateral).filter((g): g is number => g !== null));
  const brkMean = avg(turns.map((t) => t.maxGBraking).filter((g): g is number => g !== null));
  const reaccel = avg(
    turns
      .map((t) =>
        t.apexSpeedKmh && t.exitSpeedKmh && t.apexSpeedKmh > 0
          ? t.exitSpeedKmh / t.apexSpeedKmh
          : null
      )
      .filter((r): r is number => r !== null)
  );
  const carry = avg(
    turns
      .map((t) =>
        t.entrySpeedKmh && t.apexSpeedKmh && t.entrySpeedKmh > 0
          ? t.apexSpeedKmh / t.entrySpeedKmh
          : null
      )
      .filter((r): r is number => r !== null)
  );
  const entrySpeeds = turns.map((t) => t.entrySpeedKmh).filter((v): v is number => v !== null);
  const entryMean = avg(entrySpeeds);
  const entrySd = stdDev(entrySpeeds);
  // Visée : 1 = entrées très reproductibles, 0 = très dispersées (CV plafonné à 25 %).
  const visee =
    entryMean && entryMean > 0 && entrySd !== null ? clamp01(1 - entrySd / entryMean / 0.25) : null;

  return [
    {
      key: 'cap',
      label: 'Cap',
      value: norm(latMean, 0.5, 1.3),
      detail: latMean !== null ? `${fmtG(latMean)} g latéral` : null,
    },
    {
      key: 'visee',
      label: 'Visée',
      value: visee,
      detail: entrySd !== null ? `entrées à ±${entrySd.toFixed(1).replace('.', ',')} km/h` : null,
    },
    {
      key: 'plongee',
      label: 'Plongée',
      value: norm(brkMean, 0.4, 1.2),
      detail: brkMean !== null ? `${fmtG(brkMean)} g de frein` : null,
    },
    {
      key: 'trajectoire',
      label: 'Trajectoire',
      value: norm(carry, 0.6, 0.92),
      detail: carry !== null ? `apex à ${Math.round(carry * 100)} % de l'entrée` : null,
    },
    {
      key: 'anticipation',
      label: 'Anticipation',
      value: norm(reaccel, 1.0, 1.35),
      detail: reaccel !== null ? `sortie +${Math.round((reaccel - 1) * 100)} %` : null,
    },
  ];
}

/**
 * Construit la signature de pilotage à partir des segments d'une session
 * (ou agrégés sur plusieurs) et des temps de tour.
 */
export function computeSignature(input: {
  segments: SignatureSegmentInput[];
  lapTimesSeconds: number[];
}): PilotSignature {
  const turns = input.segments.filter((s) => s.kind === 'turn' || s.kind === 'chicane');

  const traits = [
    brakingTrait(turns),
    lateralTrait(turns),
    reaccelTrait(turns),
    regularityTrait(input.lapTimesSeconds),
  ].filter((t): t is SignatureTrait => t !== null);

  // Zones de prédilection : 2 virages à plus haute marge (les plus confortables)
  const comfortCorners: ComfortCorner[] = turns
    .filter((t) => t.marginPercent !== null)
    .map((t) => ({
      segmentIndex: t.segmentIndex,
      segmentName: t.segmentName,
      marginPercent: t.marginPercent as number,
    }))
    .sort((a, b) => b.marginPercent - a.marginPercent)
    .slice(0, 2);

  return {
    traits,
    axes: computeAxes(turns),
    comfortCorners,
    turnSampleCount: turns.length,
    manifest: buildManifest(traits),
  };
}

/**
 * Phrase manifeste neutre composée à partir des traits. Purement
 * descriptive : juxtapose les constats, ne conclut rien.
 */
function buildManifest(traits: SignatureTrait[]): string | null {
  if (traits.length === 0) return null;
  const braking = traits.find((t) => t.key === 'braking');
  const lateral = traits.find((t) => t.key === 'lateral');
  if (braking && lateral) {
    return `Freinage ${braking.value}, engagement ${lateral.value}. Voilà votre empreinte sur cette session.`;
  }
  return 'Votre empreinte de pilotage, telle que mesurée.';
}
