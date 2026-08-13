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

/** Extrait la valeur d'une phrase, telle qu'elle est écrite dans le service. */
function phraseDeclaree(nom = 'COACH_COMPARAISON_PHRASE'): string {
  const m = service.match(new RegExp(`${nom}\\s*=\\s*\\n?\\s*'([^']+)'`));
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

  it('elle est AFFICHÉE dans l’écran de consentement, pas seulement importée', () => {
    // PIÈGE ÉVITÉ : `toContain('COACH_COMPARAISON_PHRASE')` était satisfait par
    // la seule ligne d'import. La garde serait restée verte si le rendu avait
    // disparu — exactement le défaut qu'elle prétendait interdire.
    // On exige donc une INTERPOLATION JSX. `\b` après PHRASE exclut bien
    // PHRASE_AVANT : le caractère suivant y est un « _ », donc un mot.
    expect(/\{[^{}]*COACH_COMPARAISON_PHRASE\b[^{}]*\}/.test(ecran)).toBe(true);
  });

  /**
   * ---
   *
   * LA DIVULGATION EXISTE AVANT L'ACCORD — correction du 13/08/2026
   *
   * Elle n'était rendue que sous `consented ? … : null`. Le pilote apprenait
   * que son coach peut le comparer à ses autres élèves UNE FOIS QU'IL AVAIT DIT
   * OUI. C'est l'inverse d'un consentement éclairé.
   *
   * L'objection d'origine tenait au temps du verbe, et elle était juste : « il
   * peut » sous « en attente de votre accord » décrit un pouvoir inexistant.
   * Mais se taire n'était pas la seule issue — le conditionnel dit la même
   * chose au temps de l'état.
   */
  it('la phrase d’avant l’accord existe et nomme la comparaison', () => {
    const p = phraseDeclaree('COACH_COMPARAISON_PHRASE_AVANT');
    expect(p.length).toBeGreaterThan(40);
    expect(p).toMatch(/autres pilotes/i);
    expect(p).toMatch(/classement/i);
  });

  it('elle est au CONDITIONNEL — elle n’affirme aucun pouvoir déjà accordé', () => {
    const p = phraseDeclaree('COACH_COMPARAISON_PHRASE_AVANT');
    expect(p).toMatch(/^Si vous accordez/);
    expect(p).toMatch(/pourra/);
    // Le présent de l'indicatif décrirait un accès qui n'existe pas encore.
    expect(p).not.toMatch(/votre coach peut/i);
  });

  /**
   * LA GARDE QUI ATTRAPE VRAIMENT LA RÉGRESSION.
   *
   * Première rédaction : « l'interpolation qui contient la phrase ne contient
   * pas `: null` ». Elle aurait laissé passer l'ancien code — celui-ci rendait
   * `{consented ? <Text …>{COACH_COMPARAISON_PHRASE}</Text> : null}`, et
   * l'interpolation INTERNE, `{COACH_COMPARAISON_PHRASE}`, ne porte évidemment
   * aucun `: null`. Une garde satisfaite par le défaut qu'elle prétend
   * interdire, encore une.
   *
   * La règle tenable est ailleurs : les DEUX rédactions doivent vivre dans la
   * MÊME interpolation. C'est vrai d'un ternaire qui choisit entre elles, et
   * faux de toute forme où l'une des deux branches est muette.
   */
  it('les deux rédactions sortent de la même interpolation — aucun état muet', () => {
    const blocs = ecran.match(/\{[^{}]*COACH_COMPARAISON_PHRASE\b[^{}]*\}/g) ?? [];
    expect(blocs.length).toBeGreaterThan(0);
    expect(blocs.some((b) => b.includes('COACH_COMPARAISON_PHRASE_AVANT'))).toBe(true);
  });

  /**
   * ---
   *
   * LA PHRASE QUE LE PLAN DEMANDE SERAIT FAUSSE
   *
   * Le plan veut : « il voit vos séances, votre télémétrie, VOTRE CARDIO ET
   * VOTRE CARNET ». Écrite telle quelle, elle mentirait à la plupart des
   * pilotes — vérifié en production le 12/08/2026 :
   *
   *   `biometry_raw` exige `biometry_coach_share_consent_at IS NOT NULL` ;
   *   `pilot_notes` exige `shared_with_coach = true`, note par note.
   *
   * Un pilote qui accorde « Analyse détaillée » sans partager son cardio ne
   * montre AUCUN cardio. Lui dire l'inverse, c'est le zéro fabriqué appliqué
   * au consentement : une affirmation que la donnée ne soutient pas.
   *
   * On énumère donc les deux catégories — le plan a raison sur ce point — mais
   * pour dire qu'elles NE SONT PAS comprises.
   */
  it('la portée hors niveau nomme le cardio ET le carnet', () => {
    const p = phraseDeclaree('COACH_HORS_NIVEAU_PHRASE');
    expect(p.length).toBeGreaterThan(40);
    expect(p).toMatch(/cardio/i);
    expect(p).toMatch(/carnet/i);
  });

  it('elle dit que chacun a son propre accord, séparable', () => {
    const p = phraseDeclaree('COACH_HORS_NIVEAU_PHRASE');
    expect(p).toMatch(/accord|consentement/i);
    // Un consentement qu'on ne peut pas retirer n'en est pas un.
    expect(p).toMatch(/retir/i);
  });

  it('elle n’affirme PAS que le coach voit ces deux choses', () => {
    const p = phraseDeclaree('COACH_HORS_NIVEAU_PHRASE');
    expect(p).not.toMatch(/votre coach voit votre cardio|il voit votre cardio/i);
  });

  /**
   * AFFICHÉE DANS LES DEUX ÉTATS, et c'est le point. C'est une limite de
   * PORTÉE, pas un pouvoir accordé : la cacher au pilote qui hésite lui ferait
   * manquer l'information au moment exact où elle compte.
   */
  it('elle est affichée sans dépendre du consentement déjà donné', () => {
    const rendu = /\{\s*COACH_HORS_NIVEAU_PHRASE\s*\}/.test(ecran);
    expect(rendu).toBe(true);
    // Pas sous un ternaire `consented ? … : null`, contrairement à la phrase
    // de comparaison qui, elle, décrit bien un pouvoir déjà accordé. On lit la
    // LIGNE qui la rend : un ternaire de rendu tient sur une ligne dans ce
    // fichier, et `prettier` le garantit.
    const ligne = ecran.split(/\r?\n/).find((l) => l.includes('{COACH_HORS_NIVEAU_PHRASE}'));
    expect(ligne).toBeDefined();
    expect(ligne).not.toContain('consented');
  });
});
