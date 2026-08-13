/**
 * LA PHRASE QUI DIT D'OÙ VIENT LA LISTE.
 *
 * ===========================================================================
 * POURQUOI ELLE EXISTE
 * ===========================================================================
 *
 * Servir une copie locale au retour du circuit répare un vrai défaut : sans
 * réseau, l'écran Data basculait en erreur et le pilote ne voyait aucune de ses
 * séances, alors qu'elles étaient en base et ses trames sur son téléphone.
 *
 * Mais un repli muet en fabriquerait un autre, et pire : une liste d'hier
 * présentée comme celle d'aujourd'hui. Le pilote qui vient de rouler ne verrait
 * pas sa séance du jour et en conclurait qu'elle est perdue — exactement la
 * frayeur du 13/08, provoquée cette fois par la réparation.
 *
 * Le message DÉCRIT, et ne prescrit rien : il ne dit pas d'aller chercher du
 * réseau, il dit ce qui est affiché.
 */

/** Un instant lisible en français, sans dépendance de formatage. */
const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

/**
 * Phrase du bandeau hors-ligne, ou `null` quand la liste est fraîche.
 *
 * `null` EST LE CAS NOMINAL, ET IL EST SILENCIEUX. Un bandeau affiché à chaque
 * ouverture cesse d'être lu, et celui-ci porte la seule information qui compte
 * quand elle est vraie.
 *
 * @param capturéLe ISO de la dernière lecture réseau réussie, ou `null`.
 * @param maintenantMs instant courant (injectable pour les tests).
 */
export function messageHorsLigne(
  capturéLe: string | null,
  maintenantMs: number = Date.now()
): string | null {
  if (capturéLe === null) return null;

  const t = new Date(capturéLe).getTime();
  /**
   * Une date illisible ne doit pas produire « NaN » à l'écran, ni faire
   * disparaître le bandeau : le fait important — la liste n'est pas fraîche —
   * reste vrai même si l'on ne sait plus quand elle a été prise.
   */
  if (!Number.isFinite(t)) {
    return 'Liste hors ligne. Elle date de votre dernière connexion.';
  }

  const minutes = Math.floor((maintenantMs - t) / 60_000);

  // Moins d'une minute : inutile de dater, l'écart n'a aucun sens pour le lecteur.
  if (minutes < 1) return 'Liste hors ligne, relevée à l’instant.';
  if (minutes < 60) return `Liste hors ligne, relevée il y a ${minutes} min.`;

  const heures = Math.floor(minutes / 60);
  if (heures < 24) {
    return `Liste hors ligne, relevée il y a ${heures} h.`;
  }

  const d = new Date(t);
  const jour = d.getDate();
  const mois = MOIS[d.getMonth()] ?? '';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `Liste hors ligne, relevée le ${jour} ${mois} à ${h}h${m}.`;
}
