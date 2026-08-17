/**
 * Le géocodage doit rendre des adresses lisibles, et RIEN qu'on ne puisse
 * placer sur une carte. Les deux propriétés sont testées ici ; l'appel réseau,
 * lui, vit dans le service et ne se teste pas sur un banc.
 */

import {
  libelleAdresse,
  nettoyerResultats,
  RECHERCHE_MIN,
  validerRecherche,
  versAdresse,
  type HitGeocode,
} from '../geocodeLogic';

const PT = { lat: 45.6, lng: -0.4 };

describe('validerRecherche', () => {
  it('accepte une recherche assez longue', () => {
    expect(validerRecherche('Jonzac')).toBeNull();
    expect(validerRecherche('  Pons  ')).toBeNull();
  });

  it('refuse le vide et le trop court', () => {
    expect(validerRecherche('')).not.toBeNull();
    expect(validerRecherche('   ')).not.toBeNull();
    expect(validerRecherche('a'.repeat(RECHERCHE_MIN - 1))).not.toBeNull();
  });
});

describe('libelleAdresse — une adresse française, sans virgule orpheline', () => {
  it('compose numéro, rue, code postal et ville', () => {
    expect(
      libelleAdresse({
        housenumber: '12',
        street: 'rue des Vignes',
        postcode: '17240',
        city: 'Saint-Fort',
      })
    ).toBe('12 rue des Vignes, 17240 Saint-Fort');
  });

  it('place le nom devant quand il apporte autre chose', () => {
    expect(libelleAdresse({ name: 'Château de Beaulon', city: 'Saint-Dizant-du-Gua' })).toBe(
      'Château de Beaulon, Saint-Dizant-du-Gua'
    );
  });

  /** GraphHopper rend souvent `name` ET `street` avec la même valeur. */
  it('ne répète pas le nom quand il redit la rue', () => {
    const l = libelleAdresse({ name: 'rue des Vignes', street: 'rue des Vignes', city: 'Pons' });
    expect(l).toBe('rue des Vignes, Pons');
  });

  /** « France » sur chaque ligne pousse le reste hors de l'écran. */
  it('masque la France et montre l’étranger', () => {
    expect(libelleAdresse({ name: 'Pons', country: 'France' })).toBe('Pons');
    expect(libelleAdresse({ name: 'Spa', country: 'Belgique' })).toBe('Spa, Belgique');
  });

  it('ne laisse aucune virgule sur un champ vide', () => {
    for (const h of [
      { name: 'Pons' },
      { street: 'D145' },
      { city: 'Jonzac' },
      { name: '', street: '', city: 'Jonzac' },
    ]) {
      const l = libelleAdresse(h);
      expect(l).not.toMatch(/^,|,\s*$|,\s*,/);
    }
  });

  it('rend une chaîne vide si rien n’est exploitable', () => {
    expect(libelleAdresse({})).toBe('');
  });
});

describe('versAdresse — rien qu’on ne puisse placer', () => {
  it('convertit un hit complet', () => {
    const a = versAdresse({ point: PT, name: 'Pons', city: 'Pons' });
    expect(a).not.toBeNull();
    expect(a?.point).toEqual({ lat: 45.6, lon: -0.4 });
    expect(a?.nom).toBe('Pons');
  });

  /** GraphHopper rend parfois des entités administratives sans coordonnées. */
  it('écarte un hit sans coordonnées finies', () => {
    expect(versAdresse({ name: 'Nulle part' })).toBeNull();
    expect(versAdresse({ point: { lat: Number.NaN, lng: -0.4 }, name: 'X' })).toBeNull();
    expect(versAdresse({ point: { lat: 45.6 }, name: 'X' })).toBeNull();
  });

  it('écarte un hit sans libellé exploitable', () => {
    expect(versAdresse({ point: PT })).toBeNull();
  });

  it('le nom retombe sur le libellé quand il manque', () => {
    const a = versAdresse({ point: PT, street: 'D145', city: 'Jonzac' });
    expect(a?.nom).toBe('D145, Jonzac');
  });
});

describe('nettoyerResultats — le doublon se juge sur la position, pas sur le texte', () => {
  /**
   * LE TEST QUI DÉFINIT LA RÈGLE. Le même lieu revient sous deux noms ;
   * comparer les libellés les garderait tous les deux.
   */
  it('fusionne deux noms différents au même point', () => {
    const hits: HitGeocode[] = [
      { point: PT, name: 'Mairie', city: 'Pons' },
      { point: PT, name: 'Hôtel de ville', city: 'Pons' },
    ];
    const out = nettoyerResultats(hits);
    expect(out).toHaveLength(1);
    expect(out[0].nom).toBe('Mairie');
  });

  it('garde deux lieux réellement distincts', () => {
    const out = nettoyerResultats([
      { point: { lat: 45.6, lng: -0.4 }, name: 'Pons' },
      { point: { lat: 45.45, lng: -0.44 }, name: 'Jonzac' },
    ]);
    expect(out).toHaveLength(2);
  });

  /** Cinq décimales ≈ un mètre : deux points plus proches sont le même endroit. */
  it('fusionne deux points distants de moins d’un mètre', () => {
    const out = nettoyerResultats([
      { point: { lat: 45.600001, lng: -0.400001 }, name: 'A' },
      { point: { lat: 45.600002, lng: -0.400002 }, name: 'B' },
    ]);
    expect(out).toHaveLength(1);
  });

  it('conserve l’ordre du service — c’est lui qui classe par pertinence', () => {
    const out = nettoyerResultats([
      { point: { lat: 45.6, lng: -0.4 }, name: 'Premier' },
      { point: { lat: 45.5, lng: -0.5 }, name: 'Second' },
    ]);
    expect(out.map((a) => a.nom)).toEqual(['Premier', 'Second']);
  });

  it('écarte l’improjetable sans faire échouer le reste', () => {
    const out = nettoyerResultats([
      { name: 'Sans point' },
      { point: PT, name: 'Pons' },
      { point: { lat: Number.POSITIVE_INFINITY, lng: 0 }, name: 'Infini' },
    ]);
    expect(out.map((a) => a.nom)).toEqual(['Pons']);
  });

  it('une liste vide rend une liste vide', () => {
    expect(nettoyerResultats([])).toEqual([]);
  });
});
