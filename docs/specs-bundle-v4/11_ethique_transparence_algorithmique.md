# 11 — Éthique : transparence algorithmique (charte + déclinaison technique)

> Axe : **l'app montre comment elle calcule. Aucune boîte noire.**
> Rejoint la couche doctrine (à côté de `00_CLAUDE.md`, `01`, `10`).
> C'est le jumeau de la doctrine Mirror : si l'app montre la donnée, elle doit
> montrer la *méthode*. Et c'est une protection de bien-être autant qu'un principe :
> un score opaque érode l'autonomie autant qu'une boucle de pression.

---

## PRÉAMBULE — pourquoi la transparence est vitale ICI

L'app présente des chiffres sur le pilotage de quelqu'un. Si ces chiffres sont
illisibles dans leur fabrication, deux dérives surgissent : l'utilisateur leur fait
une confiance aveugle (et prend des décisions de pilotage sur du sable), ou il les
rejette en bloc. Les deux sont mauvaises. La transparence n'est pas un supplément
d'âme — c'est ce qui rend la donnée utilisable sans danger.

Rappel structurant : le **score QDI a été abandonné** précisément parce qu'un nombre
agrégé unique invite à la mésinterprétation. Les 4 piliers factuels l'ont remplacé.
Cet axe formalise ce choix et le verrouille.

---

# PARTIE I — LA CHARTE (les engagements)

### T1. Tout insight est explicable.
Pour chaque chiffre affiché, l'utilisateur peut voir de quoi il est calculé et
comment, en langage clair.
> *Pourquoi : un chiffre dont on ignore la fabrication ne peut pas être jugé fiable.*

### T2. La fiabilité est affichée, jamais cachée.
Quand la donnée est mince ou bruitée, l'app le dit. Elle ne présente jamais une mesure
fragile avec une fausse assurance.
> *Pourquoi : une fausse confiance sur une mesure douteuse peut induire une décision dangereuse.*

### T3. La provenance est traçable.
Chaque insight porte sa version de méthode (`engine_version`) et sa date de calcul.
Quand la méthode change, c'est versionné et visible — résultats reproductibles.
> *Pourquoi : sans provenance, impossible de savoir si deux chiffres sont comparables.*

### T4. L'IA est déclarée comme telle.
Tout texte produit par l'IA (`generate-debrief-ai`) est explicitement signalé comme
généré automatiquement. Jamais présenté comme humain, jamais comme un fait, jamais
prescriptif (doctrine Mirror), ses limites énoncées.
> *Pourquoi : prendre un texte machine pour une vérité ou un conseil humain est trompeur.*

### T5. Les limites de la méthode sont dites.
L'app énonce ce qu'elle NE peut PAS savoir ni mesurer (« Ce que l'app ne dira jamais »).
> *Pourquoi : taire les angles morts, c'est laisser croire à une omniscience qui n'existe pas.*

### T6. Aucune métrique composite opaque.
Pas de « note de pilote » agrégée en boîte noire. Des piliers factuels, pas un verdict.
> *Pourquoi : un score unique cache ses arbitrages et invite à « jouer le score » plutôt qu'à piloter.*

---

# PARTIE II — LA DÉCLINAISON TECHNIQUE (vérifiable)

## A. Primitives déjà présentes en base (vérifiées)
- `session_insights.engine_version` (text) + `computed_at` (timestamptz) → **provenance** (T3).
- `session_insights.data_quality` (jsonb : `frames_used`, `frames_dropped`, `pct_valid`,
  `corners_detected`, `laps_detected`) → **fiabilité affichable** (T2).
- Fonction edge `generate-debrief-ai` (ACTIVE) → composant IA **à divulguer** (T4).
- Moteur `compute-session-insights` : déterministe, donc explicable (T1).
- Aucun champ de score agrégé dans `session_insights` (QDI abandonné) → à maintenir (T6).

## B. Règles que Claude Code DOIT appliquer
| Eng. | Règle de code / présentation |
|---|---|
| T1 | Chaque écran d'insight porte un bloc **« source / méthode »** en langage clair (entrées + comment c'est calculé). Déjà présent dans les maquettes — **obligatoire**, pas optionnel. |
| T2 | `data_quality` affiché. Si `pct_valid` < seuil (ex. 90 %) ou incohérence de virages, bandeau de fiabilité ou **état vide** — jamais une donnée fragile présentée comme sûre. |
| T3 | `engine_version` + `computed_at` consultables (au moins en détail). Insight recalculé après changement de méthode = re-daté. |
| T4 | Tout texte de `generate-debrief-ai` est étiqueté **« généré automatiquement »**, visuellement distinct, non prescriptif, soumis au vocabulaire Mirror et au garde-langage (fiche 10 §C). |
| T5 | Bloc **« Ce que l'app ne dira jamais »** obligatoire sur les insights interprétatifs (ex. N4-4). Énonce les limites : la segmentation des virages est estimée ; l'app ne connaît pas la trajectoire que vous visiez. |
| T6 | Aucun « score » agrégé exposé. Vocabulaire QDI gelé, jamais ressuscité en verdict chiffré. |

## C. Requête de vérification — « l'éthique comme test qui peut échouer »
```sql
-- Aucun champ de verdict/score agrégé ne doit apparaître dans la table d'insights
select column_name from information_schema.columns
where table_schema='public' and table_name='session_insights'
  and column_name ~* 'score|grade|note_globale|qdi|rating|verdict';
-- attendu : 0 ligne (les piliers sont factuels, pas un verdict)
```

## D. Points d'AUDIT (à faire)
1. **`generate-debrief-ai`** : lire le prompt et un échantillon de sortie. Vérifier
   (a) étiquetage IA, (b) absence de prescription (« vous devez… »), (c) respect du
   vocabulaire Mirror. **C'est l'audit central de cet axe** — et il recoupe l'audit
   bien-être (fiche 10 §E). Une seule action couvre les deux : relire les textes
   machine (debrief IA + `ritual_dispatcher`) contre la doctrine.
2. **Maquettes** : confirmer que chaque insight interprétatif porte le bloc source ET
   le bloc limites.

---

# PARTIE III — TRANSPARENCE ET BIEN-ÊTRE SONT LIÉS

Un score boîte noire qui annoncerait « vous êtes un pilote 7/10 » cumulerait deux
maux : il attacherait la valeur de la personne à un chiffre (atteinte au bien-être,
fiche 10 §E6) ET pousserait à « faire monter le score » par la prise de risque. La
transparence (méthode visible) et l'absence de composite opaque sont donc, ensemble,
une garantie d'autonomie. Les deux chartes se renforcent.
