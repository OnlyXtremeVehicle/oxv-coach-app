# Critères de validation

> Définition objective de « réussi », zone par zone, fonction par fonction.
> Format : **« X réussi si : »** + puces vérifiables (testables à l'œil, au test, ou à la requête RLS).
> Réf. : `00_PLATEFORME_OXV.md` (nav, doctrine), `01_ORGANISATION_PRODUIT.md` (zones), `02_AUDIT_ROUTES.md` (routes réelles), `03_MVP_SCOPE.md` (périmètre V1), `04_DESIGN_CANON.md` (tokens).
> Statut : cadrage. Aucun nouveau schéma n'est acquis ici — toute table ou colonne marquée **« nécessite accord »** est à soumettre à Gabin avant code.

---

## 0. Comment lire ce document

- Une puce = un critère **binaire** : vérifiable comme vrai ou faux, sans interprétation.
- Trois familles de critères se croisent sur chaque écran : **fonctionnel** (l'écran fait son travail), **doctrine** (l'app montre, ne dirige pas), **accessibilité** (lisible, tactile, vocalisable).
- Les critères transverses (§1) s'appliquent à **tout** écran et ne sont pas répétés dans chaque section ; les sections par zone ne listent que le spécifique.
- Tables / services / écrans cités = **code réel** (cf. `src/services/*`, `app/(app|coach|admin)/*`, `src/types/database.types.ts`). Quand une fonction n'a pas encore de support en base, c'est dit et marqué « nécessite accord ».

---

## 1. Critères transverses — s'appliquent à TOUS les écrans

### 1.1 Doctrine

**Un écran est conforme doctrine si :**

- Il porte **un seul chiffre dominant** au plus. Sur le Bilan c'est la marge globale ; ailleurs, jamais deux instruments de même poids visuel.
- Côté **pilote**, aucun verbe prescriptif n'apparaît dans le texte rendu : interdits `freinez`, `corrigez`, `accélérez`, `vous devez`, `il faut`, `évitez`, `erreur`, `mauvais`, `faute`. Autorisés : `à observer`, `à explorer`, `était-ce volontaire ?`, `une chose, pas plus`, `à conserver`. (Vérifiable par grep sur les strings de l'écran et par revue du contenu généré, ex. `debriefGenerator.ts`, `sessionInsightsEngine.ts`.)
- L'**or `#FFB703`** n'apparaît **que** sur de la donnée (jauge, chiffre, points, barres `MeterBar`). Jamais sur la nav, jamais en décor, jamais sur un bouton.
- Le **rouge `#C8102E`** n'apparaît **que** pour le coach (bande « DE VOTRE COACH ») ou le voyant REC. Jamais pour signaler une « performance » ou un état décoratif.
- Le **vouvoiement** est systématique. Aucun tutoiement dans le contenu rendu.
- **Aucun emoji** n'est rendu à l'écran.
- La **bande coach** est le **seul** espace de l'app où une formulation peut être directive, et elle reste une question ouverte (Instrument Serif 17, bordure `#5A1A22`).

### 1.2 Design (canon — `04_DESIGN_CANON.md`)

**Un écran respecte le canon si :**

- Fonds, surfaces, bordures, textes sont pris **exactement** dans la palette §1 du canon (`#050505`, `#F8F9FA`, `#C9C9CE`, `#9A9AA3`, `#6E6E76`, `#54545C`, bordure `#1C1C20`…). Aucune couleur hors liste.
- Tous les **chiffres** sont en Geist Mono ; aucun **libellé** n'est en mono.
- Les **eyebrows** sont UPPERCASE, letter-spacing 0.18–0.24em, `#6E6E76`.
- Le **bouton primaire** (s'il y en a un) est crème `#F8F9FA` texte `#050505`, hauteur 54, en zone du pouce.
- La **tab bar** : actif `#F8F9FA`, inactif `#54545C`, label Mono 8.5 — **zéro or**.

### 1.3 Accessibilité

**Un écran est accessible si :**

- Toute cible tactile (bouton, ligne de liste, onglet, chevron actionnable) fait **≥ 44 px** de hauteur tactile (les lignes de liste à h~50 et la tab bar h88 satisfont déjà cela).
- Le texte reste **lisible au soleil** : contraste du texte primaire `#F8F9FA` sur fond `#050505` ≥ 7:1 ; aucun texte porteur d'information en `#54545C` seul (réservé inactif/faint).
- Chaque élément interactif a un **label VoiceOver/TalkBack** explicite (`accessibilityLabel` / `accessibilityRole`) ; un chiffre d'instrument est vocalisé avec son unité et son libellé (« marge globale, 72 pour cent »), pas « 72 » seul.
- L'**état** d'un contrôle (sélectionné, désactivé) est exposé à l'API d'accessibilité (`accessibilityState`).
- La couleur n'est **jamais le seul** porteur d'information : un constat « à observer » (puce or) vs « à conserver » (puce vert) est aussi distingué par son libellé.

### 1.4 Robustesse (offline / BLE / RLS)

**Un écran est robuste si :**

- Il gère trois états visibles : **chargement**, **vide**, **erreur** — chacun avec un texte sobre conforme au ton (cf. `09_UX_COPY_LIBRARY.md`).
- En **offline**, l'écran s'affiche depuis le cache local sans crash ; les écritures passent par `offlineQueue.ts` et ne sont pas perdues.
- Aucune donnée d'un autre utilisateur n'apparaît jamais (garanti par RLS — cf. `06_RLS_POLICIES_ACTUELLES.sql`) ; un défaut RLS se voit comme **liste vide**, pas comme fuite.

---

## 2. Pilote — par zone

### 2.1 Paddock (`app/(app)/index.tsx`, fusion de `paddock.tsx`)

**Paddock réussi si :**

- Un **seul Paddock** est rendu : `index` et `paddock` réconciliés, aucune entrée parallèle (cf. doublon `02_AUDIT_ROUTES.md`).
- L'écran affiche **une action principale contextuelle** + 2–3 raccourcis **maximum**, jamais une longue liste de liens.
- L'action principale change selon le moment réel : avant → « Préparer ma session » · arrivée → « Connecter l'équipement » · après roulage → « Découvrir mon bilan » · note coach reçue → « Lire la note » · hors événement → « Voir ma progression ».
- L'état **en piste** n'affiche **rien** d'utile (délégué à Session, UI éteinte).
- Le dernier bilan est atteignable en **1 tap**.
- Aucune donnée brute de partenaires/lieux ni réglage détaillé n'apparaît ici (renvoyés vers Club / Compte).
- Si aucune session n'existe encore, l'état vide propose une amorce sobre sans pression marketing.

### 2.2 Session (`equipement` → `placement` → `roulage` → `entre-runs` → `pilotage-fini` → `bilan-pret`)

**Le flux Session réussit si :**

- Le parcours est **linéaire et prévisible** : Équipement → Placement → Capture → Retour stands → Bilan prêt, sans branche cachée.
- L'état **en piste** (`roulage.tsx`) respecte le **silence total** : pas de tab bar, pas de données, pas de chrono, aucun son, aucune notification. Seul élément toléré : voyant REC rouge `#C8102E` qui pulse + « EN PISTE » Mono + « L'app s'efface. ». (Critère §6 du canon vérifié à l'écran.)
- Aucune **notification push** n'est déclenchée tant que l'état est « en piste » (cf. `pushNotificationsService.ts` + `14_NOTIFICATIONS.md`).
- Chaque **erreur BLE** répond aux trois questions : *que s'est-il passé ? qu'est-ce qui est préservé ? que puis-je faire maintenant ?* — jamais un code d'erreur brut.
- Une coupure BLE en cours de capture **ne perd pas** les frames déjà enregistrées (capture persistée localement via `captureSessionService.ts` / `telemetryStorage.ts`).
- La transition `bilan-pret` ne s'affiche **qu'après** le retour aux stands, jamais pendant le roulage.
- La reconnexion BLE est possible sans repartir de zéro.

### 2.3 Bilan (`app/(app)/bilan.tsx` — le cœur)

**Le Bilan réussit si :**

- La première chose vue après une session est **la marge globale** (un seul chiffre dominant, jauge or, instrument 226–230 px) + une **phrase miroir** + **2 constats factuels** (« une zone à observer » / « à conserver »).
- L'**ordre de révélation** est respecté : retenir → où regarder → pourquoi → détails techniques **sur demande seulement**.
- La **bande coach** (si une annotation existe) est le seul bloc rouge ; elle pose une question ouverte, jamais une consigne.
- Aucune sous-vue technique (carte, virages, tours, heatmap, replay, telemetry, insights) n'est une **entrée principale** : toutes sont atteintes **au toucher** depuis le hub / Data Lab.
- Le vocabulaire interdit (§1.1) est absent du contenu généré, y compris de `debriefGenerator.ts` et des insights.
- Si la session est **incomplète** (frames partielles, GPS dégradé), le Bilan le **dit calmement** et n'invente pas de chiffre ; il dégrade au lieu de mentir.

### 2.4 Data Lab (sous-vues du Bilan : `carte`, `virage`, `virage-comparer`, `tours`, `heatmap`, `replay`, `telemetry`, `insights`, `insight/[reading]`, `prochaine-fois`)

**Le Data Lab réussit si :**

- Toutes les sous-vues sont **rangées sous une porte unique** (« lecture détaillée »), accessibles depuis le Bilan, et non dupliquées comme onglets de premier niveau.
- Chaque sous-vue reste **factuelle** : elle décrit (vitesse, trajectoire, g, tour) sans prescrire. « Virage à observer », pas « prenez ce virage mieux ».
- La **donnée brute lisible** (`telemetry.tsx`) est consultable mais ne pousse aucune interprétation prescriptive.
- Le **comparateur de virages** (`virage-comparer`) compare **soi à soi** (deux tours du pilote), pas à un autre pilote sans consentement.
- Un replay **simple** est présent en V1 ; le replay avancé est reporté (`03_MVP_SCOPE.md`).
- Les couleurs respectent l'usage : or = donnée, jamais de rouge « performance ».
- L'assemblage `data-lab` net-neuf **nécessite accord** s'il implique une table ou colonne nouvelle ; sinon il n'orchestre que des écrans existants.

### 2.5 Progression (`progression`, `comparateur`, `regularite`, `signature`, `objectifs`, `roulages`, fusion `stats`)

**Progression réussie si :**

- L'écran montre une **lecture de soi**, jamais une compétition : **aucun classement, aucun leaderboard, aucune comparaison non consentie** n'est rendu.
- Le **comparateur** est **personnel** (soi vs soi : `comparateur.tsx`) ; toute comparaison entre pilotes vit dans Club et exige le consentement (`pilot_friendships`, `are_friends`).
- L'« **indice de constance** » (`regularite.tsx`, `regularityService.ts`) est présenté comme un repère personnel, pas comme une note.
- `stats` est **fusionné** dans Progression — aucune entrée parallèle (cf. doublon `02_AUDIT_ROUTES.md`).
- Le chiffre dominant de la vue globale est l'**évolution de la marge**, un seul.
- Les couches Développement (passeport, cycles, carnet, axes) sont marquées **V1.5** ; en V1, seule la **lecture** du passeport peut apparaître si elle n'exige pas de schéma nouveau.

### 2.6 Club (`mon-coach`, `coachs`, `coach/[id]`, `mes-demandes`, `amis`, `cote-a-cote/[friendId]`, `carte-oxv`, `circuits`, `circuit/[id]`, fusion `social`/`social-carte`/`lieux`)

**Club réussi si :**

- **Mon coach** (`mon-coach.tsx`) est **mis en avant** ; découverte coachs (`coachs.tsx`) et affiliation restent distinctes mais cohérentes.
- Une **seule carte** « La carte OXV » existe : `social-carte` et `lieux` fusionnés dans `carte-oxv` (doublon résolu).
- Un **seul** espace communauté : `social` fusionné dans `amis`.
- Toute **comparaison entre amis** (`cote-a-cote/[friendId]`) n'est rendue que si l'amitié est **mutuellement consentie** (`pilot_friendships`, RPC `are_friends`) ; sans consentement → écran neutre, pas la data de l'autre.
- Les **partenaires** affichés autour de l'événement sont uniquement ceux `is_published = true` (table `partners`) ; un partenaire non publié n'apparaît jamais côté pilote.
- L'annuaire partenaires V1 est en **lecture seule** ; offres/leads/réservations sont **V1.5**.

### 2.7 Compte (icône haut-droite : `profil`, `settings`, `notifications`, `donnees-securite`, `legal/[doc]`)

**Compte réussi si :**

- Le Compte est une **icône en haut à droite**, jamais un onglet de la tab bar, jamais devant le Bilan.
- **Confidentialité & données** (`donnees-securite.tsx`) permet au pilote, conforme RGPD : de voir ses données, de les **exporter** (`dataExportService.ts`), et de demander **suppression**.
- Le pilote peut **gérer son consentement coaching** depuis ici ou Club, et le **retirer sans justification** : `revokeConsent()` repasse `pilot_consent_at` à `null` et le coach cesse **immédiatement** de voir les données (vérifié par `is_coach_of` côté RLS).
- Les **réglages de notifications** respectent la règle « jamais en piste » et les préférences (`notifPreferencesLogic.ts`).
- Les **documents légaux** (`legal/[doc]`) sont accessibles et à jour.
- Les écrans `debug-capture` / `debug-circuit` sont **masqués en production**.

---

## 3. Coach — `app/(coach)`

### 3.1 Affiliation & consentement

**L'affiliation coach réussit si :**

- Un coach ne voit les données d'un pilote **que si** l'assignation `coach_pilots` est `active = true` **et** `pilot_consent_at IS NOT NULL` (logique `is_coach_of`, cf. `pilotConsentService.ts`).
- Le coach **ne peut pas** créer ni activer une affiliation lui-même : seul l'**admin** assigne (`app/(admin)/coachs/[id].tsx`) ; le coach ne peut pas modifier `coach_id`, `pilot_id` ni `active`.
- Au **retrait du consentement** par le pilote, l'accès du coach disparaît à la requête suivante, sans action du coach.
- Les permissions d'espace coach sont gouvernées par `coach_permissions` (`can_view_pilots`, `can_manage_own_sessions`, `can_view_business_dashboard`) via `coachPermissionsService.ts` ; un coach sans `can_view_business_dashboard` ne voit pas `business.tsx`.

### 3.2 Annotation (`annoter.tsx`, `lecture.tsx`, `reperes.tsx`, `repere/[index].tsx`, `coachAnnotationsService.ts`)

**L'annotation réussit si :**

- Une annotation coach écrite sur une session affiliée **apparaît côté pilote** dans la bande coach du Bilan, en rouge, comme **question ouverte**.
- L'annotation est **rattachée** à la bonne session/pilote (`coach_annotations`, `coach_pilot_highlight`) et n'est jamais visible par un pilote tiers.
- Le coach peut écrire de façon **directive** (c'est le seul espace où c'est permis), mais le rendu **côté pilote** reste une invitation, pas un ordre.
- Une annotation créée hors-ligne est mise en file et **synchronisée** sans doublon à la reconnexion.

### 3.3 Lecture priorisée & contexte (`priorites.tsx`, `contexte.tsx`, `comparer.tsx`, `comparer-pilotes.tsx`, `gabarits.tsx`)

**La lecture coach réussit si :**

- La file de lecture priorisée ne contient **que** des pilotes affiliés et consentants (mêmes garanties RLS que §3.1).
- La comparaison **entre pilotes** (`comparer-pilotes.tsx`) n'est offerte qu'au **coach** sur ses pilotes consentants — jamais exposée au pilote sans consentement mutuel.
- Le contexte de session (`coach_session_context`) et les repères/gabarits sont propres au coach et ne fuient pas vers le pilote.

---

## 4. Admin — `app/(admin)` (focus qualité data)

### 4.1 Qualité data (écran net-neuf `qualite-data` — `02_AUDIT_ROUTES.md`)

**La qualité data réussit si :**

- L'admin voit, par session (`telemetry_sessions`), des indicateurs **factuels** d'intégrité : `total_frames`, `lap_count`, `status`, présence/absence de `raw_data_url`, cohérence `started_at`/`ended_at`/`duration_seconds`.
- Une session **incomplète ou suspecte** (frames manquantes, `status` anormal, `lap_count` nul) est **signalée** sans être supprimée automatiquement.
- Toute action admin sensible est **tracée** dans `admin_audit`.
- L'écran ne propose **aucune** réécriture de la donnée télémétrie brute (lecture/diagnostic uniquement) ; toute capacité de correction de schéma **nécessite accord** de Gabin avant implémentation.

### 4.2 Opérations & coachs (`preparation.tsx`, `en-cours.tsx`, `coachs.tsx`, `coachs/[id].tsx`, `analytique.tsx`)

**L'admin opérations réussit si :**

- L'assignation coach↔pilote se fait ici et **uniquement** ici ; elle crée la ligne `coach_pilots` en `active` mais **sans** consentement (le pilote consent ensuite).
- L'octroi de permissions coach (`coach_permissions`) est réservé à l'admin et journalisé (`granted_by`).
- Les vues admin (`analytique.tsx`, `stats_dashboard`) agrègent **sans** exposer de donnée nominative au-delà du périmètre admin.

---

## 5. Partenaire — `app/(partner)` (net-neuf)

> L'espace Partenaire **n'existe pas** dans le code (`02_AUDIT_ROUTES.md`). V1 = annuaire ; dashboard partenaire = **V1.5**. Toute table de leads/offres/réservations **nécessite accord** de Gabin.

**Le partenaire V1 réussit si :**

- Le pilote voit un **annuaire** des partenaires `is_published = true` autour de l'événement (table `partners` existante), en lecture seule, sans CTA de réservation.
- La fiche partenaire reste **sobre** : nom, type (`partner_type`), localisation, lien — aucun langage promotionnel agressif, aucun emoji.
- Aucun **espace partenaire connecté** (offres/leads/réservations/performance) n'est livré en V1 sans accord schéma explicite ; sa présence en V1 serait un **échec de périmètre**.

**Le partenaire V1.5 réussira si (quand débloqué) :**

- Un partenaire authentifié (`owner_id`) ne voit **que** ses propres offres/leads/performance (RLS à définir — **nécessite accord**).
- Les leads ne sont **jamais** générés sans une action explicite et consentie du pilote.

---

## 6. Synthèse — la checklist « V1 parfait »

Reprend `03_MVP_SCOPE.md` §« parfait » en critères vérifiables. **La V1 est validée si toutes ces lignes sont vraies :**

| # | Critère | Vérifiable par |
|---|---|---|
| 1 | 5 zones, aucun menu interminable | revue nav + Paddock ≤ 3 raccourcis |
| 2 | Paddock contextuel (action juste selon le moment) | tests d'état Paddock |
| 3 | Sobre, respirant, sans arcade | revue canon §1–§5 |
| 4 | L'app montre, ne dirige pas (pilote) | grep verbes interdits + revue contenu généré |
| 5 | Silence total en piste | revue `roulage.tsx` + no-notif test |
| 6 | Bilan = moment central, un seul chiffre dominant | revue `bilan.tsx` |
| 7 | Aucun classement / « mauvais » / consigne pilote | revue Progression + contenu |
| 8 | BLE / offline / données incomplètes gérés | tests `captureSessionService`, `offlineQueue` |
| 9 | Lisible soleil, cibles ≥ 44 px, VoiceOver/TalkBack | audit accessibilité par écran |
| 10 | Or = donnée uniquement, rouge = coach/REC | grep usage couleurs |
| 11 | Aucun emoji, vouvoiement systématique | grep emoji + revue ton |
| 12 | Aucun nouveau schéma livré sans accord Gabin | revue migrations vs `02_AUDIT_ROUTES.md` |

---

## 7. Critères de rejet immédiat (un seul suffit à invalider une PR)

- Un **verbe prescriptif** rendu côté pilote.
- De l'**or sur la nav** ou en décor.
- Un **écran, son ou notification** pendant l'état « en piste ».
- **Deux chiffres dominants** sur le même écran.
- Une **donnée d'un autre utilisateur** visible (fuite RLS).
- Un **coach** voyant un pilote **sans** `active = true` ET `pilot_consent_at` non nul.
- Un **emoji** ou un **tutoiement** dans le contenu rendu.
- Une **migration Supabase** appliquée sans accord explicite de Gabin.
- Une cible tactile **< 44 px** sur un contrôle principal.
