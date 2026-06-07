# Comment visionner l'app OXV Mirror

Trois voies, par effort croissant. Choisissez selon ce que vous voulez voir.

---

## Voie A — Expo Go (5 min, UI seulement)

**Pour** : voir les 26 écrans pilote + 4 vues admin + transitions + design + couleurs.
**Pas pour** : tester le BLE RaceBox, recevoir une vraie push notification, vivre une vraie session.

### Côté téléphone

1. Installer **Expo Go** depuis l'App Store ou Play Store :
   - iOS : https://apps.apple.com/app/expo-go/id982107779
   - Android : https://play.google.com/store/apps/details?id=host.exp.exponent
2. Créer un compte Expo dans l'app (gratuit) — ou login avec celui du projet

### Côté Windows (terminal du projet)

```powershell
cd C:\Users\Julie\OneDrive\Desktop\oxv-app
npx expo start
```

Au démarrage, un QR code s'affiche dans le terminal et une page web s'ouvre sur `http://localhost:8081`.

3. **iPhone** : ouvrir l'appareil photo, scanner le QR. Une notification "Ouvrir dans Expo Go" apparaît. Tap.
4. **Android** : ouvrir l'app Expo Go, onglet "Scan QR code".

L'app se télécharge sur le téléphone (~30 s la première fois) puis se lance. Vous voyez :
- Écran de login OXV
- Possibilité de naviguer dans tous les écrans une fois loggué
- Tous les écrans pilote et admin (avec `is_admin = true`)

**Logs en direct** dans le terminal Windows. Modifications de code → reload automatique du téléphone (cmd+R sur iPhone secoué, double-tap sur Android).

### Ce qui ne marchera PAS dans Expo Go

- L'écran #08 « Détection équipement » : le scan BLE est désactivé, message "Bluetooth indisponible dans ce runtime"
- L'écran de debug capture : pareil
- Les push notifications remote (les locales fonctionnent)
- Sentry (déjà no-op en dev)

Le reste de l'app fonctionne intégralement, **y compris** :
- Auth Supabase
- Lecture de toutes les tables DB (sessions, analyses, segments, etc.)
- Géolocalisation foreground
- Persistance MMKV
- État pilote S1-S10
- Carte SVG du circuit (#14) avec vraies marges si la session a été analysée
- Vue admin inspecteur circuit (avec heatmap historique si données)

### Compte de test

Créez un compte via le SQL Editor Supabase (jamais via MCP/chat) :

```sql
-- Dans Supabase Dashboard → SQL Editor
SELECT auth.signup('alpha-test@oxvehicle.fr', 'votre_mot_de_passe_fort');
```

Puis injectez le profil :

```sql
UPDATE users
SET pilot_level = 'intermediaire',
    pact_accepted_at = NOW(),
    pact_version = '1.0',
    cgu_accepted_at = NOW(),
    privacy_accepted_at = NOW(),
    profile_completed_at = NOW(),
    is_admin = true  -- pour voir les vues admin
WHERE email = 'alpha-test@oxvehicle.fr';
```

---

## Voie B — Dev build Android local (1 h setup, complet)

**Pour** : tester le BLE RaceBox avec un vrai device (Android), voir la chaîne native complète, smoke test sans EAS cloud.
**Pas pour** : iOS (nécessite Mac).

### Setup unique (1 h)

1. **Installer Android Studio** : https://developer.android.com/studio
   - Pendant l'install, cocher "Android Virtual Device" (~5 GB de téléchargements)
2. **Créer un AVD** (émulateur) :
   - Android Studio → Tools → Device Manager → Create Device
   - Modèle : Pixel 6, Android 14 (API 34)
   - Lancer l'émulateur, le laisser tourner
3. **Variables d'environnement** (PowerShell admin, une fois) :
   ```powershell
   [Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
   [Environment]::SetEnvironmentVariable("Path", "$env:Path;$env:LOCALAPPDATA\Android\Sdk\platform-tools", "User")
   ```
   Fermer et rouvrir le terminal.
4. **Vérifier** : `adb devices` doit lister l'émulateur

### Lancement

```powershell
cd C:\Users\Julie\OneDrive\Desktop\oxv-app
npx expo run:android
```

Premier build : 10-15 min (Gradle + bundling). Builds suivants : 30 s.

L'app s'installe automatiquement sur l'émulateur et démarre avec **tous** les modules natifs (BLE compris, mais l'émulateur n'a pas de vrai Bluetooth → scan retournera vide).

### Avec un téléphone Android physique

Si vous avez un Android :
1. Activer le mode développeur (Settings → About → tap 7× sur Build number)
2. Activer USB debugging dans les options développeur
3. Brancher en USB
4. `adb devices` doit le voir
5. `npx expo run:android --device` → installation sur le téléphone

Le BLE marche, vous pouvez scanner un vrai RaceBox.

---

## Voie C — EAS Build cloud (2 h, iOS + Android, vraie chaîne)

**Pour** : tester sur iPhone, distribuer une preview à un alpha-pilote, faire la chaîne complète prod.
**Bloqué par** : Q9 (compte EAS oxv@oxvehicle.fr).

Voir les étapes détaillées dans la conversation précédente (« Étapes détaillées pour débloquer les 7 bloquants », section Q9).

Une fois EAS configuré :

```bash
eas login                                    # une fois
eas build --profile preview --platform ios   # ~30 min cloud
eas build --profile preview --platform android
```

Pour iOS : invitation TestFlight reçue par mail, installable sur iPhone via TestFlight.
Pour Android : `.apk` téléchargeable depuis le dashboard EAS, sideloadable.

---

## Recommandation

**Aujourd'hui pour visionner rapidement** : **Voie A (Expo Go)**.

C'est 5 minutes de setup. Vous voyez 90% de l'app (toutes les transitions, le design, la navigation, la carte circuit, les vues admin). Le BLE est de toute façon non testable sans RaceBox sous la main.

**Cette semaine quand vous voudrez le smoke test complet** : **Voie B (Android local)** ou **Voie C (EAS)**.

---

## Troubleshooting

### "Cannot connect to Metro"

Si Expo Go n'arrive pas à se connecter au serveur Metro :
- Vérifier que téléphone et Windows sont sur **le même WiFi**
- Si WiFi entreprise/public : utiliser `npx expo start --tunnel` (plus lent mais traverse les NAT)

### "Module not found: react-native-ble-plx"

Si vous voyez ça dans Expo Go : le guard runtime ne s'est pas appliqué. Vérifier que `app/_layout.tsx` contient bien `if (!isExpoGo())` autour de `initBle()`. Sinon : rebuild de la dev bundle.

### Écran blanc au démarrage

- Logs console terminal Windows → cherche "[OXV]"
- Si "Runtime : Expo Go" affiché : le guard fonctionne, le souci est ailleurs
- Si rien : l'app n'a pas démarré, recommencer `npx expo start --clear`

### Auth échoue

- Vérifier que `.env` contient `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Redémarrer `npx expo start` après changement de `.env` (variables embarquées au boot)
- Tester directement la clé : `curl https://fouvuqkdxarjpjbqnsjq.supabase.co/auth/v1/health -H "apikey: ..."`

---

**Pour démarrer maintenant** :

```powershell
cd C:\Users\Julie\OneDrive\Desktop\oxv-app
npx expo start
```

Téléphone : ouvrir Expo Go, scanner le QR. Dans 30 secondes, vous êtes dans l'app.
