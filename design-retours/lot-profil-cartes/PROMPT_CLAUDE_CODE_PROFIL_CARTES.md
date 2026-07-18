# PROMPT CLAUDE CODE — LOT PROFIL & PANEL DE CARTES

**Projet :** OXV Mirror (Expo / React Native / Expo Router)
**Backend :** Supabase — projet `fouvuqkdxarjpjbqnsjq` (Frankfurt)
**Date du prompt :** 17 juillet 2026
**Références visuelles :** `references/profil.html` · `references/panel-cartes.html`
**Migration associée :** `migrations/20260717_profil_pavillon.sql`

---

## 0. RÈGLES ABSOLUES — À LIRE AVANT TOUTE LIGNE DE CODE

1. **Les fichiers HTML de `references/` sont la spécification visuelle exacte.** Vous ne réinterprétez pas le design. Vous transposez pixel par pixel en React Native. En cas de doute sur un espacement, une taille, une couleur : ouvrez le HTML, lisez le CSS, reproduisez la valeur.
2. **Doctrine Miroir (juridique, non négociable) :** l'application restitue des données factuelles. Interdits côté pilote : tout langage prescriptif, toute recommandation, tout score composite, toute comparaison avec un autre pilote. Les seules comparaisons autorisées sont **self vs self** (le pilote contre ses propres sessions).
3. **Aucune donnée d'un autre pilote ne transite vers ces écrans.** Aucune requête ne sélectionne des lignes dont `user_id != auth.uid()` (exception : néant dans ce lot — l'accès coach est hors périmètre).
4. **Aucun refactoring spéculatif.** Vous ne touchez que les fichiers listés en §3. Vous ne renommez rien, vous ne déplacez rien, vous n'« améliorez » rien hors périmètre.
5. **Un lot = un commit.** Grep de contrôle avant chaque commit (voir §8).
6. **La migration SQL n'est PAS exécutée par vous.** Elle est fournie pour revue. Vous codez en supposant les colonnes présentes, avec fallback propre si absentes (voir §5.4).

---

## 1. PÉRIMÈTRE DU LOT

**Inclus :**
- Écran **Profil pilote** (consultation + édition) — espace Pilote.
- Écran **Panel de cartes** (liste des sessions télémétrie, sélection pour comparaison) — espace Pilote.
- Requêtes Supabase associées, états de chargement, états vides, gestion d'erreur.
- Écriture de l'opt-in Pavillon.

**Exclus (ne pas coder, ne pas préparer) :**
- L'écran de comparaison détaillée (cible du bouton « Comparer » → navigation vers une route existante ou placeholder `TODO_LOT_SUIVANT`).
- Les écrans TV du site web (tv-accueil, tv-coach).
- Toute logique coach.
- Tout pipeline IA.

---

## 2. IDENTITÉ VISUELLE — TOKENS

À implémenter dans un fichier de tokens partagé (si un fichier de thème existe déjà dans le repo, **étendez-le**, n'en créez pas un second — grep `#C8102E` et `Syncopate` pour le localiser).

| Token | Valeur | Usage |
|---|---|---|
| `noir` | `#0A0A0A` | Fond global |
| `blanc` | `#FFFFFF` | Texte principal |
| `rouge` | `#C8102E` | Insigne, liseré, sélection, CTA |
| `surface` | `#141414` | Cartes, blocs |
| `surface2` | `#1C1C1C` | Éléments imbriqués |
| `ligne` | `#262626` | Bordures |
| `gris` | `#8A8A8A` | Texte secondaire |
| `grisSombre` | `#555555` | Labels, légendes |
| `orHeritage` | `#C4A459` | **RÉSERVÉ Heritage. Non utilisé dans ce lot.** |

**Typographies** (via `@expo-google-fonts`) :
- `Syncopate_400Regular`, `Syncopate_700Bold` — titres, nom du pilote, dates de carte, bouton Comparer.
- `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold` — corps, bio.
- `JetBrainsMono_400Regular`, `JetBrainsMono_500Medium`, `JetBrainsMono_700Bold` — toutes les données chiffrées, eyebrows, labels, compteur.

**Interdits visuels :**
- Aucun vert/rouge de jugement sur les écarts de temps. Les deltas sont en gris neutre (`#D6D6D6`), conformément au HTML de référence.
- Aucun emoji, nulle part.
- L'or `#C4A459` n'apparaît sur aucun écran de ce lot.

---

## 3. FICHIERS À CRÉER / MODIFIER

Adaptez les chemins exacts à l'arborescence Expo Router existante (grep `app/(pilote)` ou équivalent pour localiser l'espace Pilote). Structure cible :

```
app/(pilote)/profil/index.tsx          ← Écran Profil (consultation)
app/(pilote)/profil/edition.tsx        ← Écran Profil (édition)
app/(pilote)/cartes/index.tsx          ← Panel de cartes
components/profil/CompteurCartes.tsx   ← Odomètre (élément signature)
components/profil/GarageListe.tsx
components/profil/GalerieGrille.tsx
components/profil/OptinPavillon.tsx
components/cartes/CarteSession.tsx     ← Composant carte réutilisable
components/cartes/BarreComparaison.tsx
components/cartes/FiltresCartes.tsx
lib/queries/profil.ts                  ← Requêtes Supabase profil
lib/queries/cartes.ts                  ← Requêtes Supabase cartes
```

Si des routes proches existent déjà (l'app compte ~167 routes), **réutilisez-les** au lieu d'en créer : signalez la divergence en commentaire `// DIVERGENCE_SCHEMA:` en tête de fichier.

---

## 4. MAPPING DONNÉES — TABLE.COLONNE PAR ÉLÉMENT D'INTERFACE

Schéma vérifié le 17/07/2026 sur le projet `fouvuqkdxarjpjbqnsjq`. Ne pas inventer de colonnes.

### 4.1 Écran Profil

| Élément UI (cf. profil.html) | Source |
|---|---|
| Avatar | `users.avatar_url` |
| Couverture | `users.media` (jsonb — clé `cover_url` ; si absente, fond dégradé par défaut du HTML) |
| Nom affiché | `users.first_name + ' ' + users.last_name` |
| Badge N° voiture | `users.car_number` (migration) — si NULL : masquer le badge |
| Pseudonyme | `users.public_handle` (préfixé `@`) |
| « Membre Fondateur · depuis … » | `users.created_at` (mois/année) — statut Fondateur : voir §5.5 |
| Compteur de cartes (odomètre) | `count(telemetry_sessions)` où `user_id = auth.uid()` et `status = 'completed'` (vérifier les valeurs réelles de `status` par un select distinct avant de coder le filtre) |
| Sous-ligne circuit | `circuits.official_name` du circuit principal (celui du plus grand nombre de sessions) |
| Bio | `users.bio` (migration) |
| Garage | `vehicles` (`brand`, `model`, `year`) où `user_id = auth.uid()` |
| Galerie | `users.media` (jsonb — tableau `gallery`, URLs Supabase Storage) |
| Réseaux | `users.socials` (jsonb — clés `instagram`, `youtube`, `linkedin` ; n'afficher que les clés renseignées) |
| Toggle Pavillon | `users.pavilion_name_optin` (migration) — écriture directe, RLS propriétaire |

### 4.2 Panel de cartes

Une **carte = une ligne de `telemetry_sessions`** du pilote connecté.

| Élément UI (cf. panel-cartes.html) | Source |
|---|---|
| Total en-tête | même count que le compteur profil |
| N° de carte (« Carte 024 ») | rang chronologique de la session dans l'ensemble des sessions du pilote (window `row_number()` côté requête, ou calcul client sur la liste triée par `started_at` — retenir le calcul client, plus simple, la liste est déjà chargée) |
| Date | `telemetry_sessions.started_at` — format `EEE. dd MMM. yyyy` (locale fr, capitalisé comme le HTML) |
| Badge « Référence personnelle » | la session portant `min(best_lap_seconds)` non nul du pilote **sur le circuit filtré** |
| Meilleur tour | `telemetry_sessions.best_lap_seconds` → format `m:ss.mmm` |
| Écart réf. | `best_lap_seconds - referenceLap` → format `+s.mmm` (jamais négatif par construction ; masquer sur la carte de référence) |
| Tours | `telemetry_sessions.lap_count` |
| Voiture | `telemetry_sessions.vehicle_label` si présent, sinon jointure `vehicles` via `vehicle_id` (`brand + model`) |
| Météo / températures | `telemetry_sessions.weather` (texte) ; températures piste/air : `weather_snapshots` liée à la session (`session_id`, `temperature_c`, `moment`) — si aucune snapshot : afficher uniquement `weather`, sans inventer de valeurs |
| Tracé filigrane | `circuits.track_svg_path` via `react-native-svg` (Path) — si NULL : pas de filigrane |
| Filtres | Toutes / années distinctes de `started_at` / valeurs distinctes de `weather` / par `vehicle_label` |
| Sélection comparaison | état local — max 2 cartes ; la barre apparaît dès 1 sélection, bouton actif à exactement 2 |
| Bouton Comparer | `router.push` vers la route de comparaison si elle existe, sinon écran placeholder avec `// TODO_LOT_SUIVANT` |

### 4.3 Règle de confidentialité des requêtes

Toutes les requêtes de ce lot filtrent explicitement `user_id = auth.uid()` **même si la RLS le garantit déjà** (défense en profondeur). Aucun `select` sur `users` ne ramène d'autres lignes que celle du pilote connecté.

---

## 5. REQUÊTES SUPABASE — IMPLÉMENTATION

### 5.1 Client
Utilisez le client Supabase existant du repo (grep `createClient` — ne pas en instancier un second).

### 5.2 `lib/queries/profil.ts`

```ts
// Lecture du profil — une seule requête
export async function getProfil() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('AUTH_REQUIRED');

  const [profil, vehicules, compteur] = await Promise.all([
    supabase
      .from('users')
      .select('id, first_name, last_name, public_handle, avatar_url, bio, car_number, pavilion_name_optin, socials, media, created_at')
      .eq('id', user.id)
      .single(),
    supabase
      .from('vehicles')
      .select('id, brand, model, year')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('telemetry_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
      // + filtre status validé après vérification des valeurs réelles (§4.1)
  ]);
  // Gestion d'erreur : chaque bloc vérifié individuellement, voir §7.2
  return { profil, vehicules, compteur };
}

// Écriture opt-in Pavillon — champ unique, pas d'update massif
export async function setPavillonOptin(value: boolean) { /* update ciblé users.pavilion_name_optin, eq id = auth.uid() */ }

// Édition profil — update ciblé des seuls champs modifiés (diff), jamais de spread complet de l'objet
```

### 5.3 `lib/queries/cartes.ts`

```ts
export async function getCartes() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('AUTH_REQUIRED');

  const { data, error } = await supabase
    .from('telemetry_sessions')
    .select(`
      id, started_at, best_lap_seconds, lap_count, weather,
      vehicle_label, vehicle_id, circuit_id, status,
      circuits ( id, official_name, track_svg_path )
    `)
    .eq('user_id', user.id)
    .order('started_at', { ascending: false });
  // weather_snapshots : seconde requête par lot d'ids (in), fusion côté client.
  // Référence personnelle et numérotation : calcul client sur la liste triée.
}
```

### 5.4 Tolérance migration non appliquée
Si `bio`, `car_number` ou `pavilion_name_optin` n'existent pas encore (erreur PostgREST `42703` / colonne inconnue), l'écran **ne crashe pas** : les blocs concernés sont masqués et un log `console.warn('MIGRATION_PROFIL_PAVILLON absente')` est émis. Implémentez cela par un second select de repli sans ces colonnes.

### 5.5 Statut « Membre Fondateur »
Aucune colonne dédiée n'existe. **Ne pas créer de colonne.** Afficher « Membre · depuis {mois année} » sans la mention Fondateur. Ajoutez `// TODO_ARBITRAGE: statut Fondateur — colonne ou table dédiée à trancher` au-dessus du composant. Ce point remonte à M. Fillat.

---

## 6. TRANSPOSITION HTML → REACT NATIVE — CORRESPONDANCES IMPOSÉES

| HTML/CSS de référence | React Native |
|---|---|
| `border-radius: 24px` du cadre téléphone | **Ne pas transposer** — c'est un artefact de revue desktop. L'écran RN est plein écran. |
| `position: fixed` barre de comparaison | `position: 'absolute'` bottom 0 dans le conteneur écran + `paddingBottom` du scroll = hauteur barre + safe area (`useSafeAreaInsets`) |
| Odomètre `.digit` | 3 `<View>` cellules, largeur min 44, bordure `ligne`, fond `noir`, chiffre JetBrainsMono_700Bold 44px. Le nombre est zero-paddé à 3 digits (`String(n).padStart(3,'0')`) ; à 1000+ : 4 digits. |
| `backdrop-filter: blur` | `expo-blur` (`BlurView` intensity 40, tint dark) si déjà dans les dépendances, sinon fond `rgba(10,10,10,0.94)` simple — **ne pas ajouter de dépendance pour ça** |
| Filigrane tracé SVG | `react-native-svg`, `opacity 0.07` (cartes) / `0.16` (cover), `stroke #FFFFFF`, positionné en absolu, `pointerEvents="none"` |
| Coche de sélection | `Ionicons checkmark` ou SVG inline — pas la reproduction du hack CSS en gradients |
| Scroll horizontal filtres | `ScrollView horizontal showsHorizontalScrollIndicator={false}` |
| États `:active` boutons | `Pressable` avec `opacity 0.7` en `pressed` |

**Formatage des temps** — fonction utilitaire unique `formatLapTime(seconds: number): string` → `1:52.418`. Arrondi au millième, jamais de virgule française dans les chronos (norme chronométrage). Testée (voir §7.3).

---

## 7. CONTRÔLES QUALITÉ — OBLIGATOIRES, DANS CET ORDRE

### 7.1 QA visuelle
- [ ] Capture d'écran de chaque écran RN (simulateur, 390×844) posée côte à côte avec le HTML de référence ouvert à 390px. Écarts tolérés : ±2px sur les espacements, aucune tolérance sur couleurs et typographies.
- [ ] Les trois familles de polices chargées (`useFonts`) avec écran de chargement — jamais de police système visible, même un instant (splash maintenu tant que `fontsLoaded` est faux).
- [ ] Vérification sur petit écran (375×667) : aucun débordement, l'odomètre ne casse pas.
- [ ] Mode sombre système ON/OFF : aucun changement (l'app est nativement sombre, aucune couleur dynamique système).

### 7.2 QA données & erreurs
- [ ] **État vide** : pilote sans session → compteur `000`, panel avec message « Aucune carte pour le moment. Votre première session créera votre première carte. » (pas d'écran blanc).
- [ ] **État vide partiel** : pas de véhicule → section Garage masquée ; pas de réseaux → section masquée ; pas de bio → placeholder d'invitation en mode édition uniquement.
- [ ] **Erreur réseau** : bandeau de reprise avec bouton « Réessayer » — pas de crash, pas de spinner infini (timeout 10 s).
- [ ] **`best_lap_seconds` NULL** (session sans tour valide) : la carte s'affiche avec `—` au lieu du chrono, exclue du calcul de référence.
- [ ] **Migration absente** : comportement §5.4 vérifié en supprimant temporairement les colonnes du select.
- [ ] Aucune valeur inventée : si une donnée manque en base, l'UI l'omet, elle ne fabrique jamais un placeholder chiffré.

### 7.3 QA logique (tests unitaires — `jest`, fichiers `__tests__/`)
- [ ] `formatLapTime` : `112.418 → "1:52.418"`, `59.9 → "0:59.900"`, `null → "—"`.
- [ ] Calcul de la référence personnelle : min non nul, stable en présence de NULL, recalculé par filtre circuit.
- [ ] Numérotation des cartes : chronologique ascendante (la plus ancienne = 001), indépendante de l'ordre d'affichage (descendant).
- [ ] Sélection : impossible de sélectionner une 3e carte ; désélection libre ; bouton Comparer inactif à ≠ 2.

### 7.4 QA doctrine (revue manuelle finale — bloquante)
- [ ] Grep sur les fichiers du lot : aucun terme prescriptif (`conseil`, `recommand`, `devriez`, `améliorer`, `coaching`, `score`) dans les chaînes UI côté pilote.
- [ ] Aucune donnée d'un autre pilote affichable, même par manipulation de route (tester avec un id étranger en paramètre → l'écran retombe sur le pilote connecté).
- [ ] Les deltas sont neutres visuellement (gris), sans icône de jugement.
- [ ] L'or `#C4A459` n'apparaît dans aucun fichier du lot (grep `C4A459`).

### 7.5 QA sécurité
- [ ] Aucune clé service_role dans le code — uniquement la clé anon publique existante.
- [ ] L'update profil ne permet pas de modifier `role`, `is_admin`, `kyc_status` ni aucun champ hors liste §4.1 (whitelist explicite des colonnes dans la fonction d'update).
- [ ] L'opt-in Pavillon écrit uniquement `pavilion_name_optin` (le trigger gère l'horodatage).

### 7.6 Greps de pré-commit (tous doivent être vides ou justifiés)
```bash
grep -rn "C4A459" app/ components/ lib/ --include="*.tsx" --include="*.ts"
grep -rn "service_role" app/ components/ lib/
grep -rn "console.log" <fichiers du lot>          # seuls les console.warn documentés §5.4 tolérés
grep -rniE "conseil|recommand|améliorer|coaching" <fichiers du lot>
grep -rn "TODO" <fichiers du lot>                  # chaque TODO doit porter un tag TODO_LOT_SUIVANT ou TODO_ARBITRAGE
```

---

## 8. LIVRAISON

- **Un commit unique** : `feat(pilote): profil + panel cartes — lot PROFIL_CARTES`.
- Le message de commit liste : fichiers créés, divergences signalées (`DIVERGENCE_SCHEMA`, `TODO_ARBITRAGE`), résultat des greps §7.6.
- Ne pas pousser si un contrôle §7 échoue — livrer un rapport d'échec à la place.
- La migration `migrations/20260717_profil_pavillon.sql` est jointe au commit dans le dossier migrations du repo **sans être exécutée**.

## 9. CE QUE VOUS NE FAITES PAS

- Vous n'exécutez pas la migration.
- Vous ne touchez pas aux edge functions.
- Vous ne créez pas l'écran de comparaison détaillée.
- Vous n'ajoutez aucune dépendance npm sans qu'elle soit déjà dans `package.json` (exceptions listées §6 uniquement si présentes).
- Vous ne modifiez pas les policies RLS.
- Vous n'anthropomorphisez rien, vous ne nommez aucun animal, vous n'écrivez aucun emoji.
