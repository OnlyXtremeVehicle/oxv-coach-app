# Jalons restants — état au 17/08/2026

> Ce document remplace la liste mentale. Il tient **ce qui reste**, avec ce qui
> bloque quoi, et il intègre l'audit design du même jour.
>
> Règle n° 1 du `PROGRAMME_V4` : toute affirmation de plus de deux semaines se
> remesure avant d'être traitée. Ce qui suit a été **mesuré le 17/08**, pas
> supposé.

---

## Ce qui a été fermé le 17/08

| Chantier | État |
|---|---|
| Unification des 5 paliers QDI | fait — 3 copies → 1 source |
| Graduations des canaux (vitesse, appuis) | fait |
| Écrêtage du diagramme G-G | fait |
| Écurie — insigne (catalogue + téléversement) | fait |
| Écurie — sortie, invitations, réponses | fait |
| Écurie — pack Heritage à l'invitation | fait |
| Écurie — trajet (rendez-vous, restaurant, circuit) | fait |
| Géocodage d'adresses (deux sens) | fait |
| Migration MapLibre + Protomaps | fait côté app |
| Modération des insignes | fait |

**Plus aucune fonction serveur sans appelant** dans le périmètre écurie, et
**plus aucun écran de restitution ne borne une mesure en silence.**

---

## JALON A — Ce qui bloque une mise en service

Ces trois points empêchent quelque chose de fonctionner. Ils passent avant tout
le reste.

### A1 · Les 98 tests RLS ne s'exécutent pas

`TEST_SUPABASE_URL` et `TEST_SUPABASE_SERVICE_KEY` sont absents. 18 suites, 98
tests, **jamais exécutés** — coach, partenaire, admin, modération, amitiés.

Le poids a augmenté le 17/08 : les politiques posées ce jour-là
(`convoys_crew_insert_capitaine` en RESTRICTIVE, l'invitation par le capitaine,
la visibilité de l'invité) **sont en production et vérifiées par aucun test**.
Trois fonctions applicatives s'appuient dessus.

Mise en place : `docs/architecture/17_CI_RLS_SETUP.md`.
**Décision attendue :** fournir des identifiants Supabase de test, distincts de
la production.

### A2 · Le fond de carte n'a pas de tuiles

MapLibre est en place, le style est écrit, les deux écrans sont migrés — et
`EXPO_PUBLIC_TILES_URL` est vide, donc la carte rend le fond titane et rien
d'autre.

Chaîne : produire le `.pmtiles` → choisir l'hébergement → le site écrit le
service de tuiles → renseigner la variable.
Spécification remise : `docs/architecture/18_HANDOFF_SITE_TUILES_CARTO.md`.
**Décision attendue :** emprise géographique et hébergement.

### A3 · Rien n'a été vu à l'écran

MapLibre est un module natif. Le quota de builds iOS est épuisé **jusqu'au
1er septembre**. Tout ce qui a été livré depuis la migration est vérifié par le
typecheck et 3 561 tests — aucun n'a jamais affiché un pixel.

**Premier regard possible : un build Android.**
Ce qu'il faut regarder en premier, dans l'ordre : le fond de carte (les couches
Protomaps portent-elles bien les noms `earth`/`water`/`roads`/`buildings` ?), les
graduations des canaux, le cyan de la Régularité sur le radar QDI.

---

## JALON B — L'audit design du 17/08

Mesuré par script sur `app/` et `src/`, hors tests et archive.

### B1 · Onze paires de couleurs sous ΔE 25

Épinglées et gardées par `src/theme/__tests__/collisionsCouleurs.test.ts`, qui
échoue sur la douzième. Trois méritent un arbitrage :

| Paire | ΔE | Pourquoi ça compte |
|---|---:|---|
| `qdi.freinage` / `marque.rouge` | **18,8** | le dépôt répète « rouge de DONNÉE, distinct du rouge de MARQUE » — la distinction est plus faible que le seuil qu'on s'impose ailleurs |
| `qdi.fluidite` / `or.chrono` | **19,0** | l'or est réservé au chrono, et la Fluidité est jaune à dix-neuf points |
| `or.chrono` / `#EF9F27` | **16,2** | un jaune d'état écrit EN DUR dans deux écrans admin (`circuit.tsx`, `preparation.tsx`) |

Les autres sont documentées comme tolérables — espaces disjoints, ou identité
voulue (`role.coach` **est** le rouge de marque).

**Une erreur de méthode, corrigée :** le cyan de la Régularité avait été choisi
par optimisation contre huit couleurs réservées — **sans connaître les couleurs
de rôle**. Il tombe à ΔE 9,8 du cyan admin. Sans conséquence (les deux espaces ne
se croisent pas, vérifié), mais rien ne l'aurait dit.

### B2 · 59 hex écrits en dur hors des fichiers de jetons

115 emplacements. Le plus fréquent est `#22D3EE` dans 28 fichiers — alors que
`roleColors.admin` porte exactement cette valeur. Le jeton existe et n'est pas
employé.

### B3 · Deux barils de jetons subsistent pour la TYPOGRAPHIE

168 fichiers importent `theme/v2`, 7 importent `ui/v2/tokens`. La couleur a été
unifiée le 17/08 ; la typographie et les espacements, non. Le commentaire de
`tokens.ts` annonce toujours une « bascule V2-L6 » qui n'a jamais eu lieu.

### B4 · L'échelle typographique existe et se fait contourner

**Un premier constat de cet audit disait « aucune échelle typographique ». Il
était faux**, et la correction change le remède.

`fontSize` existe dans `src/theme/v2.ts` — dix crans distincts (11, 12, 14, 15,
17, 21, 25, 28, 44, 62) — et il est employé **868 fois**. Ce qui manque n'est pas
l'échelle, c'est son respect :

| | |
|---|---|
| `fontSize` en nombre brut | **1 162** emplois, 182 fichiers |
| `fontSize` par le jeton | **868** emplois, 128 fichiers |
| Emplois déjà sur un cran | 48 % |
| Déplacement moyen si on ramenait tout | **0,74 pt** |

**Pourquoi elle est contournée :** ses trois tailles les plus écrites en dur n'y
sont pas — 10 pt (×184), 9 pt (×126), 13 pt (×119). Quatre cent vingt-neuf
emplois, 37 % du total. On n'écrit pas un nombre brut par négligence, on l'écrit
parce que le jeton qu'il faudrait n'existe pas.

**Et pourquoi on ne l'élargit pas :** l'échelle porte déjà 11, 12, 14, 15. Y
ajouter 9, 10 et 13 donnerait sept crans dans un intervalle de six points — un
continuum avec des noms, qui ne contraint rien.

Le remède est donc mécanique, pas conceptuel : ramener les emplois sur les crans
existants, à 0,74 pt de déplacement moyen — imperceptible.

**Armé le 17/08 :** `src/theme/__tests__/echelleTypo.guard.test.ts` fige le
compte à 1 162. Il ne peut plus monter, et la borne se resserre à mesure que la
migration avance. Un cliquet plutôt qu'un interdit — un interdit sur 1 162
emplois serait rouge dès le premier jour et se ferait désarmer dans la semaine.

### B5 · 327 espacements hors échelle

L'échelle est 4/8/12/16/24/36. Les écarts : 2 pt (×111), 6 pt (×57), 3 pt (×36),
40 pt (×22), 5 pt (×17), 1 pt (×15).

Les valeurs de 1 à 3 pt sont des filets et des ajustements optiques — légitimes.
**40 pt revient 22 fois** sans exister dans l'échelle : c'est un cran manquant,
pas une exception.

---

## JALON C — Les deux chantiers jamais ouverts

Derniers morceaux de la demande d'origine. Chacun pèse ce que l'écurie a pesé.

### C1 · Le coach et sa place dans l'app

Le domaine existe largement en base — `coach_*` couvre annotations, objectifs,
disponibilités, factures, file de traitement. Ce qui n'a jamais été tranché :
**ce que le pilote voit du coach**, et quand.

À poser avant d'écrire : le coach commente-t-il une séance passée, prépare-t-il
la suivante, ou les deux ? Le Principe 2 — *l'app est un miroir, pas un coach* —
demande que la réponse soit explicite, sans quoi le premier écran écrit fixera
la doctrine par accident.

### C2 · Liaison espace partenaire → compte pilote

`partner_accounts`, `partner_offers`, `partner_engagements`, `partner_leads`
existent. Ce qui manque : **ce qu'un pilote voit d'un partenaire dans son
compte**, et sous quelle règle de consentement.

Point de vigilance RGPD : une offre partenaire affichée au pilote suppose un
ciblage, donc une base légale. À arbitrer avant l'écran, pas après.

---

## Ordre recommandé

1. **A1** — armer les tests RLS. Tout le reste s'appuie sur des politiques non
   vérifiées, et l'écart grandit à chaque lot.
2. **A2 + A3** — tuiles et premier build Android. Rien de ce qui a été livré
   depuis la migration n'a été vu.
3. **B4** — ramener les tailles sur les crans existants. Chantier mécanique,
   0,74 pt de déplacement moyen, et le cliquet empêche déjà l'aggravation.
   À faire écran par écran, en descendant `PLAFOND` dans le même commit.
4. **C1 ou C2** — au choix, mais après une décision de doctrine écrite.

**B1, B2, B3, B5** sont gardés ou documentés : ils ne se dégraderont plus en
silence, et peuvent attendre.

---

## Ce que ces gardes changent

Trois ajouts du 17/08 font que ce document ne se périmera pas seul :

| Garde | Ce qu'elle empêche |
|---|---|
| `collisionsCouleurs.test.ts` | une douzième paire de couleurs trop proches, ajoutée sans mesure |
| `echelleTypo.guard.test.ts` | une taille de police de plus écrite en dur |
| `carteSansDonnee.guard.test.ts` | une couleur de donnée sur la carte, ou une carte dans la restitution |

C'est le motif que ce dépôt s'était déjà donné et qu'il oubliait d'armer :
`nameMyCrew`, `crews_public_rows`, `ramp.ts`, `ribbon.ts` — des règles écrites,
jamais tenues. Une règle sans garde finit toujours par être violée, et
généralement sans que personne le voie.
