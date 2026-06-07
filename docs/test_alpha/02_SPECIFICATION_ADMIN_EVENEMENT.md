# Spécification technique — Ajout "Événement personnalisé" à l'admin OXV

**Modifications à apporter à `index.html` et à la base de données Supabase**
**Pour permettre la création d'événements test (Balade Découverte) et autres formats non-circuit-récurrents**
**Version 1.0 — Mai 2026**

---

## Préambule

Cette spécification décrit les ajouts à apporter à la plateforme OXV existante pour permettre la création d'**événements personnalisés** en complément des sessions classiques au Circuit de Haute Saintonge.

Le cas d'usage prioritaire est la **Balade Découverte du 5 juillet 2026 à Bouteville**, mais la fonctionnalité est conçue pour être réutilisable pour d'autres événements futurs (test partenaires, événement Bordeaux quand l'implantation se concrétisera, sessions corporate sur d'autres circuits, etc.).

---

## 1. Vue d'ensemble des modifications

Pour cette fonctionnalité, **quatre éléments** doivent être ajoutés ou modifiés :

| Élément | Type | Effort estimé |
|---|---|---|
| Migration SQL — nouvelle table `events` | Backend | 1h |
| Migration SQL — modification de `sessions` pour lier aux events | Backend | 30min |
| Page admin "Créer un événement" | Frontend | 3-4h |
| Adaptation du parcours réservation pour offres gratuites | Frontend | 2-3h |

**Effort total estimé : 6 à 8 heures** de développement.

C'est court parce que tout repose sur l'infrastructure que vous avez déjà mise en place (Supabase, RLS, parcours de réservation existant). On ne crée pas un nouveau module, on étend l'existant.

---

## 2. Migration SQL — Création de la table `events`

### 2.1 — Pourquoi une nouvelle table

Votre table `sessions` actuelle est conçue pour les **32 sessions annuelles au Circuit de Haute Saintonge**. Elle a une structure rigide qui ne convient pas pour un événement ponctuel hors-circuit.

Plutôt que de polluer `sessions` avec des champs optionnels pour des cas exceptionnels, on crée une **nouvelle table `events`** qui peut référencer ou non un circuit, et qui a sa propre logique.

### 2.2 — Migration à appliquer

À sauvegarder sous `/migrations/migration_events_v1.sql` puis à appliquer sur Supabase.

```sql
-- Migration: Création de la table events pour gérer les événements personnalisés
-- Date: 2026-05-23
-- Auteur: OXV
-- Description: Permet la création d'événements ad-hoc (balade découverte,
--              test alpha, événements partenaires) en complément des sessions
--              classiques au Circuit de Haute Saintonge

-- Table events
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),

  -- Identification
  name text not null,
  slug text unique not null,
  -- Exemple slug: 'balade-decouverte-5juillet-2026'

  -- Type d'événement
  event_type text not null default 'session' check (event_type in (
    'session',              -- Session classique au Circuit de Haute Saintonge
    'balade_decouverte',    -- Rallye touristique entre amis
    'test_alpha',           -- Événement de test interne
    'partenaire',           -- Événement avec un partenaire (marque, club)
    'corporate'             -- Événement B2B sur mesure
  )),

  -- Statut
  status text not null default 'draft' check (status in (
    'draft',     -- Création en cours, non visible
    'private',   -- Visible uniquement avec invitation directe
    'public',    -- Visible dans le calendrier public
    'closed',    -- Inscriptions closes
    'finished',  -- Événement terminé
    'cancelled'  -- Annulé
  )),

  -- Lieu (peut être différent du Circuit de Haute Saintonge)
  location_name text not null,
  -- Exemple: 'Bouteville, Charente'
  location_address text,
  location_coordinates point,
  -- Format PostgreSQL: '(latitude, longitude)'

  -- Dates et horaires
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  briefing_at timestamptz,

  -- Capacité
  max_pilots integer not null default 20,
  current_pilots integer not null default 0,

  -- Tarification (compatible avec sessions classiques)
  pricing jsonb not null default '{}',
  -- Format: { "access": 250, "balade_decouverte": 0 }

  -- Métadonnées de l'événement
  description text,
  internal_notes text,
  -- Notes internes admin, non visibles côté pilote

  -- Tracking
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_at timestamptz not null default now()
);

-- Index pour performance
create index if not exists idx_events_status on public.events(status);
create index if not exists idx_events_starts_at on public.events(starts_at);
create index if not exists idx_events_slug on public.events(slug);

-- Trigger pour mise à jour automatique de updated_at
create or replace function public.update_events_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_update_events_updated_at
  before update on public.events
  for each row
  execute function public.update_events_updated_at();

-- RLS — Row Level Security
alter table public.events enable row level security;

-- Politique : tout le monde peut lire les événements public et closed
create policy "Public events visible to all"
  on public.events for select
  using (status in ('public', 'closed', 'finished'));

-- Politique : utilisateur authentifié peut voir les événements private auxquels il est invité
-- (à implémenter via une table de liaison events_invitations si nécessaire,
-- ou via un lien direct partagé)
create policy "Private events visible via direct link"
  on public.events for select
  using (status = 'private');
  -- Note: la sécurisation se fait par le slug obscur (URL non devinable),
  -- pas par un système d'invitation complexe pour la V1

-- Politique : seul l'admin peut créer/modifier/supprimer
create policy "Admin can manage events"
  on public.events for all
  using (public.is_admin())
  with check (public.is_admin());
```

### 2.3 — Modification de la table `sessions`

On ajoute une colonne `event_id` à la table `sessions` existante pour permettre de lier une session classique à un événement, et inversement (rétro-compatibilité totale).

```sql
-- Ajout de la liaison sessions <> events
alter table public.sessions
  add column if not exists event_id uuid references public.events(id);

-- Index pour les jointures
create index if not exists idx_sessions_event_id on public.sessions(event_id);

-- Vue de compatibilité pour le code existant
-- Les sessions historiques restent visibles sans event_id (NULL)
-- Les nouvelles sessions classiques peuvent optionnellement avoir un event_id
```

### 2.4 — Insertion de l'événement Balade Découverte

```sql
-- Insertion de l'événement Balade Découverte du 5 juillet 2026
insert into public.events (
  name,
  slug,
  event_type,
  status,
  location_name,
  location_address,
  starts_at,
  ends_at,
  briefing_at,
  max_pilots,
  pricing,
  description,
  internal_notes
) values (
  'Balade Découverte OXV — 5 juillet 2026',
  'balade-decouverte-5juillet-2026',
  'balade_decouverte',
  'private',
  'Bouteville, Charente',
  'Place de Bouteville, 16120 Bouteville',
  '2026-07-05 09:00:00+02',
  '2026-07-05 15:00:00+02',
  '2026-07-05 09:30:00+02',
  12,
  '{"balade_decouverte": 0}'::jsonb,
  'Demi-journée de balade automobile entre amis dans la campagne charentaise. Test alpha du parcours OXV Mirror. Conduite normale, respect du Code de la route, événement privé.',
  'Test alpha avec amis pour validation parcours client et app OXV Mirror. Décharge de responsabilité à faire signer sur place. Restauration prévue après le convoi.'
);
```

---

## 3. Modification de l'admin — Page "Créer un événement"

### 3.1 — Emplacement dans `index.html`

Dans votre fichier `index.html` actuel, la section admin contient déjà :

- Tableau de bord
- Liste pilotes
- Fiche pilote
- Liste sessions
- Détail session

On ajoute une **6ème page admin** : **Liste des événements** et **Créer un événement**.

### 3.2 — Bouton dans la navigation admin

Modifier la barre latérale admin pour ajouter l'entrée "Événements" :

```html
<!-- Dans la nav admin existante, après "Sessions" -->
<a href="#admin-events" class="nav-link" data-page="admin-events">
  <span class="nav-icon">📅</span>
  <span class="nav-label">Événements</span>
</a>
```

### 3.3 — Page "Liste des événements"

Vue tableau classique reprenant la grammaire visuelle de votre page Sessions. Colonnes recommandées :

| Colonne | Source | Type d'affichage |
|---|---|---|
| Nom | `events.name` | Texte avec lien vers détail |
| Type | `events.event_type` | Badge coloré (session = rouge, balade = orange, etc.) |
| Date | `events.starts_at` | Date formatée FR |
| Lieu | `events.location_name` | Texte court |
| Statut | `events.status` | Badge coloré |
| Pilotes | `current_pilots / max_pilots` | Compteur visuel |
| Actions | — | Boutons "Voir", "Modifier", "Dupliquer" |

Header de la page : bouton **"+ Créer un événement"** en rouge OXV en haut à droite.

### 3.4 — Formulaire "Créer un événement"

Modal ou page dédiée avec les champs suivants, en sections.

**Section 1 — Informations générales**

- **Nom de l'événement** : texte libre (validation : 5-100 caractères)
- **Type** : sélecteur parmi `session`, `balade_decouverte`, `test_alpha`, `partenaire`, `corporate`
- **Slug URL** : auto-généré à partir du nom (modifiable, validation alphanumérique + tirets)
- **Statut initial** : sélecteur `draft` (par défaut), `private`, `public`

**Section 2 — Lieu**

- **Nom du lieu** : texte libre (ex. "Bouteville, Charente")
- **Adresse complète** : texte multiligne
- **Coordonnées GPS** : deux champs latitude + longitude (optionnel, utile pour future intégration carte)

**Section 3 — Dates et capacité**

- **Date de début** : date + heure
- **Date de fin** : date + heure
- **Heure de briefing** : heure (optionnel)
- **Nombre maximum de pilotes** : numérique (1-50)

**Section 4 — Tarification**

- **Mode tarifaire** : sélecteur "Gratuit" ou "Payant"
- Si "Gratuit" : aucun champ supplémentaire, `pricing` = `{"balade_decouverte": 0}` ou équivalent selon le type
- Si "Payant" : tableau de tarifs par offre disponible

**Section 5 — Description**

- **Description publique** : texte long visible par les pilotes inscrits
- **Notes internes** : texte long, jamais visible côté pilote

**Bouton de soumission** : "Créer l'événement" (rouge OXV)

### 3.5 — Actions disponibles sur un événement créé

Une fois l'événement créé, dans la fiche détaillée :

- **Voir le lien de partage** : `oxvehicle.fr/reservation/{slug}` (cliquable, copiable)
- **Modifier l'événement** : retour au formulaire
- **Dupliquer** : crée un nouvel événement avec les mêmes paramètres (utile pour récurrence)
- **Changer le statut** : `draft` → `private` → `public` → `closed` → `finished` ou `cancelled`
- **Liste des pilotes inscrits** : tableau avec actions individuelles (mêmes actions que pour Sessions)
- **Exporter les pilotes** : CSV pour gestion manuelle

---

## 4. Adaptation du parcours réservation

### 4.1 — Modification du wizard 5 étapes existant

Votre wizard de réservation actuel (Date → Offre → Véhicule → Récap+CGV → Confirmation) doit être adapté pour gérer les événements gratuits.

**Modification de l'étape 2 (Offre)** :

Quand le pilote arrive sur l'étape 2 et qu'il a sélectionné un événement de type `balade_decouverte`, l'offre affichée est **uniquement "Balade Découverte"** à 0 €. Les autres offres (Access, Signature, etc.) sont masquées.

```javascript
// Pseudo-code de la logique
if (event.event_type === 'balade_decouverte') {
  showOnlyOffer('balade_decouverte', { price: 0 });
  hideOffers(['access', 'signature', 'promotion', 'heritage']);
} else if (event.event_type === 'session') {
  showOffersBasedOnProgression(user.progression);
}
```

**Modification de l'étape 4 (Récap + CGV)** :

Si le montant à payer est de 0 €, ne pas afficher la section paiement, mais conserver les acceptations CGV/Pacte/Confidentialité (essentielles juridiquement même pour gratuit).

Texte de remplacement de la section paiement :

```
Aucun paiement n'est requis pour cet événement.

Votre inscription sera confirmée immédiatement après acceptation
des conditions ci-dessous.
```

**Modification de l'étape 5 (Confirmation)** :

Texte de confirmation adapté :

```
Inscription confirmée à la Balade Découverte OXV.

Vous recevrez prochainement votre email de bienvenue et les
rituels avant événement.

Nous nous retrouvons le 5 juillet à 9h00 à Bouteville.
```

### 4.2 — Modification du parcours rituels

Les rituels existants (emails J-7, J-2, J-1) sont automatiques pour les sessions classiques. Il faut les adapter pour qu'ils s'enclenchent aussi pour les événements de type `balade_decouverte`.

Modifications dans le dispatcher de rituels (Edge Function `ritual_dispatcher`) :

```typescript
// Avant : on récupérait uniquement les sessions
const upcomingItems = await supabase
  .from('sessions')
  .select('*')
  .gte('starts_at', threshold);

// Après : on récupère sessions + events
const upcomingSessions = await supabase
  .from('sessions')
  .select('*')
  .gte('starts_at', threshold);

const upcomingEvents = await supabase
  .from('events')
  .select('*')
  .in('status', ['private', 'public', 'closed'])
  .gte('starts_at', threshold);

const upcomingItems = [...upcomingSessions, ...upcomingEvents];
```

### 4.3 — Adaptation du contenu des rituels

Les templates d'email actuels mentionnent "Circuit de Haute Saintonge", "Beltoise", "tracé". Pour les événements `balade_decouverte`, on doit adapter dynamiquement le contenu.

Recommandation : ajouter une variable `event_context` dans les templates :

```handlebars
{{#if event_type == 'session'}}
  Rendez-vous au Circuit de Haute Saintonge, tracé Beltoise.
{{else if event_type == 'balade_decouverte'}}
  Rendez-vous à {{location_name}} pour notre balade.
{{else}}
  Rendez-vous à {{location_name}}.
{{/if}}
```

Pour l'audio personnalisé J-2 (GPT-4o + ElevenLabs), le system prompt doit être adapté :

```
Pour un événement de type 'balade_decouverte', générer un message qui :
- Reconnaît le caractère convivial et amical de l'événement
- Évite le vocabulaire de circuit (piste, tracé, virage)
- Privilégie le vocabulaire de balade (campagne, paysage, sérénité)
- Reste dans le ton OXV (vouvoiement, sec, premium)
```

---

## 5. Adaptation de l'app OXV Mirror

### 5.1 — Détection du type d'événement

L'app doit récupérer le `event_type` lors du jumelage paddock et adapter quelques éléments :

**Sur l'écran #07 "Vous y êtes"** :
- Pour `session` : "Circuit de Haute Saintonge"
- Pour `balade_decouverte` : "Bouteville, Charente"

**Sur l'écran #09 "Placement"** :
- Pour `session` : "Posez le boîtier sur le support magnétique côté passager"
- Pour `balade_decouverte` : "Posez le boîtier sur le tableau de bord. Vous le verrez peu, mais il enregistrera tout votre parcours."

**Sur l'écran #06 "Pacte de pilotage"** :
- Pas de modification : le pacte est universel et s'applique aussi sur route normale

### 5.2 — Adaptation des algorithmes

Comme évoqué dans nos échanges précédents, **les algorithmes de marge calibrés pour Beltoise vont produire des résultats étranges sur des données de campagne**.

Recommandation pour le test alpha : afficher dans l'app un message contextuel sur l'écran Bilan (#13) :

```
Cet événement n'est pas une session de circuit.

Les analyses présentées ci-dessous sont expérimentales et
n'ont pas vocation à être comparées à vos sessions Beltoise
classiques. Vos données sont préservées pour votre information.
```

Cette mention :
- Évite la confusion pour vos amis testeurs
- Vous permet quand même de récolter les données techniques
- Reste cohérente avec votre doctrine (l'app ne ment pas sur ce qu'elle est)

### 5.3 — Stockage spécifique en base

Les données télémétriques de la Balade Découverte sont stockées normalement dans Supabase, mais avec un flag spécifique :

```sql
-- Dans la table app_sessions (à confirmer selon votre schéma actuel)
alter table public.app_sessions
  add column if not exists context text default 'circuit'
  check (context in ('circuit', 'balade', 'test_alpha'));
```

Cela vous permet, ultérieurement, de filtrer ces données dans vos analyses globales pour ne pas polluer vos statistiques de circuit.

---

## 6. Checklist d'implémentation

### Travail backend (Supabase)

- [ ] Appliquer la migration `migration_events_v1.sql`
- [ ] Vérifier les politiques RLS sur la nouvelle table `events`
- [ ] Tester l'insertion manuelle d'un événement balade_decouverte
- [ ] Ajouter la colonne `event_id` à `sessions`
- [ ] Ajouter la colonne `context` à `app_sessions`
- [ ] Mettre à jour la fonction Edge `ritual_dispatcher` pour gérer les events
- [ ] Adapter le system prompt audio J-2 pour les balades

### Travail frontend (index.html admin)

- [ ] Ajouter l'entrée "Événements" dans la nav admin
- [ ] Créer la page "Liste des événements"
- [ ] Créer le formulaire "Créer un événement" (modal ou page)
- [ ] Tester la création de la Balade Découverte
- [ ] Tester le statut `private` (visible avec lien, invisible sans)

### Travail frontend (parcours réservation)

- [ ] Adapter l'étape 2 (Offre) pour ne montrer que "Balade Découverte" quand approprié
- [ ] Adapter l'étape 4 (Récap+CGV) pour masquer le paiement si gratuit
- [ ] Adapter l'étape 5 (Confirmation) avec le bon texte
- [ ] Tester le parcours complet en mode `balade_decouverte`

### Travail app OXV Mirror

- [ ] Adapter l'écran #07 pour afficher le lieu dynamique
- [ ] Adapter l'écran #09 avec le bon message d'installation
- [ ] Ajouter le bandeau d'avertissement sur l'écran #13 Bilan
- [ ] Tester avec données fictives le rendu sur événement balade

---

## 7. Estimation finale

| Phase | Effort | Jalons |
|---|---|---|
| Backend (migrations + RLS) | 2-3h | J-21 (vers le 14 juin) |
| Admin "Créer événement" | 3-4h | J-14 (21 juin) |
| Parcours réservation | 2-3h | J-10 (25 juin) |
| App OXV Mirror (mineurs) | 1-2h | J-7 (28 juin) |
| Tests bout en bout | 2-3h | J-3 (2 juillet) |

**Total : 10-15 heures de développement** réparties sur 3 semaines.

Si vous codez vous-même : faisable en deux week-ends. Si vous déléguez à un dev externe : compter 1500-2500 € (à 100-150 €/h).

---

## 8. Notes de réutilisation future

Cette fonctionnalité est conçue pour être **réutilisée** au-delà de la Balade Découverte du 5 juillet.

**Cas d'usage futurs identifiés** :

- Événements partenaires concessionnaires (sur leur site, leur événement, leur clientèle)
- Test de l'app sur le Circuit de Bordeaux quand l'implantation se concrétisera
- Sessions corporate sur mesure (location de piste hors Beltoise)
- Événements "anniversaire OXV" annuels avec format spécial
- Tests bêta pour la sortie de nouvelles fonctionnalités

La table `events` et son `event_type` sont conçus pour absorber ces cas sans nouvelle migration.

---

*Spécification technique — Ajout admin Événement personnalisé — Version 1.0 — Mai 2026*

*À transmettre au développeur en charge de l'implémentation, accompagnée du plan opérationnel (livrable 1) et de la grille d'observation (livrable 3).*
