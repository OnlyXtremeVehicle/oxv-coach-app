# OXV Mirror V3 — Dossier de travail

**Version 3 · 26 juillet 2026**
Dépôt `oxv-app`, branche `feat/site-document-emails` · Horizon janvier 2027

Remplace les versions 1 et 2, ainsi que `OXV_Mirror_Dossier_Refonte_Design.md`.
Ce document est **autosuffisant** : il porte le périmètre, la doctrine, toutes les consignes, toutes les connexions, la pile technique et les lots.

---

# SOMMAIRE

I. Périmètre · II. Doctrine · **III. Consignes** · **IV. Connexions** · V. Direction visuelle · VI. Pile technique · VII. Architecture par espace · VIII. Nouveautés · IX. Phases et lots · Annexes

---

# I. PÉRIMÈTRE

Trois espaces mobiles.

| Espace | Nature | Volume |
|---|---|---|
| **Pilote** | évolution des 38 écrans V2 | 27 666 lignes |
| **Coach** | écrit à neuf, de 37 vers ~22 écrans | aucune maquette avant ce dossier |
| **Admin terrain** | jour J, 8 écrans sur 29 | ~2 300 lignes retenues |

Partent sur portail web : espace partenaire, espace pilote professionnel, admin lourd (qualité des données, analyse de séance, analytique, rapport B2B, partenaires, ambassadeurs, événements, utilisateurs, support, modération, certification de routes, drapeaux, maintenance).

Le rôle `pro_pilot` est conservé en base ; son espace mobile part sur le web.

---

# II. DOCTRINE

L'application restitue des **faits mesurés**. Elle ne prescrit jamais.

**Interdits absolus.** Aucune consigne de pilotage. Aucun classement entre pilotes, aucun rang, aucune médaille, aucun badge, aucune gamification. Aucune valeur inventée. Le coaching est sous-traité ; c'est le coach humain, jamais l'application, qui formule une lecture causale.

**Amendement du 26 juillet 2026 — la comparaison entre amis.** La règle n'est plus « comparaison toujours soi contre soi » mais **qui décide**.

*OXV ne classe jamais des pilotes entre eux* — c'est le produit qui jugerait, et c'est interdit sans exception.
*Deux pilotes amis peuvent consentir mutuellement à comparer leurs données* — ce sont eux qui décident, et OXV ne fait qu'afficher.

C'est la distinction déjà posée pour les partenaires : OXV ne choisit pas à la place du pilote, il achemine.

**Motif de l'amendement.** La formulation précédente était **déjà fausse au niveau du schéma**. Cinq policies accordent aux amis un accès mutuel complet — télémétrie brute à 25 Hz comprise. Voir IV.15.

**Ce que l'amendement ne lève pas.** Aucun vainqueur, aucun delta coloré, aucun ordre de performance. Une comparaison affiche deux colonnes ; le pilote lit lui-même laquelle est la plus rapide. Même règle que « un an plus tôt ».

**Trois appuis.**

*Le métier.* La donnée ne peut ni transformer les courbes en plan, ni évaluer la qualité des gestes : deux pilotes peuvent réaliser le même temps, pour l'un une plongée dans l'inconnu, pour l'autre une promenade. Le coach humain existe pour cela.

*Le droit.* L'article **R331-20 du Code du sport** dispose qu'un roulage libre sur circuit privé, sans spectateurs ni chronométrage, n'est ni une concentration ni une manifestation. `BOARD_MODE = 'A'` — ordre par numéro, jamais par chrono — vous maintient hors de cette catégorie.

*Les devoirs.* **L321-1**, assurance responsabilité civile. **L321-4**, information sur l'intérêt d'une Individuelle Accident — devient le **dixième item d'éligibilité, horodaté**.

---

# III. CONSIGNES

## III.1 Écriture

**Ce que l'application ne dit jamais.** Aucun impératif de pilotage : freinez, ouvrez, corrigez, optimisez, améliorez, vous devriez. Aucun jugement : bon, mauvais, mieux, moins bien, progrès, régression. Aucun classement : rang, position, meilleur du plateau, écart au premier.

**Ce qu'elle dit.** Des faits mesurés, avec leur unité et leur condition. « Au virage 4, le point de freinage varie de 18 m entre le tour 2 et le tour 7. » Deux valeurs côte à côte, jamais leur différence commentée.

**Le vocabulaire des branches est technique** : Trajectoire, Fluidité, Freinage, Accélération, Régularité. **Cinq, pas six** — « Intensité » en est retirée le 13/08/2026, motif ci-dessous.

**Le vocabulaire poétique** — Cap, Visée, Plongée, Anticipation — survit en **langage narratif** : phrases de ciel, fait du jour, sur-titres. Il ne désigne jamais une branche.

**Intensité n'est PAS une sixième branche — retiré le 13/08/2026, et voici pourquoi.**

Le radar se lit « plus haut, mieux ». Une branche Intensité y signifierait qu'un
pilote améliore sa figure **en roulant plus près de la limite**. Ce serait
transformer une restitution en incitation, sur un produit dont ces mêmes
documents écrivent qu'il n'est pas agréé pour évaluer — et dont le premier
principe est la sécurité avant la performance.

Le motif est écrit ici parce que, sans motif, le mot revient dans six semaines.

**Ce que le code fait déjà, et qui était juste.** Le pilier physiologique existe
sous le nom **« Aplomb »** (`PHYSIO_PILLAR_LABEL`), il vit **hors du radar**, en
barre séparée, et il est fermé sur trois conditions — drapeau `biometry`,
consentement de capture, trois séances au moins. Il rend `null` aujourd'hui.
C'est la bonne place : une mesure physiologique n'est pas un axe de pilotage.

Le QDI garde donc **cinq** branches — Trajectoire, Fluidité, Freinage,
Accélération, Régularité — et c'est ce que porte `QDI_BRANCHES`.


**Les options d'un QCM ne jugent pas.** « Plus difficile » décrit un état ressenti ; un run peut être plus difficile et meilleur. Une note libre reste toujours accessible à côté d'un QCM, parce que des options écrites par OXV façonnent ce que le pilote croit avoir senti.

**Les annotations de coach partagées** passent par un déclencheur PostgreSQL qui refuse dix-huit termes prescriptifs. L'écran l'annonce **avant** la saisie plutôt que de rejeter après.

**Registre.** Vouvoiement, phrases courtes, aucun emoji, aucun point d'exclamation. Minimalisme sec.

## III.2 Couleur

| Jeton | Valeur | Loi |
|---|---|---|
| Rouge de marque | `#C8102E` | insigne, bande coach, point REC, bouton central, action principale coach, liseré de section porteuse. **Jamais une donnée.** |
| Or Heritage | `#C4A459` | palier Heritage exclusivement |
| Or de performance | `#D9AE00` | tour de référence, ligne de record, repère de meilleur tour |
| Violet du record | `#8B5CF6` | célébration de record, remplissage bref uniquement — 4,34:1, jamais sur du texte |

**Règle de compensation.** Trois jetons de la famille ambre coexistent — Heritage `#C4A459`, performance `#D9AE00`, Fluidité `#FFB703` — et deux d'entre eux peuvent apparaître sur un même écran de séance. **L'or de performance ne se distingue donc jamais par sa seule teinte** : la courbe de référence est en trait tireté, le repère de meilleur tour porte une forme propre. C'est la redondance déjà imposée pour la deutéranopie, appliquée une seconde fois.

**Palette de données QDI** — Trajectoire `#60A5FA`, Fluidité `#FFB703`, Freinage `#E63946`, Accélération `#4ADE80`, Régularité `#C084FC`. `#F472B6` était réservé à « Intensité » : la teinte reste posée pour le pilier physiologique **Aplomb**, qui vit hors du radar.

**Deux règles absolues.** `#E63946` est **interdit sur tout texte** — remplissages et traits seulement, il mesure 4,04:1. Chaque branche porte **toujours** un libellé à côté de sa couleur, sans exception, pour la deutéranopie qui touche environ un homme sur seize.

**Rampe de vitesse** — `#4F9DF7` → `#3FD0D8` → `#4FC98A` → `#F2CE3B`. Sans or ni rouge, délibérément : la vitesse n'est ni un record ni une alarme. **Interpolation en Oklab**, pas en sRGB.

**La couleur ne juge jamais.** Un écart entre deux valeurs n'est ni vert ni rouge. Un delta n'a pas de flèche. Le pilote lit lui-même que 18 m est moins que 24 m.

**Une couleur, une signification.** Aucun hexadécimal ne porte deux sens dans l'application.

## III.3 Typographie

| Rôle | Police | Portée |
|---|---|---|
| Texte fonctionnel | **SF Pro** système | corps, libellés, listes, formulaires, boutons |
| Display de marque | **Syncopate** | ≥ 24 pt uniquement |
| Chiffres mesurés | **JetBrains Mono** | chronos, vitesses, G, distances, compteurs |

**Syncopate ne descend jamais sous 24 pt.** Aucun chiffre changeant n'est rendu en Syncopate.

**La police à chiffres tabulaires est intégrée au build** via le plugin de configuration `expo-font`, jamais chargée à l'exécution : l'issue expo/expo #20048 empêche `fontVariant: tabular-nums` de s'appliquer aux polices chargées dynamiquement sur iOS.

**Un seul chiffre roi par écran**, très grand, tout le reste subordonné.

**Hiérarchie à trois ou quatre niveaux**, construite par la graisse, la couleur et le crénage — jamais par la multiplication des tailles.

## III.4 Mise en page

**Plus aucune carte.** Le contenu repose sur le fond, séparé par des filets de 0,5 px. Empiler des rectangles arrondis produit un tableau de bord ; la donnée doit occuper la page.

**Le texte est légende, pas contenu.** Une phrase se justifie quand aucune forme ne dit la même chose. Un graphique remplace toujours une description chiffrée.

**L'objet visuel identitaire est le tracé du circuit.** Il porte le chrono, sert de filigrane, structure la page.

### Dynamic Type

| Site | Plafond |
|---|---|
| Chrono, odomètre, célébration | 1,3 |
| Cadran — valeur et libellé | 1,2 |
| Bouton central | 1,15 |

Au-delà de xxxL, le cadran bascule en barre horizontale, chiffre en pleine largeur.

### Liste de contrôle anti-décalage, applicable en revue de code

- [ ] Chasse tabulaire vérifiée **effective sur appareil**, pas seulement déclarée
- [ ] `minWidth` ou `minHeight` sur tout conteneur de valeur changeante, dimensionné pour le **maximum plafonné**
- [ ] Aucun `adjustsFontSizeToFit` sur un chiffre
- [ ] `numberOfLines` défini partout où le texte peut déborder
- [ ] Gabarits testés en français long, valeur absente, **AX5**
- [ ] Animations sur `transform` et `opacity` uniquement, jamais sur la hauteur
- [ ] Squelettes de chargement à la forme exacte du contenu attendu

## III.5 Mouvement

Table V2 étendue. `radar` **400 ms** (abaissé de 600). `needle` **800 ms**, maintenu — la lenteur d'une aiguille d'instrument est délibérée. `door` 260 ms, `stagger` 45 ms, `pulse` 1 200 ms.

**Hook synchrone de réduction des animations partout.** L'ancien hook résout `AccessibilityInfo` de façon asynchrone : l'animation joue puis claque à l'état final, ce qui est le pire des deux mondes. Dix composants animent aujourd'hui sans consulter le réglage — `StatusPill`, `TrackStage`, `DebriefMirror`, les six visualisations d'insight, `roulage.tsx`.

**Le mouvement ne ment pas.** Aucune animation ne laisse croire à une mesure qui n'existe pas. Un compteur ne monte pas de zéro vers sa valeur si la mesure n'est pas continue. Aucune célébration sur une donnée absente. `RecordFlash` ne joue qu'une fois, sur front montant, et ne peut pas boucler.

**Trois ajouts**, conditionnés à la mesure de performance : tracé rejoué à l'ouverture du bilan, nuage g-g peuplé chronologiquement, morphing du bouton central entre ses trois états.

## III.6 Données

**Une donnée absente s'affiche « — », jamais un zéro.** Le cadran n'affiche pas son unité à côté d'un tiret : elle donnerait au tiret l'air mesuré.

**Une donnée de démonstration est signalée à l'écran**, sans exception. La liste blanche à trois états — mesure, démonstration, absent — gouverne : un moteur inconnu rend `absent`, donc écran vide, donc aucun chiffre. La liste des moteurs de mesure est **vide** tant qu'aucune mesure réelle n'existe.

**Rien n'est deviné.** `telemetry_sessions.registration_id` n'est renseignée que s'il existe exactement une inscription du pilote couvrant l'instant de départ. Aucun remplissage rétroactif.

**Un tour de référence n'a de sens qu'à circuit et véhicule constants.** Le filtre est une liste de paires réellement roulées, jamais deux filtres indépendants.

**La méthode est publiée.** Chaque branche du QDI expose sa formule, ses seuils, ses entrées, ce qu'elle ne mesure pas, et sa sensibilité au véhicule. Régularité et Trajectoire se moyennent sans réserve ; Fluidité, Freinage et Accélération sont partiellement dépendantes du matériel.

**L'absence s'explique.** Pas de fix GPS, moins de trois tours, virage non détecté sur ce circuit, véhicule différent — le « — » porte sa raison.

## III.7 Code et livraison

**Un lot, un commit.** Greps avant chaque push. Confirmation explicite avant d'ouvrir le lot suivant.

**Chaque lot porte son bloc QA** : `tsc --noEmit`, `jest`, `check-doctrine`, `check-accessibility`, plus les vérifications propres au lot.

**`INCONNU` est une réponse acceptable** et préférable à une estimation. Toute affirmation sur le comportement réel porte son fichier et sa ligne.

**Aucune modification hors périmètre du lot.** Aucune installation non prévue.

---

# IV. CONNEXIONS

## IV.1 La chaîne de capture

```
RaceBox Mini (BLE, 25 Hz, UBX)
   ↓  src/ble/bluetoothService.ts — reconnexion 2/4/8/16/30 s, illimitée en capture
   ↓  src/ubx/parser.ts — jamais modifié depuis l'initialisation du dépôt
   ↓  src/services/captureSessionService.ts — premier plan seul, verrou expo-keep-awake
   ↓
telemetry_frames  +  telemetry_sessions
   ↓  src/services/analyzeSessionService.ts
   ↓
app_session_analyses  (marge : global, zone, véhicule, pilote, décomposition)
                      (qdi jsonb : 5 branches)
   ↓  compute-session-insights (Edge)
   ↓
session_insights  (anatomie, dispersion, équilibre, transfert, tour idéal, qualité)
   ↓
écrans pilote et coach
```

**Points durs de cette chaîne.**

Aucun Bluetooth en arrière-plan — `isBackgroundEnabled: false`, aucun `UIBackgroundModes`. La capture ne tourne que **premier plan, écran allumé**. Si le pilote verrouille son téléphone, le système peut couper la radio.

La marge et le QDI **partagent au moins une entrée** : la fluidité est une branche du QDI et un quart de la marge globale. Leur relation exacte doit être établie par lecture de `analyzeSessionService` et `marginCalculator` avant d'être expliquée à l'écran.

`circuits.corners` est **NULL sur Valence**. Le moteur `corners-v1` n'a tourné qu'une fois, sur Haute Saintonge, le 15 juin. Sans exécution préalable, une séance produit des trames mais aucun découpage.

## IV.2 Pilote ↔ Coach

C'est la boucle centrale du produit.

```
PILOTE                                    COACH
──────                                    ─────
demande d'affiliation
        ─────────────────────────────────→
                                          accepte  →  coach_pilots.status = 'active'
                                                      coach_consent_at posé
        ←─────────────────────────────────
consent capture + partage
        ─────────────────────────────────→  le direct peut s'amorcer

  ┌─────────────── JOUR J ───────────────┐

roule (run n)
   ↓
QCM ressenti après run
  · comparaison au run précédent
  · zone d'attention
        ─────────────────────────────────→  lecture rapide, en tête
                                            (60 s, seul, entre deux runs)
                                                 ↓
        ←──────── débrief entre runs ──────  fourche ressenti / donnée
                  (avec le pilote)             note écrite devant lui
                                               variable de la prochaine séance
        ←─────────────────────────────────
intention de la séance n+1
   ↓
roule (run n+1)
   ↓
bilan — la variable posée est seule mise en avant
```

**Les deux listes de vocabulaire restent alignées.** Le QCM de ressenti du pilote et la variable du coach emploient les mêmes termes — freinage, placement, rythme, voiture. Sans cela, le croisement sur la saison est impossible.

**Autres connexions coach → pilote :**

| Ce que le coach pose | Table | Ce que le pilote voit |
|---|---|---|
| annotation de virage | `coach_annotation` | attribuée, sur son bilan |
| repères de circuit | `coach_corner_reference` | superposés, attribués |
| priorités du bilan | `coach_pilot_highlight` | virages à regarder en premier |
| pondérations « ma lecture » | `coach_reading_weights` | présentée à part, jamais à la place de la marge OXV |
| rapport de séance | — | PDF partagé ; **le bilan écrit n'est stocké nulle part** |

**Le direct.** `liveRelayRunner` exige `coach_pilots.status = 'active'`. Rien ne l'écrit aujourd'hui. L'écran d'acceptation d'affiliation est le déblocage : il écrit `status` et `coach_consent_at`, la policy `coach_pilots_update_by_coach` existe déjà.

**Le canal biométrie est en tout ou rien.** `live:session:` est partagé par tous les coachs consentis ; on n'émet que si **chaque** coach à l'écoute est au niveau détaillé. Un coach détaillé perd le cardio parce qu'un confrère en lecture simple est connecté. La réponse propre est un canal par coach, non écrite.

## IV.3 Pilote ↔ Admin terrain

```
SITE                    APP PILOTE              APP ADMIN
────                    ──────────              ─────────
inscription
  → registrations
    (session_id, user_id,
     offer_type, status,
     display_number)
                                                préparation : plateau du jour
                                                (inscrits, pas tous les comptes)
                                                     ↓
                        QR = registration_id  ←  scan de présence
                                                     ou appel manuel
                                                     ↓
                                                registrations.attended_at
                                                + status = 'attended'
                                                (transition gardée)
                                                     ↓
                        avis après séance   ←  cron session_feedback
                                                     ↓
                        capture              →  telemetry_sessions.registration_id
                                                     ↓
                                                tableau de marche du jour
                                                (ordre par display_number)
                                                     ↓
                                                téléviseur de paddock
                                                (compte de service dédié)
```

**Transition gardée.** L'application ne pose `attended` que depuis `pending` ou `confirmed`, jamais depuis `cancelled` ni `no_show`, et uniquement dans le même geste qu'`attended_at`. Toute autre valeur de départ laisse le statut intact. `registrations.status` est une colonne du site : l'ajout d'un second écrivain doit lui être annoncé.

**Un seul système de présence, deux méthodes de saisie.** Le scan et l'appel manuel écrivent au même endroit. `event_registrations` est conservée pour les balades et rassemblements — l'annotation de dépréciation en base est fausse et doit être corrigée.

**Le numéro.** `users.car_number` est un numéro de **prédilection** choisi par le pilote, non unique. `registrations.display_number` est le numéro **effectivement porté** ce jour-là. Le tableau de marche lit le second, pas le premier. La collision se résout à l'inscription sur le site si possible, au pointage par l'admin en secours.

**Le téléviseur.** Le canal `live:board:` n'est lisible que du pilote propriétaire et de ses coachs consentis — `anon` est exclu des six policies. Un téléviseur ouvert avec la clé publique ne reçoit rien. Il lui faut un compte de service, sa policy propre sur `realtime.messages`, un jeton par appareil, et une portée limitée aux séances du jour.

## IV.4 Application ↔ Site

Un seul projet Supabase, aucune API entre les deux produits. **Le schéma est la seule interface, et il n'a jamais été écrit comme un contrat.**

| Objet | Propriétaire | Écrit par | Lu par |
|---|---|---|---|
| `users` | partagé | les deux | les deux |
| `sessions` — journées de circuit | site | site | les deux |
| `registrations` | site | site, **et l'app en transition gardée** | les deux |
| `events` / `event_registrations` — balades | site | site | les deux |
| `telemetry_sessions`, `telemetry_frames` | app | app | les deux |
| `app_session_analyses`, `session_insights` | app | edge functions | app |
| `coach_*` | app | app | app |
| `app_pairing_codes` | site | edge `pair-app` | app |

**Ce que l'application attend du site :**

| Demande | Conséquence si non tenue |
|---|---|
| Bouton « générer un code d'appairage » | aucun pilote ne peut lier son compte autrement qu'en retapant son mot de passe — `app_pairing_codes` porte zéro ligne |
| Collecte de `public_handle` à l'inscription | douze pilotes sur quatorze n'émettent aucune ligne au tableau de marche |
| Résolution de collision de numéro | repli sur l'admin au pointage |
| Accord sur `role` faisant autorité | le correctif SEC-2 peut casser un flux du site |
| Correctif `validate-inscription` : `city` → `address_city` | téléphone et date de naissance perdus, zéro pilote sur onze en porte un |
| Page `oxvehicle.fr/share/{token}` | les liens de partage sont morts |
| Propriété de `capture-membre-fondateur` et `yousign-webhook` | deux points d'entrée non authentifiés sans mainteneur |
| Sort des 43 journées disparues | risque de perte définitive |

**Alerte de données.** `public.sessions` porte une ligne, sa sauvegarde du 19 juillet en porte 44, aucun identifiant n'est commun. Les cinq tables `_backup_*_20260719` sont la seule copie survivante, hors du dispositif de purge RGPD. **Aucun `DROP` avant clarification.**

**Les liens profonds ne fonctionnent pas.** `app.json` ne déclare ni `associatedDomains` iOS ni `intentFilters` Android. Un lien `oxvehicle.fr/share/...` ouvre le navigateur, pas l'application. Seul le schéma `oxv://` atteindrait l'écran, et rien ne génère une telle adresse.

## IV.5 Rôles et permissions

```
users.role  ──────────────→  FAIT AUTORITÉ
     │
     ├─ 'pilot'    →  espace pilote
     ├─ 'coach'    →  espace coach · is_coach() dans les policies
     ├─ 'admin'    →  espace admin · is_admin() sur 85 tables
     ├─ 'partner'  →  web
     └─ 'pro_pilot'→  web (rôle conservé en base)

users.is_admin  ──────────→  MIROIR de role = 'admin', tenu par déclencheur

coach_pilots (coach_id, pilot_id, status, level)
     ├─ status : pending → active → declined | ended
     ├─ level  : lecture_simple | detaille
     ├─ is_coach_of(user_id)          →  lecture des séances
     └─ is_detailed_coach_of(user_id) →  + biométrie, si consentement de partage
```

**Avertissement d'exécution.** Le miroir rétrograderait `administration@oxvehicle.fr`, qui porte `role = 'pilot'` et `is_admin = true`. **Ce compte est nommément exempté du miroir** — c'est le compte fondateur, qui couvre tous les rôles (voir IV.11). L'exemption doit être posée dans la même migration, sous peine de verrouillage.

**Quatre défauts à corriger en tête de V3 :**

1. **Élévation de privilège ouverte** — tout compte authentifié peut poser `is_admin = true` sur sa propre ligne, sans trace. Le déclencheur de garde ne surveille que `role` et `kyc_status`. Correctif écrit, non appliqué.
2. **Coach rétrogradé conservant l'accès** — `is_coach_of()` ne vérifie pas `users.role` ; `demoteToPilot()` n'écrit pas `active = false`.
3. **Rétrogradation par validation d'inscription** — `admin_review_demande` écrit `role` par correspondance d'adresse.
4. **Suspension sans effet** — `suspended_at` est écrit, aucune policy ne le teste.

## IV.6 Drapeaux fonctionnels

| Drapeau | État | Ce qu'il commande |
|---|---|---|
| `biometry` | **ouvert** depuis le 25/07 | capture cardio, pilier **Aplomb** (hors radar), relais détaillé |
| `app_payments` | fermé | tunnel de réservation, écran Pass |
| `pilot_waivers` | fermé | décharge en signature électronique |
| `founders` | fermé | espace fondateur |
| `video_overlay` | déclaré en base, **lu nulle part** | réservation de place, pas une fonctionnalité |

**Consigne biométrie.** Le drapeau reste ouvert, mais **la fonctionnalité n'est communiquée à aucun pilote avant le test à deux appareils réels**. Tant que personne ne sait qu'elle existe, personne ne consent, et rien ne circule. Au premier consentement posé, le test devient rétroactivement obligatoire.

## IV.7 Partenaires

**État réel.** `partner_accounts` porte deux lignes — **OXV** et **OXV · Administration**. `partner_offers` en porte une, « PASS », en `draft`. `partner_leads` est vide. `contact_policy` est **NULL** sur les deux comptes, `type` vaut `autre`. Aucun enum n'existe : `type`, `contact_policy`, `category` et `channel` sont du texte libre. **Aucun partenaire extérieur n'a jamais existé.**

**Défaut structurel.** `partner_offers.event_id` et `partner_leads.event_id` pointent vers `events`, réservée aux balades. Une offre ne peut donc pas être rattachée à une journée de circuit — même erreur que `telemetry_sessions.event_id`. **Correction : ajouter `session_id`, avec une contrainte interdisant que les deux soient renseignés. Une offre vise une journée de circuit, une balade, ou rien — auquel cas elle est permanente.**

**Le vocabulaire est un contrat partagé** entre l'espace partenaire, qui part sur le web, et l'application pilote, qui le rend. Du texte libre ne peut pas piloter un rendu.

*Ce que le partenaire est* — `type` : `privilege` (hôtellerie, conciergerie, expérience) · `prestataire` (pneumatique, préparation, convoyage, assurance) · `vitrine` (constructeur, média, institution).

*Comment on l'atteint* — `contact_policy`, **choisie par le partenaire** :

| Mode | Geste du pilote | Consentement |
|---|---|---|
| `mediee` | « Être mis en relation » | `consent_contact` posé au geste ; coordonnées jamais exposées |
| `directe` | « Appeler », « Écrire » | aucun — c'est le pilote qui contacte |
| `externe` | « Ouvrir le site » | aucune donnée ne sort |
| `reservation` | « Réserver » | complet, comme une inscription |
| `aucune` | rien | vitrine seule |

*D'où vient l'intérêt* — `channel` : `catalogue` · `eligibilite` · `garage` · `territoire` · `journee`. Ce champ dit au partenaire **où** le pilote l'a trouvé.

**La fiche d'offre n'est pas un gabarit unique** : un socle commun — image, titre, description, quota, validité — plus un pied qui change selon le mode déclaré.

**Médiation structurelle, pas procédurale.** Le partenaire reçoit la demande **instantanément** par le canal OXV et répond par ce même canal. Aucun délai humain, aucune validation manuelle. L'adresse et le téléphone du pilote ne lui parviennent jamais tant que celui-ci ne les donne pas.

**Où le partenaire apparaît.**

| Surface | Ce qui est autorisé |
|---|---|
| Accueil | **uniquement une offre avec laquelle le pilote a déjà un lien** — réservée, mise de côté, ou attachée à sa journée |
| Club, catalogue | tout |
| Garage, Territoire, entourage d'une journée | découverte, sur besoin exprimé |
| **Carnet d'entretien — détail d'un élément ouvert** | **une phrase factuelle après un filet, sans logo ni prix, sans réagir à aucun seuil** (IV.22) |
| **Éligibilité** | **rien.** C'est une liste de sécurité et de conformité réglementaire — monétiser une non-conformité de freins reviendrait à tirer profit d'un défaut de sécurité |
| **Miroir, Data** | **rien.** Le commerce n'entre pas dans les espaces de la donnée |

**Aucune urgence fabriquée.** Le quota est un fait, la date limite est une date. Ni « plus que », ni compte à rebours rouge, ni « dernières places ». Le commerce ne dispense pas du registre — **et cette règle tient même si un partenaire demande le contraire.** OXV refuse de publier une offre formatée à l'urgence. C'est une position contractuelle envers les partenaires, pas seulement une règle d'interface.

**Un bloc sans matière disparaît.** Avec une offre et deux comptes en production, un emplacement partenaire sur l'accueil serait vide la quasi-totalité du temps.

## IV.8 Circuits

**La base est la source unique de la géométrie. Le code ne détient aucune donnée de circuit.**

C'était le défaut racine : la géométrie était détenue à trois endroits — la base (`circuits.corners`, `turns_count`, `centerline_latlon`, ligne d'arrivée), le code (`src/lib/circuitTopology.ts`, `src/circuit/hauteSaintonge.ts`, `src/circuit/circuitCorners.ts`) et le schéma (une contrainte `1..7`).

**Violation doctrinale corrigée.** `circuitTopology.ts` est une topologie statique de Haute Saintonge : le nom de virage affiché était un nom Beltoise **quel que soit le circuit réel**. Une valeur inventée présentée comme un fait. Le fichier disparaît entièrement. `src/circuit/hauteSaintonge.ts` est examiné : s'il ne porte que des noms, il part ; s'il porte de la géométrie, elle remonte en base.

**Aucun nom de virage, nulle part, comme donnée.** L'affichage est uniforme : « Virage 4 », dérivé de l'index dans `circuits.corners`. Aucun repli, aucun emprunt, aucun nom par défaut. Les sept noms Beltoise cessent d'exister comme donnée. Ce qu'un coach écrit dans son texte libre relève de ses propres mots — l'application ne filtre pas cela.

**Blocage dur à lever.** `coach_annotations_corner_index_check` impose `corner_index >= 1 AND <= 7` — le nombre de virages de Haute Saintonge, gravé dans une contrainte de base. **À Valence, un coach ne peut pas annoter les virages 8 à 14** : l'insertion échoue au niveau de PostgreSQL. La contrainte passe à `>= 1`, comme `coach_corner_reference`, et la borne haute devient une validation applicative contre `circuits.turns_count`.

**Deux niveaux de saisie, sans collision.**

| Qui | Quoi | Table |
|---|---|---|
| **Inspecteur circuit** (admin terrain) | la géométrie canonique — virages, ligne d'arrivée, ligne centrale | `circuits` |
| **Coach** | sa couche par-dessus — points de freinage repères, vitesses d'apex | `coach_corner_reference`, clé `(coach_id, circuit_id, corner_index)` |

Le coach ne définit jamais les virages : il pose ses repères sur ceux de l'inspecteur. Sans quoi redéfinir le virage 4 changerait rétroactivement le sens de toutes les annotations passées.

**`circuits.review_status`** — `private` · `submitted` · `approved` · `rejected`. **Administrateur seul** peut soumettre un circuit.

**État et actions.**

| Circuit | Virages | `corners` | `centerline` | Action |
|---|---|---|---|---|
| Haute Saintonge | 7 | OK | OK | rayon d'arrivée 15 m, conservé |
| Circuit Ricardo Tormo | 14 | NULL | OK | **`corners-v1`**, et rayon d'arrivée porté de 10 à 15–20 m |
| Charente | NULL | NULL | OK | **`corners-v1`** |
| La charade | NULL | NULL | **NULL** | **supprimée** |

`corners-v1` exige une ligne centrale : il ne peut pas tourner sur La Charade. Il tourne donc sur **Valence et Charente**.

**Suppression de La Charade.** Onze tables référencent `circuits`. Une seule ligne pointe sur La Charade : une séance de télémétrie. **La séance est supprimée, puis la ligne de circuit.** Ses drapeaux disaient déjà l'intention — `is_official = false`, `is_default = false`, `review_status = 'private'`.

**Saisie d'une ligne centrale** pour un futur circuit, via l'inspecteur devenu éditeur.

## IV.9 Économie du coach

**Modèle : place de marché.** OXV encaisse et reverse. Le revenu d'OXV est une **licence de saison à 550 €** par coach.

**Le modèle financier v14 porte déjà ce montant** — `1. Hypothèses` cellule **C21**. Aucune propagation n'est nécessaire. Le 750 € voisin, cellule C22, est l'abonnement **Partenaire Pavillon**, un produit distinct. La ligne de chiffre d'affaires coach est `C11 = '1. Hypothèses'!C30 * '1. Hypothèses'!$D$21` : le prix vit dans une cellule unique, toute modification future s'y fait et se propage seule.

**Cette licence n'est pas un produit de revenu.** Hypothèses du modèle : deux coachs abonnés en année 1, quatre en année 2, huit en année 3. À 550 € TTC, la ligne pèse environ **917 € HT la première année** — marginal dans le chiffre d'affaires. C'est un **mécanisme d'accès**, assumé comme tel.

**Ce que la licence protège : l'accès aux pilotes.** Le verrou n'est donc pas technique — un coach qui a rencontré un pilote au paddock peut l'appeler, aucun dispositif n'y change rien. **La place de marché apporte l'observabilité, pas l'empêchement** : OXV voit les réservations, et un coach présent au paddock dont les séances cessent d'apparaître est visiblement en train de contourner.

**Le verrou est armé par trois pièces**, dont deux existent :

| Pièce | État |
|---|---|
| Masquage des coordonnées du pilote | même règle que pour les partenaires |
| Affiliation `coach_pilots` — sans elle, aucune donnée visible | existe |
| **Charte coach** — interdiction de facturer hors plateforme, sanction par exclusion | **à écrire** |

**État réel.** Quinze écrans sur trente-sept y sont consacrés. **Zéro compte coach en production, donc zéro usage.** Le paiement est aujourd'hui un `Linking.openURL(invoice.paymentLink)` : le coach fournit son propre lien, l'application l'ouvre. Aucun encaissement dans l'application, ni Stripe ni PayPal.

**Blocage à lever en préalable de tout.** `coach_availability`, créée par un vrai coach, est **silencieusement forcée à `closed` par un déclencheur**. Aucun coach ne peut ouvrir un créneau — donc rien de l'économie coach ne se teste.

**Séquence de livraison.** La place de marché exige Stripe Connect, qui exige le SIRET, qui exige l'immatriculation de la SASU prévue en **janvier 2027** — soit le bord exact de l'horizon, sans marge.

**Le flux complet se construit donc sans attendre** : disponibilités, réservation, facture en brouillon, parcours de bout en bout. Seul l'encaissement se branche le jour où le compte Stripe s'ouvre. Ce qui reste conditionné au SIRET : Stripe Connect Express, vérification d'identité par coach, flux de reversement, gestion des litiges.

**Point porté à l'avocat.** Si OXV encaisse pour le compte du coach, OXV apparaît sur le relevé bancaire du pilote pour une prestation de coaching qu'OXV ne fournit pas — ce qui peut fragiliser la position « le coaching est intégralement sous-traité ». La construction propre est un **mandat d'encaissement** : la facture est émise par le coach, OXV n'est que collecteur. À ajouter au dossier de consultation d'avocat, à côté de la responsabilité track day.

## IV.10 Le flux REC — le jour J

Huit écrans : `rec/index` (hub, redirige vers l'étape en cours), `arrivee`, `appairage`, `preparation`, `roulage`, `entre-runs`, `cloture`, plus la capture.

**Trois contraintes physiques propres à ce flux.**

*Pas de Bluetooth en arrière-plan* — `isBackgroundEnabled: false`, aucun `UIBackgroundModes`. La capture ne tourne qu'au premier plan, écran allumé, sous verrou `expo-keep-awake`.

*Reconnexion à deux étages* — palier 2, 4, 8, 16 puis 30 s au maximum. Borné à cinq tentatives hors capture, **illimité pendant**. Un chien de garde applicatif tient un second cycle.

*Consultation en plein soleil* — c'est le seul endroit où le gris secondaire à 7:1 devient discutable.

**Contraste renforcé sur tout le flux.** Ce n'est pas une seconde palette mais une **restriction de la palette existante** : le texte secondaire prend la valeur du primaire, le tertiaire est interdit, les filets montent d'un cran. Mêmes couleurs, échelon supérieur.

**Barre d'onglets** — masquée en roulage uniquement. Elle reste en préparation et en entre-runs : le pilote doit pouvoir sortir.

### Verrouillage du téléphone

Le verrou `expo-keep-awake` empêche la mise en veille **automatique**. Il ne peut pas empêcher un verrouillage **manuel** — aucune application iOS ne le peut. Deux mesures cumulées :

- le verrou logiciel, armé au démarrage de la capture, relâché à l'arrêt ;
- un **avertissement avant le premier run**, formulé précisément : ne pas appuyer sur le bouton latéral. Pas « laissez l'écran allumé », qui décrit le mauvais geste.

### Appairage

**Pendant la reconnexion, l'état réel est affiché** : tentative 3 sur 5, prochaine dans 8 s.

**Après cinq échecs, un diagnostic qui sépare le vérifié du supposé.**

| Vérifiable depuis le téléphone | Non vérifiable — question au pilote |
|---|---|
| Bluetooth activé | le boîtier est-il allumé |
| Autorisation Bluetooth accordée | sa batterie est-elle chargée |
| **Autorisation de localisation accordée** | est-il à portée |
| | est-il déjà lié à un autre téléphone |

La localisation est la cause la plus fréquente et la moins comprise : iOS l'exige pour scanner en Bluetooth. **Elle est signalée dès l'échec, avec un lien vers les réglages.** Un pilote qui l'a refusée ne s'appairera jamais.

Les quatre causes non vérifiables sont posées **en questions, jamais en affirmations**. Écrire « votre boîtier est probablement éteint » serait une valeur inventée.

**Issue de secours après un second cycle** : rouler sans mesure, la séance étant marquée **non mesurée** — jamais vide, jamais à zéro.

*Réserve.* Cinq tentatives font une minute, un second cycle en fait deux. Le diagnostic doit être consultable **pendant** que ça retente, pas seulement après.

### Préparation

Porte l'éligibilité — neuf items, bientôt dix avec l'information L321-4.

**Le pilote déclare, l'admin contrôle au paddock.** La table `public.eligibility_items` existe et porte déjà `validated_by` et `validated_at` — **une seule colonne manque, `declared_at`**, la date de déclaration du pilote, distincte de la validation. En cas d'incident, « le pilote a déclaré son assurance valide le 3 avril, nous avons contrôlé le 14 » n'a pas la même valeur qu'une case cochée — et l'article L321-1 fait peser l'obligation sur l'organisateur.

**Aucun partenaire dans l'éligibilité.** C'est une liste de sécurité : monétiser une non-conformité de freins reviendrait à tirer un revenu d'un défaut de sécurité.

**La décharge** vit ici, derrière le drapeau `pilot_waivers`, fermé en attente de l'avocat.

### Roulage

L'écran qu'on ne regarde pas. Barre masquée, verrou armé, reconnexion illimitée.

**Perte de boîtier en piste : reprise silencieuse, aucune alerte au volant.** Le pilote ne peut rien y faire à 180 km/h, et l'information n'a de valeur qu'au stand. Le trou est marqué.

**Seuil d'interruption** — la durée sans trame dépasse le **tour de référence du pilote sur ce circuit**, avec un repli en secondes si ce tour est inconnu. Le critère ne peut pas être « un tour manqué » compté : sans trames, l'application ne peut pas compter.

**Au retour, l'interruption est expliquée** : durée et nombre de tours perdus. **Le nombre est une estimation, pas une mesure** — la durée divisée par le tour de référence. La formulation sépare les deux registres : « interruption de 2 min 14 s, soit environ deux tours ».

### Entre-runs

Cinq à dix minutes, pilote debout, casque sous le bras.

**Le QCM de ressenti d'abord**, chiffres masqués, passable. Puis le reste.

**Chiffre roi : le cadran de pause.** C'est le seul chiffre roi de l'application qui décroisse — tous les autres sont des mesures acquises. Il reste donc factuel : « prochain départ à 14h20, dans 8 min », jamais une pression. Horaire inconnu : « — », comme partout.

Le meilleur tour du jour et la biométrie suivent.

### Clôture

**Proposée au premier des deux événements** : la fin de la plage horaire (`sessions.end_time`) ou une inactivité prolongée. Le pilote confirme.

**Elle produit un moment de fin de journée** — la journée résumée. C'est le point de bascule où la journée cesse d'être un événement en cours et devient une trace de saison, et où elle se raccroche à la `registration_id`.

**Elle propose de poser la variable de la prochaine fois, pour tous** — y compris les pilotes suivis.

**Règle de préséance.** Si le coach a posé une variable au débrief, la clôture la **montre** et permet de la garder ou de la remplacer, jamais de l'ignorer en silence. En cas de divergence, **la variable du pilote prime** : c'est lui qui roule, et le coach ne prescrit pas.

## IV.11 L'admin terrain

**Modèle hybride.** Écran unique de journée le jour J ; hub structuré le reste du temps. Même logique que l'espace coach — temporel quand ça compte, structuré sinon.

**Séparation verticale sur l'écran de journée.**

| Zone | Contenu |
|---|---|
| Haut — **surveillance** | présents sur inscrits, en piste, boîtiers sortis · puis les numéros en piste |
| Milieu — **gestes**, sous « À faire » en `#D9AE00` | pointage, arbitrage des numéros en double, contrôle d'éligibilité |
| Bas — **consultation** | le plateau du jour, un pilote par ligne |

Les numéros en piste sont **des numéros, pas des noms** — c'est ce que l'administrateur voit passer. Aucun chrono, aucun ordre de performance : `BOARD_MODE = 'A'`.

Un pilote non pointé n'a pas de `display_number` : la ligne affiche « — », jamais un numéro provisoire.

**Temps réel sur tout l'espace**, et non sur les seules séances en cours. C'est un changement de nature : l'écran actuel fait une requête ponctuelle avec un bouton de rechargement, et affiche « N séance(s) active(s) » sur une photographie prise au dernier appui.

**Le parc de boîtiers reste un écran séparé.** Les boîtiers non rendus en fin de journée **ne sont pas suivis dans l'application** — le parc se gère hors produit.

### Le briefing est collectif

`briefing` est l'un des neuf items d'éligibilité, et **le seul qui soit collectif par nature** : il se tient une fois pour tout le monde. Cocher dix-huit pilotes un par un est absurde.

**Un geste unique — « briefing tenu » — bascule tous les présents.** Les absents restent en attente.

### L'incident a un état suivi

Reçu, traité, clos, **avec auteur et date**. Un incident engage l'assurance et l'organisateur : il ne peut pas rester une notification qu'on lit.

### L'admin écrit dans `registrations`

Il annule, modifie et **crée une inscription sur place**.

**Deux gardes obligatoires.**

*Une table d'audit des écritures admin* — qui, quoi, quand. Une inscription vaut un paiement ; sans trace, un désaccord de facturation est insoluble.

*Le site doit accepter des lignes qu'il n'a pas créées.* C'est une demande de raccordement supplémentaire.

### L'admin encaisse en présence — Tap to Pay on iPhone

**Ce n'est pas un achat intégré.** Apple exige l'achat intégré pour les biens **numériques** ; une journée de piste est un service **physique consommé hors de l'application** — la collecte par un tiers y est explicitement permise.

**Tap to Pay on iPhone via Stripe Terminal** lève tout doute : la carte du pilote est approchée du téléphone, c'est du commerce en face à face, avec la technologie d'Apple. Aucun examinateur ne peut le confondre avec un achat numérique.

**Le partage est donc cohérent** : le pilote paie **sur le site** à distance (IV du tunnel de réservation), l'admin encaisse **en présence** au paddock. Ni l'un ni l'autre ne pose la question de la commission.

*Bloqué par le SIRET* — module natif Stripe Terminal et compte Stripe requis.

**Trois corrections structurelles.**

1. **L'espace n'a plus d'entrée.** Le `SpaceSwitcher` n'est monté que dans le hub pilote V1 et le hub coach ; le pilote arrive désormais dans V2, qui ne contient aucun lien vers V1. Le chemin réel fait **six gestes** et passe par l'écran de création de route. **Aucun bouton de déconnexion** n'existe dans l'espace admin.
2. **« Séances en cours » n'est pas en temps réel.**
3. **L'inspecteur circuit est codé en dur sur Haute Saintonge**, alors qu'il devient l'éditeur de géométrie des trois circuits restants.

### Le cumul de rôles

**Un compte porte un seul rôle** — conséquence directe de « `role` fait autorité ».

**Admin et pilote ne se cumulent pas.** Deux comptes distincts pour une même personne physique. Celui qui contrôle l'éligibilité n'est pas celui qu'on contrôle : l'auto-contrôle devient **impossible par construction**, sans garde technique, puisque l'administrateur n'est pas inscrit à la journée qu'il administre.

**Coach et pilote se cumulent.** C'est la norme du métier — un coach roule. Un compte `role = 'coach'` a ses propres séances de télémétrie et accède à son espace pilote. **Le `SpaceSwitcher` sert ce cas et celui-là seul.**

**Une exception nommée : le compte fondateur.** `administration@oxvehicle.fr` couvre tous les rôles. Ce n'est pas une catégorie, c'est un compte exempté. **Conséquence de migration : le miroir `is_admin` ne s'y applique pas** — ce qui lève le piège de verrouillage signalé au chapitre IV.5.

## IV.12 Les notifications

Une application ouverte six fois par an n'existe entre deux journées que par ce qu'elle envoie. C'est le seul lien hors saison.

**État.** Un canal `debrief` déclaré dans `app.json`, `expo_push_token` stocké sur `users`, `enableBackgroundRemoteNotifications: false`, et un `notificationBehaviorForState` qui impose le silence en piste. **La plomberie existe, la politique n'existait pas.**

**Deux familles.** *Ce qui est arrivé au pilote* — bilan prêt, annotation du coach, inscription confirmée, journée dans dix-sept jours. Des faits qui concernent son compte. *Ce qu'OXV voudrait qu'il fasse* — places disponibles, nouveau partenaire. Des sollicitations.

**OXV s'autorise les deux, et le pilote règle.** Ce qui suppose des réglages qui n'existent pas : un canal unique signifie qu'un pilote coupant les relances coupe aussi son bilan. Il n'a pas un choix, il a un interrupteur.

### Quatre canaux

| Canal | Contenu | Défaut |
|---|---|---|
| **Votre séance** | bilan prêt, annotation, rapport du coach | actif |
| **Votre journée** | inscription confirmée, rappel, changement d'horaire | actif |
| **Le club** | places disponibles, nouveaux partenaires, nouveautés | actif |
| **Votre coach** | demande d'affiliation, message | actif |

Les quatre sont actifs à l'installation — **choix commercial assumé** : le pilote reçoit sa première sollicitation club sans l'avoir demandé.

**Le stockage existe** — `users.notification_preferences`, en JSONB. Les « rituels » de `reglagesRitualsLogic` sont ces préférences fines : `bilan` → canal `debrief` (J+1, déjà programmé), `j3` → `ritual_j3` (rappel J-3). *Corrigé le 26/07 : le dossier affirmait auparavant qu'aucun stockage n'existait.*

**Le rapport du coach déclenche une notification** — c'est un fait qui concerne le pilote, au même titre qu'une annotation.

### Le silence

**En piste** — règle existante, conservée.

**De 22 h à 8 h, fuseau du pilote.** Il ne s'agit pas d'annuler mais de **différer** : un bilan prêt à 23h40 se pousse le lendemain matin. La notification attend, elle n'est pas perdue.

*Conséquence technique.* Le report se calcule côté serveur, au moment de l'envoi : **le fuseau du pilote doit y être stocké**. `expo-localization` est en dépendances, la donnée est accessible à l'installation, mais aucune colonne ne la porte.

**Registre.** Une notification énonce un fait. Jamais de reproche déguisé en constat — « vous n'avez pas roulé depuis trois mois » est exactement le registre que l'application s'interdit à l'écran, et l'interdit ne s'arrête pas au bord de l'application.

## IV.13 Le Club, VOUS, et la structure de navigation

**Quatre portes maintenues** — Miroir, Data, Club, Vous. **Icône et libellé**, jamais l'icône seule : sur une application ouverte six fois par an, un mot ne se devine pas, et « Miroir » ou « Data » ne correspondent à aucune icône universelle. L'argument qui a fait choisir quatre portes stables vaut aussi pour les mots.

**Le bouton central ouvre le Pass.** Cela lève le câblage provisoire du lot L0, qui ouvrait le Club par défaut.

### Le Pass

**Il existe dès maintenant, sans attendre `app_payments`.** C'est l'écran de ce que le pilote **possède** — inscription, offre, créneau, décharge — avant d'être un objet de vente. Le tunnel de réservation s'y branche le jour où le drapeau s'ouvre.

### Le carnet remonte dans Data

Sa matière première vient désormais du QCM d'entre-runs et de la variable de séance ; il n'est plus alimenté depuis VOUS. Il devient une **lecture longitudinale**, à côté de la saison et de la signature.

**Data porte alors deux territoires**, séparés visuellement : ce que le boîtier a mesuré, ce que le pilote a écrit. La frontière est de mise en page, pas de convention de couleur — une convention s'oublie, une section se voit. Ce que le pilote écrit ne doit jamais avoir l'apparence d'une mesure.

*État.* Les quatre onglets du carnet — notes, intentions, objectifs, cycles — sont **vides en production**, et l'écriture n'existe pas avant le lot 16.

### Le garage aux deux endroits

**La fiche véhicule vit dans VOUS** — c'est l'identité du pilote. **Le sélecteur de véhicule vit dans Data** — c'est une clé de lecture, puisque le filtre par paire circuit-véhicule et le véhicule principal en dépendent. Un objet, deux usages, aucune duplication d'écran.

### Ce qui reste dans VOUS

Profil, garage, documents, équipement, réglages, notifications, amis, partages, compte, aide, à propos.

*Constat non résolu.* VOUS reste le seul espace dont la fonction n'a pas été formulée : il mêle l'identité du pilote et l'administration de son compte. Le carnet en sort, ce qui l'allège, mais ne le définit pas.

## IV.14 L'onboarding

**Cinq étapes** — accueil · **doctrine et méthode fusionnées** · niveau · CGU · pacte. Puis la prise en main.

**Doctrine et méthode en une seule étape.** Deux écrans de texte avant d'avoir rien vu, c'est trop pour quelqu'un qui vient de payer sa journée. **Le détail est accessible à tout moment dans la méthode publiée** — elle explique déjà comment le QDI est calculé et ce que chaque branche ne mesure pas. L'onboarding pose le principe ; la méthode publiée porte le reste, consultée quand le pilote en a besoin.

**Le moment.** L'onboarding arrive **après** l'inscription et le paiement sur le site. Le pilote a déjà décidé : c'est une prise en main autant qu'une présentation. Doctrine d'abord, prise en main ensuite.

**Ce qui n'y est plus** : le choix du numéro, qui vit sur le site à l'inscription.

**Ce qui n'y est pas** : l'appairage réel du boîtier. La prise en main l'**explique** sans le faire. Conséquence assumée : le pilote découvre au paddock si sa localisation est refusée ou sa radio coupée. **Le diagnostic d'appairage (IV.10) devient donc la seule ligne de défense**, et doit être irréprochable.

### Le pacte

**Engagement mutuel.** OXV s'engage sur trois points :

1. **Ne jamais vous dire quoi faire au volant.**
2. **Ne jamais vous classer contre un autre pilote.**
3. **Ce que vous écrivez n'est vu de personne sans votre accord.**

*Réserve de rédaction sur le troisième.* Le ressenti après run **est partagé au coach** — c'est le cœur de la boucle pilote-coach. La formulation doit distinguer ce qui reste privé (carnet, intentions, objectifs) de ce qui alimente le débrief, sinon l'engagement est faux dès la première séance.

**Un engagement mutuel écrit est un document contractuel**, pas un texte de registre. Il vit à côté des CGU et de la décharge, et **rejoint le dossier avocat** avec la charte coach et le mandat d'encaissement.

## IV.15 Le partage entre amis et la comparaison

### Ce que le schéma accordait déjà

`are_friends(user_a, user_b)` est bien construite : **réciprocité obligatoire** (`pilot_friendships.status = 'accepted'`), ordre canonique, `security definer`. Ce n'est jamais un accès unilatéral.

Son étendue est en revanche totale :

| Table | Ce qu'un ami peut lire |
|---|---|
| `telemetry_sessions` | meilleur tour, tour moyen, vitesse max, G max |
| `telemetry_frames` | **la télémétrie brute, chaque trame à 25 Hz** |
| `app_session_analyses` | la marge **et** le QDI |
| `app_segment_analyses` | l'analyse par segment |
| `session_media` | les photos |

**La doctrine était donc déjà contredite par la base**, sans que personne l'ait relevé. Il ne manquait qu'un écran.

`social_pings` existe également et n'a jamais été examinée.

### `duels` est supprimée

Zéro ligne, donc zéro perte. La table portait `challenger_id` / `opponent_id`, deux temps au tour, un `status` et un `resolved_at` : **un défi qui se résout, donc un vainqueur**. C'est un classement entre pilotes, interdit sans amendement possible.

### Une table `comparaisons` la remplace

Ce qui disparaît de l'ancienne structure : l'asymétrie défieur/défié, le statut, la résolution. Une comparaison ne se gagne pas.

Ce qui reste : deux participants, deux séances, deux tours, un circuit — et **un même véhicule, ou la mention explicite qu'ils diffèrent** (un tour de référence n'a de sens qu'à circuit et véhicule constants, voir VII.1).

**Conditions d'ouverture** : `are_friends()` vrai, et consentement des deux à la comparaison — l'amitié seule ne suffit pas.

### L'affichage

**Deux colonnes, aucun vainqueur, aucun delta coloré.** Le pilote lit lui-même laquelle est la plus rapide. Aucune flèche, aucun signe, aucun « + » ni « − ». Règle identique à « un an plus tôt » et au « run précédent » du bilan.

### Réserve juridique — à porter à l'avocat

L'article R331-20 protège OXV parce qu'un roulage libre **sans chronométrage ni classement** n'est ni une concentration ni une manifestation. Une comparaison chronométrée entre deux participants **de la même journée**, fournie par l'organisateur, entre dans une zone grise : OXV ne classe pas, mais il outille la comparaison des participants de son propre événement.

Une comparaison entre deux journées différentes, ou entre deux saisons, ne pose pas ce problème.

**Question à trancher avec l'avocat** : la comparaison doit-elle être interdite entre deux pilotes de la même journée, ou l'absence de classement affiché suffit-elle ?

## IV.16 Le Territoire

Cinq tables, toutes vides sauf une, jamais examinées avant ce dossier : `circuit_services`, `lodgings`, `restaurants`, `social_pings`, `scenic_routes`.

### Deux systèmes commerciaux distincts

| Système | Tables | Nature |
|---|---|---|
| **Partenaires** | `partner_accounts`, `partner_offers`, `partner_leads` | une **offre** — prix, quota, validité, mise en relation |
| **Territoire** | `circuit_services`, `lodgings`, `restaurants` | un **lieu** — adresse, coordonnées, distance au circuit |

**Un restaurant près du circuit n'est pas une offre, c'est une information.** Un pilote veut savoir où dormir et où manger : c'est un service. Une nuit à 180 € avec quatre places sur huit et un départ groupé est une offre — elle a un prix, un quota, une date limite.

**Le même établissement peut être les deux**, sans duplication : le lieu vit dans le Territoire, l'offre dans `partner_offers`, et `partner_id` fait le lien. Le motif existe déjà sur `social_pings`.

### `is_premium` est supprimé des quatre tables

**C'est un vestige d'un modèle abandonné.** Le modèle financier porte, ligne 49 de `1. Hypothèses` : *« PLV — emplacements vendus (0 : décision fondateur, régie 100 % saison) »*, **datée du 12 juillet 2026**. Le placement payant a été écarté ; le schéma ne l'a pas suivi.

Aucun revenu n'est perdu : il vient de l'abonnement Pavillon à 900 € HT la saison (`D46`), indépendant de tout placement.

**Règle qui découle de la suppression** : un lieu ne se distingue jamais par ce qu'il a payé. Une liste de lieux est une information, et une information dont l'ordre s'achète cesse d'être fiable.

### `social_pings` — réservée aux partenaires

Annonces datées : `kind`, `title`, `starts_at`, `ends_at`, `live_url`, `event_url`, réseaux sociaux, `share_token`, `partner_id`.

**Fermée aux pilotes.** Ouvrir la publication aux utilisateurs imposerait une file de modération, laquelle vit dans l'admin lourd — donc sur le web, hors du périmètre mobile. Le coût dépasse le bénéfice.

`is_published` reste utile : préparer une annonce et la publier à la date voulue.

**Règles éditoriales, portées par le contrat partenaire** — ni compétition, ni chronométrage, ni classement annoncés. Même mécanisme que l'interdiction de l'urgence fabriquée : une clause contractuelle, pas une file de modération. Ce que l'application ne dit pas, un tiers ne doit pas le dire à sa place sur sa surface.

### `scenic_routes`

Une ligne en production. Porte `status`, `certified_by`, `certified_at`, `review_notes` — c'est la certification que vous avez décidé de porter avec `creer-route` et `mes-routes`. Cohérent, rien à arbitrer.

## IV.17 La découverte de coachs

Vingt tables coach existent. Cinq n'avaient jamais été mentionnées.

| Table | Lignes | Ce qu'elle porte |
|---|---|---|
| `coach_profiles` | **1** | headline, bio, spécialités, palmarès, circuits, `season_price_eur`, `session_price_eur`, `billing_siret`, `vat_regime` |
| `coaching_bookings` | **2** | `amount_cents`, `billing_status`, `coach_note`, statuts complets |
| `coach_permissions` | **1** | `can_view_pilots`, `can_manage_own_sessions`, `can_view_business_dashboard`, `granted_by` |
| `coach_queue` | 0 | coach, pilote, séance télémétrique, statut |
| `coach_payout_details` | 0 | IBAN, BIC, titulaire |
| `coach_testimonials` | 0 | texte, prénom d'auteur, publication — **aucune note** |

**Un profil coach et deux réservations existent en production, alors qu'aucun compte ne porte le rôle `coach`.**

### Un seul modèle de paiement : la place de marché

Le schéma en portait deux, comme `duels` portait deux doctrines. `coach_profiles.payment_link` — facturation directe — **est supprimé**. `coach_payout_details` reste.

**Ce qui reste de la facturation, et doit rester** : `billing_siret`, `billing_name`, `billing_address`, `vat_regime`, `vat_rate`. Le mandat d'encaissement suppose que la facture soit émise **au nom du coach**, OXV n'étant que collecteur. Sans ces champs, la construction juridique portée à l'avocat ne tient plus.

La charte coach — interdiction de facturer hors plateforme — conserve donc son objet.

### `coach_queue` est déjà la file « À débriefer »

Coach, pilote, séance télémétrique, statut. Le hub coach (VII.2) n'a rien à créer : la table existe.

### `coach_permissions` reste

Seconde couche d'autorisation au-dessus de `role`, accordée par un tiers (`granted_by`). **`role` ouvre l'espace, les permissions affinent ce qu'on y fait.** Ce n'est pas une contradiction avec « `role` fait autorité », c'est un raffinement — mais il n'avait jamais été nommé.

### La validation du profil

**`coach_testimonials` est supprimée.** Deux validations tierces la remplacent, dont aucune n'est une note :

*La vérification OXV*, effectuée **une fois, à l'entrée dans le club**. Marqueur « Profil vérifié ».

*Les faits d'activité*, dérivés de `coaching_bookings` : « 12 séances accompagnées cette saison, sur 3 circuits ». Un relevé, pas une opinion — infalsifiable, le coach ne peut pas l'écrire lui-même.

**Deux risques assumés.**

Le profil reste **modifiable après vérification**, et le marqueur ne porte pas de date : OXV cautionne donc implicitement des contenus qu'il n'a jamais vus. Un coach peut ajouter une ligne de palmarès le lendemain.

Les faits d'activité créent un **ordre implicite entre coachs**. C'est cohérent avec l'amendement de doctrine (II) : OXV ne classe pas, il affiche un relevé, le pilote lit lui-même.

## IV.18 Le statut fondateur

**C'est un statut, pas un espace.** Aucun écran dédié.

### Il n'avait aucun support

`users` ne portait **aucune colonne** — ni `is_founder`, ni rang, rien. Deux tables existaient sans se rejoindre :

| Table | Lignes | Clé | Nature |
|---|---|---|---|
| `founder_applications` | 0 | `user_id` | candidature côté application — motivation, `referrer_code`, décision |
| `founding_members` | **1** | **`email`** | signature côté site — Yousign, `consent_rgpd`, `statut` |

Aucune clé commune. Le seul rapprochement possible était l'adresse électronique, qui casse dès qu'un pilote signe avec une autre que celle de son compte.

### Le modèle retenu

**Les deux tables font autorité, dans l'ordre** : candidature, puis signature. **`founding_members` gagne un `user_id`.**

**`users.founder_since`** porte le statut. **Un `founder_number`** est attribué.

**Séquence d'attribution.** La signature a lieu sur le site, et le signataire **peut ne pas avoir de compte** — c'est même le cas normal : on signe pour rejoindre, on crée son compte ensuite.

1. Le numéro s'attribue **à la signature**, sur `founding_members`, dans l'ordre réel des signatures — c'est ce qui lui donne son sens.
2. `users.founder_since` et le numéro sont **propagés au rattachement du compte**, par correspondance d'adresse.
3. Le numéro reste celui de la signature, jamais celui de l'inscription.

**Attribution par séquence dédiée**, sur le motif de `next_coach_invoice_number` : deux signatures simultanées ne peuvent pas recevoir le même numéro.

**Acquisition à la signature de la lettre d'intention**, non engageante. Un numéro peut donc être immobilisé par quelqu'un qui ne rejoindra jamais — sans conséquence visible, puisque le numéro est privé. `founding_members.statut` permet de marquer l'abandon sans le libérer.

**Le statut est visible, le numéro reste privé.**

### Ne pas confondre

**Heritage** est un palier commercial à 2 490 €, porté par `heritage_packs` et `registrations.heritage_pack_id`. **Fondateur** est un statut d'adhésion. Deux choses distinctes qui partagent un registre visuel — l'or `#C4A459` appartient au premier, pas au second.

## IV.18bis Le fil de séance, le marqueur et la carte

**Spécification complète : `OXV_Mirror_V3_Arbre_Coach.md`, sections II à IV.** Rappel de ce qui engage le reste du produit.

### Le fil de séance

**Il s'écrit seul pendant le run et *est* le débrief quand le pilote rentre.** Le coach n'ouvre pas un écran d'analyse : il ouvre ce qu'il a sous les yeux depuis vingt minutes.

**Trois registres se distinguent sans légende** — gris pour la machine, **rouge de marque** pour le coach, trait clair pour le pilote.

**Il rend inutiles quatre écrans** : `debrief`, `triage`, `lecture`, `priorites` — **1 983 lignes**.

### Le marqueur résolu

Le coach marque — geste du Neural Band, doigt sur le plateau, ou dans le focus. **L'application ne stocke pas un horodatage : elle le résout** en tour, virage, vitesse d'entrée, décélération, distance avant la corde.

**Il porte sa provenance** — horodatage, auteur, source — et **ressort partout** : file de lecture, carte de séance, préparation suivante du pilote.

**Il fusionne avec `coach_pilot_highlight` et avec le marquage pilote** : un seul mécanisme, deux origines.

### La carte de séance

Ce que le pilote reçoit. **La voix de son coach en premier objet, avant tout texte** — trente secondes d'audio réel. Un texte est froid ; une voix porte le ton et l'insistance, et **elle est infalsifiable**.

Puis : une chose à emporter, **attribuée**, sous la phrase qui énonce la doctrine — « ses mots, pas une consigne de l'application ». Un moment ancré sur le tracé. Et **le retour à la préparation suivante**, trois semaines plus tard.

**C'est la seule prescription du produit, et elle appartient à un humain.**

## IV.19 Les écuries

Découvertes par la vérification préalable, jamais discutées auparavant. `crews` et `crew_members` existent, à zéro ligne, avec cinq fonctions serveur.

### Le mécanisme, tel que la base l'encode

| Étape | Mécanisme |
|---|---|
| Le code | `users.affiliation_code`, lu par `oxv_get_my_referral_code()` |
| Le rattachement | `oxv_redeem_referral(p_code)` → `{ok, crew_id}` ou `{ok:false, error}`. Le parrain devient capitaine |
| **La validation** | déclencheur `trg_referral_validate` sur `public.payments` — `referral_validated` bascule quand un statut passe à `succeeded`. **Un filleul qui s'inscrit sans payer ne compte pas** |
| Le baptême | `oxv_name_my_crew(p_name)` — 3 à 40 caractères, `named_at` horodate. Capitaine seul |
| La visibilité | `crews_public_rows()` ne retourne que les écuries **nommées** dont les membres validés — capitaine inclus — **atteignent vingt** |

`crew_members` porte `role`, `referred_by`, `referral_validated`, `joined_at`.

### Décisions

**L'annuaire est trié par nombre de membres**, mais **sans numéro de rang**. L'ordre porte l'information — le lecteur voit que celle-ci est plus grande ; le numéro déclarerait un verdict. Même règle que les deux colonnes de comparaison : la position compare, le signe juge.

**Le seuil de vingt reste** — c'est un fait, pas un badge. *Réserve* : avec 43 journées et une poignée de pilotes, **l'annuaire public restera vide toute la première saison.**

**L'avantage du parrain est symbolique** — le nom de l'écurie, l'appartenance. Aucun avantage commercial. *Constat* : aucun avantage n'existe en base, `referral_validated` n'étant qu'un booléen.

**Le capitaine exclut et invite ; les autres membres invitent seulement.** *Conséquence* : exclure fait baisser le compte de membres validés, donc le seuil de vingt. Point ouvert — un pilote exclu peut-il rejoindre une autre écurie ?

**Le parrainage quitte définitivement `rec/preparation`** et vit dans l'écurie. Un pilote qui prépare sa journée ne recrute pas.

### L'écurie est un objet social

**Elle vit dans le Club** — « votre appartenance ».

**Le logo est téléversé par le capitaine.** *(Le blason généré depuis les circuits roulés est réservé à un autre usage : la marque personnelle du pilote.)*

**Sept objets :**

*La saison collective* — kilomètres, journées, circuits. **L'écurie est un sujet unique**, pas une somme de membres comparés. Elle a donc une raison d'exister au-delà du recrutement, et personne n'y est classé.

*Les tracés superposés* — le meilleur tour de chaque membre sur un même circuit, **dessinés ensemble, sans aucun chrono**. On voit les lignes diverger à un virage, se rejoindre en ligne droite. **C'est une comparaison de trajectoires, pas de temps.** La ligne du lecteur est blanche, celles des autres grises : il reste le sujet, les autres sont le contexte. Nommés, puisque cela reste dans le groupe.

*Les journées communes* — « quatre membres inscrits le 14 avril ». Le vrai service : savoir qu'on se croisera. Croisement de `registrations` et `crew_members`, rien à créer.

*Le garage collectif* — les véhicules de tous les membres. **Une écurie est définie par ses voitures** bien plus que par ses temps, et c'est de l'identité, pas de la mesure.

*Le carnet de bord* — le fil de l'écurie sur la saison, **d'événements et non de performances** : une première fois, une arrivée, une journée commune. L'écurie a une mémoire sans jamais classer.

*Le mur* — les photos de séance de tous les membres.

*Le direct partagé* — le jour J, un bandeau dit qui roule. L'infrastructure existe.

**Aucun chrono n'apparaît nulle part dans l'écurie.**

### La comparaison reste réservée aux amis

Une écurie ne vaut pas consentement mutuel : A rejoint l'écurie de B, puis C la rejoint — **A et C ne se sont jamais choisis**. C'est le problème de `comparer-pilotes` côté coach.

`are_friends()` exige une acceptation des deux côtés ; l'appartenance à une écurie non. **L'écurie affiche donc des faits, jamais une mise en regard chiffrée.**

## IV.20 La mémoire du circuit

**Un actif qui grandit, et qu'aucun concurrent ne peut copier sans les données.** Année un, elle est maigre ; année trois, elle est unique.

Vous accumulez les trajectoires de tous les pilotes sur les mêmes virages. Agrégées, elles disent **où le circuit se joue** — un fait sur la piste, jamais sur les pilotes.

### Trois objets

**La carte de dispersion.** Pour chaque virage, l'écart entre les lignes. Là où tout le monde passe pareil, il n'y a pas de choix ; là où les lignes s'écartent, la technique décide. Le tracé se colore par cette dispersion, et **le circuit révèle sa propre difficulté**.

**Le couloir.** L'enveloppe contenant toutes les lignes à un virage donné. **L'outil est le curve boxplot** (Mirzargar, Whitaker & Kirby, IEEE TVCG 2014) : il produit une **trajectoire médiane réellement roulée** — jamais une moyenne synthétique —, une bande à 50 %, une enveloppe, et distingue les écarts de position des écarts de forme. Ses auteurs valident précisément notre cas : « the cognitive load of direct ensemble visualization prevents its deployment to the public ». Le pilote y **situe** la sienne, sans être classé. C'est une comparaison qui ne peut pas classer : aucune position dans un couloir n'est meilleure qu'une autre.

**La convergence.** Sur une saison, la ligne d'un pilote se rapproche ou non du centre du couloir. **Soi contre soi**, mesuré par la mémoire du circuit.

### La ligne médiane

**Elle se trace, mais jamais superposée à la ligne du pilote.**

Superposée, elle transformerait un fait en cible : le pilote se demanderait « suis-je sur la bonne ligne ? », et l'application aurait prescrit sans un mot. Séparées, **la médiane décrit le circuit, la ligne décrit le pilote** — le lien se fait dans sa tête, jamais dans l'écran.

**Nom** : « ligne médiane » est un fait ; « ligne idéale » serait une prescription.

### Le seuil — une méthode, pas un nombre

**La mémoire existe quand l'estimation de dispersion cesse de bouger** : quand ajouter dix séances ne déplace plus le résultat au-delà d'une tolérance. Critère statistique mesurable, et non seuil arbitraire indéfendable.

En deçà, le virage affiche « — » et sa raison : « mémoire insuffisante, 7 séances ».

### Deux gardes

**L'agrégation passe par une fonction `security definer` qui ne retourne que des agrégats**, jamais une ligne individuelle — motif de `crews_public_rows()`.

**Aucune mémoire sous le seuil.** Une dispersion sur trois passages serait une valeur inventée.

### Où elle vit

**Dans le Territoire, avec le circuit.** Celui-ci portait les services, les lieux et les annonces ; il gagne la géométrie, la dispersion et la mémoire. **Le Territoire devient l'objet circuit** — ce que le produit n'avait pas, alors qu'il est un club à un circuit.

### Deux prolongements

**La sécurité par la donnée.** Les virages où la dispersion **et** le G latéral sont tous deux élevés concentrent les écarts. Un organisateur qui peut le dire tient un outil opérationnel réel — et un argument de partenariat avec le circuit.

**La mémoire par condition.** Quels virages changent le plus entre sec et pluie. Un fait sur la piste sous conditions, qui donne enfin un usage honnête aux données météo — sans jamais corréler performance et température.

## IV.21 Les surfaces iOS — présence hors application

**Sur un produit ouvert six fois par an, la présence hors de l'application vaut autant que dedans.** Un pilote au paddock, gants à la main, ne déverrouille pas son téléphone — il le regarde.

### Trois surfaces, trois distances

| Surface | Contenu | Contrainte |
|---|---|---|
| **Dynamic Island compacte** | meilleur du jour · temps avant le départ | **36 px de haut, texte 15 pt** — deux valeurs, rien de plus n'entre |
| **Dynamic Island étendue** | circuit, run, numéro · meilleur du jour · prochain départ · **les tours en barres**, meilleur en blanc | jusqu'à 144 pt · le graphique tient en 22 px |
| **Écran de verrouillage** | **tracé en filigrane à 50 % d'opacité** · prochain départ en chiffre roi · meilleur, tours, runs | la surface la plus vue de la journée |

**C'est sur l'écran de verrouillage que l'identité visuelle travaille le plus** — un pilote regarde son téléphone posé sur le siège une douzaine de fois par journée.

### Les widgets couvrent le hors-saison

Onze mois sur douze.

*La prochaine journée* — tracé en filigrane, date en chiffre roi, décompte **en jours**.
*Votre référence* — signature en barres, pilier **Aplomb** en moignon (hors des cinq branches), meilleur tour et circuit.

### Contrainte technique

**Une Live Activity a une durée de vie bornée par iOS** et se met à jour par notification distante ou depuis l'application au premier plan.

Un run dure vingt minutes, une journée huit heures. **Il faut donc une activité par run** — démarrée à l'armement (`rec/placement`), close à la fin du run — et non une seule qui couvrirait la journée.

## IV.22 Le carnet d'entretien du véhicule

**La seule fonctionnalité où la donnée d'OXV a de la valeur hors de la piste.**

### La distinction qui la rend possible

**L'éligibilité est une obligation de sécurité contrôlée par l'organisateur** — le commerce y est banni (IV.10). **L'entretien est la décision du propriétaire** — le commerce y est légitime, à condition de ne rien prescrire.

### L'application compte, elle n'estime jamais

**Aucun pourcentage d'usure, aucune couleur d'alerte, aucun « à changer ».** Kilomètres, freinages, G moyen et maximal, journées, jours, circuits. Estimer une usure sans mesure serait la valeur inventée que la doctrine interdit.

**Ce qui use n'est pas le kilométrage** : 312 freinages au-delà de 1,2 G disent plus que 1 240 km. Deux voitures au même compteur n'ont pas les mêmes plaquettes, et personne ne le sait aujourd'hui.

### Trois niveaux de précision, toujours annoncés

| Niveau | Ce que le pilote fournit | Ce que l'application produit |
|---|---|---|
| **0** | rien | compteurs seuls — suffisant pour qui ne veut rien saisir |
| **1** | le matériel monté | **son propre historique** : « vos Pagid RSL29 ont tenu 1 900 km, vos OEM 1 100 » |
| **2** | **une mesure d'épaisseur** | un **taux réel** — neuves à 15 mm, mesurées à 8,4 mm après 2 847 freinages = 2,3 µm par freinage, **sur sa voiture, avec son pilotage**. Puis « environ 3,1 mm consommés depuis ». Le mot « environ » sépare la mesure de la dérivation |

### Quatre questions au pilote, aucune technique

**Quand · chez qui · neuf ou d'occasion (pneus) · une photo de facture, facultative.**

**La photo est la plus intelligente** : elle contient déjà marque, référence, dimensions et prix. Le pilote ne saisit rien, il photographie.

**Jamais en amont.** Personne ne remplit un formulaire d'entretien. Les questions apparaissent **quand le pilote montre de l'intérêt** — à l'ouverture d'un élément, ou à la déclaration d'un changement — et l'application dit ce qu'elle y gagnerait.

### Le partenaire technique complète

**Une quatrième nature de partenaire**, ou un attribut sur `type` : **le partenaire technique écrit dans le carnet**.

Il saisit épaisseurs, références, voilage, norme et point d'ébullition, dimensions et profondeur. **Et il voit ce qui l'intéresse** : 2 847 freinages dont 312 au-delà de 1,2 G, sur quatre circuits. **Aucun garagiste n'a jamais eu cela.**

**Proposition de valeur** : « faites entretenir votre voiture chez un partenaire OXV, votre carnet se tient tout seul » — un argument que ni Garmin ni Apex ne peuvent formuler, faute de partenaires et de club.

### L'intervention est l'unité

Un garage qui refait un freinage touche plaquettes, disques et liquide dans la même visite.

**Date · partenaire · éléments touchés.** Le pilote déclare, le partenaire complète.

**Le consentement porte sur l'intervention entière** — pas sur le véhicule, pas pour toujours. Le pilote désigne le partenaire, et **cette désignation est le consentement**, même logique que l'amitié.

### Cinq groupes suivis

**Freinage** — plaquettes et disques par essieu, liquide. *Le groupe où la donnée est la plus riche.*
**Pneumatiques** — par essieu ou par roue. Usés par les kilomètres et le G latéral.
**Fluides** — moteur, boîte, refroidissement. Usés par les heures et la température.
**Liaison au sol** — amortisseurs, ressorts, rotules. Peu de données, mais des dates.
**Sécurité** — harnais, baquet, extincteur, coupe-circuit.

### Le groupe sécurité ferme une boucle

**Harnais et extincteur ont des dates de péremption réglementaires** — exactement ce que le contrôle au paddock vérifie.

Le carnet porte la date, **`eligibility_items` la lit**, comme il lit déjà `documents.document_id`. Le pilote saisit une fois, l'application prévient avant la journée, l'admin contrôle au paddock. **Trois écrans, une seule donnée.**

**Sans contredire l'interdit du commerce dans l'éligibilité** : le carnet est en amont, l'éligibilité est un constat. Un harnais qu'on achète relève de l'entretien ; un harnais périmé le jour J relève de la sécurité.

### La couleur — la règle

**La teinte mesure, la valeur catégorise.**

*Le tracé des zones de freinage et l'histogramme d'intensité* portent la **rampe Oklab** — grandeur continue, donc teinte. **Aucun rouge : le rouge jugerait.**

*La répartition par circuit* n'est qu'en **valeurs de gris** — un circuit n'est pas plus intense qu'un autre, il est différent. Le blanc va au plus roulé.

*La courbe d'accumulation* s'arrête au jour présent et **ne se prolonge jamais** : extrapoler serait prescrire.

### Le partenaire, en dernier

**Après un filet, sous une phrase factuelle** — « trois préparateurs du club travaillent le freinage ». Pas de logo, pas de prix, pas d'offre, pas d'urgence.

Il n'apparaît **que dans le détail d'un élément ouvert**, jamais dans la liste, jamais sur l'écran principal. Et il **ne réagit à aucun seuil** : le faire apparaître à 1 500 km serait fabriquer le besoin.

---

# V. DIRECTION VISUELLE

**Le détail complet est dans `OXV_Mirror_V3_Dossier_Conception.md`** — typographie jusqu'au choix de fonte, système dimensionnel chiffré, couleur, mouvement, présentation de la donnée, signatures visuelles, pile de rendu, treize vérifications sur appareil. Ce chapitre n'en garde que les principes.

**Fond `#0A0A0A`.** Surfaces `#141416`, `#1E1E22`, filets `#1E1E22`, bordures `#2E2E34`, gris de texte `#8C8C92` et `#6A6A70`. `app.json` aligné — le splash et l'icône adaptative passent de `#050505` à `#0A0A0A`.

**Cinq principes** — la donnée occupe la page ; la couleur vient de la mesure ; un chiffre roi par écran ; le texte est légende ; le tracé du circuit est l'objet identitaire.

**Radar réservé à la Signature.** Barres partout ailleurs, y compris l'accueil.

**Écarté par l'audit : le Display P3.** La palette est en sRGB et close ; l'activer saturerait tout, et l'export Skia hors écran reste en sRGB de toute façon.

---

# VI. PILE TECHNIQUE

## VI.1 État réel constaté

| | Actuel | Cible | Saut |
|---|---|---|---|
| Expo SDK | **51.0.28** (mai 2024) | 55 | **4 majeures** |
| React Native | **0.74.5** | 0.83 | 9 mineures |
| React | **18.2.0** | 19.2 | 1 majeure |
| Skia | **1.2.3** | 2.8.x | **1 majeure** |
| Reanimated | **3.10.1** | 4.x | **1 majeure** |
| Architecture | **ancienne** (`newArchEnabled` absent) | nouvelle | bascule complète |

**Trois dépendances lourdes à l'usage inconnu** : `@react-three/fiber` 8.17 + `three` 0.169 + `expo-gl` 14 (troisième moteur de rendu, WebGL) ; `react-native-maps` 1.14 ; `react-native-webview` 13.8.

**Six dépendances à risque de migration** : `react-native-ble-plx` 3.2 (critique — toute la capture) ; `react-native-mmkv` 2.12 → 3.x (migration obligatoire, stockage et file hors ligne) ; `react-native-health` 1.19 (Fabric incertain) ; Skia 1 → 2 ; Reanimated 3 → 4 ; `expo-av` 14, scindé en `expo-video` et `expo-audio`.

**Piège silencieux.** Le plugin Babel de Reanimated change de nom en version 4 : `react-native-reanimated/plugin` devient `react-native-worklets/plugin`. Si `babel.config.js` n'est pas mis à jour, rien ne compile et le message d'erreur ne dit pas pourquoi.

**Ce qui s'allège.** `react-native-svg` disparaît avec l'ancien kit. Six des neuf paquets de polices partent avec l'arbitrage typographique : geist, geist-mono, instrument-serif, rajdhani, michroma, hanken-grotesk.

## VI.2 Aucune bibliothèque de graphiques

Décision arrêtée. Aucune bibliothèque ne sait dessiner un ruban de circuit peint par la vitesse ni un nuage g-g décimé — ces rendus sont en Skia sur mesure quoi qu'il arrive. Le seul composant qu'une bibliothèque couvrirait est le canal de télémétrie ; l'écrire dans le même idiome coûte moins que d'importer Victory Native et de désactiver ses axes, graduations et marges, qui contredisent la direction visuelle.

`d3-scale`, `d3-shape` et `d3-array` fournissent les mathématiques sans rien dessiner. Le curseur partagé s'écrit en Reanimated et Gesture Handler.

## VI.3 Le ruban coloré — technique de référence

Skia ne possède **aucun dégradé natif suivant un chemin arbitraire**. Découper le tracé en sous-chemins est à proscrire. La technique est l'API `Vertices` en mode `triangleStrip` avec une couleur par sommet.

1. **Projection** — géographique vers plan métrique local. `circuits.centerline_latlon` fournit l'origine.
2. **Décimation** — conserver un point si la distance depuis le dernier retenu dépasse ~1,5 m **ou** si le cap a varié de plus de 2°. 30 000 trames tombent à 1 000–1 500 points par tour.
3. **Tangente** par différence centrée sur les deux voisins ; **normale** perpendiculaire.
4. **Sommets** — deux par point, décalés d'une demi-largeur de ruban (7 à 9 points d'écran).
5. **Couleur** — rampe à quatre arrêts sur la vitesse normalisée, interpolée en Oklab. Les deux sommets d'un point partagent la couleur.
6. **Assemblage** — alternance A₀, B₀, A₁, B₁… en `triangleStrip`. Circuit fermé : réémettre A₀ et B₀.

**Piège.** Quand `colors` est fourni, react-native-skia mélange avec la peinture selon un mode par défaut `dstOver`. Le poser explicitement, ne pas fournir de shader concurrent, sinon le ruban sort gris.

**Coût.** 1 600 à 3 000 sommets, une seule primitive de dessin par tour.

## VI.4 Le nuage g-g

Décimation ou agrégation en densité obligatoire. `drawPoints` avec une peinture unique, ou `Vertices` coloré par sommet. `Atlas` peut être plus lent que l'API `Picture` : à mesurer, pas à supposer.

## VI.5 Images

**ThumbHash**, retenu contre BlurHash — bords plus nets, transparence gérée.

**Défaut prioritaire.** Le chemin BlurHash existe dans le code mais aucune colonne ne porte la valeur par photo : **toutes les images partagent le même aplat titane**. Ajouter une colonne par média, générée à l'upload. `sharp` est déjà en devDependencies.

Transformations Supabase réservées au plan Pro : cent images gratuites, puis 5 $ par millier, bornes 1–2500 px, 25 Mo, 50 Mpx.

## VI.6 Sorties déportées côté serveur

**Vidéo synchronisée.** `expo-video` ne garantit pas de décodage image-exact et n'offre aucune incrustation native fiable. Rendu serveur par ffmpeg.

**PDF et carte-souvenir de qualité d'impression.** `expo-print` est limité — pas d'URL d'asset local sur iOS — et l'export Skia hors écran est en sRGB. Génération serveur.

## VI.7 Mesure

Budget **16,66 ms par image**. Le marqueur de réglage posé au lot L3 n'a jamais été levé : aucun budget n'est prouvé.

Flashlight en intégration continue sur appareil réel. Profiler la **distribution** des temps d'image, pas la moyenne. Seuils indicatifs : tracé coloré < 8 ms en interaction ; nuage g-g < 10 ms après décimation, alerte au-delà de ~5 000 points dessinés ; canaux à zéro nouveau rendu React par image.

---

# VII. ARCHITECTURE PAR ESPACE

## VII.1 Pilote

**Spécification écran par écran : `OXV_Mirror_V3_Arbre_Pilote.md`.** Les 37 routes de `app/(app2)` y sont traitées individuellement — fonction, défauts, refonte. Six écrans naissent, deux disparaissent, le compte passe de 36 à 40. Ce qui suit n'en est que la synthèse.

**Quatre portes stables** — Miroir, Data, Club, Vous. Icône **et** libellé, jamais l'icône seule. Le contexte est porté par le bouton central, le contenu de l'accueil et la disparition de la barre en `S6_roulage`, jamais par la structure. **Le bouton central ouvre le Pass.**

**Les quatre zones ont une fonction énonçable** : Miroir porte ce que vous avez vécu · Data ce que le boîtier a mesuré · le Club votre appartenance et ce que vous partagez · VOUS ce qui est à vous et qui ne se mesure pas. Corollaire : **Data porte votre mesure, le Club porte la mesure partagée.**

**Le ressenti est la première demande après chaque run.** QCM simple, chiffres cachés pendant la question, toujours passable. Deux questions, trois à quatre cibles larges chacune.

**La saison est l'objet principal.** Pour un usage saisonnier — six journées par an — elle prime sur la séance. **Signature = la manière. Saison = la trace.** Dit explicitement.

**Filtre par paire réellement roulée**, jamais deux filtres indépendants. La Signature se filtre par véhicule et circuit, avec une moyenne générale disponible.

**Véhicule principal choisi par le pilote** — colonne à ajouter, `garageService` n'a ni `is_primary` ni `setPrimary`.

**Quatre orphelins raccrochés** : `data/saison` au hub Data ; `club/territoire`, `club/galerie`, `club/roulages` au hub Club.

## VII.2 Coach

**Spécification écran par écran : `OXV_Mirror_V3_Arbre_Coach.md`.** Les 36 routes de `app/(coach)` y sont traitées — le fil de séance, l'espace live à cinq surfaces, la carte de séance. De 36 à environ 28 écrans. Ce qui suit n'en est que la synthèse.

**L'objet central est le fil de séance** : il s'écrit seul pendant le run et *est* le débrief quand le pilote rentre. Il rend inutiles `debrief`, `triage`, `lecture` et `priorites` — 1 983 lignes.

**Le marqueur résolu** est l'innovation doctrinale : le coach voit et marque, l'application résout l'instant en mesure — tour, virage, vitesse d'entrée, décélération, distance avant la corde. **Il a vu, la machine dit où et quoi, personne n'interprète.**

**La carte de séance** est ce que le pilote reçoit : la voix de son coach en premier objet, une chose à emporter attribuée, un moment ancré sur le tracé, et le retour à la préparation suivante.

**Architecture temporelle**, consolidation de 37 vers ~22 écrans.

| Moment | Contenu |
|---|---|
| Avant | pilotes inscrits, dernier bilan, variable de séance, repères de circuit |
| Pendant | acceptation d'affiliation, direct, **lecture rapide**, **débrief entre runs**, annotation, contexte |
| Après | **lecture approfondie**, rapport, priorités, programme, messages |
| Transversal | activité, disponibilités, facturation, réglages |

**Trois écrans distincts.** *Lecture rapide* — seul, 60 s, entre deux runs ; ouvre sur le ressenti. *Lecture approfondie* — seul, le soir ; ancres et comparaisons. *Débrief entre runs* — avec le pilote, mode présentation, **aucun ordre de lecture par défaut** : fourche à deux cibles larges à l'ouverture, sans modale, l'écran s'engage une fois choisi.

**Le hub est une file d'attente, pas un menu.** « À débriefer » porte le liseré rouge ; « Vos pilotes » affiche la variable en cours de chacun.

**Consolidation.** Sept écrans lisent aujourd'hui la même séance — `studio`, `triage`, `comparer`, `lecture`, `assistant`, `priorites`, `rapport`. Ils deviennent deux écrans et des sections.

## VII.3 Admin terrain

Huit écrans : tour de contrôle, préparation, séances en cours, scan de présence, présences, parc de boîtiers, médias de séance, inspecteur circuit.

Trois défauts à corriger : l'espace n'a **plus d'entrée** depuis la bascule V2 (le chemin réel fait six gestes et passe par l'écran de création de route) et **aucun bouton de déconnexion** ; « en cours » fait une requête ponctuelle **sans abonnement temps réel** ; l'inspecteur circuit est codé en dur sur Haute Saintonge et la préparation liste tous les comptes plutôt que les inscrits du jour.

---

# VIII. NOUVEAUTÉS RETENUES

## VIII.1 Les dix innovations de conception

Établies entre le 26 et le 27 juillet 2026. Chacune est spécifiée dans la section indiquée.

| # | Innovation | Ce qu'elle règle | Où |
|---|---|---|---|
| **1** | **Le fil de séance** | **la mémoire du coach** — il voit à 14h11, débriefe à 14h35, trois pilotes sont passés. Le fil s'écrit seul et **est** le débrief | Arbre coach, II |
| **2** | **Le marqueur résolu** | l'observation humaine se perd entre l'instant et le récit. Le coach marque, la machine résout en mesure — tour, virage, vitesse d'entrée, décélération, distance avant la corde | Arbre coach, II.2 |
| **3** | **La carte de séance** | le débrief est oral et s'évapore. **La voix du coach**, trente secondes réelles — infalsifiable là où un texte est froid | Arbre coach, IV |
| **4** | **L'espace live à cinq surfaces** | lunettes, téléphone, tablette, grand écran, ceinture cardio. **La distance de lecture commande tout** | Arbre coach, III |
| **5** | **L'écurie** | l'appartenance sans le classement — **l'écurie est un sujet unique**, pas une somme de membres comparés | IV.19 |
| **6** | **La mémoire du circuit** | **un actif qui grandit** et qu'aucun concurrent ne peut copier sans les données. Elle dit où le circuit se joue — un fait sur la piste, jamais sur les pilotes | IV.20 |
| **7** | **Le carnet d'entretien** | **la seule fonctionnalité où la donnée vaut hors de la piste.** 312 freinages au-delà de 1,2 G disent plus que 1 240 km | IV.22 |
| **8** | **Les surfaces iOS** | six ouvertures par an — la présence **hors** de l'application compte autant que dedans | IV.21 |
| **9** | **La restitution par niveaux** | un pilote n'est pas un ingénieur. **Expliquer une mesure n'est pas prescrire un geste** | Banque, III bis |
| **10** | **Le curve boxplot** | la même trajectoire répétée des milliers de fois. Une **médiane réellement roulée**, jamais une moyenne synthétique | Banque, III ter |

### Ce qui les relie

**Trois d'entre elles n'existent nulle part dans le secteur.** Le fil de séance — MoTeC analyse après coup, Apex parle au pilote, Garmin coache à sa place ; **aucun n'outille le coach pendant qu'il regarde**. Le marqueur résolu, qui joint l'œil humain et la mesure sur le même axe, le temps. Et le carnet d'entretien, qui donne à la télémétrie une valeur au-delà du circuit.

**Trois sont des actifs**, pas des fonctionnalités : la mémoire du circuit grandit avec les saisons · l'écurie retient les membres · le carnet d'entretien retient les partenaires — un préparateur qui tient vingt carnets ne les quitte plus.

**Et toutes tiennent la doctrine.** Aucune n'affiche de classement, de delta coloré, de valeur inventée. La seule prescription du produit est **la voix du coach, attribuée**, sous une phrase qui l'énonce : « ses mots, pas une consigne de l'application ».

## VIII.2 Les six nouveautés de contenu

1. **La méthode publiée** — comment le QDI est calculé, formule par formule, seuils compris, ce que chaque branche ne mesure pas, sa sensibilité au véhicule. Personne dans le secteur ne le fait ; l'opacité des pondérations est le reproche principal adressé aux scores composites concurrents.
2. **La variable de séance** — une chose à la fois, nommée avant, seule mise en avant après.
3. **Le ressenti suivi sur la saison** — « sur quatorze runs, vous avez nommé le freinage neuf fois ». La seule mesure du produit qui vienne du pilote lui-même.
4. **Pourquoi ce chiffre est absent** — expliquer le « — » plutôt que se taire.
5. **Le carnet de saison** — livret de fin de saison, adossé à `heritageBookExportService`, généré côté serveur.
6. **La comparaison à un an d'écart** — même virage, même circuit, même véhicule, douze mois plus tard.

---

# IX. PHASES ET LOTS

**L'ordre de construction par dépendances réelles est dans `OXV_Mirror_V3_Plan_Montage.md`** — huit jalons, le graphe de dépendances, les blocages par origine, et les critères d'acceptation. La numérotation ci-dessous est historique : elle reflète l'ordre des sessions d'arbitrage, **pas l'ordre de montage**.

## PHASE T — Technique préalable

| # | Lot | Bloque | État |
|---|---|---|---|
| ~~T-0~~ | ~~Reconnaissance~~ | — | **fait** — `docs/T0_reconnaissance.md` et `docs/VERIFICATIONS_V3.md`, 26/07 |
| **T0** | **Migration SDK 51 → 55**, palier par palier, nouvelle architecture, Reanimated v4, MMKV v3 | **tout** | à faire |
| **T1** | Socle de rendu — d3 sans rendu, projection, décimation, générateur de ruban, rampe Oklab | tracé, g-g, canaux | à faire |

### T1 — le détail

**Cinq modules purs et testés. Aucun écran touché.**

| Module | Fichier | Contenu |
|---|---|---|
| **Projection** | `src/render/projection.ts` | équirectangulaire locale — `x = (lon−lon₀)·cos(lat₀)·R`, `y = (lat−lat₀)·R`, `R = 6 371 000`. Origine : `circuits.centerline_latlon`. Testée sur les 73 points de Haute Saintonge |
| **Décimation** | `src/render/decimate.ts` | conserver si distance > **1,5 m** *ou* variation de cap > **2°**. 30 000 trames → **1 000 à 1 500 points par tour** |
| **Rampe** | `src/render/ramp.ts` | quatre arrêts, **interpolation Oklab** et non sRGB. Mesurer le poids de `culori` avant de l'importer |
| **Ruban** | `src/render/ribbon.ts` | **la pièce centrale** — voir ci-dessous |
| **Nuage g-g** | `src/render/gg.ts` | décimation obligatoire, cible 1 000–1 500 points. **Ne pas supposer qu'`Atlas` est plus rapide que `Picture`** — mesurer |

**Le générateur de ruban.** Skia ne possède **aucun dégradé natif suivant un chemin arbitraire** ; découper le tracé en sous-chemins est à proscrire. Technique : `Vertices` en `triangleStrip`, une couleur par sommet. Tangente par différence centrée, normale perpendiculaire, deux sommets par point décalés d'une demi-largeur (7 à 9 points d'écran), couleur par la rampe sur la vitesse normalisée, assemblage A₀ B₀ A₁ B₁… avec réémission de A₀ B₀ pour fermer.

**Le piège** : quand `colors` est fourni, react-native-skia mélange avec la peinture selon un mode par défaut `dstOver`. **Le poser explicitement**, aucun shader concurrent — sinon le ruban sort gris.

Coût : 1 600 à 3 000 sommets, **une seule primitive de dessin par tour**.

**Contraintes de rendu.** Un `<Canvas>` a un coût — minimiser leur nombre, combiner les graphiques. Les shaders SkSL ne tiennent pas compte de la densité de pixels : supersampling requis, donc **le grain se fait en texture statique, jamais en shader animé continu**. `SkMesh` n'est pas exposé.

**Attention licence.** Les 73 points de `hauteSaintonge.ts` viennent d'OpenStreetMap, way 54412766, **sous ODbL**. Toute remontée en base transporte l'obligation d'attribution.

**La banque de calculs est dans `OXV_Mirror_V3_Banque_Telemetrie.md`** — formules, unités, plages, pièges numériques, fiabilité réelle à 25 Hz. T1 en implémente le socle : projection, décimation, rampe, ruban, nuage g-g. Le reste — delta par distance, segmentation par courbure, vitesse minimale par virage — vient au lot suivant.

**Deux règles que T1 fixe pour toujours.** *Base distance* : tout appariement de tours passe par un ré-échantillonnage sur une grille curviligne commune. *Filtrage avant dérivation* : Savitzky-Golay sur 5 à 9 points à 25 Hz, fusion Kalman GNSS-IMU, calibration zéro-offset **et alignement d'orientation** — le boîtier n'est jamais aligné au repère véhicule.

**Test de validation du delta** : rejouer une séance et vérifier que le delta cumulé **se referme à zéro** sur un tour comparé à lui-même.

**Livrable** `docs/T1_RENDU.md` : mesures réelles par module sur appareil · poids ajouté au binaire · **ce qui n'a pas tenu le budget**. Écran de démonstration jetable dans `dev-galerie`, déjà coupé hors développement.

**Réserve.** 53 trames en production, un tour de 0,022 s. **Aucune donnée réelle n'existe** pour valider ces modules : les mesures porteront sur des données synthétiques, à dire explicitement.
| **T2** | ThumbHash — colonne, génération à l'upload, câblage | rien | à faire |
| **T3** | Mesure — Flashlight en intégration continue, trace de référence par écran | les ajouts de mouvement | à faire |

### T0 — le détail

**Préalable bloquant.** `git log origin/main..HEAD` doit retourner **zéro**. Cent trente commits ne sont pas poussés ; une migration de quatre majeures sur un dépôt local non sauvegardé est irrécupérable. Branche `migration/sdk-55`.

**Ordre imposé — une majeure à la fois, compilation et lancement sur appareil réel entre chaque.** Un simulateur ne révèle ni la performance, ni le Bluetooth, ni HealthKit.

| Étape | Objet | Point de vigilance |
|---|---|---|
| **1** | **Nettoyage** — retrait de `three` (29 Mo), `@react-three/fiber` (996 Ko), `expo-gl` | importés par le seul `src/circuit/CircuitTrace.tsx`, monté uniquement depuis l'arbre gelé. **Vérifier avant de retirer** ; si un import apparaît dans un arbre actif, s'arrêter |
| **2** | **51 → 52 → 53 → 54 → 55** | `npx expo install expo@^<v> --fix` puis `npx expo-doctor`. Lire le guide de **chaque** version, ne sauter aucune |
| **3** | **Nouvelle architecture** — `newArchEnabled: true` | point de rupture : les bibliothèques natives incompatibles échouent ici. `prebuild --clean` obligatoire |
| **4** | **Reanimated 3 → 4** | **le piège silencieux** : `react-native-reanimated/plugin` devient `react-native-worklets/plugin`. L'ancien nom **ne produit aucune erreur** — les animations cessent de fonctionner sans message. 61 fichiers. Vérifier visuellement une animation par famille d'usage |
| **5** | **MMKV 2 → 3** | obligatoire pour la nouvelle architecture. 1 import direct (`src/lib/mmkv.ts:13`), 15 consommateurs. La file de capture repose sur `expo-file-system`, **pas** sur MMKV |
| **6** | **Skia 1.2 → 2.8** | 23 fichiers. `Vertices`, `Atlas`, `RuntimeEffect`, `Picture`, `useFont` : **zéro occurrence** — rien à migrer, tout à écrire en T1 |
| **7** | **`expo-av` → `expo-audio`** | **trivial** : 2 fichiers, `Audio` seulement, aucun usage vidéo |
| **8** | **`expo-updates`** | absent du projet, à ajouter et configurer |

**Hors périmètre de T0.** `react-native-svg` — **79 fichiers importateurs**, la plus grande surface du dépôt : lot séparé. Aucun écran n'est modifié : T0 est une migration, pas une refonte. `app/(app)` n'est pas touché au-delà de l'étape 1.

**Livrable** `docs/T0_MIGRATION.md` : ce qui a été migré avec les commits · **ce qui a cassé et comment cela a été réparé** — la section la plus utile · les bibliothèques incompatibles · le résultat des tests d'animation · le poids du binaire avant et après · ce qui reste en suspens.

## PHASE 0 — Préalables sans code

~~0.A or de performance et violet du record~~ — **posés : `#D9AE00`, `#8B5CF6`, Intensité `#F472B6`**
0.B mesure 60 images/s · 0.C chasse tabulaire après intégration de la police au build · 0.D relation marge/QDI par lecture de code · 0.E sort des 43 journées et des sauvegardes · 0.F annotation de dépréciation d'`events`
**0.G** `corners-v1` sur **Valence et Charente** · rayon d'arrivée de Valence porté de 10 à 15–20 m
**0.H** suppression de La Charade — la séance de télémétrie d'abord, la ligne de circuit ensuite

## PHASE 1 — Socle de design
1 jetons typographiques · 2 jetons de couleur et fond `#0A0A0A` · 3 anti-décalage et Dynamic Type · 4 doctrine de couleur *(0.A)* · 5 navigation · 6 mouvement, table et accessibilité · 7 mouvement, trois ajouts *(0.B, T3)*

## PHASE 2 — Rôles et sécurité
8 `role` fait autorité et miroir *(avec l'exemption nommée du compte fondateur)* · 9 coach rétrogradé, rétrogradation par validation, suspension sans effet · **9bis séparation des comptes admin et pilote — `SpaceSwitcher` réservé au cumul coach-pilote et au compte fondateur**

## PHASE 3 — Corrections bloquantes
10 RGPD du partage · 11 transition gardée et pointage unifié · 12 chaînon `registration_id` · 13 les six lectures Insight

## PHASE 4 — Espace pilote
14 QDI, vocabulaire, radar et barres ~~Intensité~~ (retirée le 13/08, voir motif §) · 15 le ressenti après run · 16 intention et objectif · 17 la saison objet principal · 18 numéro de voiture et véhicule principal · 19 portage des sept orphelins V1 · 20 recâblage des douze liens · 21 suppression de l'arbre V1

## PHASE 4bis — Le flux REC
**21a** contraste renforcé sur les huit écrans · **21b** avertissement de verrouillage avant le premier run · **21c** appairage — état réel de reconnexion, diagnostic vérifié/supposé, localisation signalée dès l'échec, second cycle, issue « rouler sans mesure » · **21d** éligibilité — ajout de la seule colonne manquante, `declared_at` (`validated_by` et `validated_at` existent) · **21e** roulage — seuil d'interruption sur tour de référence, marquage du trou, restitution au retour · **21f** entre-runs — QCM en tête, cadran de pause en chiffre roi · **21g** clôture — proposition sur `end_time` ou inactivité, journée résumée, variable de la prochaine fois avec préséance pilote

## PHASE 4ter — Notifications
**21h** quatre canaux déclarés dans `app.json` · **21i** écran de réglages sur `users.notification_preferences` (JSONB **existant**) · **21j** fuseau du pilote stocké, report nocturne 22 h – 8 h côté serveur · **21k** revue de registre — aucun message de relance formulé en reproche

## PHASE 4quater — Club, VOUS, onboarding
**21l** bouton central ouvre le Pass · **21m** Pass — écran de possession, inscription, offre, créneau, décharge · **21n** carnet remonté dans Data, section visuellement séparée · **21o** garage — fiche dans VOUS, sélecteur dans Data · **21p** onboarding à cinq étapes, doctrine et méthode fusionnées · **21q** prise en main avec explication de l'appairage · **21r** pacte mutuel à trois engagements

## PHASE 4quinquies — Amis et comparaison
**21s** suppression de `duels` · **21t** table `comparaisons` — deux participants, consentement mutuel requis en plus de l'amitié · **21u** écran de comparaison — deux colonnes, aucun vainqueur, aucun delta coloré

## PHASE 5 — Espace coach
22 acceptation d'affiliation · 23 architecture temporelle et hub · 24 lecture rapide · 25 débrief entre runs · 26 lecture approfondie · 27 consolidation du reste
**27a-bis canal biométrie par coach — `live:bio:<coachId>:<sessionId>`, qui lève la règle « tout ou rien » de `liveRelayRunner.ts:326`**
**27bis correctif du déclencheur qui ferme `coach_availability` — préalable à tout test de l'économie coach**
**27ter flux économique complet sans encaissement — disponibilités, réservation, facture en brouillon**
**27quater charte coach — interdiction de facturer hors plateforme, sanction par exclusion**
**27quinquies suppression de `payment_link` et de `coach_testimonials` · profil coach avec vérification OXV et faits d'activité dérivés de `coaching_bookings` · `coach_queue` câblée à la file « À débriefer »**

## PHASE 5bis — Statut fondateur
**27a** `users.founder_since` et `founder_number` · **27b** `user_id` sur `founding_members` · **27c** séquence dédiée d'attribution du numéro · **27d** propagation au rattachement du compte par correspondance d'adresse · **27e** affichage du statut, numéro privé

## PHASE 6 — Admin terrain et circuits
**28a** briefing collectif — un geste bascule les présents · **28b** incident à état suivi — reçu, traité, clos, auteur, date · **28c** écriture admin dans `registrations` avec table d'audit · **28d** Tap to Pay on iPhone via Stripe Terminal *(bloqué SIRET)*
**28** écran unique de journée — surveillance, gestes, plateau · **28bis** temps réel sur tout l'espace · **28ter** entrée dans l'espace via `SpaceSwitcher` remonté, et bouton de déconnexion · **28quater** parc de boîtiers, écran séparé · 29 compte de service du téléviseur · **30 l'inspecteur circuit devient l'éditeur de géométrie, décodé de Haute Saintonge** · **31 suppression de `circuitTopology.ts`, affichage par numéro seul, contrainte `1..7` levée — précédé de la lecture de `src/circuit/hauteSaintonge.ts` : s'il ne porte que des noms il part avec, s'il porte de la géométrie elle remonte en base avant toute suppression, sinon Haute Saintonge perd son tracé**

## PHASE 5ter — Écuries
**27f** écran d'écurie dans le Club — saison collective, tracés superposés, journées communes, garage, carnet de bord, mur · **27g** logo téléversé par le capitaine · **27h** exclusion par le capitaine, invitation par tous · **27i** annuaire trié par taille, **sans numéro de rang** · **27j** parrainage retiré de `rec/preparation`

## PHASE 6bis — Partenaires et Territoire
**32** vocabulaire figé — enums `type`, `contact_policy`, `channel` · **33** `session_id` sur `partner_offers` et `partner_leads`, contrainte d'exclusivité · **34** catalogue Club et fiche d'offre à cinq pieds · **35** points de découverte — garage, Territoire, journée · **36** canal de mise en relation médié · **36bis** suppression d'`is_premium` sur les quatre tables Territoire · **36ter** écrans Territoire — lieux, sans ordre achetable · **36quater** `social_pings` réservée aux partenaires, règles éditoriales au contrat

## PHASE 4octies — Formes de représentation importées
**21J** functional boxplot en base distance — médiane, bande 50 %, enveloppe, tours atypiques · **21K** curve boxplot pour la dispersion des trajectoires, **profondeur pré-calculée côté serveur** (≈ 1 min pour 50 trajectoires, jamais en temps réel) · **21L** strip map — développement linéaire du tour, tracé en règle graduée · **21M** petits multiples de sparklines, bande « plage observée » · **21N** bandes de saison sans axe, **rampe Oklab séquentielle et non divergente** · **21O** bascule automatique superposition → bande au-delà de 20 à 30 tours

## PHASE 4septies — Restitution télémétrique par niveaux
**21A** cinq niveaux — tour, delta, forme, enveloppe, virage · **21B** ouverture par la donnée, niveau fermé visible et éteint avec son compteur · **21C** lien « comment ça se lit » vers la méthode publiée sur chaque niveau · **21D** virages nommés sur la courbe de delta · **21E** tour idéal sur 50 à 200 micro-secteurs, annoncé théorique · **21F** conditions affichées en faits, jamais corrélées · **21G** lecture par virage — vitesse mini et sa position, dispersion du freinage, boîte à moustaches · **21H** canaux à curseur partagé, trois maximum · **21I** vidéo synchronisée, rendu serveur *(hors périmètre mobile)*

## PHASE 4sexies — Banque de calculs télémétriques
**21w** socle robuste — delta cumulé par distance, trace de vitesse, vitesse mini par virage, points et décélérations de freinage, segmentation par courbure, diagramme g-g · **21x** étiquetage `[M]` / `[D]` / `[I]` sur toute grandeur affichée · **21y** ceinture cardio BLE `0x180D` / `0x2A37`, colonne `source` sur les échantillons · **21z** énergie de freinage `ΔE = ½m(v²−v²)`, masse saisie — alimente le carnet d'entretien

## PHASE 7quater — Carnet d'entretien
**39a** modèle d'intervention — date, partenaire, éléments touchés, consentement par intervention · **39b** cinq groupes suivis · **39c** compteurs dérivés de la télémétrie — km, freinages, G, journées, par élément · **39d** les quatre questions au pilote, jamais en amont · **39e** photo de facture · **39f** partenaire technique — quatrième nature, écriture dans le carnet · **39g** taux réel au niveau 2, avec « environ » · **39h** dates de péremption lues par `eligibility_items` · **39i** écrans — carnet et détail d'élément

## PHASE 7ter — Surfaces iOS
**38a** Live Activity par run — démarrée à l'armement, close à la fin · **38b** Dynamic Island compacte et étendue · **38c** écran de verrouillage avec tracé en filigrane · **38d** widgets hors-saison — prochaine journée, référence

## PHASE 7bis — Mémoire du circuit
**37a** fonction d'agrégation `security definer`, agrégats seuls · **37b** critère de stabilité de la dispersion, calibré sur les premières données · **37c** carte de dispersion sur le tracé · **37d** couloir par virage et situation du pilote · **37e** convergence sur la saison · **37f** ligne médiane, jamais superposée · **37g** le Territoire devient l'objet circuit

## PHASE 7 — Nouveautés
30 la méthode publiée · 31 la variable de séance · 32 pourquoi ce chiffre est absent · 33 le ressenti suivi sur la saison · 34 le carnet de saison *(serveur)* · 35 la comparaison à un an

## PHASE 8 — iOS et serveur
36 compilation unique HealthKit et Live Activity · 37 Apple Watch · 38 rendu vidéo serveur · 39 génération documentaire serveur · **40 encaissement coach — Stripe Connect Express, vérification d'identité par coach, reversement, litiges** *(bloqué par le SIRET)*

## Ordre

```
Annexe A → T-0 → T0 → T1 · T2 · T3 → PHASE 0 → 1 → 2 → 3
                                                       ↓
                     PHASE 8 ← 7 ← 6 ← 5 ← PHASE 4 ←───┘
```

T-0 et T2 sont indépendants et livrables immédiatement. T0 commande tout le reste.

---

# ANNEXE A — Correctifs d'une ligne, en premier

**A.1** Le scan doctrinal échoue sur **75 faux positifs** — `tap` et `swipe` employés comme identifiants de code, non comme textes affichés. Tant qu'il est rouge pour une raison de nommage, il n'attrape plus rien de réel — et c'est l'outil qui aurait dû détecter les chiffres de démonstration présentés comme des mesures.

**A.2** `app/(app)/profil.tsx` en CRLF, 751 remarques ESLint locales. Artefact de poste, l'objet Git est propre.

**A.3** L'en-tête de `app/(app2)/_layout.tsx`, lignes 3 à 9, décrit le groupe comme orphelin et documente une garde retirée.

---

# ANNEXE B — Dépendances hors application

**Du site** — voir IV.4.

**Du terrain.** Une journée réelle avec boîtier en mouvement conditionne : le calage de `flowService`, les six lectures, la validation de la détection de tours par porte, le test biométrie à deux appareils, la vidéo.

**De l'avocat.** CGV pour `app_payments`, rétention des signalements d'incident, relecture de la décharge pour lever `pilot_waivers`, **mandat d'encaissement coach**, **charte coach**, **pacte mutuel de l'onboarding**, **comparaison entre pilotes de la même journée au regard de R331-20**.

**Administratif.** SIRET pour Stripe et la facturation coach, DSN Sentry, secrets d'intégration continue des tests RLS, plan Supabase Pro pour les transformations d'images.

---

# ANNEXE C — Angles morts assumés

**Aucun test d'écran.** `jest.config.js` n'accepte que les `.ts` ; les 222 fichiers `.tsx` ne sont jamais montés. Aucun écran, aucun composant, aucun magasin d'état. La V3 multiplie les écrans sans changer cela.

**Cent trente commits non poussés.** L'intégration continue n'a jamais vu la refonte.

**Quatre-vingt-cinq tests RLS jamais exécutés**, faute de secrets. C'est la surface de sécurité de la base.

**Le canal biométrie par coach** n'est pas écrit, et devient nécessaire dès que deux coachs écoutent la même séance.

**Cinq capacités V1 non traitées** : inscription à un événement ouvert, certification et suppression de route, catalogue par catégorie, virage désigné, vitrine partenaire.

**Batterie et échauffement** sur vingt minutes de rendu soutenu à 60 images par seconde : non évalués.

**Coûts Supabase à l'échelle d'une saison** — stockage, egress, transformations : estimés partiellement.

**Rien n'a jamais tourné.** 53 trames, un tour de 0,022 seconde, zéro boîtier en flotte, zéro donnée cardiaque, zéro annotation de coach, zéro compte coach, zéro ligne dans `app_pairing_codes`. Toute affirmation de ce dossier sur le comportement réel est une lecture de code, jamais une observation.
