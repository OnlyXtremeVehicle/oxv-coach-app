/**
 * Second facteur (TOTP) — LA DÉCISION, sans I/O.
 *
 * Séparé de `mfaService` pour la même raison que partout ailleurs dans ce
 * dépôt : importer le service tire le client Supabase, et donc tout le
 * chargement natif de l'application, dans un test qui ne parle que de
 * booléens. La décision est la garde de tout l'espace admin — elle doit être
 * éprouvable sans réseau.
 *
 * ===========================================================================
 * POURQUOI CE SERVICE, ET POURQUOI PERSONNE NE PEUT ENRÔLER À LA PLACE D'UN AUTRE
 * ===========================================================================
 *
 * La politique de confidentialité affichée au pilote annonce une
 * « authentification forte pour les comptes administrateurs (2FA TOTP
 * obligatoire) ». Vérifié en production le 12/08/2026 :
 *
 *     select count(f.id) from public.users u
 *       left join auth.mfa_factors f on f.user_id = u.id
 *      where u.role = 'admin'
 *     → 0
 *
 * Zéro facteur, sur trois comptes. Ni enrôlé, ni a fortiori vérifié. Et aucun
 * mécanisme côté code : ni écran d'enrôlement, ni contrôle du niveau
 * d'assurance dans la garde de l'espace admin.
 *
 * **L'enrôlement ne peut pas être délégué.** Un facteur enrôlé par un tiers est
 * un secret que ce tiers connaît — ce n'est alors plus un second facteur, c'est
 * un premier facteur dupliqué. La personne doit scanner le code avec SON
 * application d'authentification et confirmer avec un code qu'elle seule lit.
 * Ce service porte la mécanique ; le geste reste à son titulaire.
 *
 * ===========================================================================
 * CE QUE DIT LE DROIT, ET CE QU'IL NE DIT PAS
 * ===========================================================================
 *
 * **Le RGPD n'impose pas le 2FA.** Ni l'article 5.1.f ni l'article 32 ne
 * l'exigent à eux seuls, et l'écrire dans un document affaiblirait OXV devant
 * un contrôleur qui le sait.
 *
 * La CNIL le RECOMMANDE expressément dans deux hypothèses qui visent OXV de
 * plein fouet : les traitements de données sensibles au sens de l'article 9
 * (le cardio des pilotes en est), et les comptes à privilèges.
 *
 * Ce qui est en revanche certain : annoncer une mesure qu'on n'applique pas est
 * un écart entre le déclaré et le réel, et c'est cet écart qui se sanctionne.
 *
 * ===========================================================================
 * TOTP, PAS SMS
 * ===========================================================================
 *
 * La CNIL recommande de combiner un facteur de connaissance et un facteur de
 * possession. Le SMS n'en est pas un bon : il s'intercepte, et il se détourne
 * par portabilité frauduleuse. On reste sur TOTP, et on ne bascule pas « pour
 * la commodité ».
 *
 * **Les codes de secours sont indispensables**, faute de quoi la mesure sera
 * contournée en pratique le jour d'une perte de téléphone. Supabase n'en génère
 * pas : la procédure est un second facteur enrôlé sur un second appareil, ou un
 * accès de récupération conservé hors ligne. C'est écrit dans la marche à
 * suivre — voir `docs/juridique/08_2FA_ADMIN.md`.
 */

/** Niveau d'assurance de la session, tel que Supabase le rend. */
export interface NiveauAssurance {
  /** Niveau ATTEINT par la session courante. */
  courant: 'aal1' | 'aal2' | null;
  /**
   * Niveau REQUIS par le compte, compte tenu de ses facteurs.
   *
   * `aal2` signifie « ce compte a un facteur vérifié » — donc la session doit
   * s'élever. `aal1` signifie « aucun facteur » : rien à demander.
   */
  requis: 'aal1' | 'aal2' | null;
}

/**
 * Le compte doit-il présenter son second facteur, et ne l'a-t-il pas fait ?
 *
 * PURE, et c'est délibéré : cette décision est la garde de tout l'espace admin,
 * elle doit être testable sans réseau.
 *
 * `null` sur l'un des deux niveaux — lecture impossible, hors ligne — ne barre
 * PAS l'accès. Un administrateur au bord de la piste, sur une 4G qui tombe, ne
 * doit pas se retrouver dehors : c'est exactement le défaut que le garde de
 * profil de cet espace a déjà connu. On ne fabrique pas une seconde porte qui
 * se ferme sur une panne réseau.
 */
export function doitPresenterFacteur(n: NiveauAssurance): boolean {
  if (n.requis === null || n.courant === null) return false;
  return n.requis === 'aal2' && n.courant !== 'aal2';
}

/**
 * Le compte est-il dépourvu de second facteur ?
 *
 * Sert à AVERTIR, jamais à barrer. Barrer un administrateur sans facteur le
 * priverait de l'écran depuis lequel il pourrait en poser un — et, les trois
 * comptes étant aujourd'hui sans facteur, cela fermerait l'espace admin à tout
 * le monde d'un seul coup.
 */
export function sansSecondFacteur(n: NiveauAssurance): boolean {
  return n.requis === 'aal1' && n.courant === 'aal1';
}
