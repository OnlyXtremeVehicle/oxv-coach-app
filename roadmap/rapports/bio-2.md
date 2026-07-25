# Rapport de lot — BIO-2 · Ceinture Polar H10 + live coach

Branche `feat/site-document-emails` · juillet 2026 · drapeau `biometry` **OFF**

---

## Ce que j'ai fait

Quatre incréments, un commit chacun.

| Commit | Livrable | Contenu |
|---|---|---|
| `f9b7767` | cœur pur | `heartRateParser` (0x2A37), `liveHealthGate` (stripHealth + triple verrou), `biometryBufferLogic` |
| `8ba669d` | L1 + L4 | extension BLE Polar · greffe relais cardio coach |
| `a2560da` | L3 | capture cardio locale offline-first (dégel cardinal ciblé) |
| *(ce lot)* | L2 + L5 | appairage paddock réel · vue coach (roster, focus, post-séance) |

### Livrable 1 — Extension BLE (exception cardinale sanctionnée)

Chemin Polar **entièrement séparé** du RaceBox : service 0x180D, mesure 0x2A37 en
notify, double connexion assumée, reconnexion cardio bornée et indépendante. La
ceinture tombe → la capture télémétrique reste intacte, et réciproquement.

**Le scan RaceBox est byte-identique** : `git diff` montre 0 ligne retirée ou
modifiée sur `bluetoothService.ts` — l'extension est purement additive.

### Livrable 2 — Appairage paddock

`rec/equipement.tsx` : la carte « à appairer par le staff » devient un appairage
réel (scan filtré Polar, liste des ceintures détectées, mémoire du dernier
appairage par pilote sur le patron RaceBox, état de contact peau).

**Gate absolue** : sans consentement de capture, aucun scan cardio n'est ouvert —
la ligne renvoie vers la feuille de consentement.

### Livrable 3 — Capture locale

`biometryCaptureBuffer` (pur, MMKV injecté) + `biometryCaptureRunner` (runtime).
Registre **séparé** de `captureSyncQueue`, sur le patron `incidentOffline`.
Double verrou local fail-closed (drapeau + consentement de capture), persistance
de sûreté toutes les 10 s, préservation idempotente à la clôture **puis purge du
local**, rejeu des séances orphelines au retour réseau, séance abandonnée → purge
sans rien préserver.

Les lectures hors [25, 250] bpm sont écartées : ce sont des décrochages capteur,
et le CHECK base aurait fait échouer le lot entier.

### Livrable 4 — Greffe live

Événement `biometry` sur le canal privé **existant** `live:session:<id>`, via un
`sendBiometry` dédié (jamais le canal roster/frame), à 0,5 Hz.
`buildBiometryEvent` est pur : FC moyenne, tendance de variabilité factuelle
(liste fermée), contact, `null` honnête si rien d'exploitable.

**Triple verrou re-vérifié à chaque tick** (consentement capture+partage · binôme ·
drapeau), fail-closed. Drapeau OFF → bloc dormant, aucune I/O santé.

### Livrable 5 — Vue coach

- **Roster** : marqueur discret « Cardio » sur les pilotes qui partagent.
- **Focus** : bande cardio live (valeur, sparkline 60 s, variabilité + contact),
  neutre en crème comme la vitesse — ni or (record) ni rouge (alarme).
- **Post-séance** : `BiometryStrip` dans le débrief coach, lecture gatée par le
  drapeau, accès arbitré par la RLS BE-1.

---

## Ce qui est testé et fonctionnel

- `tsc` 0 · `eslint` 0 · `prettier` OK
- `jest` **1721 tests verts**, dont pour ce lot : parser (17 vecteurs binaires),
  `stripHealth` + triple verrou (8), buffer qualité (23), `buildBiometryEvent` (11),
  throttle 0,5 Hz (3), buffer capture (10), verrous du runner (7).
- **Cardinal** : `useAppStateStore` et `captureSyncQueue` — diff vide.
  `bluetoothService` (exception sanctionnée) et `captureSessionService` (dégel
  ciblé approuvé) — **purement additifs, 0 ligne retirée**.

### Preuves d'étanchéité (RGPD art. 9)

- `grep` biométrie/cardio/FC sur `app/(admin)` → **vide**. La santé n'existe pas
  dans l'espace staff.
- La FC (`hrBpm`) n'apparaît que dans `BiometryLiveEvent`, l'événement coach dédié.
  `broadcast.send` ne porte que la trame (position/chrono/G), `joinRoster` que la
  présence (prénom/circuit/booléen de partage) — aucun champ santé.
- Canal privé : la RLS `realtime.messages` empêche un non-binôme de s'y abonner.

### Un bug de doctrine attrapé en cours de route

En relisant le flux, j'ai trouvé que si le pilote **révoquait en vol**, le relais
cessait d'émettre mais la dernière FC restait figée à l'écran du coach — une donnée
périmée présentée comme du direct, exactement ce que la règle du live interdit.
Corrigé : la biométrie se **périme après 10 s** sans événement (≈ 5 ticks manqués) —
révocation, ceinture décrochée ou réseau tombé effacent l'affichage. L'absence est
un état honnête.

---

## Ce qui reste en suspens

**Rien de logiciel.** Ce qui manque n'est pas du code :

1. **Consentement biométrie — validation avocat.**
   `docs/juridique/consentement_biometrie.md` porte toujours « VALIDATION AVOCAT
   REQUISE ». Le drapeau ne doit pas être levé avant.
2. **Document protocole absent.**
   `OXV_Ceinture_Protocole_Connexion_Biometrie.md` n'a jamais été livré. Le parser
   dérive donc de la **spec publique Bluetooth SIG** (org.bluetooth.characteristic
   .heart_rate_measurement), chaque vecteur de test dérivé à la main et commenté.
   À confronter au document quand il existera.
3. **Smoke test 2 appareils réels** (pilote + coach) — matériel, pas logiciel.
4. **Scrubbing 60 fps** — toujours en attente de mesure sur device.

---

## Question pour Gabin

**Le marqueur cardio du roster.** Le prompt BIO-2 demandait « une pastille cœur,
couleur = zone factuelle ». Je ne l'ai pas fait, et je préfère vous le dire
franchement plutôt que de le livrer en silence.

Deux raisons :

1. Une pastille **colorée par zone** demande de faire transiter la FC par le canal
   de présence. Or le garde-fou `stripHealth` que ce lot met en place existe
   précisément pour que la santé n'emprunte jamais ce canal — je me serais
   contredit dans le même lot.
2. Une couleur de zone sur une liste, c'est un état physiologique résumé d'un coup
   d'œil. C'est très près de l'alerte automatique, que la doctrine exclut : le coach
   juge, l'app ne diagnostique pas.

J'ai donc livré un marqueur **sans valeur ni couleur** : « Cardio », qui dit
seulement que ce pilote partage son cardio — la mesure se lit en ouvrant son direct.

Si vous voulez la pastille colorée, dites-le : c'est faisable, mais c'est un
arbitrage de doctrine qui vous appartient, pas une décision d'implémentation.
