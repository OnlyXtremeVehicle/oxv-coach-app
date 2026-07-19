/**
 * Logique pure du CLUB HUB (V2-L5, écran 1/7) — sans réseau, testable seule.
 *
 * Cœur doctrinal du lot : le FIL DE FAITS D'ÉCURIE (A3). Un fait d'écurie est
 * « {prénom} a roulé {jour} · {circuit} » — le FAIT d'avoir roulé, JAMAIS un
 * chrono d'autrui, JAMAIS une comparaison de performance. `crewFactFeed`
 * construit ses sorties à partir d'une liste BLANCHE de champs : même si une
 * ligne de présence brute transporte un chrono (bestMs, lapMs…), il est
 * structurellement absent de la sortie. Le test doctrinal le verrouille.
 *
 * Aucune I/O ici : la résolution des membres et de leurs présences vit dans
 * `useClubHub`. Ce module ne fait que trier, dédupliquer, formater — en FR
 * vouvoyé, sans emoji, sans jamais fabriquer une valeur.
 */

// ---------------------------------------------------------------------------
// Format de dates — locale-free et déterministe (environnement de test node).
// ---------------------------------------------------------------------------

const FR_WEEKDAYS = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
] as const;

const FR_DAY_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'] as const;

const FR_MONTH_ABBR = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
] as const;

/** Décompose 'YYYY-MM-DD' (ou ISO complet) en {y, m0, d} UTC, ou null. */
function parseDay(dayIso: string): { y: number; m0: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dayIso);
  if (!m) return null;
  const y = Number(m[1]);
  const m0 = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(m0) || !Number.isFinite(d)) return null;
  if (m0 < 0 || m0 > 11 || d < 1 || d > 31) return null;
  return { y, m0, d };
}

/** Jour de semaine FR (« jeudi ») d'une date 'YYYY-MM-DD', ou null si invalide. */
export function frenchWeekday(dayIso: string): string | null {
  const p = parseDay(dayIso);
  if (p === null) return null;
  const dt = new Date(Date.UTC(p.y, p.m0, p.d));
  if (Number.isNaN(dt.getTime())) return null;
  return FR_WEEKDAYS[dt.getUTCDay()] ?? null;
}

/** Nombre de jours entiers séparant deux dates 'YYYY-MM-DD' (b - a), ou null. */
function dayDiff(aIso: string, bIso: string): number | null {
  const a = parseDay(aIso);
  const b = parseDay(bIso);
  if (a === null || b === null) return null;
  const ta = Date.UTC(a.y, a.m0, a.d);
  const tb = Date.UTC(b.y, b.m0, b.d);
  return Math.round((tb - ta) / 86_400_000);
}

/**
 * Étiquette de jour RELATIVE, factuelle et sobre :
 *   0 → « aujourd'hui », 1 → « hier », 2-6 → jour de semaine (« jeudi »),
 *   au-delà → date courte (« le 12 juil. »). Locale-free.
 */
export function relativeDayLabel(dayIso: string, nowIso: string): string | null {
  const p = parseDay(dayIso);
  if (p === null) return null;
  const diff = dayDiff(dayIso, nowIso);
  if (diff !== null && diff >= 0 && diff <= 6) {
    if (diff === 0) return "aujourd'hui";
    if (diff === 1) return 'hier';
    return frenchWeekday(dayIso);
  }
  // Trop ancien (ou futur) : date courte, sans ambiguïté de semaine.
  return `le ${p.d} ${FR_MONTH_ABBR[p.m0] ?? ''}`.trim();
}

/** « sam. 19 juil. » — date courte d'une journée à venir. */
export function shortDayLabel(dayIso: string): string | null {
  const p = parseDay(dayIso);
  if (p === null) return null;
  const dt = new Date(Date.UTC(p.y, p.m0, p.d));
  if (Number.isNaN(dt.getTime())) return null;
  const wd = FR_DAY_SHORT[dt.getUTCDay()] ?? '';
  return `${wd} ${p.d} ${FR_MONTH_ABBR[p.m0] ?? ''}`.trim();
}

// ---------------------------------------------------------------------------
// Fil de faits d'écurie (A3) — DOCTRINE : le fait de rouler, jamais le chrono.
// ---------------------------------------------------------------------------

/** Un membre d'écurie prêt à afficher (résolu depuis crew + canaux opt-in). */
export interface CrewMemberProfile {
  userId: string;
  firstName: string | null;
  /** Handle public sans le « @ ». */
  handle: string | null;
  avatarUrl: string | null;
  /** Rôle serveur : 'captain' | 'member'. */
  role: string;
}

/**
 * Présence brute d'un membre à une journée PASSÉE (canal opt-in `show_attendance`).
 * N'accepte QUE le fait (qui, quand, où) : aucun champ de performance. La sortie
 * `CrewFact` est de toute façon construite par liste blanche — une clé chrono
 * ajoutée à un objet brut ne peut pas traverser.
 */
export interface RawCrewAttendance {
  userId: string;
  /** Date 'YYYY-MM-DD' de la journée passée. */
  dayIso: string;
  circuitName: string | null;
}

/** Un fait d'écurie affichable. AUCUN champ de chrono/temps/vitesse (doctrine). */
export interface CrewFact {
  userId: string;
  displayName: string;
  /** « jeudi » / « hier » / « le 12 juil. ». */
  dayLabel: string;
  circuitName: string | null;
  /** Date brute (pour tri/clé uniquement, jamais un temps de tour). */
  dayIso: string;
}

/**
 * Nom d'affichage d'un membre : prénom, sinon @handle, sinon « Un pilote ».
 * Jamais le nom complet (RGPD, aligné sur le canal `session_attendance_public`).
 */
export function memberDisplayName(profile: CrewMemberProfile): string {
  const first = profile.firstName?.trim();
  if (first) return first;
  const handle = profile.handle?.trim().replace(/^@+/, '');
  if (handle) return `@${handle}`;
  return 'Un pilote';
}

/** Le capitaine de l'écurie, ou null. */
export function crewCaptain(members: readonly CrewMemberProfile[]): CrewMemberProfile | null {
  return members.find((m) => m.role === 'captain') ?? null;
}

/** Nom d'affichage du capitaine (pour « Le groupe de {owner} »), ou null. */
export function crewOwnerName(members: readonly CrewMemberProfile[]): string | null {
  const captain = crewCaptain(members);
  if (captain === null) return null;
  const name = memberDisplayName(captain);
  return name === 'Un pilote' ? null : name;
}

/**
 * Titre de la carte écurie, dans l'ordre de vérité :
 *   1. le nom donné à l'écurie (`oxv_name_my_crew`) s'il existe ;
 *   2. « Le groupe de {capitaine} » si le capitaine est résolu ;
 *   3. « Votre écurie » (repli neutre, jamais inventé).
 */
export function crewCardTitle(crewName: string | null, ownerName: string | null): string {
  const named = crewName?.trim();
  if (named) return named;
  if (ownerName) return `Le groupe de ${ownerName}`;
  return 'Votre écurie';
}

export interface CrewFactFeedOptions {
  /** « Maintenant » en 'YYYY-MM-DD' — injecté pour un test déterministe. */
  nowIso: string;
  /** Nombre maximum de faits retournés (défaut 5). */
  limit?: number;
}

/**
 * Construit le fil de faits d'écurie. DOCTRINE :
 *  - une sortie n'est produite QUE pour un membre connu de l'écurie ;
 *  - chaque fait est assemblé par LISTE BLANCHE (userId, displayName, dayLabel,
 *    circuitName, dayIso) — aucun champ de performance ne peut traverser ;
 *  - un seul fait par membre (le plus récent), fil trié du plus récent au plus
 *    ancien, borné à `limit`.
 */
export function crewFactFeed(
  members: readonly CrewMemberProfile[],
  attendance: readonly RawCrewAttendance[],
  opts: CrewFactFeedOptions
): CrewFact[] {
  const limit = opts.limit ?? 5;
  const byId = new Map<string, CrewMemberProfile>();
  for (const m of members) byId.set(m.userId, m);

  // Un seul fait par membre : on garde la présence la plus récente.
  const latestByMember = new Map<string, RawCrewAttendance>();
  for (const row of attendance) {
    const member = byId.get(row.userId);
    if (member === undefined) continue; // fait d'un non-membre : ignoré
    if (parseDay(row.dayIso) === null) continue; // date illisible : ignorée
    const current = latestByMember.get(row.userId);
    if (current === undefined || row.dayIso > current.dayIso) {
      latestByMember.set(row.userId, row);
    }
  }

  const facts: CrewFact[] = [];
  for (const [userId, row] of latestByMember) {
    const member = byId.get(userId);
    if (member === undefined) continue;
    const dayLabel = relativeDayLabel(row.dayIso, opts.nowIso);
    if (dayLabel === null) continue;
    // Construction par liste blanche : aucune clé étrangère ne survit.
    facts.push({
      userId,
      displayName: memberDisplayName(member),
      dayLabel,
      circuitName: row.circuitName?.trim() ? row.circuitName.trim() : null,
      dayIso: row.dayIso,
    });
  }

  facts.sort((a, b) => (a.dayIso < b.dayIso ? 1 : a.dayIso > b.dayIso ? -1 : 0));
  return facts.slice(0, Math.max(0, limit));
}

/**
 * Rend un fait en une ligne factuelle : « Marie a roulé jeudi · Haute Saintonge »
 * (le circuit est omis s'il est inconnu). AUCUN chrono, jamais.
 */
export function crewFactLine(fact: CrewFact): string {
  const base = `${fact.displayName} a roulé ${fact.dayLabel}`;
  return fact.circuitName ? `${base} · ${fact.circuitName}` : base;
}

// ---------------------------------------------------------------------------
// Bloc « Mon coaching » du hub — formatage sobre (aucune donnée inventée).
// ---------------------------------------------------------------------------

/** « sam. 19 juil. · 09:00 » — prochaine réservation (heure omise si absente). */
export function bookingWhenLabel(startsAtIso: string | null): string | null {
  if (startsAtIso === null) return null;
  const day = shortDayLabel(startsAtIso);
  if (day === null) return null;
  const t = /T(\d{2}):(\d{2})/.exec(startsAtIso);
  return t ? `${day} · ${t[1]}:${t[2]}` : day;
}

/** Aperçu d'un dernier message : coupé proprement, jamais reformulé. */
export function messagePreview(body: string | null, max = 72): string | null {
  const v = body?.trim();
  if (!v) return null;
  if (v.length <= max) return v;
  return `${v.slice(0, max - 1).trimEnd()}…`;
}
