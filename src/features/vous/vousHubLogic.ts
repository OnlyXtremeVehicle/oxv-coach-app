/**
 * vousHubLogic — logique PURE de la porte VOUS (lot V2-L4, écran 1/8, Mission A).
 *
 * Module .ts strictement pur : aucune dépendance React, React Native ou
 * Supabase — testé sous ts-jest node (__tests__/vousHubLogic.test.ts). Le hook
 * (useVousHub) fait les lectures ; ici, uniquement les décisions.
 *
 * Règle fondatrice « données réelles câblées » : chaque fonction rend null / 0
 * / un segment absent quand la donnée manque — jamais une valeur plausible
 * inventée. La ligne d'identité n'affiche un chiffre que s'il TRACE vers une
 * source réelle (palier d'inscription, records par circuit, km parcourus).
 *
 * Réutilise le lexique décisionnel du Miroir (heritageOf, RegistrationRef) —
 * même règle de tier que getQdiAccessLevel, jamais une seconde source de
 * vérité pour l'appartenance Heritage.
 */

import {
  heritageOf,
  type HeritageTier,
  type RegistrationRef,
} from '@/features/miroir/miroirHomeLogic';
import type { FounderApplicationStatus } from '@/services/v2/founderLogic';

// Ré-export pour le hook et l'écran : une seule porte vers la règle Heritage.
export { heritageOf };
export type { HeritageTier, RegistrationRef };

// ---------------------------------------------------------------------------
// Palier — offre de l'inscription EFFECTIVE la plus récente (patron passeport
// v1 / getQdiAccessLevel). Une Signature annulée ne donne pas le palier à vie.
// ---------------------------------------------------------------------------

/** Statuts d'inscription EFFECTIFS — même ensemble que heritageOf / passeport. */
const ACTIVE_REG_STATUSES = new Set(['confirmed', 'attended', 'pending_payment', 'pending']);

/** Libellés d'affichage des offres réelles (enum offer_type_enum). */
const OFFER_LABELS: Record<string, string> = {
  access: 'Access',
  signature: 'Signature',
  promotion: 'Promotion',
  heritage: 'Heritage',
};

/**
 * Palier RÉEL : libellé de l'offre de l'inscription effective la plus récente
 * (rows triées created_at DESC — contrat de l'appelant). Hors parcours
 * commercial → null (segment de palier masqué, jamais un palier inventé).
 */
export function currentOfferLabel(rows: readonly RegistrationRef[]): string | null {
  const current = rows.find((r) => ACTIVE_REG_STATUSES.has(String(r.status)));
  if (current === undefined || current.offer_type === null) return null;
  const key = String(current.offer_type).toLowerCase();
  return OFFER_LABELS[key] ?? current.offer_type;
}

// ---------------------------------------------------------------------------
// Records — nombre de circuits où le pilote détient un meilleur temps réel
// (self-only : « ses » records, aucun classement, aucun autre pilote).
// ---------------------------------------------------------------------------

/** Clé du bucket « séance sans circuit » de statsService — exclue des records. */
export const NO_CIRCUIT_KEY = 'Inconnu';

/** Sous-ensemble structurel d'un agrégat circuit (statsService.CircuitAggregate). */
export interface CircuitRecordRef {
  circuitName: string;
  bestLapSeconds: number | null;
}

/**
 * Nombre de records personnels : circuits (hors « Inconnu ») pour lesquels un
 * meilleur tour RÉEL existe. Aucun circuit chronométré → 0 (segment masqué à
 * l'écran, jamais un « 0 records » fabriqué sur données absentes).
 */
export function recordsCount(byCircuit: Record<string, CircuitRecordRef>): number {
  let n = 0;
  for (const c of Object.values(byCircuit)) {
    if (
      c.circuitName !== NO_CIRCUIT_KEY &&
      c.bestLapSeconds !== null &&
      Number.isFinite(c.bestLapSeconds)
    ) {
      n += 1;
    }
  }
  return n;
}

// ---------------------------------------------------------------------------
// Ligne d'identité — « {palier} · {n} records · {km} km », segments présents
// uniquement. Aucune donnée traçable → null (ligne masquée).
// ---------------------------------------------------------------------------

/**
 * Assemble la ligne de stats mono du héros passeport. Chaque segment n'apparaît
 * que s'il trace vers une source réelle : palier d'inscription présent, records
 * strictement positifs, km strictement positifs. Tout absent → null.
 * Ex. « Heritage · 3 records · 412 km ».
 */
export function statsLine(palier: string | null, records: number, km: number): string | null {
  const parts: string[] = [];
  if (palier !== null && palier.trim().length > 0) parts.push(palier.trim());
  if (Number.isFinite(records) && records > 0) {
    parts.push(`${records} ${records > 1 ? 'records' : 'record'}`);
  }
  if (Number.isFinite(km) && km > 0) parts.push(`${Math.round(km)} km`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

// ---------------------------------------------------------------------------
// Identité affichée — nom, handle (patrons passeport / profil v1).
// ---------------------------------------------------------------------------

/** Nom affiché : « Prénom Nom » compacté, repli « Pilote » (patron passeport v1). */
export function pilotDisplayName(first: string | null, last: string | null): string {
  const name = [first, last]
    .map((part) => (part ?? '').trim())
    .filter((part) => part.length > 0)
    .join(' ');
  return name.length > 0 ? name : 'Pilote';
}

/** « @handle » depuis le public_handle réel, ou null si absent (jamais inventé). */
export function handleLabel(handle: string | null): string | null {
  const h = (handle ?? '').trim();
  if (h.length === 0) return null;
  return h.startsWith('@') ? h : `@${h}`;
}

// ---------------------------------------------------------------------------
// A2 — carte Membre Fondateur : état de la carte (flag fail-closed).
// ---------------------------------------------------------------------------

/**
 * État de la carte fondateur du hub :
 *   - `absent`     : flag OFF (fail-closed) — la carte n'est PAS rendue ; ou
 *                    candidature refusée (pas de dead-end de re-candidature :
 *                    l'unicité serveur la bloquerait) — la carte disparaît ;
 *   - `candidater` : aucune candidature — CTA vers le formulaire ;
 *   - `pending`    : candidature en cours d'examen ;
 *   - `approved`   : candidature retenue — badge fondateur.
 */
export type FounderCardState = 'absent' | 'candidater' | 'pending' | 'approved';

/** Décide l'état de la carte fondateur (flag fail-closed + statut candidature). */
export function founderCardState(
  flagOn: boolean,
  application: { status: FounderApplicationStatus } | null
): FounderCardState {
  if (!flagOn) return 'absent';
  if (application === null) return 'candidater';
  switch (application.status) {
    case 'approved':
      return 'approved';
    case 'pending':
      return 'pending';
    case 'declined':
      // Refusée : la carte disparaît (aucune re-candidature — l'insert unique
      // par user échouerait). Doctrine : on ne propose pas un geste voué à
      // l'échec, on ne fabrique pas non plus un statut affiché.
      return 'absent';
    default:
      // Statut inattendu venu de la base : repli prudent sur « en examen ».
      return 'pending';
  }
}

// ---------------------------------------------------------------------------
// A2 — jauge « x/30 » (30 membres, jamais plus). Compteur borné, jamais un
// total codé en dur : `max` par défaut à 30 (décision fondateur).
// ---------------------------------------------------------------------------

/** Plafond des Membres Fondateurs (décision fondateur 18/07 : « jamais plus »). */
export const FOUNDERS_MAX = 30;

export interface FoundersGauge {
  /** Places prises (bornées à [0, max]). */
  filled: number;
  /** Places restantes (max − filled, jamais négatif). */
  remaining: number;
}

/**
 * Jauge des places fondateur depuis le compteur serveur. `count` non fini ou
 * négatif → 0 place prise (jamais une jauge inventée) ; un compteur au-delà du
 * plafond est écrêté (la jauge ne déborde pas, « restantes » reste ≥ 0).
 */
export function foundersGauge(count: number, max: number = FOUNDERS_MAX): FoundersGauge {
  const cap = Number.isFinite(max) && max > 0 ? Math.floor(max) : FOUNDERS_MAX;
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const filled = Math.min(safe, cap);
  return { filled, remaining: cap - filled };
}

// ---------------------------------------------------------------------------
// A3 — code parrain : message de partage sobre.
// ---------------------------------------------------------------------------

/** Message de partage natif du code de parrainage. Sobre, vouvoyé, sans emoji. */
export function shareMessage(code: string): string {
  return `Rejoignez-moi sur OXV — ${code.trim()}`;
}

// ---------------------------------------------------------------------------
// A3 — ligne « mon groupe » (écurie). Vocabulaire aligné sur referralLogic
// (« écurie »). Le nom du capitaine n'est pas exposé par le service
// (crew_members ne porte que user_id) : on affiche le NOM de l'écurie, jamais
// un nom de capitaine reconstruit.
// ---------------------------------------------------------------------------

export interface CrewRowRef {
  name: string | null;
  members: readonly { userId: string; role: string }[];
}

export interface CrewRowLabel {
  label: string;
  sublabel: string;
}

/**
 * Libellé de la ligne « mon groupe » : nom de l'écurie si nommée, sinon
 * « Votre écurie » ; sous-libellé = nombre de membres réel (accord singulier /
 * pluriel).
 */
export function crewRowLabel(crew: CrewRowRef): CrewRowLabel {
  const n = crew.members.length;
  const name = (crew.name ?? '').trim();
  return {
    label: name.length > 0 ? `Écurie ${name}` : 'Votre écurie',
    sublabel: `${n} membre${n > 1 ? 's' : ''}`,
  };
}
