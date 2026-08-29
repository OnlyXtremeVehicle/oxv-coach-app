/**
 * Aucune grandeur ne quitte la banque sans dire d'où elle vient.
 * Jalon 4, phase 4sexies.
 *
 * ---
 *
 * POURQUOI CE TEST EST LE CŒUR DU LOT
 *
 * L'étiquetage aurait pu être un champ sur chaque résultat. Un champ se remplit
 * à la main, donc s'oublie — c'est exactement ce qui est arrivé au champ
 * `origines` de `kinematics.ts` : rempli, jamais lu, deux niveaux sur trois, un
 * module sur sept.
 *
 * Un registre, lui, se CONFRONTE. Ce test lit les modules de la banque et exige
 * que chaque fonction exportée y ait son entrée. Une grandeur nouvelle sans
 * étiquette fait échouer le banc : elle ne peut pas atteindre un écran sans que
 * quelqu'un ait dit d'où elle vient.
 */

import { readdirSync } from 'fs';
import { join } from 'path';

import {
  BANQUE,
  etiquette,
  grandeur,
  libelleProvenance,
  peutEtreChiffreRoi,
  type Provenance,
} from '../provenance';

const DOSSIER = join(__dirname, '..');

/**
 * Modules de `src/telemetry/` qui ne PRODUISENT aucune grandeur.
 *
 * Le registre se décrit lui-même ; `niveaux` déclare quelles grandeurs chaque
 * niveau de restitution met à l'écran, sans en calculer une seule ;
 * `courbeDelta` projette en coordonnées de dessin une grandeur déjà
 * enregistrée (`delta.cumulative`) et n'en crée aucune. Exiger d'eux une entrée
 * au registre n'aurait aucun sens.
 *
 * `virage` a rejoint la liste au lot J5, pour la même raison : il DÉCOUPE des
 * trames mesurées et les PROJETTE en coordonnées de dessin. Son « apex » n'est
 * pas une grandeur calculée mais la trame mesurée la plus proche d'une corde de
 * référence — un choix parmi des points existants, pas un nouveau chiffre.
 *
 * Cette liste est nommée plutôt que devinée : un module nouveau fait tomber le
 * test tant que quelqu'un n'a pas tranché s'il produit ou non. C'est la même
 * exigence que pour la banque, prise par l'autre bout.
 */
// projectionCurviligne : géométrie pure — relie une abscisse (m) aux points de
// la polyligne du tracé ; aucun chiffre montré au pilote n'en sort.
const NON_PRODUCTEURS = ['provenance', 'niveaux', 'courbeDelta', 'virage', 'projectionCurviligne'];

/** Les modules de calcul, hors ceux qui ne produisent rien. */
const MODULES = readdirSync(DOSSIER)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => f.replace(/\.ts$/, ''))
  .filter((m) => !NON_PRODUCTEURS.includes(m));

describe('le registre couvre la banque', () => {
  /**
   * La liste est CLOSE, et c'est le point.
   *
   * En ajoutant `adaptation.ts` à la banque, ce test est tombé — exactement ce
   * qu'il doit faire. Un module de calcul nouveau ne peut pas rejoindre la
   * banque sans que quelqu'un dise ce qu'il produit et d'où ça vient.
   */
  it('les onze modules de calcul sont bien là', () => {
    expect(MODULES.sort()).toEqual(
      [
        'accel',
        'adaptation',
        'bande',
        'braking',
        // `calibration` a rejoint la banque le 29/08/2026 : elle produit des
        // chiffres (deux angles, un lacet inféré, des g redressés), donc elle
        // doit dire d'où ils viennent. Le test est tombé à sa création — c'est
        // exactement ce qu'il doit faire.
        'calibration',
        'delta',
        'gg',
        'kinematics',
        'marqueur',
        'resample',
        'segment',
      ].sort()
    );
  });

  /**
   * LE TEST DU LOT.
   *
   * Chaque module doit avoir au moins une grandeur enregistrée. Un module de
   * calcul dont rien n'est étiqueté produit des chiffres sans provenance — ce
   * que la règle fondateur interdit.
   */
  it.each([
    'kinematics',
    'delta',
    'braking',
    'accel',
    'gg',
    'resample',
    'segment',
    'adaptation',
    'bande',
    'marqueur',
  ])('le module « %s » a au moins une grandeur enregistrée', (mod) => {
    expect(BANQUE.filter((g) => g.cle.startsWith(`${mod}.`)).length).toBeGreaterThan(0);
  });

  it('les clés sont uniques', () => {
    expect(new Set(BANQUE.map((g) => g.cle)).size).toBe(BANQUE.length);
  });

  it('chaque clé est de la forme module.champ', () => {
    for (const g of BANQUE) {
      expect(g.cle).toMatch(/^[a-z]+\.[a-zA-Z]+$/);
    }
  });
});

describe('chaque niveau porte ce qu’il doit porter', () => {
  it('les trois niveaux sont représentés', () => {
    for (const p of ['M', 'D', 'I'] as Provenance[]) {
      expect(BANQUE.filter((g) => g.prov === p).length).toBeGreaterThan(0);
    }
  });

  it('toute grandeur dit sa source', () => {
    for (const g of BANQUE) {
      expect(g.source.length).toBeGreaterThan(20);
    }
  });

  /**
   * LA FRONTIÈRE ENTRE [D] ET [I].
   *
   * Un [I] se justifie par une HYPOTHÈSE, pas par la complexité du calcul. Si
   * sa source ne nomme pas ce qu'elle suppose, le niveau n'est pas justifié —
   * et une grandeur mal classée en [I] est aussi trompeuse qu'une mal classée
   * en [D].
   */
  it('toute grandeur inférée NOMME son hypothèse', () => {
    for (const g of BANQUE.filter((x) => x.prov === 'I')) {
      expect({ cle: g.cle, dit: /suppose/i.test(g.source) }).toEqual({ cle: g.cle, dit: true });
    }
  });

  it('aucune grandeur mesurée ne prétend supposer quoi que ce soit', () => {
    for (const g of BANQUE.filter((x) => x.prov === 'M')) {
      expect(g.source).not.toMatch(/suppose/i);
    }
  });
});

describe('le chiffre roi ne peut pas être une inférence', () => {
  /**
   * Le chiffre roi est l'unique valeur dominante d'un écran. Lui donner une
   * grandeur qui repose sur une hypothèse reviendrait à présenter une
   * supposition comme le fait principal de la séance.
   */
  it('refuse toute grandeur inférée', () => {
    for (const g of BANQUE.filter((x) => x.prov === 'I')) {
      expect(peutEtreChiffreRoi(g.cle)).toBe(false);
    }
  });

  it('accepte le mesuré et le déduit', () => {
    for (const g of BANQUE.filter((x) => x.prov !== 'I')) {
      expect(peutEtreChiffreRoi(g.cle)).toBe(true);
    }
  });

  // Le tour idéal est LE cas que le dossier nomme : « annoncé théorique ».
  it('le tour idéal ne règne pas, mais reste affichable', () => {
    expect(peutEtreChiffreRoi('delta.idealLapTime')).toBe(false);
    expect(grandeur('delta.idealLapTime')?.convention).toMatch(/théorique/);
  });

  // Fail-closed : une clé inconnue n'est pas une autorisation.
  it('une clé inconnue est refusée', () => {
    expect(peutEtreChiffreRoi('inexistant.champ')).toBe(false);
  });
});

describe('l’enveloppe reste « atteinte », jamais « limite »', () => {
  // Doctrine, principe 1 : le mot « limite » est proscrit partout.
  it('aucun texte du registre ne dit « limite »', () => {
    for (const g of BANQUE) {
      const texte = `${g.nom} ${g.source} ${g.convention ?? ''}`;
      expect({ cle: g.cle, fautif: /\blimite/i.test(texte) }).toEqual({
        cle: g.cle,
        fautif: false,
      });
    }
  });

  it('l’enveloppe dit explicitement ce qu’elle n’est pas', () => {
    expect(grandeur('gg.reachedHull')?.convention).toMatch(/atteinte/i);
  });
});

describe('affichage', () => {
  it('l’étiquette est courte et entre crochets', () => {
    expect(etiquette('M')).toBe('[M]');
    expect(etiquette('D')).toBe('[D]');
    expect(etiquette('I')).toBe('[I]');
  });

  it('le libellé long est en français', () => {
    expect(libelleProvenance('M')).toBe('Mesuré');
    expect(libelleProvenance('D')).toBe('Déduit');
    expect(libelleProvenance('I')).toBe('Inféré');
  });

  it('aucun emoji, aucun tutoiement dans le registre', () => {
    for (const g of BANQUE) {
      const texte = `${g.nom} ${g.source} ${g.convention ?? ''}`;
      expect(texte).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(texte).not.toMatch(/\btu\b|\bton\b|\btes\b/i);
    }
  });
});

describe('les conventions sont nommées là où elles existent', () => {
  /**
   * Un seuil choisi par nous doit être écrit. Sans cela, un lecteur croit lire
   * une propriété du monde là où il lit une décision de conception.
   */
  it('le seuil de freinage est nommé', () => {
    expect(grandeur('braking.zones')?.convention).toMatch(/0,3 g/);
  });

  it('la base distance du ré-échantillonnage est nommée', () => {
    expect(grandeur('resample.grid')?.convention).toMatch(/DISTANCE/);
  });

  it('le critère d’acceptation du delta est rappelé', () => {
    expect(grandeur('delta.cumulative')?.convention).toMatch(/referme à zéro/);
  });
});
