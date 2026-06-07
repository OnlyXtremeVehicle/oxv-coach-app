/**
 * Page Next.js /circuit — Surface 1 OXV.
 *
 * Vitrine publique du Circuit Beltoise de Haute Saintonge. Sert de point
 * de repère visuel partagé avec l'app mobile (bilan pilote, vue coach).
 *
 * Doctrine OXV : vouvoiement, pas d'emojis, pas de marketing creux,
 * pas de verbes d'instruction. La page décrit, ne vend pas.
 */

import type { Metadata } from 'next';

import { PublicPreset } from '@/components/CircuitMap';
import { BELTOISE_CORNERS } from '@/data/circuitTopology';
import { HAUTE_SAINTONGE_CIRCUIT } from '@/data/hauteSaintonge';

import styles from '@/styles/circuit.module.css';

export const metadata: Metadata = {
  title: 'Circuit Beltoise — Haute Saintonge | OXV',
  description:
    'Tracé du circuit Beltoise de Haute Saintonge : 7 virages, ' +
    `${HAUTE_SAINTONGE_CIRCUIT.totalLengthM} mètres. Cartographie OXV.`,
};

export default function CircuitPage() {
  const lengthKm = (HAUTE_SAINTONGE_CIRCUIT.totalLengthM / 1000).toFixed(2);

  return (
    <main className={styles.page}>
      <article className={styles.container}>
        <header>
          <p className={styles.eyebrow}>Circuit</p>
          <h1 className={styles.title}>{HAUTE_SAINTONGE_CIRCUIT.name}</h1>
          <p className={styles.subtitle}>
            Tracé Beltoise. {BELTOISE_CORNERS.length} virages, {lengthKm} kilomètres.
          </p>
        </header>

        <div className={styles.mapWrapper}>
          <PublicPreset animate height={460} />
        </div>

        <section className={styles.factsGrid} aria-label="Caractéristiques du circuit">
          <div>
            <p className={styles.factLabel}>Longueur</p>
            <p className={styles.factValue}>
              {lengthKm}
              <span className={styles.factUnit}>km</span>
            </p>
          </div>
          <div>
            <p className={styles.factLabel}>Virages</p>
            <p className={styles.factValue}>{BELTOISE_CORNERS.length}</p>
          </div>
          <div>
            <p className={styles.factLabel}>Localisation</p>
            <p className={styles.factValue} style={{ fontSize: '18px' }}>
              Charente-Maritime
            </p>
          </div>
        </section>

        <section className={styles.section} aria-label="Présentation du tracé">
          <h2 className={styles.sectionTitle}>Lecture du tracé</h2>
          <p className={styles.body}>
            Le tracé Beltoise alterne deux longues lignes droites et sept virages aux profils
            contrastés. La flèche rouge en début de tracé indique le sens de circulation. Les
            disques numérotés marquent les points de corde de chaque virage.
          </p>
          <p className={styles.body}>
            La topologie comporte deux épingles (virages 3 et 6) qui demandent une attention
            particulière aux repères de freinage, encadrées par des courbes plus rapides où la
            lecture du virage compte davantage que la vitesse de passage.
          </p>
        </section>

        <section className={styles.section} aria-label="Liste des virages">
          <h2 className={styles.sectionTitle}>Les sept virages</h2>
          <ul className={styles.cornerList}>
            {BELTOISE_CORNERS.map((corner) => (
              <li key={corner.index} className={styles.cornerItem}>
                <span className={styles.cornerBadge}>{corner.index}</span>
                <span className={styles.cornerName}>{corner.name}</span>
                <span className={styles.cornerPace}>{paceLabel(corner.pace)}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className={styles.footer}>
          <p className={styles.footerLine}>
            Coordonnées GPS du tracé issues de{' '}
            <a
              href="https://www.openstreetmap.org/way/54412766"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenStreetMap (way 54412766)
            </a>
            , © contributeurs OpenStreetMap.
          </p>
          <p className={styles.footerLine}>
            Cette carte est partagée avec l'application mobile OXV Mirror et ses vues coach. Toute
            évolution topologique se propage simultanément aux trois surfaces.
          </p>
        </footer>
      </article>
    </main>
  );
}

function paceLabel(pace: 'fast' | 'medium' | 'slow'): string {
  switch (pace) {
    case 'fast':
      return 'Courbe rapide';
    case 'medium':
      return 'Virage moyen';
    case 'slow':
      return 'Épingle';
  }
}
