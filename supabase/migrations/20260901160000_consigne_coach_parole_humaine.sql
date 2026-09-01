-- LA CONSIGNE EST LA PAROLE DU COACH, PAS CELLE DE L'APPLICATION.
--
-- Le filtre doctrinal pose il y a quelques heures sur `coach_consignes` etait
-- FAUX, et c'est le depot lui-meme qui le dit — `CoachBand.tsx`, en tete de
-- fichier, depuis bien avant cette table :
--
--   « SEUL espace prescriptif de l'application. Partout ailleurs, l'app est un
--     miroir : elle enonce des faits, jamais des consignes. Ici, et ici
--     seulement, le coach (humain, BPJEPS) a droit aux verbes d'ordre et a la
--     causalite ("retardez le freinage", "vous perdez 0,3 s parce que...").
--     Le marquage rouge + "De votre coach" signale sans ambiguite que ce qui
--     suit vient d'un tiers et n'est pas une lecture automatique. »
--
-- La retenue doctrinale protege l'APPLICATION : elle l'empeche de conseiller,
-- et c'est elle qui tient OXV hors du champ de l'enseignement du pilotage. Un
-- coach diplome, lui, EXERCE ce droit — l'application ne fait que porter sa
-- parole, attribuee.
--
-- CE QUI REMPLACE LE FILTRE : l'ATTRIBUTION. Une consigne ne doit jamais etre
-- rendue dans la voix de l'application. Elle se lit dans la bande coach,
-- marquee, nommee. Cela ne se contraint pas en SQL — c'est un contrat de
-- surface, tenu cote application.
--
-- CE QUI NE CHANGE PAS : `coach_annotation_doctrine_guard` reste. Une NOTE
-- s'affiche sur les feuilles de donnees du pilote, ou la regle « aucune
-- consigne » vaut ; une CONSIGNE s'affiche dans la bande coach, ou elle ne
-- vaut pas. Deux regimes, deux surfaces — ce n'est pas une incoherence, c'est
-- la ligne que `CoachBand` trace depuis le debut.

drop trigger if exists trg_coach_consigne_doctrine on public.coach_consignes;
drop function if exists public.coach_consigne_doctrine_guard();

comment on table public.coach_consignes is
  'Consigne du coach : ce que le pilote suivra au prochain run. PAROLE D''UN TIERS — le coach (humain, BPJEPS) a droit aux verbes d''ordre et a la causalite, contrairement a l''application. Se rend dans la bande coach, attribuee, jamais dans la voix de l''app. Source des fiches P22, P35, P37, P39, P40, P43, P44.';
