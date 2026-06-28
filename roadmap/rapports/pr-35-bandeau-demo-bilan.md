# Rapport — PR-20b · Bandeau « mode démo » du Bilan

> Backlog V6, jalon M2. Doctrine d'honnêteté (test_alpha/02 §5.2). Zéro schéma
> (dérivé de `event_type`).

## Ce que j'ai fait
- **`src/services/eventContextLogic.ts`** (pur) — `demoBannerForEventType(eventType)` :
  renvoie le message d'honnêteté pour un événement HORS circuit
  (balade_decouverte / test_alpha / partenaire / corporate), `null` pour `session`
  ou sans événement. + 2 tests.
- **`src/services/eventsService.ts`** — `getEventLite(eventId)` (lecture légère ;
  `internal_notes` jamais sélectionné).
- **`src/types/telemetry.ts`** — `TelemetrySession.event_id`.
- **`app/(app)/bilan.tsx`** — si la capture relève d'un événement non-circuit, un
  bandeau sobre (ni or ni rouge) prévient : « Cet événement n'est pas une session de
  circuit. Les analyses … sont expérimentales … Vos données sont préservées. »

## Doctrine
L'app ne ment pas sur ce qu'elle est : sur données de campagne, les marges calibrées
circuit ne sont pas comparables — on le DIT. Dérivé de `event_type`, aucune colonne
`context` (le V6 le proposait ; la dérivation est plus propre).

## Gates
- `format` OK · `tsc 0` · `eslint 0` · `jest 892` (+2) · scan doctrinal vert.

## Suite (M2)
PR-21 admin Événements (liste/création/détail) · PR-22 check-in QR · PR-27 Pass OXV.
