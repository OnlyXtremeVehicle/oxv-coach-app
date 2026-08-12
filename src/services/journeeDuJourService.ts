/**
 * Le circuit de la journée réservée du pilote — lecture Supabase.
 *
 * Pendant réseau de `features/rec/journeeDuJourLogic`, qui porte tout le
 * discernement. Ici on ne fait que lire, et rendre `null` sur le moindre doute.
 *
 * ===========================================================================
 * POURQUOI CE SERVICE EXISTE, ET PAS `listMesJournees`
 * ===========================================================================
 *
 * `journeesService.listMesJournees` alimente le Pass. Il lit le NOM du circuit
 * (`circuits(name)`) et pas son identifiant — le Pass affiche, il n'arme rien.
 *
 * L'écran d'armement a besoin de l'IDENTIFIANT : rapprocher deux circuits par
 * leur nom, c'est faire dépendre le choix de la ligne d'arrivée d'une chaîne de
 * caractères qu'un administrateur peut renommer. On lit donc `circuit_id`.
 *
 * L'autre service reste STRICT (il lève) parce que le Pass doit distinguer
 * « aucune journée » de « je n'ai pas pu lire ». Celui-ci est l'inverse, et
 * délibérément : **il ne doit jamais empêcher d'armer.** Une panne de réseau au
 * paddock rend `null`, et l'écran retombe sur son comportement d'avant.
 */

import { supabase } from '@/lib/supabase';

import {
  circuitDeLaJournee,
  type InscriptionJournee,
  type JourneeRetenue,
} from '@/features/rec/journeeDuJourLogic';

/**
 * UNE SEULE CHAÎNE LITTÉRALE — même contrainte que `journeesService` : écrite
 * en concaténation, TypeScript élargit la constante en `string`, supabase-js
 * ne peut plus analyser le plongement et rend `GenericStringError`. Le typage
 * de la jointure est alors perdu, et remplacé par des affirmations non
 * vérifiées sur la requête dont la forme est justement ce qu'on veut contrôlé.
 */
const COLS = 'status, sessions(date, start_time, end_time, circuit_id, circuits(name))' as const;

type Jointe = {
  status: string | null;
  sessions: {
    date: string | null;
    start_time: string | null;
    end_time: string | null;
    circuit_id: string | null;
    circuits: { name: string } | { name: string }[] | null;
  } | null;
};

function aplatir(row: Jointe): InscriptionJournee {
  const s = row.sessions;
  const joint = s?.circuits ?? null;
  const circuit = Array.isArray(joint) ? (joint[0] ?? null) : joint;
  return {
    status: row.status,
    date: s?.date ?? null,
    startTime: s?.start_time ?? null,
    endTime: s?.end_time ?? null,
    circuitId: s?.circuit_id ?? null,
    circuitName: circuit?.name ?? null,
  };
}

/**
 * Le circuit de la journée à rouler maintenant, ou `null`.
 *
 * `null` couvre tous les cas où l'on ne sait pas, et l'appelant n'a pas à les
 * distinguer : pas de session, pas d'inscription, journée privée que la RLS
 * n'ouvre pas, séance sans circuit rattaché, panne réseau. Dans chacun, la
 * conduite est la même — laisser l'écran choisir comme avant.
 *
 * @param maintenantMs instant courant (injectable pour les tests)
 */
export async function circuitDeMaJournee(
  maintenantMs: number = Date.now()
): Promise<JourneeRetenue | null> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return null;

    const { data, error } = await supabase
      .from('registrations')
      .select(COLS)
      // Redondant avec `registrations_select_own_or_admin`, et volontairement :
      // un compte ADMIN voit toutes les inscriptions sous cette policy, et sans
      // ce filtre il armerait sur la journée d'un autre pilote.
      .eq('user_id', uid);

    if (error || !data) return null;
    return circuitDeLaJournee((data as Jointe[]).map(aplatir), maintenantMs);
  } catch {
    // Aucune remontée : ce service ne doit jamais retarder ni bloquer un
    // armement. Le pilote est au paddock, pas devant un journal d'erreurs.
    return null;
  }
}
