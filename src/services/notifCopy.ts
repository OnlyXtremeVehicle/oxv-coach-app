/**
 * Copie des notifications OXV — factuelle, jamais prescriptive (PR-43).
 *
 * Source UNIQUE et PURE des textes de notification (titre + corps), pour qu'ils
 * soient verrouillés par un test doctrinal (`notifCopy.test`) : aucune instruction
 * de pilotage, aucun jugement, ton sobre, vouvoiement, pas d'emoji. Le service
 * pushNotificationsService importe ces constantes — la copie ne vit jamais en dur.
 */

export interface NotifText {
  title: string;
  body: string;
}

export const NOTIF_COPY: Record<'debrief' | 'sessionReminder', NotifText> = {
  // Débrief J+1 prêt : une invitation posée, jamais une injonction.
  debrief: {
    title: 'Votre debrief est prêt.',
    body: 'Une lecture posée vous attend, quand vous le souhaitez.',
  },
  // Veille de session : un rappel logistique, formulé en invitation (pas « vérifiez »).
  sessionReminder: {
    title: 'Demain, vous roulez.',
    body: 'Un dernier regard à votre équipement, à tête reposée. L’app sera prête.',
  },
};
