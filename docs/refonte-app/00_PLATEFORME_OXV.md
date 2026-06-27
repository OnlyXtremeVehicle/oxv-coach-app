# OXV Platform — Cadrage directeur

> Document maître. Lis-le avant tout le reste de `docs/refonte-app/`.
> Statut : **cadrage en cours** (avant code). Décisions verrouillées ci-dessous.

---

## 1. Le virage

On passe de **OXV Mirror** (app de bilan pilote) à **OXV Platform** (écosystème).

**Phrase nord** :
> Le pilote voit l'essentiel. Le coach voit la profondeur. L'admin voit le système. Le partenaire voit les opportunités.

**Principe directeur** : simple en surface, puissant en profondeur. Si l'utilisateur ne comprend pas quoi faire en 5 secondes, l'écran est trop compliqué.

On ne refait **pas** le moteur (BLE, parser UBX, services Supabase, stores Zustand). On **range, simplifie, fiabilise, polit**, puis on **étend** par couches.

---

## 2. Quatre comptes

| Compte | Existe ? | Rôle |
|---|---|---|
| **Pilote** | `(app)` — oui | Préparer, rouler, comprendre, évoluer, profiter du club |
| **Coach** | `(coach)` — oui (riche) | Lire les sessions affiliées, annoter, programmer, développer son activité |
| **Admin** | `(admin)` — oui (riche) | Opérations événement, équipements, qualité data, coachs, partenaires |
| **Partenaire** | **net-neuf** | Offres, leads, réservations, performance autour des événements |

`SpaceSwitcher` gère déjà la bascule entre espaces.

---

## 3. Cinq piliers produit

1. **Data piste détaillée** (après session uniquement — jamais en piste)
2. **Développement pilote** (passeport, cycles, carnet, signature)
3. **Coaching affilié** (consentement, lecture, annotation, programmes)
4. **Opérations OXV** (événements, équipements, qualité data)
5. **Écosystème partenaires** (annuaire → offres → leads → performance)

---

## 4. Navigation Pilote — VERROUILLÉE

Barre d'onglets à 5 zones (l'or est INTERDIT sur la nav) :

```
Paddock · Session · Bilan · Progression · Club
```

**Compte** = icône en haut à droite (profil, réglages, données, légal). Le compte ne prend jamais une place principale ; le social/club ne passe jamais devant le Bilan.

Choix retenu = **synthèse** : on garde Bilan + Progression (doctrine « Bilan = cœur »), on élève **Club** (coach affilié + partenaires + communauté) que l'on veut mettre en avant, et Compte passe en icône.

Détail des zones : `01_ORGANISATION_PRODUIT.md`. Audit route par route : `02_AUDIT_ROUTES.md`.

---

## 5. Canon design — NOUVELLE LOI

Le spec sombre premium cockpit (fond `#050505`, pas d'arcade, instrument 270°, Geist + Geist Mono + **Instrument Serif**) devient la référence unique. On y **aligne toute l'app** : `src/theme/v2.ts` est réajusté aux valeurs exactes, Instrument Serif est ajouté, le look « gaming » actuel est tempéré vers ce sobre en **PR 7**.

Détail au token près : `04_DESIGN_CANON.md`.

Rappels non négociables : **or = donnée uniquement** · **rouge = coach/REC** · un seul chiffre dominant/écran · silence total en piste · vouvoiement · pas d'emoji.

---

## 6. Garde-fous de travail

- TypeScript strict, pas de `any`, hooks fonctionnels, pas de localStorage/sessionStorage.
- **Aucune** modification de schéma Supabase / migration sans accord explicite de Gabin.
- Travail **par PR, une à la fois**, rapport dans `roadmap/rapports/`, validation entre chaque.
- En cas de doute : simple et conforme à la doctrine, on pose la question, pas de choix arbitraire.

---

## 7. Roadmap des PR (surface — zéro schéma)

| PR | Objet | Risque |
|---|---|---|
| 1 | Navigation 5 zones (tabs) + `appMap.ts` | faible/moyen |
| 2 | Paddock contextuel | faible/moyen |
| 3 | Bilan à divulgation progressive | moyen |
| 4 | Flux Session (silence en piste) | moyen/élevé (BLE) |
| 5 | Progression / Développement | moyen |
| 6 | Compte / Club | faible/moyen |
| 7 | Design polish (canon + Instrument Serif + v2 réaligné) | moyen |

Ensuite seulement, les **créations profondes** (Data Lab assemblé, Passeport, Garage, Cycles, Carnet, Pass OXV, Coach Notes overlay, **espace Partenaire**…), chacune avec sa migration **soumise à accord**.

---

## 8. Dossier de cadrage — ce qui reste à écrire

Liste issue de la revue « ce qui manque encore ». Chaque ligne = un document à produire avant la couche de code qu'il débloque.

| # | Document | Débloque | Statut |
|---|---|---|---|
| — | `00_PLATEFORME_OXV.md` (ce fichier) | tout | ✅ |
| — | `01_ORGANISATION_PRODUIT.md` | PR 1–6 | ✅ |
| — | `02_AUDIT_ROUTES.md` | PR 1, migration | ✅ |
| — | `03_MVP_SCOPE.md` (V1/V1.5/V2) | priorisation | ✅ |
| — | `04_DESIGN_CANON.md` | PR 7, tous | ✅ |
| 1 | `05_ROLES_PERMISSIONS.md` (matrice RLS par rôle) | espaces, partenaire | ⬜ |
| 2 | `06_USER_JOURNEYS.md` (pilote/coach/admin/partenaire) | tout | ⬜ |
| 3 | `07_DATA_POLICY.md` (quelle data, à qui, quand) | Data Lab, RLS | ⬜ |
| 4 | `08_WIREFRAMES_ECRANS.md` (objectif/data/actions/états par écran) | chaque PR | ⬜ |
| 5 | `09_UX_COPY_LIBRARY.md` (boutons, vides, erreurs, coach, bilan) | chaque PR | ⬜ |
| 6 | `10_PLAN_MIGRATION.md` (sans casse, doublons) | PR 1–6 | ⬜ |
| 7 | `11_DEV_TICKETS.md` (tickets prêts à coder) | exécution | ⬜ |
| 8 | `12_ACCEPTANCE_CRITERIA.md` (« réussi si… ») | revue | ⬜ |
| 9 | `13_QA_TEST_PLAN.md` (UX/BLE/offline/RLS/RGPD) | alpha | ⬜ |
| 10 | `14_NOTIFICATIONS.md` (avant/après/J+1/jamais en piste) | PR 4–6 | ⬜ |
| 11 | `15_MEDIA_ET_OXV_MOMENT.md` (galerie, carte partageable) | Club, médias | ⬜ |
| 12 | `16_MODELE_ECONOMIQUE.md` (où OXV gagne) | priorisation | ⬜ |
| 13 | `17_JURIDIQUE_COACH_DATA.md` (consentement, responsabilité) | coach, légal | ⬜ |
| 14 | `18_APP_VS_WEB.md` (mobile vs portail web admin/partenaire) | architecture | ⬜ |

Reco app↔web (à graver dans le #18) : **app mobile** = expérience pilote terrain + lecture coach rapide ; **web** = opérations lourdes + partenaires + business ; **site public** = acquisition + réservation + vitrine. Ne pas tout mettre dans le mobile.
