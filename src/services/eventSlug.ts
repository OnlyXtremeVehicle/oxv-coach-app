/**
 * Slug d'événement (pur, testable — isolé de `eventsService` qui tire supabase).
 *
 * URL-safe : minuscule, accents retirés, alphanumérique + tirets, ≤ 80 car.
 */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
