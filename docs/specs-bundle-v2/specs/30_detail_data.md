# Bloc 30 — Detail data (5 ecrans) — l'arme concurrentielle

Reference : `01_doctrine_et_composants.md` + **`02_moteur_insights.md`** (le catalogue factuel
que ce bloc met en vitrine). **C'est ici qu'on ecrase la concurrence.** La ou
RaceChrono / AiM / Garmin Catalyst donnent un graphe brut a interpreter (ou pire, dirigent),
Mirror raconte le fait **proprement et lisiblement** — et surtout **sur le trace, la ou il se
produit** (Pattern 4). Profondeur data sans densite illisible.

---

## 30.1 — Vitesse & allure

- **But** : la courbe de vitesse du tour, propre et lisible.
- **Layout** :
  - `[Composant: MetricHero]` : vitesse max + vitesse mini (les deux faits qui parlent).
  - `[Composant: DataChart]` : vitesse sur le tour, axe distance. Epuree, une lecture.
  - `[Composant: FactRow]` : vitesse moyenne, vitesse en ligne droite principale.
- **Donnees** : frames GPS (Supabase).
- **Doctrine** : pas de « vous perdez X km/h ici, accelerez plus tot ». On montre la courbe.
- **Etat vide** : `[Composant: EmptyState]`.

---

## 30.2 — Freinage & appuis (G)

- **But** : presenter les G longitudinaux et lateraux **humainement**, pas en jargon
  d'ingenieur.
- **Layout** :
  - `[Composant: MetricHero]` : G max au freinage / G max en appui lateral, en clair.
  - `[Composant: DataChart]` : trace des G sur le tour (ou diagramme G-G factuel).
  - `[Composant: FactRow]` : zones de freinage les plus marquees (decrites, situees).
- **Donnees** : IMU 25 Hz (frames Supabase).
- **Doctrine** : montrer l'intensite reelle des appuis. **Jamais** « freinez plus fort » ou
  « vous pouvez porter plus de G ».
- **Etat vide** : `[Composant: EmptyState]`.

---

## 30.3 — Idiome HUD : Cap / Trajectoire / Anticipation / Visee / Plongee

- **But** : exposer **visuellement** le lexique HUD interne OXV — la signature conceptuelle
  du produit. Differenciation pure : personne d'autre n'a ce langage.
- **Layout** :
  - Cinq lectures factuelles, une par notion (Cap, Trajectoire, Anticipation, Visee,
    Plongee), chacune en `[Composant: MetricHero]` compact ou `[Composant: FactRow]` riche.
  - Chaque notion = une **mesure factuelle** rattachee a la donnee (ex. « Cap » = orientation
    reelle ; « Plongee » = phase de mise en appui mesuree). **Definir chaque mapping
    donnee→notion en commentaire de code**, et le garder factuel.
- **Donnees** : derivees des frames (cote Supabase).
- **Doctrine** : **point sensible.** Ces mots sont evocateurs ; ils doivent rester des
  **descripteurs de faits**, jamais des consignes (« ameliorez votre visee »). Si une notion
  ne peut etre rendue factuellement, ne l'affiche pas plutot que de la transformer en conseil.
  Ne nomme **jamais** le faucon, meme si « Plongee/Visee » l'evoquent en interne.
- **Etat vide** : afficher seulement les notions calculables.

---

## 30.4 — Conditions de session

- **But** : le contexte factuel du run — meteo, asphalte, heure. Ce qui rend la donnee
  interpretable honnetement.
- **Layout** :
  - `[Composant: MetricHero]` : condition dominante (ex. « Piste seche, 22 C »).
  - `[Composant: FactRow]` : temperature air, vent, heure de session, etat asphalte declare.
  - Lien vers « Conditions & ressenti » (90.2) pour croiser avec le ressenti pilote.
- **Donnees** : Open-Meteo (cache 10 min, GARDER) + `weather_snapshots` (table existante).
- **Doctrine** : contexte neutre. Aucune correlation suggeree du type « par temps chaud,
  freinez… ».
- **Etat vide** : « Conditions non recuperees pour cette session. »

---

## 30.5 — Insights spatiaux *(les faits que le pilote ne voyait pas seul — sur le trace)*

- **But** : exposer les insights phares du moteur (`02_moteur_insights.md`, profondeurs 3-4),
  **inscrits sur le trace**. C'est l'ecran qui materialise « afficher du nouveau, sans coacher ».
- **Layout** (chaque insight = un `[Composant: TrackStage]` + `[Composant: FactRow]` + `source`) :
  - **Dispersion par virage** (moteur 3.1) — `TrackStage / faisceau`. « Au V4 : 1,8 m ; au
    V1 : 0,3 m. » Le faisceau qui s'evase **se voit**.
  - **Tour de reference compose** (moteur 3.2) — `TrackStage`, trace colorie par secteur, chaque
    secteur affichant son tour d'origine. « 1:41.2 — non roule tel quel. »
  - **Coherence du flow** (moteur 4.1) — correlation jerk × temps au tour. « Vos tours les plus
    rapides ne sont pas vos plus agressifs. »
  - `[Composant: CoachBand]` si coach lie : ancre au virage / a la zone concernee.
- **Donnees** : indicateurs derives **cote Supabase** (GNSS ~10 cm, IMU ±8g, gyro ±320 dps, 25 Hz).
- **Doctrine** : **point le plus sensible de l'app.** On revele un lien observe ; on ne nomme
  jamais la cause a corriger cote pilote (« relachez plus tard » → interdit, → `CoachBand`). Voir
  le garde-fou critique de `02_moteur_insights.md` §F.
- **Etat vide** : afficher seulement les insights calculables ; le reste en `EmptyState`.
