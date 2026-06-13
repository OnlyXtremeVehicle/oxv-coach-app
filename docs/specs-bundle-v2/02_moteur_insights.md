# 02 — Moteur d'insights (catalogue factuel)

Reference : `00_CLAUDE.md` (doctrine, test de conformite) et `01_doctrine_et_composants.md`
(patterns, `TrackStage`, `CoachBand`).

Ce fichier est le **cerveau** de la restitution : ce que l'app peut reellement deduire des
seules donnees du RaceBox, et **comment** le dire sans diriger. Les ecrans des blocs 20 et 30
sont la **vitrine** de ce moteur.

---

## A. Le signal physique disponible (ce qui borne tout)

Le RaceBox Mini fournit, a **25 Hz** :
- **Position GNSS** (~10 cm en conditions favorables), latitude / longitude / altitude.
- **Vitesse** et **cap** (heading).
- **Accelerometre 3 axes** (±8 g) — G longitudinaux (freinage / acceleration) et lateraux (appui).
- **Gyroscope 3 axes** (±320 dps) — notamment la vitesse de lacet (rotation du vehicule).

Tout insight ci-dessous se derive de ces grandeurs (cote Supabase, **jamais** dans l'app — voir
`00_CLAUDE.md` §4 et §7-2). Si une grandeur manque (frames partielles), l'insight degrade
proprement (`EmptyState`).

---

## B. Le principe de classement : profondeur de revelation, pas prescription

On ne classe **pas** les insights du « simple » au « directif ». On les classe du **fait brut**
au **fait surprenant que le pilote ne pouvait pas voir seul**. La valeur vient de **reveler**,
pas de corriger. La causalite orientee (« la cause a corriger ») n'est pas un niveau superieur
du moteur cote pilote : elle **sort** de l'espace pilote et vit dans le `CoachBand` (Pattern 4).

Chaque insight est decrit avec : **ce qu'on revele**, **la donnee source**, **le phrasing-miroir
autorise** (cote pilote), et le **phrasing-interdit** en regard (ce qui basculerait dans le
coaching).

---

## C. Profondeur 1 — Faits directs (le socle, ce que fait deja la concurrence)

Lecture immediate d'une grandeur. Necessaire, pas differenciant. Vitrine : bloc 30.1 / 30.2.

| Revele | Source | Miroir (OK) | Interdit |
|---|---|---|---|
| Vitesse max / mini | GNSS vitesse | « Vitesse mini en S2 : 84 km/h. » | « Vous etes trop lent en S2. » |
| G max freinage / appui | Accelero ±8g | « Appui lateral max : 1,3 G. » | « Vous pouvez porter plus de G. » |
| Temps au tour | GNSS + portes | « Tour le plus regulier : 1:42.8. » | « Bon / mauvais tour. » |

---

## D. Profondeur 2 — Faits mis en perspective (soi contre soi)

Le meme fait, situe par rapport au pilote lui-meme. Vitrine : bloc 20.3 / 20.4.

| Revele | Source | Miroir (OK) | Interdit |
|---|---|---|---|
| Fourchette de regularite | Ecart-type des temps au tour | « Vos tours tiennent dans 0,9 s. » | « Visez moins de 0,5 s. » |
| Delta vs reference perso | Historique laps | « +0,4 s vs votre meilleure session ici. » | « Vous regressez. » |
| Evolution dans le temps | Sessions multiples | « Ce virage : faisceau resserre vs juin. » | « Vous devez encore progresser. » |

---

## E. Profondeur 3 — Faits spatiaux revele sur le trace *(differenciant)*

Ici commence l'arme : le fait s'inscrit dans un `TrackStage`, **la ou il se produit**. Personne
en grand public ne montre ca lisiblement. Vitrine : bloc 30.3, ecrans trace-centres.

### 3.1 — Dispersion de trajectoire par virage *(phare)*
- **Revele** : la regularite spatiale de chaque virage. « Au V4, votre corde varie de 1,8 m ;
  au V1, de 0,3 m. »
- **Source** : ecart-type lateral au point de corde geometrique de chaque virage, sur N tours
  (GNSS ~10 cm).
- **Mode** : `TrackStage / faisceau`. Le faisceau s'evase au V4, se confond au V1.
- **Miroir (OK)** : « Vos trajectoires s'evasent au V4. » — **Interdit** : « Visez la corde du
  V4 plus regulierement. » (→ `CoachBand`).

### 3.2 — Tour de reference compose *(phare)*
- **Revele** : « Vos meilleurs secteurs, assembles, donnent 1:41.2 — soit 1,6 s sous votre
  meilleur tour reellement boucle. »
- **Source** : meilleur S1 / S2 / S3 sur N tours, somme arithmetique. Chaque secteur garde son
  tour d'origine. **Tour non roule tel quel** — a ecrire noir sur blanc.
- **Mode** : `TrackStage`, trace colorie par secteur, chaque secteur affiche son tour source.
- **Miroir (OK)** : « 80 % du temps perdu se loge en S2. » — **Interdit** : « Concentrez-vous
  sur le S2. » (→ `CoachBand`).

### 3.3 — Carte de chaleur du trace
- **Revele** : ou se concentre le temps / la donnee sur le circuit.
- **Source** : agregation spatiale des frames.
- **Mode** : `TrackStage / heatmap`. **Jamais** une trajectoire ideale a suivre.

---

## F. Profondeur 4 — Correlations observees *(le sommet du miroir)*

Le fait le plus impressionnant : un **lien** entre deux grandeurs, **observe** sur les tours du
pilote, presente **sans designer la cause a corriger**. C'est ici que la frontiere du Pattern 4
est la plus fine — et la plus importante.

### 4.1 — Coherence du flow *(phare)*
- **Revele** : « Vos tours les plus rapides ne sont pas vos plus agressifs au volant. »
- **Source** : jerk (derivee de l'acceleration, IMU) + vitesse de lacet (gyro), correle au
  temps au tour, sur N tours.
- **Forme** : nuage de points (un point = un tour) ou lecture le long du trait.
- **Miroir (OK)** : presenter la correlation observee et la nommer. Le pilote voit le lien et
  conclut seul. — **Interdit** : « Adoucissez vos commandes pour gagner du temps. » (→ `CoachBand`).

### 4.2 — Constance des zones de freinage
- **Revele** : « Vos freinages au V6 se declenchent dans une fenetre de 12 m d'un tour a l'autre. »
- **Source** : detection du pic de G longitudinal negatif + position GNSS, par virage.
- **Miroir (OK)** : montrer la fenetre. — **Interdit** : « Freinez plus tard / plus tot. »

> **Garde-fou critique.** Profondeur 4 ne franchit la frontiere du coaching que par un mot. Un
> constat causal qui **designe une cause corrigible** (« vous perdez 0,3 s **parce que** vous
> relachez 8 m trop tot ») est, fonctionnellement et juridiquement, un conseil deguise : il
> oriente le comportement. **Cote pilote, on s'arrete au lien observe** (« vos tours ou vous
> relachez tot sont vos plus lents en S2 ») sans nommer la correction. Si le constat pointe la
> cause a corriger, il appartient au `CoachBand`.

---

## G. Profondeur 5 — Lecture du coach *(hors moteur OXV — espace `CoachBand`)*

Ce n'est **pas** un niveau du moteur OXV : c'est la couche du **coach agree**, posee par-dessus.
Le coach peut, lui :
- **Prescrire** : « Fixe un repere de corde au V4. » « L'objectif : reproduire ce S2 deux tours
  de suite. »
- **Enrichir la donnee technique** : ajouter des reperes / observations qui etoffent le bilan de
  son pilote (voir `specs/C0_coach.md`).

Tout contenu de profondeur 5 :
- vit dans un `CoachBand`, **separe sous le `TrackStage`**, **ancre a un point precis** ;
- est **attribue** au coach (« Debrief de [nom] »), jamais a l'app ;
- engage la responsabilite **du coach**, pas d'OXV. C'est la frontiere qui preserve le non-agrement.

---

## H. Regle de production pour Claude Code

1. Tout insight affiche cote pilote sort des profondeurs 1 a 4 et **passe le test de conformite**
   (`00_CLAUDE.md` §1) : commence par « voici / sur ce tour / par rapport a… », jamais par
   « vous devriez / il faut / pour progresser ».
2. La causalite orientee (profondeur 5) **ne s'ecrit jamais cote pilote**. Elle ne peut venir que
   d'un `CoachBand` alimente par un coach lie.
3. Le calcul de tous ces indicateurs vit **cote Supabase**, pas dans les composants d'ecran.
4. Tant que `telemetry_frames` est vide, chaque insight est une **maquette de demonstration** et
   doit degrader proprement (`EmptyState`). Premiere vraie capture : Valence, juillet 2026.
