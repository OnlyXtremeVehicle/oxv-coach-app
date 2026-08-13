/**
 * PEUT-ON APPELER `measure` SUR CE REF SANS TUER L'APPLICATION ?
 *
 * ===========================================================================
 * POURQUOI CETTE DÉCISION VIT DANS SON PROPRE FICHIER
 * ===========================================================================
 *
 * Elle était écrite en ligne dans le worklet de `useFirstViewport`, et elle
 * était FAUSSE — `ref.current === null`, une condition qui ne peut pas être
 * vraie sur le fil UI. Personne ne s'en est aperçu parce que rien ne
 * l'exécutait : les tests de ce dépôt tournent en environnement `node`, et le
 * « test » qui la couvrait comparait deux positions de chaîne dans le fichier
 * source. Il serait resté vert si la condition avait dit `=== 'bleu'`.
 *
 * Sortie ici, la décision devient une fonction pure qu'un test peut APPELER,
 * avec les valeurs que Reanimated produit réellement. C'est la seule différence
 * qui compte entre une garde et une garde armée.
 *
 * ===========================================================================
 * CE QUE `measure` NE PROTÈGE PAS, ET QU'IL FAUT DONC PROTÉGER ICI
 * ===========================================================================
 *
 * `measure(animatedRef)` commence par `const viewTag = animatedRef();` puis ne
 * teste QUE `viewTag === -1`. Un ref jamais attaché rend `null` : la valeur
 * traverse, l'appel descend en natif, `shadowNodeFromValue` fait `asObject()`
 * sur une valeur nulle et lève une `JSIException`. Émise depuis un frame
 * callback du fil UI, elle n'est rattrapée par personne — en build release il
 * n'y a même pas de `callGuard`. **Elle tue l'application.**
 *
 * C'est ce qui faisait planter l'écran Data à chaque ouverture le 13/08/2026.
 *
 * ===========================================================================
 * LA PROPRIÉTÉ QUE L'ON EXPLOITE, ET SON PIÈGE
 * ===========================================================================
 *
 * Sur le fil UI, un `AnimatedRef` n'est PAS l'objet JS qu'on manipule côté
 * React : `useAnimatedRef` place dans `serializableMappingCache` un handle dont
 * l'`__init` rend `() => sharedWrapper.value`. Le worklet reçoit donc une
 * FONCTION, qu'on appelle pour obtenir le tag de vue.
 *
 * Le piège est qu'une fonction fléchée n'a pas de propriété `current` : toute
 * garde écrite sur `ref.current` lit `undefined` et ne se déclenche jamais.
 * Et même côté JS elle serait fausse après démontage — `useAnimatedRef`
 * n'affecte `fun.current` que dans `if (ref)`, la propriété conserve donc
 * l'ANCIENNE vue quand React passe `null`.
 *
 * On lit donc exactement ce que `measure` lit, et on refuse ce qu'il accepte
 * à tort.
 */

/**
 * Le tag qu'un `AnimatedRef` rend sur le fil UI.
 *
 * `null` : la vue n'a jamais été attachée.
 * `-1`   : Reanimated signale lui-même un ref inutilisable.
 * nombre : un tag de vue exploitable.
 */
export type TagDeVue = number | null | undefined;

/**
 * Vrai si `measure` peut être appelé sur ce tag sans faire tomber le processus.
 *
 * `'worklet'` : appelée depuis le fil UI. La directive est explicite — hors
 * appel direct, le greffon Babel ne workletise plus automatiquement.
 */
export function tagMesurable(tag: TagDeVue): boolean {
  'worklet';
  if (tag === null || tag === undefined) return false;
  if (tag === -1) return false;
  // Un tag doit être un entier fini. `NaN` traverserait les deux tests
  // ci-dessus et descendrait en natif exactement comme `null`.
  return typeof tag === 'number' && Number.isFinite(tag);
}
