/**
 * LE RATTRAPAGE DES SÉANCES SANS SEGMENTS — 01/09/2026.
 *
 * ===========================================================================
 * LE TROU, ET POURQUOI IL NE SE FERME PAS PAR UN CRON
 * ===========================================================================
 *
 * `app_segment_analyses` nourrit tout : l'anatomie de virage, donc les lectures
 * approfondies, donc le ruban, donc le passage le plus engagé. Elle est écrite
 * par `analyzeAndPersistSession`, qui ne tourne qu'à la fin d'un run.
 *
 * Toute séance antérieure au 01/09 n'a donc AUCUN segment : jusqu'à ce jour, la
 * garde du 30/08 refusait de segmenter hors de Haute Saintonge, et le découpage
 * était écrit en dur. Elles ne se corrigeraient qu'en étant roulées à nouveau.
 *
 * Le cron nocturne ne peut pas les reprendre, et ce n'est pas un oubli : le
 * recalage sur le tracé, le découpage par virage et les marges par segment sont
 * du TypeScript. Une fonction SQL ne les appelle pas.
 *
 * ===========================================================================
 * CE QU'ON A ÉCARTÉ, ET POURQUOI
 * ===========================================================================
 *
 * Porter le calcul en Deno pour que le cron le fasse a été envisagé, et
 * écarté au profit de ceci — après que le fondateur ait demandé l'inverse, et
 * en le disant. Deux raisons, dont une décisive :
 *
 *   • `rec/fin` calcule aujourd'hui EN LOCAL et fonctionne sans réseau. Au bord
 *     d'une piste, c'est le cas normal, pas l'exception. Un calcul serveur
 *     rendrait la fin de run dépendante de la couverture.
 *
 *   • Le calcul existerait à deux endroits, ou devrait migrer en entier —
 *     six cents lignes d'analyse, avec le risque de divergence numérique que
 *     tout portage porte.
 *
 * Le rattrapage à l'ouverture obtient le même résultat : toute séance finit par
 * avoir ses segments. Il a même une vertu que le cron n'a pas — le travail se
 * fait là où il sert, sur les séances qu'on ouvre, et jamais sur celles que
 * personne ne lit.
 *
 * ===========================================================================
 * CE QU'IL NE COUVRE PAS, ET QU'IL FAUT SAVOIR
 * ===========================================================================
 *
 * Une séance qu'un COACH ouvre en premier ne se rattrape pas : la politique
 * `app_segment_analyses_insert_own` lui interdit d'écrire les segments d'un
 * pilote, et c'est juste — il n'est pas l'auteur de cette mesure. Le pilote
 * doit l'avoir ouverte une fois.
 *
 * C'est écrit ici plutôt que découvert plus tard devant une séance qui reste
 * vide sans raison apparente.
 */

import { analyzeAndPersistSession, isAnalyzableSession } from '@/services/analyzeSessionService';

/**
 * Les séances déjà tentées PENDANT CETTE EXÉCUTION de l'application.
 *
 * Sans elle, un écran qui se remonte relancerait l'analyse à chaque fois : un
 * calcul de plusieurs milliers de trames, en boucle, sur le fil d'un pilote qui
 * fait défiler. Le jeu se vide au redémarrage, et c'est voulu — une tentative
 * qui a échoué mérite d'être reprise au lancement suivant.
 */
const tentees = new Set<string>();

/** Remise à zéro — pour les tests, et pour eux seuls. */
export function oublierTentatives(): void {
  tentees.clear();
}

export interface EntreeRattrapage {
  sessionId: string;
  /** Le PROPRIÉTAIRE de la séance, pas le lecteur. */
  pilotId: string;
  /** Le lecteur est-il quelqu'un d'autre que le pilote ? */
  lectureDAutrui: boolean;
  /** `telemetry_sessions.status`. */
  statut: string | null;
  /** Combien de segments la séance porte DÉJÀ. */
  segmentsExistants: number;
}

/**
 * Pourquoi le rattrapage n'a pas eu lieu, ou `null` s'il a été lancé.
 *
 * Rendu plutôt que journalisé : l'appelant peut le montrer en développement, et
 * un motif nommé vaut mieux qu'un silence quand on se demande pourquoi une
 * séance reste vide.
 */
export type MotifSansRattrapage =
  | 'segments-presents'
  | 'lecture-d-autrui'
  | 'seance-non-close'
  | 'deja-tente';

/**
 * Le rattrapage doit-il partir ? Logique PURE.
 *
 * Quatre refus, dans l'ordre du moins cher au plus cher à établir. Aucun n'est
 * une panne : ce sont les conditions normales de ne rien faire.
 */
export function motifSansRattrapage(e: EntreeRattrapage): MotifSansRattrapage | null {
  if (e.segmentsExistants > 0) return 'segments-presents';
  if (e.lectureDAutrui) return 'lecture-d-autrui';
  if (!isAnalyzableSession({ status: e.statut as never })) return 'seance-non-close';
  if (tentees.has(e.sessionId)) return 'deja-tente';
  return null;
}

/**
 * Rattrape une séance sans segments, EN ARRIÈRE-PLAN.
 *
 * Ne rejette jamais et ne rend rien d'utile à attendre : l'écran s'affiche avec
 * ce qu'il a, et les segments arriveront au prochain chargement. Bloquer le
 * rendu sur un calcul de plusieurs milliers de trames serait une régression
 * visible pour un gain invisible.
 *
 * Le marquage se fait AVANT le calcul, pas après : deux montages simultanés du
 * même écran — ce qui arrive — ne doivent pas lancer deux analyses.
 */
export async function rattraperSegments(e: EntreeRattrapage): Promise<MotifSansRattrapage | null> {
  const motif = motifSansRattrapage(e);
  if (motif !== null) return motif;

  tentees.add(e.sessionId);
  try {
    const r = await analyzeAndPersistSession({
      telemetrySessionId: e.sessionId,
      userId: e.pilotId,
    });
    if (r.segmentsPersisted > 0) {
      console.warn(
        `[OXV][rattrapage] ${e.sessionId} : ${r.segmentsPersisted} segment(s) écrit(s).`
      );
    }
  } catch (err) {
    console.warn('[OXV][rattrapage] échec :', err instanceof Error ? err.message : String(err));
  }
  return null;
}
