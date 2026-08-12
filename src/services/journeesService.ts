/**
 * Les journées de circuit du pilote — lecture de `registrations` + `sessions`.
 *
 * ===========================================================================
 * POURQUOI CE SERVICE REMPLACE `eventsService.listMyRegistrations`
 * ===========================================================================
 *
 * *« Un pass de journée de circuit doit lire `registrations` et `sessions`. »*
 *
 * Vérifié en production le 12/08/2026 : **`event_registrations` contient zéro
 * ligne** et n'a jamais été écrite. `registrations` porte les inscriptions
 * réelles, celles que le site oxvehicle.fr crée quand un pilote réserve. Le
 * Pass lisait donc une table vide, et affichait « aucune inscription » à tout
 * le monde — un écran qui fonctionnait sans pouvoir rien montrer.
 *
 * Le site et l'application partagent UN SEUL projet Supabase : ces tables sont
 * les mêmes des deux côtés.
 *
 * ===========================================================================
 * CE QUE LA RLS OUVRE, ET CE QU'ELLE N'OUVRE PAS
 * ===========================================================================
 *
 * Vérifié en base, pas supposé :
 *
 *   `registrations_select_own_or_admin` → `user_id = auth.uid() OR is_admin()`.
 *   Le filtre par pilote est donc porté par la RLS. On le REPOSE quand même
 *   dans la requête : une policy qui changerait ne doit pas transformer ce
 *   service en fuite de données.
 *
 *   `sessions_select_authenticated` → `is_admin() OR is_private IS NOT TRUE`.
 *   **Une journée privée n'est pas lisible par le pilote qui y est inscrit.**
 *   La jointure rend alors `null`, et ce n'est pas une erreur : c'est un cas
 *   normal que la logique pure traite (`partagerJournees` → `illisibles`).
 *
 * SELECT est accordé sur toutes les colonnes de `registrations` — le REVOKE du
 * site du 04/08 portait sur l'UPDATE (treize colonnes, dont les cinq de prix et
 * `user_id`). On ne lit ici que ce que le Pass affiche.
 *
 * ===========================================================================
 * CE QUE CE SERVICE N'ÉCRIT PAS
 * ===========================================================================
 *
 * Rien. Il lit. Les inscriptions se créent sur le site, l'annulation passe par
 * la RPC `cancel_registration`, et le pointage appartient à la régie.
 */

import { supabase } from '@/lib/supabase';

import type { InscriptionLike, JourneeLike } from '@/features/club/passJourneeLogic';

/** Une inscription du pilote, telle que le Pass l'affiche. */
export interface MaJournee extends InscriptionLike {
  /** Créneau brut, conservé pour le libellé (`slot_choice`). */
  slot: string | null;
  /** Instant de création de l'inscription, ISO. */
  createdAt: string | null;
}

/**
 * Colonnes lues.
 *
 * `price_total`, `price_deposit` et les dates de règlement NE SONT PAS lues :
 * le Pass n'affiche pas de montant. Le statut `pending_payment` suffit à dire
 * qu'un règlement manque, sans étaler une somme sur un écran qu'on sort au
 * portail devant d'autres pilotes.
 */
/*
 * UNE SEULE CHAÎNE LITTÉRALE, ET C'EST STRUCTUREL.
 *
 * Écrite en concaténation sur deux lignes, TypeScript élargit la constante en
 * `string` : supabase-js ne peut plus analyser le plongement et rend
 * `GenericStringError`. On perd alors TOUT le typage de la jointure, et on le
 * remplace par des `as` — c'est-à-dire par des affirmations non vérifiées, sur
 * une requête dont la forme est précisément ce qu'on veut voir contrôlé.
 *
 * L'indice de clé étrangère est absent volontairement :
 * `sessions!registrations_session_id_fkey` est AMBIGU — ce nom de contrainte
 * est associé à la table `sessions` ET à deux vues qui la reprennent. Le nom de
 * relation seul désigne la table sans équivoque.
 */
const COLS =
  'id, status, offer_type, slot_choice, created_at, sessions(date, start_time, end_time, format, circuits(name))' as const;

/** Une ligne jointe, telle que supabase-js la type. */
type LigneJointe = {
  sessions: {
    date: string;
    start_time: string | null;
    end_time: string | null;
    format: string | null;
    circuits: { name: string } | { name: string }[] | null;
  } | null;
};

function mapJournee(s: LigneJointe['sessions']): JourneeLike | null {
  // `null` = journée privée, que `sessions_select_authenticated` n'ouvre pas
  // au pilote inscrit. Cas NORMAL, traité par `partagerJournees`.
  if (s === null) return null;

  const joint = s.circuits;
  const circuit = Array.isArray(joint) ? joint[0] : joint;
  const nom = circuit?.name?.trim();

  return {
    date: s.date,
    startTime: s.start_time,
    endTime: s.end_time,
    format: s.format,
    circuitName: nom !== undefined && nom !== '' ? nom : null,
  };
}

/**
 * Les journées du pilote connecté.
 *
 * STRICT PAR DÉFAUT : une panne de base REMONTE plutôt que de rendre `[]`.
 * Un tableau vide se lit « vous n'avez aucune journée », ce qui est une
 * affirmation — et c'est exactement celle que l'ancien Pass faisait à tort.
 */
export async function listMesJournees(): Promise<MaJournee[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error('SESSION_EXPIREE');

  const { data, error } = await supabase
    .from('registrations')
    .select(COLS)
    // Redondant avec la RLS, et volontairement : une policy qui changerait ne
    // doit pas transformer cette lecture en fuite.
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    registrationId: row.id,
    status: row.status ?? 'pending',
    offerType: row.offer_type,
    slot: row.slot_choice,
    createdAt: row.created_at,
    journee: mapJournee(row.sessions),
  }));
}
