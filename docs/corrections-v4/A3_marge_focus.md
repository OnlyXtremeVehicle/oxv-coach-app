# PROPOSITION — lot d'écran : marge pilote + virage à creuser

> 15/08/2026, suite du QCM. Deux fichiers neufs (logique pure + tests), sept
> remplacements exacts, chaque ancre vérifiée UNIQUE dans son fichier. Le lot
> « barres en séance » (4b) n'a pas de patch : voir § 3 — la mesure a montré
> qu'il était déjà tenu.

---

## 1 · Fichiers neufs

| fichier | rôle |
|---|---|
| `src/features/miroir/margeLogic.ts` | `margeModel()` — pilote / complete / absente — et `focusVirage()` |
| `src/features/miroir/__tests__/margeLogic.test.ts` | 7 cas, dont Bouteville à l'identique (60,4 · 34 · 100) |

La globale revient d'elle-même le jour où `margin_vehicle` redevient une
mesure : c'est le discriminant du modèle, pas un drapeau à penser.

---

## 2 · Remplacements exacts

### 2a — `src/features/miroir/bilanLogic.ts` : le marqueur `focus` existe

```
CHERCHER :
export type BilanMarkerKind = 'engaged' | 'coach';

REMPLACER PAR :
export type BilanMarkerKind = 'engaged' | 'coach' | 'focus';
```

### 2b — `src/features/miroir/useBilan.ts` : l'import

```
CHERCHER :
import { useCoachThread } from '@/hooks/useCoachThread';

REMPLACER PAR :
import { useCoachThread } from '@/hooks/useCoachThread';
import { focusVirage, margeModel, type MargeBilan } from '@/features/miroir/margeLogic';
import { colors } from '@/ui/v2/tokens';
```

### 2c — `useBilan.ts` : le contrat

```
CHERCHER :
  pillars: BilanPillar[];

REMPLACER PAR :
  pillars: BilanPillar[];
  /** Marge PUBLIABLE (décision 15/08 : pilote seule tant que le véhicule
   *  n'est pas caractérisé — margeLogic dit pourquoi). */
  marge: MargeBilan;

```

### 2d — `useBilan.ts` : le marqueur du virage à creuser

```
CHERCHER :
      const traceMarkers = buildTraceMarkers({
        segments,
        annotatedCornerIndexes: coachNotes.map((n) => n.cornerIndex),
        centerline,
      });

REMPLACER PAR :
      const traceMarkers = buildTraceMarkers({
        segments,
        annotatedCornerIndexes: coachNotes.map((n) => n.cornerIndex),
        centerline,
      });
      // Le virage à creuser — `next_focus_corner_index` était persisté à
      // chaque analyse et lu par AUCUN écran (mesuré le 14/08) : la phrase
      // sans le lieu. Bleu trajectoire : une DONNÉE, ni or ni rouge.
      const focus = focusVirage(analysis?.nextFocusCornerIndex ?? null, segments);
      if (focus) {
        traceMarkers.push({ t: focus.t, color: colors.qdi.trajectoire, kind: 'focus' });
      }

```

### 2e — `useBilan.ts` : la donnée publiée

```
CHERCHER :
        pillars: mapPillars(qdi && qdi.algoVersion === QDI_ALGO_VERSION ? qdi : null),

REMPLACER PAR :
        pillars: mapPillars(qdi && qdi.algoVersion === QDI_ALGO_VERSION ? qdi : null),
        marge: margeModel(analysis),

```

### 2f — `app/(app2)/bilan/[sessionId].tsx` : la section MARGE

```
CHERCHER :
          {/* Quatre piliers — branches QDI, « — » si non mesuré */}

REMPLACER PAR :
          {/* Marge PILOTE — jamais la globale tant que le véhicule n'est pas
              caractérisé (décision 15/08 ; margeLogic porte le pourquoi). */}
          {data.marge.kind !== 'absente' ? (
            <View style={styles.section}>
              <SectionHeader
                eyebrow={data.marge.kind === 'pilote' ? 'MARGE PILOTE' : 'MARGE'}
              />
              <View style={styles.margeCard}>
                <Text style={styles.margeHero} accessibilityRole="header">
                  {Math.round(
                    data.marge.kind === 'pilote' ? data.marge.pilote : data.marge.globale
                  )}
                  <Text style={styles.margeUnit}> %</Text>
                </Text>
                {data.marge.kind === 'pilote' ? (
                  <>
                    {data.marge.composantes.map((c) => (
                      <PillarBar
                        key={c.cle}
                        label={`${c.label} · poids ${c.poids === 0.6 ? '0,6' : '0,4'}`}
                        value={c.valeur}
                      />
                    ))}
                    <Text style={styles.margeVehicule}>
                      Véhicule non caractérisé — exclu du calcul.
                    </Text>
                  </>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Quatre piliers — branches QDI, « — » si non mesuré */}
```

### 2g — même écran : les styles

```
CHERCHER :
  debriefCard: {

REMPLACER PAR :
  margeCard: {
    marginTop: space.lg,
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    padding: space.lg,
  },
  margeHero: {
    fontFamily: typo.mono,
    fontSize: 44,
    letterSpacing: -1,
    color: colors.text.hi,
    marginBottom: space.md,
  },
  margeUnit: {
    fontFamily: typo.body,
    fontSize: 16,
    letterSpacing: 0,
    color: colors.text.mid,
  },
  margeVehicule: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.low,
    marginTop: space.md,
  },
  debriefCard: {
```

---

## 3 · Le lot « barres en séance » (4b) : déjà tenu, mesuré

Je devais remplacer le radar par des barres sur l'écran de séance. **Le radar
n'y est pas.** `QdiRadar` n'a que deux points de montage : le composant
lui-même et `app/(coach)/studio.tsx`. Côté pilote, le bilan rend déjà les
branches en `PillarBar`, avec « — » sur l'absence — c'est la forme que le banc
d'essai recommandait, en place avant lui. La décision QCM est donc satisfaite
par l'existant : radar réservé à la Signature/Saison et au studio coach,
barres partout où une séance seule s'affiche. Rien à patcher — et c'est la
troisième fois de la semaine qu'une mesure évite un chantier déjà fait.

Reste vrai : le jour où quelqu'un montera un radar sur une vue de séance, la
distinction « zéro mesuré / non mesuré » ne pourra pas s'y dessiner. Si vous
voulez la verrouiller, c'est une garde d'un grep — dites-le.

## 4 · Vérification après application

`jest` : 7 cas neufs de `margeLogic.test.ts` (dont Bouteville publie
`pilote 60,4` et PAS `51,4`) ; les suites existantes ne bougent pas — aucune
ancre modifiée n'est couverte par un test de valeur. `tsc` : le `kind: 'focus'`
compile par 2a ; `TraceCircuit` consomme `{t, color}` et ignore `kind`, le
marqueur se rend sans autre modification. Visuel : la section MARGE apparaît
au-dessus des Quatre piliers ; sur Bouteville elle doit lire 60 %, Constance
34, Fluidité 100, et la ligne véhicule.
