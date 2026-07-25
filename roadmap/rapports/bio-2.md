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

## La pastille colorée — arbitrée, puis livrée

J'avais d'abord livré un marqueur **sans couleur**, en signalant l'écart plutôt que
de trancher seul un point de doctrine. Gabin a tranché le 25/07 : pastille colorée.
Elle est en place, construite pour ne casser aucun invariant.

**La zone est relative au pilote lui-même.** Elle situe sa fréquence cardiaque dans
la plage réellement observée pendant *sa* séance — « vous contre vous ». Des zones
absolues (pourcentage de FC max, « zone 4 = seuil ») auraient exigé son âge et posé
un jugement médical : l'app ne diagnostique pas.

**La rampe est une magnitude, pas un verdict.** Bleu, vert, jaune — reprise de
`speedHeat`, sans or (réservé au chrono) ni rouge. Une échelle vert→rouge se lit
« bon → mauvais » ; froid→chaud se lit « bas → haut ». Un test verrouille
l'invariant : aucune sortie de couleur n'est de l'or ni du rouge.

**Sous les 10 bpm d'amplitude, pas de couleur.** La plage est trop étroite pour
situer quoi que ce soit honnêtement : la pastille reste neutre, sans repli fabriqué.

**Et une mention explicite sous la liste** : « Chaque couleur cardio se lit sur la
plage du pilote concerné. Elles ne se comparent pas entre elles. » Sans ce référent,
une colonne de points colorés se lirait comme un classement — exclu par la doctrine.

## Ce que la vérification adversariale a trouvé

22 agents, quatre lentilles, chaque constat soumis à réfutation. Quatre défauts
confirmés, tous corrigés.

**Le plus grave, et il était invisible à la lecture.** `supabase-js` déduplique les
canaux **par topic** : `channel()` renvoie l'instance existante. Le roster cardio et
la fiche direct ouvraient tous deux `live:session:<id>` — ils partageaient donc une
seule instance. Fermer la fiche d'un pilote **tuait le cardio de tout le roster**, et
le second abonné ne recevait jamais son `SUBSCRIBED`, si bien que la fiche affichait
« hors ligne » sur un flux pourtant vivant. Quatre réfuteurs indépendants ont tenté
de démonter ce constat ; aucun n'y est parvenu, et je l'ai vérifié moi-même dans le
code de la librairie installée. Le topic est désormais **refcompté**, sur le patron
déjà utilisé pour les rosters.

*Leçon générale à retenir* : tout nouvel abonné à un topic Realtime déjà consommé
doit passer par un refcount, sinon le premier `removeChannel` arrache le canal des
autres.

Trois autres corrigés : `bioShared` restait figé au démarrage (après révocation en
séance, le coach voyait « Cardio » indéfiniment) ; les pastilles ordonnées créaient
un classement implicite ; et un commentaire attribuait au canal de présence un
filtrage qui n'existe pas.

**Ce dernier point mérite d'être dit clairement** : `stripHealth` est écrit et testé,
mais il n'a **aucun appelant en production**. Sa liste blanche vise le futur tableau
public LIVE-B, pas les canaux d'aujourd'hui. La protection réelle de BIO-2 est
*structurelle* — la fréquence cardiaque n'est jamais écrite dans `RosterMeta` — et
non le fait d'un filtre qui tournerait à l'exécution. Les commentaires qui laissaient
croire le contraire ont été corrigés.

## Gates : où on en est

- **Validation avocat — faite** (25/07). Le document est passé de « VALIDATION AVOCAT
  REQUISE » à validé, et la localisation d'hébergement y est renseignée d'après une
  vérification réelle : Supabase **eu-west-1, Irlande** — donc dans l'Union
  européenne. Mes notes disaient « Frankfurt », c'était faux ; corrigé.
- **Le drapeau `biometry` reste baissé.** C'est le dernier verrou, et le lever est une
  décision d'exploitation distincte de la validation juridique — elle appartient à
  Gabin, pas à moi.
- Restent : le document protocole ceinture (toujours absent), le smoke test à deux
  appareils, et la mesure du scrubbing sur device.
