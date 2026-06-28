/**
 * Coquille de redirection — fusion territoire (décision Gabin 2026-06).
 *
 * L'ancien écran « Social » (liste des `social_pings`) est désormais la vue
 * Liste de `carte-oxv`, l'écran UNIQUE du territoire. Cette route subsiste comme
 * coquille pour les deep-links / liens historiques.
 * Voir `roadmap/rapports/pr-08-fusion-carte-oxv.md`.
 */

import { Redirect } from 'expo-router';

export default function SocialScreen() {
  return <Redirect href={'/(app)/carte-oxv' as never} />;
}
