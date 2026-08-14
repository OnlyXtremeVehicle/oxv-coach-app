/**
 * VOS PIÈCES — ce que vous apportez le jour J. Route `vous/pieces`.
 *
 * ===========================================================================
 * LA RPC EXISTAIT DEPUIS LE 11/08, SANS UN SEUL APPELANT
 * ===========================================================================
 *
 * `eligibility_items` est en production depuis le 03/07 avec ses neuf clés ;
 * `declare_eligibility_item` depuis le 11/08, `security definer`, avec ses
 * garanties écrites. Sa seule occurrence dans tout le dépôt était le fichier
 * de types généré.
 *
 * Le plan dit : *« le pilote saisit une fois, l'application prévient, l'admin
 * contrôle — trois écrans, une seule donnée »*. Il y en avait UN, côté admin,
 * et il ne touchait qu'une des neuf clés : le briefing.
 *
 * ===========================================================================
 * DÉCLARER N'EST PAS VALIDER
 * ===========================================================================
 *
 * Le pilote dit « je l'ai, je l'apporte ». L'administrateur, lui seul, met
 * « ok » ou « refusé » — la RPC ne peut pas toucher `status`, et c'est le
 * cœur du dispositif : laisser le pilote valider ses propres pièces ferait de
 * la checklist d'accès à la piste une formalité qu'il remplit lui-même.
 *
 * L'écran le DIT plutôt que de le laisser deviner.
 *
 * ===========================================================================
 * ET IL N'INVENTE PAS DE CHECKLIST
 * ===========================================================================
 *
 * Les lignes sont semées à l'inscription, côté serveur. Sans ligne, l'écran
 * l'affiche honnêtement : il ne fabrique pas neuf cases pour une réservation
 * dont l'exploitant n'a pas ouvert le dossier.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

import {
  CLES_DECLARABLES,
  declarePiece,
  LIBELLES,
  listPiecesForRegistration,
  type CleEligibilite,
  type PieceEligibilite,
} from '@/services/eligibilityService';
import {
  colors,
  radius,
  SectionHeader,
  space,
  StateView,
  tabBarSpace,
  typo,
  useDoorTransition,
} from '@/ui/v2';
import { formatDateShort } from '@/utils/format';

type Etat = 'loading' | 'error' | 'ready';

export default function PiecesScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const params = useLocalSearchParams<{ registrationId?: string }>();
  const registrationId = params.registrationId ?? null;

  const [etat, setEtat] = useState<Etat>('loading');
  const [pieces, setPieces] = useState<PieceEligibilite[]>([]);
  const [enCours, setEnCours] = useState<CleEligibilite | null>(null);
  const [cle, setCle] = useState(0);

  useEffect(() => {
    if (!registrationId) {
      setEtat('error');
      return;
    }
    let annule = false;
    setEtat('loading');
    listPiecesForRegistration(registrationId)
      .then((rows) => {
        if (annule) return;
        setPieces(rows);
        setEtat('ready');
      })
      .catch(() => {
        if (!annule) setEtat('error');
      });
    return () => {
      annule = true;
    };
  }, [registrationId, cle]);

  const basculer = useCallback(
    async (piece: PieceEligibilite) => {
      if (!registrationId || enCours !== null) return;
      // Une pièce déjà tranchée par l'administration ne se re-déclare pas :
      // le geste n'aurait aucun effet visible et donnerait à croire le
      // contraire.
      if (piece.statut === 'ok' || piece.statut === 'refused') return;
      setEnCours(piece.cle);
      const res = await declarePiece(registrationId, piece.cle, piece.declareeLe === null);
      setEnCours(null);
      if (res.ok) setCle((k) => k + 1);
      else Toast.show({ type: 'error', text1: 'Déclaration non enregistrée.', text2: res.error });
    },
    [registrationId, enCours]
  );

  const declarables = pieces.filter((p) => CLES_DECLARABLES.includes(p.cle));
  const briefing = pieces.find((p) => p.cle === 'briefing') ?? null;

  return (
    <Animated.View style={[s.root, door]}>
      <View style={[s.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <BackGlyph />
        </Pressable>
        <Text style={s.headerTitle} accessibilityRole="header">
          VOS PIÈCES
        </Text>
        <View style={s.headerSpacer} />
      </View>

      {etat === 'loading' ? (
        <View style={s.pad}>
          <StateView state="loading" shape="list" />
        </View>
      ) : etat === 'error' ? (
        <View style={s.centered}>
          <StateView
            state="error"
            errorMessage="Vos pièces n'ont pas pu se charger."
            onRetry={() => setCle((k) => k + 1)}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: space.xl,
            paddingBottom: tabBarSpace(insets.bottom) + space.xxl,
          }}
        >
          <Text style={s.chapeau}>
            Indiquez ce que vous apportez. C’est l’organisation qui contrôle vos pièces au portail —
            votre déclaration lui dit seulement où vous en êtes.
          </Text>

          {declarables.length === 0 ? (
            <View style={s.bloc}>
              <Text style={s.corps}>
                Aucune pièce n’est encore demandée pour cette journée. La liste s’ouvrira quand
                l’organisation aura préparé votre dossier.
              </Text>
            </View>
          ) : (
            <View style={s.bloc}>
              <SectionHeader eyebrow="CE QUE VOUS APPORTEZ" count={declarables.length} />
              {declarables.map((p) => (
                <LignePiece
                  key={p.cle}
                  piece={p}
                  occupee={enCours === p.cle}
                  onPress={() => basculer(p)}
                />
              ))}
            </View>
          )}

          {briefing ? (
            <View style={s.bloc}>
              <SectionHeader eyebrow="TENU PAR L’ÉQUIPE" />
              {/* Le briefing est un geste COLLECTIF, le seul des neuf à l'être
                  par nature. Le pilote ne le déclare pas : on montre son état
                  sans bouton, plutôt que de l'omettre et laisser croire à un
                  oubli. */}
              <View style={s.ligne}>
                <Text style={s.nom}>{LIBELLES.briefing}</Text>
                <Text style={s.etat}>{libelleStatut(briefing)}</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </Animated.View>
  );
}

/** Ce que dit l'état d'une pièce, du point de vue du pilote. */
function libelleStatut(p: PieceEligibilite): string {
  if (p.statut === 'ok') return 'Validée';
  if (p.statut === 'refused') return 'À revoir';
  if (p.statut === 'na') return 'Sans objet';
  return p.declareeLe ? `Déclarée le ${formatDateShort(p.declareeLe)}` : 'À déclarer';
}

function LignePiece({
  piece,
  occupee,
  onPress,
}: {
  piece: PieceEligibilite;
  occupee: boolean;
  onPress: () => void;
}) {
  const tranchee = piece.statut === 'ok' || piece.statut === 'refused';
  return (
    <Pressable
      onPress={onPress}
      disabled={tranchee || occupee}
      accessibilityRole="button"
      accessibilityState={{
        disabled: tranchee || occupee,
        checked: piece.declareeLe !== null,
        busy: occupee,
      }}
      accessibilityLabel={`${LIBELLES[piece.cle]} — ${libelleStatut(piece)}`}
      style={({ pressed }) => [s.ligne, pressed && !tranchee && { opacity: 0.85 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={s.nom}>{LIBELLES[piece.cle]}</Text>
        {piece.note ? <Text style={s.note}>{piece.note}</Text> : null}
      </View>
      <Text style={[s.etat, piece.declareeLe !== null && s.etatDeclare]}>
        {libelleStatut(piece)}
      </Text>
    </Pressable>
  );
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

const s = StyleSheet.create({
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
    fontSize: 15,
    letterSpacing: 1.6,
    color: colors.text.hi,
  },
  headerSpacer: { width: 20 },
  pad: { flex: 1, paddingHorizontal: space.xl, paddingTop: space.md },
  centered: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xl },

  chapeau: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.mid,
    marginTop: space.md,
  },
  bloc: { marginTop: space.xl },
  corps: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.mid,
  },

  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.hairline,
    borderRadius: radius.cell,
  },
  nom: { fontFamily: typo.body, fontSize: 15, color: colors.text.hi },
  note: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.low,
    marginTop: 2,
  },
  etat: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text.low,
  },
  /** Déclarée : plus lisible, sans couleur — ce n'est pas encore une validation. */
  etatDeclare: { color: colors.text.mid },
});
