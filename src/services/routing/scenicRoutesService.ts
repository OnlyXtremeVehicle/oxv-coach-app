/**
 * Belles routes sauvegardées + certification OXV (doc 09, migration 0043).
 *
 * Un pilote enregistre une belle route, la retrouve, et peut demander sa
 * certification par un admin OXV. Seul un admin certifie/rejette (verrou DB).
 * Curation par l'utilisateur — aucun classement par agressivité de conduite.
 */

import { supabase } from '@/lib/supabase';
import type { Database, Json } from '@/types/database.types';

import type { GeoPoint, ScenicPoi, ScenicRoute } from './types';

type Row = Database['public']['Tables']['scenic_routes']['Row'];
export type ScenicRouteStatus = Database['public']['Enums']['scenic_route_status'];

export interface SavedScenicRoute {
  id: string;
  name: string;
  start: GeoPoint;
  distanceKm: number | null;
  curviness: string | null;
  sinuosity: number | null;
  ascentM: number | null;
  status: ScenicRouteStatus;
  reviewNotes: string | null;
  createdAt: string;
}

function fromRow(r: Row): SavedScenicRoute {
  return {
    id: r.id,
    name: r.name,
    start: { lat: r.start_lat, lon: r.start_lon },
    distanceKm: r.distance_km,
    curviness: r.curviness,
    sinuosity: r.sinuosity,
    ascentM: r.ascent_m,
    status: r.status,
    reviewNotes: r.review_notes,
    createdAt: r.created_at,
  };
}

export interface SaveRouteInput {
  name: string;
  start: GeoPoint;
  curviness?: string | null;
  route?: ScenicRoute | null;
  pois?: ScenicPoi[];
}

/** Enregistre une belle route pour le pilote courant. */
export async function saveRoute(input: SaveRouteInput): Promise<SavedScenicRoute | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from('scenic_routes')
    .insert({
      user_id: uid,
      name: input.name,
      start_lat: input.start.lat,
      start_lon: input.start.lon,
      curviness: input.curviness ?? null,
      distance_km: input.route?.distanceKm ?? null,
      sinuosity: input.route?.sinuosity ?? null,
      ascent_m: input.route?.ascentM ?? null,
      geometry: (input.route?.coordinates ?? null) as Json,
      pois: (input.pois ?? null) as unknown as Json,
      provider: input.route?.provider ?? null,
    })
    .select('*')
    .single();
  if (error || !data) return null;
  return fromRow(data);
}

/** Routes du pilote courant (les plus récentes d'abord). */
export async function listMyRoutes(): Promise<SavedScenicRoute[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from('scenic_routes')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(fromRow);
}

/** Demande la certification OXV d'une route (passe en attente de revue). */
export async function requestCertification(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('scenic_routes')
    .update({ status: 'pending_review' })
    .eq('id', id);
  return !error;
}

export async function deleteRoute(id: string): Promise<boolean> {
  const { error } = await supabase.from('scenic_routes').delete().eq('id', id);
  return !error;
}

/** Routes certifiées OXV (communauté, membres validés). */
export async function listCertifiedRoutes(): Promise<SavedScenicRoute[]> {
  const { data, error } = await supabase
    .from('scenic_routes')
    .select('*')
    .eq('status', 'certified')
    .order('certified_at', { ascending: false });
  if (error || !data) return [];
  return data.map(fromRow);
}

/* ---- Côté admin (RLS : réservé is_admin) ---- */

export async function listPendingCertification(): Promise<SavedScenicRoute[]> {
  const { data, error } = await supabase
    .from('scenic_routes')
    .select('*')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map(fromRow);
}

export async function certifyRoute(id: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('scenic_routes')
    .update({
      status: 'certified',
      certified_by: auth.user?.id ?? null,
      certified_at: new Date().toISOString(),
    })
    .eq('id', id);
  return !error;
}

export async function rejectRoute(id: string, notes?: string): Promise<boolean> {
  const { error } = await supabase
    .from('scenic_routes')
    .update({ status: 'rejected', review_notes: notes ?? null })
    .eq('id', id);
  return !error;
}
