/**
 * Simulacre de react-native-mmkv pour Jest.
 *
 * La v3 repose sur un module natif (Nitro) : `new MMKV()` echoue sous Jest, qui
 * tourne en environnement node sans natif. La v2 le tolerait — d'ou l'apparition
 * de cet echec a la migration T0, sans qu'aucune ligne de production ait bouge.
 *
 * Le simulacre reproduit le CONTRAT reellement utilise par `src/lib/mmkv.ts` :
 * un magasin cle-valeur synchrone. Il est deliberement en memoire et remis a zero
 * par instance — un test ne doit rien heriter d'un autre.
 *
 * Jest le charge automatiquement : ce dossier `__mocks__` est adjacent a
 * `node_modules`, ce qui suffit pour les paquets tiers, sans appel a `jest.mock`.
 */

type Valeur = string | number | boolean | Uint8Array;

export class MMKV {
  private readonly magasin = new Map<string, Valeur>();

  /** L'identifiant est accepte et ignore : un magasin par instance suffit ici. */
  constructor(_config?: { id?: string; path?: string; encryptionKey?: string }) {}

  set(cle: string, valeur: Valeur): void {
    this.magasin.set(cle, valeur);
  }

  getString(cle: string): string | undefined {
    const v = this.magasin.get(cle);
    return typeof v === 'string' ? v : undefined;
  }

  getNumber(cle: string): number | undefined {
    const v = this.magasin.get(cle);
    return typeof v === 'number' ? v : undefined;
  }

  getBoolean(cle: string): boolean | undefined {
    const v = this.magasin.get(cle);
    return typeof v === 'boolean' ? v : undefined;
  }

  contains(cle: string): boolean {
    return this.magasin.has(cle);
  }

  delete(cle: string): void {
    this.magasin.delete(cle);
  }

  getAllKeys(): string[] {
    return [...this.magasin.keys()];
  }

  clearAll(): void {
    this.magasin.clear();
  }

  /** Aucun ecouteur n'est declenche : rien dans le depot n'en depend. */
  addOnValueChangedListener(_ecouteur: (cle: string) => void): { remove: () => void } {
    return { remove: () => {} };
  }
}
