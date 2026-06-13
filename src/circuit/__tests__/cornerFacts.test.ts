import { cornerFacts } from '../cornerFacts';
import { DEMO_SESSION_INSIGHTS } from '../sessionInsights';

describe('cornerFacts', () => {
  it('assemble les faits du virage 5 (épingle) depuis la démo', () => {
    const facts = cornerFacts(DEMO_SESSION_INSIGHTS, 5);
    const byLabel = Object.fromEntries(facts.map((f) => [f.label, f.value]));
    expect(byLabel["Vitesse d'apex"]).toBe('65 km/h');
    expect(byLabel['Freinage']).toBe('150 m');
    expect(byLabel['Réaccélération']).toBe('55 m');
    expect(byLabel['G latéral à la corde']).toBe('1,20 g');
    expect(byLabel['Dispersion']).toBe('1,6 m');
    expect(byLabel['Équilibre châssis']).toBe('+6 %');
    expect(byLabel['Transfert de charge']).toBe('0,60 s');
  });

  it('note le signe du sous-virage (châssis négatif)', () => {
    const facts = cornerFacts(DEMO_SESSION_INSIGHTS, 4);
    expect(facts.find((f) => f.label === 'Équilibre châssis')?.value).toBe('-12 %');
  });

  it('rien sans session', () => {
    expect(cornerFacts(null, 1)).toEqual([]);
  });

  it('rien pour un virage hors plage', () => {
    expect(cornerFacts(DEMO_SESSION_INSIGHTS, 99)).toEqual([]);
  });
});
