/**
 * arriveeInsigneLogic — logique PURE de la garde « insigne une fois par jour »
 * de l'écran ARRIVÉE (lot V2-L2, écran 3/8). Module .ts strictement pur —
 * testé sous ts-jest node (__tests__/arriveeInsigneLogic.test.ts).
 *
 * L'insigne OXV se dessine (2 s) UNE SEULE FOIS par jour : la première arrivée
 * au paddock est un rituel, les retours sur l'écran le même jour le montrent
 * déjà tracé (aucune ré-animation). La date du dernier tracé est mémorisée en
 * MMKV (l'écran fait la lecture/écriture) ; ici, uniquement les décisions.
 */

/** Clé MMKV du dernier jour où l'insigne a été dessiné (chaîne 'AAAA-MM-JJ'). */
export const INSIGNE_DRAWN_KEY = 'rec:arrivee:insigneDrawnOn';

/** Chemin SVG de l'insigne OXV (registre 24×24) : écu puis chevron. */
export const INSIGNE_SVG_PATH =
  'M12 3.5 L19.5 6.2 L19.5 11.5 C19.5 15.9 16.6 19.2 12 20.5 C7.4 19.2 4.5 15.9 4.5 11.5 L4.5 6.2 Z M9 9.5 L12 13.8 L15 9.5';

/** Repère de la grille de l'insigne (viewBox 24×24). */
export const INSIGNE_VIEWBOX = 24;

/**
 * Longueur approximative du chemin dans l'espace du viewBox (unités 24×24),
 * écu + chevron. Sert de `strokeDasharray` au tracé progressif ; volontairement
 * un peu SUR-estimée (~70 pour ~62 réelles) afin que l'insigne finisse de se
 * dessiner avant la fin de l'animation, jamais tronqué.
 */
export const INSIGNE_PATH_LENGTH = 70;

/**
 * Date LOCALE 'AAAA-MM-JJ' de `now` (jamais UTC) : même convention que le reste
 * de l'app (nextTrackDayService, préparation) — à 0 h 30 heure de Paris, on est
 * déjà le jour suivant.
 */
export function todayIsoLocal(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Faut-il ANIMER le tracé de l'insigne ? Vrai quand il n'a pas encore été
 * dessiné aujourd'hui (valeur stockée absente ou d'un autre jour). Faux quand
 * la valeur stockée est exactement la date du jour → l'insigne est rendu déjà
 * complet, sans mouvement.
 */
export function shouldAnimateInsigne(storedDrawnOn: string | null, todayIso: string): boolean {
  return storedDrawnOn !== todayIso;
}
