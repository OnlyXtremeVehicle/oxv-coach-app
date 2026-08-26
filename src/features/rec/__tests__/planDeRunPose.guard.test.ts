/**
 * GARDE — l'intention se pose AVANT de rouler, et le plan du run n'est pas noté.
 *
 * ===========================================================================
 * LE DÉFAUT QUE CETTE GARDE EXISTE POUR ATTRAPER
 * ===========================================================================
 *
 * Reconnaissance M01 du 26/08/2026 : `grep -n intention app/(app2)/rec/preparation.tsx`
 * rendait **zéro occurrence**, pendant que le hub PISTE annonçait
 * « Conditions, check-list, intention ».
 *
 * La chaîne complète existait — écriture, rattachement hors-ligne, relecture
 * au Bilan, relecture au Carnet, lecture coach en opt-in — sauf son ENTRÉE :
 * le lot J5 avait relocalisé la saisie en sortie de séance (`rec/fin`) sans
 * jamais la remettre à l'entrée. Le pilote posait ce qu'il voulait regarder
 * « la prochaine fois » et ne le revoyait qu'après avoir roulé.
 *
 * Une promesse d'écran qui n'est tenue par aucun code se reperd exactement de
 * la même façon. Cette garde tient les deux bouts : la promesse du hub, et la
 * règle qui la rend acceptable.
 *
 * ===========================================================================
 * ET LA RÈGLE QUI COMPTE PLUS QUE LE CÂBLAGE
 * ===========================================================================
 *
 * M01 demandait « critères de réussite verrouillés par le coach » et
 * « objectif formulé en action mesurable ». On n'en prend rien : un critère
 * qu'un tiers verrouille est une consigne, un score d'atteinte est un verdict
 * sur une phrase que l'application n'a pas comprise. La carte du run décrit ;
 * elle ne note pas. C'est la même règle que `intentionJuxtaposee` fait
 * respecter au Bilan, appliquée ici en amont.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import { codeSansCommentaires } from '@/test-utils/codeSeul';

const RACINE = process.cwd();

function lire(...m: string[]): string {
  return readFileSync(join(RACINE, ...m), 'utf8');
}

function fichiers(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'node_modules') fichiers(p, acc);
    } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
      acc.push(p);
    }
  }
  return acc;
}

const PREPARATION = codeSansCommentaires(lire('app', '(app2)', 'rec', 'preparation.tsx'));

describe('l’intention se pose avant de rouler', () => {
  /**
   * LE CŒUR. Cette assertion aurait échoué jusqu'au 26/08 : l'écran ne portait
   * aucune surface d'écriture d'intention.
   */
  it('l’écran de préparation monte la surface d’écriture, au moment « avant »', () => {
    expect(PREPARATION).toContain('CarteProchaineFois');
    expect(PREPARATION).toMatch(/moment="avant"/);
  });

  it('et il compose réellement la carte du run', () => {
    expect(PREPARATION).toContain('composerPlanDeRun');
    expect(PREPARATION).toContain('plan.lignes');
  });

  /**
   * La promesse du hub PISTE. Si quelqu'un retire l'intention de l'écran, ce
   * test tombe avant que le sous-titre ne devienne un mensonge.
   */
  it('le hub PISTE annonce l’intention, et l’écran la tient', () => {
    const hub = codeSansCommentaires(lire('app', '(app2)', 'rec', 'index.tsx'));
    expect(hub.toLowerCase()).toContain('intention');
    expect(PREPARATION.toLowerCase()).toContain('intention');
  });

  /**
   * L'absence est DITE. Sans intention posée, la carte l'annonce au lieu de
   * rendre un bloc vide ou un tiret qui ressemblerait à une donnée.
   */
  it('sans intention posée, l’écran le dit', () => {
    expect(PREPARATION).toContain('Rien de posé');
  });

  /** Le bouton d'ouverture porte un nom accessible dans les deux états. */
  it('l’action d’écriture est nommée pour la synthèse vocale', () => {
    expect(PREPARATION).toContain('Écrire ce que vous voulez regarder');
    expect(PREPARATION).toContain('Modifier ce que vous voulez regarder');
  });
});

describe('le plan du run n’est pas noté', () => {
  /**
   * Les verbes de verdict sont cherchés dans le CODE RENDU — commentaires
   * retirés, puisque cet en-tête et celui du module les emploient pour énoncer
   * l'interdit.
   */
  it('aucun verdict d’atteinte au voisinage de la carte du run', () => {
    const debut = PREPARATION.indexOf('composerPlanDeRun');
    expect(debut).toBeGreaterThan(-1);
    const bloc = PREPARATION.slice(Math.max(0, debut - 600), debut + 2500).toLowerCase();
    const verdicts = ['tenue', 'manquée', 'manqué', 'réussi', 'échoué', 'atteint', 'score'];
    expect(verdicts.filter((v) => bloc.includes(v))).toEqual([]);
  });

  /**
   * Aucun critère verrouillé par un tiers. Le coach LIT une intention partagée
   * (RLS `SELECT` seul) ; il ne l'écrit pas, il ne la borne pas.
   */
  it('le module de composition n’expose ni critère ni verrou coach', () => {
    const module = codeSansCommentaires(lire('src', 'features', 'rec', 'planDeRunLogic.ts'));
    for (const jeton of ['critere', 'critère', 'verrou', 'coach', 'objectif']) {
      expect(module.toLowerCase()).not.toContain(jeton);
    }
  });

  /**
   * Et la composition ne doit pas redevenir un module que personne n'appelle :
   * c'est l'état exact d'avant, où la spécification existait sans code.
   */
  it('la composition a un appelant de production', () => {
    const motif = /\bcomposerPlanDeRun\s*\(/;
    const appelants: string[] = [];
    for (const racine of ['app', 'src']) {
      for (const f of fichiers(join(RACINE, racine))) {
        if (f.endsWith('planDeRunLogic.ts')) continue;
        if (motif.test(codeSansCommentaires(readFileSync(f, 'utf8')))) appelants.push(f);
      }
    }
    expect(appelants.length).toBeGreaterThan(0);
  });
});
