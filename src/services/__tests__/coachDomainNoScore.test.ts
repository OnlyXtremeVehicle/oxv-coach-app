/**
 * GARDE-FOU DOCTRINAL (décision fondateur 19/07/2026) — le domaine coach ne
 * porte AUCUNE note / score / échelle / étoile.
 *
 * « Un test qui échoue si une colonne nommée rating, score, note, stars
 *  réapparaît quelque part sur le domaine coach — le garde-fou automatisé,
 *  comme le lexique interdit des phrases du ciel. »
 *
 * Instrument : le contrat de types généré (src/types/database.types.ts), qui
 * reflète le schéma RÉEL de production (régénéré par `supabase gen types`). Si
 * une future migration (ré)introduit une colonne de notation sur une table du
 * domaine coach, ce test casse.
 *
 * Nuance de lexique — « note » :
 *   « note » est ambigu en français : une NOTE chiffrée (grade 1-5) est interdite,
 *   mais une « note » TEXTE (annotation, remarque) est légitime et préexiste
 *   (coach_pilot_highlight.note, coach_reading_weights.note sont des `text`).
 *   On interdit donc `note` UNIQUEMENT si elle est numérique — ce qui capture la
 *   note-grade sans faux positif sur l'annotation. `rating` / `score` / `stars`
 *   sont interdits par le NOM (mots de notation sans ambiguïté).
 *
 * Hors périmètre volontaire : `testimonials_public(_rows)` porte un `rating` mais
 * n'est PAS préfixée `coach` — c'est une fonctionnalité distincte (témoignages
 * site), sans lien avec le domaine coaching ni avec la table supprimée.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const TYPES_PATH = join(__dirname, '..', '..', 'types', 'database.types.ts');

interface ColumnRef {
  name: string;
  type: string;
}

/**
 * Extrait, pour chaque entrée dont le nom commence par « coach » (TABLE, VUE ou
 * FONCTION tabulaire), la liste de ses colonnes exposées (nom + type). Scanne les
 * sous-blocs `Row: {` (tables/vues) ET `Returns: { … }[]` (fonctions RPC qui
 * renvoient des lignes) — de sorte qu'une colonne de notation ne puisse pas se
 * faufiler par une RPC. Parseur adossé au format stable de `supabase gen types`
 * (indentation 6/8/10 espaces ; les Args d'entrée sont volontairement ignorés).
 */
function coachDomainRows(src: string): { table: string; columns: ColumnRef[] }[] {
  const lines = src.split('\n');
  const out: { table: string; columns: ColumnRef[] }[] = [];
  let i = 0;
  while (i < lines.length) {
    const header = /^ {6}(coach\w*): \{$/.exec(lines[i]);
    if (!header) {
      i++;
      continue;
    }
    const table = header[1];
    const columns: ColumnRef[] = [];
    let j = i + 1;
    // Parcourt le bloc de cette entrée jusqu'au prochain en-tête 6-espaces.
    while (j < lines.length && !/^ {6}\w/.test(lines[j])) {
      // Sous-bloc de colonnes : Row (table/vue) ou Returns (fonction tabulaire).
      if (/^ {8}(Row|Returns): \{$/.test(lines[j])) {
        j++;
        // Ferme sur `}` ou `}[]` (une RPC tabulaire renvoie un tableau).
        while (j < lines.length && !/^ {8}\}(\[\])?$/.test(lines[j])) {
          const col = /^ {10}(\w+)\??:\s*(.+)$/.exec(lines[j]);
          if (col) columns.push({ name: col[1], type: col[2].trim() });
          j++;
        }
      }
      j++;
    }
    out.push({ table, columns });
    i = j;
  }
  return out;
}

const src = readFileSync(TYPES_PATH, 'utf8');
const domain = coachDomainRows(src);

/** Une colonne est-elle numérique (type contenant `number`) ? */
function isNumeric(type: string): boolean {
  return /\bnumber\b/.test(type);
}

describe('garde-fou domaine coach — aucune note/score/étoile', () => {
  it('surveille bien des tables du domaine coach (parseur non vide)', () => {
    expect(domain.length).toBeGreaterThan(0);
  });

  it('coach_testimonials existe et porte body + published (migration appliquée)', () => {
    const t = domain.find((d) => d.table === 'coach_testimonials');
    expect(t).toBeDefined();
    expect(t?.columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(['body', 'published', 'author_user_id', 'coach_id'])
    );
  });

  it('coach_reviews (table notée) a disparu du contrat de types', () => {
    expect(domain.some((d) => d.table === 'coach_reviews')).toBe(false);
  });

  it.each(['rating', 'score', 'stars'])(
    'aucune colonne « %s » (mot de notation) sur le domaine coach',
    (bad) => {
      const offenders = domain
        .filter((d) => d.columns.some((c) => c.name.toLowerCase() === bad))
        .map((d) => d.table);
      expect(offenders).toEqual([]);
    }
  );

  it('aucune colonne « note » NUMÉRIQUE (grade) sur le domaine coach', () => {
    // Une note TEXTE (annotation) reste permise ; seule la note chiffrée est bannie.
    const offenders = domain
      .filter((d) => d.columns.some((c) => c.name.toLowerCase() === 'note' && isNumeric(c.type)))
      .map((d) => d.table);
    expect(offenders).toEqual([]);
  });

  it('le domaine coach ne contient aucune colonne numérique évoquant une note', () => {
    // Filet supplémentaire : toute colonne numérique dont le nom évoque une note
    // (notation, note_globale, note_moyenne, avg_rating, star_count, …).
    const suspicious =
      /^(notation|note_\w+|\w+_note|avg_rating|average_rating|rating_\w+|\w+_rating|star_count|\w+_stars|score_\w+|\w+_score)$/;
    const offenders: string[] = [];
    for (const d of domain) {
      for (const c of d.columns) {
        if (isNumeric(c.type) && suspicious.test(c.name.toLowerCase())) {
          offenders.push(`${d.table}.${c.name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
