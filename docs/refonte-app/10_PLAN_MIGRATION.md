# Plan de migration sans casse

> Comment passer à la nav 5 zones (`Paddock · Session · Bilan · Progression · Club`) **sans casser un seul écran existant**.
> Réf. : nav verrouillée `00_PLATEFORME_OXV.md §4`, roadmap PR 1–7 `§7`, audit route par route `02_AUDIT_ROUTES.md`.
> Statut : **cadrage avant code**. Aucun schéma Supabase touché ici — la migration est **100 % surface** (routing, navigation, redirections).

---

## 0. Principe directeur

**On ne supprime rien tant qu'un doublon vit encore.** La règle est l'inverse d'un refactor classique : on **ajoute** la nouvelle structure, on **redirige** vers elle, on **observe** qu'elle tient, et seulement alors on **retire** l'ancienne. À chaque étape, toutes les routes `app/(app)/*` actuelles restent résolvables — un deep link, un `router.push` oublié ou un favori ne doit jamais tomber sur un écran blanc.

État de départ réel (vérifié dans le code) :
- `app/(app)/_layout.tsx` est un **`Stack`** Expo Router (pas de `Tabs`), animation `fade`, redirection auth si `unauthenticated`.
- Le hub d'accueil est **`index.tsx`** (« Hub central, 3 modes »), pas `paddock.tsx`.
- `paddock.tsx` est en réalité l'ancien écran #07 « Vous y êtes » (arrivée circuit), titré `PADDOCK` dans son `AppBar` — **homonyme de zone, pas hub**. Ce point conditionne la fusion `index` vs `paddock` (cf. §3).
- `SpaceSwitcher` (importé dans `index.tsx`, `current="pilot"`) gère déjà la bascule inter-espaces. La migration ne le touche pas.
- `src/services/appMap.ts` **n'existe pas encore** : il est créé en PR 1. C'est la table de vérité du routage (zone → route canonique + alias).

---

## 1. Étapes de migration (ordre strict)

Six étapes, alignées sur PR 1–7. Chaque étape est livrable seule et réversible.

| # | Étape | PR | Ce qu'on fait | Ce qu'on NE fait PAS |
|---|---|---|---|---|
| E1 | **Ne rien supprimer** | 1 | Geler l'inventaire. Aucune route retirée, aucun fichier déplacé. | Renommer / effacer un `*.tsx` |
| E2 | **Créer hubs + tabs** | 1 | Introduire la `Tabs` (5 zones) ; créer les hubs de zone ; créer `appMap.ts` (route canonique par zone + alias connus). | Brancher les redirections définitives |
| E3 | **Rediriger progressivement** | 2–6 | Au fil de chaque PR de zone, les anciens écrans deviennent accessibles **au toucher depuis le hub** (rangés). Les doublons pointent vers la cible canonique via un `<Redirect>`. | Couper l'accès direct par URL |
| E4 | **Masquer les anciens liens** | 2–6 | Retirer les **entrées de menu / boutons** vers les routes rangées ou dédupliquées. La route reste vivante, seul le lien d'UI disparaît. | Supprimer la route elle-même |
| E5 | **Dédupliquer** | 3–6 | Quand la cible canonique est stable, l'ancienne route doublon devient un pur `<Redirect href=…>` (coquille de compatibilité). | Supprimer la coquille |
| E6 | **Nettoyer les routes** | 7 (+ post-7) | Une fois aucun appel entrant résiduel, supprimer les coquilles de redirection et les écrans morts (`debug-*` masqués). | Toucher au schéma Supabase |

**Lecture clé** : E3→E4→E5 se font **zone par zone**, pas en bloc. On termine entièrement Paddock (PR 2) avant d'ouvrir Bilan (PR 3), etc. Le « grand nettoyage » (E6) est concentré en **PR 7**, jamais en cours de route.

### Mécanique technique de la coquille de redirection

Pour chaque doublon retiré de l'UI mais encore atteignable par URL, le fichier de route est réduit à :

```tsx
// app/(app)/social.tsx — coquille de compat (E5). À supprimer en E6.
import { Redirect } from 'expo-router';
export default function SocialRedirect() {
  return <Redirect href="/(app)/amis" />; // cible canonique : Club › Communauté
}
```

`appMap.ts` centralise ces correspondances pour que les redirections ne soient pas dispersées en dur dans 10 fichiers :

```ts
// src/services/appMap.ts (créé en PR 1)
export const ZONE_HOME = {
  paddock: '/(app)',          // index = hub Paddock
  session: '/(app)/equipement',
  bilan: '/(app)/bilan',
  progression: '/(app)/progression',
  club: '/(app)/mon-coach',   // coach affilié mis en avant
} as const;

export const ROUTE_ALIASES = {
  '/(app)/paddock': '/(app)',       // arrivée circuit → état du hub
  '/(app)/social': '/(app)/amis',
  '/(app)/social-carte': '/(app)/carte-oxv',
  '/(app)/lieux': '/(app)/carte-oxv',
  '/(app)/stats': '/(app)/progression',
  // … cf. §3
} as const;
```

> `appMap.ts` est de la **donnée de routage** (TypeScript), pas du schéma. Sa création ne nécessite aucun accord Gabin.

---

## 2. Cible de navigation (rappel verrouillé)

5 onglets, **or interdit sur la nav** (actif `#F8F9FA` / inactif `#54545C`, cf. `04_DESIGN_CANON §4` Tab bar). Compte = icône haut-droite, jamais un onglet.

| Onglet | Route canonique (hub) | Écrans rangés dessous (accès au toucher) |
|---|---|---|
| **Paddock** | `index` | `paddock` (état arrivée) |
| **Session** | `equipement` → flux | `placement`, `roulage`, `entre-runs`, `pilotage-fini`, `bilan-pret` |
| **Bilan** | `bilan` | Data Lab : `carte`, `virage`, `virage-comparer`, `tours`, `heatmap`, `replay`, `telemetry`, `insights`, `insight/[reading]`, `prochaine-fois` · `debrief`, `debrief-presentiel`, `partage`, `carte-trophee`, `circuits`, `circuit/[id]` |
| **Progression** | `progression` | `signature`, `regularite`, `comparateur`, `objectifs`, `roulages` |
| **Club** | `mon-coach` | `coachs`, `coach/[id]`, `mes-demandes`, `amis`, `carte-oxv`, `cote-a-cote/[friendId]` |
| **Compte** (icône) | `profil` | `settings`, `notifications`, `donnees-securite`, `legal/[doc]` |

---

## 3. Doublons à résoudre — décision et ordre

Issus de `02_AUDIT_ROUTES.md §Doublons`. Décision **DROP franc** (memo doctrine « drop plutôt que neutraliser ») dès que la cible est stable : l'ancien devient coquille puis disparaît.

| # | Doublon | Cible canonique | Décision | Traité en | Note de grounding |
|---|---|---|---|---|---|
| D1 | `index` vs `paddock` | `index` (hub) | **Garder les deux distincts**, pas de fusion | PR 2 | `paddock.tsx` ≠ hub : c'est l'écran « Vous y êtes » (arrivée circuit). Devient un **état du hub Paddock** ou un sous-écran. `paddock` → alias vers `index` une fois l'état intégré. |
| D2 | `carte-oxv` vs `social-carte` vs `lieux` | `carte-oxv` | **Fusionner** vers une seule « La carte OXV » | PR 6 (Club) | `social-carte` et `lieux` → coquilles `<Redirect href="/(app)/carte-oxv">` |
| D3 | `social` vs `amis` | `amis` | **Fusionner** vers Communauté (Club) | PR 6 (Club) | `social` → coquille vers `amis` |
| D4 | `bilan` vs `insights` vs `stats` vs `heatmap` | `bilan` (hub) + Data Lab | **Pas d'entrées parallèles** : sous-vues au toucher | PR 3 (Bilan) | `stats` est un cas mixte : fusionne côté **Progression** (cf. D6). `insights`/`heatmap` restent vivants comme sous-vues Data Lab, on retire seulement leurs liens directs. |
| D5 | `coachs` vs `mon-coach` | les **deux** gardés | **Ne PAS fusionner** | PR 6 (Club) | Rôles distincts : `mon-coach` = affiliation (mise en avant) ; `coachs` = découverte/marketplace. Cohérence de nav, pas dédup. |
| D6 | `roulages` vs `roulage` | les **deux** gardés | **Ne PAS fusionner** | PR 5 (Progression) | Homonymes trompeurs : `roulages` (pluriel) = historique/carnet → Progression ; `roulage` (singulier) = étape « en piste » → Session. Aucun changement de route, lever l'ambiguïté par le rangement. |
| D7 | `stats` → `progression` | `progression` | **Fusionner** | PR 5 (Progression) | `stats` → coquille vers `progression` après absorption du contenu. |

**Ordre de résolution** (suit les PR de zone, pour ne dédupliquer qu'une zone à la fois) :

1. **PR 2 — Paddock** : D1 (intégrer l'état arrivée, aliaser `paddock`).
2. **PR 3 — Bilan** : D4 (ranger `insights`/`heatmap`/`telemetry` sous Data Lab, couper les liens directs).
3. **PR 5 — Progression** : D6 (clarifier `roulages`≠`roulage`), D7 (`stats`→`progression`).
4. **PR 6 — Club** : D2 (`carte-oxv` absorbe `social-carte`+`lieux`), D3 (`amis` absorbe `social`), D5 (laisser `coachs`/`mon-coach` séparés mais reliés).
5. **PR 7 — Polish** : suppression des coquilles devenues silencieuses + masquage `debug-capture`/`debug-circuit` hors prod.

---

## 4. Risques par étape + filet de sécurité

**Filet permanent** : tant qu'on n'a pas atteint E6 pour une route donnée, **toutes les routes `app/(app)/*` restent valides** (écran réel ou coquille `<Redirect>`). Un deep link historique, un `router.push('/(app)/social')` oublié ou un favori utilisateur ne casse jamais.

| Étape | Risque | Filet |
|---|---|---|
| E2 (Tabs + hubs) | Le passage `Stack` → `Tabs` peut casser les transitions des écrans de flux (Session) qui supposaient un `Stack` plein écran. | Garder le flux Session **hors** de la barre d'onglets (présenté en `Stack`/modal au-dessus des Tabs). La tab bar disparaît pendant Session — cohérent avec la doctrine du silence (`04_DESIGN_CANON §6` : « pas de tab bar » en piste). |
| E2 | `appMap.ts` introduit une indirection : risque de cible morte (alias pointant vers une route inexistante). | Test unitaire Jest : chaque valeur de `ZONE_HOME`/`ROUTE_ALIASES` correspond à un fichier de route existant (assertion sur la liste réelle des routes). |
| E3 (redirections) | Boucle de redirection (A→B et B→A) ou double `<Redirect>` au montage. | `appMap.ts` est un graphe **acyclique** : un alias ne pointe jamais vers un autre alias, toujours vers une route canonique terminale. Test Jest de non-cyclicité. |
| E3 | Perte de l'état de navigation (params, deep link `insight/[reading]`, `circuit/[id]`) lors du rangement. | Les routes paramétrées **ne deviennent jamais des coquilles** : elles sont rangées (accès au toucher) mais gardent leur URL et leurs params intacts. Seuls les doublons **sans param** (`social`, `lieux`, `stats`…) deviennent coquilles. |
| E4 (masquer liens) | Un écran devient orphelin (plus aucun lien d'UI) alors qu'il n'est pas encore rangé → inaccessible sauf URL. | Critère de bascule §5 : on ne masque un lien que **lorsque** le hub de zone offre déjà l'accès au toucher équivalent. |
| E4 | Silence en piste compromis : un lien résiduel ramène une UI pendant `roulage`. | Audit ciblé : aucun composant monté pendant l'état « en piste » ne rend de navigation (cf. `roulage.tsx`, mode `enroute` du hub). |
| E5 (dédup) | Suppression du contenu d'un écran encore appelé par un autre espace (Coach/Admin deep link vers un écran pilote). | Avant de réduire en coquille : `grep` des références `'/(app)/<route>'` dans `app/(coach)/*`, `app/(admin)/*`, `src/services/*`, `src/components/*`. Zéro référence active hors hub = feu vert. |
| E6 (nettoyage) | Suppression d'une coquille encore atteinte par un client déployé (app installée, lien partagé `share/[token]`). | `share/[token]` est **public et conservé** (audit : GARDER). Les coquilles internes ne sont retirées qu'après une fenêtre d'observation (≥ 1 build alpha sans hit). |

---

## 5. Critères de bascule (quand retirer un doublon)

Une route doublon ne passe à l'étape suivante que si **tous** les critères de l'étape sont remplis. Aucun saut d'étape.

**De rangé → coquille (E5)** :
- [ ] La cible canonique est livrée et stable (PR de zone mergée, validée par Gabin).
- [ ] Le hub de la zone offre l'accès au toucher équivalent (l'utilisateur ne perd aucune destination).
- [ ] Aucun lien d'UI ne pointe encore vers l'ancienne route (E4 fait).
- [ ] La route n'a **pas** de paramètre dynamique porteur d'état (sinon : rester rangée, pas de coquille).

**De coquille → supprimée (E6)** :
- [ ] Zéro référence en code : `grep '/(app)/<route>'` vide dans `app/*`, `src/*` (hors `appMap.ts`).
- [ ] La route n'est pas publique / partageable (`share/[token]` exclu).
- [ ] Au moins **un cycle alpha** écoulé sans accès enregistré à la coquille (filet anti-lien-déployé).
- [ ] Suppression groupée en **PR 7** (ou post-7 dédiée), jamais dispersée.

**Cas « ne jamais retirer »** (décision figée, pas de bascule) :
- `coachs` et `mon-coach` (D5) — rôles distincts.
- `roulages` et `roulage` (D6) — zones distinctes (Progression vs Session).
- `share/[token]` — surface publique.
- `debug-capture`, `debug-circuit` — **masqués** en prod (flag `__DEV__`), pas supprimés (outillage dev).

---

## 6. Alignement roadmap PR 1–7

| PR (réf. `00 §7`) | Apport migration | Étapes couvertes | Doublons traités |
|---|---|---|---|
| **PR 1** — Nav 5 zones + `appMap.ts` | Tabs + hubs + table de routage. Rien retiré. | E1, E2 | — |
| **PR 2** — Paddock contextuel | Hub Paddock, intègre l'état arrivée. | E3, E4 (Paddock) | D1 |
| **PR 3** — Bilan progressif | Data Lab assemblé, sous-vues au toucher. | E3, E4 (Bilan) | D4 |
| **PR 4** — Flux Session (silence) | Session hors Tabs, UI éteinte en piste. | E3 (Session) | — |
| **PR 5** — Progression / Développement | Absorbe `stats`, clarifie `roulages`. | E3, E4, E5 (Progression) | D6, D7 |
| **PR 6** — Compte / Club | Carte unique, communauté unique, coachs reliés. | E3, E4, E5 (Club) | D2, D3, D5 |
| **PR 7** — Design polish | Suppression coquilles, masquage `debug-*`, v2 réaligné. | E6 | clôture |

---

## 7. Garde-fous transverses

- **Aucun schéma Supabase touché.** Cette migration est purement routing/navigation. Toute évolution de données reste **à soumettre à l'accord de Gabin** dans un document séparé (`07_DATA_POLICY.md`, migrations dédiées). À marquer explicitement « nécessite accord » le jour où une couche profonde (Data Lab assemblé, Passeport, Pass OXV) exigera une table.
- **Une PR à la fois**, rapport dans `roadmap/rapports/`, validation entre chaque (`00 §6`).
- **Doctrine intacte pendant la migration** : aucun écran déplacé n'introduit de verbe prescriptif, d'or hors donnée, ni de rupture du silence en piste. Le rangement ne réécrit pas le contenu — il ne fait que déplacer l'accès.
- **TypeScript strict, pas de `any`** dans `appMap.ts` (types littéraux `as const`).
- En cas de doute sur une fusion : **garder distinct** et poser la question, plutôt que fusionner par erreur (coût d'un faux doublon > coût d'un écran en trop).
