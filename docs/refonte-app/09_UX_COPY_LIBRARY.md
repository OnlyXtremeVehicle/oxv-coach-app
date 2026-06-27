# Bibliothèque de textes (UX copy)

> **Loi rédactionnelle.** Toute chaîne visible côté pilote passe par les règles ci-dessous.
> Débloque : chaque PR (boutons, états vides, erreurs, coach, bilan, consentement, partenaires).
> Réf. doctrine : `CLAUDE.md`, `00_PLATEFORME_OXV.md §5`, `04_DESIGN_CANON.md §7`.
> Réf. organisation : `01_ORGANISATION_PRODUIT.md`. Périmètre V1/V1.5 : `03_MVP_SCOPE.md`.

Ce document est une **réserve de phrases prêtes à coller**, pas un guide théorique. Quand une vue a besoin d'un libellé, on le prend ici ou on l'ajoute ici. Les chaînes citées « déjà en code » existent vraiment (ex. `src/components/BleErrorModal.tsx`) et servent de mètre-étalon.

---

## 1. Règles non négociables (rappel court)

| Règle | Application |
|---|---|
| **Vouvoiement** systématique | « Vous pouvez… », jamais « Tu peux… ». Clientèle premium. |
| **Aucun emoji** | Nulle part. Ni dans les boutons, ni dans les notifications. |
| **Aucun verbe prescriptif côté pilote** | Interdits : *freinez, accélérez, corrigez, vous devez, il faut, évitez, erreur, mauvais, faute, raté*. |
| **Le miroir, pas le coach** | L'app décrit, situe, interroge. Elle ne conclut pas à la place du pilote. |
| **Un seul chiffre dominant** | Le texte n'introduit jamais un second indicateur en concurrence. |
| **Or = donnée, rouge = coach/REC** | Aucune phrase ne « colore » un jugement (pas de rouge « performance »). |
| **Silence en piste** | Pendant le roulage : zéro texte, zéro notif, zéro son (cf. §6 et §10). |

**Frontière prescriptive unique.** Le **seul** endroit où une phrase peut orienter est la **bande coach** (rouge, eyebrow « DE VOTRE COACH »). Et même là, la doctrine privilégie la **question ouverte** au verbe d'ordre (cf. §8).

**Verbes / tournures autorisés côté pilote** : « à observer », « à explorer », « à conserver », « était-ce volontaire ? », « que sentez-vous ? », « confortable », « terrain serré », « apprivoisé », « une chose, pas plus ».

---

## 2. Boutons

### 2.1 Bouton primaire (fond crème `#F8F9FA`, texte `#050505`)

Action unique et claire d'un écran. Verbe d'action neutre à l'infinitif ou impératif **non pilotage**. Casse normale (pas d'UPPERCASE — le primaire n'est pas en mono).

| Contexte | À éviter | À privilégier |
|---|---|---|
| Paddock avant session | « C'est parti ! » | « Préparer ma session » |
| Arrivée circuit | « Scanner » | « Connecter l'équipement » |
| Bilan prêt | « Voir le résultat » | « Découvrir mon bilan » |
| Note coach reçue | « Ouvrir » | « Lire la note » |
| Hors événement | « Stats » | « Voir ma progression » |
| Consentement coach | « Valider » | « Autoriser mon coach » |

> Le libellé du primaire **reprend la question de la zone** (cf. `01_ORGANISATION_PRODUIT.md`) : Paddock = « maintenant », donc l'action colle au moment.

### 2.2 Bouton ghost (bordure `#1C1C20`, texte Mono UPPERCASE `#6E6E76`)

Action secondaire, en retrait. Court, sobre, sans engagement émotionnel.

| À éviter | À privilégier |
|---|---|
| « ANNULER TOUT » | « PLUS TARD » |
| « PASSER » (ambigu) | « IGNORER » / « CONTINUER SANS » |
| « RETOUR ⟵ » (emoji/flèche déco) | « RETOUR » |

Exemple déjà en code : modal BLE, ghost = **« Continuer sans »** (`BleErrorModal.tsx`).

### 2.3 Règles transverses boutons

- Un **seul** primaire par écran (le « un seul chiffre / une seule action » s'applique aussi aux CTA).
- Jamais de double négation, jamais de point d'exclamation marketing.
- Le verbe décrit **ce que fait le pilote**, jamais ce que l'app lui ordonne sur la piste.

---

## 3. États vides (par zone)

Principe : un vide n'est pas une erreur. Il **annonce calmement** ce qui apparaîtra, et **quand**. Jamais culpabilisant. Modèle existant : `EmptyState` (`src/components/instruments/EmptyState.tsx`) — `label` (eyebrow) + `message`.

| Zone / vue | `label` (eyebrow) | `message` |
|---|---|---|
| **Paddock** — aucun événement | EN ATTENTE | « Aucune sortie programmée pour le moment. Votre dernier bilan reste consultable. » |
| **Bilan** — aucune session encore | EN ATTENTE | « Votre premier bilan apparaîtra après votre première session sur la piste. » |
| **Data Lab — Carte** | EN ATTENTE | « Le tracé de votre tour apparaîtra après votre premier roulage. » |
| **Data Lab — Heatmap (G-G)** | EN ATTENTE | « La carte G-G apparaîtra après votre premier roulage. » *(déjà cité en code)* |
| **Data Lab — Tours** | EN ATTENTE | « Les tours détectés s'afficheront ici une fois la session enregistrée. » |
| **Progression** — un seul point | PREMIÈRE LECTURE | « Une seule session pour l'instant. Votre évolution se dessinera au fil des sorties. » |
| **Progression — comparateur** | PAS ENCORE | « Le comparateur s'ouvre dès votre deuxième session sur ce circuit. » |
| **Club — mon coach** (aucun) | SANS COACH | « Aucun coach affilié pour le moment. Vous pouvez en découvrir un dans le Club. » |
| **Club — partenaires** (aucun) | AUTOUR DE VOUS | « Les partenaires liés à votre prochain événement apparaîtront ici. » |
| **Club — communauté** | DISCRET | « Aucune comparaison partagée. Rien ne se partage sans votre accord. » |
| **Notifications** | RIEN À SIGNALER | « Aucune notification. Tout est calme. » |

Interdits dans un état vide : « Vous n'avez rien fait », « Commencez par… », tout impératif de pilotage, tout ton de reproche.

---

## 4. Erreurs

**Grammaire imposée** (cf. `01_ORGANISATION_PRODUIT.md §Session`). Chaque erreur répond, dans cet ordre, à trois questions :

1. **Que s'est-il passé ?** — fait, sans dramatiser, sans le mot « erreur ».
2. **Qu'est-ce qui est préservé ?** — rassurer sur les données déjà acquises.
3. **Que puis-je faire maintenant ?** — une ou deux actions claires (primaire + ghost).

Modèle de référence en code : `BleErrorModal.tsx` (eyebrow « ÉQUIPEMENT », titre « Connexion à l'équipement perdue. », corps « Vos données déjà enregistrées sont sauvegardées… »). **Note doctrine** : ce modal n'apparaît **jamais** pendant `S6_roulage` (silence en piste garanti, cf. `useAppStateStore`).

### 4.1 Connexion à l'équipement perdue (BLE)

> À éviter : « Erreur de connexion BLE » / « Bluetooth error ».

| Élément | Texte |
|---|---|
| Eyebrow | ÉQUIPEMENT |
| Titre | « Connexion à l'équipement perdue. » |
| Préservé | « Vos données déjà enregistrées sont sauvegardées. » |
| Action | Primaire **« Reconnecter »** · ghost **« Continuer sans »** |

### 4.2 Hors ligne (offline)

> À éviter : « Pas de réseau ! » / « Erreur serveur ».

| Élément | Texte |
|---|---|
| Bandeau | « Hors ligne. Vos données sont enregistrées sur l'appareil. » |
| Préservé | « Tout ce que vous consultez ici fonctionne sans réseau. La synchronisation reprendra seule. » |
| Action (si bloquant) | ghost **« Réessayer »** |

Sur une action différée (ex. acceptation CGU/pacte hors ligne, déjà en code) : « Votre engagement sera rejoué dès que votre connexion sera de retour. » (cf. `app/(onboarding)/pacte.tsx`).

### 4.3 Session sans tours détectés

> À éviter : « Aucun tour valide / session invalide ».

| Élément | Texte |
|---|---|
| Eyebrow | SESSION |
| Titre | « Aucun tour complet n'a été détecté. » |
| Préservé | « La trace brute de votre session est conservée. » |
| Pourquoi (neutre, sans reproche) | « Cela arrive sur une session courte ou un passage partiel. » |
| Action | ghost **« Revoir la trace »** |

### 4.4 Analyse en cours

> À éviter : « Chargement… » sec / « Patientez ».

| Élément | Texte |
|---|---|
| Eyebrow | ANALYSE |
| Titre | « Lecture de votre session en cours. » |
| Préservé | (implicite — rien n'est perdu) « Vos données sont déjà enregistrées. » |
| Action | aucune (état transitoire) ; si long : « Vous pouvez quitter, le bilan vous attendra. » |

### 4.5 GPS bruité / qualité data réduite

> À éviter : « Mauvais signal GPS » / « Données erronées ».

| Élément | Texte |
|---|---|
| Eyebrow | QUALITÉ |
| Titre | « Le signal de cette session était irrégulier. » |
| Préservé | « Votre bilan reste lisible ; certains détails fins sont approchés. » |
| Action | aucune obligatoire ; bandeau de transparence (cf. `DataQualityBanner`, `ProvenanceLine` déjà en code). |

> Côté pilote, on n'emploie jamais « erreur GPS ». On dit « irrégulier », « approché », « moins précis ». La transparence sur la méthode reste neutre (cf. §9 et composants `InsightTransparency`).

---

## 5. Notifications

Règles : **jamais pendant le roulage** (cf. §10 et `14_NOTIFICATIONS.md`), vouvoiement, pas d'emoji, pas d'urgence artificielle, une notif = une intention. Cadence : avant / après / J+1 / jamais en piste.

| Moment | À éviter | À privilégier |
|---|---|---|
| Veille d'événement | « Demain ça roule ! » | « Votre sortie est demain. Pensez à charger votre équipement. » |
| Arrivée au circuit | « Connecte-toi vite » | « Vous êtes au circuit. Votre équipement est prêt à être jumelé. » |
| Bilan disponible (après roulage) | « Tes résultats sont là ! » | « Votre bilan est prêt. » |
| Note du coach | « Ton coach t'a écrit » | « Votre coach a laissé une note sur votre session. » |
| Débrief J+1 | « N'oublie pas de réviser » | « Un recul à J+1 sur votre dernière session vous attend. » |
| Consentement reçu (côté coach) | — | « Un pilote vous a donné accès à ses sessions. » |

Jamais de notification de classement, de comparaison non consentie, ni de relance culpabilisante (« Vous n'avez pas roulé depuis… »).

---

## 6. Phrases coach — bande

La **bande coach** (rouge `#C8102E`, eyebrow « DE VOTRE COACH », citation Instrument Serif) est le **seul** espace prescriptif de l'app. Composant : `CoachBand` (`src/components/instruments`). Même ici, la doctrine OXV privilégie l'**ouverture** à l'ordre.

### 6.1 Questions ouvertes (à privilégier)

- « Sur le virage 4, était-ce un choix ou une hésitation ? »
- « Qu'avez-vous ressenti à l'entrée de la longue courbe ? »
- « Cette sortie vous a-t-elle paru plus confortable que la précédente ? »
- « Où vous êtes-vous senti le plus en confiance aujourd'hui ? »

### 6.2 Observations situées (acceptables)

- « Une zone à explorer ensemble la prochaine fois : l'entrée du virage 6. »
- « J'ai noté un endroit qui mérite qu'on s'y arrête. »

### 6.3 À éviter même côté coach

| À éviter | Pourquoi |
|---|---|
| « Vous freinez trop tard au 4. » | Verbe prescriptif + jugement. |
| « C'est une erreur de trajectoire. » | « erreur » interdit. |
| « Il faut serrer la corde. » | Ordre direct. |

> Reformulation : « Au 4, le point de freinage semble varier d'un tour à l'autre — était-ce volontaire ? »

---

## 7. Phrases bilan (miroir, qualitatives)

Le Bilan **montre**. Une phrase manifeste (Instrument Serif, le mot qualitatif en italique) + deux constats factuels. Voir `app/(app)/bilan.tsx` (le « fait saillant », pas un verdict).

### 7.1 Phrase manifeste (miroir)

| À éviter | À privilégier |
|---|---|
| « Bonne session, continuez ! » | « Une séance plutôt *confortable*. » |
| « Vous avez progressé de 4 %. » | « Votre meilleur tour situe cette séance dans votre fil. » |
| « Trajectoire à améliorer. » | « Un *terrain serré* sur la seconde partie du tour. » |

### 7.2 Les deux constats (puce or = à observer · puce vert = à conserver)

- À observer : « L'entrée du virage 6 — une zone à explorer la prochaine fois. »
- À conserver : « Votre régularité dans la longue courbe — apprivoisée. »

Interdit : « point faible », « point fort », « à corriger », tout classement implicite. On dit **à observer** / **à conserver**.

### 7.3 Débrief J+1

- « À tête reposée : qu'est-ce qui vous reste de cette séance ? »
- « Une chose, pas plus, à emporter pour la prochaine fois. »

---

## 8. Phrases data (neutres)

Pour les couches Data Lab (carte, tours, virages, heatmap, télémétrie). Ton **factuel, descriptif, jamais évaluatif**. Les chiffres sont en Geist Mono ; le texte ne juge pas la valeur.

| Type | À éviter | À privilégier |
|---|---|---|
| Meilleur tour | « Super temps ! » | « Meilleur tour » (label) + valeur Mono |
| Écart entre tours | « Trop irrégulier » | « Amplitude des tours » |
| Vitesse en virage | « Trop lent au 3 » | « Vitesse mini au virage 3 » |
| Delta vs séance précédente | « +1,2 s, moins bien » | « − 1,2 s » (signe non coloré, jamais « moins bien ») |
| Constance | « Régularité faible » | « Indice de constance » |

> Le delta de temps utilise le signe U+2212 « − », **jamais coloré en rouge** (cf. `formatDeltaSeconds` dans `bilan.tsx`). Un chiffre n'est ni bon ni mauvais : il est.

Transparence (composants `InsightTransparency` déjà en code) :
- Provenance : « Calculé à partir de 312 points GPS et de l'IMU. »
- Qualité réduite : « Données partielles sur ce segment — valeur approchée. »
- Angle mort : « Ce segment manque de données pour être lu finement. »

---

## 9. Phrases consentement (RGPD)

Cadre : `pilotConsentService.ts` (le consentement coaching est **libre, révocable à tout moment, sans justification**). Réf. future : `07_DATA_POLICY.md`, `17_JURIDIQUE_COACH_DATA.md`. Ton : clair, non culpabilisant, jamais de pression.

| Contexte | À éviter | À privilégier |
|---|---|---|
| Donner accès au coach | « Acceptez pour profiter du coaching » | « Vous autorisez ce coach à lire vos sessions. Vous pouvez retirer cet accès à tout moment. » |
| Confirmation accordé | « Merci ! » | « Accès accordé. Votre coach voit désormais vos sessions. » |
| Retrait | « Êtes-vous sûr ?! Vous perdrez… » | « Retirer l'accès ? Votre coach cessera immédiatement de voir vos données. » |
| Confirmation retrait | — | « Accès retiré. » |
| Partage public (carte/marge) | « Partagez vos exploits » | « Vous générez un lien qui montre votre marge globale et votre progression. Pas de détails par virage, pas de position GPS. » |
| Conservation données brutes | « On garde tout » | « Vos données brutes sont conservées 90 jours, puis supprimées — sauf si vous demandez à les garder. » |

Principe : **rien ne se partage par défaut**. Toute comparaison communautaire est opt-in explicite (cf. §3 Club — communauté).

---

## 10. Silence en piste — la copie est vide

Pendant `S6_roulage` : **aucune chaîne fonctionnelle**. L'écran « en piste » (cf. `04_DESIGN_CANON.md §6`) ne porte que trois fragments éditoriaux, non actionnables :

- Eyebrow Mono : « EN PISTE »
- Instrument Serif : « L'app s'efface. »
- Faint : « Aucun écran. Aucun son. Conduisez. »

Pas de bouton, pas de chiffre, pas de notification, pas de bandeau d'erreur (le BLE échoue en silence et se reconnecte seul). Toute autre copie est **interdite** dans cet état.

---

## 11. Phrases partenaires

Espace Club (annuaire V1 ; offres/leads V1.5, cf. `03_MVP_SCOPE.md`). Ton : **sobre, premium, jamais publicitaire racoleur**. On présente, on ne harangue pas. Pas de prix clignotant, pas d'urgence (« Dernières places ! »).

| Contexte | À éviter | À privilégier |
|---|---|---|
| Entrée annuaire | « Nos super partenaires ! » | « Les partenaires autour de votre prochain événement. » |
| Fiche partenaire | « Offre incroyable à ne pas rater » | « Une offre proposée autour de l'événement. » |
| Lead / mise en relation (V1.5) | « Réservez vite ! » | « Demander à être recontacté. » |
| Pass OXV (V1.5) | « Votre billet magique » | « Votre Pass pour l'événement. » |
| Absence d'offre | « Rien pour vous » | « Aucune offre pour le moment autour de votre prochain événement. » |

Doctrine : un partenaire est un **service autour de la piste**, présenté avec la même retenue que le reste de l'app. L'or reste réservé à la donnée : un prix ou un badge partenaire **n'est pas** en or.

---

## 12. Check-list de relecture (avant merge d'une PR à copy)

- [ ] Vouvoiement partout, zéro tutoiement.
- [ ] Zéro emoji.
- [ ] Côté pilote : aucun verbe prescriptif ni « erreur / mauvais / faute ».
- [ ] Chaque message d'erreur répond à : passé → préservé → action.
- [ ] Aucune phrase n'introduit un second chiffre dominant.
- [ ] Aucune copie n'apparaît pendant `S6_roulage`.
- [ ] Or = donnée, rouge = coach/REC ; aucun jugement coloré.
- [ ] Consentement : libre, révocable, sans pression ; rien partagé par défaut.
- [ ] Partenaires : sobre, sans urgence ni superlatif.
