/**
 * Tests garageLogic (V2-L4, écran Garage) — ts-jest node, zéro rendu.
 *
 * Points verrouillés :
 *   - véhicule principal = le PREMIER (ordre service), marqué sans inventer de
 *     colonne is_primary ; garage vide → null ;
 *   - mapping specs : « — » factuel quand une colonne réelle est absente,
 *     jamais un placeholder fabriqué ;
 *   - tri/marquage stable ; cover véhicule (undefined si aucune) ;
 *   - réglages : résumé factuel (lignes non vides), date, pressions bar FR,
 *     parse tolérant à la virgule, détection de brouillon non vide.
 */

import type { Vehicle, VehicleSetup } from '@/services/garageService';

import {
  EMPTY_SETUP_DRAFT,
  coverUriFor,
  fmtBar,
  formatSetupDate,
  hasSetupInput,
  markGarage,
  metaValue,
  parseBar,
  primaryVehicleId,
  setupSummaryLines,
  specRows,
  vehicleName,
  vehicleSpecsLine,
} from '../garageLogic';

const veh = (over: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1',
  brand: 'Alpine',
  model: 'A110',
  year: 2019,
  color: 'Bleu',
  notes: null,
  isPrimary: false,
  massKg: null,
  ...over,
});

const setup = (over: Partial<VehicleSetup> = {}): VehicleSetup => ({
  id: 's1',
  vehicleId: 'v1',
  tires: null,
  brakes: null,
  pressureFrontStart: null,
  pressureRearStart: null,
  pressureFrontEnd: null,
  pressureRearEnd: null,
  notes: null,
  recordedAt: '2026-07-18T09:00:00Z',
  ...over,
});

describe('véhicule principal', () => {
  it('le premier est marqué principal, les autres non', () => {
    const entries = markGarage([veh(), veh({ id: 'v2' }), veh({ id: 'v3' })]);
    expect(entries.map((e) => e.isPrimary)).toEqual([true, false, false]);
    expect(entries.map((e) => e.vehicle.id)).toEqual(['v1', 'v2', 'v3']);
  });

  it('garage vide → primaryVehicleId null, aucune entrée', () => {
    expect(primaryVehicleId([])).toBeNull();
    expect(markGarage([])).toEqual([]);
  });

  it('primaryVehicleId = id du premier, À DÉFAUT de désignation', () => {
    expect(primaryVehicleId([veh({ id: 'x' }), veh({ id: 'y' })])).toBe('x');
  });

  /**
   * LA RÈGLE NEUVE — 12/08/2026. La colonne `is_primary` existe en base depuis
   * le 29/07 et le service ne la lisait pas : le principal était FORCÉMENT le
   * premier enregistré, sans recours.
   *
   * Conséquence pour un pilote à deux voitures : l'accueil illustrait celle
   * qu'il ne roulait plus, et rien ne lui permettait d'en changer.
   */
  it('la DÉSIGNATION prime sur l’ordre d’enregistrement', () => {
    const garage = [veh({ id: 'x' }), veh({ id: 'y', isPrimary: true })];
    expect(primaryVehicleId(garage)).toBe('y');
    expect(markGarage(garage)[0].vehicle.id).toBe('y');
  });

  it('le désigné remonte en tête, l’ordre des autres est conservé', () => {
    const garage = [veh({ id: 'a' }), veh({ id: 'b' }), veh({ id: 'c', isPrimary: true })];
    expect(markGarage(garage).map((e) => e.vehicle.id)).toEqual(['c', 'a', 'b']);
  });

  /**
   * `parDefaut` existe pour que l'écran n'affiche pas une désignation que le
   * pilote n'a jamais faite. Un garage sans désignation est un cas NORMAL —
   * celui de tout pilote qui n'a jamais touché au réglage.
   */
  it('un principal par repli se dit comme tel', () => {
    const sansDesignation = markGarage([veh({ id: 'a' }), veh({ id: 'b' })]);
    expect(sansDesignation[0].isPrimary).toBe(true);
    expect(sansDesignation[0].parDefaut).toBe(true);

    const avecDesignation = markGarage([veh({ id: 'a' }), veh({ id: 'b', isPrimary: true })]);
    expect(avecDesignation[0].parDefaut).toBe(false);
  });

  it('un seul véhicule reste principal, et par repli', () => {
    const seul = markGarage([veh({ id: 'a' })]);
    expect(seul).toHaveLength(1);
    expect(seul[0].isPrimary).toBe(true);
    expect(seul[0].parDefaut).toBe(true);
  });
});

describe('mapping specs', () => {
  it('nom avec repli', () => {
    expect(vehicleName(veh())).toBe('Alpine A110');
    expect(vehicleName(veh({ brand: null, model: null }))).toBe('Véhicule');
  });

  it('metaValue : « — » factuel quand absent', () => {
    expect(metaValue(null)).toBe('—');
    expect(metaValue('  ')).toBe('—');
    expect(metaValue(2019)).toBe('2019');
  });

  it('ligne specs : réel joint, « — » si tout absent', () => {
    expect(vehicleSpecsLine(veh())).toBe('2019  ·  Bleu');
    expect(vehicleSpecsLine(veh({ year: null, color: null }))).toBe('—');
    expect(vehicleSpecsLine(veh({ year: 2019, color: null }))).toBe('2019');
  });

  it('specRows : 4 lignes, valeurs réelles ou « — »', () => {
    const rows = specRows(veh({ color: null }));
    expect(rows.map((r) => r.value)).toEqual(['Alpine', 'A110', '2019', '—']);
  });

  it('coverUriFor : undefined si aucune cover', () => {
    expect(coverUriFor('v1', { v1: 'https://c' })).toBe('https://c');
    expect(coverUriFor('v1', {})).toBeUndefined();
    expect(coverUriFor('v1', { v1: '' })).toBeUndefined();
  });
});

describe('réglages (miroir : faits, aucun jugement)', () => {
  it('pressions bar FR, « — » si null', () => {
    expect(fmtBar(2.1)).toBe('2,1 bar');
    expect(fmtBar(null)).toBe('—');
  });

  it('date FR courte, « — » si illisible', () => {
    expect(formatSetupDate('2026-07-18T09:00:00Z')).toContain('2026');
    expect(formatSetupDate('nope')).toBe('—');
  });

  it('résumé : uniquement les lignes renseignées', () => {
    expect(setupSummaryLines(setup())).toEqual([]);
    const lines = setupSummaryLines(
      setup({ tires: 'Michelin', pressureFrontStart: 2.0, notes: 'RAS' })
    );
    expect(lines).toEqual(['Pneus : Michelin', 'Départ AV/AR : 2,0 bar / —', 'RAS']);
  });

  it('parseBar tolère la virgule, null si vide/illisible', () => {
    expect(parseBar('2,1')).toBe(2.1);
    expect(parseBar('')).toBeNull();
    expect(parseBar('abc')).toBeNull();
  });

  it('hasSetupInput : brouillon vide → false, un champ → true', () => {
    expect(hasSetupInput(EMPTY_SETUP_DRAFT)).toBe(false);
    expect(hasSetupInput({ ...EMPTY_SETUP_DRAFT, tires: 'Michelin' })).toBe(true);
    expect(hasSetupInput({ ...EMPTY_SETUP_DRAFT, notes: '   ' })).toBe(false);
  });
});
