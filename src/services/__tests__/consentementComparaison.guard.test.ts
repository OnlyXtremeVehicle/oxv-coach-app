/**
 * GARDE DE SOURCE — le consentement coach DIT la comparaison d'élèves.
 *
 * ---
 *
 * CE QUI MANQUAIT
 *
 * Les trois niveaux d'accès (`COACH_ACCESS_LEVELS`) décrivent CE QUE le coach
 * voit : vos séances, votre donnée brute, l'analyse virage par virage. Aucun ne
 * disait qu'il peut rapprocher vos données de celles de ses autres pilotes —
 * alors que c'est exactement ce que fait son métier, et ce que l'espace coach
 * permet.
 *
 * Un consentement qui décrit l'accès sans décrire l'usage est incomplet. Le
 * pilote accepte ce qu'on lui dit ; il ne devine pas le reste.
 *
 * ---
 *
 * POURQUOI UNE GARDE LEXICALE
 *
 * Deux raisons. La première est technique : `pilotConsentService` importe le
 * client Supabase, et l'importer ici tirerait tout le chargement de
 * l'application dans un test qui ne parle que de texte.
 *
 * La seconde est le fond. Le risque n'est pas que la phrase soit mal écrite,
 * c'est qu'elle cesse d'être RENDUE lors d'une refonte — définie, présente en
 * mémoire, et affichée nulle part. Seule une lecture de l'écran l'attrape.
 *
 * ---
 *
 * CE QU'ELLE NE PROUVE PAS
 *
 * Que la formulation suffit en droit. La question est posée au conseil (pièce 6
 * du dossier de consultation) et n'a pas de réponse à ce jour. Dire la chose
 * vaut mieux que se taire ; ce n'est pas la même garantie qu'un avis.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const SERVICE = join(process.cwd(), 'src', 'services', 'pilotConsentService.ts');
const ECRAN = join(process.cwd(), 'app', '(app2)', 'club', 'coaching.tsx');

const service = readFileSync(SERVICE, 'utf8');
const ecran = readFileSync(ECRAN, 'utf8');

/** Extrait la valeur de la phrase, telle qu'elle est écrite dans le service. */
function phraseDeclaree(): string {
  const m = service.match(/COACH_COMPARAISON_PHRASE\s*=\s*\n?\s*'([^']+)'/);
  return m?.[1] ?? '';
}

describe('garde — la comparaison d’élèves est divulguée', () => {
  it('la phrase existe et n’est pas vide', () => {
    expect(phraseDeclaree().length).toBeGreaterThan(40);
  });

  it('elle nomme la comparaison', () => {
    expect(phraseDeclaree()).toMatch(/autres pilotes/i);
  });

  it('elle dit que ce n’est PAS un classement', () => {
    // La doctrine interdit le classement dans l'application. Sans cette
    // précision, la phrase laisserait craindre l'inverse de ce qui est promis.
    expect(phraseDeclaree()).toMatch(/classement/i);
  });

  it('aucun niveau d’accès ne prétend déjà décrire cet usage', () => {
    // Si un `hint` disait la comparaison, la phrase séparée ferait doublon et il
    // faudrait choisir. On veut UNE divulgation, pas deux formulations.
    // Le tableau SEUL — pas la prose qui le suit. Une première rédaction allait
    // jusqu'à la déclaration de la phrase et attrapait le commentaire qui
    // l'explique : le test tombait sur son propre texte.
    const debut = service.indexOf('COACH_ACCESS_LEVELS');
    const tableau = service.slice(debut, service.indexOf('\n];', debut));
    expect(tableau).not.toMatch(/autres pilotes/i);
  });

  it('elle est AFFICHÉE dans l’écran de consentement, pas seulement définie', () => {
    expect(ecran).toContain('COACH_COMPARAISON_PHRASE');
  });
});
