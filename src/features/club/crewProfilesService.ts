/**
 * Résoudre l'identité des membres d'une écurie — une seule fois, pour tous.
 *
 * ===========================================================================
 * POURQUOI CE MODULE EXISTE
 * ===========================================================================
 *
 * `getMyCrew()` rend des `userId` et des rôles, rien d'autre : la RLS de
 * `crews_members` ne porte pas les prénoms. Deux écrans ont besoin de la même
 * résolution — le hub du Club (carte « votre appartenance ») et l'écran
 * d'écurie. Écrire la lecture deux fois, c'est se donner deux règles de
 * confidentialité qui divergeront : ce dépôt a déjà payé une formule de
 * constance vivant en deux versions, chacune persuadée d'être la bonne.
 *
 * ===========================================================================
 * CE QUE LA RLS PERMET, ET CE QU'ELLE REFUSE
 * ===========================================================================
 *
 * La lecture de `users` est **best-effort** : la policy est « own-or-admin »,
 * donc un membre ordinaire peut n'obtenir que sa propre ligne. Un refus n'est
 * pas une panne — c'est le comportement attendu, et le repli est le handle
 * public, puis « Un pilote ».
 *
 * Aucun nom de famille ne traverse, jamais : `memberDisplayName` s'arrête au
 * prénom, aligné sur ce que `session_attendance_public` accepte de rendre.
 */

import { supabase } from '@/lib/supabase';

import type { CrewMemberProfile } from './clubHubLogic';

export interface MembreBrut {
  userId: string;
  role: string;
}

/** Identités déjà connues par un autre canal (présence opt-in), s'il y en a. */
export interface IdentitesConnues {
  handleById?: ReadonlyMap<string, string | null>;
  avatarById?: ReadonlyMap<string, string | null>;
}

/**
 * Complète des membres bruts en profils affichables.
 *
 * Les identités déjà connues PRIMENT : elles viennent du canal opt-in
 * `session_attendance_public`, que le pilote a explicitement ouvert. La lecture
 * de `users` ne fait que combler les trous.
 */
export async function resolveCrewProfiles(
  membres: readonly MembreBrut[],
  connues: IdentitesConnues = {}
): Promise<CrewMemberProfile[]> {
  const handleById = new Map<string, string | null>(connues.handleById ?? []);
  const avatarById = new Map<string, string | null>(connues.avatarById ?? []);
  const firstNameById = new Map<string, string | null>();

  const ids = membres.map((m) => m.userId);
  if (ids.length > 0) {
    // Best-effort assumé : un refus RLS laisse les prénoms vides, et l'écran
    // affiche des handles. Le `catch` ne masque donc pas une panne — il tient
    // le cas nominal d'un membre qui ne peut pas lire ses coéquipiers.
    const { data, error } = await supabase
      .from('users')
      .select('id, first_name, public_handle, avatar_url')
      .in('id', ids);
    if (error) {
      console.warn('[OXV][crew] profils best-effort :', error.message);
    }
    for (const u of data ?? []) {
      const row = u as {
        id: string;
        first_name: string | null;
        public_handle: string | null;
        avatar_url: string | null;
      };
      firstNameById.set(row.id, row.first_name ?? null);
      if (!handleById.get(row.id)) handleById.set(row.id, row.public_handle ?? null);
      if (!avatarById.get(row.id)) avatarById.set(row.id, row.avatar_url ?? null);
    }
  }

  return membres.map((m) => ({
    userId: m.userId,
    firstName: firstNameById.get(m.userId) ?? null,
    handle: handleById.get(m.userId) ?? null,
    avatarUrl: avatarById.get(m.userId) ?? null,
    role: m.role,
  }));
}
