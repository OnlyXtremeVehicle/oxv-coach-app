/**
 * Tests de la logique pure du catalogue de réservation (V2-L4, mission D).
 * Prix, places/jauge, offres, gating drapeau — sans réseau ni RN.
 */

import {
  FOUNDER_TOTAL,
  NBSP,
  availableOfferKeys,
  foundersProgressLabel,
  formatPriceEur,
  placesGauge,
  placesLabel,
  placesRemaining,
  resolveBookingAccess,
  resolveOfferPriceCents,
  seasonForDate,
  type PricingRow,
} from '../bookingCatalogLogic';

describe('formatPriceEur', () => {
  it('formate le prix Heritage (correctif) : 249000 cents → « 2 490 € »', () => {
    expect(formatPriceEur(249000)).toBe(`2${NBSP}490${NBSP}€`);
    // Même valeur, séparateurs normalisés en espace ordinaire, pour la lisibilité.
    expect(formatPriceEur(249000).replace(/ /g, ' ')).toBe('2 490 €');
  });

  it('formate des prix courants sans décimales inutiles', () => {
    expect(formatPriceEur(39000)).toBe(`390${NBSP}€`);
    expect(formatPriceEur(69000)).toBe(`690${NBSP}€`);
    expect(formatPriceEur(6900)).toBe(`69${NBSP}€`);
  });

  it('affiche les décimales seulement si non nulles', () => {
    expect(formatPriceEur(39050)).toBe(`390,50${NBSP}€`);
  });

  it('rend « — » pour un montant absent (jamais un 0 fabriqué)', () => {
    expect(formatPriceEur(null)).toBe('—');
    expect(formatPriceEur(undefined)).toBe('—');
    expect(formatPriceEur(Number.NaN)).toBe('—');
  });
});

describe('placesRemaining', () => {
  it('rend capacité − prises, borné à 0', () => {
    expect(placesRemaining(20, 1)).toBe(19);
    expect(placesRemaining(5, 10)).toBe(0);
    expect(placesRemaining(null, null)).toBe(0);
  });
});

describe('placesGauge', () => {
  it('jauge une journée réelle : 20 places, 1 prise', () => {
    const g = placesGauge(20, 1);
    expect(g.segments).toBe(20);
    expect(g.filledSegments).toBe(1);
    expect(g.freeSegments).toBe(19);
    expect(g.remaining).toBe(19);
    expect(g.isWaitlist).toBe(false);
    expect(placesLabel(g)).toBe('19 places');
  });

  it('bascule en liste d’attente quand tout est pris', () => {
    const g = placesGauge(20, 20);
    expect(g.remaining).toBe(0);
    expect(g.isWaitlist).toBe(true);
    expect(placesLabel(g)).toBe("Liste d'attente");
  });

  it('capacité nulle → liste d’attente, aucun segment', () => {
    const g = placesGauge(0, 0);
    expect(g.segments).toBe(0);
    expect(g.isWaitlist).toBe(true);
  });

  it('plafonne le nombre de segments à 20', () => {
    const g = placesGauge(30, 0);
    expect(g.segments).toBe(20);
    expect(g.remaining).toBe(30);
  });

  it('accorde le singulier : 1 place', () => {
    expect(placesLabel(placesGauge(20, 19))).toBe('1 place');
  });

  it('borne les prises à la capacité : taken > cap → 0 restant, jamais négatif', () => {
    const g = placesGauge(10, 25);
    expect(g.taken).toBe(10);
    expect(g.remaining).toBe(0);
    expect(g.isWaitlist).toBe(true);
    expect(placesLabel(g)).toBe("Liste d'attente");
  });
});

describe('resolveBookingAccess (gating drapeau app_payments)', () => {
  it('OFF → fermé, ON → ouvert', () => {
    expect(resolveBookingAccess(false)).toBe('closed');
    expect(resolveBookingAccess(true)).toBe('open');
  });
});

describe('foundersProgressLabel', () => {
  it('formate et borne le compteur à [0, total]', () => {
    expect(foundersProgressLabel(12)).toBe('12/30 fondateurs');
    expect(foundersProgressLabel(FOUNDER_TOTAL + 10)).toBe('30/30 fondateurs');
    expect(foundersProgressLabel(-5)).toBe('0/30 fondateurs');
  });
});

describe('availableOfferKeys', () => {
  it('ne garde que les offres à true, dans l’ordre canonique', () => {
    expect(availableOfferKeys({ signature: false, access: true, heritage: true })).toEqual([
      'access',
      'heritage',
    ]);
  });

  it('entrée absente/malformée → []', () => {
    expect(availableOfferKeys(null)).toEqual([]);
    expect(availableOfferKeys('access')).toEqual([]);
    expect(availableOfferKeys({ inconnu: true })).toEqual([]);
  });
});

describe('seasonForDate', () => {
  it('extrait l’année de la date ISO', () => {
    expect(seasonForDate('2026-12-24')).toBe('2026');
  });
});

describe('resolveOfferPriceCents', () => {
  const rows: PricingRow[] = [
    {
      season: '2027',
      offer_key: 'heritage',
      format: 'full_day',
      price_first_session_cents: 249000,
      price_subsequent_cents: 249000,
      active: true,
    },
    // Ligne archivée (active=false) : lisible via le RLS public, mais jamais retenue.
    {
      season: '2026',
      offer_key: 'access',
      format: 'full_day',
      price_first_session_cents: 69000,
      price_subsequent_cents: 69000,
      active: false,
    },
    {
      season: '2027',
      offer_key: 'access',
      format: 'half_day',
      price_first_session_cents: 39000,
      price_subsequent_cents: 39000,
      active: true,
    },
    {
      season: '2028',
      offer_key: 'access',
      format: 'full_day',
      price_first_session_cents: 69000,
      price_subsequent_cents: 69000,
      active: true,
    },
  ];

  it('résout le prix Heritage actif', () => {
    expect(
      resolveOfferPriceCents(rows, { season: '2027', offerKey: 'heritage', format: 'full_day' })
    ).toBe(249000);
  });

  it('résout le demi-jour Access', () => {
    expect(
      resolveOfferPriceCents(rows, { season: '2027', offerKey: 'access', format: 'half_day' })
    ).toBe(39000);
  });

  it('normalise les formats demi-journée « morning »/« afternoon » vers half_day', () => {
    expect(
      resolveOfferPriceCents(rows, { season: '2027', offerKey: 'access', format: 'morning' })
    ).toBe(39000);
    expect(
      resolveOfferPriceCents(rows, { season: '2027', offerKey: 'access', format: 'afternoon' })
    ).toBe(39000);
  });

  it('ignore une ligne archivée (jamais de repli sur une ligne inactive)', () => {
    expect(
      resolveOfferPriceCents(rows, { season: '2026', offerKey: 'access', format: 'full_day' })
    ).toBeNull();
  });

  it('ne facture JAMAIS une demi-journée au tarif pleine journée (anti-surfacturation)', () => {
    // 2028 access n'a QU'une ligne full_day active : une demi-journée ne doit pas s'y replier.
    expect(
      resolveOfferPriceCents(rows, { season: '2028', offerKey: 'access', format: 'morning' })
    ).toBeNull();
    expect(
      resolveOfferPriceCents(rows, { season: '2028', offerKey: 'access', format: 'half_day' })
    ).toBeNull();
  });

  it('rend null sans correspondance active (prix affiché « — »)', () => {
    expect(
      resolveOfferPriceCents(rows, { season: '2099', offerKey: 'signature', format: 'full_day' })
    ).toBeNull();
  });
});
