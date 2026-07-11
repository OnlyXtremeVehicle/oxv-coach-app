# P3 — Waivers e-sign : proposition (schéma + texte)

> **STATUT : STOP — proposition en attente de validation.** Le schéma DB **et** le
> texte de décharge doivent être validés par le fondateur (Gabin) **et relus par
> un avocat spécialisé droit du sport mécanique** avant tout build. Rien n'est
> appliqué en base ; aucun écran n'est construit. Ce document sert de support à
> cette décision.

Objectif produit : permettre au pilote de **signer électroniquement une décharge
de responsabilité** (waiver) reconnaissant les risques de l'activité sur circuit,
avec une **trace probante** (horodatage, version du texte, empreinte du document).

---

## 1 — Pourquoi un waiver dédié (ce qui manque)

Le dispositif actuel (Pacte + CGU + CGV) forme déjà une défense contractuelle,
mais **aucun document ne joue explicitement le rôle de décharge de responsabilité
sportive** :

- **Pacte de pilotage** (`docs/juridique/01`) : engagement moral, doctrine « l'app
  est un miroir », autorité du pilote sur ses décisions. Ne nomme **pas** les
  risques physiques.
- **CGU app** (`02`) : exclusions de responsabilité de l'**éditeur** (l'app). Hors
  activité piste.
- **CGV prestations** (`03`) : conditions d'accès à la session, assurances,
  comportement piste. Acceptées à la réservation, mais **pas** une reconnaissance
  nominative et signée des risques par le pilote.

Un waiver de sport mécanique déclare explicitement ce qu'aucun de ces textes ne
dit : **« Je reconnais les risques de sortie de piste, collision, blessures
graves ou mortelles, et je participe en connaissance de cause. »**

---

## 2 — Ce qui existe déjà (réutilisable)

- **Acceptations versionnées** sur `public.users` (migration `0010`) :
  `pact_accepted_at` / `pact_version`, `cgu_accepted_at` / `cgu_version`,
  `privacy_accepted_at` / `privacy_version`. Capturent horodatage serveur +
  version. **Manque pour une preuve forte** : empreinte (hash) du texte signé, et
  une trace par-signature (les colonnes `users` écrasent à chaque acceptation).
- **`pilot_signature_snapshots`** (migration `0028`) : empreinte consolidée du
  pilote (reframe numérique) — **pas** un waiver, mais le patron d'une table de
  « snapshot » est réutilisable.
- **Flux d'acceptation onboarding** : `app/(onboarding)/cgu.tsx` et `pacte.tsx`
  (cases à cocher → `onboardingService.acceptPact()` / `acceptCguAndPrivacy()`,
  idempotent, file offline). Modèle direct pour un `acceptWaiver()`.
- **Génération légale** : textes en Markdown (`docs/juridique/*.md`) → compilés
  dans `src/legal/legalDocuments.ts` via `scripts/genlegal.js`. Un waiver suivrait
  le même chemin.

---

## 3 — Décisions fondateur requises (avant tout build)

**D1 — Quand signe-t-on ? (timing)** — 3 options, du plus simple au plus probant :

| Option | Quand | Force probante | Coût UX |
|---|---|---|---|
| **A** one-time | une fois, à l'onboarding | faible (valable « en général ») | nul |
| **B** par réservation | à chaque réservation de session | bonne (rattachée à une session) | faible |
| **C** jour J | avant de rouler, sur le circuit | forte (consentement au plus près) | modéré |

Recommandation : **B** (rattaché à la réservation) comme socle, éventuellement
renforcé par un rappel **C** le jour J. **A** seul est trop faible pour un sport à
risque.

**D2 — Valeur probante visée ?**
- **Signature simple** (case + nom + horodatage + hash du texte) : suffisante pour
  la plupart des litiges, gratuite, hébergée par nous. **Recommandé pour démarrer.**
- **Signature qualifiée / horodatage tiers** (type Universign, eIDAS) : valeur
  probante renforcée, coût par signature, intégration externe. À réserver si un
  assureur/avocat l'exige.

**D3 — Périmètre** : waiver pilote uniquement, ou aussi accompagnants/mineurs
(représentant légal) ? (impacte le schéma).

**D4 — Rétention** : durée de conservation des signatures (obligation légale vs
minimisation RGPD — à cadrer avec la Politique de confidentialité `04`).

---

## 4 — Schéma proposé (⚠ NON APPLIQUÉ — pour validation)

```sql
-- STOP : ne pas appliquer sans accord Gabin. Table dédiée (trace par-signature,
-- immuable) plutôt que des colonnes sur users (qui s'écrasent).
create table if not exists public.pilot_waiver_signatures (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  -- rattachement (option B) : la réservation concernée, si applicable
  booking_id         uuid references public.coaching_bookings(id) on delete set null,
  session_id         uuid references public.telemetry_sessions(id) on delete set null,
  waiver_version     text not null,           -- version du texte signé
  document_hash      text not null,           -- SHA-256 du texte exact signé (preuve d'intégrité)
  signed_full_name   text not null,           -- nom saisi par le signataire
  signed_at          timestamptz not null default now(),
  -- contexte technique (faisceau d'indices ; à arbitrer RGPD)
  user_agent         text,
  app_version        text,
  created_at         timestamptz not null default now()
);

create index if not exists pilot_waiver_user_idx
  on public.pilot_waiver_signatures (user_id, signed_at desc);

alter table public.pilot_waiver_signatures enable row level security;

-- Le pilote lit et crée SES signatures ; il ne peut ni les modifier ni les
-- supprimer (immuabilité de la preuve). Admin en lecture (audit).
create policy waiver_owner_select on public.pilot_waiver_signatures
  for select using (user_id = auth.uid());
create policy waiver_owner_insert on public.pilot_waiver_signatures
  for insert with check (user_id = auth.uid());
create policy waiver_admin_select on public.pilot_waiver_signatures
  for select using (is_admin());
-- (Volontairement AUCUNE policy update/delete pour authenticated : immuable.)
```

Note : pas d'IP par défaut (RGPD — donnée sensible peu utile hors litige) ; à
ajouter seulement si l'avocat le juge nécessaire. `user_agent` + `app_version`
suffisent comme faisceau d'indices.

---

## 5 — Projet de texte de décharge (⚠ PROJET — relecture avocat obligatoire)

> Brouillon de travail, **droit français**, à faire relire par un avocat
> spécialisé droit du sport mécanique avant tout usage. Ton OXV : vouvoiement,
> sobre, sans dramatisation ni sur-promesse. Destiné à `docs/juridique/05_*.md`
> une fois validé.

---

**Décharge de responsabilité — Session de roulage sur circuit**
**Version 0.1 (projet) — à signer avant la session**

**Reconnaissance des risques.** Vous reconnaissez que le roulage sur circuit est
une activité à risques. Ces risques incluent, sans s'y limiter : la sortie de
piste, la collision, le retournement du véhicule, et des blessures pouvant être
graves ou mortelles. Vous déclarez participer à la session en pleine connaissance
de ces risques.

**Votre engagement.** Vous déclarez sur l'honneur :
1. être majeur et titulaire d'une assurance responsabilité civile couvrant la
   pratique sur circuit ;
2. disposer d'une expérience adaptée à la session à laquelle vous participez ;
3. être, ce jour, dans un état physique et mental permettant de conduire ;
4. avoir pris connaissance du briefing de sécurité et des règles de la piste, et
   vous y conformer ;
5. rouler sous votre seule responsabilité et prendre vos décisions de pilotage en
   toute autonomie.

**Rôle de l'application.** L'application OXV Mirror est un outil de lecture de
données **après** la session. Elle ne constitue ni un dispositif de sécurité, ni
une aide à la conduite, et n'intervient pas pendant que vous roulez.

**Renonciation.** Dans les limites permises par la loi, vous renoncez à rechercher
la responsabilité d'OXV au titre des dommages résultant de vos propres décisions
de pilotage. Cette renonciation ne couvre pas les manquements d'OXV à ses propres
obligations d'organisateur (sécurité du circuit, encadrement, assurances).

**Engagement d'OXV.** OXV s'engage à fournir un circuit inspecté, un encadrement
et des protocoles de sécurité, et à souscrire l'assurance responsabilité civile
de l'organisateur.

*Signature : case à cocher, nom saisi, horodatée et scellée par empreinte du texte.*

---

## 6 — Flux app esquissé (non construit)

- **Service** `waiverService.ts` : `WAIVER_VERSION`, `acceptWaiver({ bookingId?,
  sessionId? })` → hash du texte (`legalDocuments.waiver`) + insert (+ file
  offline, idempotent comme `acceptPact`) ; `listMyWaivers()`.
- **Écran** de signature (onboarding et/ou pré-session selon D1) : texte scrollable
  + case « J'ai lu et j'accepte » + champ nom + bouton « Je signe ».
- **Écran** historique (dans « Compte / consentements ») : liste chronologique,
  lecture seule.
- **Garde** (si option C) : un roulage n'est « couvert » que si un waiver de la
  version courante existe pour la session.

---

## 7 — Ce que je fais MAINTENANT

**Rien en base, aucun écran.** Sur ta validation de **D1–D4** (et après relecture
avocat du texte §5), j'applique le schéma §4 via `apply_migration`, je pose le
texte validé dans `docs/juridique/05_*.md` (→ `genlegal`), puis je construis le
service + les écrans du §6. Jusque-là : **STOP**.
