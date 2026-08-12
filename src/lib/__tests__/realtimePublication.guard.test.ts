/**
 * GARDE — aucun abonnement `postgres_changes` ne doit promettre du temps réel
 * sur une table qui n'est pas publiée.
 *
 * ===========================================================================
 * LE DÉFAUT QUE CETTE GARDE FIGE
 * ===========================================================================
 *
 * `useCoachThread` s'abonnait à `coach_messages` et son en-tête affirmait
 * qu'« un nouveau message apparaît sans refetch ». La table n'est pas dans la
 * publication `supabase_realtime` — vérifié en production le 12/08/2026, où
 * seules `telemetry_sessions` et `coach_annotations` y figurent.
 *
 * Un abonnement sur une table non publiée rejoint le canal, passe
 * `SUBSCRIBED`, et ne reçoit JAMAIS rien. **Aucune erreur n'est levée.** C'est
 * un silence, pas une panne : ni le développeur ni l'utilisateur ne voient
 * quoi que ce soit d'anormal, et le fil semble simplement « pas très réactif ».
 *
 * ===========================================================================
 * CE QUE CETTE GARDE PEUT, ET CE QU'ELLE NE PEUT PAS
 * ===========================================================================
 *
 * Elle ne peut pas interroger la base : ces tests tournent sans réseau. Elle
 * tient donc une LISTE TENUE À LA MAIN de ce qui est publié, et exige que tout
 * abonnement porte sur une table de cette liste — ou déclare explicitement
 * qu'il sait qu'elle ne l'est pas.
 *
 * La liste peut vieillir. C'est assumé : elle vieillit dans le sens sûr. Si
 * une table est publiée sans que la liste suive, la garde échoue et quelqu'un
 * la met à jour. Si une table est DÉ-publiée, la garde ne le voit pas — mais
 * dé-publier n'arrive pas par accident, alors que s'abonner à une table jamais
 * publiée arrive, et est arrivé.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { sync as glob } from 'glob';

/**
 * Les tables réellement dans `supabase_publication` au 12/08/2026.
 *
 * Relevé, pas supposé :
 *   select tablename from pg_publication_tables where pubname='supabase_realtime'
 */
const PUBLIEES = ['telemetry_sessions', 'coach_annotations'];

/**
 * Les abonnements qui SAVENT que leur table n'est pas publiée.
 *
 * Y figurer n'est pas une dispense : c'est une déclaration. Le fichier doit
 * dire, dans son texte, que le canal est muet aujourd'hui et par quel autre
 * mécanisme il tient sa fraîcheur.
 */
const ASSUMES: Record<string, string> = {
  'src/hooks/useCoachThread.ts': 'coach_messages',
  'src/services/liveRelayRunner.ts': 'coach_pilots',
};

const RACINE = process.cwd();

function fichiersSource(): string[] {
  return glob('{src,app}/**/*.{ts,tsx}', { cwd: RACINE, ignore: ['**/__tests__/**'] });
}

/** Tables citées dans un `postgres_changes` — `table: '<nom>'`. */
function tablesAbonnees(source: string): string[] {
  if (!source.includes('postgres_changes')) return [];
  const noms: string[] = [];
  const re = /table:\s*'([a-z0-9_]+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) noms.push(m[1]);
  return noms;
}

describe('garde — un abonnement temps réel porte sur une table publiée', () => {
  const trouves = fichiersSource()
    .map((f) => ({ f, tables: tablesAbonnees(readFileSync(join(RACINE, f), 'utf8')) }))
    .filter((x) => x.tables.length > 0);

  it('au moins un abonnement existe — sinon cette garde ne garde rien', () => {
    // Une garde qui ne trouve aucun sujet est verte par vacuité. C'est le
    // même défaut qu'elle poursuit, un étage plus haut.
    expect(trouves.length).toBeGreaterThan(0);
  });

  it('chaque table abonnée est publiée, ou assumée non publiée', () => {
    const fautifs: string[] = [];
    for (const { f, tables } of trouves) {
      const normalise = f.replace(/\\/g, '/');
      for (const t of tables) {
        if (PUBLIEES.includes(t)) continue;
        if (ASSUMES[normalise] === t) continue;
        fautifs.push(`${normalise} → ${t}`);
      }
    }
    // Message parlant : la liste des couples fautifs, pas un simple `false`.
    expect(fautifs).toEqual([]);
  });

  it('un abonnement assumé DIT qu’il est muet, il ne se contente pas d’être listé', () => {
    for (const [fichier, table] of Object.entries(ASSUMES)) {
      const src = readFileSync(join(RACINE, fichier), 'utf8');
      // Le nom de la table, et le fait qu'elle n'est pas publiée.
      expect(src).toContain(table);
      expect(src).toMatch(/n['’]est pas publiée|pas dans la publication|non publiée/i);
    }
  });

  /**
   * LE CAS LE PLUS GRAVE TROUVÉ PAR CETTE GARDE.
   *
   * `liveRelayRunner` écoutait `coach_pilots` pour couper le direct quand un
   * pilote retire son consentement EN SÉANCE, sous un commentaire affirmant
   * que « Coupez quand vous voulez est tenu en vol ». La table n'étant pas
   * publiée, le retrait ne coupait rien : le pilote continuait d'être diffusé
   * à son coach jusqu'à la fin du run.
   *
   * La promesse est désormais tenue par une réconciliation périodique. Ce test
   * exige qu'elle existe et qu'elle soit bornée — un abonnement muet seul ne
   * suffit plus.
   */
  it('le relais direct réconcilie le consentement sans dépendre du temps réel', () => {
    const src = readFileSync(join(RACINE, 'src', 'services', 'liveRelayRunner.ts'), 'utf8');
    expect(src).toContain('RECONCILIATION_MS');
    expect(src).toMatch(/setInterval\(\s*reconcilier/);
    // Nettoyée à l'arrêt : un relais coupé ne doit pas continuer d'interroger.
    expect(src).toContain('clearInterval(consentTimer)');
    // Une panne réseau NE COUPE PAS le direct — sinon il devient inutilisable
    // au circuit, et une panne n'est pas un retrait de consentement.
    expect(src).toMatch(/\.catch\(\(\) => \{[\s\S]{0,200}on ne coupe pas/);
  });

  /**
   * LA RÈGLE QUI COMPTE : `SUBSCRIBED` ne prouve rien. Il dit que le canal est
   * rejoint, pas qu'un événement arrivera. Annoncer « en direct » sur cette
   * base, c'est exactement l'erreur d'origine.
   */
  it('useCoachThread ne lève son drapeau qu’après RÉCEPTION', () => {
    const src = readFileSync(join(RACINE, 'src', 'hooks', 'useCoachThread.ts'), 'utf8');
    expect(src).toContain('setTempsReel(true)');
    // Une seule levée dans tout le fichier, et elle est dans le gestionnaire
    // d'événement — jamais dans un `.subscribe((statut) => …)`.
    expect(src.match(/setTempsReel\(true\)/g) ?? []).toHaveLength(1);
    expect(src).not.toMatch(/SUBSCRIBED[\s\S]{0,120}setTempsReel\(true\)/);
  });
});
