/**
 * Helpers de formatage partagés entre écrans.
 *
 * Centralisés pour éviter la duplication entre tours.tsx, stats.tsx,
 * replay.tsx, virage.tsx, virage-comparer.tsx et le PDF export, et
 * pour pouvoir les unit-tester sans monter un écran React.
 *
 * ---
 *
 * SÉPARATEUR DÉCIMAL : LA VIRGULE (jalon 2, phase 1)
 *
 * `1:41,203`, jamais `1:41.203`. L'application est en français et s'adresse à
 * des pilotes francophones ; un point décimal y lit comme une faute, ou pire,
 * comme un séparateur de milliers.
 *
 * `toFixed` rend TOUJOURS un point, quelle que soit la locale. Toute valeur
 * décimale destinée à l'écran passe donc par `virgule()`. Ce module est la
 * source canonique : les écrans ne reformatent pas eux-mêmes.
 */

/**
 * Convertit le point décimal de `toFixed` en virgule.
 *
 * N'agit que sur le SÉPARATEUR — le point qui suit un chiffre et précède un
 * chiffre. Un point de fin de phrase ou d'abréviation reste intact, ce qui
 * permet d'appliquer la fonction à une chaîne déjà composée sans la casser.
 */
export function virgule(texte: string): string {
  return texte.replace(/(\d)\.(\d)/g, '$1,$2');
}

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
  // Arrondi AVANT le découpage des minutes : 119,995 s → « 2'00.00 »,
  // jamais « 1'60.00 » (bord de retenue du toFixed).
  const total = Math.round(seconds * 100) / 100;
  const mins = Math.floor(total / 60);
  const secs = total - mins * 60;
  if (mins > 0) return virgule(`${mins}'${secs.toFixed(2).padStart(5, '0')}`);
  return virgule(`${secs.toFixed(2)} s`);
}

/**
 * Formate un temps au tour au canon des maquettes refonte-v2 : « M:SS.mmm »
 * (deux-points, millième). Distinct de {@link formatLapTime} (apostrophe +
 * centième, verrouillé par test + exports PDF) : réservé aux CHIFFRES ROIS des
 * écrans qui suivent la maquette au millième (bilan, passeport, référence).
 *
 * Exemples :
 *   formatLapTimeMs(84.318)  → "1:24.318"
 *   formatLapTimeMs(45.123)  → "45.123 s"
 */
export function formatLapTimeMs(seconds: number | string | null | undefined): string {
  // PostgREST rend les colonnes `numeric` en CHAÎNE au runtime, alors que le
  // type TypeScript annonce `number`. `Number.isFinite('95.2')` valant false, ce
  // formateur rendait « — » sur des chronos parfaitement présents en base —
  // constaté sur le débrief, le studio et la fiche pilote. On coerce donc ici :
  // le tiret reste réservé à ce qui est vraiment absent ou illisible.
  const n = typeof seconds === 'number' ? seconds : Number(seconds);
  if (seconds === null || seconds === undefined || seconds === '') return '—';
  if (!Number.isFinite(n) || n < 0) return '—';
  return formatLapTimeSecondes(n);
}

/** Découpage minutes/secondes, une fois la valeur établie comme un nombre. */
function formatLapTimeSecondes(seconds: number): string {
  // Arrondi au millième AVANT découpage des minutes (bord de retenue).
  const total = Math.round(seconds * 1000) / 1000;
  const mins = Math.floor(total / 60);
  const secs = total - mins * 60;
  if (mins > 0) return virgule(`${mins}:${secs.toFixed(3).padStart(6, '0')}`);
  return virgule(`${secs.toFixed(3)} s`);
}

/**
 * Formate un temps au tour au dixième (« M:SS.d ») — canon des maquettes où le
 * chiffre roi est allégé (Trace, scrubber du rejeu). Deux-points, 1 décimale.
 *
 * Exemples :
 *   formatChronoTenths(84.318) → "1:24.3"
 *   formatChronoTenths(45.1)   → "45.1 s"
 */
export function formatChronoTenths(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds * 10) / 10;
  const mins = Math.floor(total / 60);
  const secs = total - mins * 60;
  if (mins > 0) return virgule(`${mins}:${secs.toFixed(1).padStart(4, '0')}`);
  return virgule(`${secs.toFixed(1)} s`);
}

/**
 * Méta de séance courte SANS année, au canon des maquettes (« 4 juil · 20 h 12 »).
 * Le caller met en capitales si besoin. Séparateur milieu de point.
 */
export function formatSessionMeta(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${date} · ${hh} h ${mm}`;
  } catch {
    return '—';
  }
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
  return virgule(`${sign}${Math.abs(delta).toFixed(decimals)} ${unit}`);
}
