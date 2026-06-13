# Bloc E0 — Vue AR coach (lunettes) (2 ecrans)

Reference : `01_doctrine_et_composants.md`. Voir aussi le cadre coach dans `C0_coach.md`.

## Cadre doctrinal — A LIRE AVANT DE CODER CE BLOC

C'est le **coach** qui porte les lunettes AR au bord de piste, **jamais le pilote.**

- Le **pilote roule en silence** : aucun affichage AR, aucun signal en conduite. La doctrine
  « silence en piste » reste **totalement intacte**. L'AR ne touche pas le pilote.
- Le **coach**, au bord de piste, voit en live les points importants de **son** pilote sur
  l'ecran des lunettes. C'est un outil professionnel pour le coach agree.
- Cohérent avec le bloc Coach : le coach **interprete** la donnee (sa responsabilite). L'app
  lui **montre** des faits. OXV ne prescrit toujours rien.
- Acces strictement reserve aux **comptes coach**, et uniquement pour les **eleves qui l'ont
  invite** (meme consentement que C0). Aucun acces AR sans lien coach-pilote actif.

## Cadre technique et reserves — verifie en juin 2026

Etat reel de la plateforme Meta a ce jour, a garder en tete :

- Meta a ouvert les **Ray-Ban Display** aux developpeurs tiers (mai 2026) via le **Wearables
  Device Access Toolkit**, avec **deux voies : SDK natif (iOS/Android) ET technologies web
  standard** (URL hebergees, sans app store dedie). L'affichage in-lens accepte texte,
  images, boutons, video.
- **Approche retenue : Web View / PWA.** Coherent avec notre stack Expo, agile, on garde la
  main sur le code sans repasser par les stores. (Le SDK natif imposerait un dev iOS + Android
  separe, hors de notre architecture.)
- **RESERVES FERMES a inscrire dans la roadmap :**
  1. Le toolkit est en **developer preview**. La publication grand public est **limitee a des
     partenaires selectionnes** ; disponibilite generale visee courant 2026. → **Prototypable
     des maintenant, NON publiable au public tant que Meta n'a pas ouvert la GA.**
  2. Materiel **specifique** : seulement les **Ray-Ban Display** (modele avec ecran), pas les
     Ray-Ban Meta classiques. Le coach doit posseder ce modele.
  3. **Latence** d'affichage vers les lunettes a **valider en conditions reelles** avant de
     promettre un usage « live bord de piste ». Ne pas survendre le temps reel avant test.

## Architecture (Web View)

```
RaceBox (pilote) --25Hz--> App mobile (Expo) --push--> Supabase (telemetry_frames)
                                                              |
                                          calcul des indicateurs (cote Supabase)
                                                              |
App/compte COACH  <-- WebSocket / temps reel -->  page web `ar-view` (HTML/CSS/JS)
                                                              |
                                              poussee vers les lunettes Ray-Ban Display
```

- Une **route web dediee** (ex. `app.oxvehicle.fr/ar-view`) concue **specifiquement pour
  l'ecran des lunettes** : tres peu d'elements, gros contrastes, lisible d'un coup d'oeil.
- L'app/compte coach gere la logique (selection de l'eleve, abonnement WebSocket) ; la page
  `ar-view` s'abonne au flux temps reel et se met a jour.
- On garde la main sur l'UI des lunettes sans soumettre de nouvelle version aux stores.

---

## E0.1 — Configuration de la vue AR (cote app coach)

- **But** : permettre au coach de preparer ce qu'il verra dans ses lunettes pour une session
  d'un eleve donne.
- **Entree / sortie** : depuis l'espace coach (C0.2/C0.3) → lancement de la vue live.
- **Layout** :
  - Selection de l'eleve (parmi ceux qui ont invite le coach) et de la session en cours.
  - Choix des **faits a afficher en live** (peu nombreux : ex. chrono du tour courant, delta
    vs reference perso de l'eleve, un repere de regularite). Liste courte, le coach choisit
    l'essentiel **pour lui**.
  - Etat de connexion des lunettes (appairage Ray-Ban Display) + etat du flux capteur.
  - Action « Lancer la vue AR ».
- **Donnees** : config de vue par coach/eleve (Supabase) ; etat lunettes ; flux telemetrie.
- **Doctrine** : ce sont des **faits** poussés au coach. Pas de message du type « dites-lui
  de freiner plus tard ». Le coach lit le fait et decide de sa pedagogie.
- **Etat vide** : « Selectionnez un eleve et connectez vos lunettes pour preparer la vue. »

---

## E0.2 — Vue live in-lens (page `ar-view`)

- **But** : l'affichage minimal, dans les lunettes du coach, des points importants de son
  pilote en temps reel.
- **Layout (concu pour l'ecran des lunettes, pas le telephone)** :
  - **Tres epure** : 1 a 3 faits maximum a l'ecran. Gros, contrastes, lisibles en plein
    soleil et en un coup d'oeil.
  - Ex. : chrono du tour courant en grand ; delta vs reference perso de l'eleve ; un repere
    factuel (secteur courant). Pas de graphe dense, pas de texte long.
  - Mise a jour temps reel via WebSocket. Degradation propre si le flux se coupe (afficher
    « signal perdu » sobre, pas d'ecran fige trompeur).
- **Donnees** : flux temps reel depuis Supabase / WebSocket, indicateurs calcules cote serveur.
- **Doctrine** : **faits uniquement**, cote coach. Aucune consigne affichee. C'est le coach,
  derriere ses lunettes, qui transforme le fait en conseil **a sa charge**. L'app ne formule
  jamais l'instruction.
- **Etat vide** : « En attente de donnees de la session. » / « Signal perdu. » (sobre, jamais
  une fausse valeur).

---

## Note pour Claude Code

- La page `ar-view` est servie cote **web** (repo site ou route dediee), pas embarquee dans
  le bundle Expo : c'est ce qui permet de la mettre a jour sans repasser par les stores.
- **Ne pas promettre** la dispo publique de l'AR tant que Meta n'a pas ouvert la GA : marquer
  la fonctionnalite comme **preview/prototype** dans l'app (drapeau de fonctionnalite), visible
  uniquement aux comptes coach habilites.
- **Confidentialite** : la donnee d'un eleve poussee vers les lunettes d'un coach circule sous
  le consentement de C0. Pas de partage hors de la relation coach-eleve. Respecter les RLS.
- **Securite** : c'est un outil pour le coach **a l'arret / au bord de piste**. Ne jamais
  concevoir cette vue pour etre portee par le pilote en conduite.
