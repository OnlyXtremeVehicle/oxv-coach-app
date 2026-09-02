/**
 * GARDE — deux moteurs écrivent la même ligne, et le second efface le premier.
 *
 * ===========================================================================
 * LA MESURE, FAITE SUR LE CODE DÉPLOYÉ ET PAS SEULEMENT SUR LE DÉPÔT
 * ===========================================================================
 *
 * `session_insights` porte `UNIQUE (telemetry_session_id)` — une ligne par
 * séance, lu en production le 02/09/2026. `engine_version` n'entre dans aucune
 * clé. Deux lignes pour une séance sont donc structurellement impossibles.
 *
 * Les deux fonctions edge font, à l'identique :
 *
 *     await supabase.from('session_insights').delete().eq('telemetry_session_id', sessionId);
 *     const { error: insErr } = await supabase.from('session_insights').insert(row);
 *
 * Aucun `upsert`, aucun filtre sur le moteur. Vérifié dans le code DÉPLOYÉ de
 * `compute-session-insights` (version 11, ACTIVE) et non seulement dans le
 * dépôt : les deux sont identiques, commentaires compris.
 *
 * ===========================================================================
 * CE QUE CELA COÛTE, ET QUI N'EST PAS UNE QUESTION DE PERFORMANCE
 * ===========================================================================
 *
 * v3 écrit vingt-deux colonnes, v1 en écrit douze — toutes présentes chez v3.
 * On croirait donc v3 strictement supérieure. Elle ne l'est pas, à cause d'UNE
 * forme :
 *
 *     v1  ideal_lap: { ideal_time_s, real_best_s, gap_s, best_lap, … }   À PLAT
 *     v3  ideal_lap: { theoretical_day: {…}, theoretical_record: {…} }   IMBRIQUÉE
 *
 * `chronosLisibles` (`disponibilite.ts`) exige la forme À PLAT, et refuse
 * l'imbriquée DÉLIBÉRÉMENT — son commentaire réserve au fondateur le choix
 * entre le potentiel du jour et celui du record.
 *
 * Conséquence, jusqu'au 02/09/2026 : v3 ouvrait les quatre lectures de modules
 * et FERMAIT « Potentiel démontré » ; v1 faisait exactement l'inverse. **Aucun
 * ordre d'appel ne donnait les deux**, puisque la table n'a qu'une ligne par
 * séance. Ce n'était pas un défaut de câblage, c'était une exclusion
 * structurelle.
 *
 * ===========================================================================
 * L'EXCLUSION EST LEVÉE — décision du fondateur, v3 version 12
 * ===========================================================================
 *
 * v3 écrit désormais la forme À PLAT **en plus** de l'imbriquée, alimentée par
 * le potentiel du JOUR — le meilleur tour réel de la séance, ce que v1
 * calculait. Les cinq lectures s'ouvrent donc ensemble.
 *
 * Ce qui n'est PAS fermé par ce geste : `theoretical_record` reste écrit, donc
 * le choix jour-vs-record que `disponibilite.ts` réserve au fondateur reste
 * entier. On a levé une exclusion, pas tranché une préférence.
 *
 * CE QUI RESTE OUVERT : le bouton « Recalculer les lectures » de la console
 * admin appelle toujours v1 SEULE, et dégrade donc une séance calculée par v3 —
 * dix colonnes remplacées par douze. Un test ci-dessous le fige.
 *
 * ===========================================================================
 * CE QUE CETTE GARDE FAIT, ET CE QU'ELLE NE FAIT PAS
 * ===========================================================================
 *
 * Elle est LEXICALE : elle lit des sources, elle ne monte rien et n'appelle
 * aucune fonction edge. Elle ne prouve pas que la production se comporte ainsi ;
 * elle prouve que le code du dépôt le décrit ainsi, et elle échoue si quelqu'un
 * rebranche v1 sur le chemin nominal sans rouvrir la question.
 *
 * Elle NE touche PAS `MOTEURS_INSIGHTS_REELS` : `insightsMoteurReel.test.ts`
 * exige que cette liste porte DEUX moteurs et que `mirror-insights-v1` y soit
 * reconnu réel. La liste blanche des moteurs est un sujet distinct, avec sa
 * garde déjà verte ; l'y mêler rendrait rouge une garde en place.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RACINE = join(__dirname, '..', '..');

const V1 = readFileSync(
  join(RACINE, 'supabase', 'functions', 'compute-session-insights', 'index.ts'),
  'utf8'
);
const V3 = readFileSync(
  join(RACINE, 'supabase', 'functions', 'compute-session-insights-v3', 'index.ts'),
  'utf8'
);

/** Tous les `.ts` / `.tsx` de `src/` et `app/`, tests exclus. */
function sources(): string[] {
  const trouves: string[] = [];
  const parcourir = (d: string): void => {
    for (const e of readdirSync(d)) {
      if (e === 'node_modules' || e === '__tests__') continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) parcourir(p);
      else if (e.endsWith('.ts') || e.endsWith('.tsx')) trouves.push(p);
    }
  };
  parcourir(join(RACINE, 'src'));
  parcourir(join(RACINE, 'app'));
  return trouves;
}

/** Les fichiers qui invoquent un slug donné, chemin relatif en barres avant. */
function invocateurs(slug: string): string[] {
  const motif = new RegExp(`invoke\\(\\s*['"\`]${slug}['"\`]`);
  return sources()
    .filter((f) => motif.test(readFileSync(f, 'utf8')))
    .map((f) => f.replace(RACINE, '').replace(/\\/g, '/'));
}

describe('une seule ligne d’insights par séance', () => {
  it('les deux moteurs suppriment sur la MÊME clé avant d’insérer', () => {
    const motif = /session_insights'\)\s*\.delete\(\)\s*\.eq\('telemetry_session_id'/;
    expect(V1).toMatch(motif);
    expect(V3).toMatch(motif);
  });

  /**
   * Le point qui rend l'effacement total : la suppression ne filtre PAS sur le
   * moteur. Si elle le faisait, les deux lignes coexisteraient — ce que la
   * contrainte UNIQUE interdit de toute façon, mais l'intention se lirait.
   */
  it('aucune des deux ne filtre sur `engine_version` en supprimant', () => {
    for (const src of [V1, V3]) {
      const i = src.indexOf(".from('session_insights').delete()");
      expect(i).toBeGreaterThan(-1);
      const ligne = src.slice(i, src.indexOf('\n', i));
      expect(ligne).not.toMatch(/engine_version/);
    }
  });

  /**
   * LE CHEMIN NOMINAL N'APPELLE QUE v3. v1 y tournait quatorze lignes avant, et
   * son résultat était effacé — deux COUNT exacts sur 27 000 trames pour rien.
   *
   * CONTRE-TEST OBLIGATOIRE ci-dessous : sans lui, un balayage qui ne trouve
   * rien ne prouve rien — il pourrait chercher au mauvais endroit.
   */
  it('aucun code de src/ ou app/ n’invoque plus le slug v1 sur le chemin nominal', () => {
    expect(invocateurs('compute-session-insights')).toEqual([
      // Le bouton de la console d'administration, et lui seul. Voir ci-dessous.
      '/src/services/adminSessionDiagnosticService.ts',
    ]);
  });

  it('le contre-test : le slug v3, lui, se trouve bien', () => {
    expect(invocateurs('compute-session-insights-v3').length).toBeGreaterThan(0);
    expect(invocateurs('compute-session-insights-v3')).toContain(
      '/src/services/analyzeSessionService.ts'
    );
  });

  /**
   * LE BOUTON QUI DÉGRADE, NOMMÉ ET NON CORRIGÉ.
   *
   * `relaunchInsights` — « Recalculer les lectures », console admin — appelle v1
   * SEULE. Sur une séance déjà calculée par v3, elle efface les dix colonnes que
   * v3 seule écrit et les remplace par une ligne de douze.
   *
   * Ce n'est PAS corrigé ici, et c'est délibéré : repointer ce bouton sur v3
   * fermerait la dernière route vers un `ideal_lap` À PLAT, donc vers
   * « Potentiel démontré ». Le choix jour-vs-record appartient au fondateur, et
   * `disponibilite.ts` le réserve nommément.
   *
   * Ce test ne juge pas : il FIGE l'état, pour qu'on ne le découvre pas une
   * seconde fois. Le jour où la décision tombe, il échoue et rappelle pourquoi.
   */
  it('le bouton admin appelle v1 seule, et cela reste une question ouverte', () => {
    const admin = readFileSync(
      join(RACINE, 'src', 'services', 'adminSessionDiagnosticService.ts'),
      'utf8'
    );
    expect(admin).toMatch(/invoke\('compute-session-insights'/);
    expect(admin).not.toMatch(/invoke\('compute-session-insights-v3'/);
  });

  /**
   * LES DEUX FORMES D'`ideal_lap`, qui sont la raison de l'exclusion. Si l'une
   * des deux change, cette garde doit échouer — c'est le seul endroit du dépôt
   * où les deux sont écrites côte à côte.
   */
  it('v1 écrit un `ideal_lap` à plat, v3 un `ideal_lap` imbriqué', () => {
    expect(V1).toMatch(/ideal_time_s:/);
    expect(V3).toMatch(/theoretical_day:/);
    expect(V3).toMatch(/theoretical_record:/);
    // Et la vue, elle, ne lit que la forme à plat.
    const dispo = readFileSync(
      join(RACINE, 'src', 'components', 'insights', 'disponibilite.ts'),
      'utf8'
    );
    expect(dispo).toMatch(/b\.ideal_time_s/);
    expect(dispo).not.toMatch(/b\.theoretical_day/);
  });

  /**
   * L'EXCLUSION EST LEVÉE — décision du fondateur du 02/09/2026, déployée en
   * version 12.
   *
   * v3 écrit désormais la forme À PLAT **en plus** de l'imbriquée, alimentée par
   * le potentiel du JOUR. Les cinq lectures s'ouvrent donc ensemble, et le choix
   * jour-vs-record reste entier : `theoretical_record` est toujours écrit.
   *
   * Ce test échoue si quelqu'un retire l'étalement — auquel cas « Potentiel
   * démontré » se refermerait sans que rien ne le dise.
   */
  it('v3 étale le potentiel du jour à la racine, sans perdre l’imbriqué', () => {
    expect(V3).toMatch(/const potentielDuJour = bestOfDay/);
    expect(V3).toMatch(/\.\.\.\(potentielDuJour \?\? \{\}\)/);
    expect(V3).toMatch(/theoretical_day: potentielDuJour/);
    expect(V3).toMatch(/theoretical_record: recordTime != null/);
  });

  /**
   * ET IL NE FABRIQUE PAS DE SECTEUR. v1 écrivait `worst_sector: 0`, qui nomme
   * un secteur inexistant, alors que son propre en-tête pose la règle :
   * « l'absence n'est pas un zéro ». v3 l'omet, et laisse
   * `loss_by_sector_pct` vide — aucun découpage en secteurs n'est calculé.
   */
  it('le bloc à plat de v3 n’invente aucun secteur', () => {
    const i = V3.indexOf('const potentielDuJour = bestOfDay');
    const bloc = V3.slice(i, V3.indexOf('const ideal_lap', i));
    expect(bloc).toMatch(/loss_by_sector_pct: \[\]/);
    expect(bloc).not.toMatch(/worst_sector/);
  });
});
