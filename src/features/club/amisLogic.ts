/**
 * Logique pure — onglet AMIS de la porte CLUB (lot V2-L5, Mission B).
 *
 * DOCTRINE SOCIALE ABSOLUE (le cœur de ce module) : le fil d'amis montre le
 * FAIT de rouler — le DERNIER CIRCUIT d'un ami — JAMAIS un chrono d'autrui,
 * JAMAIS un classement, JAMAIS une comparaison de performance. La fonction
 * `toFriendFacts` DÉPOUILLE volontairement toute donnée chronométrique
 * (meilleur tour, vitesse, marge) : elle ne laisse passer que le nom de
 * circuit et la date. Un test jest verrouille cette garantie.
 *
 * Le badge « groupe » s'allume pour les amis de la même écurie
 * (`referralService.getMyCrew`) — appartenance partagée, pas performance.
 *
 * Aucune I/O ici : module .ts pur, testable sous jest node.
 */

// ---------------------------------------------------------------------------
// Fait de séance dépouillé — le SEUL matériau autorisé dans le fil d'amis
// ---------------------------------------------------------------------------

/**
 * Entrée brute possible d'une séance d'ami (telle que la renvoie le service
 * de lecture inter-amis). Les champs chronométriques y sont présents mais
 * ne DOIVENT jamais atteindre l'UI — d'où le dépouillement ci-dessous.
 */
export interface FriendSessionInput {
  circuitName: string | null;
  startedAt: string;
  /** Champs chrono TOLÉRÉS en entrée, JAMAIS ressortis (doctrine). */
  bestLapSeconds?: number | null;
  maxSpeedKmh?: number | null;
  marginGlobal?: number | null;
}

/** Fait de séance affichable : le circuit et la date, RIEN de chronométrique. */
export interface FriendSessionFact {
  circuitName: string | null;
  startedAt: string;
}

/**
 * Dépouille les séances d'un ami en FAITS affichables : uniquement le circuit
 * et la date. Toute donnée chronométrique (chrono, vitesse, marge) est
 * ÉCARTÉE — c'est la garantie doctrinale « pas de chrono d'autrui dans le
 * fil ». Ne jamais élargir la sortie à un champ de performance.
 */
export function toFriendFacts(rows: readonly FriendSessionInput[]): FriendSessionFact[] {
  return rows.map((r) => ({ circuitName: r.circuitName, startedAt: r.startedAt }));
}

/** Dernier circuit factuel d'un ami : circuit + date de la séance la plus récente. */
export interface FriendLastCircuit {
  circuitLabel: string | null;
  dateISO: string | null;
}

/**
 * Dernier circuit FACTUEL : la séance la plus récente PORTANT un nom de
 * circuit. Si aucune séance n'a de circuit nommé, `circuitLabel` reste null
 * (jamais un libellé fabriqué). La date renvoyée est celle de cette séance.
 */
export function friendLastCircuit(facts: readonly FriendSessionFact[]): FriendLastCircuit {
  let best: FriendSessionFact | null = null;
  for (const f of facts) {
    const c = (f.circuitName ?? '').trim();
    if (!c) continue;
    if (best === null || Date.parse(f.startedAt) > Date.parse(best.startedAt)) best = f;
  }
  if (best === null) return { circuitLabel: null, dateISO: null };
  return { circuitLabel: (best.circuitName ?? '').trim() || null, dateISO: best.startedAt };
}

// ---------------------------------------------------------------------------
// Identité affichable d'un ami
// ---------------------------------------------------------------------------

/** Champs d'identité minimaux d'un ami (le hook mappe la ligne d'amitié). */
export interface FriendIdentity {
  friendId: string;
  friendHandle: string | null;
  friendFirstName: string | null;
}

/** Initiales d'avatar depuis le @handle réel (« thomas.m » → TM), repli prénom. */
export function friendInitials(id: FriendIdentity): string {
  const source = id.friendHandle ?? id.friendFirstName ?? '';
  const letters = source
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
  return letters || '—';
}

/** Nom affiché d'un ami : prénom réel, repli @handle, repli identifiant court. */
export function friendDisplayName(id: FriendIdentity): string {
  return id.friendFirstName ?? id.friendHandle ?? `Pilote ${id.friendId.slice(0, 6)}`;
}

/**
 * Ligne méta mono sous le nom : « @handle · {dernier circuit} ». Chaque
 * segment trace vers un fait réel ; JAMAIS un chrono. Vide si rien ne la
 * porte (l'écran affiche alors « — » / rien).
 */
export function friendMetaLine(handle: string | null, lastCircuit: string | null): string {
  return [handle ? `@${handle}` : null, lastCircuit]
    .filter((p): p is string => Boolean(p))
    .join(' · ');
}

// ---------------------------------------------------------------------------
// Écurie (crew) — badge « groupe »
// ---------------------------------------------------------------------------

/** Membre d'écurie minimal (forme de `referralService.MyCrew.members`). */
export interface CrewMember {
  userId: string;
}

/** Écurie minimale, ou null si le pilote n'appartient à aucune. */
export interface CrewRef {
  members: CrewMember[];
}

/** Ensemble des identifiants membres de mon écurie (vide si pas d'écurie). */
export function crewMemberIds(crew: CrewRef | null): Set<string> {
  if (crew === null) return new Set();
  return new Set(crew.members.map((m) => m.userId));
}

/** Vrai si l'ami appartient à mon écurie (badge « groupe »). */
export function isInCrew(friendId: string, memberIds: ReadonlySet<string>): boolean {
  return memberIds.has(friendId);
}

// ---------------------------------------------------------------------------
// Recherche @handle
// ---------------------------------------------------------------------------

/** Normalise une saisie @handle : retire l'arobase de tête, borne la casse. */
export function normalizeHandleQuery(raw: string): string {
  return raw.trim().replace(/^@+/, '');
}

/** La saisie est-elle assez longue pour lancer une recherche live ? */
export function isSearchable(raw: string): boolean {
  return normalizeHandleQuery(raw).length >= 2;
}
