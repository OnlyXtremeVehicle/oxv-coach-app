# 16 — Sentry : pose du DSN (ACTION FONDATEUR)

Le code est câblé (`src/lib/sentry.ts`, `eas.json` champ `environment` des 3 profils) mais INACTIF sans DSN. À faire une fois :

1. Créer le projet Sentry (plateforme React Native) sur sentry.io → copier le DSN.
2. `npx eas env:create --name EXPO_PUBLIC_SENTRY_DSN --value <DSN> --environment development --environment preview --environment production --visibility sensitive` (remplace `eas secret:create`, déprécié ; sinon une commande par environnement).
3. Vérifier : `npx eas env:list --environment production`.
4. `eas build --profile preview` puis déclencher une erreur volontaire → l'événement apparaît dans Sentry (preview/production seulement : `initSentry` est no-op sous `__DEV__`).

NB : EAS CLI >= 12 requis (champ `environment`, d'où le bump `cli.version` d'eas.json). Le plugin sourcemaps reste retiré (conflit Gradle sem 14) : stacks minifiées tant qu'il n'est pas reconfiguré.
