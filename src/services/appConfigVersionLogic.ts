/**
 * Comparateur de version (PR-46) — PUR (sans réseau), testable.
 *
 * Décide si la version native installée est inférieure à la version minimale
 * requise (gate de mise à jour obligatoire). Isolé du service pour rester
 * importable sans tirer le client Supabase.
 */

/** Compare deux versions « x.y.z ». Renvoie true si `current` < `min`. */
export function isVersionBelow(current: string, min: string): boolean {
  const parse = (v: string): number[] =>
    v
      .trim()
      .split('.')
      .map((p) => {
        const n = parseInt(p, 10);
        return Number.isFinite(n) ? n : 0;
      });
  const c = parse(current);
  const m = parse(min);
  const len = Math.max(c.length, m.length);
  for (let i = 0; i < len; i += 1) {
    const a = c[i] ?? 0;
    const b = m[i] ?? 0;
    if (a < b) return true;
    if (a > b) return false;
  }
  return false;
}
