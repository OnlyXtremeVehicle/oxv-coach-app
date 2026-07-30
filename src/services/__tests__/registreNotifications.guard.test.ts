/**
 * REGISTRE DES NOTIFICATIONS — l'interdit ne s'arrête pas au bord de l'app.
 *
 * *« "Vous n'avez pas roulé depuis trois mois" est exactement ce que
 * l'application s'interdit à l'écran — et l'interdit ne s'arrête pas au bord de
 * l'application. »* — Plan de montage, jalon 5, critère d'acceptation 4 :
 * **le test de registre sur TOUS les messages de notification.**
 *
 * ---
 *
 * CE QUI ÉTAIT GARDÉ, ET CE QUI NE L'ÉTAIT PAS
 *
 * `src/services/notifCopy.ts` porte deux messages, et son propre test les
 * verrouille. Le scanner doctrinal du dépôt, lui, ne lit que `app/` et `src/`
 * en `.tsx` — et `.eslintrc` ignore `supabase/` en entier.
 *
 * Or **une vingtaine de fonctions serveur portent leur propre copie** : titres
 * et corps de notification poussée, sujets et textes d'e-mail. Elles parlent au
 * pilote exactement comme un écran, et aucune garde ne les lisait. Un message
 * qui reproche une absence, qui dicte une conduite ou qui juge une personne
 * serait passé sans que rien ne bronche.
 *
 * ---
 *
 * DEUX JEUX DE RÈGLES
 *
 * 1. **Les règles doctrinales du dépôt**, importées de `scripts/doctrineRegles`
 *    — la même liste que celle qui garde les écrans, jamais une copie. Une
 *    règle ajoutée là s'applique ici le jour même.
 *
 * 2. **Les règles propres au registre**, écrites ici parce qu'elles n'ont de
 *    sens que pour un message non sollicité : reprocher une absence, presser,
 *    culpabiliser. Un écran ne fait pas cela parce que le pilote l'a ouvert ;
 *    une notification arrive sans qu'on l'ait demandée.
 *
 * ---
 *
 * CE QUE CETTE GARDE NE PROUVE PAS
 *
 * Que le message ENVOYÉ est celui qu'on lit ici. Plusieurs textes sont
 * assemblés par interpolation (`${pilotName}`, `${circuit}`) : la garde lit le
 * gabarit, pas la chaîne finale. Un prénom ne peut pas violer la doctrine ; une
 * variable qui porterait une phrase entière, si. Aucune n'est dans ce cas
 * aujourd'hui — vérifié à l'écriture.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { FORBIDDEN_PATTERNS } from '../../../scripts/doctrineRegles';

const RACINE = join(__dirname, '..', '..', '..');

/**
 * Où vit la copie adressée à un humain, hors écrans.
 *
 * `supabase/functions` : notifications poussées et e-mails.
 * `src/services/notifCopy.ts` : la copie embarquée, en `.ts` — donc invisible
 * au scanner doctrinal, qui ne lit que les `.tsx`.
 */
const PERIMETRE = [
  join(RACINE, 'supabase', 'functions'),
  join(RACINE, 'src', 'services', 'notifCopy.ts'),
];

function fichiers(chemin: string, acc: string[] = []): string[] {
  if (!statSync(chemin, { throwIfNoEntry: false })) return acc;
  if (statSync(chemin).isFile()) {
    if (/\.tsx?$/.test(chemin)) acc.push(chemin);
    return acc;
  }
  for (const e of readdirSync(chemin)) fichiers(join(chemin, e), acc);
  return acc;
}

/**
 * Retire commentaires et imports.
 *
 * Sans cela la garde se déclenche sur sa propre documentation et sur les
 * en-têtes qui CITENT le message interdit pour expliquer pourquoi il l'est.
 */
function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*import .*$/gm, '');
}

/**
 * Les chaînes RÉELLEMENT ENVOYÉES À UN HUMAIN.
 *
 * Premier jet : « tout littéral contenant une espace ». Il a accusé
 * `coach-ai-draft`, `generate-debrief-ai` et `ritual_dispatcher` — c'est-à-dire
 * exactement les trois fonctions qui APPLIQUENT la doctrine, en citant au
 * modèle les verbes qu'il ne doit jamais écrire. Une garde qui accuse le code
 * chargé de l'interdit est une garde qu'on désarme le lendemain.
 *
 * La bonne définition d'un message n'est pas « une phrase », c'est **une phrase
 * qui atterrit dans un champ d'envoi** : `title`, `body`, `subject`, `text`,
 * `html`. Une consigne adressée à un modèle va dans `system`, `prompt` ou
 * `content` : elle n'est lue par personne.
 */
const CHAMPS_ENVOI = ['title', 'body', 'subject', 'text', 'html'] as const;

function messages(source: string): string[] {
  const propre = sansCommentaires(source);
  const out: string[] = [];
  for (const champ of CHAMPS_ENVOI) {
    // `champ: '…'` et `champ = \`…\`` existent tous deux dans le dépôt.
    const motif = new RegExp(
      `\\b${champ}\\s*[:=]\\s*(['"\`])((?:\\\\.|(?!\\1)[\\s\\S])*?)\\1`,
      'g'
    );
    for (const m of propre.matchAll(motif)) {
      const s = m[2];
      if (s.includes(' ') && !/^https?:\/\//.test(s.trim())) out.push(s);
    }
  }
  return out;
}

/**
 * RÈGLES DU REGISTRE — ce qu'un message non sollicité ne dit jamais.
 *
 * Elles complètent les règles doctrinales, elles ne les remplacent pas.
 */
const REGLES_REGISTRE: { motif: RegExp; nom: string; pourquoi: string }[] = [
  {
    motif: /vous n['’]avez pas (roulé|tourné|piloté|conduit)/i,
    nom: "reproche d'absence",
    pourquoi:
      "l'exemple nommé par le plan : « vous n'avez pas roulé depuis trois mois ». " +
      "L'application montre ce qui s'est passé, elle ne compte pas les absences.",
  },
  {
    motif: /(ça fait|cela fait) (longtemps|un moment)/i,
    nom: 'reproche de durée',
    pourquoi: 'même chose, dite autrement.',
  },
  {
    motif: /on ne vous a pas vu/i,
    nom: 'reproche de présence',
    pourquoi: "l'application n'attend pas le pilote, elle l'accueille.",
  },
  {
    motif: /\b(revenez|reviens)\b/i,
    nom: 'injonction de retour',
    pourquoi: 'une invitation ne se formule pas à l’impératif.',
  },
  {
    motif: /\b(dernière chance|plus que|dépêchez)\b/i,
    nom: 'urgence fabriquée',
    pourquoi: "OXV n'invente pas de compte à rebours pour faire agir.",
  },
  {
    motif: /\b(vous ratez|vous manquez|vous perdez)\b/i,
    nom: 'peur de manquer',
    pourquoi: 'ressort marketing, contraire au ton de la maison.',
  },
];

interface Violation {
  fichier: string;
  regle: string;
  extrait: string;
}

describe('registre — ce que les notifications ne disent jamais', () => {
  const sources = PERIMETRE.flatMap((p) => fichiers(p)).map((f) => ({
    chemin: f.slice(RACINE.length + 1),
    texte: readFileSync(f, 'utf8'),
  }));

  const tousLesMessages = sources.flatMap((s) => messages(s.texte));

  it('le périmètre est réellement peuplé', () => {
    // Une garde qui ne lit aucun fichier est verte pour rien. C'est le mode
    // d'échec le plus courant de ce type de test.
    expect(sources.length).toBeGreaterThan(15);
  });

  it('elle extrait VRAIMENT des messages, et les bons', () => {
    // Compter les fichiers ne suffit pas : une extraction cassée rendrait tous
    // les contrôles verts sur un dépôt entièrement fautif. On exige donc de
    // retrouver des phrases connues, écrites à la main dans deux sources
    // différentes — l'embarquée et une fonction serveur.
    expect(tousLesMessages.length).toBeGreaterThan(8);
    expect(tousLesMessages).toContain('Une lecture posée vous attend, quand vous le souhaitez.');
    expect(tousLesMessages).toContain('Vous pouvez désormais comparer vos bilans.');
  });

  it('aucun message ne porte un verbe interdit par la doctrine', () => {
    const violations: Violation[] = [];
    for (const { chemin, texte } of sources) {
      for (const phrase of messages(texte)) {
        for (const { pattern, verb } of FORBIDDEN_PATTERNS) {
          // Les regex de la liste sont globales : on remet le curseur à zéro,
          // sans quoi une occurrence sur deux passe entre les mailles.
          pattern.lastIndex = 0;
          if (pattern.test(phrase)) {
            violations.push({ fichier: chemin, regle: verb, extrait: phrase.slice(0, 90) });
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("aucun message ne reproche une absence ni ne fabrique d'urgence", () => {
    const violations: Violation[] = [];
    for (const { chemin, texte } of sources) {
      for (const phrase of messages(texte)) {
        for (const { motif, nom } of REGLES_REGISTRE) {
          if (motif.test(phrase)) {
            violations.push({ fichier: chemin, regle: nom, extrait: phrase.slice(0, 90) });
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('la garde sait accuser un message fautif', () => {
    // Sans ce contrôle, une extraction de prose cassée rendrait les deux tests
    // ci-dessus verts sur un dépôt entièrement fautif.
    const faux = "const m = { body: 'Vous n’avez pas roulé depuis trois mois. Revenez vite.' };";
    const phrases = messages(faux);
    expect(phrases).toHaveLength(1);
    const touchee = REGLES_REGISTRE.filter((r) => phrases.some((p: string) => r.motif.test(p)));
    expect(touchee.map((r) => r.nom).sort()).toEqual(
      ['injonction de retour', "reproche d'absence"].sort()
    );
  });

  it('ne lit PAS les consignes adressées à un modèle', () => {
    // `coach-ai-draft` cite les verbes interdits pour les proscrire au modèle.
    // Ce texte va dans `system`, jamais sous les yeux d'un pilote.
    const consigne =
      'const p = { system: \'INTERDITS absolus : "freinez", "accélérez", "il faut".\' };';
    expect(messages(consigne)).toEqual([]);
  });

  it('la garde ignore un interdit CITÉ dans un commentaire', () => {
    const avecCommentaire = [
      '/**',
      " * Ne jamais écrire « vous n'avez pas roulé depuis trois mois ».",
      ' */',
      "const t = { body: 'Votre bilan est prêt.' };",
    ].join('\n');
    const phrases = messages(avecCommentaire);
    expect(phrases.some((p) => REGLES_REGISTRE.some((r) => r.motif.test(p)))).toBe(false);
  });
});
