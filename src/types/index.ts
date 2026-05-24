/**
 * Types globaux OXV — v0.2
 *
 * CORRECTIONS v0.2 — RGPD :
 * - SUPPRESSION du type BloodType
 * - SUPPRESSION de medical_notes
 * - SUPPRESSION de blood_type dans OxvUser
 */

export type PilotLevel = 'debutant' | 'intermediaire' | 'confirme' | 'expert';
export type ExperienceYears = '<1' | '1-2' | '3-5' | '5-10' | '10+';
export type EmergencyRelation = 'conjoint' | 'parent' | 'enfant' | 'ami' | 'autre';

export interface OxvUser {
  id: string;
  email: string;

  // Identité
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  birth_date: string | null;

  // Profil
  avatar_url: string | null;
  public_handle: string | null;

  // Pilotage
  pilot_level: PilotLevel | null;
  ffsa_license: string | null;
  experience_years: ExperienceYears | null;

  // Contact urgence (sans données médicales pour conformité RGPD)
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: EmergencyRelation | null;

  // Métadonnées
  profile_completed_at: string | null;
  two_factor_enabled: boolean;
  notification_preferences: Record<string, boolean>;

  // Admin
  is_admin: boolean;

  created_at: string;
  updated_at: string;
}

/**
 * Préférences de notification — alignées doctrine OXV Coach.
 *
 * Les notifications sociales (new_follower, mention), de classement
 * (rank_change, new_record) et de "coaching" (coach_response) ont été
 * retirées : elles contredisent le principe "miroir, pas coach" et
 * l'absence de comparaison entre pilotes.
 */
export interface NotificationPreferences {
  // Rituels avant session
  ritual_jminus7: boolean; // Confirmation + playlist
  ritual_jminus2: boolean; // Audio personnalisé
  ritual_jminus1: boolean; // Rappel veille

  // Cycle de session
  session_bilan_ready: boolean; // "Votre bilan est prêt"
  debrief_jplus1: boolean; // Debrief J+1 littéraire

  // Logistique
  session_cancelled: boolean; // Annulation météo, force majeure
  payment_received: boolean; // Confirmation paiement
  document_validated: boolean; // KYC validé
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  ritual_jminus7: true,
  ritual_jminus2: true,
  ritual_jminus1: true,
  session_bilan_ready: true,
  debrief_jplus1: true,
  session_cancelled: true,
  payment_received: true,
  document_validated: true,
};
