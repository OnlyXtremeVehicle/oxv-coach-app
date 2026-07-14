/**
 * Carte licence OXV — licence numérique du pilote (§7bis, screens/33-carte-licence.png).
 *
 * Reskin fidèle au langage refonte-v2. Deux strates :
 *   1. La CARTE D'IDENTITÉ licence (surface sombre, liseré crème) : nom réel,
 *      n° FFSA réel (`users.ffsa_license`), statut de validité RÉEL. Le badge
 *      vert « VALIDÉ » n'apparaît QUE si `users.kyc_status = 'validated'`
 *      (seul signal de validité vérifiable en base) ; sinon aucun badge.
 *   2. L'INSIGNE PARTAGEABLE (LicenseCard) capturé en image (react-native-view-shot)
 *      → feuille de partage OS. Faits cumulés neutres, jamais un rang.
 *
 * ÉCARTS À LA MAQUETTE (assumés, cf. sharedChangesNeeded) :
 *  - « Valide 31.12.2026 » : AUCUNE colonne de fin de validité de licence
 *    n'existe (`ffsa_license_valid_until` absent). On rend `kyc_validated_at`
 *    (« validé le »), pas une date d'expiration inventée.
 *  - « Groupe sanguin O+ » : donnée MÉDICALE. Non rendue (doctrine + intention
 *    de retrait des données médicales). Jamais affichée sur une carte partageable.
 *  - QR : il n'existe aucun QR de LICENCE en base. Le seul QR réel est le code de
 *    présence événement (Pass OXV). On NE fabrique pas de QR de licence : un renvoi
 *    honnête vers le Pass OXV est proposé à la place.
 *
 * Doctrine : sobre, vouvoiement, pas d'emoji, descriptif. or = chrono/record
 * UNIQUEMENT — une licence est une identité, donc crème. Le vert n'est employé
 * que pour l'ÉTAT « validé » (state, pas une donnée QDI). Zéro nouvelle table.
 */

import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import { LicenseCard } from '@/components/LicenseCard';
import { FadeInSection } from '@/components/motion';
import { supabase } from '@/lib/supabase';
import { type Passport, loadPassport } from '@/services/passportService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

const { palette, fonts, fontSize, spacing, radius } = theme;

/** Champs licence lus directement sur `users` (colonnes existantes, zéro schéma). */
type LicenceIdentity = {
  ffsaLicense: string | null;
  kycStatus: string | null;
  kycValidatedAt: string | null;
};

function prettyLevel(level: string | null | undefined): string {
  switch (level) {
    case 'debutant':
      return 'Débutant';
    case 'intermediaire':
      return 'Apprivoisé';
    case 'confirme':
      return 'Confirmé';
    case 'expert':
      return 'Expert';
    default:
      return 'Pilote OXV';
  }
}

function sinceLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function validatedOnLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fullName(first: string | null | undefined, last: string | null | undefined): string {
  const parts = [first?.trim(), last?.trim()].filter((p): p is string => !!p);
  return parts.length > 0 ? parts.join(' ') : 'Pilote';
}

export default function CarteLicenceScreen() {
  const profile = useAuthStore((s) => s.profile);
  const cardRef = useRef<View>(null);
  const [passport, setPassport] = useState<Passport | null>(null);
  const [identity, setIdentity] = useState<LicenceIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  const reload = useCallback(() => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      loadPassport(profile.id),
      supabase
        .from('users')
        .select('ffsa_license, kyc_status, kyc_validated_at')
        .eq('id', profile.id)
        .maybeSingle(),
    ]).then(([p, idRes]) => {
      if (cancelled) return;
      setPassport(p);
      const row = (idRes.data ?? null) as Record<string, unknown> | null;
      setIdentity(
        row
          ? {
              ffsaLicense: (row.ffsa_license as string | null) ?? null,
              kycStatus: (row.kyc_status as string | null) ?? null,
              kycValidatedAt: (row.kyc_validated_at as string | null) ?? null,
            }
          : null
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  useFocusEffect(reload);

  async function onShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Partager ma licence OXV',
          UTI: 'public.png',
        });
      }
    } catch {
      // Feuille fermée ou capture impossible : rien à remonter.
    } finally {
      setSharing(false);
    }
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="Ma licence" onBack={() => router.back()} />
        <View style={s.center}>
          <ActivityIndicator
            color={palette.creamMute}
            accessibilityLabel="Chargement de votre licence"
          />
        </View>
      </Screen>
    );
  }

  const hasData = (passport?.stats.totalSessions ?? 0) > 0;
  if (!passport || !hasData) {
    return (
      <Screen scroll={false}>
        <AppBar title="Ma licence" onBack={() => router.back()} />
        <View style={s.center}>
          <Text style={s.emptyTitle} accessibilityRole="header">
            Licence à composer.
          </Text>
          <Text style={s.emptyBody}>Votre carte se compose au fil de vos séances analysées.</Text>
        </View>
      </Screen>
    );
  }

  const name = fullName(profile?.first_name, profile?.last_name);
  const ffsa = identity?.ffsaLicense?.trim() || null;
  const validated = identity?.kycStatus === 'validated';
  const validatedOn = validated ? validatedOnLabel(identity?.kycValidatedAt ?? null) : null;

  return (
    <Screen>
      <AppBar title="Ma licence" subtitle="Licence circuit" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* — Strate 1 : la carte d'identité licence (données réelles `users`) — */}
        <FadeInSection>
          <View style={s.licence}>
            <View style={s.licenceTop}>
              <Text style={s.licenceBrand}>OXV</Text>
              {validated ? (
                <View style={s.badge} accessibilityRole="text" accessibilityLabel="Licence validée">
                  <View
                    style={s.badgeDot}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                  <Text style={s.badgeT}>Validé</Text>
                </View>
              ) : null}
            </View>

            <Text style={s.licenceEyebrow}>Licence circuit</Text>
            <Text style={s.licenceName} numberOfLines={1}>
              {name}
            </Text>

            <View style={s.licenceMetas}>
              <IdRow label="N° FFSA" value={ffsa ?? '—'} />
              <IdRow
                label="Validité"
                value={validated ? (validatedOn ? `Validée le ${validatedOn}` : 'Validée') : '—'}
              />
            </View>

            <Text style={s.licenceFoot}>oxvehicle.fr</Text>
          </View>
        </FadeInSection>

        {/* Présentation au contrôle : renvoi HONNÊTE vers le seul QR réel (Pass OXV),
            à la place d'un QR de licence inexistant en base. */}
        <FadeInSection delay={60}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ouvrir votre Pass OXV et son code de présence"
            hitSlop={theme.hitSlop}
            onPress={() => router.push('/(app)/pass-oxv' as never)}
            style={({ pressed }) => [s.passRow, pressed && { opacity: 0.85 }]}
          >
            <View style={s.passDot} accessibilityElementsHidden importantForAccessibility="no" />
            <Text style={s.passT}>
              Votre code de présence se trouve sur le Pass OXV, à présenter à l&apos;accueil.
            </Text>
            <View
              style={s.passChevron}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          </Pressable>
        </FadeInSection>

        {!validated ? (
          <FadeInSection delay={100}>
            <Text style={s.note}>
              La mention « Validé » apparaît une fois votre dossier vérifié par OXV.
            </Text>
          </FadeInSection>
        ) : null}

        {/* — Strate 2 : l'insigne partageable (faits cumulés neutres) — */}
        <FadeInSection delay={140}>
          <View style={s.headRow}>
            <Text style={s.sectionEyebrow}>À partager</Text>
            <View style={s.headLine} accessibilityElementsHidden importantForAccessibility="no" />
          </View>
        </FadeInSection>

        <View style={{ marginTop: spacing.lg, marginBottom: spacing.xl }}>
          <LicenseCard
            ref={cardRef}
            name={name}
            level={prettyLevel(profile?.pilot_level)}
            since={sinceLabel(passport.memberSince)}
            axes={passport.signature.axes}
            sessions={passport.stats.totalSessions}
            circuits={passport.circuitCount}
            laps={passport.stats.totalLaps}
          />
        </View>

        <FadeInSection delay={200}>
          <Button label="Partager" onPress={onShare} loading={sharing} />
        </FadeInSection>

        <FadeInSection delay={260}>
          <Text style={s.note}>
            {Platform.OS === 'ios'
              ? 'La feuille de partage couvre Story et Enregistrer.'
              : 'Partagez l’image ou enregistrez-la depuis la feuille système.'}
          </Text>
        </FadeInSection>
      </View>
    </Screen>
  );
}

/** Rangée factuelle « micro-label mono · valeur » (langage v2). */
function IdRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.idRow}>
      <Text style={s.idLabel}>{label}</Text>
      <Text style={s.idValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    color: palette.cream,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptyBody: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamMute,
    textAlign: 'center',
    lineHeight: fontSize.body * 1.5,
  },

  // — Carte d'identité licence (surface alt v2, liseré gauche crème = identité) —
  licence: {
    backgroundColor: palette.card2,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.line,
    borderLeftWidth: 2,
    borderLeftColor: palette.edge,
    padding: spacing.xl,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  licenceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  licenceBrand: {
    fontFamily: fonts.heavy,
    fontSize: fontSize.h3,
    letterSpacing: 2,
    color: palette.cream,
  },
  licenceEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  licenceName: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.3,
    color: palette.cream,
    marginTop: -spacing.xs,
  },
  licenceMetas: { marginTop: spacing.sm, gap: spacing.sm },
  licenceFoot: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: palette.faint,
    marginTop: spacing.sm,
  },

  // — Badge « Validé » (état vérifié en base : kyc_status = validated) —
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(79,201,138,0.35)',
    backgroundColor: 'rgba(79,201,138,0.10)',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.green,
  },
  badgeT: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.green,
  },

  // — Rangée « label mono · valeur » —
  idRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  idLabel: {
    width: 76,
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.faint,
    paddingTop: 2,
  },
  idValue: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.3,
    color: palette.creamSoft,
  },

  // — Renvoi Pass OXV (là où vit le vrai QR de présence) —
  passRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
  },
  passDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.creamMute,
  },
  passT: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.45,
    color: palette.creamMute,
  },
  passChevron: {
    width: 8,
    height: 8,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: palette.creamMute,
    transform: [{ rotate: '45deg' }],
  },

  // — Séparateur de section « À partager » —
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
  sectionEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  headLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.separator,
  },

  note: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
    color: palette.creamMute,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
