# 12 — Éthique : souveraineté des données (charte + déclinaison technique)

> Axe : **vos données vous appartiennent. OXV en est le gardien, pas le propriétaire.**
> Rejoint la couche doctrine (à côté de `00_CLAUDE.md`, `01`, `10`, `11`).
> Prolonge le cadrage RGPD de la fiche 07 (partage) en l'étendant à la propriété,
> la portabilité et l'effacement.

---

## PRÉAMBULE

La télémétrie de pilotage est une donnée intime : elle décrit le geste de quelqu'un.
La position d'OXV n'est pas « ces données sont notre actif » mais « ces données sont
les vôtres, nous les gardons pour vous ». Tout découle de là : on peut les emporter,
les effacer, et elles ne servent à rien d'autre que ce qui est consenti.

---

# PARTIE I — LA CHARTE (les engagements)

### S1. Vos données vous appartiennent.
La télémétrie, les sessions, les insights sont à vous. OXV en est le gardien, pas le
propriétaire, et ne les traite pas comme un actif à exploiter.

### S2. Export total, à tout moment, format ouvert.
Vous pouvez récupérer l'intégralité de vos données quand vous voulez, dans un format
lisible et réutilisable. La portabilité n'est pas une faveur, c'est un dû.

### S3. Suppression réelle, pas un masquage.
« Supprimer » veut dire effacer pour de bon (cascade en base), pas cacher. Limite
honnête : les pièces à valeur légale (paiements) sont conservées le temps imposé par
la loi, et certaines traces de sécurité sont dé-identifiées plutôt que détruites.

### S4. Aucune revente, aucun usage secondaire non consenti.
Vos données ne sont jamais vendues. Elles ne servent qu'à vous restituer votre
pilotage. Aucun entraînement de modèle tiers sur vos données sans consentement explicite.

### S5. Hébergement et flux maîtrisés.
Les données sont hébergées en UE (Supabase, Francfort). Tout flux vers un tiers — en
particulier l'IA — est déclaré, consenti, et réduit au strict minimum.

### S6. Minimisation et durée.
On ne collecte que le nécessaire. Les données brutes volumineuses (frames) ont une
durée de conservation définie, distincte des insights dérivés.

---

# PARTIE II — LA DÉCLINAISON TECHNIQUE (vérifiable)

## A. Garanties déjà VÉRIFIÉES en base
- **Chaîne d'effacement complète (cascade)** : supprimer un `users` →
  `telemetry_sessions` (CASCADE) → `telemetry_frames`, `session_insights`, `laps`,
  `app_session_analyses`, `app_segment_analyses`, `session_media`, `weather_snapshots`
  (tous CASCADE). Les données de performance personnelles s'effacent réellement.
- **Exception légale assumée** : `payments` en `NO ACTION` → un compte avec paiements
  n'est pas supprimable tel quel (conservation comptable obligatoire). Correct.
- **Dé-identification raisonnée** : `admin_audit`, `email_log`, `coach_annotations`,
  `pilot_goals` en `SET NULL` → la trace opérationnelle survit, dé-liée de la personne.
- **Hébergement UE** : Supabase Francfort.

## B. Règles / à construire
| Eng. | Règle / chantier |
|---|---|
| S1 | Les CGU énoncent OXV gardien, pas propriétaire des données de pilotage. |
| S2 | **À construire** : fonction edge « exporter mes données » → rassemble toutes les lignes de l'utilisateur en un export téléchargeable (JSON/CSV ouvert). |
| S3 | Parcours « supprimer mon compte » qui déclenche la cascade (effacer la ligne `users`). Copie honnête sur l'exception paiements (durée légale). |
| S4 | Pas de revente. Le débrief IA n'utilise les données que pour restituer, pas pour entraîner un modèle externe sans consentement. |
| S5 | **AUDIT CLÉ** : flux de `generate-debrief-ai`. Envoie-t-il de la télémétrie à un tiers (OpenAI, US) ? Si oui → divulgation + consentement + minimisation de ce qui est transmis + contrat de sous-traitance. |
| S6 | Définir la rétention des `telemetry_frames` (brutes, volumineuses) vs insights dérivés. |

## C. Requête de vérification — « l'éthique comme test qui peut échouer »
```sql
-- La chaîne d'effacement doit rester en CASCADE depuis telemetry_sessions
select tc.table_name, rc.delete_rule
from information_schema.table_constraints tc
join information_schema.constraint_column_usage ccu
  on tc.constraint_name = ccu.constraint_name
join information_schema.referential_constraints rc
  on tc.constraint_name = rc.constraint_name
where tc.constraint_type='FOREIGN KEY' and ccu.table_name='telemetry_sessions'
  and tc.table_name in ('telemetry_frames','session_insights','laps');
-- attendu : delete_rule = CASCADE pour les trois.
-- Si l'un passe à NO ACTION/RESTRICT, l'effacement est cassé → la charte est violée.
```

## D. Points d'AUDIT / chantiers (à faire)
1. **Flux IA** (`generate-debrief-ai`) : tracer ce qui sort de l'UE. C'est LE point
   sensible de cet axe — il recoupe la transparence (fiche 11, T4) et le RGPD. Une
   donnée de performance envoyée à un LLM US est un transfert hors UE à encadrer.
2. **Construire** l'export de données (S2) et le parcours de suppression (S3).
3. **Définir** la politique de rétention des frames brutes (S6).
4. Soumettre la politique de confidentialité (propriété, export, effacement, flux IA)
   à l'avocat — chemin critique RGPD/CGU/CGV.

---

# PARTIE III — LIMITE HONNÊTE

Le droit à l'effacement n'est pas absolu, et le prétendre serait malhonnête : la loi
impose de conserver les pièces comptables, et la sécurité justifie de garder des
traces d'audit dé-identifiées. OXV s'engage sur le réel : effacer tout ce qui peut
l'être, dire clairement ce qui est conservé et pourquoi, et ne jamais conserver « par
confort » ce qui devrait disparaître.
