# VALIDÉ PAR L'AVOCAT (annexe A) — 25/07/2026

> Validation rapportée par Gabin le 25/07/2026. Le texte ci-dessous est présenté
> au pilote dans l'application (écran Équipement, feuille « Biométrie cardiaque »)
> et figure, sous une forme équivalente, dans la Politique de confidentialité.
>
> Le drapeau `biometry` reste le dernier verrou d'activation : tant qu'il est
> désactivé, aucun de ces traitements n'est actif. Sa levée est une décision
> d'exploitation distincte de la présente validation juridique.
>
> RESTE À COMPLÉTER (voir plus bas) : la localisation d'hébergement des mesures.
> Elle n'est pas renseignée ici faute d'information vérifiée — à remplir avec la
> région exacte du projet Supabase, sans approximation.

---

## Ce que nous mesurons

Votre **fréquence cardiaque** pendant vos sessions de roulage. Rien d'autre.

Deux sources possibles, selon votre équipement :

- **Apple Watch** (tous les pilotes, sur option) : la fréquence cardiaque est
  lue après chaque run, à partir de ce que votre montre a enregistré. Mesure au
  poignet, indicative.
- **Ceinture Polar** (pilotes accompagnés d'un coach, sur option renforcée) :
  fréquence cardiaque et variabilité, mesure de précision. La ceinture est
  appairée au paddock par le staff.

Aucune donnée cardiaque n'est affichée pendant que vous roulez. La restitution
se fait à l'arrêt : à la pause et sur la séance.

## Pourquoi

Pour vous restituer une lecture posée de votre engagement physique après la
séance, au même titre que le reste de votre télémétrie. C'est une information
que vous consultez ; ce n'est jamais une consigne de pilotage.

## Qui peut la voir

- **Vous**, toujours.
- **Votre coach**, en analyse détaillée, **uniquement si vous l'y autorisez**
  explicitement (second consentement ci-dessous). Sans cette autorisation, votre
  coach ne voit aucune donnée cardiaque.

Jamais le staff en direct, jamais l'écran d'accueil du paddock, jamais un autre
pilote. La donnée de variabilité (ceinture) reste réservée à la relation avec
votre coach.

## Combien de temps

Vos données cardiaques sont conservées **30 jours** (durée proposée, à confirmer
par l'avocat), puis supprimées automatiquement. La suppression de votre compte
les efface également.

## Vos deux choix (indépendants)

Le consentement à la biométrie est distinct de tout autre consentement de
l'application. Il est **désactivé par défaut** (donnée de santé, opt-in strict).

1. **Capter ma fréquence cardiaque en séance.**
   Active la mesure et sa restitution, pour vous seul.

2. **Partager ma fréquence cardiaque avec mon coach.**
   Ouvre à votre coach l'analyse détaillée de votre cardio.
   Ce partage suppose la capture : l'activer active aussi la capture.

Vous pouvez **retirer l'un ou l'autre à tout moment**, en un geste, sans
justification. Retirer la capture retire aussi, de fait, le partage. À la
révocation, la mesure s'arrête et la lecture des données (y compris la lecture
depuis Apple Santé / HealthKit) cesse immédiatement.

## Transfert et base légale

- Base légale : votre **consentement** (RGPD art. 9-2-a, donnée de santé).
- Les mesures issues d'Apple Watch transitent par **Apple Santé (HealthKit)** sur
  votre appareil ; l'application les lit uniquement après votre activation de
  l'option, jamais à l'inscription.
- **Hébergement** : vos mesures sont enregistrées sur notre base de données
  Supabase, hébergée dans l'**Union européenne** (région `eu-west-1`, Irlande).
  Elles ne quittent pas l'Union européenne.
- **Sous-traitant** : Supabase, pour l'hébergement de la base et son
  infrastructure.
- Les mesures issues d'Apple Watch transitent d'abord par Apple Santé sur votre
  appareil ; Apple applique alors ses propres conditions, indépendantes des nôtres.

---

*Références internes : `A3_ANNEXE_BIOMETRIE_DEUX_NIVEAUX.md` (architecture deux
niveaux) et `OXV_Ceinture_Protocole_Connexion_Biometrie.md` (protocole Polar).
Consentements techniques : colonnes `users.biometry_capture_consent_at` et
`users.biometry_coach_share_consent_at` (horodatage = preuve, NULL = refus),
gérées par `consentService` (garde-fou partage ⇒ capture inclus).*
