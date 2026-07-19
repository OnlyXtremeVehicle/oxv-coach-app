/**
 * Tests — logique PURE de la porte VOUS (lot V2-L4, Mission A). Aucun réseau.
 * Couvre : palier, records, ligne d'identité, états de la carte fondateur,
 * jauge x/30, message de partage, identité affichée, ligne écurie, plus la
 * validation de motivation réutilisée de founderLogic (BE-1).
 */

import { validateMotivation, FOUNDER_MOTIVATION_MIN } from '@/services/v2/founderLogic';

import {
  crewRowLabel,
  currentOfferLabel,
  founderCardState,
  foundersGauge,
  FOUNDERS_MAX,
  handleLabel,
  pilotDisplayName,
  recordsCount,
  shareMessage,
  statsLine,
  type CircuitRecordRef,
  type RegistrationRef,
} from '../vousHubLogic';

// ---------------------------------------------------------------------------
// currentOfferLabel
// ---------------------------------------------------------------------------

describe('currentOfferLabel', () => {
  const reg = (offer_type: string | null, status: string | null): RegistrationRef => ({
    offer_type,
    status,
  });

  it('rend le libellé de la première inscription effective (rows triées DESC)', () => {
    expect(currentOfferLabel([reg('heritage', 'confirmed'), reg('access', 'confirmed')])).toBe(
      'Heritage'
    );
  });

  it('ignore les inscriptions non effectives (ex. cancelled)', () => {
    expect(currentOfferLabel([reg('signature', 'cancelled'), reg('access', 'attended')])).toBe(
      'Access'
    );
  });

  it('mappe les offres connues, conserve une offre inconnue telle quelle', () => {
    expect(currentOfferLabel([reg('signature', 'pending')])).toBe('Signature');
    expect(currentOfferLabel([reg('mystere', 'confirmed')])).toBe('mystere');
  });

  it('aucune inscription effective → null (segment masqué)', () => {
    expect(currentOfferLabel([])).toBeNull();
    expect(currentOfferLabel([reg('access', 'cancelled')])).toBeNull();
    expect(currentOfferLabel([reg(null, 'confirmed')])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// recordsCount
// ---------------------------------------------------------------------------

describe('recordsCount', () => {
  const c = (circuitName: string, bestLapSeconds: number | null): CircuitRecordRef => ({
    circuitName,
    bestLapSeconds,
  });

  it('compte les circuits avec un meilleur tour réel, hors « Inconnu »', () => {
    const byCircuit = {
      a: c('Haute Saintonge', 92.1),
      b: c('Le Mans', 105.3),
      c: c('Inconnu', 80.0), // exclu (bucket sans circuit)
      d: c('Nogaro', null), // exclu (pas de temps réel)
    };
    expect(recordsCount(byCircuit)).toBe(2);
  });

  it('aucun temps → 0', () => {
    expect(recordsCount({})).toBe(0);
    expect(recordsCount({ a: c('Nogaro', null) })).toBe(0);
  });

  it('ignore un temps non fini', () => {
    expect(recordsCount({ a: c('Nogaro', Number.NaN) })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// statsLine
// ---------------------------------------------------------------------------

describe('statsLine', () => {
  it('assemble les trois segments présents', () => {
    expect(statsLine('Heritage', 3, 412)).toBe('Heritage · 3 records · 412 km');
  });

  it('accorde « record » au singulier', () => {
    expect(statsLine('Access', 1, 50)).toBe('Access · 1 record · 50 km');
  });

  it('masque les segments absents ou nuls', () => {
    expect(statsLine(null, 0, 0)).toBeNull();
    expect(statsLine('Signature', 0, 0)).toBe('Signature');
    expect(statsLine(null, 2, 0)).toBe('2 records');
    expect(statsLine(null, 0, 120)).toBe('120 km');
  });

  it('arrondit les km', () => {
    expect(statsLine(null, 0, 411.6)).toBe('412 km');
  });
});

// ---------------------------------------------------------------------------
// founderCardState (4 états)
// ---------------------------------------------------------------------------

describe('founderCardState', () => {
  it('flag OFF → absent (fail-closed, carte non rendue)', () => {
    expect(founderCardState(false, null)).toBe('absent');
    expect(founderCardState(false, { status: 'pending' })).toBe('absent');
    expect(founderCardState(false, { status: 'approved' })).toBe('absent');
  });

  it('flag ON, aucune candidature → candidater', () => {
    expect(founderCardState(true, null)).toBe('candidater');
  });

  it('flag ON, candidature pending → pending', () => {
    expect(founderCardState(true, { status: 'pending' })).toBe('pending');
  });

  it('flag ON, candidature approved → approved', () => {
    expect(founderCardState(true, { status: 'approved' })).toBe('approved');
  });

  it('flag ON, candidature declined → absent (pas de re-candidature en dead-end)', () => {
    expect(founderCardState(true, { status: 'declined' })).toBe('absent');
  });
});

// ---------------------------------------------------------------------------
// foundersGauge
// ---------------------------------------------------------------------------

describe('foundersGauge', () => {
  it('compte nominal', () => {
    expect(foundersGauge(12)).toEqual({ filled: 12, remaining: 18 });
    expect(FOUNDERS_MAX).toBe(30);
  });

  it('écrête un compteur au-delà du plafond (jamais de débordement)', () => {
    expect(foundersGauge(42)).toEqual({ filled: 30, remaining: 0 });
  });

  it('compteur invalide/négatif → 0 place prise', () => {
    expect(foundersGauge(-3)).toEqual({ filled: 0, remaining: 30 });
    expect(foundersGauge(Number.NaN)).toEqual({ filled: 0, remaining: 30 });
  });

  it('tronque une valeur décimale', () => {
    expect(foundersGauge(12.9)).toEqual({ filled: 12, remaining: 18 });
  });

  it('respecte un plafond personnalisé', () => {
    expect(foundersGauge(5, 10)).toEqual({ filled: 5, remaining: 5 });
  });
});

// ---------------------------------------------------------------------------
// shareMessage
// ---------------------------------------------------------------------------

describe('shareMessage', () => {
  it('compose un message sobre vouvoyé', () => {
    expect(shareMessage('ABCD1234')).toBe('Rejoignez-moi sur OXV — ABCD1234');
  });

  it('détrime le code', () => {
    expect(shareMessage('  WXYZ  ')).toBe('Rejoignez-moi sur OXV — WXYZ');
  });
});

// ---------------------------------------------------------------------------
// pilotDisplayName / handleLabel
// ---------------------------------------------------------------------------

describe('pilotDisplayName', () => {
  it('compose prénom + nom', () => {
    expect(pilotDisplayName('Gabin', 'Fillat')).toBe('Gabin Fillat');
  });

  it('tolère un nom partiel', () => {
    expect(pilotDisplayName('Gabin', null)).toBe('Gabin');
    expect(pilotDisplayName(null, 'Fillat')).toBe('Fillat');
  });

  it('repli « Pilote » si aucune identité', () => {
    expect(pilotDisplayName(null, null)).toBe('Pilote');
    expect(pilotDisplayName('  ', '  ')).toBe('Pilote');
  });
});

describe('handleLabel', () => {
  it('préfixe @ si absent', () => {
    expect(handleLabel('zoe')).toBe('@zoe');
  });

  it('ne double pas le @', () => {
    expect(handleLabel('@zoe')).toBe('@zoe');
  });

  it('handle absent → null (jamais un @ vide)', () => {
    expect(handleLabel(null)).toBeNull();
    expect(handleLabel('  ')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// crewRowLabel
// ---------------------------------------------------------------------------

describe('crewRowLabel', () => {
  it('écurie nommée + accord pluriel', () => {
    expect(
      crewRowLabel({
        name: 'Les Sangliers',
        members: [
          { userId: 'a', role: 'owner' },
          { userId: 'b', role: 'member' },
        ],
      })
    ).toEqual({ label: 'Écurie Les Sangliers', sublabel: '2 membres' });
  });

  it('écurie sans nom + accord singulier', () => {
    expect(crewRowLabel({ name: null, members: [{ userId: 'a', role: 'owner' }] })).toEqual({
      label: 'Votre écurie',
      sublabel: '1 membre',
    });
  });
});

// ---------------------------------------------------------------------------
// validateMotivation (réutilisée de founderLogic BE-1)
// ---------------------------------------------------------------------------

describe('validateMotivation (founderLogic)', () => {
  it('refuse une motivation trop courte', () => {
    expect(validateMotivation('trop court').ok).toBe(false);
  });

  it('accepte une motivation dans les bornes', () => {
    expect(validateMotivation('a'.repeat(FOUNDER_MOTIVATION_MIN)).ok).toBe(true);
  });
});
