/**
 * Vue Coach — E0.1 : configuration de la vue AR (lunettes Ray-Ban Display).
 *
 * DOCTRINE — NON NÉGOCIABLE (bloc E0, cf. docs/specs-bundle-v4/specs/E0_ar_coach.md) :
 *   - L'AR est l'outil DU COACH, porté par le coach AU BORD DE PISTE — JAMAIS le
 *     pilote. Le pilote roule en silence : rien ici ne touche le côté pilote.
 *     Aucune vue AR côté pilote, nulle part.
 *   - FAITS uniquement. La vue in-lens montre des faits (chrono, delta vs la
 *     référence PERSO du pilote, secteur). JAMAIS une consigne (« dis-lui de
 *     freiner… »). L'app ne prescrit rien — le coach lit le fait et décide de sa
 *     pédagogie, sous sa responsabilité.
 *   - Accès strictement coach (cet écran vit sous app/(coach)/, déjà gardé par
 *     rôle dans _layout.tsx) ET uniquement pour les pilotes qui ont invité le
 *     coach (consentement). On réutilise la MÊME source de pilotes que le reste
 *     de l'espace coach : `listMyPilots()` → `coach_pilots_view` (RLS : coach_id
 *     = auth.uid() ET pilot_consent_at IS NOT NULL).
 *   - PREVIEW / PROTOTYPE. Les Ray-Ban Display sont en developer preview Meta :
 *     non publiable au grand public tant que la GA n'est pas ouverte. La
 *     fonctionnalité est marquée preview dans l'UI. On NE simule PAS de connexion
 *     lunettes : état neutre « non appairées — aperçu ». On NE fabrique JAMAIS de
 *     fausse valeur.
 *
 * Couleurs : accent coach = theme.palette.coach (crème neutre). gold = donnée ;
 * red = marque. PAS de bronze (admin), PAS de heritageGold.
 *
 * La vue in-lens elle-même (E0.2, page `ar-view`) est servie côté WEB (route
 * dédiée, hors bundle Expo) pour pouvoir évoluer sans repasser par les stores.
 * Ici on en montre un APERÇU via WebView. La route web peut ne pas être live :
 * on gère loading + erreur/404 proprement, jamais un crash.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { WebView } from 'react-native-webview';
import type {
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewNavigationEvent,
} from 'react-native-webview/lib/WebViewTypes';

import { Logo } from '@/brand/Logo';
import * as haptics from '@/lib/haptics';
import {
  type CoachPilotRow,
  type PilotSessionSummary,
  listMyPilots,
  listPilotSessions,
} from '@/services/coachService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateLong } from '@/utils/format';

/**
 * Route web de la vue in-lens (E0.2). Construite côté site, peut ne pas être
 * encore en ligne : la WebView gère ce cas avec un repli sobre.
 */
const AR_VIEW_URL = 'https://app.oxvehicle.fr/ar-view';

/** Statut de chargement de l'aperçu in-lens (WebView). */
type PreviewState = 'loading' | 'ready' | 'error';

export default function CoachArScreen() {
  const [pilots, setPilots] = useState<CoachPilotRow[]>([]);
  const [loadingPilots, setLoadingPilots] = useState(true);

  const [selectedPilotId, setSelectedPilotId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<PilotSessionSummary[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const [previewState, setPreviewState] = useState<PreviewState>('loading');

  // Pilotes consentis (même source que tout l'espace coach).
  useEffect(() => {
    let cancelled = false;
    listMyPilots()
      .then((rows) => {
        if (!cancelled) {
          setPilots(rows);
          setLoadingPilots(false);
        }
      })
      .catch(() => {
        // Réseau coupé : on sort du loading, l'état vide gère l'affichage.
        if (!cancelled) setLoadingPilots(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sessions du pilote sélectionné (RLS coach). Re-sélection remet la session à zéro.
  useEffect(() => {
    if (!selectedPilotId) {
      setSessions([]);
      setSelectedSessionId(null);
      return;
    }
    let cancelled = false;
    setLoadingSessions(true);
    setSelectedSessionId(null);
    listPilotSessions(selectedPilotId)
      .then((rows) => {
        if (!cancelled) {
          setSessions(rows);
          setLoadingSessions(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSessions([]);
          setLoadingSessions(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPilotId]);

  const selectedPilot = useMemo(
    () => pilots.find((p) => p.pilotId === selectedPilotId) ?? null,
    [pilots, selectedPilotId]
  );

  const onSelectPilot = useCallback((pilotId: string) => {
    haptics.tap();
    setSelectedPilotId((prev) => (prev === pilotId ? null : pilotId));
  }, []);

  const onSelectSession = useCallback((sessionId: string) => {
    haptics.tap();
    setSelectedSessionId((prev) => (prev === sessionId ? null : sessionId));
  }, []);

  // WebView : démarrage d'un chargement (peut survenir à chaque navigation interne).
  const onPreviewLoadStart = useCallback(() => {
    setPreviewState('loading');
  }, []);

  const onPreviewLoad = useCallback((e: WebViewNavigationEvent) => {
    // Certaines plateformes 404 servent une page : on la traite via onHttpError.
    // Ici on bascule "ready" seulement si l'URL a bien chargé.
    if (e.nativeEvent.url) setPreviewState('ready');
  }, []);

  // Échec réseau / route absente → repli sobre, jamais de crash ni fausse valeur.
  const onPreviewError = useCallback((_e: WebViewErrorEvent) => {
    setPreviewState('error');
  }, []);

  const onPreviewHttpError = useCallback((_e: WebViewHttpErrorEvent) => {
    // 404 / 5xx : la route web n'est pas (encore) servie.
    setPreviewState('error');
  }, []);

  // « Lancer la vue AR » : prototype. La vue live in-lens (E0.2) est une route
  // web poussée vers les lunettes du coach — non embarquée. Tant que ce n'est
  // pas branché, on reste honnête : pas de fausse mise en route.
  const canLaunch = selectedPilotId !== null && selectedSessionId !== null;

  const pilotFullName = useCallback(
    (pilot: CoachPilotRow) =>
      [pilot.firstName, pilot.lastName].filter(Boolean).join(' ') || 'Pilote',
    []
  );

  return (
    <Screen>
      <AppBar title="VUE AR" leading={<Logo size={24} />} onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        {/* En-tête + badge preview, accent coach */}
        <View style={s.headerRow}>
          <Text style={s.eyebrow}>VUE AR COACH</Text>
          <View style={s.previewBadge}>
            <View style={s.previewDot} />
            <Text style={s.previewBadgeText}>APERÇU · PROTOTYPE</Text>
          </View>
        </View>
        <Text style={s.title}>Vos lunettes, au bord de piste.</Text>
        <Text style={s.manifest}>
          Préparez les faits que vous lirez dans vos lunettes pour la session d&apos;un pilote. Le
          pilote, lui, roule en silence : rien ne s&apos;affiche de son côté.
        </Text>

        {/* Bandeau de cadrage : preview, faits, pilote silencieux */}
        <Card style={s.frameCard}>
          <Text style={s.frameText}>
            Outil réservé au coach, à l&apos;arrêt. La vue montre des faits (chrono, écart vs la
            référence du pilote, secteur) — jamais une consigne. Matériel Ray-Ban Display en preview
            développeur : non disponible au grand public à ce jour.
          </Text>
        </Card>

        {/* ---- 1. Sélection du pilote (consentis uniquement) ---- */}
        <View style={s.sectionHead}>
          <SectionLabel>1 · PILOTE</SectionLabel>
        </View>
        {loadingPilots ? (
          <Text style={s.caption}>Chargement…</Text>
        ) : pilots.length === 0 ? (
          <Card style={s.emptyCard}>
            <Text style={s.emptyTitle}>Aucun pilote ne vous a invité pour l&apos;instant.</Text>
            <Text style={s.emptyHint}>
              Sélectionnez un pilote et connectez vos lunettes pour préparer la vue. Un pilote doit
              consentir au coaching avant que vous voyiez ses données.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {pilots.map((pilot) => {
              const active = pilot.pilotId === selectedPilotId;
              return (
                <Pressable
                  key={pilot.pilotId}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Pilote ${pilotFullName(pilot)}`}
                  onPress={() => onSelectPilot(pilot.pilotId)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                >
                  <Card
                    style={{
                      borderColor: active ? theme.palette.coach : theme.palette.line,
                      borderWidth: active ? 1.5 : 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.md,
                    }}
                  >
                    <View style={[s.radio, active && s.radioOn]}>
                      {active ? <View style={s.radioInner} /> : null}
                    </View>
                    <Text style={s.pilotName}>{pilotFullName(pilot)}</Text>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ---- 2. Sélection de la session ---- */}
        {selectedPilotId ? (
          <>
            <View style={s.sectionHead}>
              <SectionLabel>2 · SESSION</SectionLabel>
            </View>
            {loadingSessions ? (
              <Text style={s.caption}>Chargement des sessions…</Text>
            ) : sessions.length === 0 ? (
              <Card style={s.emptyCard}>
                <Text style={s.emptyHint}>
                  Aucune session analysée pour{' '}
                  {selectedPilot ? pilotFullName(selectedPilot) : 'ce pilote'}.
                </Text>
              </Card>
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                {sessions.map((session) => {
                  const active = session.id === selectedSessionId;
                  const lapStr = session.lapCount
                    ? `${session.lapCount} tour${session.lapCount > 1 ? 's' : ''}`
                    : '—';
                  return (
                    <Pressable
                      key={session.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Session du ${formatDateLong(session.startedAt)}`}
                      onPress={() => onSelectSession(session.id)}
                      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                    >
                      <Card
                        style={{
                          borderColor: active ? theme.palette.coach : theme.palette.line,
                          borderWidth: active ? 1.5 : 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: theme.spacing.md,
                        }}
                      >
                        <View style={[s.radio, active && s.radioOn]}>
                          {active ? <View style={s.radioInner} /> : null}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.sessionDate}>{formatDateLong(session.startedAt)}</Text>
                          <Text style={s.caption}>
                            {session.circuitName ?? 'Circuit'} · {lapStr}
                          </Text>
                        </View>
                      </Card>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        ) : null}

        {/* ---- 3. États matériels : lunettes + flux capteur ---- */}
        <View style={s.sectionHead}>
          <SectionLabel>3 · ÉQUIPEMENT</SectionLabel>
        </View>
        <Card style={{ gap: theme.spacing.md }}>
          {/* Appairage lunettes : NON simulé. État neutre honnête. */}
          <StatusRow
            label="Lunettes Ray-Ban Display"
            value="Non appairées — aperçu"
            tone="neutral"
          />
          {/* Flux capteur : dépend de la session sélectionnée (honnête, pas de fausse valeur). */}
          <View style={s.statusDivider} />
          <StatusRow
            label="Flux capteur"
            value={selectedSessionId ? 'Session sélectionnée' : 'En attente de sélection'}
            tone={selectedSessionId ? 'ok' : 'neutral'}
          />
        </Card>

        {/* ---- 4. Aperçu de la vue in-lens (route web E0.2) ---- */}
        <View style={s.sectionHead}>
          <SectionLabel>APERÇU IN-LENS</SectionLabel>
        </View>
        <Text style={[s.caption, { marginBottom: theme.spacing.sm }]}>
          Ce que verra le coach dans ses lunettes. Servie côté web ({AR_VIEW_URL}).
        </Text>
        <Card style={s.previewCard}>
          <View style={s.previewFrame}>
            <WebView
              source={{ uri: AR_VIEW_URL }}
              originWhitelist={['https://*']}
              onLoadStart={onPreviewLoadStart}
              onLoad={onPreviewLoad}
              onError={onPreviewError}
              onHttpError={onPreviewHttpError}
              style={s.webview}
              // Fond sombre pendant le rendu, cohérent avec la vue in-lens.
              containerStyle={{ backgroundColor: theme.palette.night }}
            />
            {previewState === 'loading' ? (
              <View style={s.previewOverlay} pointerEvents="none">
                <ActivityIndicator color={theme.palette.creamMute} />
                <Text style={s.previewOverlayText}>Chargement de l&apos;aperçu…</Text>
              </View>
            ) : null}
            {previewState === 'error' ? (
              <View style={s.previewOverlay}>
                <Text style={s.previewErrorTitle}>Aperçu indisponible</Text>
                <Text style={s.previewErrorText}>La vue web arrive bientôt.</Text>
              </View>
            ) : null}
          </View>
        </Card>

        {/* ---- 5. Action : lancer la vue AR ---- */}
        <View style={{ marginTop: theme.spacing.xl }}>
          <Button
            label="Lancer la vue AR"
            disabled={!canLaunch}
            onPress={() => {
              if (!canLaunch) return;
              haptics.confirm();
              // Prototype : la mise en route live (push vers les lunettes) sera
              // branchée quand la route web E0.2 et l'appairage seront disponibles.
            }}
          />
          {!canLaunch ? (
            <Text style={[s.caption, { marginTop: theme.spacing.sm, textAlign: 'center' }]}>
              Sélectionnez un pilote et une session pour préparer la vue.
            </Text>
          ) : null}
        </View>

        {/* Rappel doctrine, pied de page sobre (red = marque) */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            Le coach lit ces faits et décide de sa pédagogie. L&apos;app ne dicte rien. Le pilote
            roule en silence.
          </Text>
        </View>

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={s.backLink}>Retour</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'ok' | 'neutral';
}) {
  return (
    <View style={s.statusRow}>
      <View style={s.statusLeft}>
        <View
          style={[
            s.statusDot,
            { backgroundColor: tone === 'ok' ? theme.dataColors.accel : theme.palette.faint },
          ]}
        />
        <Text style={s.statusLabel}>{label}</Text>
      </View>
      <Text style={s.statusValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: theme.palette.coach,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: theme.palette.coach,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  previewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.gold,
  },
  previewBadgeText: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: theme.palette.cream,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic',
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.md,
  },
  frameCard: {
    borderColor: theme.palette.coach,
    marginTop: theme.spacing.xl,
  },
  frameText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    lineHeight: theme.fontSize.small * 1.55,
    color: theme.palette.creamSoft,
  },
  sectionHead: {
    marginTop: theme.spacing.xxl,
    marginBottom: theme.spacing.md,
  },
  caption: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyTitle: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic',
    color: theme.palette.creamSoft,
    textAlign: 'center',
  },
  emptyHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    lineHeight: theme.fontSize.small * 1.5,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: theme.palette.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: theme.palette.coach },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.palette.coach,
  },
  pilotName: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 0.3,
    color: theme.palette.cream,
  },
  sessionDate: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  statusValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
    textAlign: 'right',
  },
  statusDivider: {
    height: 1,
    backgroundColor: theme.palette.line,
  },
  previewCard: {
    padding: 0,
    overflow: 'hidden',
  },
  previewFrame: {
    height: 200,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    backgroundColor: theme.palette.night,
    justifyContent: 'center',
  },
  webview: {
    flex: 1,
    backgroundColor: theme.palette.night,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.palette.night,
  },
  previewOverlayText: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
  },
  previewErrorTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    color: theme.palette.cream,
  },
  previewErrorText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  footer: {
    borderLeftWidth: 2,
    borderLeftColor: theme.palette.red,
    paddingLeft: theme.spacing.md,
    marginTop: theme.spacing.xxl,
  },
  footerText: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic',
    lineHeight: theme.fontSize.small * 1.6,
    color: theme.palette.creamMute,
  },
  backLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
});
