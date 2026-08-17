/**
 * Le trajet d'une sortie : rendez-vous → restaurant → circuit, dans cet ordre,
 * et un refus qui dit ce qui manque plutôt qu'un « impossible » nu.
 */

import {
  messageRefus,
  planifierTrajet,
  pointValide,
  resumeTrajet,
  type CompositionSortie,
} from '../sortieTrajetLogic';

const RDV = { nom: 'Place de Pons', point: { lat: 45.58, lon: -0.55 } };
const RESTO = { nom: 'La Table du Cognac', point: { lat: 45.5, lon: -0.4 } };
const CIRCUIT = { nom: 'Circuit de Haute Saintonge', point: { lat: 45.2415, lon: -0.0915 } };

const COMPLET: CompositionSortie = { rendezVous: RDV, restaurant: RESTO, circuit: CIRCUIT };

describe('pointValide', () => {
  it('accepte des coordonnées réelles', () => {
    expect(pointValide({ lat: 45.6, lon: -0.4 })).toBe(true);
    expect(pointValide({ lat: 0, lon: 0 })).toBe(true);
  });

  it('refuse l’absent et le non fini', () => {
    expect(pointValide(null)).toBe(false);
    expect(pointValide(undefined)).toBe(false);
    expect(pointValide({ lat: Number.NaN, lon: 0 })).toBe(false);
    expect(pointValide({ lat: 0, lon: Number.POSITIVE_INFINITY })).toBe(false);
  });

  /** Hors bornes vient d'une colonne mal remplie, jamais d'un GPS. */
  it('refuse ce qui sort du monde', () => {
    expect(pointValide({ lat: 91, lon: 0 })).toBe(false);
    expect(pointValide({ lat: 0, lon: -181 })).toBe(false);
  });
});

describe('planifierTrajet — l’ordre du parcours', () => {
  it('compose rendez-vous → restaurant → circuit', () => {
    const p = planifierTrajet(COMPLET);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.requete.start).toEqual(RDV.point);
    expect(p.requete.end).toEqual(CIRCUIT.point);
    expect(p.requete.waypoints).toEqual([RESTO.point]);
    expect(p.etapes).toEqual([RDV.nom, RESTO.nom, CIRCUIT.nom]);
  });

  it('sans restaurant, le trajet va droit au circuit', () => {
    const p = planifierTrajet({ ...COMPLET, restaurant: null });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.requete.waypoints).toBeUndefined();
    expect(p.etapes).toEqual([RDV.nom, CIRCUIT.nom]);
  });

  /**
   * Une ligne de `restaurants` peut avoir lat/lon à NULL. Le trajet reste juste
   * — il passe sans détour — mais le restaurant n'est PAS annoncé dans les
   * étapes : promettre un passage qui n'aura pas lieu est pire que le taire.
   */
  it('ignore un restaurant sans coordonnées, et ne l’annonce pas', () => {
    const p = planifierTrajet({
      ...COMPLET,
      restaurant: { nom: 'Sans adresse', point: { lat: Number.NaN, lon: Number.NaN } },
    });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.requete.waypoints).toBeUndefined();
    expect(p.etapes).not.toContain('Sans adresse');
  });

  it('évite les voies rapides — une sortie passe par les routes', () => {
    const p = planifierTrajet(COMPLET);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.requete.avoidMotorways).toBe(true);
  });
});

describe('planifierTrajet — les refus disent ce qui manque', () => {
  it('refuse sans rendez-vous', () => {
    const p = planifierTrajet({ ...COMPLET, rendezVous: null });
    expect(p).toEqual({ ok: false, refus: 'sans_rendez_vous' });
  });

  it('refuse sans circuit', () => {
    const p = planifierTrajet({ ...COMPLET, circuit: null });
    expect(p).toEqual({ ok: false, refus: 'sans_circuit' });
  });

  it('refuse un rendez-vous improjetable comme s’il était absent', () => {
    const p = planifierTrajet({
      ...COMPLET,
      rendezVous: { nom: 'Nulle part', point: { lat: Number.NaN, lon: 0 } },
    });
    expect(p).toEqual({ ok: false, refus: 'sans_rendez_vous' });
  });

  /** Un trajet de zéro mètre n'est pas un trajet — on le dit plutôt que de l'appeler. */
  it('refuse un rendez-vous confondu avec le circuit', () => {
    const p = planifierTrajet({
      ...COMPLET,
      rendezVous: { nom: 'Sur place', point: CIRCUIT.point },
    });
    expect(p).toEqual({ ok: false, refus: 'meme_point' });
  });

  it('chaque refus porte un message, et aucun ne dit « impossible »', () => {
    for (const r of ['sans_rendez_vous', 'sans_circuit', 'meme_point'] as const) {
      const m = messageRefus(r);
      expect(m.length).toBeGreaterThan(0);
      expect(m.toLowerCase()).not.toContain('impossible');
    }
  });
});

describe('resumeTrajet — des faits, aucun chiffre de performance', () => {
  it('enchaîne les étapes par des flèches', () => {
    expect(resumeTrajet([RDV.nom, RESTO.nom, CIRCUIT.nom])).toBe(
      'Place de Pons → La Table du Cognac → Circuit de Haute Saintonge'
    );
  });

  it('saute les noms vides plutôt que de laisser une flèche orpheline', () => {
    expect(resumeTrajet(['A', '', '  ', 'B'])).toBe('A → B');
  });

  it('ne produit ni durée, ni distance, ni vitesse', () => {
    const r = resumeTrajet([RDV.nom, RESTO.nom, CIRCUIT.nom]);
    expect(r).not.toMatch(/\bkm\b|\bmin\b|km\/h/i);
  });

  it('une liste vide rend une chaîne vide', () => {
    expect(resumeTrajet([])).toBe('');
  });
});
