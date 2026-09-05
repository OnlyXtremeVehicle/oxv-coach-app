/**
 * GARDE R1 — tout écran a DEUX entrées, ou une exception datée qui dit pourquoi.
 *
 * ===========================================================================
 * LA MOITIÉ DE CETTE RÈGLE ÉTAIT DÉJÀ GARDÉE, ET LE BRIEF NE LE DISAIT PAS
 * ===========================================================================
 *
 * `src/lib/__tests__/orphelinsApp2.guard.test.ts` interdit depuis le jalon 5
 * qu'un écran de l'arbre pilote ait ZÉRO entrée. Ce qui manquait à R1 est la
 * SECONDE entrée, pas la première — et le tableau des sept règles portait
 * « à écrire » comme si rien n'existait. **Chercher avant d'écrire, y compris
 * quand c'est soi-même qu'on relit.**
 *
 * ===========================================================================
 * CE QUE COMPTE UNE « ENTRÉE », ET POURQUOI CE COMPTAGE-LÀ
 * ===========================================================================
 *
 * Un fichier du dépôt qui porte le CHEMIN de l'écran dans un littéral de
 * chaîne, hors commentaires. Quatre normalisations, chacune tirée d'une forme
 * réellement employée ici :
 *
 *   `/(app2)/club/galerie`              router.navigate, forme complète
 *   `/data/session/${id}`               groupe omis — expo-router l'accepte
 *   `/(coach)/pilote/[id]`              pathname littéral d'un objet de route
 *   `/(app2)/data/session/${sessionId}` gabarit — `${…}` ramené au même motif
 *
 * Sans ces quatre-là, la mesure rendait **130 écrans sans entrée** sur 144.
 * C'était le comptage qui était faux, pas le dépôt. Une garde qui se trompe en
 * accusant est pire qu'une garde absente : elle apprend à ne plus la lire.
 *
 * ===========================================================================
 * CE QU'ELLE NE PEUT PAS FAIRE, ET IL FAUT LE DIRE
 * ===========================================================================
 *
 * Elle vérifie qu'un chemin EXISTE dans le code vivant, pas qu'il est
 * atteignable À L'ÉCRAN. Un lien enfermé sous une condition de donnée jamais
 * vraie la satisferait — et ce n'est pas une hypothèse : l'en-tête
 * d'`orphelinsApp2.guard` raconte que c'est arrivé, sur ces écrans-là, au Club.
 * Le contrôle humain reste nécessaire.
 *
 * Elle compte des FICHIERS, pas des chemins de navigation distincts : deux
 * liens dans un même écran comptent pour un. C'est délibéré — deux boutons
 * côte à côte ne sont pas deux entrées.
 *
 * ===========================================================================
 * L'ÉTAT AU 05/09/2026
 * ===========================================================================
 *
 *     144 écrans      0 sans entrée      97 à une entrée      47 à deux et plus
 *
 * Les 97 sont couverts par six familles d'exceptions, dont **cinq sont des
 * formes justes** — un moyeu de console, un entonnoir, un détail depuis sa
 * liste. La sixième, dix tiroirs pilotes, est la seule dette, et la seule datée
 * court : **19/09/2026**, la répétition de Bouteville.
 */

import { readFileSync, readdirSync } from 'fs';
import { basename, join } from 'path';

import { exceptionsDeuxEntrees, FAMILLES } from '@/lib/deuxEntrees.exceptions';
import { codeSansCommentaires } from '@/test-utils/codeSeul';

const RACINE = process.cwd();

const relatif = (p: string): string =>
  p.replace(/\\/g, '/').replace(RACINE.replace(/\\/g, '/'), '').replace(/^\//, '');

function sources(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', '__tests__', 'archive', '.git'].includes(e.name)) sources(p, acc);
    } else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

/**
 * LE FICHIER D'EXCEPTIONS N'EST PAS UNE ENTRÉE — et il a failli le devenir.
 *
 * Il cite les quatre-vingt-dix-sept routes qu'il excepte, dans des littéraux,
 * et il vit sous `src/`. Au premier passage, la garde a donc compté **deux
 * entrées pour tout le monde** : la vraie, plus celle-ci. Toutes les exceptions
 * sont devenues « périmées » d'un coup.
 *
 * C'est le test des exceptions périmées qui l'a attrapé, et c'est exactement ce
 * pour quoi il existe. Un fichier qui LISTE des routes n'est pas un fichier qui
 * y MÈNE — la distinction n'est pas lexicale, elle est nommée ici.
 */
const PAS_UNE_ENTREE = 'src/lib/deuxEntrees.exceptions.ts';

const APP = sources(join(RACINE, 'app')).map(relatif);
const TOUS = [...APP, ...sources(join(RACINE, 'src')).map(relatif)].filter(
  (f) => f !== PAS_UNE_ENTREE
);

/** Les ÉCRANS : les fichiers de `app/` qui ne sont ni layout ni fichier spécial. */
const ECRANS = APP.filter((f) => {
  const b = basename(f);
  return b !== '_layout.tsx' && !b.startsWith('+');
});

/** Le motif de route d'un fichier : groupe gardé, `index` remonté, `[x]` → `*`. */
export function motifDeRoute(fichier: string): string {
  const u = fichier
    .replace(/^app/, '')
    .replace(/\.tsx?$/, '')
    .replace(/\/index$/, '')
    .replace(/\[[^\]]+\]/g, '*');
  return u === '' ? '/' : u;
}

/** Le même motif, groupe retiré — expo-router accepte les deux écritures. */
export const sansGroupe = (motif: string): string => motif.replace(/\/\([^)]+\)/g, '') || '/';

/**
 * Les chemins qu'une source cite, normalisés au motif de route.
 *
 * `${…}` et `[…]` deviennent `*`, la query et le fragment tombent : c'est ce
 * qui fait qu'un gabarit et un motif dynamique se reconnaissent.
 */
export function cheminsCites(code: string): Set<string> {
  const out = new Set<string>();
  const re = /'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const brut = m[1] ?? m[2] ?? m[3];
    if (typeof brut !== 'string' || !brut.startsWith('/')) continue;
    const v = (brut.split('?')[0] as string)
      .split('#')[0]
      .replace(/\$\{[^}]*\}/g, '*')
      .replace(/\[[^\]]+\]/g, '*')
      .replace(/\/+$/, '');
    out.add(v === '' ? '/' : v);
  }
  return out;
}

const CITES = new Map(
  TOUS.map((f) => [f, cheminsCites(codeSansCommentaires(readFileSync(join(RACINE, f), 'utf8')))])
);

/** Les fichiers qui mènent à un écran — l'écran lui-même exclu. */
function entrees(ecran: string): string[] {
  const m = motifDeRoute(ecran);
  const sg = sansGroupe(m);
  return TOUS.filter((f) => {
    if (f === ecran) return false;
    const c = CITES.get(f) as Set<string>;
    return c.has(m) || c.has(sg);
  });
}

const MESURE = ECRANS.map((e) => ({ ecran: e, motif: motifDeRoute(e), n: entrees(e).length }));
const EXCEPTIONS = exceptionsDeuxEntrees();
const EXCEPTES = new Set(EXCEPTIONS.map((x) => x.route));

/** Aujourd'hui, à la journée — une date de relecture se compare en jours. */
const AUJOURD_HUI = new Date().toISOString().slice(0, 10);

describe('R1 — la règle des deux entrées', () => {
  it('la garde a de quoi mesurer', () => {
    // 144 écrans le 05/09/2026. Si ce compte tombait, ce serait le balayage qui
    // serait cassé, pas le dépôt qui aurait maigri.
    expect(ECRANS.length).toBeGreaterThan(120);
    expect(EXCEPTIONS.length).toBeGreaterThan(80);
    // Et la mesure trouve bien des écrans BIEN desservis : si tout tombait à
    // une entrée, c'est la normalisation qui aurait lâché.
    expect(MESURE.filter((m) => m.n >= 2).length).toBeGreaterThan(30);
  });

  /**
   * LE CŒUR. Un écran à moins de deux entrées doit être listé — sinon il est en
   * faute, et la garde le nomme avec son compte.
   */
  it('tout écran a deux entrées, ou figure aux exceptions', () => {
    const fautifs = MESURE.filter((m) => m.n < 2 && !EXCEPTES.has(m.motif))
      .map((m) => `${m.motif} — ${m.n} entrée(s)`)
      .sort();
    expect(fautifs).toEqual([]);
  });

  /**
   * AUCUN ORPHELIN. `orphelinsApp2.guard` le tient déjà pour l'arbre pilote ;
   * ici on l'étend à TOUT `app/`, et on refuse qu'une exception couvre un
   * orphelin — une exception dit « une entrée suffit », jamais « zéro ».
   */
  it('aucun écran n’a zéro entrée, exception ou pas', () => {
    expect(MESURE.filter((m) => m.n === 0).map((m) => m.motif)).toEqual([]);
  });

  /**
   * PAS D'ENTRÉE PÉRIMÉE. Un écran qui a gagné sa seconde entrée doit SORTIR de
   * la liste, dans le même commit. C'est la leçon déjà payée par la liste des
   * orphelins : une liste qu'on n'élague pas cesse de décrire le dépôt.
   */
  it('aucune exception ne survit à l’écran qu’elle couvrait', () => {
    const parMotif = new Map(MESURE.map((m) => [m.motif, m.n]));
    const perimees = EXCEPTIONS.filter((x) => (parMotif.get(x.route) ?? 0) >= 2)
      .map((x) => `${x.route} — a maintenant ${String(parMotif.get(x.route))} entrées`)
      .sort();
    expect(perimees).toEqual([]);
  });

  /** Et aucune exception ne vise une route qui n'existe pas. */
  it('aucune exception ne vise un écran absent', () => {
    const connus = new Set(MESURE.map((m) => m.motif));
    expect(EXCEPTIONS.filter((x) => !connus.has(x.route)).map((x) => x.route)).toEqual([]);
  });

  /**
   * CHAQUE EXCEPTION PORTE UNE RAISON ÉCRITE. D-3 l'exige en français ; on
   * vérifie ce qui est vérifiable — une phrase, pas un mot, pas un code.
   */
  it('chaque exception porte une raison écrite', () => {
    const muettes = EXCEPTIONS.filter(
      (x) => x.raison.trim().split(/\s+/).length < 8 || !/[a-zà-ÿ]{4}/i.test(x.raison)
    ).map((x) => x.route);
    expect(muettes).toEqual([]);
  });

  /**
   * ET CHAQUE EXCEPTION PORTE UNE DATE QUI N'EST PAS PASSÉE.
   *
   * « Une exception sans date n'est pas une exception, c'est un abandon »
   * (D-3). Le 19/09/2026, les dix tiroirs pilotes font échouer ce test s'ils
   * n'ont pas bougé. **C'est le mécanisme, pas un accident.**
   */
  it('chaque exception porte une date de relecture non passée', () => {
    const malformees = EXCEPTIONS.filter((x) => !/^\d{4}-\d{2}-\d{2}$/.test(x.jusquau)).map(
      (x) => x.route
    );
    expect(malformees).toEqual([]);

    const perimees = [
      ...new Set(EXCEPTIONS.filter((x) => x.jusquau < AUJOURD_HUI).map((x) => x.jusquau)),
    ];
    expect(perimees).toEqual([]);
  });

  /**
   * LA DETTE EST NOMMÉE, ET ELLE EST DATÉE COURT. Si quelqu'un repoussait la
   * date des tiroirs pilotes à celle des familles structurelles, la dette
   * disparaîtrait sans être payée — ce test l'interdit.
   */
  it('les tiroirs pilotes gardent une date courte, distincte des familles structurelles', () => {
    expect(FAMILLES.tiroirPilote.jusquau).toBe('2026-09-19');
    expect(FAMILLES.tiroirPilote.routes.length).toBeGreaterThan(5);
    for (const [nom, f] of Object.entries(FAMILLES)) {
      if (nom === 'tiroirPilote') continue;
      expect(f.jusquau > FAMILLES.tiroirPilote.jusquau).toBe(true);
    }
  });

  /**
   * LE CONTRE-TEST, sans lequel une liste vide ne prouve rien : la
   * normalisation pourrait ne rien reconnaître, et tout paraîtrait desservi.
   */
  it('le contre-test : les quatre écritures de chemin sont reconnues', () => {
    expect(motifDeRoute('app/(app2)/club/galerie.tsx')).toBe('/(app2)/club/galerie');
    expect(motifDeRoute('app/(app2)/club/index.tsx')).toBe('/(app2)/club');
    expect(motifDeRoute('app/(app2)/data/session/[id].tsx')).toBe('/(app2)/data/session/*');
    expect(sansGroupe('/(app2)/data/session/*')).toBe('/data/session/*');

    const code = `
      router.navigate('/(app2)/club/galerie' as never);
      router.push(\`/data/session/\${id}\` as never);
      router.push({ pathname: '/(coach)/pilote/[id]', params: { id } });
      const url = '/(app2)/vous?onglet=pieces';
    `;
    const c = cheminsCites(code);
    expect(c.has('/(app2)/club/galerie')).toBe(true);
    expect(c.has('/data/session/*')).toBe(true);
    expect(c.has('/(coach)/pilote/*')).toBe(true);
    expect(c.has('/(app2)/vous')).toBe(true); // la query est retirée
    // Et une chaîne qui n'est pas un chemin n'entre pas.
    expect(cheminsCites(`const x = 'galerie';`).size).toBe(0);
  });

  /**
   * ET LE COMMENTAIRE NE COMPTE PAS. Un chemin cité pour être expliqué n'est
   * pas un lien — c'est la faute que `codeSeul` existe pour empêcher, et cette
   * garde en dépend entièrement.
   */
  it('le contre-test : un chemin cité en commentaire n’est pas une entrée', () => {
    const code = `
      // On ouvrira '/(app2)/club/galerie' au lot suivant.
      /* Voir aussi '/(app2)/club/routes'. */
      const vrai = '/(app2)/club/pass';
    `;
    const c = cheminsCites(codeSansCommentaires(code));
    expect(c.has('/(app2)/club/pass')).toBe(true);
    expect(c.has('/(app2)/club/galerie')).toBe(false);
    expect(c.has('/(app2)/club/routes')).toBe(false);
  });
});
