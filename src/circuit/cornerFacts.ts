/**
 * Faits d'un virage (panneau de détail au tap, specs v4 §05 §2).
 *
 * Assemble les faits BRUTS d'un virage à partir des insights de session — aucun
 * conseil, aucun verdict (doctrine Mirror : on montre ce qui EST). Logique pure,
 * testable. N'inclut que les faits réellement présents (état vide honnête).
 */

import type { SessionInsights } from './sessionInsights';

export interface CornerFact {
  label: string;
  value: string;
}

function fmt(n: number, digits = 0): string {
  return n.toFixed(digits).replace('.', ',');
}

export function cornerFacts(session: SessionInsights | null, cornerIndex: number): CornerFact[] {
  if (!session) return [];
  const facts: CornerFact[] = [];

  const a = session.anatomy?.find((x) => x.corner_index === cornerIndex);
  if (a) {
    facts.push({ label: "Vitesse d'apex", value: `${fmt(a.apex_speed_kmh)} km/h` });
    if (a.brake_dist_m > 0) facts.push({ label: 'Freinage', value: `${fmt(a.brake_dist_m)} m` });
    if (a.accel_dist_m > 0) {
      facts.push({ label: 'Réaccélération', value: `${fmt(a.accel_dist_m)} m` });
    }
    facts.push({ label: 'G latéral à la corde', value: `${fmt(a.g_lat_apex, 2)} g` });
  }

  const key = `corner_${cornerIndex}`;
  const disp = session.dispersion?.[key];
  if (typeof disp === 'number') facts.push({ label: 'Dispersion', value: `${fmt(disp, 1)} m` });
  const chassis = session.chassis_balance?.[key];
  if (typeof chassis === 'number') {
    facts.push({ label: 'Équilibre châssis', value: `${chassis > 0 ? '+' : ''}${fmt(chassis)} %` });
  }
  const load = session.load_transfer?.[key];
  if (typeof load === 'number') {
    facts.push({ label: 'Transfert de charge', value: `${fmt(load, 2)} s` });
  }

  return facts;
}
