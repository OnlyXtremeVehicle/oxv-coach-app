/**
 * Helpers de formatage partagés entre écrans.
 *
 * Centralisés pour éviter la duplication entre tours.tsx, stats.tsx,
 * replay.tsx, virage.tsx, virage-comparer.tsx et le PDF export, et
 * pour pouvoir les unit-tester sans monter un écran React.
 */

/**
 * Formate un temps au tour en mm'ss.cc ou ss.cc s.
 *
 * Exemples :
 *   formatLapTime(82.45)  → "1'22.45"
 *   formatLapTime(45.123) → "45.12 s"
 *   formatLapTime(0)      → "0.00 s"
 */
export function formatLapTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds - mins * 60;
  if (mins > 0) return `${mins}'${secs.toFixed(2).padStart(5, '0')}`;
  return `${secs.toFixed(2)} s`;
}

/**
 * Formate une durée longue en h Xmin.
 *
 * Exemples :
 *   formatDuration(125)   → "2 min"
 *   formatDuration(3725)  → "1 h 2 min"
 *   formatDuration(0)     → "0 min"
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} h ${mins} min`;
  return `${mins} min`;
}

/**
 * Date courte fr-FR (« 25 mai 2026 »).
 */
export function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Date longue fr-FR (« 25 mai 2026 »).
 */
export function formatDateLong(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Montant en centimes d'euro → chaîne fr-FR (« 1 200 € », « 49,50 € »).
 * Affiche les centimes uniquement s'ils sont non nuls.
 */
export function formatPriceCents(cents: number): string {
  try {
    const euros = cents / 100;
    const hasCents = cents % 100 !== 0;
    return euros.toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: 2,
    });
  } catch {
    return '—';
  }
}

/**
 * Date + heure fr-FR (« 10 juil. 2026, 09:00 »). Utilisé pour les roulages.
 */
export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/**
 * Formate un delta entre deux valeurs avec signe non-mathématique
 * (« + » ou « − » U+2212, pas « - »).
 *
 * Exemples :
 *   formatDelta(50, 55, 'km/h')          → "+5 km/h"
 *   formatDelta(82.5, 81.8, 's', 2)      → "−0.70 s"
 *   formatDelta(null, 30, 'pts')         → "—"
 *   formatDelta(20, 20, 'pts')           → "±0 pts"
 */
export function formatDelta(
  a: number | null,
  b: number | null,
  unit: string,
  decimals = 0
): string {
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return '—';
  const delta = b - a;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
  return `${sign}${Math.abs(delta).toFixed(decimals)} ${unit}`;
}
