/**
 * Service carnet pilote — notes libres post-session (table `pilot_notes`, 0025).
 *
 * Espace INTIME du pilote : own-row strict. L'app n'écrit, ne pré-remplit ni ne
 * suggère JAMAIS le contenu (doctrine V5 P-E) — ce service ne fait que stocker et
 * relire ce que le pilote a écrit. Aucune génération, aucune IA, aucun jugement.
 *
 * Partage : opt-in PAR NOTE (`shared_with_coach`). Quand le pilote partage, son
 * coach consenti lit la note EN LECTURE SEULE (RLS pilot_notes_coach_select).
 * Révocable immédiatement (repasser le flag à false). Le partenaire n'accède
 * jamais. L'accès coach est journalisé via log_coach_view (RGPD).
 */

import { supabase } from '@/lib/supabase';
import { RESSENTIS, THEMES, type RessentiQcm, type ThemeQcm } from '@/features/rec/qcmLogic';

export interface PilotNote {
  id: string;
  sessionId: string | null;
  body: string;
  sharedWithCoach: boolean;
  /** Thème du ressenti structuré (QCM entre-runs). `null` pour une note libre. */
  theme: string | null;
  /** Réponse au QCM, en clair. `null` pour une note libre. */
  ressenti: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * `theme` et `ressenti` sont dans cette liste, et c'est un correctif du
 * 12/08/2026 : la veille, j'ai ajouté leur ÉCRITURE sans ajouter leur LECTURE.
 * La donnée du QCM entrait en base et n'en ressortait jamais.
 *
 * C'est exactement le défaut du ThumbHash, corrigé le 04/08 : une colonne
 * écrite, transportée, puis perdue au dernier maillon. Deux fois la même faute
 * en huit jours — la leçon est qu'un ajout de colonne se vérifie sur le trajet
 * COMPLET, aller ET retour, avant d'être déclaré fait.
 */
const COLS = 'id, session_id, body, theme, ressenti, shared_with_coach, created_at, updated_at';

function mapNote(r: Record<string, unknown>): PilotNote {
  return {
    id: r.id as string,
    sessionId: (r.session_id as string | null) ?? null,
    body: r.body as string,
    theme: (r.theme as string | null) ?? null,
    ressenti: (r.ressenti as string | null) ?? null,
    sharedWithCoach: Boolean(r.shared_with_coach),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export interface MutationResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/** Mes notes (RLS own-row), de la plus récente à la plus ancienne. */
export async function listMyNotes(): Promise<PilotNote[]> {
  const { data, error } = await supabase
    .from('pilot_notes')
    .select(COLS)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[OXV][carnet] listMyNotes :', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapNote(r as Record<string, unknown>));
}

/**
 * Crée une note. Le texte vient du pilote, jamais d'un gabarit. `sessionId` est
 * un lien optionnel (rattacher la note à une séance) — jamais une pré-saisie de
 * contenu.
 */
export async function addNote(
  body: string,
  sessionId?: string | null,
  /**
   * Le ressenti structuré du QCM de l'entre-runs. Absent pour une note libre —
   * et une note libre reste parfaitement valide : les deux colonnes sont
   * nullables en base.
   *
   * `theme` est CONTRAINT côté Postgres (`pilot_notes_theme_check`) sur le
   * vocabulaire de la variable coach. Une valeur hors liste ne serait pas
   * silencieusement acceptée : l'insertion serait refusée. C'est voulu — le
   * croisement avec ce que le coach observe n'a de sens que si les deux
   * emploient les mêmes mots.
   */
  structure?: { theme: string; ressenti: string } | null
): Promise<MutationResult> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Session expirée.' };
  const text = body.trim();
  if (!text) return { ok: false, error: 'Note vide.' };

  const { data, error } = await supabase
    .from('pilot_notes')
    .insert({
      user_id: uid,
      body: text,
      session_id: sessionId ?? null,
      theme: structure?.theme ?? null,
      ressenti: structure?.ressenti ?? null,
    } as never)
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Enregistrement impossible.' };
  return { ok: true, id: (data as { id: string }).id };
}

/** Édite le corps d'une note existante (le pilote corrige son propre texte). */
export async function updateNoteBody(id: string, body: string): Promise<MutationResult> {
  const text = body.trim();
  if (!text) return { ok: false, error: 'Note vide.' };
  const { error } = await supabase
    .from('pilot_notes')
    .update({ body: text } as never)
    .eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true, id };
}

/**
 * Partage / retire le partage d'une note avec le coach. Acte explicite et
 * révocable : false coupe l'accès coach immédiatement (RLS).
 */
export async function setNoteShared(id: string, shared: boolean): Promise<MutationResult> {
  const { error } = await supabase
    .from('pilot_notes')
    .update({ shared_with_coach: shared } as never)
    .eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true, id };
}

/** Supprime franchement une note (souveraineté du pilote sur ses données). */
export async function deleteNote(id: string): Promise<MutationResult> {
  const { error } = await supabase.from('pilot_notes').delete().eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true, id };
}

/**
 * Vue COACH (lecture seule) : les notes qu'un pilote suivi a explicitement
 * partagées. La RLS pilot_notes_coach_select garantit qu'on ne reçoit QUE les
 * notes `shared_with_coach = true` d'un pilote dont on est coach consenti.
 * L'accès est journalisé (log_coach_view) pour la conformité RGPD.
 */
export async function listSharedNotesForPilot(pilotId: string): Promise<PilotNote[]> {
  const { data, error } = await supabase
    .from('pilot_notes')
    .select(COLS)
    .eq('user_id', pilotId)
    .eq('shared_with_coach', true)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[OXV][carnet] listSharedNotesForPilot :', error.message);
    return [];
  }
  const notes = (data ?? []).map((r) => mapNote(r as Record<string, unknown>));
  if (notes.length > 0) {
    // Journalisation RGPD (best effort, ne bloque jamais l'affichage).
    await supabase
      .rpc('log_coach_view', { target_pilot_uuid: pilotId, action_subtype: 'carnet_view' })
      .then(
        () => undefined,
        () => undefined
      );
  }
  return notes;
}

/**
 * LE QCM D'ENTRE-RUNS D'UNE SÉANCE — thème et ressenti, validés.
 *
 * ===========================================================================
 * LA DONNÉE ÉTAIT ÉCRITE, ELLE N'ÉTAIT PAS RELUE PAR LE MOTEUR
 * ===========================================================================
 *
 * `rec/entre-runs` écrit le QCM depuis le 12/08 : `addNote(body, sessionId,
 * { theme, ressenti })`. `listSessionNotes` le relit pour l'afficher. Mais le
 * moteur de composition, lui, recevait `theme: null` et `ressenti: null` —
 * la troisième fois dans ce dépôt qu'une colonne est écrite, transportée, puis
 * perdue au dernier maillon.
 *
 * ===========================================================================
 * DEUX VALIDATIONS, ET UNE SEULE VIENT DE POSTGRES
 * ===========================================================================
 *
 * `theme` est CONTRAINT en base (`pilot_notes_theme_check`) sur les quatre
 * valeurs de `ThemeQcm` : ce qui sort de la table est déjà licite.
 *
 * `ressenti` ne l'est PAS — la colonne est un `text` libre. On le valide donc
 * ici, contre `RESSENTIS`, et une valeur hors liste devient `null` au lieu
 * d'entrer dans le moteur. Le jour où une cinquième réponse s'ajoute à l'écran
 * sans s'ajouter au type, elle se voit ici plutôt que de départager des fiches
 * en silence.
 *
 * ===========================================================================
 * LA PLUS RÉCENTE, ET RIEN QU'ELLE
 * ===========================================================================
 *
 * Un pilote peut répondre plusieurs fois sur une même séance. La dernière
 * réponse est celle qui vaut : les précédentes sont des états intermédiaires
 * d'un geste, pas des avis successifs. On ne les agrège pas — une moyenne de
 * ressentis ne veut rien dire.
 */
export async function lireQcmSeance(
  sessionId: string
): Promise<{ theme: ThemeQcm | null; ressenti: RessentiQcm | null }> {
  const vide = { theme: null, ressenti: null };
  if (typeof sessionId !== 'string' || sessionId.length === 0) return vide;

  const { data, error } = await supabase
    .from('pilot_notes')
    .select('theme, ressenti, created_at')
    .eq('session_id', sessionId)
    .not('theme', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.warn('[OXV][notes] lireQcmSeance :', error.message);
    return vide;
  }
  const ligne = (data ?? [])[0] as { theme?: unknown; ressenti?: unknown } | undefined;
  if (ligne === undefined) return vide;

  const theme = THEMES.find((t) => t.cle === ligne.theme)?.cle ?? null;
  const ressenti = RESSENTIS.find((r) => r.cle === ligne.ressenti)?.cle ?? null;
  return { theme, ressenti };
}
