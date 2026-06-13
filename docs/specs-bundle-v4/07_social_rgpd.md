# 07 — Social & cadrage RGPD (conception)

> Fiche de conception, suivant le gabarit du §6 de `05_integration_trace_3d.md`.
> À lire APRÈS `00_CLAUDE.md` et `06_espace_coach.md`.
>
> ⚠️ État réel vérifié en base (`fouvuqkdxarjpjbqnsjq`) : les 5 tables sociales
> EXISTENT mais sont TOUTES VIDES. On conçoit, on ne raccorde pas.
>
> ⚠️ Principe directeur de cette fiche : **le RGPD n'est pas une couche ajoutée à la
> fin, c'est la fondation.** Partager des données de pilotage entre personnes = traiter
> de la donnée personnelle. Toute fonctionnalité sociale part du consentement, pas
> l'inverse.

---

## 1. PÉRIMÈTRE (décision fondateur)

Social version 1 = **les trois, mais amis + partage de progression EN PRIORITÉ**.
- PRIORITÉ 1 : amitiés entre pilotes (`pilot_friendships`) + partage de progression
  choisi métrique par métrique (`app_progression_shares`).
- PRIORITÉ 2 : invitations à rouler ensemble (`roulage_invitations`).
- PLUS TARD / proche carte : fil d'événements et lieux (`social_pings`) — ressemble
  davantage à la future page Carte ; ne pas le mélanger avec le cœur social.

Décision clé sur le partage : **le pilote choisit métrique par métrique ce qu'il
expose** (le plus respectueux). Pas de classement imposé, pas d'exposition par défaut.

---

## 2. CADRAGE RGPD — LA FONDATION (à valider par l'avocat AVANT tout code)

### 2.1 — Données concernées et leur sensibilité
| Donnée | Table | Sensibilité |
|--------|-------|-------------|
| Métriques de pilotage (régularité, progression, temps) | `app_progression_shares.included_metrics` | Personnelle — performance individuelle |
| Lien d'amitié (qui connaît qui) | `pilot_friendships` | Personnelle — graphe social |
| Géolocalisation d'événement | `social_pings.lat/lon/address` | Sensible — localisation |
| Email de contact | `social_pings.contact_email` | Personnelle — donnée de contact |

### 2.2 — Les 6 principes appliqués à OXV (chacun = une règle de code)
1. **Consentement explicite** : aucune donnée partagée sans action positive du
   pilote. Pas de partage par défaut, pas de case pré-cochée.
2. **Minimisation** : on ne partage QUE les métriques explicitement cochées
   (`included_metrics`). Le défaut est l'ensemble vide.
3. **Granularité** : le pilote choisit métrique par métrique (décision fondateur).
   `included_metrics` = liste blanche, jamais liste noire.
4. **Limitation de durée** : `expires_at` obligatoire ou recommandé fort. Un partage
   n'est pas éternel par défaut.
5. **Révocabilité** : `revoked_at` — le pilote coupe quand il veut, effet immédiat
   (au niveau requête ET RLS, pas seulement UI).
6. **Traçabilité** : `view_count` / `last_viewed_at` — le pilote voit qui/combien a
   consulté son partage. Transparence sur l'usage réel.

### 2.3 — Réciprocité de l'amitié
`pilot_friendships` : `initiator_id`, `status`, `requested_at`, `responded_at`.
- Une amitié n'existe (`status='accepted'`) que si l'AUTRE pilote a répondu oui.
- Tant que `status='pending'`, AUCUNE donnée ne circule entre les deux.
- Définir l'énumération `status` : pending / accepted / declined / blocked.
- Le blocage (`blocked`) coupe tout : plus de partage, plus d'invitation possible.

### 2.4 — Droits des personnes (à prévoir dans l'app, pas seulement en base)
- Droit d'accès : le pilote voit tout ce qu'il partage et avec qui (écran 5.4).
- Droit de retrait : révocation en un geste.
- Droit à l'effacement : suppression d'un partage = suppression réelle, pas masquage.
- Le tout documenté dans une politique de confidentialité (chemin critique avocat,
  cf. CGU/CGV/RGPD du dossier de consultation).

---

## 3. STRUCTURE DES TABLES (vérifiée en base)

| Table | Rôle | Colonnes clés (déjà pensées RGPD) |
|-------|------|-----------------------------------|
| `pilot_friendships` | lien d'amitié bilatéral | pilot_a, pilot_b, initiator_id, status, requested_at, responded_at |
| `app_progression_shares` | partage granulaire de progression | share_token, share_scope, **included_metrics (jsonb)**, **expires_at**, **revoked_at**, view_count, last_viewed_at |
| `pilot_goals` | objectifs personnels du pilote | body, status, evaluated_session_id (perso, pas social par défaut) |
| `roulage_invitations` | inviter un pilote à un roulage | roulage_id, pilot_id, status, invited_at, responded_at |
| `social_pings` | événements / lieux (proche Carte) | kind, lat, lon, address, contact_email, is_published, starts_at |

> Le schéma confirme une intention prudente : `app_progression_shares` a nativement
> scope + métriques explicites + expiration + révocation + compteur de vues. C'est le
> bon modèle ; le code doit l'honorer, pas le contourner.

---

## 4. ÉCRANS DU SOCIAL (sous-fiches)

### 4.1 — Mes amis (annuaire + demandes)
- Rôle : voir ses amis (`accepted`), gérer les demandes (`pending`), bloquer.
- Données : `pilot_friendships`.
- Tracé : aucun.
- Garde : une demande pending ne donne accès à RIEN.

### 4.2 — Partager ma progression (le cœur RGPD)
- Rôle : créer un partage en cochant métrique par métrique ce qu'on expose, à qui,
  jusqu'à quand.
- Données : écriture `app_progression_shares` (included_metrics = liste blanche cochée,
  share_scope = à qui, expires_at = durée).
- Tracé : OPTIONNEL — si le pilote inclut des métriques par virage, un mini-tracé peut
  illustrer ce qui sera visible. Ne montrer QUE les métriques cochées.
- Liaison : l'ami voit le partage via `share_token`, dans la limite du scope/expiration.
- Règle absolue : défaut = rien de coché. Le pilote construit son partage activement.

### 4.3 — Progression d'un ami (consultation)
- Rôle : voir ce qu'un ami a CHOISI de partager — ni plus, ni moins.
- Données : lecture `app_progression_shares` filtrée (non révoqué, non expiré, scope ok) ;
  incrémente view_count / last_viewed_at (traçabilité pour l'émetteur).
- Tracé : tracé partagé en lecture, LIMITÉ aux métriques incluses. Les couches non
  partagées n'existent pas pour le spectateur.
- Garde : révocation ou expiration → écran « partage terminé », plus aucune donnée.

### 4.4 — Mes partages actifs (droit d'accès & retrait)
- Rôle : transparence — le pilote voit tous ses partages, qui les a vus, et révoque.
- Données : `app_progression_shares` de l'utilisateur (view_count, last_viewed_at).
- C'est l'écran qui matérialise les droits RGPD (accès, retrait, effacement).

### 4.5 — Inviter à un roulage (priorité 2)
- Rôle : convier un ami à un roulage existant.
- Données : `roulage_invitations` (lié à `coach_roulages` de la fiche 06).
- Garde : on n'invite qu'un ami (`accepted`), pas n'importe qui.

### 4.6 — Fil événements / lieux (priorité tardive, proche Carte)
- Rôle : `social_pings` publiés. À traiter probablement DANS la future page Carte,
  pas dans le cœur social. Géolocalisation + email = cadrage spécifique (consentement
  de publication, modération de `is_published`).

---

## 5. RÉSERVES STRUCTURELLES (à ne pas masquer)

1. **Tables vides** : développement sur seed de démonstration marqué comme tel.
2. **RLS = la vraie barrière** : toutes les gardes (consentement, scope, expiration,
   révocation, amitié acceptée) doivent être au niveau Postgres RLS, PAS seulement
   dans l'app. Une faille RLS = fuite de données personnelles. À écrire et tester
   politique par politique.
3. **`social_pings` n'est pas vraiment du social** : lat/lon/email/événements relèvent
   de la Carte. Ne pas le forcer dans le cœur amis/partage — risque de mélanger deux
   régimes de données (perso vs lieux publics).
4. **Validation juridique bloquante** : ne RIEN exposer entre pilotes avant que le
   mécanisme de consentement + la politique de confidentialité soient validés par
   l'avocat. Le social touche à la donnée personnelle de tiers — c'est le périmètre
   le plus exposé de l'app.
5. **Pas de classement par défaut** : la doctrine Mirror + la décision fondateur
   interdisent un leaderboard imposé. Toute comparaison reste un choix actif du pilote
   sur ce qu'il expose.

---

## 6. ORDRE DE TRAVAIL RECOMMANDÉ

1. Définir les énumérations (`pilot_friendships.status`, `share_scope`) + écrire les
   politiques RLS de consentement/scope/expiration. Validation fondateur + AVOCAT
   avant tout code d'exposition.
2. Écran 4.1 (amis) — graphe social, pas encore de données de perf.
3. Écran 4.2 (partager ma progression) — le cœur : liste blanche métrique par métrique.
4. Écran 4.3 (voir un ami) + 4.4 (mes partages actifs / droits RGPD) ensemble.
5. Écran 4.5 (invitations roulage), lié à la fiche 06.
6. `social_pings` / fil lieux : reporté à la conception de la page Carte.

Chaque étape validée par le fondateur avant la suivante. Pas de refactor spéculatif.
Architecture mono-repo Expo préservée.
