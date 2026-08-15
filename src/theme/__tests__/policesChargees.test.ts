/**
 * Toute police NOMMÉE doit être CHARGÉE — jalon 2, phase 1.
 *
 * ---
 *
 * POURQUOI CE TEST EXISTE
 *
 * Une police citée dans un style mais absente du chargeur ne produit **aucune
 * erreur**. React Native retombe silencieusement sur la police système. Le texte
 * s'affiche, il est simplement… faux. Personne ne le voit en relecture de code,
 * et sur un écran chargé personne ne le voit non plus.
 *
 * C'est le même motif que les gardes trouvées inertes ailleurs dans ce dépôt :
 * l'absence ne se signale pas d'elle-même.
 *
 * Le lot « onze graisses mortes » retire des familles entières. Sans ce test,
 * une seule occurrence oubliée aurait dégradé un écran sans que rien ne le dise.
 *
 * ---
 *
 * ET L'INVERSE : une police chargée sans être employée coûte du poids et du
 * temps de démarrage pour rien. Le test le signale aussi, en avertissement
 * plutôt qu'en échec — une graisse peut être posée en prévision d'un lot proche.
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const RACINE = join(__dirname, '..', '..', '..');

/** Familles susceptibles d'apparaître dans un style. */
const FAMILLES =
  /^(HankenGrotesk|JetBrainsMono|Inter|Syncopate|Michroma|Geist|GeistMono|Rajdhani|InstrumentSerif)_/;

function fichiers(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!/node_modules|__tests__/.test(e.name) && !e.name.startsWith('.')) fichiers(p, out);
    } else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const SOURCE_CHARGEUR = readFileSync(join(RACINE, 'src', 'theme', 'fonts.ts'), 'utf8');

/** Les graisses réellement passées à `useFonts`. */
const CHARGEES = new Set(
  (SOURCE_CHARGEUR.match(/^\s{4}([A-Z][A-Za-z]+_[A-Za-z0-9_]+),/gm) ?? []).map((s) =>
    s.trim().replace(',', '')
  )
);

/** Les graisses citées ailleurs que dans le chargeur. */
function policesCitees(): Map<string, string[]> {
  const vues = new Map<string, string[]>();
  for (const f of [...fichiers(join(RACINE, 'src')), ...fichiers(join(RACINE, 'app'))]) {
    if (f.endsWith('fonts.ts')) continue;
    const src = readFileSync(f, 'utf8');
    // Les COMMENTAIRES sont écartés : un en-tête de correctif nomme forcément
    // la police qu'il vient de retirer.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const m of code.matchAll(/'([A-Z][A-Za-z]+_[A-Za-z0-9_]+)'/g)) {
      const nom = m[1];
      if (!FAMILLES.test(nom)) continue;
      const liste = vues.get(nom) ?? [];
      liste.push(f.replace(RACINE, '').replace(/\\/g, '/'));
      vues.set(nom, liste);
    }
  }
  return vues;
}

describe('polices — nommées et chargées', () => {
  it('le chargeur monte bien des graisses', () => {
    expect(CHARGEES.size).toBeGreaterThan(0);
  });

  // LE test du lot. Une police nommée sans être chargée dégrade un écran en
  // silence : aucune erreur, aucun avertissement, juste la police système.
  it('AUCUNE police nommée n’est absente du chargeur', () => {
    const manquantes: string[] = [];
    for (const [nom, ou] of policesCitees()) {
      if (!CHARGEES.has(nom)) manquantes.push(`${nom} — ${ou.join(', ')}`);
    }
    expect(manquantes).toEqual([]);
  });

  it('les familles retirées ne sont plus citées nulle part', () => {
    const retirees = /^(Geist|GeistMono|Rajdhani|InstrumentSerif)_/;
    const restantes = [...policesCitees().keys()].filter((n) => retirees.test(n));
    expect(restantes).toEqual([]);
  });

  it('le chargeur ne monte plus les familles retirées', () => {
    for (const nom of CHARGEES) {
      expect(nom).not.toMatch(/^(Geist|GeistMono|Rajdhani|InstrumentSerif)_/);
    }
  });

  /**
   * L'AUTRE SENS, ARMÉ LE 14/08/2026.
   *
   * L'en-tête de ce fichier annonçait ce contrôle depuis le premier jour, « en
   * avertissement plutôt qu'en échec ». Il n'existait pas. C'est le motif que
   * ce dépôt répète : la garde est décrite, elle n'est pas posée.
   *
   * Ce qu'elle coûtait : Syncopate (2 graisses) et Inter (4) étaient montés
   * DEVANT le splash pour `lotProfilTokens`, dont les seuls importateurs
   * vivent dans `archive/arbre-v1/`. Six fichiers de police téléchargés et
   * décodés à chaque démarrage à froid, pour une table que rien de vivant ne
   * lisait — et rien ne le disait.
   *
   * En échec et non en avertissement : un avertissement que personne ne lit ne
   * vaut pas mieux que le contrôle absent. Pour poser une graisse en prévision
   * d'un lot, on la nomme dans le jeton qui l'attend — c'est plus honnête
   * qu'un chargement muet.
   */
  it('AUCUNE police chargée n’est inemployée — le splash n’attend rien pour rien', () => {
    const citees = new Set(policesCitees().keys());
    const inutiles = [...CHARGEES].filter((n) => !citees.has(n));
    expect(inutiles).toEqual([]);
  });

  /**
   * Et le compte, écrit noir sur blanc.
   *
   *   18 au matin du 14/08 · 12 le soir (Syncopate et Inter sortis) · 11 le
   *   15/08, Michroma sorti à son tour sur décision du fondateur.
   *
   * Ce nombre n'est pas un détail de style — c'est du temps de démarrage à
   * froid pris à tous les pilotes. Le faire bouger doit être un geste
   * conscient, pas une dérive : ce test a échoué au passage de 12 à 11, et
   * c'est exactement ce qu'on lui demande.
   */
  it('le chargeur monte onze graisses, pas dix-huit', () => {
    expect([...CHARGEES].sort()).toEqual([
      'HankenGrotesk_300Light',
      'HankenGrotesk_400Regular',
      'HankenGrotesk_400Regular_Italic',
      'HankenGrotesk_500Medium',
      'HankenGrotesk_600SemiBold',
      'HankenGrotesk_700Bold',
      'HankenGrotesk_800ExtraBold',
      'JetBrainsMono_400Regular',
      'JetBrainsMono_500Medium',
      'JetBrainsMono_600SemiBold',
      'JetBrainsMono_700Bold',
    ]);
  });
});
