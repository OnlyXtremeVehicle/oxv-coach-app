# Bloc A — Terrain

*Spécifications destinées à Claude Code. Branche `migration/sdk-55`, dépôt `oxv-app`. Six interfaces : trois créées, une créée en composant, deux adaptées. Ce sont les seuls écrans touchés par le pilote et par vous au Mans, les 26 et 27 septembre.*

**Convention de lecture.** Chaque interface donne : sa raison d'être en une phrase, ses deux appelants (règle `deuxEntrees` — aucun écran n'a une seule entrée), ses données, ses cinq états, sa première vue, ses interactions, ses interdits, ses critères d'acceptation, sa garde.

**Les cinq états, partout.** `chargement` · `vide` (dit **quel champ** manque et pourquoi) · `partiel` (montre ce qu'il a, nomme ce qui manque) · `prêt` · `erreur` (dit quoi faire). Un écran qui s'ouvre blanc est un défaut, pas un cas limite. Garde : `cinqEtats`.

**Noms de tables et de champs.** Ceux que je n'ai pas pu vérifier sur la branche sont marqués **(à confirmer)**. Le dépôt `oxv-app` n'est pas synchronisé ; Claude Code doit vérifier chaque nom avant d'écrire, et corriger la spec si elle se trompe.

---

## A-1 · Intention avant la séance

`app/(app2)/preparation/intention.tsx` — **à créer**

**Raison d'être.** Une phrase écrite avant de monter, à laquelle la donnée du retour répondra. C'est ce qu'un chronométrage officiel ne fera jamais.

**Appelants.** L'écran Préparation (bouton principal) · le Bilan de la séance précédente (« préparer la suivante »). Deux entrées, jamais un lien unique.

**Données.**
- écriture : `session_intentions` **(à créer)** — `id`, `user_id`, `session_id` nullable à la création, `texte` (280 caractères max), `created_at`, `circuit_id`.
- lecture : les trois dernières intentions du même pilote, tous circuits confondus, pour reprise d'un geste.

**Première vue.** Un champ, vide, curseur dedans, clavier ouvert. Au-dessus : rien. En dessous : les trois dernières intentions, en gris, touchables. Un bouton unique, « Poser ».

**Interactions.**
- Toucher une intention passée la recopie dans le champ, éditable. Elle ne la valide pas.
- « Poser » écrit la ligne et revient à Préparation. L'intention devient visible en tête de Préparation, avec une croix pour la retirer.
- Si aucune séance n'est encore ouverte, l'intention reste orpheline et s'attache à la première séance démarrée dans les six heures **(à confirmer : règle d'attachement)**.

**Interdits.**
- Aucune liste d'intentions suggérées, aucun exemple pré-rempli, aucune reformulation. Proposer une intention, c'est prescrire.
- Aucune analyse du texte. Il est stocké et réaffiché tel quel.

**États.** `vide` : « Aucune intention posée » — pas d'illustration, pas d'encouragement. `partiel` : sans réseau, l'intention est gardée localement et marquée « à envoyer ».

**Acceptation.**
1. Écrire une intention hors réseau, tuer l'application, la rouvrir : l'intention est là.
2. Elle apparaît en tête du Bilan de la séance correspondante (A-5).
3. Aucune chaîne de suggestion n'existe dans le code — vérifié par lecture, pas par test.

---

## A-2 · Notes au camion

`app/(app2)/bilan/notes.tsx` — **à créer**

**Raison d'être.** Sans enregistrement audio, c'est la seule trace de ce que dit le pilote. Elle doit s'écrire debout, à une main, en plein soleil, dans le bruit, sans réseau.

**Appelants.** Le Bilan (bouton « Noter ») · la Séance (même bouton, en tête de la frise). Deux entrées.

**Données.**
- `session_notes` **(à créer)** — `id`, `session_id`, `user_id`, `texte`, `created_at` (horodatage **de l'écriture**, pas de l'envoi), `synced_at` nullable, `auteur` (`pilote` | `observateur`).
- L'horodatage est ce qui permet de reposer la note à côté du tour correspondant (A-6). Il ne se recalcule jamais à la synchronisation.

**Première vue.** Un champ de saisie en bas, grand, occupant un tiers de l'écran, police 20 pt minimum. Au-dessus, le fil des entrées de la séance, la plus récente en haut, chacune avec son heure. Rien d'autre.

**Interactions.**
- Entrée courte, envoi par le bouton du clavier. Le champ se vide et reste ouvert : on écrit par salves.
- Appui long sur une entrée : modifier ou supprimer, dans les cinq minutes. Au-delà, elle est figée — une note du terrain n'est pas un brouillon.
- Bascule `pilote` / `observateur` : un seul commutateur, en haut, qui garde son dernier état. Ce qu'il dit et ce que vous voyez ne se mélangent pas.

**Contraintes techniques, non négociables.**
- Écriture **locale d'abord**, toujours. La synchronisation est un effet de bord, jamais une condition.
- Sauvegarde à chaque frappe dans le stockage local ; l'entrée en cours de saisie survit à la mort de l'application.
- File d'envoi rejouée au retour du réseau, dans l'ordre, sans doublon (clé d'idempotence côté client).
- Contraste plein soleil : le champ et le fil respectent le plancher de `contrasteFluxRec`.

**Interdits.** Aucun résumé, aucun classement, aucune extraction de mots-clés. Le fil est un fil.

**États.** `vide` : « Aucune note sur cette séance ». `partiel` : bandeau « n notes à envoyer », jamais bloquant.

**Acceptation.**
1. Mode avion : trois notes écrites, application tuée entre la deuxième et la troisième, réseau rétabli → les trois arrivent, dans l'ordre, avec leurs heures d'écriture.
2. Une note écrite à 14 h 32 apparaît sur la frise de la Séance à 14 h 32 (A-6).
3. Lisible dehors, écran à mi-luminosité, avec des gants.

---

## A-3 · Mode Stand

`app/(app2)/rec/stand.tsx` — **à créer** (spécification A4 existante)

**Raison d'être.** Trois chiffres, lisibles avec des gants, à l'arrêt. Rien tant que ça roule.

**Appelants.** Le tunnel REC (bascule automatique à l'arrêt) · le Bilan (« revoir le stand »). Deux entrées.

**Les trois chiffres, arrêtés.** Dernier tour · écart à son meilleur tour du jour · nombre de tours valides. Aucun ne le compare à quelqu'un d'autre. Aucun ne dépend d'une source externe : cet écran doit être vrai même quand tout le reste est tombé.

**Bascule.** Hystérésis 5 / 15 : le Mode Stand s'affiche après **15 s** sous le seuil d'arrêt, disparaît après **5 s** au-dessus. Les deux seuils sont nommés et testables **(à confirmer : valeur du seuil de vitesse)**.

**Interactions.** Aucune. Zéro toucher. L'écran ne fait rien d'autre que s'afficher et disparaître.

**Interdits.** Aucun tour en cours affiché pendant le roulage. Aucune notification. Aucune place dans le plateau — elle dépend d'une source qui peut tomber, et un écran à trois chiffres dont un manque une fois sur deux perd sa crédibilité en une séance.

**Acceptation.**
1. Rejeu d'une trace : la bascule se déclenche aux bons instants, sans oscillation dans les arrêts brefs.
2. Lisible à un mètre, en plein soleil, avec des gants.
3. Rien ne s'affiche tant que la vitesse est au-dessus du seuil, même en fin de séance.

---

## A-4 · Bandeau de santé de la chaîne

`src/ui/data/SanteChaine.tsx` — **à créer** · monté sur la tablette, en direct **et** hors direct

**Raison d'être.** Savoir que la chaîne vit **avant** que le camion parte. Personne ne l'avait imaginée ; son absence coûte une séance entière et ne dit même pas quel maillon a lâché.

**Appelants.** L'écran En direct · l'écran Équipement. Deux entrées. Il est **monté en permanence** sur la tablette, pas ouvert à la demande.

**Quatre voyants, dans l'ordre de la chaîne.**

| Voyant | Vert | Orange | Rouge |
|---|---|---|---|
| Boîtier | trames reçues < 3 s | 3 à 15 s | > 15 s ou jamais vu |
| Réseau | remontée < 5 s | 5 à 30 s | > 30 s |
| Dernière trame | l'heure, en clair | — | — |
| Tampon | 0 en attente | 1 à 500 | > 500 ou en perte |

**Règle de lecture.** Le bandeau dit **quel maillon**, jamais « ça ne marche pas ». Les quatre maillons de la section 4 du dossier sont les quatre voyants : capture, remontée, serveur, affichage.

**Interactions.** Toucher le bandeau ouvre le détail (dernier code d'erreur, adresse de l'appareil, taille du tampon). Le détail est un tiroir, pas un écran.

**États.** `vide` : « Aucun appareil affecté » avec le nom du champ attendu (`device_assignments`). `erreur` : le maillon rouge et ce qu'on fait — la phrase de reprise est écrite, pas générée.

**Acceptation.**
1. Débrancher le boîtier : le premier voyant passe rouge en moins de 20 s, les autres restent justes.
2. Couper la 4G : le deuxième passe rouge, le tampon monte, aucune trame n'est perdue au rétablissement.
3. Le bandeau est visible sans ouvrir quoi que ce soit, camion à l'arrêt.

---

## A-5 · Bilan de séance — adaptation

`app/(app2)/bilan/[sessionId].tsx` — **conservé, adapté**

**Ce qui change.** L'ordre de la première vue, et deux bandeaux.

**Première vue, avant tout défilement.**
1. **L'intention** posée avant la séance (A-1), en clair, sans commentaire.
2. **Trois chiffres** : meilleur tour · écart à son meilleur · tours valides.
3. **Le bandeau d'écart** avec le chronométrage officiel (voir plus bas).

Le reste — trace, secteurs, marges, virage à creuser — vient au défilement. La donnée répond à sa question avant de déballer ce qu'elle sait ; c'est la seule chose qui distingue le Bilan d'une feuille de chronométrage.

**Le bandeau d'écart.** `DataConfidenceBanner`, déjà au registre, branché ici : « Écart mesuré avec le chronométrage officiel : ± 0,0X s · mesuré le JJ/MM ». Il s'affiche **toujours**, bon ou mauvais. Afficher sa propre marge d'erreur à un professionnel est ce qui vous sépare de tous ceux qui promettent la précision sans la mesurer. S'il n'y a pas encore de mesure, il le dit : « Écart non mesuré sur ce circuit ».

**Le découpage.** Le Bilan parle **secteurs officiels** (S1, S2, S3), comparables à leur feuille. Pas de zones par virage ici, pas de sélecteur.

**Interdits.** Aucune phrase causale. Aucun conseil. Aucune comparaison à un autre pilote. Le virage à creuser se nomme, il ne s'explique pas.

**Acceptation.**
1. Ouvert sur une séance sans intention : la place de l'intention n'est pas un trou, elle porte « Aucune intention posée ».
2. Ouvert sur un circuit sans mesure d'écart : le bandeau le dit, il ne disparaît pas.
3. Aucun chiffre n'apparaît sans son état : garde `cinqEtats` verte sur cet écran.

---

## A-6 · Séance — adaptation

`app/(app2)/seance/[sessionId].tsx` **(à confirmer : chemin exact)** — **conservé, adapté**

**Ce qui change.** Le découpage, et la frise.

**Le découpage.** La Séance parle **zones OXV par virage**. C'est l'écran qu'on lit assis, le soir : il a le droit d'être fin. Chaque écran a un seul découpage, personne n'a à choisir un mode.

**La frise des tours.** Les notes du camion (A-2) se posent sur la frise **à leur heure d'écriture**. Une note à 14 h 32 se pose entre le tour qui finit à 14 h 31 et celui qui finit à 14 h 34. Sa parole et la mesure, côte à côte.

**La règle qui tient toute la preuve P-4.** On les pose côte à côte. **On ne les relie pas.** Aucune formulation du type « cette note explique ce tour », aucun trait, aucune flèche, aucune couleur partagée qui suggère une causalité. La juxtaposition est le propos ; l'interprétation appartient au pilote.

**Interactions.** Toucher une note l'ouvre dans le fil (A-2). Toucher un tour ouvre le tour. Les deux ne se sélectionnent jamais ensemble.

**Acceptation.**
1. Une séance avec cinq notes et vingt tours : les cinq notes sont à la bonne place dans la frise, à la seconde près.
2. Une séance sans note : la frise est identique, sans espace réservé ni invitation à écrire.
3. Aucun élément visuel ne relie une note à un tour.

---

## Ce que ce bloc suppose et qui n'est pas dedans

| Dépendance | Où c'est spécifié |
|---|---|
| Secteurs officiels calculés | Bloc B |
| Écart mesuré avec le chronométrage | Bloc B |
| Trames qui arrivent (passerelle, ingestion) | Bloc B |
| Cinq états, contraste plein soleil, couche 2 | Bloc E |
| Circuit du Bugatti en base | Bloc B |
