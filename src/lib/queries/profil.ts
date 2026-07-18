// DIVERGENCE_SCHEMA: adaptations au schéma réel de production (17/07/2026) —
//  - `users.media` est un TABLEAU de PilotMediaItem (jsonb, service
//    pilotMediaService), PAS un objet { cover_url, gallery } : la galerie du
//    profil = les médias de profil réels (signed URLs) ; la COUVERTURE n'a
//    AUCUNE donnée réelle → fallback dégradé du HTML de référence, aucune clé
//    cover_url inventée ;
//  - `bio`, `car_number`, `pavilion_name_optin` : migration
//    20260717000000_profil_pavillon.sql JOINTE mais NON APPLIQUÉE → repli
//    §5.4 (42703 → second select sans ces colonnes, blocs masqués,
//    console.warn('MIGRATION_PROFIL_PAVILLON absente')) ;
//  - filtre statut sessions : write-path réel = 'completed' (compteur borné) ;
//  - réseaux : `users.socials` (jsonb) existe ; clés du lot instagram /
//    youtube / linkedin — les autres clés (website…) sont PRÉSERVÉES à
//    l'écriture (fusion, jamais d'écrasement du jsonb).
/**
 * Profil pilote — requêtes Supabase (lot PROFIL_CARTES).
 *
 * Défense en profondeur (spec §4.3) : toutes les requêtes filtrent
 * explicitement sur l'utilisateur connecté MÊME si la RLS le garantit déjà.
 * Aucun select sur `users` ne ramène d'autre ligne que celle du pilote.
 *
 * Écritures : WHITELIST stricte de colonnes (§7.5) — jamais role, is_admin,
 * kyc_status ni aucun champ hors bio / socials / pavilion_name_optin /
 * public_handle.
 */

import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database.types';

import { avecDelaiGarde } from './attente';

/** Réseaux affichés par le lot (seules les clés renseignées apparaissent). */
export interface ReseauxProfil {
  instagram: string | null;
  youtube: string | null;
  linkedin: string | null;
}

export interface ProfilPilote {
  id: string;
  prenom: string | null;
  nom: string | null;
  handle: string | null;
  avatarUrl: string | null;
  /** ISO — users.created_at (« Membre · depuis {mois année} »). */
  creeLe: string | null;
  /** null tant que la migration profil/pavillon n'est pas appliquée. */
  bio: string | null;
  carNumber: number | null;
  pavillonOptin: boolean | null;
  reseaux: ReseauxProfil;
  /** false = colonnes bio/car_number/pavilion_name_optin absentes (§5.4). */
  migrationPavillon: boolean;
}

export interface VehiculeGarage {
  id: string;
  brand: string;
  model: string;
  year: number | null;
}

export interface CircuitPrincipalProfil {
  officialName: string | null;
  name: string | null;
  trackSvgPath: string | null;
}

export interface DonneesProfil {
  profil: ProfilPilote;
  vehicules: VehiculeGarage[];
  /** count(telemetry_sessions) où user_id = moi et status = 'completed'. */
  compteurCartes: number;
  /** Circuit du plus grand nombre de sessions terminées — null si aucune. */
  circuitPrincipal: CircuitPrincipalProfil | null;
}

const COLONNES_BASE = 'id, first_name, last_name, public_handle, avatar_url, socials, created_at';
const COLONNES_MIGRATION = `${COLONNES_BASE}, bio, car_number, pavilion_name_optin`;

interface LigneUserBrute {
  id: string;
  first_name: string | null;
  last_name: string | null;
  public_handle: string | null;
  avatar_url: string | null;
  socials: unknown;
  created_at: string | null;
  bio?: string | null;
  car_number?: number | null;
  pavilion_name_optin?: boolean | null;
}

function texte(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

/** Parse défensif du jsonb `socials` — clés du lot uniquement. */
function parseReseaux(raw: unknown): ReseauxProfil {
  const vide: ReseauxProfil = { instagram: null, youtube: null, linkedin: null };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return vide;
  const o = raw as Record<string, unknown>;
  return {
    instagram: texte(o.instagram),
    youtube: texte(o.youtube),
    linkedin: texte(o.linkedin),
  };
}

/** Erreur PostgREST « colonne inconnue » (migration non appliquée, §5.4). */
function estColonneInconnue(erreur: { code?: string; message?: string } | null): boolean {
  return erreur?.code === '42703';
}

/**
 * Lit la ligne `users` du pilote connecté, avec repli si la migration
 * profil/pavillon n'est pas appliquée (§5.4) : second select sans les
 * colonnes bio / car_number / pavilion_name_optin.
 */
async function lireLigneUser(
  userId: string
): Promise<{ ligne: LigneUserBrute; migrationPavillon: boolean }> {
  const complet = await supabase.from('users').select(COLONNES_MIGRATION).eq('id', userId).single();
  if (!complet.error && complet.data) {
    return { ligne: complet.data as unknown as LigneUserBrute, migrationPavillon: true };
  }
  if (!estColonneInconnue(complet.error)) {
    throw new Error(complet.error?.message ?? 'PROFIL_ILLISIBLE');
  }

  console.warn('MIGRATION_PROFIL_PAVILLON absente');
  const repli = await supabase.from('users').select(COLONNES_BASE).eq('id', userId).single();
  if (repli.error || !repli.data) {
    throw new Error(repli.error?.message ?? 'PROFIL_ILLISIBLE');
  }
  return { ligne: repli.data as unknown as LigneUserBrute, migrationPavillon: false };
}

/**
 * Charge les données du profil : identité, garage, compteur de cartes
 * (sessions 'completed') et circuit principal. Délai garde 10 s (§7.2).
 */
export async function getProfil(): Promise<DonneesProfil> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error('AUTH_REQUIRED');

  const [{ ligne, migrationPavillon }, vehicules, compteur, circuitPrincipal] =
    await avecDelaiGarde(
      Promise.all([
        lireLigneUser(user.id),
        chargerGarage(user.id),
        compterCartes(user.id),
        chargerCircuitPrincipal(user.id),
      ])
    );

  return {
    profil: {
      id: ligne.id,
      prenom: texte(ligne.first_name),
      nom: texte(ligne.last_name),
      handle: texte(ligne.public_handle),
      avatarUrl: texte(ligne.avatar_url),
      creeLe: texte(ligne.created_at),
      bio: migrationPavillon ? texte(ligne.bio) : null,
      carNumber:
        migrationPavillon && typeof ligne.car_number === 'number' ? ligne.car_number : null,
      pavillonOptin: migrationPavillon ? (ligne.pavilion_name_optin ?? false) : null,
      reseaux: parseReseaux(ligne.socials),
      migrationPavillon,
    },
    vehicules,
    compteurCartes: compteur,
    circuitPrincipal,
  };
}

async function chargerGarage(userId: string): Promise<VehiculeGarage[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, brand, model, year')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((v) => ({
    id: v.id,
    brand: v.brand,
    model: v.model,
    year: typeof v.year === 'number' ? v.year : null,
  }));
}

async function compterCartes(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('telemetry_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed');
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Circuit du plus grand nombre de sessions terminées du pilote. */
async function chargerCircuitPrincipal(userId: string): Promise<CircuitPrincipalProfil | null> {
  const { data, error } = await supabase
    .from('telemetry_sessions')
    .select('circuit_id')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .not('circuit_id', 'is', null)
    .limit(1000);
  if (error) throw new Error(error.message);

  const comptes = new Map<string, number>();
  for (const ligne of data ?? []) {
    if (!ligne.circuit_id) continue;
    comptes.set(ligne.circuit_id, (comptes.get(ligne.circuit_id) ?? 0) + 1);
  }
  let principal: string | null = null;
  let max = 0;
  for (const [id, n] of comptes) {
    if (n > max) {
      max = n;
      principal = id;
    }
  }
  if (!principal) return null;

  const { data: circuit, error: erreurCircuit } = await supabase
    .from('circuits')
    .select('official_name, name, track_svg_path')
    .eq('id', principal)
    .maybeSingle();
  if (erreurCircuit || !circuit) {
    if (erreurCircuit) console.warn('[OXV][profil] circuit principal :', erreurCircuit.message);
    return null;
  }
  return {
    officialName: texte(circuit.official_name),
    name: texte(circuit.name),
    trackSvgPath: texte(circuit.track_svg_path),
  };
}

type ResultatEcriture = { ok: true } | { ok: false; error: string };

/**
 * Opt-in Pavillon : écrit le SEUL champ pavilion_name_optin (l'horodatage du
 * consentement est géré par le trigger de la migration). RLS propriétaire.
 */
export async function setPavillonOptin(valeur: boolean): Promise<ResultatEcriture> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { ok: false, error: 'Vous devez être connecté.' };

  const { error } = await supabase
    .from('users')
    .update({ pavilion_name_optin: valeur } as never)
    .eq('id', user.id);
  if (error) {
    console.warn('[OXV][profil] setPavillonOptin :', error.message);
    return {
      ok: false,
      error: "Le réglage n'a pas pu être enregistré. Réessayez dans un instant.",
    };
  }
  return { ok: true };
}

export interface EditionProfilInput {
  /** Ignoré si la migration profil/pavillon est absente. */
  bio?: string | null;
  reseaux?: Partial<ReseauxProfil>;
}

/**
 * Édition du profil — WHITELIST stricte : seuls `bio` et `socials` sont
 * modifiables ici (jamais role / is_admin / kyc_status ni aucun autre champ).
 * `socials` est FUSIONNÉ avec le jsonb existant : les clés hors lot
 * (website…) sont préservées.
 */
export async function sauvegarderProfil(
  input: EditionProfilInput,
  opts: { migrationPavillon: boolean }
): Promise<ResultatEcriture> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { ok: false, error: 'Vous devez être connecté.' };

  const nettoie = (v?: string | null): string | null => (v && v.trim() ? v.trim() : null);

  // Whitelist explicite — aucune autre clé ne peut entrer dans ce patch.
  const patch: { bio?: string | null; socials?: Json } = {};

  if (input.bio !== undefined && opts.migrationPavillon) {
    patch.bio = nettoie(input.bio);
  }

  if (input.reseaux !== undefined) {
    // Fusion : lecture du jsonb actuel de MA ligne, préservation des clés
    // hors lot, mise à jour des seules clés instagram / youtube / linkedin.
    const { data: actuel, error: erreurLecture } = await supabase
      .from('users')
      .select('socials')
      .eq('id', user.id)
      .maybeSingle();
    if (erreurLecture) {
      console.warn('[OXV][profil] lecture socials :', erreurLecture.message);
      return {
        ok: false,
        error: "Votre profil n'a pas pu être enregistré. Réessayez dans un instant.",
      };
    }
    const existant =
      actuel?.socials && typeof actuel.socials === 'object' && !Array.isArray(actuel.socials)
        ? (actuel.socials as Record<string, Json>)
        : {};
    const fusion: Record<string, Json> = { ...existant };
    if (input.reseaux.instagram !== undefined) fusion.instagram = nettoie(input.reseaux.instagram);
    if (input.reseaux.youtube !== undefined) fusion.youtube = nettoie(input.reseaux.youtube);
    if (input.reseaux.linkedin !== undefined) fusion.linkedin = nettoie(input.reseaux.linkedin);
    patch.socials = fusion;
  }

  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase
    .from('users')
    .update(patch as never)
    .eq('id', user.id);
  if (error) {
    console.warn('[OXV][profil] sauvegarderProfil :', error.message);
    return {
      ok: false,
      error: "Votre profil n'a pas pu être enregistré. Réessayez dans un instant.",
    };
  }
  return { ok: true };
}

/**
 * Nom public (users.public_handle, UNIQUE — partagé site/app). Pas de
 * vérification préalable d'unicité (racée) : la contrainte UNIQUE fait foi,
 * une violation renvoie Postgres 23505.
 */
export async function changerNomPublic(
  handle: string
): Promise<{ ok: true } | { ok: false; code: 'pris' | 'autre'; error: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { ok: false, code: 'autre', error: 'Vous devez être connecté.' };

  const { error } = await supabase
    .from('users')
    .update({ public_handle: handle })
    .eq('id', user.id);
  if (error) {
    if (error.code === '23505') {
      return { ok: false, code: 'pris', error: 'Ce nom est déjà pris.' };
    }
    console.warn('[OXV][profil] changerNomPublic :', error.message);
    return {
      ok: false,
      code: 'autre',
      error: "Votre nom public n'a pas pu être enregistré. Réessayez dans un instant.",
    };
  }
  return { ok: true };
}
