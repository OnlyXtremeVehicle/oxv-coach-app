-- LE CHECK PORTAIT UNE TOPOLOGIE, PAS UNE REGLE.
--
-- `segment_index BETWEEN 1 AND 7` decrivait Haute Saintonge et ses sept
-- secteurs. La contrainte a survecu au circuit : Bouteville en compte douze,
-- Le Mans quatorze officiels, Albi neuf ou quinze selon la configuration. Les
-- virages 8 a 12 d'une seance reelle etaient refuses a l'insertion, et la
-- table est restee vide.
--
-- L'index reste positif — c'est la seule regle qui vaille pour tout circuit —
-- et un plafond large subsiste comme garde-fou contre une boucle folle, pas
-- comme description d'un trace.
--
-- Table vide au moment de la migration (verifie : 0 ligne), donc aucune
-- donnee a reprendre.
alter table public.app_segment_analyses
  drop constraint if exists app_segment_analyses_segment_index_check;

alter table public.app_segment_analyses
  add constraint app_segment_analyses_segment_index_check
  check (segment_index >= 1 and segment_index <= 200);

comment on constraint app_segment_analyses_segment_index_check
  on public.app_segment_analyses is
  'Index de secteur : positif, borne haute large. Ne decrit aucun circuit — la borne de 7 tenait de Haute Saintonge et refusait les virages 8 a 12 de Bouteville (01/09/2026).';
