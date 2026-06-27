# Wireframes par écran

> Spéc opérationnelle des **écrans clés** de la refonte OXV Platform — pas les 55 routes.
> Réf. : `01_ORGANISATION_PRODUIT.md` (zones), `02_AUDIT_ROUTES.md` (routes réelles), `04_DESIGN_CANON.md` (loi visuelle).
> But : un document autonome, prêt à servir Claude Code pour cadrer chaque écran avant code.

## Comment lire ce document

Chaque écran suit le **même template** (10 lignes). Aucune dérogation.

| Champ | Ce qu'il dit |
|---|---|
| Nom | Libellé écran + route réelle (`app/(...)/...`) |
| Utilisateur | Pilote · Coach · Admin · Partenaire · Public |
| Objectif | La **seule** question à laquelle l'écran répond |
| Données affichées | Tables / services réels qui alimentent l'écran |
| Actions | Ce que l'utilisateur peut faire (navigation, toucher) |
| État vide | Aucune donnée |
| État erreur | Échec réseau / BLE / droits |
| État chargement | Pendant le fetch |
| Nav entrante | D'où on arrive |
| Nav sortante | Où l'on va |

**Rappels canon non négociables** appliqués partout :
- **Un seul chiffre dominant** par écran (cf. `04 §3`).
- **Or `#FFB703` = donnée uniquement** (jauge, barres, points). Jamais sur la nav, jamais en décor.
- **Rouge `#C8102E` = coach / REC uniquement**. La **bande coach** est le **seul** espace prescriptif.
- Côté pilote : **aucun verbe prescriptif** (freinez, corrigez, vous devez, évitez, erreur, mauvais). Autorisé : « à observer », « était-ce volontaire ? ».
- **Vouvoiement**, **aucun emoji**, **silence total en piste**.
- Nav pilote = 5 onglets **Paddock · Session · Bilan · Progression · Club**, Compte en icône haut-droite. Actif crème `#F8F9FA` / inactif `#54545C`.

**Légende statut** : **net-neuf** = écran à créer · **reskin** = route existante réalignée · **fusion** = assemble plusieurs routes existantes.

---

# 1. Espace Pilote

## 1.1 Paddock (hub) — *fusion `index` + `paddock`*

| | |
|---|---|
| **Nom** | Paddock · `app/(app)/index.tsx` (réconcilie `paddock.tsx`) |
| **Utilisateur** | Pilote |
| **Objectif** | Qu'est-ce qui compte **maintenant** ? |
| **Données affichées** | Salutation contextuelle (heure) · dernier bilan (`app_session_analyses` / `analysesService`) · prochaine sortie (`registrations`, `sessions`) · coach affilié (`coach_pilots_view` / `coachService`) · état équipement BLE · météo (`weather_snapshots` / `weatherService`). **Un seul chiffre** : **régularité au tour** (écart-type des temps, Geist Mono — déjà en code via `computeRegularity` / `fetchSessionLaps`). **La marge globale reste réservée au Bilan** — on ne la duplique pas (décision Gabin, cf. ticket `11` B1). |
| **Actions** | 1 action principale contextuelle (bouton primaire crème) + 2–3 raccourcis ghost max. Action selon le moment : avant → « Préparer ma session » · arrivée → « Connecter l'équipement » · après roulage → « Découvrir mon bilan » · note coach → « Lire la note » · hors événement → « Voir ma progression ». |
| **État vide** | Aucune session : titre serif « Bienvenue. », pas de mini-instrument, action « Préparer ma session ». |
| **État erreur** | Fetch bilan/coach échoué : carte dégradée silencieuse (on masque le bloc, pas d'alarme). Météo absente → bloc retiré, pas d'erreur affichée. |
| **État chargement** | Squelette de cartes (fond `rgba(255,255,255,0.025)`), pas de spinner plein écran. |
| **Nav entrante** | Lancement app (route par défaut) · retour onglet Paddock. |
| **Nav sortante** | Session (`equipement`) · Bilan (`bilan`) · Progression · `mon-coach` · `notifications`. |

> **Doctrine** : état « en piste » → le Paddock **n'affiche rien d'utile**, il renvoie à l'état silence (cf. 1.3 *Roulage*).

---

## 1.2 Session (hub de flux) — net-neuf (assemble les étapes)

| | |
|---|---|
| **Nom** | Session · `app/(app)/session` *(hub net-neuf)* orchestrant `equipement` → `placement` → `roulage` → `entre-runs` → `pilotage-fini` → `bilan-pret` |
| **Utilisateur** | Pilote |
| **Objectif** | Comment **rouler** sereinement ? |
| **Données affichées** | Position dans le flux linéaire (5 étapes) · état BLE RaceBox (`bluetoothService`) · session de capture en cours (`telemetry_sessions` / `captureSessionService`, `sessionTelemetryService`). Pas de chiffre dominant ici (écran de transition). |
| **Actions** | Avancer dans le flux (un seul CTA par étape). Pas de retour arrière destructif pendant capture. |
| **État vide** | Pas d'équipement jumelé → renvoi vers `equipement`. |
| **État erreur** | Erreur BLE → message en 3 temps (cf. `01 §Session`) : *que s'est-il passé ? qu'est-ce qui est préservé ? que puis-je faire ?* La capture déjà enregistrée est **toujours** présentée comme préservée. |
| **État chargement** | Connexion BLE en cours : indicateur discret (pas de plein écran bloquant). |
| **Nav entrante** | Onglet Session · Paddock (action « Préparer ma session »). |
| **Nav sortante** | `bilan-pret` → Bilan. |

### Étapes du flux (sous-écrans existants, *reskin*)

| Étape | Route | Objectif | Note doctrine |
|---|---|---|---|
| Équipement | `equipement.tsx` | Jumeler le RaceBox | États BLE clairs |
| Placement | `placement.tsx` | Se positionner sur le circuit | — |
| **Roulage** | `roulage.tsx` | **En piste** | **UI éteinte** (cf. 1.3) |
| Inter-runs | `entre-runs.tsx` | Pause entre deux runs | Pas de chiffre, repos |
| Retour stands | `pilotage-fini.tsx` | Fin de roulage | — |
| Bilan prêt | `bilan-pret.tsx` | Transition | Mini-instrument + CTA « Découvrir » |

---

## 1.3 Roulage — état « en piste » (silence) — *reskin*

| | |
|---|---|
| **Nom** | En piste · `app/(app)/roulage.tsx` |
| **Utilisateur** | Pilote |
| **Objectif** | **Ne rien afficher.** Enregistrer en silence. |
| **Données affichées** | **Rien d'utile.** Fond `#020202`, voyant REC rouge 16px (`#C8102E`) qui pulse lentement, « EN PISTE » Mono ls 0.4em, « L'app s'efface. » serif `#9A9AA3`, « Aucun écran. Aucun son. Conduisez. » `#54545C`. **Pas de tab bar, pas de données, pas de chrono** (cf. `04 §6`). |
| **Actions** | Aucune attendue. Capture télémétrie en arrière-plan (`captureSessionService` → `telemetry_frames`). |
| **État vide** | N/A (état lui-même minimal). |
| **État erreur** | Perte BLE en piste : **aucune alarme visuelle/sonore en mouvement**. L'incident est journalisé et présenté **au retour stands** uniquement (préservation d'abord). |
| **État chargement** | N/A. |
| **Nav entrante** | `placement` (départ run). |
| **Nav sortante** | `entre-runs` ou `pilotage-fini` (détection retour stands). |

> **Le seul écran où le silence prime sur toute information.** Aucune dérogation, jamais.

---

## 1.4 Bilan (hub) — le cœur — *reskin*

| | |
|---|---|
| **Nom** | Bilan · `app/(app)/bilan.tsx` |
| **Utilisateur** | Pilote |
| **Objectif** | Qu'est-ce que ma **dernière** session m'apprend ? |
| **Données affichées** | **Chiffre dominant unique** : marge globale (instrument 226–230, `marginCalculator` / `app_session_analyses`). Phrase miroir (mot qualitatif en *Instrument Serif italic*, ex. « Terrain apprivoisé »). **2 constats** (composant Fact) : 1 « à observer » (puce or) + 1 « à conserver » (puce vert), issus de `sessionInsightsEngine` / `app_segment_analyses`. **Bande coach** (rouge, seul espace prescriptif) si annotation existante (`coach_annotations` / `coachAnnotationsService`). |
| **Actions** | Toucher un constat → Virage Explorer. Toucher l'instrument / « Lecture détaillée » → **Data Lab**. Bande coach → lecture de la note. Partage → carte OXV Moment. |
| **État vide** | Aucune session analysée : message calme « Votre première lecture vous attend après le prochain roulage. » Pas d'instrument vide. |
| **État erreur** | Analyse incomplète (données partielles) : présenter ce qui est disponible, marquer le reste « en cours de lecture ». Jamais « erreur ». |
| **État chargement** | Arc d'instrument se remplit une fois à l'ouverture (~1s, dashoffset → valeur). |
| **Nav entrante** | `bilan-pret` · Paddock (« Découvrir mon bilan ») · onglet Bilan. |
| **Nav sortante** | `virage` · `data-lab` · `debrief` · `partage` / `carte-trophee` · note coach. |

> **Ordre de révélation** : retenir (le chiffre + le mot) → où regarder (les 2 constats) → pourquoi (Data Lab sur demande).

---

## 1.5 Data Lab (lecture détaillée) — net-neuf (assemblage)

| | |
|---|---|
| **Nom** | Data Lab · `app/(app)/data-lab` *(net-neuf, range les routes existantes)* |
| **Utilisateur** | Pilote |
| **Objectif** | Lire le détail technique **sur demande** (jamais imposé). |
| **Données affichées** | Sommaire des sous-vues rangées (cf. `02` décision RANGER) : Carte (`carte.tsx`) · Virages (`virage.tsx`) · Tours (`tours.tsx` / `laps`) · Heatmap (`heatmap.tsx`) · Replay (`replay.tsx`) · Insights (`insights.tsx` / `session_insights`) · Data brute lisible (`telemetry.tsx` / `telemetry_frames`). Pas de chiffre dominant (écran de sommaire). |
| **Actions** | Ouvrir une sous-vue. Comparer (`virage-comparer.tsx`). Exporter (`dataExportService` / `bilanPdfExportService`). |
| **État vide** | Pas de télémétrie exploitable → liste des couches grisées avec « disponible après lecture ». |
| **État erreur** | Une couche indisponible : la masquer ou la marquer « non disponible pour cette session », sans bloquer les autres. |
| **État chargement** | Chargement par couche (lazy), pas global. |
| **Nav entrante** | Bilan (« Lecture détaillée »). |
| **Nav sortante** | Toute sous-vue Data Lab · retour Bilan. |

---

## 1.6 Virage Explorer — *reskin*

| | |
|---|---|
| **Nom** | Virage · `app/(app)/virage.tsx` (+ comparaison `virage-comparer.tsx`) |
| **Utilisateur** | Pilote |
| **Objectif** | Comprendre **un** virage, factuellement. |
| **Données affichées** | Tracé du virage (carte locale) · profil vitesse/freinage (`brakingPointsService` / `segmentAnalysesService` / `app_segment_analyses` · `cornerDeepDiveService`). **Un chiffre dominant** : marge du virage (or). Constat factuel non prescriptif (« Entrée plus large qu'au tour précédent — était-ce volontaire ? »). |
| **Actions** | Naviguer virage suivant/précédent · comparer (soi vs soi, `duelService` côté personnel) · revenir à la carte. |
| **État vide** | Virage non couvert par la télémétrie → « Pas de donnée nette sur ce virage. » |
| **État erreur** | Segment corrompu → marquer « lecture incomplète », proposer le virage adjacent. |
| **État chargement** | Squelette du tracé + barre de vitesse. |
| **Nav entrante** | Bilan (constat) · Data Lab · `carte`. |
| **Nav sortante** | `virage-comparer` · virage adjacent · retour carte/Bilan. |

> **Interdit ici** : « freinez plus tôt », « trajectoire à corriger ». Autorisé : « à observer », « était-ce volontaire ? ».

---

## 1.7 Progression — *reskin (+ fusion `stats`)*

| | |
|---|---|
| **Nom** | Progression · `app/(app)/progression.tsx` (fusionne `stats.tsx`) |
| **Utilisateur** | Pilote |
| **Objectif** | Comment **j'évolue** ? (lecture de soi, jamais compétition) |
| **Données affichées** | **Un chiffre dominant** : tendance de la marge globale (`statsService` / `history_rollups` / `day_rollups`). Signature pilote (`pilotSignatureService` → `signature.tsx`, rangé) · indice de constance (`regularityService` / `regularite.tsx`) · comparateur **personnel** soi-vs-soi (`comparateur.tsx`). Courbe en or (donnée). **Aucun classement, aucun leaderboard.** |
| **Actions** | Filtrer par période · ouvrir comparateur personnel · ouvrir historique (`roulages.tsx`). |
| **État vide** | < 2 sessions : « Votre courbe se dessine dès la deuxième session. » |
| **État erreur** | Rollups indisponibles → afficher les sessions brutes disponibles. |
| **État chargement** | Squelette de courbe. |
| **Nav entrante** | Onglet Progression · Paddock (hors événement). |
| **Nav sortante** | `comparateur` · `regularite` · `roulages` · `signature` (Développement, V1.5). |

> **Comparateur amis** (`cote-a-cote/[friendId]`) **n'est pas ici** : il vit dans **Club**, et **seulement sur consentement** (`pilotConsentService`).

---

## 1.8 Club — *fusion (`social`, `amis`, `lieux`, `social-carte` rangés)*

| | |
|---|---|
| **Nom** | Club · `app/(app)/club` *(hub net-neuf)* — mon coach, découverte, partenaires, carte OXV, communauté |
| **Utilisateur** | Pilote |
| **Objectif** | Qui m'**entoure** ? |
| **Données affichées** | **Mon coach** mis en avant (`mon-coach.tsx` / `coach_pilots_view`) · découverte coachs (`coachs.tsx` / `coachMarketplaceService` / `coach_public_card`) · partenaires autour du prochain événement (`partners` / `placesService` / `ecosystemService`) · **La carte OXV** (`carte-oxv.tsx`, fusionne `lieux` + `social-carte`) · communauté/amis (`amis.tsx` / `friendshipsService` / `pilot_friendships`). Pas de chiffre dominant. |
| **Actions** | Ouvrir fiche coach · envoyer demande (`mes-demandes.tsx`) · ouvrir la carte · comparaison consentie entre amis. |
| **État vide** | Pas de coach affilié → bloc « Découvrir les coachs ». Pas d'amis → « Invitez un pilote ». |
| **État erreur** | Marketplace/partenaires indisponibles → masquer le bloc, garder la carte locale. |
| **État chargement** | Squelette par bloc. |
| **Nav entrante** | Onglet Club · Paddock (coach affilié). |
| **Nav sortante** | `mon-coach` · `coach/[id]` · `mes-demandes` · `carte-oxv` · `amis` · `cote-a-cote/[friendId]`. |

---

## 1.9 Compte (icône haut-droite) — *reskin*

| | |
|---|---|
| **Nom** | Compte · `app/(app)/profil.tsx` + `settings.tsx` + `notifications.tsx` + `donnees-securite.tsx` + `legal/[doc]` |
| **Utilisateur** | Pilote |
| **Objectif** | Comment je me **gère** ? |
| **Données affichées** | Profil (`pilotProfileService` / `users`) · véhicule (→ Garage V1.5, `vehicles`) · notifications (`notifPreferencesLogic`) · réglages · confidentialité & données RGPD (`donnees-securite.tsx` / `accountService` / `dataExportService`) · légal (`documents`). Pas de chiffre dominant (écran rangé). |
| **Actions** | Éditer profil · gérer notifications · export/suppression données (RGPD) · ouvrir documents légaux · déconnexion. |
| **État vide** | N/A (toujours un profil). |
| **État erreur** | Sauvegarde échouée → message neutre + conservation locale (offline-first, `offlineQueue`). |
| **État chargement** | Squelette de listes. |
| **Nav entrante** | **Icône Compte haut-droite** depuis tout onglet pilote. |
| **Nav sortante** | `settings` · `notifications` · `donnees-securite` · `legal/[doc]`. |

> **Discret, jamais devant le Bilan.** Accessible par icône, pas par onglet.

---

# 2. Espace Coach — `app/(coach)`

> Doctrine coach (cf. en-tête de `app/(coach)/index.tsx`) : **vouvoiement**, l'app est un miroir **pour le coach aussi** (il voit ce que le pilote vit, il interprète seul), lecture seule sur la data pilote. Le coach est le **seul** rôle autorisé à produire des annotations prescriptives (bande rouge côté pilote).

## 2.1 Dashboard coach — *reskin*

| | |
|---|---|
| **Nom** | Coach — Mes pilotes · `app/(coach)/index.tsx` |
| **Utilisateur** | Coach |
| **Objectif** | Quels pilotes demandent mon attention **maintenant** ? |
| **Données affichées** | Liste des pilotes affiliés filtrée par RLS (`coach_pilots_view` — actifs **et** consentis, via `coachService.listMyPilots`) · synthèse (`loadCoachDashboardSummary`) · file priorisée (`priorites.tsx` / `coachCurationService`). **Un chiffre dominant** : nombre de lectures en attente. |
| **Actions** | Ouvrir fiche pilote · file de lecture priorisée · demandes entrantes (`demandes.tsx`) · disponibilités (`disponibilites.tsx` / `coach_availability`). |
| **État vide** | Aucun pilote consenti → EmptyState « Aucun pilote ne partage encore ses sessions avec vous. » |
| **État erreur** | Réseau coupé → sortie du loading, liste vide gérée par EmptyState (comportement réel du fichier). |
| **État chargement** | `ActivityIndicator` discret. |
| **Nav entrante** | Lancement espace coach (SpaceSwitcher). |
| **Nav sortante** | `pilote/[id]` · `priorites` · `demandes` · `disponibilites` · `business` · `profil`. |

---

## 2.2 Fiche pilote (coach) — *reskin*

| | |
|---|---|
| **Nom** | Fiche pilote · `app/(coach)/pilote/[id]` |
| **Utilisateur** | Coach |
| **Objectif** | Comprendre **ce pilote** avant de lire sa data. |
| **Données affichées** | Contexte pilote (`coachSessionContextService` / `coach_session_context`) · historique roulages partagés (`coach_roulages` / `coachReadingService`) · objectifs (`coach_objectives` / `pilotGoalsService`) · repères du coach (`coach_corner_reference` / `coachReferenceService`). **Un chiffre dominant** : marge globale dernière session du pilote (lecture seule). Permissions vérifiées (`coachPermissionsService` / `coach_has_permission`). |
| **Actions** | Ouvrir lecture/annotation · comparer (`comparer.tsx`, `comparer-pilotes.tsx`) · consigner un repère · ouvrir contexte (`contexte.tsx`). |
| **État vide** | Pilote sans session lisible → « Pas encore de session partagée. » |
| **État erreur** | Permission révoquée (consentement retiré) → accès bloqué, message neutre. |
| **État chargement** | Squelette de fiche. |
| **Nav entrante** | Dashboard coach · file priorisée. |
| **Nav sortante** | `lecture` · `annoter` · `comparer` · `reperes` / `repere/[index]`. |

---

## 2.3 Lecture & annotation — *reskin*

| | |
|---|---|
| **Nom** | Lecture / Annoter · `app/(coach)/lecture.tsx` + `app/(coach)/annoter.tsx` |
| **Utilisateur** | Coach |
| **Objectif** | Lire la session du pilote et **déposer une note** (overlay sur la data). |
| **Données affichées** | Télémétrie du pilote (lecture seule) · gabarits d'annotation (`coach_annotation_template` / `gabarits.tsx`) · annotations existantes (`coach_annotations` via `coachAnnotationsService`, ciblées virage/tour). Overlay d'annotation sur la data (net-neuf, cf. `02` écrans net-neufs coach). **Un chiffre dominant** : marge du segment lu. |
| **Actions** | Sélectionner un virage/tour · rédiger une note (depuis gabarit ou libre) · publier → devient la **bande coach rouge** côté pilote · éditer/retirer sa note. |
| **État vide** | Aucune annotation → invite à en créer une (côté coach uniquement). |
| **État erreur** | Publication échouée → conserver le brouillon, réessayer ; aucune note partielle visible côté pilote. |
| **État chargement** | Squelette de timeline + télémétrie. |
| **Nav entrante** | Fiche pilote · file priorisée. |
| **Nav sortante** | Retour fiche pilote · `gabarits` · `reperes`. |

> **C'est ici que naît le seul contenu prescriptif de l'app pilote.** Forme imposée côté pilote : eyebrow « DE VOTRE COACH » Mono 10 `#C8102E`, citation *Instrument Serif* 17, idéalement une **question ouverte** (cf. `04 §4 Bande coach`).

---

# 3. Espace Admin — `app/(admin)`

## 3.1 Qualité data — net-neuf

| | |
|---|---|
| **Nom** | Qualité data · `app/(admin)/qualite-data` *(net-neuf — manque identifié dans `02`)* |
| **Utilisateur** | Admin |
| **Objectif** | Les données capturées sont-elles **fiables** ? |
| **Données affichées** | Sessions de capture et taux d'exploitabilité (`telemetry_sessions` / `telemetry_frames` / `sessionTelemetryService`) · sessions analysées vs brutes (`app_session_analyses`, `app_segment_analyses`) · tableau de bord (`stats_dashboard` / `analyticsService`) · journal d'audit (`admin_audit`). **Un chiffre dominant** : % de sessions exploitables sur la période. |
| **Actions** | Filtrer par circuit/période (`circuit.tsx`) · ouvrir une session suspecte · marquer/relancer une ré-analyse. |
| **État vide** | Aucune capture sur la période → « Aucune session à inspecter. » |
| **État erreur** | Agrégat indisponible → afficher les sessions brutes consultables. |
| **État chargement** | Squelette de tableau. |
| **Nav entrante** | `app/(admin)/index.tsx` (hub admin). |
| **Nav sortante** | Détail session · `analytique.tsx` · `sessions-media.tsx`. |

> **Note schéma** : si la traçabilité qualité exige des colonnes/table dédiées (ex. statut d'exploitabilité, motif de rejet), c'est un **changement de schéma Supabase À SOUMETTRE à l'accord de Gabin — nécessite accord**. Ne rien présenter comme acquis ; v1 s'appuie sur les tables existantes (`telemetry_sessions`, `app_session_analyses`, `admin_audit`).

---

# 4. Espace Partenaire — `app/(partner)` (n'existe pas encore)

## 4.1 Dashboard partenaire — net-neuf

| | |
|---|---|
| **Nom** | Partenaire — Tableau de bord · `app/(partner)/index` *(espace entièrement net-neuf, cf. `02`)* |
| **Utilisateur** | Partenaire |
| **Objectif** | Quelle est ma **présence** dans l'écosystème OXV ? |
| **Données affichées** | Fiche partenaire (`partners` / `ecosystemService` / `placesService`) · présence sur **La carte OXV** (`points-carte` côté admin) · événements liés (`registrations` / `sessions`). **Un chiffre dominant** : exposition (vues fiche / présences événement). En **V1 = annuaire** ; leads/offres/réservations en **V1.5** (cf. `03_MVP_SCOPE`). |
| **Actions** | V1 : consulter sa fiche, ses créneaux d'événement. V1.5 : gérer offres, voir leads, réservations. |
| **État vide** | Partenaire sans événement à venir → « Aucun événement programmé. » |
| **État erreur** | Données écosystème indisponibles → fiche statique en repli. |
| **État chargement** | Squelette de cartes. |
| **Nav entrante** | Connexion espace partenaire (SpaceSwitcher). |
| **Nav sortante** | `offres` · `leads` · `reservations` · `performance` · `profil` (tous V1.5). |

> **Note schéma** : leads, offres réservables et métriques de performance partenaire dépassent les tables actuelles (`partners`, `corporate_leads`). Toute extension (table `partner_offers`, `partner_leads`, métriques) est un **changement de schéma À SOUMETTRE — nécessite accord de Gabin**. V1 reste un annuaire en lecture sur l'existant.

---

# 5. Public

## 5.1 Page de partage (OXV Moment) — *reskin*

| | |
|---|---|
| **Nom** | Partage public · `app/(app)/share/[token]` (généré depuis `partage.tsx` / `carte-trophee.tsx`) |
| **Utilisateur** | Public (non authentifié) |
| **Objectif** | Montrer **un moment**, sobrement, sans exposer de données privées. |
| **Données affichées** | Carte OXV Moment générée (`sharesService` / `app_progression_shares` / `sessions_public` / `get_shared_progression`). **Un chiffre dominant** : marge globale du moment partagé (or). Aucune donnée brute, aucune coordonnée GPS détaillée. |
| **Actions** | Voir · télécharger l'image · ouvrir l'app (CTA). Aucune action sur la donnée. |
| **État vide** | Token révoqué/expiré → « Ce partage n'est plus disponible. » |
| **État erreur** | Token invalide → page neutre, pas de fuite d'information. |
| **État chargement** | Image en cours de génération (`view-shot`). |
| **Nav entrante** | Lien externe (web/social). |
| **Nav sortante** | Store / page d'accueil app. |

---

# Synthèse des écrans net-neufs (à créer)

| Écran | Espace | Rôle | Priorité (cf. `03`) |
|---|---|---|---|
| Session (hub de flux) | Pilote | Orchestrer Équipement → … → Bilan prêt | V1 |
| Data Lab (assemblage) | Pilote | Sommaire des sous-vues détaillées | V1 |
| Club (hub) | Pilote | Mon coach + découverte + carte + communauté | V1 |
| Compte (hub icône) | Pilote | Regrouper profil/réglages/RGPD/légal | V1 |
| Overlay d'annotation | Coach | Note coach posée sur la data | V1 |
| File de lecture priorisée | Coach | Pilotes à lire en premier | V1 |
| Qualité data | Admin | Fiabilité des captures | V1 |
| Espace Partenaire (dashboard) | Partenaire | Annuaire V1, leads/offres V1.5 | V1 annuaire / V1.5 |

# Rappels finaux de conformité

1. **Un seul chiffre dominant par écran** — vérifié écran par écran ci-dessus.
2. **Or = donnée, rouge = coach/REC** — jamais d'or sur la nav, jamais de rouge décoratif.
3. **Silence en piste** — `roulage.tsx` n'affiche rien d'utile, aucune notif, aucun son.
4. **Aucun verbe prescriptif côté pilote** — seule la **bande coach** porte du prescriptif, idéalement en question ouverte.
5. **Tout nouveau schéma Supabase = À SOUMETTRE à Gabin (nécessite accord)** — Qualité data et Espace Partenaire s'appuient d'abord sur les tables existantes.
6. **Vouvoiement systématique, aucun emoji** dans l'app.
