# OXV — Éligibilité des véhicules

**Document canonique.** Toute pièce dérivée qui diverge de ce document est invalidée.
Millésime 2026. Supersede toute mention antérieure de conditions d'accès véhicule.

---

## 1. Principe fondateur

OXV ne refuse pas de client. OXV définit un périmètre de service.

Cette distinction est juridique avant d'être commerciale. L'article L121-11 du Code de la
consommation interdit de refuser une prestation à un consommateur sans motif légitime. Un
périmètre publié, objectif et appliqué uniformément ne constitue pas un refus : il constitue
la définition du service vendu.

Conséquence opérationnelle : **aucun véhicule non éligible n'est sélectionnable à la
réservation.** Le filtrage est structurel, en amont du paiement. Il n'existe pas de refus
a posteriori sur un véhicule correctement déclaré.

---

## 2. Conditions d'accès — C1 à C5

### C1 — Homologation et immatriculation
Véhicule homologué pour la circulation routière, immatriculé, certificat d'immatriculation
et attestation d'assurance en cours de validité. Concordance vérifiée par HistoVec.

Exclut : prototypes, monoplaces, véhicules de compétition non homologués, véhicules non
immatriculés. Ce critère conditionne également la RC circuit du pilote.

### C2 — Architecture
Carrosserie fermée, ou véhicule découvrable équipé d'une protection anti-tonneau d'origine.

**Dépendance bloquante.** L'admission des découvrables est subordonnée au règlement intérieur
de l'opérateur circuit. Confirmation écrite requise avant publication.

### C3 — Performance
Rapport masse / puissance inférieur ou égal à **6,0 kg/ch**.

Le critère est exprimé en rapport et non en puissance seule : un seuil en chevaux exclurait
les châssis légers légitimes tout en laissant entrer des berlines lourdes.

### C4 — Masse
Masse en ordre de marche inférieure ou égale à **2 400 kg**.

Ce plafond ouvre la gamme électrique crédible — Taycan, RS e-tron GT — tout en écartant les
SUV et les berlines dont le comportement thermique de freins est incompatible avec un
plateau GT.

**Dépendance bloquante.** L'opérateur circuit peut appliquer sa propre limite de masse sur
un tracé de 2 208 m. Confirmation écrite requise.

### C5 — Conformité à l'origine
Toute modification du moteur, de l'échappement, de la suspension ou du freinage est déclarée
à la réservation. Une modification non déclarée et constatée au contrôle d'accès entraîne
l'exclusion de la journée dans les conditions de l'article 4 ci-dessous.

### Motorisations électrifiées
Admises sous réserve de couverture par l'assurance spécialisée véhicules électrifiés.
Recharge en extérieur exclusivement — la règle no-indoor-charging du local s'applique
également au paddock.

---

## 3. Classes de roulage

La classe est **calculée** à partir du rapport masse / puissance. Elle n'est jamais saisie
manuellement, jamais négociée, jamais ajustée au cas par cas.

| Classe | Rapport masse / puissance | Dénomination |
|---|---|---|
| I | 5,0 à 6,0 kg/ch | Sport |
| II | 3,5 à 5,0 kg/ch | GT |
| III | inférieur à 3,5 kg/ch | Supersport |

Plafond de masse de 2 400 kg applicable aux trois classes.

### Ouverture des offres par classe

| Offre | Classe I | Classe II | Classe III |
|---|:---:|:---:|:---:|
| Access — demi-journée | ouverte | ouverte | ouverte |
| Signature — journée pleine | fermée | ouverte | ouverte |
| Heritage — pack de 4 journées | fermée | ouverte | ouverte |

Justification économique : Access exige 13 pilotes présents sur 20 pour couvrir son coût
direct, contre 12 pour Signature. Access est la journée dont le remplissage est le plus
tendu. L'ouvrir à la classe I élargit le vivier de recrutement là où le besoin est le plus
fort, sans fractionner le calendrier Signature — ce qui aurait rendu le pack Heritage
inconsommable pour la classe minoritaire.

La restriction Signature n'est pas une exclusion : elle installe une échelle. Le pilote entre
en Access à 250 €, observe la classe II rouler, change de véhicule.

### Rotation en piste
Les classes organisent les groupes de roulage à l'intérieur d'une même journée : sessions
alternées, sortie de stand par groupe. Le calendrier n'est jamais fractionné par classe en
2027 ni en 2028.

---

## 4. Matrice d'annulation

| Situation | Traitement |
|---|---|
| Déclaration exacte, véhicule conforme | Journée assurée |
| Déclaration inexacte constatée au contrôle d'accès | Retenue à hauteur du coût de piste engagé par place, solde restitué sous 14 jours |
| Non-conformité constatée par l'opérateur circuit (décibels, contrôle technique) | Report sans frais sur une date ultérieure de la saison |
| Substitution de véhicule demandée avant J−7 | Réadmission gratuite si la classe est identique ou supérieure |
| Annulation OXV, indisponibilité du circuit, conditions météorologiques | Report sans frais ou remboursement intégral, au choix du pilote |

**Point de vigilance juridique.** Une clause de non-remboursement total serait présumée
abusive au sens de l'article L212-1 du Code de la consommation, faute de contrepartie
symétrique. La retenue proportionnée au coût réellement engagé est la seule rédaction qui
tienne. La ligne « annulation OXV » est indispensable : sans clause miroir, l'ensemble du
dispositif paraît déséquilibré et fragilise les autres articles par contagion.

**Droit de rétractation.** L'article L221-28 12° exclut du droit de rétractation les
activités de loisirs fournies à une date déterminée. L'exception doit être invoquée
explicitement en conditions générales, sinon elle ne joue pas.

---

## 5. Référentiel véhicules

Fichier : `OXV_Referentiel_Vehicules_2026.csv` — 93 entrées, révision 2026.
Répartition : 16 en classe I, 48 en classe II, 29 en classe III.

Le référentiel est l'**application** des conditions C1 à C5, jamais leur substitut. La classe
de chaque entrée est recalculée à chaque révision par le script `gen_referentiel.py`. Aucune
valeur de classe n'est saisie en dur.

Mention obligatoire en conditions générales :

> Le référentiel des véhicules éligibles constitue l'application des conditions d'accès. Il
> est révisé annuellement. L'absence d'un véhicule du référentiel ne vaut pas refus : elle
> ouvre un examen individuel sous 72 heures.

Sans cette voie de recours, les réservations légitimes non anticipées par le référentiel sont
perdues en silence, sans mesure possible du manque à gagner.

---

## 6. Dépendances bloquantes

Aucune publication client avant obtention des deux réponses écrites suivantes, à demander
dans un même courrier à l'opérateur du Circuit de Haute Saintonge.

1. **Découvrables.** Admission au titre du règlement intérieur, et niveau d'équipement
   anti-tonneau exigé.
2. **Masse et électrifiés.** Masse maximale admise en piste, et politique applicable aux
   véhicules électriques et hybrides rechargeables.

### Question à forte valeur économique

Le modèle financier porte, pour la demi-journée Access, une base piste de 2 000 € HT jusqu'à
huit voitures, puis un supplément de 1 100 € HT au-delà.

**Ce palier compte-t-il les voitures simultanément en piste, ou les pilotes inscrits sur la
journée ?**

Si le décompte porte sur la présence simultanée, la rotation en trois groupes de six à sept
véhicules ne déclenche jamais le supplément. Économie de 1 100 € HT par demi-journée Access,
soit 7 700 € HT sur les sept journées de 2027 — davantage que le résultat net négatif de
première année. Le seuil de rentabilité Access passerait alors de 13 à 10 pilotes présents.

Cette question conditionne la structure de la rotation. Elle est prioritaire sur les deux
autres.

---

## 7. Réserve de compétence

Les articles 2 et 4 constituent un projet argumenté, appuyé sur les textes cités. Ils ne
constituent pas un avis juridique. La version diffusée au public doit être relue par un
avocat en droit de la consommation.

SAEC Lalande et Associés n'est pas l'interlocuteur pertinent sur ce point : le cabinet valide
la structure, les taux et le modèle, non les conditions générales de vente.
