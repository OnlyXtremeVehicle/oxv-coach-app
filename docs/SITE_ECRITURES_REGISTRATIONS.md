# Ce que l'application écrit sur `registrations`

> Réponse à la demande du 04/08/2026 : *« La liste des colonnes de
> `registrations` que l'application écrit. Sans elle, le REVOKE qui ferme la
> faille vous casse — c'est le point le plus urgent, avant tout écran. »*
>
> Mesuré sur la branche `migration/sdk-55`, commit `92fa4b9`, par balayage
> exhaustif de `src/` et `app/`. Rien n'est déduit d'un souvenir.

---

## La réponse tient en trois colonnes

L'application n'a **qu'un seul point d'écriture** sur `registrations`, dans
`src/services/attendanceService.ts:173`, appelé depuis
`app/(admin)/presences.tsx` — le pointage des présences au circuit.

```ts
.from('registrations')
.update({
  attended_at:           attended ? maintenant : null,
  attended_by:           pointeurId,
  attendance_updated_at: maintenant,
})
.eq('id', registrationId);
```

**`attended_at`, `attended_by`, `attendance_updated_at`.** Rien d'autre.

Aucun `insert`, aucun `upsert`, aucun `delete` sur cette table dans toute
l'application. L'unique `insert` du dépôt est dans `src/__tests__/rls/be1RLS.test.ts:82`,
et il passe par un client `service_role` : c'est un test de politique, pas un
chemin d'exécution.

Les huit autres accès sont en lecture seule, listés plus bas.

---

## VOTRE REVOKE CASSE LE POINTAGE — et pas à moitié

Votre liste révoque `attended_at`. Elle ne mentionne ni `attended_by` ni
`attendance_updated_at`.

Ça ne dégrade pas l'écriture, **ça l'annule**. Postgres refuse l'instruction
entière dès qu'une seule colonne du `SET` manque au droit. L'`UPDATE` ci-dessus
en pose trois d'un coup : la présence tombe net.

Et elle tombe pour tout le monde. **Les grants se vérifient avant la RLS**, donc
révoquer à `authenticated` retire aussi le droit aux administrateurs :
`is_admin()` est une policy, pas un grant. Le jour d'un roulage, au circuit,
sans réseau de secours.

C'est le seul point de votre correctif qui casse quelque chose. Le reste des
colonnes de votre liste — `status`, `price_total`, `price_deposit`,
`deposit_paid_at`, `balance_paid_at`, `refund_amount`, `user_id`, `session_id`,
`offer_type` — **l'application n'en écrit aucune.** Révoquez-les sans crainte
de notre côté.

---

## La contrepartie est écrite et vous attend

`supabase/migrations/PROPOSITION_mark_attendance.sql` — une RPC `security
definer`, réservée à l'administration, qui porte le pointage. Non appliquée :
elle attend l'arbitrage du fondateur, et le fichier est volontairement non
horodaté pour que `supabase db push` l'ignore d'ici là.

Elle règle aussi le défaut que vous décrivez en D-07, et vous avez raison sur le
diagnostic : notre garde de transition (`decisionPointage`,
`src/services/presenceLogic.ts:57`) **tourne dans l'application**. N'importe
quel jeton authentifié peut l'ignorer et écrire `attended_at` directement. C'est
exactement la classe de défaut que vous nommez en C2 sur `price_total`, sur une
autre colonne. Votre principe s'applique tel quel : *la faille doit être fermée
avant d'écrire la règle, sinon la règle est décorative.*

Sur la collision que vous cherchiez — nous écrivons `attended` depuis
`pending|confirmed`, votre `adminMarkAttended` l'écrit sans condition, dernier
arrivé gagne — la RPC la ferme du côté base, donc pour les deux appelants.
Elle ne touche pas `status` : poser une présence et solder un dossier sont deux
faits distincts, et le second reste à vous.

### L'ordre, et il n'est pas indifférent

1. **La RPC est appliquée.** Le pointage direct fonctionne encore : rien ne
   casse, rien n'est encore protégé.
2. **L'application bascule dessus.** Un seul fichier,
   `src/services/attendanceService.ts`, dont l'`update` devient un `rpc`. Suivi
   d'un build et d'une soumission — comptez le délai de revue App Store, ce
   n'est pas un déploiement web.
3. **Vous appliquez le REVOKE.** Le pointage direct devient impossible pour
   tout le monde, la RPC est le seul chemin.

Inverser 2 et 3 casse le pointage dans l'intervalle. Les faire le même jour ne
suffit pas : c'est l'ordre qui compte, et l'étape 2 n'est pas instantanée chez
nous.

**Dites-nous quand vous voulez poser l'étape 3, nous calerons l'étape 2 en
amont** — et pas l'inverse.

---

## Ce que l'application lit — pour que le prochain REVOKE ne surprenne personne

Votre correctif ne touche que `UPDATE`, donc rien de ceci n'est en jeu
aujourd'hui. C'est consigné pour qu'un futur `REVOKE SELECT` ne soit pas pris
pour anodin.

| Fichier | Colonnes lues |
|---|---|
| `services/attendanceService.ts` | `id, user_id, session_id, offer_type, status, slot_choice, attended_at` |
| `services/prochaineSeanceService.ts` | `id, user_id, status, attended_at` |
| `services/nextTrackDayService.ts` | `session_id, status` |
| `services/qdiService.ts` | `offer_type, status` |
| `services/heritageBookExportService.ts` | `offer_type, status` |
| `features/club/useClubHub.ts` | `session_id, status` |
| `features/club/useGalerie.ts` | `offer_type, status` |
| `features/miroir/useMiroirHome.ts` | `offer_type, status` |
| `features/vous/useVousHub.ts` | `offer_type, status` |
| `features/rec/attendancePublicService.ts` | `session_id, status` |

Neuf colonnes distinctes en tout. `status` est lu partout — c'est le pivot de
tout l'affichage de séance côté pilote.

---

## Les fonctions Edge sont hors de votre REVOKE

Elles tournent en `service_role` et ne passent pas par les grants de
`authenticated`. Pour mémoire, une seule écrit :

- `send-booking-confirmation/index.ts:148` → `confirmation_email_sent_at`.

Les autres (`eligibility-reminders`, `feedback-request`, `notify-admin-lead`,
`ritual_dispatcher`) ne font que lire.

---

## L'URL de paiement — ce que nous pouvons dire, et ce que nous ne pouvons pas

`https://www.oxvehicle.fr/paiement/{registration_id}` **s'intègre sans
obstacle** côté application. Les trois conditions techniques sont réunies :

- Le statut `pending_payment` est déjà connu et affiché — cinq emplacements,
  dont `src/services/presenceLogic.ts:92` qui le libelle « en attente de
  paiement ».
- L'identifiant d'inscription est déjà en portée à l'endroit où le lien
  s'afficherait : `prochaineSeanceService.ts` sélectionne `id`.
- Le motif existe déjà : `src/features/club/passLogic.ts:143` ouvre
  `https://www.oxvehicle.fr/compte-sessions`. Un second lien du même genre ne
  demande aucune architecture nouvelle.

**Ce n'est pas pour autant une validation.** Ouvrir un parcours de paiement
depuis l'application engage des questions qui ne sont pas techniques — la revue
App Store sur le paiement de services hors application, ce que le pilote voit
avant de quitter l'app, ce qui se passe s'il revient sans avoir payé. C'est un
arbitrage du fondateur, avec les cinq contradictions.

Ce que nous garantissons : **le jour où l'URL est arbitrée, l'application peut
l'ouvrir sans refonte.**

---

## Ce sur quoi nous ne nous prononçons pas

Les cinq contradictions (C1 `events`, C2 prix client, C3 `is_premium`, C4
paliers de parrainage, C5 homonymie D-22), les trois énumérations partenaires,
et le retrait de l'affichage `is_premium` : arbitrage du fondateur. Nous ne
retournons pas une décision verrouillée depuis l'application, comme vous n'avez
pas retourné A1 depuis le site.

Sur C5, votre levée d'homonymie est admise et nous corrigeons notre dossier :
D-22 porte bien deux registres distincts, l'appairage et les liens app→site.

Sur `car_number` unique globalement : mesure reçue, elle contredit un arbitrage
au paddock journée par journée. Nous n'en avons pas besoin côté application —
nous ne l'écrivons pas.
