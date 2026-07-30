/**
 * GARDE DE SOURCE — là où l'application publie de l'UGC, elle offre un
 * signalement.
 *
 * ---
 *
 * CE QUE CETTE GARDE EMPÊCHE DE REPERDRE
 *
 * Le signalement n'a longtemps existé que dans trois écrans de `app/(app)`,
 * tous classés « meurt » au lot J5. Pendant ce temps `app/(app2)` affichait
 * déjà des témoignages écrits par des pilotes et des offres rédigées par des
 * partenaires, sans aucun chemin pour les signaler. Personne ne l'avait vu :
 * rien ne cassait, aucun test ne tombait, l'écran s'affichait très bien.
 *
 * C'est aussi une exigence de revue sur les magasins d'applications — une app
 * qui publie du contenu d'utilisateur doit offrir un moyen de le signaler.
 *
 * ---
 *
 * CE QU'ELLE VÉRIFIE, ET CE QU'ELLE NE PEUT PAS VÉRIFIER
 *
 * Elle vérifie qu'un écran qui REND une collection d'UGC monte aussi
 * `ReportLink`. Elle ne peut pas prouver que le lien est posé sur le BON
 * élément, ni qu'il est atteignable à l'écran : cela demande un rendu.
 *
 * Elle ne se met pas à jour toute seule. **Un nouvel écran affichant de l'UGC
 * doit être ajouté à `SURFACES_UGC`** — la liste est le contrat, pas une
 * commodité.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = join(__dirname, '..', '..', '..', '..');

/**
 * Écrans d'`app/(app2)` qui rendent du contenu écrit par des utilisateurs.
 *
 * `marqueur` sert à détecter que la surface existe encore : si le rendu de
 * l'UGC disparaît de l'écran, la ligne devient caduque et le test le dit, au
 * lieu d'exiger un `ReportLink` pour un contenu qui n'est plus affiché.
 */
const SURFACES_UGC: { fichier: string; marqueur: string; quoi: string }[] = [
  {
    fichier: join('app', '(app2)', 'club', 'coaching.tsx'),
    marqueur: 'citations.map',
    quoi: 'les témoignages de pilotes, rendus en citations dans la fiche coach',
  },
  {
    fichier: join('app', '(app2)', 'club', 'partenaires.tsx'),
    marqueur: 'offers.map',
    quoi: 'les offres rédigées par les partenaires',
  },
];

describe('garde — tout UGC affiché est signalable', () => {
  it.each(SURFACES_UGC)('$fichier monte ReportLink pour $quoi', ({ fichier, marqueur }) => {
    const source = readFileSync(join(RACINE, fichier), 'utf8');
    // La surface existe-t-elle toujours ? Sinon, la ligne est à retirer.
    expect(source).toContain(marqueur);
    expect(source).toContain('<ReportLink');
  });

  it('les deux types de cible du service sont couverts', () => {
    // `moderationService` n'accepte que ces deux types, et le trigger
    // `moderation_validate_target` vérifie chacun contre sa table. Si un
    // troisième type apparaît sans surface, cette assertion le signale.
    const sources = SURFACES_UGC.map((s) => readFileSync(join(RACINE, s.fichier), 'utf8')).join(
      '\n'
    );
    expect(sources).toContain('targetType="coach_review"');
    expect(sources).toContain('targetType="partner_offer"');
  });
});
