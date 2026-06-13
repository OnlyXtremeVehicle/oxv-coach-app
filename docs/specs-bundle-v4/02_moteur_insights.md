# Moteur d'insights OXV Mirror — du signal brut à l'intelligence factuelle

Reference doctrine : `01_doctrine_et_composants.md`. Ce fichier definit **ce que l'app
deduit** des donnees, pas seulement ce qu'elle affiche. C'est l'etage au-dessus du chrono brut.

---

## 0. Le principe qui rend tout possible : fait analytique ≠ prescription

Un insight peut etre **profond, causal, impressionnant** sans jamais diriger. La frontiere
n'est pas la complexite du calcul — c'est le **temps du verbe**.

| Meme donnee | Fait analytique (OUI, cote app) | Prescription (NON, cote app) |
|---|---|---|
| Relachement frein S2 | « Vous relachez les freins 8 m avant la corde en S2 ; c'est la que se loge l'ecart de 0,3 s avec votre meilleur tour. » | « Freinez 8 m plus tard en S2. » |
| Variabilite de trajectoire | « Votre point de corde au virage 4 varie de 1,8 m entre vos tours. » | « Visez la corde plus regulierement. » |
| Gestion des gaz | « Vous remettez les gaz progressivement en S1, brutalement en S3. » | « Remettez les gaz plus tot en S3. » |

**Regle ferme :** l'app **decrit ce qui EST** (constat, mesure, correlation observee). Elle ne
dit **jamais ce qu'il FAUT faire**. Le constat causal (« X se produit parce que Y est mesure »)
est autorise tant qu'il reste un **constat**, pas une consigne.

**Asymetrie pilote / coach :** dans l'espace coach (`C0`), le coach **a le droit de prescrire**
— c'est son metier, sa responsabilite. L'app peut donc lui presenter les memes insights de
maniere plus **actionnable** (ex. surligner l'ecart le plus couteux), car c'est LUI qui
transformera ca en consigne, attribuee a lui. Cote pilote : constat strict.

---

## 1. Ce que le RaceBox Mini donne physiquement (le socle)

Source : RaceBox BLE Protocol, revision 8. Message data 0xFF 0x01, payload 80 octets, jusqu'a
25 fois/seconde (un echantillon toutes les 40 ms). Champs exploitables (avec leur facteur) :

- **GNSS** : longitude / latitude (facteur 10^7, precision ~10 cm via Horizontal Accuracy en mm),
  **vitesse** (mm/s, ground speed par defaut), **cap / heading** (degres ×10^5, 0 = Nord),
  altitude WGS et MSL (mm), nombre de satellites, PDOP. Multi-constellation (GPS/GLONASS/Galileo/BeiDou).
- **Accelerometre 3 axes** (milli-g, /1000 pour g) : **X = avant/arriere** (freinage/accel),
  **Y = droite/gauche** (appui lateral), **Z = haut/bas** (compressions, kerbs, charge verticale).
- **Gyroscope 3 axes** (centi-deg/s, /100 pour deg/s) : **X = roll (roulis)**, **Y = pitch
  (tangage)**, **Z = yaw (lacet = rotation de la voiture a plat)**.

Point capital pour la profondeur : l'IMU tourne **en interne a 1 kHz, moyenne a 25 Hz** — le
signal est donc propre, ce qui rend le **jerk** (derivee de l'acceleration) calculable sans bruit
parasite. Chaque echantillon porte un timestamp UTC + iTOW (intervalle exact entre paquets).

Tout le reste (trajectoire, points de corde, fluidite, diagramme G-G, transfert de charge,
survirage/sous-virage…) se **derive** de ces canaux par calcul cote Supabase. Le coach peut
**enrichir** avec ce que le RaceBox ne capte pas (reperes visuels, contexte mecanique, ressenti).

### Ce que les 6 axes IMU debloquent (au-dela du GPS seul)

La plupart des apps grand public n'exploitent que vitesse + trajectoire GPS. Avoir les 6 axes
inertiels documentes precisement ouvre une famille d'insights que personne ne sort :

- **Transfert de charge** (pitch + G long) : la vitesse de plongee sous freinage et de cabrage
  a la reaccel se mesure. Pas juste « il freine fort » mais « la mise en charge de l'avant met
  X ms a se stabiliser ».
- **Prise de roulis** (roll + G lat) : comment la voiture s'appuie en entree de courbe, et a
  quelle vitesse le roulis s'etablit.
- **Survirage / sous-virage factuel** (yaw vs cap GPS) : le gyroscope Z donne la rotation reelle
  de la voiture ; le cap GPS donne la direction du deplacement. Quand la voiture pivote plus vite
  que la trajectoire ne l'impose = signature de survirage, mesurable, sans jugement.
- **Coherence du flow** (jerk, derivee du G a partir du signal 25 Hz propre) : la regularite des
  transitions, base de l'insight 4.3.

---

## 2. Catalogue d'insights — par niveau de profondeur

Chaque insight liste : **ce qu'on deduit**, **la donnee source**, **le phrasing factuel**, et
la **prescription interdite** (le miroir a ne pas franchir cote app).

### NIVEAU 1 — Lecture directe (table stakes, ce que tout le monde fait)
Vitesse, temps au tour, secteurs, vitesse maxi/mini. Necessaire mais pas differenciant. On le
fait proprement (cf. bloc 30) et on passe vite au-dessus.

### NIVEAU 2 — Décomposition (la donnee derivee)

**2.1 — Anatomie d'un virage**
- Deduit : phase de freinage / point de corde (vitesse mini) / phase de reaccel, virage par
  virage.
- Source : vitesse + G long + G lat + cap. Le point de corde = minimum local de vitesse
  correle au pic de G lateral.
- Factuel : « Virage 3 : freinage sur 95 m, vitesse mini 78 km/h a la corde, reaccel sur 140 m. »
- Interdit : « Freinez plus tard / portez plus de vitesse a la corde. »

**2.2 — Diagramme G-G (l'empreinte d'adherence)**
- Deduit : l'enveloppe d'acceleration utilisee (combien le pilote exploite le grip
  disponible, en combine freinage+virage+accel).
- Source : nuage de points (G long, G lat) sur tout le tour.
- Factuel : « Votre G-G se concentre sur les axes purs (freiner OU tourner). Les phases de
  freinage-en-courbe combinees sont rares dans vos donnees. »
- Interdit : « Travaillez le trail-braking. » (constat OUI, consigne NON)

**2.3 — Profil de gaz et de frein**
- Deduit : progressivite vs brutalite des transitions (release de frein, mise de gaz).
- Source : derivee du G longitudinal dans le temps (a-coups = pics de jerk).
- Factuel : « Vos remises de gaz en S1 sont progressives ; en S3, plus abruptes (3 a-coups
  detectes sur 18 tours). »
- Interdit : « Soyez plus doux sur les gaz en S3. »

### NIVEAU 3 — Consistance & dispersion (soi contre soi, fin)

**3.1 — Dispersion de trajectoire**
- Deduit : a quel point le pilote repete la meme ligne, virage par virage.
- Source : superposition des traces GPS de tous les tours ; ecart-type lateral en chaque point.
- Factuel : « Au virage 4, votre point de corde varie de 1,8 m d'un tour a l'autre — c'est
  votre virage le moins reproductible. Le virage 1 ne varie que de 0,3 m. »
- Interdit : « Soyez plus regulier au virage 4. »
- **Impressionnant** : personne dans le grand public ne montre la *variabilite spatiale* par
  virage. C'est un insight pur soi-contre-soi.

**3.2 — Ou se loge le temps perdu (theoretical best)**
- Deduit : le « tour ideal compose » = meilleur secteur de chaque tour assemble, et l'ecart
  au meilleur tour reel.
- Source : decoupage micro-sectoriel + comparaison intra-session.
- Factuel : « En assemblant vos meilleurs secteurs, votre tour ideal serait 1:41.2 — soit
  1,6 s sous votre meilleur tour reel. 80 % de cet ecart se loge en S2. »
- Interdit : « Concentrez-vous sur S2. » (le fait « 80 % en S2 » suffit ; le pilote conclut)

**3.3 — Derive sur la session (fatigue / montee en gomme / temperature)**
- Deduit : comment les temps et la trajectoire evoluent du debut a la fin de session.
- Source : serie temporelle des tours + meteo (Open-Meteo) + heure.
- Factuel : « Vos tours s'ameliorent jusqu'au tour 9 puis se stabilisent ; la dispersion de
  trajectoire augmente apres le tour 14. »
- Interdit : « Arretez-vous au tour 14 / reposez-vous. »

### NIVEAU 4 — Correlations causales (l'intelligence qui impressionne)

**4.1 — Le lien cause→effet mesure**
- Deduit : relier un comportement a un resultat chiffre, factuellement.
- Source : croisement multi-canaux (release de frein × vitesse de corde × temps de secteur).
- Factuel : « Les tours ou vous relachez les freins plus tot au virage 6 sont aussi vos tours
  les plus lents en S2 (correlation observee sur 18 tours). »
- Interdit : « Relachez les freins plus tard au virage 6. »
- **C'est l'etage roi** : un constat causal, mesure, que le pilote ne pouvait pas voir seul —
  mais formule comme une observation, pas une instruction.

**4.2 — Signature d'adherence vs conditions**
- Deduit : comment l'enveloppe G-G se reduit quand la piste change (pluie, froid).
- Source : G-G × weather_snapshots × heure.
- Factuel : « Sous 15 °C, votre G lateral maxi observe descend de 1,15 a 0,98 g. »
- Interdit : toute consigne d'adaptation.

**4.3 — Coherence du rythme (le « flow »)**
- Deduit : enchainement fluide vs hache, mesure par la regularite des transitions sur un tour.
- Source : jerk (derivee de l'acceleration) lisse sur le tour.
- Factuel : « Vos tours les plus rapides sont aussi vos plus fluides (moins d'a-coups), pas
  vos plus agressifs. »
- Interdit : « Soyez plus fluide. »

**4.4 — Equilibre de la voiture : signature survirage / sous-virage (yaw vs trajectoire)**
- Deduit : a chaque virage, la voiture pivote-t-elle plus ou moins vite que ce que sa
  trajectoire impose ? C'est la signature objective de l'equilibre.
- Source : **gyroscope Z (yaw reel, deg/s)** croise avec le **taux de rotation geometrique**
  derive du cap GPS (variation de heading / temps). Ecart positif soutenu = la voiture tourne
  plus que la trajectoire = signature de survirage ; ecart negatif = signature de sous-virage.
- Factuel : « Au virage 7, votre voiture pivote 18 % plus vite que la trajectoire ne l'impose
  en milieu de courbe — signature de survirage, recurrente sur 12 de vos 18 tours. »
- Interdit : « Corrigez le survirage / mettez moins de gaz en sortie. »
- **Impressionnant** : aucune app grand public ne separe rotation reelle (gyro) et rotation
  geometrique (GPS). C'est une lecture de chassis, factuelle, que seul le croisement des deux
  capteurs permet.

**4.5 — Transfert de charge : vitesse de mise en appui (pitch / roll + G)**
- Deduit : combien de temps la masse met a se transferer — plongee avant au freinage, prise de
  roulis en entree de courbe, cabrage a la reaccel.
- Source : **gyroscope Y (pitch)** correle au G longitudinal pour le tangage ; **gyroscope X
  (roll)** correle au G lateral pour le roulis. La duree entre le debut de l'action et la
  stabilisation = temps de transfert.
- Factuel : « En entree du virage 3, votre prise de roulis se stabilise en 0,4 s ; au virage 9,
  en 0,7 s — c'est votre entree la plus progressive. »
- Interdit : toute consigne sur la maniere d'attaquer l'appui.
- **Impressionnant** : on passe de « combien de G » a « a quelle vitesse la voiture se met en
  charge » — une dimension temporelle du pilotage invisible sans IMU 6 axes.

### NIVEAU 5 — Enrichi par le coach (la valeur conjointe app + expertise)

Le coach ajoute ce que le capteur ne capte pas. L'app **fusionne** sa contribution aux donnees
factuelles, **attribuee au coach** (cf. `C0.4`).

**5.1 — Reperes contextuels**
- Le coach annote un point du trace (« ici, reference de freinage = panneau 100 m »). L'app
  superpose ce repere a la donnee GPS du pilote.
- Resultat : « Votre freinage reel au virage 3 commence 12 m avant le repere note par votre
  coach. » (fait ; le **conseil** eventuel vient du coach, signe).

**5.2 — Donnees mecaniques externes**
- Le coach saisit pression pneus, reglages, ressenti chassis. L'app les met en regard de la
  signature d'adherence.
- Resultat : « Avec la pression avant a 1,9 bar (notee par le coach), votre G lateral maxi en
  S2 etait de 1,12 g ; a 2,1 bar, 1,05 g. » (correlation factuelle observee).

**5.3 — Le debrief augmente**
- Le coach redige (C0.5) en s'appuyant sur les insights N1–N4, et peut **prescrire** (son
  role). L'app porte ce texte, signe du coach, jamais fondu dans une sortie OXV.

---

## 3. Comment l'app calcule (architecture)

- Tous les insights N2–N4 sont calcules **cote Supabase** (edge functions / SQL), pas dans
  l'app mobile. L'app **affiche**.
- La chaine `generate-debrief-ai` (conservee, usage factuel interne) sert a **mettre en forme
  et formuler** l'insight en langage clair — toujours soumise au test de conformite : sortie
  en « voici / on observe / vos tours montrent », jamais « vous devriez ».
- Chaque insight expose **sa donnee source** (tracabilite) : le pilote/coach peut toujours
  remonter au fait brut. Pas de boite noire qui « juge ».
- **Degradation** : un insight de niveau N n'apparait que si la donnee le permet (assez de
  tours, assez de canaux). Sinon il reste masque — jamais d'insight invente. Aujourd'hui
  (`telemetry_frames` vide), tout est en maquette : le marquer comme tel.

---

## 4. Pourquoi ca ecrase la concurrence (et reste dans la doctrine)

- RaceChrono & co donnent des **graphes bruts a interpreter seul**, ou (Garmin Catalyst) des
  **consignes** qui engagent leur responsabilite pedagogique.
- OXV Mirror donne l'**insight deduit** — le constat causal que le pilote ne voyait pas — sans
  jamais prescrire. C'est plus profond que RaceChrono ET plus prudent que Catalyst.
- L'asymetrie coach permet la prescription la ou elle est legitime (le coach agree), enrichie
  par des donnees que personne d'autre ne fusionne.
- Resultat : l'app est *intelligente* sans etre *directive*. C'est exactement la ligne que
  vous voulez tenir — profondeur maximale, prescription zero (cote OXV).

---

## 5. Addendum — formules de calcul exactes (pour Claude Code)

Toutes ces formules s'appliquent cote Supabase sur la table `telemetry_frames` (un enregistrement
= un echantillon 0xFF 0x01 decode, 25 Hz). Conversions a appliquer au parsing UBX :
`g = raw_milli_g / 1000`, `deg_s = raw_centideg_s / 100`, `heading_deg = raw / 1e5`,
`lat/lon = raw / 1e7`, `speed_ms = raw_mm_s / 1000`.

### Pre-traitement commun
- **Detection de tour** : franchissement de la ligne start/finish (geofence sur lat/lon du
  trace). Decoupage en tours, puis micro-secteurs (N segments egaux en distance curviligne).
- **Distance curviligne** : integration de la vitesse dans le temps (sum speed_ms × dt, dt
  derive de iTOW), ou cumul des distances haversine entre points GPS successifs.
- **Lissage** : moyenne glissante courte (5 echantillons ≈ 200 ms) sur les canaux IMU avant
  derivation, pour le jerk. Le signal est deja propre (1 kHz → 25 Hz interne) donc lissage leger.

### 3.1 — Dispersion de trajectoire par virage
- Aligner tous les tours sur la distance curviligne (rationnel : comparer le meme point
  geographique, pas le meme instant).
- En chaque point d'echantillonnage curviligne s, calculer l'**ecart lateral** de chaque tour a
  la trajectoire mediane (distance perpendiculaire a la ligne mediane, en metres).
- **Dispersion(s) = ecart-type des ecarts lateraux sur tous les tours**, exprime en metres.
- Au point de corde de chaque virage (minimum local de vitesse), retenir Dispersion(corde).
- Sortie factuelle : virage le plus disperse vs le plus reproductible. AUCUNE consigne.

### 3.2 — Tour ideal compose & localisation du temps perdu
- Pour chaque micro-secteur k, retenir `t_best[k] = min` sur tous les tours.
- **Tour ideal = somme(t_best[k])**. Ecart au meilleur tour reel = best_lap − ideal.
- **Repartition du temps perdu** : pour le meilleur tour reel, perte[k] = t_reel[k] − t_best[k] ;
  exprimer chaque secteur en % de la perte totale. Sortie : « X % du temps perdu en secteur Y ».
- Strictement descriptif (« le temps se loge ici »), jamais « travaillez ce secteur ».

### 3.3 — Derive sur la session
- Serie temporelle : temps au tour vs index de tour. Tendance (regression lineaire simple ou
  moyenne mobile) + detection du point d'inflexion (ou les temps cessent de progresser).
- Croiser avec dispersion de trajectoire par tour (3.1 applique tour a tour) pour montrer si la
  ligne devient plus variable en fin de session. Optionnel : meteo (weather_snapshots) et heure.

### 4.1 — Correlation cause→effet
- Choisir une variable comportementale (ex. point de release frein au virage V = distance avant
  corde ou le G long repasse au-dessus de −0,1 g) et une variable resultat (temps du secteur
  contenant V).
- Calculer le **coefficient de correlation** (Pearson) sur l'ensemble des tours. Ne presenter
  l'insight que si |r| significatif (ex. |r| > 0.5 et n >= 8 tours) — sinon masquer (degradation).
- Sortie : nuage de points + phrase « vos tours ou X … sont aussi … ». Constat, pas consigne.

### 4.4 — Survirage / sous-virage (yaw vs trajectoire)
- **Yaw reel** : gyroscope Z en deg/s (deja disponible, /100).
- **Yaw geometrique** : derivee du cap GPS, `d(heading)/dt`, attention au passage 360°→0°
  (calculer la difference angulaire signee la plus courte). Lisser legerement.
- **Ecart = yaw_reel − yaw_geometrique**, evalue en phase de courbe (G lateral > seuil, ex.
  0,3 g). Ecart positif soutenu = signature survirage ; negatif = sous-virage.
- Normaliser en % : `ecart / yaw_geometrique`. Aggreger par virage et par tour. Sortie
  factuelle uniquement (« la voiture pivote N % plus vite que la trajectoire »).

### 4.5 — Transfert de charge (temps de mise en appui)
- **Tangage** : detecter le debut d'une phase de freinage (G long franchit un seuil negatif) ;
  mesurer le temps jusqu'a stabilisation du **pitch (gyro Y)** autour de zero (la plongee est
  finie quand la vitesse de tangage revient sous un seuil). Duree = temps de mise en charge avant.
- **Roulis** : en entree de courbe (G lateral monte), temps jusqu'a stabilisation du **roll
  (gyro X)**. Duree = temps de prise de roulis.
- Sortie : comparaison entre virages (« entree la plus progressive / la plus brutale »), en
  secondes. Jamais de consigne.

### Regles transverses de calcul
- **Toujours cote serveur** (edge function / SQL), jamais dans l'app mobile.
- **Seuil de donnees** : un insight n'est calcule et affiche que si l'echantillon le permet
  (nombre de tours minimal, canaux presents, correlation significative). Sinon EmptyState.
- **Tracabilite** : chaque insight expose sa donnee source et la fenetre d'echantillons utilisee.
- **Test de conformite doctrinal** applique a la formulation finale : sortie en « voici / on
  observe / vos tours montrent », jamais « vous devriez / il faut ». La prescription reste le
  domaine exclusif du coach (espace C0), attribuee a lui.
- **Etat actuel** : `telemetry_frames` est vide. Tout insight tourne en mode maquette/demo
  jusqu'a la premiere vraie capture (Valence, juillet 2026). Marquer comme tel a l'ecran.
