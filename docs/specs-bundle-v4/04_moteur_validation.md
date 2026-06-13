# Moteur de calcul des insights — état de validation

Le moteur de référence est dans `moteur/` (deux fichiers JS, runtime-agnostique) :
- `synth.mjs` — générateur de session synthétique (circuit fictif 6 virages, 1602 m, 6 tours à
  25 Hz). Sert à valider les formules **sans données réelles** (telemetry_frames est vide).
- `insights.mjs` — le moteur : calcule les 9 insights à partir des frames. Logique de référence
  à porter en edge function Supabase (Deno/TypeScript) ou en SQL.

## Méthode
On a généré un tour synthétique physiquement cohérent avec des caractéristiques **connues
d'avance** (injectées), puis vérifié que le moteur les retrouve. C'est la seule façon de prouver
les formules avant la première vraie capture (Valence).

## Résultats de validation (sur données synthétiques)

| Insight | Attendu (injecté) | Calculé | Verdict |
|---|---|---|---|
| 3.1 Dispersion | V4 le plus dispersé, V1 le plus stable | V4=0.57 (max), V1=0.02 (min) | ✅ classement correct |
| 3.2 Tour idéal | gap faible, localisé | gap 0.32 s, pertes localisées | ✅ |
| 3.3 Dérive session | amélioration jusqu'au tour ~4-5 | improvingUntil = 5 | ✅ exact |
| 4.3 Flow (jerk) | + rapide = + fluide | corr −0.98 | ✅ très net |
| 4.4 Équilibre châssis | V3 survireur (+18%), V5 sous-vireur (−16%) | V3=+19%, V5=−14% | ✅ signe + magnitude OK |
| 2.2 Diagramme G-G | axes purs, combiné rare | combiné 0.7%, G plafonné 1.6g | ✅ |
| 2.1 Anatomie virage | freinage/corde/réaccel par virage | distances de freinage plausibles | ✅ (accelDist=0, voir limite) |
| 2.3 Profils gaz/frein | (calculé via jerk, cf. flow) | — | à câbler sur écran |
| 4.5 Transfert de charge | temps de roulis variable par virage | 2.48 s constant | ⚠️ NON DISCRIMINANT sur synthétique |

## Limites connues (honnêtes)
- **4.5 Transfert de charge** : le générateur synthétique modélise le roulis comme une fonction
  instantanée du G latéral, sans dynamique temporelle propre par virage. Le moteur ne peut donc
  pas mesurer de vitesse de mise en charge variable — d'où la valeur constante. **Le calcul n'est
  pas invalidé**, il manque de matière à mesurer. À CONFIRMER sur données réelles RaceBox, où le
  roulis aura une vraie inertie (suspensions, masse, style). Ne pas considérer comme prouvé.
- **2.1 accelDist = 0** : le générateur enchaîne les virages sans phase d'accélération pure
  isolable. Sur données réelles (lignes droites franches), la distance de réaccel sera renseignée.
- Les valeurs absolues de dispersion (m) dépendent de la projection ⟂ au cap ; calibrer le
  facteur d'affichage sur les premières vraies sessions.

## Ce qui est solidement validé
Six insights sur neuf produisent des résultats corrects et discriminants sur données contrôlées,
dont **l'équilibre châssis (4.4)** — l'insight le plus différenciant, et le plus à risque de bug
de signe. La chaîne complète (découpage tours → distance curviligne → détection virages →
calculs) tourne sans erreur sur ~7900 frames.

## Portage en production (pour Claude Code, plus tard)
1. Porter `insights.mjs` en edge function Deno : remplacer l'import synth par une lecture
   `telemetry_frames WHERE session_id = ?` ordonnée par `elapsed_ms`.
2. En prod, `lap` n'est pas fourni : utiliser `detectCornersGeneric` et une vraie détection de
   tour par franchissement de ligne start/finish (geofence), pas le champ `lap` synthétique.
3. Filtrer en amont sur `fix_valid = true` et `pdop` raisonnable (cf. 03_chantier_capture.md).
4. Écrire les résultats dans `app_session_analyses` (ou une table insights dédiée), PAS dans le
   vocabulaire QDI/marges de l'ancienne `cron-analyze-pending-sessions` (doctrine Mirror : faits,
   pas scores). Passer le test de conformité doctrinal sur toute formulation texte.
5. Re-valider chaque insight sur la première vraie session (Valence) avant de l'exposer en prod.
