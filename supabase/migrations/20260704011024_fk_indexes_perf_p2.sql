-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 4 juillet 2026 a 01:10:24 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Perf P2 : index sur les 65 FK non couvertes (jointures + cascades de suppression).
-- Purement additif (create index if not exists), aucune policy ni donnée modifiée.
create index if not exists ai_safety_reviews_pilot_id_fk_idx on ai_safety_reviews (pilot_id);
create index if not exists app_config_updated_by_fk_idx on app_config (updated_by);
create index if not exists app_feature_flags_updated_by_fk_idx on app_feature_flags (updated_by);
create index if not exists b2b_event_reports_generated_by_fk_idx on b2b_event_reports (generated_by);
create index if not exists coach_ai_drafts_resulting_annotation_id_fk_idx on coach_ai_drafts (resulting_annotation_id);
create index if not exists coach_ai_drafts_telemetry_session_id_fk_idx on coach_ai_drafts (telemetry_session_id);
create index if not exists coach_corner_reference_circuit_id_fk_idx on coach_corner_reference (circuit_id);
create index if not exists coach_objective_events_coach_id_fk_idx on coach_objective_events (coach_id);
create index if not exists coach_objective_events_pilot_id_fk_idx on coach_objective_events (pilot_id);
create index if not exists coach_objectives_circuit_id_fk_idx on coach_objectives (circuit_id);
create index if not exists coach_permissions_granted_by_fk_idx on coach_permissions (granted_by);
create index if not exists coach_pilots_created_by_fk_idx on coach_pilots (created_by);
create index if not exists coach_queue_pilot_id_fk_idx on coach_queue (pilot_id);
create index if not exists coach_queue_telemetry_session_id_fk_idx on coach_queue (telemetry_session_id);
create index if not exists coach_reviews_pilot_id_fk_idx on coach_reviews (pilot_id);
create index if not exists coach_reviews_booking_id_fk_idx on coach_reviews (booking_id);
create index if not exists coaching_bookings_availability_id_fk_idx on coaching_bookings (availability_id);
create index if not exists contact_messages_read_by_fk_idx on contact_messages (read_by);
create index if not exists crew_members_referred_by_fk_idx on crew_members (referred_by);
create index if not exists data_quality_reports_owner_admin_id_fk_idx on data_quality_reports (owner_admin_id);
create index if not exists demandes_inscription_created_user_id_fk_idx on demandes_inscription (created_user_id);
create index if not exists demandes_inscription_reviewed_by_fk_idx on demandes_inscription (reviewed_by);
create index if not exists device_assignments_pilot_id_fk_idx on device_assignments (pilot_id);
create index if not exists device_assignments_assigned_by_fk_idx on device_assignments (assigned_by);
create index if not exists documents_validated_by_fk_idx on documents (validated_by);
create index if not exists duels_opponent_session_id_fk_idx on duels (opponent_session_id);
create index if not exists duels_challenger_session_id_fk_idx on duels (challenger_session_id);
create index if not exists eligibility_items_validated_by_fk_idx on eligibility_items (validated_by);
create index if not exists eligibility_items_document_id_fk_idx on eligibility_items (document_id);
create index if not exists event_registrations_checked_in_by_fk_idx on event_registrations (checked_in_by);
create index if not exists events_created_by_fk_idx on events (created_by);
create index if not exists invoices_registration_id_fk_idx on invoices (registration_id);
create index if not exists invoices_credit_note_for_fk_idx on invoices (credit_note_for);
create index if not exists media_uploaded_by_fk_idx on media (uploaded_by);
create index if not exists media_exports_telemetry_session_id_fk_idx on media_exports (telemetry_session_id);
create index if not exists media_exports_session_media_id_fk_idx on media_exports (session_media_id);
create index if not exists moderation_report_reviews_reviewed_by_fk_idx on moderation_report_reviews (reviewed_by);
create index if not exists notif_throttle_log_source_user_id_fk_idx on notif_throttle_log (source_user_id);
create index if not exists partner_leads_offer_id_fk_idx on partner_leads (offer_id);
create index if not exists payments_heritage_pack_id_fk_idx on payments (heritage_pack_id);
create index if not exists pilot_friendships_initiator_id_fk_idx on pilot_friendships (initiator_id);
create index if not exists pilot_goal_events_user_id_fk_idx on pilot_goal_events (user_id);
create index if not exists pilot_goals_evaluated_session_id_fk_idx on pilot_goals (evaluated_session_id);
create index if not exists pilot_goals_circuit_id_fk_idx on pilot_goals (circuit_id);
create index if not exists pilot_notes_session_id_fk_idx on pilot_notes (session_id);
create index if not exists pilot_signature_snapshots_session_id_fk_idx on pilot_signature_snapshots (session_id);
create index if not exists ping_rsvps_user_id_fk_idx on ping_rsvps (user_id);
create index if not exists pro_team_members_pro_user_id_fk_idx on pro_team_members (pro_user_id);
create index if not exists pro_team_members_member_user_id_fk_idx on pro_team_members (member_user_id);
create index if not exists registrations_vehicle_id_fk_idx on registrations (vehicle_id);
create index if not exists registrations_cancelled_by_fk_idx on registrations (cancelled_by);
create index if not exists registrations_heritage_pack_id_fk_idx on registrations (heritage_pack_id);
create index if not exists scenic_routes_certified_by_fk_idx on scenic_routes (certified_by);
create index if not exists session_feedback_user_id_fk_idx on session_feedback (user_id);
create index if not exists session_intentions_circuit_id_fk_idx on session_intentions (circuit_id);
create index if not exists session_media_uploaded_by_user_id_fk_idx on session_media (uploaded_by_user_id);
create index if not exists social_pings_created_by_fk_idx on social_pings (created_by);
create index if not exists support_messages_author_id_fk_idx on support_messages (author_id);
create index if not exists support_tickets_device_id_fk_idx on support_tickets (device_id);
create index if not exists support_tickets_session_id_fk_idx on support_tickets (session_id);
create index if not exists telemetry_sessions_source_device_id_fk_idx on telemetry_sessions (source_device_id);
create index if not exists telemetry_sessions_circuit_id_fk_idx on telemetry_sessions (circuit_id);
create index if not exists users_kyc_validated_by_fk_idx on users (kyc_validated_by);
create index if not exists users_suspended_by_fk_idx on users (suspended_by);
create index if not exists vehicle_setups_session_id_fk_idx on vehicle_setups (session_id);
