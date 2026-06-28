/**
 * Catalogue des événements produit OXV (KPI §27 du cahier des charges).
 *
 * Noms centralisés (une seule source de vérité) pour éviter les fautes de frappe
 * et garder les KPIs cohérents entre écrans. Tout passe par
 * `analyticsService.trackEvent` — donc RGPD par construction : no-op tant que le
 * domaine Plausible n'est pas configuré, opt-out respecté, et **jamais de PII**
 * (on ne transmet que des propriétés catégorielles : un type de couche, un
 * niveau d'accès, une source — jamais d'email, d'id ni de coordonnées).
 *
 * Correspondance KPI §27 :
 *   onboarding_termine        → activation_pilote
 *   capture_reussie / _echouee → session_capture_success
 *   bilan_ouvert              → bilan_open_rate
 *   datalab_couche_ouverte    → data_lab_depth
 *   coach_consentement_donne  → coach_share_rate
 *   coach_note_envoyee        → coach_note_delivery
 *
 * (data_anomaly_rate et partner_lead_rate attendent leurs tables — hors scope.)
 */

import { trackEvent } from './analyticsService';

export const OxvEvent = {
  /** Le pilote a terminé l'onboarding (Pacte signé). */
  onboardingTermine: () => trackEvent('onboarding_termine'),
  /** Une session a produit de la matière exploitable (analyse persistée). */
  captureReussie: (props: { source: string; segments: number }) =>
    trackEvent('capture_reussie', props),
  /** Une session n'a pas pu être exploitée (aucune donnée). */
  captureEchouee: (source: string) => trackEvent('capture_echouee', { source }),
  /** Le pilote a ouvert son bilan. */
  bilanOuvert: () => trackEvent('bilan_ouvert'),
  /** Le pilote ouvre une couche du Data Lab (profondeur de lecture). */
  datalabCoucheOuverte: (couche: string) => trackEvent('datalab_couche_ouverte', { couche }),
  /** Le pilote a consenti au coaching, au niveau d'accès choisi. */
  coachConsentementDonne: (niveau: string) => trackEvent('coach_consentement_donne', { niveau }),
  /** Le coach a envoyé une note à un pilote. */
  coachNoteEnvoyee: () => trackEvent('coach_note_envoyee'),
} as const;
