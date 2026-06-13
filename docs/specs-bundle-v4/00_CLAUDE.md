# CLAUDE.md — Application mobile OXV Mirror

> Lis ce fichier **en entier** avant toute modification de code.
>
> Ce repo est l'**application mobile** OXV Mirror (Expo / React Native). Il est
> **distinct** du repo du site web (`OnlyXtremeVehicle/oxv-site`). Ne confonds pas
> les deux : ce qui se decide ici ne se « repare » pas cote site, et inversement.
>
> N'ajoute jamais de secret (cle `service_role`, token, mot de passe) ni de donnee
> personnelle dans un fichier versionne. Jamais de `.env` committe.

---

## 0. Mission

Reconstruire l'app **OXV Mirror** : une application mobile **post-session** d'analyse
telemetrique pour pilotes de track day. Elle restitue la donnee, de facon factuelle,
lisible et premium. **Elle ne coache pas.**

Point de depart impose : **repartir du repo Expo existant**, en conservant les briques
techniques saines de la V1 (voir section 6) et en supprimant tout ce qui contredit la
doctrine. Ce n'est pas un projet vierge : c'est un assainissement + une refonte de l'arbo
autour de 4 piliers factuels.

---

## 1. Doctrine — le principe non negociable

**« L'app est un miroir. Elle vous montre. Elle ne vous dirige pas. La piste est a vous.
Les decisions aussi. »**

C'est la regle de tri de **toute** decision produit et de **tout** texte affiche :

- Si une fonction **dirige** le pilote (note globale, conseil, classement qui designe un
  « meilleur », « il faut freiner plus tard », « pour progresser… ») → **hors doctrine, refusee.**
- Si elle **montre un fait** (vitesse, trajectoire empruntee, ecart a soi-meme, deux faits
  cote a cote) → **recevable.**
- **En cas de doute : on retire.** Le silence est conforme ; la prescription ne l'est pas.

### Test de conformite d'un texte affiche
Toute chaine affichee (y compris generee par la chaine de mise en forme) doit passer ce test :
- Commence par « vous devriez… », « il faut… », « pour progresser… » → **BLOQUE.**
- Commence par « voici… », « sur ce tour… », « par rapport a votre session precedente… » → **OK.**

### Raison juridique (ne pas l'oublier)
La doctrine est aussi la ligne de defense du produit. OXV conserve la responsabilite
**technique** (l'app marche, la donnee est exacte) mais decline la responsabilite
**pedagogique** (le pilote interprete et decide seul). Ne jamais ecrire de copie qui
brouille cette frontiere.

---

## 2. Vocabulaire impose

- **Vouvoiement** partout. Jamais de tutoiement.
- **Pas d'emojis** dans l'UI ni dans les textes.
- Idiome HUD interne (a exposer visuellement, jamais comme un conseil) :
  **Cap, Trajectoire, Anticipation, Visee, Plongee.**
- Les 4 piliers factuels (remplacent le QDI) :
  **Signature de pilotage · Regularite/consistance · Evolution personnelle (soi contre soi)
  · Carte de chaleur du trace.**
- Le **QDI est abandonne** cote app. Ne reintroduis aucun score global, aucune note de
  niveau (Elite/Solide/A travailler), aucun classement inter-pilotes hierarchise.
- Le **totem faucon est interne uniquement**. Jamais nomme dans l'UI (pas de « Falcon Eye »,
  « Dive Mode », etc.). Il s'exprime silencieusement par l'insigne bouclier-casque et les
  formes en V / visiere / plongee.

---

## 3. Charte visuelle (tokens)

A centraliser dans un fichier de theme unique, **repris a l'identique du site** (`index.html`,
charte « Executive Dashboard », MODULE_CHARTE_DESIGN.md). Ne pas reinventer : ces valeurs font
foi.

Deux familles de variables coexistent **volontairement** : les variables d'UI generale
(`--gold`, `--red`...) utilisees au quotidien, et les variables **marque OXV** (`--oxv-*`)
reservees aux moments d'identite (insigne, focus de marque). Ne pas les confondre ni les fusionner.

### Palette de fond (Noir Abysse / Carbone)
| Token | Valeur | Usage |
|---|---|---|
| `--night` | `#050505` | Noir Abysse — fond principal |
| `--night-deep` | `#000000` | Fond le plus profond |
| `--night-soft` | `#0E0E0E` | Fond adouci |
| `--night-card` | `#121212` | Carbone Verre — surfaces Bento |
| `--oxv-night` | `#0A0A0A` | Fond marque |

### Texte (Blanc Pur / Gris Titane)
| Token | Valeur | Usage |
|---|---|---|
| `--cream` | `#F8F9FA` | Blanc Pur — titres et data |
| `--cream-soft` | `#E5E5E5` | Texte clair adouci |
| `--cream-mute` | `#A1A1AA` | Gris Titane — secondaire |
| `--cream-faint` | `rgba(248,249,250,0.50)` | Texte tres discret |
| `--cream-line` | `rgba(255,255,255,0.05)` | Bordure Bento |
| `--cream-edge` | `rgba(255,255,255,0.15)` | Bordure Bento (hover) |

### Accents
| Token | Valeur | Usage |
|---|---|---|
| `--gold` / `--copper` | `#FFB703` | Or Dore — performance, QDI, succes, accents principaux, CTA |
| `--copper-glow` | `#FFC93C` | Variante claire de l'Or (gradients, glow) |
| `--copper-deep` | `#C68B00` | Variante sombre de l'Or |
| `--red` | `#E63946` | Rouge Adrenaline — alertes, urgent, erreurs, accents UI |
| `--blue-tech` | `#60A5FA` | Bleu technique (freinage) |
| `--green-perf` | `#4ADE80` | Vert performance (acceleration) |
| `--purple-tech` | `#C084FC` | Violet (regularite) |
| `--steel` | `#5C5C66` | Gris acier |

### Marque OXV (strict — moments d'identite uniquement)
| Token | Valeur | Usage |
|---|---|---|
| `--oxv-red` | `#C8102E` | **Rouge insigne** — Access, Signature, Promotion ; focus de marque |
| `--oxv-gold` | `#C4A459` | **Or Heritage STRICT** — reserve a Heritage. Jamais ailleurs |
| `--oxv-cream` | `#F8F9FA` | Texte marque |

### Couleurs piliers QDI (intouchables — ne pas renommer ni reaffecter)
| Token | Valeur | Dimension |
|---|---|---|
| `--qdi-trajectory` | `#E63946` | Trajectoire |
| `--qdi-fluidity` | `#FFB703` | Fluidite |
| `--qdi-braking` | `#60A5FA` | Freinage |
| `--qdi-acceleration` | `#4ADE80` | Acceleration |
| `--qdi-regularity` | `#C084FC` | Regularite |

### Regles d'usage fermes
- **`--oxv-gold #C4A459` = Heritage et rien d'autre.** Ne jamais l'appliquer a Access,
  Signature, Promotion ou a un accent decoratif. (A distinguer de `--gold #FFB703`, l'Or Dore
  d'UI generale, lui largement utilise.)
- **Les 5 couleurs QDI sont figees** et signifiantes (une par dimension). Ne pas les renommer
  ni les detourner tant que les donnees reelles ne les ont pas validees/remplacees.
- Ne **pas** reintroduire d'anciennes valeurs hors charte (ex. `#FFB703` est bien la charte ;
  c'est l'usage qui compte). En cas de doute, reprendre la valeur exacte du `:root` d'`index.html`.

### Typographie (variables du site)
| Variable | Police | Usage |
|---|---|---|
| `--display` | `Syncopate` (fallback Inter) | Titres, chiffres geants, eyebrows, data — l'identite forte |
| `--sans` / `--serif` | `Inter` | Corps de texte (note : `--serif` est mappe sur Inter pour la lisibilite) |
| `--mono` | `JetBrains Mono` | Eyebrows, donnees, labels mono (9-11px, letter-spacing 0.18-0.32em, uppercase) |

- Style editorial : minimalisme sec facon Ferrari, dense et lumineux (refs internes : Apple TV,
  Bloomberg Terminal, F1 TV Pro). Sobre, dense en sens, pauvre en decoration.
- Eyebrows/labels en `--display` ou `--mono`, uppercase, fort letter-spacing.
- Confirme la disponibilite de Syncopate et JetBrains Mono dans Expo avant usage ; sinon,
  fallback Inter en gardant la hierarchie.
- Easings officiels : `--ease cubic-bezier(0.25,0.46,0.45,0.94)` (standard),
  `--ease-out cubic-bezier(0.22,1,0.36,1)` (barres de progression).

---

## 4. Stack technique

- **Mobile** : Expo / React Native. Navigation a repointer sur les 11 blocs (voir specs).
- **Capteur** : RaceBox Mini (GPS + IMU, **25 Hz**), via **BLE**.
- **Backend** : **Supabase** (PostgreSQL, Auth, Storage, Edge Functions), region **Frankfurt
  (EU)**, projet `fouvuqkdxarjpjbqnsjq`.
- **Chaine de donnees** : App (capture 25 Hz) → `push` des frames dans `telemetry_frames`
  → **calcul des indicateurs cote Supabase** (PAS dans l'app) → restitution dans l'app et
  sur la page progression du site.
- **Auth** : un **client Supabase unique typé**, token chiffre via `expo-secure-store`.
  (La V1 avait 2 clients : **les fusionner**.)
- **Meteo** : Open-Meteo (cache 10 min) — RGPD-friendly, deja en V1, a garder.
- **Mise en forme** : edge function `generate-debrief-ai` conservee pour un usage
  **strictement factuel et interne** (mise en page « nouvelle generation » des restitutions,
  **jamais** de conseil). Soumise au test de conformite de la section 1.
- **Analytics** : Plausible (privacy-compliant), pas de tracker tiers intrusif.
- **AR coach (preview)** : lunettes **Ray-Ban Display** via approche **Web View** (route web
  `ar-view` dediee, hors bundle Expo, mise a jour sans passer par les stores). Reservee aux
  comptes coach. **Developer preview Meta** : prototypable, **non publiable au grand public
  tant que Meta n'a pas ouvert la disponibilite generale**. Voir `specs/E0_ar_coach.md`.

### Etat critique a connaitre
`telemetry_frames` est **vide (0 ligne)** : la capture n'est pas encore branchee en
production. **Consequence directe** : toute restitution est aujourd'hui une **maquette de
demonstration**, pas un bug. La premiere vraie capture est prevue a **Valence (Espagne),
juillet 2026**. Concois les ecrans pour qu'ils degradent proprement quand la donnee manque
(voir bloc « Etats limites »).

---

## 5. Architecture cible de navigation

13 blocs principaux + 1 bloc preview (detail dans `specs/`) :

1. Onboarding · 2. Coeur (restitution post-session) · 3. Detail data · 4. Sessions &
historique · 5. Circuits & traces · 6. Communaute · 7. Identite/Avatar · 8. Garage ·
9. Fonctionnalites neuves · 10. Compte · 11. Etats limites · 12. **Coach (SaaS coachs
agrees)** · 13. **Map & ecosysteme partenaires** · 14. **Vue AR coach (lunettes — preview
Meta, prototypable, non publiable tant que Meta n'a pas ouvert la GA)**.

L'entree apres une session est **la Synthese de session** (bloc 2). Le reste se navigue
depuis une barre principale sobre. Ne surcharge pas la navigation : un pilote consulte
l'app au paddock, entre deux relais, avec des gants.

### Deux types de comptes
L'app sert **deux roles** : le **pilote** (parcours principal) et le **coach agree** (bloc
12, ecrans C0.2 a C0.5 reserves aux comptes coach). Prevois la distinction de role des le
modele d'auth : un coach a un abonnement SaaS (750 EUR/saison) et n'accede qu'aux eleves qui
l'ont invite. Voir `specs/C0_coach.md` pour le cadre juridique (le coach parle en son nom,
pas au nom d'OXV).

---

## 6. Heritage V1 — ce qu'on garde, ce qu'on jette

### GARDER (briques validees en conditions reelles)
- **Parser UBX** RaceBox (checksums Fletcher-8, trames 88 octets). **Ne pas modifier.**
- **Service BLE** (scan + connexion + notifications + reconnexion). Garder, simplifiable.
- **Types telemetrie** (alignes sur la base). Garder.
- **Utilitaires geo** (Haversine, detection de tours avec cooldown anti-faux-positifs). Garder.
- **Service meteo Open-Meteo** (cache 10 min). Garder.
- **Client Supabase SecureStore** (token chiffre). Garder le principe, **fusionner en un seul**.
- **Migrations Supabase deja appliquees** (circuits, laps, weather_snapshots). **Ne pas recreer.**

### JETER (conflit doctrinal ou dette)
- **Systeme QDI** (`drivingQuality.ts` et derives) : note Elite/Solide/A travailler →
  contredit la doctrine. **Supprimer.**
- **Charte couleur V1** : la V1 mixait des valeurs hors `:root` officiel. **Reprendre la
  charte exacte du site** (section 3 : `:root` d'`index.html`) plutot que les valeurs
  improvisees de la V1. Centraliser dans un theme unique.
- **Arbo onglets V1** (`index`/`sessions`/`live`/`profile`) : **refondre** sur les 11 blocs.
- **Prefs de notification** `rank_change` / `new_record` / `new_follower` historiques :
  a retirer **sauf** ce que le bloc Communaute reintroduit explicitement et de facon opt-in
  (voir `specs/60_communaute.md` — assouplissement assume).

---

## 7. Regles de code non negociables

1. **Travaille par increments valides.** Au-dela de ~500-1000 lignes produites d'un coup,
   la qualite chute. Decoupe, fais valider, avance.
2. **Architecture mono-responsabilite.** Le calcul des indicateurs vit cote Supabase, pas
   dans les composants d'ecran. L'app **affiche**, elle ne calcule pas les piliers.
3. **Pas de refacto speculatif.** Ne reorganise pas une brique « pour faire propre » sans
   raison liee a une spec. Les briques GARDER de la section 6 restent telles quelles.
4. **TypeScript strict.** Types explicites pour toute donnee telemetrie.
5. **Degradation propre.** Chaque ecran data doit avoir un etat « donnee absente / partielle »
   (cf. `telemetry_frames` vide aujourd'hui).
6. **Aucune chaine affichee ne doit echouer au test de conformite** de la section 1.
7. **Accessibilite terrain** : lisibilite plein soleil (contraste fort), cibles tactiles
   larges (usage avec gants), pas d'interaction fine requise en exterieur.
8. **Aucun secret versionne.** Cles cote serveur uniquement. Respecte les RLS Supabase.
9. **Tu ne peux pas** : tester sur un vrai smartphone, te connecter physiquement a un
   RaceBox, ni publier sur les stores (2FA humaine). Signale ces etapes comme manuelles.

---

## 8. Comptes et publication

- Comptes Expo/EAS et stores sur `oxv@oxvehicle.fr` (pas un compte personnel).
- Apple : compte developpeur (99 $/an), penser a regenerer le JWT. Captures iPhone 6.7"
  (1290×2796).
- Google Play : captures 1080×1920.
- Le nom store doit rester stable 8-12 mois.

---

## 9. En cas de blocage

- Si une demande contredit la doctrine : repointe vers la section 1 et ajuste.
- Si une fonction te semble « utile mais limite » : applique le test de conformite. Dans le
  doute, retire et signale-le.
- Si tu ne peux pas faire quelque chose techniquement : dis pourquoi et propose des
  alternatives.

Bonne route avec OXV Mirror.
