/**
 * LE SENS DE PARCOURS, DIT AU PILOTE — logique pure.
 *
 * ===========================================================================
 * POURQUOI CE FICHIER EXISTE
 * ===========================================================================
 *
 * En mode PORTE — c'est-à-dire dès qu'un circuit renseigne un cap —, la ligne
 * d'arrivée n'est franchie que dans UN sens. Parcourue à l'envers, elle ne
 * compte rien : pas un tour approximatif, pas un tour douteux. Zéro.
 *
 * Cette règle est écrite dans `utils/lapDetection`, éprouvée par ses tests,
 * consignée dans la migration du circuit — et **elle n'apparaissait nulle part
 * dans l'application**. Un pilote qui tourne dans l'autre sens enregistre sa
 * séance entière, trames comprises, et découvre au bilan qu'elle n'a aucun
 * chrono. Il n'a aucun moyen de l'apprendre avant.
 *
 * C'est le seul réglage d'un circuit qui décide de la journée avant même de
 * démarrer. Il se dit donc à l'armement, en clair.
 *
 * ===========================================================================
 * CE QU'ON REFUSE DE DIRE
 * ===========================================================================
 *
 * Sans cap relevé, la détection retombe en mode RAYON, qui n'a AUCUN filtre de
 * direction : les deux sens comptent. Annoncer un sens obligatoire serait alors
 * faux, et un pilote qui s'y fierait tournerait à l'envers pour rien. On rend
 * donc `null` — l'absence, jamais une phrase de remplissage.
 *
 * Et ce n'est pas une prescription : on décrit la géométrie du chronométrage,
 * on ne dit pas comment piloter.
 */

/** Les seize secteurs de la rose, du nord au nord. */
const SECTEURS = [
  'nord',
  'nord-nord-est',
  'nord-est',
  'est-nord-est',
  'est',
  'est-sud-est',
  'sud-est',
  'sud-sud-est',
  'sud',
  'sud-sud-ouest',
  'sud-ouest',
  'ouest-sud-ouest',
  'ouest',
  'ouest-nord-ouest',
  'nord-ouest',
  'nord-nord-ouest',
] as const;

/**
 * Le secteur de la rose des vents correspondant à un cap, ou `null`.
 *
 * Les caps hors de [0, 360[ sont ramenés dans l'intervalle plutôt que rejetés :
 * 372° est un cap parfaitement lisible, et le refuser priverait le pilote de
 * l'information pour une faute de saisie sans conséquence.
 */
export function secteurCardinal(capDeg: number | null | undefined): string | null {
  if (typeof capDeg !== 'number' || !Number.isFinite(capDeg)) return null;
  const cap = ((capDeg % 360) + 360) % 360;
  return SECTEURS[Math.round(cap / 22.5) % 16];
}

/**
 * La phrase du sens de parcours, ou `null` si le circuit n'impose aucun sens.
 *
 * @param capDeg cap de franchissement du circuit (`finish_line_heading`)
 */
export function phraseSensParcours(capDeg: number | null | undefined): string | null {
  const secteur = secteurCardinal(capDeg);
  if (secteur === null) return null;
  const cap = ((((capDeg as number) % 360) + 360) % 360).toFixed(0);
  return `Sens de parcours : la ligne se franchit vers le ${secteur} (cap ${cap}°). À contresens, aucun tour n’est compté.`;
}
