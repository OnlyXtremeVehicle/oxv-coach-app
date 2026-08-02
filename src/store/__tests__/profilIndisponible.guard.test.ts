/**
 * L'INCONNU N'EST PAS UN REFUS.
 *
 * ---
 *
 * CE QUI ÉTAIT EN PLACE
 *
 * `profile === null` avait DEUX sens confondus dans tout le dépôt : « ce compte
 * n'a pas encore de fiche » et « je n'ai pas pu lire sa fiche ». Trois seuils
 * tiraient la même conclusion du second :
 *
 *   • `app/index.tsx` renvoyait vers l'onboarding pilote ;
 *   • `app/(admin)/_layout.tsx` redirigeait vers l'espace pilote ;
 *   • `app/(coach)/_layout.tsx` rendait un écran noir.
 *
 * Le chemin était ordinaire, pas exotique : `onAuthStateChange` recharge le
 * profil à CHAQUE rafraîchissement de jeton — toutes les heures — et écrasait
 * un profil valide par `null` dès que la lecture échouait. Sur le réseau d'un
 * circuit, un administrateur en plein pointage se retrouvait éjecté sans un
 * mot, sa porte de retour ayant disparu au même instant. Il ne restait qu'à
 * tuer l'application.
 *
 * ---
 *
 * CE QUE CES TESTS PROTÈGENT
 *
 * Deux invariants, l'un de comportement, l'autre de structure.
 *
 * Ils ne remplacent pas un essai sur appareil : couper le réseau en pleine
 * séance reste la seule preuve complète. Ils garantissent que la distinction ne
 * peut pas se perdre en silence dans un futur remaniement.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const RACINE = join(__dirname, '..', '..', '..');

function source(chemin: string): string {
  return readFileSync(join(RACINE, chemin), 'utf8');
}

describe('le magasin distingue l’échec de l’absence', () => {
  const store = source('src/store/useAuthStore.ts');

  it('l’état porte la distinction', () => {
    expect(store).toContain('profilIndisponible: boolean;');
  });

  it('une lecture en échec ne détruit pas le profil déjà connu', () => {
    // Le rafraîchissement de jeton est le chemin par lequel l'expulsion se
    // produisait. Un jeton renouvelé ne change pas qui est la personne.
    expect(store).toContain('profile: lu.echec ? get().profile : lu.profil');
  });

  it('une fiche réellement absente n’est PAS signalée comme une panne', () => {
    // Sans cette branche, l'onboarding deviendrait inatteignable : tout nouveau
    // compte tomberait sur « votre compte n'a pas pu être lu ».
    expect(store).toContain('return { profil: null, echec: false }');
  });

  it('une erreur de lecture EST signalée comme une panne', () => {
    expect(store).toContain('return { profil: null, echec: true }');
  });
});

describe('les trois seuils ne confondent plus', () => {
  // Chacun décidait sur `profile` seul. Le test exige qu'ils consultent
  // l'indicateur AVANT de conclure — une garde qui ne lit pas son signal ne se
  // déclenche jamais.
  const SEUILS = ['app/index.tsx', 'app/(admin)/_layout.tsx', 'app/(coach)/_layout.tsx'];

  it.each(SEUILS)('%s consulte profilIndisponible', (chemin) => {
    const src = source(chemin);
    expect(src).toContain('profilIndisponible');
    expect(src).toContain('ProfilIndisponible');
  });
});

describe('la porte vers l’espace admin ne dépend pas d’une lecture qui peut rater', () => {
  const vous = source('app/(app2)/vous/index.tsx');

  it('le sélecteur d’espace est monté une seule fois', () => {
    expect(vous.split('<SpaceSwitcher current="pilot" />').length - 1).toBe(1);
  });

  it('il est posé APRÈS le ternaire d’état du hub, pas dedans', () => {
    // Première version : à l'intérieur de la branche `ready`. La porte
    // disparaissait donc avec la première erreur de `useVousHub` — exactement
    // quand le réseau flanche, le jour où l'administrateur en a besoin.
    const porte = vous.indexOf('<SpaceSwitcher current="pilot" />');
    const finDuTernaire = vous.indexOf('</Animated.ScrollView>');
    expect(porte).toBeGreaterThan(-1);
    expect(finDuTernaire).toBeGreaterThan(-1);
    expect(porte).toBeLessThan(finDuTernaire);
    // Et surtout : hors du bloc `styles.body`, qui n'existe que dans `ready`.
    const corps = vous.indexOf('<View style={styles.body}>');
    const finCorps = vous.indexOf('</View>', vous.indexOf('</Stagger>'));
    expect(porte > corps && porte < finCorps).toBe(false);
  });
});

describe('le sélecteur ne propose aucun espace inaccessible', () => {
  const sw = source('src/components/SpaceSwitcher.tsx');

  it('ne propose pas l’espace coach', () => {
    // Il ne s'affiche que pour `role === 'admin'`, et le seuil coach renvoie
    // tout `role !== 'coach'`. La cible menait donc systématiquement à un refus.
    expect(sw).not.toContain("space: 'coach'");
  });

  it('le seuil coach refuse bien tout autre rôle — la raison du retrait', () => {
    expect(source('app/(coach)/_layout.tsx')).toContain("profile.role !== 'coach'");
  });
});
