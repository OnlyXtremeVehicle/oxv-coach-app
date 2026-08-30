# Bloc B — Plateau, secteurs, direct et écran

*Le bloc le plus risqué : il dépend d'une source que vous ne contrôlez pas et il alimente deux dépôts, `oxv-app` et `oxv-site`.*

**Une précision sur B-1.** Votre réponse — « sur les deux, pour retransmission sur télé et tablette » — mélangeait deux choses qui ne s'opposent pas. **Lire** et **afficher** sont deux gestes séparés : le serveur lit **une fois**, écrit dans une table, et la tablette comme l'écran s'y abonnent. Vous obtenez donc la retransmission sur les deux surfaces, avec un seul lecteur, une seule cadence et un seul interrupteur. Un lecteur par appareil allumé serait ingérable et contredirait l'engagement d'arrêt immédiat du courrier. La spec ci-dessous retient un lecteur serveur, plus **un** lecteur de secours désigné sur la tablette, actif uniquement si le serveur ne voit pas la source, et jamais les deux à la fois. Dites-moi si vous vouliez autre chose.

---

## B-1 · Référentiel plateau

`supabase/functions/lire-plateau/` (planifiée) · `src/services/plateauService.ts` · table `plateau` — **à créer**

**Raison d'être.** Replacer les temps du pilote dans ceux de son plateau. OXV ne fabrique aucun classement : il lit celui qui existe déjà, officiel et public, et le rend lisible autrement.

**Table `plateau`.** `id` · `circuit_id` · `epreuve` · `seance` · `numero` (numéro de course) · `categorie` · `meilleur_tour_ms` · `s1_ms` · `s2_ms` · `s3_ms` · `releve_at` · `source` (`officiel` | `saisie`).

**Aucun nom.** La table stocke des **numéros de course**, jamais des noms de pilotes ni d'écuries. Deux raisons, et la seconde compte plus que la première : d'une part le numéro suffit pour situer quelqu'un dans un plateau ; d'autre part les autres concurrents n'ont rien consenti, et constituer un fichier nominatif de tiers pour un usage commercial est un problème que vous n'avez aucune raison de vous créer. Le numéro du pilote suivi est le seul qui soit résolu en identité, et il l'est côté application, pas en base.

**Cadence et garde-fous, codés, pas documentés.**
- Une requête toutes les 5 à 10 secondes, avec gigue aléatoire. Jamais de rafale, jamais de rattrapage accéléré après une coupure.
- Recul exponentiel sur erreur, plafonné, et arrêt complet après trois échecs consécutifs.
- En-tête d'agent identifiant OXV et une adresse de contact joignable.
- Un **interrupteur unique en base** (`plateau_lecture_active`), relu à chaque cycle. Le couper arrête tout, partout, en moins d'une minute. C'est l'engagement pris dans le courrier à ITS : il doit être tenable en une seconde, un dimanche.
- Aucune lecture hors des créneaux de séance déclarés.

**Lecteur de secours.** Si le serveur ne voit pas la source, **un seul** appareil peut prendre le relais, marqué explicitement comme lecteur (`plateau_lecteur_device_id`). Deux appareils ne lisent jamais en même temps. La bascule est manuelle et visible.

**Interdits.**
- Aucune redistribution publique. Le référentiel ne sort ni sur `/pavillon/accueil`, ni sur aucune page publique du site, ni dans un export client. Garde `plateauNonPublic`.
- Aucune reconstitution d'historique : on ne garde que les épreuves où OXV est présent.

**Acceptation.**
1. Couper `plateau_lecture_active` : plus aucune requête sortante en moins de 60 s, vérifié dans les journaux.
2. Trois erreurs de suite : le lecteur s'arrête et le dit dans la santé de chaîne.
3. La table ne contient aucune colonne de nom — vérifié par le schéma, pas par convention.

---

## B-2 · Découpage en secteurs officiels

`src/services/secteursOfficiels.ts` · `scripts/recaler-secteurs.ts` — **à créer**

**Méthode, une fois par circuit, hors ligne.**
1. Prendre une séance du pilote dont les temps S1/S2/S3 **officiels** sont connus (ils figurent sur sa feuille).
2. Pour chaque tour valide : partir de l'instant de passage sur la ligne, avancer de `s1`, puis de `s1+s2`, et relever les deux positions sur la trace.
3. Projeter ces positions sur l'axe du tracé, en fraction de distance parcourue.
4. Répéter sur au moins trois tours. **Prendre la médiane, et conserver la dispersion** : c'est la mesure de confiance du découpage, et elle s'affiche.
5. Figer les deux frontières dans la table `circuits`.

**Pourquoi la dispersion compte.** Si les trois tours donnent trois positions écartées de plus de quelques mètres, le recalage est faux et le dire vaut mieux que publier trois nombres. Le seuil d'acceptation se fixe à la première mesure réelle, pas à l'avance.

**Ce qui ne marche pas.** Trois secteurs de longueur égale : immédiat et faux, et la preuve P-1 s'effondre au premier recoupement devant le pilote.

**Acceptation.**
1. Recalé sur Bouteville avec des temps connus, l'écart entre secteurs recalculés et secteurs officiels reste sous le seuil retenu.
2. Le Bugatti et Albi sont recalés **avant** le week-end concerné, jamais pendant.
3. La dispersion est stockée et lisible.

---

## B-3 · Mesure de l'écart avec le chronométrage

`src/services/mesureEcart.ts` · table `mesures_ecart` — **à créer**

**Ce que c'est.** Pour une séance, l'écart entre nos temps au tour et les temps officiels du **même camion**, sur tous les tours valides : médiane, dispersion, nombre de tours. Une ligne par circuit, mise à jour à chaque séance.

**Ce qui l'alimente.** Le bandeau du Bilan (A-5), la feuille de preuve, et la première phrase que vous direz au pilote.

**La règle.** On n'annonce jamais un écart avant de l'avoir mesuré. Tant qu'il n'y a pas de mesure sur un circuit, le bandeau dit « Écart non mesuré sur ce circuit ». Le premier week-end **établit** cet écart ; il ne le valide pas.

---

## B-4 · Émission du canal direct — contrat partagé

`src/services/liveRelayRunner.ts` · `passerelle/src/emit.ts` — **à créer / à réveiller**

**Le contrat, écrit une fois, respecté par deux émetteurs.**

Canal `pavillon:{circuit_id}:live` · événement `position` · message :
`{ v: 1, user_id, car_number, lat, lon, speed_kmh, ts }`
Cadence **1 Hz maximum** (l'entrée est à 25 Hz), validé avant envoi, durée de vie 20 s. **Jamais de nom.**

**Deux clients de ce contrat.** La passerelle v1 (matériel) et le relais téléphone (repli). C'est ce qui rend le repli du 19 septembre presque gratuit : le jour où la passerelle ne tient pas, on change d'émetteur, pas de chaîne.

**Acceptation.**
1. Les deux émetteurs produisent des messages **identiques** au champ près, vérifié par un test de contrat partagé.
2. La cadence ne dépasse jamais 1 Hz, même quand les trames arrivent à 25 Hz.
3. L'émission ne ralentit jamais la capture : si l'envoi bloque, la capture continue et le tampon monte.

---

## B-5 · Chemin d'ingestion unique

`src/services/ingestPath.ts` · `supabase/functions/ingest-frames/` — **à créer**

**La règle.** Le CSV téléchargé du boîtier et les trames de la passerelle entrent par **la même fonction** et produisent **la même séance**. Le Mans teste donc réellement le chemin d'Albi.

**Authentification appareil.** Jeton d'appareil, cycle de séance par `device_assignments`, tours écrits pendant le roulage, battement de cœur régulier. Un appareil non affecté est refusé, avec un message qui dit lequel.

**Acceptation.**
1. Un même roulage, importé par CSV puis rejoué par trames, produit deux séances **identiques** — mêmes tours, mêmes temps, mêmes secteurs.
2. Un jeton révoqué est refusé immédiatement.
3. Le tri se fait sur `elapsed_ms`, jamais sur `created_at` — garde `triElapsedMs`.

---

## B-6 · En direct, sur la tablette

`app/(app2)/en-direct/[sessionId].tsx` **(à confirmer)** — **conservé, à réveiller**

**Ce qu'il montre.** Tour en cours, vitesse, tours terminés, et le **bandeau de santé de chaîne** (A-4) monté en permanence.

**Ce qu'il ne montre pas.** Aucune consigne, aucune alerte de performance, rien qui ressemble à une instruction. C'est un poste d'observation, pas un poste de commande.

---

## B-7 · L'écran OXV — `/pavillon/coach` et `/pavillon/controle`

Dépôt `oxv-site`, pages existantes — **à adapter**

**Bascule automatique, régie de recours.** L'écran suit le direct tant que des trames arrivent ; il passe en restitution quand la séance se ferme. La tablette (`/pavillon/controle`) peut forcer un mode et **figer** l'affichage — c'est ce qu'on fait quand quelqu'un s'arrête devant.

**Les quatre modes.** `veille` · `direct` · `restitution` · `multi`. Au Mans, `veille`, `direct` et `restitution` suffisent.

**Circuit forcé par paramètre.** Les deux pages acceptent un `circuit_id` explicite : elles doivent afficher le Bugatti un jour où aucune journée OXV n'a lieu.

**Interdits sur `/pavillon/accueil`** (le mur du bar, page publique) : aucun chrono, aucun classement, aucune donnée de plateau. Garde `murSansClassement` et garde `plateauNonPublic`.

**Acceptation.**
1. Fin de séance : l'écran passe en restitution seul, en moins de dix secondes.
2. Figé depuis la tablette, il ne bouge plus, même si des trames reprennent.
3. `/pavillon/accueil` ne reçoit jamais un champ de plateau — vérifié par la garde, sur le paquet livré.

---

## B-8 · Garde `plateauNonPublic`

`src/__tests__/plateauNonPublic.guard.test.ts` + contrôle côté site — **à créer**

**Ce qu'elle vérifie.** Qu'aucune surface publique n'importe `plateauService` ni ne reçoit un champ de la table `plateau` ; que les politiques RLS ferment la table à tout ce qui n'est pas le compte du pilote suivi et l'admin. La garde échoue à la compilation, pas à l'exécution.

**Pourquoi elle existe.** Le référentiel vient d'un tiers. La seule chose qui distingue une lecture interne d'une rediffusion, c'est un test qui casse le jour où quelqu'un branche le champ sur une page publique — et ce quelqu'un, dans six mois, ce sera vous.
