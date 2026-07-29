/**
 * La file des créneaux à valider — logique PURE. Jalon 6, préalable.
 *
 * ---
 *
 * POURQUOI CETTE FILE EXISTE
 *
 * Depuis le 29/07, un créneau proposé par un coach entre en
 * `pending_validation` au lieu d'être rabattu sur `closed` (migration
 * `20260729034324`). L'état se nomme honnêtement.
 *
 * Mais il n'avait **aucune sortie** : personne ne pouvait valider un créneau
 * depuis l'application, et l'attente était sans fin. Un état sans sortie est
 * pire qu'un mensonge franc — il donne l'apparence d'un processus.
 *
 * ---
 *
 * UNE SEULE MARQUE, SUR LE PLUS ANCIEN
 *
 * *« Liseré rouge sur une seule séance, la plus ancienne en attente : une file
 * où tout est urgent n'est plus une file. »* — plan de montage, jalon 6.
 *
 * La règle s'applique ici. Marquer chaque ligne en attente ne hiérarchise rien
 * et fatigue l'œil ; marquer la plus ancienne dit où commencer.
 *
 * ---
 *
 * L'ORDRE EST CELUI DE L'ATTENTE, PAS CELUI DE LA SÉANCE
 *
 * On trie par date de PROPOSITION, pas par date du créneau. Un coach qui a
 * proposé il y a trois jours attend depuis trois jours, que sa séance soit
 * demain ou dans six mois. Trier par date de séance ferait passer les urgences
 * du calendrier avant les gens.
 */

/** Un créneau en attente, réduit à ce que la file consomme. */
export interface CreneauEnAttente {
  id: string;
  coachId: string;
  /** Nom affichable du coach, s'il a une fiche. `null` sinon. */
  coachNom: string | null;
  circuitName: string;
  /** Début du créneau, ISO. */
  startsAt: string;
  endsAt: string | null;
  capacity: number;
  notes: string | null;
  /** Date de PROPOSITION, ISO — c'est elle qui ordonne la file. */
  createdAt: string;
}

/** Une ligne prête à afficher. */
export interface LigneFile {
  creneau: CreneauEnAttente;
  /**
   * Cette ligne porte-t-elle la marque ?
   *
   * Vrai pour UNE seule ligne : la plus anciennement proposée. Une file où
   * tout est marqué ne hiérarchise plus rien.
   */
  marquee: boolean;
  /** Depuis combien de jours pleins ce créneau attend. */
  joursDAttente: number;
}

/** Millisecondes dans un jour. */
const JOUR_MS = 86_400_000;

/**
 * Jours pleins écoulés depuis la proposition.
 *
 * `maintenant` est passé explicitement : une fonction pure ne lit pas l'heure.
 * Rend `0` plutôt qu'un négatif si l'horodatage est dans le futur — une
 * horloge d'appareil peut avancer, et « il attend depuis −2 jours » n'informe
 * personne.
 */
export function joursDAttente(createdAtIso: string, maintenantMs: number): number {
  const t = new Date(createdAtIso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((maintenantMs - t) / JOUR_MS));
}

/**
 * La file, ordonnée et marquée.
 *
 * Les horodatages illisibles ne sont pas écartés — un créneau existe même si sa
 * date de proposition est abîmée, et le taire le rendrait invalidable. Ils
 * passent en fin de file, là où ils ne masquent rien.
 */
export function construitFile(
  creneaux: readonly CreneauEnAttente[],
  maintenantMs: number
): LigneFile[] {
  const avecCle = creneaux.map((c) => {
    const t = new Date(c.createdAt).getTime();
    return { c, t: Number.isFinite(t) ? t : Number.POSITIVE_INFINITY };
  });
  avecCle.sort((a, b) => a.t - b.t);

  // La marque va au premier dont l'horodatage est lisible. Marquer un créneau
  // à date illisible dirait « commencez par celui-ci » sans savoir pourquoi.
  const indexMarque = avecCle.findIndex((x) => Number.isFinite(x.t));

  return avecCle.map((x, i) => ({
    creneau: x.c,
    marquee: i === indexMarque,
    joursDAttente: joursDAttente(x.c.createdAt, maintenantMs),
  }));
}

/** « Depuis 3 jours », « aujourd'hui ». Un fait, jamais un reproche. */
export function libelleAttente(jours: number): string {
  if (jours <= 0) return 'Proposé aujourd’hui';
  if (jours === 1) return 'En attente depuis hier';
  return `En attente depuis ${jours} jours`;
}

/** Nom du coach tel qu'il s'affiche, sans jamais inventer une identité. */
export function libelleCoach(c: CreneauEnAttente): string {
  const nom = c.coachNom?.trim();
  if (nom) return nom;
  // Pas de fiche publiée : on montre l'identifiant tronqué plutôt qu'un nom
  // fabriqué. L'administrateur peut le retrouver, un faux nom ne se retrouve pas.
  return `Coach ${c.coachId.slice(0, 8)}…`;
}
