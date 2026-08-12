-- =============================================================================
-- L'EFFACEMENT RGPD ÉTAIT IMPOSSIBLE. PAS PARTIEL — IMPOSSIBLE.
-- =============================================================================
--
-- Trouvé le 12/08/2026 en EXÉCUTANT `purge_user_data` dans une transaction
-- annulée, après qu'un audit adversarial du travail du jour eut signalé un
-- premier verrou. La lecture ne l'aurait jamais montré : le code est correct,
-- ce sont les contraintes qui refusent.
--
-- -----------------------------------------------------------------------------
-- CE QUI SE PASSAIT
-- -----------------------------------------------------------------------------
--
-- `purge_user_data` supprime des lignes dans une soixantaine de tables. Six
-- clés étrangères pointaient vers ces tables en NO ACTION — c'est-à-dire en
-- refus. Chacune levait `23503` et, plpgsql étant UNE SEULE TRANSACTION,
-- annulait la purge ENTIÈRE.
--
--   registrations.vehicle_id        → vehicles            (8ᵉ instruction)
--   eligibility_items.document_id   → documents           (9ᵉ instruction)
--   sessions.circuit_id             → circuits
--   payments.heritage_pack_id       → heritage_packs
--   registrations.heritage_pack_id  → heritage_packs
--   incident_reports.session_id     → telemetry_sessions
--
-- **Tout pilote ayant réservé une journée avec un véhicule était ineffaçable.**
-- Il restait en base avec son nom, son adresse, son téléphone, son groupe
-- sanguin et ses notes médicales.
--
-- -----------------------------------------------------------------------------
-- ET PERSONNE NE POUVAIT LE VOIR
-- -----------------------------------------------------------------------------
--
-- `purge-deleted-accounts` range l'erreur dans son résultat et répond `ok`,
-- réponse que `pg_net` jette. Le cron (jobid 9) réessayait chaque nuit à 02h30
-- et échouait chaque nuit, en silence, depuis sa mise en place.
--
-- Aucune alerte, aucun journal consulté, aucun symptôme visible. C'est la
-- forme la plus aboutie du défaut que ce dépôt combat : une garantie affichée,
-- un mécanisme complet, et rien qui fonctionne.
--
-- -----------------------------------------------------------------------------
-- SET NULL, ET JAMAIS CASCADE
-- -----------------------------------------------------------------------------
--
-- Les lignes qui pointent doivent SURVIVRE à l'effacement du pilote : une
-- journée de circuit, un paiement, une inscription, un rapport d'incident sont
-- des traces commerciales, comptables ou de sécurité. C'est le même
-- raisonnement qui a fait garder `payments` depuis le début.
--
-- Elles perdent un pointeur vers un objet supprimé, rien de plus. Les six
-- colonnes concernées étaient déjà nullables — vérifié avant d'y toucher.
--
-- CASCADE aurait effacé une inscription payée parce que le pilote a supprimé
-- son compte. Ce n'est pas ce que demande l'article 17.
--
-- -----------------------------------------------------------------------------
-- VÉRIFIÉ, PAS ANNONCÉ
-- -----------------------------------------------------------------------------
--
-- Après application, la purge a été exécutée sur un compte RÉEL portant une
-- inscription ET une candidature fondateur rattachée — le cas exact qui était
-- impossible — dans une transaction terminée par un `raise` d'annulation.
--
--   Elle est allée au bout sans erreur.
--   Intégrité recontrôlée juste après : 14 comptes, 18 séances, 6 véhicules,
--   1 inscription, 9 documents, 0 ligne d'essai, 0 compte anonymisé.
--
-- Ce qu'il faut en retenir : **une purge se prouve en l'exécutant.** Aucune
-- relecture, aucun test unitaire, aucun audit de code ne trouve une contrainte
-- qui refuse.
--
-- =============================================================================

alter table public.registrations drop constraint registrations_vehicle_id_fkey;
alter table public.registrations add constraint registrations_vehicle_id_fkey
  foreign key (vehicle_id) references public.vehicles(id) on delete set null;

alter table public.sessions drop constraint sessions_circuit_id_fkey;
alter table public.sessions add constraint sessions_circuit_id_fkey
  foreign key (circuit_id) references public.circuits(id) on delete set null;

alter table public.eligibility_items drop constraint eligibility_items_document_id_fkey;
alter table public.eligibility_items add constraint eligibility_items_document_id_fkey
  foreign key (document_id) references public.documents(id) on delete set null;

alter table public.payments drop constraint payments_heritage_pack_id_fkey;
alter table public.payments add constraint payments_heritage_pack_id_fkey
  foreign key (heritage_pack_id) references public.heritage_packs(id) on delete set null;

alter table public.registrations drop constraint registrations_heritage_pack_id_fkey;
alter table public.registrations add constraint registrations_heritage_pack_id_fkey
  foreign key (heritage_pack_id) references public.heritage_packs(id) on delete set null;

alter table public.incident_reports drop constraint incident_reports_session_id_fkey;
alter table public.incident_reports add constraint incident_reports_session_id_fkey
  foreign key (session_id) references public.telemetry_sessions(id) on delete set null;

-- -----------------------------------------------------------------------------
-- LE SEPTIÈME VERROU, D'UNE AUTRE FAMILLE
-- -----------------------------------------------------------------------------
--
-- Le bras `founding_members` de la purge annule trois colonnes qui étaient
-- NOT NULL : il levait 23502 dès qu'une candidature serait rattachée à un
-- compte. La candidature unique de production porte déjà l'adresse d'un compte
-- existant — le défaut était à un rattachement d'être armé.
--
-- Ce point-là était CONNU : il avait été relevé le matin même et déposé en
-- proposition non appliquée, pendant que le bras qui le déclenche restait en
-- production. Documenter une bombe ne la désamorce pas.
alter table public.founding_members alter column prenom drop not null;
alter table public.founding_members alter column nom drop not null;
alter table public.founding_members alter column email drop not null;
