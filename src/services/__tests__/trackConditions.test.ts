/**
 * L'ÉTAT DE LA PISTE — ce que l'application a le droit d'affirmer.
 *
 * ===========================================================================
 * CE QUE CE FICHIER EXISTE POUR EMPÊCHER
 * ===========================================================================
 *
 * `trackConditions` gardait bien ses quatre verdicts par `!= null`. Mais son
 * REPLI en était un cinquième, non gardé :
 *
 *     return { label: 'Conditions sèches', isDry: true, isWet: false, ... };
 *
 * Le commentaire l'appelait « l'état neutre par défaut ». Il n'a rien de
 * neutre : il affirme l'adhérence de la piste.
 *
 * Sur l'écran de préparation, ligne MÉTÉO PISTE, le pilote lisait donc
 * « Conditions sèches » à côté d'un « — » en température. L'application
 * avouait ne pas connaître le degré et se prononçait, dans la même ligne, sur
 * l'état de la piste qu'elle n'avait pas mesuré.
 *
 * C'est le « 0 fabriqué » que la consigne fondateur interdit, sous forme de
 * phrase plutôt que de chiffre — donc plus difficile à repérer, et plus facile
 * à croire. Et cela touche le principe 1 : sécurité avant performance.
 *
 * ===========================================================================
 * POURQUOI CE FICHIER EXÉCUTE, LÀ OÙ `weatherAbsence.test.ts` LIT
 * ===========================================================================
 *
 * L'unique test météo du dépôt lit le TEXTE de `weatherService.ts` et vérifie
 * des chaînes. Il ne pouvait pas voir ce défaut — pourtant situé dans le
 * fichier qu'il garde — parce qu'aucune assertion textuelle n'atteint une
 * valeur de retour. Une réécriture qui aurait conservé les mêmes chaînes en
 * changeant le comportement serait passée au vert.
 *
 * Ici, on APPELLE la fonction.
 */

/**
 * `weatherService` importe `@/lib/supabase` au chargement du module, lequel
 * tire `react-native-url-polyfill/auto` — de l'ESM que l'environnement `node`
 * de ce dépôt ne sait pas charger. C'est la raison technique pour laquelle le
 * test météo d'origine LISAIT le fichier au lieu de l'importer, et donc la
 * raison pour laquelle il ne pouvait rien exécuter.
 *
 * `trackConditions` est une fonction pure qui n'a aucun rapport avec Supabase :
 * on neutralise l'import, et la fonction devient appelable. Patron déjà employé
 * par une quinzaine de suites du dépôt.
 */
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

import { trackConditions, type WeatherData } from '../weatherService';

/** Une météo dont AUCUNE mesure n'est renseignée — le cas du repli. */
const RIEN: WeatherData = {
  latitude: 45.6,
  longitude: -0.13,
  temperatureC: null,
  feelsLikeC: null,
  humidityPct: null,
  pressureHpa: null,
  visibilityKm: null,
  windSpeedKmh: null,
  windDirectionDeg: null,
  windGustKmh: null,
  precipitationMm: null,
  precipitationProbabilityPct: null,
  weatherCode: null,
  weatherLabel: null,
  isDay: null,
  sunriseAt: null,
  sunsetAt: null,
  capturedAt: '2026-08-13T00:20:00.000Z',
  source: 'open-meteo',
};

describe('sans aucune mesure, l’application ne se prononce pas', () => {
  it('le libellé dit l’absence, il n’annonce pas une piste sèche', () => {
    const c = trackConditions(RIEN);
    expect(c.mesure).toBe(false);
    expect(c.label).toBe('Conditions non mesurées');
    expect(c.label).not.toMatch(/sèche/i);
  });

  /**
   * LE CHAMP LE PLUS DANGEREUX DES QUATRE. `isDry: true` sur une absence donne
   * un feu vert inventé à tout appelant qui conditionnerait quoi que ce soit
   * dessus — sur un écran qui prépare une sortie en piste.
   */
  it('ni sec ni mouillé : ne pas savoir n’est pas « sec »', () => {
    const c = trackConditions(RIEN);
    expect(c.isDry).toBe(false);
    expect(c.isWet).toBe(false);
  });

  it('aucun avertissement fabriqué non plus', () => {
    expect(trackConditions(RIEN).warning).toBeNull();
  });
});

describe('avec des mesures, les verdicts restent ceux d’avant', () => {
  /**
   * LE CONTRE-TEST, ET IL DÉCIDE. Une fonction qui répondrait « non mesurées »
   * à tout passerait les trois cas ci-dessus, et l'application perdrait la
   * seule lecture d'adhérence qu'elle sait produire — en silence.
   */
  it('une pluie mesurée annonce une piste mouillée', () => {
    const c = trackConditions({ ...RIEN, precipitationMm: 4.2 });
    expect(c.label).toBe('Piste mouillée');
    expect(c.isWet).toBe(true);
    expect(c.mesure).toBe(true);
  });

  it('une probabilité de pluie élevée s’annonce', () => {
    const c = trackConditions({ ...RIEN, precipitationProbabilityPct: 80 });
    expect(c.label).toBe('Pluie probable');
    expect(c.mesure).toBe(true);
  });

  it('une humidité forte s’annonce', () => {
    const c = trackConditions({ ...RIEN, humidityPct: 95 });
    expect(c.label).toBe('Piste humide');
    expect(c.mesure).toBe(true);
  });

  it('un vent fort s’annonce', () => {
    const c = trackConditions({ ...RIEN, windSpeedKmh: 45 });
    expect(c.label).toBe('Conditions ventées');
    expect(c.warning).not.toBeNull();
    expect(c.mesure).toBe(true);
  });

  /**
   * ET « CONDITIONS SÈCHES » RESTE DISPONIBLE — quand c'est MESURÉ. Zéro
   * millimètre de pluie relevé est une information ; l'absence de relevé n'en
   * est pas une. Toute la correction tient dans cette distinction.
   */
  it('zéro millimètre MESURÉ annonce bien une piste sèche', () => {
    const c = trackConditions({ ...RIEN, precipitationMm: 0, humidityPct: 40 });
    expect(c.label).toBe('Conditions sèches');
    expect(c.isDry).toBe(true);
    expect(c.mesure).toBe(true);
  });

  /**
   * Le cas limite exact du 13/08 : température connue, rien d'autre. Ça ne
   * suffit pas à se prononcer sur l'adhérence — la température ne dit rien de
   * la pluie.
   */
  it('une température seule ne suffit pas à qualifier la piste', () => {
    const c = trackConditions({ ...RIEN, temperatureC: 18 });
    expect(c.mesure).toBe(false);
    expect(c.isDry).toBe(false);
  });
});
