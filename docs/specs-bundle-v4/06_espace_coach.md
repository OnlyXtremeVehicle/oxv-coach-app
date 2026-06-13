# 06 — Espace coach (conception)

> Fiche de conception, suivant le gabarit du §6 de `05_integration_trace_3d.md`.
> À lire APRÈS `00_CLAUDE.md`, `05_integration_trace_3d.md` et le
> `CONTRAT_DONNEES_session_insights.json`.
>
> ⚠️ État réel vérifié en base (projet `fouvuqkdxarjpjbqnsjq`) : les 10 tables
> `coach_*` EXISTENT mais sont VIDES (sauf `coach_permissions` : 1 ligne = admin).
> On ne raccorde donc pas un espace existant — on le CONÇOIT pour la première fois.
> Le schéma est en place ; ne pas le re-migrer sans raison, le vérifier et l'utiliser.

---

## 1. RAISON D'ÊTRE (décision fondateur)

Espace coach version 1 = **LIRE + ANNOTER + GÉRER**.
- LIRE : voir ses pilotes rattachés et leurs données de session (tracé + insights).
- ANNOTER : poser des notes attribuées au coach sur des virages précis.
- GÉRER : créer/administrer des roulages, un planning, rattacher des pilotes.

---

## 2. POSITION DOCTRINALE — le coach est l'exception qui prescrit

Rappel `00_CLAUDE.md` : l'app est un miroir, elle ne prescrit jamais. **Le coach,
agréé, EST l'exception** : lui peut dire « freine plus tard », « vise ce point de
corde ». Règle absolue : **tout contenu produit par le coach est visuellement
attribué au coach** (badge « Coach », liseré or `--oxv-gold`), pour qu'un pilote ne
confonde jamais un constat factuel de l'app avec une consigne humaine du coach.

### Conséquence sur deux tables (décision fondateur : RÉSERVÉES AU COACH, on les garde)
- `coach_reading_weights` (w_vehicle, w_pilot, w_regularity, w_smoothness) :
  pondérations héritées du QDI. **Réservées au coach** — c'est SA grille de lecture
  personnelle, pas un score affiché au pilote. Ne JAMAIS exposer ces poids ni un
  score agrégé côté pilote. Usage strictement coach, et étiqueté comme tel.
- `coach_corner_reference` (braking_point_m, target_speed_kmh, trajectory_note) :
  valeurs cibles **prescriptives**. Légitimes UNIQUEMENT parce qu'attribuées au
  coach. À l'affichage : toujours sous le nom du coach, jamais présentées comme un
  fait de l'app.

---

## 3. STRUCTURE DES TABLES (vérifiée en base)

| Table | Rôle | Colonnes clés |
|-------|------|---------------|
| `coach_permissions` | droits d'un user coach | can_view_pilots, can_manage_own_sessions, can_view_business_dashboard, granted_by |
| `coach_pilots` | rattachement coach↔pilote | coach_id, pilot_id, active, **pilot_consent_at**, notes |
| `coach_session_context` | contexte d'une session | pilot_level, objective, equipment, weather_note |
| `coach_annotations` | notes sur un virage | corner_index, body, **visibility**, deleted_at |
| `coach_annotation_template` | gabarits de notes réutilisables | label, body |
| `coach_corner_reference` | référence virage (prescriptive, coach) | braking_point_m, target_speed_kmh, trajectory_note |
| `coach_pilot_highlight` | virages mis en avant pour un pilote | highlight_corner_indexes[], note |
| `coach_reading_weights` | grille de lecture perso (coach) | w_* (réservé coach) |
| `coach_roulages` | sessions/événements organisés | title, circuit_name, starts_at, max_pilots, status, price_per_pilot |
| `coach_pilots_view` | vue agrégée | (vue SQL existante à inspecter) |

---

## 4. RGPD — LE POINT DUR (à cadrer AVANT de coder l'accès aux données pilote)

Un coach accède aux données télémétriques d'un pilote = donnée personnelle. La table
`coach_pilots.pilot_consent_at` existe précisément pour ça : **un coach ne voit les
données d'un pilote que si `active = true` ET `pilot_consent_at` est renseigné.**

Règles de conception non négociables :
- Pas de `pilot_consent_at` → aucune donnée du pilote visible. Filtre côté requête
  ET côté RLS (ne pas se reposer sur l'UI seule).
- Le pilote peut révoquer (passe `active=false` ou efface le consentement) → le coach
  reperd l'accès immédiatement.
- `coach_annotations.visibility` arbitre qui voit l'annotation (le pilote concerné ?
  les autres pilotes ? le coach seul ?). Définir l'énumération AVANT de coder.
- Soumettre le schéma de consentement à l'avocat (cf. chemin critique : Pacte, RGPD).
  C'est exactement un point où `legal:review-contract` / cadrage juridique s'applique.

---

## 5. ÉCRANS DE L'ESPACE COACH (sous-fiches)

### 5.1 — Tableau de bord coach (accueil)
- Rôle : point d'entrée. Liste des pilotes rattachés (consentis), prochains roulages.
- Données : `coach_pilots` (active + consent), `coach_roulages` (status, starts_at).
- Tracé : aucun ici (vue liste).
- Garde : si `coach_permissions.can_view_pilots = false` → écran restreint.

### 5.2 — Fiche pilote (vue d'un pilote par le coach)
- Rôle : voir les sessions d'un pilote rattaché.
- Données : sessions du pilote + `coach_session_context` + `session_insights`.
- Tracé : **tracé partagé**, couches coach débloquées (cf. §3 de
  `05_integration_trace_3d.md`). C'est ici que le composant `<CircuitTrace role="coach">`
  prend tout son sens.
- Garde RGPD : `pilot_consent_at` obligatoire (cf. §4).

### 5.3 — Annotation de session (lire + annoter)
- Rôle : le coach lit une session sur le tracé et pose des notes sur des virages.
- Données : écriture dans `coach_annotations` (corner_index, body, visibility) ;
  gabarits depuis `coach_annotation_template`.
- Tracé : tap sur un virage → ajout d'une annotation attribuée au coach (badge or).
- Liaison : l'annotation apparaît ensuite côté pilote SELON `visibility`.
- Référence prescriptive optionnelle : `coach_corner_reference` (toujours sous le
  nom du coach).

### 5.4 — Gestion des roulages (gérer)
- Rôle : créer/éditer des roulages, fixer date/lieu/places/prix, suivre le statut.
- Données : CRUD sur `coach_roulages`.
- Tracé : optionnel (afficher le circuit du roulage si `circuit_name` connu).
- Note métier : `price_per_pilot` en entier (centimes — cohérence avec le reste de
  la base, cf. règle prix Heritage en centimes).

### 5.5 — Rattachement de pilotes (gérer)
- Rôle : inviter/rattacher un pilote, suivre le consentement.
- Données : écriture `coach_pilots` ; le consentement (`pilot_consent_at`) est posé
  PAR LE PILOTE, pas par le coach (côté app pilote).
- Garde : un rattachement sans consentement ne donne AUCUN accès aux données.

---

## 6. RÉSERVES STRUCTURELLES (à ne pas masquer)

1. **Tables vides** : tout l'espace se développe sur des données de démonstration
   jusqu'à ce que de vrais coachs/pilotes existent. Prévoir un jeu de seed réaliste
   pour le développement, marqué comme tel.
2. **Désalignement virages** (rappel §5.1 de `05_`) : `coach_annotations.corner_index`
   et `coach_corner_reference.corner_index` doivent référencer la MÊME numérotation
   de virages que le générateur de circuit (détection par courbure, 7 virages sur le
   tracé test). Tant que le moteur d'insights numérote différemment (13 par minima de
   vitesse), une annotation « virage 7 » risque de tomber au mauvais endroit. À
   verrouiller : une seule source de numérotation des virages par circuit.
3. **Consentement = bloquant** : ne pas livrer l'accès coach aux données pilote avant
   que le mécanisme de consentement soit codé ET validé juridiquement.

---

## 7. ORDRE DE TRAVAIL RECOMMANDÉ

1. Définir l'énumération `coach_annotations.visibility` + les règles RLS de
   consentement (§4). Validation fondateur + avocat AVANT code.
2. Écran 5.1 (tableau de bord) — lecture seule, pas de donnée sensible.
3. Écran 5.2 (fiche pilote) avec `<CircuitTrace role="coach">` sur session de démo.
4. Écran 5.3 (annotation) — écriture dans `coach_annotations`, attribution visuelle.
5. Écrans 5.4 / 5.5 (gestion roulages + rattachement).
6. Brancher sur vraies données après Valence + après alignement de la numérotation
   des virages (§6.2).

Chaque étape validée par le fondateur avant la suivante. Pas de refactor spéculatif.
Architecture mono-repo Expo préservée.
