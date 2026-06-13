# Bloc 10 — Onboarding (3 ecrans)

Reference : `01_doctrine_et_composants.md`. Vouvoiement, pas d'emojis, charte stricte.

---

## 10.1 — Splash / Bouclier

- **But** : premier contact. Etablir la marque en silence.
- **Entree / sortie** : ouverture de l'app → Pacte (premiere fois) ou Synthese (utilisateur connu).
- **Layout** :
  - Fond `noir` plein ecran.
  - Insigne bouclier-casque OXV centre (rouge sur fond sombre), animation breve de formation.
  - Aucun texte marketing. Sobriete totale.
- **Donnees** : aucune.
- **Doctrine** : ne nomme jamais le faucon. L'insigne parle seul.
- **Etat vide** : N/A.

---

## 10.2 — Pacte de pilotage (signature)

- **But** : faire signer le pacte qui reconcilie doctrine et usage, et recueille le
  consentement. **C'est aussi la piece juridique** (responsabilite pedagogique declinee).
- **Entree / sortie** : depuis Splash a la premiere ouverture → Appairage RaceBox.
- **Layout** :
  - `[Composant: PactBanner]` en tete.
  - Corps : texte du pacte (fourni par l'avocat — ne pas inventer le contenu juridique ;
    poser un placeholder clairement balise `<<TEXTE_PACTE_AVOCAT>>` tant qu'il n'est pas livre).
  - Points cles en `[Composant: FactRow]` : « L'app montre, ne dirige pas » / « Vous
    interpretez et decidez seul » / « Vos donnees vous appartiennent ».
  - Action : case de consentement explicite + bouton « Je signe ». Bouton inactif tant que
    non coche.
- **Donnees** : enregistre l'acceptation (date, version du pacte) cote Supabase.
- **Doctrine** : le pacte EST le socle doctrinal. Ne le minimise pas, ne le saute pas.
- **Etat vide** : si le texte avocat manque, afficher le placeholder + signaler que la
  signature est non bloquante en dev mais **obligatoire avant publication**.

---

## 10.3 — Appairage RaceBox (BLE)

- **But** : connecter le capteur RaceBox Mini.
- **Entree / sortie** : depuis le Pacte → Synthese / accueil.
- **Layout** :
  - `[Composant: AppBar]` titre « Appairage ».
  - Etat de connexion en `[Composant: MetricHero]` (ex. « Capteur detecte » / « En recherche »).
  - Liste des capteurs detectes en `[Composant: FactRow]` (nom, intensite signal).
  - Action : « Connecter ». Aide repli si rien detecte (verifier capteur allume, Bluetooth ON).
- **Donnees** : service BLE V1 (GARDER). 25 Hz, GPS+IMU.
- **Doctrine** : neutre, purement technique.
- **Etat vide** : « Aucun capteur detecte. » + checklist factuelle. Permettre de continuer
  sans capteur (mode consultation historique).
