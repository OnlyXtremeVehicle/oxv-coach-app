/**
 * Écran « Belles routes » — découverte de routes touristiques HORS CHRONO
 * (maquette refonte-v2 #37 · doc architecture/09 · README §7bis).
 *
 * Cadre OXV : TOURISME / DÉCOUVERTE, jamais performance. On liste des routes
 * à savourer, certifiées par OXV, avec leur distance et leur préférence de
 * sinuosité. AUCUN chrono ici : hors piste, l'or ne s'applique pas.
 *
 * Données réelles (table `scenic_routes`, via scenicRoutesService — NON modifié) :
 *   - nom              → r.name
 *   - distance (km)    → r.distanceKm
 *   - sinuosité (label)→ r.curviness   (préférence de balade, pas une métrique)
 *   - badge CERTIFIÉE  → r.status === 'certified'   (verrou admin en base)
 *
 * Volontairement masqués faute de source réelle (voir sharedChangesNeeded) :
 *   - la DURÉE n'est pas persistée dans `scenic_routes` → non affichée ;
 *   - il n'existe pas de colonne de POPULARITÉ → badge « POPULAIRE » masqué ;
 *   - la géométrie du tracé n'est pas exposée par le service → l'en-tête de
 *     carte reste une surface calme (aucun tracé fabriqué).
 *
 * En tête : CTA sobre vers « Créer votre route » (planificateur GraphHopper,
 * retour fondateur build 23) — route `/(app2)/club/composer-route`.
 *
 * Motion (kit src/components/motion) : entrée en fondu décalé, cartes route en
 * cascade (Stagger), CTA en PressableScale. Courbes et durées du kit,
 * reduce-motion respecté.
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { FadeInSection, PressableScale, Stagger } from '@/components/motion';
import { type SavedScenicRoute, listCertifiedRoutes } from '@/services/routing/scenicRoutesService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { StatusLine, cockpitHalo } from '@/ui/Cockpit';

// Libellés humains de la préférence de balade (jamais une note de conduite).
const CURVINESS_LABEL: Record<string, string> = {
  douce: 'Route douce',
  sinueuse: 'Route sinueuse',
  tres_sinueuse: 'Route très sinueuse',
};

function curvinessLabel(value: string | null): string | null {
  if (!value) return null;
  return CURVINESS_LABEL[value] ?? value;
}

export default function BellesRoutesScreen() {
  const [routes, setRoutes] = useState<SavedScenicRoute[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setRoutes(await listCertifiedRoutes());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="Belles routes" onBack={() => router.back()} />
        <View style={s.centered}>
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="Belles routes" onBack={() => router.back()} />
      <View style={s.body}>
        <FadeInSection>
          <Text style={s.lede}>Des routes à savourer, loin du chrono.</Text>
        </FadeInSection>

        {/* CTA planificateur (retour fondateur build 23) — sobre, jamais d'or. */}
        <FadeInSection delay={80}>
          <PressableScale
            onPress={() => router.push('/(app2)/club/composer-route' as never)}
            accessibilityRole="button"
            accessibilityLabel="Créer votre route"
            haptic="tap"
          >
            <Card style={{ ...s.createCta, ...cockpitHalo }}>
              <View style={s.createBody}>
                <Text style={s.createEyebrow}>Planificateur</Text>
                <Text style={s.createTitle}>Créer votre route</Text>
                <Text style={s.createHint}>
                  Composez un itinéraire sinueux depuis votre position, étape par étape.
                </Text>
              </View>
              <View
                style={s.createChev}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            </Card>
          </PressableScale>
        </FadeInSection>

        {routes.length === 0 ? (
          <FadeInSection delay={160}>
            <Card style={{ ...s.empty, ...cockpitHalo }}>
              <Text style={s.emptyTitle}>Aucune route certifiée pour l&apos;instant.</Text>
              <Text style={s.emptyHint}>
                Les routes validées par OXV apparaîtront ici. Vos itinéraires enregistrés restent
                dans « Mes belles routes ».
              </Text>
            </Card>
          </FadeInSection>
        ) : (
          <>
            <FadeInSection delay={160}>
              <StatusLine
                label={`${routes.length} route${routes.length > 1 ? 's' : ''} certifiée${
                  routes.length > 1 ? 's' : ''
                }`}
              />
            </FadeInSection>
            <Stagger initialDelay={240} style={s.list}>
              {routes.map((r) => (
                <RouteCard key={r.id} route={r} />
              ))}
            </Stagger>
          </>
        )}
      </View>
    </Screen>
  );
}

function RouteCard({ route: r }: { route: SavedScenicRoute }) {
  const certified = r.status === 'certified';
  const accent = certified ? theme.dataColors.accel : theme.palette.line;
  const curve = curvinessLabel(r.curviness);

  // Méta réelles uniquement. La durée n'est pas persistée → non affichée.
  const meta: string[] = [];
  if (r.distanceKm != null) meta.push(`${Math.round(r.distanceKm)} km`);
  if (r.sinuosity != null) meta.push(`sinuosité ${r.sinuosity.toFixed(2)}`);

  return (
    <Card style={{ ...s.card, ...cockpitHalo }}>
      {/* En-tête de carte : surface calme + liseré d'accent (vert = certifiée).
          Aucun tracé fabriqué — la géométrie réelle n'est pas exposée ici. */}
      <View style={[s.header, { borderBottomColor: accent }]}>
        {certified ? (
          <View style={s.badge}>
            <Text style={s.badgeT}>Certifiée OXV</Text>
          </View>
        ) : null}
      </View>

      <View style={s.cardBody}>
        <Text style={s.name} numberOfLines={2}>
          {r.name}
        </Text>
        <View style={s.metaRow}>
          {meta.length > 0 ? (
            <Text style={s.meta}>{meta.join('  ·  ')}</Text>
          ) : (
            <Text style={s.meta}>—</Text>
          )}
          {curve ? <Text style={s.curve}>{curve}</Text> : null}
        </View>
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  lede: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.lg,
    lineHeight: theme.fontSize.body * 1.5,
  },
  list: { gap: theme.spacing.md },

  // — CTA planificateur (en tête) : carte actionnable, liseré gauche crème
  // (identité, jamais l'or), chevron sobre à droite.
  createCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.palette.card2,
    borderLeftWidth: 2,
    borderLeftColor: theme.palette.edge,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  createBody: { flex: 1 },
  createEyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: theme.palette.eyebrow,
    marginBottom: 4,
  },
  createTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    color: theme.palette.cream,
  },
  createHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.45,
    marginTop: theme.spacing.xs,
  },
  createChev: {
    width: 9,
    height: 9,
    borderTopWidth: 1.7,
    borderRightWidth: 1.7,
    borderColor: theme.palette.creamMute,
    transform: [{ rotate: '45deg' }],
    marginRight: 3,
  },

  // Carte route — padding 0 pour que l'en-tête touche les bords ; le corps
  // récupère l'espacement standard.
  card: { padding: 0, overflow: 'hidden' },
  header: {
    height: 96,
    backgroundColor: theme.palette.card2,
    borderBottomWidth: 2,
    justifyContent: 'flex-start',
  },
  cardBody: { padding: theme.spacing.md },

  // Eyebrow badge (JetBrains Mono, sentence-case impossible en majuscules :
  // on garde l'eyebrow mono en capitales, canon v2 des eyebrows).
  badge: {
    alignSelf: 'flex-start',
    margin: theme.spacing.md,
    backgroundColor: theme.palette.night,
    borderColor: theme.palette.separator,
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  badgeT: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: theme.dataColors.accel,
  },

  name: {
    fontFamily: theme.fonts.displayReg,
    fontSize: theme.fontSize.h3,
    color: theme.palette.cream,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.4,
    color: theme.palette.creamMute,
  },
  // Chip de préférence de balade — surface calme, neutre (l'accent vert reste
  // réservé à la certification OXV, pas à un descripteur géométrique).
  curve: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: theme.palette.secondary,
    backgroundColor: theme.palette.surface3,
    borderColor: theme.palette.line,
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    overflow: 'hidden',
  },

  empty: { alignItems: 'center', paddingVertical: theme.spacing.xxl },
  emptyTitle: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic',
    color: theme.palette.creamMute,
    textAlign: 'center',
  },
  emptyHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    lineHeight: theme.fontSize.small * 1.5,
    paddingHorizontal: theme.spacing.md,
  },
});
