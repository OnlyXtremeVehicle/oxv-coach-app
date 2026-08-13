/**
 * Petits multiples — le profil de chaque séance, tous sous la même échelle.
 *
 * La grille ne vaut que par ce qu'elle annonce : **l'échelle commune est écrite
 * au-dessus**. Sans elle, une grille aplatie par un tour de sortie de stand se
 * lit comme une saison sans relief, et le pilote n'a aucun moyen de le savoir.
 * Avec elle, il voit l'étendue et comprend l'aplatissement.
 *
 * Le calcul vit dans `petitsMultiplesLogic.ts` — et c'est là qu'est vérifié le seul
 * point qui fasse la différence entre un petit multiple et une vignette :
 * l'échelle est partagée, pas recalculée panneau par panneau.
 *
 * Une séance qui n'a pas deux tours ne rend pas une ligne plate : elle le DIT.
 * Une ligne horizontale au milieu d'un cadre est une affirmation de régularité
 * parfaite, et ce serait faux.
 */

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';

import { StateView, colors, msToLapLabel, radius, space, typo } from '@/ui/v2';
import {
  construirePanneaux,
  dernieresSeances,
  domaineCommun,
  type SerieSeance,
} from './petitsMultiplesLogic';

/** Trois par ligne : au-delà, le tracé n'a plus assez de largeur pour dire quoi que ce soit. */
const COLONNES = 3;
const HAUTEUR_TRACE = 44;
const PAD_TRACE = 3;

export interface PetitsMultiplesProps {
  /** Les séances, de la plus ANCIENNE à la plus récente. */
  series: readonly SerieSeance[];
  /** Largeur utile de la colonne de contenu. */
  width: number;
}

export function PetitsMultiples({ series, width }: PetitsMultiplesProps) {
  const gap = space.sm;
  const largeurPanneau = Math.max(1, (width - gap * (COLONNES - 1)) / COLONNES);
  const largeurTrace = Math.max(1, largeurPanneau - space.sm * 2);

  // La coupe est faite AVANT le domaine : l'échelle annoncée doit être celle
  // des panneaux affichés, sinon elle décrit des séances qu'on ne voit pas.
  const { retenues, total } = useMemo(() => dernieresSeances(series), [series]);

  const domaine = useMemo(() => domaineCommun(retenues), [retenues]);

  const panneaux = useMemo(
    () =>
      domaine ? construirePanneaux(retenues, domaine, largeurTrace, HAUTEUR_TRACE, PAD_TRACE) : [],
    [retenues, domaine, largeurTrace]
  );

  if (!domaine || panneaux.length === 0) {
    return (
      <StateView
        state="empty"
        emptyMessage="Pas encore assez de tours pour poser vos séances côte à côte."
      />
    );
  }

  return (
    <View>
      {/* L'échelle annoncée — c'est elle qui rend la grille honnête. */}
      <Text style={styles.echelle}>
        Échelle commune · {msToLapLabel(domaine.minMs)} → {msToLapLabel(domaine.maxMs)}
      </Text>

      {/* Une grille tronquée qui ne le dit pas se lit comme une saison entière. */}
      {total > panneaux.length ? (
        <Text style={styles.coupe}>
          Vos {panneaux.length} dernières séances, sur {total}.
        </Text>
      ) : null}

      <View style={[styles.grille, { gap }]}>
        {panneaux.map((p) => (
          <View
            key={p.sessionId}
            style={[styles.panneau, { width: largeurPanneau }]}
            accessible
            accessibilityLabel={
              p.tours >= 2
                ? `${p.libelle}, ${p.tours} tours, meilleur ${msToLapLabel(p.meilleurMs ?? Number.NaN)}`
                : `${p.libelle}, ${p.tours === 1 ? 'un seul tour' : 'aucun tour'} — pas de profil`
            }
          >
            {p.chemin !== '' ? (
              <Svg width={largeurTrace} height={HAUTEUR_TRACE}>
                <SvgPath
                  d={p.chemin}
                  stroke={colors.qdi.regularite}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  fill="none"
                />
              </Svg>
            ) : (
              <View style={[styles.sansTrace, { width: largeurTrace, height: HAUTEUR_TRACE }]}>
                <Text style={styles.sansTraceTexte}>{p.tours === 1 ? '1 tour' : 'aucun tour'}</Text>
              </View>
            )}

            <Text style={styles.libelle} numberOfLines={1}>
              {p.libelle}
            </Text>
            <Text style={styles.meilleur}>
              {p.meilleurMs !== null ? msToLapLabel(p.meilleurMs) : '—'}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.legende}>
        Un panneau, une séance. Le tour le plus rapide de la saison est en haut du cadre : une ligne
        qui descend est une série de tours plus longs.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  echelle: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.text.low,
    marginBottom: space.sm,
  },
  coupe: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.low,
    marginBottom: space.sm,
  },
  grille: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  panneau: {
    backgroundColor: colors.bg.card2,
    borderRadius: radius.cell,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
  },
  sansTrace: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sansTraceTexte: {
    fontFamily: typo.body,
    fontSize: 11,
    color: colors.text.dim,
  },
  libelle: {
    fontFamily: typo.body,
    fontSize: 11,
    color: colors.text.mid,
    marginTop: space.xs,
  },
  meilleur: {
    fontFamily: typo.mono,
    fontSize: 12,
    color: colors.text.hi,
  },
  legende: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.low,
    marginTop: space.sm,
  },
});
