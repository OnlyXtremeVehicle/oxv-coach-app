/**
 * DÉCHARGE — sous-écran de VOUS/Documents (lot V2-L4). Route `vous/decharge`.
 * Flux e-sign v1 rebrandé au langage v2 ; services et logique INCHANGÉS
 * (waiverService, waiverLogic).
 *
 * Gaté par le drapeau `pilot_waivers`, VÉRIFIÉ SUR L'ÉCRAN (fail-closed) : tant
 * qu'il est OFF (texte non relu par un avocat), on affiche « Bientôt » — rien de
 * légalement effectif n'est présenté. ON : le pilote lit le texte, saisit son
 * nom, coche le consentement et signe ; l'app horodate et scelle l'empreinte du
 * texte (waiverService). Le pilote reste seul responsable de sa déclaration.
 */

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { LEGAL_DOCUMENTS } from '@/legal/legalDocuments';
import { isFlagEnabled } from '@/services/featureFlagsService';
import {
  WAIVER_VERSION,
  acceptWaiver,
  listMyWaivers,
  type WaiverSignature,
} from '@/services/waiverService';
import { hasCurrentSignature, isValidSignerName } from '@/services/waiverLogic';
import { useAuthStore } from '@/store/useAuthStore';
import {
  colors,
  haptic,
  PressScale,
  radius,
  space,
  StateView,
  typo,
  useDoorTransition,
} from '@/ui/v2';

function longDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function DechargeScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const params = useLocalSearchParams<{ bookingId?: string; sessionId?: string }>();
  const bookingId = params.bookingId ?? null;
  const sessionId = params.sessionId ?? null;
  const profile = useAuthStore((s) => s.profile);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [flagOn, setFlagOn] = useState(false);
  const [waivers, setWaivers] = useState<WaiverSignature[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      const on = await isFlagEnabled('pilot_waivers');
      if (cancelled) return;
      setFlagOn(on);
      if (!on) {
        setStatus('ready');
        return;
      }
      const list = await listMyWaivers();
      if (cancelled) return;
      setWaivers(list);
      setSignerName(
        (prev) => prev || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || ''
      );
      setStatus('ready');
    })().catch(() => {
      if (!cancelled) setStatus('error');
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
  const canSign = accepted && isValidSignerName(signerName) && !signing;

  const onSign = async () => {
    if (!canSign) return;
    setSigning(true);
    setSignError(null);
    haptic('record');
    const res = await acceptWaiver({ fullName: signerName, bookingId, sessionId });
    setSigning(false);
    if (res.ok) {
      setAccepted(false);
      setReloadKey((k) => k + 1);
    } else {
      setSignError(
        "Votre signature n'a pas pu être enregistrée. Vérifiez votre connexion, puis réessayez."
      );
    }
  };

  return (
    <Animated.View style={[styles.root, door]}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <PressScale
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <BackGlyph />
        </PressScale>
        <Text style={styles.headerTitle}>DÉCHARGE</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingTop: space.md,
          paddingBottom: insets.bottom + space.xxl,
        }}
      >
        {status === 'loading' ? (
          <StateView state="loading" shape="list" />
        ) : status === 'error' ? (
          <StateView
            state="error"
            errorMessage="La décharge n'a pas pu être chargée."
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        ) : !flagOn ? (
          // Fail-closed : rien de légalement effectif tant que le flag est OFF.
          <View style={styles.panel}>
            <Text style={styles.panelEyebrow}>BIENTÔT</Text>
            <Text style={styles.panelBody}>
              La signature électronique de la décharge s&apos;ouvrira prochainement. En attendant,
              la décharge vous est présentée et signée sur place, avant de rouler.
            </Text>
          </View>
        ) : alreadySigned ? (
          <>
            <View style={styles.panel}>
              <Text style={styles.panelEyebrow}>DÉCHARGE SIGNÉE</Text>
              <Text style={styles.panelBody}>
                Votre décharge (version {WAIVER_VERSION}) est enregistrée
                {bookingId ? ' pour cette réservation' : ''}. Vous pouvez la relire à tout moment.
              </Text>
            </View>
            <WaiverHistory waivers={waivers} />
          </>
        ) : (
          <>
            <Text style={styles.title} accessibilityRole="header">
              {doc.title}
            </Text>
            <View style={styles.textCard}>{renderMarkdown(doc.body)}</View>

            <PressScale
              onPress={() => setAccepted((v) => !v)}
              accessibilityLabel="J'ai lu la décharge et je l'accepte"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: accepted }}
              style={styles.checkRow}
            >
              <View style={[styles.checkbox, accepted && styles.checkboxOn]}>
                {accepted ? <CheckGlyph /> : null}
              </View>
              <Text style={styles.checkLabel}>
                J&apos;ai lu la décharge ci-dessus et je l&apos;accepte.
              </Text>
            </PressScale>

            <Text style={styles.fieldLabel}>Votre nom complet</Text>
            <TextInput
              value={signerName}
              onChangeText={setSignerName}
              placeholder="Prénom Nom"
              placeholderTextColor={colors.text.dim}
              autoCapitalize="words"
              maxLength={120}
              selectionColor={colors.accent}
              style={styles.field}
              accessibilityLabel="Votre nom complet"
            />
            <Text style={styles.fieldHelp}>
              Tel qu&apos;il figurera sur la signature horodatée.
            </Text>

            <PressScale
              onPress={onSign}
              disabled={!canSign}
              accessibilityLabel="Je signe la décharge"
              accessibilityState={{ disabled: !canSign }}
              containerStyle={styles.signBtnContainer}
              style={[styles.signBtn, !canSign && styles.signBtnDisabled]}
            >
              <Text style={styles.signBtnLabel}>{signing ? 'SIGNATURE…' : 'JE SIGNE'}</Text>
            </PressScale>
            {signError ? <Text style={styles.signError}>{signError}</Text> : null}

            <Text style={styles.footnote}>
              Votre signature est horodatée et accompagnée d&apos;une empreinte du texte accepté
              (pour vérifier la version signée). Vous restez seul responsable de votre déclaration.
            </Text>

            <WaiverHistory waivers={waivers} />
          </>
        )}
      </Animated.ScrollView>
    </Animated.View>
  );
}

function WaiverHistory({ waivers }: { waivers: WaiverSignature[] }) {
  if (waivers.length === 0) return null;
  return (
    <View style={styles.history}>
      <Text style={styles.historyLabel}>SIGNATURES</Text>
      {waivers.map((w) => (
        <View key={w.id} style={styles.historyRow}>
          <Text style={styles.historyName}>{w.signedFullName}</Text>
          <Text style={styles.historyMeta}>
            Version {w.waiverVersion} · {longDate(w.signedAt)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Rendu markdown sobre (même esprit que le lecteur légal). */
function renderMarkdown(body: string) {
  return body.split('\n').map((raw, i) => {
    const line = raw.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
    const t = line.trim();
    const key = `l${i}`;
    if (t === '') return <View key={key} style={styles.gap} />;
    if (t === '---' || t === '***' || t === '___') return <View key={key} style={styles.hr} />;
    if (t.startsWith('## '))
      return (
        <Text key={key} accessibilityRole="header" style={styles.h2}>
          {t.slice(3)}
        </Text>
      );
    if (t.startsWith('# '))
      return (
        <Text key={key} accessibilityRole="header" style={styles.h1}>
          {t.slice(2)}
        </Text>
      );
    if (/^\d+\.\s/.test(t))
      return (
        <Text key={key} style={[styles.para, styles.bullet]}>
          {t}
        </Text>
      );
    if (t.startsWith('- ') || t.startsWith('* '))
      return (
        <Text key={key} style={[styles.para, styles.bullet]}>
          {`•  ${t.slice(2)}`}
        </Text>
      );
    return (
      <Text key={key} style={styles.para}>
        {t}
      </Text>
    );
  });
}

function BackGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M15 5 L8.5 12 L15 19"
        stroke={colors.text.hi}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function CheckGlyph() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path
        d="M5 12.5 L10 17.5 L19 7"
        stroke={colors.text.hi}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingBottom: space.sm,
  },
  headerTitle: {
    fontFamily: typo.display,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.text.hi,
  },
  headerSpacer: { width: 20 },

  panel: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.sm,
  },
  panelEyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.text.low,
  },
  panelBody: {
    fontFamily: typo.body,
    fontSize: 15,
    lineHeight: 15 * 1.55,
    color: colors.text.mid,
  },

  title: {
    fontFamily: typo.display,
    fontSize: 20,
    letterSpacing: 0.5,
    lineHeight: 28,
    color: colors.text.hi,
    marginTop: space.sm,
    marginBottom: space.lg,
  },
  textCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    backgroundColor: colors.bg.card,
    padding: space.lg,
    marginBottom: space.lg,
  },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: radius.cell,
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Coche NEUTRE (le glyphe suffit) : l'accent rouge unique du flux = « JE SIGNE ».
  checkboxOn: { borderColor: colors.text.hi },
  checkLabel: { flex: 1, fontFamily: typo.body, fontSize: 15, color: colors.text.mid },

  fieldLabel: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text.low,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  field: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    backgroundColor: colors.bg.card,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontFamily: typo.body,
    fontSize: 15,
    color: colors.text.hi,
  },
  fieldHelp: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.low,
    marginTop: space.xs,
  },

  signBtnContainer: { marginTop: space.lg, alignSelf: 'flex-start' },
  signBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.xxl,
    paddingVertical: space.md,
  },
  signBtnDisabled: { borderColor: colors.border.strong },
  signBtnLabel: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 1.8,
    color: colors.accent,
  },
  signError: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.accent,
    marginTop: space.sm,
  },
  footnote: {
    fontFamily: typo.body,
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 12 * 1.55,
    color: colors.text.low,
    marginTop: space.md,
  },

  history: { marginTop: space.xxl, gap: space.sm },
  historyLabel: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.text.low,
    marginBottom: space.xs,
  },
  historyRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    backgroundColor: colors.bg.card,
    padding: space.md,
  },
  historyName: { fontFamily: typo.bodyMedium, fontSize: 15, color: colors.text.hi },
  historyMeta: { fontFamily: typo.mono, fontSize: 12, color: colors.text.low, marginTop: 2 },

  gap: { height: space.sm },
  hr: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.hairline,
    marginVertical: space.md,
  },
  h1: {
    fontFamily: typo.display,
    fontSize: 17,
    color: colors.text.hi,
    marginBottom: space.sm,
  },
  h2: {
    fontFamily: typo.bodySemi,
    fontSize: 15,
    color: colors.text.hi,
    marginTop: space.md,
    marginBottom: space.xs,
  },
  para: {
    fontFamily: typo.body,
    fontSize: 15,
    lineHeight: 15 * 1.65,
    color: colors.text.mid,
    marginBottom: space.xs,
  },
  bullet: { paddingLeft: space.md },
});
