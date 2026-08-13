/**
 * GARDE — la chaîne de freinage reste ARMÉE, et pas depuis un seul écran.
 *
 * ===========================================================================
 * L'HISTOIRE, PARCE QU'ELLE EXPLIQUE LA FORME DE CETTE GARDE
 * ===========================================================================
 *
 * `BrakingPointsLayer` vivait dans `PilotPreset` derrière une garde
 * `brakingPoints && length > 0`, et **aucun appelant ne fournissait la prop** :
 * un calque entier qui ne pouvait pas s'allumer, et un service dont le seul
 * importateur était son propre test. Le motif de ce dépôt dans sa forme la plus
 * pure — la garde posée, non armée.
 *
 * Elle a été armée le 13/08 sur instruction du fondateur — *« garde la chaine de
 * freinage et rend la fiable »* — depuis `app/(coach)/triage.tsx`.
 *
 * Sauf que le plan du jalon 6 condamne `triage`. Supprimer l'écran aurait
 * éteint la chaîne : il en était le SEUL point de montage. Deux instructions
 * qui se croisent, et rien à trancher — il suffisait de découpler.
 *
 * ===========================================================================
 * CE QUE CETTE GARDE VÉRIFIE, ET CE QU'ELLE REFUSE
 * ===========================================================================
 *
 * Elle ne vérifie pas seulement que la chaîne est appelée quelque part. Elle
 * exige que ce quelque part **ne soit pas un écran** : un composant réutilisable,
 * que plusieurs hôtes peuvent monter. Un service dont la survie tient à un
 * fichier d'écran est un service qu'une suppression de routine éteint.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const RACINE = process.cwd();

function lire(...morceaux: string[]): string {
  return readFileSync(join(RACINE, ...morceaux), 'utf8');
}

/** Tous les `.tsx`/`.ts` d'un dossier, récursivement. */
function fichiers(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__') fichiers(p, acc);
    } else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) {
      acc.push(p);
    }
  }
  return acc;
}

/** Qui appelle réellement `detectBrakingPoints` — hors sa propre définition. */
function appelants(): string[] {
  const out: string[] = [];
  for (const racine of ['app', 'src']) {
    for (const f of fichiers(join(RACINE, racine))) {
      if (f.includes('brakingPointsService')) continue;
      if (/\bdetectBrakingPoints\s*\(/.test(readFileSync(f, 'utf8'))) {
        out.push(f.replace(RACINE, '').split(/[\\/]/).join('/'));
      }
    }
  }
  return out;
}

describe('la chaîne de freinage est armée', () => {
  it('le service est appelé par du code d’application, pas seulement par son test', () => {
    expect(appelants().length).toBeGreaterThan(0);
  });

  /**
   * LE CŒUR DE LA GARDE. Un appelant unique qui serait un écran redonne au
   * service la fragilité qu'on vient de lui retirer : le jour où l'écran part,
   * la chaîne s'éteint sans que rien ne le dise.
   */
  it('au moins un appelant n’est PAS un écran', () => {
    const horsEcrans = appelants().filter((f) => !f.startsWith('/app/'));
    expect(horsEcrans).not.toEqual([]);
  });

  it('le composant réutilisable existe et monte bien le preset', () => {
    const carte = lire('src', 'features', 'coach', 'CarteSeanceFreinage.tsx');
    expect(carte).toMatch(/detectBrakingPoints\s*\(/);
    expect(carte).toMatch(/<PilotPreset/);
    expect(carte).toMatch(/brakingPoints=\{brakingPoints\}/);
  });

  it('un hôte au moins le monte réellement', () => {
    const monteurs = fichiers(join(RACINE, 'app'))
      .map((f) => readFileSync(f, 'utf8'))
      .filter((src) => /<CarteSeanceFreinage\b/.test(src));
    expect(monteurs.length).toBeGreaterThan(0);
  });

  /**
   * Le seuil physique reste partagé entre le service et le module de
   * télémétrie : deux définitions du « freinage » finiraient par diverger, et
   * c'est le défaut que ce dépôt vient de payer deux fois sur la constance.
   */
  it('le seuil de freinage a une seule définition', () => {
    const service = lire('src', 'services', 'brakingPointsService.ts');
    expect(service).toMatch(/SEUIL_FREINAGE_G/);
    // Le nombre lui-même ne doit apparaître qu'à sa source.
    const enDur = service.match(/-0\.3\b/g) ?? [];
    expect(enDur.length).toBeLessThanOrEqual(1);
  });
});
