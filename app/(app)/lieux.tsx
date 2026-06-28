/**
 * Coquille de redirection — fusion territoire (décision Gabin 2026-06).
 *
 * Le modèle `places` (partners/lodgings/restaurants) est déprécié au profit de
 * `social_pings` ; la découverte du territoire vit dans `carte-oxv`, l'écran
 * UNIQUE (carte + liste). Coquille conservée pour deep-links / liens
 * historiques. Voir `roadmap/rapports/pr-08-fusion-carte-oxv.md`.
 */

import { Redirect } from 'expo-router';

export default function LieuxScreen() {
  return <Redirect href={'/(app)/carte-oxv' as never} />;
}
