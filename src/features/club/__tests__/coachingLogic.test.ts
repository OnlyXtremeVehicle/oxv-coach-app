/**
 * Tests — logique pure du COACHING (V2-L5). Verrous DOCTRINAUX :
 *  - une carte coach n'expose AUCUN score / note / classement ;
 *  - un témoignage ne sort qu'en CITATION (texte + auteur) ; la source
 *    `coach_testimonials` ne porte AUCUNE note (cf. coachDomainNoScore.test.ts).
 */

import type { CoachListing, CoachTestimonial } from '@/services/coachMarketplaceService';

import {
  bookingIsPast,
  bookingTimelineStep,
  clampTabIndex,
  coachCardMap,
  COACHING_TABS,
  euroLabel,
  sortCoachCards,
  tabIndexOf,
  tabKeyFromIndex,
  testimonialCitations,
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

describe('testimonialCitations — DOCTRINE : citations, jamais de note', () => {
  function testimonial(partial: Partial<CoachTestimonial>): CoachTestimonial {
    return {
      id: partial.id ?? 't',
      body: partial.body ?? '',
      authorFirstName: partial.authorFirstName ?? null,
      createdAt: partial.createdAt ?? '2026-07-16T10:00:00Z',
    };
  }

  it('ne retient que les témoignages AVEC texte, et n’expose aucune note', () => {
    const testimonials: CoachTestimonial[] = [
      testimonial({ id: 't1', body: 'Très pédagogue', authorFirstName: 'Marie' }),
      testimonial({ id: 't2', body: '', authorFirstName: 'Luc' }), // vide → écarté
      testimonial({ id: 't3', body: '   ', authorFirstName: null }), // blancs → écarté
      testimonial({ id: 't4', body: 'Au top', authorFirstName: null }), // auteur repli
    ];
    const citations = testimonialCitations(testimonials);
    expect(citations).toHaveLength(2);
    expect(citations[0]).toEqual({ id: 't1', quote: 'Très pédagogue', author: 'Marie' });
    expect(citations[1].author).toBe('Un pilote');

    for (const c of citations) {
      expect(c).not.toHaveProperty('rating');
      expect(Object.keys(c).sort()).toEqual(['author', 'id', 'quote']);
    }
    // Aucune note nulle part (la source n'en porte aucune).
    const serialized = JSON.stringify(citations);
    expect(serialized).not.toContain('rating');
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
