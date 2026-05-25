# OXV Coach — FAQ alpha

> Questions remontées en pré-alpha + questions anticipées. Ce document évoluera au fil des retours pilotes.

---

## Sur la doctrine

### Pourquoi l'app ne me dit pas comment m'améliorer ?

C'est volontaire. La doctrine OXV repose sur l'idée que **vous savez mieux que nous** ce qui s'est passé dans votre voiture. L'app vous donne les chiffres, vous donnez le sens.

Une app qui dit « freinez 10 m plus tard » suppose qu'elle a un modèle parfait de votre voiture, vos pneus du jour, votre fatigue, votre stratégie de session. Nous n'avons pas ce modèle. Personne ne l'a vraiment. Plutôt que de bluffer, on choisit de se taire.

### Pourquoi un seul chiffre central ?

Quand on multiplie les chiffres, on rajoute du bruit. Le pilote rentre en piste avec une question simple — *« étais-je à l'aise ou non ? »* — et on lui donne une réponse simple. Le reste (vitesses, G_lat, écarts) est là pour qui veut creuser, mais ne s'impose pas.

### Pourquoi pas de classement entre pilotes ?

Parce qu'un track day OXV n'est pas une compétition. Il y a déjà 200 courses ailleurs pour cela. Ici, vous explorez vos propres limites, à votre rythme, sans regarder ce que fait le voisin.

### Pourquoi l'écran s'éteint pendant la session ?

Parce que la piste demande votre attention complète. Un écran qui clignote, une vibration, une instruction visuelle — tout cela vous sort de la conduite. La sécurité prime sur l'information.

L'app enregistre. Vous conduisez. C'est tout.

---

## Sur l'app

### Combien d'espace l'app prend-elle ?

À l'installation : ~80 Mo. Avec 10 sessions enregistrées : ~150 Mo. Une session prend ~5-10 Mo de données brutes localement (effacées automatiquement après 30 jours, conservées sur les serveurs).

### L'app fonctionne-t-elle hors-ligne ?

Oui. La session s'enregistre localement. Le calcul de la marge se fait sur le téléphone. Quand vous récupérez du réseau, les données se synchronisent automatiquement. Vous pouvez vivre une journée track day complète sans réseau, vos données seront uploadées le soir chez vous.

### Quelle batterie consomme la session ?

Sur une session de 20 minutes : ~5-8 % de batterie iPhone récent, ~10-12 % Android. Le Bluetooth + GPS sont actifs en continu pendant le roulage. Le RaceBox a sa propre batterie autonome.

### Puis-je voir mes sessions précédentes ?

Oui. Sur le hub : « **Mes sessions** » → liste chronologique. Tap une session pour réouvrir le bilan, la carte, le zoom virages. Tout est consultable indéfiniment.

### Puis-je comparer 2 sessions ?

Oui. Sur le hub : « **Comparateur** » → choisissez 2 sessions. Vous verrez les deltas de marge globale, par virage, et par phase (entrée/apex/sortie). Pas de notion de "meilleure" — juste des différences à interpréter.

### Puis-je partager une vue avec un proche ?

Oui (V1.1 dans Settings). Vous générerez un lien unique qui montre **uniquement** votre marge globale et votre progression — pas les détails par virage, pas les GPS. Le destinataire n'a pas besoin de l'app.

---

## Sur le matériel

### Quel RaceBox compatible ?

Uniquement le **RaceBox Mini S** (modèle 2024+). Les versions plus anciennes (Mini, Pro) ne sont pas supportées en V1.

### Que faire si mon RaceBox ne s'allume pas ?

1. Charger 30 min sur USB-C
2. Si le bouton reste éteint après charge → le boîtier est probablement HS, contactez `support@racebox.pro`
3. Pour la session du 5 juillet : nous aurons des **boîtiers de prêt** sur place

### Et si je n'ai pas de RaceBox du tout ?

Pour l'alpha, OXV vous en prête un sur place. Demandez à l'inscription.

### Faut-il un Flic 2 ?

Non, pas obligatoire en V1. C'est un bouton physique optionnel pour marquer un tour particulier à la volée pendant la session. V1 fonctionne complètement sans.

### Quel téléphone faut-il ?

- **iPhone iOS 16 minimum** (testé jusqu'à iOS 17)
- **Android 11 minimum** (testé jusqu'à Android 14)

Les versions plus anciennes ne sont pas supportées (le Bluetooth Low Energy s'y comporte mal).

---

## Sur la session

### Quand l'app détecte-t-elle que j'arrive au circuit ?

Quand vous êtes à moins de **200 m du centre du circuit Beltoise** (45.6012, -0.1410). Activez la géolocalisation au lancement de l'app pour que ça marche.

### Quand l'app détecte-t-elle que j'ai fini ?

Quand **toutes les conditions** sont réunies :
- Vitesse < 10 km/h pendant > 90 secondes
- Position revenue au paddock (zone connue de l'app)
- Bluetooth déconnecté du RaceBox

Si l'app rate la détection (peu probable), vous pouvez la forcer manuellement depuis le hub.

### Que se passe-t-il si je sors plusieurs fois en piste dans la journée ?

Chaque sortie est **une session distincte**. À chaque retour box, vous avez un bilan dédié. Vous pouvez les comparer ensuite via le comparateur.

### Combien de temps faut-il pour avoir le bilan ?

3 à 5 secondes après le retour box, le bilan est prêt. Le debrief J+1 littéraire arrive le lendemain à la même heure (notification push).

### Que se passe-t-il si je tue l'app pendant le roulage ?

Vos données sont sauvegardées localement toutes les 30 secondes. À la réouverture de l'app, vous récupérez la session si elle a moins de 5 minutes. Au-delà : la session est marquée "abandonnée" mais les données restent consultables.

---

## Sur les calculs

### Comment calcule-t-on la marge ?

V1 (simplifié) : 50 % précision trajectoire + 50 % sécurité pneumatique.
- **Précision trajectoire** : écart latéral moyen entre votre tracé et un tracé de référence (seuil 4 m)
- **Sécurité pneumatique** : G_lat max observé (seuil 1.2 g, au-delà = sollicitation forte)

V1.1 enrichira avec smoothness (régularité du geste) et stabilité dynamique (sous/sur-virage).

### Pourquoi 14 segments ?

C'est le nombre de virages du tracé Beltoise. Chaque virage = un segment d'analyse. Les lignes droites sont fondues dans l'entrée/sortie des virages adjacents.

### Pourquoi les seuils 30 % et 15 % ?

Ce sont des seuils **calibrés sur l'expérience pilote OXV V1** :
- ≥ 30 % = confortable, marge présente, sentiment d'aisance
- 15-30 % = exploré, marge travaillée mais pas inconfortable
- < 15 % = serré, limite ressentie

Ces seuils seront **affinés après l'alpha** à partir de vos retours qualitatifs croisés avec vos sessions.

### Le tracé de référence est-il optimal ?

V1 : non, c'est un tracé interpolé à partir de la position des 14 apex. C'est suffisant pour avoir un ordre de grandeur, pas pour mesurer une perte au tour.

V1.1 : nous enregistrerons un tour de référence avec un pilote confirmé pour avoir une polyline réelle.

---

## Sur la confidentialité

### Mes données vont-elles être vendues ?

**Non, jamais.** C'est dans nos CGU et dans le pacte. Aucun partenariat publicitaire, aucun courtage de données.

### Qui voit mes sessions ?

Vous, et le staff OXV pour les opérations (support, fixes). Aucun autre pilote, aucun tiers. Vous pouvez en partager une vue partielle (marge globale + progression) si vous le souhaitez via la fonction partage.

### Combien de temps gardez-vous mes données ?

- **Sessions analysées** : indéfiniment (vos historiques sont précieux)
- **Données brutes UBX/GPS** : 90 jours, puis purgées (sauf opt-in pour conserver)
- **Si vous supprimez votre compte** : tout est effacé sous 30 jours

### Les algorithmes sont-ils entraînés sur mes données ?

Pendant l'alpha : oui, **anonymisées**. Vous pouvez vous y opposer (réponse au mail d'invitation alpha).

En V1 commerciale : sur opt-in explicite uniquement.

---

## Sur l'alpha

### Combien de pilotes participent à l'alpha ?

Cible : 10 à 20 pilotes pour la session du 5 juillet 2026.

### Combien de temps dure la phase alpha ?

3 sessions OXV par pilote sur 2 mois (juillet → septembre 2026). Au bout, nous décidons du go/no-go pour la V1 commerciale.

### Vais-je payer pour l'alpha ?

Non. L'alpha est **gratuite**. Votre temps et vos retours sont la contrepartie.

### Que se passera-t-il après l'alpha ?

- Si succès : V1 commerciale en octobre 2026, inclusion dans le forfait OXV pour les pilotes existants
- Si retours mitigés : V1.1 d'ajustements avant lancement commercial
- Si retours négatifs : retour à la planche à dessin (peu probable mais on l'assume)

### Puis-je inviter un autre pilote dans l'alpha ?

Pas pour le moment. Le périmètre alpha est fermé pour garantir la qualité du suivi. La beta ouverte arrivera à l'automne 2026.

---

## Pour toute autre question

Mail : `alpha@oxvehicle.fr`

Réponse sous 24 h en semaine, 48 h le week-end.

— L'équipe OXV
