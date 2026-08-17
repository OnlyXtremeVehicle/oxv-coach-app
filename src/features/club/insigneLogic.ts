/**
 * L'insigne d'écurie — la part qui se teste.
 *
 * ===========================================================================
 * CE QUE LA MIGRATION DU 17/08/2026 A RENDU POSSIBLE
 * ===========================================================================
 *
 * L'en-tête de `app/(app2)/club/ecurie.tsx` disait, et disait vrai : « le logo
 * téléversé par le capitaine — les fonctions serveur n'existent pas, aucun
 * bucket de logo n'est déclaré ». La migration `20260817021552` a ajouté les
 * six colonnes `insigne_*` sur `crews`, la fonction `oxv_set_crew_insigne` et
 * le bucket `crew-insignes`. Ce module est la règle côté app.
 *
 * ===========================================================================
 * DEUX VOIES, UN SEUL INSIGNE
 * ===========================================================================
 *
 * Décision fondateur : catalogue ET téléversement, tous deux ouverts. Ce sont
 * deux VOIES, pas deux insignes — une écurie en porte un. La base l'écrit
 * (`num_nonnulls(insigne_catalogue_key, insigne_image_path) <= 1`) ; ici on
 * l'exprime par un type qui rend l'état « les deux » impossible à construire.
 *
 * ===========================================================================
 * FAIL-CLOSED, ET QUI EN EST L'AUTORITÉ
 * ===========================================================================
 *
 * Une image téléversée n'est visible des autres écuries qu'une fois validée.
 * Le capitaine, lui, voit toujours la sienne — sinon il téléverserait dans le
 * vide, sans savoir si son geste a pris.
 *
 * **La politique Storage est l'autorité, pas ce module.** `crew_insignes_lecture`
 * applique déjà exactement cette règle côté serveur. Ce qui est écrit ici sert à
 * ne pas AFFICHER une image que le serveur refusera de livrer — un cadre cassé
 * est une panne à l'écran, pas une protection. Si les deux divergeaient un jour,
 * c'est le serveur qui aurait raison.
 */

/**
 * Le catalogue — des clés, pas des dessins.
 *
 * Le rendu (formes SVG) vit dans le composant ; ce module ne connaît que les
 * identifiants et leurs libellés, pour rester testable en node comme
 * `ecurieLogic`. Les clés sont écrites en base : les renommer casserait les
 * insignes déjà choisis, et ce sont donc des identifiants, pas des étiquettes.
 */
export const INSIGNES_CATALOGUE = [
  { key: 'ecusson', libelle: 'Écusson' },
  { key: 'chevron', libelle: 'Chevron' },
  { key: 'losange', libelle: 'Losange' },
  { key: 'bouclier', libelle: 'Bouclier' },
  { key: 'couronne', libelle: 'Couronne' },
  { key: 'fanion', libelle: 'Fanion' },
] as const;

export type InsigneCatalogueKey = (typeof INSIGNES_CATALOGUE)[number]['key'];

/** Une clé inconnue ne se dessine pas : elle vient d'une base plus récente que l'app. */
export function estCleCatalogue(key: string | null | undefined): key is InsigneCatalogueKey {
  if (!key) return false;
  return INSIGNES_CATALOGUE.some((i) => i.key === key);
}

// ---------------------------------------------------------------------------
// Le téléversement — ce qu'on refuse AVANT d'envoyer
// ---------------------------------------------------------------------------

/**
 * Formats acceptés. Le SVG en est EXCLU délibérément : un SVG est un document
 * exécutable (scripts, références externes), et il serait affiché à d'autres
 * pilotes. Un insigne est une image, pas un document.
 */
export const MIMES_ACCEPTES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/**
 * Borne haute — 1 Mio. Un insigne s'affiche à quelques dizaines de points de
 * côté ; au-delà, on paie du stockage et du réseau pour des pixels que personne
 * ne verra. Refuser tôt épargne au capitaine un téléversement inutile sur un
 * réseau de circuit.
 */
export const OCTETS_MAX = 1024 * 1024;

export interface FichierInsigne {
  readonly mimeType: string | null;
  readonly octets: number | null;
}

/**
 * Valide un fichier AVANT l'envoi. Rend le message à afficher, ou `null`.
 *
 * Doubler la validation du serveur n'est pas de la défiance : c'est éviter au
 * capitaine d'attendre la fin d'un envoi pour apprendre que son fichier fait
 * quatre méga-octets.
 */
export function validerTeleversement(f: FichierInsigne): string | null {
  if (!f.mimeType || !(MIMES_ACCEPTES as readonly string[]).includes(f.mimeType)) {
    return 'Formats acceptés : PNG, JPEG ou WebP.';
  }
  if (f.octets === null || !Number.isFinite(f.octets) || f.octets <= 0) {
    return 'Ce fichier est vide ou illisible.';
  }
  if (f.octets > OCTETS_MAX) {
    return 'Votre image dépasse 1 Mo. Choisissez-en une plus légère.';
  }
  return null;
}

/**
 * Chemin Storage d'un insigne : `<crew_id>/<nom>`.
 *
 * LE PREMIER SEGMENT N'EST PAS COSMÉTIQUE. La politique
 * `crew_insignes_capitaine_ecrit` compare `(storage.foldername(name))[1]` à
 * l'identifiant de l'écurie du capitaine : un chemin construit autrement est
 * refusé par le serveur, silencieusement du point de vue de l'app.
 */
export function cheminInsigne(crewId: string, nomFichier: string): string {
  return `${crewId}/${nomFichier}`;
}

/** Extension de fichier tirée du type MIME — jamais du nom d'origine, qui ment. */
export function extensionDe(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

// ---------------------------------------------------------------------------
// Ce qu'on affiche
// ---------------------------------------------------------------------------

export type StatutInsigne = 'en_attente' | 'valide' | 'refuse';

/** L'écurie telle que la base la rend, réduite aux colonnes d'insigne. */
export interface EcurieInsigne {
  readonly insigneCatalogueKey: string | null;
  readonly insigneImagePath: string | null;
  readonly insigneStatus: StatutInsigne | null;
}

/**
 * Ce qu'il y a à peindre. `aucun` porte la RAISON, parce qu'« en attente » et
 * « rien choisi » se disent différemment au capitaine : l'un est un délai,
 * l'autre une invitation à agir.
 */
export type RaisonAbsence = 'vide' | 'en_attente' | 'refuse' | 'cle_inconnue';

export type InsigneAffichable =
  | { readonly type: 'catalogue'; readonly key: InsigneCatalogueKey }
  | { readonly type: 'image'; readonly chemin: string }
  | { readonly type: 'aucun'; readonly raison: RaisonAbsence };

/**
 * Résout l'insigne à peindre.
 *
 * `estMien` — le lecteur appartient-il à cette écurie ? Il voit alors son image
 * même non validée, comme la politique Storage le permet. Un capitaine qui ne
 * verrait pas ce qu'il vient d'envoyer croirait son geste perdu.
 */
export function insigneAffichable(e: EcurieInsigne, estMien: boolean): InsigneAffichable {
  if (e.insigneCatalogueKey !== null) {
    return estCleCatalogue(e.insigneCatalogueKey)
      ? { type: 'catalogue', key: e.insigneCatalogueKey }
      : { type: 'aucun', raison: 'cle_inconnue' };
  }

  if (e.insigneImagePath !== null) {
    if (e.insigneStatus === 'valide' || estMien) {
      return { type: 'image', chemin: e.insigneImagePath };
    }
    return { type: 'aucun', raison: e.insigneStatus === 'refuse' ? 'refuse' : 'en_attente' };
  }

  return { type: 'aucun', raison: 'vide' };
}

/** Le texte qui accompagne une absence, côté capitaine. Jamais un blanc muet. */
export function messageAbsence(raison: RaisonAbsence): string {
  switch (raison) {
    case 'en_attente':
      return 'Votre insigne est en cours de validation. Les autres écuries ne le voient pas encore.';
    case 'refuse':
      return 'Votre insigne a été refusé. Vous pouvez en proposer un autre.';
    case 'cle_inconnue':
      return 'Cet insigne vient d’une version plus récente de l’application.';
    default:
      return 'Votre écurie n’a pas encore d’insigne.';
  }
}
