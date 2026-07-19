/**
 * documentsLogic — logique PURE de l'écran Licence & documents (V2-L4, VOUS 6/8).
 *
 * Décisions couvertes :
 *   - la lecture des champs LICENCE réels depuis la ligne `users` (n° FFSA,
 *     statut KYC, date de validation) — source vérifiée sur app/(app)/carte-
 *     licence.tsx v1, ZÉRO champ inventé (pas de date d'expiration fabriquée) ;
 *   - l'état de la ligne DÉCHARGE selon le drapeau `pilot_waivers` (fail-closed :
 *     OFF → « disponible prochainement ») ;
 *   - la liste des documents légaux bundlés (Pacte · CGU · Confidentialité).
 *
 * Aucune dépendance React / react-native / Supabase : testé sous ts-jest/node
 * (src/features/vous/__tests__/documentsLogic.test.ts). Les services (waiver,
 * featureFlags) et le module légal bundlé restent INTACTS.
 */

// ---------------------------------------------------------------------------
// Licence FFSA — champs réels de `users`
// ---------------------------------------------------------------------------

export interface LicenceIdentity {
  /** N° de licence FFSA (`users.ffsa_license`), ou null. */
  ffsaLicense: string | null;
  /** Statut KYC (`users.kyc_status`) — seul signal de validité vérifiable en base. */
  kycStatus: string | null;
  /** Date de validation KYC (`users.kyc_validated_at`), ou null. */
  kycValidatedAt: string | null;
}

const EMPTY_IDENTITY: LicenceIdentity = {
  ffsaLicense: null,
  kycStatus: null,
  kycValidatedAt: null,
};

/** Projette une ligne `users` (colonnes réelles) vers l'identité licence. */
export function licenceIdentityFromRow(row: Record<string, unknown> | null): LicenceIdentity {
  if (!row) return { ...EMPTY_IDENTITY };
  return {
    ffsaLicense: (row.ffsa_license as string | null) ?? null,
    kycStatus: (row.kyc_status as string | null) ?? null,
    kycValidatedAt: (row.kyc_validated_at as string | null) ?? null,
  };
}

/** Le dossier est-il validé ? (seul état de validité vérifiable : kyc_status). */
export function isLicenceValidated(kycStatus: string | null): boolean {
  return kycStatus === 'validated';
}

/** N° FFSA à afficher (mono), ou « — » s'il est absent. */
export function licenceNumberDisplay(ffsa: string | null): string {
  const t = ffsa?.trim();
  return t && t.length > 0 ? t : '—';
}

/** Nom complet du pilote, ou « Pilote » à défaut. */
export function fullName(first?: string | null, last?: string | null): string {
  const parts = [first?.trim(), last?.trim()].filter((p): p is string => !!p);
  return parts.length > 0 ? parts.join(' ') : 'Pilote';
}

/** « Validée le 3 juillet 2026 » depuis la date de validation KYC, ou null. */
export function validatedOnLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Une identité licence existe-t-elle (profil renseigné OU champ licence présent) ? */
export function hasLicenceIdentity(hasProfile: boolean, identity: LicenceIdentity): boolean {
  return hasProfile || identity.ffsaLicense != null || identity.kycStatus != null;
}

// ---------------------------------------------------------------------------
// Décharge — état de ligne selon le drapeau `pilot_waivers`
// ---------------------------------------------------------------------------

export type WaiverRowState = 'soon' | 'available';

/**
 * État de la ligne Décharge. Fail-closed : tant que le drapeau `pilot_waivers`
 * est OFF (texte non relu par un avocat), la ligne est « disponible
 * prochainement » et non tappable — rien de légalement effectif n'est présenté.
 */
export function waiverRowState(flagOn: boolean): WaiverRowState {
  return flagOn === true ? 'available' : 'soon';
}

export function waiverRowSublabel(state: WaiverRowState): string {
  return state === 'available' ? 'Signature électronique' : 'Disponible prochainement';
}

// ---------------------------------------------------------------------------
// Documents légaux bundlés
// ---------------------------------------------------------------------------

export type LegalSlug = 'pacte' | 'cgu' | 'confidentialite';

export interface LegalLink {
  slug: LegalSlug;
  label: string;
}

/** Les 3 documents légaux consultables in-app (lecteur markdown bundlé v1). */
export const LEGAL_DOC_LINKS: readonly LegalLink[] = [
  { slug: 'pacte', label: 'Pacte de pilotage' },
  { slug: 'cgu', label: "Conditions d'utilisation" },
  { slug: 'confidentialite', label: 'Confidentialité' },
] as const;
