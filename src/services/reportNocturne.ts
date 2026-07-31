/**
 * REPORT NOCTURNE — une notification n'arrive pas au milieu de la nuit.
 *
 * *« Le fuseau du pilote doit être stocké — le report nocturne 22 h – 8 h se
 * calcule côté serveur. **Il diffère, il n'annule pas** : un bilan prêt à 23h40
 * se pousse le lendemain. »* — Plan de montage, jalon 5, phase 4ter.
 *
 * ---
 *
 * CE QUI EXISTAIT AVANT CE MODULE : RIEN
 *
 * La migration `l21j_fuseau_horaire_pilote` a été appliquée en production le
 * 29/07/2026. La colonne `users.timezone` existe donc — et **aucune des
 * quatorze lignes de la table ne la renseigne**, aucun code ne l'écrit, aucun
 * code ne la lit. Les deux endroits qui parlent de fuseau (`weatherService`,
 * `ritual_dispatcher/lib/weather`) écrivent `Europe/Paris` en dur.
 *
 * Quant au report lui-même, il n'existait nulle part : `scheduleDebriefNotification`
 * programmait exactement vingt-quatre heures après la séance. Une séance finie
 * à 23h40 poussait son bilan à 23h40 le lendemain soir.
 *
 * ---
 *
 * IL DIFFÈRE, IL N'ANNULE JAMAIS
 *
 * C'est la règle, et elle est écrite dans le plan. Un message reporté reste dû :
 * on ne perd pas un bilan parce qu'il était prêt trop tard. Et on n'AVANCE
 * jamais : un instant hors de la fenêtre est rendu tel quel.
 *
 * ---
 *
 * LE FUSEAU INCONNU
 *
 * Tant que la colonne est vide, il faut bien décider. Le repli est
 * `Europe/Paris` : c'est le fuseau du circuit et celui de la quasi-totalité des
 * pilotes, et l'erreur qu'il produit va dans le bon sens — au pire on décale un
 * message d'une heure, jamais on ne réveille quelqu'un.
 *
 * Ce repli est une HYPOTHÈSE, pas une mesure. Il disparaît dès que le fuseau
 * réel est enregistré.
 */

/** Début de la fenêtre de silence, heure LOCALE du pilote. */
export const HEURE_DEBUT_SILENCE = 22;
/** Fin de la fenêtre de silence, heure LOCALE du pilote. */
export const HEURE_FIN_SILENCE = 8;

/**
 * Fuseau retenu quand celui du pilote n'est pas connu.
 * Voir l'en-tête : hypothèse assumée, pas une mesure.
 */
export const FUSEAU_PAR_DEFAUT = 'Europe/Paris';

/**
 * Heure locale (0-23) d'un instant dans un fuseau donné.
 *
 * Renvoie null si le moteur ne sait pas résoudre le fuseau — certains
 * environnements JavaScript embarquent un ICU réduit. Un null se propage en
 * « on ne diffère pas » : mieux vaut une notification à l'heure prévue qu'une
 * notification décalée d'après un calcul faux.
 */
export function heureLocale(instant: Date, fuseau: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('fr-FR', {
      timeZone: fuseau,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(instant);
    const brut = parts.find((p) => p.type === 'hour')?.value;
    if (brut === undefined) return null;
    const h = Number.parseInt(brut, 10);
    // `hour12: false` rend parfois « 24 » pour minuit selon les moteurs.
    if (!Number.isInteger(h) || h < 0 || h > 24) return null;
    return h === 24 ? 0 : h;
  } catch {
    return null;
  }
}

/** L'instant tombe-t-il dans la fenêtre de silence du pilote ? */
export function dansLaNuit(instant: Date, fuseau: string): boolean {
  const h = heureLocale(instant, fuseau);
  if (h === null) return false;
  // La fenêtre enjambe minuit : 22, 23, 0, 1 … 7.
  return h >= HEURE_DEBUT_SILENCE || h < HEURE_FIN_SILENCE;
}

/**
 * Instant de livraison d'une notification prévue à `prevu`.
 *
 * Hors fenêtre de silence : `prevu`, inchangé.
 * Dans la fenêtre : le prochain 8 h 00 local, minute et seconde à zéro.
 *
 * Jamais avancé, jamais annulé.
 */
export function instantDeLivraison(prevu: Date, fuseau: string = FUSEAU_PAR_DEFAUT): Date {
  if (!dansLaNuit(prevu, fuseau)) return prevu;

  const h = heureLocale(prevu, fuseau);
  if (h === null) return prevu;

  // Combien d'heures jusqu'au prochain 8 h local ?
  // 23 h → 9 heures ; 2 h → 6 heures ; 7 h → 1 heure.
  const heuresJusquA8 =
    h >= HEURE_DEBUT_SILENCE ? 24 - h + HEURE_FIN_SILENCE : HEURE_FIN_SILENCE - h;

  const cible = new Date(prevu.getTime() + heuresJusquA8 * 60 * 60 * 1000);
  // On retombe pile sur l'heure ronde : le décalage ci-dessus conserve les
  // minutes de `prevu`, or 8 h 00 se dit 8 h 00, pas 8 h 37. On retire donc les
  // minutes et secondes RESTANTES, en travaillant sur l'instant lui-même.
  const minutes = cible.getUTCMinutes();
  const secondes = cible.getUTCSeconds();
  const ms = cible.getUTCMilliseconds();
  return new Date(cible.getTime() - (minutes * 60 + secondes) * 1000 - ms);
}

/**
 * Délai, en millisecondes, avant de présenter une notification prévue dans
 * `delaiPrevuMs` — report nocturne appliqué.
 *
 * `maintenant` est injecté pour que la logique reste pure et testable.
 */
export function delaiApresReport(
  delaiPrevuMs: number,
  fuseau: string = FUSEAU_PAR_DEFAUT,
  maintenant: Date = new Date()
): number {
  const prevu = new Date(maintenant.getTime() + delaiPrevuMs);
  const livraison = instantDeLivraison(prevu, fuseau);
  return Math.max(0, livraison.getTime() - maintenant.getTime());
}

/**
 * Le fuseau de l'appareil, tel que le moteur le connaît.
 *
 * C'est la seule source honnête côté client : le pilote est là où est son
 * téléphone. Renvoie null si le moteur ne sait pas répondre.
 */
export function fuseauDeLAppareil(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === 'string' && tz.length > 0 ? tz : null;
  } catch {
    return null;
  }
}
