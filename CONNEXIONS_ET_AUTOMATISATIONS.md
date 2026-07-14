# CONNEXIONS & AUTOMATISATIONS — OXV

> Plan directeur. Objectif : lister tout ce qui doit être **connecté** (site ↔ app ↔
> Supabase) et **automatisé** dans le parcours, distinguer ce qui est **déjà prêt**,
> ce qui est **buildable tout de suite sans schéma**, et ce qui demande une **décision
> fondateur** (schéma / site / légal). Ancré sur le commit `f81df1f` (refonte pilote
> v2 complète).

---

## 0. Principe directeur — le commerce reste sous doctrine

L'app est un **miroir**, pas un coach. Ce principe vaut **aussi pour le commerce** :

- ✅ **Autorisé** : un catalogue partenaires **navigable**, rangé par catégorie
  (Pneus, Freins, Photo, Hôtel…), que le pilote **choisit** de parcourir. Un
  « paddock des partenaires » qui donne envie, mis en avant éditorialement par
  OXV / le partenaire.
- 🚫 **Ligne rouge** : **ne jamais pousser un produit à partir de la télémétrie du
  pilote** (« vos données montrent des pneus fatigués → achetez ceux-là »). C'est
  exactement l'exemple séduisant mais interdit : l'app **dirigerait** le pilote,
  et pire, détournerait la donnée-miroir à des fins commerciales. La marge, les G,
  l'usure déduite ne déclenchent **aucune** recommandation d'achat.

> **La nuance qui sauve** : le contexte peut ouvrir une **porte neutre** (« Vous
> revenez d'une journée piste → voir le paddock partenaires »), mais le contenu
> mis en avant est choisi par OXV/partenaires (éditorial), **jamais** calculé sur
> les données de conduite du pilote. Le pilote entre dans le catalogue ; le
> catalogue ne sort pas le chercher avec ses chiffres.

---

## 1. Catalogue partenaires (site → app)

### État réel — le socle EXISTE
| Élément | Statut | Preuve |
|---|---|---|
| Table comptes partenaires | ✅ en base | `partner_accounts` (display_name, type, logo_url, description, geo_zone, status) — `0017` |
| Table produits/offres = **le catalogue** | ✅ en base | `partner_offers` (title, description, **price_eur**, **category**, **image_url**, **conditions**, **valid_until**, quota, status draft/published/archived) — `0017` + `20260629003844` |
| Intérêt pilote → partenaire | ✅ en base | `partner_leads` (pilot_id, offer_id, consent, channel app_oxv/**qr_event**/admin, status) — `0017` |
| Lecture app | ✅ code | `partnerService.listMarketplace()` lit comptes validés + offres publiées |
| Création d'un lead | ✅ code | `partnerService.requestPartnerContact()` |

### La connexion site ↔ app existe déjà
Le partenaire crée son produit sur l'**espace partenaire du site** → écriture dans
`partner_offers` (même base Supabase) → l'app le lit via `listMarketplace()`.
**Aucune nouvelle plomberie de données n'est nécessaire.** La « connexion » est la
base Supabase partagée + la RLS (offres `published` visibles des pilotes).

### Ce qui manque côté app — BUILDABLE MAINTENANT, zéro schéma
Une **vraie page catalogue** côté pilote (aujourd'hui : simple onglet Partenaires en
liste dans Découverte). À construire :
- Écran `catalogue.tsx` : héros éditorial, **regroupement par catégorie** (Pneus,
  Freins, Photo, Hôtel, Transport…), **belles cartes produit** (image_url, prix,
  conditions, validité, logo partenaire), CTA « Je suis intéressé » → `requestPartnerContact`
  (lead avec consentement). Langage v2, désir d'achat, partenaires mis en avant.
- Point d'entrée : onglet Découverte + **raccourci contextuel neutre** depuis le
  Paddock post-journée (porte, pas push télémétrique — cf. §0).
- États réels : offre expirée (`valid_until`) masquée, quota épuisé signalé, EmptyState digne.

### Ce qui reste à décider / côté site
- **Catégories canoniques** : figer la liste (Pneus, Freins, Pneumatique, Photo,
  Hôtel, Restauration, Transport, Assurance, Loueur…) partagée site + app.
- **Mise en avant éditoriale** : un flag `featured` sur `partner_offers` (1 colonne)
  pour « produits à la une » — sinon tri par catégorie + récence. → décision schéma.
- Côté **site** (repo oxv-site) : l'UI de création d'offre par le partenaire (hors ce repo).

---

## 2. Paiement coach (encaissé directement par le coach)

### État réel
| Élément | Statut | Preuve |
|---|---|---|
| Modèle « coach encaisse hors OXV » | ✅ acté | `facturation.tsx` : « pas de suivi d'encaissement ni de déverrouillage payant » |
| Lien de paiement du coach | ✅ colonne | `users.payment_link` (P2) — le coach peut déjà coller un lien (SumUp/Lydia/Stripe perso) |
| Facturation P2 | ✅ | `coach_invoices`, `coach_invoice_counters`, billing_name/siret/vat, PDF de facture |
| **IBAN / RIB du coach** | ❌ absent | aucune colonne iban/bic/holder |
| OXV encaisse | 🚫 jamais | conforme doctrine + pas de SIRET OXV requis |

### Deux options (à trancher — cf. décisions)
**Option A — Lien de paiement (ZÉRO schéma, buildable maintenant).**
`users.payment_link` existe. Le coach colle son lien (SumUp, Lydia, PayPal.me,
Stripe Payment Link perso). L'app affiche « Régler {montant} » → ouvre le lien.
Simple, immédiat, aucun stockage bancaire sensible.

**Option B — RIB + virement SEPA facilité (1 décision schéma).**
Le coach saisit **IBAN + BIC + titulaire**. L'app génère pour le client :
- une **demande de virement** (IBAN + montant + référence = n° de facture) ;
- un **QR SEPA (EPC / « GiroCode »)** que le client scanne dans son appli bancaire
  pour **pré-remplir le virement** (bénéficiaire, IBAN, montant, motif). Zéro
  saisie, « virement direct au coach », **sans PSP, sans SIRET OXV**.
- Rapprochement : la **référence unique** (n° facture) permet au coach de pointer
  le virement reçu (suivi côté coach, pas OXV).

> Recommandation : **A tout de suite** (le champ existe), **B en cible** (le plus
> proche de ta description « il met son RIB, le client vire »). Les deux
> coexistent : lien OU RIB/QR SEPA selon ce que le coach renseigne.

### Garde-fous
- L'IBAN est une donnée sensible → RLS stricte (le coach lit/écrit le sien ; le
  pilote ne voit que ce qui est nécessaire au virement au moment du règlement).
- **Je ne saisis jamais de coordonnées bancaires moi-même** : c'est le coach (son
  RIB) et le client (son virement, dans sa banque). L'app ne fait que présenter et
  faciliter — elle n'exécute aucun paiement.

---

## 3. QR code & timeline de la journée

### État réel
- `oxv:checkin:<registrationId>` (pass présence, `pass-oxv.tsx`, `react-native-qrcode-svg`).
- `partner_leads.channel = 'qr_event'` **déjà prévu** → le QR-au-stand est anticipé.

### Rôle du QR dans la journée — propositions (touchpoints)
| Moment | QR | Apporte |
|---|---|---|
| **Arrivée / accueil** | Le pilote présente son QR pass → staff scanne (check-in) | Registre de présence temps réel (console direction P4), fin des listes papier |
| **Retrait boîtier** | Staff scanne pass → associe RaceBox ↔ pilote ↔ session | Traçabilité matériel, moins d'erreurs d'affectation |
| **Stand partenaire** | Le partenaire scanne le QR pilote (consentement) → lead `qr_event` | Capture de lead qualifiée sur place, mesurable (déjà prévu en base) |
| **Fin de journée** | QR sur la carte-trophée / le bilan → partage | Communication virale, chaque pilote devient relais OXV |
| **Coach** | QR de règlement (§2 option B) | Virement pré-rempli au coach |

### Ce que ça apporte au circuit / comment on avance
- **Boucle de présence** fermée → la console de direction (P4, déjà factuelle) devient
  utilisable en temps réel le jour J.
- **Communication** : le QR de partage (trophée) est le canal « tranquille » que tu
  évoques — pas d'agressivité, le pilote partage son moment, OXV apparaît.
- Reste à décider : périmètre du **scan côté staff** (app admin scan-checkin existe
  déjà : `(admin)/scan-checkin.tsx`) et côté **partenaire** (nouvel écran de scan ?).

---

## 4. « Construit mais pas encore exploitable — il manque un suivi »

Plusieurs briques existent sans **boucle de suivi** fermée :

| Brique | Existe | Boucle manquante |
|---|---|---|
| Santé boîtier | `deviceHealthService`, `device_health_logs` | Pas d'alerte/tableau : batterie faible, dérive GPS → prévenir avant la journée |
| Exports média | `mediaExportsService`, `media_exports` | Journalisé mais pas de relance « vos photos sont prêtes » ni de galerie retour |
| Analytics produit | `analyticsService`, `analyticsEvents` | Événements émis, **pas consommés** dans un tableau de pilotage |
| Notifications push | `pushNotificationsService`, `notifPreferences` | Service prêt, **boucle d'envoi** (déclencheurs métier) non câblée |
| Leads partenaires | `partner_leads` | Créés, mais **pas de relance** ni de statut de suivi partagé au partenaire |

**Automatisations à câbler (côté serveur, edge functions / triggers)** :
1. Pilote inscrit → **rappel J-2** (préparation, météo, pass).
2. Bilan calculé → **notification « votre lecture est prête »**.
3. Lead partenaire créé → **e-mail/notif au partenaire** + statut.
4. Facture coach émise → **notification au pilote** (déjà partiellement en prod, cf. audit `generate-invoice`).
5. Boîtier santé dégradée → **alerte staff** avant la session.

---

## 5. Tableau récapitulatif des connexions

| Connexion | Mécanisme | Statut | Action |
|---|---|---|---|
| Site (offre partenaire) → App (catalogue) | Supabase `partner_offers` partagé | 🟢 données prêtes | Construire la page catalogue app (zéro schéma) |
| App (intérêt pilote) → Partenaire | `partner_leads` + notif | 🟡 lead OK, notif à câbler | Edge function notif partenaire |
| Coach RIB → Pilote (virement) | `payment_link` (A) / IBAN+QR SEPA (B) | 🟡 A prêt, B à décider | Cf. décision paiement |
| Pass pilote → Staff (check-in) | QR `oxv:checkin` + scan admin | 🟢 existe | Fermer la boucle présence temps réel |
| Pilote → Partenaire au stand | QR `qr_event` | 🟡 prévu en base | Écran de scan partenaire (à décider) |
| Bilan/évènement → Pilote | push | 🔴 service prêt, envoi non câblé | Déclencheurs métier |

Légende : 🟢 prêt · 🟡 partiel · 🔴 à câbler.

---

## 6. Décisions attendues (fondateur)

1. **Catalogue — cadre doctrine** : on valide le catalogue **navigable par catégorie**,
   sans push télémétrique (§0) ? (ma reco : oui)
2. **Paiement coach** : A (lien, maintenant) / B (RIB + QR SEPA) / **A puis B** (ma reco) ?
3. **Priorité de build** : catalogue pilote d'abord, ou boucles de suivi/notifs d'abord ?
4. **Mise en avant** : ajouter `partner_offers.featured` (1 colonne) pour les produits à la une ?

## 7. Buildable tout de suite — zéro schéma, zéro décision bloquante
- ✅ **Page catalogue pilote** (lecture `listMarketplace`, cartes par catégorie, lead au clic).
- ✅ **Bloc paiement coach par lien** (`payment_link` déjà en base).
- ✅ **QR de partage** sur la carte-trophée (déjà en place, à relier au flux de comm).

Le reste (IBAN/QR SEPA, `featured`, edge functions de notif, scan partenaire) attend
tes arbitrages ci-dessus.
