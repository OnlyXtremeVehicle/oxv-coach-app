/**
 * GARDE R3 — les deux univers visuels ne se mélangent pas.
 *
 * ===========================================================================
 * LA RÈGLE, VERBATIM, ET SES DEUX VOLETS
 * ===========================================================================
 *
 * `docs/specs/E_Systeme.md:25` : « Garde `frontiereUnivers` : aucun import de
 * `src/ui/v2` hors `(app2)` sauf la couche 2, aucun kit v1 dans `(app2)` ».
 *
 * Deux volets, mesurés séparément, qui ne rendent pas le même verdict.
 *
 * ===========================================================================
 * POURQUOI UN BALAYAGE LEXICAL NE SUFFIT PAS — ET SERAIT ROUGE À TORT
 * ===========================================================================
 *
 * Vingt-deux lignes de `src/` importent le kit pilote : `BandeTours`,
 * `CourbeDelta`, `StripMap`, `SaisonSections`, `EcouteNoteCoach`… Une garde qui
 * refuserait « tout import de `@/ui/v2` hors de `app/(app2)/` » serait ROUGE sur
 * les vingt-deux, et le dossier interdit d'écrire une garde rouge.
 *
 * Elle aurait tort. Ces modules ne sont montés QUE par des écrans `(app2)` :
 * ils sont du kit pilote rangé ailleurs, pas un mélange. **Ce qui décide n'est
 * pas où le fichier vit, c'est quel écran l'atteint.**
 *
 * Cette garde construit donc le graphe d'imports de `app/` et `src/`, puis
 * remonte, depuis CHAQUE route, l'ensemble des modules qu'elle atteint —
 * transitivement. Un module est en faute quand un écran du mauvais univers le
 * touche, fût-ce à travers cinq fichiers.
 *
 * C'est ainsi que le franchissement de `SecondFacteurRequis` avait été trouvé
 * le 03/09 : il n'est importé par aucun écran, mais `app/(admin)/_layout.tsx:86`
 * le monte. Un balayage de surface ne l'aurait jamais vu.
 *
 * ===========================================================================
 * CE QU'ELLE A MESURÉ EN NAISSANT
 * ===========================================================================
 *
 * Le 03/09/2026, cinq franchissements du volet 1, exactement :
 *
 *     app/(admin)/incidents.tsx          colors, SectionHeader, space, StateView, typo
 *     app/(admin)/securite.tsx           colors, PressScale, radius, space, typo
 *     app/(admin)/sessions-media.tsx     Photo
 *     src/components/SecondFacteurRequis colors, PressScale, radius, space, typo
 *     src/components/MediaGrid           Photo
 *
 * Les cinq ont été levés les 04 et 05/09. Le volet 2 était tenu depuis le début,
 * direct et transitif. **Cette garde naît donc verte, et c'est sa raison d'être :
 * elle ne constate pas un défaut, elle empêche son retour.**
 *
 * ===========================================================================
 * CE QUE `@/theme/v2` N'EST PAS, ET QUE J'AVAIS ÉCRIT FAUX
 * ===========================================================================
 *
 * J'ai soutenu, le 03/09, que « huit écrans pilotes importent `fontSize` du
 * thème coach ». **Faux, et la mesure le retourne :** `src/theme/v2.ts` ne porte
 * AUCUN import — c'est une fondation, pas un univers — et le kit pilote en
 * dépend lui-même, à sa racine (`src/ui/v2/tokens.ts:20` prend `dataColors`,
 * `ProvenanceTag.tsx:38` prend `theme`). Sous ma lecture, R3 aurait été violée
 * à la racine du kit pilote.
 *
 * Une garde VERTE prescrit d'ailleurs exactement cet import : `echelleTypo.guard`
 * balaie `app/` comme `src/` et son message d'échec dit « Employez `fontSize` de
 * src/theme/v2.ts ». Deux univers sur une fondation commune ne sont pas un
 * mélange. `@/theme/v2` n'entre donc dans aucun des deux volets.
 *
 * ===========================================================================
 * LA COUCHE 2 : CE QU'ELLE EST AUJOURD'HUI, ET CE QU'ELLE N'EST PAS
 * ===========================================================================
 *
 * La spécification l'annonce en `src/ui/data/` — « radar, tracé Skia, chrono,
 * états, barres, Fact, provenance, confiance, rejeu ». **Ce dossier n'existe
 * pas**, et la spécification est périmée SUR LE CHEMIN ; le principe tient.
 *
 * Sa première pièce réelle existe depuis le 05/09 : `src/components/media/`
 * (`Photo`, `blurhash`, `mediaMath`), sortie du kit pilote parce qu'elle ne
 * porte aucun jeton visuel et que deux univers en avaient besoin. Elle n'a pas
 * besoin d'être inscrite ici en exception : ne prenant rien à aucun kit, elle
 * n'est vue par aucun des deux volets. **Une couche 2 correctement construite
 * est invisible à cette garde** — c'est le meilleur test de son appartenance.
 *
 * ===========================================================================
 * SES LIMITES, ÉCRITES
 * ===========================================================================
 *
 * Elle lit les `from '…'` : un `require()` dynamique ou un import calculé lui
 * échappe. Elle suppose Expo Router — toute route est un fichier de `app/` — et
 * ne sait pas qu'un écran est inatteignable par la navigation. Enfin, un module
 * qu'aucune route n'atteint ne reçoit aucun verdict : il ne peut rien mélanger,
 * et c'est `modulesOrphelins` qui s'en occupe.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, posix } from 'path';

const RACINE = process.cwd();

/* ========================================================================== */
/*  LE GRAPHE — fonctions pures, pour que le contre-test puisse les nourrir   */
/* ========================================================================== */

/** Chemin relatif à la racine, en barres avant. */
function relatif(p: string): string {
  return p.replace(/\\/g, '/').replace(RACINE.replace(/\\/g, '/'), '').replace(/^\//, '');
}

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

const FICHIERS = [...sources(join(RACINE, 'app')), ...sources(join(RACINE, 'src'))].map(relatif);
const CONNUS = new Set(FICHIERS);

/**
 * Résout un spécificateur d'import vers un fichier du dépôt.
 *
 * `@/x` → `src/x` (l'alias du tsconfig), le relatif depuis le fichier, et rien
 * d'autre : `react-native`, `expo-image` et consorts ne sont pas des fichiers
 * d'ici et ne peuvent porter aucun jeton.
 */
export function resoudre(depuis: string, spec: string, connus: Set<string>): string | null {
  let brut: string;
  if (spec.startsWith('@/')) brut = `src/${spec.slice(2)}`;
  else if (spec.startsWith('.')) brut = posix.normalize(posix.join(posix.dirname(depuis), spec));
  else return null;
  for (const c of [brut, `${brut}.ts`, `${brut}.tsx`, `${brut}/index.ts`, `${brut}/index.tsx`]) {
    if (connus.has(c)) return c;
  }
  return null;
}

/** Les spécificateurs `from '…'` d'une source, commentaires compris ou non. */
function specificateurs(code: string): string[] {
  return [...code.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
}

const GRAPHE = new Map<string, string[]>();
for (const f of FICHIERS) {
  const code = readFileSync(join(RACINE, f), 'utf8');
  GRAPHE.set(
    f,
    specificateurs(code)
      .map((s) => resoudre(f, s, CONNUS))
      .filter((x): x is string => x !== null)
  );
}

/**
 * Pour chaque module, l'ensemble des ROUTES qui l'atteignent, transitivement.
 *
 * Une route est un fichier de `app/` — `_layout.tsx` compris, et c'est
 * essentiel : c'est un layout qui montait le franchissement transitif du 03/09.
 */
export function routesAtteignantes(
  graphe: Map<string, string[]>,
  routes: readonly string[]
): Map<string, Set<string>> {
  const par = new Map<string, Set<string>>();
  for (const r of routes) {
    const vus = new Set<string>();
    const pile = [r];
    while (pile.length > 0) {
      const f = pile.pop() as string;
      if (vus.has(f)) continue;
      vus.add(f);
      for (const d of graphe.get(f) ?? []) pile.push(d);
    }
    for (const f of vus) {
      const s = par.get(f) ?? new Set<string>();
      s.add(r);
      par.set(f, s);
    }
  }
  return par;
}

/* ========================================================================== */
/*  LES DEUX UNIVERS                                                          */
/* ========================================================================== */

/** Le kit PILOTE : tout ce qui vit sous `src/ui/v2/`. */
export const estKitPilote = (f: string): boolean => f.startsWith('src/ui/v2/');

/**
 * Le kit CONSOLE (dit « v1 ») : les composants à plat de `src/ui/`.
 *
 * À plat, et à plat seulement : `src/ui/v2/` est l'autre univers, et
 * `src/ui/carteIdentity.ts` est une table de données, pas un composant.
 */
export const estKitConsole = (f: string): boolean => /^src\/ui\/[A-Z][A-Za-z0-9]*\.tsx?$/.test(f);

/** Les routes de l'univers pilote. */
export const estRoutePilote = (r: string): boolean => r.startsWith('app/(app2)/');

const ROUTES = FICHIERS.filter((f) => f.startsWith('app/'));
const ATTEINT_PAR = routesAtteignantes(GRAPHE, ROUTES);

/**
 * Les franchissements d'un volet : les fichiers qui prennent au kit `interdit`
 * alors qu'une route du mauvais univers les atteint.
 */
function franchissements(
  estKitVise: (f: string) => boolean,
  routeEnFaute: (r: string) => boolean
): string[] {
  const sortie: string[] = [];
  for (const f of FICHIERS) {
    if (estKitVise(f)) continue; // un kit qui s'importe lui-même ne mélange rien
    const pris = [...new Set((GRAPHE.get(f) ?? []).filter(estKitVise))];
    if (pris.length === 0) continue;
    const routes = [...(ATTEINT_PAR.get(f) ?? [])].filter(routeEnFaute).sort();
    if (routes.length > 0) {
      sortie.push(`${f} — prend ${pris.join(', ')} — atteint par ${routes.join(', ')}`);
    }
  }
  return sortie.sort();
}

describe('R3 — la frontière entre les deux univers', () => {
  it('la garde a de quoi mesurer', () => {
    // Si le balayage ou la résolution cassait, tout deviendrait vert sans que
    // rien ne le dise. On vérifie donc qu'il y a bien un graphe et des routes.
    expect(FICHIERS.length).toBeGreaterThan(400);
    expect(ROUTES.length).toBeGreaterThan(100);
    const arcs = [...GRAPHE.values()].reduce((n, v) => n + v.length, 0);
    expect(arcs).toBeGreaterThan(1000);
    // Et la remontée transitive atteint bien plus que les routes elles-mêmes.
    expect(ATTEINT_PAR.size).toBeGreaterThan(ROUTES.length);
  });

  /**
   * VOLET 1 — le kit pilote ne sort pas de `(app2)`.
   *
   * Cinq franchissements le 03/09, zéro le 05/09. Voir l'en-tête.
   */
  it('aucune route hors (app2) n’atteint le kit pilote', () => {
    expect(franchissements(estKitPilote, (r) => !estRoutePilote(r))).toEqual([]);
  });

  /**
   * VOLET 2 — le kit console n'entre pas dans `(app2)`.
   *
   * Tenu depuis le début, direct ET transitif : les seuls modules de `src/` qui
   * prennent un composant console — `ProfilIndisponible`, `StateWrapper` — ne
   * sont montés par aucun écran pilote.
   */
  it('aucune route (app2) n’atteint le kit console', () => {
    expect(franchissements(estKitConsole, estRoutePilote)).toEqual([]);
  });

  /**
   * LA FONDATION COMMUNE N'EST PAS UN MÉLANGE, et cette garde doit continuer de
   * le savoir. `src/theme/v2.ts` ne dépend de rien et les DEUX kits en vivent.
   * Si quelqu'un le rangeait dans l'un des deux univers, les deux volets
   * deviendraient faux d'un coup.
   */
  it('`src/theme/v2.ts` reste une fondation, hors des deux univers', () => {
    expect(estKitPilote('src/theme/v2.ts')).toBe(false);
    expect(estKitConsole('src/theme/v2.ts')).toBe(false);
    // Le kit pilote en dépend, à sa racine : c'est ce qui rend l'exclusion
    // nécessaire plutôt que polie.
    expect(GRAPHE.get('src/ui/v2/tokens.ts')).toContain('src/theme/v2.ts');
  });

  /**
   * LE CONTRE-TEST, sur un graphe fabriqué. Sans lui, deux listes vides ne
   * prouvent rien : la résolution pourrait ne rien résoudre, la remontée ne rien
   * remonter, et la garde être verte pour n'avoir rien cherché.
   */
  it('le contre-test : la remontée transitive voit un franchissement indirect', () => {
    // Le motif exact de `SecondFacteurRequis` : un layout admin monte un
    // composant de `src/` qui prend le kit pilote. Aucun écran ne l'importe.
    const graphe = new Map<string, string[]>([
      ['app/(admin)/_layout.tsx', ['src/components/Faux.tsx']],
      ['app/(app2)/index.tsx', ['src/ui/v2/tokens.ts']],
      ['src/components/Faux.tsx', ['src/ui/v2/tokens.ts']],
      ['src/ui/v2/tokens.ts', []],
    ]);
    const routes = ['app/(admin)/_layout.tsx', 'app/(app2)/index.tsx'];
    const par = routesAtteignantes(graphe, routes);

    // Le composant est bien atteint par les deux univers…
    expect([...(par.get('src/components/Faux.tsx') ?? [])]).toEqual(['app/(admin)/_layout.tsx']);
    // …et le kit pilote, lui, est atteint par une route admin À TRAVERS lui.
    expect([...(par.get('src/ui/v2/tokens.ts') ?? [])].sort()).toEqual([
      'app/(admin)/_layout.tsx',
      'app/(app2)/index.tsx',
    ]);

    // Les deux prédicats d'univers discriminent.
    expect(estKitPilote('src/ui/v2/tokens.ts')).toBe(true);
    expect(estKitPilote('src/components/Faux.tsx')).toBe(false);
    expect(estKitConsole('src/ui/StateWrapper.tsx')).toBe(true);
    expect(estKitConsole('src/ui/v2/StateView.tsx')).toBe(false);
    expect(estKitConsole('src/ui/carteIdentity.ts')).toBe(false);
  });

  /**
   * ET LA RÉSOLUTION RÉSOUT VRAIMENT — l'alias, le relatif, le barrel, et rien
   * d'autre. Une résolution qui rendrait toujours `null` viderait les deux
   * volets en silence.
   */
  it('le contre-test : la résolution suit l’alias, le relatif et les barrels', () => {
    const connus = new Set(['src/ui/v2/index.ts', 'src/ui/v2/tokens.ts', 'src/components/A.tsx']);
    expect(resoudre('app/(app2)/x.tsx', '@/ui/v2', connus)).toBe('src/ui/v2/index.ts');
    expect(resoudre('app/(app2)/x.tsx', '@/ui/v2/tokens', connus)).toBe('src/ui/v2/tokens.ts');
    expect(resoudre('src/ui/v2/Autre.tsx', './tokens', connus)).toBe('src/ui/v2/tokens.ts');
    expect(resoudre('src/components/B.tsx', './A', connus)).toBe('src/components/A.tsx');
    // Une librairie n'est pas un fichier d'ici.
    expect(resoudre('src/components/B.tsx', 'react-native', connus)).toBeNull();
    // Un chemin qui n'existe pas non plus — pas de faux positif inventé.
    expect(resoudre('src/components/B.tsx', '@/ui/v2/Fantome', connus)).toBeNull();
  });

  /**
   * LES VINGT-DEUX LIGNES QUI RESTENT SONT CONFORMES, et il faut que la garde le
   * DÉMONTRE plutôt que de le supposer. `StripMap` prend le kit pilote et n'est
   * monté que par `(app2)/data/session/[id].tsx` : si un écran de console venait
   * l'employer, le volet 1 tomberait.
   */
  it('les modules pilotes rangés hors du kit restent atteints par (app2) seul', () => {
    const strip = 'src/components/telemetry/StripMap.tsx';
    expect(GRAPHE.get(strip)).toContain('src/ui/v2/index.ts');
    const routes = [...(ATTEINT_PAR.get(strip) ?? [])];
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every(estRoutePilote)).toBe(true);
  });
});
