# Closeout — Jalon M1 (Alpha sécurisée)

> Backlog V6. M1 = verrouiller la doctrine au runtime + écrans P1 indispensables.
> État : **périmètre codable terminé et poussé** (origin `main`). Seuls restes =
> une décision juridique et le build device (bloqué quota EAS jusqu'au 1er juil.).

## Livré et poussé
| PR | Objet | Commit |
|----|-------|--------|
| 01–05 | Filtre IA branché (débrief, focusCorner, source unique, rendu Bilan) + scanner copie réparé | `0ed539e`…`f7e3fc0`, `14b0ba6` |
| 08 | Honnêteté du lien BLE en roulage (LIEN INTERROMPU/PERDU) | `13b4919` |
| 09–11 | **Support** : schéma `0020` + RLS testées + écrans pilote & admin | `4f685e4`/`2faf1a3`/`8dee243` |
| 12 | **Admin Utilisateurs** : rôle audité, suspension, consentements | `68535cb` |
| 13 | Matrice RLS rôle × télémétrie (règle cardinale §148) | `afecac6` |
| 14 | Cohérence appMap ↔ routes (+ fix orphelines support/compte) | `bc8ad18` |

## Vérifiés déjà-satisfaits (aucun diff fabriqué)
- **PR-05b** — toggle « Débrief IA » + divulgation hors-UE + coupe-circuit edge présents ;
  seul l'opt-in *explicite* (défaut OFF) reste une **décision juridique** de Gabin.
- **PR-06** — silence en piste : le handler coupe déjà tout en S6 ; pas de push distant en V1.
- **PR-07** — EmptyState couvert (29 écrans + replis honnêtes / catalogues statiques).
- **PR-15** — consentement coach : `mon-coach.tsx` est un consentement RGPD **binaire**
  (Switch) + **portée** séparée (niveau), explicite, **défaut le plus restrictif**,
  révocable à tout moment avec effet immédiat, divulgation « ce que le coach voit ».
  Le modèle EST déjà aligné ; pas de désalignement à corriger.
- **PR-16** — export portabilité (11 tables, frames sur-demande RGPD-OK) + suppression J+30.
- **PR-17** — Plausible : domaine `oxvehicle.fr` dans `eas.json` + consommé par `analyticsService`.

## Restes hors-ressort
- **PR-18 / PR-19** (build preview iOS + validation terrain) : **BLOQUÉS** — quota EAS gratuit
  épuisé, reset le **1er juillet 2026**. À relancer `npm run build:ios:preview` à ce moment
  pour valider M1 sur device (Charente/tours, Support, Utilisateurs, garde-fous).
- **PR-05b opt-in / PR-15 fond juridique** : arbitrage avocat (ne pas toucher au juridique sans accord).

## État technique
`tsc 0 · eslint 0 · jest 886 · scan doctrinal vert · CI verte`. Migrations `0020` appliquées
en prod. Types Supabase régénérés.

## Prochain gate
**M2 — socle `events`** (STOP-schéma, shape complet `test_alpha/02`) : pivot public-ready
(Pass OXV, check-in, offres/leads liés événement, B2B Report).
