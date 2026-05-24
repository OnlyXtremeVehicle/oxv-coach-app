# Connexion Progression Site ↔ App OXV Coach

> Cahier des charges pour synchroniser la page "Ma progression" de oxvehicle.fr avec les données générées par l'app mobile OXV Coach.

---

## Contexte

L'app OXV Coach (mobile) génère des données télémétriques riches lors de chaque session de pilotage :
- Sessions complètes dans `telemetry_sessions`
- Détail tour par tour dans `laps`
- Conditions météo dans `weather_snapshots`
- (V2) Analyses calculées dans `app_session_analyses`

Le site oxvehicle.fr contient une page "Ma progression" (espace pilote) qui **doit refléter ces données** en temps réel pour offrir au pilote une expérience cohérente entre web et mobile.

**Bonne nouvelle** : les deux produits **partagent la même base Supabase** (`fouvuqkdxarjpjbqnsjq`). La synchronisation est donc native — il suffit d'adapter les requêtes côté site.

---

## Objectif

Quand un pilote consulte sa page de progression sur oxvehicle.fr (`/compte/progression` ou similaire), il doit voir :

1. **Sa progression long terme** : nombre de sessions effectuées, marge moyenne, évolution dans le temps
2. **Ses dernières sessions** : bilan synthétique de chaque session récente
3. **Ses meilleurs résultats** : meilleur tour, meilleure marge, meilleure session
4. **Sa progression vers Heritage** : compteur de sessions vers les paliers (Access → Signature → Promotion → Heritage)
5. **Des liens contextuels** vers l'app mobile pour explorer en détail (deep links `oxvcoach://`)

---

## Architecture technique

### Côté backend (Supabase)

**Aucune modification de schéma nécessaire** pour la V1 de cette synchronisation. Les tables existent déjà :

- `telemetry_sessions` : sessions enregistrées par l'app
- `laps` : tours individuels
- `app_session_analyses` (V2, à créer) : analyses calculées (marge composite, etc.)
- `registrations` : inscriptions aux sessions OXV officielles
- `sessions` : sessions OXV (au sens "événement track day")

**Note importante** : il faut bien distinguer **`sessions`** (l'événement OXV, jour de roulage) et **`telemetry_sessions`** (les données enregistrées par l'app pendant la session). Les deux sont liées par `user_id` + corrélation temporelle.

### Côté frontend (oxvehicle.fr)

Le site est en **HTML/JS vanilla** (single file `index.html` 568 Ko). Les modifications seront :

1. **Section nouvelle ou enrichie** dans `index.html` : `<div id="progression-page">`
2. **Fonctions JavaScript** pour requêter Supabase et afficher
3. **Réutilisation du client Supabase** déjà en place dans `index.html`
4. **Aucun framework supplémentaire** (cohérent avec la stack existante)

---

## Spécifications fonctionnelles détaillées

### Section 1 — Vue d'ensemble (Hero KPIs)

**Visuel** : 4 cards en grille horizontale (responsive 2x2 sur mobile)

| Card | Données | Source |
|---|---|---|
| Sessions effectuées | Nombre total | `COUNT(*) FROM registrations WHERE user_id = ? AND status = 'attended'` |
| Tours bouclés | Somme des tours valides | `SUM(lap_count) FROM telemetry_sessions WHERE user_id = ? AND status = 'completed'` |
| Marge moyenne | % moyen sur les 5 dernières sessions | `AVG(margin_global) FROM app_session_analyses` (V2) |
| Meilleur tour | Temps + circuit | `MIN(best_lap_seconds) FROM telemetry_sessions WHERE status = 'completed'` |

**Style visuel** : grandes typos serif italique pour les chiffres, étiquette mono sous chaque chiffre.

---

### Section 2 — Progression vers Heritage

**Visuel** : barre de progression verticale ou horizontale avec 4 paliers

```
Access ─────● Signature ─────○ Promotion ─────○ Heritage ─────○
  Done           1/2              1/2              4/4
```

**Logique** :
- Compter le nombre de sessions effectuées (`status = 'attended'`)
- **Palier 1 (Access)** : déverrouillé dès l'inscription
- **Palier 2 (Signature)** : après 1 session
- **Palier 3 (Promotion)** : après 2 sessions
- **Palier 4 (Heritage)** : après 3 sessions (achat libre)

Si le pilote a un `heritage_pack` actif, afficher la progression du pack (X/4 sessions consommées).

**Phrase contextuelle** sous la progression :
- 0 session : "Votre première session vous ouvrira Signature."
- 1 session : "Une session de plus vers Promotion."
- 2 sessions : "Une session de plus vers Heritage."
- 3+ sessions : "Heritage est disponible. Le club privilégié vous attend."

---

### Section 3 — Mes dernières sessions

**Visuel** : liste verticale des 5 dernières sessions, avec une card par session

**Données par card** :
```
┌─────────────────────────────────────────────┐
│ Mardi 15 mai 2026 — Beltoise                │
│                                              │
│ Marge globale            24%                 │
│ À explorer                                   │
│                                              │
│ 8 tours · Meilleur tour 1:42.318             │
│ 22°C — Sec                                   │
│                                              │
│ [Explorer dans l'app →]                      │
└─────────────────────────────────────────────┘
```

**Source des données** :
- Date, circuit : `telemetry_sessions.started_at`, `circuit_name`
- Marge globale : `app_session_analyses.margin_global` (V2)
- Étiquette : "Confortable" / "À explorer" / "Terrain serré" selon zone
- Tours : `lap_count`
- Meilleur tour : `best_lap_seconds`
- Météo : jointure avec `weather_snapshots` (moment = 'during', moyenne)

**Action "Explorer dans l'app"** : deep link `oxvcoach://bilan/{session_id}` qui ouvre l'app sur le bilan de cette session (si l'app est installée).

**Si pas de session encore** : message bienveillant "Votre prochaine session écrira la première ligne de votre histoire."

---

### Section 4 — Graphique de progression

**Visuel** : graphique en ligne temporelle (SVG natif, pas de bibliothèque externe)

**Axes** :
- X : temps (sessions chronologiquement)
- Y : marge globale (0-100%)

**Bandes colorées en fond** :
- 0-15% : rouge léger (terrain serré)
- 15-30% : orange léger (à explorer)
- 30%+ : vert léger (confortable)

**Filtre temporel** : boutons "Mois en cours" / "Cette saison" / "Tout"

**Source** : `SELECT margin_global, started_at FROM app_session_analyses JOIN telemetry_sessions ORDER BY started_at`

**Si moins de 3 sessions** : afficher un placeholder "Votre progression apparaîtra après 3 sessions complètes."

---

### Section 5 — Records personnels

**Visuel** : tableau ou liste

| Type | Valeur | Date | Circuit |
|---|---|---|---|
| Meilleur tour | 1:42.318 | 15/05/2026 | Beltoise |
| Meilleure marge | 38% | 22/04/2026 | Beltoise |
| Plus de tours en session | 18 | 10/03/2026 | Beltoise |
| Vitesse max atteinte | 187 km/h | 15/05/2026 | Beltoise |

**Sources** :
- Meilleur tour : `MIN(best_lap_seconds) FROM telemetry_sessions`
- Meilleure marge : `MAX(margin_global) FROM app_session_analyses`
- Tours max : `MAX(lap_count) FROM telemetry_sessions`
- Vitesse max : `MAX(max_speed_kmh) FROM telemetry_sessions`

**Important doctrine OXV** : pas de classement entre pilotes, pas de "leaderboard". Ce sont des records **personnels** uniquement.

---

### Section 6 — Lien vers l'app mobile

**Visuel** : section en bas de page avec deux boutons

```
Explorer en détail dans l'app
[App Store]  [Google Play]
```

Si l'app détecte que l'utilisateur a déjà l'app installée (via un cookie ou un test de deep link), afficher plutôt :
```
[Ouvrir OXV Coach →]
```

---

## Spécifications techniques

### Requêtes Supabase à implémenter

À ajouter dans `index.html` (dans la section JS existante).

```javascript
// ============================================================
// MODULE PROGRESSION — Données pour la page Ma progression
// ============================================================

async function loadProgressionData(userId) {
  try {
    // 1. KPIs vue d'ensemble
    const { data: kpis } = await Promise.all([
      supabase.from('registrations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'attended'),
      
      supabase.from('telemetry_sessions')
        .select('lap_count, best_lap_seconds, max_speed_kmh')
        .eq('user_id', userId)
        .eq('status', 'completed'),
      
      // V2 : marges depuis app_session_analyses
      supabase.from('app_session_analyses')
        .select('margin_global, computed_at')
        .order('computed_at', { ascending: false })
        .limit(5)
    ]);
    
    // 2. Sessions récentes
    const { data: recentSessions } = await supabase
      .from('telemetry_sessions')
      .select(`
        id,
        circuit_name,
        started_at,
        ended_at,
        lap_count,
        best_lap_seconds,
        max_speed_kmh
      `)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(5);
    
    // 3. Pour chaque session, récupérer la marge si V2 prête
    const sessionsWithAnalyses = await Promise.all(
      recentSessions.map(async (session) => {
        const { data: analysis } = await supabase
          .from('app_session_analyses')
          .select('margin_global, margin_zone')
          .eq('telemetry_session_id', session.id)
          .maybeSingle();
        
        return { ...session, analysis };
      })
    );
    
    // 4. Progression Heritage
    const sessionsAttended = kpis[0].count || 0;
    const heritageProgress = calculateHeritageProgress(sessionsAttended);
    
    // 5. Données pour le graphique long terme
    const { data: progressionChart } = await supabase
      .from('app_session_analyses')
      .select(`
        margin_global,
        computed_at,
        telemetry_session_id
      `)
      .order('computed_at', { ascending: true });
    
    // 6. Records personnels
    const records = calculateRecords(kpis[1]);
    
    return {
      kpis: {
        sessionsAttended,
        totalLaps: kpis[1].reduce((sum, s) => sum + (s.lap_count || 0), 0),
        avgMargin: averageMargin(kpis[2]),
        bestLap: minBestLap(kpis[1]),
      },
      heritageProgress,
      recentSessions: sessionsWithAnalyses,
      progressionChart,
      records,
    };
    
  } catch (error) {
    console.error('Erreur chargement progression:', error);
    return null;
  }
}

function calculateHeritageProgress(sessionsAttended) {
  return {
    access: { unlocked: true, label: 'Access', sessions: sessionsAttended },
    signature: { 
      unlocked: sessionsAttended >= 1, 
      label: 'Signature',
      remaining: Math.max(0, 1 - sessionsAttended)
    },
    promotion: { 
      unlocked: sessionsAttended >= 2, 
      label: 'Promotion',
      remaining: Math.max(0, 2 - sessionsAttended)
    },
    heritage: { 
      unlocked: sessionsAttended >= 3, 
      label: 'Heritage',
      remaining: Math.max(0, 3 - sessionsAttended)
    },
  };
}
```

---

### Fonctions de rendu

```javascript
function renderProgressionPage(data) {
  if (!data) {
    document.getElementById('progression-content').innerHTML = renderEmptyState();
    return;
  }
  
  document.getElementById('progression-content').innerHTML = `
    ${renderHeroKPIs(data.kpis)}
    ${renderHeritageProgress(data.heritageProgress)}
    ${renderRecentSessions(data.recentSessions)}
    ${renderProgressionChart(data.progressionChart)}
    ${renderPersonalRecords(data.records)}
    ${renderAppCTA()}
  `;
}
```

Chaque fonction `render*` retourne du HTML avec les classes CSS existantes du site OXV (style sec, premium).

---

## Cas particuliers

### Pilote nouveau (0 session)

Afficher un état d'accueil personnalisé :
- Section KPIs : tous à zéro avec phrase "Votre histoire commence à votre première session"
- Section Heritage : montrer le chemin "Une session pour débloquer Signature"
- Section Sessions récentes : message d'accueil + lien "Réserver ma première session"
- Section Graphique : placeholder "Votre courbe apparaîtra après 3 sessions"
- Section Records : masquer ou montrer "Aucun record encore"

### Pilote sans app installée

Si le pilote a effectué une session sans l'app (équipement OXV temporaire ou sans connexion BLE), il peut quand même avoir :
- Une `registration` avec `status = 'attended'`
- Mais pas de `telemetry_session` correspondante

Dans ce cas :
- Compter la session dans la progression Heritage
- Ne pas afficher de données télémétriques pour cette session
- Inviter à installer l'app pour la prochaine fois

### Désynchronisation app/web

L'app peut être en mode offline pendant des heures. Les données arrivent sur Supabase à la prochaine connexion.

**Côté site** :
- Toujours requêter en temps réel (pas de cache long)
- Afficher un timestamp "Dernière mise à jour : il y a 2 minutes"
- Bouton "Rafraîchir" optionnel

---

## Performance et coûts

**Volume attendu** par utilisateur :
- ~4 sessions/an (Heritage) = ~4 telemetry_sessions/an
- Chaque session : ~20-40 laps + 1 analyse + 3 weather_snapshots
- **Volume base raisonnable** : ~100 enregistrements/utilisateur/an

**Requêtes côté site** :
- 5 requêtes Supabase par chargement de la page
- Cache 1 minute côté client si nécessaire
- **Coût Supabase** : négligeable (plan Pro inclut 50 000 requêtes/jour)

---

## Roadmap d'implémentation

### Phase 1 — V1 avec données existantes (semaine 13 du plan app)

Implémenter les sections 1, 3, 5, 6 avec les **données déjà disponibles** :
- KPIs depuis `registrations` et `telemetry_sessions`
- Sessions récentes (sans la marge composite si V2 pas prête)
- Records personnels
- CTA app

Pas encore la marge composite (Section 2 partielle, Section 4 absente).

### Phase 2 — V2 avec analyses (semaine 14 du plan app, en parallèle de la soumission stores)

Une fois `app_session_analyses` créée et alimentée par l'app V2 :
- Compléter la section KPIs avec marge moyenne
- Compléter les sessions récentes avec marge globale + étiquette
- Activer le graphique de progression (section 4)
- Compléter la section Heritage si bug

### Phase 3 — Améliorations futures

- Filtres avancés (par circuit, par véhicule, par condition météo)
- Comparaison avec sessions passées
- Export PDF de la progression
- Partage de la progression (lien public temporaire)

---

## Doctrine OXV à respecter

Même côté web, les principes restent les mêmes :

1. **Pas de classement entre pilotes** — uniquement progression personnelle
2. **Ton sec et vouvoiement** — pas de "Bravo !", pas d'emoji
3. **Pas de gamification agressive** — pas de badges, pas de récompenses gimmicks
4. **Phrases manifestes** ponctuent les sections vides
5. **Charte stricte** : noir profond, rouge OXV `#C8102E`, blanc, or réservé Heritage

---

## Sécurité

**RLS Supabase** déjà en place :
- Un utilisateur ne peut lire que ses propres données (`auth.uid() = user_id`)
- Aucun risque d'exposition des données d'un autre pilote
- Les requêtes JavaScript dans `index.html` héritent automatiquement de la session utilisateur

**Côté frontend** :
- Vérifier que l'utilisateur est bien authentifié avant d'afficher la page
- Rediriger vers `/login` si pas de session
- Bouton "Déconnexion" toujours visible

---

## Tests à effectuer

Avant mise en production :

1. ☐ Tester avec un compte qui n'a jamais piloté (état vide)
2. ☐ Tester avec un compte qui a 1, 2, 3, et 4+ sessions
3. ☐ Tester sur mobile et desktop (responsive)
4. ☐ Tester en mode offline (que se passe-t-il si Supabase est down ?)
5. ☐ Tester les deep links vers l'app (avec et sans app installée)
6. ☐ Vérifier que les RLS bloquent bien l'accès aux données d'un autre user
7. ☐ Tester avec différents niveaux de pilote (debutant → expert)
8. ☐ Tester la cohérence avec ce que l'app affiche au même moment

---

## Récapitulatif des modifications nécessaires

### Fichier oxvehicle.fr/index.html

1. **Ajouter** une nouvelle section/page `<div id="progression-page">`
2. **Ajouter** la fonction `loadProgressionData(userId)` dans le `<script>`
3. **Ajouter** les fonctions de rendu (`renderHeroKPIs`, `renderHeritageProgress`, etc.)
4. **Ajouter** les styles CSS correspondants (cohérents avec la charte)
5. **Activer** la nav vers cette page depuis l'espace pilote

### Base Supabase

**Aucune modification** nécessaire pour la Phase 1.

Pour la Phase 2, dépend de la création de la table `app_session_analyses` par l'app V2 (semaine 7-8 du plan app).

### Côté app OXV Coach

**Aucune modification** nécessaire — l'app écrit déjà dans les bonnes tables.

À documenter : les deep links `oxvcoach://bilan/{session_id}` doivent être implémentés côté app pour que les liens depuis le site fonctionnent.

---

## Estimation effort

**Phase 1** (données existantes) :
- Dev : ~3-4 jours
- Tests : ~1 jour
- **Total : ~5 jours**

**Phase 2** (avec marge composite) :
- Dev : ~2 jours (dépend de la dispo de `app_session_analyses`)
- Tests : ~1 jour
- **Total : ~3 jours**

**Effort total : ~8 jours de développement** pour avoir une page de progression complète et cohérente avec l'app.

---

*Cahier des charges — Connexion Progression Site ↔ App OXV Coach*
*Version 1.0 — Mai 2026*
*Pour Claude Code : à implémenter en parallèle du dev app (semaine 13-14) ou après publication app.*
