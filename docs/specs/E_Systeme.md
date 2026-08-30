# Bloc E — Système visuel, états, gardes, serveur

*Le bloc invisible. Personne ne le voit au Mans, et c'est lui qui décide si les quatre autres tiennent debout.*

---

## E-0 · Une précision sur E-4, avant tout

Votre réponse — « tout ce dont a besoin un pilote pro pour améliorer ses objectifs en piste » — répond à une autre question que celle posée. Deux choses à séparer, et une à nommer.

**Ce que je demandais.** Ce que **vous**, seul dans le paddock avec trois minutes entre deux séances, devez voir pour savoir si la chaîne tient. C'est de l'outillage, ça ne concerne pas le pilote, et sans ça vous diagnostiquerez une panne en dix minutes quand vous en avez trois.

**Ce que vous décrivez.** Ce que le **pilote** voit — et c'est exactement l'objet des blocs A, B et C au complet. Il n'y a rien à ajouter là : le Bilan, la Séance, les secteurs, le plateau, les notes, le Mode Stand, le Débrief, c'est déjà cette réponse.

**Ce qu'il faut nommer.** « Tout ce dont il a besoin pour **améliorer** » n'est pas la promesse d'OXV. OXV montre ; il ne prescrit pas, et vous n'êtes pas agréé pour le faire. La nuance n'est pas cosmétique : c'est elle qui vous autorise à poser un boîtier dans la cabine d'un professionnel sans entrer dans le champ du coaching sportif. Ce que l'outil doit viser, c'est **tout ce dont un pilote a besoin pour voir ce qu'il a fait**. Ce qu'il en tire lui appartient.

**Donc, retenu :** Sentry avec cartes de source, plus une page d'état à une adresse — quatre maillons, dernière trame, état du lecteur de plateau, les deux interrupteurs. C'est le bandeau A-4, sorti de l'application, lisible sur un téléphone sans se connecter.

---

## E-1 · Le système visuel — les deux phases avant Le Mans

Vous prenez les deux phases. C'est faisable, à une condition de méthode.

**Phase 1 — la couche 2.** `src/ui/data/` : radar, tracé Skia, chrono, états, barres, Fact, provenance, confiance, rejeu. Un composant de donnée **unique**, importé par les deux univers. Garde `frontiereUnivers` : aucun import de `src/ui/v2` hors `(app2)` sauf la couche 2, aucun kit v1 dans `(app2)`.

**Phase 2 — les jetons et les kits.** Schéma unique `tokens.json` → `tokens.ts` + `tokens.css`, deux thèmes (instrument, console), CSS pour le site. Fusion des kits : Button, Field, Chip console ; motion V1 → V2.

**La condition, et elle est absolue.** Les **868 usages de `fontSize`** ne se reprennent pas à la main. C'est une transformation mécanique : un codemod qui remplace chaque valeur littérale par le jeton correspondant, une table de correspondance écrite **avant**, et une revue par captures d'écran comparées avant / après sur les écrans des blocs A à C.

Fait ainsi, c'est un ou deux jours. Fait à la main, c'est une semaine, avec des erreurs qui apparaîtront au Mans sur un écran qu'on n'aura pas rouvert. **Si le codemod n'est pas écrit, la phase 2 ne commence pas** — elle retombe au lot Client, sans discussion.

**Position dans l'ordre de sacrifice.** Phase 1 : intouchable, les blocs A à C en dépendent. Phase 2 : juste après les trois écrans du Paddock Pro, avant le reste.

---

## E-2 · Les cinq états

**La garde `cinqEtats` est bloquante sur les dix écrans du week-end** — les six du bloc A, les quatre du bloc C — et en avertissement sur les 140 autres routes.

**Les cinq états, définis une fois pour toutes.**

| État | Ce qu'il doit dire |
|---|---|
| `chargement` | Rien de plus qu'un mouvement. Aucun squelette qui imite de la donnée |
| `vide` | **Quel champ** manque et pourquoi. « Signature disponible à partir de trois séances — 1 sur 3 », pas « Aucune donnée » |
| `partiel` | Ce qu'il a, et le nom de ce qui manque. Jamais un chiffre affiché comme complet alors qu'il est partiel |
| `prêt` | La donnée, avec sa provenance |
| `erreur` | Ce qui s'est passé et ce qu'on fait. La phrase de reprise est écrite, pas générée |

**La règle qui les résume.** Un écran qui s'ouvre blanc est un défaut, pas un cas limite. Devant un pilote professionnel, un état vide honnête vaut mieux qu'un chiffre approximatif — c'est la seule chose que la doctrine achète et que la concurrence ne peut pas copier sans y renoncer.

---

## E-3 · Les six gardes, dans l'ordre

| # | Garde | Ce qu'elle empêche | Priorité |
|---|---|---|---|
| 1 | `assistantSansConseil` | Une phrase de conseil devant un pilote professionnel | **Bloquante.** Tant qu'elle est rouge, l'assistant reste éteint |
| 2 | `plateauNonPublic` | La donnée d'un tiers rediffusée publiquement | **Bloquante** avant toute mise en ligne |
| 3 | `deuxEntrees` | Le retour des 35 orphelins, avec sa liste d'exceptions datées | Avant le build de fin septembre |
| 4 | `frontiereUnivers` | Le mélange des deux univers visuels | Avec la phase 1 |
| 5 | `triElapsedMs` | Un tri sur `created_at`, qui est un ordre d'insertion | Avant la répétition du 19/09 |
| 6 | `cinqEtats` | Un écran blanc devant le pilote | Bloquante sur dix écrans |

**Pourquoi les deux premières.** Ce sont les seules qui protègent contre un dommage **irréversible**. Un tri faux se corrige le soir même ; une phrase de conseil sortie devant un professionnel, et une donnée de tiers rediffusée, ne se rattrapent pas.

**Les gardes datées, en plus.** `gelsDates.guard` échoue quand la date d'un gel passe sans décision (D-4). `deuxEntrees` échoue quand une exception est périmée ou sans raison (D-3). Le motif est le même partout : **une dette qui se rappelle à vous, ou ce n'est pas une dette, c'est un oubli.**

---

## E-4 · Serveur

| Chantier | Détail |
|---|---|
| `ingest-frames` | Authentification appareil, cycle de séance, tours écrits en direct, battement de cœur (bloc B) |
| `assistant-questionner` | Le modèle écrit la requête, la base répond sous RLS, filtre en sortie, journal des questions (bloc C) |
| `lire-plateau` | Fonction planifiée, cadence basse, interrupteur en base (bloc B) |
| `publier-debrief` | Génère la page à jeton révocable (bloc C) — **dépend de la décision `/share/{token}`** |
| Migration | Suppression de `coach_ai_drafts` |
| RLS | Tests sur `plateau`, `session_notes`, `session_intentions`, `laps` |

---

## E-5 · Observabilité — la page d'état

`oxv-site : /etat` (accès restreint) — **à créer**

Une page, une adresse, lisible sur un téléphone sans se connecter à un tableau de bord.

| Ligne | Ce qu'elle montre |
|---|---|
| Boîtier | Dernière trame reçue, il y a n secondes |
| Passerelle | Dernier battement de cœur, taille du tampon |
| Serveur | Dernière séance écrite, dernier tour écrit |
| Plateau | Lecteur actif ou non, dernier relevé, nombre d'échecs consécutifs |
| Interrupteurs | `plateau_lecture_active` et `assistant_actif`, avec leur état |

**Les deux interrupteurs se coupent depuis cette page.** C'est le seul endroit du produit où une action a un effet immédiat sur autre chose que l'affichage — et c'est voulu : un dimanche, dans un paddock, vous devez pouvoir éteindre l'assistant ou le lecteur en trois secondes, sans déploiement, sans ordinateur.

---

## E-6 · Ce que ce bloc doit prouver

1. `frontiereUnivers`, `deuxEntrees`, `triElapsedMs` verts.
2. `assistantSansConseil` verte sur les trente questions pièges, dans les deux implémentations.
3. `plateauNonPublic` verte sur le paquet du site livré.
4. `cinqEtats` verte et bloquante sur les dix écrans du week-end.
5. Un plantage provoqué remonte dans Sentry avec sa pile et ses cartes de source.
6. La page d'état affiche juste, et les deux interrupteurs coupent en moins de dix secondes.
