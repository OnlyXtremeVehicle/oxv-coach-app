/**
 * LA CHAÎNE QUI SE FAIT PASSER POUR UN NOMBRE.
 *
 * ===========================================================================
 * CE QUE CES TESTS PROTÈGENT
 * ===========================================================================
 *
 * PostgREST sérialise `numeric` en CHAÎNE JSON. TypeScript annonce `number`.
 * Le décalage ne plante jamais et ne se voit nulle part — il change seulement
 * les réponses, toujours dans le sens du silence :
 *
 *   Number.isFinite("83.412")    → false   → « — » sur une valeur présente
 *   typeof "83.412" === 'number' → false   → l'élément est écarté d'un filtre
 *   "102.7" < "95.2"             → true    → le tour le plus LENT gagne
 *
 * Le dépôt l'a corrigé trois fois à trois endroits sans le corriger à sa
 * source, et il restait vivant sur `telemetry_sessions` — où il faisait
 * célébrer CHAQUE séance comme record personnel.
 *
 * Ces tests éprouvent la conversion avec le FORMAT RÉEL DU FIL, des chaînes,
 * et non avec les nombres qu'un test complaisant lui donnerait.
 */

import fs from 'fs';
import path from 'path';

import {
  NUMERIQUES_SEANCE,
  NUMERIQUES_TOUR,
  coerceNumeriques,
  nombresDeSeance,
  nombresDuTour,
  seancesEnNombres,
} from '../numeriquesPostgrest';

describe('la conversion, avec ce que PostgREST envoie vraiment', () => {
  it('une chaîne décimale devient un nombre', () => {
    const ligne = nombresDeSeance({ best_lap_seconds: '95.200', id: 'a' });
    expect(ligne.best_lap_seconds).toBe(95.2);
    expect(typeof ligne.best_lap_seconds).toBe('number');
  });

  it('les colonnes NON listées sont laissées intactes', () => {
    const ligne = nombresDeSeance({ best_lap_seconds: '95.2', circuit_name: 'Bouteville' });
    expect(ligne.circuit_name).toBe('Bouteville');
  });

  it('null et undefined traversent sans devenir zéro', () => {
    const ligne = nombresDeSeance({ best_lap_seconds: null, distance_km: undefined });
    expect(ligne.best_lap_seconds).toBeNull();
    expect(ligne.distance_km).toBeUndefined();
  });

  /**
   * `NaN` EST PIRE QUE `null`. Il traverse les gardes `!== null` sans broncher,
   * ressort en « — », en trait de graphique corrompu, ou en comparaison
   * toujours fausse — et on ne sait plus d'où il vient.
   */
  it('une valeur illisible devient null, jamais NaN', () => {
    const ligne = nombresDeSeance({ best_lap_seconds: 'pas-un-nombre', distance_km: 'Infinity' });
    expect(ligne.best_lap_seconds).toBeNull();
    expect(ligne.distance_km).toBeNull();
    expect(Number.isNaN(ligne.best_lap_seconds as unknown as number)).toBe(false);
  });

  it('la ligne d’origine n’est pas modifiée', () => {
    const origine = { best_lap_seconds: '95.2' };
    nombresDeSeance(origine);
    expect(origine.best_lap_seconds).toBe('95.2');
  });

  it('seancesEnNombres tolère null et undefined', () => {
    expect(seancesEnNombres(null)).toEqual([]);
    expect(seancesEnNombres(undefined)).toEqual([]);
    expect(seancesEnNombres([{ best_lap_seconds: '95.2' }])).toEqual([{ best_lap_seconds: 95.2 }]);
  });

  it('les onze colonnes de `laps` sont couvertes', () => {
    const brut: Record<string, unknown> = {};
    for (const col of NUMERIQUES_TOUR) brut[col] = '1.5';
    const ligne = nombresDuTour(brut);
    for (const col of NUMERIQUES_TOUR) expect(ligne[col]).toBe(1.5);
  });

  it('coerceNumeriques n’exige pas que la colonne existe', () => {
    expect(coerceNumeriques({ a: 1 }, ['absente'])).toEqual({ a: 1 });
  });
});

/**
 * ===========================================================================
 * LA GARDE : LES LISTES SUIVENT LE SCHÉMA, PAS L'INVERSE
 * ===========================================================================
 *
 * Une liste de colonnes qui ne se compare qu'à elle-même ne prouve rien. Le
 * défaut a survécu à trois corrections précisément parce qu'à chaque fois on
 * complétait une liste sans se demander ce que la BASE contenait.
 *
 * On confronte donc les constantes au schéma de référence versionné dans le
 * dépôt — `docs/architecture/05_SCHEMA_SUPABASE_ACTUEL.md`, extrait de la
 * production. Une colonne `numeric` ajoutée en base sans être ajoutée ici fait
 * échouer ce test, et c'est le seul moment où quelqu'un se posera la question.
 */
describe('les listes de colonnes couvrent le schéma réel', () => {
  const SCHEMA = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'docs', 'architecture', '05_SCHEMA_SUPABASE_ACTUEL.md'),
    'utf8'
  );

  /**
   * Extrait les colonnes `numeric` d'une table depuis le document de schéma.
   * Le document liste les tables sous un titre puis une colonne par ligne,
   * `nom  type`. On s'arrête au titre suivant.
   */
  function numeriquesDeLaTable(table: string): string[] {
    const titre = SCHEMA.search(new RegExp(`^#+ .*\`${table}\``, 'm'));
    if (titre === -1) throw new Error(`table ${table} absente du document de schéma`);
    // On repart APRÈS la ligne de titre : sans cela, le titre lui-même est
    // reconnu comme « section suivante » et le bloc est vide — ce que la
    // vérification de longueur non nulle, plus bas, a effectivement attrapé.
    const debut = SCHEMA.indexOf('\n', titre) + 1;
    const suite = SCHEMA.slice(debut);
    const finRelative = suite.search(/^#+ /m);
    const bloc = finRelative === -1 ? suite : suite.slice(0, finRelative);

    const cols: string[] = [];
    for (const ligne of bloc.split('\n')) {
      const m = /^\s*\|?\s*([a-z_][a-z0-9_]*)\s*\|?\s+numeric\b/i.exec(ligne);
      if (m) cols.push(m[1]);
    }
    return cols;
  }

  it('`telemetry_sessions` : aucune colonne numeric oubliée', () => {
    const duSchema = numeriquesDeLaTable('telemetry_sessions');
    // Le document doit en contenir : un extracteur qui rend [] passerait tout.
    expect(duSchema.length).toBeGreaterThan(0);
    for (const col of duSchema) {
      expect(NUMERIQUES_SEANCE as readonly string[]).toContain(col);
    }
  });

  it('`laps` : aucune colonne numeric oubliée', () => {
    const duSchema = numeriquesDeLaTable('laps');
    expect(duSchema.length).toBeGreaterThan(0);
    for (const col of duSchema) {
      expect(NUMERIQUES_TOUR as readonly string[]).toContain(col);
    }
  });
});
