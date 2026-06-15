/**
 * Service carte écosystème (§8 étape A OXV Mirror) — accès Supabase.
 *
 * Lit les circuits (annuaire national) et les services associés
 * (restauration, hébergement, loisirs, roulages). Référencement/lecture
 * uniquement — aucune écriture côté pilote (admin only).
 *
 * La logique pure (groupage, centre carte) vit dans `ecosystemLogic.ts`.
 * Voir migration 20260526210000_0036_circuit_services.sql.
 */

import { supabase } from '@/lib/supabase';

import { type CircuitService, type DirectoryCircuit, type ServiceKind } from './ecosystemLogic';

interface CircuitRow {
  id: string;
  name: string | null;
  official_name: string | null;
  city: string | null;
  region: string | null;
  length_km: number | null;
  turns_count: number | null;
  finish_line_lat: number | null;
  finish_line_lon: number | null;
  bbox_min_lat: number | null;
  bbox_max_lat: number | null;
  bbox_min_lon: number | null;
  bbox_max_lon: number | null;
  is_official: boolean | null;
}

interface ServiceRow {
  id: string;
  circuit_id: string;
  kind: ServiceKind;
  name: string;
  description: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  organizer: string | null;
  is_premium: boolean;
}

function num(v: number | null): number | null {
  return v == null ? null : Number(v);
}

function mapCircuit(row: CircuitRow): DirectoryCircuit {
  return {
    id: row.id,
    name: row.name ?? '',
    officialName: row.official_name,
    city: row.city,
    region: row.region,
    lengthKm: num(row.length_km),
    turnsCount: row.turns_count,
    finishLineLat: num(row.finish_line_lat),
    finishLineLon: num(row.finish_line_lon),
    bboxMinLat: num(row.bbox_min_lat),
    bboxMaxLat: num(row.bbox_max_lat),
    bboxMinLon: num(row.bbox_min_lon),
    bboxMaxLon: num(row.bbox_max_lon),
  };
}

function mapService(row: ServiceRow): CircuitService {
  return {
    id: row.id,
    circuitId: row.circuit_id,
    kind: row.kind,
    name: row.name,
    description: row.description,
    address: row.address,
    lat: num(row.lat),
    lon: num(row.lon),
    url: row.url,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    organizer: row.organizer,
    isPremium: row.is_premium,
  };
}

/**
 * Liste les circuits officiels pour l'annuaire national (couche gratuite).
 * Triés par nom. Étape A V1 : démarrage Nouvelle-Aquitaine + circuits
 * majeurs (le référencement national est un travail de données progressif).
 */
export async function fetchDirectoryCircuits(): Promise<DirectoryCircuit[]> {
  const { data, error } = await supabase
    .from('circuits')
    .select(
      'id, name, official_name, city, region, length_km, turns_count, finish_line_lat, finish_line_lon, bbox_min_lat, bbox_max_lat, bbox_min_lon, bbox_max_lon, is_official'
    )
    .eq('is_official', true);

  if (error || !data) {
    if (error) console.warn('[ecosystem] fetchDirectoryCircuits error:', error.message);
    return [];
  }
  return (data as unknown as CircuitRow[])
    .map(mapCircuit)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Liste les services publiés d'un circuit donné. */
export async function listCircuitServices(circuitId: string): Promise<CircuitService[]> {
  const { data, error } = await supabase
    .from('circuit_services')
    .select('*')
    .eq('circuit_id', circuitId)
    .eq('is_published', true);

  if (error || !data) {
    if (error) console.warn('[ecosystem] listCircuitServices error:', error.message);
    return [];
  }
  return (data as unknown as ServiceRow[]).map(mapService);
}
