/**
 * Écran "Mon coach" — gestion du consentement RGPD au coaching.
 * Reskin fidèle à la maquette refonte-v2 §7.11 (screens/11-mon-coach.png).
 *
 * Le pilote voit ici les coachs qu'OXV lui a assignés. Pour chacun, il
 * peut consentir (autoriser le coach à voir ses sessions) ou retirer son
 * consentement (le coach cesse immédiatement de voir).
 *
 * Doctrine :
 *   - Le consentement est libre. L'app n'insiste pas, ne moralise pas.
 *   - Pas d'instruction à donner son accord — c'est strictement neutre.
 *   - Le pilote peut révoquer à tout moment, sans justification.
 *
 * Maquette : carte coach à liseré gauche rouge coach (avatar initiales,
 * « Votre coach depuis {mois} », pill verte ACTIF) · eyebrow « Ce qu'il peut
 * voir » · liste de toggles verts · encart vert « Il ne verra jamais » ·
 * lien doux « Retirer l'accès à {prénom} ».
 *
 * Les toggles sont branchés sur le MODÈLE RÉEL (pilotConsentService) :
 *   - « Vos sessions & bilans » = consentement maître (pilot_consent_at) ;
 *     l'éteindre = retirer l'accès (avec confirmation, README §242).
 *   - « Vos analyses détaillées » / « Programme » = niveau d'accès gradué
 *     (level : lecture_simple ⊂ lecture_detaillee ⊂ programme), rendu en
 *     toggles cumulatifs cohérents avec cette hiérarchie réelle.
 *   - « Partage en direct » = live_sharing_at (consentement distinct).
 * Le toggle « notes présentielles » de la maquette n'a PAS de persistance
 * côté pilote : non rendu (aucun contrôle qui ne fait rien).
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Switch, Text, View } from 'react-native';
import { Link, router } from 'expo-router';

import * as haptics from '@/lib/haptics';
import {
  type CoachAccessLevel,
  type MyCoachAssignment,
  giveConsent,
  listMyCoaches,
  revokeConsent,
  setConsentLevel,
  setLiveSharing,
} from '@/services/pilotConsentService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateShort } from '@/utils/format';

const { palette, fonts, fontSize, spacing, radius } = theme;

// Tints dérivés de palette.green (#4FC98A) — pill ACTIF (.12) et encart
// « Il ne verra jamais » (.06 / .20) de la maquette §7.11. Aucune autre
// couleur hors thème.
const GREEN_TINT_PILL = 'rgba(79,201,138,0.12)';
const GREEN_TINT_BG = 'rgba(79,201,138,0.06)';
const GREEN_TINT_BORDER = 'rgba(79,201,138,0.20)';

/** Nom affichable du coach (donnée réelle, fallback email). */
function coachFullName(a: MyCoachAssignment): string {
  return [a.coachFirstName, a.coachLastName].filter(Boolean).join(' ') || a.coachEmail;
}

/** Prénom pour le lien de retrait — fallback nom complet/email. */
function coachFirstName(a: MyCoachAssignment): string {
  return a.coachFirstName || coachFullName(a);
}

/** Initiales pour l'avatar (prénom + nom, fallback email). */
function coachInitials(a: MyCoachAssignment): string {
  const letters = [a.coachFirstName, a.coachLastName]
    .map((part) => (part ?? '').trim().charAt(0))
    .join('');
  const fromEmail = a.coachEmail.trim().charAt(0);
  return (letters || fromEmail || '—').toUpperCase();
}

/**
 * « Votre coach depuis {mois} » — mois RÉEL de l'assignation (created_at).
 * L'année n'apparaît que si elle diffère de l'année courante.
 */
function sinceLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Votre coach';
  const month = d.toLocaleDateString('fr-FR', { month: 'long' });
  const year = d.getFullYear();
  return year === new Date().getFullYear()
    ? `Votre coach depuis ${month}`
    : `Votre coach depuis ${month} ${year}`;
}

export default function MonCoachScreen() {
  const [coaches, setCoaches] = useState<MyCoachAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    try {
      const rows = await listMyCoaches();
      setCoaches(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    listMyCoaches()
      .then((rows) => {
        if (!cancelled) {
          setCoaches(rows);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onGiveConsent(assignment: MyCoachAssignment) {
    // À l'acceptation : on consent au niveau le plus restreint (sessions seules) ;
    // le pilote ouvre davantage via les toggles ci-dessous (§6/§23, privacy-first).
    const result = await giveConsent(assignment.id, 'lecture_simple');
    if (result.ok) {
      // Confirmation tactile : un consentement RGPD mérite un retour clair
      haptics.success();
      await reload();
    }
  }

  async function doRevoke(assignment: MyCoachAssignment) {
    const result = await revokeConsent(assignment.id);
    if (result.ok) {
      haptics.tap();
      await reload();
    }
  }

  /** Retrait d'accès = confirmation (README refonte-v2, comportements attendus). */
  function onConfirmRevoke(assignment: MyCoachAssignment) {
    Alert.alert(
      `Retirer l'accès à ${coachFirstName(assignment)}`,
      'Ce coach cessera immédiatement de voir vos sessions et vos données. Vous pourrez consentir de nouveau plus tard.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: () => {
            void doRevoke(assignment);
          },
        },
      ]
    );
  }

  async function onSetLevel(assignment: MyCoachAssignment, level: CoachAccessLevel) {
    if (level === assignment.level) return;
    const result = await setConsentLevel(assignment.id, level);
    if (result.ok) {
      haptics.tap();
      await reload();
    }
  }

  async function onToggleLive(assignment: MyCoachAssignment, next: boolean) {
    const result = await setLiveSharing(assignment.id, next);
    if (result.ok) {
      if (next) haptics.success();
      else haptics.tap();
      await reload();
    }
  }

  const activeAssignments = coaches.filter((c) => c.active);

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="Mon coach" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.creamMute} accessibilityLabel="Chargement" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="Mon coach" onBack={() => router.back()} />
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xxl,
        }}
      >
        {activeAssignments.length === 0 ? (
          <EmptyState />
        ) : (
          <View style={{ gap: spacing.xxl }}>
            {activeAssignments.map((assignment) => (
              <CoachSection
                key={assignment.id}
                assignment={assignment}
                onGiveConsent={() => onGiveConsent(assignment)}
                onConfirmRevoke={() => onConfirmRevoke(assignment)}
                onSetLevel={(level) => onSetLevel(assignment, level)}
                onToggleLive={(next) => onToggleLive(assignment, next)}
              />
            ))}
          </View>
        )}

        {/* Accès aux invitations de roulages (§8). Le pilote convié par un
            coach gère ici sa présence. */}
        <View style={{ marginTop: spacing.xxl }}>
          <Link href={'/(app)/roulages' as never} asChild>
            <Button label="Mes invitations aux roulages" variant="ghost" />
          </Link>
        </View>
      </View>
    </Screen>
  );
}

/**
 * Section d'une assignation : carte coach (liseré rouge coach), puis — si
 * consenti — les toggles de partage, l'encart « Il ne verra jamais » et le
 * lien de retrait. Sinon, l'ouverture d'accès (consentement maître).
 */
function CoachSection({
  assignment,
  onGiveConsent,
  onConfirmRevoke,
  onSetLevel,
  onToggleLive,
}: {
  assignment: MyCoachAssignment;
  onGiveConsent: () => void;
  onConfirmRevoke: () => void;
  onSetLevel: (level: CoachAccessLevel) => void;
  onToggleLive: (next: boolean) => void;
}) {
  const fullName = coachFullName(assignment);
  const firstName = coachFirstName(assignment);
  const consented = assignment.pilotConsentAt !== null;
  const detailed = assignment.level !== 'lecture_simple';
  const programme = assignment.level === 'programme';

  return (
    <View>
      {/* Carte coach — liseré gauche rouge coach (maquette §7.11). */}
      <Card style={s.coachCard}>
        <View style={s.coachRow}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{coachInitials(assignment)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.coachName} accessibilityRole="header">
              {fullName}
            </Text>
            <Text style={s.coachSince}>{sinceLabel(assignment.createdAt)}</Text>
          </View>
          <ConsentPill active={consented} />
        </View>
        {assignment.notes ? <Text style={s.coachNotes}>{assignment.notes}</Text> : null}
      </Card>

      {consented ? (
        <>
          <View style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
            <SectionLabel>{'Ce qu’il peut voir'}</SectionLabel>
          </View>

          <View style={s.toggleList}>
            {/* Consentement maître : l'éteindre retire tout l'accès (confirmation). */}
            <ToggleRow
              label="Vos sessions & bilans"
              hint={`Sessions, tours et bilans. Autorisé le ${formatDateShort(assignment.pilotConsentAt!)}.`}
              value
              onChange={(next) => {
                if (!next) onConfirmRevoke();
              }}
              a11yLabel={`Sessions et bilans partagés avec ${fullName}`}
              a11yHint="Désactiver retire tout l'accès de ce coach. Une confirmation vous sera demandée."
            />
            <Hairline />
            {/* Niveau gradué : lecture_detaillee (⊃ lecture_simple). */}
            <ToggleRow
              label="Vos analyses détaillées"
              hint="Donnée brute et analyse virage par virage (Data Lab)."
              value={detailed}
              onChange={(next) => onSetLevel(next ? 'lecture_detaillee' : 'lecture_simple')}
              a11yLabel={`Analyses détaillées partagées avec ${fullName}`}
              a11yHint="Désactiver repasse aux sessions et bilans seuls, programme compris."
            />
            <Hairline />
            {/* Niveau gradué : programme (⊃ lecture_detaillee). */}
            <ToggleRow
              label="Programme d'accompagnement"
              hint="Un accompagnement suivi dans la durée."
              value={programme}
              onChange={(next) => onSetLevel(next ? 'programme' : 'lecture_detaillee')}
              a11yLabel={`Programme d'accompagnement avec ${fullName}`}
              a11yHint="Désactiver conserve l'analyse détaillée."
            />
            <Hairline />
            {/* Consentement LIVE distinct — OFF par défaut, coupé immédiatement. */}
            <ToggleRow
              label="Partage en direct"
              hint="Position et télémétrie en temps réel, pendant vos roulages uniquement."
              value={assignment.liveSharingAt !== null}
              onChange={onToggleLive}
              a11yLabel={`Partage en direct avec ${fullName}`}
              a11yHint="Diffuse votre télémétrie temps réel à ce coach pendant vos roulages. Se coupe immédiatement à la désactivation."
            />
          </View>

          <NeverSeenCard />

          <Pressable
            onPress={onConfirmRevoke}
            accessibilityRole="button"
            accessibilityLabel={`Retirer l'accès à ${firstName}`}
            accessibilityHint="Ce coach cessera immédiatement de voir vos données."
            hitSlop={theme.hitSlop}
            style={({ pressed }) => [s.revokeLink, pressed ? { opacity: 0.7 } : null]}
          >
            <Text style={s.revokeText}>{`Retirer l’accès à ${firstName}`}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={s.pendingBody}>
            {
              'Ce coach ne voit rien de vous pour l’instant. Si vous ouvrez l’accès, il verra vos sessions, vos tours et vos bilans — révocable à tout moment, sans justification.'
            }
          </Text>
          <NeverSeenCard />
          <Button label={`Autoriser l'accès à ${firstName}`} onPress={onGiveConsent} />
        </>
      )}
    </View>
  );
}

/** Pastille d'état du consentement — verte ACTIF (maquette) / neutre en attente. */
function ConsentPill({ active }: { active: boolean }) {
  return (
    <View
      style={[s.pill, active ? s.pillActive : s.pillIdle]}
      accessibilityRole="text"
      accessibilityLabel={active ? 'Consentement actif' : 'Consentement en attente'}
    >
      <View style={[s.pillDot, { backgroundColor: active ? palette.green : palette.creamMute }]} />
      <Text style={[s.pillText, { color: active ? palette.green : palette.creamMute }]}>
        {active ? 'ACTIF' : 'EN ATTENTE'}
      </Text>
    </View>
  );
}

/** Ligne « nom + Switch vert » de la liste de partage (maquette §7.11). */
function ToggleRow({
  label,
  hint,
  value,
  onChange,
  a11yLabel,
  a11yHint,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  a11yLabel: string;
  a11yHint: string;
}) {
  return (
    <View style={s.row}>
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <Text style={[s.rowLabel, { color: value ? palette.creamSoft : palette.creamMute }]}>
          {label}
        </Text>
        {hint ? <Text style={s.rowHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityRole="switch"
        accessibilityLabel={a11yLabel}
        accessibilityHint={a11yHint}
        accessibilityState={{ checked: value }}
        trackColor={{ false: palette.cardBorderProminent, true: palette.green }}
        thumbColor={palette.cream}
        ios_backgroundColor={palette.cardBorderProminent}
      />
    </View>
  );
}

/** Séparateur fin entre lignes de la liste (hairline maquette). */
function Hairline() {
  return <View style={s.hair} />;
}

/**
 * Encart vert « Il ne verra jamais » — la liste reprend le périmètre RÉEL
 * de l'accès coach (RLS) : jamais l'email, le téléphone ni les documents.
 */
function NeverSeenCard() {
  return (
    <View style={s.neverCard}>
      <View style={s.neverHead}>
        <View style={s.neverDot} />
        <Text style={s.neverTitle}>Il ne verra jamais</Text>
      </View>
      <Text style={s.neverBody}>
        Votre email, votre téléphone, vos documents. Rien de personnel.
      </Text>
    </View>
  );
}

/** État sans coach — honnête, avec l'accès à la place de marché existante. */
function EmptyState() {
  return (
    <Card style={s.emptyCard}>
      <Text style={s.emptyTitle} accessibilityRole="header">
        Aucun coach pour le moment.
      </Text>
      <Text style={s.emptyHint}>
        {
          'Quand un coach vous accompagnera, vous déciderez ici de ce qu’il voit. Rien ne se partage sans votre accord.'
        }
      </Text>
      <View style={{ alignSelf: 'stretch', marginTop: spacing.xl }}>
        <Button
          label="Découvrir les coachs"
          variant="ghost"
          onPress={() => router.push('/(app)/coachs' as never)}
        />
      </View>
    </Card>
  );
}

const s = {
  // Carte coach : surface card, bordure line, liseré gauche 2 px rouge coach.
  coachCard: {
    padding: spacing.lg,
    borderLeftWidth: 2,
    borderLeftColor: palette.coachAccent,
  },
  coachRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md + 1,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  avatarText: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.bodyLg,
    color: palette.secondary,
  },
  coachName: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  coachSince: {
    fontFamily: fonts.body,
    fontSize: fontSize.micro,
    color: palette.legend,
    marginTop: 2,
  },
  coachNotes: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    fontStyle: 'italic' as const,
    color: palette.creamSoft,
    lineHeight: fontSize.small * 1.5,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.separator,
  },
  // Pastille d'état (maquette : fond vert .12, point + mono vert).
  pill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  pillActive: { backgroundColor: GREEN_TINT_PILL },
  pillIdle: {
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: {
    fontFamily: fonts.monoSemi,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  // Liste de toggles : conteneur sombre, hairlines internes (maquette).
  toggleList: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.borderHair,
    borderRadius: radius.lg,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    minHeight: 52,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rowLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
  },
  rowHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.micro,
    color: palette.creamMute,
    lineHeight: fontSize.micro * 1.45,
    marginTop: 2,
  },
  hair: {
    height: 1,
    backgroundColor: palette.separator,
    marginHorizontal: spacing.md,
  },
  // Encart « Il ne verra jamais » : fond vert très sombre + pastille.
  neverCard: {
    backgroundColor: GREEN_TINT_BG,
    borderWidth: 1,
    borderColor: GREEN_TINT_BORDER,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg - 1,
    marginBottom: spacing.xl,
  },
  neverHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    marginBottom: spacing.xs + 3,
  },
  neverDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.green,
  },
  neverTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.small,
    color: palette.green,
  },
  neverBody: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
  },
  // Lien de retrait — rouge doux coach (#E2685A), centré, cible ≥ 44 px.
  revokeLink: {
    minHeight: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  revokeText: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.small,
    color: palette.coachAlert,
    textAlign: 'center' as const,
  },
  // État non consenti : texte factuel avant l'ouverture d'accès.
  pendingBody: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamMute,
    lineHeight: fontSize.body * 1.55,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  emptyCard: {
    alignItems: 'center' as const,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: palette.creamSoft,
    textAlign: 'center' as const,
  },
  emptyHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    textAlign: 'center' as const,
    lineHeight: fontSize.small * 1.5,
    marginTop: spacing.md,
  },
};
