/**
 * LA RÈGLE DES MOTS-CLÉS — les cas viennent du dépôt, pas de l'imagination.
 *
 * Les chaînes contrôlées ici sont celles que le lot P4 pose réellement dans
 * `registrePresentations`, `disponibilite` et `compositionLogic`, et celles
 * qu'elles remplacent.
 */

import { contientMotOutil, estMotCle, estPhrase, motifRefusMotCle, mots } from '../regleMotsCles';

describe('estPhrase — ce que la garde refuse', () => {
  /** Les deux conditions comptent, et une seule ne suffit jamais. */
  it('plus de trois mots ET un mot outil', () => {
    expect(estPhrase('ce que vous aviez posé avant de rouler')).toBe(true);
    expect(estPhrase('Aucune mesure sur cette séance')).toBe(true);
    expect(estPhrase('Pas assez de tours pour comparer')).toBe(true);
  });

  it('quatre mots sans mot outil ne sont pas une phrase', () => {
    expect(estPhrase('DIRECT · PLUSIEURS PILOTES')).toBe(false);
    expect(estPhrase('CHRONOS SECTEUR ABSENTS')).toBe(false);
  });

  it('un mot outil dans trois mots ne suffit pas', () => {
    expect(estPhrase('TOURS DE PISTE')).toBe(false);
  });

  /**
   * L'APOSTROPHE SÉPARE. « l'écran » porte deux mots dont le premier est un mot
   * outil — et c'est précisément celui qu'on cherche. Une découpe qui garderait
   * « l'écran » d'un bloc raterait la moitié des phrases du dépôt.
   */
  it('l’apostrophe ne cache pas le mot outil', () => {
    expect(mots('l’état de la chaîne')).toContain('l');
    expect(estPhrase('l’état de la chaîne de mesure')).toBe(true);
    expect(estPhrase('l’avancement du traitement de ce run')).toBe(true);
  });

  it('une chaîne vide ou de chiffres n’est pas une phrase', () => {
    expect(estPhrase('')).toBe(false);
    expect(estPhrase('5:27,542')).toBe(false);
    expect(estPhrase('12 virages · 5 902 m')).toBe(false);
  });
});

describe('estMotCle — ce qu’on écrit, plus strict que ce qu’on refuse', () => {
  /** Les libellés réels du lot P4 doivent tous passer. */
  it('les mots-clés du catalogue sont valides', () => {
    for (const m of [
      'INTENTION',
      'REPÈRE PISTE',
      'DEUX TOURS COMPARABLES',
      'ÉCART ENTRE TOURS',
      'DÉBUT DÉCÉLÉRATION',
      'DIRECT · PLUSIEURS PILOTES',
      'AUCUNE MESURE',
      'CHRONOS SECTEUR ABSENTS',
      'DONNÉE ABSENTE · PASSAGE LOCALISÉ',
      'CONFIANCE FAIBLE · DÉBUT DÉCÉLÉRATION',
    ]) {
      expect({ m, refus: motifRefusMotCle(m) }).toEqual({ m, refus: null });
    }
  });

  /**
   * LA QUATRIÈME RÈGLE EST LA PLUS IMPORTANTE : aucun mot outil, jamais, même
   * dans un fragment de trois mots que `estPhrase` laisserait passer. Sans
   * elle, la composition `DONNÉE ABSENTE · <libellé>` pourrait fabriquer une
   * phrase à partir de deux fragments licites.
   */
  it('un mot outil disqualifie, même dans un fragment court', () => {
    expect(motifRefusMotCle('TOURS DE PISTE')).toBe('mot outil');
    expect(estPhrase('TOURS DE PISTE')).toBe(false); // licite pour la détection…
    expect(estMotCle('TOURS DE PISTE')).toBe(false); // …refusé à l'écriture
  });

  it('les minuscules sont refusées', () => {
    expect(motifRefusMotCle('Repère piste')).toBe('minuscules');
  });

  it('plus de trois mots d’un côté du point médian sont refusés', () => {
    expect(motifRefusMotCle('ALPHA BRAVO CHARLIE DELTA')).toBe('trop de mots');
    // Trois de chaque côté restent valides.
    expect(motifRefusMotCle('ALPHA BRAVO CHARLIE · DELTA ECHO FOXTROT')).toBeNull();
  });

  it('une chaîne vide est refusée', () => {
    expect(motifRefusMotCle('   ')).toBe('vide');
  });

  /**
   * LA COMPOSITION EST SÛRE PAR CONSTRUCTION. On le vérifie plutôt que de le
   * supposer : les deux préfixes composés du lot P4, croisés avec les libellés,
   * ne doivent jamais produire une phrase.
   */
  it('aucune composition de deux mots-clés ne devient une phrase', () => {
    const prefixes = ['DONNÉE ABSENTE', 'CONFIANCE FAIBLE'];
    const libelles = [
      'INTENTION',
      'REPÈRE PISTE',
      'DEUX TOURS COMPARABLES',
      'ÉCART ENTRE TOURS',
      'DÉBUT DÉCÉLÉRATION',
      'DIRECT · PLUSIEURS PILOTES',
      'PASSAGE LOCALISÉ',
      'CANAUX VÉHICULE',
    ];
    for (const p of prefixes) {
      for (const l of libelles) {
        const compose = `${p} · ${l}`;
        expect({ compose, phrase: estPhrase(compose) }).toEqual({ compose, phrase: false });
        expect({ compose, outil: contientMotOutil(compose) }).toEqual({ compose, outil: false });
      }
    }
  });
});
