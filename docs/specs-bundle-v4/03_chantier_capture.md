# Chantier capture — RaceBox Mini → telemetry_frames

Reference protocole : RaceBox BLE Protocol rev 8 (fourni). Ce document fige le schema cible et
les contraintes pour le build de la chaine de capture. A lire avec `00_CLAUDE.md` (briques V1 a
garder : parser UBX, service BLE) et `02_moteur_insights.md` (consommateurs des donnees).

## Modele materiel : RaceBox MINI (confirme)
- **PAS de standalone recording.** Le Mini n'enregistre PAS en memoire interne — il REQUIERT une
  connexion BLE constante au telephone pour capturer. (Seuls Mini S / Micro ont le standalone.)
- **Consequence directe :** la robustesse de la connexion BLE 25 Hz est le point de fragilite
  numero un de la capture. Si le lien tombe, la donnee de cette periode est perdue, definitivement.

## Contraintes BLE (du protocole, critiques pour le Mini)
- Le device envoie ~25 messages/s, payload 80 octets (message 0xFF 0x01).
- **Les paquets sont fragmentes sur plusieurs notifications BLE** et une notification peut contenir
  plusieurs paquets ou des paquets partiels. OBLIGATOIRE : buffer FIFO d'octets, reassemblage,
  verification de l'entete (0xB5 0x62) + longueur + **checksum** avant parsing. Ne jamais supposer
  qu'une notification = un message complet.
- Demander MTU le plus grand possible + connection interval le plus court possible.
- Gerer proprement : perte de lien (reconnexion auto), perte de fix GNSS, batterie faible
  (le protocole recommande de se preparer a la deconnexion a 0%).
- Degradation propre : si un paquet est corrompu (checksum KO), le jeter, ne pas l'ecrire.

## Mapping protocole → colonnes telemetry_frames
Conversions a appliquer au parsing (toutes documentees dans le protocole) :

| Champ protocole (offset) | Conversion | Colonne DB |
|---|---|---|
| iTOW (0) | ms bruts | `itow_ms` |
| Latitude (28) | / 1e7 | `latitude` |
| Longitude (24) | / 1e7 | `longitude` |
| MSL Altitude (36) | mm → m (/1000) | `altitude_m` |
| Horizontal Accuracy (40) | mm → m (/1000) | `gps_accuracy_m` |
| Fix Status (20) | enum (3 = 3D fix) | `gps_fix` |
| Fix Status Flags bit 0 (21) | bool (fix valide) | `fix_valid` |
| Number of SVs (23) | entier | `satellites` |
| Speed (48) | mm/s → m/s (/1000) | `speed_ms` |
| Speed (48) | mm/s → km/h (×0.0036) | `speed_kmh` |
| Speed Accuracy (56) | mm/s → m/s (/1000) | `speed_accuracy` |
| Heading (52) | / 1e5 (deg) | `heading` |
| Heading Accuracy (60) | / 1e5 (deg) | `heading_accuracy` |
| PDOP (64) | / 100 | `pdop` |
| GForceX (68) | milli-g → g (/1000) | `g_force_x` (avant/arriere) |
| GForceY (70) | milli-g → g (/1000) | `g_force_y` (lateral) |
| GForceZ (72) | milli-g → g (/1000) | `g_force_z` (vertical) |
| Rotation X (74) | centi-deg/s → deg/s (/100) | `rotation_x` (roll) |
| Rotation Y (76) | centi-deg/s → deg/s (/100) | `rotation_y` (pitch) |
| Rotation Z (78) | centi-deg/s → deg/s (/100) | `rotation_z` (yaw) |
| Battery (67) | 7 bits = % (Mini) | `battery_level` |

`elapsed_ms` = temps depuis le debut de session (derive de iTOW ou horloge locale). `session_id`
= FK vers `telemetry_sessions`. `created_at` = horodatage d'insertion.

## Stockage hybride (valide)
- **Frames en base** (`telemetry_frames`, 25 Hz) : pour requeter les insights. Index
  `(session_id, elapsed_ms)` deja cree.
- **Fichier brut** : dump compresse de la session (idealement les octets UBX bruts ou un JSON/CSV
  compresse) uploade vers Supabase Storage, URL dans `telemetry_sessions.raw_data_url` (colonne
  existante). Sert d'archive de souverainete + permet de recalculer si les formules evoluent.
- A la fin de session, renseigner les resumes dans `telemetry_sessions` : `total_frames`,
  `max_speed_kmh`, `max_g_lateral`, `max_g_longitudinal`, `distance_km`, `lap_count`,
  `best_lap_seconds`, `duration_seconds`, `status`.

## Qualite de donnee (precision > cosmetique)
Les champs de fiabilite ne sont pas decoratifs — ils conditionnent la justesse des insights :
- **Filtrer en amont du calcul** : un echantillon avec `fix_valid = false`, `pdop` eleve, ou
  `gps_accuracy_m` mauvais ne doit pas polluer la trajectoire (dispersion N3.1) ni le yaw
  geometrique (equilibre N4.4). Le rejeter ou le ponderer.
- **Signaler honnêtement** : si une portion de tour a une donnee degradee, l'app peut l'indiquer
  (coherent doctrine miroir : on montre aussi l'incertitude, on ne maquille pas).

## Schema telemetry_frames — etat final (apres migrations)
id, session_id, elapsed_ms, latitude, longitude, altitude_m, gps_accuracy_m, gps_fix,
satellites, speed_kmh, heading, g_force_x, g_force_y, g_force_z, battery_level, created_at,
rotation_x, rotation_y, rotation_z, itow_ms, speed_ms, heading_accuracy, pdop, speed_accuracy,
fix_valid.

## Etat au moment de la redaction
- `telemetry_frames` : 0 ligne (vide). `telemetry_sessions` : 10 sessions de test.
- Migration gyroscope + champs protocole + precision : APPLIQUEE et verifiee.
- Premiere vraie capture cible : Valence, juillet 2026. Tester la robustesse BLE AVANT (le Mini
  n'a pas de filet standalone).
