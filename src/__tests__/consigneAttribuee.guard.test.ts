/**
 * GARDE — une consigne ne se rend JAMAIS dans la voix de l'application.
 *
 * ===========================================================================
 * CE QU'ELLE REMPLACE
 * ===========================================================================
 *
 * La table `coach_consignes` a d'abord porté un filtre doctrinal : aucun verbe
 * d'ordre, aucune causalité, comme pour les notes partagées. C'ÉTAIT FAUX, et
 * le dépôt le disait déjà — `CoachBand.tsx`, en tête de fichier, bien avant
 * cette table :
 *
 *   « SEUL espace prescriptif de l'application. Partout ailleurs, l'app est un
 *     miroir : elle énonce des faits, jamais des consignes. Ici, et ici
 *     seulement, le coach (humain, BPJEPS) a droit aux verbes d'ordre et à la
 *     causalité. Le marquage rouge + "De votre coach" signale sans ambiguïté
 *     que ce qui suit vient d'un tiers et n'est pas une lecture automatique. »
 *
 * La retenue doctrinale protège l'APPLICATION. Un coach diplômé, lui, exerce
 * son droit ; l'application ne fait que porter sa parole.
 *
 * ===========================================================================
 * CE QUI PROTÈGE À LA PLACE DU FILTRE
 * ===========================================================================
 *
 * L'ATTRIBUTION, et elle seule. Le filtre retiré, plus rien n'empêche un verbe
 * d'ordre d'atteindre le pilote — c'est voulu. Ce qui doit rester impossible,
 * c'est qu'il l'atteigne SANS QU'ON SACHE QUI PARLE : une consigne rendue nue,
 * au milieu des lectures, se lirait comme une lecture automatique. Et ce
 * jour-là, l'application conseillerait.
 *
 * Cette garde tient ce contrat au seul endroit où il peut se vérifier sans
 * monter d'écran : tout fichier qui affiche le corps d'une consigne porte aussi
 * sa marque d'attribution.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, sep } from 'path';

const RACINE = process.cwd();

/** Les marques qui disent « ceci vient d'un tiers ». Une seule suffit. */
const MARQUES_ATTRIBUTION = ['De votre coach', 'DE VOTRE COACH', 'CONSIGNE', 'coachName'];

function fichiers(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && !e.name.startsWith('.')) fichiers(p, acc);
    } else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts')) {
      acc.push(p);
    }
  }
  return acc;
}

const TOUS = [...fichiers(join(RACINE, 'app')), ...fichiers(join(RACINE, 'src'))].filter(
  (f) => !f.includes(`${sep}__tests__${sep}`)
);

/**
 * LES SURFACES QUI AFFICHENT UNE CONSIGNE — nommées, pas devinées.
 *
 * Une première écriture les cherchait par un prédicat sur le source. Le
 * prédicat validait le bilan quand on le lui soumettait seul, et l'écartait du
 * filtre : un comportement que je n'ai pas su reproduire, et une garde dont on
 * ne comprend pas la sélection ne garde rien.
 *
 * La liste explicite est de toute façon plus forte. Elle ne peut pas rater un
 * fichier en silence, et le second test ci-dessous la tient à jour : toute
 * surface NOUVELLE qui affiche une consigne sans être inscrite ici échoue.
 */
const SURFACES_ATTRIBUANTES: readonly string[] = [
  join('app', '(app2)', 'bilan', '[sessionId].tsx'),
];

describe('la consigne du coach est toujours attribuée', () => {
  it.each(SURFACES_ATTRIBUANTES)('%s affiche la consigne ET dit qui parle', (relatif) => {
    const src = readFileSync(join(RACINE, relatif), 'utf8');

    // Elle affiche bien un corps de consigne — sinon la ligne est périmée.
    expect(/consigne/i.test(src)).toBe(true);
    expect(/\.body/.test(src)).toBe(true);

    // Et elle l'attribue.
    expect(MARQUES_ATTRIBUTION.some((m) => src.includes(m))).toBe(true);
  });

  /**
   * LE FILET — toute surface NOUVELLE qui afficherait une consigne sans figurer
   * ci-dessus échoue ici.
   *
   * C'est la moitié qui manque à une liste écrite à la main : sans elle, la
   * liste vieillit et personne ne le voit.
   */
  it('aucune autre surface n’affiche une consigne', () => {
    const inscrites = new Set(SURFACES_ATTRIBUANTES.map((r) => join(RACINE, r)));
    const oubliees = TOUS.filter((f) => {
      if (inscrites.has(f)) return false;
      if (!f.endsWith('.tsx')) return false;
      const src = readFileSync(f, 'utf8');
      return /consigneOuverte|ConsigneCoach|\.consignes/.test(src) && /<Text/.test(src);
    }).map((f) => f.replace(RACINE, ''));
    expect(oubliees).toEqual([]);
  });
});

describe('le service ne filtre plus la parole du coach', () => {
  const service = readFileSync(join(RACINE, 'src', 'services', 'coachConsignesService.ts'), 'utf8');

  /**
   * Le filtre a existé quelques heures, le 01/09/2026. S'il revient, c'est
   * qu'on aura réappliqué à un humain diplômé la retenue qui protège
   * l'application — et ce test doit alors échouer, pour qu'on relise
   * `CoachBand` avant de le remettre.
   */
  it('aucune traduction de violation doctrinale ne subsiste', () => {
    expect(service).not.toContain('doctrine_violation');
  });

  it('la raison du retrait est écrite, pas seulement le retrait', () => {
    expect(service).toContain('BPJEPS');
    expect(service).toContain('CoachBand');
  });
});
