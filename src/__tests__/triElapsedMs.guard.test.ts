/**
 * GARDE R5 — toute lecture de trajectoire trie sur `elapsed_ms`, jamais
 * `created_at`.
 *
 * ===========================================================================
 * POURQUOI CETTE RÈGLE, ET POURQUOI ELLE N'EST PAS DÉCORATIVE
 * ===========================================================================
 *
 * `telemetry_frames` porte DEUX temps. `elapsed_ms` est le temps de la voiture,
 * écrit par le boîtier ; `created_at` est le moment où la ligne est arrivée en
 * base. Ils ne coïncident pas :
 *
 *   — la capture envoie par LOTS (`captureSyncQueue`), et un lot rejoué après
 *     une coupure réseau arrive après des trames plus tardives ;
 *   — une reprise de séance réinsère des trames anciennes ;
 *   — l'ingestion d'un fichier `.ubx` écrit 27 000 lignes en quelques secondes,
 *     toutes avec des `created_at` quasi identiques et sans ordre utile.
 *
 * Trier une trajectoire sur `created_at` produit donc un tracé dans le désordre
 * — et rien ne le signale : la courbe s'affiche, les chiffres sortent, ils sont
 * simplement faux. C'est la classe de défaut la plus coûteuse de ce dépôt,
 * celle qui ne casse rien.
 *
 * ===========================================================================
 * ÉTAT À L'ÉCRITURE : LA RÈGLE EST DÉJÀ RESPECTÉE
 * ===========================================================================
 *
 * Mesuré le 03/09/2026 sur les douze fichiers qui lisent `telemetry_frames` :
 * toutes les lectures de lignes ordonnent sur `elapsed_ms`, aucune sur
 * `created_at`. Cette garde n'est donc pas un constat, c'est un CLIQUET : elle
 * fige un état déjà bon pour qu'il le reste.
 *
 * Le brief nommait `triElapsedMs` dans son tableau des sept règles, avec la
 * mention « à écrire ». Elle l'est.
 *
 * ===========================================================================
 * CE QU'ELLE NE PEUT PAS FAIRE, ET IL FAUT LE DIRE
 * ===========================================================================
 *
 * Elle est LEXICALE. Elle découpe le texte à partir de chaque
 * `.from('telemetry_frames')` jusqu'à la requête suivante, et lit ce qu'elle y
 * trouve. Elle ne suit pas une variable à travers deux fonctions, et un tri
 * posé par un helper générique lui échapperait.
 *
 * Elle ne prétend pas non plus couvrir « toute requête de trajectoire » au sens
 * large : elle couvre `telemetry_frames`, qui EST la trajectoire. Les tours
 * (`laps`) s'ordonnent sur `lap_number`, ce qui est leur ordre propre.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RACINE = join(__dirname, '..', '..');

/** La table qui porte la trajectoire. */
const TABLE = "from('telemetry_frames')";

/** Tous les `.ts` / `.tsx` de `src/`, `app/` et `supabase/functions/`. */
function sources(): string[] {
  const trouves: string[] = [];
  const parcourir = (d: string): void => {
    for (const e of readdirSync(d)) {
      if (e === 'node_modules' || e === '__tests__') continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) parcourir(p);
      else if (e.endsWith('.ts') || e.endsWith('.tsx')) trouves.push(p);
    }
  };
  for (const r of ['src', 'app', join('supabase', 'functions')]) parcourir(join(RACINE, r));
  return trouves;
}

/**
 * Les chaînes de requête sur `telemetry_frames` d'une source.
 *
 * Chaque tronçon va d'un `.from('telemetry_frames')` jusqu'au `.from(` suivant
 * — la requête d'après — ou la fin du fichier. Ce découpage-là suit les chaînes
 * coupées par une condition, comme dans `filSeanceService`, où le `.order()`
 * est posé une dizaine de lignes plus bas, après un `if`.
 */
function requetesTrames(src: string): string[] {
  const troncons: string[] = [];
  let i = src.indexOf(TABLE);
  while (i !== -1) {
    const suivant = src.indexOf(".from('", i + TABLE.length);
    troncons.push(src.slice(i, suivant === -1 ? src.length : suivant));
    i = src.indexOf(TABLE, i + TABLE.length);
  }
  return troncons;
}

/** Une requête qui n'attend aucune ligne : écriture, ou comptage `head`. */
function sansLignes(t: string): boolean {
  return /\.(insert|upsert|delete)\(/.test(t) || /count:\s*'exact'\s*,\s*head:\s*true/.test(t);
}

const FICHIERS = sources().map((f) => ({
  chemin: f.replace(RACINE, '').replace(/\\/g, '/'),
  code: readFileSync(f, 'utf8'),
}));

const LECTEURS = FICHIERS.filter((f) => f.code.includes(TABLE));

describe('R5 — le tri des trajectoires', () => {
  it('la garde a de quoi mesurer', () => {
    // Douze fichiers lisaient les trames le 03/09/2026. Si ce compte tombait à
    // zéro, c'est le balayage qui serait cassé, pas le dépôt qui serait devenu
    // vertueux.
    expect(LECTEURS.length).toBeGreaterThan(5);
  });

  /**
   * LE CŒUR. Toute requête qui rend des LIGNES de trames doit dire dans quel
   * ordre. Sans `.order()`, PostgREST ne garantit rien — et « rien » ressemble
   * beaucoup à « l'ordre d'insertion » tant qu'on ne l'a pas mesuré.
   */
  it('toute lecture de trames ordonne sur `elapsed_ms`', () => {
    const muettes: string[] = [];
    for (const f of LECTEURS) {
      for (const t of requetesTrames(f.code)) {
        if (sansLignes(t)) continue;
        if (!/\.order\(\s*'elapsed_ms'/.test(t)) {
          muettes.push(`${f.chemin} — ${t.slice(0, 90).replace(/\s+/g, ' ')}…`);
        }
      }
    }
    expect(muettes).toEqual([]);
  });

  /**
   * ET AUCUNE NE TRIE SUR `created_at`. Le dépôt en compte soixante-cinq
   * usages légitimes — sur des médias, des notes, des comptes. Aucun ne doit
   * tomber sur une trajectoire.
   */
  it('aucune requête de trames ne trie sur `created_at`', () => {
    const fautives: string[] = [];
    for (const f of LECTEURS) {
      for (const t of requetesTrames(f.code)) {
        if (/\.order\(\s*'created_at'/.test(t)) {
          fautives.push(`${f.chemin} — ${t.slice(0, 90).replace(/\s+/g, ' ')}…`);
        }
      }
    }
    expect(fautives).toEqual([]);
  });

  /**
   * LE CONTRE-TEST, sans lequel un balayage qui ne trouve rien ne prouve rien.
   * On éprouve le découpage ET les deux détections sur des textes fabriqués.
   */
  it('le contre-test : le découpage et les détections marchent', () => {
    const mauvaise = `
      const { data } = await supabase
        .from('telemetry_frames')
        .select('elapsed_ms, latitude')
        .eq('session_id', id)
        .order('created_at', { ascending: true });
    `;
    const troncons = requetesTrames(mauvaise);
    expect(troncons).toHaveLength(1);
    expect(sansLignes(troncons[0])).toBe(false);
    expect(/\.order\(\s*'elapsed_ms'/.test(troncons[0])).toBe(false);
    expect(/\.order\(\s*'created_at'/.test(troncons[0])).toBe(true);

    // Une écriture et un comptage sont bien reconnus comme sans lignes.
    expect(sansLignes(`.from('telemetry_frames').insert(batch)`)).toBe(true);
    expect(
      sansLignes(`.from('telemetry_frames').select('id', { count: 'exact', head: true })`)
    ).toBe(true);

    // Et le découpage s'arrête bien à la requête suivante : un `created_at`
    // posé sur une AUTRE table ne doit pas être imputé aux trames.
    const deuxRequetes = `
      supabase.from('telemetry_frames').select('elapsed_ms').order('elapsed_ms');
      supabase.from('coach_annotations').select('*').order('created_at');
    `;
    const [premier] = requetesTrames(deuxRequetes);
    expect(/created_at/.test(premier)).toBe(false);
  });
});
