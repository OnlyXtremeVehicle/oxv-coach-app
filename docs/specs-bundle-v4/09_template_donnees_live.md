# 09 — Template de données « en direct » (session_insights)

> Comment Claude Code obtient un exemple RÉEL et INTERROGEABLE de la donnée
> d'intégration, au lieu d'un JSON figé sur le disque.

---

## 1. ÉTAT HONNÊTE (vérifié en base)

`session_insights` est **VIDE** : aucune vraie session n'est encore calculée, car
`telemetry_frames` ne se remplit qu'à partir de la session de Valence (juillet 2026).
Le moteur (`compute-session-insights`) et son cron horaire sont en place et PROUVÉS,
mais ils n'ont rien à mâcher tant qu'il n'y a pas de frames.

Conséquence : un template « tiré de vraies données » n'existe pas encore. Deux sources
de vérité de forme en attendant :
1. **`CONTRAT_DONNEES_session_insights.json`** — la forme exacte produite par le moteur
   (sur données synthétiques 6 tours ; attention : 13 virages sur-segmentés, cf. §5.1
   de la fiche 05).
2. **Une ligne de DÉMO en base** — alignée 7 virages (Haute Saintonge), interrogeable
   en direct, marquée `engine_version = 'mirror-insights-demo'`. C'est l'objet de ce doc.

---

## 2. LA LIGNE DE DÉMO (comment l'interroger en direct)

Une ligne a été insérée dans `session_insights`, rattachée à la vraie session
Haute Saintonge `b62ab3af-5d6a-4e88-b316-73a0729933ae`. Claude Code l'interroge avec
la requête EXACTE qu'il utilisera en production :

```sql
select *
from session_insights
where telemetry_session_id = 'b62ab3af-5d6a-4e88-b316-73a0729933ae';
```

ou, plus généralement, pour récupérer le dernier insight d'un pilote :

```sql
select *
from session_insights
where user_id = :pilot_id
order by computed_at desc
limit 1;
```

Cette démo est alignée sur les **7 virages** du circuit (corner_1 … corner_7), donc
elle correspond au tracé 3D du générateur — contrairement au contrat synthétique.

---

## 3. REMPLACEMENT AUTOMATIQUE PAR LA VRAIE DONNÉE

Le jour où Valence remplit `telemetry_frames` pour cette session, le moteur fait un
**upsert** sur `telemetry_session_id` (clé unique). La ligne de démo sera donc
**écrasée** par le vrai calcul, et `engine_version` passera de `mirror-insights-demo`
à `mirror-insights-v1`. Rien à nettoyer : la transition est automatique.

Pour distinguer démo et réel à tout moment :
```sql
select telemetry_session_id, engine_version, computed_at
from session_insights
order by computed_at desc;
```
`mirror-insights-demo` = template ; `mirror-insights-v1` = vraie donnée calculée.

---

## 4. POUR SUPPRIMER LA DÉMO (si besoin)

```sql
delete from session_insights where engine_version = 'mirror-insights-demo';
```
Sans danger : ne touche aucune vraie donnée (il n'y en a pas encore).

---

## 5. COMPORTEMENT À CODER : ÉTATS VIDES

La démo remplit TOUTES les clés pour montrer leur forme. Mais en vraie donnée précoce
(début Valence), trois insights seront souvent vides — décision fondateur : **état
vide explicite**, pas de remplissage artificiel :
- `throttle_brake` = `null` (câblé côté écran depuis le jerk longitudinal).
- `dispersion` = `{}` tant qu'il n'y a pas assez de tours comparables.
- `load_transfer` = `{}` tant que le gyroscope n'a pas assez de matière.

Claude Code DOIT donc coder l'état vide de ces trois blocs, même s'ils sont peuplés
dans la démo. Voir fiche 05 §3 (couches) et la doctrine Mirror (ne jamais maquiller
l'absence de donnée).

---

## 6. RAPPEL : numérotation des virages

La démo utilise corner_1 … corner_7, alignés sur la détection par courbure du
générateur de circuit. Le moteur d'insights actuel (détection par minima de vitesse)
produit ENCORE 13 virages sur-segmentés. Tant que cet alignement n'est pas fait
(cf. fiche 05 §5.1), brancher les écrans sur la DÉMO (7 virages), pas sur la sortie
brute du moteur. Calibrage définitif à Valence.
