# Capture d'une session UBX réelle

Procédure pour produire un fichier `.ubx` rejouable, à partir d'un RaceBox Mini S
physique. Cible : enrichir `test-fixtures/` avec une trace de session de
référence, pour les tests du parser et du service BLE (semaines 3-4).

## Préalable

- Un RaceBox Mini S chargé et appairé en BLE
- L'app OXV Coach installée en build de développement (`expo-dev-client`),
  pas Expo Go — le BLE n'est pas accessible sous Expo Go
- iOS ou Android, peu importe

## Pas à pas

1. **Démarrer l'app en mode dev.** Lancement habituel :
   ```
   npx expo start --dev-client
   ```
   puis ouvrir la build dev sur votre téléphone.

2. **Se connecter avec votre compte Supabase.** L'écran d'accueil
   `(app)/index` apparaît avec le greeting "Bienvenue, {first_name}."

3. **Ouvrir l'écran de capture.** Dans l'écran d'accueil, en mode `__DEV__`
   uniquement, un lien discret "Mode debug — capture UBX" s'affiche.
   (Sinon : naviguer manuellement vers `/(app)/debug-capture`.)

4. **Scanner.** Bouton "Scan", attendre que votre RaceBox apparaisse dans la
   liste (nom commençant par `RaceBox`).

5. **Se connecter.** Tap sur la ligne du RaceBox. L'état BLE passe à
   `connected`. Les listeners raw s'activent.

6. **Démarrer la capture.** Bouton "Démarrer la capture". Les compteurs
   "Chunks reçus" et "Octets capturés" s'incrémentent en temps réel
   (~25 frames/s, ~88 bytes par frame de données).

7. **Faire la session.** Cas simples pour des fixtures représentatives :
   - **Statique 5 min** : RaceBox posé, GPS extérieur, calibre l'IMU et le
     fix GPS. Fixture minimale pour tester le parser.
   - **Roulage 30-60 min** : tour Beltoise ou autre piste. Inclut accélérations,
     freinages, virages. Cible : >1 Mo de données.
   - **Trajet route** : si vous testez en allant au circuit, garde une trace
     "voiture normale" utile pour vérifier que la detection de tours ne se
     déclenche pas hors piste.

8. **Arrêter.** Bouton "Arrêter et sauvegarder". L'app écrit dans
   `${documentDirectory}/fixtures/racebox-capture-{timestamp}.ubx`. Le path
   complet s'affiche en bas.

9. **Partager.** Bouton "Partager le fichier .ubx". Sheet système :
   - **iOS** : AirDrop vers votre Mac, ou "Enregistrer dans Fichiers" puis
     iCloud Drive
   - **Android** : "Enregistrer sur l'appareil" puis Google Drive, ou Gmail
     en pièce jointe

10. **Déposer dans le repo.** Récupérer le fichier sur votre machine, le
    déposer dans `test-fixtures/` à la racine du projet :
    ```
    test-fixtures/
    ├── racebox-static-5min.ubx
    ├── racebox-beltoise-2026-05-30.ubx
    └── racebox-trajet-route.ubx
    ```
    Le `.gitignore` autorise les `.ubx` dans `test-fixtures/` (mais ignore
    partout ailleurs, pour éviter les uploads accidentels de gros fichiers).

11. **Commit.** Préfixer le message par `fixture:` pour distinguer des commits
    de code :
    ```
    fixture: capture RaceBox Beltoise 30 mai 2026 (45 min, 1.2 MB)
    ```

## Que va en faire Claude Code

Les fixtures `.ubx` permettent de :

- **Tester le parser unitairement** sans matériel — `UbxFrameBuffer.push()`
  rejoue le fichier, on assert sur les `RaceBoxData` extraits.
- **Tester la détection de tours** — `lapDetection` consomme les positions
  GPS et doit produire le bon nombre de tours pour une session connue.
- **Benchmarker** — mesurer le temps de parsing complet d'une session de
  60 min sur device, sans avoir le RaceBox en main.
- **Reproduire les bugs** — si un client signale un comportement étrange,
  on peut tenter de capturer un fichier similaire.

## Sécurité et confidentialité

Les fichiers `.ubx` contiennent des **traces GPS précises** (votre position
à chaque instant). À garder confidentiel : ne pas push dans un repo public,
ne pas partager hors équipe OXV.

Le `.gitignore` autorise `test-fixtures/*.ubx` côté repo, mais le
repo OXV Coach est privé sur GitHub. Si jamais il passe public un jour,
**retirer toutes les fixtures** avant.

## Format du fichier

Le fichier produit est strictement la concaténation des chunks BLE reçus
(bytes bruts, pas de header OXV, pas d'index). Identique à ce qui serait
écrit en streaming par un futur logger production.

Replay côté Node.js (pour les tests parser) :

```js
import { readFileSync } from 'fs';
import { UbxFrameBuffer } from './src/ubx/parser';
import { parseRaceBoxDataMessage, isRaceBoxDataMessage } from './src/ubx/parser';

const bytes = new Uint8Array(readFileSync('test-fixtures/racebox-static-5min.ubx'));
const buffer = new UbxFrameBuffer();
const frames = buffer.push(bytes);
const dataFrames = frames.filter(isRaceBoxDataMessage).map(parseRaceBoxDataMessage);
console.log(`${dataFrames.length} frames de données extraites`);
```
