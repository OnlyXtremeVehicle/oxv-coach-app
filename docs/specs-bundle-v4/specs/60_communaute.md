# Bloc 60 — Communaute : cercle filtre (3 ecrans)

Reference : `01_doctrine_et_composants.md`.

**Assouplissement assume vs position de mai 2026** : les prefs `rank_change`/`new_record`/
`new_follower` avaient ete retirees comme contraires a la doctrine. Le feed et le partage en
reintroduisent une partie (suivre l'activite partagee d'un membre). C'est **voulu**, et reste
compatible **tant que** : partage opt-in, cercle reserve aux membres valides, **aucun
classement impose**.

**Regle ferme** : la comparaison entre pilotes est **opt-in et sans rang**. Faits cote a
cote uniquement. **Aucun leaderboard, aucun « meilleur ».** C'est la ligne rouge absolue.

---

## 60.1 — Feed (membres valides)

- **But** : prolonger l'experience entre les sessions, dans un cercle filtre.
- **Layout** :
  - `[Composant: AppBar]` titre « Communaute ».
  - Flux de cartes : templates de session partages par des membres (60.3), actualites OXV.
  - Chaque carte = un fait partage volontairement (pas un score, pas un rang).
  - `[Composant: ConsentGate]` au premier acces (rejoindre le feed est un choix).
- **Donnees** : feed reserve aux membres **valides** (RLS Supabase stricte). Un non-membre
  valide ne voit rien.
- **Doctrine** : pas de fil « classement de la semaine ». Pas de metrique de vanite imposee.
- **Etat vide** : « Le feed est calme pour l'instant. »

---

## 60.2 — Comparaison opt-in (faits cote a cote)

- **But** : permettre a deux pilotes **consentants** de comparer leurs faits.
- **Layout** :
  - `[Composant: ConsentGate]` : les **deux** parties doivent avoir partage. Sinon, indispo.
  - `[Composant: ComparisonPair]` repete : signature vs signature, regularite vs regularite,
    carte de chaleur vs carte de chaleur, secteur vs secteur.
  - **Strictement symetrique.** Aucun marquage « gagnant », aucune fleche de hierarchie,
    aucun delta presente comme un verdict.
- **Donnees** : sessions explicitement partagees par les deux pilotes (Supabase, consentement
  trace et revocable).
- **Doctrine** : **la ligne rouge du produit.** Faits cote a cote, point. Si quelqu'un demande
  « pourquoi pas un petit classement entre amis » — c'est non. La doctrine prime.
- **Etat vide** : « La comparaison demande que les deux pilotes aient partage une session. »

---

## 60.3 — Partage d'un template de session

- **But** : publier sur le feed une restitution mise en forme de sa session.
- **Layout** :
  - Apercu du template (les piliers presentes en nouvelle generation).
  - Choix de ce qui est partage (granularite). `[Composant: ConsentGate]` recapitulant ce qui
    sera visible et par qui.
  - `[Composant: PactBanner]` discret : rappel que partager est un choix, revocable.
  - Action : « Partager au cercle ». Revocation possible a tout moment.
- **Donnees** : cree un post lie a la session (Supabase), visible **membres valides** seulement.
- **Doctrine** : le partage est **opt-in** et **revocable**. Jamais de partage automatique,
  jamais public hors cercle.
- **Etat vide** : N/A (part d'une session existante).
