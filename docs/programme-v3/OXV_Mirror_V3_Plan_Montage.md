# OXV Mirror V3 — Plan de montage

**27 juillet 2026** · Destiné à Claude Code
Ordre de construction par **dépendances réelles**, non par numérotation.

**Documents de référence, à lire avant chaque jalon :**

| Document | Contenu |
|---|---|
| `OXV_Mirror_V3_Dossier_Travail_v3.md` | doctrine, connexions entre espaces, lots |
| `OXV_Dossier_Avocat.md` | les 8 pièces de consultation juridique |
| `OXV_Dossier_Raccordement_Site.md` | les 22 demandes au site, par ordre d'urgence |
| `OXV_Mirror_V3_Dossier_Conception.md` | typographie, dimensions, couleur, mouvement, pile de rendu |
| `OXV_Mirror_V3_Arbre_Pilote.md` | les 37 routes pilote, écran par écran |
| `OXV_Mirror_V3_Arbre_Coach.md` | les 36 routes coach, écran par écran |
| `OXV_Mirror_V3_Banque_Telemetrie.md` | canaux RaceBox, formules, visualisations, méthode du coach |

---

# RÈGLES DE TRAVAIL

**Une branche par jalon.** `migration/sdk-55`, `socle/rendu`, `produit/rec`, etc.

**Compiler et lancer sur appareil réel à chaque fin de lot.** Un simulateur ne révèle ni la performance, ni le Bluetooth, ni HealthKit, ni la lisibilité au soleil.

**Ne jamais élargir le périmètre d'un lot.** Si un défaut apparaît hors périmètre, le consigner dans `docs/DETTE.md` et continuer.

**Aucun écran n'est touché pendant les jalons techniques.** T0 et T1 sont des migrations et des modules — pas des refontes.

**Étiquetage obligatoire dès le socle de calcul.** Toute grandeur porte `mesure` ou `derivation`. `null` s'affiche « — », jamais zéro. L'interprétation n'existe pas dans le code.

**Base distance partout.** Toute comparaison passe par un ré-échantillonnage sur grille curviligne commune. Jamais en base temps.

---

# JALON 0 — CE QUI BLOQUE TOUT

## 0.1 · La sauvegarde — **absolument bloquant**

```bash
git log origin/main..HEAD --oneline | wc -l   # doit afficher 0
```

**Cent trente commits ne sont pas poussés.** Une migration de quatre majeures sur un dépôt local non sauvegardé est irrécupérable — et la nouvelle architecture est un point de rupture où des bibliothèques natives peuvent casser sans retour possible. **Rien ne commence avant.**

### Les six étapes

**1 · Constater sans rien modifier.** `git status` · `git log origin/main..HEAD --oneline` · `git stash list` · `git branch -a`. Consigner dans `docs/ETAT_DEPOT.md` : nombre exact de commits, étendue temporelle, fichiers non commités, remises en attente, branches locales sans distant.

**2 · Traiter le non commité.** Ce qui est cohérent part en commit · ce qui est expérimental part en branche `wip/<sujet>`, **poussée elle aussi** · ce qui est mort est supprimé après avoir été listé. **Une remise non poussée est du travail invisible et perdable — la vider.**

**3 · Vérifier qu'aucun secret ne part.**

```bash
git log origin/main..HEAD -p | grep -inE "(supabase|anon|service_role|sk_|pk_|api[_-]?key|secret|password|token)" | head -50
```

**Si un secret apparaît, s'arrêter immédiatement** — le retirer d'un historique déjà écrit demande une réécriture, et la clé doit de toute façon être révoquée. Vérifier aussi que `.gitignore` couvre `.env`, `.env.local`, `google-services.json`, `GoogleService-Info.plist` et les fichiers de signature iOS.

**4 · Pousser.** En cas de divergence, **ne pas forcer** — établir ce qui diffère et le consigner.

**5 · Poser le point de retour.**

```bash
git tag -a pre-migration-sdk55 -m "État avant migration Expo 51 → 55, 27 juillet 2026"
git push origin pre-migration-sdk55
```

**C'est ce à quoi vous reviendrez si T0 échoue. Sans elle, il n'y a pas de retour.**

**6 · Créer la branche, et la pousser tout de suite.** Une branche locale de migration qui vit trois semaines sans sauvegarde reproduit exactement le problème qu'on vient de résoudre.

**Règle** : ce lot **ne réécrit aucun historique**, ne fusionne aucun commit, ne renomme aucune branche. Il met à l'abri ce qui existe. **Un dépôt en désordre mais sauvegardé vaut infiniment mieux qu'un dépôt propre et perdu.**

## 0.2 · Les correctifs d'une ligne

Annexe A du dossier de travail. Scan doctrinal — 75 faux positifs `tap` et `swipe` · CRLF dans `profil.tsx` · en-tête de `_layout.tsx`.

**Coût : une heure. Gain : le scan doctrinal redevient utilisable.**

## 0.3 · Les données de circuit

**0.G** — `corners-v1` sur Valence et Charente. Rayon d'arrivée de Valence porté de **10 à 15–20 m**.
**0.H** — suppression de La Charade : **la séance de télémétrie d'abord** (`circuit_id → null`, `circuit_name` conservé), la ligne de circuit ensuite.

*Dépendance terrain* : les données `corners-v1` viennent de l'extérieur.

## 0.4 · Ce qui part chez d'autres — **à envoyer aujourd'hui**

| Destinataire | Document | Ce qui bloque |
|---|---|---|
| **Responsable du site** | `OXV_Dossier_Raccordement_Site.md` — **22 demandes** | **D-01 les 43 journées disparues** et **D-02 les cinq sauvegardes** bloquent tout le reste |
| **Avocat** | `OXV_Dossier_Avocat.md` — **8 pièces** | la **décharge**, sans laquelle aucun pilote ne roule ; le **mandat d'encaissement**, sans lequel l'économie coach ne s'ouvre pas |
| **Circuit / terrain** | `corners-v1` sur Valence et Charente · une séance de télémétrie à Valence · rayon d'arrivée porté de 10 à **15–20 m** | la segmentation par virage |
| **Greffe / expert-comptable** | **le SIRET** | Stripe, l'encaissement coach, Tap to Pay, le tunnel de paiement |

**Ces quatre ont des délais que vous ne contrôlez pas et sont indépendants du code.**

## 0.5 · La règle de sécurité, valable dès maintenant

**Aucune migration destructive — `DROP`, `TRUNCATE`, `DELETE` massif — tant que D-01 et D-02 ne sont pas tranchés.**

Une table à une ligne alors qu'une sauvegarde en porte quarante-quatre est le signe qu'une opération s'est mal passée. **Il ne faut pas en ajouter une seconde.**

---

# JALON 1 — TECHNIQUE

## T0 · Migration SDK 51 → 55 — **bloque tout le reste**

Détail complet : dossier de travail, section IX, Phase T.

| Étape | Objet | Vigilance |
|---|---|---|
| 1 | **Nettoyage** — retirer `three` (29 Mo), `@react-three/fiber`, `expo-gl` | vérifier d'abord qu'aucun import n'existe hors arbre gelé |
| 2 | 51 → 52 → 53 → 54 → 55 | lire le guide de **chaque** version |
| 3 | `newArchEnabled: true` | point de rupture — `prebuild --clean` |
| 4 | **Reanimated 3 → 4** | **le plugin change de nom sans erreur** — `react-native-reanimated/plugin` devient `react-native-worklets/plugin`. 61 fichiers |
| 5 | MMKV 2 → 3 | 1 import direct, 15 consommateurs |
| 6 | Skia 1.2 → 2.8 | 23 fichiers ; les APIs avancées sont à zéro occurrence |
| 7 | `expo-av` → `expo-audio` | **trivial** : 2 fichiers, `Audio` seulement |
| 8 | `expo-updates` | absent, à ajouter |

**Hors périmètre** : `react-native-svg`, **79 fichiers** — lot séparé.

**Acceptation** : l'application compile, se lance sur appareil, et **une animation par famille d'usage Reanimated est vérifiée visuellement**.

## T1 · Socle de rendu

Cinq modules purs : `projection` · `decimate` · `ramp` · `ribbon` · `gg`.

**Le générateur de ruban est la pièce centrale.** `Vertices` en `triangleStrip`, une couleur par sommet. **Poser explicitement le mode de mélange** — le défaut `dstOver` sort un ruban gris.

**Attention licence** : les 73 points de `hauteSaintonge.ts` sont sous **ODbL**. Toute remontée en base transporte l'obligation d'attribution à OpenStreetMap.

**Acceptation** : `docs/T1_RENDU.md` avec les mesures réelles par module, et **ce qui n'a pas tenu le budget de 16,66 ms**.

## T1bis · Socle de calcul

Six calculs : `segment` · `apex` · `braking` · `accel` · `gg` · `delta`.

**Préférer `a_lat = v × ω_lacet`** au canal `GForceY`, biaisé par le dévers.
**Travailler sur la courbure `1/R`**, jamais sur `R` qui diverge en ligne droite.
**Seuil de freinage : −0,3 g**, pour exclure le frein moteur.

**Acceptation** : le **delta cumulé se referme à zéro** sur un tour comparé à lui-même. S'il ne le fait pas, le ré-échantillonnage ou l'intégration sont faux.

## T2 · ThumbHash

Une colonne par média, génération à l'upload — `sharp` est déjà en devDependencies. **Aujourd'hui toutes les images partagent le même aplat titane.**

## T3 · Mesure

Flashlight en intégration continue, sur appareil réel. **Profiler la distribution des temps d'image, jamais la moyenne** — les shaders provoquent un throttling thermique sur les appareils anciens.

---

# JALON 2 — SOCLE PRODUIT

**Aucun écran n'est encore refondu. On pose ce que tous consommeront.**

## Phase 1 · Jetons de design

Retirer les **onze graisses mortes**. Poser le trio — Söhne Breit, SF Pro, JetBrains Mono ligatures désactivées et zéro non pointé.

**Séparateur décimal : virgule.** `1:41,203`, jamais `1:41.203`. Corriger partout.

Grille sans colonnes, marge 20 pt, rythme 8 pt. Chiffre roi plafonné à **56 pt au-delà de 7 caractères**.

**Correctif obligatoire** : le hook de réduction des animations devient **synchrone**. Dix composants l'ignorent.

**Acceptation** : test de chaînes françaises sur 320 pt — « Réglages », « Séances ».

## Phase 2 · Rôles et sécurité

**Ce lot touche l'autorisation. Une erreur ici verrouille des comptes.**

**Lot 8 — `role` fait autorité.** `is_admin` devient un miroir maintenu par déclencheur, conservé pour ne pas casser les policies existantes.

**L'exemption est obligatoire et va dans la même migration.** `administration@oxvehicle.fr` porte `role = 'pilot'` et `is_admin = true` : **le miroir le rétrograderait et le verrouillerait hors de son propre espace d'administration.**

*Vérification impérative avant d'écrire :*

```sql
select id, email, role, is_admin from public.users
where is_admin = true or role in ('admin','coach');
```

**Si un autre compte est dans le même cas, s'arrêter et le signaler** — ne pas l'exempter d'office.

**Lot 9 — quatre défauts de rôle** : le coach rétrogradé doit perdre l'accès · la rétrogradation par validation ne doit pas retomber sur `pilot` par défaut · la suspension doit couper l'accès et pas seulement l'affichage · **le quatrième est à établir par lecture** — chercher toute policy qui lit `is_admin` sans passer par `role`.

**Lot 9bis — séparation admin et pilote.** Deux comptes distincts pour une même personne. **Celui qui contrôle l'éligibilité n'est pas celui qu'on contrôle** : l'auto-contrôle devient impossible par construction, sans garde technique. **Coach et pilote se cumulent** — un coach roule.

Le `SpaceSwitcher` ne sert plus que ces deux cas. **Il n'est aujourd'hui monté que dans les hubs V1 et coach** — le chemin réel depuis V2 fait **six gestes** et passe par l'écran de création de route. **Et l'espace admin n'a aucun bouton de déconnexion.**

**Acceptation** : se connecter avec le compte fondateur **après** migration et vérifier l'accès à l'espace admin.

## Phase 3 · Corrections bloquantes

**Quatre correctifs qui bloquent des fonctionnalités entières. Aucun ne dessine d'écran.**

**Lot 10 — RGPD.** La purge référence **`coach_reviews`, table supprimée** : elle échoue silencieusement. Retirer la référence morte et **vérifier table par table**, y compris les ajouts récents — `crew_members`, `eligibility_items`, `coaching_bookings`, `pilot_notes`, `session_media`. *Test : créer un compte, produire de la donnée partout, purger, vérifier qu'il ne reste rien.*

**Lot 11 — `registrations.status`.** L'application n'écrit `attended` **que depuis `pending` ou `confirmed`**. Jamais autrement, jamais en écrasement. *Dépendance externe : D-07 du dossier de raccordement.*

**Lot 12 — `registration_id` jamais devinée.** Elle se pose **au moment de la clôture**, depuis le contexte réel du flux REC, jamais par rapprochement de date ou de circuit. **Une séance sans inscription reste sans inscription** — c'est un fait, pas un trou à combler.

**Lot 13 — Insights, liste blanche à trois états.** Quatre des six lectures affichent des **chiffres de démonstration sans aucun bandeau**. Trois états : `disponible` · `absent` — « — » et sa raison · `demo`, **jamais en production**. **Conséquence assumée : six lectures sur six rendront `absent`, et la section entière s'effacera** jusqu'à la première mesure réelle. **Séparer physiquement les chiffres de démonstration du code de production.**

**Lot 27bis — le déclencheur `coach_availability`, le blocage caché.**

Migration `20260718111150`, lignes 60-63 : à l'insertion, `open` est rabattu sur `closed` ; à la mise à jour, l'ouverture est annulée et le statut précédent restauré. **Un coach ne peut jamais ouvrir un créneau.**

Le motif documenté est légitime — validation OXV préalable. **Mais le silence ne l'est pas** : la valeur est réécrite sans exception, sans message. Un coach croit que rien ne s'est passé.

**Deux corrections minimales** : un état `pending_validation` distinct de `closed`, et l'information retournée au client pour que l'interface puisse la dire.

**Préalable à tout test de l'économie coach.**

---

# JALON 3 — LE JOUR J

**Le cœur du produit.** C'est ici que la mesure existe ou n'existe pas.

## Phase 4bis · Le flux REC — huit étapes

Contraste renforcé sur les huit · cibles **56 à 64 pt** · ~~barre masquée en
roulage seulement~~ → **barre masquée sur les CINQ segments** (amendé le 13/08).

> ### Amendements du 13/08/2026 — là où le code avait raison contre ce plan
>
> *Rendus par arbitrage fondateur. Ils sont écrits ICI, dans le plan, et pas
> seulement en dette : un plan qu'on corrige par un fichier annexe n'est plus un
> plan.*
>
> **1. Les deux écrans `consentement` et `appairage` séparés ne sont plus
> exigés.** Le consentement cardio a un sens au moment où le pilote vient de
> connecter son boîtier, pas dans un écran abstrait deux étapes plus tôt. La
> décision du 01/08 est postérieure à ce plan et mieux motivée.
>
> **2. Aucun chrono en roulage — même figé.** Le plan écrit « chrono figé au tour
> bouclé, jamais animé » ; le code n'en affiche aucun. C'est le seul endroit du
> dossier où l'implémentation est plus disciplinée que sa spécification : un
> chiffre en piste appelle le regard, et le regard appelle l'accident. Le chrono
> figé existe un écran plus loin, et c'est le bon endroit.
>
> **3. La barre d'onglets est masquée sur les CINQ segments, pas seulement en
> roulage.** Le flux REC est un tunnel. Une barre au milieu d'un tunnel propose
> une sortie qui laisse un état à moitié construit — une capture armée sans
> véhicule, un consentement à moitié donné. « Masquée en roulage seulement »
> décrit une consultation ; REC est une saisie.
>
> **4. Le « passer » du QCM sort du tiers supérieur.** Le pilote le remplit entre
> deux runs, en combinaison, souvent avec des gants, sur un téléphone tenu d'une
> main : le tiers supérieur d'un écran moderne n'est pas atteignable au pouce.
> En bas, en texte seul — un bouton plein en ferait l'action principale, ce
> qu'il n'est pas. La règle des cibles de ce plan n'est pas esthétique.
>
> **5. La ceinture cardio reste réservée aux pilotes coachés, et le motif est
> écrit.** Le rythme cardiaque est une donnée de santé, catégorie particulière
> au sens de l'article 9 du RGPD. Restreindre la collecte à ceux pour qui elle a
> une finalité démontrable est de la minimisation (article 5.1.c) : c'est
> défendable devant un contrôle, « on l'a fait comme ça » ne l'est pas. Le jour
> où quelqu'un voudra l'ouvrir à tous « puisque le capteur est là », cette ligne
> sera la seule chose qui l'arrêtera.

| Lot | Écran | Points durs |
|---|---|---|
| 21a | tous | contraste renforcé — le tertiaire est **interdit** |
| 21b | `placement` | avertissement de verrouillage — **« ne pas appuyer sur le bouton latéral »**, pas « laissez l'écran allumé » |
| 21c | **`appairage`** *(nouveau)* | **diagnostic dès le premier échec**, reconnexion en fond. Sépare le vérifié du supposé. **La localisation refusée est signalée dès l'échec** — cause la plus fréquente et la moins comprise |
| — | `consentement` *(nouveau)* | **première fois seulement** — le flux reste à huit étapes |
| 21d | `preparation` | éligibilité en tête. **Ajouter la seule colonne manquante : `declared_at`** |
| 21e | `roulage` | seuil d'interruption sur **le tour de référence du pilote**, repli en secondes. ~~Chrono figé au tour bouclé~~ → **aucun chrono en roulage** (amendement 2) |
| 21f | `entre-runs` | QCM en tête, chiffres masqués. **Étendre `pilot_notes`** — un texte libre ne se croise pas |
| 21g | `fin` | incident à état suivi · journée résumée · variable avec **préséance pilote** |

### Les trois règles du flux

**Le contraste renforcé.** En plein soleil, la luminance affichée doit dépasser la lumière réfléchie d'un facteur **2,5 minimum** — **le contraste AAA à 7:1 devient un plancher** sur ces huit écrans.

**Les cibles.** Les 44 pt d'Apple sont un plancher ; les études cockpit situent l'optimum entre **18 et 21 mm**, et le taux d'erreur passe de **10,3 % en statique à 16,6 % sous vibration**. **Aucune action critique dans le tiers supérieur.**

**L'aiguilleur reste invisible.** Le retour se fait d'écran à écran — une chaîne, pas une étoile. **Revenir, c'est consulter, jamais rembobiner** : sans cette règle, revenir sur `placement` relancerait la capture.

### Trois points durs à ne pas manquer

**`arrivee` — le libellé de permission doit changer.** `app.json` déclare aujourd'hui la localisation pour le seul scan Bluetooth. **La détection d'arrivée est un autre usage, et un libellé inexact est un motif de rejet en revue.** Aucune détection en arrière-plan — pas d'`UIBackgroundModes`. **Repli manuel obligatoire** : permission refusée, GPS qui ne fixe pas, circuit sans coordonnées — aucun de ces cas ne bloque la journée.

**`appairage` — deux appareils désormais.** La ceinture cardio suit le profil standard `0x180D` / `0x2A37` — universel, et **bien plus simple que le protocole UBX du RaceBox**. Mais le téléphone tient **deux liaisons pendant qu'il capture à 25 Hz** : l'autonomie est à mesurer. **Une colonne `source` sur les échantillons** — ceinture quand elle est là, HealthKit sinon.

**`placement` — l'armement est refusé si le boîtier est déconnecté.** Retour à l'appairage. Cela ne bloque pas la journée : cela la **route par le diagnostic**, où « rouler sans mesure » reste ouvert.

**Consigne montre sur `placement`**, au même endroit que l'avertissement de verrouillage : lancer une séance « Autre » dans l'application Exercice d'Apple. **Sans elle, la Watch n'échantillonne qu'à quelques minutes d'intervalle et la branche Intensité reste vide.** Si le pilote oublie, le bilan le dira.

### Acceptation — six vérifications, toutes sur appareil réel

**Une journée complète simulée de bout en bout, avec un boîtier réel.**

1. Le parcours complet, étape par étape, avec les temps observés.
2. **Le test en plein soleil** — quel texte est illisible, s'il y en a.
3. **Le test ganté** — quelle cible échoue, s'il y en a.
4. **L'autonomie sur vingt minutes**, deux liaisons BLE et capture 25 Hz.
5. Le comportement au **verrouillage manuel** du téléphone.
6. Ce qui n'a pas pu être testé faute de données réelles.

---

# JALON 4 — LA RESTITUTION

## Phase 4sexies · Banque de calculs

Socle robuste · étiquetage `[M]` / `[D]` / `[I]` · ceinture cardio `0x180D` avec colonne `source` · énergie de freinage, qui alimente le carnet.

## Phase 4septies · Restitution par niveaux

Cinq niveaux ouverts **par la donnée**. Un niveau fermé reste **visible, éteint, avec son compteur**.

Virages nommés sur la courbe de delta · tour idéal sur 50 à 200 micro-secteurs, **annoncé théorique** · conditions en faits, jamais corrélées.

## Phase 4octies · Formes importées

**Bascule automatique superposition → bande au-delà de 20 à 30 tours.**

`functional boxplot` en base distance · `curve boxplot` **pré-calculé côté serveur** — environ une minute pour 50 trajectoires, jamais en temps réel · strip map · sparklines · bandes de saison en **rampe séquentielle, jamais divergente**.

## Les trois écrans de restitution

**Le Bilan** — premier regard, dans Miroir, lu debout au paddock. Variable en tête avec son fait mesuré, ressenti, tracé, photos. **Une seule sortie : la Séance**, le retour étant le geste arrière. **L'export PDF passe côté serveur** ; la carte-trophée devient une section de la carte-souvenir.

**La Séance** — la mesure, dans Data, lue assise. Huit sections à ancres collantes, **sous 10 % de la hauteur d'écran**. **Les six lectures s'effacent tant qu'elles sont vides.** Aucune sortie vers le Bilan. *À vérifier avant de dessiner : ce que produit `weatherCorrelationService` — une jointure est un fait, une corrélation serait causale.*

**La Saison** — **le hub Data devient la Saison**, `data/saison` fusionne et disparaît. Seule solution qui règle trois défauts d'un coup : l'orphelin disparaît, le hub cesse d'être une liste sans destination, et « la saison est l'objet principal » devient vrai littéralement.

Le carnet y remonte en **section visuellement séparée** — fond propre, précédé d'une barre. **Une frontière de mise en page, pas une convention de couleur** : une convention s'oublie, une rupture de fond se voit avant qu'on lise.

**Ancres collantes, rendu différé et mémorisation de position au retour de modale** — obligatoires. La page approche 2 900 lignes.

### Acceptation du jalon 4

1. **Le delta cumulé se referme à zéro** sur un tour comparé à lui-même. *S'il ne le fait pas, le ré-échantillonnage ou l'intégration sont faux.*
2. Les temps de rendu de la page Saison, **au 95ᵉ centile, jamais en moyenne**.
3. Le comportement de la mémorisation de position au retour de feuille.
4. Le nombre de lectures d'insight qui rendent `absent` — **six sur six attendu**.
5. Le seuil réel de bascule superposition-bande, **mesuré**.

---

# JALON 5 — LES ESPACES

## Phase 4 · Espace pilote

QDI et vocabulaire technique · ressenti après run · saison objet principal · véhicule principal — **colonne `is_primary` à créer** · portage des sept orphelins V1 · recâblage des douze liens · **suppression de l'arbre V1**.

## Phase 4quater · Club, VOUS, onboarding

**Le Club — votre appartenance, ce que vous partagez, ce que le club vous ouvre.** Trois couches : le Pass en tête et en pleine largeur — le bouton central l'ouvre —, puis ce que vous partagez, puis ce que vous découvrez. **Cela rend une entrée aux deux orphelins** et libère `roulages` de sa dépendance à une notification.

**Le Pass existe sans attendre `app_payments`** : c'est l'écran de ce que le pilote **possède**. Il lit `registrations` et `sessions`, **pas `events`**. Paiement fermé : **un lien vers le site avec le chemin exact**, jamais un bouton mort.

**VOUS — ce qui est à vous et qui ne se mesure pas.** Le carnet en sort pour Data ; le garage garde la fiche, **le sélecteur vit dans Data**. **`vous/equipement` devient « Votre matériel »** — deux écrans portaient ce nom sans rien de commun — et devient **une source d'éligibilité** : un casque périmé est un item que la préparation lit. **`dataExportService` remonte ici** : c'est la portabilité RGPD article 20.

*Retirer le repli 42703 sur `bio`, `car_number`, `pavilion_name_optin` — la migration est appliquée.*

**L'onboarding à cinq étapes**, doctrine et méthode fusionnées. Deux écrans de texte avant d'avoir rien vu, c'est trop pour quelqu'un qui vient de payer sa journée. **Le pacte mutuel dépend de la pièce 2 du dossier avocat.**

## Phase 4quinquies · Amis et comparaison

**Suppression de `duels`** — zéro ligne, zéro perte. La table portait un `status` et un `resolved_at` : **un défi qui se résout, donc un vainqueur.**

**Aucune table de comparaison n'est créée** — elle est **éphémère, sans trace**. **L'amitié est le consentement** : `are_friends()` exige déjà `accepted` des deux côtés, le consentement supplémentaire était redondant.

**Deux écrans** : `data/comparer` pour ses propres séances, un nouvel écran dans le Club pour les amis. **Data porte votre mesure, le Club porte la mesure partagée.**

## Phase 4ter · Notifications

Quatre canaux, **tous actifs par défaut** — choix commercial assumé. **Le stockage existe** : `users.notification_preferences` en JSONB, les « rituels » étant ces préférences fines.

**Le fuseau du pilote doit être stocké** — le report nocturne 22 h – 8 h se calcule côté serveur. **Il diffère, il n'annule pas** : un bilan prêt à 23h40 se pousse le lendemain.

**Revue de registre obligatoire.** « Vous n'avez pas roulé depuis trois mois » est exactement ce que l'application s'interdit à l'écran — **et l'interdit ne s'arrête pas au bord de l'application.**

### Acceptation du jalon 5

1. Les quatre zones ont-elles **une fonction énonçable en une phrase** ?
2. **Chaque hub atteint-il tous ses enfants ?** *Aujourd'hui : Data en atteint un sur trois, le Club trois sur sept.*
3. L'arbre V1 est-il supprimé, et que reste-t-il de non porté ?
4. Le test de registre sur **tous** les messages de notification.

---

# JALON 6 — COACH

**Préalable : lot 27bis fait.** Sans lui, aucun test de l'économie coach n'est possible.

## Phase 5 · Espace coach

### Le fil de séance — d'abord, avant tout le reste

**Il rend inutiles quatre écrans** : `debrief`, `triage`, `lecture`, `priorites` — **1 983 lignes**. *`triage` est de surcroît doctrinalement douteux : un signalement automatique est une interprétation.*

**Trois registres se distinguent sans légende** — gris pour la machine, rouge de marque pour le coach, trait clair pour le pilote.

### Le marqueur résolu

**L'application ne stocke pas un horodatage : elle le résout** en tour, virage, vitesse d'entrée, décélération, distance avant la corde.

Il porte sa provenance — horodatage, auteur, source — et **ressort partout** : file de lecture, carte de séance, préparation suivante. **Il fusionne avec `coach_pilot_highlight` et le marquage pilote** : un mécanisme, deux origines.

### Lot 27a-bis — le canal biométrie par coach

Aujourd'hui, `liveRelayRunner.ts:326` impose que **tous** les coachs à l'écoute soient au niveau détaillé pour qu'un cardio soit émis.

**La raison est structurelle** : la biométrie voyage sur `live:session:<id>`, canal partagé — impossible de la réserver à certains au moment de l'émission.

**Correction : un canal par coach**, `live:bio:<coachId>:<sessionId>`. *Le code ne connaît pas la notion de « coach du jour » : tant que le canal est partagé, la règle « tout ou rien » reste la seule garantie en droit.*

### Le reste du bloc

**Le hub à deux modes** — quinze sorties, c'est un menu, pas un poste de travail. **Liseré rouge sur une seule séance**, la plus ancienne en attente : une file où tout est urgent n'est plus une file. **`coach_queue` est déjà câblée.**

**`rapport` devient la composition de la carte de séance** — le PDF reste un export, plus le produit.

**`assistant` devient le transcripteur** des notes vocales, plus l'analyste : **il met en forme ce qu'un humain a dit, il ne coache pas.**

**Suppression de `payment_link`** — place de marché seule. **Mais `billing_siret`, `billing_name`, `billing_address`, `vat_regime` et `vat_rate` restent** : le mandat d'encaissement suppose une facture au nom du coach.

**Suppression de `coach_testimonials`.** Remplacée par la vérification OXV et **les faits d'activité dérivés de `coaching_bookings`** — un relevé que le coach ne peut pas écrire lui-même.

**La phrase de consentement doit dire la comparaison d'élèves** : « il voit vos séances, votre télémétrie, votre cardio et votre carnet, **et peut les comparer à celles de ses autres pilotes** ».

## Phase 5bis · Statut fondateur

`users.founder_since` · `founder_number` par **séquence dédiée** · `user_id` sur `founding_members` · propagation au rattachement.

## Phase 5ter · Écuries

Écran d'écurie · logo téléversé par le capitaine · exclusion par le capitaine, invitation par tous · parrainage retiré de `rec/preparation`.

**Annuaire trié par taille, sans numéro de rang** — l'ordre porte l'information, le numéro déclarerait un verdict. **Aucun chrono n'apparaît nulle part dans l'écurie.**

*Réserve* : avec 43 journées et une poignée de pilotes, **l'annuaire public restera vide toute la première saison.**

### Acceptation du jalon 6

1. Le fil se remplit-il **en temps réel** pendant un run ?
2. Un marqueur posé sur les lunettes **se résout-il correctement** en tour, virage et mesures ?
3. Une carte de séance est-elle reçue par un pilote, **avec l'audio** ?
4. Le canal par coach émet-il le cardio **au bon destinataire, et à lui seul** ?

---

# JALON 7 — ADMIN ET PARTENAIRES

## Phase 6 · Admin terrain

**Deux modes** — écran unique le jour J, hub structuré sinon. Même règle que le pilote et le coach : **la temporalité commande.**

**Séparation verticale** : surveillance en haut, gestes au milieu sous « À faire », plateau en bas.

**Les numéros en piste sont des numéros, pas des noms** — c'est ce que l'administrateur voit passer. **Aucun chrono, aucun ordre de performance** : `BOARD_MODE = 'A'`.

**Temps réel sur tout l'espace**, pas seulement sur les séances en cours.

**Trois corrections structurelles** : l'espace n'a plus d'entrée — le chemin réel fait **six gestes** · **aucun bouton de déconnexion n'existe** · l'inspecteur est codé en dur sur Haute Saintonge alors qu'il devient l'éditeur des trois circuits.

**Le briefing est collectif** — un geste bascule tous les présents. **Seul des neuf items à l'être par nature.**

**L'incident a un état suivi** — reçu, traité, clos, avec auteur et date.

**L'admin écrit dans `registrations`, avec une table d'audit** : une inscription vaut un paiement, et sans trace un désaccord de facturation est insoluble.

**Tap to Pay on iPhone** *(bloqué SIRET)* — une journée de circuit est un service **physique consommé hors de l'application** : la collecte par un tiers y est permise, et le paiement en présence lève tout doute.

## Phase 6bis · Partenaires et Territoire

**Vocabulaire figé** — `type` en **quatre** valeurs désormais, la quatrième étant **le partenaire technique** qui écrit dans le carnet · `contact_policy` en cinq modes · `channel` en cinq origines.

**`session_id` sur `partner_offers` et `partner_leads`**, contrainte d'exclusivité — jamais les deux.

**Suppression d'`is_premium` sur les quatre tables.** Vestige d'un modèle abandonné par **décision du 12 juillet 2026** — « régie 100 % saison ». **Un lieu ne se distingue jamais par ce qu'il a payé.**

**`social_pings` réservée aux partenaires**, règles éditoriales au contrat — **pas de file de modération, une clause.**

**Le Territoire garde le circuit et son entourage** : les convois partent chez les amis, les belles routes ont leur écran.

---

# JALON 8 — INNOVATIONS ET SERVEUR

**Tout ce qui suit peut attendre que la mesure fonctionne.**

## Phase 7 · Les six nouveautés

Méthode publiée · variable de séance · ressenti sur la saison · pourquoi ce chiffre est absent · carnet de saison · comparaison à un an d'écart.

## Phase 7bis · Mémoire du circuit

**Ne peut rien montrer avant plusieurs saisons de données.**

Fonction d'agrégation `security definer` qui **ne retourne que des agrégats**, jamais une ligne individuelle — motif de `crews_public_rows()`.

**Le seuil est une méthode, pas un nombre** : la mémoire existe quand l'estimation de dispersion **cesse de bouger**. En deçà : « — » et sa raison.

**La ligne médiane se trace, jamais superposée à celle du pilote** — superposée, elle deviendrait une cible, et l'application aurait prescrit sans un mot.

Le Territoire devient l'objet circuit.

## Phase 7ter · Surfaces iOS

**Une Live Activity par run, pas par journée** : un run dure vingt minutes, une journée huit heures, et iOS borne la durée de vie.

Dynamic Island compacte — **36 px, deux valeurs, rien de plus n'entre**.

**L'écran de verrouillage porte le tracé en filigrane** : c'est la surface la plus vue de la journée. Widgets pour les onze mois hors-saison.

## Phase 7quater · Carnet d'entretien

**L'application compte, elle n'estime jamais.** Aucun pourcentage d'usure : **312 freinages au-delà de 1,2 G disent plus que 1 240 km.**

**Quatre questions au pilote, aucune technique** — la photo de facture contient déjà marque, référence, dimensions et prix.

**L'intervention est l'unité** : un garage qui refait un freinage touche plaquettes, disques et liquide dans la même visite. **Le consentement porte sur l'intervention entière.**

**Les dates de péremption sont lues par `eligibility_items`** — harnais, extincteur. Le pilote saisit une fois, l'application prévient, l'admin contrôle. **Trois écrans, une seule donnée.**

**Le partenaire est en dernier**, après un filet, sous une phrase factuelle, et **ne réagit à aucun seuil** : le faire apparaître à 1 500 km serait fabriquer le besoin.

## Phase 8 · iOS et serveur

**Une seule compilation** pour HealthKit et Live Activity.

**Quatre sorties côté serveur** : vidéo synchronisée par ffmpeg — `expo-video` ne garantit aucun décodage image-exact · PDF de bilan · carte-souvenir · livret de saison. *`expo-print` est limité, et l'export Skia hors écran reste en sRGB.*

**Lot 40 — encaissement Stripe.** *Bloqué SIRET.*

---

# ACCEPTATION FINALE

`docs/BILAN_V3.md` :

1. **Les quatre-vingt-un écrans**, avec leur état — fait, partiel, non commencé.
2. **Les treize vérifications sur appareil**, avec leur résultat.
3. Ce qui reste bloqué par une dépendance externe.
4. **Ce qui n'a jamais pu être testé faute de données réelles.**

---

# LE GRAPHE DE DÉPENDANCES

```
0.1 git push
 └── T0 migration
      ├── T1 rendu ──┬── T1bis calcul ──┬── Jalon 4 restitution
      │              │                   └── Phase 4sexies/septies/octies
      │              └── T2 ThumbHash
      ├── T3 mesure
      └── Phase 1 jetons ──┬── Phase 2 rôles ── Phase 3 corrections
                            │                    └── Jalon 3 REC ── Jalon 5 espaces
                            └── (tous les écrans)

Jalon 3 REC ── Jalon 6 coach ── Jalon 7 admin
Jalon 4 restitution ── Jalon 8 innovations

Externes, en parallèle dès J0 :
  site (148) · avocat (8) · terrain (corners-v1) · SIRET
```

---

# LES BLOCAGES, PAR ORIGINE

| Origine | Ce qui est bloqué |
|---|---|
| **`git push`** | **absolument tout** |
| **T0** | tout le développement |
| **SIRET** | encaissement coach, Tap to Pay, tunnel de paiement |
| **Site** | réservation transmise, `registrations.status`, numéro de voiture, 43 journées |
| **Avocat** | décharge, pacte, charte coach, mandat d'encaissement |
| **Terrain** | `corners-v1` Valence et Charente, séance de télémétrie Valence |
| **Déclencheur `coach_availability`** | tout test de l'économie coach |
| **Données réelles** | mémoire du circuit, faits d'activité coach, six lectures d'insight |

---

# CINQ INCONNUES SANS BLOCAGE

À lever quand l'occasion se présente, aucune ne retient un lot.

**Le lien marge-QDI** — `qdiLogic.ts` ne contient aucune occurrence de `margin` ni `marge`. Reste à savoir s'ils partagent une entrée en amont.
**`captureLinkStatusLogic`** — distingue-t-il le boîtier connecté mais **muet** d'une déconnexion ?
**`correlateWeather`** — son contenu n'a pas été lu ; une phrase ou une tendance s'y trouverait.
**Qui écrit `eligibility_items`** — aucun écran de `(app2)` ne l'écrit. Vérifier si le site l'exerce.
**L'avantage du parrainage** — rien en base ne le décrit. `crews` et `crew_members` sont à zéro ligne.

---

# LE FAIT QUI DOMINE

**Rien n'a jamais tourné.**

53 trames en production, un tour de **0,022 seconde**, zéro boîtier en flotte, zéro donnée cardiaque, zéro annotation de coach, zéro compte coach.

**Toute affirmation de ces cinq documents sur le comportement réel est une lecture de code, jamais une observation.**

Les mesures des jalons 1 et 4 porteront sur des **données synthétiques**. Le dire explicitement dans chaque livrable.
