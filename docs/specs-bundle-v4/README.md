# OXV Mirror — Dossier de specifications

**Destinataire : Claude Code.** Ce dossier cadre la reconstruction de l'application mobile OXV Mirror. Il ne contient pas de pixel-perfect : il decrit le layout, les composants, les donnees affichees et les regles doctrinales de chaque ecran. Tout choix visuel fin reste a l'execution, dans le respect de la charte (voir `00_CLAUDE.md`).

## Comment lire ce dossier

1. **Lire `00_CLAUDE.md` en entier d'abord.** C'est le contrat. Il porte la doctrine, la charte, la stack, le point de depart (repo Expo existant) et les regles de code non negociables.
2. Lire `01_doctrine_et_composants.md` : la doctrine miroir appliquee, et la bibliotheque de composants reutilisables referencee par toutes les specs d'ecran.
3. Les specs d'ecran sont rangees par bloc dans `specs/`. Chaque fichier couvre un bloc fonctionnel complet.

## Index des blocs

| Fichier | Bloc | Ecrans |
|---|---|---|
| `specs/10_onboarding.md` | Onboarding | 3 |
| `specs/20_coeur_restitution.md` | Coeur — restitution post-session | 8 |
| `specs/30_detail_data.md` | Detail data (l'arme concurrentielle) | 4 |
| `specs/40_sessions_historique.md` | Sessions & historique | 3 |
| `specs/50_circuits_traces.md` | Circuits & traces | 3 |
| `specs/60_communaute.md` | Communaute — cercle filtre | 3 |
| `specs/70_identite_avatar.md` | Identite pilote / Avatar | 3 |
| `specs/80_garage.md` | Garage | 3 |
| `specs/90_fonctionnalites_neuves.md` | Fonctionnalites neuves | 4 |
| `specs/A0_compte.md` | Compte | 3 |
| `specs/B0_etats_limites.md` | Etats limites | 2 |
| `specs/C0_coach.md` | Coach (SaaS coachs agrees) | 5 |
| `specs/D0_map_partenaires.md` | Map & ecosysteme partenaires | 4 |
| `specs/E0_ar_coach.md` | Vue AR coach (lunettes, preview) | 2 |

Total : ~50 ecrans repartis en 14 blocs.

## Regle d'or

> L'app est un miroir. Elle montre. Elle ne dirige pas.
> Si une fonction pourrait dire au pilote quoi faire, elle est hors doctrine.

En cas de doute pendant le developpement : repointer vers `00_CLAUDE.md`, section « Doctrine ». La doctrine prime sur toute autre consideration produit.
