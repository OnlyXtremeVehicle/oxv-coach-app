# Modèle économique — où OXV gagne

> Document de cadrage. À lire après `00_PLATEFORME_OXV.md`, `03_MVP_SCOPE.md`, `04_DESIGN_CANON.md`.
> Statut : **cadrage** (avant code). Aucune intégration de paiement n'est planifiée en V1.
> But : relier chaque fonction de l'app à une source de revenu réelle, sans jamais trahir la doctrine.

---

## 0. Position de principe

OXV est d'abord une **expérience de track day premium** au Circuit de Haute Saintonge. L'app n'est pas le produit qui se vend ; elle est le **tissu** qui rend l'expérience désirable, lisible et fidélisante. Le revenu vient de l'**événement physique** et de ce qui gravite autour (coaching, médias, partenaires, B2B). L'app **sert** ces revenus — elle ne les **simule** pas, ne les **pousse** pas, ne transforme pas le pilote en cible marketing.

Trois garde-fous qui priment sur toute considération business :

1. **Doctrine d'abord.** Côté pilote, aucun verbe prescriptif, aucun classement, un seul chiffre dominant par écran, silence total en piste. Une fonction qui rapporte mais viole la doctrine n'entre pas.
2. **L'or = donnée, jamais argent ni nav.** Un prix, un bouton « Réserver », une offre partenaire ne s'habillent **jamais** en or. Bouton primaire = fond crème `#F8F9FA` / texte `#050505` (cf. `04_DESIGN_CANON`). La nav reste actif `#F8F9FA` / inactif `#54545C`, **jamais d'or**.
3. **Le schéma de revenu n'est pas acquis.** Des colonnes de monétisation existent déjà en base (voir §1) mais **aucune** logique de facturation n'est branchée. Toute activation (Stripe, commission, abonnement) **nécessite l'accord explicite de Gabin** avant code.

---

## 1. Ce qui existe déjà en base (constat, pas décision)

Le schéma de production porte déjà une ossature de monétisation, héritée du site `oxvehicle.fr`. On la **constate** ici pour ne pas la réinventer ; on ne l'**active** pas sans accord.

| Table (`src/types/database.types.ts`) | Colonnes économiques réelles | Sert quoi |
|---|---|---|
| `payments` | `amount`, `currency`, `status`, `payment_method`, `stripe_payment_intent_id`, `stripe_charge_id`, `stripe_invoice_id`, `invoice_pdf_url`, `registration_id`, `heritage_pack_id` | Paiements événement / pack — **déjà câblé côté site web**, pas côté app |
| `subscriptions` | `scope`, `season`, `status`, `stripe_customer_id`, `stripe_subscription_id`, `current_period_end` | Abonnement saison (fonction RPC `is_subscription_current`) |
| `pricing` | grille tarifaire | Référentiel de prix |
| `heritage_packs` | `price_total`, `sessions_total`, `sessions_used`, `valid_from/until`, `status` | Pack de sessions prépayées (carnet) |
| `registrations` | inscription événement (FK depuis `payments`) | Inscription au track day |
| `coach_profiles` | `season_price_eur` | Tarif saison annoncé par le coach |
| `coach_pilots` | `affiliation_price_eur` | Tarif d'affiliation coach↔pilote |
| `coach_roulages` | `price_per_pilot` | Roulage tarifé organisé par un coach |
| `coaching_bookings` | `status`, `requested_starts_at`, `availability_id` | Demande de séance coach (**sans montant** aujourd'hui) |
| `partners` | `is_official_partner`, `is_premium`, `is_published`, `partner_type`, `circuit_id` | Annuaire partenaires (référencement) |
| `circuit_services`, `restaurants`, `lodgings` | `is_premium`, `is_published` | Services autour du circuit |
| `corporate_leads` | `company`, `contact_name`, `day_format`, `guests`, `status` | Demandes B2B / privatisation (formulaire web) |
| `media`, `session_media` | médias de session | Photos / vidéos d'événement |

**Lecture clé.** Les colonnes Stripe sont **présentes mais inertes dans l'app**. `payments`/`subscriptions` sont alimentées par le site, pas par le mobile. `coaching_bookings` ne porte **aucun montant** : la séance coach se négocie hors app aujourd'hui. Le `coachBusinessService.ts` calcule un revenu coach **purement descriptif** (prix/place × présences confirmées), **sans aucune commission ni encaissement** — décision Gabin du 2026-06-07, à conserver.

---

## 2. Les six sources de revenu

### 2.1 Événements / track day — **socle**
Le cœur économique. Inscription à une journée au Circuit de Haute Saintonge (multi-circuit Charente à terme). Tables : `registrations`, `payments`, `heritage_packs` (sessions prépayées), `subscriptions` (saison). L'app **prépare** (Paddock contextuel : prochaine sortie, compte à rebours, équipement) et **prolonge** (Bilan, Progression) l'événement, mais l'achat se fait aujourd'hui sur le **site web**.

### 2.2 Coaching affilié
Coach rattaché à un pilote (`coach_pilots`, `affiliation_price_eur`), séances (`coaching_bookings`), roulages tarifés (`coach_roulages.price_per_pilot`), tarif saison (`coach_profiles.season_price_eur`). L'app **rend visible** le coach, **transporte** la lecture/annotation de session (espace `(coach)` : `lecture`, `annoter`, `reperes`, `comparer`), et **facilite la mise en relation** (`mon-coach`, `coachs`, `coach/[id]`, `mes-demandes`). La **transaction** reste hors app en V1.

### 2.3 Partenaires
Annuaire de l'écosystème piste (`partners`, `circuit_services`, `restaurants`, `lodgings`), avec `is_premium` / `is_official_partner`. L'app **référence** (Club → La carte OXV : `carte-oxv`, `circuit/[id]`) en lecture seule côté pilote. Monétisation future : référencement premium, lead qualifié, commission de réservation. L'**espace Partenaire** (dashboard) n'existe pas encore (net-neuf, V1.5+).

### 2.4 Médias
Photos et vidéos d'événement (`media`, `session_media`). L'app **distribue** (médias de session dans Bilan / Club) et **amplifie** (partage « OXV Moment » : `partage`, `carte-trophee`, `share/[token]`). Monétisation : **pack média** payant. Le partage public est aussi un **canal d'acquisition** (chaque carte partagée ramène un prospect).

### 2.5 Abonnements premium pilote
`subscriptions` (scope/season) existe. Levier de valeur en app : **Data Lab avancé** (replay synchronisé avancé, couches techniques, comparateur étendu) réservé aux abonnés. La V1 garde la lecture **complète et gratuite** : on ne dégrade pas le Bilan pour créer un mur payant. Le premium se construit en **profondeur ajoutée**, pas en **fonction retirée**.

### 2.6 B2B garage / privatisation
`corporate_leads` (privatisation, séminaires) déjà alimentée par le site. Piste annexe : **diagnostic piste** pour garages/préparateurs (lecture agrégée et anonyme de la donnée). Cette piste touche la donnée télémétrique : elle **nécessite accord Gabin ET cadrage RGPD** (`07_DATA_POLICY`, `17_JURIDIQUE_COACH_DATA`) avant toute exploration.

---

## 3. Source × Fonction app × Monétisation

| Source | Fonction app (zone / route réelle) | Tables/services | Mécanique de revenu | Statut app |
|---|---|---|---|---|
| **Événement** | Paddock contextuel (`index`/`paddock`), prochaine sortie, Pass OXV (V1.5) | `registrations`, `payments`, `circuits` | Inscription track day | Préparation oui, **achat sur web** |
| **Événement** | Carnet de sessions prépayées | `heritage_packs` | Pack prépayé (sessions_total/used) | Lecture V1.5, achat web |
| **Événement** | Accès saison | `subscriptions`, RPC `is_subscription_current` | Abonnement saison | Gating possible, **accord requis** |
| **Coaching** | Mon coach (`mon-coach`), découverte (`coachs`, `coach/[id]`) | `coach_profiles`, `coach_pilots`, `coachMarketplaceService.ts` | Affiliation / tarif saison | Visible V1, transaction hors app |
| **Coaching** | Demande de séance (`mes-demandes`, `(coach)/demandes`) | `coaching_bookings`, `coach_availability` | Séance payante | Mise en relation V1, **paiement V2** |
| **Coaching** | Roulage coach tarifé, dashboard business (`(coach)/business`) | `coach_roulages`, `coachBusinessService.ts` | Prix/place × présences (descriptif) | V1 **sans commission ni encaissement** |
| **Partenaires** | La carte OXV (`carte-oxv`, `circuit/[id]`) | `partners`, `circuit_services`, `ecosystemService.ts` | Référencement premium / lead | Annuaire V1, offres/leads V1.5 |
| **Partenaires** | Espace Partenaire (dashboard) | `partners` (net-neuf) | Abonnement / commission | **N'existe pas** (V1.5+) |
| **Médias** | Médias de session (Bilan/Club), `sessionMediaService.ts` | `session_media`, `media` | Pack média | Partage V1, galerie V1.5 |
| **Médias** | OXV Moment (`partage`, `carte-trophee`, `share/[token]`) | `sharesService.ts` | Acquisition (viral, indirect) | V1 |
| **Premium pilote** | Data Lab avancé (replay/couches étendues) | `subscriptions` | Abonnement / pack | Base gratuite V1, avancé V1.5/V2 |
| **B2B garage** | Privatisation / séminaire (formulaire) | `corporate_leads` | Lead B2B | Web aujourd'hui, app non prioritaire |

---

## 4. Règle de validation d'une fonction

> Une fonction n'a sa place que si elle sert **au moins une** des quatre raisons : **expérience pilote**, **qualité opérationnelle**, **monétisation**, **rétention**. Sinon, c'est du bruit — on la range, la fusionne ou la reporte (cf. `02_AUDIT_ROUTES`, `03_MVP_SCOPE`).

| Raison | Test concret | Exemple dans l'app |
|---|---|---|
| Expérience pilote | Répond-elle à la question de sa zone (`01_ORGANISATION_PRODUIT`) ? | Bilan : « qu'est-ce que ma session m'apprend ? » |
| Qualité opérationnelle | Aide-t-elle OXV à mieux opérer l'événement / la data ? | Admin `operations`, qualité data, `coachBusinessService` |
| Monétisation | Pointe-t-elle vers une source du §2 ? | Mon coach → affiliation ; carte OXV → partenaires |
| Rétention | Donne-t-elle envie de revenir après l'événement ? | Progression, OXV Moment, médias |

**Précisions doctrinales sur cette règle :**

- La monétisation ne **prime jamais** sur la doctrine. Un écran qui rapporterait en violant « l'app montre, ne dirige pas », « un seul chiffre », « silence en piste » ou le vouvoiement est **rejeté**, quel que soit son potentiel.
- Aucune monétisation **en piste** : pendant le roulage, l'écran s'efface (voyant REC, aucune offre, aucune notif, aucun prix). La monétisation vit **avant** (Paddock) et **après** (Bilan, Club).
- Aucune offre ne s'habille en or. Les CTA commerciaux suivent le bouton primaire crème du canon ; le rouge reste réservé coach / REC.

---

## 5. Lien avec le périmètre V1 / V1.5 / V2

Aligné sur `03_MVP_SCOPE`. **Décision stratégique : pas d'intégration de paiement en V1. Stripe = V2.**

| Brique | V1 (gratuit / sans paiement) | V1.5 | V2 (paiement) |
|---|---|---|---|
| Bilan + Data Lab simple | **Gratuit, complet** | Data Lab avancé | — |
| Coach visible + consentement + notes | **Oui** | Programmes (cycles), réservation | **Paiement coach (Stripe)** |
| `coaching_bookings` | Mise en relation, **sans montant** | Réservation structurée | Encaissement séance |
| Partenaires | **Annuaire** (carte OXV) | Offres / leads | Commission partenaires |
| Pass OXV (QR événement) | — | **Oui** | — |
| Médias | Partage (OXV Moment) | Galerie / pack média | — |
| Abonnement premium | — (lecture gratuite) | Data Lab avancé gated | Abonnement / marketplace coach |
| Espace Partenaire (dashboard) | — | **Net-neuf** | Commission |
| B2B garage | — (web) | À explorer | Offre B2B |

**Pourquoi pas de Stripe en V1 (rappel) :**

1. **Doctrine et confiance d'abord.** La V1 doit prouver que l'app est un miroir premium et fidèle ; un mur de paiement précoce brouille ce message.
2. **Le revenu existe déjà côté web.** `payments`/`subscriptions` tournent sur `oxvehicle.fr` ; dupliquer l'encaissement dans le mobile crée surface, risque et conformité (PCI, RGPD) sans gain immédiat.
3. **Surface et conformité.** Encaisser dans l'app implique App Store / Play Store rules, facturation, litiges. Hors scope d'une V1 « publiable et propre ».
4. **Séquencement.** On valide la **mise en relation** (coach, partenaires) et la **valeur** (Bilan, Progression) avant d'y greffer la **transaction**.

**Conséquence pour Claude Code :** en V1, on **affiche** des prix issus de la base (`season_price_eur`, `price_per_pilot`, `affiliation_price_eur`) et on **oriente** vers le canal d'achat (site web / contact coach). On n'écrit **aucun** flux d'encaissement, on ne touche **aucune** colonne Stripe.

---

## 6. Ce qui nécessite l'accord de Gabin (à soumettre)

Aucun de ces points n'est acté. Chacun **nécessite accord** avant cadrage détaillé ou code.

- **Brancher Stripe dans le mobile** (paiement séance, abonnement, pack média) — V2, à arbitrer vs achat web.
- **Ajouter un montant à `coaching_bookings`** ou tout schéma de réservation tarifée — **changement de schéma, accord requis**.
- **Commission OXV** sur coaching ou partenaires — écartée à ce jour pour le dashboard coach ; toute réintroduction est une **décision Gabin**.
- **Gating premium** du Data Lab via `subscriptions` — définir la **ligne gratuit/payant** sans dégrader le Bilan.
- **Diagnostic piste B2B garage** exploitant la télémétrie — **accord + cadrage RGPD** (`07_DATA_POLICY`, `17_JURIDIQUE_COACH_DATA`) impératifs.
- **Toute nouvelle table** de facturation, offre ou lead partenaire — soumise à accord, jamais présentée comme acquise.

---

## 7. Synthèse

OXV gagne sur l'**événement physique** ; l'app le **prépare, le prolonge et le fidélise**. Les leviers secondaires (coaching, médias, partenaires, premium, B2B) ont déjà leur **ossature en base** mais restent **inertes côté mobile** en V1. La V1 vend la **confiance** (miroir fidèle, doctrine tenue), pas une transaction. Le paiement vient en V2, **après accord de Gabin**, sans jamais habiller l'argent en or ni rompre le silence en piste.
