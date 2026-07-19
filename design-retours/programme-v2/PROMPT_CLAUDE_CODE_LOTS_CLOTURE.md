# PROMPTS CLAUDE CODE — LOTS DE CLÔTURE · BIO-3 · B1 · A1-ON · V2-L6
### Repo oxv-app · 4 lots indépendants, un commit chacun — 18/07/2026

---

# LOT BIO-3 · MINI-APP WATCHOS (phase B — zéro geste pilote)
**GATE : BIO-1 en production et validé une journée réelle.**
1. Target watchOS native (Swift, config plugin Expo + target Xcode — même mécanique EAS que L2-B) : app OXV Watch UN écran (insigne + état « Enregistrement » / « Prêt »).
2. `WCSession` : l'iPhone notifie l'armement de la capture → la Watch démarre `HKWorkoutSession` (type .other) → FC 1 Hz dans HealthKit ; `pilotage-fini` → stop. Aucune UI à toucher côté pilote.
3. Complication cadran : insigne + J-x (timeline quotidienne).
4. La lecture iPhone (BIO-1) devient quasi temps réel côté données MAIS la restitution pilote RESTE à la pause/bilan (doctrine inchangée — la phase B améliore la densité, pas le moment d'affichage). Entre-runs : la ligne « Cœur disponible au bilan » devient la vraie `BiometryStrip` du run (source watch) quand les échantillons sont déjà lisibles.
5. Preuves : session automatique démarrée/arrêtée sur device réel, densité ~1 Hz constatée, échec Watch absente = silencieux non bloquant.

---

# LOT B1 · VIDÉO SYNCHRONISÉE TÉLÉMÉTRIE ⭐ le différenciateur
**GATES : frames réelles · flag `video_overlay` · coût stockage validé fondateur (les exports restent ON-DEVICE an 1 — rien sur serveur, coût zéro, décision par défaut).**
1. **Import** : depuis Galerie/Bilan/Séance — picker vidéo (pellicule iPhone ou fichier GoPro). Montage 100 % on-device (`expo-av` lecture + rendu frames via Skia offscreen, export `expo-video-thumbnails`/AVAssetWriter via module léger — pas de serveur vidéo).
2. **Synchronisation tap-align** : l'utilisateur cale UN instant : il scrubbe la vidéo jusqu'au franchissement de la ligne (image) pendant que l'app affiche le franchissement télémétrique (ts) — bouton « CALER ICI » ; offset stocké (`video_overlays` BE-1). Ajustement fin ±0,5 s par molette hairline. C'est simple et ça marche (patron RaceRender).
3. **Overlay DA Instrument** (rendu Skia composé frame par frame) : bandeau bas — chrono roulant JetBrains Mono millièmes rouges · mini-tracé avec point de position `GlowStroke` · G latéral jauge fine · vitesse mono · insigne discret haut droit. AUCUNE biométrie dans l'export par défaut ; option « inclure mon cœur » explicite (ses données à lui, son choix — case décochée par défaut).
4. **Export** : 9:16 (vertical social) et 16:9, durée max 90 s (un tour), file d'export avec Dial de progression, partage natif. Watermark « OXV » sobre — chaque partage est signé.
5. Preuves : export réel 60 s sur device sans frame drop, sync ±2 frames sur vecteur test, grep biométrie hors option explicite.

---

# LOT A1-ON · ACTIVATION PAIEMENTS
**GATES : SIRET obtenu · Stripe live · CGV validées avocat (distinction IAP/Stripe) · flux L4 en prod flag OFF depuis ≥ 2 semaines (funnel analytics lu).**
1. **Stripe** (journées + Heritage — services physiques, hors commission Apple) : `@stripe/stripe-react-native` PaymentSheet (Apple Pay activé) branché sur le pas 3 du flux L4 ; edge NOUVELLE `create-payment-intent` (repo site, à côté du webhook existant `send-payment-confirmed`) : vérifie place disponible (plafond 20, verrou transactionnel), crée l'intent, écrit `registrations` pending → webhook confirme (patron site existant). Liste d'attente : inscription + notification si libération.
2. **IAP** (abonnement 99 €/an — numérique, règle Apple) : `react-native-iap` produit auto-renouvelable, reçu vérifié serveur (edge `verify-iap`), écrit l'abonnement. Restauration d'achat obligatoire (review Apple).
3. **Vérification Heritage** : prix BDD = 249 000 cents (le correctif consigné) — test automatisé qui échoue si la valeur diverge du modèle v15.
4. Flag `app_payments` ON par migration — chaque écran du flux re-vérifie (déjà codé L4). Emails transactionnels : brancher les templates Resend existants du site.
5. Preuves : paiement test Stripe bout en bout + IAP sandbox + place décomptée + double-achat impossible (idempotence) + remboursement testé.

---

# LOT V2-L6 · BASCULE FINALE
**GATES : L0-L5 validés fondateur sur device · smoke test v2 complet (flux jour J réel en v2) · crash-free ≥ 99,5 % sur build interne 2 semaines.**
1. Redirects : toutes les routes v1 pilotes → équivalents v2 (table de mapping du dossier maître §4, deep links notifications mis à jour).
2. Racine : `(app2)` devient l'arbre par défaut du rôle pilote.
3. Suppression des écrans pilote v1 morts (la liste §9 du dossier maître) — les espaces coach/admin/partner/pro v1 RESTENT (leur refonte = série suivante).
4. `dev-galerie` conservée (`__DEV__`). Nettoyage imports/styles orphelins (`knip` ou grep systématique).
5. BIO-4 : activer le pilier physiologique dans Signature SI le nom est tranché (constante) ET données réelles ≥ 3 séances multi-pilotes — sinon reste OFF, ce n'est pas bloquant pour la bascule.
6. **Préparation App Store** : icône + splash DA Instrument (insigne trait sur titane), captures des 6,7"/6,1" générées depuis les écrans réels (accueil J-6 avec GT, bilan, séance, signature, galerie), texte fiche (doctrine relue), politique de confidentialité mise à jour (HealthKit, données santé — wording avocat).
7. Preuves : parcours complet nouvel utilisateur → première séance → bilan en v2 pure · zéro route v1 pilote atteignable · build TestFlight soumis.

---

## ORDRE FINAL D'EXÉCUTION DE LA SÉRIE COMPLÈTE
BE-1 → L0 → L1 → L2 (+L2-B) → L4 → L5 → **[SMOKE TEST TERRAIN]** → L3 → BIO-2 → **[DÉCISION CLASSEMENT]** → LIVE-B → BIO-3 → B1 → **[SIRET]** → A1-ON → L6 → App Store.
