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

describe('A-WEATHER-1 — le ciel inconnu se dit inconnu', () => {
  it('déclare les trois champs de condition nullables', () => {
    expect(SOURCE).toContain('weatherCode: number | null;');
    expect(SOURCE).toContain('weatherLabel: string | null;');
    expect(SOURCE).toContain('weatherIcon: string | null;');
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
