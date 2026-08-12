/**
 * A-WEATHER-1 — une mesure absente ne se fabrique pas.
 *
 * La consigne fondateur visait les CHIFFRES : jamais un « 0 °C » inventé. Elle
 * avait été appliquée aux mesures numériques, mais deux portes restaient
 * ouvertes sur le CIEL — et c'était le repli le plus trompeur du service, parce
 * qu'il ne ressemblait pas à un zéro :
 *
 *   1. à la source, `current.weather_code ?? 0` ;
 *   2. à la relecture, `nReq(row.weather_code)` qui rend 0 sur une colonne nulle.
 *
 * Or chez Open-Meteo, le code 0 vaut « Ciel dégagé ». L'application annonçait
 * donc un ciel dégagé qu'elle n'avait jamais mesuré, à un pilote qui prépare sa
 * séance. Un zéro se repère ; un beau temps inventé, non.
 *
 * Ce test défend la règle au niveau du CONTRAT plutôt que du comportement
 * réseau : les trois champs de condition doivent être nullables, et aucune
 * coercition vers 0 ne doit réapparaître sur le code météo.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const SOURCE = readFileSync(join(__dirname, '..', 'weatherService.ts'), 'utf8');

/**
 * Le fichier PRIVÉ DE SES COMMENTAIRES.
 *
 * Sans cela, ces tests se retournent contre eux-mêmes : le commentaire qui
 * explique le retrait d'une chaîne CONTIENT cette chaîne, et le test échoue en
 * signalant sa propre documentation. Pire dans l'autre sens — un mécanisme
 * décrit dans un commentaire ferait passer un test qui croit vérifier du code.
 */
const CODE = SOURCE.split(/\r?\n/)
  .filter((l) => {
    const t = l.trimStart();
    return !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*');
  })
  .join('\n');

describe('A-WEATHER-1 — le ciel inconnu se dit inconnu', () => {
  it('déclare les deux champs de condition nullables', () => {
    expect(SOURCE).toContain('weatherCode: number | null;');
    expect(SOURCE).toContain('weatherLabel: string | null;');
  });

  /**
   * `weatherIcon` était un EMOJI (☀️, 🌦️), proscrit par le principe 4 de la
   * doctrine. Aucun écran ne le lisait — et c'est ce qui le rendait dangereux :
   * un champ prêt à l'emploi, nommé exactement comme le besoin, qu'un futur
   * écran aurait affiché sans savoir qu'il violait la charte. Son repli était
   * de surcroît un emoji posé sur un code INCONNU.
   */
  it('n’expose plus d’icône emoji, ni le champ, ni la table', () => {
    expect(CODE).not.toContain('weatherIcon:');
    expect(CODE).not.toMatch(/icon: '/);
    // Aucun pictogramme dans le CODE : les commentaires qui expliquent
    // le retrait en contiennent, forcément.
    expect(CODE).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  /**
   * `isDay` valait `true` en dur à la relecture : une séance de fin de journée
   * se relisait « de jour » sans que rien ne l'ait mesuré. La colonne n'est pas
   * stockée — on ne le sait donc pas, et on le dit.
   */
  it('ne fabrique plus le jour à la relecture', () => {
    expect(SOURCE).toContain('isDay: boolean | null;');
    expect(CODE).not.toContain('isDay: true');
  });

  /**
   * « Conditions inconnues » était une chaîne AFFICHABLE, posée à côté d'une
   * température réelle. Le pilote y aurait lu une mesure. Une absence rend
   * « — », comme toutes les autres.
   */
  it('un code non répertorié rend une absence, pas une phrase', () => {
    expect(CODE).not.toContain('Conditions inconnues');
  });

  it('ne convertit plus un code météo absent en 0 à la source', () => {
    expect(SOURCE).not.toContain('current.weather_code ?? 0');
  });

  it('ne force plus un code météo à la relecture', () => {
    expect(SOURCE).not.toContain('nReq(row.weather_code)');
  });

  it('garde toutes les mesures numériques nullables', () => {
    for (const champ of [
      'temperatureC',
      'feelsLikeC',
      'humidityPct',
      'pressureHpa',
      'visibilityKm',
      'windSpeedKmh',
      'windDirectionDeg',
      'windGustKmh',
      'precipitationMm',
      'precipitationProbabilityPct',
    ]) {
      expect(SOURCE).toContain(`${champ}: number | null;`);
    }
  });

  // Le zéro reste une VALEUR LÉGITIME : 0 °C, c'est le gel, pas une absence.
  // La règle interdit de fabriquer un zéro, pas d'en afficher un mesuré.
  it('n’interdit pas un zéro réellement mesuré', () => {
    expect(SOURCE).toContain('current.temperature_2m ?? null');
    expect(SOURCE).not.toContain('current.temperature_2m || null');
  });
});
