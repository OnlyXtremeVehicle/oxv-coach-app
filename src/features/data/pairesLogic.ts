/**
 * La paire circuit-véhicule — logique PURE, partagée par la Signature, la
 * Saison et la comparaison.
 *
 * ===========================================================================
 * CE QUE LE PLAN DEMANDE, ET POURQUOI DEUX FILTRES NE LE FONT PAS
 * ===========================================================================
 *
 * *« Filtre par paire réellement roulée, jamais deux filtres indépendants. »*
 * *« Le filtre par paire s'applique, sinon la comparaison ment. »*
 *
 * Deux menus séparés — un pour le circuit, un pour le véhicule — offrent le
 * PRODUIT de ce que le pilote a roulé, pas ce qu'il a roulé. Trois circuits et
 * deux voitures donnent six choix ; quatre d'entre eux peuvent n'avoir jamais
 * eu lieu. Le pilote sélectionne alors une combinaison sans séance, l'écran
 * répond « aucune donnée », et il lui reste à deviner si c'est un défaut de
 * l'application ou un fait sur sa saison.
 *
 * Ici les paires sont DÉRIVÉES des séances. Une paire existe parce qu'elle a
 * été roulée, et son effectif est celui des séances qui la composent. Aucune
 * combinaison ne peut être choisie sans données, parce qu'aucune n'est
 * proposée sans données.
 *
 * ===========================================================================
 * LA PAIRE INCOMPLÈTE
 * ===========================================================================
 *
 * Une séance sans véhicule est le cas ORDINAIRE de tout ce qui a été capturé
 * avant le 12/08/2026 — l'écran d'armement n'attachait aucun véhicule, et les
 * dix séances de production portent `vehicle_id = null`. Les jeter du
 * sélecteur ferait disparaître l'historique entier ; leur inventer un véhicule
 * serait pire.
 *
 * Elles forment donc leurs propres paires, dites INCOMPLÈTES, et se
 * regroupent par circuit. Le libellé le dit — « Véhicule non renseigné » — au
 * lieu de laisser croire à une voiture qu'on n'a pas su nommer.
 *
 * ===========================================================================
 * CE QUE CE MODULE NE FAIT PAS
 * ===========================================================================
 *
 * Il ne classe pas les paires par performance, et n'en désigne aucune comme
 * meilleure. L'ordre est celui de l'usage — la paire la plus roulée d'abord —
 * parce qu'un sélecteur se lit du plus probable au moins probable, jamais
 * parce qu'elle vaudrait mieux.
 */

/** Ce que ce module a besoin de savoir d'une séance. */
export interface SeanceAppariable {
  circuitId: string | null;
  circuitName: string | null;
  vehicleId: string | null;
}

/** Une paire réellement roulée. */
export interface Paire {
  /** Clé stable, utilisable en `key` de liste et en état de sélection. */
  cle: string;
  circuitId: string | null;
  vehicleId: string | null;
  /** Libellé affichable, déjà résolu. */
  libelle: string;
  /** Nombre de séances qui composent la paire. Toujours ≥ 1. */
  seances: number;
  /** La paire n'a pas de véhicule — historique d'avant l'attache. */
  incomplete: boolean;
}

/** La clé de la moyenne générale — aucune paire, toutes les séances. */
export const CLE_GENERALE = 'generale';

/** Ce qu'on affiche d'un véhicule quand la séance n'en porte aucun. */
export const VEHICULE_ABSENT = 'Véhicule non renseigné';

/** Ce qu'on affiche d'un circuit que la séance ne nomme pas. */
export const CIRCUIT_ABSENT = 'Circuit non renseigné';

function cleDe(circuitId: string | null, vehicleId: string | null): string {
  return `${circuitId ?? '—'}::${vehicleId ?? '—'}`;
}

/**
 * Les paires réellement roulées, la plus fréquente d'abord.
 *
 * `nomVehicule` résout un identifiant de véhicule en libellé ; il rend `null`
 * pour un véhicule absent du garage — vendu, retiré — et le libellé le dit
 * plutôt que d'afficher un UUID.
 */
export function pairesRoulees(
  seances: readonly SeanceAppariable[],
  nomVehicule: (id: string) => string | null
): Paire[] {
  const parCle = new Map<string, Paire>();

  for (const s of seances) {
    const cle = cleDe(s.circuitId, s.vehicleId);
    const existante = parCle.get(cle);
    if (existante) {
      existante.seances += 1;
      continue;
    }

    const circuit = s.circuitName?.trim() ? s.circuitName.trim() : CIRCUIT_ABSENT;
    const vehicule =
      s.vehicleId === null
        ? VEHICULE_ABSENT
        : // Un véhicule retiré du garage a bien roulé : on ne masque pas la
          // paire, on nomme ce qu'on peut en dire.
          (nomVehicule(s.vehicleId) ?? 'Véhicule retiré du garage');

    parCle.set(cle, {
      cle,
      circuitId: s.circuitId,
      vehicleId: s.vehicleId,
      libelle: `${circuit} · ${vehicule}`,
      seances: 1,
      incomplete: s.vehicleId === null,
    });
  }

  // Ordre d'usage : la plus roulée d'abord, puis alphabétique à effectif égal
  // pour que la liste ne bouge pas d'un chargement à l'autre.
  return [...parCle.values()].sort(
    (a, b) => b.seances - a.seances || a.libelle.localeCompare(b.libelle, 'fr')
  );
}

/**
 * Les séances d'une sélection.
 *
 * `CLE_GENERALE` (ou une clé inconnue) rend TOUTES les séances : le défaut de
 * la Signature est la moyenne générale, et une clé périmée — un véhicule
 * supprimé entre deux chargements — ne doit pas produire un écran vide.
 */
export function seancesDeLaPaire<T extends SeanceAppariable>(
  seances: readonly T[],
  cle: string
): T[] {
  if (cle === CLE_GENERALE) return [...seances];
  const connue = seances.some((s) => cleDe(s.circuitId, s.vehicleId) === cle);
  if (!connue) return [...seances];
  return seances.filter((s) => cleDe(s.circuitId, s.vehicleId) === cle);
}

/**
 * La ligne qui dit toujours ce que l'écran montre.
 *
 * *« Une ligne sous le radar dit toujours ce qu'il montre : "Signature
 * générale · 11 séances" ou "Haute Saintonge · 911 GT3 · 4 séances". »*
 *
 * Elle n'est jamais absente et ne dit jamais zéro : sans séance, elle rend
 * `null` et l'écran affiche son état vide, qui est un autre objet.
 */
export function libelleSelection(paires: readonly Paire[], cle: string): string | null {
  if (cle === CLE_GENERALE) {
    const total = paires.reduce((s, p) => s + p.seances, 0);
    if (total === 0) return null;
    return `Signature générale · ${total} ${total > 1 ? 'séances' : 'séance'}`;
  }
  const p = paires.find((x) => x.cle === cle);
  if (!p) return null;
  return `${p.libelle} · ${p.seances} ${p.seances > 1 ? 'séances' : 'séance'}`;
}

/**
 * Le sélecteur mérite-t-il d'être affiché ?
 *
 * UNE SEULE PAIRE NE SE FILTRE PAS. Proposer « général » et « Haute Saintonge
 * · 911 » à un pilote qui n'a roulé que cela, c'est offrir un choix dont les
 * deux branches donnent le même écran.
 */
export function selecteurUtile(paires: readonly Paire[]): boolean {
  return paires.length > 1;
}
