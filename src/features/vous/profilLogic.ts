/**
 * profilLogic — logique pure de l'écran Profil public (V2-L4, écran 2/8).
 *
 * Aucun import natif : ts-jest node (les types de `@/lib/queries/profil` et
 * `@/services/pilotMediaService` sont importés en `import type`, effacés à la
 * compilation). La validation du handle réutilise `@/utils/validation` (pur),
 * pour que le MÊME nom public suive le pilote sur oxvehicle.fr et dans l'app.
 *
 * Règle fondateur données réelles : la couverture ne trace QUE vers une photo
 * réelle (média de profil signé, sinon cover du véhicule principal) ; sans
 * source réelle → undefined → HeroPhoto rend son fallback, jamais une image
 * stock. Le schéma n'a PAS de colonne cover dédiée (cf. DIVERGENCE_SCHEMA v1) :
 * la couverture = la photo de profil la plus récente.
 */

import { isValidHandle } from '@/utils/validation';
import type { ProfilPilote, ReseauxProfil, VehiculeGarage } from '@/lib/queries/profil';
import type { PilotMediaView } from '@/services/pilotMediaService';

export const BIO_MAX = 400;
export const HANDLE_MAX = 20;

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

/** Retire les « @ » de tête, minusculise, coupe les espaces de bord. */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

/**
 * Message d'erreur du handle, ou null si valide. Un champ VIDE ne renvoie pas
 * d'erreur (le pilote peut ne pas fixer de nom public) : la validation ne mord
 * que sur une saisie non vide invalide.
 */
export function handleError(raw: string): string | null {
  const h = normalizeHandle(raw);
  if (h.length === 0) return null;
  if (!isValidHandle(h)) {
    return '3 à 20 caractères : minuscules, chiffres, tiret ou underscore.';
  }
  return null;
}

/**
 * Valeur de handle à écrire, ou null si rien à faire (vide, inchangée, ou
 * invalide — dans ce dernier cas l'appelant a déjà `handleError` pour prévenir).
 */
export function handleToPersist(raw: string, current: string | null): string | null {
  const h = normalizeHandle(raw);
  if (h.length === 0) return null;
  if (h === (current ?? '')) return null;
  if (!isValidHandle(h)) return null;
  return h;
}

/** Message d'erreur de la bio, ou null. */
export function bioError(bio: string): string | null {
  if (bio.length > BIO_MAX) return `La bio est limitée à ${BIO_MAX} caractères.`;
  return null;
}

export interface IdentityChip {
  key: string;
  label: string;
}

/** Nom lisible d'un véhicule pour une chip, repli neutre. */
export function vehicleChipLabel(v: VehiculeGarage): string {
  const name = [v.brand, v.model].filter(Boolean).join(' ').trim();
  return name.length > 0 ? name : 'Véhicule';
}

export function vehiclesToChips(vehicles: VehiculeGarage[]): IdentityChip[] {
  return vehicles.map((v) => ({ key: v.id, label: vehicleChipLabel(v) }));
}

/** Chip du numéro de course du pilote (« N° 46 »), null si absent. */
export function carNumberChip(carNumber: number | null): IdentityChip | null {
  return carNumber != null ? { key: 'car-number', label: `N° ${carNumber}` } : null;
}

/**
 * Bandeau de chips identité : le numéro de course d'abord (attribut du pilote,
 * pas du véhicule), puis une chip par véhicule du garage.
 */
export function identityChips(input: {
  vehicles: VehiculeGarage[];
  carNumber: number | null;
}): IdentityChip[] {
  const num = carNumberChip(input.carNumber);
  return [...(num ? [num] : []), ...vehiclesToChips(input.vehicles)];
}

/** Nom affiché : prénom + nom, sinon @handle, sinon « — ». */
export function displayName(profil: Pick<ProfilPilote, 'prenom' | 'nom' | 'handle'>): string {
  const full = [profil.prenom, profil.nom].filter(Boolean).join(' ').trim();
  if (full.length > 0) return full;
  if (profil.handle) return `@${profil.handle}`;
  return '—';
}

/** Initiales (repli avatar sans photo), « — » si aucune. */
export function initials(profil: Pick<ProfilPilote, 'prenom' | 'nom'>): string {
  const i = `${profil.prenom?.charAt(0) ?? ''}${profil.nom?.charAt(0) ?? ''}`.toUpperCase();
  return i.length > 0 ? i : '—';
}

/** « Membre · depuis juillet 2026 » depuis users.created_at, ou null. */
export function memberSince(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `Membre · depuis ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

export interface SocialLink {
  key: keyof ReseauxProfil;
  label: string;
  url: string;
}

const SOCIAL_LABELS: Record<keyof ReseauxProfil, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
};

/** Réseaux renseignés uniquement (seule la clé non vide apparaît). */
export function activeSocials(reseaux: ReseauxProfil): SocialLink[] {
  return (Object.keys(SOCIAL_LABELS) as (keyof ReseauxProfil)[])
    .filter((k) => typeof reseaux[k] === 'string' && (reseaux[k] as string).trim().length > 0)
    .map((k) => ({ key: k, label: SOCIAL_LABELS[k], url: (reseaux[k] as string).trim() }));
}

export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/**
 * L'ADRESSE TELLE QU'ON PEUT L'OUVRIR — ou `null` si on ne peut pas.
 *
 * `Linking.openURL` a besoin d'un schéma. Sans lui, l'appel rejette, le
 * `.catch()` avale, et le bouton ne fait RIEN — sans message, sans trace,
 * indéfiniment. Personne ne saisit « https:// » spontanément : un pilote tape
 * `instagram.com/monpseudo`, un administrateur tape `cafeducircuit.fr`.
 *
 * On complète donc le schéma manquant plutôt que de faire disparaître le
 * bouton : l'intention est claire, et une adresse sans `https://` reste une
 * adresse. Ce qui ne ressemble à rien d'ouvrable rend `null`, et l'appelant
 * n'affiche pas de bouton — un contrôle mort vaut moins que pas de contrôle.
 *
 * `mailto:` et `tel:` passent tels quels : ce sont des schémas valides.
 *
 * Relevé par l'audit des liens sortants du 02/08/2026 : la fiche pilote côté
 * COACH ouvrait sans aucun contrôle les mêmes valeurs que l'écran pilote
 * filtrait déjà par `isHttpUrl`.
 */
export function lienOuvrable(valeur: string | null | undefined): string | null {
  if (typeof valeur !== 'string') return null;
  const v = valeur.trim();
  if (v.length === 0) return null;

  // Un schéma déjà présent : on ne réécrit pas ce que l'auteur a choisi.
  if (/^(https?|mailto|tel):/i.test(v)) return v;

  // Un espace, et ce n'est plus une adresse mais une phrase — « Contact :
  // accueil@… » a été saisi tel quel dans un champ « Email ».
  if (/\s/.test(v)) return null;

  // Une adresse électronique nue devient un `mailto:`.
  if (/^[^@]+@[^@]+\.[a-z]{2,}$/i.test(v)) return `mailto:${v}`;

  // Reste le cas ordinaire : un hôte, avec ou sans chemin. On exige au moins un
  // point suivi de deux lettres, sans quoi « brouillon » deviendrait une URL.
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/|\?|#|$)/i.test(v)) return `https://${v}`;

  return null;
}

/**
 * URI de couverture — donnée réelle uniquement, dans l'ordre :
 *  1. la photo de PROFIL la plus récente (dernière du tableau media, signée) —
 *     ainsi « changer la photo » (ajout d'un média) la promeut aussitôt ;
 *  2. sinon la cover du véhicule principal ;
 *  3. sinon undefined → HeroPhoto rend son fallback, jamais une image stock.
 */
export function pickCoverUri(
  profileMedia: PilotMediaView[],
  vehicleCoverUri?: string
): string | undefined {
  for (let i = profileMedia.length - 1; i >= 0; i--) {
    const m = profileMedia[i];
    if (m.type === 'photo' && typeof m.signedUrl === 'string' && m.signedUrl.length > 0) {
      return m.signedUrl;
    }
  }
  return vehicleCoverUri && vehicleCoverUri.length > 0 ? vehicleCoverUri : undefined;
}
