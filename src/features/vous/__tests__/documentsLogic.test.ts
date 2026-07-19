/**
 * Tests documentsLogic (V2-L4, porte VOUS, écran Licence & documents) — pur, node.
 *
 * Couvre : projection des champs licence réels de `users` (jamais un champ
 * inventé), état de validité (kyc_status), affichage du n° FFSA, présence d'une
 * identité, état de la ligne Décharge selon le drapeau `pilot_waivers`
 * (fail-closed), et la liste des documents légaux bundlés.
 */

import {
  fullName,
  hasLicenceIdentity,
  isLicenceValidated,
  LEGAL_DOC_LINKS,
  licenceIdentityFromRow,
  licenceNumberDisplay,
  validatedOnLabel,
  waiverRowState,
  waiverRowSublabel,
} from '../documentsLogic';

// ---------------------------------------------------------------------------
// Identité licence
// ---------------------------------------------------------------------------

describe('licenceIdentityFromRow', () => {
  it('projette les colonnes réelles de users', () => {
    expect(
      licenceIdentityFromRow({
        ffsa_license: 'FR-2026-00123',
        kyc_status: 'validated',
        kyc_validated_at: '2026-07-03T10:00:00Z',
        autre_colonne: 'ignorée',
      })
    ).toEqual({
      ffsaLicense: 'FR-2026-00123',
      kycStatus: 'validated',
      kycValidatedAt: '2026-07-03T10:00:00Z',
    });
  });

  it('ligne absente → identité vide (jamais un champ inventé)', () => {
    expect(licenceIdentityFromRow(null)).toEqual({
      ffsaLicense: null,
      kycStatus: null,
      kycValidatedAt: null,
    });
  });

  it('colonnes manquantes → null (pas de fabrication)', () => {
    expect(licenceIdentityFromRow({ ffsa_license: 'X' })).toEqual({
      ffsaLicense: 'X',
      kycStatus: null,
      kycValidatedAt: null,
    });
  });
});

describe('isLicenceValidated', () => {
  it('validé UNIQUEMENT si kyc_status = validated', () => {
    expect(isLicenceValidated('validated')).toBe(true);
    expect(isLicenceValidated('pending')).toBe(false);
    expect(isLicenceValidated(null)).toBe(false);
  });
});

describe('licenceNumberDisplay', () => {
  it('n° présent (trim), sinon « — »', () => {
    expect(licenceNumberDisplay(' FR-1 ')).toBe('FR-1');
    expect(licenceNumberDisplay('')).toBe('—');
    expect(licenceNumberDisplay(null)).toBe('—');
  });
});

describe('fullName', () => {
  it('assemble prénom + nom, sinon « Pilote »', () => {
    expect(fullName('Gabin', 'Dupont')).toBe('Gabin Dupont');
    expect(fullName('Gabin', null)).toBe('Gabin');
    expect(fullName(null, null)).toBe('Pilote');
    expect(fullName('  ', '  ')).toBe('Pilote');
  });
});

describe('validatedOnLabel', () => {
  it('date lisible ou null', () => {
    expect(validatedOnLabel('2026-07-03T10:00:00Z')).toContain('2026');
    expect(validatedOnLabel(null)).toBeNull();
    expect(validatedOnLabel('pas-une-date')).toBeNull();
  });
});

describe('hasLicenceIdentity', () => {
  const EMPTY = { ffsaLicense: null, kycStatus: null, kycValidatedAt: null };
  it('vraie dès qu’un profil existe OU qu’un champ licence est présent', () => {
    expect(hasLicenceIdentity(true, EMPTY)).toBe(true);
    expect(hasLicenceIdentity(false, { ...EMPTY, ffsaLicense: 'FR-1' })).toBe(true);
    expect(hasLicenceIdentity(false, { ...EMPTY, kycStatus: 'pending' })).toBe(true);
    expect(hasLicenceIdentity(false, EMPTY)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Décharge — drapeau pilot_waivers (fail-closed)
// ---------------------------------------------------------------------------

describe('waiverRowState (fail-closed)', () => {
  it('drapeau OFF → « disponible prochainement »', () => {
    expect(waiverRowState(false)).toBe('soon');
    expect(waiverRowSublabel(waiverRowState(false))).toBe('Disponible prochainement');
  });
  it('drapeau ON → disponible (signature électronique)', () => {
    expect(waiverRowState(true)).toBe('available');
    expect(waiverRowSublabel(waiverRowState(true))).toBe('Signature électronique');
  });
});

// ---------------------------------------------------------------------------
// Documents légaux bundlés
// ---------------------------------------------------------------------------

describe('LEGAL_DOC_LINKS', () => {
  it('les 3 documents légaux, dans l’ordre, avec slugs valides', () => {
    expect(LEGAL_DOC_LINKS.map((l) => l.slug)).toEqual(['pacte', 'cgu', 'confidentialite']);
    LEGAL_DOC_LINKS.forEach((l) => expect(l.label.length).toBeGreaterThan(0));
  });
});
