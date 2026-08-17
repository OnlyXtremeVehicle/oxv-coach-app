# Handoff site — service de tuiles, et deux avis sur la base partagée

**Destinataire :** équipe `oxv-site`
**Émetteur :** application OXV Mirror
**Date :** 17/08/2026
**Dépôt applicatif :** branche `migration/sdk-55`

Ce document contient **une demande** et **deux avis**. La demande bloque une
fonctionnalité de l'application ; les avis n'appellent aucune action de votre
part, mais vous concernent parce qu'ils touchent des tables que vous lisez.

À lire avec [`09_HANDOFF_SITE_BASE_PARTAGEE.md`](09_HANDOFF_SITE_BASE_PARTAGEE.md),
qui pose le cadre général de la base partagée.

---

## 1 · LA DEMANDE — un service de tuiles vectorielles

### Pourquoi elle existe

L'application a migré ses deux écrans cartographiques d'Apple Maps / Google Maps
vers **MapLibre**, avec un fond de plan écrit à la charte OXV.

Le motif n'est pas le coût — les SDK mobiles de Google facturent l'affichage de
carte à zéro. Il est que **ni Apple ni Google ne laissent styler leur carte**.
`PROVIDER_DEFAULT` rendait Apple Maps sur iOS et Google Maps sur Android : deux
fonds différents, aucun des deux conforme à la charte, sur un produit dont le
dépôt teste ses rapports de contraste.

Le fond vient donc de tuiles **Protomaps auto-hébergées** — décision fondateur.
Aucune position de pilote ne part chez un tiers, ce qui aligne la carte sur le
choix déjà fait pour GraphHopper (hébergement européen).

### Le point technique qui rend ce service obligatoire

**MapLibre Native ne lit pas le format `.pmtiles`.** Vérifié le 17/08/2026 :

| Contrôle | Résultat |
|---|---|
| Occurrences de `pmtiles` dans `@maplibre/maplibre-react-native` 11.3.6 | **0** |
| SDK natif embarqué | MapLibre Native **6.26.0** |
| Moyen d'enregistrer un protocole depuis JavaScript | **aucun exposé** |

`addProtocol`, qui règle le problème en trois lignes dans MapLibre **GL JS**,
n'existe pas côté natif : le rendu se fait hors du moteur JavaScript.

**Il ne s'agit donc pas d'un cache ni d'une optimisation.** Sans ce service,
l'application n'a aucun fond de carte.

### Ce qui est attendu

Un point d'entrée HTTP qui sert des tuiles vectorielles au format standard.

```
GET https://<votre-domaine>/api/tiles/{z}/{x}/{y}.mvt
```

| Aspect | Attendu |
|---|---|
| Réponse 200 | corps = la tuile MVT (protobuf), `Content-Type: application/vnd.mapbox-vector-tile` |
| Tuile absente | **204 No Content** — voir la note ci-dessous |
| Compression | `Content-Encoding: gzip` si les tuiles sont stockées gzippées |
| Cache | `Cache-Control: public, max-age=86400` au moins — le fond change rarement |
| CORS | inutile pour l'app mobile ; à ajouter si le site affiche la même carte |
| Authentification | **aucune** (voir « questions ouvertes ») |

**Le 204 n'est pas un détail.** Une zone sans données doit répondre 204, jamais
404 ni 500. MapLibre traite le 204 comme « rien à dessiner ici » et continue ;
sur une erreur, il réessaie en boucle et l'écran se fige sur une zone vide de
mer ou de campagne.

### Le fichier source

Le `.pmtiles` est un fichier unique lu par **requêtes de plage HTTP**
(`Range: bytes=…`). Le service traduit `{z}/{x}/{y}` en offset, lit la plage, et
renvoie la tuile. La spécification du format est publique et il existe des
bibliothèques de lecture pour Node.

Deux hébergements possibles, à votre main :

- **stockage objet + fonction serverless** — le `.pmtiles` sur un bucket, la
  fonction fait les lectures par plage. Pas de fichier dans le dépôt ;
- **fichier servi directement** si votre hébergeur honore les requêtes de plage,
  la fonction se réduisant au calcul d'offset.

Le fichier n'est **pas produit par l'application** ; sa fabrication (extrait
Nouvelle-Aquitaine ou France) reste à faire côté OXV.

### Comment brancher l'application

Une variable, la **base** du service, **sans** le motif de chemin — le style
ajoute lui-même `/{z}/{x}/{y}.mvt` :

```
EXPO_PUBLIC_TILES_URL=https://oxvehicle.fr/api/tiles
```

Tant qu'elle est vide, l'application rend le fond titane et rien d'autre. C'est
un état prévu et volontaire, pas une panne : une URL morte produirait des
erreurs réseau en boucle.

### Un point à vérifier ensemble au premier essai

Le style applicatif nomme les couches selon le **schéma « basemap » de
Protomaps** : `earth`, `water`, `roads`, `buildings`.

Si le `.pmtiles` est généré avec un autre schéma — OpenMapTiles porte
`transportation` là où celui-ci porte `roads` — **les couches concernées
resteront invisibles, sans la moindre erreur pour le signaler.** Une carte
presque vide sur un service qui répond 200 est le symptôme à reconnaître.

Communiquez-nous le schéma retenu ; l'ajustement se fait côté application, dans
un seul fichier (`src/features/carte/styleOxv.ts`).

### Attribution — non négociable

Les tuiles dérivent d'OpenStreetMap, sous **ODbL**. L'auto-hébergement
n'affranchit pas de la licence. L'application affiche déjà
`© OpenStreetMap, © Protomaps` et conserve le bouton d'attribution de MapLibre.
Si le site affiche la même carte, il doit faire de même.

### Questions ouvertes, à trancher ensemble

1. **Faut-il protéger le service ?** Il sert des données OSM publiques, donc
   rien de confidentiel — mais une URL ouverte peut être consommée par
   n'importe qui, à vos frais de bande passante. Un jeton ou une restriction
   par `Referer`/origine est possible ; l'application peut porter un jeton dans
   l'URL si vous le souhaitez.
2. **Quelle emprise géographique ?** La Nouvelle-Aquitaine suffit à l'usage
   actuel (circuit de Haute-Saintonge et ses routes). La France entière pèse
   plus lourd mais évite un second chantier si l'activité s'étend.
3. **Quel niveau de zoom maximal ?** Le style est réglé sur `maxzoom: 14`. Un
   fichier généré au-delà fonctionne (MapLibre sur-zoome la dernière tuile) ;
   en deçà, les niveaux fins seront vides.

---

## 2 · LA DEMANDE — une carte de partage pour le trajet d'écurie

### Ce qui existe côté application

Depuis le 17/08/2026, une sortie d'écurie porte un trajet composé :

```
Place de Pons → La Table du Cognac → Circuit de Haute Saintonge
```

Rendez-vous posé par recherche d'adresse, étape restaurant optionnelle,
circuit en destination. Le capitaine veut pouvoir l'envoyer à son écurie — dans
un message, sur un réseau — et que le lien s'ouvre sur une **vignette**, pas sur
une URL nue.

### Ce qui est demandé

Une page publique par sortie, portant ses métadonnées Open Graph :

```
GET https://<votre-domaine>/sortie/<id>
```

```html
<meta property="og:title"       content="Sortie de l'écurie <nom>" />
<meta property="og:description" content="Place de Pons → La Table du Cognac → Circuit de Haute Saintonge" />
<meta property="og:image"       content="https://<votre-domaine>/sortie/<id>/og.png" />
<meta property="og:type"        content="website" />
```

L'image est générée à la volée — 1200 × 630 — et montre le tracé sur fond OXV.

### Trois règles, et elles ne sont pas négociables

**La vignette ne porte aucune donnée de conduite.** C'est une décision fondateur
et elle vaut pour vous aussi : ni chrono, ni vitesse, ni « meilleur tour », ni
aucune des cinq couleurs QDI. La carte OXV sert l'identité et le territoire — la
restitution a son propre moteur, et il ne sort pas de l'application.

Le tracé se peint donc en **crème `#E8E9ED`** sur le fond titane `#14151A`, et
les repères dans la palette de carte (`src/features/carte/paletteCarte.ts` :
point de vue `#E8E9ED`, eau `#8FA6C4`, col `#A783F2`, sommet `#E091B8`). L'or est
réservé au chrono : il n'apparaît pas.

**Aucune donnée personnelle dans la page publique.** Le nom de l'écurie et les
étapes du trajet, rien d'autre. Ni la liste des pilotes, ni qui a répondu quoi,
ni l'adresse exacte du rendez-vous si elle est un domicile — le libellé de ville
suffit à une vignette.

**La page est publique, la sortie ne l'est pas.** Un identifiant de sortie ne doit
pas permettre de lire la table `convoys` : servez la page depuis un **jeton de
partage** distinct de l'identifiant, ou depuis une projection figée au moment du
partage. Le dépôt a déjà ce motif — `app_progression_shares` et le correctif L31
(« le jeton de partage vient de la base, plus de `Math.random` »).

### Ce que l'application vous fournira

Rien pour l'instant, et c'est le point à trancher ensemble. Deux voies :

- **l'application appelle une fonction** au moment du partage, en passant nom
  d'écurie, étapes et polyligne, et reçoit une URL — la sortie n'a alors pas
  besoin d'être lisible depuis le site ;
- **le site lit `convoys`** par un jeton — moins d'aller-retour, mais il vous
  faut alors un accès en lecture à une table applicative, ce que le cadre de la
  base partagée invite à éviter.

Je recommande la première : elle garde la frontière nette et ne demande aucune
politique RLS nouvelle.

---

## 3 · AVIS — une fonction serveur écrit dans `registrations`

**Aucune action attendue.** Signalé parce que vous lisez cette table pour
l'espace client.

La migration `20260817021552` a déployé
`public.oxv_use_heritage_session(p_registration_id uuid)` — `SECURITY DEFINER`,
exécutable par `authenticated`.

Ce qu'elle fait, en une transaction :

- vérifie que l'inscription appartient à l'appelant ;
- vérifie qu'il a été **invité par son écurie** sur cette journée ;
- verrouille la ligne du pack (`SELECT … FOR UPDATE`), incrémente
  `heritage_packs.sessions_used` ;
- écrit `registrations.heritage_pack_id`.

**Ce qui vous concerne :** `registrations.heritage_pack_id` peut désormais
passer de `NULL` à une valeur **sans passage par le site**. Si votre espace
client suppose que ce lien n'est écrit qu'au moment de l'achat, l'hypothèse ne
tient plus.

Le verrou sérialise les appels concurrents : deux inscriptions simultanées sur
le dernier crédit n'en consomment qu'un. Une inscription déjà réglée par un pack
est refusée (`deja_consomme`).

---

## 4 · AVIS — nouvelles colonnes, aucune rupture

**Aucune action attendue.** Toutes les colonnes ajoutées sont **nullables** ou
portent un défaut ; aucune colonne n'a été renommée ni supprimée.

| Table | Ajouts |
|---|---|
| `crews` | `insigne_catalogue_key`, `insigne_image_path`, `insigne_status`, `insigne_updated_at`, `insigne_reviewed_at`, `insigne_reviewed_by` |
| `convoys` | `crew_id`, `restaurant_id` (nullables — le convoi libre existe toujours) |
| `convoy_participants` | `status` (défaut `'present'`), `invited_by`, `responded_at` |

Deux types énumérés créés : `crew_insigne_status_enum`
(`en_attente｜valide｜refuse`) et `convoy_participant_status_enum`
(`invite｜present｜decline`).

Un bucket Storage `crew-insignes`, **non public**, avec lecture conditionnée à
`crews.insigne_status = 'valide'` — une image téléversée n'est visible des
autres écuries qu'après validation.

**Le défaut `'present'` sur `convoy_participants.status` est délibéré.** Les
lignes existantes sont des pilotes ayant rejoint un convoi de leur propre chef ;
un défaut `'invite'` les aurait transformés rétroactivement en invitations sans
réponse.

**Modération à prévoir, côté OXV :** rien ne fait passer un insigne de
`en_attente` à `valide` aujourd'hui. Tant qu'aucun outil n'existe, une image
téléversée reste visible de sa seule écurie. Ce n'est pas un défaut — c'est le
comportement fail-closed voulu — mais c'est un travail à ouvrir.

---

## 5 · Récapitulatif

| # | Sujet | Pour vous | Bloquant |
|---|---|---|---|
| 1 | Service de tuiles | **à construire** | **oui** — pas de fond de carte sans lui |
| 2 | Page + vignette Open Graph de la sortie | **à construire** | non — confort de partage |
| 3 | `oxv_use_heritage_session` | information | non |
| 4 | Colonnes écurie / convoi | information | non |

**Le chemin critique est le point 1**, et il dépend d'abord d'une décision OXV :
produire le `.pmtiles` et choisir son hébergement. Le service ne peut pas être
écrit avant.

Le point 2 est indépendant du 1 — la vignette se dessine côté serveur, sans
tuiles — et peut donc avancer en parallèle. Il demande une décision : l'app
pousse le trajet, ou le site le lit par jeton. Je recommande la première.

Côté application, tout est prêt : les deux écrans sont sur MapLibre,
`react-native-maps` est retiré, et il ne manque que `EXPO_PUBLIC_TILES_URL`.

**Réserve à connaître :** rien de la carte n'a encore été vu à l'écran. MapLibre
est un module natif, et le quota de builds iOS est épuisé jusqu'au 1er
septembre. Le premier regard réel passera par un build Android.
