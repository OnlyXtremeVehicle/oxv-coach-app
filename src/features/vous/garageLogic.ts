/**
 * garageLogic — logique pure de l'écran Garage (V2-L4, écran 3/8, l'écran photo).
 *
 * Aucun import natif : ts-jest node (les types `Vehicle`/`VehicleSetup` sont
 * importés en `import type`, effacés à la compilation).
 *
 * Véhicule principal — HONNÊTETÉ SCHÉMA : il N'EXISTE PAS de colonne is_primary
 * ni de setPrimary dans garageService. Le principal = le PREMIER enregistré
 * (ordre created_at ascendant du service), celui dont la cover illustre déjà
 * l'accueil/hub. On le marque donc factuellement, sans jamais inventer un
 * bouton « Définir principal » (capacité absente, consignée au rapport).
 *
 * Pressions en bar. Aucun jugement sur les réglages (miroir) : on résume des
 * faits matériels, rien de prescriptif.
 */

import type { Vehicle, VehicleSetup } from '@/services/garageService';

export interface GarageEntry {
  vehicle: Vehicle;
  /** Premier enregistré = celui affiché sur l'accueil (fait, non modifiable). */
  isPrimary: boolean;
}

/**
 * Ordonne le garage pour l'affichage : le principal (index 0 du service) en
 * tête, marqué. L'ordre created_at ascendant est déjà celui du service — cette
 * fonction encode le contrat (et le normalise si la liste arrivait non triée).
 */
export function markGarage(vehicles: Vehicle[]): GarageEntry[] {
  return vehicles.map((vehicle, i) => ({ vehicle, isPrimary: i === 0 }));
}

/** Identifiant du véhicule principal (le premier), null si garage vide. */
export function primaryVehicleId(vehicles: Vehicle[]): string | null {
  return vehicles.length > 0 ? vehicles[0].id : null;
}

/** Nom lisible (marque + modèle), repli neutre si vide. */
export function vehicleName(v: Vehicle): string {
  return [v.brand, v.model].filter(Boolean).join(' ').trim() || 'Véhicule';
}

/** Valeur factuelle affichable, « — » si absente (jamais inventée). */
export function metaValue(v: string | number | null | undefined): string {
  if (v == null) return '—';
  const t = String(v).trim();
  return t.length > 0 ? t : '—';
}

/** Ligne specs mono « 2015 · Rouge » (réel), « — » si tout est absent. */
export function vehicleSpecsLine(v: Vehicle): string {
  const parts = [v.year, v.color].map(metaValue).filter((x) => x !== '—');
  return parts.length > 0 ? parts.join('  ·  ') : '—';
}

export interface SpecRow {
  key: string;
  label: string;
  value: string;
}

/** Lignes de spécifications (seules colonnes réelles), « — » si absente. */
export function specRows(v: Vehicle): SpecRow[] {
  return [
    { key: 'brand', label: 'Marque', value: metaValue(v.brand) },
    { key: 'model', label: 'Modèle', value: metaValue(v.model) },
    { key: 'year', label: 'Année', value: metaValue(v.year) },
    { key: 'color', label: 'Couleur', value: metaValue(v.color) },
  ];
}

/** Cover signée d'un véhicule (première photo), undefined si aucune. */
export function coverUriFor(vehicleId: string, covers: Record<string, string>): string | undefined {
  const uri = covers[vehicleId];
  return uri && uri.length > 0 ? uri : undefined;
}

/** « 2,1 bar » (virgule décimale FR), « — » si null. */
export function fmtBar(v: number | null): string {
  return v != null ? `${v.toFixed(1).replace('.', ',')} bar` : '—';
}

/** « 18 juil. 2026 » depuis l'ISO recorded_at, « — » si illisible. */
export function formatSetupDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Résumé factuel d'un réglage (lignes non vides uniquement) — aucun jugement.
 * Une pression n'apparaît que si au moins un des deux essieux est renseigné.
 */
export function setupSummaryLines(s: VehicleSetup): string[] {
  const out: string[] = [];
  if (s.tires) out.push(`Pneus : ${s.tires}`);
  if (s.brakes) out.push(`Freins : ${s.brakes}`);
  if (s.pressureFrontStart != null || s.pressureRearStart != null) {
    out.push(`Départ AV/AR : ${fmtBar(s.pressureFrontStart)} / ${fmtBar(s.pressureRearStart)}`);
  }
  if (s.pressureFrontEnd != null || s.pressureRearEnd != null) {
    out.push(`Retour AV/AR : ${fmtBar(s.pressureFrontEnd)} / ${fmtBar(s.pressureRearEnd)}`);
  }
  if (s.notes) out.push(s.notes);
  return out;
}

/** Parse une pression saisie (« 2,1 » → 2.1), null si vide/illisible. */
export function parseBar(v: string): number | null {
  const t = v.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export interface SetupDraft {
  tires: string;
  brakes: string;
  pfs: string;
  prs: string;
  pfe: string;
  pre: string;
  notes: string;
}

export const EMPTY_SETUP_DRAFT: SetupDraft = {
  tires: '',
  brakes: '',
  pfs: '',
  prs: '',
  pfe: '',
  pre: '',
  notes: '',
};

/** true si le brouillon de réglage porte au moins un champ renseigné. */
export function hasSetupInput(draft: SetupDraft): boolean {
  return (Object.values(draft) as string[]).some((v) => v.trim().length > 0);
}
