# Guide de réintégration HTML → React Native (playbook interne)

> Comment je traduis chaque écran refait dans Claude Design en RN avec le kit,
> de façon mécanique et cohérente. Compagnon de `HANDOFF_CLAUDE_DESIGN.md` et
> `REGLES_COULEUR.md`.

## 1. Couleurs — hex reçu → token (à substituer systématiquement)
| Hex dans le HTML | Token RN | Note |
|------------------|----------|------|
| `#050505` | `theme.palette.night` | fond |
| `#0B0B0D` | `theme.palette.card` | carte |
| `#121214` | `theme.palette.card2` | carte 2 / pill |
| `#F8F9FA` | `theme.palette.cream` | texte primaire / fond bouton |
| `#E5E5E5` | `theme.palette.creamSoft` | |
| `#C9C9CE` | `theme.palette.secondary` | |
| `#9A9AA3` | `theme.palette.creamMute` | muted / pastille neutre |
| `#6E6E76` | `theme.palette.eyebrow` | |
| `#54545C` | `theme.palette.faint` | eyebrow / inactif |
| `#1C1C20` | `theme.palette.line` | filet |
| `#232326` | `theme.palette.cardBorderProminent` | |
| `rgba(255,255,255,0.20)` | `theme.palette.edge` | bordure état sélectionné |
| `#FFB703` | `theme.palette.gold` | **DONNÉE seule** |
| `#C8102E` | `theme.palette.red` | **marque/REC seul** |
| `#C4A459` | `theme.palette.heritageGold` | Heritage / n° virage |
| `#97C459` | `theme.palette.green` | connecté / switch ON |
| `#F2792B` | `theme.palette.pilotAmber` | marge / trajectoire |
| `#E63946` | `theme.dataColors.brake` | **freinage** (rouge de donnée) |
| `#60A5FA` | *(littéral)* | bleu = vitesse basse / eau (pas un token) |
| `#4ADE80` | `theme.dataColors.accel` | accélération |
| `#C084FC` | `theme.dataColors.regularity` | régularité |
| `#B87333` | *(const BRONZE local)* | admin uniquement |

> Tout hex reçu qui matche un token DOIT devenir le token (règle DRY canon).
> Un hex sans token exact (jaune `#EF9F27`, bleu `#60A5FA`) reste un littéral commenté.

## 2. Typographie — CSS → theme
| CSS | theme |
|-----|-------|
| `font-family: Geist / sans` (400/500/600) | `theme.fonts.body / bodyMedium / bodySemi` |
| `font-family: Geist Mono` (chiffres, eyebrows) | `theme.fonts.mono / monoMedium` |
| `font-family: Instrument Serif` (titre hero, date) | `theme.fonts.serif / serifItalic` — **jamais un chiffre** |
| tailles | eyebrow 11 · small 12 · body 14 · bodyLg 15 · h3 17 · h2 21 · value 25 · display 28 · serifTitle 44 · hud 62 → `theme.fontSize.*` |
| `letter-spacing` sur eyebrow | garder (+1.5 à +2), majuscules |

## 3. Espacement / rayon → theme
- padding/margin px → `theme.spacing` (xs 4 · sm 8 · md 12 · lg 16 · xl 22 · xxl 28) ; arrondir au plus proche.
- border-radius → `theme.radius` (sm 10 · md 12 · lg 14 · xl 18 · pill 999).

## 4. Élément HTML → composant du kit
| Motif dans le HTML | Composant RN | Détails |
|--------------------|--------------|---------|
| barre de titre | `<AppBar title onBack leading trailing />` | titre mono majuscule ; logo lettres blanches sur les hubs |
| conteneur d'écran | `<Screen>` | fond night, scroll, padding lg |
| carte / panneau | `<Card>` | fond card2, bordure line, radius xl ; **ombre neutre, jamais or** |
| bouton d'action plein | `<Button label />` (défaut) | fond cream, texte night, ≥52px |
| bouton secondaire | `<Button variant="ghost" />` | bordure edge, texte cream |
| champ de saisie | `<Field label placeholder value onChangeText />` | label eyebrow au-dessus |
| gros chiffre / jauge | `<GaugeInstrument value min max unit />` ou `<MeterBar />` | valeur en or, **un seul par écran** |
| sur-titre / eyebrow | `<Text style={eyebrow}>` | mono, faint, +letterSpacing, MAJUSCULE |
| état vide | `<EmptyState label message />` | doux, honnête |
| note du coach | `<CoachBand />` | bande séparée, serif italic |
| interrupteur | `<Switch trackColor={{true: theme.palette.green}} />` | actif = vert |
| pastille de statut | `<View>` 6px | creamMute (neutre) / green (connecté) / red (REC) |
| pill / carte sélectionnable | `<Pressable>` | actif = bordure `edge` + fond `card` |
| case à cocher | — | cochée = fond cream, coche night |
| onglets internes | `<LayerToggle>` / segmented | actif = cream, jamais or |
| radar 5 branches | `<QdiRadar current reference detail />` | polygone or, réf. pointillé creamMute |
| tracé circuit + couches | `<CircuitMap>` presets + `<LayerToggle>` | ambre = marge/trajectoire |
| feuille basse virage | `<CornerPanel>` | Modal + Animated |

## 5. Réflexes de traduction
- **Pas de hover** (mobile) : ignorer les `:hover` ; garder l'état `pressed`
  (opacité 0.85–0.9).
- **Ombres** : RN = `shadowColor/shadowOpacity/shadowRadius/shadowOffset` (iOS) +
  `elevation` (Android). **Jamais shadowColor or** (halo décoratif interdit).
- **Gradients** : `expo-linear-gradient` si nécessaire ; rester sobre.
- **Icônes** : réutiliser l'existant ; pas d'emoji.
- **Animations** : `Animated`/`Reanimated` déjà en place ; respecter le silence
  en piste (pas d'haptique/anim pendant le roulage).
- **SVG** (graphes, tracés) : `react-native-svg` ; les rendus Skia (Data Lab
  canvas, charts perf) ne se valident qu'au build.

## 6. Check final par écran (avant commit)
- [ ] Or = donnée seule ; rouge de marque = REC seul ; freinage = `#E63946` ; marge = ambre.
- [ ] Un seul chiffre dominant ; chiffres en mono ; aucun serif sur un chiffre.
- [ ] États vide / erreur / hors-ligne présents ; aucun spinner infini.
- [ ] Cibles tactiles ≥ 44 px ; `accessibilityRole`/`Label` sur l'interactif.
- [ ] Données/nav/RLS **inchangées** (je n'ai touché que le rendu).
- [ ] Gates vertes : tsc · prettier · eslint · doctrine · jest.
