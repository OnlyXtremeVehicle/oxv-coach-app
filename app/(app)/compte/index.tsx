/**
 * Compte — 5e onglet racine (nav maquettes refonte-v2 §6, décision fondateur
 * 2026-07-12 ; remplace l'ancienne icône haut-droite). Reskin fidèle §7.12
 * (12-compte.png) : bloc profil réel (initiales, @handle, séances), carte
 * boîtier OXV (état réel, masquée sans affectation), liste de réglages
 * canonique + héritage retravaillé (Profil, Réglages). Doctrine : sobre,
 * vouvoiement, pas d'emoji, chaque valeur trace vers une table réelle.
 */

import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { FadeInSection, PressableScale, Stagger } from '@/components/motion';
import { supabase } from '@/lib/supabase';
import {
  getDeviceHealthHistory,
  getMyAssignedDevice,
  type MyDevice,
} from '@/services/deviceHealthService';
import { listMyVehicles } from '@/services/garageService';
import { useAuthStore } from '@/store/useAuthStore';
import { useTelemetryStore } from '@/store/useTelemetryStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { StatusPill } from '@/ui/StatusPill';

const { palette, fonts, fontSize, spacing, radius } = theme;

/* ------------------------------------------------------------------ */
/* États du boîtier — vocabulaire factuel, borné aux enums réels de la */
/* table `devices` (migration 0016). Inconnu = « — », jamais inventé.  */
/* ------------------------------------------------------------------ */

const BATTERY_LABEL: Record<string, string> = { ok: 'ok', low: 'faible', critical: 'critique' };
const HEALTH_LABEL: Record<string, string> = {
  ok: 'ok',
  maintenance: 'entretien',
  defect: 'défaut',
};

function formatRssi(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  // Signe moins typographique (U+2212) — convention chiffres de l'app.
  return `${v < 0 ? '−' : ''}${Math.abs(v)} dBm`;
}

/* ------------------------------------------------------------------ */
/* Icônes fines (décoratives) — 20/22 px, trait 1.6-1.7, style v2.     */
/* ------------------------------------------------------------------ */

const ROW_ICON = 20;
const stroke = palette.creamMute;

/** Boîtier OXV — petit appareil vert (état matériel, canon vert = connecté/validé). */
function IconDevice() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Rect
        x={5.5}
        y={4}
        width={13}
        height={16}
        rx={3}
        stroke={palette.green}
        strokeWidth={1.7}
        fill="none"
      />
      <Circle cx={12} cy={9} r={1.6} fill={palette.green} />
      <Line
        x1={9.2}
        y1={15.5}
        x2={14.8}
        y2={15.5}
        stroke={palette.green}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Garage — silhouette d'auto. */
function IconCar() {
  return (
    <Svg width={ROW_ICON} height={ROW_ICON} viewBox="0 0 24 24">
      <Path
        d="M5.2 16.5 H4 V13 l1.6-4.2 A2 2 0 0 1 7.5 7.5 h9 a2 2 0 0 1 1.9 1.3 L20 13 v3.5 h-1.2 M4 13 h16"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={8.2} cy={16.8} r={1.6} stroke={stroke} strokeWidth={1.6} fill="none" />
      <Circle cx={15.8} cy={16.8} r={1.6} stroke={stroke} strokeWidth={1.6} fill="none" />
    </Svg>
  );
}

/** Données & sécurité — bouclier. */
function IconShield() {
  return (
    <Svg width={ROW_ICON} height={ROW_ICON} viewBox="0 0 24 24">
      <Path
        d="M12 3.5 L18.5 6 v5 c0 4.2 -2.8 7.3 -6.5 9 C8.3 18.3 5.5 15.2 5.5 11 V6 Z"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Notifications — cloche. */
function IconBell() {
  return (
    <Svg width={ROW_ICON} height={ROW_ICON} viewBox="0 0 24 24">
      <Path
        d="M12 4 a5 5 0 0 1 5 5 v3.2 l1.5 2.6 H5.5 L7 12.2 V9 a5 5 0 0 1 5-5 Z"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M10.3 17.8 a1.8 1.8 0 0 0 3.4 0" stroke={stroke} strokeWidth={1.6} fill="none" />
    </Svg>
  );
}

/** Support — point d'interrogation cerclé. */
function IconHelp() {
  return (
    <Svg width={ROW_ICON} height={ROW_ICON} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={8.5} stroke={stroke} strokeWidth={1.6} fill="none" />
      <Path
        d="M9.9 9.8 a2.2 2.2 0 1 1 3.2 2 c-.7 .4 -1.1 .8 -1.1 1.7"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={12} cy={16.4} r={1} fill={stroke} />
    </Svg>
  );
}

/** Profil — buste. */
function IconPerson() {
  return (
    <Svg width={ROW_ICON} height={ROW_ICON} viewBox="0 0 24 24">
      <Circle cx={12} cy={8.6} r={3.1} stroke={stroke} strokeWidth={1.6} fill="none" />
      <Path
        d="M5.5 19 c.9-3 3.4-4.6 6.5-4.6 s5.6 1.6 6.5 4.6"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** Réglages — curseurs. */
function IconSliders() {
  return (
    <Svg width={ROW_ICON} height={ROW_ICON} viewBox="0 0 24 24">
      <Line
        x1={4.5}
        y1={9}
        x2={19.5}
        y2={9}
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Circle cx={9.5} cy={9} r={2} fill={palette.card} stroke={stroke} strokeWidth={1.6} />
      <Line
        x1={4.5}
        y1={15}
        x2={19.5}
        y2={15}
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Circle cx={14.5} cy={15} r={2} fill={palette.card} stroke={stroke} strokeWidth={1.6} />
    </Svg>
  );
}

/** Chevron de ligne (maquette : `#4A4A50` → token le plus proche, palette.faint). */
function Chevron() {
  return <View style={s.chev} accessibilityElementsHidden importantForAccessibility="no" />;
}

/* ------------------------------------------------------------------ */
/* Lignes de réglages — icône + label + valeur factuelle + chevron.    */
/* SANS hint verbeux (maquette §7.12).                                 */
/* ------------------------------------------------------------------ */

function SettingsRow({
  label,
  value,
  Icon,
  onPress,
  last,
}: {
  label: string;
  value?: string | null;
  Icon: () => React.JSX.Element;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}. ${value}.` : label}
      style={[s.row, !last && s.rowSep]}
    >
      <Icon />
      <Text style={s.rowLabel}>{label}</Text>
      <View style={{ flex: 1 }} />
      {value ? <Text style={s.rowValue}>{value}</Text> : null}
      <Chevron />
    </PressableScale>
  );
}

/** Tuile d'état du boîtier — valeur mesurée + libellé, « — » si absente. */
function StateTile({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.stateTile} accessibilityRole="text" accessibilityLabel={`${label} : ${value}`}>
      <Text style={s.stateValue}>{value}</Text>
      <Text style={s.stateLabel}>{label}</Text>
    </View>
  );
}

export default function CompteHubScreen() {
  const profile = useAuthStore((state) => state.profile);
  const bleStatus = useTelemetryStore((state) => state.bleStatus);

  const [handle, setHandle] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [device, setDevice] = useState<MyDevice | null>(null);
  const [rssi, setRssi] = useState<number | null>(null);
  const [vehicleCount, setVehicleCount] = useState<number | null>(null);

  const userId = profile?.id;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      if (userId) {
        // @handle réel (users.public_handle, RLS self-read) — masqué si absent.
        (async () => {
          const { data } = await supabase
            .from('users')
            .select('public_handle')
            .eq('id', userId)
            .maybeSingle();
          if (!cancelled) {
            setHandle((data as { public_handle?: string | null } | null)?.public_handle ?? null);
          }
        })().catch(() => undefined);

        // Séances réelles : count des telemetry_sessions complétées.
        (async () => {
          const { count } = await supabase
            .from('telemetry_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'completed');
          if (!cancelled && typeof count === 'number') setSessionCount(count);
        })().catch(() => undefined);
      }

      // Boîtier affecté (RLS : le pilote ne voit que le sien) + dernier signal relevé.
      (async () => {
        const dev = await getMyAssignedDevice();
        if (cancelled) return;
        setDevice(dev);
        if (dev) {
          const hist = await getDeviceHealthHistory(dev.deviceId, 1);
          if (!cancelled) setRssi(hist[0]?.rssi ?? null);
        }
      })().catch(() => undefined);

      // Garage : count réel des véhicules (table vehicles, own-row).
      listMyVehicles()
        .then((v) => {
          if (!cancelled) setVehicleCount(v.length);
        })
        .catch(() => undefined);

      return () => {
        cancelled = true;
      };
    }, [userId])
  );

  const firstName = profile?.first_name?.trim() ?? '';
  const lastName = profile?.last_name?.trim() ?? '';
  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() ||
    (profile?.email?.charAt(0).toUpperCase() ?? '—');
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || (profile?.email ?? '—');

  const subParts: string[] = [];
  if (handle) subParts.push(`@${handle}`);
  if (sessionCount != null) {
    subParts.push(`${sessionCount} séance${sessionCount > 1 ? 's' : ''}`);
  }
  const profileSub = subParts.join(' · ');

  const connected = bleStatus === 'connected';
  const deviceSub = device
    ? [device.alias ?? device.label, device.serial ? `#${device.serial}` : null]
        .filter(Boolean)
        .join(' · ')
    : '';

  const rows: {
    key: string;
    label: string;
    value?: string | null;
    href: string;
    Icon: () => React.JSX.Element;
  }[] = [
    {
      key: 'garage',
      label: 'Garage',
      value: vehicleCount != null ? `${vehicleCount} auto${vehicleCount > 1 ? 's' : ''}` : null,
      href: '/(app)/garage',
      Icon: IconCar,
    },
    // Le centre réel des données/RGPD (consentements, export, suppression).
    { key: 'donnees', label: 'Données & sécurité', href: '/(app)/consentements', Icon: IconShield },
    { key: 'notifications', label: 'Notifications', href: '/(app)/notifications', Icon: IconBell },
    { key: 'support', label: 'Support', href: '/(app)/support', Icon: IconHelp },
    // Héritage retravaillé au même style (lignes fines, sans hint).
    { key: 'profil', label: 'Profil', href: '/(app)/profil', Icon: IconPerson },
    { key: 'reglages', label: 'Réglages', href: '/(app)/settings', Icon: IconSliders },
  ];

  return (
    <Screen>
      <AppBar title="Compte" />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* Bloc profil — identité réelle (users), séances réelles. */}
        <FadeInSection>
          <View style={s.profileRow}>
            <View style={s.avatar} accessibilityElementsHidden importantForAccessibility="no">
              <Text style={s.avatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name} accessibilityRole="header">
                {fullName}
              </Text>
              {profileSub ? <Text style={s.profileSub}>{profileSub}</Text> : null}
            </View>
          </View>
        </FadeInSection>

        {/* Carte boîtier OXV — masquée tant qu'aucun boîtier n'est affecté.
            Badge selon l'état BLE réel ; tuiles bornées aux mesures réelles. */}
        {device ? (
          <FadeInSection delay={80}>
            <Card
              style={s.deviceCard}
              onPress={() => router.push('/(app)/mon-equipement' as never)}
              accessibilityLabel={`Boîtier OXV. ${deviceSub}. ${connected ? 'Connecté' : 'Non connecté'}.`}
            >
              <View style={s.deviceHeader}>
                <IconDevice />
                <View style={{ flex: 1 }}>
                  <Text style={s.deviceTitle}>Boîtier OXV</Text>
                  {deviceSub ? <Text style={s.deviceSub}>{deviceSub}</Text> : null}
                </View>
                <StatusPill
                  label={connected ? 'CONNECTÉ' : 'NON CONNECTÉ'}
                  tone={connected ? 'connected' : 'neutral'}
                  live={connected}
                />
              </View>
              <View style={s.stateRow}>
                <StateTile
                  value={(device.batteryStatus && BATTERY_LABEL[device.batteryStatus]) ?? '—'}
                  label="batterie"
                />
                <StateTile
                  value={(device.healthStatus && HEALTH_LABEL[device.healthStatus]) ?? '—'}
                  label="santé"
                />
                <StateTile value={formatRssi(rssi)} label="signal" />
              </View>
            </Card>
          </FadeInSection>
        ) : null}

        {/* Liste de réglages — lignes canoniques + héritage, même style.
            Cascade discrète : la carte se pose, puis ses lignes suivent. */}
        <FadeInSection delay={160}>
          <Card style={s.listCard}>
            <Stagger initialDelay={200} interval={60}>
              {rows.map((row, i) => (
                <SettingsRow
                  key={row.key}
                  label={row.label}
                  value={row.value}
                  Icon={row.Icon}
                  last={i === rows.length - 1}
                  onPress={() => router.push(row.href as never)}
                />
              ))}
            </Stagger>
          </Card>
        </FadeInSection>
      </View>
    </Screen>
  );
}

const s = {
  profileRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  avatarText: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.bodyLg,
    letterSpacing: 0.5,
    color: palette.creamSoft,
  },
  name: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    color: palette.cream,
  },
  profileSub: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: 3,
  },
  deviceCard: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  deviceHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  deviceTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.body,
    color: palette.cream,
  },
  deviceSub: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: 2,
  },
  stateRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  stateTile: {
    flex: 1,
    alignItems: 'center' as const,
    gap: 3,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: palette.surface3,
  },
  stateValue: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.small + 1,
    letterSpacing: 0.3,
    color: palette.cream,
  },
  stateLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    color: palette.eyebrow,
  },
  listCard: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: 0,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    minHeight: 52,
    paddingVertical: spacing.sm,
  },
  rowSep: {
    borderBottomWidth: 1,
    borderBottomColor: palette.separator,
  },
  rowLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.cream,
  },
  rowValue: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 0.4,
    color: palette.creamMute,
  },
  chev: {
    width: 8,
    height: 8,
    borderTopWidth: 1.6,
    borderRightWidth: 1.6,
    borderColor: palette.faint,
    transform: [{ rotate: '45deg' as const }],
  },
};
