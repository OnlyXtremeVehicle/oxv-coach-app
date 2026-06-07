# 🏎️ OXV Mirror — Architecture technique (Partie 2 — version augmentée)

> **Algorithmes de marge et modèles de compétition automobile**
> Version augmentée : intègre les modèles utilisés en F1, GT et endurance
> Adaptés à RaceBox Mini (GPS + IMU seuls) sur le tracé Beltoise
> Date : Mai 2026

---

## Légende de fiabilité

À chaque formule, vous trouverez un marqueur :

- ✅ **Modèle physique fondamental** — issu de la mécanique du véhicule, indiscutable
- 🟡 **Modèle académique validé** — Milliken, Pacejka, Genta — coefficients à calibrer
- ⚠️ **Estimation indirecte** — dérivée d'autres mesures, précision dégradée
- 🔴 **Heuristique empirique** — valeur de référence, à valider sur vos données

---

## Sommaire

1. [Limites de RaceBox Mini et stratégie de contournement](#1-limites-de-racebox-mini)
2. [Filtre de Kalman pour fusion GPS+IMU](#2-filtre-de-kalman-pour-fusion-gpsimu)
3. [Modèle pneumatique de Pacejka simplifié](#3-modèle-pneumatique-de-pacejka)
4. [Transfert de charge dynamique](#4-transfert-de-charge-dynamique)
5. [Détection sous-virage / sur-virage par yaw rate](#5-détection-sous-virage--sur-virage)
6. [Estimation du temps optimal théorique](#6-estimation-du-temps-optimal-théorique)
7. [Modèle de marge véhicule augmenté](#7-modèle-de-marge-véhicule-augmenté)
8. [Modèle de marge pilote augmenté](#8-modèle-de-marge-pilote-augmenté)
9. [Procédure de calibration du circuit de Haute Saintonge](#9-procédure-de-calibration-du-circuit)
10. [Bilan d'implémentation et priorisation](#10-bilan-dimplémentation)

---

## 1. Limites de RaceBox Mini

### 1.1. Ce que RaceBox Mini mesure directement

| Grandeur | Fréquence | Précision typique |
|---|---|---|
| Position GPS (lat, lon) | 25 Hz | ±2-3 m (10 Hz HPPOSLLH ±0.5 m) |
| Altitude GPS | 25 Hz | ±5 m |
| Vitesse GPS | 25 Hz | ±0.1 km/h |
| Cap GPS | 25 Hz | ±2° à >5 km/h |
| Accélération 3 axes (X/Y/Z) | 200 Hz | ±0.005 g |
| Gyroscope 3 axes | 200 Hz | ±0.5°/s |
| Température interne | 1 Hz | ±2°C |

### 1.2. Ce que RaceBox Mini ne mesure PAS

- ❌ Pression de freinage
- ❌ Position pédale accélérateur
- ❌ Régime moteur
- ❌ Angle de braquage
- ❌ Débattement amortisseurs
- ❌ Pression / température pneus
- ❌ Force aux moyeux
- ❌ Wind speed

### 1.3. Stratégie de contournement

Pour chaque grandeur manquante, on **dérive** depuis ce qu'on a :

| Grandeur manquante | Dérivation depuis RaceBox | Précision attendue |
|---|---|---|
| Pression frein | Décélération longitudinale + dérivée (jerk) | ⚠️ 70-80% |
| Position gaz | Accélération longitudinale positive | ⚠️ 80-85% |
| Régime moteur | Vitesse / rapport supposé selon le delta vitesse | ⚠️ 50-70% |
| Angle braquage | Yaw rate / vitesse longitudinale | ⚠️ 75-85% |
| Coefficient frottement instantané | G_total observé / G_max calibré | 🟡 85% après calibration |

Ces estimations sont suffisantes pour la **pédagogie OXV** (montrer des tendances, suggérer des observations), mais **inadaptées à la compétition stricte** (réglages châssis, optimisation millimètre).

---

## 2. Filtre de Kalman pour fusion GPS+IMU

### 2.1. Pourquoi c'est nécessaire

Le GPS donne une position fiable mais bruitée à 25 Hz. L'IMU donne des accélérations précises à 200 Hz mais dérive dans le temps si intégrée seule. Le **filtre de Kalman étendu (EKF)** fusionne les deux pour obtenir une trajectoire lisse, précise, et à haute fréquence.

C'est ce que font tous les outils pros (RaceTechnology, RaceBox Lite Pro a son propre EKF embarqué, MoTeC, etc.). RaceBox Mini envoie les données brutes — on doit faire la fusion nous-mêmes côté app.

### 2.2. Modèle d'état

L'état du véhicule à l'instant `t` est représenté par un vecteur :

```
x(t) = [ position_x, position_y, position_z,
         vitesse_x, vitesse_y, vitesse_z,
         orientation_yaw, orientation_pitch, orientation_roll,
         biais_accelero_x, biais_accelero_y, biais_accelero_z,
         biais_gyro_z ]
```

13 dimensions. Les "biais" capturent les dérives des capteurs MEMS au cours du temps.

### 2.3. Étape de prédiction (200 Hz, depuis IMU) ✅

```
x(t+dt) = F(x(t), u(t), dt)
```

Où `u(t)` est le vecteur d'entrée IMU (accélérations + gyros). En pseudo-code :

```typescript
function kalmanPredict(state: State, imu: ImuReading, dt: number): State {
  // 1. Corriger les biais
  const ax = imu.accel_x - state.bias_ax;
  const ay = imu.accel_y - state.bias_ay;
  const az = imu.accel_z - state.bias_az;
  const yaw_rate = imu.gyro_z - state.bias_gyro_z;

  // 2. Rotation du repère véhicule vers repère terrestre
  const cos_yaw = Math.cos(state.yaw);
  const sin_yaw = Math.sin(state.yaw);
  const ax_world = ax * cos_yaw - ay * sin_yaw;
  const ay_world = ax * sin_yaw + ay * cos_yaw;

  // 3. Soustraction de la gravité (sur axe Z)
  const az_world = az - 9.81;

  // 4. Intégration
  return {
    x: state.x + state.vx * dt + 0.5 * ax_world * dt * dt,
    y: state.y + state.vy * dt + 0.5 * ay_world * dt * dt,
    z: state.z + state.vz * dt + 0.5 * az_world * dt * dt,
    vx: state.vx + ax_world * dt,
    vy: state.vy + ay_world * dt,
    vz: state.vz + az_world * dt,
    yaw: state.yaw + yaw_rate * dt,
    pitch: state.pitch,    // estimé séparément
    roll: state.roll,      // estimé séparément
    bias_ax: state.bias_ax,
    bias_ay: state.bias_ay,
    bias_az: state.bias_az,
    bias_gyro_z: state.bias_gyro_z,
  };
}
```

### 2.4. Étape de correction (25 Hz, depuis GPS) ✅

À chaque mesure GPS, on corrige l'état prédit :

```
K(t) = P(t) × H(t)^T × (H(t) × P(t) × H(t)^T + R)^-1   // gain de Kalman
x(t) = x(t) + K(t) × (z(t) - H(t) × x(t))               // mise à jour de l'état
P(t) = (I - K(t) × H(t)) × P(t)                         // mise à jour de la covariance
```

Où :
- `z(t)` est la mesure GPS (position + vitesse)
- `H` est la matrice d'observation (lien entre l'état et la mesure)
- `R` est la matrice de covariance du bruit GPS (~9 m² en position, ~0.01 m²/s² en vitesse)
- `P` est la matrice de covariance d'erreur de l'état

### 2.5. Résultat attendu

Une trajectoire :
- **Précise** à ±0.5 m en position (vs ±2-3 m sans fusion)
- **Lisse** sans sauts liés au bruit GPS
- **Fréquence effective 200 Hz** (vs 25 Hz du GPS seul)
- **Stable** dans les tunnels GPS courts (jusqu'à 2-3 secondes de perte)

### 2.6. Implémentation

Plusieurs librairies existantes en JavaScript / Rust :

- `kalmanjs` (npm) — simple, suffisant pour 1D
- `kalman-filter` (npm) — multidimensionnel, Express en JS
- `nalgebra` + custom EKF (Rust) — recommandé pour intégration WASM

**Charge calcul** : ~5 ms de traitement par seconde de données. Négligeable.

---

## 3. Modèle pneumatique de Pacejka

### 3.1. La Magic Formula (Pacejka 1989) 🟡

Hans Pacejka a publié dans les années 80 une formule qui décrit avec précision le comportement non-linéaire des pneus en glissement. C'est **le modèle de référence** utilisé en F1, WEC, IndyCar.

**Force latérale F_y en fonction du glissement latéral α** :

```
F_y(α) = D × sin(C × atan(B × α - E × (B × α - atan(B × α))))
```

Où les coefficients dépendent du pneu :
- `B` = stiffness factor (8 à 15 pour pneus de course)
- `C` = shape factor (1.3 à 1.6 pour latéral)
- `D` = peak factor = μ × charge_verticale
- `E` = curvature factor (-2 à 1)

**Pour OXV** : on ne peut pas mesurer `α` (le glissement) directement avec RaceBox. Mais on peut **estimer indirectement** le coefficient de friction effectif utilisé à chaque instant.

### 3.2. Estimation du μ effectif instantané ⚠️

À chaque instant, le pneu transmet une force latérale qui produit l'accélération latérale mesurée par l'IMU :

```
F_y_mesurée = m × G_lat × g

(loi de Newton, F = m × a)
```

Le coefficient de friction utilisé est :

```
μ_effectif(t) = G_lat(t) / G_charge(t)
```

Où `G_charge(t)` est l'accélération verticale, normalement ≈ 1 g + transfert de charge dynamique (voir section 4).

```typescript
function estimateInstantFriction(accelData: ImuReading, weightTransfer: number): number {
  const g_lat = Math.abs(accelData.accel_y);  // en g
  const g_vertical = 1 + weightTransfer;       // en g, avec transfert
  return g_lat / g_vertical;
}
```

### 3.3. Application pédagogique pour OXV

Pour chaque virage, on compte le **% du temps passé au-dessus de 90% du μ max calibré**. C'est un indicateur de **proximité de la limite pneumatique** plus subtil que le simple G_lat max.

```
Temps_pres_limite = somme(dt_i) pour tous i où μ_effectif(t_i) > 0.9 × μ_max
Pourcentage_pres_limite = Temps_pres_limite / Durée_virage
```

**Pédagogiquement** : un pilote qui passe 5% du temps proche de la limite a une marge confortable. Un pilote qui y passe 30% du temps est en zone de risque pneumatique — quel que soit son chrono.

### 3.4. Limites de l'approximation

Sans capteur de pression ou de température pneu, on ne sait pas si le pneu travaille à sa température optimale. À froid, un pneu PS4S a un μ de ~1.0 ; à 80°C, il monte à ~1.4. **Notre formule suppose un pneu en température**, ce qui est faux les 2-3 premiers tours.

**Solution OXV** : on flag les 3 premiers tours comme "tours d'échauffement" et on **n'affiche pas de marge pneumatique** sur ces tours. C'est l'inverse de ce que fait une app classique qui mesure tout dès le tour 1.

---

## 4. Transfert de charge dynamique

### 4.1. Pourquoi c'est important ✅

Quand une voiture freine, la masse se transfère sur l'essieu avant : plus d'adhérence devant, moins derrière. Inversement à l'accélération. En virage, c'est le côté extérieur qui charge.

Ce transfert change **dynamiquement** l'adhérence disponible à chaque roue, donc le comportement de la voiture. Un pilote qui transfère brutalement (transitions hachées) déstabilise la voiture et perd du temps.

### 4.2. Modèle simplifié de transfert longitudinal ✅

```
ΔF_z_av = (m × G_long × h_cg) / L

Où :
- m : masse totale (kg) — connue selon véhicule
- G_long : accélération longitudinale (m/s²)
- h_cg : hauteur du centre de gravité (~0.45 m pour GT3, ~0.55 pour route)
- L : empattement (m) — connu selon véhicule
```

Le transfert exprimé en % de la charge statique avant :

```
Transfert_pct_AV = ΔF_z_av / F_z_av_statique × 100
```

### 4.3. Modèle de transfert latéral ✅

Plus complexe car il dépend du roulis (anti-roll bars, suspensions). Modèle simplifié :

```
ΔF_z_lat = (m × G_lat × h_cg) / track_width

Où track_width est la voie de l'essieu (m)
```

### 4.4. Application OXV — l'indice de douceur ⚠️

On définit un **Smoothness Index** mesurant la régularité des transferts :

```
SI(t) = 1 - écart_type(dG_long/dt) / seuil_jerk

Avec seuil_jerk = 10 m/s³ (calibré pour pilote moyen)
```

Le **jerk** (dérivée de l'accélération) mesure la brutalité des transitions. Un pilote pro a un jerk maîtrisé < 5 m/s³ ; un pilote agressif sans technique monte à 15-20 m/s³.

**Pédagogie OXV** : ce score alimente le sous-indicateur "Douceur des transitions" de la marge pilote (vu en Partie 2 standard, section 3.3). Mais c'est **plus précis** que mon premier calcul — on raisonne sur le jerk, pas juste sur la dérivée brute.

```typescript
function computeSmoothnessIndex(longitudinalAccel: number[]): number {
  const dt = 0.005; // 200 Hz
  const jerks: number[] = [];

  for (let i = 1; i < longitudinalAccel.length; i++) {
    const jerk = (longitudinalAccel[i] - longitudinalAccel[i - 1]) / dt;
    jerks.push(Math.abs(jerk));
  }

  const meanJerk = jerks.reduce((s, j) => s + j, 0) / jerks.length;
  const variance = jerks.reduce((s, j) => s + (j - meanJerk) ** 2, 0) / jerks.length;
  const stdDev = Math.sqrt(variance);

  const SEUIL_JERK = 10; // m/s³
  return Math.max(0, Math.min(1, 1 - stdDev / SEUIL_JERK));
}
```

---

## 5. Détection sous-virage / sur-virage

### 5.1. La théorie ✅

En virage, deux comportements pathologiques :

- **Sous-virage** (understeer) : la voiture refuse de tourner autant que demandé. L'avant glisse. Le pilote braque plus, sans effet.
- **Sur-virage** (oversteer) : la voiture tourne trop. L'arrière glisse. La voiture pivote autour de son centre.

### 5.2. Détection par yaw rate vs trajectoire 🟡

**Sans capteur d'angle de braquage**, on ne peut pas mesurer directement le sous/sur-virage. Mais on peut le **détecter indirectement** en comparant deux grandeurs :

```
Yaw_rate_attendu = V × κ
Yaw_rate_mesuré  = gyro_z (depuis IMU)

Sous-virage = Yaw_rate_attendu > Yaw_rate_mesuré + seuil
Sur-virage  = Yaw_rate_attendu < Yaw_rate_mesuré - seuil
```

Où :
- `V` est la vitesse longitudinale (m/s)
- `κ` est la courbure locale de la trajectoire (1/rayon), calculée depuis la trajectoire GPS

### 5.3. Calcul de la courbure depuis la trajectoire GPS ✅

Pour 3 points GPS consécutifs `P_{i-1}, P_i, P_{i+1}`, la courbure se calcule via le **cercle passant par ces 3 points** :

```typescript
function computeCurvature(p1: Point, p2: Point, p3: Point): number {
  // Distance entre les points
  const a = haversine(p2, p3);
  const b = haversine(p1, p3);
  const c = haversine(p1, p2);

  // Aire du triangle (formule de Héron)
  const s = (a + b + c) / 2;
  const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));

  // Rayon du cercle circonscrit
  const radius = (a * b * c) / (4 * area);

  return 1 / radius;  // courbure en 1/m
}
```

### 5.4. Détection des phases instables ⚠️

```typescript
interface BalanceState {
  type: 'neutre' | 'sous_virage_leger' | 'sous_virage_marque' | 'sur_virage_leger' | 'sur_virage_marque';
  intensity_deg_per_s: number;  // amplitude de l'écart
}

function detectBalanceAnomaly(
  speed: number,           // m/s
  curvature: number,       // 1/m
  measuredYawRate: number  // deg/s, depuis gyro
): BalanceState {
  const expectedYawRate = (speed * curvature) * (180 / Math.PI);  // en deg/s
  const delta = expectedYawRate - measuredYawRate;

  const ABS_DELTA = Math.abs(delta);

  if (ABS_DELTA < 5) return { type: 'neutre', intensity_deg_per_s: 0 };

  if (delta > 0) {
    // Le yaw rate mesuré est inférieur à l'attendu : sous-virage
    return {
      type: ABS_DELTA < 15 ? 'sous_virage_leger' : 'sous_virage_marque',
      intensity_deg_per_s: ABS_DELTA,
    };
  } else {
    // Sur-virage
    return {
      type: ABS_DELTA < 15 ? 'sur_virage_leger' : 'sur_virage_marque',
      intensity_deg_per_s: ABS_DELTA,
    };
  }
}
```

### 5.5. Pédagogie OXV

Les phases de sous/sur-virage **marqué** alimentent les questions ouvertes de la méthode 3 :

- *"Sur le virage X, une phase de sous-virage de Y°/s a été détectée. Y avait-il une cause identifiable (charge moteur, freinage trop tardif, trajectoire) ?"*
- *"Une phase de sur-virage de Y°/s est apparue en sortie du virage Z. Cette glisse était-elle volontaire ?"*

**Important** : on ne dit jamais "freinez moins fort" ou "ouvrez les gaz plus tôt". On constate, on questionne.

---

## 6. Estimation du temps optimal théorique

### 6.1. Le quasi-steady-state lap time simulation 🟡

C'est la méthode utilisée par les équipes F1 et WEC pour estimer le temps optimal théorique d'un véhicule sur un tracé. Elle suppose qu'à chaque instant, la voiture est au maximum de l'adhérence disponible — soit en accélération, soit en freinage, soit en virage.

**Principe** :

1. Découper le circuit en N segments (typiquement 500 segments pour 2.6 km)
2. Pour chaque segment, calculer la vitesse maximale possible donnée par :
   - Le rayon du virage `R` (depuis trajectoire de référence)
   - Le coefficient de friction `μ` calibré pour le véhicule
   - Les contraintes amont (vitesse en entrée du segment)
   - Les contraintes aval (vitesse cible en sortie)

3. Itérer en avant (forward pass) : vitesse max possible vu l'accélération
4. Itérer en arrière (backward pass) : vitesse max possible vu le freinage requis
5. Prendre le **minimum** des deux à chaque point

### 6.2. Vitesse maximale en virage ✅

```
V_max_virage(R) = sqrt(μ × g × R)

Où :
- R : rayon du virage (m)
- μ : coefficient de friction (~1.4 pour GT3)
- g : 9.81 m/s²
```

Pour un virage à `R = 50 m` et `μ = 1.4` : V_max = sqrt(1.4 × 9.81 × 50) = 26.2 m/s = **94 km/h**.

### 6.3. Limitation longitudinale (accélération moteur) 🟡

L'accélération longitudinale est limitée par la puissance moteur :

```
a_max(V) = (P × η) / (m × V) - F_résistance(V) / m

Où :
- P : puissance moteur (W)
- η : rendement transmission (~0.85 pour transmission classique)
- F_résistance(V) = 0.5 × ρ × Cx × S × V² + m × g × Cr
- Cx : coefficient de traînée (~0.35 pour sportive)
- S : surface frontale (~2 m²)
- Cr : résistance roulement (~0.012)
```

### 6.4. Limitation longitudinale (freinage) ✅

Le freinage est limité par l'adhérence longitudinale du pneu :

```
a_min = -μ × g  (en m/s²)

Avec μ = 1.4 → freinage théorique max = -13.7 m/s² ≈ -1.4 g
```

### 6.5. Algorithme complet

```typescript
function computeOptimalLapTime(
  circuit: CircuitSegment[],
  vehicle: VehicleParameters
): { optimalLapTime: number; speedProfile: number[]; segmentTimes: number[] } {
  const N = circuit.length;
  const V_corner_max = circuit.map(s => Math.sqrt(vehicle.mu * 9.81 * s.radius));

  // Forward pass — accélération
  const V_fwd = new Array(N);
  V_fwd[0] = V_corner_max[0];
  for (let i = 1; i < N; i++) {
    const a_max = computeMaxAcceleration(V_fwd[i - 1], vehicle);
    const V_possible = Math.sqrt(V_fwd[i - 1] ** 2 + 2 * a_max * circuit[i].length);
    V_fwd[i] = Math.min(V_possible, V_corner_max[i]);
  }

  // Backward pass — freinage
  const V_bwd = new Array(N);
  V_bwd[N - 1] = V_corner_max[N - 1];
  for (let i = N - 2; i >= 0; i--) {
    const a_brake = vehicle.mu * 9.81;  // toujours positif (magnitude)
    const V_possible = Math.sqrt(V_bwd[i + 1] ** 2 + 2 * a_brake * circuit[i + 1].length);
    V_bwd[i] = Math.min(V_possible, V_corner_max[i]);
  }

  // Profil optimal = min(forward, backward) à chaque point
  const V_opt = V_fwd.map((v, i) => Math.min(v, V_bwd[i]));

  // Temps total = somme des dt_i = somme(length_i / V_moyen_i)
  let totalTime = 0;
  const segmentTimes: number[] = [];
  for (let i = 0; i < N; i++) {
    const V_avg = (V_opt[i] + (V_opt[i + 1] ?? V_opt[i])) / 2;
    const dt = circuit[i].length / V_avg;
    segmentTimes.push(dt);
    totalTime += dt;
  }

  return { optimalLapTime: totalTime, speedProfile: V_opt, segmentTimes };
}
```

### 6.6. Calibration sur Beltoise

Pour appliquer cet algo, il faut :
- Les **rayons** des 14 virages de Beltoise (à mesurer)
- Les **longueurs** des segments entre virages (à mesurer)
- Le **μ** pour le véhicule du pilote (calibré par catégorie)

Voir section 9 pour la procédure de relevé.

### 6.7. Usage pédagogique OXV

Le `optimalLapTime` est la **référence "Tour théorique"** affichée dans l'app (écran 2, picker de référence). Le profil de vitesse `V_opt` est superposé à la vitesse réelle du pilote dans le comparateur Ghost.

**Attention** : ce temps est **physiquement optimal**, pas humainement atteignable. Pour une 911 GT3 sur Beltoise, le tour théorique pourrait être 1:36, alors qu'un pilote pro fait 1:38, un pilote confirmé 1:42, un pilote initié 1:48.

C'est pour ça qu'OXV propose 3 références (théorique / personnel / pro) — pas pour comparer le pilote au théorique, mais pour lui donner **plusieurs étalons**.

---

## 7. Modèle de marge véhicule augmenté

### 7.1. Reprise de la marge de la Partie 2 standard

En Partie 2 standard, on avait :

```
Marge_véhicule = max(0, (G_max - G_total_p95) / G_max) × 100
```

C'est correct mais **simpliste**. On va l'enrichir avec les apports de Pacejka et du transfert de charge.

### 7.2. Marge véhicule pondérée par transfert de charge ✅+🟡

Le pneu intérieur en virage est **déchargé** par le transfert latéral. Sa force d'adhérence chute. La marge effective doit refléter cela.

```
F_z_extérieur = m × g / 2 + ΔF_z_lat
F_z_intérieur = m × g / 2 - ΔF_z_lat

Marge effective = adhérence du pneu le moins chargé / utilisation totale
```

Concrètement :

```typescript
function vehicleMarginAugmented(
  cornerData: TelemetrySegment,
  vehicle: VehicleParameters
): number {
  const samples = cornerData.points;
  const marges: number[] = [];

  for (const sample of samples) {
    // Transfert de charge instantané
    const deltaFz_lat = (vehicle.mass * Math.abs(sample.g_lat) * vehicle.h_cg) / vehicle.track_width;
    const Fz_inner = (vehicle.mass * 9.81 / 2) - deltaFz_lat;

    // Si pneu intérieur quasi-déchargé, marge effective faible même si G_total modéré
    const load_ratio_inner = Fz_inner / (vehicle.mass * 9.81 / 2);  // 1 = chargé normal, 0 = vide

    // Adhérence effective disponible côté intérieur
    const mu_eff_inner = vehicle.mu * load_ratio_inner;
    const G_inner_max = mu_eff_inner * 9.81;
    const G_inner_used = sample.g_lat / 2;  // moitié de l'effort latéral
    const marge_inner = Math.max(0, 1 - G_inner_used / G_inner_max);

    // Marge limitante = pneu le plus sollicité (généralement intérieur)
    marges.push(marge_inner);
  }

  // 95e percentile
  marges.sort();
  return marges[Math.floor(marges.length * 0.05)] * 100;  // on prend le 5e (la marge la plus faible)
}
```

### 7.3. Implication pédagogique

Un pilote qui rentre brutalement en virage **transfère trop vite** et fait sauter le pneu intérieur, créant un sous-virage transitoire. La marge véhicule augmentée détecte ce cas alors que la marge simple ne le voyait pas.

---

## 8. Modèle de marge pilote augmenté

### 8.1. Sous-indicateur 1 — Régularité (déjà dans Partie 2 standard)

Pas de changement par rapport au document standard.

### 8.2. Sous-indicateur 2 — Qualité de trajectoire augmenté ✅

On enrichit en mesurant non seulement la **déviation latérale** mais aussi la **continuité de la trajectoire**.

```
Continuité = 1 - écart_type(courbure) / courbure_référence
```

Une trajectoire avec courbure stable indique un pilote qui anticipe et conduit en flow. Une trajectoire avec courbure hachée indique des corrections successives.

### 8.3. Sous-indicateur 3 — Smoothness Index (depuis section 4.4)

C'est exactement le `SI(t)` calculé via jerk. Il remplace la métrique simpliste de la Partie 2 standard.

### 8.4. Sous-indicateur 4 — Stabilité dynamique (nouveau) 🟡

On compte la fréquence des phases de sous/sur-virage marquées (depuis section 5).

```
Stabilité = 1 - durée_phases_anormales / durée_totale_virages
```

Un pilote stable a < 5% de phases anormales. Un pilote nerveux > 20%.

### 8.5. Agrégation marge pilote augmentée

```
Marge_pilote = 0.30 × Régularité
             + 0.25 × Qualité_trajectoire
             + 0.20 × Smoothness_Index
             + 0.25 × Stabilité_dynamique
```

Les coefficients sont rééquilibrés par rapport à la version standard pour intégrer le nouveau sous-indicateur.

---

## 9. Procédure de calibration du circuit de Haute Saintonge

### 9.1. Pourquoi c'est nécessaire

Les formules ci-dessus nécessitent les paramètres physiques du tracé Beltoise :
- Rayons des 14 virages
- Longueurs des segments
- Profil altimétrique (dévers, montées/descentes)
- Coordonnées GPS précises de la ligne start/finish et des coupures secteurs

**Sans ces données, l'app affichera des résultats approximatifs.**

### 9.2. Session de calibration recommandée

**Une session dédiée**, idéalement avant le lancement de l'app, avec :

- **Un pilote expérimenté** (Julien Beltoise idéalement)
- **Un véhicule de référence** (GT3 ou Cayman GT4)
- **RaceBox Mini** fixé selon les recommandations constructeur
- **10-15 tours propres** avec recherche de la trajectoire optimale

### 9.3. Données à extraire

Après la session, on récupère le fichier UBX et on fait l'extraction suivante :

```typescript
// 1. Identifier le meilleur tour (chrono pur)
const bestLap = laps.sort((a, b) => a.duration_ms - b.duration_ms)[0];

// 2. Pour ce tour, identifier les 14 virages par yaw rate
//    Un virage = phase où |gyro_z| > 10°/s pendant > 0.3s
const cornerSegments = detectCorners(bestLap.telemetry);

// 3. Pour chaque virage, calculer le rayon moyen
const corners = cornerSegments.map((segment, idx) => ({
  index: idx + 1,
  entry_lat: segment.points[0].lat,
  entry_lon: segment.points[0].lon,
  apex_lat: segment.points[segment.points.length / 2].lat,
  apex_lon: segment.points[segment.points.length / 2].lon,
  exit_lat: segment.points[segment.points.length - 1].lat,
  exit_lon: segment.points[segment.points.length - 1].lon,
  radius_m: computeAverageRadius(segment.points),
  theoretical_apex_speed_kmh: bestLap.telemetry.find(p => p.timestamp === segment.apex_time).speed,
}));

// 4. Stocker dans app_circuit_reference
await supabase.from('app_circuit_reference').update({
  corners: corners,
  reference_lap_data: bestLap.telemetry,
  parser_version: '1.0.0',
});
```

### 9.4. Validation du modèle

Une fois calibré, on relance le calcul de temps optimal théorique. On compare :

- **Temps optimal calculé** par notre algo
- **Meilleur temps réel** observé en compétition sur Beltoise (probablement ~1:35 pour une GT3 bien pilotée)

Si l'écart est < 3%, le modèle est calibré correctement. Si > 10%, il faut ajuster μ ou la trajectoire de référence.

### 9.5. Élargissement aux autres circuits

Cette procédure est **reproductible pour Bordeaux** (votre futur deuxième site) ou tout autre circuit. Chaque tracé devient une ligne dans `app_circuit_reference`.

---

## 10. Bilan d'implémentation

### 10.1. Priorisation par impact pédagogique

| Modèle | Impact pédagogique | Complexité dev | Priorité |
|---|---|---|---|
| Filtre de Kalman GPS+IMU | 🔴 Critique | Élevée | **V1 obligatoire** |
| Marge véhicule simple (μ_eff) | 🔴 Critique | Moyenne | **V1 obligatoire** |
| Smoothness Index (jerk) | 🟠 Forte | Faible | **V1 obligatoire** |
| Détection sous/sur-virage | 🟠 Forte | Moyenne | **V1 obligatoire** |
| Marge véhicule augmentée (transfert) | 🟡 Modérée | Élevée | V2 |
| Optimal lap time simulation | 🟡 Modérée | Très élevée | V2 |
| Modèle Pacejka complet | 🟢 Faible (sans capteurs) | Très élevée | Hors scope |

### 10.2. Estimation d'effort de dev pour les algorithmes

| Module | Effort en heures |
|---|---|
| Filtre de Kalman (lib + intégration) | 25-35 h |
| Parser UBX (Rust → WASM) | 40-50 h |
| Détection virages + secteurs | 15-20 h |
| Marge véhicule + pilote (V1) | 20-30 h |
| Smoothness Index + détection anomalies | 15-20 h |
| Détection sous/sur-virage | 10-15 h |
| Comparateur Ghost (alignement spatial) | 20-25 h |
| Tests unitaires + datasets de validation | 30-40 h |
| **Total algorithmes V1** | **175-235 h** |

### 10.3. Datasets nécessaires

Pour valider les algorithmes avant lancement :

- **Dataset 1** : 1 session "parfaite" (Julien Beltoise) → trajectoire de référence
- **Dataset 2** : 3 sessions pilotes confirmés → calibration des marges
- **Dataset 3** : 3 sessions pilotes initiés → calibration des seuils
- **Dataset 4** : 1 session avec incident (sortie de piste, tête à queue) → validation détection anomalies

Total : **8 sessions de roulage** pour valider l'app avant ouverture publique.

### 10.4. Limites assumées du système

Ce que OXV Mirror **ne peut pas faire** avec RaceBox Mini seul :

- Mesurer précisément les pressions pneus à chaque virage
- Détecter une casse mécanique
- Coacher en temps réel pendant la conduite (refus du HUD pour raisons de sécurité)
- Donner des conseils de réglage châssis
- Comparer aux pilotes pros à la milliseconde

Ce que OXV Mirror **fait bien** :

- Observer la marge globale et par zone du pilote
- Détecter les zones de progression sûres
- Bloquer les zones de risque (marge < 15%)
- Poser des questions ouvertes pédagogiques
- Suivre la progression dans le temps
- Adapter les recommandations au niveau du pilote

C'est **un outil pédagogique premium, pas un outil de compétition**. Ce positionnement est cohérent avec votre cible OXV.

---

## Synthèse

Ce document de référence couvre :

1. ✅ Les limites de RaceBox Mini, lucidement
2. ✅ La fusion Kalman GPS+IMU pour une trajectoire fiable à 200 Hz
3. ✅ Le modèle pneumatique Pacejka, simplifié pour ce qu'on peut mesurer
4. ✅ Le transfert de charge dynamique
5. ✅ La détection sous/sur-virage par yaw rate
6. ✅ Le calcul du temps optimal théorique (quasi-steady-state)
7. ✅ Les marges véhicule et pilote augmentées
8. ✅ La procédure de calibration du circuit Beltoise
9. ✅ Le bilan d'implémentation et la priorisation V1 / V2

Ce n'est **pas** un copie de logiciel pro (PI Toolbox, MoTeC, AiM), mais **une adaptation cohérente des modèles académiques** à votre contexte hardware et à votre doctrine produit "sécurité avant performance".

---

*Document à conserver dans votre repo sous `/docs/app/ARCHITECTURE_PARTIE_2_AUGMENTEE.md`.*
*Pour la mise en œuvre, voir Partie 3 (à venir) : connectivité, déploiement, coûts.*
