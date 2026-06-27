# Audit des routes existantes

> Inventaire réel de `app/(app)/*` (espace Pilote) → zone cible + décision.
> Décisions : **GARDER** · **RANGER** (sous une zone, accès au toucher) · **FUSIONNER** (doublon) · **MASQUER** (prod) · **REPORTER** (V1.5+).
> Principe : on ne supprime rien en PR 1. On range, puis on déduplique (cf. `10_PLAN_MIGRATION.md`).

## Pilote — `app/(app)`

| Route | Zone cible | Décision | Note |
|---|---|---|---|
| `index` | Paddock | GARDER | Hub d'accueil, simplifié en PR 2 |
| `paddock` | Paddock | FUSIONNER | Réconcilier avec `index` (un seul Paddock) |
| `equipement` | Session | GARDER | Étape 1 du flux |
| `placement` | Session | GARDER | Étape 2 |
| `roulage` | Session | GARDER | État « en piste » (UI éteinte) |
| `entre-runs` | Session | GARDER | Inter-runs |
| `pilotage-fini` | Session | GARDER | Retour stands |
| `bilan-pret` | Session→Bilan | GARDER | Transition vers Bilan |
| `bilan` | Bilan | GARDER | **Cœur de l'app** |
| `carte` | Bilan | RANGER | Sous Data Lab |
| `virage` | Bilan | RANGER | Data Lab — Virage Explorer |
| `virage-comparer` | Bilan | RANGER | Data Lab — comparaison virages |
| `tours` | Bilan | RANGER | Data Lab — tour par tour |
| `heatmap` | Bilan | RANGER | Data Lab — carte de chaleur |
| `replay` | Bilan | RANGER | Data Lab — replay synchronisé |
| `telemetry` | Bilan | RANGER | Data Lab — data brute lisible |
| `insights` | Bilan | RANGER | Possible FUSION avec bilan (revue) |
| `insight/[reading]` | Bilan | RANGER | Lecture d'insight unitaire |
| `debrief` | Bilan | GARDER | Débrief J+1 |
| `debrief-presentiel` | Bilan/Coach | GARDER | Débrief en présentiel coach |
| `prochaine-fois` | Bilan | RANGER | « À creuser la prochaine fois » |
| `progression` | Progression | GARDER | Vue globale |
| `signature` | Progression | RANGER | → Développement |
| `regularite` | Progression | RANGER | « Indice de constance » |
| `comparateur` | Progression | GARDER | Comparateur **personnel** |
| `stats` | Progression | FUSIONNER | Avec `progression` (revue) |
| `objectifs` | Progression | RANGER | → Cycles (Développement) |
| `roulages` | Progression | RANGER | Historique / carnet de sessions |
| `cote-a-cote/[friendId]` | Club | RANGER | Comparaison **consentie** entre amis |
| `mon-coach` | Club | GARDER | Coach affilié — **mis en avant** |
| `coachs` | Club | GARDER | Découverte coachs (marketplace) |
| `coach/[id]` | Club | GARDER | Fiche coach |
| `mes-demandes` | Club | GARDER | Demandes de coaching |
| `amis` | Club | GARDER | Communauté |
| `social` | Club | FUSIONNER | Avec `amis` / Club |
| `social-carte` | Club | FUSIONNER | Avec `carte-oxv` (doublon carte) |
| `carte-oxv` | Club | GARDER | **La carte OXV** (lieux/partenaires/événements) |
| `lieux` | Club | FUSIONNER | Avec `carte-oxv` |
| `circuits` | Bilan/Club | GARDER | Liste circuits |
| `circuit/[id]` | Bilan/Club | GARDER | Fiche circuit |
| `belle-route` | Club | REPORTER | Belles routes (V1.5) |
| `mes-routes` | Club | REPORTER | V1.5 |
| `creer-trace` | Club/Admin | REPORTER | V1.5 |
| `partage` | Bilan/Club | GARDER | Carte de partage → « OXV Moment » |
| `carte-trophee` | Bilan | GARDER | Trophée partageable → « OXV Moment » |
| `share/[token]` | (public) | GARDER | Page de partage publique |
| `profil` | Compte | GARDER | Profil pilote (éditable) |
| `settings` | Compte | GARDER | Réglages |
| `notifications` | Compte | GARDER | Centre de notifications |
| `donnees-securite` | Compte | GARDER | Confidentialité & données (RGPD) |
| `legal/[doc]` | Compte | GARDER | Documents légaux |
| `debug-capture` | Système | MASQUER | Hors prod |
| `debug-circuit` | Système | MASQUER | Hors prod |

## Doublons à résoudre (cf. `10_PLAN_MIGRATION.md`)

- `index` vs `paddock` → un seul Paddock.
- `bilan` vs `insights` vs `stats` vs `heatmap` → Bilan + sous-vues Data Lab, pas d'entrées parallèles.
- `carte-oxv` vs `social-carte` vs `lieux` → une seule **La carte OXV**.
- `social` vs `amis` → un seul espace communauté dans Club.
- `coachs` vs `mon-coach` → découverte vs affiliation (rôles distincts, à garder séparés mais cohérents).
- `roulages` vs `roulage` → historique (pluriel) ≠ étape de session (singulier).

## Autres espaces (séparés, déjà riches)

- **Coach** `app/(coach)` : index, pilote/[id], lecture, annoter, comparer, comparer-pilotes, contexte, demandes, disponibilites, gabarits, priorites, reperes, repere/[index], roulages, business, ar, profil. → à détailler dans `08_WIREFRAMES_ECRANS.md`.
- **Admin** `app/(admin)` : index, operations (preparation/en-cours), analytique, circuit, coachs, coachs/[id], sessions-media, routes-certification, points-carte. → manque **qualité data**, **incidents**, **partenaires (validation)**, **reporting**.
- **Partenaire** `app/(partner)` : **n'existe pas** — net-neuf (V1 annuaire, V1.5 leads/offres).

## Écrans net-neufs (couches profondes — après PR 1–7)

Pilote : `data-lab` (assemblage), `passeport`, `garage`, `cycles`, `carnet`, `pass-oxv`, hubs `session`/`compte`/`club`.
Coach : overlay d'annotation sur la data, file de lecture priorisée.
Admin : `qualite-data`, `incidents`, `partenaires`, `reporting`.
Partenaire : tout l'espace (`index`, `offres`, `leads`, `reservations`, `performance`, `profil`).
