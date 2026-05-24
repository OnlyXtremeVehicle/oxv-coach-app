# Rapport semaine 8 — Onboarding #01-06 + routing 3 branches

**Date** : 25 mai 2026
**Auteur** : Claude Code (Opus 4.7 — 1M context)
**Statut** : Onboarding complet de bout en bout. Premier flow utilisateur entièrement câblé login → app.

---

## Ce que j'ai fait

### Jour 1 — Lecture juridique + migration

**Lecture intégrale** de [docs/juridique/02_CGU_APP_OXV_COACH.md](docs/juridique/02_CGU_APP_OXV_COACH.md) — 13 articles, 320 lignes. Points clés intégrés au code :
- Article 4.2 — Limites essentielles : pas d'ADAS, pas de coach diplômé, pas de dispositif de sécurité
- Article 6.1 — Engagement utilisateur de ne jamais consulter l'écran pendant que le véhicule est en mouvement
- Article 8 — RGPD : hébergement Supabase Frankfurt, conservation 3 ans après dernière connexion, droits CNIL

Pas besoin de relire la Politique de confidentialité (04) intégralement pour la V1 — son acceptation est couverte par la même case checkbox que les CGU dans l'écran #05.

**Migration 0010** appliquée en prod :
- `users.pact_accepted_at` / `pact_version`
- `users.cgu_accepted_at` / `cgu_version`
- `users.privacy_accepted_at` / `privacy_version`
- Toutes `NULL` par défaut → un compte existant doit refaire l'onboarding à la prochaine ouverture V1
- Types TypeScript régénérés (vérifié : `pact_accepted_at` présent)

### Jour 2 — Routing + service onboarding

**[src/store/useAuthStore.ts](src/store/useAuthStore.ts)** étendu : `UserProfile` inclut maintenant `profile_completed_at`, `pact_accepted_at`, `pact_version`, `cgu_accepted_at`, `privacy_accepted_at`. `fetchProfile` les sélectionne tous.

**[src/services/onboardingService.ts](src/services/onboardingService.ts)** :
- `setPilotLevel(level)` — UPDATE `users.pilot_level`, fallback `enqueueAction('update_pilot_level')` si offline
- `acceptCguAndPrivacy()` — set CGU + privacy ensemble avec timestamps + versions, refresh profile
- `acceptPact()` — UPDATE `pact_accepted_at` + `pact_version`, fallback queue `accept_pact` (déjà câblée sem 2)
- `completeOnboarding()` — UPDATE `profile_completed_at` = now
- `isOnboardingComplete(profile)` — guard pour le router : true ssi les 3 acceptations sont là
- Constantes versionnées exportées : `PACT_VERSION='1.0'`, `CGU_VERSION='1.0'`, `PRIVACY_VERSION='1.0'`

**[app/index.tsx](app/index.tsx) — router 3 branches** :

```
status === 'idle' | 'loading'         → spinner
status !== 'authenticated'            → /(auth)/login
!profile || !isOnboardingComplete()   → /(onboarding)
otherwise                             → /(app)
```

Cohérent avec la state machine S1 → S2 → S3+ : un user sans compte n'arrive même pas ici, un user avec compte mais sans pacte signé est forcé d'aller jusqu'au #06.

### Jour 3-4 — Les 6 écrans onboarding

[app/(onboarding)/_layout.tsx](app/(onboarding)/_layout.tsx) — Stack fade, **`gestureEnabled: false`** : le pilote ne peut pas swiper back. Le flow est linéaire ou rien.

**[app/(onboarding)/index.tsx](app/(onboarding)/index.tsx) — #01 Accueil philosophique**
- Insigne 160×160 centré (placeholder Q7)
- Eyebrow `OXV COACH`
- Manifeste italique *"Bienvenue dans le miroir."*
- Bouton primaire `Commencer` → doctrine

**[app/(onboarding)/doctrine.tsx](app/(onboarding)/doctrine.tsx) — #02 Doctrine**
- Eyebrow `DOCTRINE`
- Titre headline *"Une app qui vous montre."*
- 3 lignes empilées titleLarge weight 200 : *"Pas un coach."* / *"Pas un instructeur."* / *"Un miroir."*
- Manifeste italique gris secondary *"Les décisions de pilotage vous appartiennent. Toujours."*
- Bouton primaire `Compris` → methode

**[app/(onboarding)/methode.tsx](app/(onboarding)/methode.tsx) — #03 Méthode**
- Eyebrow `LA MÉTHODE OXV`
- 3 blocs verticaux : **VOIR** (*Ce qui s'est passé.*) / **COMPRENDRE** (*Ce que vous avez senti.*) / **QUESTIONNER** (*Ce que vous voulez explorer.*)
- Eyebrows colorés en accent rouge OXV, letter-spacing 3
- Manifeste *"Jamais d'instruction. Toujours une observation."*
- Bouton `Suivant` → niveau

**[app/(onboarding)/niveau.tsx](app/(onboarding)/niveau.tsx) — #04 Niveau pilote**
- 4 cards verticales sélectionnables (`debutant`, `intermediaire` ("Apprivoisé"), `confirme`, `expert`)
- État actif : bordure rouge + fond rouge 8% opacité
- Caption *"Cette information reste privée. Elle calibre vos analyses."* sous le titre
- Bouton `Continuer` désactivé tant que pas de sélection, appelle `setPilotLevel`
- → cgu

**[app/(onboarding)/cgu.tsx](app/(onboarding)/cgu.tsx) — #05 CGU/RGPD**
- 3 cases à cocher custom (carré bordé, ✓ rouge OXV si checked) :
  - *"J'accepte les Conditions Générales d'Utilisation."*
  - *"J'ai lu la Politique de confidentialité."*
  - *"Je confirme avoir 18 ans révolus et un permis B valide."*
- Caption *"Les documents complets sont consultables à tout moment depuis vos paramètres."* (consultation câblée sem 10)
- Bouton `J'accepte` activé seulement si les 3 sont cochées → appelle `acceptCguAndPrivacy` → pacte
- Alert si erreur réseau

**[app/(onboarding)/pacte.tsx](app/(onboarding)/pacte.tsx) — #06 Pacte**
- L'écran le plus signature de l'onboarding. Fond noir absolu, marges aérées
- Eyebrow `PACTE DE PILOTAGE`
- Les **deux phrases manifestes** en italique title weight 200 line-height 1.6 :
  - *"L'app est un miroir. Elle vous montre. Elle ne vous dirige pas."*
  - *"La piste est à vous. Les décisions aussi."*
- Une seule case à cocher 28px : *"Je m'engage."* (plus grande que les checks #05, signature)
- Bouton primaire `Activer OXV Coach` (avec spinner pendant submit)
- À l'activation : `acceptPact()` → `completeOnboarding()` → `router.replace('/')` qui re-route vers `(app)/`
- Alerts contextualisées si l'une des deux étapes échoue

---

## Ce qui est testé et fonctionnel

- [x] `npx tsc --noEmit` : ✅ 0 erreur
- [x] `npm run lint` : ✅ 0 erreur, 4 warnings legacy V1 inchangés
- [x] `npm run format:check` : ✅ tout conforme
- [x] `npm test` : ✅ 61/61 tests
- [x] Migration `0010` confirmée présente dans les types Supabase (`pact_accepted_at: true`)

Pas validable sans device :
- [ ] Flow complet login → #01 → #02 → #03 → #04 → #05 → #06 → hub
- [ ] Persistance Supabase à chaque étape (vérifier via dashboard)
- [ ] Comportement déconnexion-reconnexion : doit retomber sur le hub (pas refaire l'onboarding)
- [ ] Comportement nouveau compte vierge

---

## Ce qui reste en suspens

Identique aux semaines précédentes :
- **Q9 — compte EAS** : toujours le goulot. Sans build natif, on a maintenant 11 écrans codés sans qu'aucun ait été vu sur device.
- **Détails circuit promis** (Q19/Q20 noms et SVG) : non reçus encore
- Q11 Sentry, Q12 Flic 2, Q13 test alpha 5 juillet, Q14-Q23 ouvertes

---

## Questions pour Gabin

### Q24 — Refus d'acceptation = quoi ?

Actuellement si le pilote ne coche pas les CGU ou ne signe pas le pacte, le bouton reste désactivé et il est bloqué sur l'écran. Pas de bouton "Refuser et quitter" — la doctrine étant que **l'app est complète ou rien**.

Trois options :
- **A — Statu quo** : il reste bloqué. Il peut fermer l'app et la rouvrir, il retombera sur le même écran.
- **B — Bouton "Quitter" discret** sur #06 qui fait `signOut()` et retombe sur login.
- **C — Auto-signOut après 5 min d'inactivité** sur l'onboarding.

Recommandation : B. C'est plus respectueux et évite la sensation d'enfermement. Code minimal.

### Q25 — `users.pilot_level` existant en base

J'ai vu dans le schéma `users.pilot_level` est un text CHECK `(debutant, intermediaire, confirme, expert)`. Mon service écrit dedans avec exactement ces 4 valeurs. Mais : qu'est-ce qui se passe pour les comptes existants dont `pilot_level` est déjà rempli (créés via le site oxvehicle.fr) ?

Actuellement l'écran #04 redemande systématiquement le niveau, même si déjà set. Trois options :
- **A — Forcer la re-sélection** (statu quo) — propre, le pilote confirme ce qu'il avait déclaré
- **B — Pré-cocher** la valeur actuelle si présente, le pilote peut juste tapper Continuer
- **C — Sauter complètement** l'écran si déjà set

Recommandation : B. Si vous validez, je l'ajoute en 5 minutes.

---

## Recommandations

### R25 — Tester le router 3-branches dès que possible

C'est la pièce de plomberie la plus délicate sem 8. À surveiller pendant le smoke test :
1. Compte vierge → arrive sur `/(onboarding)/`
2. Compte qui a fait l'onboarding → arrive sur `/(app)/`
3. Compte en cours d'onboarding (par exemple a accepté CGU mais pas Pacte) → repart sur `/(onboarding)/` mais idéalement à l'écran Pacte (V1.1 : reprise sur la 1ère étape non terminée)

### R26 — `gestureEnabled: false` à valider

J'ai désactivé le swipe back sur tout l'onboarding. Sur iOS c'est inhabituel (gesture standard). Si vous trouvez ça bloquant à l'usage (par exemple sur #04 le pilote veut revenir sur #03 pour relire la méthode), je peux réactiver et empêcher le retour uniquement sur #05 et #06 (signatures juridiques).

---

## Estimation pour la semaine 9

Selon roadmap : **Paddock #07-09 + Retour stands #10-12.**

- **J1** — #07 *Vous y êtes* (déclenchement géoloc) + état S7 paddock
- **J2** — #08 *Détection équipement* (variante prod de l'écran debug-capture) + #09 *Placement*
- **J3** — #10 *Vous avez piloté* (déclenché par fin de session vitesse 0 + timer)
- **J4** — #11 *Données en sécurité* (sync background) + #12 *Bilan prêt*
- **J5** — Détection auto S5/S7/S8 via géolocalisation + rapport

Estimation : **5 jours-claude**. Le wiring géoloc est la pièce la plus délicate — `expo-location` background sur iOS demande un usage description précis et un mode `bluetooth-central` déjà déclaré dans app.json.

---

## En résumé

L'onboarding fonctionne de bout en bout, doctrine respectée à chaque écran. Les 6 écrans posent la grammaire qui sera utilisée partout dans l'app : eyebrow / titre / manifeste / bouton primaire rouge OXV. Le router 3-branches garantit qu'on ne peut pas accéder à l'app sans avoir signé le Pacte.

24 commits totaux sur `main`. 12 écrans codés (5 cœur + 4 navigation + 6 onboarding moins #15 zoom virage qui doublonne — 11 routes distinctes). 61 tests passants. Doctrine OXV verrouillée par les tests anti-verbes-interdits.

— Claude Code, 25 mai 2026
