import {
  INTENTION_MAX,
  PENDING_FRESHNESS_MS,
  isPendingFresh,
  normalizeIntention,
} from '../intentionLogic';

describe('normalizeIntention', () => {
  it('retourne null sur vide ou blancs (rien à enregistrer)', () => {
    expect(normalizeIntention('')).toBeNull();
    expect(normalizeIntention('   \n\t ')).toBeNull();
  });

  it('rogne les bords sans toucher au fond', () => {
    expect(normalizeIntention('  Apprivoiser le virage 3.  ')).toBe('Apprivoiser le virage 3.');
  });

  it('borne la longueur maximale', () => {
    const long = 'a'.repeat(INTENTION_MAX + 50);
    expect(normalizeIntention(long)).toHaveLength(INTENTION_MAX);
  });

  it('ne complète, ni ne reformule, ni ne suggère (texte rendu = texte donné)', () => {
    expect(normalizeIntention('Rouler posé.')).toBe('Rouler posé.');
  });
});

describe('isPendingFresh', () => {
  const now = Date.parse('2026-06-29T12:00:00Z');

  it('est fraîche dans la fenêtre', () => {
    expect(isPendingFresh('2026-06-29T11:00:00Z', now)).toBe(true); // 1 h
    expect(isPendingFresh(new Date(now - PENDING_FRESHNESS_MS + 1000).toISOString(), now)).toBe(
      true
    );
  });

  it('n’est plus fraîche au-delà de la fenêtre (anti-rattachement d’une vieille intention)', () => {
    expect(isPendingFresh('2026-06-28T10:00:00Z', now)).toBe(false); // 26 h
    expect(isPendingFresh(new Date(now - PENDING_FRESHNESS_MS - 1000).toISOString(), now)).toBe(
      false
    );
  });

  it('tolère un created_at légèrement futur (biais d’horloge serveur)', () => {
    expect(isPendingFresh('2026-06-29T12:01:00Z', now)).toBe(true);
  });

  it('rejette une date invalide', () => {
    expect(isPendingFresh('pas-une-date', now)).toBe(false);
  });
});
