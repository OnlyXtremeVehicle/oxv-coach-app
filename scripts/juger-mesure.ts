/**
 * Juge des traces de temps d'image — lot T3.
 *
 * Usage :
 *   npx tsx scripts/juger-mesure.ts perf/resultats/*.json
 *
 * Lit des traces produites par Flashlight, applique `judgeBudget`, et sort en
 * erreur si un écran ne tient pas.
 *
 * ---
 *
 * CE SCRIPT NE MESURE RIEN, ET C'EST VOULU
 *
 * La mesure demande un appareil réel — voir `.github/workflows/mesure.yml`. Le
 * JUGEMENT, lui, n'a besoin que des nombres : il est donc écrit, testé, et
 * utilisable dès qu'une trace existe, y compris relevée à la main.
 *
 * Séparer les deux évite le piège habituel : un harnais de mesure qui ne tourne
 * pas emporterait avec lui la règle de lecture, et celle-ci est la partie qui
 * compte.
 */

import * as fs from 'fs';
import * as path from 'path';

import { judgeBudget } from '../src/perf/frameTimes';

/**
 * Extrait les temps d'image d'une trace.
 *
 * Deux formes acceptées : un tableau de nombres, ou l'objet Flashlight qui porte
 * ses mesures sous `iterations[].measures[].fps` — auquel cas on convertit.
 *
 * Rend `null` sur une forme inconnue plutôt que de deviner : une trace mal lue
 * donnerait un verdict sur des nombres qui ne sont pas des temps d'image.
 */
function extraireTemps(brut: unknown): number[] | null {
  if (Array.isArray(brut) && brut.every((x) => typeof x === 'number')) {
    return brut as number[];
  }
  const o = brut as { iterations?: { measures?: { fps?: number }[] }[] };
  const mesures = o?.iterations?.flatMap((it) => it.measures ?? []) ?? [];
  if (mesures.length === 0) return null;

  const temps: number[] = [];
  for (const m of mesures) {
    // Un fps nul ou absent ne se convertit pas : il signale une image perdue,
    // pas une image infiniment lente. On l'écarte plutôt que d'inventer.
    if (typeof m.fps !== 'number' || m.fps <= 0) continue;
    temps.push(1000 / m.fps);
  }
  return temps.length > 0 ? temps : null;
}

function main(): void {
  const fichiers = process.argv.slice(2).filter((a) => a.endsWith('.json'));

  if (fichiers.length === 0) {
    console.error('Aucune trace fournie.');
    console.error('Usage : npx tsx scripts/juger-mesure.ts perf/resultats/*.json');
    process.exit(2);
  }

  let echecs = 0;

  for (const f of fichiers) {
    const nom = path.basename(f, '.json');

    if (!fs.existsSync(f)) {
      console.error(`  ${nom} — fichier introuvable`);
      echecs++;
      continue;
    }

    let brut: unknown;
    try {
      brut = JSON.parse(fs.readFileSync(f, 'utf-8'));
    } catch {
      console.error(`  ${nom} — JSON illisible`);
      echecs++;
      continue;
    }

    const temps = extraireTemps(brut);
    if (!temps) {
      // Une trace vide n'est PAS un succès. Sans cette branche, un relevé raté
      // passerait pour un écran parfait.
      console.error(`  ${nom} — aucune mesure exploitable dans la trace`);
      echecs++;
      continue;
    }

    const verdict = judgeBudget(temps);
    if (!verdict) {
      console.error(`  ${nom} — aucune image retenue`);
      echecs++;
      continue;
    }

    const s = verdict.stats;
    const resume =
      `${s.count} images · p50 ${s.p50.toFixed(1)} ms · p95 ${s.p95.toFixed(1)} ms · ` +
      `p99 ${s.p99.toFixed(1)} ms · ${(s.withinBudget * 100).toFixed(1)} % dans le budget`;

    if (verdict.passed) {
      console.log(`  OK  ${nom} — ${resume}`);
    } else {
      console.error(`  KO  ${nom} — ${resume}`);
      for (const r of verdict.reasons) console.error(`        ${r}`);
      echecs++;
    }
  }

  console.log('');
  if (echecs === 0) {
    console.log(`${fichiers.length} trace(s) jugée(s) — toutes tiennent leur budget.`);
    process.exit(0);
  }
  console.error(`${echecs} trace(s) hors budget sur ${fichiers.length}.`);
  console.error('La moyenne n’est pas un critère : voir src/perf/frameTimes.ts.');
  process.exit(1);
}

main();
