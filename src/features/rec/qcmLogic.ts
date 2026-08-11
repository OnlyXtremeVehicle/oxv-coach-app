/**
 * Le QCM de l'entre-runs — jalon 3, lot 21f. Logique PURE.
 *
 * ===========================================================================
 * « QCM EN TÊTE, CHIFFRES MASQUÉS » — ET LE MOTIF EST DOCTRINAL
 * ===========================================================================
 *
 * Le plan pose l'ordre, sans l'expliquer. L'explication est dans la doctrine :
 * **un chiffre vu avant la question oriente la réponse.**
 *
 * Un pilote qui lit « 1:41,203 · record du jour » avant qu'on lui demande ce
 * qu'il a senti répondra que ça allait. Il ne mentira pas — il aura lu la
 * réponse avant la question. L'application aurait alors mesuré son chronomètre,
 * pas son ressenti, et les deux se seraient confondus dans la même table.
 *
 * L'écran masque donc ses chiffres tant que la question n'a pas été traitée.
 * « Traitée » comprend « passée » : on ne retient personne.
 *
 * ===========================================================================
 * LE VOCABULAIRE EST CELUI DU COACH, ET CE N'EST PAS UN DÉTAIL
 * ===========================================================================
 *
 * Le plan : *« le vocabulaire des options doit rester aligné sur celui de la
 * variable coach — freinage, placement, rythme, voiture. »*
 *
 * C'est ce qui rendra un jour comparables ce que le pilote ressent et ce que le
 * coach observe. Deux vocabulaires proches mais distincts donneraient l'illusion
 * du croisement sans jamais le permettre — exactement le défaut du texte libre,
 * sous une autre forme.
 *
 * La contrainte est portée en base depuis le 05/08/2026
 * (`pilot_notes_theme_check`). Ce module et elle doivent rester d'accord.
 *
 * ===========================================================================
 * « JE NE SAIS PAS » EST UNE RÉPONSE, ET ELLE EST OFFERTE
 * ===========================================================================
 *
 * Forcer un choix fabriquerait une donnée. Un pilote qui sort de piste ne sait
 * pas toujours ce qu'il a senti, et l'écrire est un fait — pas un échec du
 * questionnaire.
 *
 * Elle s'enregistre comme les autres : on retient qu'il a été interrogé et
 * qu'il n'a pas su. C'est différent d'avoir passé la question, et différent de
 * ne pas avoir été interrogé.
 */

/** Les quatre thèmes, alignés sur la variable coach. */
export type ThemeQcm = 'freinage' | 'placement' | 'rythme' | 'voiture';

export const THEMES: readonly { cle: ThemeQcm; label: string }[] = [
  { cle: 'freinage', label: 'Le freinage' },
  { cle: 'placement', label: 'Le placement' },
  { cle: 'rythme', label: 'Le rythme' },
  { cle: 'voiture', label: 'La voiture' },
] as const;

/**
 * Les ressentis proposés.
 *
 * DESCRIPTIFS, JAMAIS PRESCRIPTIFS. Aucun n'évalue, aucun ne dit quoi faire.
 * « Terrain serré » décrit une sensation ; « trop rapide » porterait un jugement
 * que l'application n'a pas à rendre.
 *
 * Le mot « limite » est proscrit partout dans le produit — « marge » le
 * remplace. Aucun ressenti ne l'emploie, et un test le vérifie.
 */
export type RessentiQcm = 'confortable' | 'serre' | 'a_creuser' | 'sais_pas';

export const RESSENTIS: readonly { cle: RessentiQcm; label: string }[] = [
  { cle: 'confortable', label: 'Confortable' },
  { cle: 'serre', label: 'Terrain serré' },
  { cle: 'a_creuser', label: 'À creuser' },
  // Offerte, et au même rang que les autres : ne pas savoir est un fait.
  { cle: 'sais_pas', label: 'Je ne sais pas' },
] as const;

/** Où en est le questionnaire. */
export type EtapeQcm = 'theme' | 'ressenti' | 'termine';

export interface EtatQcm {
  etape: EtapeQcm;
  theme: ThemeQcm | null;
  ressenti: RessentiQcm | null;
  /** Vrai quand le pilote a passé la question plutôt que d'y répondre. */
  passe: boolean;
}

export const QCM_INITIAL: EtatQcm = {
  etape: 'theme',
  theme: null,
  ressenti: null,
  passe: false,
};

export function choisirTheme(etat: EtatQcm, theme: ThemeQcm): EtatQcm {
  return { ...etat, theme, etape: 'ressenti' };
}

export function choisirRessenti(etat: EtatQcm, ressenti: RessentiQcm): EtatQcm {
  return { ...etat, ressenti, etape: 'termine' };
}

/** Passer, à n'importe quelle étape. Rien n'est enregistré. */
export function passer(etat: EtatQcm): EtatQcm {
  return { ...etat, etape: 'termine', passe: true };
}

/**
 * Les chiffres sont-ils affichables ?
 *
 * LA RÈGLE DE L'ORDRE, EN UNE FONCTION. Tant que la question n'est pas traitée,
 * l'écran ne montre aucune valeur. Passer compte comme traiter : on ne retient
 * personne au stand pour une question.
 */
export function chiffresAffichables(etat: EtatQcm): boolean {
  return etat.etape === 'termine';
}

/**
 * Ce qu'on écrit, ou rien.
 *
 * Rend `null` quand il n'y a rien à enregistrer — question passée, ou réponse
 * incomplète. **On n'écrit jamais une ligne à moitié** : une note dont le thème
 * serait posé sans ressenti se croiserait avec les autres et fausserait le
 * recoupement, qui est la seule raison d'être de ces colonnes.
 *
 * `body` reste la phrase lisible, parce que la colonne est NOT NULL et parce
 * qu'une note doit se relire sans décodeur. Elle est composée des libellés, pas
 * des clés : c'est ce que le pilote a vu à l'écran.
 */
export interface EcritureQcm {
  body: string;
  theme: ThemeQcm;
  ressenti: RessentiQcm;
}

export function ecritureDepuis(etat: EtatQcm): EcritureQcm | null {
  if (etat.passe) return null;
  if (etat.theme === null || etat.ressenti === null) return null;

  const theme = THEMES.find((t) => t.cle === etat.theme);
  const ressenti = RESSENTIS.find((r) => r.cle === etat.ressenti);
  if (!theme || !ressenti) return null;

  return {
    body: `${theme.label} : ${ressenti.label.toLowerCase()}.`,
    theme: etat.theme,
    ressenti: etat.ressenti,
  };
}

/** L'intitulé de l'étape courante. Interrogatif, jamais impératif. */
export function questionCourante(etat: EtatQcm): string | null {
  if (etat.etape === 'theme') return 'Sur quoi voulez-vous revenir ?';
  if (etat.etape === 'ressenti') {
    const t = THEMES.find((x) => x.cle === etat.theme);
    return t ? `${t.label} — que sentez-vous ?` : 'Que sentez-vous ?';
  }
  return null;
}
