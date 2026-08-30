# Passerelle v1 — ce qui se commande, et ce que je propose de changer avant

**30/08/2026 · butée de commande : mercredi 2 septembre.** C'est le chemin critique du jalon du Mans : aucune ligne de code ne rattrape un délai de livraison.

---

## 1 · Deux changements d'architecture, à trancher avant de payer

La passerelle décrite jusqu'ici était : Raspberry Pi Zero 2 W + HAT LTE + convertisseur 24 V → 5 V pris sur le camion. Vingt-sept jours plus tard, elle doit fonctionner du premier coup devant un client. Je propose deux simplifications qui retirent chacune un risque entier, sans rien enlever à la démonstration.

### A · Ne rien prendre sur le 24 V du camion

Un Pi Zero 2 W consomme environ 0,5 à 1,5 W. Une batterie nomade de 20 000 mAh (74 Wh) le tient **plus de deux jours**, routeur compris. Une séance dure vingt à quarante minutes.

Ce que ça supprime : le convertisseur à sourcer, la validation électrique par le mécanicien, la conversation « vous branchez quoi sur mon camion ? » le vendredi matin, le fusible, et le risque de coupure quand ils travaillent sur le faisceau entre deux séances.

Ce que ça coûte : il faut penser à recharger le soir. C'est tout.

**Le 24 V redevient utile en 2027**, quand le boîtier restera à demeure sur une saison. Pas pour deux week-ends.

### B · Sortir la 4G du Pi et la mettre dans un routeur de poche

Le HAT LTE (SIM7600G-H) est le bon composant — et c'est aussi celui qui mange une semaine : configuration du modem, PPP ou QMI, antennes, firmware, reprise après perte de réseau. Un **routeur 4G de poche** fait la même chose, sort de la boîte en marche, a sa propre batterie, et se remplace dans n'importe quelle grande surface un samedi matin.

Le Pi n'a alors qu'à se connecter en WiFi. Il ne reste plus une seule inconnue logicielle côté réseau.

**La contrepartie, dite franchement :** le Pi Zero 2 W partage une seule antenne entre le WiFi et le Bluetooth. Faire tourner les deux en même temps dégrade les deux. Pour un message par seconde, c'est sans conséquence attendue — mais ce n'est pas prouvé, et **c'est exactement ce que la répétition de Bouteville doit mesurer le 19 septembre.** Si la coexistence pose problème, le repli est le HAT LTE, qui éteint le WiFi.

**Résultat.** La passerelle v1 devient : un Pi Zero 2 W, une batterie, un routeur 4G, un boîtier, une fixation. Que du matériel courant, en stock, remplaçable, et rien de câblé au camion.

---

## 2 · Nomenclature — route A (recommandée)

*Prix constatés fin août 2026, à revérifier au moment de payer. Deux fournisseurs différents volontairement : le risque n'est pas le prix, c'est la livraison.*

| Qté | Élément | Pourquoi cette quantité | Ordre de prix |
|---|---|---|---|
| 2 | Raspberry Pi Zero 2 W | **Un de secours.** C'est la pièce qui ne se rachète pas au Mans | ~18 € pièce |
| 3 | microSD A2 32 Go (marque sérieuse) | La carte SD est la première panne d'un Pi sur le terrain. Trois cartes, deux images identiques prêtes | ~10 € pièce |
| 2 | Batterie nomade 20 000 mAh, USB-C | Une dans la cabine, une en charge | ~30 € pièce |
| 1 | Routeur 4G de poche à batterie (type TP-Link M7350) | La 4G de la cabine | ~65 € |
| 2 | Carte SIM data sans engagement, 100 Go et plus | Une pour la cabine, une pour la tablette et l'écran au stand | ~15 €/mois pièce |
| 4 | Câbles USB courts (30 cm) + adaptateur OTG | Les câbles longs vibrent et se déboîtent | ~20 € |
| 1 | Boîtier ABS + mousse de calage | Le camion vibre plus qu'une voiture | ~15 € |
| 1 | Dual Lock 3M (rouleau) + sangle velcro | Fixation sans percer, sans coller sur peinture | ~30 € |
| 1 | Dissipateurs adhésifs pour Pi Zero | Une cabine au soleil monte très haut | ~5 € |
| — | **Total** | | **≈ 260 à 300 €** |

**Le point le moins évident, et le plus vicieux.** Beaucoup de batteries nomades **s'éteignent toutes seules** quand la consommation est trop faible : un Pi Zero au repos passe sous leur seuil de détection et la batterie coupe au bout de trente secondes. Il faut soit une batterie avec un mode « faible consommation » explicitement annoncé, soit une petite charge parasite. **À vérifier dès la réception, pas le 19 septembre.**

---

## 3 · Nomenclature — route B (le HAT LTE, si vous tenez à l'intégré)

| Qté | Élément | Ordre de prix |
|---|---|---|
| 1 | HAT SIM7600G-H 4G (version B) | ~70 à 90 € |
| 1 | Jeu d'antennes LTE + adhésif pare-brise | ~15 € |
| 1 | Alimentation 5 V 3 A dédiée (le HAT tire plus que le Pi) | ~15 € |
| 1 | UPS HAT à supercondensateur (extinction propre) | ~25 € |
| 1 | Convertisseur 24 V → 5 V 3 A qualité automobile + porte-fusible | ~25 € |

Surcoût : ~150 à 170 €, et surtout **une semaine d'intégration** dans une fenêtre qui en compte quatre. C'est la bonne cible pour 2027. Ce n'est pas la bonne pour le 26 septembre.

---

## 4 · Ce qui est écrit dans le logiciel, et qui ne se voit pas sur une facture

| # | Contrainte | Pourquoi |
|---|---|---|
| G-1 | **Racine en lecture seule** (overlayfs), écritures en mémoire, vidage vers le serveur | La corruption de carte SD après coupure est la panne numéro un d'un Pi embarqué |
| G-2 | Tampon local **circulaire**, jamais de perte silencieuse | Une passerelle qui perd la 4G garde ses trames et les rejoue. Elle ne les jette pas |
| G-3 | Démarrage automatique, sans écran, sans clavier, sans intervention | Le vendredi au Mans, on branche et ça marche, ou ça ne marche pas |
| G-4 | Battement de cœur visible depuis la tablette | Vous devez savoir que la passerelle vit **avant** que le camion parte, pas après |
| G-5 | Même parseur UBX que l'application, porté, pas réécrit | Un seul comportement de trame entre le direct et l'import |
| G-6 | Même contrat d'émission que le relais téléphone | C'est ce qui rend le repli gratuit (section 12 de la stratégie) |

---

## 5 · Deux dépenses qui ne sont pas dans la passerelle et qu'il faut trancher

| # | Sujet | Le choix |
|---|---|---|
| E-1 | **Alimenter l'écran de 24 à 27 pouces au paddock** | Un écran consomme 20 à 30 W. Sur une journée, c'est 250 Wh — largement au-delà d'une batterie nomade. Soit vous demandez une prise au stand de l'écurie (gratuit, et ça crée une occasion de parler), soit vous prenez une station d'énergie de 300 Wh (200 à 300 €). **Demandez d'abord. Décidez le 10 septembre.** |
| E-2 | **L'écran lui-même** | Un 27 pouces mat, alimenté en USB-C si possible : un seul câble depuis la tablette ou depuis une station. Le brillant est illisible dehors |

---

## 6 · Ce qui se fait cette semaine

| Quand | Quoi |
|---|---|
| Aujourd'hui | Trancher A et B ci-dessus. Commander chez **deux** fournisseurs différents |
| À réception | Test de la batterie (le seuil de coupure), image du Pi écrite en double, démarrage sans écran vérifié |
| 08/09 | Contrat d'émission partagé écrit, relais téléphone réveillé — la passerelle n'est pas encore nécessaire pour ça |
| 15/09 | Deux heures de route, zéro trame perdue |
| 19/09 | Bouteville, séance complète. Le WiFi et le Bluetooth cohabitent, ou on bascule sur le HAT |

---

*Note de méthode : je n'ai pas pu vérifier les stocks ni les prix exacts au moment où vous lirez ceci. Les ordres de grandeur viennent de relevés publics de fin août 2026. Le seul chiffre qui compte est celui de la page de commande, mercredi.*
