/**
 * Décharge de responsabilité — signature e-sign (P3). Décisions fondateur
 * 2026-07-12 : signature SIMPLE, timing À LA RÉSERVATION (param `bookingId`),
 * périmètre PILOTE. Le pilote lit le texte, saisit son nom, coche le consentement
 * et signe ; l'app horodate et scelle l'empreinte du texte (waiverService).
 *
 * Gaté par le flag `pilot_waivers` (OFF) : tant qu'il est inactif, on affiche
 * « Bientôt » — rien de légalement effectif tant que le texte n'est pas relu par
 * un avocat. Doctrine : vouvoiement, sans emoji, honnêteté (l'app conserve la
 * preuve ; le pilote reste seul responsable de sa déclaration).
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { LEGAL_DOCUMENTS } from '@/legal/legalDocuments';
import { isFlagEnabled } from '@/services/featureFlagsService';
import {
  WAIVER_VERSION,
  type WaiverSignature,
  acceptWaiver,
  listMyWaivers,
} from '@/services/waiverService';
import { hasCurrentSignature, isValidSignerName } from '@/services/waiverLogic';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { CockpitPanel } from '@/ui/CockpitPanel';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatDateLong } from '@/utils/format';

const { palette, spacing, fonts, fontSize, radius } = theme;

export default function DechargeScreen() {
  const params = useLocalSearchParams<{ bookingId?: string; sessionId?: string }>();
  const bookingId = params.bookingId ?? null;
  const sessionId = params.sessionId ?? null;

  const profile = useAuthStore((st) => st.profile);
  const [state, setState] = useState<ScreenState>('loading');
  const [flagOn, setFlagOn] = useState(false);
  const [waivers, setWaivers] = useState<WaiverSignature[]>([]);

  const [accepted, setAccepted] = useState(false);
  const [fullName, setFullName] = useState('');
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    (async () => {
      const on = await isFlagEnabled('pilot_waivers');
      if (cancelled) return;
      setFlagOn(on);
      if (!on) {
        setState('nominal');
        return;
      }
      const list = await listMyWaivers();
      if (cancelled) return;
      setWaivers(list);
      setFullName(
        (prev) => prev || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || ''
      );
      setState('nominal');
    })().catch(() => {
      if (!cancelled) setState('error');
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, profile?.first_name, profile?.last_name]);

  const doc = LEGAL_DOCUMENTS.decharge;
  const alreadySigned = useMemo(
    () => hasCurrentSignature(waivers, WAIVER_VERSION, bookingId),
    [waivers, bookingId]
  );
  const canSign = accepted && isValidSignerName(fullName) && !signing;

  async function onSign() {
    if (!canSign) return;
    setSigning(true);
    setSignError(null);
    const res = await acceptWaiver({ fullName, bookingId, sessionId });
    setSigning(false);
    if (res.ok) {
      setAccepted(false);
      setReloadKey((k) => k + 1);
    } else {
      setSignError(
        "Votre signature n'a pas pu être enregistrée. Vérifiez votre connexion, puis réessayez."
      );
    }
  }

  return (
    <Screen>
      <AppBar title="DÉCHARGE" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
      >
        <StateWrapper
          state={state}
          skeletonLines={6}
          errorCause="La décharge n'a pas pu être chargée."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          {!flagOn ? (
            <CockpitPanel plain style={{ marginTop: spacing.sm }}>
              <Text style={s.eyebrow}>Bientôt</Text>
              <Text style={s.body}>
                La signature électronique de la décharge s&apos;ouvrira prochainement. En attendant,
                la décharge vous est présentée et signée sur place, avant de rouler.
              </Text>
            </CockpitPanel>
          ) : alreadySigned ? (
            <>
              <CockpitPanel style={{ marginTop: spacing.sm }}>
                <Text style={s.eyebrow}>Décharge signée</Text>
                <Text style={s.body}>
                  Votre décharge (version {WAIVER_VERSION}) est enregistrée
                  {bookingId ? ' pour cette réservation' : ''}. Vous pouvez la relire à tout moment.
                </Text>
              </CockpitPanel>
              <WaiverHistory waivers={waivers} />
            </>
          ) : (
            <>
              <Text style={s.title} accessibilityRole="header">
                {doc.title}
              </Text>
              <View style={s.textCard}>{renderMarkdown(doc.body)}</View>

              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: accepted }}
                onPress={() => setAccepted((v) => !v)}
                style={s.checkRow}
                hitSlop={theme.hitSlop}
              >
                <View style={[s.checkbox, accepted ? s.checkboxOn : null]}>
                  {accepted ? <Text style={s.checkMark}>✓</Text> : null}
                </View>
                <Text style={s.checkLabel}>
                  J&apos;ai lu la décharge ci-dessus et je l&apos;accepte.
                </Text>
              </Pressable>

              <Field
                label="Votre nom complet"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Prénom Nom"
                autoCapitalize="words"
                maxLength={120}
                helper="Tel qu'il figurera sur la signature horodatée."
                containerStyle={{ marginTop: spacing.lg }}
              />

              <Button label="Je signe" onPress={onSign} loading={signing} disabled={!canSign} />
              {signError ? <Text style={s.signError}>{signError}</Text> : null}
              <Text style={s.footnote}>
                Votre signature est horodatée et accompagnée d&apos;une empreinte du texte accepté
                (pour vérifier la version signée). Vous restez seul responsable de votre
                déclaration.
              </Text>

              <WaiverHistory waivers={waivers} />
            </>
          )}
        </StateWrapper>
      </ScrollView>
    </Screen>
  );
}

function WaiverHistory({ waivers }: { waivers: WaiverSignature[] }) {
  if (waivers.length === 0) return null;
  return (
    <View style={{ marginTop: spacing.xxl }}>
      <Text style={s.sectionLabel}>SIGNATURES</Text>
      <View style={{ gap: spacing.sm }}>
        {waivers.map((w) => (
          <View key={w.id} style={s.histRow}>
            <Text style={s.histName}>{w.signedFullName}</Text>
            <Text style={s.histMeta}>
              Version {w.waiverVersion} · {formatDateLong(w.signedAt)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Rendu markdown minimal et sobre (même esprit que le viewer légal). */
function renderMarkdown(body: string) {
  return body.split('\n').map((raw, i) => {
    const line = raw.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
    const t = line.trim();
    const key = `l${i}`;
    if (t === '') return <View key={key} style={{ height: spacing.sm }} />;
    if (t === '---' || t === '***' || t === '___') return <View key={key} style={s.hr} />;
    if (t.startsWith('## '))
      return (
        <Text key={key} accessibilityRole="header" style={s.h2}>
          {t.slice(3)}
        </Text>
      );
    if (t.startsWith('# '))
      return (
        <Text key={key} accessibilityRole="header" style={s.h1}>
          {t.slice(2)}
        </Text>
      );
    if (/^\d+\.\s/.test(t))
      return (
        <Text key={key} style={[s.para, s.bullet]}>
          {t}
        </Text>
      );
    if (t.startsWith('- ') || t.startsWith('* '))
      return (
        <Text key={key} style={[s.para, s.bullet]}>
          {`•  ${t.slice(2)}`}
        </Text>
      );
    if (/^>\s?/.test(t))
      return (
        <Text key={key} style={[s.para, s.quote]}>
          {t.replace(/^>\s?/, '')}
        </Text>
      );
    return (
      <Text key={key} style={s.para}>
        {t}
      </Text>
    );
  });
}

const s = StyleSheet.create({
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamSoft,
    lineHeight: fontSize.body * 1.5,
  },
  textCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    backgroundColor: palette.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Case de consentement : crème neutre (l'or = chrono/record uniquement).
  checkboxOn: { borderColor: palette.cream, backgroundColor: 'rgba(255,255,255,0.08)' },
  checkMark: { color: palette.cream, fontSize: 15, fontFamily: fonts.bodySemi },
  checkLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamSoft,
  },
  footnote: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic',
    color: palette.creamMute,
    marginTop: spacing.md,
    lineHeight: fontSize.small * 1.5,
  },
  signError: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.red,
    marginTop: spacing.sm,
    lineHeight: fontSize.small * 1.5,
  },
  histRow: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: palette.card,
  },
  histName: { fontFamily: fonts.bodyMedium, fontSize: fontSize.body, color: palette.cream },
  histMeta: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
  },
  h1: {
    fontFamily: fonts.display,
    color: palette.cream,
    fontSize: fontSize.bodyLg,
    letterSpacing: 0.3,
    marginBottom: spacing.sm,
  },
  h2: {
    fontFamily: fonts.bodySemi,
    color: palette.cream,
    fontSize: fontSize.body,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  para: {
    fontFamily: fonts.bodyLight,
    color: palette.creamSoft,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.6,
    marginBottom: spacing.xs,
  },
  bullet: { paddingLeft: spacing.md },
  quote: { fontStyle: 'italic', color: palette.creamMute },
  hr: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.line,
    marginVertical: spacing.md,
  },
});
