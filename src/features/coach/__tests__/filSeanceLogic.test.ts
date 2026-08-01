/**
 * FIL DE SÉANCE — le modèle (jalon 6, phase 5).
 *
 * ---
 *
 * LES DEUX TESTS QUI COMPTENT
 *
 * `un événement non daté ne descend pas dans la chronologie`. C'est la règle
 * doctrinale du fil : intercaler la lecture globale d'une séance entre deux
 * tours demanderait de lui inventer un instant. On la tient donc à part. Un fil
 * qui ment sur l'ordre ne vaut pas mieux qu'un chiffre fabriqué.
 *
 * `le virage n'est pas ré-incrémenté`. `app_segment_analyses.segment_index` est
 * en base 1 — la contrainte SQL impose `>= 1 and <= 7`. Un `+ 1` de plus
 * désignerait le virage suivant, et un pilote qui dit « le V4 » ne parlerait pas
 * du même endroit que son coach. Ce défaut a déjà existé (D-21).
 *
 * ---
 *
 * CE QUE CES TESTS NE PROUVENT PAS
 *
 * Que les événements existent. Au 01/08/2026, la production porte 13 lectures
 * machine et **zéro** annotation, priorité ou intention. Le fil est donc, pour
 * l'instant, presque toujours vide — et c'est ce qu'il doit afficher.
 */

import {
  type EvenementFil,
  ancrage,
  assembleFil,
  filEstVide,
} from '@/features/coach/filSeanceLogic';

const base = (p: Partial<EvenementFil>): EvenementFil => ({
  id: 'e1',
  registre: 'machine',
  instantMs: null,
  tour: null,
  virage: null,
  titre: 'Un fait',
  corps: null,
  ...p,
});

describe('assembleFil', () => {
  it('un événement non daté ne descend pas dans la chronologie', () => {
    const fil = assembleFil([
      base({ id: 'global', instantMs: null, titre: 'Lecture de la séance' }),
      base({ id: 'date', instantMs: 1000, titre: 'Tour bouclé' }),
    ]);

    expect(fil.entete.map((e) => e.id)).toEqual(['global']);
    expect(fil.chronologie.map((e) => e.id)).toEqual(['date']);
  });

  it('ordonne du plus ancien au plus récent', () => {
    const fil = assembleFil([
      base({ id: 'c', instantMs: 3000 }),
      base({ id: 'a', instantMs: 1000 }),
      base({ id: 'b', instantMs: 2000 }),
    ]);
    expect(fil.chronologie.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('à instant égal, la mesure précède l’interprétation, et le pilote conclut', () => {
    // Ce n'est pas une hiérarchie de valeur : c'est l'ordre dans lequel les
    // choses se produisent — on mesure, on lit, puis le pilote se prononce.
    const fil = assembleFil([
      base({ id: 'p', registre: 'pilote', instantMs: 500 }),
      base({ id: 'c', registre: 'coach', instantMs: 500 }),
      base({ id: 'm', registre: 'machine', instantMs: 500 }),
    ]);
    expect(fil.chronologie.map((e) => e.id)).toEqual(['m', 'c', 'p']);
  });

  it('départage par tour puis par virage avant le registre', () => {
    const fil = assembleFil([
      base({ id: 't2', instantMs: 100, tour: 2, virage: 1 }),
      base({ id: 't1v5', instantMs: 100, tour: 1, virage: 5 }),
      base({ id: 't1v2', instantMs: 100, tour: 1, virage: 2 }),
    ]);
    expect(fil.chronologie.map((e) => e.id)).toEqual(['t1v2', 't1v5', 't2']);
  });

  it('déduplique par identifiant — le premier rencontré gagne', () => {
    const fil = assembleFil([
      base({ id: 'meme', titre: 'Version de confiance', instantMs: 1 }),
      base({ id: 'meme', titre: 'Doublon', instantMs: 1 }),
    ]);
    expect(fil.chronologie).toHaveLength(1);
    expect(fil.chronologie[0]?.titre).toBe('Version de confiance');
  });

  it('n’annonce que les registres réellement présents', () => {
    // La légende ne s'affiche que si elle sert : trois couleurs annoncées pour
    // une seule voix présente est du bruit.
    const fil = assembleFil([base({ id: 'm', registre: 'machine', instantMs: 1 })]);
    expect(fil.registresPresents).toEqual(['machine']);
  });

  describe('fail-closed sur les entrées douteuses', () => {
    it('écarte un événement sans titre — une ligne vide n’informe pas', () => {
      const fil = assembleFil([base({ id: 'vide', titre: '   ', instantMs: 1 })]);
      expect(filEstVide(fil)).toBe(true);
    });

    it('écarte un registre inconnu plutôt que de le rendre sans couleur', () => {
      const faux = base({ id: 'x', registre: 'autre' as never, instantMs: 1 });
      expect(filEstVide(assembleFil([faux]))).toBe(true);
    });

    it('un instant non fini n’est pas une date — il remonte en entête', () => {
      const fil = assembleFil([base({ id: 'nan', instantMs: Number.NaN })]);
      expect(fil.entete.map((e) => e.id)).toEqual(['nan']);
      expect(fil.chronologie).toHaveLength(0);
    });

    it('une entrée absente ne fait pas tomber l’assemblage', () => {
      const fil = assembleFil([null as unknown as EvenementFil, base({ id: 'ok', instantMs: 1 })]);
      expect(fil.chronologie.map((e) => e.id)).toEqual(['ok']);
    });

    it('rend un fil vide plutôt que d’échouer sur une liste absente', () => {
      expect(filEstVide(assembleFil(null as unknown as EvenementFil[]))).toBe(true);
    });
  });
});

describe('ancrage', () => {
  it('le virage n’est pas ré-incrémenté — la base est déjà en 1', () => {
    // `app_segment_analyses.segment_index` : CHECK (>= 1 and <= 7). Un « + 1 »
    // de plus désignerait le virage suivant (D-21).
    expect(ancrage(base({ tour: 3, virage: 5 }))).toBe('Tour 3 · Virage 5');
  });

  it('dit ce qu’il sait, et rien de plus', () => {
    expect(ancrage(base({ tour: 2, virage: null }))).toBe('Tour 2');
    expect(ancrage(base({ tour: null, virage: 4 }))).toBe('Virage 4');
  });

  it('rend null quand rien n’est connu — pas de puce vide', () => {
    expect(ancrage(base({ tour: null, virage: null }))).toBe(null);
  });

  it('un zéro n’est pas un ancrage — la base commence à 1', () => {
    expect(ancrage(base({ tour: 0, virage: 0 }))).toBe(null);
  });
});
