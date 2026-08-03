/**
 * S'ABONNER N'EST PAS RECEVOIR.
 *
 * `postgres_changes` ne livre que les tables inscrites à la publication
 * `supabase_realtime`. Au 03/08/2026, `telemetry_sessions` n'y est PAS — seule
 * `coach_annotations` l'est.
 *
 * Un canal portant sur une table non publiée rejoint quand même, et son statut
 * passe à `SUBSCRIBED`. Déduire « en direct » de ce statut serait un mensonge
 * qu'aucune erreur ne signalerait : la garde posée, non armée.
 *
 * Ces tests fixent la seule règle qui tienne : le mot « direct » n'apparaît
 * qu'après un évènement REÇU.
 */

import { phraseFraicheur } from '@/features/admin/fraicheurLogic';

const LU = new Date('2026-08-03T09:07:00');

describe('phraseFraicheur', () => {
  it('rien reçu → aucune promesse de direct, même abonné', () => {
    // LE CAS QUI COMPTE. C'est l'état d'aujourd'hui : la table n'est pas
    // publiée, le canal rejoint, et rien n'arrivera jamais.
    const p = phraseFraicheur({ abonne: true, recuAuMoinsUn: false }, LU);
    expect(p).not.toMatch(/direct/i);
    expect(p).toContain('09:07');
  });

  it('pas encore abonné → on dit seulement quand on a lu', () => {
    const p = phraseFraicheur({ abonne: false, recuAuMoinsUn: false }, LU);
    expect(p).not.toMatch(/direct/i);
    expect(p).toContain('09:07');
  });

  it('un évènement reçu → et SEULEMENT là, on annonce le direct', () => {
    const p = phraseFraicheur({ abonne: true, recuAuMoinsUn: true }, LU);
    expect(p).toMatch(/direct/i);
  });

  it('un évènement reçu prime, même si le canal a depuis décroché', () => {
    // Le canal peut se reconnecter ; ce qui a été reçu a été reçu. On ne
    // rétrograde pas l'affichage à chaque hoquet de réseau.
    const p = phraseFraicheur({ abonne: false, recuAuMoinsUn: true }, LU);
    expect(p).toMatch(/direct/i);
  });

  it('sans heure de lecture, on n’invente pas d’horodatage', () => {
    for (const etat of [
      { abonne: false, recuAuMoinsUn: false },
      { abonne: true, recuAuMoinsUn: false },
    ]) {
      const p = phraseFraicheur(etat, null);
      expect(p).not.toMatch(/\d{2}:\d{2}/);
    }
  });

  it('l’heure est toujours sur deux chiffres', () => {
    const p = phraseFraicheur(
      { abonne: false, recuAuMoinsUn: false },
      new Date('2026-08-03T07:05:00')
    );
    expect(p).toContain('07:05');
  });
});
