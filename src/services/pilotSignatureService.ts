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

export interface PilotSignature {
  traits: SignatureTrait[];
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
