/**
 * GARDE — un effet ne doit pas s'annuler lui-même.
 *
 * ===========================================================================
 * LE DÉFAUT QU'ELLE FERME, ET IL A ARRÊTÉ LE FLUX DU JOUR J
 * ===========================================================================
 *
 * Relevé le 04/08/2026, depuis l'appareil : « le flux s'arrête à l'appairage,
 * une fois connecté pas de passage à la prochaine étape. »
 *
 * `app/(app2)/rec/equipement.tsx` portait ceci :
 *
 *     const [consentDemande, setConsentDemande] = useState(false);
 *     useEffect(() => {
 *       if (consentDemande) return;
 *       let annule = false;
 *       setConsentDemande(true);          // ← relance l'effet
 *       void (async () => {
 *         const r = await lire();
 *         if (annule) return;             // ← toujours vrai
 *         setPorte('fermee');             // ← jamais atteint
 *       })();
 *       return () => { annule = true; };  // ← posé par la relance
 *     }, [consentDemande, ...]);
 *
 * L'enchaînement est DÉTERMINISTE, ce n'était pas un aléa réseau :
 *
 *   1. l'effet part et appelle `setConsentDemande(true)` ;
 *   2. la valeur figurant dans ses dépendances, l'effet est relancé ;
 *   3. React exécute d'abord le NETTOYAGE du passage précédent — `annule = true` ;
 *   4. or c'est ce passage-là qui porte la fonction asynchrone en vol.
 *
 * Au retour des lectures, tous les `if (annule) return` se déclenchaient. Le
 * travail utile n'était jamais fait. Aucune erreur, aucun journal : l'écran
 * restait simplement là.
 *
 * ===========================================================================
 * LA COMBINAISON EXACTE QUI TUE
 * ===========================================================================
 *
 * Trois ingrédients, et il en faut TROIS :
 *
 *   — une valeur d'état écrite DANS l'effet,
 *   — cette même valeur en DÉPENDANCE de l'effet,
 *   — un drapeau d'annulation posé par le NETTOYAGE.
 *
 * Sans le troisième, la relance est bénigne : le travail se refait. Avec lui,
 * le travail est annulé avant d'aboutir, une seule fois, pour toujours.
 *
 * Le remède est le même partout : une référence, qui ne provoque pas de rendu.
 *
 * ===========================================================================
 * CE QUE CETTE GARDE NE PROUVE PAS
 * ===========================================================================
 *
 * Elle est LEXICALE. Elle ne monte aucun composant, ne suit aucun rendu, et ne
 * comprend pas le contrôle de flux. Elle reconnaît une FORME. Un effet écrit
 * autrement — l'écriture d'état dans une fonction appelée, par exemple —
 * passera sans être vu.
 *
 * Elle sert à ne pas réécrire CE piège-là, pas à prouver que les effets sont
 * corrects.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RACINE = join(__dirname, '..', '..');

/** Découpe grossière d'un fichier en blocs `useEffect(… , [deps]);`. */
function effets(source: string): { corps: string; deps: string }[] {
  const out: { corps: string; deps: string }[] = [];
  const re = /useEffect\(\s*\(\s*\)\s*=>\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    // Équilibrage des accolades depuis l'ouverture du corps.
    let i = m.index + m[0].length;
    let profondeur = 1;
    while (i < source.length && profondeur > 0) {
      const c = source[i];
      if (c === '{') profondeur++;
      else if (c === '}') profondeur--;
      i++;
    }
    const corps = source.slice(m.index + m[0].length, i - 1);
    // Le tableau de dépendances suit la fermeture du corps.
    const apres = source.slice(i, i + 400);
    const dep = /^\s*,\s*\[([^\]]*)\]/.exec(apres);
    out.push({ corps, deps: dep ? dep[1] : '' });
  }
  return out;
}

/**
 * Les noms d'état écrits SYNCHRONEMENT dans ce corps : `setX(` → `x`.
 *
 * LE MOT « SYNCHRONEMENT » EST TOUT LE DISCRIMINANT, et il a été appris en se
 * trompant. La première version de cette garde comptait toutes les écritures,
 * et accusait deux effets sains :
 *
 *   - `data/comparer.tsx` écrit `lapsBySession` DANS un `.then` : la relance
 *     n'a lieu qu'une fois l'écriture faite, donc rien n'est annulé avant
 *     d'aboutir. Au pire une requête est refaite ;
 *   - `(coach)/assistant.tsx` fait de même avec `aiConsent`.
 *
 * Le piège n'existe que si l'écriture PRÉCÈDE l'attente : c'est elle qui
 * provoque la relance pendant que le travail est en vol. On ignore donc tout ce
 * qui suit le premier passage en asynchrone.
 */
function etatsEcrits(corps: string): string[] {
  const bascule = corps.search(/\.then\s*\(|\.catch\s*\(|async\s*\(|await\s/);
  const avant = bascule >= 0 ? corps.slice(0, bascule) : corps;
  const noms = new Set<string>();
  const re = /\bset([A-Z][A-Za-z0-9_]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(avant)) !== null) {
    noms.add(m[1][0].toLowerCase() + m[1].slice(1));
  }
  return [...noms];
}

/** L'effet pose-t-il un drapeau d'annulation dans son nettoyage ? */
function aUnDrapeauDAnnulation(corps: string): boolean {
  const declare = /\blet\s+(annule|cancelled|cancel|aborted|obsolete)\b/.test(corps);
  const pose =
    /return\s*\(\s*\)\s*=>\s*\{[^}]*\b(annule|cancelled|cancel|aborted|obsolete)\s*=\s*true/.test(
      corps
    );
  return declare && pose;
}

function fichiers(dossier: string): string[] {
  const out: string[] = [];
  const parcourir = (d: string): void => {
    for (const e of readdirSync(d)) {
      if (e === 'node_modules' || e === '__tests__' || e === 'archive') continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) parcourir(p);
      else if (e.endsWith('.tsx')) out.push(p);
    }
  };
  parcourir(dossier);
  return out;
}

function fautifs(): string[] {
  const out: string[] = [];
  for (const f of [...fichiers(join(RACINE, 'src')), ...fichiers(join(RACINE, 'app'))]) {
    const source = readFileSync(f, 'utf8');
    if (!source.includes('useEffect')) continue;
    for (const e of effets(source)) {
      if (!aUnDrapeauDAnnulation(e.corps)) continue;
      const deps = e.deps.split(',').map((d) => d.trim());
      for (const nom of etatsEcrits(e.corps)) {
        if (deps.includes(nom)) {
          out.push(`${f.replace(RACINE, '').replace(/\\/g, '/')} → « ${nom} »`);
        }
      }
    }
  }
  return out;
}

describe('un effet ne s’annule pas lui-même', () => {
  it('aucun effet n’écrit un état qui figure dans ses propres dépendances, ET n’annule au nettoyage', () => {
    expect(fautifs()).toEqual([]);
  });

  it('la garde reconnaît la forme qu’elle prétend reconnaître', () => {
    // Sans ce contrôle, un changement de motif ferait passer le test au vert en
    // ne trouvant plus rien à examiner — l'échec silencieux qu'on veut éviter.
    const piege = `
      useEffect(() => {
        if (demande) return;
        let annule = false;
        setDemande(true);
        void (async () => { await lire(); if (annule) return; })();
        return () => { annule = true; };
      }, [status, demande]);
    `;
    const e = effets(piege)[0];
    expect(e).toBeDefined();
    expect(aUnDrapeauDAnnulation(e.corps)).toBe(true);
    expect(etatsEcrits(e.corps)).toContain('demande');
    expect(e.deps.split(',').map((d) => d.trim())).toContain('demande');
  });

  it('elle ne se déclenche PAS quand l’écriture SUIT l’attente', () => {
    // Le cas de `data/comparer.tsx` : la relance survient APRÈS l'écriture,
    // donc rien n'est annulé avant d'aboutir. L'accuser ferait du bruit, et le
    // bruit finit toujours par se contourner.
    const sain = `
      useEffect(() => {
        let cancelled = false;
        lire().then((r) => { if (cancelled) return; setDonnees(r); });
        return () => { cancelled = true; };
      }, [idA, donnees]);
    `;
    expect(etatsEcrits(effets(sain)[0].corps)).not.toContain('donnees');
  });

  it('elle ne se déclenche PAS sans drapeau d’annulation', () => {
    // Même forme, sans nettoyage annulant : la relance est bénigne, le travail
    // se refait. Accuser ici ferait du bruit, et le bruit se contourne.
    const benin = `
      useEffect(() => {
        if (pret) return;
        setPret(true);
      }, [pret]);
    `;
    expect(aUnDrapeauDAnnulation(effets(benin)[0].corps)).toBe(false);
  });
});
