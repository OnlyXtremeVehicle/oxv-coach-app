/**
 * Coach — LE FIL DE SÉANCE (jalon 6, phase 5).
 *
 * Une séance, une colonne, chaque voix reconnaissable. Cet écran réunit ce que
 * `triage`, `debrief`, `lecture` et `priorites` disent aujourd'hui chacun de
 * leur côté — 1 986 lignes pour quatre fenêtres sur un seul objet.
 *
 * ---
 *
 * TROIS REGISTRES, RECONNAISSABLES SANS LÉGENDE
 *
 *   machine — gris. Ce qu'OXV a mesuré. Il ne conclut pas.
 *   coach   — rouge de marque. Ce qu'un humain a écrit. Voix ATTRIBUÉE.
 *   pilote  — trait clair. Ce que le pilote a posé lui-même.
 *
 * La couleur n'est pas un ornement : elle dit d'où vient la phrase. Un pilote
 * doit pouvoir reconnaître d'un coup d'œil un calcul, son coach, ou lui-même.
 * La légende n'apparaît QUE si plusieurs registres sont présents — trois
 * couleurs annoncées pour une seule voix est du bruit.
 *
 * ---
 *
 * DEUX BANDES, ET POURQUOI
 *
 * En tête, ce qui porte sur la séance ENTIÈRE et n'a pas d'instant : la lecture
 * globale, les marges par virage, l'intention du pilote. En dessous, la
 * chronologie — uniquement ce qui est réellement daté.
 *
 * Les mélanger demanderait d'inventer un instant à ce qui n'en a pas. Voir
 * `filSeanceLogic` : un fil qui ment sur l'ordre ne vaut pas mieux qu'un chiffre
 * fabriqué.
 *
 * ---
 *
 * AUCUNE ACTION, AUCUNE PRESCRIPTION
 *
 * Cet écran LIT. Il ne propose ni consigne de pilotage, ni classement, ni
 * jugement. Le coach lit le fait et décide de sa pédagogie, sous sa
 * responsabilité — l'application montre, elle ne dirige pas.
 *
 * ---
 *
 * IL SERA SOUVENT VIDE, ET IL LE DIT
 *
 * Au 01/08/2026 la production porte 13 lectures machine, 1 tour, et zéro
 * annotation, priorité ou intention. Un fil vide s'affiche et s'explique ; il ne
 * se remplit pas d'exemples.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  type EvenementFil,
  type FilSeance,
  type RegistreFil,
  ancrage,
  filEstVide,
} from '@/features/coach/filSeanceLogic';
import { chargerFilSeance } from '@/features/coach/filSeanceService';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const { palette, fonts, fontSize, spacing } = theme;

/**
 * La couleur d'un registre.
 *
 * Le rouge coach est celui de l'IDENTITÉ de marque, jamais un signal de
 * performance — la doctrine réserve le rouge de données aux zones de marge, et
 * l'or au chrono. Ici il ne dit qu'une chose : « c'est un humain qui parle ».
 */
const COULEUR_REGISTRE: Record<RegistreFil, string> = {
  machine: palette.creamMute,
  coach: palette.coachAccent,
  pilote: palette.cream,
};

/**
 * Le nom d'un registre — DIT AU COACH, qui est celui qui lit cet écran.
 *
 * Une première rédaction annonçait « Votre coach » pour le registre coach :
 * l'écran faisait dire au coach qu'il était son propre coach. Les libellés de
 * l'espace pilote ne se transposent pas tels quels.
 */
const NOM_REGISTRE: Record<RegistreFil, string> = {
  machine: 'Mesuré par OXV',
  coach: 'Vous',
  pilote: 'Le pilote',
};

/**
 * DATE ET heure d'un instant — « 4 juil · 14:32 ».
 *
 * La date est indispensable, et son absence était un défaut : le fil mêle des
 * tours bouclés PENDANT la séance et des notes écrites des jours plus tard. Avec
 * l'heure seule, un tour de 14:32 suivi d'une note de 09:15 donnait l'impression
 * que le fil remontait le temps. Relevé par la revue adversariale du 01/08/2026.
 */
function quand(ms: number | null): string | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
  try {
    const d = new Date(ms);
    const jour = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
    const h = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(d);
    return `${jour} · ${h}`;
  } catch {
    return null;
  }
}

/** Une ligne du fil. Le trait de gauche porte le registre — pas d'étiquette. */
function LigneFil({ e, avecHeure }: { e: EvenementFil; avecHeure: boolean }) {
  const couleur = COULEUR_REGISTRE[e.registre];
  const situe = ancrage(e);
  const h = avecHeure ? quand(e.instantMs) : null;

  return (
    <View
      style={s.ligne}
      accessible
      // `accessible` fusionne les enfants en UN élément : sans le corps ici, le
      // détail de chaque ligne était INAUDIBLE. La couleur du registre ne parle
      // pas non plus à un lecteur d'écran — d'où son nom en tête.
      accessibilityLabel={[NOM_REGISTRE[e.registre], e.titre, situe, h, e.corps]
        .filter(Boolean)
        .join('. ')}
    >
      <View style={[s.trait, { backgroundColor: couleur }]} />
      <View style={s.ligneCorps}>
        {(h !== null || situe !== null) && (
          <Text style={s.ligneMeta}>{[h, situe].filter(Boolean).join(' · ')}</Text>
        )}
        <Text style={[s.ligneTitre, { color: couleur }]}>{e.titre}</Text>
        {e.corps !== null && <Text style={s.ligneTexte}>{e.corps}</Text>}
      </View>
    </View>
  );
}

/** Légende — n'apparaît que si le fil porte PLUSIEURS voix. */
function Legende({ registres }: { registres: RegistreFil[] }) {
  if (registres.length < 2) return null;
  return (
    <View style={s.legende}>
      {registres.map((r) => (
        <View key={r} style={s.legendeItem}>
          <View style={[s.legendePastille, { backgroundColor: COULEUR_REGISTRE[r] }]} />
          <Text style={s.legendeTxt}>{NOM_REGISTRE[r]}</Text>
        </View>
      ))}
    </View>
  );
}

function CorpsFil({
  fil,
  isConsole,
  panne,
}: {
  fil: FilSeance;
  isConsole: boolean;
  /** Vrai si une source au moins n'a pas répondu — le fil est incomplet. */
  panne: boolean;
}) {
  if (filEstVide(fil)) {
    return (
      <View style={s.vide}>
        {/* UN FIL VIDE N'EST PAS UNE PANNE, et l'inverse non plus. Avaler les
            erreurs faisait passer une coupure réseau pour une séance sans
            matière — l'état d'erreur de l'écran était injoignable. */}
        <Text style={s.videTitre}>{panne ? 'Fil incomplet' : 'Ce fil est vide'}</Text>
        <Text style={s.videTexte}>
          {panne
            ? 'Une partie de cette séance n’a pas pu être lue. Ce que vous voyez peut être incomplet — réessayez.'
            : 'Rien n’a encore été mesuré ni écrit sur cette séance. Les tours bouclés, la lecture d’OXV et vos notes apparaîtront ici, chacun dans sa voix.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={isConsole ? s.corpsConsole : undefined}>
      {panne && (
        <Text style={s.note}>
          Une partie de cette séance n&apos;a pas pu être lue. Ce fil est incomplet.
        </Text>
      )}
      <Legende registres={fil.registresPresents} />

      {fil.entete.length > 0 && (
        <View style={s.bande}>
          <SectionLabel>SUR TOUTE LA SÉANCE</SectionLabel>
          {fil.entete.map((e) => (
            <LigneFil key={e.id} e={e} avecHeure={false} />
          ))}
        </View>
      )}

      {fil.chronologie.length > 0 && (
        <View style={s.bande}>
          <SectionLabel>AU FIL DU TEMPS</SectionLabel>
          {fil.chronologie.map((e) => (
            <LigneFil key={e.id} e={e} avecHeure />
          ))}
        </View>
      )}

      {fil.chronologie.length === 0 && fil.entete.length > 0 && (
        // On CONSTATE l'absence, on n'en donne pas la cause : une première
        // rédaction affirmait « les tours n'ont pas été enregistrés », ce que
        // rien ici n'établit — les tours peuvent exister sans heure de fin, ou
        // la lecture peut avoir échoué.
        <Text style={s.note}>Aucun événement daté sur cette séance.</Text>
      )}
    </View>
  );
}

export default function CoachFilScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = params.sessionId;
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [fil, setFil] = useState<FilSeance | null>(null);
  const [panne, setPanne] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [echec, setEchec] = useState(false);
  const [cleRecharge, setCleRecharge] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      setChargement(false);
      return;
    }
    let annule = false;
    setChargement(true);
    setEchec(false);
    setPanne(false);
    chargerFilSeance(sessionId)
      .then((r) => {
        if (annule) return;
        setFil(r.fil);
        setPanne(r.panne);
        setChargement(false);
      })
      .catch(() => {
        if (annule) return;
        setEchec(true);
        setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [sessionId, cleRecharge]);

  const etat: ScreenState = useMemo(() => {
    if (chargement) return 'loading';
    if (echec) return 'error';
    if (!sessionId || fil === null) return 'empty';
    // `nominal` = on a des données réelles à montrer. Un fil VIDE est nominal :
    // il dit honnêtement qu'il n'y a rien, ce qui n'est pas la même chose que
    // « aucune séance ouverte » (empty) ni qu'une panne (error).
    return 'nominal';
  }, [chargement, echec, sessionId, fil]);

  const relancer = useCallback(() => setCleRecharge((k) => k + 1), []);

  return (
    <Screen>
      <AppBar title="FIL DE SÉANCE" onBack={() => router.back()} />
      {/* PAS de ScrollView ici : `StateWrapper` en pose déjà une. Deux ScrollView
          verticales imbriquées faisaient défiler la barre de retour hors de
          l'écran. Relevé par la revue adversariale du 01/08/2026. */}
      <View style={s.scroll}>
        <StateWrapper
          state={etat}
          skeletonLines={6}
          emptyLabel="Aucune séance"
          emptyMessage="Ouvrez un fil depuis une séance de votre file de lecture."
          errorCause="Le fil n'a pas pu être chargé."
          onRetry={relancer}
        >
          {fil !== null ? <CorpsFil fil={fil} isConsole={isConsole} panne={panne} /> : null}
        </StateWrapper>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  corpsConsole: {
    maxWidth: 760,
    alignSelf: 'center',
    width: '100%',
  },
  legende: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  legendeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendePastille: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendeTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: palette.creamMute,
  },
  bande: {
    marginBottom: spacing.xl,
  },
  ligne: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  trait: {
    width: 2,
    borderRadius: 1,
  },
  ligneCorps: {
    flex: 1,
  },
  ligneMeta: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: palette.creamMute,
    marginBottom: 2,
  },
  ligneTitre: {
    fontFamily: fonts.display,
    fontSize: fontSize.body,
  },
  ligneTexte: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: 20,
    color: palette.creamMute,
    marginTop: spacing.xs,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: 19,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },
  vide: {
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  videTitre: {
    fontFamily: fonts.display,
    fontSize: fontSize.h3,
    color: palette.cream,
  },
  videTexte: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: 20,
    color: palette.creamMute,
  },
});
