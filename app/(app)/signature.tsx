/**
 * Signature de pilotage — zone Miroir. Reskin FIDÈLE aux maquettes Claude Design
 * refonte-v2 §7.3 (screens/03-signature-qdi.png), décision fondateur 2026-07-12.
 *
 * Héros conforme à la maquette (haut → bas) :
 *   header « Signature de pilotage » · eyebrow centré « VOTRE STYLE, RIEN QUE LE
 *   VÔTRE » · radar pentagonal QDI (polygone séance blanc + points colorés,
 *   empreinte self-only en pointillé, annotation « point fort ») · légende ·
 *   carte « votre lecture » (3 lignes pastille + phrase factuelle) · « Votre
 *   style au fil des séances » (3 mini-radars mensuels, le dernier surligné).
 *
 * JAMAIS un score unique. Substance OXV préservée SOUS le héros (parti A) :
 * méthode/limites, virages confortables, empreinte dans le temps (partage coach),
 * rappel doctrinal. Logique/données/RLS inchangées. Vouvoiement.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { LayoutAnimation, Platform, Pressable, Switch, Text, UIManager, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { SourceMethodBlock } from '@/components/InsightTransparency';
import { MiniQdiRadar } from '@/components/MiniQdiRadar';
import { QdiRadar, type QdiAnnotations } from '@/components/QdiRadar';
import { FadeInSection, useReduceMotion } from '@/components/motion';
import { EmptyState } from '@/components/instruments';
import {
  getOrComputeQdiForSession,
  getQdiAccessLevel,
  getQdiReference,
  listMonthlyQdi,
  type MonthlyQdi,
  type QdiAccessLevel,
  type QdiRecord,
} from '@/services/qdiService';
import { type QdiBranches } from '@/services/qdiLogic';
import { listSegmentAnalysesForSession } from '@/services/segmentAnalysesService';
import { fetchSessionLaps } from '@/services/sessionsService';
import { type PilotSignature, computeSignature } from '@/services/pilotSignatureService';
import {
  type SignatureSnapshot,
  listMySnapshots,
  setSnapshotShared,
  upsertSnapshotForSession,
} from '@/services/pilotSignatureSnapshotService';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';
import { StateWrapper } from '@/ui/StateWrapper';

const { palette, dataColors, spacing, radius, fonts } = theme;

// LayoutAnimation (panneau « Comment lire cet écran ») — l'ancienne architecture
// Android exige l'activation explicite ; sans effet ailleurs.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Légende QDI du panneau pédagogique — mêmes couleurs que le radar (une couleur
 *  = une donnée, système §4 handoff). */
const QDI_LEGEND = [
  { label: 'Trajectoire', color: dataColors.trajectory },
  { label: 'Fluidité', color: dataColors.flow },
  { label: 'Freinage', color: dataColors.brake },
  { label: 'Accélération', color: dataColors.accel },
  { label: 'Régularité', color: dataColors.regularity },
] as const;

/** Couleur QDI de chaque trait de signature (une couleur = une donnée).
 *  Le bleu reste à la TRAJECTOIRE (radar) ; l'engagement latéral (G lat, domaine
 *  de la Fluidité) porte le jaune — jamais deux données sur la même couleur. */
const TRAIT_COLOR: Record<string, string> = {
  braking: dataColors.brake,
  lateral: dataColors.flow,
  reaccel: dataColors.accel,
  regularity: dataColors.regularity,
};

export default function SignatureScreen() {
  const profile = useAuthStore((s) => s.profile);
  const params = useLocalSearchParams<{ sessionId?: string }>();

  const [signature, setSignature] = useState<PilotSignature | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [, setSessionId] = useState<string | null>(null);
  // Empreinte consolidée : la mémoire descriptive du miroir, séance après séance.
  const [snapshots, setSnapshots] = useState<SignatureSnapshot[]>([]);
  // QDI 5 branches — LE radar, self-only.
  const [qdi, setQdi] = useState<QdiRecord | null>(null);
  const [qdiReference, setQdiReference] = useState<{
    branches: QdiBranches;
    sessions: number;
  } | null>(null);
  const [qdiAccess, setQdiAccess] = useState<QdiAccessLevel>('full');
  // « Votre style au fil des séances » — 3 mini-radars mensuels (constats).
  const [monthly, setMonthly] = useState<MonthlyQdi[]>([]);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    // Reset QDI au changement de session : sinon, si le fetch de la nouvelle
    // session échoue, le radar de la PRÉCÉDENTE resterait affiché (périmé).
    setQdi(null);
    setQdiReference(null);
    setLoading(true);
    setError(false);

    (async () => {
      // Résout la session cible (param ou dernière complétée)
      let resolvedId = params.sessionId;
      if (!resolvedId) {
        const { data: row } = await supabase
          .from('telemetry_sessions')
          .select('id')
          .eq('user_id', profile.id)
          .eq('status', 'completed')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        resolvedId = (row as { id?: string } | null)?.id;
      }
      if (!resolvedId || cancelled) {
        setLoading(false);
        return;
      }
      setSessionId(resolvedId);

      const [segments, laps] = await Promise.all([
        listSegmentAnalysesForSession(resolvedId),
        fetchSessionLaps(resolvedId),
      ]);
      if (cancelled) return;

      // QDI + référence self-only + niveau d'offre + mois — best-effort.
      (async () => {
        const [record, access, months] = await Promise.all([
          getOrComputeQdiForSession(resolvedId),
          getQdiAccessLevel(profile.id),
          listMonthlyQdi(profile.id, 3),
        ]);
        if (cancelled) return;
        setQdi(record);
        setQdiAccess(access);
        setMonthly(months);
        if (record) {
          const ref = await getQdiReference(profile.id, record.reference.circuit, resolvedId);
          if (!cancelled) setQdiReference(ref);
        }
      })().catch(() => undefined);

      // Temps de tour valides uniquement (pas outlap/inlap)
      const lapTimesSeconds = laps
        .filter((l) => !l.is_outlap && !l.is_inlap && l.duration_seconds > 0)
        .map((l) => l.duration_seconds);

      const sig = computeSignature({
        segments: segments.map((s2) => ({
          segmentIndex: s2.segmentIndex,
          segmentName: s2.segmentName,
          kind: s2.kind,
          entrySpeedKmh: s2.entrySpeedKmh,
          apexSpeedKmh: s2.apexSpeedKmh,
          exitSpeedKmh: s2.exitSpeedKmh,
          maxGLateral: s2.maxGLateral,
          maxGBraking: s2.maxGBraking,
          marginPercent: s2.marginPercent,
        })),
        lapTimesSeconds,
      });
      setSignature(sig);
      setLoading(false);

      // Fige l'empreinte de cette séance (mémoire du miroir).
      if (sig.traits.length > 0) {
        await upsertSnapshotForSession(resolvedId);
        if (cancelled) return;
        const snaps = await listMySnapshots(8);
        if (!cancelled) setSnapshots(snaps);
      }
    })().catch(() => {
      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [profile, params.sessionId, reloadKey]);

  async function onToggleShare(snap: SignatureSnapshot, next: boolean) {
    setSnapshots((prev) =>
      prev.map((s2) => (s2.id === snap.id ? { ...s2, sharedWithCoach: next } : s2))
    );
    const res = await setSnapshotShared(snap.id, next);
    if (!res.ok) setSnapshots(await listMySnapshots(8));
  }

  function snapDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  function traitValue(snap: SignatureSnapshot, key: string): string | null {
    return snap.traits.find((t) => t.key === key)?.value ?? null;
  }

  if (loading || error) {
    return (
      <Screen>
        <AppBar title="Signature de pilotage" onBack={() => router.back()} />
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
          <StateWrapper
            state={error ? 'error' : 'loading'}
            skeletonLines={5}
            errorCause="Votre signature n'a pas pu être chargée."
            onRetry={() => setReloadKey((k) => k + 1)}
          >
            {null}
          </StateWrapper>
        </View>
      </Screen>
    );
  }

  const hasContent = signature && signature.traits.length > 0;

  // Branche la plus haute → annotation « votre point fort » sur le radar
  // (descriptif, self-only, jamais un ordre).
  const qdiAnnotations: QdiAnnotations | undefined = (() => {
    if (!qdi) return undefined;
    const keys: (keyof QdiBranches)[] = [
      'trajectoire',
      'fluidite',
      'freinage',
      'acceleration',
      'regularite',
    ];
    let best: keyof QdiBranches | null = null;
    let max = -1;
    for (const k of keys) {
      const v = qdi[k];
      if (typeof v === 'number' && v > max) {
        max = v;
        best = k;
      }
    }
    return best ? { [best]: 'votre point fort' } : undefined;
  })();

  return (
    <Screen>
      <AppBar title="Signature de pilotage" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* Accroche — eyebrow centré (maquette ; vouvoiement, doctrine). */}
        <Text style={s.accroche}>VOTRE STYLE, RIEN QUE LE VÔTRE</Text>

        {!hasContent && !qdi ? (
          <EmptyState
            message="Votre signature se dessine à partir de la trace de vos tours. Elle apparaîtra après votre premier roulage analysé."
            source="telemetry_frames · app_segment_analyses"
          />
        ) : (
          <>
            {/* Lecture (retour build 23) — ce qu'on regarde, en une phrase simple.
                Descriptif, jamais prescriptif. */}
            <Text style={s.lectureLine}>
              Cinq facettes de votre conduite, mesurées sur cette séance. La forme est un portrait,
              pas une note.
            </Text>

            {/* RADAR — le portrait. Polygone séance blanc + points colorés,
                empreinte self-only pointillée, annotation point fort. */}
            <FadeInSection>
              {qdi ? (
                <QdiRadar
                  current={qdi}
                  reference={qdiReference?.branches ?? null}
                  referenceSessions={qdiReference?.sessions}
                  detail={qdiAccess === 'full'}
                  annotations={qdiAnnotations}
                />
              ) : (
                <EmptyState
                  label="QDI en préparation"
                  message="Le calcul des cinq branches suit l'analyse de la session. Revenez après le bilan."
                />
              )}
            </FadeInSection>

            {/* VOTRE LECTURE — 3 lignes pastille + phrase factuelle (maquette).
                Dérivées des traits mesurés (descriptif, jamais une consigne). */}
            {hasContent ? (
              <FadeInSection delay={80}>
                <View style={s.lectureCard}>
                  {/* Régularité d'abord (maquette : 1re ligne violette), puis les
                      autres traits mesurés. Libellé + valeur colorée + détail. */}
                  {[...signature.traits]
                    .sort((a, b) => (a.key === 'regularity' ? -1 : b.key === 'regularity' ? 1 : 0))
                    .slice(0, 3)
                    .map((trait) => (
                      <View
                        key={trait.key}
                        style={s.lectureRow}
                        accessible
                        accessibilityLabel={`${trait.label} : ${trait.value}`}
                      >
                        <View
                          style={[
                            s.lectureDot,
                            { backgroundColor: TRAIT_COLOR[trait.key] ?? palette.creamMute },
                          ]}
                        />
                        <Text style={s.lectureText}>
                          {trait.label}{' '}
                          <Text
                            style={{
                              color: TRAIT_COLOR[trait.key] ?? palette.cream,
                              fontFamily: fonts.bodyMedium,
                            }}
                          >
                            {trait.value.toLowerCase()}
                          </Text>
                          {trait.detail ? ` — ${trait.detail}` : ''}
                        </Text>
                      </View>
                    ))}
                </View>
              </FadeInSection>
            ) : null}

            {/* Pédagogie (build 23) : comment lire — repliable, état local, pas un modal. */}
            {qdi ? (
              <FadeInSection delay={110}>
                <HowToRead>
                  <HowRow color={palette.cream}>
                    Le polygone blanc est votre séance : cinq branches notées de 0 à 100, un sommet
                    par branche.
                  </HowRow>
                  {qdiReference ? (
                    <HowRow color={palette.faint}>
                      Le pointillé est votre propre référence : la médiane de vos dernières séances
                      ici. Jamais un autre pilote.
                    </HowRow>
                  ) : null}
                  <HowLegend items={QDI_LEGEND} />
                  <HowRow>
                    « Votre point fort » marque la branche la plus haute de la séance. Un constat,
                    pas une note.
                  </HowRow>
                  <HowRow>
                    Une branche à « — » manque de données : elle reste au centre, sans invention.
                  </HowRow>
                  {monthly.length >= 2 ? (
                    <HowRow>
                      Les mini-radars reprennent la même forme, mois par mois — le dernier est mis
                      en avant.
                    </HowRow>
                  ) : null}
                  <HowRow>
                    La méthode et ses limites sont détaillées plus bas, sous « Source / Méthode ».
                  </HowRow>
                </HowToRead>
              </FadeInSection>
            ) : null}

            {/* VOTRE STYLE AU FIL DES SÉANCES — mini-radars mensuels juxtaposés,
                le dernier surligné. Des constats, jamais une courbe. */}
            {monthly.length >= 2 ? (
              <FadeInSection delay={140}>
                <Text style={s.sectionEyebrow}>VOTRE STYLE AU FIL DES SÉANCES</Text>
                <View style={s.monthRow}>
                  {monthly.map((m, i) => (
                    <MiniQdiRadar
                      key={m.monthKey}
                      label={m.monthLabel}
                      branches={m.branches}
                      highlighted={i === monthly.length - 1}
                    />
                  ))}
                </View>
              </FadeInSection>
            ) : null}

            {/* ── Substance OXV sous le héros (parti A) ───────────────────── */}

            <View style={{ marginTop: spacing.xxl }}>
              <SourceMethodBlock
                items={[
                  'Cinq branches calculées par un algorithme déterministe versionné, depuis le GPS et la centrale inertielle du boîtier (25 Hz).',
                  'Le boîtier ne mesure ni le volant ni les pédales : Fluidité, Freinage et Accélération lisent les accélérations subies par le véhicule — les conséquences, pas les gestes.',
                  'La référence est votre propre historique sur ce circuit. Jamais un autre pilote, jamais un classement.',
                ]}
              />
            </View>

            {/* Virages de prédilection — repère factuel. */}
            {hasContent && signature.comfortCorners.length > 0 ? (
              <View style={{ marginTop: spacing.xl }}>
                <View style={s.cornerPanel}>
                  <Text style={s.eyebrow}>Vos virages les plus confortables</Text>
                  <View style={{ marginTop: spacing.sm }}>
                    {signature.comfortCorners.map((c) => (
                      <View
                        key={c.segmentIndex}
                        style={s.cornerRow}
                        accessible
                        accessibilityLabel={`${c.segmentName ?? `Virage ${c.segmentIndex}`} : ${Math.round(c.marginPercent)} % de marge`}
                      >
                        <Text style={s.cornerName}>
                          {c.segmentName ?? `Virage ${c.segmentIndex}`}
                        </Text>
                        <Text style={s.cornerValue}>{Math.round(c.marginPercent)} %</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ) : null}

            {/* Empreinte dans le temps — mémoire du miroir + partage coach. */}
            {snapshots.length >= 2 ? (
              <View style={{ marginTop: spacing.xxl }}>
                <Text style={s.eyebrow}>Votre empreinte dans le temps</Text>
                <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
                  {[...snapshots]
                    .sort((a, b) =>
                      (b.sessionStartedAt ?? b.computedAt).localeCompare(
                        a.sessionStartedAt ?? a.computedAt
                      )
                    )
                    .map((snap) => {
                      const braking = traitValue(snap, 'braking');
                      const lateral = traitValue(snap, 'lateral');
                      return (
                        <View key={snap.id} style={s.snapPanel}>
                          {/* Date de la SÉANCE (computed_at daterait du recalcul). */}
                          <Text style={s.snapDate}>
                            {snapDate(snap.sessionStartedAt ?? snap.computedAt)}
                          </Text>
                          <Text style={s.snapLine}>
                            Tours {snap.regularityBand ?? '—'}
                            {braking ? ` · freinage ${braking}` : ''}
                            {lateral ? ` · engagement ${lateral}` : ''}
                          </Text>
                          <View style={s.snapShareRow}>
                            <Text style={s.snapShareLabel}>Partagée avec mon coach</Text>
                            <Switch
                              value={snap.sharedWithCoach}
                              onValueChange={(v) => onToggleShare(snap, v)}
                              accessibilityRole="switch"
                              accessibilityLabel="Partager cette empreinte avec mon coach"
                              accessibilityState={{ checked: snap.sharedWithCoach }}
                              trackColor={{ false: '#26262B', true: palette.green }}
                              thumbColor={palette.cream}
                            />
                          </View>
                        </View>
                      );
                    })}
                </View>
                <Text style={s.snapFootnote}>
                  Des constats, séance après séance — pas une note d&apos;évolution.
                </Text>
              </View>
            ) : null}

            {/* Rappel doctrinal sobre */}
            <Text style={s.doctrine}>
              Un portrait, pas un verdict. À vous d&apos;en faire ce que vous voulez.
            </Text>
          </>
        )}
      </View>
    </Screen>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Pédagogie (retour fondateur build 23 : « élevé mais pas très compréhensible »).
   Composants LOCAUX à l'écran — le périmètre du chantier ne touche pas aux
   composants partagés. Descriptif uniquement : ce que ça montre, jamais quoi
   faire. Aucune donnée ni logique modifiée — lisibilité et motion seulement.
   ───────────────────────────────────────────────────────────────────────────── */

/** Affordance fine « Comment lire cet écran » → panneau repliable (LayoutAnimation). */
function HowToRead({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReduceMotion();
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={theme.hitSlop}
        onPress={() => {
          if (!reduceMotion) {
            LayoutAnimation.configureNext(
              LayoutAnimation.create(
                220,
                LayoutAnimation.Types.easeInEaseOut,
                LayoutAnimation.Properties.opacity
              )
            );
          }
          setOpen((o) => !o);
        }}
        style={({ pressed }) => [s.howBtn, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={s.howLabel}>Comment lire cet écran</Text>
        <Text style={[s.howChevron, open ? s.howChevronOpen : null]}>›</Text>
      </Pressable>
      {open ? <View style={s.howPanel}>{children}</View> : null}
    </View>
  );
}

/** Une ligne du panneau : pastille de couleur (optionnelle) + phrase factuelle. */
function HowRow({ color, children }: { color?: string; children: ReactNode }) {
  return (
    <View style={s.howRow}>
      {color ? <View style={[s.howDot, { backgroundColor: color }]} /> : null}
      <Text style={s.howText}>{children}</Text>
    </View>
  );
}

/** Légende compacte : une pastille + un libellé par donnée, dans SA couleur. */
function HowLegend({ items }: { items: readonly { label: string; color: string }[] }) {
  return (
    <View style={s.howLegendWrap}>
      {items.map((it) => (
        <View key={it.label} style={s.howLegendItem}>
          <View style={[s.howLegendDot, { backgroundColor: it.color }]} />
          <Text style={[s.howLegendTxt, { color: it.color }]}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

const s = {
  accroche: {
    fontFamily: fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.8,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    textAlign: 'center' as const,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  // Ligne de lecture (build 23) : dit ce qu'on regarde, en une phrase simple.
  lectureLine: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    lineHeight: theme.fontSize.small * 1.55,
    textAlign: 'center' as const,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionEyebrow: {
    fontFamily: fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  // « Comment lire cet écran » — affordance fine + panneau sobre.
  howBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    minHeight: 44,
  },
  howLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  howChevron: { fontFamily: fonts.body, fontSize: 16, color: palette.creamMute },
  howChevronOpen: { transform: [{ rotate: '90deg' }] },
  howPanel: { gap: spacing.sm, paddingBottom: spacing.xs },
  howRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: spacing.sm },
  howDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  howText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamSoft,
    lineHeight: theme.fontSize.small * 1.55,
  },
  howLegendWrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
  howLegendItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5 },
  howLegendDot: { width: 7, height: 7, borderRadius: 4 },
  howLegendTxt: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.6 },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  // Carte « votre lecture » — 3 lignes pastille + phrase (maquette).
  lectureCard: {
    backgroundColor: palette.card2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  lectureRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.sm,
  },
  lectureDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  lectureText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: theme.fontSize.body,
    color: palette.creamSoft,
    lineHeight: theme.fontSize.body * 1.5,
  },
  monthRow: { flexDirection: 'row' as const, gap: spacing.sm },
  cornerPanel: {
    backgroundColor: palette.card2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  cornerName: {
    fontFamily: fonts.mono,
    fontSize: theme.fontSize.body,
    letterSpacing: 0.5,
    color: palette.heritageGold,
  },
  cornerRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: spacing.xs,
  },
  cornerValue: {
    fontFamily: fonts.mono,
    fontSize: theme.fontSize.body,
    color: palette.cream,
  },
  snapPanel: {
    backgroundColor: palette.card2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  snapDate: {
    fontFamily: fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  snapLine: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.body,
    color: palette.cream,
  },
  snapShareRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  snapShareLabel: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
  },
  snapFootnote: {
    fontFamily: fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },
  doctrine: {
    fontFamily: fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: palette.creamMute,
    textAlign: 'center' as const,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xxl,
  },
};
