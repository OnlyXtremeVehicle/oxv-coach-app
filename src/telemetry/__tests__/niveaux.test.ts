/**
 * Les cinq niveaux, et surtout : la preuve que ce ne sont pas des paliers.
 * Jalon 4, phase 4septies.
 *
 * ---
 *
 * CE QUE CES TESTS PROTÈGENT
 *
 * « Cinq niveaux qui s'ouvrent » peut dériver en mécanique de progression à la
 * première refonte venue. La doctrine l'interdit — aucun classement, aucun
 * score, aucune récompense.
 *
 * Le garde-fou n'est pas une intention, c'est une propriété : **aucune ouverture
 * ne dépend d'un autre niveau**. Le test central en fait la démonstration en
 * construisant une séance où le rang 4 est ouvert sous un rang 2 fermé. Si
 * quelqu'un enchaîne un jour les niveaux, ce test tombe.
 */

import { BANQUE } from '../provenance';
import {
  compteCanaux,
  compteToursComparables,
  etatDepuisSeance,
  etatNiveau,
  etatsNiveaux,
  niveau,
  NIVEAUX,
  TOURS_POUR_DISPERSION,
  TRAMES_POUR_NUAGE,
  type CleNiveau,
  type EtatSeance,
} from '../niveaux';

const VIDE: EtatSeance = {
  toursChronometres: 0,
  toursComparables: 0,
  tramesAvecLacet: 0,
  tramesAvecAcceleration: 0,
};

const CLES: CleNiveau[] = ['chrono', 'regularite', 'delta', 'phases', 'enveloppe'];

function compteur(cle: CleNiveau, seance: EtatSeance): string | null {
  const e = etatNiveau(cle, seance);
  return e.ouvert ? null : e.compteur;
}

describe('la liste', () => {
  it('porte cinq niveaux', () => {
    expect(NIVEAUX).toHaveLength(5);
  });

  it('va du moins technique au plus technique, sans trou ni doublon', () => {
    expect(NIVEAUX.map((n) => n.rang)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(NIVEAUX.map((n) => n.cle)).size).toBe(5);
  });

  it('se retrouve par clé', () => {
    for (const cle of CLES) expect(niveau(cle)?.cle).toBe(cle);
  });

  /**
   * Un niveau ne peut pas afficher une grandeur dont personne n'a dit d'où elle
   * vient. C'est la règle fondateur — toute valeur affichée trace vers une
   * source réelle — appliquée à l'étage au-dessus du registre.
   */
  it('ne cite que des grandeurs enregistrées au registre de provenance', () => {
    const connues = new Set(BANQUE.map((g) => g.cle));
    for (const n of NIVEAUX) {
      expect(n.grandeurs.length).toBeGreaterThan(0);
      for (const g of n.grandeurs) {
        expect(connues.has(g)).toBe(true);
      }
    }
  });
});

describe('ce ne sont pas des paliers', () => {
  /**
   * LE TEST CENTRAL.
   *
   * Deux tours comparables et un gyroscope : `delta` (rang 3) et `phases`
   * (rang 4) sont ouverts, tandis que `regularite` (rang 2), qui demande trois
   * tours, reste fermé.
   *
   * Une échelle ne peut pas produire cet état. Si ce test tombe, quelqu'un a
   * enchaîné les niveaux et introduit une progression.
   */
  it('un niveau haut s’ouvre sous un niveau bas fermé', () => {
    const seance: EtatSeance = {
      toursChronometres: 2,
      toursComparables: 2,
      tramesAvecLacet: 500,
      tramesAvecAcceleration: 0,
    };
    expect(etatNiveau('regularite', seance).ouvert).toBe(false);
    expect(etatNiveau('delta', seance).ouvert).toBe(true);
    expect(etatNiveau('phases', seance).ouvert).toBe(true);
    expect(etatNiveau('enveloppe', seance).ouvert).toBe(false);
  });

  /**
   * L'inverse aussi : beaucoup de tours sans aucun capteur inertiel ouvre les
   * trois premiers et ferme les deux derniers. Aucun ordre n'est imposé.
   */
  it('les niveaux bas s’ouvrent sans les hauts', () => {
    const seance: EtatSeance = {
      toursChronometres: 12,
      toursComparables: 12,
      tramesAvecLacet: 0,
      tramesAvecAcceleration: 0,
    };
    const ouverts = etatsNiveaux(seance)
      .filter((x) => x.etat.ouvert)
      .map((x) => x.niveau.cle);
    expect(ouverts).toEqual(['chrono', 'regularite', 'delta']);
  });

  it('aucune ouverture ne change quand on ne touche qu’aux autres conditions', () => {
    const base: EtatSeance = {
      toursChronometres: 5,
      toursComparables: 4,
      tramesAvecLacet: 0,
      tramesAvecAcceleration: 0,
    };
    const avecCapteurs: EtatSeance = {
      ...base,
      tramesAvecLacet: 900,
      tramesAvecAcceleration: 900,
    };
    // Les trois premiers ne bougent pas : ils ne regardent pas les capteurs.
    for (const cle of ['chrono', 'regularite', 'delta'] as const) {
      expect(etatNiveau(cle, base).ouvert).toBe(etatNiveau(cle, avecCapteurs).ouvert);
    }
  });
});

describe('les conditions d’ouverture', () => {
  it('une séance vide ferme les cinq, chacun avec son compteur', () => {
    const etats = etatsNiveaux(VIDE);
    expect(etats).toHaveLength(5);
    for (const { etat } of etats) {
      expect(etat.ouvert).toBe(false);
      if (!etat.ouvert) expect(etat.compteur.length).toBeGreaterThan(10);
    }
  });

  it('un tour bouclé ouvre le chrono, et lui seul', () => {
    const seance = { ...VIDE, toursChronometres: 1 };
    expect(etatNiveau('chrono', seance).ouvert).toBe(true);
    expect(etatNiveau('regularite', seance).ouvert).toBe(false);
  });

  it('la régularité demande trois tours, et le seuil est nommé', () => {
    expect(TOURS_POUR_DISPERSION).toBe(3);
    expect(etatNiveau('regularite', { ...VIDE, toursChronometres: 2 }).ouvert).toBe(false);
    expect(etatNiveau('regularite', { ...VIDE, toursChronometres: 3 }).ouvert).toBe(true);
  });

  it('le delta demande deux tours comparables', () => {
    expect(etatNiveau('delta', { ...VIDE, toursComparables: 1 }).ouvert).toBe(false);
    expect(etatNiveau('delta', { ...VIDE, toursComparables: 2 }).ouvert).toBe(true);
  });

  it('les phases demandent la vitesse de lacet, en quantité nommée', () => {
    expect(TRAMES_POUR_NUAGE).toBe(100);
    expect(etatNiveau('phases', { ...VIDE, tramesAvecLacet: 99 }).ouvert).toBe(false);
    expect(etatNiveau('phases', { ...VIDE, tramesAvecLacet: 100 }).ouvert).toBe(true);
  });

  it('l’enveloppe demande les accélérations', () => {
    expect(etatNiveau('enveloppe', { ...VIDE, tramesAvecAcceleration: 99 }).ouvert).toBe(false);
    expect(etatNiveau('enveloppe', { ...VIDE, tramesAvecAcceleration: 100 }).ouvert).toBe(true);
  });
});

describe('ce qu’un compteur a le droit de dire', () => {
  /** Toutes les formulations que le module peut produire, en un seul endroit. */
  const TOUS: string[] = [];
  for (const seance of [
    VIDE,
    { ...VIDE, toursChronometres: 1 },
    { ...VIDE, toursChronometres: 2 },
    { ...VIDE, toursComparables: 1 },
    { ...VIDE, tramesAvecLacet: 40 },
    { ...VIDE, tramesAvecAcceleration: 40 },
  ]) {
    for (const cle of CLES) {
      const c = compteur(cle, seance);
      if (c) TOUS.push(c);
    }
  }

  it('produit bien des compteurs à examiner', () => {
    expect(TOUS.length).toBeGreaterThan(10);
  });

  /**
   * « 2/3 », « 66 % » ou une barre énoncent une progression vers une
   * récompense. Un compteur énonce un état et un besoin.
   */
  it('aucun ne prend la forme d’une jauge', () => {
    for (const c of TOUS) {
      expect(c).not.toMatch(/\d+\s*\/\s*\d+/);
      expect(c).not.toMatch(/%/);
      expect(c).not.toMatch(/\bsur\s+(un|deux|trois|quatre|cinq|\d)/i);
    }
  });

  /** Le vocabulaire du jeu, nommément proscrit. */
  it('aucun ne parle de déblocage, de progression ou de palier', () => {
    for (const c of TOUS) {
      expect(c).not.toMatch(/déblo|debloq|verrouill|palier|progress|niveau|atteint|récompense/i);
    }
  });

  it('aucun n’est prescriptif, ni tutoyant, ni orné', () => {
    for (const c of TOUS) {
      expect(c).not.toMatch(/vous devez|il faut|veuillez|essayez|roulez plus/i);
      expect(c).not.toMatch(/\btu\b|\bton\b|\btes\b/i);
      expect(c).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  /**
   * Doctrine, principe 1 : « marge », jamais « limite ». Vaut pour tout texte
   * que le module peut mettre à l'écran, compteurs comme descriptions.
   */
  it('aucun texte du module ne dit « limite »', () => {
    const textes = [...TOUS, ...NIVEAUX.flatMap((n) => [n.nom, n.contenu, n.lecture])];
    for (const t of textes) {
      expect(t.toLowerCase()).not.toMatch(/limite/);
    }
  });

  /**
   * Un niveau fermé faute de capteur est fermé par le BOÎTIER. Le dire ainsi
   * retire toute lecture méritocratique — le pilote n'y est pour rien.
   */
  it('les compteurs de capteur nomment le canal absent, pas le pilote', () => {
    expect(compteur('phases', VIDE)).toMatch(/lacet/i);
    expect(compteur('enveloppe', VIDE)).toMatch(/accélérations/i);
    for (const cle of ['phases', 'enveloppe'] as const) {
      expect(compteur(cle, VIDE)).not.toMatch(/vous|votre/i);
    }
  });

  it('les compteurs de tours écrivent les petits nombres en lettres', () => {
    expect(compteur('regularite', { ...VIDE, toursChronometres: 2 })).toContain('Deux tours');
    expect(compteur('regularite', { ...VIDE, toursChronometres: 1 })).toContain('Un tour');
  });
});

describe('ce qui compte comme un tour', () => {
  const trame = { gLat: null, gLong: null, yawRateRadS: null };
  const RIEN = { tramesAvecLacet: 0, tramesAvecAcceleration: 0 };

  /**
   * LE CAS RÉEL, PRIS EN BASE.
   *
   * L'unique ligne `laps` de production est un tour de sortie de stand :
   * `is_outlap = true`, `duration_seconds = 0,022`, `max_speed_kmh = 1,39`,
   * `distance_meters = 0`. Le compter ouvrirait le chrono et lui ferait
   * afficher vingt-deux millisecondes en chiffre roi.
   */
  it('un tour de sortie de stand n’ouvre pas le chrono', () => {
    const etat = etatDepuisSeance([{ longueurM: 0, estOutlap: true }], RIEN);
    expect(etat.toursChronometres).toBe(0);
    expect(etatNiveau('chrono', etat).ouvert).toBe(false);
  });

  it('un tour de rentrée non plus', () => {
    expect(etatDepuisSeance([{ longueurM: 3000, estInlap: true }], RIEN).toursChronometres).toBe(0);
  });

  it('un tour ordinaire compte', () => {
    const etat = etatDepuisSeance([{ longueurM: 3000 }], RIEN);
    expect(etat.toursChronometres).toBe(1);
    expect(etatNiveau('chrono', etat).ouvert).toBe(true);
  });

  it('sortie et rentrée sont retirées d’une séance complète', () => {
    const etat = etatDepuisSeance(
      [
        { longueurM: 500, estOutlap: true },
        { longueurM: 3000 },
        { longueurM: 3010 },
        { longueurM: 2990 },
        { longueurM: 800, estInlap: true },
      ],
      RIEN
    );
    expect(etat.toursChronometres).toBe(3);
    expect(etat.toursComparables).toBe(3);
    expect(etatNiveau('regularite', etat).ouvert).toBe(true);
  });

  /** Un tour isolé n'est comparable à rien : son delta divergerait. */
  it('un tour de longueur isolée n’est comparable à personne', () => {
    expect(compteToursComparables([3000, 3010, 1200])).toBe(2);
    expect(compteToursComparables([3000])).toBe(0);
    expect(compteToursComparables([])).toBe(0);
  });

  it('une longueur non mesurable ne compte pas comme comparable', () => {
    expect(compteToursComparables([null, null])).toBe(0);
    expect(compteToursComparables([3000, null])).toBe(0);
  });

  it('les trames se comptent par canal réellement présent', () => {
    const c = compteCanaux([
      { ...trame, yawRateRadS: 0.3 },
      { ...trame, gLat: 0.4, gLong: -0.2 },
      // Un seul axe : pas un point du plan (g_lat, g_long).
      { ...trame, gLat: 0.4 },
      trame,
    ]);
    expect(c.tramesAvecLacet).toBe(1);
    expect(c.tramesAvecAcceleration).toBe(1);
  });

  it('un canal non fini ne compte pas', () => {
    const c = compteCanaux([
      { gLat: NaN, gLong: 0.2, yawRateRadS: Infinity },
      { gLat: 0.1, gLong: 0.2, yawRateRadS: 0.1 },
    ]);
    expect(c.tramesAvecLacet).toBe(1);
    expect(c.tramesAvecAcceleration).toBe(1);
  });

  /** Un compte venu de la base est un entier positif ; on s'en assure. */
  it('un compte aberrant est ramené à un entier positif', () => {
    const etat = etatDepuisSeance([], {
      tramesAvecLacet: -5,
      tramesAvecAcceleration: 12.7,
    });
    expect(etat.tramesAvecLacet).toBe(0);
    expect(etat.tramesAvecAcceleration).toBe(12);
  });
});
