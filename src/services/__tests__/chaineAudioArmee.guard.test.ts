/**
 * GARDE — la voix du coach s'enregistre ET s'écoute.
 *
 * ===========================================================================
 * CE QUE LA MESURE A TROUVÉ LE 14/08/2026
 * ===========================================================================
 *
 * `coachAudioService` porte deux moitiés :
 *
 *   • `attachAudioToAnnotation` — envoyer le fichier. Un appelant : `annoter` ;
 *   • `getAnnotationAudioUrl`   — obtenir l'URL signée pour le jouer.
 *     **ZÉRO appelant.** Pas un écran, pas un service, pas un composant.
 *
 * La fonction était écrite, correcte, commentée (« RLS : coach propriétaire ou
 * pilote en partage »), et personne ne l'appelait. Le bucket privé existait
 * depuis le 18/06 avec ses quatre policies, dont une écrite exprès pour laisser
 * le pilote lire. Le coach pouvait parler ; personne ne pouvait l'entendre.
 *
 * C'est la forme la plus pure du motif de ce dépôt : la garde posée, non armée.
 *
 * ===========================================================================
 * CE QUE CETTE GARDE EXIGE
 * ===========================================================================
 *
 * Que les DEUX moitiés aient un appelant de production. Une chaîne audio qui
 * n'écrit pas est inutile ; une chaîne qui écrit sans qu'on puisse lire est
 * pire — elle donne au coach le sentiment d'avoir transmis quelque chose.
 */

import { readFileSync, readdirSync } from 'fs';

import { codeSansCommentaires } from '@/test-utils/codeSeul';
import { join } from 'path';

const RACINE = process.cwd();

function lire(...morceaux: string[]): string {
  return readFileSync(join(RACINE, ...morceaux), 'utf8');
}

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

/** Qui appelle vraiment `nom(` — hors la définition du service lui-même. */
function appelants(nom: string): string[] {
  const motif = new RegExp(`\\b${nom}\\s*\\(`);
  const out: string[] = [];
  for (const racine of ['app', 'src']) {
    for (const f of fichiers(join(RACINE, racine))) {
      if (f.includes('coachAudioService')) continue;
      // Le fichier privé de ses commentaires : un service NOMMÉ dans une
      // explication n'est pas un appelant. C'est le motif qui a rendu quatre
      // verdicts faux le 14/08.
      if (motif.test(codeSansCommentaires(readFileSync(f, 'utf8')))) {
        out.push(f.replace(RACINE, '').split(/[\\/]/).join('/'));
      }
    }
  }
  return out;
}

describe('la chaîne audio du coach est armée des deux côtés', () => {
  it('l’envoi a un appelant de production', () => {
    expect(appelants('attachAudioToAnnotation')).not.toEqual([]);
  });

  /**
   * LE CŒUR. C'est cette assertion qui aurait échoué du 18/06 au 14/08.
   */
  it('la LECTURE a un appelant de production — elle n’en avait aucun', () => {
    expect(appelants('getAnnotationAudioUrl')).not.toEqual([]);
  });

  /**
   * Et le bout de la chaîne : un écran pilote doit monter le lecteur. Le
   * service peut être appelé par un composant que plus personne ne rend — c'est
   * précisément ce qui est arrivé à `ramp.ts` pendant des mois.
   */
  it('le bilan du pilote monte réellement le lecteur', () => {
    const bilan = lire('app', '(app2)', 'bilan', '[sessionId].tsx');
    expect(bilan).toMatch(/<EcouteNoteCoach\b/);
    expect(bilan).toMatch(/audioPath=\{data\.coachSessionNote\.audioUrl\}/);
  });

  /**
   * L'ORDRE DES DEUX ÉCRITURES, qui n'est pas un détail de confort.
   *
   * `coach_audio_insert` autorise l'objet si son NOM est l'uuid d'une annotation
   * du coach. Envoyer l'audio avant d'avoir la note, c'est un refus du stockage.
   * On vérifie donc que le rapport tient bien cet ordre.
   */
  it('le rapport crée la note AVANT d’envoyer l’audio', () => {
    const src = lire('app', '(coach)', 'rapport.tsx');
    const iNote = src.indexOf('await upsertSessionNote(');
    const iAudio = src.indexOf('await attachAudioToAnnotation(');
    expect(iNote).toBeGreaterThan(-1);
    expect(iAudio).toBeGreaterThan(-1);
    expect(iNote).toBeLessThan(iAudio);
  });

  /**
   * L'audio ne peut être attaché qu'à une note EXISTANTE. Si `upsertSessionNote`
   * a échoué, `note` est nul — l'envoi doit être sauté, pas tenté sur `undefined`.
   */
  it('l’envoi est conditionné à l’existence de la note', () => {
    expect(lire('app', '(coach)', 'rapport.tsx')).toMatch(/if \(note && recordedUri\)/);
  });
});
