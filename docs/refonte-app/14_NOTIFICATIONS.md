# Logique de notifications

> Document de cadrage. Débloque PR 4–6 (Session, Progression, Compte/Club).
> Réf. : `00_PLATEFORME_OXV.md §8` · doctrine `CLAUDE.md` · canon `04_DESIGN_CANON.md`.
> Statut : cadrage. Tout ajout de **type** de notif ou de **colonne** est à valider — voir §10.

---

## 0. Règle absolue — jamais pendant la piste

La notification est un service **avant** et **après** le roulage. Pendant que le véhicule roule, **rien** : aucune bannière, aucun son, aucune vibration, aucun badge qui s'anime. C'est l'application directe du Principe 3 (silence en piste) et de l'état « en piste » du canon (`04_DESIGN_CANON.md §6`).

Trois garde-fous, déjà partiellement en place dans le code :

| Garde-fou | Où | Statut |
|---|---|---|
| Handler foreground **sans son** | `pushNotificationsService.ts` — `setNotificationHandler` (`shouldPlaySound: false`, `shouldSetBadge: false`) | en place |
| Aucune notif **locale programmée** pendant un état roulage (S5–S8) | responsabilité de l'appelant ; le service ne connaît pas l'état pilote (commentaire du service) | à câbler en PR 4 |
| Suppression d'affichage si état pilote = roulage | **manque** — voir §3 « passerelle silence » | à créer (PR 4) |

Le service push porte déjà la note doctrinale : *« Silence en piste : aucune notif programmée pendant un état S5-S8 (roulage). C'est l'appelant qui décide. »* Le cadrage formalise **qui** est l'appelant et **comment** on supprime un push remote qui arriverait pendant le roulage.

---

## 1. État réel du système

L'app possède déjà un système de notifications fonctionnel, à deux moteurs.

### 1.1 Notifications locales (device, sans serveur)

`src/services/pushNotificationsService.ts` :

| Fonction | Titre actuel | Corps actuel | `data.type` | Trigger |
|---|---|---|---|---|
| `scheduleDebriefNotification` | « Votre debrief est prêt. » | « Une lecture posée vous attend, quand vous le souhaitez. » | `debrief` | J+1 (`delayMs` défaut 24 h) |
| `scheduleSessionReminder` | « Demain, vous roulez. » | « Vérifiez votre équipement à tête reposée. L'app sera prête. » | `session_reminder` | `hoursBefore` avant `sessionAt` (défaut 18 h) |
| `cancelAllOxvNotifications` | — | — | — | déconnexion / opt-out |

### 1.2 Notifications remote (Expo Push via Edge Functions)

Six Edge Functions Supabase, déclenchées par triggers Postgres `pg_net` (migrations 0021/0022/0025), envoient vers `https://exp.host/--/api/v2/push/send` :

| Edge Function | Destinataire | `data.type` | Émis quand |
|---|---|---|---|
| `notify-pilot-coach-annotated` | Pilote | `coach_annotation` | coach pose une annotation `visibility='shared'` |
| `notify-coach-session-analyzed` | Coach | `session_analyzed` | une session d'un pilote suivi est analysée |
| `notify-pilot-coach-assigned` | Pilote | `coach_assigned` | un coach est affilié au pilote |
| `notify-coach-consent-received` | Coach | `pilot_consented` | un pilote consent au suivi |
| `notify-pilot-friend-request` | Pilote | `friend_request` | demande de comparaison entre amis |
| `notify-pilot-friend-accepted` | Pilote | `friend_accepted` | demande acceptée |

Garde-fous remote déjà codés : Bearer `EDGE_FUNCTIONS_INVOKE_SECRET` (anti-forge), throttle `should_send_notif(recipient, source, notif, window_seconds)` (15 min pour les annotations coach), skip si pas de `expo_push_token`, skip annotation `private`.

### 1.3 Persistance et opt-in (schéma existant — aucun ajout)

Table `users` (`src/types/database.types.ts`) :

| Colonne | Rôle |
|---|---|
| `expo_push_token` | jeton device (remote) |
| `push_token_updated_at` | fraîcheur du jeton |
| `push_notif_enabled` (bool) | **maître** opt-in global |
| `notification_preferences` (JSONB) | préférences fines par canal |

Logique pure testable : `src/services/notifPreferencesLogic.ts` — canaux **réellement** programmés = `debrief` et `reminder`. Règle honnête : *un réglage ne contrôle que ce qui existe vraiment* ; absent = actif (défaut-ON), sous le maître `push_notif_enabled`.

### 1.4 Routage deep-link (loi)

Le routeur unique est dans `app/_layout.tsx` (`Notifications.useLastNotificationResponse`). Il lit `data.type` et route. **Toute notif doit produire un `data.type` déjà géré ici, sinon le tap ne mène nulle part.**

| `data.type` | Champs `data` lus | Route cible RÉELLE | Espace |
|---|---|---|---|
| `debrief` | `sessionId` | `/(app)/debrief?sessionId=…` | Pilote · Bilan |
| `session_reminder` | — | `/(app)` (Paddock) | Pilote · Paddock |
| `coach_annotation` | `cornerIndex`, `sessionId` | `/(app)/virage?index=…&sessionId=…` | Pilote · Bilan (Data Lab) |
| `session_analyzed` | `pilotId`, `sessionId` | `/(coach)/pilote/[id]` | Coach |
| `coach_assigned` | — | `/(app)/mon-coach` | Pilote · Club |
| `pilot_consented` | — | `/(coach)` | Coach |
| `friend_request` | `friendshipId`, `initiatorId` | `/(app)/amis` | Pilote · Club |
| `friend_accepted` | `friendId` | `/(app)/cote-a-cote/[friendId]` | Pilote · Club |

Le schéma d'URL natif est `oxv://` (cf. deep-link construit dans `notify-pilot-coach-annotated`).

---

## 2. Doctrine appliquée à la notification

Une notification OXV obéit aux mêmes règles que le reste de l'app.

| Règle | Traduction notification |
|---|---|
| L'app montre, ne dirige pas | Côté **pilote**, aucun verbe prescriptif. Interdit : « freinez », « corrigez », « vous devez », « évitez », « erreur », « mauvais ». Autorisé : « à observer », « était-ce volontaire ? », constat factuel. |
| Espace prescriptif = bande coach | Une consigne ne peut venir **que** du coach, jamais de l'app de sa propre voix. Une notif d'app reste descriptive. |
| Or = donnée · Rouge = coach/REC | Le badge compteur de l'écran Notifications est **or** (`#FFB703`) — c'est une donnée, pas un acte (cf. `notifications.tsx`). Le rouge reste réservé coach/REC. Jamais d'or ailleurs sur la nav. |
| Vouvoiement | « Votre debrief est prêt », « Demain, vous roulez ». Jamais de tutoiement. |
| Pas d'emoji | Aucun, dans titre comme corps. |
| Sobriété sonore | Foreground sans son (déjà). Background : son discret toléré, jamais d'urgence. |
| Un seul message | Une notif = une chose. Pas d'empilement de constats dans un corps. |

**Quiet hours.** Le service note l'intention « silencieux entre 22 h et 8 h » côté pilote (commentaire de `notify-pilot-coach-annotated`). À formaliser : aucune notif **non urgente** ne s'affiche entre 22 h et 8 h heure pilote (best-effort `fr-FR`) ; elle est différée à 8 h. Décision verrouillée : OXV n'a **aucune** notif urgente côté pilote — donc la fenêtre 22 h–8 h est respectée sans exception.

---

## 3. Architecture : silence en piste comme couche obligatoire

Deux familles arrivent sur le device : **locales** (que l'app programme) et **remote** (poussées par Expo, hors contrôle du device au moment de l'envoi). Le silence en piste doit couvrir les deux.

```
                  ┌─────────────────────────────┐
   locale ───────▶│  AVANT programmation :       │
 (debrief,        │  refus si état pilote=roulage│───▶ scheduleNotificationAsync
  reminder)       └─────────────────────────────┘
                  ┌─────────────────────────────┐
   remote ───────▶│  À l'arrivée (handler) :     │
 (coach, amis…)   │  si état pilote=roulage      │───▶ shouldShowAlert:false
                  │  ⇒ supprimer affichage + son │     (tap conservé pour plus tard)
                  └─────────────────────────────┘
```

**Passerelle silence (à créer, PR 4).** Le `setNotificationHandler` actuel renvoie toujours `shouldShowAlert: true`. Il doit consulter l'état de session (store Zustand de roulage / machine d'états `docs/sitemap/04_state_machine.md`) et renvoyer `shouldShowAlert: false, shouldPlaySound: false` tant que l'état ∈ {S5…S8 roulage}. Le contenu n'est pas perdu : il reste dans le centre système et son tap fonctionnera au retour aux stands.

Côté **programmation locale**, l'appelant (flux Session) ne programme `scheduleDebriefNotification` qu'au **retour stands** (`pilotage-fini` / `bilan-pret`), jamais pendant `roulage` / `entre-runs`.

> Cette passerelle est un ajout de **code applicatif** (handler + lecture de store), pas un changement de schéma. Aucune validation Gabin requise sur la DB.

---

## 4. AVANT — préparer sereinement

Notifications de préparation. Destinataire : **pilote**. Ton : posé, jamais pressant.

| # | Notification | Déclencheur | `data.type` | Deep-link RÉEL | Moteur | Statut |
|---|---|---|---|---|---|---|
| A1 | Veille de session | `sessionAt − hoursBefore` (défaut 18 h) | `session_reminder` | `/(app)` (Paddock) | local | **existe** |
| A2 | Arrivée au circuit | géofence circuit Haute Saintonge / jour J | `session_reminder` (réutilisé) | `/(app)` (Paddock, action « Connecter l'équipement ») | local | nouveau (PR 4) |
| A3 | Équipement à préparer | RaceBox non jumelé à H−2 le jour J | `session_reminder` (réutilisé) | `/(app)` → `equipement` | local | nouveau (PR 4) |

Notes :
- A1 existe déjà (`scheduleSessionReminder`). Texte actuel conforme : « Demain, vous roulez. » / « Vérifiez votre équipement à tête reposée. »
- A2 et A3 **réutilisent `session_reminder`** pour ne créer aucun nouveau `data.type` : ils mènent tous au Paddock, qui est déjà contextuel (`01_ORGANISATION_PRODUIT.md` — état « arrivée circuit »). Le Paddock affiche la bonne action principale selon le moment. C'est l'option la plus sobre et sans risque de routage mort.
- Aucune notif A* ne part si le device est déjà en état roulage (cas limite : arrivée tardive).

Copies proposées (vouvoiement, descriptif) :
- A2 — « Vous êtes au circuit. » / « L'équipement peut être jumelé quand vous le souhaitez. »
- A3 — « Votre boîtier n'est pas encore jumelé. » / « Vous pourrez le connecter depuis le Paddock. »

---

## 5. APRÈS — comprendre, sans diriger

Notifications post-roulage. Le moment central de l'app. Aucune ne s'émet **pendant** la piste : elles sont programmées/déclenchées au retour aux stands ou plus tard.

| # | Notification | Déclencheur | Destinataire | `data.type` | Deep-link RÉEL | Moteur | Statut |
|---|---|---|---|---|---|---|---|
| B1 | Bilan prêt | session analysée (retour stands + traitement) | Pilote | `debrief` | `/(app)/debrief?sessionId=…` | local (J+1) / remote possible | **existe (local)** |
| B2 | Note de votre coach | annotation coach `shared` | Pilote | `coach_annotation` | `/(app)/virage?index=…&sessionId=…` | remote | **existe** |
| B3 | Session analysée | analyse d'un pilote suivi | Coach | `session_analyzed` | `/(coach)/pilote/[id]` | remote | **existe** |
| B4 | Média disponible | photos/vidéos de session publiées | Pilote | `media_ready` *(nouveau type)* | `/(app)/bilan` puis galerie média | remote | **à créer + accord §10** |
| B5 | Problème de qualité data | session capturée mais data incomplète/corrompue | Pilote | `debrief` (réutilisé, corps adapté) | `/(app)/bilan` | local | nouveau (PR 4) |

Notes doctrinales :
- B1 « Votre debrief est prêt. » — descriptif, invite sans presser : « Une lecture posée vous attend, quand vous le souhaitez. » Conforme.
- B2 est le **seul** message qui peut porter une consigne — parce qu'elle vient du coach, pas de l'app. Titre « Note de {coach} », corps = extrait de la note (≤ 60 car.) + nom du virage. Déjà codé ainsi.
- B5 (qualité data) doit rester **non culpabilisant** : on décrit, on ne reproche pas. Interdit : « Capture échouée », « erreur boîtier ». Autorisé : « Une partie de votre session n'a pas pu être lue. » / « Le reste de votre bilan reste disponible. » Répond aux 3 questions des erreurs BLE (`01_ORGANISATION_PRODUIT.md` — « que s'est-il passé / qu'est-ce qui est préservé / que puis-je faire »).
- B4 média : `media_ready` est un **nouveau** `data.type` → nécessite d'ajouter une branche dans `app/_layout.tsx` (cf. §10). Tant qu'il n'existe pas, ne pas émettre cette notif (sinon tap mort).

---

## 6. LE LENDEMAIN — débrief J+1

Le débrief différé est le rituel signature : revenir à froid, sans le bruit de la piste.

| # | Notification | Déclencheur | Destinataire | `data.type` | Deep-link RÉEL | Moteur | Statut |
|---|---|---|---|---|---|---|---|
| C1 | Débrief J+1 prêt | J+1 (24 h post-session, défaut) | Pilote | `debrief` | `/(app)/debrief?sessionId=…` | local | **existe** |
| C2 | Programme coach mis à jour | coach modifie un cycle/programme (V1.5) | Pilote | `coach_program` *(nouveau)* | `/(app)/mon-coach` ou écran Cycles | remote | **V1.5 + accord §10** |

Notes :
- C1 = `scheduleDebriefNotification`, déjà programmée. La fenêtre J+1 respecte de facto les quiet hours si la session a lieu en journée (24 h plus tard ≈ même heure). À borner : si l'horaire tombe entre 22 h et 8 h, décaler à 8 h.
- C2 (programme mis à jour) relève du **Développement / Cycles**, classé V1.5 (`03_MVP_SCOPE.md` : « Programme coach (cycles) » = V1.5). À ne pas câbler avant que l'écran cible existe. Cible de repli acceptable d'ici là : `/(app)/mon-coach` (déjà routable, espace Club).

---

## 7. Écosystème — Club, partenaires, social

Notifications de l'écosystème (Club). Toujours côté pilote ou coach, toujours descriptives.

| # | Notification | Déclencheur | Destinataire | `data.type` | Deep-link RÉEL | Statut |
|---|---|---|---|---|---|---|
| D1 | Un coach vous suit | affiliation coach | Pilote | `coach_assigned` | `/(app)/mon-coach` | **existe** |
| D2 | Un pilote a consenti | consentement reçu | Coach | `pilot_consented` | `/(coach)` | **existe** |
| D3 | Demande de comparaison | un ami souhaite comparer | Pilote | `friend_request` | `/(app)/amis` | **existe** |
| D4 | Comparaison acceptée | ami accepte | Pilote | `friend_accepted` | `/(app)/cote-a-cote/[friendId]` | **existe** |
| D5 | Offre partenaire liée à un événement | offre publiée pour l'événement du pilote inscrit | Pilote | `partner_offer` *(nouveau)* | `/(app)/carte-oxv` ou écran offres (Club) | **V1.5 + accord §10** |
| D6 | Document manquant | pièce requise non fournie (pacte, KYC, décharge) avant événement | Pilote | `doc_missing` *(nouveau)* | `/(app)/notifications` onglet « À traiter » | **à créer + accord §10** |

Notes :
- D1–D4 existent déjà, routage correct dans `_layout.tsx`. Côté **pilote**, D3 « X souhaite vous comparer » est non prescriptif (`friend_request`).
- D5 (offre partenaire) suit l'espace partenaire, **V1.5** (`03_MVP_SCOPE.md` : « Partenaires — offres / leads » = V1.5). Une offre n'est jamais poussée pendant un roulage ni de façon intrusive : opt-in dédié recommandé (canal `partner` distinct du canal `coach`).
- D6 (document manquant) alimente l'onglet **À traiter** de `notifications.tsx`, dont le badge or affiche déjà `unreadNotificationsCount`. C'est une **donnée** (badge or), pas un acte (pas de rouge). Ton : « Une pièce reste à compléter avant votre session. » — descriptif, jamais comminatoire (« vous devez » interdit).

---

## 8. JAMAIS — ce qui ne déclenche aucune notification

Liste de refus explicite, à respecter comme la liste « à éviter » du canon.

| Interdit | Pourquoi |
|---|---|
| Toute notif **pendant le roulage** (S5–S8) | Principe 3 — silence en piste. Couvert par la passerelle §3. |
| Notif **urgente / anxiogène** côté pilote | Doctrine du calme. Aucune notif OXV n'est prioritaire au point de percer les quiet hours. |
| **Classement, leaderboard, « vous êtes Xe »** | Progression = lecture de soi, jamais compétition (`01_ORGANISATION_PRODUIT.md`). |
| **Consigne de pilotage** de la voix de l'app | Seule la bande/note coach peut prescrire (B2). |
| Mots interdits (« erreur », « mauvais », « vous devez », « freinez ») | Verbes prescriptifs interdits côté pilote. |
| **Relances marketing** / réengagement creux (« Revenez rouler ! ») | Pas de marketing creux (Principe 4). |
| Notif **entre 22 h et 8 h** (non urgente = toutes) | Quiet hours. Différer à 8 h. |
| Push si `push_notif_enabled = false` ou canal coupé | Opt-in respecté (`isChannelEnabled`). |
| Émettre un `data.type` **non routé** dans `_layout.tsx` | Tap mort = écran qui ne s'ouvre pas. Ajouter la branche d'abord. |
| **Son / vibration** pour une notif d'app | Foreground déjà muet ; le rester en background pour le non-coach. |

---

## 9. Synthèse des types — réel vs à créer

| `data.type` | Routé dans `_layout.tsx` ? | Moteur | Décision |
|---|---|---|---|
| `debrief` | oui | local | réutiliser (B1, B5, C1) |
| `session_reminder` | oui | local | réutiliser (A1, A2, A3) |
| `coach_annotation` | oui | remote | en place (B2) |
| `session_analyzed` | oui | remote | en place (B3) |
| `coach_assigned` | oui | remote | en place (D1) |
| `pilot_consented` | oui | remote | en place (D2) |
| `friend_request` | oui | remote | en place (D3) |
| `friend_accepted` | oui | remote | en place (D4) |
| `media_ready` | **non** | remote | **à ajouter** (B4) — branche route + accord |
| `coach_program` | **non** | remote | **V1.5** (C2) — branche route + accord |
| `partner_offer` | **non** | remote | **V1.5** (D5) — branche route + accord |
| `doc_missing` | **non** | local/remote | **à ajouter** (D6) — branche route + accord |

Principe d'extension : **on ne crée un nouveau `data.type` que si aucun type existant ne mène au bon écran.** Préférer la réutilisation (A2/A3/B5 réutilisent des types existants).

---

## 10. Ce qui nécessite l'accord de Gabin (schéma / nouveaux canaux)

Aucun changement de schéma Supabase n'est acquis. À **soumettre explicitement** avant toute migration :

| Élément | Nature | Pourquoi accord |
|---|---|---|
| Nouveaux canaux fins (`media`, `partner`, `coach_program`, `doc`) dans `notification_preferences` | **JSONB existant**, pas de colonne — mais étend `NotifChannel` | élargit le contrat opt-in ; valider la liste honnête des canaux |
| Nouveaux `data.type` (`media_ready`, `coach_program`, `partner_offer`, `doc_missing`) | branches dans `app/_layout.tsx` + Edge Functions + triggers Postgres | nouvelles migrations (triggers `pg_net`) → **nécessite accord** |
| Table de **journal de notifications** (historique « À traiter / Archives ») | **nouvelle table** — l'écran `notifications.tsx` n'a aujourd'hui que des états vides | tout nouveau schéma **nécessite accord** ; à soumettre |
| Persistance des **quiet hours / fuseau pilote** | éventuelle colonne `users.timezone` ou champ JSONB | **nécessite accord** si nouvelle colonne |

> Tant que l'accord n'est pas donné, ces éléments restent **au stade cadrage**. On ne pousse aucune migration, on ne câble aucun `data.type` non routé.

---

## 11. Acceptation — « réussi si… »

- Aucune notification (locale ou remote) ne s'affiche ni ne sonne pendant un état roulage (S5–S8). La passerelle handler renvoie `shouldShowAlert:false` en piste.
- Chaque notification émise porte un `data.type` qui ouvre un écran réel — aucun tap mort.
- Côté pilote, aucun corps de notif ne contient un verbe prescriptif ni un mot interdit ; vouvoiement systématique ; zéro emoji.
- Le badge de l'écran Notifications reste or (donnée) ; aucun or n'apparaît sur la barre d'onglets.
- `push_notif_enabled = false` ou canal coupé ⇒ aucune notif programmée/affichée.
- Aucune notif non urgente entre 22 h et 8 h ; report à 8 h.
- Aucun nouveau `data.type`, canal, table ou colonne n'est livré sans accord explicite de Gabin (§10).
