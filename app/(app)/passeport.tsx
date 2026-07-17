/**
 * Passeport piste — carte d'identité CUMULATIVE du pilote.
 * Reskin fidèle à la maquette refonte-v2 §7bis #5e (screens/18-passeport.png).
 *
 * Maquette : carte d'identité à dégradé sombre (nom réel, badge PALIER or,
 * 3 stats mono : séances / circuits / tours) · eyebrow « Vos circuits » ·
 * une carte par circuit roulé avec le MEILLEUR TEMPS réel en or (l'or est
 * réservé au chrono/record) · note « Le vôtre seul — aucun autre pilote ».
 * Soi seul : aucun autre pilote, aucun classement, jamais de « gagnant ».
 *
 * Données réelles uniquement :
 *   - nom → profiles (useAuthStore) ;
 *   - « Membre depuis » → première séance complétée (passportService) ;
 *   - palier → registrations.offer_type de l'inscription EFFECTIVE la plus
 *     récente (même règle que qdiService.getQdiAccessLevel, RLS own-row) ;
 *     aucune inscription = badge masqué ;
 *   - stats → loadPassport (loadPilotStats agrégé) ; records par circuit →
 *     stats.byCircuit.bestLapSeconds (best_lap_seconds réels), « — » si absent.
 *
 * Héritage retravaillé (le graphique v2 fait loi) : le radar d'empreinte, le
 * manifeste et la distance km sont DROP (absents de la maquette — l'empreinte
 * vit sur Signature/Empreinte de saison). Les accès Empreinte de saison et
 * Carte de licence sont GARDÉS (seule porte d'entrée de ces écrans) mais
 * retravaillés en lignes discrètes v2. Tutoiement des PNG transposé en
 * vouvoiement. Zéro nouvelle table.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { EmptyState } from '@/components/instruments';
import {
  BreathingGlow,
  CountUpNumber,
  FadeInSection,
  PressableScale,
  Stagger,
} from '@/components/motion';
import { supabase } from '@/lib/supabase';
import { NO_CIRCUIT, type Passport, loadPassport } from '@/services/passportService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatLapTimeMs } from '@/utils/format';

const { palette, fonts, fontSize, spacing, radius } = theme;

/** Libellés d'affichage des offres réelles (enum offer_type_enum). */
const OFFER_LABELS: Record<string, string> = {
  access: 'Access',
  signature: 'Signature',
  promotion: 'Promotion',
  heritage: 'Heritage',
};

/**
 * Palier RÉEL du pilote : offre de l'inscription EFFECTIVE la plus récente
 * (même règle que qdiService.getQdiAccessLevel — une Signature annulée il y a
 * un an ne donne pas le palier à vie). RLS : registrations own-row.
 * Null = hors parcours commercial → badge masqué (jamais un palier inventé).
 */
async function loadCurrentOffer(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('registrations')
    .select('offer_type, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  const ACTIVE = new Set(['confirmed', 'attended', 'pending_payment', 'pending']);
  const current = (data ?? []).find((r) => ACTIVE.has(String(r.status)));
  return current ? String(current.offer_type) : null;
}

/** « Membre depuis {mois année} » — date RÉELLE de la première séance complétée. */
function memberSinceLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/** Fond de la carte d'identité : dégradé sombre (surface-3 → surface), thème only. */
function CardGradient() {
  return (
    <Svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', top: 0, left: 0 }}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="passportCard" x1="0%" y1="0%" x2="60%" y2="100%">
          <Stop offset="0" stopColor={palette.surface3} stopOpacity="1" />
          <Stop offset="1" stopColor={palette.card} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#passportCard)" />
    </Svg>
  );
}

/**
 * Colonne de stat de la carte (chiffre mono + label bas de casse, maquette).
 * Le chiffre réel se construit en comptant (CountUpNumber) ; « — » si absent.
 */
function StatCol({ value, label }: { value: number | null; label: string }) {
  return (
    <View style={{ flex: 1 }} accessible accessibilityLabel={`${value ?? '—'} ${label}`}>
      {value != null ? (
        <CountUpNumber value={value} style={s.statValue} />
      ) : (
        <Text style={s.statValue}>—</Text>
      )}
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

/** Glyphe tracé (anneau fin) des lignes circuit — décoratif, maquette. */
function TrackRing() {
  return <View style={s.ring} importantForAccessibility="no" />;
}

/** Chevron droit fin des lignes de navigation (héritage retravaillé v2). */
function ChevronRight() {
  return <View style={s.chevRight} importantForAccessibility="no" />;
}

export default function PasseportScreen() {
  const profile = useAuthStore((st) => st.profile);
  const [passport, setPassport] = useState<Passport | null>(null);
  const [offer, setOffer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([loadPassport(profile.id), loadCurrentOffer(profile.id)])
      .then(([p, o]) => {
        if (!cancelled) {
          setPassport(p);
          setOffer(o);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  useFocusEffect(reload);

  const name =
    [profile?.first_name, profile?.last_name]
      .map((part) => (part ?? '').trim())
      .filter(Boolean)
      .join(' ') || 'Pilote';
  const since = memberSinceLabel(passport?.memberSince ?? null);
  const offerLabel = offer ? (OFFER_LABELS[offer] ?? offer) : null;
  // Heritage porte SA couleur d'offre (heritageGold strict) ; les autres paliers
  // suivent la maquette (or). Jamais une couleur QDI ici.
  const offerColor = offer === 'heritage' ? palette.heritageGold : palette.gold;

  // Le plus familier en tête (séances) — jamais un classement de performance.
  // Le bucket « sans circuit » (circuit_name null → NO_CIRCUIT) est exclu :
  // pas de circuit « Inconnu » ni de chrono or pour une séance non située.
  const circuits = passport
    ? Object.values(passport.stats.byCircuit)
        .filter((c) => c.circuitName !== NO_CIRCUIT)
        .sort((a, b) => b.sessionCount - a.sessionCount)
    : [];

  return (
    <Screen>
      <AppBar title="Passeport piste" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* ── Carte d'identité (dégradé sombre, maquette) — entre en fondu,
            puis respire très discrètement (seul BreathingGlow de l'écran). ── */}
        <FadeInSection>
          <BreathingGlow minOpacity={0.92}>
            <View style={s.idCard}>
              <CardGradient />
              <View style={s.idHead}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name} accessibilityRole="header">
                    {name}
                  </Text>
                  {since ? <Text style={s.since}>Membre depuis {since}</Text> : null}
                </View>
                {offerLabel ? (
                  <View style={s.palier} accessible accessibilityLabel={`Palier ${offerLabel}`}>
                    <Text style={[s.palierEyebrow, { color: offerColor }]}>PALIER</Text>
                    <Text style={[s.palierValue, { color: offerColor }]}>{offerLabel}</Text>
                  </View>
                ) : null}
              </View>

              <View style={s.idHair} />

              <View style={s.statRow}>
                <StatCol
                  value={passport ? passport.stats.totalSessions : null}
                  label={passport?.stats.totalSessions === 1 ? 'séance' : 'séances'}
                />
                <StatCol
                  value={passport ? passport.circuitCount : null}
                  label={passport?.circuitCount === 1 ? 'circuit' : 'circuits'}
                />
                <StatCol
                  value={passport ? passport.stats.totalLaps : null}
                  label={passport?.stats.totalLaps === 1 ? 'tour' : 'tours'}
                />
              </View>
            </View>
          </BreathingGlow>
        </FadeInSection>

        {loading ? (
          <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator color={palette.creamMute} />
          </View>
        ) : circuits.length === 0 ? (
          <FadeInSection delay={80}>
            <View style={{ marginTop: spacing.xl }}>
              <EmptyState
                label="Passeport à composer"
                message="Vos circuits et vos temps s'inscriront ici au fil de vos séances analysées."
              />
            </View>
          </FadeInSection>
        ) : (
          <>
            {/* ── Records par circuit — chronos RÉELS, en or (chrono seul).
                Cartes en cascade ; le chrono se construit en comptant en ms
                puis en formatant au canon M:SS.mmm (valeur finale inchangée). ── */}
            <FadeInSection delay={80}>
              <View style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
                <SectionLabel>Vos circuits</SectionLabel>
              </View>
            </FadeInSection>
            <Stagger initialDelay={160} style={{ gap: spacing.sm + 2 }}>
              {circuits.map((c) => (
                <View
                  key={c.circuitName}
                  style={s.circuitCard}
                  accessible
                  accessibilityLabel={
                    c.bestLapSeconds !== null
                      ? `${c.circuitName}, meilleur temps ${formatLapTimeMs(c.bestLapSeconds)}`
                      : `${c.circuitName}, meilleur temps non disponible`
                  }
                >
                  <TrackRing />
                  <Text style={s.circuitName} numberOfLines={2}>
                    {c.circuitName}
                  </Text>
                  {c.bestLapSeconds !== null ? (
                    <CountUpNumber
                      value={Math.round(c.bestLapSeconds * 1000)}
                      format={(ms) => formatLapTimeMs(ms / 1000)}
                      style={s.circuitBest}
                    />
                  ) : (
                    <Text style={[s.circuitBest, { color: palette.creamMute }]}>—</Text>
                  )}
                </View>
              ))}
            </Stagger>

            <FadeInSection delay={280}>
              <Text style={s.footnote}>
                Votre meilleur temps par circuit. Le vôtre seul — aucun autre pilote.
              </Text>
            </FadeInSection>
          </>
        )}

        {/* ── Héritage retravaillé : seuls accès Empreinte saison / Licence ── */}
        {!loading ? (
          <FadeInSection delay={360}>
            <View style={s.linkList}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Empreinte de saison"
                onPress={() => router.push('/(app)/empreinte-saison' as never)}
                style={s.linkRow}
              >
                <Text style={s.linkLabel}>Empreinte de saison</Text>
                <ChevronRight />
              </PressableScale>
              <View style={s.linkHair} />
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Carte de licence"
                onPress={() => router.push('/(app)/carte-licence' as never)}
                style={s.linkRow}
              >
                <Text style={s.linkLabel}>Carte de licence</Text>
                <ChevronRight />
              </PressableScale>
            </View>
          </FadeInSection>
        ) : null}
      </View>
    </Screen>
  );
}

const s = {
  // Carte d'identité : dégradé sombre clippé, bordure line, padding généreux.
  idCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    overflow: 'hidden' as const,
    padding: spacing.lg,
    marginTop: spacing.xs,
  },
  idHead: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.md,
  },
  name: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    letterSpacing: 0.2,
    color: palette.cream,
  },
  since: {
    fontFamily: fonts.mono,
    fontSize: fontSize.micro,
    color: palette.creamMute,
    marginTop: spacing.xs + 1,
    lineHeight: fontSize.micro * 1.45,
  },
  // Badge palier (or — maquette ; Heritage garde son heritageGold strict).
  palier: { alignItems: 'flex-end' as const },
  palierEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    opacity: 0.8,
  },
  palierValue: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.body,
    marginTop: 2,
  },
  idHair: {
    height: 1,
    backgroundColor: palette.separator,
    marginVertical: spacing.lg - 2,
  },
  statRow: {
    flexDirection: 'row' as const,
    gap: spacing.md,
  },
  statValue: {
    fontFamily: fonts.king,
    fontSize: 24,
    letterSpacing: -0.5,
    color: palette.cream,
    fontVariant: ['tabular-nums' as const],
  },
  statLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: palette.creamMute,
    marginTop: spacing.xs,
  },
  // Ligne circuit : carte v2 (surface, hairline), glyphe anneau, chrono or.
  circuitCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    minHeight: 52,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg - 2,
  },
  ring: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: palette.faint,
  },
  circuitName: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.body,
    color: palette.cream,
    lineHeight: fontSize.body * 1.3,
  },
  circuitBest: {
    fontFamily: fonts.monoSemi,
    fontSize: 13,
    letterSpacing: 0.3,
    color: palette.gold,
    fontVariant: ['tabular-nums' as const],
  },
  footnote: {
    fontFamily: fonts.body,
    fontSize: fontSize.micro,
    color: palette.faint,
    textAlign: 'center' as const,
    lineHeight: fontSize.micro * 1.5,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  // Lignes de navigation héritées (Empreinte saison / Licence), style v2 sobre.
  linkList: {
    marginTop: spacing.xxl,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.borderHair,
    borderRadius: radius.lg,
  },
  linkRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  linkLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.creamSoft,
  },
  linkHair: {
    height: 1,
    backgroundColor: palette.separator,
    marginHorizontal: spacing.lg,
  },
  chevRight: {
    width: 8,
    height: 8,
    borderRightWidth: 1.5,
    borderTopWidth: 1.5,
    borderColor: palette.faint,
    transform: [{ rotate: '45deg' }],
  },
};
