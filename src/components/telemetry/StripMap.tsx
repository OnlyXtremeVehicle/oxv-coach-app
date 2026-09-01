/**
 * STRIP MAP — le tour déroulé, et le tracé comme règle graduée.
 *
 * *« Dérouler le tracé fermé en un axe distance droit, en préservant la
 * position curviligne, pour empiler les bandes de grandeurs. »* — banque de
 * télémétrie V3, forme 3.
 *
 * ---
 *
 * LA RÈGLE, C'EST LE RUBAN DU HAUT
 *
 * Il s'épaissit dans les virages et s'amincit dans les droites. On y reconnaît
 * son circuit sans lire un seul chiffre — et les bandes empilées dessous, qui
 * partagent le même axe, se situent d'un coup d'œil. Un axe en mètres ne
 * permettait pas ça : personne ne connaît son circuit en mètres.
 *
 * Le ruban ne montre PAS le sens des virages. `app_segment_analyses` ne porte
 * pas de gauche/droite, et la seule source qui en porterait est propre à un
 * circuit codé en dur, que ce dépôt retire. Un ruban qui inventerait le sens
 * serait plus joli et faux.
 *
 * ---
 *
 * LES DEUX BANDES SUIVENT LA CONVENTION DÉJÀ POSÉE
 *
 * `BarresG`, dans le même écran, peint le freinage en `qdi.freinage` et
 * l'accélération en `qdi.acceleration`. On ne fabrique donc aucune teinte : le
 * G latéral prend `qdi.trajectoire` — c'est la grandeur de la trajectoire —,
 * le G de freinage garde `qdi.freinage`.
 *
 * ---
 *
 * LE SIGNE A ÉTÉ VÉRIFIÉ, PAS SUPPOSÉ
 *
 * Une barre haute doit vouloir dire « on a beaucoup freiné ». Si le freinage
 * était stocké en décélération négative, la bande dessinerait ses plus grandes
 * barres là où le pilote a freiné le MOINS — une inversion invisible à la
 * relecture et flagrante en piste.
 *
 * Les deux écrivains ont été confrontés : `captureFrameMapping` pose
 * `Math.max(0, gForceX)` et `Math.abs(gForceY)` ; `trackviz/analysis` pose
 * `g_force_x > 0 ? g_force_x : 0` et `Math.abs(g_force_y)`. Les trois grandeurs
 * arrivent donc en MAGNITUDE POSITIVE, et les deux sources s'accordent. Rien à
 * redresser ici — et c'est écrit pour que la prochaine lecture n'ait pas à
 * refaire l'enquête.
 *
 * ---
 *
 * CE QUI N'EST PAS MESURÉ RESTE VIDE
 *
 * Un segment sans valeur ne rend aucune barre : le fond de bande reste nu.
 * Une barre de hauteur nulle se lirait comme un minimum mesuré, et c'est la
 * confusion que ce dépôt s'interdit partout — absence n'est pas zéro.
 *
 * La couverture est écrite en toutes lettres : une bande pleine sur un tour
 * analysé aux deux tiers serait un faux.
 */

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { StateView, colors, radius, space, typo } from '@/ui/v2';
import {
  construireStrip,
  normaliserBande,
  type CaseStrip,
  type SegmentSituable,
} from '@/features/data/stripMapLogic';
import type { RepereApex } from '@/features/data/viragesCircuit';

/** Hauteurs du ruban selon ce que le tracé fait à cet endroit. */
const RUBAN_H = 22;
const EPAISSEUR_VIRAGE = 22;
const EPAISSEUR_DROITE = 6;
const EPAISSEUR_INCONNU = 12;

const BANDE_H = 36;

/** En dessous, un nom de virage chevaucherait son voisin. */
const LARGEUR_MIN_ETIQUETTE = 34;

export interface StripMapSegment extends SegmentSituable {
  maxGLateral: number | null;
  maxGBraking: number | null;
}

export interface StripMapProps {
  segments: readonly StripMapSegment[];
  /**
   * Les virages DU CIRCUIT, situés à leur corde.
   *
   * Ils ne remplacent pas les segments : ils prennent le relais quand aucune
   * analyse n'a tourné. `app_segment_analyses` est vide sur toute séance réelle
   * à ce jour, et le ruban affichait donc « le tour n'a pas encore été découpé »
   * sur un circuit dont la base porte pourtant douze virages mesurés.
   *
   * Un repère n'a PAS de longueur — voir `reperesApex`. Le ruban montre alors
   * où sont les virages et se tait sur leur étendue.
   */
  apexes?: readonly RepereApex[];
  /** Largeur utile — l'axe complet représente un tour. */
  width: number;
}

function epaisseurDe(genre: CaseStrip['genre']): number {
  if (genre === 'turn' || genre === 'chicane') return EPAISSEUR_VIRAGE;
  if (genre === 'straight') return EPAISSEUR_DROITE;
  return EPAISSEUR_INCONNU;
}

/** `1,24` — virgule décimale, comme partout dans l'app. */
function g(v: number): string {
  return Math.abs(v).toFixed(2).replace('.', ',');
}

function pct(v: number): string {
  return `${Math.round(v * 100)}`;
}

export function StripMap({ segments, apexes = [], width }: StripMapProps) {
  const strip = useMemo(() => construireStrip(segments), [segments]);

  /** Valeur d'un segment, retrouvée par son index — les cases n'en portent pas. */
  const valeurParIndex = useMemo(() => {
    const lat = new Map<number, number | null>();
    const frein = new Map<number, number | null>();
    for (const s of segments) {
      lat.set(s.segmentIndex, s.maxGLateral);
      frein.set(s.segmentIndex, s.maxGBraking);
    }
    return { lat, frein };
  }, [segments]);

  const bandeLat = useMemo(
    () => normaliserBande(strip.cases.map((c) => valeurParIndex.lat.get(c.segmentIndex) ?? null)),
    [strip.cases, valeurParIndex]
  );
  const bandeFrein = useMemo(
    () => normaliserBande(strip.cases.map((c) => valeurParIndex.frein.get(c.segmentIndex) ?? null)),
    [strip.cases, valeurParIndex]
  );

  if (strip.cases.length === 0 || width <= 0) {
    if (apexes.length > 0 && width > 0) return <RegleDesVirages apexes={apexes} width={width} />;
    return (
      <StateView
        state="empty"
        emptyMessage="Le tour n'a pas encore été découpé en segments — le développement linéaire s'affichera dès que l'analyse aura tourné."
      />
    );
  }

  const nomsOrdonnes = strip.cases
    .filter((c) => c.genre === 'turn' || c.genre === 'chicane')
    .map((c) => c.nom);

  return (
    <View>
      {/* ── Le ruban — la règle graduée ────────────────────────────────── */}
      <Svg
        width={width}
        height={RUBAN_H}
        accessible
        accessibilityLabel={
          nomsOrdonnes.length > 0
            ? `Le tour déroulé, dans l'ordre : ${nomsOrdonnes.join(', ')}`
            : 'Le tour déroulé — aucun virage nommé'
        }
      >
        {strip.cases.map((c) => {
          const h = epaisseurDe(c.genre);
          return (
            <Rect
              key={c.cle}
              x={c.debut * width}
              y={(RUBAN_H - h) / 2}
              width={Math.max(1, (c.fin - c.debut) * width)}
              height={h}
              rx={h >= EPAISSEUR_VIRAGE ? 3 : 1}
              fill={c.genre === 'straight' ? colors.border.strong : colors.bg.card2}
              stroke={c.genre === 'straight' ? 'none' : colors.border.strong}
              strokeWidth={1}
            />
          );
        })}
      </Svg>

      {/* Les noms — seulement là où ils tiennent sans chevaucher. Les autres
          restent dans le libellé d'accessibilité du ruban, jamais perdus. */}
      <View style={[styles.etiquettes, { width, height: 14 }]}>
        {strip.cases.map((c) => {
          const w = (c.fin - c.debut) * width;
          if (c.genre === 'straight' || w < LARGEUR_MIN_ETIQUETTE) return null;
          return (
            <Text
              key={c.cle}
              style={[styles.etiquette, { left: c.debut * width, width: w }]}
              numberOfLines={1}
            >
              {c.nom}
            </Text>
          );
        })}
      </View>

      <Bande
        titre="G latéral maximum"
        unite="g"
        teinte={colors.qdi.trajectoire}
        cases={strip.cases}
        bande={bandeLat}
        width={width}
        format={g}
      />
      <Bande
        titre="G de freinage maximum"
        unite="g"
        teinte={colors.qdi.freinage}
        cases={strip.cases}
        bande={bandeFrein}
        width={width}
        format={g}
      />

      {/* ── Ce que le strip couvre, écrit ──────────────────────────────── */}
      <Text style={styles.couverture}>
        Analyse posée sur {pct(strip.couverture)} % du tour.
        {strip.nonSitues > 0
          ? ` ${strip.nonSitues} segment${strip.nonSitues > 1 ? 's' : ''} sans position exploitable, non ${strip.nonSitues > 1 ? 'représentés' : 'représenté'}.`
          : ''}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

function Bande({
  titre,
  unite,
  teinte,
  cases,
  bande,
  width,
  format,
}: {
  titre: string;
  unite: string;
  teinte: string;
  cases: readonly CaseStrip[];
  bande: ReturnType<typeof normaliserBande>;
  width: number;
  format: (v: number) => string;
}) {
  if (!bande) {
    return (
      <View style={styles.bandeBloc}>
        <Text style={styles.bandeTitre}>{titre}</Text>
        <Text style={styles.bandeAbsente}>Non mesuré sur ce tour.</Text>
      </View>
    );
  }

  return (
    <View style={styles.bandeBloc}>
      <View style={styles.bandeEntete}>
        <Text style={styles.bandeTitre}>{titre}</Text>
        <Text style={styles.bandeEtendue}>
          {format(bande.min)} → {format(bande.max)} {unite}
        </Text>
      </View>
      <Svg
        width={width}
        height={BANDE_H}
        accessible
        accessibilityLabel={`${titre}, de ${format(bande.min)} à ${format(bande.max)} ${unite} sur le tour`}
      >
        {/* Le sol de la bande : il montre qu'un emplacement existe là où aucune
            barre n'est dessinée — l'absence se voit, au lieu de se confondre
            avec une valeur minimale. */}
        <Rect x={0} y={BANDE_H - 1} width={width} height={1} fill={colors.border.hairline} />
        {cases.map((c, i) => {
          const t = bande.positions[i];
          if (t === null) return null;
          const h = Math.max(2, t * (BANDE_H - 2));
          return (
            <Rect
              key={c.cle}
              x={c.debut * width}
              y={BANDE_H - h}
              width={Math.max(1, (c.fin - c.debut) * width)}
              height={h}
              fill={teinte}
              opacity={0.85}
            />
          );
        })}
      </Svg>
    </View>
  );
}

/**
 * LA RÈGLE DES VIRAGES — ce que le ruban montre quand rien n'a été analysé.
 *
 * Elle ne prétend pas être un strip. Un strip porte des SEGMENTS, avec leur
 * longueur et leurs grandeurs par segment ; ici on n'a que des cordes. Elle
 * porte donc des traits, leurs numéros, et rien d'autre — pas de bande de G, pas
 * de couverture, pas de largeur inventée autour d'un point.
 *
 * Le sens du virage est écrit quand la base le porte : c'est une mesure du
 * détecteur, pas une déduction. Le rayon suit, en mètres.
 */
function RegleDesVirages({ apexes, width }: { apexes: readonly RepereApex[]; width: number }) {
  const noms = apexes.map((a) => a.nom).join(', ');
  return (
    <View>
      <Svg
        width={width}
        height={RUBAN_H}
        accessible
        accessibilityLabel={`Les virages du circuit, dans l'ordre du tour : ${noms}`}
      >
        <Rect
          x={0}
          y={(RUBAN_H - EPAISSEUR_DROITE) / 2}
          width={width}
          height={EPAISSEUR_DROITE}
          rx={1}
          fill={colors.border.strong}
        />
        {apexes.map((a) => (
          <Rect
            key={`apex-${a.index}`}
            x={Math.max(0, Math.min(width - 2, a.position * width - 1))}
            y={(RUBAN_H - EPAISSEUR_VIRAGE) / 2}
            width={2}
            height={EPAISSEUR_VIRAGE}
            fill={colors.text.mid}
          />
        ))}
      </Svg>

      <View style={[styles.etiquettes, { width, height: 14 }]}>
        {apexes.map((a, i) => {
          const precedent = i > 0 ? apexes[i - 1].position : -1;
          // Deux cordes trop proches empileraient leurs numéros : le second
          // reste dans le libellé d'accessibilité, jamais perdu.
          if ((a.position - precedent) * width < LARGEUR_MIN_ETIQUETTE) return null;
          return (
            <Text
              key={`nom-${a.index}`}
              style={[
                styles.etiquette,
                {
                  left: a.position * width - LARGEUR_MIN_ETIQUETTE / 2,
                  width: LARGEUR_MIN_ETIQUETTE,
                },
              ]}
              numberOfLines={1}
            >
              {a.index}
            </Text>
          );
        })}
      </View>

      {/* Mot-clé, pas phrase : cette feuille est une feuille de données. Il dit
          d'où viennent les repères — du CIRCUIT, pas d'une analyse de séance. */}
      <Text style={[styles.bandeEtendue, { marginTop: space.md }]}>VIRAGES · CIRCUIT</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  etiquettes: {
    position: 'relative',
    marginTop: 2,
  },
  etiquette: {
    position: 'absolute',
    top: 0,
    fontFamily: typo.body,
    fontSize: 9,
    letterSpacing: 0.2,
    color: colors.text.low,
    textAlign: 'center',
  },
  bandeBloc: {
    marginTop: space.lg,
  },
  bandeEntete: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.xs,
  },
  bandeTitre: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.mid,
  },
  bandeEtendue: {
    fontFamily: typo.mono,
    fontSize: 11,
    color: colors.text.low,
  },
  bandeAbsente: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.dim,
    marginTop: space.xs,
    backgroundColor: colors.bg.card2,
    borderRadius: radius.cell,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
  },
  couverture: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.low,
    marginTop: space.lg,
  },
});
