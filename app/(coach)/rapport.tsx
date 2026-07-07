/**
 * Coach — Rapport de séance (PDF). Réintégration coach__rapport.
 *
 * Le coach rédige SON bilan d'une séance et génère un PDF de synthèse (QDI 5
 * branches + faits clés + son bilan attribué), partagé via la share sheet native
 * (= « envoi pilote »). Câble getStudioSession (données) + coachReportPdfService
 * (rendu). Aucun schéma nouveau ; le bilan n'est pas stocké — il voyage dans le
 * document.
 *
 * expo-print ne tourne pas en Expo Go (build natif) : on le signale honnêtement.
 */

import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';

import { type StudioSession, getStudioSession } from '@/services/coachStudioService';
import { exportAndShareCoachReport } from '@/services/coachReportPdfService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { CockpitPanel } from '@/ui/CockpitPanel';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatLapTime } from '@/utils/format';

const { palette, spacing } = theme;

export default function CoachRapportScreen() {
  const params = useLocalSearchParams<{ sessionId?: string; startedAt?: string }>();
  const sessionId = params.sessionId;

  const [studio, setStudio] = useState<StudioSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [bilan, setBilan] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    getStudioSession(sessionId)
      .then((s) => {
        if (!cancelled) {
          setStudio(s);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, reloadKey]);

  async function onGenerate() {
    if (!sessionId || generating) return;
    setGenerating(true);
    const res = await exportAndShareCoachReport({
      sessionId,
      coachBilan: bilan,
      startedAt: params.startedAt ?? null,
    });
    setGenerating(false);
    Toast.show(
      res.ok
        ? { type: 'success', text1: 'Rapport généré.' }
        : { type: 'error', text1: res.error ?? 'Génération impossible.' }
    );
  }

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : !sessionId || !studio
        ? 'empty'
        : 'nominal';

  return (
    <Screen scroll={false}>
      <AppBar title="RAPPORT" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
          <View style={{ marginBottom: spacing.md }}>
            <RoleBadge role="coach" />
          </View>

          <StateWrapper
            state={state}
            skeletonLines={5}
            emptyLabel="Aucune séance"
            emptyMessage="Ouvrez le rapport depuis une séance de votre file de lecture."
            errorCause="La séance n'a pas pu être chargée."
            onRetry={() => setReloadKey((k) => k + 1)}
          >
            {studio ? (
              <>
                {/* Aperçu des faits clés qui iront dans le PDF. */}
                <CockpitPanel>
                  <Text style={s.eyebrow}>{studio.circuitName ?? 'Séance'}</Text>
                  <Text style={s.facts}>
                    {studio.lapCount} tour{studio.lapCount > 1 ? 's' : ''}
                    {studio.bestLapSeconds != null
                      ? ` · meilleur ${formatLapTime(studio.bestLapSeconds)}`
                      : ''}
                    {studio.qdi ? ' · QDI 5 branches' : ' · QDI en attente'}
                  </Text>
                </CockpitPanel>

                <View style={{ marginTop: spacing.xl }}>
                  <Field
                    label="Le bilan de votre coach"
                    value={bilan}
                    onChangeText={setBilan}
                    placeholder="Votre synthèse pour ce pilote. Elle apparaîtra attribuée, dans une bande à votre nom."
                    multiline
                    numberOfLines={6}
                    maxLength={1500}
                    showCounter
                    optional
                  />
                </View>

                <View style={{ marginTop: spacing.xl }}>
                  <Button
                    label={generating ? 'Génération…' : 'Générer et envoyer le rapport PDF'}
                    onPress={onGenerate}
                    loading={generating}
                  />
                </View>

                <Text style={s.note}>
                  Le rapport reprend le QDI, les faits clés et votre bilan. Le rendu PDF s’ouvre
                  dans le build de l’application (impression native).
                </Text>
              </>
            ) : null}
          </StateWrapper>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginBottom: spacing.sm,
  },
  facts: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamSoft,
  },
  note: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: palette.creamMute,
    marginTop: spacing.xl,
    lineHeight: theme.fontSize.small * 1.5,
  },
};
