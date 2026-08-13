import { formatSecondes, vueLecture } from '../ecouteNoteLogic';

describe('formatSecondes', () => {
  it('rend m:ss', () => {
    expect(formatSecondes(0)).toBe('0:00');
    expect(formatSecondes(7)).toBe('0:07');
    expect(formatSecondes(63)).toBe('1:03');
    expect(formatSecondes(600)).toBe('10:00');
  });

  it('ne rend jamais une durée négative ou non-finie', () => {
    expect(formatSecondes(-4)).toBe('0:00');
    expect(formatSecondes(NaN)).toBe('0:00');
    expect(formatSecondes(Infinity)).toBe('0:00');
  });
});

describe('vueLecture', () => {
  /**
   * LE CŒUR. Un lecteur qui n'a pas chargé le fichier rend `duration: 0` —
   * c'est l'état normal des premières frames, pas une note vide. Afficher
   * « 0:00 / 0:00 » et une barre à zéro donnerait à voir une mesure là où il
   * n'y en a aucune.
   */
  it('durée inconnue : ni barre, ni chrono — l’absence se tait', () => {
    const v = vueLecture({ isLoaded: false, playing: false, currentTime: 0, duration: 0 });
    expect(v.progression).toBeNull();
    expect(v.chrono).toBeNull();
    expect(v.libelle).toBe('Chargement');
  });

  it('durée connue : la progression est une fraction réelle', () => {
    const v = vueLecture({ isLoaded: true, playing: true, currentTime: 15, duration: 60 });
    expect(v.progression).toBeCloseTo(0.25, 6);
    expect(v.chrono).toBe('0:15 / 1:00');
    expect(v.libelle).toBe('Pause');
  });

  it('au repos au début : « Écouter »', () => {
    const v = vueLecture({ isLoaded: true, playing: false, currentTime: 0, duration: 42 });
    expect(v.libelle).toBe('Écouter');
    expect(v.termine).toBe(false);
  });

  it('au repos au milieu : « Reprendre », pas « Écouter »', () => {
    const v = vueLecture({ isLoaded: true, playing: false, currentTime: 20, duration: 42 });
    expect(v.libelle).toBe('Reprendre');
    expect(v.termine).toBe(false);
  });

  /**
   * La marge de fin. Un lecteur qui s'arrête à 41,9 s sur 42 s est arrivé au
   * bout : sans la marge, la pression suivante relancerait 100 ms de silence.
   */
  it('arrêté à un cheveu de la fin : terminé, donc « Réécouter »', () => {
    const v = vueLecture({ isLoaded: true, playing: false, currentTime: 41.9, duration: 42 });
    expect(v.termine).toBe(true);
    expect(v.libelle).toBe('Réécouter');
  });

  it('en cours de lecture près de la fin : PAS terminé', () => {
    const v = vueLecture({ isLoaded: true, playing: true, currentTime: 41.9, duration: 42 });
    expect(v.termine).toBe(false);
    expect(v.libelle).toBe('Pause');
  });

  it('la progression est bornée même si le lecteur dépasse sa durée', () => {
    const v = vueLecture({ isLoaded: true, playing: false, currentTime: 45, duration: 42 });
    expect(v.progression).toBe(1);
  });

  it('un currentTime aberrant ne fabrique pas une position', () => {
    const v = vueLecture({ isLoaded: true, playing: false, currentTime: NaN, duration: 42 });
    expect(v.progression).toBe(0);
    expect(v.chrono).toBe('0:00 / 0:42');
  });
});
