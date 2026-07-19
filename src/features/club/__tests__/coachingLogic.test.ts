/**
 * Tests — logique pure du COACHING (V2-L5). Verrous DOCTRINAUX :
 *  - une carte coach n'expose AUCUN score / note / classement ;
 *  - un avis ne sort qu'en CITATION (texte + auteur), jamais sa note étoilée.
 */

import type { CoachListing, CoachReview } from '@/services/coachMarketplaceService';

import {
  bookingIsPast,
  bookingTimelineStep,
  clampTabIndex,
  coachCardMap,
  COACHING_TABS,
  euroLabel,
  reviewCitations,
  sortCoachCards,
  tabIndexOf,
  tabKeyFromIndex,
} from '../coachingLogic';

describe('onglets', () => {
  it('trois onglets stables', () => {
    expect(COACHING_TABS.map((t) => t.key)).toEqual(['trouver', 'mon-coach', 'demandes']);
  });
  it('borne et convertit les index (swipe robuste)', () => {
    expect(clampTabIndex(-3)).toBe(0);
    expect(clampTabIndex(9)).toBe(2);
    expect(clampTabIndex(1.4)).toBe(1);
    expect(tabKeyFromIndex(2)).toBe('demandes');
    expect(tabIndexOf('mon-coach')).toBe(1);
  });
});

describe('euroLabel', () => {
  it('formate ou renvoie null (jamais fabriqué)', () => {
    expect(euroLabel(120)).toBe('120 €');
    expect(euroLabel(null)).toBeNull();
  });
});

describe('coachCardMap — DOCTRINE : zéro score', () => {
  it('ne laisse passer AUCUN champ de note / score', () => {
    // Fiche marketplace polluée par des champs de scoring (comme si une source
    // future les ajoutait). Ils NE DOIVENT PAS traverser.
    const listing = {
      coachId: 'c1',
      headline: 'Jean Coach',
      bio: 'Ancien pilote.',
      photoUrl: null,
      circuits: ['Haute Saintonge', 'Le Mans'],
      specialties: ['Freinage', 'Trajectoire'],
      sessionPriceEur: 120,
      seasonPriceEur: 1000,
      rating: 4.7,
      average: 4.7,
      score: 99,
      reviewsCount: 12,
      stars: 5,
    } as unknown as CoachListing;

    const vm = coachCardMap(listing);
    expect(vm.name).toBe('Jean Coach');
    expect(vm.specialties).toEqual(['Freinage', 'Trajectoire']);
    expect(vm.circuitsLabel).toBe('Haute Saintonge · Le Mans');
    expect(vm.sessionPriceLabel).toBe('120 €');

    for (const forbidden of ['rating', 'average', 'score', 'reviewsCount', 'stars', 'note']) {
      expect(vm).not.toHaveProperty(forbidden);
    }
    const serialized = JSON.stringify(vm);
    expect(serialized).not.toContain('4.7');
    expect(serialized).not.toContain('99');
  });

  it('replis honnêtes : nom par défaut, prix absent = null', () => {
    const listing = {
      coachId: 'c2',
      headline: null,
      bio: null,
      photoUrl: null,
      circuits: [],
      specialties: [],
      sessionPriceEur: null,
      seasonPriceEur: null,
    } as unknown as CoachListing;
    const vm = coachCardMap(listing);
    expect(vm.name).toBe('Coach OXV');
    expect(vm.sessionPriceLabel).toBeNull();
    expect(vm.circuitsLabel).toBeNull();
  });

  it('tri neutre alphabétique (jamais un palmarès)', () => {
    const a = coachCardMap({
      coachId: 'a',
      headline: 'Zoé',
      circuits: [],
      specialties: [],
    } as unknown as CoachListing);
    const b = coachCardMap({
      coachId: 'b',
      headline: 'Adrien',
      circuits: [],
      specialties: [],
    } as unknown as CoachListing);
    expect(sortCoachCards([a, b]).map((c) => c.name)).toEqual(['Adrien', 'Zoé']);
  });
});

describe('reviewCitations — DOCTRINE : citations, jamais d’étoile', () => {
  function review(partial: Partial<CoachReview>): CoachReview {
    return {
      id: partial.id ?? 'r',
      rating: partial.rating ?? 3,
      comment: partial.comment ?? null,
      pilotFirstName: partial.pilotFirstName ?? null,
      createdAt: partial.createdAt ?? '2026-07-16T10:00:00Z',
    };
  }

  it('ne retient que les avis AVEC texte, et n’expose jamais la note', () => {
    const reviews: CoachReview[] = [
      review({ id: 'r1', rating: 5, comment: 'Très pédagogue', pilotFirstName: 'Marie' }),
      review({ id: 'r2', rating: 1, comment: null, pilotFirstName: 'Luc' }), // note seule → écartée
      review({ id: 'r3', rating: 3, comment: '   ', pilotFirstName: null }), // vide → écartée
      review({ id: 'r4', rating: 4, comment: 'Au top', pilotFirstName: null }), // auteur repli
    ];
    const citations = reviewCitations(reviews);
    expect(citations).toHaveLength(2);
    expect(citations[0]).toEqual({ id: 'r1', quote: 'Très pédagogue', author: 'Marie' });
    expect(citations[1].author).toBe('Un pilote');

    for (const c of citations) {
      expect(c).not.toHaveProperty('rating');
      expect(Object.keys(c).sort()).toEqual(['author', 'id', 'quote']);
    }
    // La note étoilée n'apparaît nulle part.
    const serialized = JSON.stringify(citations);
    expect(serialized).not.toContain('rating');
    expect(serialized).not.toContain('"5"');
  });
});

describe('timeline des demandes', () => {
  it('mappe les statuts en étapes de frise', () => {
    expect(bookingTimelineStep('pending')).toBe('envoyee');
    expect(bookingTimelineStep('accepted')).toBe('acceptee');
    expect(bookingTimelineStep('declined')).toBe('declinee');
    expect(bookingTimelineStep('completed')).toBe('passee');
    expect(bookingTimelineStep('cancelled')).toBe('close');
  });
  it('avis possible uniquement après une séance passée', () => {
    expect(bookingIsPast('completed')).toBe(true);
    expect(bookingIsPast('accepted')).toBe(false);
  });
});
