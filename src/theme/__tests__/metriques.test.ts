/**
 * Acceptation du jalon 2, phase 1 : **les chaînes françaises sur 320 pt**.
 *
 * ---
 *
 * POURQUOI 320 PT COMMANDE TOUT
 *
 * L'iPhone SE de 1re génération fait 320 pt de large. C'est la seule largeur où
 * les gabarits cassent, et c'est aussi la seule qu'on ne voit jamais en
 * développement — le simulateur ouvre un 390 pt par défaut. Le français aggrave
 * le cas : « Réglages » contre « Settings », « Séances » contre « Runs ».
 *
 * Un texte tronqué ne lève aucune erreur. Il s'affiche, amputé, et personne ne
 * le voit en relecture de code. Même motif que les polices absentes et les
 * gardes inertes trouvées ailleurs dans ce dépôt : **l'absence ne se signale pas
 * d'elle-même**. D'où ce banc.
 *
 * ---
 *
 * CE QUE CE TEST NE PROUVE PAS
 *
 * Il ne rend rien. Il calcule un budget de largeur à partir de la chasse de la
 * fonte. Pour JetBrains Mono le calcul est exact (0,6 em, chasse fixe) ; pour
 * Hanken Grotesk c'est une borne haute prudente. Une mesure sur appareil reste
 * la seule preuve — elle est notée comme telle dans le livrable.
 */

import {
  avanceMono,
  avanceProportionnelle,
  largeurUtile,
  margeEcran,
  tailleChiffreRoi,
  tientAvecReserve,
  PLAFOND_CHIFFRE_ROI_LONG,
  PLANCHER_CHIFFRE_ROI,
} from '../metriques';
import { spacing } from '../v2';

/** Largeurs logiques réelles à couvrir (dossier §IV.1). */
const APPAREILS = [
  { nom: 'iPhone SE 1re', largeur: 320 },
  { nom: 'iPhone SE 3e / 13 mini', largeur: 375 },
  { nom: 'iPhone 14/15/16', largeur: 390 },
  { nom: 'iPhone 16 Pro', largeur: 393 },
  { nom: 'iPhone Plus / Pro Max', largeur: 428 },
  { nom: 'iPhone 16 Pro Max', largeur: 440 },
];

describe('marge d’écran — par palier, jamais proportionnelle', () => {
  it('20 pt de 320 à 414 pt, 24 pt au-delà', () => {
    expect(margeEcran(320)).toBe(20);
    expect(margeEcran(390)).toBe(20);
    expect(margeEcran(414)).toBe(20);
    expect(margeEcran(415)).toBe(24);
    expect(margeEcran(440)).toBe(24);
  });

  // Le palier est un palier : deux appareils du même palier ont la MÊME marge,
  // et non deux valeurs interpolées. C'est ce qui distingue la règle du dossier
  // d'un calcul proportionnel continu.
  it('ne gonfle pas le vide entre deux appareils d’un même palier', () => {
    expect(margeEcran(375)).toBe(margeEcran(393));
    expect(margeEcran(428)).toBe(margeEcran(440));
  });

  it('la largeur utile sur SE est bien de 280 pt', () => {
    expect(largeurUtile(320)).toBe(280);
  });

  it('la largeur utile sur iPhone 14/15/16 est bien de 350 pt', () => {
    expect(largeurUtile(390)).toBe(350);
  });

  it('le jeton d’écran porte la marge du palier majoritaire', () => {
    expect([20, 24]).toContain(spacing.screen);
  });
});

describe('rythme vertical — base 8 pt, demi-pas 4 pt', () => {
  // Toute valeur de l'échelle doit tomber sur le demi-pas. `xl` valait 22 :
  // ni un pas, ni un demi-pas — une valeur qui désalignait 386 emplacements.
  it('chaque jeton d’espacement tombe sur le demi-pas de 4 pt', () => {
    for (const [nom, valeur] of Object.entries(spacing)) {
      expect({ nom, reste: valeur % 4 }).toEqual({ nom, reste: 0 });
    }
  });

  it('l’échelle reste strictement croissante', () => {
    const echelle = [spacing.xs, spacing.sm, spacing.md, spacing.lg, spacing.xl, spacing.xxl];
    for (let i = 1; i < echelle.length; i++) {
      expect(echelle[i]).toBeGreaterThan(echelle[i - 1]);
    }
  });

  // Règle « interne ≤ externe » : un remplissage intérieur qui dépasse la marge
  // d'écran colle le contenu au bord opposé de ce que la marge protège.
  it('l’espacement des frères ne dépasse pas la marge d’écran', () => {
    expect(spacing.lg).toBeLessThanOrEqual(spacing.screen);
  });
});

describe('chiffre roi — plafond, puis repli', () => {
  it('plafonne à 56 pt au-delà de 7 caractères', () => {
    expect(tailleChiffreRoi('1:41,203', 72)).toBe(PLAFOND_CHIFFRE_ROI_LONG);
  });

  it('laisse respirer un chiffre court', () => {
    expect(tailleChiffreRoi('287', 72)).toBe(72);
    expect(tailleChiffreRoi('1,2 G', 64)).toBe(64);
  });

  // 7 caractères exactement : le plafond ne mord pas encore.
  it('le seuil est bien « au-delà de 7 », pas « à partir de 7 »', () => {
    expect(tailleChiffreRoi('1:41,20', 64)).toBe(64);
    expect(tailleChiffreRoi('1:41,203', 64)).toBe(56);
  });

  it('ne remonte jamais au-dessus de la taille souhaitée', () => {
    expect(tailleChiffreRoi('287', 48)).toBe(48);
  });

  /**
   * LE CAS QUI JUSTIFIE LE REPLI.
   *
   * Sur SE, `1:41,203` au plafond de 56 pt occupe 8 × 0,6 × 56 = 268,8 pt pour
   * 280 pt utiles : il « rentre », à 96 % de la largeur, réserve mangée. Le
   * dossier exige 10 % de réserve — le repli descend donc sous le plafond.
   *
   * Autrement dit : le plafond seul n'aurait pas suffi.
   */
  it('replie SOUS le plafond quand la largeur ne suffit pas', () => {
    const dispo = largeurUtile(320);
    const taille = tailleChiffreRoi('1:41,203', 72, dispo);

    expect(taille).toBeLessThan(PLAFOND_CHIFFRE_ROI_LONG);
    expect(tientAvecReserve(avanceMono('1:41,203', taille), dispo)).toBe(true);
  });

  it('sur iPhone 14/15/16 le plafond suffit, sans repli', () => {
    expect(tailleChiffreRoi('1:41,203', 72, largeurUtile(390))).toBe(PLAFOND_CHIFFRE_ROI_LONG);
  });

  it('ne descend jamais sous le plancher de lisibilité', () => {
    expect(tailleChiffreRoi('1:41,203', 72, 40)).toBe(PLANCHER_CHIFFRE_ROI);
  });

  it('sans largeur connue, le plafond s’applique quand même', () => {
    expect(tailleChiffreRoi('1:41,203', 72, null)).toBe(PLAFOND_CHIFFRE_ROI_LONG);
    expect(tailleChiffreRoi('1:41,203', 72, undefined)).toBe(PLAFOND_CHIFFRE_ROI_LONG);
  });

  // Sur TOUS les appareils couverts, un chrono complet tient avec sa réserve.
  it('un chrono complet tient sur chaque largeur couverte', () => {
    for (const { nom, largeur } of APPAREILS) {
      const dispo = largeurUtile(largeur);
      const taille = tailleChiffreRoi('1:41,203', 72, dispo);
      expect({ nom, tient: tientAvecReserve(avanceMono('1:41,203', taille), dispo) }).toEqual({
        nom,
        tient: true,
      });
    }
  });
});

describe('chaînes françaises sur 320 pt — l’acceptation du lot', () => {
  const DISPO = largeurUtile(320);

  /**
   * Libellé de `StatCell` : mono 11 pt, letter-spacing 1,4, capitales. Trois
   * cellules par rangée (grille réelle, ex. `data/saison.tsx`), séparées par
   * `spacing.md`.
   */
  const cellule = (DISPO - 2 * spacing.md) / 3;

  it.each(['Séances', 'Record', 'Distance', 'Réglages', 'Marge'])(
    '« %s » tient dans une cellule de statistique',
    (mot) => {
      const largeur = avanceMono(mot.toUpperCase(), 11, 1.4);
      expect(tientAvecReserve(largeur, cellule)).toBe(true);
    }
  );

  it.each([
    'Réglages',
    'Séances',
    'Notifications',
    'Données & sécurité',
    'Confidentialité',
    'Mes coordonnées',
  ])('« %s » tient dans une ligne de navigation', (mot) => {
    // Ligne pleine largeur, moins l'icône de gauche (24) et le chevron (16),
    // moins leurs gouttières. Corps 15 pt en Hanken Grotesk.
    const reste = DISPO - 24 - 16 - 2 * spacing.md;
    expect(tientAvecReserve(avanceProportionnelle(mot, 15), reste)).toBe(true);
  });

  /**
   * L'unité et la légende du chiffre roi vivent dans une colonne à sa droite.
   * Si cette colonne était comptée dans le budget du chiffre, l'ensemble
   * déborderait — c'est pourquoi `KingNumber` la soustrait avant de replier.
   */
  it('chiffre roi + unité + légende tiennent ensemble', () => {
    const legende = avanceMono('RÉGULARITÉ', 10, 1.6);
    const unite = avanceMono('/100', 11);
    const colonne = Math.max(legende, unite);
    const restant = DISPO - colonne - spacing.sm;

    const taille = tailleChiffreRoi('1:41,203', 72, restant);
    const total = avanceMono('1:41,203', taille) + spacing.sm + colonne;

    expect(total).toBeLessThanOrEqual(DISPO);
    expect(taille).toBeGreaterThanOrEqual(PLANCHER_CHIFFRE_ROI);
  });
});
