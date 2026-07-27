# Vérifications préalables à la refonte V3

**26 juillet 2026** · lecture seule · constats, sans recommandation

Chaque affirmation porte son fichier et sa ligne. `INCONNU` figure partout où le
code n'établit pas la réponse, avec ce qui manquerait pour trancher.

---

## Q1 — Les six écrans « sans aucun import de service »

**La prémisse est fausse, et l'erreur vient de moi.** Les six écrans sont
câblés. Le constat de l'inventaire était un artefact de mon extracteur, pour
deux raisons cumulées :

1. **Les imports multi-lignes n'étaient pas détectés du tout.** La détection
   testait chaque ligne isolément contre `^import … from '@/…'`. Un import
   réparti sur plusieurs lignes — la forme dominante dans ce dépôt — n'a jamais
   de `from` sur la ligne qui porte `import`. Résultat : `vous/profil.tsx` et
   `vous/garage.tsx` ressortaient avec **zéro** import.
2. **`@/lib/queries/*` n'était pas compté comme source de données.** Les quatre
   écrans coach avaient bien des imports détectés (7 à 13), mais aucun ne tombait
   dans les catégories retenues, d'où le libellé trompeur.

`docs/INVENTAIRE_ECRANS.md` a été régénéré avec l'extracteur corrigé.

### Le câblage réel

| Écran | Sources de données établies |
|---|---|
| `app/(app2)/vous/profil.tsx` | `@/lib/queries/profil` (`:42`), `@/services/pilotMediaService` (`:48`), `@/features/vous/profilLogic` (`:61`) |
| `app/(app2)/vous/garage.tsx` | `@/services/garageService` (`:55`), `@/services/pilotMediaService` (`:61`), `@/features/vous/garageLogic` (`:76`) |
| `app/(coach)/demandes.tsx` | `@/services/coachMarketplaceService` (`:55`) |
| `app/(coach)/disponibilites.tsx` | `@/services/coachMarketplaceService` (`:58`) |
| `app/(coach)/calendrier.tsx` | `@/services/coachMarketplaceService` (`:46`) |
| `app/(coach)/comparer-pilotes.tsx` | `@/services/coachService` (`:55`) |

**Verdict pour les six : écran fonctionnel.** Chacun importe au moins un service
de données. `vous/garage.tsx` écrit bien via `addMyPilotMedia`, ce qui est
cohérent avec son import de `pilotMediaService` — l'incohérence relevée dans la
question n'existait que dans mon relevé.

### Les deux écrans réellement sans source de données

Après correction, deux écrans seulement n'importent aucun service, hook, magasin
ni requête :

- `app/(app2)/dev-galerie.tsx` — 764 lignes, **coupé hors développement**
  (garde `__DEV__`). Galerie de composants du kit.
- `app/(app2)/vous/document/[doc].tsx` — 199 lignes.

Pour ces deux-là, **INCONNU** : établir d'où viennent les valeurs affichées
demande de lire leur rendu ligne à ligne, ce que ce relevé n'a pas fait. Ce qui
manquerait : une lecture complète des deux fichiers.

---

## Q2 — `weatherCorrelationService`

**Ce n'est pas un coefficient de corrélation.** Le service joint des faits, il ne
calcule aucun lien de causalité.

L'en-tête (`src/services/weatherCorrelationService.ts:43-44`) le dit
explicitement : « chaque séance complétée est jointe à son meilleur tour
(`best_lap_seconds * 1000`) et à sa météo capturée ». C'est une **jointure**, pas
une inférence : une ligne par séance, portant côte à côte un chrono mesuré et une
météo mesurée.

Trois garanties sont posées dans le même en-tête :

- **Self-only** (`:5-7`) — ne lit que les séances du pilote courant, via
  `fetchAllSessions` et `weather_snapshots` filtrés sur ses `session_id`. Aucun
  accès coach, aucune donnée d'un autre pilote.
- **Strict** (`:9-11`) — une panne de base remonte comme une erreur, au lieu
  d'être masquée en agrégat vide « qui ressemblerait à aucune donnée ».
- L'agrégation vit dans `weatherCorrelationLogic.ts`, pur et testé (`:13-14`).

**INCONNU** : le contenu exact de `correlateWeather` dans
`weatherCorrelationLogic.ts` n'a pas été lu. Si une phrase ou une tendance y est
produite, elle s'y trouverait. Ce qui manquerait : la lecture de ce fichier.

---

## Q3 — `captureLinkStatusLogic`

Le module ne s'appelle pas comme la question le suppose : il vit dans
`src/services/captureLinkStatusLogic.ts`, et l'écran n'en importe qu'**une seule
fonction**, `captureLinkMessage` :

- `app/(app2)/rec/roulage.tsx:31`
- `app/(app)/roulage.tsx:23` (arbre gelé)
- testé par `src/services/__tests__/captureLinkStatusLogic.test.ts:5`

**INCONNU** — la question posée est : distingue-t-il un boîtier *connecté mais
silencieux* d'une *déconnexion* ? Le nom de la fonction importée suggère qu'elle
produit un message, pas un état, mais **je n'ai pas lu le fichier**. Ce qui
manquerait : la lecture de `captureLinkStatusLogic.ts` et de son test, qui
énumère probablement les cas.

---

## Q4 — Où vit l'éligibilité

**Table : `public.eligibility_items`**, créée par
`supabase/migrations/20260703200426_eligibility_items_hub02.sql:12`.

Son commentaire (`:25`) : « PR-HUB-02 — checklist éligibilité par réservation.
Écriture admin (validation) + système (seed/sync docs). GO = tout ok · NO-GO =
un refus · EN ATTENTE sinon. »

**Neuf items possibles**, contraints en base (`:15-16`) : `permis`, `cni`,
`assurance_circuit`, `controle_technique`, `pneus_freins`, `niveau_sonore`,
`casque`, `decharge`, `briefing`.

**Quatre statuts** (`:17`) : `pending`, `ok`, `refused`, `na`.

L'unité n'est pas le pilote mais **la réservation** : `registration_id` référence
`public.registrations` (`:14`), avec unicité `(registration_id, item_key)` (`:23`).

Consommateurs repérés dans le code :

- `src/features/rec/preparationLogic.ts`
- `src/features/miroir/miroirHomeLogic.ts` et `useMiroirHome.ts`
- `app/(app)/preparation.tsx` (arbre gelé)
- `supabase/migrations/20260703201330_eligibility_reminders_cron_hub02.sql`
  (tâche de relance)

**Qui écrit : INCONNU côté application.** La policy de lecture
(`eligibility_select_own`, `:28-30`) autorise l'admin ou le propriétaire de la
réservation. Le commentaire de table attribue l'écriture à l'admin et au système.
Aucun écran de `app/(app2)` n'a été trouvé qui écrive cette table. Ce qui
manquerait : lire les policies d'écriture et vérifier si le site les exerce.

---

## Q5 — `dataExportService`

**Portabilité RGPD, article 20.** L'en-tête est sans ambiguïté
(`src/services/dataExportService.ts:2`) : « Service export de données — droit à
la portabilité (S2, charte 12 / RGPD art. 20) ».

Ce qu'il produit (`:4-7`) : un **JSON structuré**, lisible par machine, écrit
dans un fichier et partagé par la feuille de partage native. Export entièrement
côté application, sans backend ni courriel — la RLS autorisant déjà le pilote à
lire ses propres lignes.

Périmètre (`:9-10`) : profil, sessions, analyses, segments, insights, tours,
médias, partages.

**Exclusion explicite** (`:10-13`) : les trames brutes `telemetry_frames`
(25 Hz, volumineuses) sont hors de l'export automatique. Leur conservation est
bornée à douze mois, et elles peuvent être fournies sur demande à
`contact@oxvehicle.fr`.

Ce n'est donc **pas** un CSV télémétrique de séance.

---

## Q6 — `reglagesRitualsLogic`

Fichier : `src/features/vous/reglagesRitualsLogic.ts`, en-tête `:2` — « Logique
PURE des rituels de notification B3 (lot V2-L4, mission D) ».

**Les « rituels » sont des préférences fines de notification**, stockées dans le
JSONB existant `users.notification_preferences` (`:4-6`) — aucune colonne nouvelle,
au même endroit que les canaux déjà lus par les planificateurs.

Chaque rituel a sa clé dans ce JSONB :

- `bilan` → `debrief` (`:8-10`) — canal **déjà programmé** (« votre bilan est
  prêt », J+1, `pushNotificationsService`). Le commentaire insiste : « pas un
  canal fantôme, la préférence agit vraiment ».
- `j3` → `ritual_j3` (`:11-12`) — le rappel J-3, bandeau d'accueil B3.

**INCONNU** : la liste complète des rituels au-delà de ces deux-là. Ce qui
manquerait : la lecture du reste du fichier (l'en-tête est tronqué à la douzième
ligne dans ce relevé).

---

## Q7 — `referralService`

Fichier : `src/services/v2/referralService.ts`, en-tête `:2` — « Service
parrainage & écuries (A3) — v2 ».

**Il ne crée ni n'écrit aucune table en direct** (`:4-7`). Il s'adosse
intégralement à des fonctions serveur déjà en production, documentées dans
`docs/architecture/12_CREWS_PROD.md`. Toute la logique de rattachement vit dans
la fonction `SECURITY DEFINER` `oxv_redeem_referral`, décrite comme
« fail-closed par construction ».

RPC consommées (`:9-11`) :

- `oxv_get_my_referral_code()` → `text` — le code d'affiliation de l'appelant
- `oxv_redeem_referral(p_code)` → `jsonb` — `{ok, crew_id}` ou `{ok:false, error}`

Le code d'affiliation est donc porté par `users.affiliation_code`, et le
rattachement crée ou rejoint une **écurie** (`crew`).

Consommateur établi : `app/(app2)/rec/preparation.tsx:55`.

**INCONNU** : l'avantage attaché au parrainage. Aucun élément du service ne le
décrit ; il relèverait des fonctions serveur ou du produit. Et **`crews` comme
`crew_members` sont à zéro ligne en production**, relevé du 26/07/2026.

---

## Q8 — Le canal du relais biométrie

**Le canal** : `live:session:<sessionId>`, canal privé Realtime, gardé par RLS
sur le binôme consenti. La biométrie y voyage sur un événement dédié,
`biometry`, jamais sur `frame` ni sur le roster.

**Qui s'y abonne** : la fiche direct du coach et le marqueur cardio du roster —
deux consommateurs du **même topic**. C'est pourquoi le topic est refcompté dans
`src/services/liveSessionService.ts` : `supabase-js` dédoublonne les canaux par
topic, et sans comptage le premier `removeChannel` arrachait le canal à l'autre.

**La règle « tout ou rien » existe bien dans le code.**
`src/services/liveRelayRunner.ts:326` :

```js
const tousDetailles = coaches.length > 0 && coaches.every((c) => c.detailed);
```

Elle alimente `detailedBinome` (`:329`), lui-même consommé par
`canEmitBiometry` (`:344`, importé de `@/services/v2/liveHealthGate` à `:32`) :
`if (!canEmitBiometry(gate)) return;` — fail-closed, aucune biométrie ne part.

La raison est structurelle et non prudentielle : **la biométrie voyage sur le
canal de séance, partagé par tous les coachs consentis**. On ne peut donc pas la
réserver à certains au moment de l'émission. Tant que ce canal est commun, la
seule position tenable est tout ou rien.

Sur l'enjeu soulevé — un seul coach actif par journée : le code ne connaît pas
la notion de « coach du jour ». `coaches` est l'ensemble des coachs consentis et
à l'écoute. Si l'usage garantit qu'il n'y en a qu'un, la règle devient sans
objet **en pratique**, mais elle reste la seule garantie **en droit** tant que le
canal est partagé. La réponse propre serait un canal par coach
(`live:bio:<coachId>:<sessionId>`), non implémenté.

---

## Q9 — Le déclencheur `oxv_coach_availability_open_gate`

Créé par
`supabase/migrations/20260718111150_validation_admin_coach_partenaire_site.sql`,
lignes 60-63. Également touché par
`supabase/migrations/20260719011206_sec1_d_search_path_revokes.sql` (durcissement
du `search_path`).

Ce qu'il fait, littéralement :

```sql
IF TG_OP = 'INSERT' AND NEW.status = 'open' THEN
  NEW.status := 'closed'; -- créneau proposé → en attente de validation OXV
ELSIF TG_OP = 'UPDATE' AND NEW.status = 'open' AND OLD.status IS DISTINCT FROM 'open' THEN
  NEW.status := OLD.status; -- ouverture réservée à l'admin
END IF;
```

**Un coach ne peut jamais ouvrir un créneau lui-même.** À l'insertion, un statut
`open` est rabattu sur `closed`. À la mise à jour, un passage vers `open` est
annulé et le statut précédent restauré. Les commentaires de la migration disent
le motif : le créneau proposé attend une validation OXV, et l'ouverture est
réservée à l'administration.

**Aucun message n'est renvoyé au coach** : la valeur est réécrite en silence, pas
rejetée par une exception.

---

## Q10 — La détection des entrées était fausse (elle l'était)

**Confirmé, et c'est encore mon extracteur.** Les six écrans coach sont
atteignables. `app/(coach)/index.tsx` déclare une table d'outils dont chaque
entrée porte une propriété `route`, **au milieu d'une ligne** :

| Écran | Déclaration |
|---|---|
| `demandes` | `app/(coach)/index.tsx:299` |
| `comparer-pilotes` | `:306` |
| `cycles` | `:310` |
| `reperes` | `:315` |
| `gabarits` | `:317` |
| `assistant` | `:318` |
| `lecture` | `:319` |
| `ar` | `:320` |
| `roulages` | `:327` |
| `business` | `:335` |
| `facturation` | `:343` |

**La navigation réelle** : `app/(coach)/index.tsx:514` —
`<ToolTile tool={tool} onPress={() => router.push(tool.route as never)} />`.
Une grille de tuiles sur l'accueil coach.

Mon filtre exigeait que la déclaration commence la ligne. Il a été élargi aux
propriétés d'objet.

**`app/(app2)/club/coaching`** est également atteignable, par deux chemins :

- `app/(app2)/club/index.tsx:159` — `const COACHING_HREF = '/(app2)/club/coaching'`
- `app/_layout.tsx:135` — `router.push('/(app2)/club/coaching' as never)`, sur
  la notification « un coach vous suit »

### Liste corrigée des orphelins réels

Vérifiés par recherche directe : aucune ligne de `app/` ni `src/` ne les cite
dans un contexte de navigation, de table de routes ou de propriété `route`.

| Route | Fichier | Lignes |
|---|---|---|
| `/(app2)/club/galerie` | `app/(app2)/club/galerie.tsx` | 1 003 |
| `/(app2)/club/territoire` | `app/(app2)/club/territoire.tsx` | 1 428 |
| `/(app2)/data/saison` | `app/(app2)/data/saison.tsx` | 1 308 |
| `/(app2)/dev-galerie` | `app/(app2)/dev-galerie.tsx` | 764 · garde `__DEV__` |

**Volume : 4 503 lignes**, dont 3 739 hors écran de développement.

Côté coach : **aucun orphelin**. Les six candidats sont tous reliés par la
grille d'outils.

**Réserve honnête** : mon extracteur, même corrigé, continue de ne pas rattacher
ces entrées dans son propre relevé — la cause n'a pas été trouvée. La liste
ci-dessus a donc été établie **à la main**, par recherche directe, et c'est elle
qui fait foi. La section « orphelins » de `docs/INVENTAIRE_ECRANS.md` reste
inexacte sur le volet coach ; celle-ci la remplace.

---

## Q11 — `src/circuit/hauteSaintonge.ts`

**Il porte de la géométrie, pas des noms.** 160 lignes.

En-tête (`:3-8`) : « Circuit de Haute Saintonge (La Genétouze) — OSM way
54412766 « Piste vitesse ». Points bruts (lat/lon) servant à générer la géométrie
via `generateCircuit()`. Tracé fermé (73 points). Détection : 7 virages par
courbure (specs v4 §05). Source : OpenStreetMap. © contributeurs OpenStreetMap
(ODbL). »

Ce qu'il exporte :

- `HAUTE_SAINTONGE_OSM_WAY_ID = 54412766` (`:10`)
- `HAUTE_SAINTONGE_CLOSED = true` (`:12`)
- `HAUTE_SAINTONGE_POINTS: LatLon[]` (`:14`) — **73 points lat/lon**, à sept
  décimales, par exemple `{ lat: 45.2428731, lon: -0.0958743 }`

**Une licence est attachée.** Les points viennent d'OpenStreetMap sous ODbL.
Toute remontée en base transporte cette obligation d'attribution.

Les **noms** de virages vivent ailleurs, dans `src/lib/circuitTopology.ts`
(`BELTOISE_CORNERS`), avec leurs apex et un profil. Ce sont deux fichiers
distincts.

---

## Q12 — Le schéma d'éligibilité peut-il porter sa provenance

`CREATE TABLE` actuel, `supabase/migrations/20260703200426_eligibility_items_hub02.sql:12-24` :

```sql
create table public.eligibility_items (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  item_key text not null check (item_key in
    ('permis','cni','assurance_circuit','controle_technique','pneus_freins','niveau_sonore','casque','decharge','briefing')),
  status text not null default 'pending' check (status in ('pending','ok','refused','na')),
  note text,
  document_id uuid references public.documents(id),
  validated_by uuid references public.users(id),
  validated_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (registration_id, item_key)
);
```

**Deux des trois colonnes demandées existent déjà, sous un autre nom :**

| Demandé | Existant | Type |
|---|---|---|
| `checked_by` | `validated_by` | `uuid references public.users(id)` |
| `checked_at` | `validated_at` | `timestamptz` |
| `declared_at` | **absent** | — |

Il manque donc **une seule colonne** : `declared_at`, la date à laquelle le
pilote déclare l'item, distincte de la date à laquelle l'administration le
valide. La table porte déjà la validation, pas la déclaration.

---

## Q13 — Marge et QDI

**INCONNU — et le constat partiel est en soi une réponse.**

Recherche des termes `margin` et `marge` dans `src/services/qdiLogic.ts` :
**aucune occurrence**. Le module de calcul du QDI n'emploie ni l'un ni l'autre.

`src/services/qdiService.ts` expose `computeAndPersistQdi(sessionId)` (`:40`),
`getQdiForSession` (`:88`), `getOrComputeQdiForSession` (`:105`),
`getQdiReference` (`:124`), `listMonthlyQdi` (`:209`), `getQdiAccessLevel`
(`:300`). Aucune de ces signatures ne mentionne la marge.

Ce qui est donc établi : **le QDI ne consomme pas la marge par un chemin nommé**.

Ce qui reste `INCONNU` : les deux peuvent partager une **entrée commune** en
amont — les mêmes trames, les mêmes segments — sans que le mot n'apparaisse. La
marge est produite par `analyzeTrackVizSession` et persistée dans
`app_segment_analyses` ; le QDI est persisté dans `app_session_analyses`. Savoir
s'ils partent des mêmes grandeurs demande de lire `qdiLogic.ts` en entier et de
le confronter à `src/trackviz/analysis.ts`.

Ce qui manquerait pour trancher : la lecture de ces deux fichiers, et de tout
appelant écrivant `app_session_analyses`. Ce relevé ne l'a pas fait.

---

## Q14 — Reconnaissance technique

Ce point a été traité en détail dans `docs/T0_reconnaissance.md` (26/07/2026).
Rappel des faits établis.

### Les trois dépendances à usage inconnu

**`three` / `@react-three/fiber` / `expo-gl`** — un seul fichier les importe :

- `src/circuit/CircuitTrace.tsx:18` — `@react-three/fiber/native`
- `src/circuit/CircuitTrace.tsx:19` — `three`
- `expo-gl` n'est **dans aucun import** : sa seule occurrence est un commentaire
  (`:4`). Il est tiré transitivement par `fiber`.

Ce composant est monté par `src/circuit/CircuitTraceHero.tsx:24` et `:96`,
lui-même monté par `app/(app)/circuit/[id].tsx:20` et `:103`. Montages directs :
`app/(app)/creer-trace.tsx:22`/`:129` et `app/(app)/debug-circuit.tsx:14`/`:33`.
**Tous dans l'arbre gelé.** Aucun écran de `(app2)` ne les importe — les symboles
`CircuitTraceFallback` de `(app2)` sont des replis plats locaux, sans rapport.

Poids : `three` 29 Mo, `@react-three/fiber` 996 Ko, `expo-gl` 770 Ko.

**`react-native-maps`** — trois écrans :

- `app/(app)/carte-oxv.tsx:47` — `MapView, { Marker, PROVIDER_DEFAULT }`
- `app/(app)/creer-route.tsx:50` — import multi-lignes
- `app/(app2)/club/territoire.tsx:36` — `MapView, { Marker, PROVIDER_DEFAULT }`

Seule des trois à avoir un consommateur dans l'arbre actif. Poids 1,3 Mo.

**`react-native-webview`** — un seul écran :

- `app/(coach)/ar.tsx:65` — `WebView`
- `app/(coach)/ar.tsx:70` — types depuis `react-native-webview/lib/WebViewTypes`

Encapsule la page servie par `https://app.oxvehicle.fr/ar-view`. Poids 876 Ko.

### Surface d'appel des six dépendances à risque

| Dépendance | Fichiers importateurs | Détail établi |
|---|---|---|
| `react-native-svg` | **79** | `src/components/` 25 · `app/(app2)/` 25 · `app/(app)/` 19 · `app/(coach)/` 7 · `src/ui/` 4 · `src/ui/v2/` 3 |
| `react-native-reanimated` | **61** | `useSharedValue` 36 · `runOnJS` 17 · `useDerivedValue` 3 · `measure` 2 · `runOnUI` 1 · `useAnimatedReaction` 1 · `useFrameCallback` 1 · `scrollTo` 1 · `createWorkletRuntime` **0** |
| `@shopify/react-native-skia` | **23** | `Canvas`, `Skia`, `Path`, `Group`, `Circle`, `Rect`, `Points`, `Image`. `Vertices`, `Atlas`, `RuntimeEffect`, `Picture`, `useFont` : **zéro occurrence** |
| `expo-av` | **2** | `Audio` seulement — `src/services/coachAudioService.ts:14` (valeur) et `app/(coach)/annoter.tsx:66` (type). Aucun usage vidéo |
| `react-native-mmkv` | **1 direct** | `src/lib/mmkv.ts:13`, instance partagée `:15`. **15 fichiers** consomment cette instance |
| `expo-font` | **INCONNU** | Non recensé. `src/theme/fonts.ts:1` importe `useFonts` ; le nombre total de fichiers important `expo-font` n'a pas été compté |

Rappel de deux faits établis en T0 et qui pèsent ici : la file de synchronisation
de capture repose sur `expo-file-system` (`src/services/captureSyncQueue.ts:100`)
et **non sur MMKV** ; et `babel.config.js` ne déclare qu'un plugin,
`react-native-reanimated/plugin`, celui-là même qui change de nom en Reanimated 4.

---

## Ce que ce document corrige de mon propre travail

Deux constats de `docs/INVENTAIRE_ECRANS.md` étaient faux, tous deux par défaut
d'extraction et non par défaut du code :

1. **Six écrans déclarés sans source de données** l'étaient à cause des imports
   multi-lignes non détectés et d'une catégorisation trop étroite. Corrigé,
   inventaire régénéré.
2. **Six écrans coach déclarés orphelins** le sont restés dans le relevé
   automatique alors qu'ils sont reliés par la grille d'outils de l'accueil
   coach. La liste des orphelins qui fait foi est celle de Q10, établie à la
   main.

---

*Relevé produit en lecture seule. Aucun fichier du dépôt modifié hors celui-ci et
la régénération de `docs/INVENTAIRE_ECRANS.md`.*
