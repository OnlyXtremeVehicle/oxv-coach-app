# Bloc C0 — Coach (SaaS coachs agrees) (5 ecrans)

Reference : `01_doctrine_et_composants.md`.

## Cadre doctrinal et juridique — A LIRE AVANT DE CODER CE BLOC

**OXV ne coache pas et n'est pas agree.** Ce bloc n'introduit PAS du coaching par OXV. Il
ouvre un espace **SaaS pour des coachs independants agrees** (offre 750 EUR/saison), choisis
par le pilote.

La regle qui preserve le non-agrement d'OXV :

- Quand un coach ecrit un debrief ou enrichit la donnee technique, **c'est le coach qui
  parle, pas l'app.** Tout contenu produit par un coach est **visuellement attribue au coach**
  (nom, mention « Debrief de votre coach »), jamais presente comme une sortie OXV.
- La **pedagogie et la responsabilite** du conseil appartiennent au **coach agree**. OXV
  fournit le canal et la donnee factuelle.
- La doctrine miroir reste intacte **cote OXV** : l'app, par elle-meme, continue de ne rien
  prescrire. Ce qui change : un tiers identifie et choisi par le pilote ajoute sa lecture.
- Relation **opt-in et revocable** : le pilote invite son coach et peut retirer l'acces a
  tout moment. Sans invitation active, un coach ne voit **rien** du pilote.

Ce bloc a **deux faces** : cote **pilote** (C0.1) et cote **coach** (C0.2 a C0.5, accessibles
uniquement aux comptes coach).

---

## C0.1 — Mon coach (cote pilote)

- **But** : permettre au pilote d'inviter, voir et revoquer un coach, et de consulter les
  debriefs que **son coach** lui adresse.
- **Entree / sortie** : depuis Compte / Synthese → debrief coach d'une session.
- **Layout** :
  - `[Composant: AppBar]` titre « Mon coach ».
  - Si aucun coach : invitation (`[Composant: ConsentGate]` expliquant ce que le coach
    pourra voir — sessions, donnees — et la revocabilite). Action « Inviter un coach ».
  - Si coach lie : carte du coach (nom, mention agree), perimetre d'acces, bouton **Revoquer**.
  - Liste des **debriefs recus**, chacun clairement attribue au coach (renvoi C0.5 cote
    lecture).
- **Donnees** : relation pilote-coach (Supabase, consentement trace et revocable, RLS
  strictes). Debriefs lies aux sessions.
- **Doctrine** : le debrief affiche ici est **la parole du coach**, signe par lui. L'app ne
  le reformule pas, ne le complete pas d'un conseil maison. Le test de conformite (00_CLAUDE
  §1) s'applique au **chrome de l'app** autour, pas au contenu du coach (qui assume sa
  pedagogie).
- **Etat vide** : « Vous n'avez pas encore de coach. L'inviter est un choix, revocable a tout
  moment. »

---

## C0.2 — Espace coach : mes eleves *(comptes coach uniquement)*

- **But** : tableau de bord du coach — la liste des pilotes qui l'ont **autorise**.
- **Layout** :
  - `[Composant: AppBar]` titre « Mes eleves ».
  - Liste des pilotes ayant invite ce coach (nom/pseudo, dernier roulage, circuit). Tap →
    C0.3.
  - Indicateur d'abonnement SaaS (saison active). Pas d'acces si abonnement inactif.
- **Donnees** : pilotes lies au coach (Supabase, via invitations actives). Un pilote qui
  revoque disparait immediatement.
- **Doctrine** : le coach ne voit **que** ses eleves consentants. Aucune decouverte d'autres
  pilotes, aucun annuaire global. Pas de classement entre eleves.
- **Etat vide** : « Aucun eleve pour l'instant. Vos eleves apparaissent ici apres vous avoir
  invite. »

---

## C0.3 — Espace coach : fiche eleve & ses sessions *(coach)*

- **But** : donner au coach la donnee **factuelle** d'un eleve pour batir SON accompagnement.
- **Layout** :
  - En-tete eleve (nom, vehicule(s), circuits).
  - Acces aux restitutions de l'eleve : 4 piliers, tour de reference, secteurs, trace, detail
    data (reutilise les composants des blocs 20 et 30, en **lecture**).
  - Vue plus technique autorisee pour le coach (donnees brutes plus fines que pour le pilote
    lambda), car c'est un professionnel.
  - Actions : enrichir la donnee technique (C0.4), rediger un debrief (C0.5).
- **Donnees** : sessions de l'eleve (Supabase), perimetre defini par le consentement.
- **Doctrine** : l'app **montre** la donnee au coach. C'est le coach qui **interprete**. L'app
  ne pre-mache aucun diagnostic.
- **Etat vide** : « Cet eleve n'a pas encore de session exploitable. »

---

## C0.4 — Espace coach : enrichir la donnee technique *(coach)*

- **But** : permettre au coach d'**ajouter des donnees techniques** qui enrichiront le bilan
  de session de son pilote (le coach apporte son expertise et ses propres mesures/annotations).
- **Layout** :
  - Selection de la session de l'eleve.
  - Champs d'enrichissement technique : annotations sur des points du trace
    (`[Composant: TrackCanvas]` en mode annotation), donnees complementaires saisies par le
    coach, reperes techniques.
  - Apercu de la facon dont l'enrichissement apparaitra dans le bilan de l'eleve, **attribue
    au coach**.
  - Action « Publier l'enrichissement vers l'eleve ».
- **Donnees** : enregistre des donnees/annotations liees a la session, **marquees comme
  produites par le coach** (Supabase, auteur = coach).
- **Doctrine** : l'enrichissement est la **contribution du coach**, signee. Il s'ajoute au
  bilan sans transformer l'app en prescripteur : c'est l'expertise d'un tiers agree, pas une
  sortie OXV. Tout reste attribue.
- **Etat vide** : « Selectionnez une session a enrichir. »

---

## C0.5 — Debrief coach (redaction cote coach / lecture cote pilote) *(coach + pilote)*

- **But** : le canal de restitution coach→eleve. Le coach redige ; le pilote lit.
- **Layout (cote coach, redaction)** :
  - Editeur de debrief lie a une session de l'eleve. Le coach ecrit **ses** observations et
    **ses** conseils (c'est SON role, il l'assume).
  - Peut referencer les faits de la session (piliers, secteurs) et ses enrichissements (C0.4).
  - Action « Envoyer a l'eleve ».
- **Layout (cote pilote, lecture)** :
  - Le debrief s'affiche dans « Mon coach » (C0.1) et en regard de la session (40.2),
    **clairement signe par le coach** : en-tete « Debrief de [nom du coach] », style distinct
    du chrome OXV.
- **Donnees** : debriefs lies a session + coach + eleve (Supabase).
- **Doctrine** : **point juridique central.** Le contenu du debrief est la **parole du coach
  agree**, attribuee a lui, sous sa responsabilite. L'app le **transporte et l'affiche**, elle
  ne le genere pas et ne s'en approprie pas le conseil. Ne jamais fondre un debrief coach dans
  une « sortie de l'app » anonyme. La separation visuelle auteur-coach / chrome-OXV est
  obligatoire.
- **Etat vide** : cote pilote, « Aucun debrief de votre coach pour cette session. »
