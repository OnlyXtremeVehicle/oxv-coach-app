# Rapport — PR-38 · B2B Event Report

> Backlog V6, jalon M2. Décision Gabin : **table `b2b_event_reports`** (admin
> génère un rapport figé partagé). Schéma STOP appliqué (DDL montré).

## Pourquoi une table (et pas un agrégat lu)
Le partenaire **ne peut pas lire `event_registrations`** (privacy, RLS). Donc l'admin
SNAPSHOTTE les compteurs au moment de la génération ; le partenaire ne voit que
l'**agrégat figé**, et uniquement quand `status = 'shared'`. Aucune donnée pilote
individuelle ne transite jamais.

## Schéma (migration `0023`)
- **`b2b_event_reports`** : event_id, partner_id, `registered_count`, `checked_in_count`
  (snapshot), `media_summary`, `conclusion`, `status` (draft/shared), generated_by/at,
  unique(event_id, partner_id), trigger updated_at. RLS : admin gère ; partenaire voit
  son rapport **SI shared** (`owns_partner_account` + status).

## App
- **`src/services/b2bReportService.ts`** — `getReport`/`generateReport` (snapshot compteurs
  via reads admin)/`updateReport` (éditorial + statut) ; partenaire `listMySharedReports`.
- **`app/(admin)/b2b-rapport.tsx`** — éditeur : compteurs figés, « Régénérer », média +
  conclusion, statut Brouillon/Partagé. Atteint depuis le détail événement (par partenaire).
- **`app/(partner)/rapports.tsx`** — « Mes rapports » : participation + temps forts +
  conclusion. Entrée depuis le dashboard partenaire.

## Tests RLS
`src/__tests__/rls/b2bReportRLS.test.ts` : le partenaire voit son rapport partagé, pas un
brouillon ; un autre partenaire ne voit rien. Skippés sans creds. Types régénérés (+80/-0).

## Gates
- `format` OK · `tsc 0` · `eslint 0` · `jest` vert · scan doctrinal vert (129 .tsx).

## Suite
**QR** (dépendance react-native-qrcode-svg + expo-camera) → Pass OXV complet + scan check-in.
Build device au 1er juillet pour tout valider.
