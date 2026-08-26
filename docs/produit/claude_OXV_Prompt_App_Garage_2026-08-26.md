# Prompt Claude Code — App OXV Mirror, zone Garage et contrôle d'accès

Cible : OXV Mirror V4, Expo / React Native, iOS-first.
Référence doctrinale : `claude_OXV_Eligibilite_Vehicules_2026-08-26.md`.

---

## Prompt à transmettre

Tu interviens sur OXV Mirror, application Expo / React Native, navigation à quatre zones —
Circuit, Séances, Club, Garage. Typographie : Inter variable pour le texte, IBM Plex Mono
pour la donnée. Backend Supabase, projet `fouvuqkdxarjpjbqnsjq`.

**Doctrine miroir, contrainte absolue.** L'application restitue la donnée factuellement. Aucun
coaching, aucune prescription, aucune notation. Aucune comparaison entre pilotes. Valeur
absente : tiret cadratin, jamais zéro. Tout écart expose OXV juridiquement.

### Lot 1 — Fiche véhicule dans Garage

Le véhicule déclaré à la réservation devient l'objet central de la zone Garage.

Affiche : marque, modèle, génération, années, puissance, masse, rapport masse / puissance,
classe. Les valeurs numériques en IBM Plex Mono, les libellés en Inter.

La classe s'affiche en libellé neutre — « Classe II — GT ». Jamais de qualificatif, jamais de
position relative, jamais de mention du nombre de pilotes par classe. La classe est un fait
d'organisation, pas un rang.

Sous la fiche, un bloc « Accès » indiquant les formules ouvertes à cette classe. Formulation
factuelle : « Access, Signature, Heritage » ou « Access ». Pas de verbe de restriction, pas
d'incitation au changement de véhicule.

### Lot 2 — Concordance HistoVec

Bouton « Vérifier la concordance ». Compare l'immatriculation déclarée aux données HistoVec.

Trois états, sans jugement de valeur :

- **Concordance vérifiée** — horodatage de la vérification
- **Concordance non établie** — motif factuel, invitation à contacter l'administration
- **Non vérifié** — tiret cadratin, aucun message d'alerte

Ne bloque rien dans l'application. La concordance est une information restituée au pilote,
pas un contrôle applicatif. Le contrôle réel a lieu au paddock.

### Lot 3 — Déclaration de modification

Interrupteur dans la fiche véhicule : « Modifications moteur, échappement, suspension,
freinage. » Activé, il ouvre un champ texte et bascule le statut de la prochaine réservation
en `en_examen`.

Message affiché, exactement : « Une modification déclarée ouvre un examen sous soixante-douze
heures. Une modification non déclarée entraîne le refus d'accès à la piste le jour de la
journée. »

Ton factuel. Pas de mise en garde dramatisée, pas de rouge, pas d'icône d'avertissement.

### Lot 4 — Substitution de véhicule

Depuis Garage, permettre la substitution jusqu'à J−7 sur une réservation à venir.

Sélection en cascade identique au site — marque, modèle, génération — servie par la même
table `vehicules_eligibles`. Si le véhicule de substitution relève d'une classe ne donnant pas
accès à la formule réservée, la substitution est refusée avec la mention de la classe requise.

Au-delà de J−7, le bouton disparaît. Aucun message d'échec, aucune explication non sollicitée.

### Lot 5 — Contrôle d'accès paddock, vue administration

Écran distinct, réservé aux comptes administrateurs, hors navigation pilote.

Liste des pilotes attendus sur la journée. Par ligne : nom, véhicule déclaré,
immatriculation, classe, concordance HistoVec, modifications déclarées.

Trois actions par ligne : **présent conforme**, **non-concordance**, **absent**.

L'action « non-concordance » ouvre un champ de motif libre et horodate. Elle ne déclenche
aucun traitement financier automatique — la retenue relève de l'administration, jamais de
l'application.

Le contrôle sonore et le contrôle technique ne figurent pas sur cet écran. Ils relèvent de
l'opérateur du circuit. N'ajoutez aucun champ les concernant, sous aucun prétexte
d'ergonomie.

### Lot 6 — Composition des groupes de roulage

Vue administration. Répartit les pilotes présents en groupes selon leur classe, pour la
rotation en piste de la journée.

Affiche par groupe : effectif, classes représentées, plage horaire. Export texte simple pour
le briefing.

Aucun classement, aucun ordonnancement par performance à l'intérieur d'un groupe. L'ordre
d'affichage est alphabétique.

### Interdits

- Aucune comparaison entre pilotes, aucun classement, aucune notation.
- Aucun montant B2B.
- Aucun verbe prescriptif dans les libellés d'interface.
- Aucun cadran central, aucune grille symétrique — ces motifs trahissent la génération
  automatique et sont proscrits par la charte.
- Ne jamais confondre `hauteSaintonge.ts`, fichier de dépôt à 73 points, et le GeoJSON réel
  du circuit à 2 250 points. Cette zone n'utilise ni l'un ni l'autre.
- Micro-typographie française : U+202F avant deux-points, point-virgule, point d'exclamation
  et point d'interrogation, et comme séparateur de milliers.

### Vérifications

- Test pgTAP : aucune substitution acceptée vers une classe non autorisée pour la formule.
- Test pgTAP : `classe_retenue` d'une réservation payée demeure inchangée après mise à jour
  du référentiel.
- Parcours Maestro : déclaration de modification, bascule en `en_examen`, retour à Garage.
- Aucun texte d'interface ne contient de verbe prescriptif ni de comparatif de performance.
