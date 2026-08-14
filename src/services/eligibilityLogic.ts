/**
 * Les pièces de la journée — la part PURE, testable sans supabase.
 *
 * Le service tire `@/lib/supabase`, qui tire `expo-secure-store` : il n'est
 * pas chargeable dans l'environnement node de Jest. Les constantes vivent donc
 * ici, comme partout ailleurs dans ce dépôt (`xxxLogic.ts`), et le service les
 * ré-exporte pour ses appelants.
 *
 * Ce n'est pas de la cosmétique : sans cette séparation, la garde qui vérifie
 * que le briefing n'est PAS déclarable devrait relire du texte de fichier au
 * lieu de lire les valeurs.
 */

/** Les neuf clés, telles que le CHECK de la table les borne. */
export const CLES_ELIGIBILITE = [
  'permis',
  'cni',
  'assurance_circuit',
  'controle_technique',
  'pneus_freins',
  'niveau_sonore',
  'casque',
  'decharge',
  'briefing',
] as const;

export type CleEligibilite = (typeof CLES_ELIGIBILITE)[number];

/**
 * Le libellé montré au pilote. Sobre, sans jargon administratif inutile.
 *
 * `briefing` n'y figure pas comme une pièce à apporter : c'est un geste
 * collectif, tenu sur place par l'organisation. Le pilote ne le déclare pas.
 */
export const LIBELLES: Readonly<Record<CleEligibilite, string>> = {
  permis: 'Permis de conduire',
  cni: 'Pièce d’identité',
  assurance_circuit: 'Assurance circuit',
  controle_technique: 'Contrôle technique',
  pneus_freins: 'Pneus et freins',
  niveau_sonore: 'Niveau sonore',
  casque: 'Casque',
  decharge: 'Décharge signée',
  briefing: 'Briefing de sécurité',
};

/** Les clés que le PILOTE peut déclarer — le briefing est tenu par l'équipe. */
export const CLES_DECLARABLES: readonly CleEligibilite[] = CLES_ELIGIBILITE.filter(
  (c) => c !== 'briefing'
);
