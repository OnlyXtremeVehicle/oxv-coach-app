/**
 * Coquille de redirection — fusion territoire (décision Gabin 2026-06).
 *
 * L'ancienne vue carte sociale est désormais la vue Carte de `carte-oxv`,
 * l'écran UNIQUE du territoire. Coquille conservée pour deep-links / liens
 * historiques. Voir `roadmap/rapports/pr-08-fusion-carte-oxv.md`.
 */

import { Redirect } from 'expo-router';

export default function SocialCarteScreen() {
  return <Redirect href={'/(app)/carte-oxv' as never} />;
}
