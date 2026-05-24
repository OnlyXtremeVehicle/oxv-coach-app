# Guide de connexion Supabase pour OXV Coach

> Comment connecter le projet React Native au backend Supabase existant de Gabin (project `fouvuqkdxarjpjbqnsjq` en région Frankfurt).

---

## Préambule

Votre backend Supabase est **déjà opérationnel** sur oxvehicle.fr depuis plusieurs mois. L'app OXV Coach doit s'y connecter, lire les mêmes tables (users, sessions, etc.) et écrire dans les nouvelles tables qu'on va créer (app_sessions, app_circuit_references, etc.).

Ce guide explique :
1. Comment **récupérer vos credentials** Supabase de façon sécurisée
2. Comment **les configurer** dans l'app React Native
3. Comment **exporter votre schéma actuel** pour le donner à Claude Code

---

## Étape 1 — Récupérer vos credentials Supabase

### 1.1 — Connexion à Supabase

1. Aller sur https://supabase.com/dashboard
2. Se connecter avec votre compte
3. Sélectionner le projet OXV (`fouvuqkdxarjpjbqnsjq`)

### 1.2 — Récupérer l'URL et les clés

1. Dans le menu de gauche, cliquer sur **Project Settings** (l'icône engrenage)
2. Cliquer sur **API**
3. Vous voyez trois informations importantes :

**Project URL** :
- Format : `https://fouvuqkdxarjpjbqnsjq.supabase.co`
- C'est **public**, peut être partagée

**Project API keys** :

**(a) `anon public`** :
- Une longue chaîne commençant par `eyJ...`
- C'est la clé **publique**, utilisée par l'app mobile
- Peut être commitée dans le code (Supabase RLS protège les données)
- À copier dans `EXPO_PUBLIC_SUPABASE_ANON_KEY` du fichier `.env`

**(b) `service_role`** :
- Une autre longue chaîne `eyJ...`
- C'est la clé **admin**, ne JAMAIS exposer
- À utiliser uniquement côté serveur (Edge Functions)
- À copier dans `SUPABASE_SERVICE_ROLE_KEY` du fichier `.env`

### 1.3 — Sécurisation

**Important** : ces clés donnent accès à votre base de données. Si elles fuient :

- `anon public` : un attaquant peut faire les requêtes que vos RLS autorisent (limité)
- `service_role` : un attaquant a **accès admin complet** (lecture, écriture, suppression de tout)

**Bonnes pratiques** :
- Ne jamais commiter `.env`
- Ne jamais coller la `service_role` dans un message public
- Stocker `service_role` dans un gestionnaire de mots de passe (1Password, Bitwarden)
- Activer la rotation périodique des clés si possible

---

## Étape 2 — Configurer l'app React Native

### 2.1 — Créer le fichier `.env`

À la racine du projet `oxv-coach-app/`, créer un fichier `.env` (sans extension) avec ce contenu :

```env
EXPO_PUBLIC_SUPABASE_URL=https://fouvuqkdxarjpjbqnsjq.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxxxx... (votre vraie clé)

SUPABASE_URL=https://fouvuqkdxarjpjbqnsjq.supabase.co
SUPABASE_ANON_KEY=eyJxxxxxxx... (la même)
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxxxx... (clé serveur, optionnel pour le dev)
```

**Vérification** : le fichier `.gitignore` doit contenir `.env` (déjà fait).

### 2.2 — Installer le client Supabase

Dans le terminal, à la racine du projet :

```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
```

### 2.3 — Créer le client Supabase

Créer le fichier `src/lib/supabase.ts` (Claude Code le fera, mais voici le modèle) :

```typescript
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Variables Supabase manquantes dans .env')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

### 2.4 — Tester la connexion

Créer un écran de test temporaire :

```typescript
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { supabase } from './src/lib/supabase'

export default function TestSupabase() {
  const [status, setStatus] = useState('Connexion...')

  useEffect(() => {
    async function test() {
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1)
      
      if (error) {
        setStatus(`Erreur : ${error.message}`)
      } else {
        setStatus(`Connexion OK ! Données reçues.`)
      }
    }
    test()
  }, [])

  return (
    <View style={{ padding: 40 }}>
      <Text>{status}</Text>
    </View>
  )
}
```

Si vous voyez **"Connexion OK"** au lancement, c'est bon.

---

## Étape 3 — Exporter le schéma actuel de Supabase

C'est l'étape la plus importante : donner à Claude Code une vue **exacte** de votre base de données actuelle.

### 3.1 — Méthode A : via le Dashboard (recommandé, le plus simple)

1. Aller sur https://supabase.com/dashboard
2. Sélectionner votre projet OXV
3. Dans le menu de gauche, cliquer sur **Database**
4. Cliquer sur **Schemas** (en dessous de "Database")
5. Vous voyez la liste de vos schémas (généralement `public`, `auth`, `storage`)
6. Cliquer sur **public** (c'est là que sont vos tables OXV)
7. Vous voyez la liste de vos tables

**Pour chaque table importante** (users, sessions, registrations, vehicles, etc.) :
1. Cliquer sur la table
2. Cliquer sur **Definition** dans l'onglet
3. Copier le SQL affiché (CREATE TABLE statement)
4. Coller dans un fichier `docs/architecture/05_SCHEMA_SUPABASE_ACTUEL.sql`

### 3.2 — Méthode B : via SQL Editor (plus exhaustif)

1. Dans le menu de gauche, cliquer sur **SQL Editor**
2. Cliquer sur **+ New query**
3. Coller cette requête :

```sql
-- Export du schéma public complet
SELECT 
  'CREATE TABLE ' || schemaname || '.' || tablename || ' (' || E'\n' ||
  string_agg(
    '  ' || column_name || ' ' || data_type ||
    CASE 
      WHEN character_maximum_length IS NOT NULL THEN '(' || character_maximum_length || ')'
      ELSE ''
    END ||
    CASE
      WHEN is_nullable = 'NO' THEN ' NOT NULL'
      ELSE ''
    END,
    E',\n'
  ) || E'\n);' AS create_statement
FROM information_schema.columns c
JOIN pg_tables t ON c.table_name = t.tablename AND c.table_schema = t.schemaname
WHERE t.schemaname = 'public'
GROUP BY schemaname, tablename;
```

4. Cliquer sur **Run**
5. Vous obtenez tous les CREATE TABLE statements
6. Exporter en CSV ou copier-coller dans le fichier

### 3.3 — Méthode C : via la CLI Supabase (avancé)

Si vous avez la CLI Supabase installée :

```bash
# Login
supabase login

# Link au projet
supabase link --project-ref fouvuqkdxarjpjbqnsjq

# Export du schéma
supabase db dump --schema public > schema.sql
```

Le fichier `schema.sql` contient tout : tables, contraintes, indexes, RLS policies, triggers, fonctions.

### 3.4 — Que faire du fichier exporté

1. Sauvegarder dans `docs/architecture/05_SCHEMA_SUPABASE_ACTUEL.sql`
2. **Vérifier qu'il ne contient pas de données sensibles** (clés API, mots de passe en dur, etc.)
3. Commiter dans le repo Git (le schéma seul est OK à commiter, contrairement aux credentials)

---

## Étape 4 — Exporter les RLS Policies

Les Row Level Security policies sont **critiques** pour la sécurité. Claude Code doit les connaître pour ne pas casser votre modèle de sécurité.

### Via Dashboard

1. **Database** → **Policies**
2. Pour chaque table, voir les policies actives
3. Copier le SQL de chaque policy

### Via SQL

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Sauvegarder dans `docs/architecture/06_RLS_POLICIES_ACTUELLES.sql`.

---

## Étape 5 — Exporter les Edge Functions existantes

Si vous avez déjà des Edge Functions déployées (ritual_dispatcher, etc.) :

### Via CLI

```bash
supabase functions list
supabase functions download ritual_dispatcher
```

Sauvegarder dans `docs/architecture/edge_functions/`.

### Via Dashboard

1. **Edge Functions** dans le menu
2. Pour chaque fonction : voir le code source
3. Copier-coller dans un fichier .ts

---

## Étape 6 — Donner ces fichiers à Claude Code

Une fois ces exports réalisés, votre structure de dossier sera enrichie :

```
oxv-coach-app/
├── docs/
│   ├── architecture/
│   │   ├── 01_PARTIE_1_stack_supabase.md
│   │   ├── 02_PARTIE_2_algorithmes.md
│   │   ├── 03_PARTIE_3_deploiement.md
│   │   ├── 04_SUPABASE_CONNECTION_GUIDE.md   ← (ce fichier)
│   │   ├── 05_SCHEMA_SUPABASE_ACTUEL.sql     ← (à créer par vous)
│   │   ├── 06_RLS_POLICIES_ACTUELLES.sql     ← (à créer par vous)
│   │   └── edge_functions/                    ← (à créer par vous)
│   │       └── ritual_dispatcher.ts
```

Claude Code pourra alors lire votre schéma exact et générer du code parfaitement aligné avec votre base actuelle.

---

## Validation finale

Une fois tout en place, vous pouvez demander à Claude Code :

```
Lis docs/architecture/05_SCHEMA_SUPABASE_ACTUEL.sql et résume-moi
les 5 tables les plus importantes pour l'app, avec leurs colonnes
principales. Puis génère les types TypeScript correspondants
dans src/types/database.types.ts.
```

Si Claude Code peut le faire **sans hésitation et sans inventer**, c'est que la connexion conceptuelle est réussie.

---

## Sécurité — Récapitulatif

**À NE JAMAIS commiter** :
- `.env` (credentials)
- Tout fichier contenant la `service_role` key
- Tout backup contenant des données utilisateurs réelles

**À commiter** :
- `.env.example` (placeholders)
- Schéma SQL (structure sans données)
- RLS policies (logique de sécurité)
- Code Edge Functions (logique métier)

**À garder dans un gestionnaire de mots de passe** :
- `service_role` key
- Mots de passe admin Supabase
- Comptes Apple Developer / Google Play

---

## En cas de problème

**Erreur de connexion** :
- Vérifier que `.env` est bien à la racine
- Vérifier que les variables ont le bon préfixe (`EXPO_PUBLIC_` pour client)
- Vérifier que les clés sont copiées intégralement (pas tronquées)

**RLS bloque les requêtes** :
- L'utilisateur n'est peut-être pas authentifié
- Les policies actuelles ne couvrent pas le cas d'usage
- Tester avec la `service_role` (en dev uniquement) pour vérifier

**Tables manquantes** :
- Le schéma actuel ne contient peut-être pas encore les tables `app_*`
- Voir Partie 1 de l'architecture pour les CREATE TABLE à exécuter

---

*Guide Supabase Connection — OXV Coach — Mai 2026*
