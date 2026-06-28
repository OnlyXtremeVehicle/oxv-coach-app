# PR-44 — Garage enrichi : journal de réglages (M3)

**Milestone** : M3 (innovation V4) · **Date** : 2026-06-28 · **Branche** : `main`

## Intention

Relier la donnée au matériel. Le pilote (et le pilote pro) tient un **journal de
réglages** par véhicule : pneus, freins, pressions départ/retour, notes,
horodaté. C'est une mémoire matérielle, pas un conseil : l'app **consigne des
faits**, ne juge jamais un réglage (miroir).

## Schéma (approuvé avant migration, comme events/b2b)

Migration **0024_vehicle_setups.sql** (appliquée en prod) :

- Table `vehicle_setups` : `vehicle_id` → `vehicles` (cascade), `session_id` →
  `telemetry_sessions` (set null, lien optionnel), `tires`, `brakes`,
  `pressure_front_start/rear_start/front_end/rear_end` `numeric(3,1)` (bar),
  `notes`, `recorded_at`, `created_at`.
- Index `idx_vehicle_setups_vehicle (vehicle_id, recorded_at desc)`.
- RLS `vehicle_setups_owner_all` (for all) : **propriété dérivée du véhicule** —
  `exists(select 1 from vehicles v where v.id = vehicle_id and v.user_id =
  auth.uid())` en `using` **et** `with check`. Aucune table existante touchée.
- `vehicles` existait déjà (own-row) — non modifiée.

`database.types.ts` régénéré (superset propre +67/-0).

## Ce que j'ai fait

- **Service** `src/services/garageService.ts` : `listMyVehicles`, `getVehicle`,
  `addVehicle` (marque + modèle requis, `user_id = auth uid`), `listSetups`,
  `addSetup`. Mapping snake→camel, pressions en bar.
- **Écran** `app/(app)/garage.tsx` : liste des véhicules + formulaire d'ajout
  inline (marque/modèle/année/couleur), `EmptyState`, tap → fiche véhicule.
- **Écran** `app/(app)/garage/[vehicleId].tsx` : en-tête véhicule + journal
  (historique antéchronologique) + formulaire « Consigner un réglage »
  (pneus/freins/4 pressions/notes, clavier décimal, parse virgule→point).
- **Navigation** : `garage` ajouté à `appMap.ts` (`ROUTE_TO_ZONE` → zone
  `compte`) — le test de cohérence appMap passe (pas d'orpheline).
- **Points d'entrée** : ligne « Garage » dans Réglages (section Compte) et carte
  « Mon garage » dans le hub Pilote pro (note mise à jour).
- **Tests RLS** `src/__tests__/rls/vehicleSetupsRLS.test.ts` : 1 positif
  (propriétaire insère + relit), 2 négatifs (un autre pilote ne voit rien ; ne
  peut pas insérer sur un véhicule étranger → WITH CHECK).

## Vérifié

- `tsc --noEmit` : clean.
- `eslint` / `prettier --write` / `format:check` : clean.
- `npm run doctrine` : 132 fichiers, aucun verbe interdit.
- `npx jest` : 899 passed, 0 échec (94 skipped — RLS sans env de test).
  `appMap.test.ts` vert (route garage mappée).

## Doctrine

- Aucun jugement sur les réglages (consignation factuelle).
- Or = donnée (pressions), pas de décor. Vouvoiement, pas d'emoji, phrases
  courtes. Pressions = un fait par champ, pas d'indicateur dominant détourné.

## Reste / suite M3

- Validation device + scan QR caméra : reportée au 1er juillet (quota EAS).
- Tranches M3 à venir (schéma → STOP approbation) : assistant IA coach,
  programmes adaptatifs, carnet pilote, jumeau numérique, modération.
