# Schéma de navigation M7 — cartographie actuelle → cible (PROPOSITION à valider)

> Principe (prompt v2, 7.1) : **une fonctionnalité = un chemin évident**,
> hub → section → détail, jamais plus profond. RIEN n'est déplacé avant
> validation de ce document par le fondateur.

## Constat (audit M0 + appMap)

L'espace pilote compte ~74 écrans routés mais la structure EXISTE déjà :
`src/lib/appMap.ts` (source unique, testée) répartit tout en 5 zones + Compte,
et le Data Lab assemble déjà les 8 vues d'analyse. Le problème n'est pas
l'absence de schéma — c'est (a) des entrées redondantes vers les mêmes vues,
(b) des écrans debug routés en prod, (c) des orphelins de zone Bilan
accessibles hors Data Lab.

## Cible par rôle

### Pilote (5 onglets verrouillés + Compte icône — INCHANGÉ)
| Hub / section | Contenu cible | Écart vs aujourd'hui |
|---------------|---------------|----------------------|
| **Paddock** (hub) | action contextuelle par état (fait, `paddockHeroLogic`) + dernier bilan/QDI + statut boîtier | ajouter les 2 cartes de rappel (bilan récent, Mon boîtier) |
| **Session** | flux capture linéaire préparation→équipement→placement→roulage→fin (fait) | rien |
| **Bilan** | bilan → Data Lab (8 vues + Vue unifiée) → débrief/trace | `conditions`, `partage`, `carte-trophee` restent des sous-vues du bilan (déjà le cas) |
| **Progression** | **signature = maison du QDI** (fait M1) → régularité/comparateur/stats/objectifs/carnet/passeport | `empreinte-saison`, `carte-licence`, `roulages` inchangés |
| **Club** | coachs/amis/carte OXV/partenaires/routes (fait) | rien |
| **Compte** | profil/settings/Mon boîtier/garage/consentements/support/légal (fait) | rien |

### Coach / Partenaire / Admin
Hubs déjà réels (audit M0 : dashboards câblés). Cible = inchangée, aucune
réorganisation nécessaire.

## Déplacements PROPOSÉS (à valider, aucun fait)

1. **Archiver hors prod** : `debug-capture.tsx`, `debug-circuit.tsx` (déjà
   `__DEV__`-only ; proposition = les déplacer sous `app/(dev)/` non routé en
   release, ou les laisser — coût zéro, choix cosmétique).
2. **Dédoublonner les entrées télémétrie** : `tours`, `virage`, `telemetry`,
   `heatmap`, `replay` ne seraient plus listés dans des menus intermédiaires
   hors Data Lab (aucun fichier déplacé, seulement des liens retirés là où ils
   doublonnent). À inventorier lien par lien en cas de GO.
3. **`trace.tsx` (Trace du jour)** : reste intercalé post-analyse ET accessible
   depuis Bilan (déjà le cas) — pas de changement.

## Ce que ce schéma NE fait PAS
- Pas de suppression d'écran, pas de renommage de route (les deep links et
  l'appMap testée restent stables).
- Pas de refonte des onglets (décision verrouillée : Paddock · Session ·
  Bilan · Progression · Club + Compte icône).

## Décision attendue du fondateur
- GO / NO-GO sur les déplacements 1 et 2 (le 3 est un constat).
- Si GO : exécution en un lot dédié, avec l'inventaire lien-par-lien AVANT.
