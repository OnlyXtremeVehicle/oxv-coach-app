# Prompt Claude Code — Sélection véhicule au tunnel de réservation

Destination : `OnlyXtremeVehicle/oxv-site`. Un lot, un commit.
Référence doctrinale : `claude_OXV_Eligibilite_Vehicules_2026-08-26.md`.

---

## Prompt à transmettre

Tu interviens sur oxv-site, SPA vanilla JS mono-fichier déployée sur Vercel, backend
Supabase (projet `fouvuqkdxarjpjbqnsjq`, Frankfurt). Aucun framework, aucune dépendance
nouvelle. Charte v2 : ivoire #F5F3F0, noir mat #0A0A0A, rouge #C8102E. L'or #C4A459 est
réservé à Heritage et n'apparaît nulle part ailleurs.

### Objectif

Insérer une étape de sélection véhicule dans le tunnel de réservation, en amont du paiement.
Un véhicule non éligible ne doit jamais être sélectionnable. Il n'existe pas de validation
a posteriori sur un véhicule correctement déclaré.

### 1. Schéma Supabase

Crée la migration suivante.

```sql
create table public.vehicules_eligibles (
  id            uuid primary key default gen_random_uuid(),
  marque        text not null,
  modele        text not null,
  generation    text,
  annee_debut   smallint,
  annee_fin     smallint,
  puissance_ch  smallint not null,
  masse_kg      smallint not null,
  ratio_kg_ch   numeric(4,2) generated always as
                  (round(masse_kg::numeric / puissance_ch, 2)) stored,
  classe        char(3) not null check (classe in ('I','II','III')),
  carrosserie   text    not null check (carrosserie in ('fermee','decouvrable')),
  motorisation  text    not null check (motorisation in ('thermique','hybride','electrique')),
  statut        text    not null default 'actif' check (statut in ('actif','exclu')),
  revision      text    not null default '2026',
  created_at    timestamptz not null default now()
);

create index idx_veh_marque  on public.vehicules_eligibles (marque)
  where statut = 'actif';
create index idx_veh_classe  on public.vehicules_eligibles (classe)
  where statut = 'actif';

alter table public.vehicules_eligibles enable row level security;

create policy "lecture publique des vehicules actifs"
  on public.vehicules_eligibles for select
  using (statut = 'actif');
```

Import du référentiel depuis `OXV_Referentiel_Vehicules_2026.csv`, séparateur point-virgule,
encodage UTF-8 BOM, décimale virgule sur `ratio_kg_ch` — convertir en point à l'import.

Étends la table des réservations.

```sql
alter table public.reservations
  add column vehicule_id            uuid references public.vehicules_eligibles(id),
  add column immatriculation        text,
  add column modifications_declarees boolean not null default false,
  add column modifications_detail   text,
  add column classe_retenue         char(3);
```

`classe_retenue` est figée à la réservation : une révision ultérieure du référentiel ne doit
jamais reclasser une réservation déjà payée.

### 2. Contrainte offre / classe

Table de correspondance, jamais codée en dur côté client.

```sql
create table public.offres_classes (
  offre  text   not null,
  classe char(3) not null,
  primary key (offre, classe)
);

insert into public.offres_classes values
  ('access','I'), ('access','II'), ('access','III'),
  ('signature','II'), ('signature','III'),
  ('heritage','II'),  ('heritage','III');
```

Vérification côté edge function avant création de l'intention de paiement. Un appel direct à
l'API portant une combinaison offre / classe absente de cette table doit être rejeté.

### 3. Interface — étape « Votre véhicule »

Sélection en cascade, trois listes déroulantes successives.

1. **Marque** — `select distinct marque ... order by marque`
2. **Modèle** — filtré sur la marque retenue
3. **Génération** — filtré sur marque et modèle, libellé `{generation} · {annee_debut}–{annee_fin}`, `annee_fin` vide affichée en tiret cadratin

Chaque liste reste désactivée tant que la précédente n'est pas renseignée. Aucun chargement
global du référentiel au montage : requêtes successives, résultats mis en cache dans un objet
en mémoire pour la durée de la session.

Une fois la génération choisie, afficher une fiche de confirmation sobre : puissance, masse,
rapport masse / puissance en IBM Plex Mono, classe en libellé complet — « Classe II — GT ».
Aucune notation, aucun classement, aucun commentaire de performance. La donnée est restituée,
jamais commentée.

### 4. Champs complémentaires

- **Immatriculation** — obligatoire, format AA-123-AA, normalisation en majuscules,
  suppression des espaces, insertion automatique des tirets.
- **Modifications** — case à cocher unique : « Ce véhicule a fait l'objet de modifications du
  moteur, de l'échappement, de la suspension ou du freinage. » Si cochée, ouvrir un champ
  texte obligatoire et basculer la réservation en `en_examen` plutôt qu'en `confirmee`.

### 5. Filtrage du calendrier

Lorsque la classe est déterminée, les dates dont l'offre n'est pas ouverte à cette classe
apparaissent grisées, non sélectionnables, accompagnées de la mention : « Journée Signature —
ouverte aux classes II et III. »

Ne masquez jamais ces dates. Un pilote de classe I doit voir ce qui existe au-dessus : c'est
le mécanisme de montée en gamme, et sa dissimulation le supprime.

### 6. Véhicule absent du référentiel

Lien discret sous la troisième liste : « Mon véhicule ne figure pas dans cette liste. »

Ouvre un formulaire — marque, modèle, année, puissance, masse, immatriculation, adresse
électronique. Enregistre dans `demandes_examen_vehicule` et déclenche un envoi Resend depuis
contact@oxvehicle.fr vers l'administration. Réponse annoncée sous soixante-douze heures
ouvrées.

Cette table constitue votre veille : elle mesure ce que le référentiel n'a pas anticipé.

### 7. Interdits

- Aucune valeur de classe calculée côté client. La classe provient exclusivement de la base.
- Aucun montant B2B affiché.
- Aucune mention de l'opérateur du circuit comme partenaire ou co-organisateur.
- Aucune formulation présentant OXV comme garant de la sécurité en piste.
- Micro-typographie française : U+202F avant deux-points, point-virgule, point d'exclamation
  et point d'interrogation, et comme séparateur de milliers.

### 8. Vérifications avant commit

- Un pilote de classe I ne peut atteindre le paiement sur une offre Signature, ni par
  l'interface, ni par appel direct à l'API.
- Une réservation payée conserve sa `classe_retenue` après révision du référentiel.
- Aucune requête ne renvoie de lignes dont `statut` vaut `exclu`.
- Le tunnel reste intégralement utilisable au clavier seul.
