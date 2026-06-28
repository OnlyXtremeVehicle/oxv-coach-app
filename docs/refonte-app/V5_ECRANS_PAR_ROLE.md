# V5 — Écrans par rôle (spécification exécutable)

> Un même écosystème OXV, **cinq expériences** : Pilote · Pilote Pro · Coach · Partenaire B2B · Admin.
> Règle produit cardinale : **chaque rôle voit uniquement ce qui l'aide à agir ; jamais ce qui ne le concerne pas.**
> État au 2026-06-28. Dérivé des CDC V2/V3/V4 + de la cartographie validée par Gabin.
> Ce document **détaille** ; [PLAN_ECRANS_PAR_ROLE.md](PLAN_ECRANS_PAR_ROLE.md) reste la roadmap courte.

---

## 0. Conventions

**Statut** (ancré sur le repo, pas sur l'intention) :
- `EXISTE` — écran présent et fonctionnel ; fichier cité. Une ligne, pas de re-spec.
- `À COMPLÉTER` — écran présent mais un volet V5 manque ; on liste seulement le delta.
- `À CRÉER` — écran absent. Gabarit **complet à 9 champs**.

**Gabarit à 9 champs** (pour tout `À CRÉER`) : Objectif · Données · Actions · État vide · État erreur · Permissions · Fichiers · Acceptation · Schéma.

**Priorité** : `P1` alpha sécurisée · `P2` public-ready · `P3` innovation V4.

**Légende schéma** : toute nouvelle table est marquée **STOP** — création conditionnée à l'accord explicite de Gabin (méthode : 1 PR = 1 slice, pas de schéma sans validation).

**Doctrine non négociable rappelée à chaque sortie** : miroir jamais coach ; aucun verbe prescriptif ; un seul chiffre/visuel dominant par écran ; vouvoiement ; **aucun emoji** ; or = donnée (jamais déco/nav/CTA) ; rouge = marque/REC ; silence total en piste (S6) ; **le partenaire ne voit jamais la télémétrie** ; toute sortie IA est descriptive/interrogative, post-session, validée par l'humain.

**Structure cible confirmée** (on garde l'existant pour ne pas renommer les routes) :
```
app/
├── (app)/      = Pilote            (riche)
├── (pro)/      = Pilote Pro        (fondation posée)
├── (coach)/    = Coach             (riche)
├── (partner)/  = Partenaire B2B    (marketplace posée)
├── (admin)/    = Admin             (control tower posée)
├── (onboarding)/ (coach-onboarding)/ (auth)/ = tunnels d'entrée
└── (app)/legal, notifications, settings…     = système/partagé
```

---

## 1. Matrice de permissions (source de vérité)

| Écran / action | Pilote | Pilote Pro | Coach | Partenaire | Admin |
|---|:--:|:--:|:--:|:--:|:--:|
| Voir ses sessions | Oui | Oui | Si autorisé | **Non** | Oui |
| Data Lab détaillé | Oui | Oui | Si autorisé (gradué) | **Non** | Oui |
| Annoter une session | Note perso | Note perso | Oui | **Non** | Oui |
| Créer un programme | Non | Non | Oui | **Non** | Oui |
| Créer une offre | Non | Non | Non | Oui | Oui |
| Voir des leads | Non | Non | Non | **Les siens** | Oui |
| Voir la télémétrie | La sienne | La sienne | Si consentie (niveau) | **Jamais** | Encadré |
| Gérer les devices | Non | Non | Non | Non | Oui |
| Valider coach / partenaire | Non | Non | Non | Non | Oui |
| Business dashboard | Non | Limité (ambassadeur) | Limité (le sien) | Le sien | Oui |

Garde-fous techniques en place : RLS own-row (pilote/pro), `is_detailed_coach_of()` (coach gradué, migration 0014), `owns_partner_account()` + deny télémétrie (0017), `is_admin()` partout côté admin, trigger d'audit sur changement de rôle (0015).

---

## 2. Espace Pilote `(app)` — *expérience terrain*

Navigation (verrouillée) : **Paddock · Session · Bilan · Progression · Club** + Compte (icône). L'or interdit sur la nav.

### Existant (re-spec inutile)
- **Paddock** — `EXISTE` `app/(app)/paddock.tsx` (accueil contextuel : prochaine session, dernier bilan, équipement, coach, action principale).
- **Session / lancement** — `EXISTE` `session/index.tsx`, `equipement.tsx`, `placement.tsx`.
- **Roulage silencieux** — `EXISTE` `roulage.tsx` (P0 silence : handler notif neutralisé en S6, PR-A).
- **Bilan** — `EXISTE` `bilan.tsx`, `bilan-pret.tsx`.
- **Data Lab** — `EXISTE` `data-lab.tsx` (+ `tours.tsx`, `regularite.tsx`, `heatmap.tsx`, `replay.tsx`, `comparateur.tsx`, `telemetry.tsx`).
- **Virage Explorer** — `EXISTE` `virage.tsx`, `virage-comparer.tsx`.
- **Moments à relire** — `EXISTE` `insights.tsx`, `insight/[reading].tsx`.
- **Signature de conduite** — `EXISTE` `signature.tsx` (radar empreinte, PR-G).
- **Progression** — `EXISTE` `progression.tsx`, `objectifs.tsx`, `prochaine-fois.tsx`, `stats.tsx`.
- **Coach (côté pilote)** — `EXISTE` `mon-coach.tsx` (accès gradué + retrait consentement), `coachs.tsx`, `coach/[id].tsx`, `mes-demandes.tsx`.
- **Club** — `EXISTE` `carte-oxv.tsx` (carte+liste fusionnées), `partenaires.tsx` (lead consenti), `amis.tsx`, `cote-a-cote/`, `carte-trophee.tsx`, `partage.tsx`, `share/[token].tsx`.
- **Compte / système** — `EXISTE` `compte/index.tsx`, `profil.tsx`, `settings.tsx`, `notifications.tsx`, `donnees-securite.tsx`, `legal/[doc].tsx`.

### P-A · Pass OXV — `À CRÉER` · **P2**
- **Objectif** : écran central de la journée d'événement — preuve d'accès + tout le contexte logistique en un endroit.
- **Données** : QR code (token check-in), événement, circuit, heure d'arrivée, briefing (statut lu/non lu), équipement assigné, coach affilié, documents, lien support.
- **Actions** : afficher QR plein écran, valider le briefing, voir le programme, contacter le support, ouvrir la fiche équipement.
- **État vide** : aucun événement à venir → « Aucun rendez-vous piste programmé. » + lien Paddock. Pas de QR.
- **État erreur** : token non généré / hors-ligne → afficher le dernier QR mis en cache + bandeau « Hors ligne — code valable à présenter à l'accueil ».
- **Permissions** : pilote propriétaire (own-row) ; le QR encode un token signé non rejouable.
- **Fichiers** : `app/(app)/pass-oxv.tsx` ; `src/services/passOxvService.ts` (token + cache MMKV) ; lib QR (`react-native-qrcode-svg`, à valider en dépendance).
- **Acceptation** : QR lisible hors-ligne ; briefing validable une fois ; aucun chiffre de perf affiché ; vouvoiement ; zéro emoji.
- **Schéma** : dépend du **concept « événement »** (cf. §5 B2B Report et §6 Admin Événements) — **STOP** `events`, `event_registrations`.

### P-B · Préparation session — `À COMPLÉTER` (aujourd'hui dilué dans `equipement`/`paddock`) · **P2**
- **Delta** : regrouper checklist pilote, documents, briefing, **intention personnelle** (champ libre, jamais pré-rempli), météo (service existant), consignes logistiques. **Aucune consigne de pilotage.**
- **Fichiers** : `app/(app)/preparation.tsx` ; réutilise `weatherService`.
- **Acceptation** : l'app ne suggère jamais le texte d'intention ; météo = donnée brute, pas de conseil.

### P-C · Garage — `À CRÉER` · **P2** *(1re tranche recommandée, partagée avec le Pilote Pro)*
- **Objectif** : mémoire matérielle du pilote — véhicules et réglages, pour relier la donnée au matériel.
- **Données** : véhicules ; par véhicule : pneus, freins, setup, **pression départ / retour**, historique des réglages horodaté.
- **Actions** : ajouter/éditer un véhicule, consigner un setup (pressions, notes), consulter l'historique par voiture.
- **État vide** : « Aucun véhicule enregistré. » + CTA « Ajouter un véhicule ».
- **État erreur** : échec d'écriture → conserver la saisie locale, bandeau « Enregistrement différé ».
- **Permissions** : own-row strict (RLS `auth.uid() = user_id`).
- **Fichiers** : `app/(app)/garage.tsx` ; `src/services/garageService.ts` ; composant `VehicleCard`, `SetupLogRow`.
- **Acceptation** : pressions en bar (fr), un véhicule « principal » par défaut, aucun jugement sur les réglages (miroir).
- **Schéma** : **STOP** `vehicles` (si pas déjà couvert par `vehicle_id` existant), `vehicle_setups` (véhicule, date, pneus, freins, pression_av/ar, notes).

### P-D · Passeport Pilote — `À CRÉER` · **P2**
- **Objectif** : identité piste cumulative — la carte d'identité sportive du pilote (et la vue qu'en aura le coach).
- **Données** : identité, nb de sessions, circuits pratiqués, **signature de conduite** (réutilise le radar PR-G), axes de développement, coach affilié, cycles terminés. **Un seul visuel dominant : le radar.**
- **Actions** : ouvrir la signature en grand, voir l'historique des circuits ; (côté coach : lecture seule, cf. §4).
- **État vide** : pilote sans session → passeport « en devenir », radar grisé + « Votre empreinte se dessinera après vos premières sessions. »
- **État erreur** : données partielles → afficher ce qui est disponible, jamais d'axe inventé.
- **Permissions** : own-row ; lecture coach via `is_coach_of()`.
- **Fichiers** : `app/(app)/passeport.tsx` ; réutilise `pilotSignatureService` + `RadarEmpreinte`.
- **Acceptation** : aucune note globale/score unique de « niveau » ; axes formulés en termes neutres (cap, visée, plongée…).
- **Schéma** : aucun (agrège l'existant).

### P-E · Carnet pilote — `À CRÉER` · **P3**
- **Objectif** : ressenti libre après session, propriété du pilote.
- **Données** : note texte, (note vocale plus tard), partage coach optionnel, historique.
- **Actions** : écrire, (dicter — V4), partager au coach, relire.
- **État vide** : « Aucune note. Ce carnet est à vous. »
- **État erreur** : sauvegarde différée hors-ligne.
- **Permissions** : own-row ; partage explicite et révocable vers le coach.
- **Fichiers** : `app/(app)/carnet.tsx` ; `src/services/pilotNotesService.ts`.
- **Acceptation** : **l'app ne pré-remplit ni ne suggère jamais** le contenu ; partage = acte explicite.
- **Schéma** : **STOP** `pilot_notes` (puis `pilot_voice_notes` + `audio_url` en V4).

### P-F · Support (pilote) — `À CRÉER` · **P1** *(2e tranche recommandée, paire avec l'Admin Support)*
- **Objectif** : signaler un problème simplement, sans quitter l'app.
- **Données** : catégorie (équipement / bilan / data / question coach / demande RGPD), session liée optionnelle, device lié optionnel, message, statut.
- **Actions** : créer un ticket, suivre son statut, répondre.
- **État vide** : « Aucune demande en cours. »
- **État erreur** : envoi impossible → conserver le brouillon, réessayer.
- **Permissions** : own-row ; l'admin lit/répond (§6).
- **Fichiers** : `app/(app)/support.tsx` ; `src/services/supportService.ts`.
- **Acceptation** : la demande RGPD ouvre la bonne catégorie ; ton sobre ; pas de promesse de délai automatique.
- **Schéma** : **STOP** `support_tickets`, `support_messages` (statut P0/P1/P2/P3 côté admin).

---

## 3. Espace Pilote Pro `(pro)` — *performance, média, partage contrôlé*

Fondation `EXISTE` (PR-I) : `_layout.tsx` (guard `role='pro_pilot'`), `index.tsx` (hub réutilisant Bilan/Data Lab/Signature/Progression du pilote, sans duplication). Le pro **est** un pilote (RLS own-row) ; on ajoute des outils, on ne refait pas le moteur.

Navigation cible : **Paddock Pro · Performance · Média · Équipe · Partage**.

### PRO-1 · Paddock Pro — `À COMPLÉTER` (le hub actuel en tient lieu) · **P2**
- **Delta** : remonter sessions récentes, objectifs actifs, coach/équipe, médias à valider, demandes OXV.
- **Fichiers** : enrichir `app/(pro)/index.tsx`.

### PRO-2 · Performance avancée — `À CRÉER` · **P3**
- **Objectif** : lecture plus fine que le pilote courant — comparaison et tendances, toujours descriptives.
- **Données** : sessions comparées, tours de référence, évolution par circuit, comparaison setup, multi-véhicules.
- **Actions** : sélectionner deux sessions/tours, basculer une couche, filtrer par circuit/véhicule.
- **État vide** : moins de 2 sessions comparables → « Encore une session et la comparaison s'ouvre. »
- **État erreur** : data manquante → afficher la disponibilité (cf. Data Confidence §7), jamais d'extrapolation.
- **Permissions** : own-row.
- **Fichiers** : `app/(pro)/performance.tsx` ; réutilise `comparateur`/`dataLabService`.
- **Acceptation** : aucune recommandation de pilotage ; un seul indicateur dominant par vue.
- **Schéma** : aucun (agrège l'existant) ; option **STOP** `pilot_digital_twins` (jumeau) si tendances persistées.

### PRO-3 · Bibliothèque de sessions — `À CRÉER` · **P3**
- **Objectif** : retrouver n'importe quelle session par critères.
- **Données** : toutes les sessions ; filtres circuit / véhicule / setup / météo / coach.
- **Actions** : filtrer, ouvrir, exporter.
- **État vide** : « Aucune session pour ces filtres. »
- **État erreur** : liste partielle → bandeau « Certaines sessions n'ont pas pu être chargées. »
- **Permissions** : own-row.
- **Fichiers** : `app/(pro)/bibliotheque.tsx` ; `roulages.tsx` existant sert de base.
- **Acceptation** : filtres combinables ; tri par date par défaut.
- **Schéma** : aucun.

### PRO-4 · Média Pro — `À CRÉER` · **P3**
- **Objectif** : gérer et valider ses contenus (souveraineté média pro).
- **Données** : vidéos, photos, OXV Moments, clips, contenus à publier.
- **Actions** : valider, exporter, partager, envoyer à OXV.
- **État vide** : « Aucun média. »
- **État erreur** : upload échoué → file d'attente, réessai.
- **Permissions** : own-row ; partage explicite.
- **Fichiers** : `app/(pro)/media.tsx` ; réutilise `session-media/`, Supabase Storage.
- **Acceptation** : rien n'est publié sans validation explicite du pilote pro.
- **Schéma** : réutilise le storage média existant.

### PRO-5 · Espace Équipe — `À CRÉER` · **P3**
- **Objectif** : déclarer son entourage et leurs droits.
- **Données** : coach principal, préparateur, assistant, contacts autorisés, droits d'accès.
- **Actions** : inviter, définir un niveau d'accès, révoquer.
- **État vide** : « Aucun membre d'équipe. »
- **État erreur** : invitation échouée → réessai.
- **Permissions** : own-row ; chaque accès accordé est explicite et révocable (réutilise la logique de consentement gradué).
- **Fichiers** : `app/(pro)/equipe.tsx` ; `src/services/proTeamService.ts`.
- **Acceptation** : un membre ne voit que ce qui lui est accordé ; révocation immédiate.
- **Schéma** : **STOP** `pro_team_members`.

### PRO-6 · Partage contrôlé — `À CRÉER` · **P3**
- **Objectif** : vitrine publique maîtrisée.
- **Données** : lien public profil, sessions partageables, médias validés, statistiques **non sensibles**.
- **Actions** : activer/désactiver le lien, choisir ce qui est exposé.
- **État vide** : « Profil public désactivé. »
- **État erreur** : génération de lien échouée → réessai.
- **Permissions** : own-row ; **jamais de télémétrie brute exposée publiquement**.
- **Fichiers** : `app/(pro)/partage.tsx` ; réutilise `share/[token]`.
- **Acceptation** : par défaut tout est privé ; l'exposition est opt-in champ par champ.
- **Schéma** : réutilise le mécanisme de token de partage.

### PRO-7 · Ambassadeur OXV — `À CRÉER` · **P3**
- **Objectif** : statut, missions et avantages ambassadeur.
- **Données** : statut, événements invités, missions contenu, publications, avantages.
- **Permissions** : own-row ; statut posé par l'admin.
- **Fichiers** : `app/(pro)/ambassadeur.tsx`.
- **Acceptation** : aucun classement entre ambassadeurs.
- **Schéma** : **STOP** `ambassador_profiles` (ou colonne sur le profil pro).

---

## 4. Espace Coach `(coach)` — *lecture, annotation, programme*

Navigation : **Accueil · Pilotes · Lectures · Programmes · Activité**.

### Existant
- **Dashboard / priorités** — `EXISTE` `priorites.tsx`.
- **File de lecture** — `EXISTE` `lecture.tsx`, `roulages/index.tsx`, `roulages/[id].tsx`, `roulages/nouveau.tsx` (file + demande pilote, PR-E).
- **Mes pilotes / fiche pilote** — `EXISTE` `pilote/[id].tsx`, `comparer-pilotes.tsx`.
- **Lecture session (Data Lab coach)** — `EXISTE` `lecture.tsx`, `comparer.tsx`, `contexte.tsx`.
- **Annotation** — `EXISTE` `annoter.tsx`, `reperes.tsx`, `repere/[index].tsx`.
- **Programmes / gabarits** — `EXISTE` `gabarits.tsx`.
- **Demandes d'affiliation** — `EXISTE` `demandes.tsx`.
- **Disponibilités** — `EXISTE` `disponibilites.tsx`.
- **Profil public coach** — `EXISTE` `profil.tsx`.
- **Activité / business** — `EXISTE` `business.tsx`.
- **AR** — `EXISTE` `ar.tsx` (prototype WebView assumé).

### C-1 · Coach AI Assistant — `À CRÉER` · **P3** · **bloqué par le filtre IA (§7)**
- **Objectif** : aider le coach à **prioriser** et **pré-rédiger** des observations — jamais prescrire, toujours validé humain.
- **Données** : suggestions de priorité de lecture, **pré-brouillons d'observations non prescriptifs**, signaux factuels (régularité, variabilité). Chaque sortie passe le filtre lexical.
- **Actions** : accepter/éditer/rejeter un brouillon, marquer comme validé avant envoi pilote.
- **État vide** : « Aucune suggestion. » (jamais de remplissage forcé)
- **État erreur** : IA indisponible → l'écran reste pleinement utilisable sans IA.
- **Permissions** : coach affilié + consentement pilote ; sortie jamais envoyée sans validation coach.
- **Fichiers** : `app/(coach)/assistant.tsx` ; `src/services/coachAiService.ts` ; **dépend** de `src/services/aiSafetyFilter.ts` (§7).
- **Acceptation** : 100 % des sorties passent le filtre ; aucun verbe prescriptif ne franchit l'UI ; tout est éditable et révocable ; rien n'est auto-envoyé.
- **Schéma** : **STOP** `coach_ai_suggestions`, `ai_safety_reviews`.

### C-2 · Programmes adaptatifs — `À CRÉER` · **P3**
- **Objectif** : cycles qualitatifs (≈3 sessions) avec recommandations **validées par le coach**.
- **Données** : cycle, étapes, objectifs qualitatifs, virages associés, statut.
- **Actions** : créer un cycle, ajouter une étape, associer des virages, clôturer.
- **État vide** : « Aucun cycle actif. »
- **État erreur** : sauvegarde différée.
- **Permissions** : coach affilié ; visible pilote si partagé.
- **Fichiers** : `app/(coach)/cycles.tsx` ; `src/services/developmentCycleService.ts`.
- **Acceptation** : objectifs formulés en observations, pas en ordres ; pas de score de réussite chiffré.
- **Schéma** : **STOP** `pilot_development_cycles`, `cycle_steps`.

### C-3 · Note vocale coach — `À COMPLÉTER` (annotation existe) · **P3**
- **Delta** : ajouter `audio_url` à l'annotation ; enregistrement + lecture.
- **Fichiers** : enrichir `annoter.tsx` ; Supabase Storage.
- **Schéma** : **STOP** colonne `audio_url` sur la table d'annotations.

---

## 5. Espace Partenaire B2B `(partner)` — *offres, leads, événements*

Le partenaire **ne vient pas analyser de la data piste**. Visibilité, services, leads, présence événement. **Aucune télémétrie, jamais** (deny-by-default RLS).

Navigation : **Accueil · Offres · Leads · Événements · Performance**.

### Existant (PR-F1→F4)
- **Dashboard** — `EXISTE` `index.tsx`.
- **Offres (CRUD)** — `EXISTE` `offres.tsx`.
- **Lead pilote consenti** — `EXISTE` côté pilote `app/(app)/partenaires.tsx` ; côté admin `app/(admin)/partenaires.tsx`.

### PA-1 · Profil partenaire — `À CRÉER` · **P2**
- **Objectif** : fiche entreprise validée par l'admin.
- **Données** : nom, type (photographe / garage / préparateur / hôtel / restaurant / transporteur / assurance / loueur / équipementier), description, zone géo, contact, logo, documents, **statut de validation admin**.
- **Actions** : éditer, soumettre à validation, téléverser logo/documents.
- **État vide** : profil incomplet → checklist de complétion.
- **État erreur** : upload échoué → réessai ; soumission bloquée si champs requis manquants.
- **Permissions** : `owns_partner_account()` ; statut modifiable seulement par l'admin.
- **Fichiers** : `app/(partner)/profil.tsx` ; étend `partnerService`.
- **Acceptation** : un partenaire non validé ne reçoit pas de leads ; statut clairement affiché.
- **Schéma** : `partner_accounts` existe (champs à compléter — **STOP** si ajout de colonnes).

### PA-2 · Créer / éditer une offre — `À COMPLÉTER` (CRUD existe) · **P2**
- **Delta** : champs complets — titre, catégorie, description, prix, **événement lié**, quota, date de validité, conditions, image.
- **Fichiers** : enrichir `offres.tsx`.
- **Schéma** : `offers` existe ; lien événement **STOP** (dépend de `events`).

### PA-3 · Leads reçus — `À COMPLÉTER` · **P2**
- **Delta** : liste filtrable par statut (nouveau / contacté / en cours / converti / perdu), offre concernée, événement, date, **consentement contact**.
- **Fichiers** : `app/(partner)/leads.tsx`.
- **Schéma** : `leads` existe (statut + consentement déjà prévus).

### PA-4 · Détail lead — `À CRÉER` · **P2**
- **Objectif** : agir sur un lead consenti.
- **Données** : nom pilote **si consentement**, contact, offre, événement, message, historique. **Aucune télémétrie. Jamais.**
- **Actions** : changer le statut, consigner un échange.
- **État vide** : (n/a — toujours ouvert depuis une liste)
- **État erreur** : mise à jour échouée → réessai.
- **Permissions** : `owns_partner_account()` ; lecture conditionnée au consentement explicite + `consent_at`.
- **Fichiers** : `app/(partner)/lead/[id].tsx` ; étend `partnerService`.
- **Acceptation** : si consentement absent/retiré → contact masqué ; zéro champ télémétrie présent dans la requête.
- **Schéma** : `leads` existe.

### PA-5 · Événements associés — `À CRÉER` · **P2** · dépend de `events`
- **Objectif** : préparer sa présence sur un événement.
- **Données** : prochains événements, présence validée, offres liées, consignes logistiques, contact OXV.
- **Actions** : confirmer présence, lier une offre.
- **Permissions** : `owns_partner_account()` ; présence validée par l'admin.
- **Fichiers** : `app/(partner)/evenements.tsx`.
- **Schéma** : **STOP** `events`, `event_partners`.

### PA-6 · Performance partenaire — `À CRÉER` · **P3**
- **Objectif** : mesurer son activité (dérivé, pas de nouveau schéma lourd).
- **Données** : vues profil, clics offres, leads, taux de conversion, événements performants.
- **Permissions** : le sien uniquement.
- **Fichiers** : `app/(partner)/performance.tsx`.
- **Acceptation** : agrégats dérivés des leads/vues ; aucune donnée d'autres partenaires.
- **Schéma** : dérivable ; **STOP** `partner_profile_views` si tracking de vues persisté.

### PA-7 · Facturation / abonnement — `À CRÉER` · **P3** *(phase Stripe séparée)*
- **Objectif** : plan, factures, commissions, paiements. **Hors périmètre alpha** — placeholder honnête.
- **Fichiers** : `app/(partner)/facturation.tsx`.
- **Schéma** : phase Stripe Connect dédiée.

---

## 6. Espace Admin `(admin)` — *opérations, sécurité, qualité, business*

Navigation : **Opérations · Utilisateurs · Data · Support · Business**.

### Existant
- **Préparation / en cours** — `EXISTE` `preparation.tsx`, `en-cours.tsx`.
- **Analytique** — `EXISTE` `analytique.tsx`.
- **Qualité Data** — `EXISTE` `qualite-data.tsx` (PR-D ; devices/anomalies).
- **Partenaires (validation)** — `EXISTE` `partenaires.tsx` (PR-F).
- **Coachs (validation)** — `EXISTE` `coachs.tsx`, `coachs/[id].tsx`.
- **Circuit / routes / médias / points-carte** — `EXISTE` `circuit.tsx`, `routes-certification.tsx`, `sessions-media.tsx`, `points-carte.tsx`.

### A-1 · Admin Dashboard — `À COMPLÉTER` (préparation/en-cours en tiennent lieu) · **P2**
- **Delta** : vue control-tower du jour — événement, pilotes présents, devices actifs, anomalies data, tickets support, coachs/partenaires à valider.
- **Fichiers** : `app/(admin)/index.tsx` (dashboard d'entrée).

### A-2 · Événements + Détail + Check-in — `À CRÉER` · **P2** · **socle du concept « événement »**
- **Objectif** : créer et opérer les journées piste — c'est la table pivot qui débloque Pass OXV, leads/offres liés événement, B2B Report.
- **Données** : liste (statut, circuit, date, pilotes, coachs, partenaires) ; détail (inscrits, check-in, briefing, devices assignés, coachs/partenaires présents, incidents) ; check-in (QR Pass OXV, documents, briefing, équipement remis, coach).
- **Actions** : créer/modifier/clôturer/exporter un événement ; valider présence, assigner un device, signaler un problème.
- **État vide** : « Aucun événement programmé. » + CTA créer.
- **État erreur** : scan QR invalide → message clair, pas de check-in fantôme.
- **Permissions** : `is_admin()` strict.
- **Fichiers** : `app/(admin)/evenements.tsx`, `evenements/[id].tsx`, `evenements/[id]/checkin.tsx` ; `src/services/eventsService.ts`.
- **Acceptation** : un device assigné apparaît côté Qualité Data (`source_device_id`) ; check-in idempotent.
- **Schéma** : **STOP** `events`, `event_registrations`, (réutilise `devices`/`device_assignments` PR-D).

### A-3 · Devices / Équipements — `À CRÉER` (tables PR-D faites) · **P2**
- **Objectif** : parc matériel et affectations.
- **Données** : RaceBox, Flic, batteries ; statut (disponible / assigné / en piste / retourné / maintenance / perdu), dernier signal, affectation, maintenance.
- **Actions** : CRUD device, assigner/rendre, marquer maintenance.
- **État vide** : « Aucun équipement enregistré. »
- **État erreur** : écriture échouée → réessai.
- **Permissions** : `is_admin()`.
- **Fichiers** : `app/(admin)/devices.tsx` ; `adminQualityService`/`src/services/devicesService.ts`.
- **Acceptation** : un device « en piste » est lié à une session ; cohérent avec Qualité Data.
- **Schéma** : `devices`, `device_assignments` **existent** (PR-D).

### A-4 · Utilisateurs — `À CRÉER` · **P1**
- **Objectif** : annuaire + gestion des rôles (audité).
- **Données** : pilotes, coachs, partenaires, admins, pro_pilots ; rôle, statut compte.
- **Actions** : **modifier un rôle** (déclenche le trigger d'audit 0015), suspendre, consulter l'historique, vérifier les consentements.
- **État vide** : recherche sans résultat.
- **État erreur** : changement de rôle refusé (RLS) → message explicite.
- **Permissions** : `is_admin()` ; chaque changement de rôle écrit dans `admin_audit`.
- **Fichiers** : `app/(admin)/utilisateurs.tsx`, `utilisateurs/[id].tsx` ; `src/services/adminUsersService.ts`.
- **Acceptation** : tout changement de rôle est tracé (vérifiable dans `admin_audit`) ; pas de suppression de compte sans double confirmation.
- **Schéma** : aucun (trigger d'audit déjà posé).

### A-5 · Support (admin) — `À CRÉER` · **P1** · paire avec P-F
- **Objectif** : traiter les tickets pilotes.
- **Données** : tickets ouverts, priorité (P0/P1/P2/P3), utilisateur, session liée, device lié, statut.
- **Actions** : prioriser, répondre, clôturer, relier à un device/session.
- **État vide** : « Aucun ticket ouvert. »
- **État erreur** : envoi de réponse échoué → brouillon conservé.
- **Permissions** : `is_admin()`.
- **Fichiers** : `app/(admin)/support.tsx`, `support/[id].tsx` ; `src/services/supportService.ts` (partagé pilote/admin).
- **Acceptation** : un ticket P0 remonte en tête ; le pilote voit le changement de statut.
- **Schéma** : `support_tickets`, `support_messages` **STOP** (mêmes tables que P-F).

### A-6 · Modération — `À CRÉER` · **P3**
- **Objectif** : traiter les signalements.
- **Données** : profils / offres / médias / notes coach signalés.
- **Actions** : valider, masquer, avertir.
- **Permissions** : `is_admin()`.
- **Fichiers** : `app/(admin)/moderation.tsx`.
- **Schéma** : **STOP** `moderation_reports`.

### A-7 · Analyse session admin — `À CRÉER` · **P3**
- **Delta** : statut analyse, logs, version algo, qualité data, erreurs ; relancer analyse / régénérer bilan/PDF / vérifier frames.
- **Fichiers** : `app/(admin)/analyse/[sessionId].tsx` ; étend `adminQualityService`.

### A-8 · Business Dashboard + Analytics + Paramètres — `À COMPLÉTER` (`analytique` existe) · **P3**
- **Delta** : KPI métier (actifs, captures, bilans/Data Lab ouverts, demandes coach, leads, taux capture, anomalies) — réutilise les `OxvEvent` (PR-C, Plausible) ; feature flags, versions algos.
- **Fichiers** : enrichir `analytique.tsx` ; `app/(admin)/parametres.tsx`.

---

## 7. Transverse (tous rôles) — innovations sûres d'abord

### T-1 · Filtre de sécurité IA — `À CRÉER` · **P1 (prérequis de toute sortie IA)**
- **Objectif** : garantir qu'aucune sortie générée ne franchit la doctrine (verbes prescriptifs interdits).
- **Fichiers** : `src/services/aiSafetyFilter.ts` + tests snapshot.
- **Acceptation** : la liste de verbes interdits (freinez, accélérez, vous devriez, il faut, évitez…) est bloquée à 100 % ; tests snapshot verrouillent la liste ; toute fonctionnalité IA (C-1, débrief enrichi) en dépend.
- **Schéma** : aucun.

### T-2 · Data Confidence Score — `À CRÉER` · **P3 (le plus sûr des V4)**
- **Objectif** : qualifier la lecture (complète / partielle / limitée) avec raisons.
- **Données** : niveau + raisons (GPS, frames manquantes, BLE perdu…). Dérivé de l'existant `dataLabLogic`.
- **Permissions** : pilote (le sien), coach (si autorisé), admin (toutes).
- **Fichiers** : `src/services/dataConfidenceLogic.ts` (pur) + bandeau dans `bilan`/`data-lab`.
- **Acceptation** : aucune session n'est présentée comme complète si elle ne l'est pas ; raisons honnêtes.
- **Schéma** : aucun (dérivable).

### T-3 · OXV Key Moments — `À CRÉER` · **P3**
- **Objectif** : surfacer factuellement les moments saillants (tour le plus constant, virage le plus variable, anomalie…).
- **Fichiers** : `src/services/keyMomentsLogic.ts` (pur) + intégration `insights`.
- **Acceptation** : descriptif, jamais prescriptif ; un moment = un fait, pas un conseil.
- **Schéma** : aucun.

---

## 8. Écrans partagés / système

`EXISTE` : Connexion `(auth)/login`, Onboarding pilote `(onboarding)/*`, Onboarding coach `(coach-onboarding)/*`, Profil `(app)/profil` + `(coach)/profil`, Notifications `(app)/notifications`, Légal `(app)/legal/[doc]`, Données/consentement `(app)/donnees-securite`, `+not-found`.

`À CRÉER` / `À COMPLÉTER` (P2-P3) : **Centre de consentement** unifié (regroupe RGPD + consentements coach/équipe/partage), **Mode offline** explicite, **Maintenance**, **Mise à jour obligatoire**. Fichiers : `app/(app)/consentements.tsx`, états globaux dans `app/_layout.tsx`.

---

## 9. Séquence de build priorisée (→ PR)

**P1 — Alpha sécurisée** (débloque un terrain propre) :
1. `T-1` Filtre de sécurité IA — *prérequis, petit, zéro schéma.*
2. `P-C` Garage + `A-3` Devices (tables PR-D déjà là) — valeur immédiate pilote + parc.
3. `P-F` + `A-5` Support (pilote ⇄ admin) — une seule paire de tables.
4. `A-4` Utilisateurs (gestion rôles auditée).

**P2 — Public-ready** :
5. `A-2` Événements + Check-in — **socle `events`** qui débloque Pass OXV, leads/offres événement, B2B Report.
6. `P-A` Pass OXV · `P-D` Passeport · `P-B` Préparation.
7. Partenaire : `PA-1` Profil · `PA-3/PA-4` Leads · `PA-5` Événements.
8. Coach : `C-2` Programmes adaptatifs.

**P3 — Innovation V4** :
9. `T-2` Data Confidence · `T-3` Key Moments.
10. `C-1` Coach AI (après `T-1`) · `C-3` Note vocale.
11. Pilote Pro `PRO-2→7` · Partenaire `PA-6` Performance · Admin `A-6/A-7/A-8`.
12. `PA-7` Facturation (phase Stripe séparée).

---

## 10. Dépendances schéma — récapitulatif (chaque ligne = **STOP** validation Gabin)

| Table | Pour | Priorité |
|---|---|---|
| `support_tickets`, `support_messages` | P-F + A-5 | P1 |
| `vehicles?` / `vehicle_setups` | P-C Garage | P1 |
| `events`, `event_registrations`, `event_partners` | A-2, P-A, PA-5, B2B Report | P2 |
| `pilot_notes` (puis `pilot_voice_notes`) | P-E Carnet | P3 |
| `pro_team_members` | PRO-5 | P3 |
| `pilot_development_cycles`, `cycle_steps` | C-2 | P3 |
| `coach_ai_suggestions`, `ai_safety_reviews` | C-1 | P3 |
| `moderation_reports` | A-6 | P3 |
| `b2b_event_reports` | Partenaire B2B Report | P3 |
| `ambassador_profiles?`, `partner_profile_views?` | PRO-7, PA-6 | P3 |
| `pilot_digital_twins?` | PRO-2 jumeau | P3 |

Déjà en place : `devices`, `device_assignments`, `data_quality_reports` (PR-D) ; `partner_accounts`, `offers`, `leads` (PR-F) ; helpers `is_admin/is_coach_of/is_detailed_coach_of/owns_partner_account/is_partner/is_pro_pilot` ; trigger d'audit rôle (0015).

---

> **Prochain pas concret** : commencer par `T-1` (filtre IA, zéro schéma) **ou** `P-C` Garage (1re tranche à valeur pilote+pro). Toute table marquée **STOP** attend votre accord avant migration.
