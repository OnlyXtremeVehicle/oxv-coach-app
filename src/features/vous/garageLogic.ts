/**
 * garageLogic — logique pure de l'écran Garage (V2-L4, écran 3/8, l'écran photo).
 *
 * Aucun import natif : ts-jest node (les types `Vehicle`/`VehicleSetup` sont
 * importés en `import type`, effacés à la compilation).
 *
 * Véhicule principal — LA COLONNE EXISTE, ET ELLE EST LUE DEPUIS LE 12/08/2026.
 *
 * Cet en-tête affirmait le contraire : « il N'EXISTE PAS de colonne is_primary
 * ni de setPrimary dans garageService ». C'était vrai le jour où il a été
 * écrit ; la migration `20260729034110` l'a posée le 29/07, et le service ne
 * l'a jamais lue. Le repli « le principal = le premier enregistré » a donc
 * survécu à sa propre raison d'être pendant deux semaines.
 *
 * Conséquence du repli, et elle n'était pas anodine : un pilote qui ajoutait un
 * second véhicule voyait son principal rester le premier, sans pouvoir en
 * changer — et l'accueil illustrait une voiture qu'il ne roulait plus.
 *
 * Désormais : le principal est celui que le pilote a DÉSIGNÉ. Le repli sur le
 * premier enregistré demeure, mais comme repli — un garage sans désignation est
 * un cas normal, pas une anomalie.
 *
 * Pressions en bar. Aucun jugement sur les réglages (miroir) : on résume des
 * faits matériels, rien de prescriptif.
 */

import type { Vehicle, VehicleSetup } from '@/services/garageService';

export interface GarageEntry {
  vehicle: Vehicle;
  /** Désigné principal par le pilote, ou premier enregistré à défaut. */
  isPrimary: boolean;
  /**
   * Vrai quand ce véhicule n'est principal QUE par défaut — aucune désignation
   * n'existe dans le garage. L'écran s'en sert pour ne pas afficher une
   * désignation que le pilote n'a jamais faite.
   */
  parDefaut: boolean;
}

/**
 * Ordonne le garage : le principal en tête, marqué.
 *
 * LA DÉSIGNATION PRIME, LE PREMIER ENREGISTRÉ REPLIE. Un garage sans
 * désignation est un cas normal — c'est celui de tout pilote qui n'a jamais
 * touché au réglage. On marque alors le premier, et on dit que c'est un repli.
 */
export function markGarage(vehicles: Vehicle[]): GarageEntry[] {
  const designe = vehicles.findIndex((v) => v.isPrimary);
  const aucuneDesignation = designe < 0;
  const indexPrincipal = aucuneDesignation ? 0 : designe;

  const entrees = vehicles.map((vehicle, i) => ({
    vehicle,
    isPrimary: i === indexPrincipal,
    parDefaut: aucuneDesignation,
  }));

  // Le principal remonte en tête ; l'ordre relatif des autres est conservé.
  return [...entrees.filter((e) => e.isPrimary), ...entrees.filter((e) => !e.isPrimary)];
}

/**
 * Identifiant du véhicule principal, `null` si le garage est vide.
 *
 * Le désigné d'abord, le premier enregistré à défaut.
 */
export function primaryVehicleId(vehicles: Vehicle[]): string | null {
  if (vehicles.length === 0) return null;
  return (vehicles.find((v) => v.isPrimary) ?? vehicles[0]).id;
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
