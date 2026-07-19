# PROMPT CLAUDE CODE — LOT BIO-2 · CEINTURE POLAR H10 + LIVE COACH
### Repo oxv-app · GATES : BE-1 mergé · consentement avocat validé · smoke live 2 appareils · un lot = un commit — 18/07/2026

---

## CONTEXTE
Le niveau 2 de la biométrie : FC + R-R précis en streaming pour les pilotes coachés, via le relais téléphone EXISTANT. Référence protocole : `OXV_Ceinture_Protocole_Connexion_Biometrie.md`. **RÈGLE CARDINALE : on GREFFE sur `liveRelayRunner` et les canaux `live:roster:`/`live:session:` existants — on ne crée AUCUN système live parallèle.** `bluetoothService` peut être ÉTENDU dans ce lot (exception BE explicite) mais jamais cassé : le scan RaceBox reste identique, tests v1 verts.

## LIVRABLE 1 — Extension BLE Polar · `bluetoothService` (+ tests)
- Scan/connexion 2e périphérique : service standard 0x180D, characteristic 0x2A37 (notify).
- **Parser exact** (fonction pure `parseHeartRateMeasurement(dataView)`, testée sur les vecteurs du doc protocole) : octet flags → format HR 8/16 bits (bit 0) · statut contact peau (bits 1-2 ; 2 = électrodes sèches → qualité dégradée signalée) · énergie présente (bit 3 → sauter 2 octets) · R-R présents (bit 4) → liste uint16 little-endian en 1/1024 s convertis ms.
- Gestion double connexion (RaceBox + Polar simultanés) : files séparées, reconnexion indépendante, aucun couplage d'échec (Polar tombe → capture télémétrique intacte).

## LIVRABLE 2 — Appairage paddock · extension `rec/equipement.tsx`
Section ceinture (coachés) passe de « à appairer » à réelle : scan filtré « Polar H10 », carte appareil (batterie si dispo, contact peau pastille), mémoire du dernier appairage par pilote (patron RaceBox). **Gate absolue : le scan Polar n'est accessible que si consentement `biometry` accordé** (sinon la carte renvoie vers la Sheet consentement). Staff : rien à faire côté app admin dans ce lot (l'appairage est sur le téléphone du pilote, assisté humainement au paddock).

## LIVRABLE 3 — Capture locale
Échantillons (ts, hr, rr_ms[], contact) → buffer mémoire + flush SQLite locale (patron file capture, table locale dédiée `biometry_buffer`) → à la préservation : `biometryService.saveSamples(sessionId, samples, 'polar_h10')` (chunks, idempotent). Offline-first identique à la télémétrie. `quality` : depuis statut contact + densité.

## LIVRABLE 4 — Greffe live · `liveRelayRunner` (extension chirurgicale)
- Nouvel événement `biometry` émis sur les canaux privés EXISTANTS (`live:session:<sessionId>`) à 0,5 Hz (moyenne glissante 2 s — le coach n'a pas besoin du 1 Hz brut) : `{hr, rrTrend, contact, ts}`.
- **Triple gate fail-closed testée** : consentement biometry actif + binôme détaillé + flag `biometry` — l'un tombe (révocation en vol comprise, patron révocation live existant) → l'événement cesse immédiatement.
- `stripHealth()` : fonction pure appliquée à TOUT payload sortant vers un canal non-coach (board LIVE-B inclus par anticipation) — whitelist stricte {position, lapMs, sector, ts} ; test : un payload contenant hr/rr ne passe JAMAIS.

## LIVRABLE 5 — Vue coach · extension écrans en-direct existants
- Roster : pastille cœur discrète par pilote consenti (couleur = zone factuelle, pas d'alerte automatique — le coach juge, l'app ne diagnostique pas).
- Focus pilote : bande FC live (sparkline Skia fenêtre 60 s, valeur RollingCounter, tendance R-R en fait « variabilité stable/en baisse » — vocabulaire factuel figé, liste fermée de 3 libellés).
- Post-session coach : la `BiometryStrip` de la séance apparaît dans la lecture coach (RLS BE-1 l'autorise déjà).
- JAMAIS de biométrie dans l'espace staff/admin : grep dédié en preuve.

## PREUVES
tsc 0 · jest vert (parser vecteurs binaires, triple gate, stripHealth, révocation en vol, découplage échec Polar/capture) · greps : biométrie absente de `app/(admin)` et de tout payload board · test 2 appareils réels (pilote+coach) consigné `roadmap/rapports/bio-2.md` · scan RaceBox v1 : tests inchangés verts.

## HORS PÉRIMÈTRE
Watch (BIO-1/3 séparés) · board TV (LIVE-B) · pilier Signature (BIO-4) · matériel staff.
