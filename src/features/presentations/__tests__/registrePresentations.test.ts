/**
 * Le registre est une TRANSCRIPTION. Ces tests vérifient qu'elle est complète,
 * cohérente avec elle-même, et fidèle aux règles écrites du cahier — pas
 * qu'elle est « bonne » : personne ne peut tester un jugement éditorial.
 */

import {
  FICHES,
  LIBELLES_DONNEES,
  PREMIER_ID_MOTEUR_PREUVE,
  REGISTRE_PRESENTATIONS,
  estMoteurDePreuve,
  presentation,
  type CleDonnee,
} from '../registrePresentations';

describe('registre des présentations', () => {
  it('porte les soixante-cinq fiches, de P01 à P65 sans trou', () => {
    expect(FICHES).toHaveLength(65);
    const attendus = Array.from({ length: 65 }, (_, i) => `P${String(i + 1).padStart(2, '0')}`);
    expect(FICHES.map((f) => f.id)).toEqual(attendus);
  });

  it('aucune fiche vide : nom, question et base sont renseignés', () => {
    for (const f of FICHES) {
      expect(f.nom.trim().length).toBeGreaterThan(0);
      expect(f.question.trim().length).toBeGreaterThan(0);
      expect(f.base.trim().length).toBeGreaterThan(0);
      expect(f.surfaces.length).toBeGreaterThan(0);
    }
  });

  it('chaque question du pilote est bien une question', () => {
    // Les fiches du §05 ouvrent toutes sur QUESTION PILOTE. Une affirmation à
    // cette place serait déjà une conclusion posée à sa place.
    for (const f of FICHES) {
      expect(f.question.endsWith('?')).toBe(true);
    }
  });

  it('toute donnée requise porte un libellé pilote', () => {
    const libelles = LIBELLES_DONNEES as Readonly<Record<string, string>>;
    for (const f of FICHES) {
      for (const cle of f.donneesRequises) {
        expect(typeof libelles[cle]).toBe('string');
        expect(libelles[cle].length).toBeGreaterThan(0);
      }
    }
  });

  it('aucun libellé de donnée n’est mort : chacun sert au moins une fiche', () => {
    const utilisees = new Set<CleDonnee>();
    for (const f of FICHES) for (const c of f.donneesRequises) utilisees.add(c);
    const declarees = Object.keys(LIBELLES_DONNEES) as CleDonnee[];
    const orphelines = declarees.filter((c) => !utilisees.has(c));
    expect(orphelines).toEqual([]);
  });

  /**
   * §06 : « Le pilote n'ouvre par défaut que les P01–P54. Les P55–P65
   * constituent le moteur de preuve professionnel du coach et de l'analyste. »
   */
  it('P55–P65 ne portent jamais la surface pilote', () => {
    const fautives = FICHES.filter(
      (f) => estMoteurDePreuve(f.id) && f.surfaces.includes('pilote')
    ).map((f) => f.id);
    expect(fautives).toEqual([]);
  });

  it('P01–P54 ne sont pas comptées dans le moteur de preuve', () => {
    expect(estMoteurDePreuve('P54')).toBe(false);
    expect(estMoteurDePreuve('P55')).toBe(true);
    expect(estMoteurDePreuve('P65')).toBe(true);
    expect(PREMIER_ID_MOTEUR_PREUVE).toBe(55);
  });

  /** La règle de niveau du §01 croisée avec les sections du §05. */
  it('les niveaux suivent la section, aux deux exceptions motivées près', () => {
    const numero = (id: string): number => Number.parseInt(id.slice(1), 10);
    for (const f of FICHES) {
      const n = numero(f.id);
      if (f.id === 'P33') {
        expect(f.niveau).toBe(3); // TEXTE « Caché par défaut », BASE ATLAS/MoTeC
        continue;
      }
      if (f.id === 'P45') {
        expect(f.niveau).toBe(1); // TEXTE « 3 cartes » — budget d'écran pilote
        continue;
      }
      if (n <= 17)
        expect(f.niveau).toBe(1); // 05.A + 05.B
      else if (n <= 54)
        expect(f.niveau).toBe(2); // 05.C + 05.D + 05.E
      else expect(f.niveau).toBe(3); // 05.F
    }
  });

  it('le niveau Lab n’appartient qu’au coach et à l’analyste', () => {
    for (const f of FICHES) {
      if (f.niveau === 3) expect(f.surfaces.includes('pilote')).toBe(false);
    }
  });

  it('les fiches d’avant-verdict sont exactement le §05.A', () => {
    const avant = FICHES.filter((f) => f.moment === 'avant').map((f) => f.id);
    expect(avant).toEqual(['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07']);
  });

  /**
   * DOCTRINE. Le catalogue lui-même est du texte lu par le pilote : ni verbe
   * prescriptif, ni le mot « limite », que « marge » remplace partout.
   */
  it('aucun nom ni aucune question ne prescrit, et aucun ne dit « limite »', () => {
    const PROSCRITS =
      /\b(freinez|accélérez|accelerez|tournez|vous devriez|il faut|évitez|evitez|limite|limites)\b/i;
    const fautifs = FICHES.filter((f) => PROSCRITS.test(f.nom) || PROSCRITS.test(f.question)).map(
      (f) => f.id
    );
    expect(fautifs).toEqual([]);
  });

  it('aucun score global ne se glisse dans une fiche', () => {
    const SCORE = /score|note globale|classement|percentile|\/100/i;
    const fautifs = FICHES.filter((f) => SCORE.test(`${f.nom} ${f.question} ${f.base}`)).map(
      (f) => f.id
    );
    expect(fautifs).toEqual([]);
  });

  it('les rôles restent rares : une poignée de réussites, une poignée d’opportunités', () => {
    const reussites = FICHES.filter((f) => f.role === 'reussite').map((f) => f.id);
    const opportunites = FICHES.filter((f) => f.role === 'opportunite').map((f) => f.id);
    expect(reussites).toEqual(['P09', 'P16', 'P46', 'P47', 'P50']);
    expect(opportunites).toEqual(['P10', 'P12', 'P14', 'P34', 'P58']);
  });

  it('l’accès par identifiant retrouve la fiche, et rien pour un inconnu', () => {
    expect(presentation('P18')?.nom).toBe('Film du virage');
    expect(presentation('P66')).toBeUndefined();
    expect(presentation('')).toBeUndefined();
  });

  it('FICHES et REGISTRE_PRESENTATIONS sont la même donnée', () => {
    expect(FICHES).toBe(REGISTRE_PRESENTATIONS as unknown as typeof FICHES);
  });
});
