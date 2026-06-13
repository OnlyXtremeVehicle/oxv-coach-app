# Brief de démarrage — Claude Code · Chantier capture OXV Mirror

Copiez le bloc ci-dessous comme premier message à Claude Code (dans le repo Expo de l'app mobile).

---

## CONTEXTE
Tu travailles sur OXV Mirror, l'app mobile de télémétrie post-session (Expo / React Native).
Le dossier de specs complet est dans `oxv-mirror-specs/` (dézippe `oxv-mirror-specs.zip` à la
racine si besoin). Lis ces fichiers DANS CET ORDRE avant d'écrire la moindre ligne :

1. `oxv-mirror-specs/00_CLAUDE.md` — le contrat : doctrine, charte, briques V1 à garder/jeter,
   les 9 règles de code. Non négociable.
2. `oxv-mirror-specs/03_chantier_capture.md` — LE document de ce chantier : modèle RaceBox Mini,
   contraintes BLE, mapping octet→colonne, schéma cible de `telemetry_frames`.
3. `oxv-mirror-specs/02_moteur_insights.md` (section 1 + addendum §5) — pour comprendre ce que la
   donnée capturée devra nourrir en aval (ne PAS coder les insights maintenant, juste capturer
   tout ce qu'ils exigeront, gyroscope compris).

## ÉTAT FACTUEL (vérifié)
- Supabase projet `fouvuqkdxarjpjbqnsjq` (Frankfurt). Table `telemetry_frames` VIDE, schéma déjà
  migré et prêt (gyroscope rotation_x/y/z, itow_ms, speed_ms/speed_accuracy, heading_accuracy,
  pdop, fix_valid ajoutés). NE PAS re-migrer le schéma : il est correct, vérifie-le et utilise-le.
- `telemetry_sessions` existe (10 sessions test) avec `raw_data_url` pour le dump brut.
- Le repo Expo contient déjà des briques V1 à RÉUTILISER (cf. 00_CLAUDE.md) : parser UBX, service
  BLE, types télémétrie, détection de tours, météo. NE PAS repartir de zéro. Inspecte l'existant
  d'abord, dis-moi ce que tu trouves, et propose ce que tu gardes / refactores / ajoutes.

## RÈGLE MATÉRIELLE CRITIQUE
RaceBox **Mini** = PAS de standalone. La connexion BLE doit tenir toute la session. Le protocole
fragmente les paquets sur plusieurs notifications : buffer FIFO d'octets OBLIGATOIRE, avec
vérification entête (0xB5 0x62) + longueur + checksum avant parsing. Jeter tout paquet corrompu.
Gérer reconnexion auto, perte de fix, batterie faible.

## PREMIÈRE TÂCHE (et SEULEMENT celle-ci pour l'instant)
Ne code pas toute la chaîne d'un coup. Étape 1 = **audit + plan**, pas d'implémentation lourde :
1. Lis les 3 fichiers de specs ci-dessus.
2. Inspecte le repo : qu'est-ce qui existe déjà pour le BLE / parsing / écriture Supabase ?
3. Vérifie le schéma réel de `telemetry_frames` via le MCP Supabase (ou demande-moi).
4. Rends-moi : (a) un état de l'existant, (b) le plan de la chaîne de capture en étapes testables,
   (c) la liste précise de ce que tu vas garder / jeter / créer. ATTENDS ma validation avant de
   coder l'étape suivante.

## RAPPELS
- Calcul des insights = côté Supabase plus tard, PAS dans l'app. L'app capture et affiche.
- Doctrine miroir : aucune sortie prescriptive. Ici on ne fait que capturer, donc surtout : ne
  perds pas de données, ne maquille pas l'incertitude (champs de fiabilité à remplir).
- Tu ne peux pas tester sur un vrai RaceBox depuis ton environnement — écris le code testable
  (parsing vérifiable sur le paquet exemple du protocole : `B5 62 FF 01 50 00 ...`), et signale
  ce qui devra être validé sur device réel.
- Incréments validés un par un. Pas de refactor spéculatif. Architecture mono-repo Expo préservée.

Commence par l'étape 1 et reviens vers moi avec ton audit.
