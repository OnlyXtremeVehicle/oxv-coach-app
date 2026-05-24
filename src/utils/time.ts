/**
 * Utilitaires de temps — formatage et helpers OXV.
 */

/**
 * Salutation contextuelle française selon l'heure locale.
 *
 * Mappage simple :
 *   05h00 – 17h59 : Bonjour
 *   18h00 – 04h59 : Bonsoir
 *
 * On évite "Bonne nuit" qui sonne fin-de-journée — l'app peut s'ouvrir
 * la nuit pour consulter un bilan sans qu'on souhaite "Bonne nuit".
 */
export function timeBasedGreeting(now: Date = new Date()): 'Bonjour' | 'Bonsoir' {
  const hour = now.getHours();
  if (hour >= 5 && hour < 18) return 'Bonjour';
  return 'Bonsoir';
}

/** Format MM:SS.mmm pour un temps en millisecondes. */
export function formatChronoMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalMs = Math.round(ms);
  const min = Math.floor(totalMs / 60_000);
  const sec = Math.floor((totalMs % 60_000) / 1_000);
  const mil = totalMs % 1_000;
  return `${min}:${String(sec).padStart(2, '0')}.${String(mil).padStart(3, '0')}`;
}

/** Formule "il y a X" en français pour une date passée. */
export function timeAgoFr(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return 'à venir';

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;

  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'hier';
  if (diffD < 7) return `il y a ${diffD} jours`;
  if (diffD < 30) return `il y a ${Math.floor(diffD / 7)} sem`;
  if (diffD < 365) return `il y a ${Math.floor(diffD / 30)} mois`;
  return `il y a ${Math.floor(diffD / 365)} an${diffD >= 730 ? 's' : ''}`;
}

/** Nombre de jours entre maintenant et une date future, arrondi à l'entier supérieur. */
export function daysUntil(date: Date, now: Date = new Date()): number {
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}
