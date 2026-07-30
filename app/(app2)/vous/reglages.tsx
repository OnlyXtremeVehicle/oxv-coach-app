/**
 * RÉGLAGES — écran 7/8 de la porte VOUS (V2-L4, mission D). Route NOUVELLE.
 *
 * UN écran, quatre groupes SectionHeader + ListRow (switch en slot droit) :
 *   1. Notifications — maître push, rituels B3 (bilan/J-3/records), rappel J-1,
 *      offres partenaires (colonnes réelles `users`, JSONB préservé).
 *   2. Consentements — IA débrief, IA coach, audience, partage live coach,
 *      biométrie (capture + partage). Chaque bascule : sous-texte factuel une
 *      ligne + révocation immédiate (haptic warn). Révoquer la capture cardio
 *      ouvre une confirmation (Sheet) et coupe aussi le partage (garde-fou du
 *      service).
 *   3. Données & sécurité — export (Dial d'état), suppression J+30 (double
 *      confirmation).
 *   4. Session — déconnexion.
 *
 * Données réelles : chaque valeur trace vers une source (useReglages). Aucune
 * bascule n'affiche un état non confirmé par le serveur : sur échec d'écriture,
 * le hook annule l'état optimiste et pose `lastError`, rendu ici en bandeau
 * sobre. La révocation de la capture cardio (santé) ne passe OFF qu'après succès
 * serveur. Le switch est monochrome (piste claire = activé) — aucun accent rouge
 * dispersé, l'accent reste réservé aux actions destructrices confirmées.
 *
 * Doctrine : sobre, vouvoiement, zéro emoji, jamais prescriptif.
 */

import { type ReactNode, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { RITUAL_CHANNELS } from '@/features/vous/reglagesRitualsLogic';
import { isFlagEnabled } from '@/services/featureFlagsService';
import {
  biometrieVisible,
  requiresCaptureRevokeConfirm,
} from '@/features/vous/reglagesConsentLogic';
import { useReglages } from '@/features/vous/useReglages';
import {
  Dial,
  ListRow,
  PressScale,
  SectionHeader,
  Sheet,
  Shimmer,
  colors,
  haptic,
  radius,
  space,
  tabBarSpace,
  typo,
  useDoorTransition,
} from '@/ui/v2';

// Piste du switch : claire = activé, sombre = coupé. Monochrome (pas d'accent
// rouge répété) ; le pouce reste clair et lisible sur les deux états.
const SWITCH_TRACK = { false: colors.border.card, true: colors.text.low };

function BackChevron() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M14.5 5 L8 12 L14.5 19"
        stroke={colors.text.hi}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Ligne à bascule : ListRow (label + sous-texte 1 ligne) + Switch à droite. */
function ToggleRow({
  label,
  caption,
  value,
  onValueChange,
  divider = true,
  disabled = false,
}: {
  label: string;
  caption?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  divider?: boolean;
  disabled?: boolean;
}) {
  return (
    <ListRow
      label={label}
      sublabel={caption}
      divider={divider}
      disabled={disabled}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          accessibilityLabel={label}
          accessibilityHint={caption}
          trackColor={SWITCH_TRACK}
          thumbColor={colors.text.hi}
          ios_backgroundColor={colors.border.card}
        />
      }
    />
  );
}

/** Ligne d'action (export, suppression, déconnexion) — pressable, chevron. */
function ActionRow({
  label,
  caption,
  danger = false,
  divider = true,
  onPress,
}: {
  label: string;
  caption?: string;
  danger?: boolean;
  divider?: boolean;
  onPress: () => void;
}) {
  return (
    <PressScale onPress={onPress} accessibilityLabel={label}>
      <View style={[styles.actionRow, divider && styles.divider]}>
        <View style={styles.actionLabels}>
          <Text style={[styles.actionLabel, danger && styles.dangerText]}>{label}</Text>
          {caption ? <Text style={styles.actionCaption}>{caption}</Text> : null}
        </View>
        <Text style={[styles.chevron, danger && styles.dangerText]}>›</Text>
      </View>
    </PressScale>
  );
}

function Group({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <SectionHeader eyebrow={eyebrow} />
      <View style={styles.groupCard}>{children}</View>
    </View>
  );
}

export default function ReglagesScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const r = useReglages();
  const s = r.state;

  const [bioConfirm, setBioConfirm] = useState(false);

  /**
   * DRAPEAU BIOMÉTRIE — il manquait ici.
   *
   * `equipement.tsx` garde tout son bloc derrière `isFlagEnabled('biometry')`.
   * Cet écran affichait les mêmes interrupteurs sans aucun contrôle : un pilote
   * pouvait accorder la captation de son rythme cardiaque — donnée de santé,
   * article 9 — pendant que le drapeau déclarait la fonction absente.
   *
   * Fail-closed : tant que la réponse n'est pas revenue, on considère le
   * drapeau éteint. Un consentement de santé ne s'obtient pas par défaut.
   */
  const [bioFlag, setBioFlag] = useState(false);
  useEffect(() => {
    let annule = false;
    isFlagEnabled('biometry')
      .then((v) => {
        if (!annule) setBioFlag(v);
      })
      .catch(() => undefined);
    return () => {
      annule = true;
    };
  }, []);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Phase LOCALE de l'export : indépendante du flag async du hook, pour éviter
  // un flash « prêt » entre l'ouverture du Sheet et le passage en « busy ».
  const [exportPhase, setExportPhase] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [exportError, setExportError] = useState<string | null>(null);
  const disabled = !s.loaded;

  // Biométrie capture : activer → direct ; révoquer → confirmation (le service
  // coupera aussi le partage).
  function onToggleCapture(next: boolean) {
    if (requiresCaptureRevokeConfirm(s.biometry, { which: 'capture', value: next })) {
      setBioConfirm(true);
      return;
    }
    void r.applyBiometryCapture(next);
  }

  function confirmRevokeCapture() {
    haptic('warn');
    void r.applyBiometryCapture(false);
    setBioConfirm(false);
  }

  async function runExport() {
    setExportError(null);
    setExportPhase('busy');
    const res = await r.exportData();
    if (res.ok) {
      setExportPhase('done');
    } else {
      setExportError(res.error ?? "L'export n'a pas pu être préparé.");
      setExportPhase('error');
    }
  }

  async function confirmDelete() {
    haptic('warn');
    setDeleteError(null);
    const res = await r.deleteAccount();
    if (!res.ok) {
      // Échec honnête : on ne ferme pas le Sheet sans un mot (ce serait laisser
      // croire la demande enregistrée). Le pilote reste sur la confirmation avec
      // le message d'échec et peut réessayer.
      setDeleteError(res.error ?? 'La demande n’a pas pu être enregistrée. Réessayez.');
      return;
    }
    // Succès : deleteAccount() déconnecte (redirection par la garde du layout).
  }

  function openDelete() {
    setDeleteError(null);
    setDeleteStep(1);
  }

  function closeDelete() {
    setDeleteError(null);
    setDeleteStep(0);
  }

  return (
    <Animated.View style={[styles.root, door]}>
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <PressScale
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={styles.backDisc}>
            <BackChevron />
          </View>
        </PressScale>
        <Text style={styles.title} accessibilityRole="header">
          RÉGLAGES
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingTop: space.md,
          paddingBottom: tabBarSpace(insets.bottom) + space.xxl,
        }}
      >
        {/* Échec d'écriture : bandeau sobre (neutre, jamais l'accent rouge —
            réservé aux actions destructrices). Se dissipe au prochain
            enregistrement réussi. */}
        {s.lastError ? (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorBannerText}>{s.lastError}</Text>
          </View>
        ) : null}

        {/* 1 — NOTIFICATIONS */}
        <Group eyebrow="NOTIFICATIONS">
          <ToggleRow
            label="Notifications OXV"
            caption="Rien pendant que vous roulez."
            value={s.pushEnabled}
            onValueChange={r.toggleMasterPush}
            disabled={disabled}
            divider={s.pushEnabled}
          />
          {s.pushEnabled ? (
            <>
              {RITUAL_CHANNELS.map((rit) => (
                <ToggleRow
                  key={rit.id}
                  label={rit.label}
                  caption={rit.caption}
                  value={r.state.notifPrefs[rit.prefKey] !== false}
                  onValueChange={(v) => r.toggleRitual(rit.id, v)}
                  disabled={disabled}
                />
              ))}
              <ToggleRow
                label="La veille d'une séance"
                caption="Un rappel calme la veille d'un roulage à venir."
                value={r.readReminder()}
                onValueChange={r.toggleReminder}
                disabled={disabled}
              />
              <ToggleRow
                label="Offres partenaires"
                caption="Coupé par défaut, rien sans votre accord."
                value={s.offersEnabled}
                onValueChange={r.toggleOffers}
                disabled={disabled}
                divider={false}
              />
            </>
          ) : null}
        </Group>

        {/* 2 — CONSENTEMENTS */}
        <Group eyebrow="CONSENTEMENTS">
          <ToggleRow
            label="Débrief assisté par IA"
            caption="Récit du débrief rédigé par une IA hors UE. Coupé : rédaction locale."
            value={s.aiDebrief}
            onValueChange={r.toggleAiDebrief}
            disabled={disabled}
          />
          <ToggleRow
            label="Assistant IA de mon coach"
            caption="Votre coach pré-rédige ses observations avec une IA hors UE."
            value={s.coachAi}
            onValueChange={r.toggleCoachAi}
            disabled={disabled}
          />
          <ToggleRow
            label="Statistiques d'usage"
            caption="Anonymes, sans donnée personnelle. Sans conséquence si coupé."
            value={s.analytics}
            onValueChange={r.toggleAnalytics}
            disabled={disabled}
          />
          {s.hasLiveCoach ? (
            <ToggleRow
              label="Partage en direct avec mon coach"
              caption="Votre télémétrie et votre position en temps réel, pendant que vous roulez."
              value={s.liveCoach}
              onValueChange={(v) => {
                if (!v) haptic('warn');
                void r.toggleLiveCoach(v);
              }}
              disabled={disabled}
            />
          ) : null}
          {biometrieVisible(bioFlag, s.biometry) ? (
            <>
              <ToggleRow
                label="Rythme cardiaque"
                caption="Capté en séance (boîtier cardio). Coupé par défaut, données de santé."
                value={s.biometry.capture}
                onValueChange={onToggleCapture}
                disabled={disabled}
                divider={s.biometry.capture}
              />
              {s.biometry.capture ? (
                <ToggleRow
                  label="Partager mon cardio au coach"
                  caption="Votre rythme cardiaque visible par votre coach binôme."
                  value={s.biometry.coachShare}
                  onValueChange={(v) => {
                    if (!v) haptic('warn');
                    void r.toggleBiometryCoachShare(v);
                  }}
                  disabled={disabled}
                  divider={false}
                />
              ) : null}
            </>
          ) : null}
        </Group>

        {/* 3 — DONNÉES & SÉCURITÉ */}
        <Group eyebrow="DONNÉES & SÉCURITÉ">
          <ActionRow
            label="Exporter mes données"
            caption="Une copie de vos données, au format ouvert."
            onPress={runExport}
          />
          <ActionRow
            label="Supprimer mon compte"
            caption="Suppression définitive après 30 jours."
            danger
            divider={false}
            onPress={openDelete}
          />
        </Group>

        {/* 4 — SESSION */}
        <Group eyebrow="SESSION">
          <ActionRow label="Déconnexion" divider={false} onPress={() => void r.signOut()} />
        </Group>

        {/*
          5 — DÉVELOPPEMENT. Invisible en production : le groupe entier est
          conditionné à `__DEV__`, et les deux écrans redirigent d'eux-mêmes
          si la condition tombe.

          Il existe parce que les deux bancs n'avaient AUCUNE porte. Le banc de
          capture, porté au lot J5, justifie sa survie en tête de fichier —
          « la seule surface qui capture et exporte des trames UBX réelles » —
          et rien dans l'application n'y menait : la capacité était conservée
          et perdue en même temps. `dev-galerie` était dans le même cas depuis
          plus longtemps.
        */}
        {__DEV__ ? (
          <Group eyebrow="DÉVELOPPEMENT">
            <ActionRow
              label="Banc de capture"
              caption="Boîtier, trames UBX, détection de tours."
              onPress={() => router.push('/(app2)/dev-capture' as never)}
            />
            <ActionRow
              label="Banc visuel"
              caption="Composants et mouvements du kit."
              divider={false}
              onPress={() => router.push('/(app2)/dev-galerie' as never)}
            />
          </Group>
        ) : null}

        <Text style={styles.footer}>
          Une question sur vos données ? Écrivez à contact@oxvehicle.fr.
        </Text>
      </ScrollView>

      {/* Sheet — révocation capture cardio (garde-fou : coupe aussi le partage) */}
      <Sheet visible={bioConfirm} onClose={() => setBioConfirm(false)} snapHeight={300}>
        <Text style={styles.sheetTitle}>Rythme cardiaque</Text>
        <Text style={styles.sheetBody}>
          Vos données cœur cessent d'être collectées. Les données passées restent visibles de vous
          seul.
        </Text>
        <View style={styles.sheetActions}>
          <PressScale
            onPress={() => setBioConfirm(false)}
            accessibilityLabel="Annuler"
            containerStyle={styles.ghostContainer}
            style={styles.ghostBtn}
          >
            <Text style={styles.ghostLabel}>Annuler</Text>
          </PressScale>
          <PressScale
            onPress={confirmRevokeCapture}
            accessibilityLabel="Confirmer l'arrêt de la collecte"
            containerStyle={styles.primaryContainer}
            style={styles.dangerBtn}
          >
            <Text style={styles.dangerLabel}>Arrêter la collecte</Text>
          </PressScale>
        </View>
      </Sheet>

      {/* Sheet — suppression de compte, double confirmation */}
      <Sheet visible={deleteStep !== 0} onClose={closeDelete} snapHeight={340}>
        {deleteStep === 1 ? (
          <>
            <Text style={styles.sheetTitle}>Supprimer mon compte</Text>
            <Text style={styles.sheetBody}>
              Votre compte et vos données seront supprimés après un délai de grâce de 30 jours.
              Avant l'échéance, écrivez à contact@oxvehicle.fr pour annuler. Les données exigées par
              la loi (facturation) sont conservées séparément.
            </Text>
            <View style={styles.sheetActions}>
              <PressScale
                onPress={closeDelete}
                accessibilityLabel="Annuler"
                containerStyle={styles.ghostContainer}
                style={styles.ghostBtn}
              >
                <Text style={styles.ghostLabel}>Annuler</Text>
              </PressScale>
              <PressScale
                onPress={() => setDeleteStep(2)}
                accessibilityLabel="Continuer vers la confirmation"
                containerStyle={styles.primaryContainer}
                style={styles.dangerBtn}
              >
                <Text style={styles.dangerLabel}>Continuer</Text>
              </PressScale>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sheetTitle}>Confirmer la suppression</Text>
            <Text style={styles.sheetBody}>
              Cette demande lance la suppression définitive, effective sous 30 jours. Vous serez
              déconnecté.
            </Text>
            {deleteError ? <Text style={styles.sheetError}>{deleteError}</Text> : null}
            <View style={styles.sheetActions}>
              <PressScale
                onPress={closeDelete}
                accessibilityLabel="Non, revenir"
                containerStyle={styles.ghostContainer}
                style={styles.ghostBtn}
              >
                <Text style={styles.ghostLabel}>Non</Text>
              </PressScale>
              <PressScale
                onPress={confirmDelete}
                disabled={s.deleting}
                accessibilityLabel="Supprimer définitivement mon compte"
                containerStyle={styles.primaryContainer}
                style={[styles.dangerBtn, s.deleting && styles.btnDisabled]}
              >
                <Text style={styles.dangerLabel}>
                  {s.deleting ? 'En cours…' : deleteError ? 'Réessayer' : 'Supprimer'}
                </Text>
              </PressScale>
            </View>
          </>
        )}
      </Sheet>

      {/* Sheet — export en cours (Dial d'état, jamais un % fabriqué) */}
      <Sheet
        visible={exportPhase !== 'idle'}
        onClose={() => {
          if (exportPhase !== 'busy') setExportPhase('idle');
        }}
        snapHeight={360}
      >
        <Text style={styles.sheetTitle}>Export de vos données</Text>
        <View style={styles.exportBody}>
          {exportPhase === 'busy' ? (
            <>
              {/* Dial au repos (« — ») : l'opération est en cours, aucune mesure
                  à afficher — on ne fabrique pas de pourcentage. */}
              <Dial value={null} max={100} size="m" label="Export" />
              <Text style={styles.sheetBody}>Préparation de votre archive…</Text>
              <Shimmer height={12} width="70%" radius={radius.cell} />
            </>
          ) : exportPhase === 'error' ? (
            <>
              <Text style={styles.sheetBody}>{exportError}</Text>
              <View style={styles.sheetActions}>
                <PressScale
                  onPress={() => setExportPhase('idle')}
                  accessibilityLabel="Fermer"
                  containerStyle={styles.ghostContainer}
                  style={styles.ghostBtn}
                >
                  <Text style={styles.ghostLabel}>Fermer</Text>
                </PressScale>
                <PressScale
                  onPress={runExport}
                  accessibilityLabel="Réessayer l'export"
                  containerStyle={styles.primaryContainer}
                  style={styles.primaryBtn}
                >
                  <Text style={styles.primaryLabel}>Réessayer</Text>
                </PressScale>
              </View>
            </>
          ) : (
            <>
              {/* Fin réelle : l'arc se remplit d'un coup — le seul instant mesuré. */}
              <Dial value={100} max={100} size="m" label="Prêt" />
              <Text style={styles.sheetBody}>
                Votre archive est prête. Choisissez où l'enregistrer.
              </Text>
              <PressScale
                onPress={() => setExportPhase('idle')}
                accessibilityLabel="Fermer"
                containerStyle={styles.primaryContainer}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryLabel}>Fermer</Text>
              </PressScale>
            </>
          )}
        </View>
      </Sheet>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  backDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 36 },
  title: {
    fontFamily: typo.display,
    fontSize: 18,
    letterSpacing: 2,
    color: colors.text.hi,
  },

  group: { marginTop: space.xl },
  groupCard: {
    marginTop: space.sm,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 52,
    paddingVertical: space.md,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.hairline,
  },
  actionLabels: { flex: 1 },
  actionLabel: {
    fontFamily: typo.bodyMedium,
    fontSize: 15,
    color: colors.text.hi,
  },
  actionCaption: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.low,
    marginTop: 2,
  },
  dangerText: { color: colors.accent },
  chevron: { fontFamily: typo.body, fontSize: 18, color: colors.text.dim },

  footer: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.low,
    marginTop: space.xl,
    paddingHorizontal: space.sm,
  },

  // Bandeau d'échec d'écriture — neutre (jamais l'accent rouge, réservé au
  // destructif). Même langage sobre que le bandeau offline du kit.
  errorBanner: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.cell,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  errorBannerText: {
    fontFamily: typo.bodyMedium,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.mid,
  },

  // Sheets
  sheetTitle: {
    fontFamily: typo.display,
    fontSize: 18,
    letterSpacing: 0.4,
    color: colors.text.hi,
    marginTop: space.sm,
  },
  sheetBody: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.mid,
    marginTop: space.md,
  },
  // Échec de la demande de suppression : lisible mais neutre (le bouton
  // destructif porte déjà l'unique accent de la zone).
  sheetError: {
    fontFamily: typo.bodyMedium,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.hi,
    marginTop: space.md,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: space.md,
    marginTop: space.xl,
  },
  exportBody: {
    alignItems: 'center',
    gap: space.lg,
    marginTop: space.xl,
  },
  ghostContainer: { flex: 1 },
  ghostBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  ghostLabel: { fontFamily: typo.bodyMedium, fontSize: 14, color: colors.text.mid },
  primaryContainer: { flex: 1 },
  primaryBtn: {
    backgroundColor: colors.bg.card2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  primaryLabel: { fontFamily: typo.bodySemi, fontSize: 14, color: colors.text.hi },
  dangerBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  dangerLabel: { fontFamily: typo.bodySemi, fontSize: 14, color: colors.text.hi },
  btnDisabled: { opacity: 0.6 },
});
