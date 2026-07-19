/**
 * Garde SEC-1 : `coach_profiles.payment_link` est publié (policy
 * read_published) — on n'y accepte qu'une URL http(s), jamais un IBAN.
 * Logique pure (coachBillingLogic), zéro mock.
 */

import { isAcceptablePaymentLink } from '../coachBillingLogic';

describe('isAcceptablePaymentLink', () => {
  it('accepte une URL https', () => {
    expect(isAcceptablePaymentLink('https://pay.example.com/coach-42')).toBe(true);
  });

  it('accepte une URL http', () => {
    expect(isAcceptablePaymentLink('http://paypal.me/coach')).toBe(true);
  });

  it('accepte le vide et null (effacement du lien)', () => {
    expect(isAcceptablePaymentLink('')).toBe(true);
    expect(isAcceptablePaymentLink('   ')).toBe(true);
    expect(isAcceptablePaymentLink(null)).toBe(true);
    expect(isAcceptablePaymentLink(undefined)).toBe(true);
  });

  it('refuse un IBAN français (avec ou sans espaces, minuscules comprises)', () => {
    expect(isAcceptablePaymentLink('FR7630006000011234567890189')).toBe(false);
    expect(isAcceptablePaymentLink('FR76 3000 6000 0112 3456 7890 189')).toBe(false);
    expect(isAcceptablePaymentLink('fr7630006000011234567890189')).toBe(false);
  });

  it('refuse un IBAN étranger', () => {
    expect(isAcceptablePaymentLink('DE89370400440532013000')).toBe(false);
  });

  it('refuse du texte libre non-URL', () => {
    expect(isAcceptablePaymentLink('me contacter par SMS')).toBe(false);
    expect(isAcceptablePaymentLink('www.sans-schema.fr')).toBe(false);
  });
});
