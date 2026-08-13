# OXV Mirror V3 — Arbre coach, spécification écran par écran

**26 juillet 2026** · Complément au dossier de travail V3
Établi à partir de `docs/INVENTAIRE_ECRANS.md` et de vingt arbitrages.

**Périmètre** : les 36 routes de `app/(coach)`, layout exclu. Aucune n'est omise.

---

# I. LE PRINCIPE

**Deux modes, comme l'admin terrain.** Temporel le jour J, structuré le reste du temps. C'est désormais la règle des trois espaces : le pilote a cinq visages, le coach deux modes, l'admin deux modes.

**Et une rupture avec tout le marché** : le fil de séance.

MoTeC analyse après coup sur ordinateur. Apex Pro parle au pilote en temps réel. Garmin Catalyst coache à sa place. **Aucun n'outille le coach pendant qu'il regarde.**

Le problème réel du coach n'est pas la donnée, c'est **sa mémoire** : il voit quelque chose à 14h11, il débriefe à 14h35, et trois autres pilotes sont passés entre-temps.

---

# II. LE FIL DE SÉANCE — l'objet central

**Il s'écrit seul pendant le run, et il *est* le débrief quand le pilote rentre.** Le coach n'ouvre pas un écran d'analyse : il ouvre ce qu'il a sous les yeux depuis vingt minutes.

## II.1 Ce qui atterrit sur le fil

| Source | Événement | Registre visuel |
|---|---|---|
| **Machine** | entrée en piste, tour bouclé, meilleur tour, retour au stand | gris neutre |
| **Coach** | marqueur, note vocale, annotation | **rouge de marque** |
| **Pilote** | ressenti après run, note libre | trait clair |
| **Capteur** | courbe cardiaque | posée à ses horodatages |

**Trois registres se distinguent sans légende.** Un coup d'œil suffit à savoir qui a produit quoi.

Le meilleur tour porte l'or de performance `#D9AE00` et un filet — **jamais une couleur de jugement**.

## II.2 Le marqueur résolu — l'innovation doctrinale

Le coach voit quelque chose et marque : geste du Neural Band sur les lunettes, doigt sur le plateau, ou dans le focus.

**L'application ne stocke pas un horodatage, elle le résout** : quel pilote, quel tour, quel virage, quelle vitesse d'entrée, quelle décélération, quelle distance avant la corde.

> Tour 4 · virage 4 · 118 km/h en entrée · 1,08 G · 62 m avant la corde

**Il a vu, la machine dit où et quoi, personne n'interprète.** C'est la doctrine à son meilleur : l'œil humain et la mesure sur le même axe, le temps.

**Le marqueur porte sa provenance** — horodatage, auteur, source — et **ressort partout** : file de lecture, carte de séance, préparation suivante du pilote.

Il fusionne avec `coach_pilot_highlight` et avec le marquage pilote : **un seul mécanisme, deux origines**.

## II.3 Ce que le fil rend inutile

| Écran supprimé | Lignes | Motif |
|---|---|---|
| `debrief` | 524 | le fil **est** le débrief |
| `triage` | 377 | le marqueur humain remplace le signalement automatique — qui est de surcroît une interprétation |
| `lecture` | 530 | c'est un réglage, pas un écran |
| `priorites` | 552 | marquer et annoter sont le même geste, absorbé par `annoter` |

**1 983 lignes disparaissent.**

---

# III. L'ESPACE LIVE — cinq surfaces

**La distance de lecture commande tout.**

| Surface | Distance | Rôle | Information simultanée |
|---|---|---|---|
| **Lunettes** Meta Ray-Ban Display | superposée au réel | le coach regarde la piste | **une ligne** |
| **Téléphone** | 35 cm, en main | le coach en mouvement | 5 à 8 |
| **Tablette** | 50 cm, posée | le poste complet | 15 et plus |
| **Grand écran** | 2 à 4 m | le débrief, à plusieurs | 3 à 5, très grandes |
| **Apple Watch** | — | **côté pilote, mesure seule** | aucune |

## III.1 Les lunettes — trois fonctions

**Le SDK est ouvert depuis le 14 mai 2026.** Meta Wearables Device Access Toolkit : SDK natif iOS Swift et Android Kotlin, qui étend une application existante vers l'écran des lunettes — composants texte, images, listes, boutons, vidéo. Voie alternative en HTML/CSS/JS avec accès au mouvement, à l'orientation, au GPS du téléphone, à l'entrée du Neural Band et au stockage local.

Entrée par **électromyographie de surface** via le Neural Band : mouvements de doigts subtils, ni écran tactile ni voix.

**Deux réserves** : c'est un **aperçu développeur**, pas une version stable ; et le SDK natif est en Swift alors que l'application est React Native — module natif et client de développement personnalisé requis.

| Fonction | Comportement |
|---|---|
| **Le passage** | rien en continu. Un pilote coupe la ligne → une ligne trois secondes : `07 · 1:42,8` → elle disparaît |
| **Le marqueur** | un geste horodate l'instant, **sans quitter la piste du regard** |
| **L'appel** | un pincement fait apparaître l'état d'un pilote, un balayage passe au suivant |

**Interdit** : télémétrie continue, barre de delta, tracé vivant. **Tout ce qui défile concurrence la vision réelle, et sur un circuit c'est dangereux.**

`ar` (1 010 lignes, orphelin) reste l'écran de **configuration** ; la vue vit sur les lunettes.

## III.2 Le grand écran — la garde doctrinale

**Un seul pilote en piste** : c'est un poste de lecture. Tracé, tours, canaux, en très grand.

**Plusieurs** : la garde s'applique. **Afficher le chrono de chaque pilote est factuel ; les ordonner par chrono est un classement.** L'ordre se fait par numéro de voiture, jamais par temps — exactement `BOARD_MODE = 'A'`.

## III.3 La biométrie — ceinture Bluetooth

**Décision : ceinture cardio Bluetooth, en direct.**

Motif technique : sans application montre, la fréquence cardiaque transite Watch → HealthKit → iPhone avec **plusieurs dizaines de secondes de retard**. Inutilisable pour observer un pilote en piste.

**Profil Bluetooth standard** — service `0x180D`, caractéristique `0x2A37` — universel chez Polar, Garmin, Wahoo, Decathlon. **Bien plus simple que le protocole UBX du RaceBox.**

**Trois conséquences.**
1. `rec/appairage` gère **deux appareils**.
2. Le téléphone tient deux liaisons BLE pendant qu'il capture à 25 Hz — **autonomie à mesurer**.
3. Une colonne `source` sur les échantillons : ceinture quand elle est là, HealthKit sinon. Deux sources pour une même mesure divergeraient.

`useRosterBiometry` et `cardioZoneLogic` existent déjà.

**Article 9 du RGPD** : fréquence cardiaque transmise en direct à un tiers = donnée de santé. Consentement explicite, niveau détaillé.

## III.4 L'Apple Watch — côté pilote, mesure seule

**Aucune application montre OXV. Aucun affichage.**

**Chemin v1 retenu** : le pilote lance une session « Autre » dans l'application Exercice d'Apple avant son run. `healthKitService` relit après coup — ce que `rec/fin` fait déjà. **Zéro développement.**

**Motif technique** : sans session d'entraînement active, la Watch n'échantillonne la fréquence cardiaque que toutes les quelques minutes. Le pilier physiologique **Aplomb** ne peut exister sans elle. (Il vit HORS du radar : « Intensité » a été retirée des branches le 13/08/2026 — un axe qui monte quand on roule plus près de la limite transforme une restitution en incitation.)

**La consigne vit sur `rec/placement`**, avec l'avertissement de verrouillage. Deux gestes au même moment, juste avant d'armer.

**Si le pilote oublie**, le bilan le dit : « Aplomb absent : aucune session d'entraînement enregistrée ». C'est « pourquoi ce chiffre est absent », appliqué à une cause corrigible.

## III.5 Le live devient un objet à trois échelles

`en-direct` (707) + `en-direct/[sessionId]` (948) + `ar` (1 010) = **2 665 lignes**.

*Le plateau* — qui roule, leur dernier tour, leur zone cardiaque. Mode par défaut.
*Le focus* — un pilote, son tracé vivant, ses tours, ses canaux.
*Les lunettes* — configurées depuis `ar`.

**`startSimulatedStream` reste, visiblement marqué comme simulé.** Il confirme d'ailleurs que rien n'a jamais tourné en réel.

---

# IV. LA CARTE DE SÉANCE — ce que le pilote reçoit

**Le débrief est oral aujourd'hui, et il s'évapore.** Le pilote rentre chez lui avec un souvenir.

**Pas un rapport** — personne ne lit un rapport. **Une carte**, un seul objet, qu'il garde.

## IV.1 Quatre pièces

**La voix de son coach**, en premier objet de l'écran, avant tout texte. Trente secondes d'audio réel, pas une transcription. **C'est l'innovation centrale** : un texte est froid, une voix porte le ton, l'insistance, l'encouragement — et elle est infalsifiable.

*Production* : le coach l'enregistre après le débrief en une prise, **ou** l'extrait de ses notes vocales de la séance. Il choisit.

**Une chose à emporter**, dans les mots du coach, **attribuée**. Sous elle, une ligne qui n'est pas de la prudence juridique mais la doctrine rendue lisible :

> Ses mots, pas une consigne de l'application.

C'est le seul endroit du produit où une prescription apparaît, et elle est attribuée à un humain.

**Un moment ancré** — le marqueur résolu en mesure, **le segment concerné en rouge sur le tracé gris**. Le pilote voit *où*, pas seulement *quoi*.

**Le retour à la préparation suivante** — trois semaines plus tard : « votre coach avait marqué le virage 4 ». Ce n'est pas OXV qui prescrit, c'est le rappel de ce que son coach a dit.

## IV.2 La synthèse vocale

`coach_annotations` porte déjà `startRecording`, `stopRecording`, `attachAudioToAnnotation`. Les lunettes ont un micro, le téléphone aussi.

**Transcription plus structuration, validée par le coach avant tout envoi.** Sans cette garde, une transcription approximative devient une parole qu'il n'a pas tenue.

**L'intelligence artificielle ne coache pas : elle met en forme ce qu'un humain a dit.** `coach_ai_drafts`, `coach_ai_consent` et `AIReviewBanner` existent déjà.

---

# V. LES ÉCRANS, BLOC PAR BLOC

## V.1 Le hub — `/(coach)`

**1 239 lignes, quinze sorties.** Quinze destinations, c'est un menu, pas un poste de travail.

**Deux modes.**

*Jour J* — compteurs (en piste, à débriefer, vos pilotes) · les pilotes en piste avec leur dernier tour · **la file « à débriefer », liseré rouge sur la plus ancienne seulement** — une file où tout est urgent n'est plus une file · les pilotes du jour, plus l'accès à tous.

*Hors journée* — structuré : repères, gabarits, programmes, économie, profil.

**Temps réel sur tout l'espace**, comme l'admin terrain.

**Le hub liste les pilotes qui l'ont désigné pour aujourd'hui**, plus un accès à tous. C'est la différence entre un carnet d'adresses et un poste de travail.

**Déjà câblé** : `coachQueueService` — la file existe, `coach_queue` est en base et vide. `useCoachPermissions` — la seconde couche d'autorisation est en place.

**Un pilote sans tour bouclé affiche « — »**, jamais un zéro.

## V.2 Bloc lecture — de sept écrans à quatre

`file-lecture` 591 · `studio` 909 · `comparer` 551 · `rapport` 667 restent.
`debrief`, `triage`, `lecture` disparaissent.

**Le fil** — pendant et juste après. Écran par défaut.
**`studio`** — la télémétrie profonde, quand le fil ne suffit pas. Lu assis, le soir.
**`file-lecture`** — la file, déjà câblée sur `coach_queue`.
**`comparer`** — deux séances d'un même pilote.

**`rapport` change de nature** : il devient **l'écran où le coach compose la carte de séance** — choisit ou enregistre son audio, écrit sa phrase, retient un marqueur, envoie. Le PDF reste possible, généré côté serveur, mais il n'est plus le produit : il en est l'export.

## V.3 Bloc pilote — de six écrans à trois plus une feuille

**`pilote/[id]`** 1 090 — la fiche, point d'entrée unique. **Ses deux sorties V1 sont recâblées** : `/(app)/bilan` et `/(app)/virage`.

**`annoter`** 1 113 — marquer, dire, enregistrer. **Absorbe `priorites`** : marquer un virage et l'annoter sont le même geste, séparés par un accident d'architecture. Porte déjà l'enregistrement audio.

**`plan`** 694 — les objectifs et les cycles.

**`contexte`** 356 — reste un écran.

**`comparer-pilotes`** 802 — **conservé** : le coach analyse ses propres élèves.

*Réserve, corrigée sans coût.* Les deux pilotes n'ont consenti qu'à « mon coach voit mes données », pas « il les montre à côté de celles d'un autre ». **La phrase de consentement doit donc le dire** : « il voit vos séances, votre télémétrie, votre cardio et votre carnet, et peut les comparer à celles de ses autres pilotes. » Le pilote sait, la fonction reste.

## V.4 Bloc référentiels

**`reperes`** 900 + **`repere/[index]`** 642 — **la seule pièce solide du bloc.** Couche coach sur la géométrie canonique via `coach_corner_reference`. Cohérent : l'inspecteur pose la géométrie, le coach pose sa lecture par-dessus. **Rien à changer, sinon les brancher** — `reperes` est déjà multi-circuit, contrairement à l'inspecteur admin.

**`gabarits`** 899, orphelin — **conservés**, utiles pour l'écrit répétitif. *Réserve* : la note vocale les rend moins nécessaires, et rien n'y mène aujourd'hui.

**`cycles`** 869 + **`cycles/[id]`** 871 — **fusionnés en un écran de proposition.** Le pilote crée ses cycles, **le coach en propose** ; le pilote accepte ou refuse. Objet beaucoup plus simple et plus court.

## V.5 Bloc économie — de sept écrans à deux plus deux feuilles

`business` 642 · `demandes` 557 · `disponibilites` 902 · `calendrier` 832 · `facturation` 701 · `facture-nouvelle` 751 · `facturation-identite` 422.

**Deux objets** :

*L'offre* — mes disponibilités et les demandes qu'elles produisent.
*L'agenda* — ce qui en résulte.

**La facturation devient un écran plus deux feuilles.**

**Rien ne fonctionne aujourd'hui** : `coach_availability` fermée par un déclencheur, `app_payments` fermé, SIRET manquant. **Le correctif du déclencheur est préalable à tout test.**

## V.6 Bloc relation

**`messages`** 658 + **`messages/[coachPilotId]`** 641 — **deux écrans conservés.**

Ils survivent à la carte de séance par leur usage propre : **la logistique**. « Je serai au paddock à 9 h », « on décale à 14 h », une question entre deux journées. Ce que la carte ne porte pas.

**`profil`** 829 — le compte pro du coach. **Absorbe la pondération des axes de lecture**, venue de `lecture`.

**La fiche publique devient un écran séparé** — celle que les pilotes voient : vérification OXV, spécialités, circuits, **faits d'activité dérivés de `coaching_bookings`**.

`payment_link` en sort — **place de marché seule**. `coach_testimonials` est supprimée.

## V.7 Les roulages — une journée OXV

`roulages` 438 · `roulages/[id]` 672 · `roulages/nouveau` 538.

**Décision : un roulage de coach est une journée OXV.** Mêmes règles, même table `sessions`.

**Conséquence juridique à porter à l'avocat** : si le roulage d'un coach est une journée OXV, **OXV en porte les obligations d'organisateur** — article L321-1 sur l'assurance, et la protection R331-20 qui suppose l'absence de chronométrage et de classement. Le coach organise, OXV répond.

## V.8 L'assistant — 1 302 lignes, orphelin

Il importe `coachAiService`, `coachTriageLogic`, et appelle le RPC `coach_ai_consent`.

**Sa raison d'être était doctrinalement fragile** : un assistant qui analyse pour le coach reproduit exactement ce que fait Garmin Catalyst, et que vous refusez. De plus, `triage` disparaît et l'assistant en dépendait.

**Il devient le transcripteur des notes vocales.** Pas l'analyste. C'est un changement de nature, pas une conservation.

---

# VI. RÉCAPITULATIF

## Ce qui disparaît

| Écran | Lignes | Absorbé par |
|---|---|---|
| `debrief` | 524 | le fil |
| `triage` | 377 | le marqueur humain |
| `lecture` | 530 | le profil coach |
| `priorites` | 552 | `annoter` |
| `cycles/[id]` | 871 | l'écran de proposition |
| 2 des 4 écrans d'économie | ~1 400 | l'offre et l'agenda |
| 2 des 3 écrans de facturation | ~1 170 | un écran plus deux feuilles |

## Ce qui naît

**Le fil de séance** — l'écran central de l'espace.
**La fiche publique coach** — séparée du profil.
**L'écran de composition de la carte** — `rapport` transformé.

## Ce qui change de nature

`rapport` → composition de la carte de séance.
`assistant` → transcripteur.
`en-direct` + focus + `ar` → un objet à trois échelles.

**De 36 à environ 28 écrans de production.**

---

# VII. VÉRIFICATIONS — RÉSULTAT DU 26 JUILLET

## Ce qui est résolu

**Les quatre écrans « sans import » sont câblés.** `demandes`, `disponibilites` et `calendrier` lisent tous **`coachMarketplaceService`** (`:55`, `:58`, `:46`) ; `comparer-pilotes` lit `coachService` (`:55`). L'anomalie venait de l'extracteur, qui ne comptait pas `@/lib/queries/*` comme source de données. **Écrans fonctionnels.**

**Aucun écran coach n'est orphelin.** Les six candidats — `demandes`, `cycles`, `gabarits`, `assistant`, `lecture`, `ar` — sont reliés par une **grille de tuiles** déclarée dans `app/(coach)/index.tsx` (lignes 299 à 343), naviguée à `:514` : `router.push(tool.route as never)`. Le filtre de détection exigeait que la route commence la ligne.

**Le déclencheur `oxv_coach_availability_open_gate` est confirmé et pire que prévu.** Migration `20260718111150`, lignes 60-63 :

```sql
IF TG_OP = 'INSERT' AND NEW.status = 'open' THEN
  NEW.status := 'closed';
ELSIF TG_OP = 'UPDATE' AND NEW.status = 'open' AND OLD.status IS DISTINCT FROM 'open' THEN
  NEW.status := OLD.status;
END IF;
```

Un coach ne peut **jamais** ouvrir un créneau. À l'insertion, `open` est rabattu sur `closed` ; à la mise à jour, l'ouverture est annulée et le statut précédent restauré. **Aucun message n'est renvoyé** : la valeur est réécrite en silence, jamais rejetée. Le motif documenté est la validation OXV préalable.

**La règle biométrie « tout ou rien » existe dans le code.** `src/services/liveRelayRunner.ts:326` :

```js
const tousDetailles = coaches.length > 0 && coaches.every((c) => c.detailed);
```

Elle alimente `detailedBinome` (`:329`), consommé par `canEmitBiometry` (`:344`) en fail-closed.

**Sa raison est structurelle, pas prudentielle** : la biométrie voyage sur `live:session:<sessionId>`, canal partagé par tous les coachs consentis — on ne peut pas la réserver à certains au moment de l'émission. Le topic est refcompté dans `liveSessionService.ts`, `supabase-js` dédoublonnant les canaux par topic.

**Décision retenue : un canal par coach**, `live:bio:<coachId>:<sessionId>`. C'est la seule réponse propre, et elle n'est pas implémentée. Le code ne connaît d'ailleurs pas la notion de « coach du jour » : `coaches` est l'ensemble des coachs consentis à l'écoute. Tant que le canal est partagé, la règle reste la seule garantie **en droit**, même si l'usage n'amène qu'un auditeur.

## Ce qui reste à mesurer

| Objet | Pourquoi |
|---|---|
| **Autonomie avec deux liaisons BLE** plus capture 25 Hz | ceinture cardio et RaceBox simultanés |
| **Stabilité du SDK Meta Ray-Ban Display** | aperçu développeur, module natif Swift à écrire depuis React Native |
| `react-native-webview` sur `coach/ar` | **encapsule `https://app.oxvehicle.fr/ar-view`** — la vue AR est donc une page servie par le site, pas un écran natif |
