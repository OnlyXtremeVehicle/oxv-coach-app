# Cadre juridique coach & data

> Document de cadrage. À lire après `00_PLATEFORME_OXV.md` et avant toute PR touchant
> au coaching, au partage de données ou à l'espace Club.
> **Ce document ne rédige PAS le texte légal final.** Il cadre ce qui doit y figurer,
> où l'intégrer, et comment l'app doit le refléter sans le trahir.
> Sources juridiques existantes : `docs/juridique/01_PACTE_DE_PILOTAGE.md`,
> `02_CGU_APP_OXV_MIRROR.md`, `04_POLITIQUE_CONFIDENTIALITE.md`, `06_PACTE_DE_COACHING.md`.
> Source technique (réalité du code) : `coach_pilots`, `is_coach_of()`, `log_coach_view()`,
> `coach_annotations` (cf. §0).

---

## 0. Ce que le code fait déjà (ne pas réinventer)

Le cadre juridique doit décrire **la réalité technique en place**, pas un idéal théorique.
Tout écart entre ce que dit le légal et ce que fait le code est un risque. État au cadrage :

| Élément réel | Où | Comportement |
|---|---|---|
| Table `coach_pilots` | `supabase/migrations/20260525114148_coach_pilots_table_and_rls.sql` | Assignation coach↔pilote. Colonnes : `active`, `pilot_consent_at`, `coach_consent_at`, `initiated_by`, `status`, `affiliation_price_eur`, `notes`. Contraintes : `UNIQUE(coach_id,pilot_id)`, `CHECK(coach_id<>pilot_id)`. |
| Gardien d'accès | fonction `is_coach_of(pilot_uuid)` | Renvoie `true` **uniquement** si `active=true` **ET** `pilot_consent_at IS NOT NULL`. C'est le seul verrou data. |
| Consentement pilote | `src/services/pilotConsentService.ts` | `giveConsent()` pose `pilot_consent_at` ; `revokeConsent()` le remet à `null` → le coach **cesse immédiatement** de voir les données. |
| Enums | `affiliation_status` = `pending · active · declined · ended` ; `affiliation_initiator` = `coach · pilot` | `database.types.ts` (≈ l.5313). |
| Tables que le coach peut LIRE (RLS `is_coach_of`) | migration ci-dessus | `telemetry_sessions`, `telemetry_frames`, `laps`, `app_session_analyses`, `app_segment_analyses`, `vehicles`, `app_progression_shares`. **Lecture seule.** |
| Ce que le coach NE voit JAMAIS | RLS + vue `coach_pilots_view` | email, téléphone, `documents` (RGPD), `payments`, `registrations` (commercial OXV). La vue n'expose que prénom/nom/`pilot_level`/avatar. |
| Annotations coach | table `coach_annotations` | `body`, `corner_index`, `lap_index`, `marker_s_norm`, `audio_url`, `visibility`, `deleted_at`. C'est le seul espace où le coach écrit. |
| Journalisation des accès | fonction `log_coach_view()` | Logge chaque consultation coach dans `admin_audit`, après re-vérification de l'autorisation. No-op silencieux si non autorisé. |
| Permissions UI coach | `src/services/coachPermissionsService.ts` | Flags `canViewPilots / canManageOwnSessions / canViewBusinessDashboard`. **Ne portent PAS la sécurité data** (c'est `is_coach_of`), seulement l'accès aux fonctionnalités. |

**Conséquence majeure** : aujourd'hui l'accès coach est **binaire** (rien / lecture complète des tables ci-dessus).
La granularité décrite en §2 (« niveaux d'accès ») est une **proposition produit** qui n'existe pas en base.
Elle est marquée explicitement **« nécessite accord Gabin + schéma à soumettre »**. Tant qu'elle n'est pas validée,
le cadre légal décrit le modèle binaire réel.

---

## 1. Principes — ce que le légal doit graver

Sept principes. Chacun doit se retrouver **à la fois** dans un document juridique **et** dans le comportement de l'app.

### 1.1 Le coach voit la data UNIQUEMENT avec accord du pilote
Aucune donnée de session, d'analyse ou de progression n'est visible par un coach sans `pilot_consent_at` posé.
C'est déjà la règle technique (`is_coach_of`). Le légal doit énoncer que ce consentement est **préalable, libre, spécifique et informé**.
- Où c'est déjà dit : `06_PACTE_DE_COACHING.md` Art. 1 (« pilotes qui ont explicitement consenti »).
- À renforcer : la Politique de confidentialité doit nommer le coach comme **destinataire** des catégories de données listées en §0, et seulement celles-là.

### 1.2 Le pilote peut retirer l'accès à tout moment, sans justification
La révocation est un droit, pas une faveur. Effet **immédiat** : `revokeConsent()` remet `pilot_consent_at` à `null`,
le coach ne voit plus rien. L'app **n'insiste pas, ne moralise pas, ne demande pas de motif** (cf. en-tête `pilotConsentService.ts`).
- Le légal doit garantir : retrait à tout moment, effet immédiat, aucune pénalité, aucune conservation d'accès résiduel.
- L'assignation peut rester en base (`active`) mais **sans visibilité** tant que le consentement n'est pas re-donné.

### 1.3 Les annotations du coach ne sont PAS des instructions en piste
Une note de coach (`coach_annotations`) est une **lecture a posteriori**, lue aux stands ou après l'événement — **jamais pendant le roulage**.
Elle ne dicte pas un geste de pilotage. Doctrine OXV : l'app montre, ne dirige pas.
- La bande coach (rouge `#C8102E`, cf. `04_DESIGN_CANON §4`) est le **seul** espace où un ton interrogatif/prescriptif est toléré,
  et encore : question ouverte (« était-ce volontaire ? »), pas un ordre.
- Le légal doit poser : une annotation est un **avis personnel d'un observateur tiers**, pas une consigne, pas une garantie de résultat,
  pas un acte de formation (cf. `06_PACTE_DE_COACHING.md` Art. 2).
- Renforce le **silence en piste** : aucune note ne s'affiche tant que le véhicule roule (cf. §3 des journeys et doctrine Session).

### 1.4 L'app ne remplace pas un briefing sécurité
La lecture de data et les notes coach ne se substituent **en aucun cas** au briefing sécurité de l'événement,
aux consignes du circuit, ni au jugement du pilote en piste.
- Déjà cadré par `01_PACTE_DE_PILOTAGE.md` et les CGU. À répéter explicitement dans le **Contrat de lecture coach** (cf. §3).
- Texte d'esprit : « Ce que vous lisez ici éclaire votre pratique passée. Il ne vous dispense d'aucune règle de sécurité présente. »

### 1.5 La data ne certifie pas une compétence
Une marge, une vitesse, une régularité **ne valent pas** brevet, niveau homologué, ni attestation d'aptitude.
- Le légal doit refuser explicitement toute valeur certificative : ni le pilote ni le coach ne peuvent présenter une donnée OXV
  comme preuve de compétence opposable (assurance, employeur, organisateur tiers).
- Cohérent avec `06_PACTE_DE_COACHING.md` Art. 2 (« pas un instructeur diplômé au sens du Code du sport »).

### 1.6 Comparaisons entre pilotes = consentement explicite et distinct
Comparer deux pilotes (côte-à-côte, classement, partage) exige le consentement **des deux**, et ce consentement est
**distinct** du consentement de coaching (§1.1).
- Réalité code : `app/(app)/cote-a-cote/[friendId]` et les `pilot_friendships` (migration `..._0027_pilot_friendships.sql`) encadrent
  déjà la comparaison entre amis ; côté coach, `app/(coach)/comparer-pilotes` doit être gated par un consentement explicite des pilotes comparés.
- Doctrine Progression : **aucun classement, aucun leaderboard, aucune comparaison non consentie** (`01_ORGANISATION_PRODUIT §Progression`).
- Le légal doit traiter la comparaison comme un traitement **séparé**, opt-in, révocable, jamais public par défaut.

### 1.7 Responsabilité — qui répond de quoi
À cadrer noir sur blanc (le détail revient à l'avocat, cf. `00_SYNTHESE_JURIDIQUE_BRIEF_AVOCAT.md`) :

| Acteur | Répond de | Ne répond pas de |
|---|---|---|
| Pilote | Sa conduite en piste, ses décisions, le respect des consignes | L'exactitude des calculs OXV |
| Coach | Ses propres annotations et avis (observateur tiers) | La sécurité de l'événement, l'organisation, la facturation |
| OXV | La plateforme, la sécurité des données, la qualité raisonnable des calculs | Les décisions de pilotage, les conseils personnels du coach |

OXV n'est ni employeur ni mandataire du coach (`06_PACTE_DE_COACHING.md` Art. 2), et le coach renvoie vers OXV
pour tout sujet sécurité/organisation/facturation (Art. 4.3).

---

## 2. Niveaux d'accès coach — proposition (NÉCESSITE ACCORD)

> **Statut : à soumettre à Gabin. N'existe PAS en base aujourd'hui** (accès binaire — cf. §0).
> Introduire ces niveaux = **changement de schéma `coach_pilots`** (ajout d'une colonne type `access_level`)
> + adaptation de `is_coach_of()` et des RLS. **Ne jamais présenter comme acquis.**

L'idée : permettre au pilote de doser ce que son coach voit, au lieu du tout-ou-rien actuel.

| Niveau proposé | Le coach voit | Le coach peut | Mappe sur le réel |
|---|---|---|---|
| **Aucun** | Rien | Rien | `pilot_consent_at IS NULL` (état actuel par défaut) |
| **Lecture simple** | Bilan synthétique (marge globale, 2 constats) | Lire | sous-ensemble de `app_session_analyses` |
| **Lecture détaillée** | Data Lab complet (carte, virages, tours, segments) | Lire + annoter | `telemetry_*`, `laps`, `app_segment_analyses`, écrire `coach_annotations` |
| **Programme** | Lecture détaillée + cycles/objectifs (V1.5) | Proposer cycles | tables Développement à créer (V1.5) |
| **Événement** | Accès temporaire borné à un événement précis | Lire pendant l'événement | nécessite une borne temporelle sur `coach_pilots` |

Points à arbitrer avec Gabin **avant** toute migration :
1. Niveau **par défaut** à la création d'une affiliation (recommandation doctrinale : `aucun`, le pilote ouvre activement).
2. Le niveau **Événement** implique une **expiration** (`access_until`) — colonne nouvelle, à valider.
3. Rétrocompatibilité : les affiliations existantes (consenties aujourd'hui) basculent sur quel niveau ? (proposition : `lecture détaillée`).
4. Impact sur `coach_pilots_view` et sur les 7 RLS `is_coach_of` (toutes deviennent paramétrées par le niveau).

Tant que non validé, **le modèle binaire de §0 fait foi** et le légal décrit ce modèle.

---

## 3. Où intégrer — cartographie légal ↔ produit

Quatre documents portent ce cadre. Chacun a un rôle distinct ; aucune redite contradictoire entre eux.

| Document | Couvre | Ce qu'il doit (ré)affirmer ici |
|---|---|---|
| **CGU** (`02_CGU_APP_OXV_MIRROR.md`) | Cadre d'usage de l'app | Statut « miroir, pas coach » ; data non certificative (§1.5) ; pas de substitution au briefing sécurité (§1.4) ; responsabilité plateforme vs pilote (§1.7). |
| **Politique de confidentialité** (`04_POLITIQUE_CONFIDENTIALITE.md`) | Données personnelles, RGPD | Coach comme **destinataire** des catégories §0 et seulement celles-là ; base légale = **consentement** ; droit de retrait immédiat (§1.2) ; comparaison inter-pilotes = traitement distinct opt-in (§1.6) ; journalisation `log_coach_view` consultable par le pilote (cf. `06` Art. 5.4). |
| **Contrat / Pacte de lecture coach** (`06_PACTE_DE_COACHING.md`) | Engagement du coach | Lecture seule (Art. 1) ; observateur tiers, pas instructeur (Art. 2) ; confidentialité, respect du retrait, non-incitation au dépassement (Art. 4) ; annotations = avis, pas instruction (§1.3) ; renvoi vers OXV pour sécurité/orga/facturation. |
| **Pacte de pilotage** (`01_PACTE_DE_PILOTAGE.md`) | Doctrine pilote | Le pilote reste seul décideur en piste ; les notes coach éclairent, ne dirigent pas (§1.3) ; la marge prime sur la performance, y compris dans la relation coach. |

### Reflets UI obligatoires (le légal sans l'app ne suffit pas)
- **Écran de consentement coach** (Club → mon-coach) : libellé clair de ce que le coach verra, bouton de retrait toujours accessible,
  aucune formulation culpabilisante. Vouvoiement, pas d'emoji.
- **Centre confidentialité & données** (`app/(app)/donnees-securite`) : exposer l'historique des accès coach (`log_coach_view`) et le toggle de consentement.
- **Bande coach** dans le Bilan : rouge `#C8102E`, eyebrow « DE VOTRE COACH », jamais affichée en piste, jamais un ordre.
- **Comparaisons** : tout écran côte-à-côte/comparer-pilotes affiche l'état de consentement et le retire à la révocation.

---

## 4. Points ouverts à trancher avec Gabin

| # | Question | Pourquoi ça bloque |
|---|---|---|
| 1 | Adopte-t-on les niveaux d'accès §2 ? Si oui, schéma `coach_pilots` à modifier. | Toute granularité = migration + RLS à revalider. Sans accord, on reste binaire. |
| 2 | Le `coach_consent_at` existant joue-t-il un rôle légal (double consentement coach+pilote) ou est-ce purement opérationnel ? | Présent en base mais non documenté côté juridique ; à clarifier dans le Pacte de coaching. |
| 3 | Durée de conservation des annotations coach après révocation / fin d'affiliation (`ended`). | `06` Art. 7 dit « confidentialité indéfinie » mais ne fixe pas la conservation des `coach_annotations`. |
| 4 | Renommage doctrinal « OXV Mirror » → « OXV Platform » dans les docs juridiques. | Les 4 docs portent « OXV Mirror » ; cohérence à acter (hors périmètre de ce cadrage). |
| 5 | Le niveau « Événement » nécessite-t-il une borne temporelle en base (`access_until`) ? | Sinon le niveau est ingérable techniquement. |

---

## 5. Garde-fous (rappels non négociables)

- **Aucune** modification de schéma Supabase sans accord explicite de Gabin (cf. `00 §6`). Le §2 est une proposition, pas une décision.
- Le légal **décrit le code réel** ; tout écart est un bug de conformité à corriger côté app, pas à masquer côté texte.
- Doctrine : l'app montre, ne dirige pas. Côté pilote, aucun verbe prescriptif. Or = donnée. Rouge = coach/REC. Silence total en piste.
- Vouvoiement systématique, aucun emoji, dans l'app comme dans les écrans de consentement.
