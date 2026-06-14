# 10 — Éthique : bien-être & sécurité (charte + déclinaison technique)

> Axe : **la boucle de feedback ne doit pas pousser à la prise de risque.**
> Ce document rejoint la couche doctrine (à côté de `00_CLAUDE.md` / `01`).
> Principe de méthode : une éthique qui n'est pas vérifiable dans le code n'est
> qu'un slogan. Chaque engagement de la Partie I a sa traduction en Partie II.

---

## PRÉAMBULE — la question propre à OXV

Pour la plupart des apps, « éthique » se réduit à la vie privée. Pour OXV, la vie
privée est la partie facile. Le cœur dur est ailleurs : OXV accompagne des gens qui
roulent vite sur circuit. La question n'est pas « qui voit mes données » — c'est :
**est-ce que quantifier et afficher la performance pousse, même involontairement, à
dépasser sa limite ?**

Une boucle de feedback qui récompense le chrono peut encourager la prise de risque.
La doctrine Mirror — « l'app vous montre, elle ne vous dirige pas » — est déjà la
réponse de fond : respecter l'autonomie. Cet axe en tire les conséquences pour la
sécurité.

---

# PARTIE I — LA CHARTE (les engagements)

### E1. La progression est référencée à soi, pas aux autres.
La mesure première est l'évolution personnelle (soi vs soi), jamais un classement
imposé. Toute comparaison à autrui est un choix actif et granulaire de l'utilisateur.
> *Pourquoi : un classement de vitesse pousse à se mesurer aux autres, donc à forcer.*

### E2. La régularité et le contrôle priment sur le chrono brut.
Un tour propre est présenté aussi positivement qu'un tour rapide. L'app ne célèbre
jamais la vitesse pure comme « meilleure quoi qu'il arrive ». Régularité et fluidité
sont mises en avant au moins à égalité avec le temps au tour.
> *Pourquoi : valoriser le seul chrono, c'est récompenser le fait d'aller au-delà du contrôle.*

### E3. L'app reflète, elle ne pousse pas.
Aucune mécanique qui pousse à rouler plus, plus souvent, ou plus fort : pas de série
(streak), pas de notification « battez votre temps », pas d'urgence artificielle, pas
de FOMO.
> *Pourquoi : les boucles d'engagement transforment un loisir à risque en obligation.*

### E4. Aucun feedback pendant la conduite.
L'app est post-session par conception. Elle n'affiche jamais de télémétrie en direct
destinée au pilote pendant qu'il roule. Capture pendant, analyse après.
> *Pourquoi : tout affichage lu au volant est une distraction, donc un danger.*

### E5. La performance est contextualisée par les conditions.
Un tour sur le sec n'est pas comparé naïvement à un tour sous la pluie. Les conditions
qualifient toute comparaison.
> *Pourquoi : comparer hors contexte pousse à « rattraper » un chrono inatteignable en sécurité.*

### E6. Le langage est factuel, jamais un jugement.
Pas de « vous avez échoué », pas de « vous étiez lent ». Le vocabulaire Mirror décrit,
il ne note pas. La valeur de la personne n'est jamais liée à un chiffre.
> *Pourquoi : un feedback culpabilisant pousse à se « racheter » par la prise de risque.*

### E7. Honnêteté sur la limite (l'engagement le plus important).
OXV **n'est pas un dispositif de sécurité**. Rouler vite sur circuit comporte un risque
irréductible que l'app ne supprime pas. Son engagement n'est pas de rendre l'activité
sûre — c'est de **ne pas amplifier ce risque par sa conception**. Et la responsabilité
de tout conseil (prescription) incombe au **coach agréé**, pas à l'app.
> *Pourquoi : prétendre « rendre sûr » serait un mensonge dangereux. L'honnêteté protège.*

---

# PARTIE II — LA DÉCLINAISON TECHNIQUE (vérifiable)

## A. Garanties déjà VÉRIFIÉES en base (état au jour de rédaction)
- **Aucune** table `leaderboard / ranking / streak / badge / trophy / achievement`.
- `session_insights` : **0** champ de comparaison inter-pilotes (`rank`, `percentile`,
  `vs_other`…). Le moteur est intrinsèquement « soi vs soi » : `session_drift`,
  `ideal_lap` (vs son propre meilleur), `flow_coherence` (qui calcule À LA FOIS
  `smoothest_lap` ET `fastest_lap`).
- `weather_snapshots` existe → contextualisation par conditions possible (E5).
- `pilot_goals` (objectifs personnels), `app_progression_shares` (partage opt-in,
  métrique par métrique) existent → comparaison uniquement choisie (E1).

## B. Règles que Claude Code DOIT appliquer
| Engagement | Règle de code / présentation |
|---|---|
| E1 | Aucun écran ne rend un classement de vitesse inter-pilotes. Comparaison seulement via `app_progression_shares`. |
| E2 | `flow_coherence.smoothest_lap` affiché à prominence ≥ `fastest_lap`. Couche par défaut du `<CircuitTrace>` = **Régularité**, pas vitesse. Le temps au tour n'est jamais le titre unique ou dominant. |
| E3 | Aucune table ni logique de série/badge. Notifications (`ritual_dispatches`) : copie factuelle et de soutien uniquement. |
| E4 | Architecture capture→analyse. Aucun écran de télémétrie live destiné au pilote au volant. |
| E5 | Toute comparaison (PB, tour idéal, session vs session) affiche les conditions et signale si elles diffèrent. Ne jamais égaliser sec et pluie. |
| E6 | Garde-langage (liste ci-dessous) appliqué à toute copie produite. |
| E7 | Écran d'accueil/charte : l'app est un miroir, pas un dispositif de sécurité. Toute prescription est attribuée au coach (cf. fiche 06). |

## C. Garde-langage — vocabulaire INTERDIT dans toute copie client
Termes de jugement à bannir (liste lintable, à étendre) :
`échec, raté, lent, mauvais, faute, erreur (comme reproche), médiocre, faible,
décevant, vous auriez dû, il faut, vous devez (comme injonction de pilotage)`.
Remplacés par du factuel : « votre dispersion a augmenté au V4 », pas « vous avez raté
le V4 ». Le verbe est au présent descriptif, jamais à l'impératif prescriptif.

## D. Requête de vérification — « l'éthique comme test qui peut échouer »
À exécuter (CI ou revue périodique). Si elle renvoie autre chose que vide / 0, la
charte est violée :
```sql
-- 1. Aucune table de mécanique compétitive ne doit apparaître
select table_name from information_schema.tables
where table_schema='public'
  and table_name ~* 'leaderboard|ranking|streak|badge|trophy|achievement';
-- attendu : 0 ligne

-- 2. Le moteur d'insights reste « soi vs soi »
select count(*) as champs_inter_pilotes from information_schema.columns
where table_schema='public' and table_name='session_insights'
  and column_name ~* 'rank|percentile|vs_other|other_pilot|leaderboard';
-- attendu : 0
```

## E. Points d'AUDIT (à faire, pas encore faits)
1. **Copie des notifications** : relire le contenu de `ritual_dispatches` et de la
   fonction `ritual_dispatcher` (edge) contre le garde-langage (C) et E3. C'est le seul
   endroit où une pression pourrait s'être glissée. → action concrète immédiate.
2. **Maquettes** : vérifier qu'aucune ne met le chrono en titre dominant seul (E2).
3. **Coach** : confirmer que toute prescription coach est visuellement attribuée au
   coach (E7 + fiche 06).

---

# PARTIE III — RESPONSABILITÉ & LIMITE

OXV présente des données ; elle ne pilote pas à la place du pilote et ne garantit
aucune sécurité. Le pilote reste seul responsable de sa conduite sur circuit. Le coach
agréé porte la responsabilité de ses conseils. L'app porte une seule responsabilité,
mais entière : **ne pas concevoir de boucle qui pousse à la faute.** Cette charte est
le contrat qui rend cette responsabilité vérifiable.
