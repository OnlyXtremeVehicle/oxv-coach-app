# Brief — Propagation feature Coach côté site web OXV

> Document à transmettre au dev du site web `oxvehicle.fr` (Next.js,
> Stripe, espace admin pilote). Couvre les pages à ajouter et les
> interfaces Supabase à consommer.
>
> **Contexte** : la feature coach a été livrée sur l'app mobile OXV
> Coach (React Native + Expo). Le schéma DB est en prod. Il reste à
> propager sur le site web pour que l'admin OXV puisse aussi gérer
> les coachs depuis son backoffice web, et pour que les pilotes
> puissent consulter leur coach depuis leur espace web.

---

## Ce qui existe déjà côté Supabase (rien à recoder)

### Tables et fonctions disponibles

| Objet | Type | Schéma | Notes |
|---|---|---|---|
| `coach_pilots` | table | `public` | Assignation coach ↔ pilote |
| `coach_pilots_view` | view INVOKER | `public` | Liste filtrée par RLS — utilisable directement |
| `is_coach_of(uuid)` | function | `public` | Helper utilisable dans RLS custom |
| `log_coach_view(uuid, text, uuid)` | function | `public` | Audit RGPD, à appeler côté web aussi |
| `users.role` | enum | `public` | Inclut `'coach'` |

### Policies RLS coach déjà en place

7 policies SELECT pour coach sur `telemetry_sessions`, `telemetry_frames`, `laps`, `app_session_analyses`, `app_segment_analyses`, `vehicles`, `app_progression_shares`. Le web n'a rien à recréer côté DB.

---

## Pages web à créer

### 1. Backoffice admin — Gestion des coachs

**Route** : `/admin/coachs`
**Permission** : admin OXV uniquement (`is_admin()`)
**Référence app mobile** : [`app/(admin)/coachs.tsx`](../../app/(admin)/coachs.tsx) + [`app/(admin)/coachs/[id].tsx`](../../app/(admin)/coachs/[id].tsx)

#### Sous-pages

- **`/admin/coachs`** — Liste de tous les coachs OXV
  - Filtre auto sur `users.role = 'coach'`
  - Pour chaque coach : nom, email, nombre d'assignations actives
  - Bouton "↤ Rétrograder en pilote" (avec garde-fou si assignations actives)
  - Bouton "+ Promouvoir un pilote" → modal de sélection

- **`/admin/coachs/[id]`** — Détail coach
  - Liste des assignations existantes (active/inactive, consenti/pas)
  - Bouton "Assigner un pilote" → picker avec recherche nom/email
  - Toggle active/inactive sur chaque assignation
  - Bouton "Forcer le consentement (papier signé hors-app)" si pas encore consenti

#### Code source disponible (services réutilisables)

Le module [`src/services/coachAdminService.ts`](../../src/services/coachAdminService.ts) contient toutes les fonctions à porter en TypeScript web :

```typescript
listCoaches() — SELECT users WHERE role='coach' + count assignations
listPilots() — SELECT users WHERE role='pilot' (pour picker)
listAssignmentsForCoach(coachId) — JOIN coach_pilots + users
assignPilotToCoach({coachId, pilotId, createdBy, notes?}) — INSERT
toggleAssignmentActive(id, active) — UPDATE active
forcePilotConsent(id) — UPDATE pilot_consent_at = NOW()
promoteToCoach(userId) — UPDATE users SET role='coach'
demoteToPilot(userId) — UPDATE users SET role='pilot'
```

Réutilisez tel quel en changeant `from '@/lib/supabase'` par votre chemin d'import Supabase côté web.

### 2. Espace pilote web — "Mon coach"

**Route** : `/espace/mon-coach` (ou `/account/coach` selon votre URL scheme)
**Permission** : pilote authentifié
**Référence app mobile** : [`app/(app)/mon-coach.tsx`](../../app/(app)/mon-coach.tsx)

#### Contenu

- Liste des coachs assignés au pilote courant (RLS auto)
- Pour chaque coach : nom, date assignation, statut consentement
- Toggle "Autoriser ce coach à voir mes sessions"
- Card explicative "CE QUE LE COACH VOIT" (sessions, analyses, progression) / "CE QU'IL NE VOIT JAMAIS" (email, tel, docs)
- Phrase doctrinale : *"Vous pouvez retirer votre accord à tout moment."*

#### Code source disponible

[`src/services/pilotConsentService.ts`](../../src/services/pilotConsentService.ts) :

```typescript
listMyCoaches() — SELECT coach_pilots + JOIN users (RLS filtre auto)
giveConsent(assignmentId) — UPDATE pilot_consent_at = NOW()
revokeConsent(assignmentId) — UPDATE pilot_consent_at = NULL
```

### 3. (Optionnel V1.1) Espace coach web — "Mes pilotes"

Pour permettre aux coachs de consulter sans installer l'app mobile.

**Route** : `/espace-coach` (auto-redirect depuis `/` si `role='coach'`)
**Référence app mobile** : [`app/(coach)/index.tsx`](../../app/(coach)/index.tsx) + [`app/(coach)/pilote/[id].tsx`](../../app/(coach)/pilote/[id].tsx)

#### Contenu

- Liste pilotes assignés ET consentis (via `coach_pilots_view`)
- Pour chaque pilote : nom, niveau, date assignation, dernière session
- Tap pilote → liste sessions ordonnées chronologiquement
- Tap session → page bilan en lecture seule (réutilise composants existants)

Service : [`src/services/coachService.ts`](../../src/services/coachService.ts) :

```typescript
listMyPilots() — SELECT coach_pilots_view
listPilotSessions(pilotId) — SELECT telemetry_sessions + JOIN analyses
logCoachView(pilotId) — RPC log_coach_view (RGPD audit)
```

**N'oubliez pas le log audit** : `await supabase.rpc('log_coach_view', {...})` à chaque fois qu'un coach consulte les sessions d'un pilote spécifique.

---

## Charte visuelle (à respecter)

| Persona | Couleur accent | Hex | Usage |
|---|---|---|---|
| Pilote | Rouge OXV | `#C8102E` | Mode standard |
| Admin | Bronze | `#B87333` | Backoffice |
| **Coach** | **Bleu nuit** | **`#1E3A5F`** | Espace coach |
| Heritage | Or | `#C4A459` | Pack héritage |

**Doctrine éditoriale** :
- Vouvoiement systématique
- Pas d'emoji
- Phrases courtes
- Pas de verbe directif dans le contenu utilisateur
- Pour le coach : présentation factuelle, pas d'enthousiasme commercial

---

## Schéma RGPD à respecter côté web

### Texte d'opt-in pilote (à valider légal)

> En autorisant ce coach, vous lui permettez de consulter vos sessions, vos analyses par virage, et votre progression. Il ne verra jamais votre email, votre téléphone, ni vos documents. Vous pouvez retirer votre accord à tout moment, sans justification.

### Audit logs

À consulter dans `admin_audit` :
```sql
SELECT * FROM admin_audit
WHERE action LIKE 'coach_view%'
ORDER BY created_at DESC;
```

À conserver indéfiniment (preuve RGPD en cas de litige). Anonymisation possible après 5 ans (V2).

---

## Checklist de portage

- [ ] Page admin `/admin/coachs` (liste + promotion)
- [ ] Page admin `/admin/coachs/[id]` (détail + assignations)
- [ ] Page pilote `/espace/mon-coach` (consentement)
- [ ] (Optionnel) Page coach `/espace-coach` + sous-pages
- [ ] Texte légal opt-in validé et affiché
- [ ] Audit log appelé à chaque accès coach
- [ ] Test : compte coach test peut voir un pilote consenti
- [ ] Test : compte coach test NE PEUT PAS voir un pilote non consenti
- [ ] Test : retrait du consentement révoque l'accès immédiatement
- [ ] Header navigation : badge "COACH" en bleu nuit pour les comptes coach

---

## Questions à clarifier avant code web

1. **Sign-up coach** : self-signup ou admin-only ? (App mobile : admin-only via promotion)
2. **Email d'invitation coach** : OXV envoie l'invitation au nouveau coach ? (Pas codé en V1, à voir avec votre stack email — probablement Resend déjà câblé)
3. **Notif pilote au moment de l'assignation** : email au pilote "Un coach vous est assigné, ouvrez l'app pour consentir" ? (Pas codé V1)
4. **Page publique "Devenir coach OXV"** : marketing inbound coach ou pas ? (Décision produit)

---

## Estimation effort dev web

- Lecture du brief + setup : 1 h
- Page admin coachs (liste + détail) : 1-2 jours
- Page pilote mon-coach : 0.5-1 jour
- (Optionnel) Espace coach complet : 2-3 jours
- Tests manuels + déploiement : 0.5 jour

**Total minimum (sans espace coach web)** : 3-4 jours
**Total complet** : 6-8 jours

— Brief Claude Code, 26 mai 2026
