# MVP — Place de marché coaching OXV

> Document de SPÉCIFICATION. **Aucun code, aucun schéma appliqué, aucune migration.**
> Le SQL présenté est **indicatif** et **NON APPLIQUÉ** : il sert de proposition à
> arbitrer par Gabin, pas d'instruction d'exécution.
>
> À lire avec : `00_CLAUDE.md` (doctrine), `06_espace_coach.md` et `specs/C0_coach.md`
> (espace coach existant), `docs/architecture/05_SCHEMA_SUPABASE_ACTUEL.md` et
> `docs/architecture/06_RLS_POLICIES_ACTUELLES.sql` (schéma + RLS de production).
>
> ⚠️ **Vérifié en base** (`src/types/database.types.ts`, généré depuis le projet
> `fouvuqkdxarjpjbqnsjq`) : les tables `coach_profiles`, `coach_pilots`,
> `coach_roulages` et les enums `affiliation_status` / `affiliation_initiator`
> **EXISTENT DÉJÀ**. Ce MVP ne les recrée pas : il s'appuie dessus et n'ajoute que
> ce qui manque réellement.

---

## 1. Vision et cadrage doctrine

### 1.1 — Le produit en une phrase
Permettre à un pilote OXV de **trouver un coach, consulter sa fiche, demander un
créneau, obtenir une confirmation**, puis vivre la séance et son débrief présentiel
(déjà existant) — le tout dans un cadre sobre, premium et conforme à la doctrine.

### 1.2 — Pourquoi c'est compatible OXV
La doctrine « l'app est un miroir, elle ne vous dirige pas » encadre **l'app côté
restitution de pilotage** : aucune machine ne prescrit, aucun score, aucun verdict
algorithmique. Elle **n'interdit pas un service de coaching HUMAIN.** Le coach est
un **rôle réel d'OXV** : l'espace coach (`app/(coach)/*`) et le débrief présentiel
(`app/(app)/debrief-presentiel.tsx`) existent déjà, et la position doctrinale est
posée dans `specs/C0_coach.md` :

> « Quand un coach écrit un débrief ou enrichit la donnée, **c'est le coach qui
> parle, pas l'app.** Tout contenu produit par un coach est visuellement attribué au
> coach, jamais présenté comme une sortie OXV. »

La place de marché ne change pas cette frontière. Elle ajoute un **canal de mise en
relation** entre un pilote et un coach. La parole prescriptive reste celle d'un
humain identifié et choisi ; l'app reste un miroir factuel côté données.

### 1.3 — Ce que ce MVP n'est PAS (garde-fous premium)
- **Pas un bazar gig-economy.** Pas de surenchère de badges, pas de « 3 coachs
  regardent ce créneau », pas de compte à rebours anxiogène, pas de notation
  publique agressive façon plateforme de VTC.
- **Pas de classement de coachs.** On peut lister et filtrer sobrement (circuit,
  spécialité), mais aucun rang « meilleur coach », aucune mise en avant payante
  bruyante. La ligne rouge `00_CLAUDE.md` (« aucun classement hiérarchisé ») vise le
  **pilotage** ; on l'étend par cohérence de marque au classement de personnes.
- **Avis sobres possibles, en Phase 2 seulement**, et encadrés (voir §6 et §7).

### 1.4 — Articulation avec l'espace coach existant (point important)
Le bundle actuel (`specs/C0_coach.md`) décrit une relation **opt-in et révocable où
le pilote invite SON coach** — « aucune découverte d'autres pilotes, aucun annuaire
global ». La place de marché introduit, côté pilote, une **découverte de coachs**
(parcourir des fiches). Ce n'est **pas** un annuaire de pilotes (la règle « pas
d'annuaire de pilotes » reste intacte) : c'est un annuaire de **coachs qui ont
choisi de se rendre visibles** (`coach_profiles.is_published = true`).

C'est néanmoins une **évolution de cadrage** par rapport à C0.1 (« inviter un coach »
devient « parcourir puis demander un coach »). **→ arbitrage Gabin requis** (§5, §6).

---

## 2. MVP en deux phases

Découpage volontaire : livrer vite une mise en relation **sans paiement** (zéro
complexité juridique/PSP), valider l'usage réel, puis ajouter le paiement.

### Phase 1 — Mise en relation, SANS paiement
**Objectif : livrer vite, valider l'usage, zéro complexité paiement/juridique.**

Périmètre :
1. **Fiche coach publique** : bio, palmarès, circuits couverts, spécialités, tarif
   **indicatif** (affiché, non transactionnel), photo, liens (site, réseaux).
   → s'appuie sur `coach_profiles` (existant).
2. **Disponibilités** : le coach déclare des créneaux ouverts (date, circuit, place).
   → table **nouvelle** `coach_availability` (n'existe pas).
3. **Demande de réservation / mise en relation** : le pilote demande un créneau ou
   une prise de contact ; le coach **confirme ou décline**.
   → table **nouvelle** `coaching_bookings` (n'existe pas), articulée avec l'affiliation
   `coach_pilots` existante (consentement).
4. **Confirmation par le coach** : passage d'état `pending → confirmed`/`declined`.
   Aucun flux d'argent dans l'app : le règlement éventuel se fait hors app (de gré à
   gré), comme aujourd'hui pour le débrief présentiel.

Hors périmètre Phase 1 : paiement, commission, facturation, avis.

### Phase 2 — Paiement + commission + avis
Une fois l'usage validé :
1. **Paiement intégré** via **Stripe Connect** (sous réserve §5) : le pilote paie la
   séance dans l'app, **OXV prélève une commission de X %**, le reste est **reversé au
   coach** (compte connecté Stripe).
2. **Cycle de vie transactionnel** sur `coaching_bookings` : `confirmed → paid →
   completed` (+ `refunded`/`cancelled`).
3. **Avis post-séance** : le pilote peut laisser un avis **sobre** (texte court +
   note basse résolution), visible sur la fiche coach selon une règle à définir (§6).
   → table **nouvelle** `coach_reviews`.

> Phase 2 fait basculer OXV de « mise en relation » à « intermédiaire de paiement ».
> C'est un changement de **nature juridique** (CGV de transaction, statut
> d'intermédiaire, fiscalité du reversement). **→ décisions Gabin + juriste (§5, §6).**

---

## 3. Parcours pilote (bout en bout)

Parcours cible, en réutilisant les composants du bundle (`[Composant: …]` défini dans
`01_doctrine_et_composants.md`) :

1. **Parcourir** — Liste des coachs publiés.
   - `[Composant: AppBar]` « Coachs ».
   - Filtres sobres : circuit, spécialité. Tri neutre (ex. alphabétique ou récence),
     **jamais** « les mieux notés » mis en avant par défaut.
   - Carte coach : photo, nom, headline, circuits, spécialités, tarif indicatif.
   - Source : `coach_profiles` où `is_published = true`.

2. **Fiche coach** — Détail d'un coach.
   - Bio, palmarès, circuits, spécialités, médias, liens, tarif indicatif.
   - `[Composant: ConsentGate]` rappelant ce que le coach pourra voir s'il devient
     votre coach (sessions, données), et la **révocabilité**.
   - Action principale : « Demander un créneau » / « Demander une mise en relation ».
   - Source : `coach_profiles` + `coach_availability` (créneaux ouverts à venir).

3. **Demande de créneau** — Le pilote choisit un créneau (ou une prise de contact
   libre) et envoie sa demande.
   - Crée une ligne `coaching_bookings` en état `pending`.
   - Si aucune affiliation `coach_pilots` active n'existe, la demande **vaut intention
     de partage** : le consentement pilote (`coach_pilots.pilot_consent_at`) est posé
     à l'acceptation, pas avant (voir §4 RGPD).
   - `[Composant: PactBanner]` au premier contact (rappel sobre de la doctrine).

4. **Confirmation** — Le coach reçoit la demande dans son espace, **confirme ou
   décline**.
   - `pending → confirmed` (ou `declined`).
   - À la confirmation : l'affiliation `coach_pilots` est activée/consentie des deux
     côtés (le périmètre d'accès du coach s'ouvre **seulement maintenant**).

5. **Séance** — Elle a lieu (sur circuit). L'app dort en piste (doctrine « silence en
   piste » inchangée).

6. **Débrief présentiel** — Écran **déjà existant** (`debrief-presentiel.tsx`,
   `DebriefMirror`) : faits côté pilote, section coach attribuée (liseré cuivre).
   Aucune modification requise par ce MVP — on s'y raccorde.

7. **Avis (Phase 2 uniquement)** — Après une séance `completed`, le pilote peut
   déposer un avis sobre. Lecture sur la fiche coach selon règle §6.

> **Côté paiement (Phase 2)** : l'étape 4 se prolonge en `confirmed → paid` (le pilote
> règle dans l'app, Stripe Connect répartit), puis `paid → completed` après la séance.

---

## 4. RGPD et consentement (rappel — point dur hérité)

`specs/C0_coach.md` et `06_espace_coach.md` posent déjà la règle, **inchangée** ici :

- Un coach **ne voit les données d'un pilote** que si l'affiliation `coach_pilots`
  est `active = true` **ET** `pilot_consent_at` est renseigné. Filtre **RLS + requête**,
  jamais l'UI seule.
- Une **demande de réservation** (`coaching_bookings.pending`) **n'ouvre aucun accès
  aux données** du pilote. L'accès ne s'ouvre qu'à la **confirmation** (consentement
  posé à ce moment).
- Le pilote **révoque** quand il veut (`coach_pilots.active = false`) → l'accès se
  ferme immédiatement.
- La fiche coach publique (`coach_profiles`) ne contient **aucune donnée pilote** :
  pas de risque RGPD côté découverte.

---

## 5. Décisions requises de Gabin (liste nette)

Rien n'avance côté implémentation tant que ces points ne sont pas tranchés :

1. **Cadrage produit / doctrine** : valide-t-on le passage de « le pilote invite son
   coach » (C0.1) à « le pilote **parcourt** des coachs puis demande » ? (Évolution de
   `specs/C0_coach.md` à acter.)
2. **Provider de paiement (Phase 2)** : **Stripe Connect** confirmé ? (Stripe est déjà
   utilisé côté plateforme — table `payments`, `stripe_customer_id` sur `users`.)
   Quel modèle Connect (Express ? Standard ?) pour les coachs ?
3. **Commission** : quel **% OXV** sur chaque séance payée ? Fixe ou variable selon
   l'offre ? Y a-t-il un minimum/plafond ?
4. **Validation du schéma** : approuves-tu les **3 tables nouvelles** proposées
   (`coach_availability`, `coaching_bookings`, `coach_reviews`) et le fait de **réutiliser
   `coach_profiles` / `coach_pilots` existantes** ? (Détail §8.)
5. **Juridique — CGV de transaction (Phase 2)** : qui rédige les CGV de la place de
   marché (statut d'intermédiaire, responsabilité, remboursement, litiges) ? Faut-il
   les soumettre au juriste comme le Pacte / la politique RGPD ?
6. **Périmètre exact du MVP** : livre-t-on **Phase 1 seule** d'abord (mise en relation
   sans paiement), puis Phase 2 ? Ou faut-il Phase 2 dès le départ ?
7. **Unité monétaire (à trancher avant toute migration)** : la base mélange deux
   conventions — `coach_profiles.season_price_eur` / `coach_pilots.affiliation_price_eur`
   semblent en **euros**, alors que le code app alimente `coach_roulages.price_per_pilot`
   en **centimes** (`Math.round(€ * 100)`, cf. `app/(coach)/roulages/nouveau.tsx`).
   Quelle unité pour les **nouveaux** champs prix ? (Recommandation : **centimes
   entiers** partout, cohérent avec Stripe et le reste de la base.)
8. **Agrément des coachs** : qui peut publier une fiche (`is_published`) ? Validation
   manuelle OXV (admin) avant mise en ligne, ou auto-publication par le coach ?

---

## 6. Points doctrine / juridique signalés pour arbitrage

- **Découverte de coachs vs « pas d'annuaire »** : la règle « pas d'annuaire global »
  visait les **pilotes**. Un annuaire de **coachs volontairement publiés** ne la viole
  pas, mais **contredit la lettre de C0.1** (« inviter un coach »). → arbitrage (§5.1).
- **Avis publics (Phase 2)** : la doctrine bannit « classement hiérarchisé » et
  « note de niveau » **pour le pilotage**. Un avis de coach est d'une autre nature
  (service humain), mais reste sensible côté ton premium. Options à arbitrer :
  - (a) **Pas d'avis du tout** (le plus sobre, le plus sûr juridiquement).
  - (b) **Avis texte modérés, sans note chiffrée** (sobre, premium).
  - (c) **Avis + note basse résolution** (ex. 1–5), **sans tri par défaut sur la note**
    et sans « top coachs ». À ne faire qu'avec modération et droit de réponse.
  Recommandation doctrine : (a) ou (b) au lancement.
- **OXV intermédiaire de paiement (Phase 2)** : prélever une commission fait d'OXV un
  intermédiaire transactionnel → **CGV dédiées, mentions, fiscalité du reversement,
  gestion des litiges/remboursements**. Point juridique central, à cadrer avec le
  juriste (même circuit que Pacte / RGPD). Tant que non cadré : **Phase 1 sans
  paiement** reste la voie sûre.
- **Responsabilité pédagogique** : inchangée — le conseil appartient au **coach
  agréé**, OXV fournit le canal et la donnée factuelle (`00_CLAUDE.md` §1, raison
  juridique). La place de marché ne doit jamais laisser entendre qu'OXV **recommande**
  un coach plutôt qu'un autre.

---

## 7. SCHÉMA PROPOSÉ — **PROPOSITION — NON APPLIQUÉ**

> ⚠️ **PROPOSITION — NON APPLIQUÉ.** SQL **indicatif**. Aucune migration n'est créée
> ni exécutée par ce document. Ne **jamais** toucher aux tables existantes : on
> **réutilise** `coach_profiles`, `coach_pilots`, `coach_roulages` (déjà en prod) et on
> **ajoute uniquement** les tables nouvelles ci-dessous. FK vers `public.users` (table
> réelle des comptes ; le rôle coach vit sur `users`, pas sur une table `profiles`).

### 7.0 — Tables EXISTANTES réutilisées (NE PAS recréer)

| Table existante | Rôle dans le MVP | Colonnes clés déjà présentes |
|---|---|---|
| `coach_profiles` | **Fiche coach** (parcours, fiche détail) | `coach_id` (PK, FK users, unique), `bio`, `headline`, `palmares`, `circuits text[]`, `specialties text[]`, `season_price_eur`, `photo_url`, `media jsonb`, `socials jsonb`, `website_url`, `instagram_url`, `youtube_url`, `is_published bool` |
| `coach_pilots` | **Affiliation + consentement** (le lien durable pilote↔coach) | `coach_id`, `pilot_id`, `status` (`pending\|active\|declined\|ended`), `initiated_by` (`coach\|pilot`), `pilot_consent_at`, `coach_consent_at`, `affiliation_price_eur`, `active` |
| `coach_roulages` | Événements/roulages d'un coach (déjà géré côté app) | `coach_id`, `title`, `circuit_name`, `starts_at`, `ends_at`, `max_pilots`, `price_per_pilot`, `status`, `location` |

Enums existants réutilisés : `affiliation_status`, `affiliation_initiator`.

### 7.1 — `coach_availability` (NOUVELLE) — disponibilités/créneaux

```sql
-- PROPOSITION — NON APPLIQUÉ
CREATE TABLE public.coach_availability (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  circuit_name    text,                 -- libre, ou FK circuits(id) si on relie au tracé
  circuit_id      uuid REFERENCES public.circuits(id),
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz,
  capacity        int4 NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  price_cents     int4 CHECK (price_cents >= 0),   -- centimes (cf. décision §5.7)
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','full','closed','cancelled')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.coach_availability (coach_id, starts_at);
```
**Notes RLS** :
- SELECT public **limité** : un créneau n'est visible que si la fiche du coach est
  publiée (`EXISTS (SELECT 1 FROM coach_profiles p WHERE p.coach_id = coach_availability.coach_id AND p.is_published)`)
  et `status IN ('open','full')`. Sinon, visible **au coach propriétaire** uniquement.
- INSERT/UPDATE/DELETE : **coach propriétaire** (`coach_id = auth.uid()`) **ou** `is_admin()`.

### 7.2 — `coaching_bookings` (NOUVELLE) — demande de réservation / mise en relation

```sql
-- PROPOSITION — NON APPLIQUÉ
CREATE TABLE public.coaching_bookings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  coach_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  availability_id   uuid REFERENCES public.coach_availability(id) ON DELETE SET NULL,
  -- Lien optionnel vers l'affiliation durable (consentement RGPD)
  affiliation_id    uuid REFERENCES public.coach_pilots(id) ON DELETE SET NULL,

  requested_starts_at timestamptz,       -- créneau souhaité (si pas de availability_id)
  message           text,                -- mot du pilote à la demande
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN (
                        'pending',       -- demande envoyée
                        'confirmed',     -- coach a accepté (Phase 1 s'arrête ici)
                        'declined',      -- coach a refusé
                        'cancelled',     -- annulée (pilote ou coach)
                        'paid',          -- Phase 2 — réglée via Stripe
                        'completed',     -- séance faite
                        'refunded'       -- Phase 2 — remboursée
                      )),

  -- Montants (Phase 2) — centimes entiers (cf. §5.7)
  price_cents       int4 CHECK (price_cents >= 0),
  commission_cents  int4 CHECK (commission_cents >= 0),   -- part OXV
  currency          text NOT NULL DEFAULT 'eur',

  -- Références Stripe (Phase 2) — pas de secret, juste des identifiants
  stripe_payment_intent_id text,
  stripe_transfer_id       text,

  confirmed_at      timestamptz,
  cancelled_at      timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.coaching_bookings (coach_id, status);
CREATE INDEX ON public.coaching_bookings (pilot_id, status);
```
**Notes RLS** :
- SELECT : **le pilote concerné** (`pilot_id = auth.uid()`) **ou** **le coach concerné**
  (`coach_id = auth.uid()`) **ou** `is_admin()`.
- INSERT : **le pilote** crée sa propre demande (`pilot_id = auth.uid()`, `status='pending'`).
- UPDATE : **le coach** peut passer `pending → confirmed/declined` ; **pilote et coach**
  peuvent `→ cancelled` selon règles ; transitions `paid/refunded` réservées au
  **backend** (Edge Function / webhook Stripe, `service_role`), jamais au client.
- Les colonnes `price_cents`/`commission_cents`/`stripe_*` ne doivent **pas** être
  écrites par le client (calcul et écriture côté serveur en Phase 2).

### 7.3 — `coach_reviews` (NOUVELLE, Phase 2) — avis post-séance

```sql
-- PROPOSITION — NON APPLIQUÉ  (Phase 2 seulement, et sous réserve d'arbitrage §6)
CREATE TABLE public.coach_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid NOT NULL REFERENCES public.coaching_bookings(id) ON DELETE CASCADE,
  coach_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pilot_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating        int2 CHECK (rating BETWEEN 1 AND 5),  -- optionnel selon option §6
  body          text,
  is_published  boolean NOT NULL DEFAULT false,       -- modération avant affichage
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id)                                  -- un avis par séance
);
```
**Notes RLS** :
- INSERT : **le pilote** d'une séance `completed` uniquement (`pilot_id = auth.uid()`
  ET la réservation liée est `completed`).
- SELECT public : seulement `is_published = true` (modération préalable) ; sinon
  visible à l'auteur, au coach concerné et à l'admin.
- UPDATE `is_published` : **admin** (modération) ; le coach peut éventuellement avoir
  un **droit de réponse** (table séparée non spécifiée ici, à décider en §6).
- **Cette table n'est créée que si l'option (b)/(c) du §6 est retenue.**

### 7.4 — Articulation avec les rôles existants
- Le **rôle coach** est porté par `users` (le guard `app/(coach)/_layout.tsx` teste
  `profile.role === 'coach'`). Les FK `coach_id` pointent vers `users(id)`.
- La **fiche** (`coach_profiles`) et l'**affiliation** (`coach_pilots`) existent déjà :
  la place de marché les **branche ensemble** via les 3 tables nouvelles, sans rien
  modifier de l'existant.
- Pattern RLS repris de la prod : `auth.uid() = <owner_id> OR is_admin()`, et
  `is_admin()` (SECURITY DEFINER) déjà en place — **ne pas la redéfinir**.

---

## 8. Récapitulatif de ce qui est nouveau vs existant

| Élément | État | Action MVP |
|---|---|---|
| Fiche coach (`coach_profiles`) | **Existe** (vide) | Réutiliser, brancher l'écran « parcourir » + « fiche » |
| Affiliation + consentement (`coach_pilots`) | **Existe** (vide) | Réutiliser pour le consentement RGPD à la confirmation |
| Roulages (`coach_roulages`) | **Existe** | Inchangé (déjà géré) |
| Enums `affiliation_status/initiator` | **Existe** | Réutiliser |
| Disponibilités (`coach_availability`) | **N'existe pas** | **Proposer** (Phase 1) |
| Réservations (`coaching_bookings`) | **N'existe pas** | **Proposer** (Phase 1, étendue Phase 2) |
| Avis (`coach_reviews`) | **N'existe pas** | **Proposer** (Phase 2, sous arbitrage) |
| Paiement (Stripe Connect) | Stripe déjà côté plateforme | **Phase 2**, après décisions §5 |

---

STOP — rien n'est codé ni le schéma touché tant que Gabin n'a pas validé.
