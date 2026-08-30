# P0 — paquet d'exécution

*30/08/2026 · chaînes exactes · aucun fichier du dépôt modifié à ce stade*

Trois gestes. Deux sont sûrs et prêts. Le troisième touche la base de production
et attend votre mot.

---

## P0.1 · Le cap — vérifié jusqu'au protocole, et la conclusion change

### Ce que j'ai vérifié

J'ai confronté `src/ubx/parser.ts` au *RaceBox BLE Protocol Description rev 8*,
champ par champ. Le parseur lit la trame avec l'en-tête inclus, donc
`offset parseur = offset charge utile + 6`.

| Champ (doc) | Charge utile | Parseur | Verdict |
|---|---|---|---|
| iTOW | 0 | 6 | juste |
| Fix Status | 20 | 26 | juste |
| Fix Status Flags | 21 | 27 | juste |
| Nombre de SV | 23 | 29 | juste |
| Longitude | 24 | 30 | juste |
| Latitude | 28 | 34 | juste |
| Altitude MSL | 36 | 42 | juste (MSL choisie, pas WGS — bon choix) |
| Précision horizontale | 40 | 46 | juste |
| Vitesse | 48 | 54 | juste |
| **Cap** | **52** | **58** | **juste** |
| Précision de vitesse | 56 | 62 | **non lue** |
| **Précision du cap** | **60** | **66** | **non lue** |
| PDOP | 64 | 70 | **non lue** |
| Batterie | 67 | 73 | juste |
| GForce X/Y/Z | 68/70/72 | 74/76/78 | justes |
| Rotation X/Y/Z | 74/76/78 | 80/82/84 | justes |

Et la garde `(fixStatusFlags & 0x20)` est **exactement** ce que la documentation
appelle *« Bit 5 : 1 = valid heading »*.

### La conclusion, corrigée

**Le parseur n'a pas de défaut.** Il lit le bon octet, au bon endroit, et il
respecte le drapeau que le constructeur définit. Le cap est nul en base parce que
**le boîtier a laissé le bit 5 à zéro pendant dix-huit minutes de roulage à
106 km/h de pointe** — pas parce que l'application l'a mal lu.

Je ne sais pas pourquoi. Et je ne peux pas le savoir, parce que **le seul
instrument qui le dirait n'est pas lu** : la *Précision du cap* (charge utile 60,
en degrés × 10⁵). Dans l'exemple du constructeur lui-même, à l'arrêt, le cap vaut
0° et sa précision vaut 145,27° — la précision dit ce que le drapeau tait.

Trois colonnes existent en base, créées par la migration
`telemetry_frames_add_accuracy_fields`, et **aucune n'est jamais écrite** :
`heading_accuracy`, `speed_accuracy`, `pdop`. Zéro valeur sur 26 999 trames.

### Ce qu'il faut faire, et c'est petit

**A. Écrire les trois champs de qualité.** Ils sont gratuits : les colonnes
existent, les offsets sont connus, le parseur passe déjà dessus. Ils rendent la
question décidable au lieu de rester une hypothèse.

`src/ubx/parser.ts` — chercher :

```
    motion: {
      speed: (dv.getUint32(54, LE) * 3.6) / 1000,
      heading: dv.getUint32(58, LE) / 1e5,
      headingValid: (fixStatusFlags & 0x20) !== 0,
    },
```

remplacer par :

```
    motion: {
      speed: (dv.getUint32(54, LE) * 3.6) / 1000,
      // Précision de vitesse (charge utile 56, mm/s) et précision de cap
      // (charge utile 60, deg × 1e5) : rev 8, p. 5-6. Elles ne changent aucun
      // calcul — elles permettent de SAVOIR pourquoi un cap est refusé.
      speedAccuracy: dv.getUint32(62, LE) / 1000,
      heading: dv.getUint32(58, LE) / 1e5,
      headingValid: (fixStatusFlags & 0x20) !== 0,
      headingAccuracy: dv.getUint32(66, LE) / 1e5,
      // PDOP (charge utile 64, facteur 100).
      pdop: dv.getUint16(70, LE) / 100,
    },
```

`src/services/captureFrameMapping.ts` — chercher :

```
  speed_ms: number | null;
  heading: number | null;
```

remplacer par :

```
  speed_ms: number | null;
  speed_accuracy: number | null;
  heading: number | null;
  heading_accuracy: number | null;
  pdop: number | null;
```

puis chercher :

```
    speed_ms: frame.motion.speed / 3.6,
    heading: frame.motion.headingValid ? frame.motion.heading : null,
```

remplacer par :

```
    speed_ms: frame.motion.speed / 3.6,
    speed_accuracy: frame.motion.speedAccuracy ?? null,
    // Le cap reste conditionné au drapeau du constructeur : on n'invente pas une
    // validité qu'il ne déclare pas. La PRÉCISION, elle, est écrite dans tous
    // les cas — c'est elle qui dira si le cap refusé était exploitable.
    heading: frame.motion.headingValid ? frame.motion.heading : null,
    heading_accuracy: frame.motion.headingAccuracy ?? null,
    pdop: frame.quality?.pdop ?? null,
```

`src/types/telemetry.ts` — ajouter `speedAccuracy`, `headingAccuracy` et `pdop`
au type `RaceBoxData.motion` (optionnels, pour ne casser aucun appelant de test).

**B. La règle d'affichage, jusqu'à nouvel ordre.** Aucun écran n'affiche
d'orientation : ni silhouette orientée, ni rotation de carte, ni angle de lacet.
L'état vide dit `CAP INDISPONIBLE`. La dérivation depuis la trajectoire est un
chantier séparé (P7 du plan v5), pas un correctif.

**C. La mesure du 19/09 à Bouteville.** Une seule requête après la répétition
dira si le cap est récupérable :

```sql
select count(*) n,
       count(heading) cap_valides,
       round(avg(heading_accuracy),1) precision_cap_moy,
       round(avg(pdop),2) pdop_moy
from telemetry_frames where session_id = '<séance du 19/09>';
```

Si `cap_valides > 0` : le boîtier sait le faire, et le 12/08 était une
circonstance. Si `cap_valides = 0` mais que `precision_cap_moy` est basse : le
cap était bon et le drapeau ment — on peut alors le rattacher sur un critère de
précision, en le disant. Si la précision est haute : le cap n'existe pas sur ce
matériel, et on cesse d'y penser.

**Aucune de ces trois branches ne se décide avant la mesure.**

---

## P0.2 · Ce qu'il ne faut PAS faire — la ligne de démonstration

Rappel, parce que je m'étais trompé : l'application **filtre déjà** la ligne
`mirror-insights-demo` trois fois — `MOTEURS_INSIGHTS_REELS`, `insightsMesures`,
et le filtre en requête de `sessionInsightsService` qui trie sur `computed_at`
pour prendre la plus récente *mesure*. Un test nommé la vise.

**Rien à coder.** Il reste seulement à la sortir de la table, parce qu'elle en est
le seul contenu et que tout ce qui lit la table sans passer par le service voit
des chiffres inventés comme contenu total.

### La requête, à valider avant exécution

```sql
-- Vérification préalable : cette ligne, et rien d'autre.
select id, telemetry_session_id, engine_version, n_laps, n_frames, computed_at
from session_insights
where engine_version = 'mirror-insights-demo';
-- attendu : 1 ligne, séance b62ab3af-5d6a-4e88-b316-73a0729933ae, 0 trame réelle

-- Suppression, après vérification.
delete from session_insights
where engine_version = 'mirror-insights-demo';
```

`INSIGHTS_JEU_ESSAI` reste dans le dépôt : c'est son jeu d'essai, il est marqué
`@deprecated`, et son en-tête interdit déjà son import par un écran livré.

---

## P0.3 · Le QDI — diagnostic livré, geste en attente

Voir `OXV_P0bis_Lecture_Moteur_2026-08-30.md` §4. Chiffres établis :
jerk latéral médiane 0,286 g/s, moyenne 2,240, p95 14,0 ; lissé sur 13 trames,
moyenne 0,629 → fluidité **78** au lieu de 0.

Le geste — filtrer avant de dériver — implique un incrément de
`QDI_ALGO_VERSION` et un recalcul des quatorze analyses existantes. Le dépôt
range explicitement ce genre de décision au fondateur. **Elle vous attend.**

---

## Ordre d'exécution proposé

1. P0.1-A et P0.1-B — les trois champs de qualité, la règle d'affichage. Sûr,
   réversible, sans effet sur un chiffre existant.
2. P0.2 — la suppression, après votre validation de la requête de vérification.
3. P0.3 — sur votre décision.
4. Puis P1 : la recette sur la séance de Bouteville.
