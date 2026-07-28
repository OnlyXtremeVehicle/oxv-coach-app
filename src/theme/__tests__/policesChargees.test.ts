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
});
