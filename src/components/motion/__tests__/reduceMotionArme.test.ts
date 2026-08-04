/**
 * GARDE — une animation en BOUCLE consulte toujours « Réduire les animations ».
 *
 * ===========================================================================
 * POURQUOI CETTE GARDE EXISTE, ET POURQUOI ELLE EST LEXICALE
 * ===========================================================================
 *
 * Le plan de montage V3 pose, en Phase 1 : « le hook de réduction des
 * animations devient synchrone. **Dix composants l'ignorent.** »
 *
 * La première moitié a été traitée : les deux hooks du dépôt délèguent à
 * `useReducedMotion` de Reanimated, qui lit la valeur côté natif de façon
 * synchrone. La seconde ne l'avait pas été — et le commit qui a corrigé le hook
 * a même écrit « la correction est dans le hook, pas dans ses appelants »,
 * ce qui est vrai pour les sept qui l'appelaient, et sans effet sur ceux qui ne
 * l'appelaient pas.
 *
 * Relevé le 04/08/2026 : **neuf composants animaient sans jamais consulter le
 * réglage.** Le premier balayage n'en trouvait que cinq, tous sans boucle — le
 * compte manquait parce qu'il ne cherchait que Reanimated. Les vraies boucles
 * infinies vivaient dans l'autre moteur, `Animated.loop` de React Native :
 *
 *   AnatomieViz · DispersionViz · GGViz · TourIdealViz · TransfertViz
 *   TrackStage · DebriefMirror · StatusPill
 *
 * Les cinq premières sont montées ENSEMBLE sur l'écran d'une séance. Un pilote
 * qui a demandé l'absence de mouvement recevait donc cinq boucles infinies
 * simultanées, indéfiniment, sur la même vue.
 *
 * ===========================================================================
 * CE QUE CETTE GARDE VÉRIFIE, ET CE QU'ELLE NE VÉRIFIE PAS
 * ===========================================================================
 *
 * Elle est LEXICALE : elle lit les fichiers, elle ne monte aucun composant.
 * Elle vérifie qu'un fichier qui contient une animation EN BOUCLE — le cas où
 * le mouvement ne s'arrête jamais de lui-même — mentionne aussi le hook.
 *
 * Elle ne prouve PAS que le repli est correct. Un fichier qui appellerait le
 * hook sans rien en faire la passerait. Elle sert à ne rien OUBLIER, comme la
 * vérification de couverture de purge : le jugement reste à la revue.
 *
 * Elle ne couvre QUE les boucles. Une animation transitoire qui ignore le
 * réglage est un défaut moins grave — elle se termine — et l'imposer ici
 * ferait tomber des dizaines de fichiers d'un coup, ce qui transformerait la
 * garde en bruit qu'on apprend à contourner.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RACINE = join(__dirname, '..', '..', '..', '..');

/** Les deux hooks du dépôt répondent à la même question système. */
const HOOKS = /useReduceMotion|useReducedMotion|isReduceMotionEnabled/;

/**
 * Une animation dont le mouvement ne s'arrête pas de lui-même.
 *
 *   Animated.loop(…)          moteur React Native
 *   withRepeat(…, -1, …)      moteur Reanimated, répétition infinie
 */
const BOUCLE = /Animated\s*\.\s*loop\s*\(|withRepeat\s*\([\s\S]{0,400}?-1\s*,/;

function fichiers(dossier: string): string[] {
  const out: string[] = [];
  const parcourir = (d: string): void => {
    for (const e of readdirSync(d)) {
      if (e === 'node_modules' || e === '__tests__') continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) parcourir(p);
      else if (e.endsWith('.tsx') || e.endsWith('.ts')) out.push(p);
    }
  };
  parcourir(dossier);
  return out;
}

describe('« Réduire les animations » — la règle est armée', () => {
  const candidats = [...fichiers(join(RACINE, 'src')), ...fichiers(join(RACINE, 'app'))];

  it('aucune animation en boucle n’ignore le réglage système', () => {
    const fautifs = candidats
      .filter((f) => {
        const source = readFileSync(f, 'utf8');
        // Les hooks eux-mêmes et le kit de motion documentent la règle sans
        // l'appliquer à leur propre code.
        if (/motion[\\/]useReduceMotion\.ts$/.test(f)) return false;
        return BOUCLE.test(source) && !HOOKS.test(source);
      })
      .map((f) => f.replace(RACINE, '').replace(/\\/g, '/'));

    expect(fautifs).toEqual([]);
  });

  it('la garde peut échouer — elle reconnaît les deux moteurs', () => {
    // Sans ces deux cas, un jour où le motif changerait, le test passerait au
    // vert en ne trouvant plus rien à contrôler. C'est l'échec silencieux qu'on
    // veut éviter : un contrôle qui ne peut pas échouer ne contrôle rien.
    expect(BOUCLE.test('const l = Animated.loop(Animated.timing(v, {}));')).toBe(true);
    expect(BOUCLE.test('v.value = withRepeat(withTiming(1), -1, false);')).toBe(true);
    expect(BOUCLE.test('v.value = withTiming(1, { duration: 200 });')).toBe(false);
    expect(BOUCLE.test('v.value = withRepeat(withTiming(1), 3, false);')).toBe(false);
  });

  it('elle trouve bien des boucles dans le dépôt — sinon elle ne mesure rien', () => {
    // Garde contre le faux vert : si plus aucun fichier ne portait de boucle,
    // le premier test passerait pour de mauvaises raisons.
    const avecBoucle = candidats.filter((f) => BOUCLE.test(readFileSync(f, 'utf8')));
    expect(avecBoucle.length).toBeGreaterThan(5);
  });
});
