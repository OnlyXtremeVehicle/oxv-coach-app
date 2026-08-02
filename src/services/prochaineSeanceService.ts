/**
 * LES INSCRITS DE LA PROCHAINE SÉANCE (jalon 7, phase 6).
 *
 * ---
 *
 * CE QUE L'ÉCRAN « PRÉPARATION » LISAIT
 *
 * Les cinquante premiers comptes de rôle `pilot`, triés par nom, sans aucune
 * jointure sur `registrations` ni sur `sessions`. C'était l'ANNUAIRE, pas une
 * liste d'inscrits — et son état vide annonçait pourtant « Aucun pilote inscrit
 * à la prochaine session », décrivant un filtre qui n'existait pas.
 *
 * Un administrateur qui prépare une journée y voyait donc des gens qui ne
 * viennent pas, et pouvait manquer ceux qui viennent — l'annuaire étant tronqué
 * à cinquante, par ordre alphabétique.
 *
 * ---
 *
 * LA PROCHAINE SÉANCE, PAS « AUJOURD'HUI »
 *
 * `presences.tsx` sert le jour J et lit la journée en cours. Préparation sert
 * AVANT : elle vise la prochaine séance à venir, celle qu'on prépare. Les deux
 * écrans ne regardent donc pas la même chose, et c'est voulu.
 *
 * Une séance ANNULÉE n'est pas la prochaine séance. Une inscription annulée
 * n'est pas un inscrit.
 *
 * ---
 *
 * L'ÉCHEC SE DIT
 *
 * Chaque fonction lève sur erreur de lecture. Rendre une liste vide ferait
 * afficher « personne n'est inscrit » à un administrateur dont le réseau a
 * simplement flanché — la veille d'une journée, c'est la différence entre
 * préparer douze véhicules et n'en préparer aucun.
 */

import { supabase } from '@/lib/supabase';

export interface ProchaineSeance {
  id: string;
  date: string;
  startTime: string | null;
  format: string | null;
  isPrivate: boolean;
  privateClientName: string | null;
}

export interface InscritSeance {
  /** Identifiant de l'INSCRIPTION, pas du pilote. */
  registrationId: string;
  pilotId: string;
  fullName: string;
  email: string;
  kycStatus: string;
  level: string | null;
  /** Statut de l'inscription tel que stocké — jamais réinterprété. */
  status: string | null;
  /** Déjà pointé présent ? Utile pour ne pas préparer deux fois. */
  attended: boolean;
}

/**
 * La prochaine séance à venir, ou `null` s'il n'y en a aucune.
 *
 * `null` est un FAIT ici — aucune journée n'est programmée — et se distingue de
 * l'échec, qui lève.
 */
export async function prochaineSeance(aujourdHuiIso: string): Promise<ProchaineSeance | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, date, start_time, format, is_private, private_client_name, status')
    .gte('date', aujourdHuiIso)
    // Une séance annulée n'est pas la prochaine séance.
    .neq('status', 'cancelled')
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const r = data as Record<string, unknown>;
  return {
    id: String(r.id),
    date: typeof r.date === 'string' ? r.date : '',
    startTime: typeof r.start_time === 'string' ? r.start_time : null,
    format: typeof r.format === 'string' ? r.format : null,
    isPrivate: r.is_private === true,
    privateClientName: typeof r.private_client_name === 'string' ? r.private_client_name : null,
  };
}

/**
 * Les inscrits d'une séance, avec ce qu'il faut pour la préparer.
 *
 * Deux requêtes plutôt qu'une jointure PostgREST : la relation
 * `registrations → users` n'a pas de clé étrangère nommée exploitable ici, et
 * `attendanceService` a déjà retenu ce découpage pour la même raison. Deux
 * lectures qui disent la vérité valent mieux qu'une jointure qui échoue en
 * silence.
 */
export async function inscritsDeLaSeance(sessionId: string): Promise<InscritSeance[]> {
  const { data: inscriptions, error } = await supabase
    .from('registrations')
    .select('id, user_id, status, attended_at')
    .eq('session_id', sessionId)
    // Une inscription annulée n'est pas un inscrit.
    .is('cancelled_at', null);

  if (error) throw new Error(error.message);
  if (!Array.isArray(inscriptions) || inscriptions.length === 0) return [];

  const lignes = inscriptions as Record<string, unknown>[];
  const pilotIds = [
    ...new Set(lignes.map((l) => l.user_id).filter((v): v is string => typeof v === 'string')),
  ];
  if (pilotIds.length === 0) return [];

  const { data: pilotes, error: erreurPilotes } = await supabase
    .from('users')
    .select('id, first_name, last_name, email, kyc_status, pilot_level')
    .in('id', pilotIds);

  if (erreurPilotes) throw new Error(erreurPilotes.message);

  const parId = new Map<string, Record<string, unknown>>();
  for (const p of (pilotes ?? []) as Record<string, unknown>[]) {
    if (typeof p.id === 'string') parId.set(p.id, p);
  }

  return lignes
    .map((l): InscritSeance | null => {
      const pilotId = l.user_id;
      if (typeof pilotId !== 'string') return null;
      const p = parId.get(pilotId);
      const nom = [p?.first_name, p?.last_name]
        .filter((x): x is string => typeof x === 'string' && x.length > 0)
        .join(' ');
      return {
        registrationId: String(l.id),
        pilotId,
        // Un compte sans nom renseigné n'est pas une anomalie : on ne fabrique
        // pas un libellé, on dit que le nom manque.
        fullName: nom.length > 0 ? nom : 'Nom non renseigné',
        email: typeof p?.email === 'string' ? p.email : '',
        kycStatus: typeof p?.kyc_status === 'string' ? p.kyc_status : 'unknown',
        level: typeof p?.pilot_level === 'string' ? p.pilot_level : null,
        status: typeof l.status === 'string' ? l.status : null,
        attended: l.attended_at !== null && l.attended_at !== undefined,
      };
    })
    .filter((x): x is InscritSeance => x !== null)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}
