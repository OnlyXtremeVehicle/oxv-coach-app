/**
 * GARDE — aucun écran de l'arbre pilote n'est inatteignable.
 *
 * *« Chaque hub atteint-il tous ses enfants ? Aujourd'hui : Data en atteint un
 * sur trois, le Club trois sur sept. »* — Plan de montage, jalon 5, critère
 * d'acceptation 2.
 *
 * ---
 *
 * CE QUE LE COMPTAGE À LA MAIN A TROUVÉ
 *
 * Trois écrans du Club — `galerie`, `routes`, `territoire` — n'avaient **aucun
 * lien entrant**, nulle part. `routes` avait été porté depuis l'arbre V1 sans
 * qu'on lui donne d'entrée : la capacité était conservée et perdue en même
 * temps, exactement comme le banc de capture.
 *
 * Et le défaut était pire que trois liens manquants : tous les blocs du hub
 * Club étaient conditionnés à des données — un coach, une écurie, une
 * invitation, un pass. Un pilote de son premier jour voyait une phrase vide et
 * ne pouvait atteindre AUCUN de ces trois écrans.
 *
 * ---
 *
 * CE QUE CETTE GARDE MESURE, ET CE QU'ELLE NE MESURE PAS
 *
 * Elle vérifie qu'un chemin vers chaque écran EXISTE dans le code vivant. Elle
 * ne vérifie pas qu'il est atteignable À L'ÉCRAN : un lien enfermé sous une
 * condition de donnée jamais vraie la satisferait. C'est précisément ce qui
 * s'était produit ; le contrôle humain reste nécessaire.
 *
 * Les commentaires sont retirés avant recherche — un chemin cité pour être
 * expliqué n'est pas un lien.
 */

import { readFileSync, readdirSync } from 'node:fs';

import { codeSansCommentaires } from '@/test-utils/codeSeul';
import { join, sep } from 'node:path';

const RACINE = join(__dirname, '..', '..', '..');

function fichiers(dossier: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const p = join(dossier, e.name);
    if (e.isDirectory()) fichiers(p, acc);
    else if (/\.tsx?$/.test(e.name)) acc.push(p.split(sep).join('/'));
  }
  return acc;
}

/** Le code vivant, commentaires retirés. */
function corpusVivant(): string {
  return [...fichiers(join(RACINE, 'app')), ...fichiers(join(RACINE, 'src'))]
    .map((f) => codeSansCommentaires(readFileSync(f, 'utf8')))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** Routes de `app/(app2)`, sans les layouts. */
function routesApp2(): string[] {
  const base = join(RACINE, 'app', '(app2)');
  return fichiers(base)
    .filter((f) => f.endsWith('.tsx') && !f.endsWith('_layout.tsx'))
    .map((f) => f.slice(base.split(sep).join('/').length + 1).replace(/\.tsx$/, ''));
}

describe("garde — aucun écran d'app2 n'est orphelin", () => {
  const corpus = corpusVivant();
  const routes = routesApp2();

  it("l'arbre pilote est bien celui qu'on croit", () => {
    // Une garde qui n'énumère rien passe sur un dépôt vide.
    expect(routes.length).toBeGreaterThan(30);
    expect(routes).toContain('club/routes');
    expect(routes).toContain('data/session/[id]');
  });

  it('chaque écran a au moins un chemin entrant dans le code vivant', () => {
    const orphelins: string[] = [];
    for (const route of routes) {
      // `x/index` s'atteint par la route de la zone, `x`.
      const cible = route.replace(/\/index$/, '');
      // Un segment dynamique s'atteint par interpolation : on cherche le préfixe.
      const cherche = cible.replace(/\/\[[^\]]+\]$/, '');
      const trouve =
        corpus.includes(`/(app2)/${cherche}`) ||
        (cible === 'index' && corpus.includes("'/(app2)'"));
      if (!trouve) orphelins.push(route);
    }
    expect(orphelins).toEqual([]);
  });

  it('les portes du Club sont atteintes SANS condition de donnée', () => {
    // Le défaut d'origine : les liens existaient bien… sous `hasAnyBlock`, faux
    // pour un pilote sans coaching ni écurie. Le bloc de portes est rendu hors
    // de cette condition, et ce contrôle le fige.
    //
    // `club/roulages` REJOINT LA LISTE LE 12/08/2026. Il n'était atteignable
    // que par le bloc « invitations » — donc seulement quand quelqu'un venait
    // d'inviter le pilote. Ses amis lui étaient inaccessibles le reste du
    // temps, et l'écran n'existait qu'au bon vouloir d'autrui.
    const hub = readFileSync(join(RACINE, 'app', '(app2)', 'club', 'index.tsx'), 'utf8');
    expect(hub).toContain('<PortesBlock />');
    for (const lieu of [
      'club/galerie',
      'club/routes',
      'club/territoire',
      'club/roulages',
      'data/comparer',
    ]) {
      expect(hub).toContain(`/(app2)/${lieu}`);
    }
    // `PortesBlock` est monté APRÈS la fermeture du ternaire `hasAnyBlock` :
    // il ne doit pas figurer à l'intérieur du `Stagger` conditionnel.
    const stagger = hub.slice(hub.indexOf('<Stagger'), hub.indexOf('</Stagger>'));
    expect(stagger).not.toContain('PortesBlock');
  });

  /**
   * Le bouton central est une porte à lui seul : il ouvre le Pass. Le vérifier
   * ici évite qu'un câblage « provisoire » y survive, comme celui du lot L0 —
   * qui menait à la porte Club, c'est-à-dire à un hub de sept enfants.
   */
  it('le bouton central mène au Pass, jamais à un hub', () => {
    const layout = readFileSync(join(RACINE, 'app', '(app2)', '_layout.tsx'), 'utf8');
    expect(layout).toContain('centralButtonRoute(central.mode)');
  });
});
