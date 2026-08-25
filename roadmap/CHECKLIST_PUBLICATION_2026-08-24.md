# Checklist de publication — état au 24/08/2026

> Ce document est le chemin complet entre l'état d'aujourd'hui et la soumission
> aux stores. Il a été établi après un audit mesuré le 24/08 (git, config,
> runtime, tests, légal — 5 axes indépendants) et il distingue ce qui est FAIT,
> ce qui est CODE (faisable ici), et ce qui n'appartient qu'au fondateur.
>
> Complète `roadmap/JALONS_RESTANTS_2026-08-17.md` (jalons produit) — ici, il
> ne s'agit que de la mise en service.

---

## Mesures du 24/08 (pour mémoire)

| Axe | Résultat |
|---|---|
| Tests | typecheck OK · 3 564 verts, 0 échec, 98 RLS skippés (52 s) |
| Git | 2 commits non poussés · 18 d'avance sur main · 5 fichiers non commités |
| Config build | production PRÊTE (bundle `fr.oxvehicle.app`, profils EAS, icônes, permissions iOS, privacy manifests) |
| Config submit | `submit.production` VIDE — voir §3 |
| Runtime | rien ne casse ; carte sans fond (tuiles absentes, état prévu) ; garde-fous branchés (kill-switch monté, flags fail-closed, paiement OFF) |
| Légal | mentions à trous ([SIRET], siège, RCS, capital, date) = BLOQUANT store |
| EAS | connecté au compte `oxv` · env preview complet (Supabase, Sentry + auth token, GraphHopper) |

---

## 1 · Fait le 24/08 (côté code — à commiter par le fondateur)

- [x] `app.json` : permissions Android héritées retirées (`READ/WRITE_EXTERNAL_STORAGE`
      supprimées ; `BLUETOOTH`/`BLUETOOTH_ADMIN` retirées de la liste explicite —
      le plugin `react-native-ble-plx` les injecte lui-même avec `maxSdkVersion`,
      la déclaration explicite lui faisait perdre cette borne).
- [x] `assets/notification-icon.png` créé : icône de notification Android
      monochrome (blanc + alpha, 96×96, silhouette de l'emblème OXV, dérivée de
      l'icône adaptative) et branchée dans le plugin `expo-notifications`.
      Avant : l'icône couleur 1024 → carré gris dans la barre d'état.
- [x] `src/lib/sentry.ts` : `tracesSampleRate` 1.0 → 0.2 (100 % des traces en
      prod = quota Sentry et réseau pilote consommés pour rien).
- [x] `.env.example` : bundle ID corrigé (`fr.oxvehicle.coach` → `fr.oxvehicle.app`),
      section Google Maps périmée supprimée (retirée du code le 17/08).
- [x] **Textes juridiques — région d'hébergement corrigée** : « Frankfurt »
      → « Dublin, Irlande » dans CGU (art. 8.3), politique de confidentialité
      (§5.2 tableau + §10) et CGV (2 mentions), puis régénération
      (`node scripts/genlegal.js`). Le projet Supabase de production est en
      **eu-west-1 (Irlande)** — vérifié par l'API. Version des documents laissée
      à 1.0 : ils ne sont pas encore « en vigueur » (date en placeholder) et
      passeront de toute façon par l'avocat. **À valider au commit.**
- [x] **Premier build Android preview RÉUSSI** sur EAS (profil `preview`, APK,
      distribution interne, versionCode distant 7, commit `b00f8bb`) — le
      premier build contenant MapLibre : **Gradle passe**, la voie Android est
      ouverte. Page du build :
      https://expo.dev/accounts/oxv/projects/oxv-app/builds/80688550-9a5c-496f-9246-05424b9e05eb
      APK à installer :
      https://expo.dev/artifacts/eas/aQYGwjubD8UGfoTc0Bpl68tG3bfhdMUqfTb89ba8T2M.apk
      Le lancement a confirmé : env preview complet chargé, et **keystore
      Android déjà présent sur le compte EAS** (« Build Credentials DAQR_uYvIg »).

Les autres mentions « Frankfurt » du dépôt (16 fichiers dans `docs/` hors
juridique) sont des documents internes — sans effet sur la publication, à
corriger au fil de l'eau.

---

## 2 · Bloquant légal — le fondateur uniquement

Sans ces valeurs, l'app n'est pas soumettable (art. 13 RGPD : responsable de
traitement identifiable).

- [ ] Renseigner dans `docs/juridique/` (CGU, politique, pacte, CGV) :
      **SIRET, siège social, RCS, capital, [date de mise en service]** — puis
      `node scripts/genlegal.js && npm run format`.
- [ ] Faire valider par l'avocat : CGU, politique, CGV, **décharge (v0.1
      PROJET)** et la **mention CGV de l'écran de paiement**
      (`app/(app2)/reserver/paiement.tsx` — le flag `app_payments` reste OFF
      tant que ce texte n'existe pas).
- [ ] Publier la politique de confidentialité sur le site :
      **https://oxvehicle.fr/confidentialite** (exigée par les DEUX stores).
      Spécification : `docs/architecture/19_HANDOFF_SITE_PAGE_CONFIDENTIALITE.md`.

---

## 3 · Comptes et consoles stores — le fondateur uniquement

### Apple (App Store) — voir aussi §7.2 (compte Individual)
- [ ] Vérifier que le bundle `fr.oxvehicle.app` est enregistré sur le compte
      développeur (Identifiers) **avec la capability HealthKit activée**
      (l'app lit la fréquence cardiaque — un App ID sans HealthKit = build
      rejeté à la signature).
- [ ] Créer la fiche App Store Connect (nom, sous-titre, captures, URL de
      confidentialité, questionnaire « Confidentialité de l'app »).
- [ ] Rappel quota : builds iOS de nouveau possibles au **1er septembre**.

### Google (Play Console) — LIRE §7.1 AVANT de créer le compte
- [ ] Créer la fiche Play Console — en **compte organisation** (§7.1), donc
      après le SIRET. Le **tout premier envoi d'AAB se fait à la main** dans la
      console (EAS ne peut pas créer la fiche).
- [ ] Créer une clé de **compte de service Google** (API Play Developer) pour
      les envois suivants via `eas submit`.
- [ ] Formulaires console : Data Safety, déclaration de localisation
      (ACCESS_FINE_LOCATION + BLUETOOTH_SCAN), déclaration app de santé si
      demandée (Connect Santé n'est PAS utilisé — lecture HealthKit iOS
      uniquement).

### eas.json — à remplir quand les comptes existent
```json
"submit": {
  "production": {
    "ios": {
      "ascAppId": "<id numérique App Store Connect>",
      "appleTeamId": "<team id>"
    },
    "android": {
      "serviceAccountKeyPath": "<chemin local, JAMAIS commité>",
      "track": "internal"
    }
  }
}
```
- [x] Keystore **Android** : confirmé sur le compte EAS le 24/08 (utilisé par le
      build preview — « Build Credentials DAQR_uYvIg »).
- [ ] Certificat de distribution **iOS** : le compte Apple est connecté à EAS
      (Gabin Fillat, Individual, team K53YDJ3Y55) avec un certificat **Ad Hoc**
      valide (builds internes OK, iPhone enregistré). Le certificat de
      **distribution App Store** sera créé par EAS au premier build
      `production` iOS — à faire en interactif (`npx eas credentials -p ios`)
      avant ou au 1er septembre.

---

## 4 · Infrastructure — décisions du fondateur, exécution partagée

- [ ] **Tuiles cartographiques** : décider l'emprise géographique et
      l'hébergement → produire le `.pmtiles` → le site expose le service
      (`docs/architecture/18_HANDOFF_SITE_TUILES_CARTO.md`) → renseigner
      `EXPO_PUBLIC_TILES_URL` dans les environnements EAS (`npx eas env:create`).
      Sans elle : la carte rend le fond titane nu (état prévu, pas un crash).
- [ ] **Identifiants RLS de test** : fournir `TEST_SUPABASE_URL` +
      `TEST_SUPABASE_SERVICE_KEY` (projet distinct de la prod) pour armer les
      98 tests de sécurité (`docs/architecture/17_CI_RLS_SETUP.md`). Les
      politiques écurie du 17/08 sont en prod et vérifiées par aucun test.

---

## 5 · Vérification sur appareil (le build preview est PRÊT depuis le 24/08)

- [ ] Installer l'APK preview sur un Android (autoriser les sources inconnues) :
      https://expo.dev/artifacts/eas/aQYGwjubD8UGfoTc0Bpl68tG3bfhdMUqfTb89ba8T2M.apk
- [ ] Regarder, dans l'ordre (jalon A3) : le fond de carte (couches
      `earth/water/roads/buildings` à confirmer contre le .pmtiles réel — sans
      tuiles, vérifier simplement que l'écran carte est stable), les
      graduations des canaux, le cyan Régularité sur le radar QDI.
- [ ] Vérifier l'icône de notification (une notification locale de test →
      silhouette blanche, pas un carré).
- [ ] Parcours minimal : connexion, accueil, une séance en données réelles,
      écran écurie.

---

## 6 · Ordre recommandé jusqu'à la soumission

1. Commit + push de l'état du jour (fondateur — inclut les correctifs ci-dessus).
2. Regard sur le build Android preview (§5) ; corrections visuelles s'il y a lieu.
3. Mentions légales complétées + avocat (§2) → régénération → re-commit.
4. Comptes stores + credentials + submit (§3), en parallèle de 3.
5. Tuiles + RLS de test (§4).
6. 1er septembre : build iOS + TestFlight interne → alpha.
7. Soumission stores après validation alpha — décision explicite du fondateur.

---

## 7 · COMPLÉMENT du 24/08 (soir) — trois points vérifiés, deux décisions à ajouter

> Ajouté après relecture croisée : dépôt (copie du 14/08 — cohérente avec
> l'audit config « PRÊTE ») et règles stores en vigueur (recherche du 24/08).
> Le §7.3 a été re-vérifié le jour même sur le clone principal (état du 24/08) :
> les trois constats tiennent.

### 7.1 — Décision manquante : type de compte Play (interagit avec D9/SIRET)

Le §3 dit « créer la fiche Play Console » sans choisir le type de compte, et
ce choix n'est pas neutre :

- **Compte personnel** (créé après nov. 2023) : soumis à la règle
  **12 testeurs × 14 jours** en test fermé AVANT tout accès à la production.
  Un délai incompressible et un recrutement de testeurs à organiser.
- **Compte organisation** : exempté de cette règle, mais exige un numéro
  **D-U-N-S** — donc la SASU immatriculée (SIRET, D9). Et la fiche store
  affiche l'entreprise, pas un nom personnel.

Recommandation : ne PAS créer un compte personnel par réflexe. Attendre le
SIRET (déjà bloquant au §2) et créer un compte organisation — le même geste
D9 débloque le légal ET le bon compte Play. Le calendrier (avril 2027) absorbe
largement ce séquencement ; le test interne alpha, lui, ne dépend pas de la
règle (elle ne gate que la production).

### 7.2 — Décision à consigner : le compte Apple est Individual

Le compte connecté à EAS est « Gabin Fillat, Individual ». Sur l'App Store, le
**nom de vendeur affiché sera « Gabin Fillat »**, pas OXV. Le passage en
compte Organisation (D-U-N-S + entité légale) est possible mais c'est une
procédure Apple à part entière. À trancher : assumer le nom personnel pour
l'alpha/TestFlight (aucun impact), et décider avant la SOUMISSION publique si
la fiche doit porter la SASU.

### 7.3 — Trois non-lacunes, vérifiées dans le dépôt

- **« Sign in with Apple » n'est PAS requis** : l'authentification est
  e-mail + mot de passe uniquement (`signInWithPassword`, aucun OAuth tiers
  dans `useAuthStore`). La règle Apple 4.8 ne s'applique qu'aux logins tiers.
- **Export compliance déjà réglée** : `ITSAppUsesNonExemptEncryption: false`
  est dans `app.json` — pas de question bloquante à chaque upload TestFlight.
- **HealthKit côté binaire déjà porté par le plugin** : `react-native-health`
  est configuré dans `app.json` avec `healthSharePermission` (il injecte
  l'usage description et l'entitlement au prebuild). Il ne manque bien QUE la
  capability sur l'App ID — le §3 est complet sur ce point.

Nota `eas.json` : le track `"internal"` proposé est le bon choix — le test
interne ne compte PAS dans l'horloge des 14 jours (seul le test fermé compte),
mais il n'en dispense pas non plus si le compte est personnel.
