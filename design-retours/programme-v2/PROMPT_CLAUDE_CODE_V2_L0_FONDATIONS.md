# PROMPT CLAUDE CODE — LOT V2-L0 · FONDATIONS SENSORIELLES
### Repo oxv-app · DA Instrument · niveau visé : Airbnb/Uber Eats · un lot = un commit — 18/07/2026

---

## CONTEXTE & AMBITION
Fondations de la refonte v2. Ambition explicite du fondateur : une app **belle à regarder, navigable instinctivement, émotionnelle** — au niveau des meilleures apps consumer actuelles. Principe directeur : la beauté OXV = **matière photographique (les GT des membres, les circuits) + mouvement + espace**, jamais de décor gratuit. La DA Instrument (titane, cadrans, or Heritage) est le cadre.
**Aucun écran métier ici. Aucune modification de `src/services/`. 837 tests verts.**

## CONTRAINTES ABSOLUES
1. Ne toucher ni `src/services/`, ni `supabase/`, ni la state machine.
2. tsc 0 · jest vert · grep doctrine 0 · zéro couleur en dur hors tokens.
3. Commit : `feat(v2): L0 fondations sensorielles — tokens, motion, icônes, images, 18 composants`.

## LIVRABLE 1 — Outillage nouvelle génération
```bash
npx expo install react-native-reanimated react-native-gesture-handler expo-haptics expo-blur expo-image @shopify/flash-list
npm i @expo-google-fonts/michroma
```
`@shopify/react-native-skia` est DÉJÀ présent (data-lab-canvas) — le réutiliser, ne pas réinstaller. Babel : plugin reanimated en dernier. GestureHandlerRootView à la racine `(app2)`. PAS de Lottie (les illustrations sont des SVG maison animés — zéro asset externe, cohérence totale).

## LIVRABLE 2 — Tokens · `src/ui/v2/tokens.ts` (DA Instrument, enrichis)
```ts
export const colors = {
  bg: { base: '#14151A', card: '#1B1D24', card2: '#232630', scrim: 'rgba(10,11,14,0.72)' },
  border: { card: '#2A2D38', strong: '#3A3E4C', hairline: '#22242C' },
  accent: '#C8102E', accentGlow: 'rgba(200,16,46,0.35)',
  text: { hi: '#E8E9ED', mid: '#A9ADBB', low: '#7A7E8C', dim: '#5A5E6C' },
  heritage: { gold: '#C4A459', text: '#E8DCB8', glow: 'rgba(196,164,89,0.30)' },
  qdi: { trajectoire: '#60A5FA', fluidite: '#FFB703', freinage: '#E63946',
         acceleration: '#4ADE80', regularite: '#C084FC' },
} as const;
export const type = {
  display: 'Michroma_400Regular', body: 'Inter_400Regular', bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold', mono: 'JetBrainsMono_500Medium', monoSemi: 'JetBrainsMono_600SemiBold',
} as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 18, xl: 24, xxl: 36 } as const;
export const radius = { card: 18, cell: 12, hero: 24, pill: 999 } as const;
export const motion = {
  door: 260, stagger: 45, radar: 600, pulse: 1200, needle: 800,
  spring: { damping: 18, stiffness: 180 },       // le spring maison, partout
  springSoft: { damping: 22, stiffness: 120 },
} as const;
```
Règles en tête de fichier (commentaires) : UN accent rouge par zone · or = Heritage exclusif · QDI = données jamais fonds · cadran : 1/écran, jamais décoratif, aiguille=instantané arc=cumul, zéro texture métal · `accentGlow`/`heritage.glow` = UNIQUEMENT ombres portées Skia de traits (tracé, aiguille), jamais des fonds · scrim = uniquement sur photo pour lisibilité texte (patron Airbnb).

## LIVRABLE 3 — Iconographie OXV · `src/ui/v2/icons/` ⭐
**Fini les symboles unicode.** Set d'icônes SVG maison, style « instrument » : trait 1.5px, terminaisons rondes, grille 24px, monochromes (couleur par prop). Composant `OxvIcon name= size= color=`. Les 20 icônes du set, dessinées EN RAPPORT avec la piste :
`miroir` (rétroviseur galbé) · `data` (courbe télémétrie sur grille) · `club` (fanion de paddock) · `vous` (casque de profil, visière) · `rec` (cercle plein) · `chrono` (chronographe à poussoirs) · `circuit` (tracé bouclé) · `casque` · `gants` · `drapeau-damier` · `cle` (réglages, clé à molette fine) · `coeur` (biométrie) · `montre` (Apple Watch) · `ceinture` (électrodes) · `camera` · `convoi` (3 chevrons route) · `groupe` (3 casques) · `insigne` (bouclier OXV, reprend le vrai) · `meteo-piste` (soleil sur bitume) · `incident` (triangle fin).
La tab bar utilise `miroir · data · [CentralButton] · club · vous(casque)`. Test snapshot du set complet.

## LIVRABLE 4 — Système d'images · `src/ui/v2/media/`
Patron Airbnb : la photo est un matériau de premier plan.
- `Photo` : wrapper `expo-image` — placeholder **blurhash** (stocké en base quand dispo, sinon blurhash générique titane), transition fade 220 ms, `contentFit=cover`, recyclingKey.
- `HeroPhoto` : plein cadre radius `hero`, **scrim dégradé bas** (`colors.bg.scrim` → transparent, LinearGradient d'expo — seule exception autorisée à la règle anti-dégradé, réservée à la lisibilité sur photo) + slot texte superposé + parallax léger au scroll (translateY × 0.3, Reanimated scrollHandler).
- Sources de matière DÉJÀ en base : photos garage (`users.media` par véhicule), médias sessions, photos partenaires. + `assets/circuits/` : 2 visuels circuit (Haute Saintonge, Ricardo Tormo — tracé Skia sur fond photo si photo indisponible, généré depuis centerline).
- Règle : JAMAIS d'image stock générique. Pas de photo réelle → tracé Skia du circuit ou monogramme, comme la v1 le fait déjà pour les partenaires.

## LIVRABLE 5 — Langage de motion · `src/ui/v2/motion/` ⭐
Bibliothèque de primitives réutilisables (chacune : hook ou wrapper + test) :
| Primitive | Spec |
|---|---|
| `useDoorTransition` | entrée d'écran : fade + translateY 12→0, `motion.door`, easing out |
| `Stagger` | enfants apparaissent en cascade `motion.stagger` (remplace/étend le Stagger existant, FlashList-compatible via entering) |
| `useCondensingHeader` | patron Airbnb : au scroll >64px le header devient barre condensée `expo-blur` (tint dark, intensité 40) + hairline — titre migre en 12px, interpolation Reanimated |
| `HeroMorph` | transition carte→écran : la SessionCard tapée fige position/taille (measure) et le Bilan entre avec chrono+tracé interpolés depuis cette géométrie (orchestration Reanimated, 320 ms spring) — l'effet « ça voyage » d'Airbnb |
| `PullToRefreshDial` | ⭐ signature OXV : tirer = une aiguille de cadran suit le doigt (rotation ∝ distance), relâcher = sweep complet pendant le refresh + haptic léger |
| `RollingCounter` | chiffres odomètre : chaque digit roule verticalement (millièmes en accent) |
| `Shimmer` | squelettes : balayage lumineux froid sur formes `bg.card2` (pas de spinner nulle part) |
| `RecordFlash` | célébration record SOBRE : le chrono pulse ×2 en blanc→or, halo Skia bref sous le texte, haptic `notificationSuccess` — 900 ms, pas de confetti |
| `NeedleSweep` | aiguille Dial : spring `motion.spring`, léger overshoot mécanique |
| `PressScale` | tout élément tappable : scale 0.97 + haptic `selection` (wrapper Pressable universel) |
| `GlowStroke` | Skia : trait de tracé circuit avec ombre portée `accentGlow` 6px — lumière du trait, pas néon de fond |

## LIVRABLE 6 — Haptics map · `src/ui/v2/haptics.ts`
`expo-haptics`, sémantique figée : `tap` selection (tout Pressable) · `arm` heavy (armer capture) · `record` notificationSuccess (RecordFlash) · `doorSnap` light (fin NeedleSweep, sections franchies) · `warn` notificationWarning (erreurs). Un seul point d'entrée `haptic('tap')` — jamais d'appel direct dispersé. Respecte le réglage système.

## LIVRABLE 7 — 18 composants noyau · `src/ui/v2/`
Les 13 de la spec précédente, ENRICHIS du langage motion, + 5 nouveaux :
| Composant | Spec (delta sensoriel) |
|---|---|
| `StateView` | loading = `Shimmer` formes réelles de la section ; empty = **illustration SVG maison animée** (tracé de circuit qui se dessine en boucle lente 8 s, trait `text.dim`) + message ; error = icône `incident` + Réessayer `PressScale` ; offline = bandeau + dernier contenu |
| `SectionHeader` | inchangé + option compteur (« 3 ») pill hairline |
| `ChronoHero` | `RollingCounter` intégré ; prop `celebrate` → `RecordFlash` |
| `StatCell` / `SessionCard` | `PressScale` ; SessionCard reçoit `photoUri?` (média session) → mini `Photo` 56px à gauche du chrono ; participe à `HeroMorph` |
| `RadarQdi` | tracé progressif 600 ms + points qui « claquent » en fin (scale spring) + `doorSnap` |
| `PillarBar` | remplissage animé au premier viewport (useAnimatedReaction + measure) |
| `TraceCircuit` | rendu **Skia** : trait fond `border.card` 5px + `GlowStroke` progression ; puces événements avec pop spring ; `annotationBand` inchangée (bord or) |
| `BiometryStrip` | sparkline Skia, dernier point pulsé au rythme moyen (période = 60/bpm s — détail d'orfèvre) |
| `HeritageBand` | + `heritage.glow` ombre du trait or |
| `CentralButton` | 3 états (reserve/countdown/rec) + pulse capture + `arm` haptic |
| `Dial` | aiguille `NeedleSweep`, arc progressif, valeur `RollingCounter` |
| `Sheet` | gorhom si présent sinon Reanimated pur ; fond `bg.card`, coins `radius.hero`, **backdrop blur** léger |
| 🆕 `HeroPhoto` | cf. Livrable 4 |
| 🆕 `Photo` | cf. Livrable 4 |
| 🆕 `OxvIcon` | cf. Livrable 3 |
| 🆕 `Chip` | filtre/catégorie (patron Uber Eats) : pill hairline, actif = fond `bg.card2` bord `border.strong`, `PressScale` |
| 🆕 `ListRow` | ligne hairline universelle : OxvIcon + label + valeur/chevron, `PressScale` — remplace toute liste maison |
| 🆕 `TabBar` | la barre 5 portes elle-même : fond blur (`expo-blur` dark 30) au-dessus du contenu, hairline top, icônes OxvIcon avec transition actif (couleur + scale 1.06 spring), CentralButton flottant −8px |

## LIVRABLE 8 — Structure `(app2)` + dev-galerie
- `app/(app2)/_layout.tsx` : GestureHandlerRootView + `TabBar` custom + masquage capture (import logique appMap, sans la modifier).
- 5 placeholders de porte avec `useDoorTransition` + StateView empty illustré.
- `useCentralButtonState()` (lecture `getMyNextTrackDay` + `useAppStateStore`, testé).
- `app/(app2)/dev-galerie.tsx` (`__DEV__`) : **l'écran de validation fondateur** — les 18 composants + les 20 icônes + les 11 primitives motion déclenchables (boutons « rejouer ») + section haptics testable. C'est ici que le niveau Airbnb se juge avant tout écran métier.

## LIVRABLE 9 — Preuves
tsc 0 · jest vert (+ tests : icônes snapshot, primitives motion logique, haptics map, useCentralButtonState) · grep doctrine 0 · grep couleurs en dur 0 (hors tokens/icônes) · captures dev-galerie (composants + motion) dans `roadmap/rapports/v2-l0.md` · budget perfs noté : aucune animation sur JS thread (tout Reanimated/Skia), vérif `useNativeDriver` implicite.

## HORS PÉRIMÈTRE
Écrans métier · services · migrations · Live Activity (L2-B) · Lottie/moti/toute dépendance non listée.
