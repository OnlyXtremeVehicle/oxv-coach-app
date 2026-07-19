/**
 * Logique pure de l'écran PRÉPARATION (V2-L2, écran 2/8) — porte REC.
 *
 * Aucune dépendance React ni react-native : testée sous ts-jest/node
 * (src/features/rec/__tests__/preparationLogic.test.ts). Tout ce qui décide
 * (progression de la check-list, mapping des inscrits « Qui roule », gating du
 * convoi, sélection du pass, état du compte à rebours) vit ici pour rester
 * vérifiable ; l'écran se contente de rendre.
 *
 * Doctrine : données réelles câblées (rien de fabriqué), fail-closed sur les
 * flags/consentements, ton OXV (vouvoiement, sans emoji, jamais prescriptif).
 */

// ---------------------------------------------------------------------------
// Check-list de pré-vol — MÊMES items que la v1 (app/(app)/preparation.tsx).
// ---------------------------------------------------------------------------
//
// NOTE HONNÊTE (divergence assumée) : la v1 ne PERSISTE PAS ces coches (état
// local éphémère, cf. commentaire « non persisté » dans preparation.tsx). Il
// n'existe donc AUCUNE clé MMKV v1 à « conserver ». La v2 introduit une vraie
// persistance MMKV (helpers ci-dessous) en gardant STRICTEMENT les mêmes
// libellés d'items : un item fabriqué violerait « données réelles ». Le prompt
// évoque « x/6 » ; la vérité v1 est de 4 items — la barre affiche donc x/4
// (x/N générique), jamais un dénominateur inventé. À valider avec le fondateur.

export const CHECKLIST_ITEMS = [
  'Boîtier OXV chargé',
  'Casque et gants',
  'Licence et papiers du véhicule',
  'Niveaux et pression des pneus',
] as const;

/** Préfixe de la clé MMKV (namespacée par pilote pour un appareil partagé). */
export const CHECKLIST_STORAGE_PREFIX = 'prep:checklist';

/** Clé MMKV de la check-list d'un pilote (`anon` si non connecté). */
export function checklistStorageKey(userId: string | null | undefined): string {
  return `${CHECKLIST_STORAGE_PREFIX}:${userId ?? 'anon'}`;
}

export interface ChecklistProgress {
  done: number;
  total: number;
  /** 0..1 — pour la barre hairline en tête. */
  ratio: number;
}

/** Progression x/N (barre hairline). `total` par défaut = nombre d'items. */
export function checklistProgress(
  checked: readonly boolean[],
  total: number = CHECKLIST_ITEMS.length
): ChecklistProgress {
  const safeTotal = Math.max(0, Math.floor(total));
  const done = checked.slice(0, safeTotal).filter(Boolean).length;
  return { done, total: safeTotal, ratio: safeTotal === 0 ? 0 : done / safeTotal };
}

/** Relit l'état MMKV (JSON boolean[]) en tolérant absence/corruption/longueur. */
export function hydrateChecklist(
  raw: string | null | undefined,
  count: number = CHECKLIST_ITEMS.length
): boolean[] {
  const base: boolean[] = new Array(Math.max(0, count)).fill(false);
  if (!raw) return base;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (let i = 0; i < base.length; i++) base[i] = parsed[i] === true;
    }
  } catch {
    // JSON corrompu → tout décoché (jamais de crash, jamais d'état inventé).
  }
  return base;
}

/** Sérialise pour MMKV (booléens stricts). */
export function serializeChecklist(checked: readonly boolean[]): string {
  return JSON.stringify(checked.map(Boolean));
}

/** Bascule l'item `index` (hors-bornes → copie inchangée). */
export function toggleChecklistAt(checked: readonly boolean[], index: number): boolean[] {
  return checked.map((v, i) => (i === index ? !v : v));
}

// ---------------------------------------------------------------------------
// C1 « Qui roule » — mapping des inscrits opt-in (RPC session_attendance_public)
// ---------------------------------------------------------------------------

/** Ligne brute renvoyée par le RPC (snake_case). Types Supabase pas régénérés. */
export interface AttendanceRow {
  user_id: string;
  public_handle: string | null;
  avatar_url: string | null;
  crew_id: string | null;
}

/** Inscrit opt-in prêt à afficher (avatar + @handle). */
export interface AttendanceMember {
  userId: string;
  handle: string | null;
  avatarUrl: string | null;
  crewId: string | null;
  isSelf: boolean;
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Rows RPC → membres affichables. Défensif (data non typée : `unknown[]`) :
 * rejette les lignes sans user_id exploitable, DÉDUPLIQUE par user_id (le
 * LEFT JOIN crew_members peut dupliquer un pilote multi-écurie — on garde la
 * première occurrence), marque « soi », et trie soi d'abord puis @handle
 * alphabétique (handles nuls en fin).
 */
export function mapAttendanceRows(
  rows: readonly unknown[],
  opts: { selfUserId?: string | null } = {}
): AttendanceMember[] {
  const self = opts.selfUserId ?? null;
  const seen = new Set<string>();
  const out: AttendanceMember[] = [];

  for (const raw of rows) {
    if (typeof raw !== 'object' || raw === null) continue;
    const row = raw as Record<string, unknown>;
    const userId = asString(row.user_id);
    if (userId === null || seen.has(userId)) continue;
    seen.add(userId);
    out.push({
      userId,
      handle: asString(row.public_handle),
      avatarUrl: asString(row.avatar_url),
      crewId: asString(row.crew_id),
      isSelf: userId === self,
    });
  }

  out.sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    if (a.handle === null && b.handle === null) return 0;
    if (a.handle === null) return 1;
    if (b.handle === null) return -1;
    return a.handle.localeCompare(b.handle, 'fr', { sensitivity: 'base' });
  });
  return out;
}

/** Filtre « Mon groupe » : crewId null → tout le monde ; sinon même écurie. */
export function filterByCrew(
  members: readonly AttendanceMember[],
  crewId: string | null
): AttendanceMember[] {
  if (crewId === null) return [...members];
  return members.filter((m) => m.crewId === crewId);
}

// ---------------------------------------------------------------------------
// C2 Convoi — gating fail-closed
// ---------------------------------------------------------------------------

/** Section convoi visible UNIQUEMENT si le flag est vrai (null/undefined → off). */
export function convoyGate(flagEnabled: boolean | null | undefined): boolean {
  return flagEnabled === true;
}

// ---------------------------------------------------------------------------
// Pass OXV — sélection de l'inscription active (mêmes règles que la v1)
// ---------------------------------------------------------------------------

/** Forme minimale attendue (structurellement compatible avec MyRegistration). */
export interface PassCandidate {
  registrationId: string;
  status: string;
  event: { startsAt: string; endsAt: string } | null;
}

/**
 * L'inscription à présenter : événement encore ouvert (fin >= maintenant),
 * statut inscrit/présent, la plus proche dans le temps. `now` en ms epoch.
 */
export function pickActivePass<T extends PassCandidate>(regs: readonly T[], now: number): T | null {
  const eligible = regs.filter(
    (r) =>
      r.event !== null &&
      (r.status === 'registered' || r.status === 'checked_in') &&
      Date.parse(r.event.endsAt) >= now
  );
  eligible.sort((a, b) => Date.parse(a.event!.startsAt) - Date.parse(b.event!.startsAt));
  return eligible[0] ?? null;
}

/** Charge utile du QR de présence — jamais un QR inventé (flux pass-oxv v1). */
export function qrCheckinPayload(registrationId: string): string {
  return `oxv:checkin:${registrationId}`;
}

// ---------------------------------------------------------------------------
// Héros journée — état du compte à rebours
// ---------------------------------------------------------------------------

/** « Samedi 19 juillet » — date de la journée en toutes lettres (patron v1). */
export function longDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return '';
  const txt = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

/** « 09:30:00 » (time Postgres) → « 9 h 30 ». Null si illisible (patron v1). */
export function startTimeLabel(t: string | null | undefined): string | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  return `${parseInt(m[1], 10)} h ${m[2]}`;
}

/** Miroir de miroirHomeLogic.DIAL_COUNTDOWN_MAX_DAYS (cohérence accueil). */
export const COUNTDOWN_MAX_DAYS = 30;

export type HeroCountdownKind = 'today' | 'countdown' | 'none';

/**
 * Décide l'affichage du héros à partir des jours restants (voir
 * daysUntilTrackDay) : 0 (ou passé) → badge « AUJOURD'HUI » ; > 0 → cadran
 * countdown ; null (date illisible) → ni l'un ni l'autre.
 */
export function heroCountdownKind(days: number | null): HeroCountdownKind {
  if (days === null) return 'none';
  if (days <= 0) return 'today';
  return 'countdown';
}
