/**
 * Aucun chiffre fabriqué dans le catalogue des lectures — lot 13.
 *
 * ---
 *
 * POURQUOI CE TEST EXISTE
 *
 * Le catalogue portait, pour chacune des six lectures, un `fact` et un
 * `reading` repris des maquettes : « freinage sur 95 m », « 1,12 g latéral »,
 * « 1:41.2 », « 18 tours alignés ». Des valeurs inventées, dans le fichier que
 * son propre en-tête appelait « SOURCE UNIQUE de vérité ».
 *
 * Elles n'étaient plus rendues. Mais elles restaient à une ligne de l'être — un
 * `sublabel={r.fact}` aurait suffi — et rien n'aurait signalé le retour. Un
 * chiffre inventé ne lève aucune erreur : il s'affiche, plausible.
 *
 * Le dossier demande de séparer PHYSIQUEMENT les chiffres de démonstration du
 * code de production. La séparation la plus sûre est l'absence ; ce test la
 * maintient.
 *
 * ---
 *
 * CE QU'IL AUTORISE, ET POURQUOI
 *
 * Les niveaux — « Niveau 2 », « N4 · 6 axes » — sont des ÉTIQUETTES, pas des
 * mesures. Elles ne prétendent rien sur la séance du pilote. Le test les laisse
 * passer nommément plutôt que d'interdire tout chiffre, ce qui l'aurait rendu
 * impossible à satisfaire et donc, tôt ou tard, désactivé.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { READINGS } from '../catalogue';

const SOURCE = readFileSync(join(__dirname, '..', 'catalogue.ts'), 'utf8');

/** Retire les commentaires : l'en-tête cite forcément ce qu'il vient de retirer. */
function codeSeul(texte: string): string {
  return texte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Chaînes littérales du code, hors commentaires. */
function chainesLitterales(): string[] {
  const code = codeSeul(SOURCE);
  return [...code.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
}

/** Étiquettes de niveau — pas des mesures. */
const ETIQUETTES = /^(N[234]( · \d+ axes)?|Niveau [234] · .+)$/;

/** Unités physiques : leur présence à côté d'un nombre trahit une mesure. */
const UNITES = /\b\d[\d ,.]*\s*(m|km\/h|g|s|%|Hz|tours?|secondes?|mètres?)\b/i;

describe('catalogue — aucun chiffre fabriqué', () => {
  it('aucune chaîne ne porte de valeur avec unité', () => {
    const fautives = chainesLitterales().filter((s) => !ETIQUETTES.test(s) && UNITES.test(s));
    expect(fautives).toEqual([]);
  });

  // Les chronos ont leur propre forme, que la règle d'unités ne verrait pas.
  it('aucun chrono', () => {
    const fautives = chainesLitterales().filter((s) => /\b\d+:\d{2}[.,]\d+\b/.test(s));
    expect(fautives).toEqual([]);
  });

  /**
   * Le marqueur de mise en avant du chiffre roi. Sa présence signifiait qu'une
   * valeur était destinée à être rendue en mono coloré — donc affichée comme un
   * résultat de la séance.
   */
  it('aucun marqueur ** de mise en avant', () => {
    expect(codeSeul(SOURCE)).not.toContain('**');
  });
});

describe('catalogue — le contrat de forme', () => {
  // Les champs qui portaient les valeurs sont retirés du type ET des données.
  it('les entrées ne portent plus ni fact ni reading', () => {
    for (const r of READINGS) {
      expect(r).not.toHaveProperty('fact');
      expect(r).not.toHaveProperty('reading');
    }
  });

  it('les six lectures sont toujours là, avec leur méthode', () => {
    expect(READINGS).toHaveLength(6);
    for (const r of READINGS) {
      expect(r.source.length).toBeGreaterThan(20);
      expect(r.eyebrow.length).toBeGreaterThan(0);
    }
  });

  it('les clés sont uniques', () => {
    expect(new Set(READINGS.map((r) => r.key)).size).toBe(READINGS.length);
  });

  // Doctrine : un constat, jamais une consigne. Les méthodes décrivent un
  // instrument, elles ne s'adressent pas au pilote.
  it('aucune méthode n’est prescriptive', () => {
    for (const r of READINGS) {
      expect(r.source).not.toMatch(/vous devez|il faut|veuillez|freinez|accélérez|évitez/i);
    }
  });
});
