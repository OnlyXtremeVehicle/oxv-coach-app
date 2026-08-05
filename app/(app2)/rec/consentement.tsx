/**
 * REC — Étape 4b · Consentement biométrie. **NOUVEAU** (jalon 3, phase 4bis).
 *
 * ===========================================================================
 * POURQUOI CET ÉCRAN EXISTE, ALORS QUE LA FEUILLE FONCTIONNAIT
 * ===========================================================================
 *
 * Le consentement vivait en feuille sur l'écran d'appairage, par décision du
 * 01/08/2026. Le plan de montage, lui, demande un écran. Le fondateur a tranché
 * le 05/08 : **on crée les deux écrans du plan.**
 *
 * Ce n'est pas cosmétique. Une feuille se referme d'un geste vers le bas, sans
 * réponse — et cette dérobade laissait le consentement dans son état antérieur
 * sans que rien ne soit décidé. Un écran, lui, a deux sorties nommées, et le
 * pilote passe par l'une ou par l'autre.
 *
 * ===========================================================================
 * « AFFICHÉ LA PREMIÈRE FOIS SEULEMENT » — ET LA DÉCISION N'EST PAS ICI
 * ===========================================================================
 *
 * Le plan est explicite : *« Affiché la première fois seulement. Le consentement
 * valant jusqu'à révocation, un écran qui n'existerait que pour rappeler viole
 * la règle du bloc sans matière. Le rappel devient une ligne sur l'appairage. »*
 *
 * **La décision d'afficher cet écran se prend sur l'appairage, avant de
 * naviguer.** Jamais ici. Un écran qui déciderait lui-même de se sauter se
 * monterait pour se refermer — le pilote verrait un éclair — et il daterait par
 * `markBiometryAsked` une question qu'il n'a jamais vue.
 *
 * Conséquence : ce fichier ne consulte NI le drapeau `biometry`, NI
 * `biometry_asked_at`. S'il est monté, c'est qu'on a décidé de le montrer.
 *
 * Le flux reste donc à HUIT étapes dans le cas nominal.
 *
 * ===========================================================================
 * DEUX SORTIES, ET TOUTES DEUX MÈNENT PLUS LOIN
 * ===========================================================================
 *
 * « Accorder » et « Refuser » font l'une comme l'autre `replace` vers
 * `placement`. C'est la condition pour que cet écran ne devienne pas une
 * impasse — et c'est le piège exact que la scission pouvait créer : dans la
 * feuille d'origine, seule la fermeture au doigt relâchait la navigation ;
 * l'enregistrement, lui, ne reposait rien. Porté tel quel en route, le pilote
 * serait arrivé ici et n'en serait jamais reparti.
 *
 * **Aucun chevron de retour.** Revenir sur un consentement déjà donné n'aurait
 * pas de sens : la révocation vit dans les Réglages, à tout moment, et c'est ce
 * que dit la dernière ligne.
 *
 * ===========================================================================
 * DONNÉE SENSIBLE AU SENS DE L'ARTICLE 9
 * ===========================================================================
 *
 * La fréquence cardiaque relève de l'article 9 du RGPD. Le texte affiché ici
 * n'est pas un texte d'interface : sa source qui fait foi est
 * `docs/juridique/consentement_biometrie.md`. **Tenir les deux synchronisés.**
 *
 * Deux cases distinctes, et l'invariant est porté aux deux bouts : couper la
 * capture coupe le partage, et partager suppose de capter. Le garde-fou vit
 * dans le service ; celui d'ici n'en est que le reflet, pour que la case ne
 * puisse pas afficher un état que la base refusera.
 */

import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { REC_ROUTES } from '@/features/rec/captureStepLogic';
import {
  loadBiometryConsents,
  setBiometryCaptureConsent,
  setBiometryCoachShareConsent,
} from '@/services/consentService';
import { useAuthStore } from '@/store/useAuthStore';
import { chromeStyles } from '@/ui/v2/EcranChrome';
import { OxvIcon } from '@/ui/v2/icons';
import { PressScale } from '@/ui/v2/motion/PressScale';
import { colors, radius, space, typo } from '@/ui/v2';

// ---------------------------------------------------------------------------
// Une case, son intitulé, et la PORTÉE RÉELLE de ce qu'elle engage
// ---------------------------------------------------------------------------

function CheckRow({
  checked,
  title,
  hint,
  onToggle,
}: {
  checked: boolean;
  title: string;
  hint: string;
  onToggle: () => void;
}) {
  return (
    // Le `hint` porte la PORTÉE RÉELLE du consentement (source :
    // docs/juridique/consentement_biometrie.md). Le label seul écrasait ce
    // texte : on cochait sans jamais l'entendre. Il est lu après le label et
    // l'état, sans polluer la navigation par éléments.
    <PressScale
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={title}
      accessibilityHint={hint}
    >
      <View style={styles.checkRow}>
        <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
          {checked ? (
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path
                d="M5 12.5 L10 17.5 L19 6.5"
                stroke={colors.text.hi}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          ) : null}
        </View>
        <View style={styles.checkLabels}>
          <Text style={styles.checkTitle}>{title}</Text>
          <Text style={styles.checkHint}>{hint}</Text>
        </View>
      </View>
    </PressScale>
  );
}

// ---------------------------------------------------------------------------
// L'écran
// ---------------------------------------------------------------------------

export default function ConsentementScreen() {
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);

  const [capture, setCapture] = useState(false);
  const [share, setShare] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  /**
   * L'état persisté sert de point de départ aux cases.
   *
   * Il est normalement faux des deux côtés — cet écran ne s'affiche qu'à la
   * première question. Mais un compte qui aurait consenti depuis les Réglages
   * verrait sinon deux cases vides et croirait devoir tout redonner.
   */
  useEffect(() => {
    const pilotId = profile?.id;
    if (!pilotId) return;
    let annule = false;
    loadBiometryConsents(pilotId)
      .then((c) => {
        if (annule) return;
        setCapture(c.capture);
        setShare(c.coachShare);
      })
      .catch(() => undefined);
    return () => {
      annule = true;
    };
  }, [profile?.id]);

  // Invariant, miroir du garde-fou du service.
  const basculerCapture = () => {
    setCapture((prev) => {
      const suivant = !prev;
      if (!suivant) setShare(false); // couper la capture coupe le partage
      return suivant;
    });
  };
  const basculerPartage = () => {
    setShare((prev) => {
      const suivant = !prev;
      if (suivant) setCapture(true); // partager suppose capter
      return suivant;
    });
  };

  /**
   * ON NAVIGUE TOUJOURS, MÊME QUAND L'ÉCRITURE ÉCHOUE.
   *
   * Le pilote est au paddock, il va rouler. Le retenir sur un écran de
   * consentement parce que le réseau n'a pas répondu serait le pire des
   * arbitrages : la journée passe avant la préférence.
   *
   * Mais on ne lui ment pas non plus. L'échec s'affiche, et l'état local n'est
   * PAS mis à jour — c'est la différence avec la version d'origine, dont le
   * `catch` vide affichait « activé » sur une écriture ratée.
   */
  const enregistrer = useCallback(
    async (accepteCapture: boolean, accepteePartage: boolean) => {
      if (enCours) return;
      setEnCours(true);
      setErreur(null);
      const pilotId = profile?.id;
      if (!pilotId) {
        router.replace(REC_ROUTES.placement as never);
        return;
      }
      // Fail-closed : on n'écrit QUE les changements réels. Rien coché et rien
      // en base, aucune écriture.
      const echecs: string[] = [];
      if (accepteCapture !== capture) {
        const r = await setBiometryCaptureConsent(pilotId, accepteCapture).catch(() => ({
          ok: false as const,
          error: 'Le réseau n’a pas répondu.',
        }));
        if (!r.ok) echecs.push(r.error ?? 'La capture n’a pas pu être enregistrée.');
      }
      if (accepteePartage !== share) {
        const r = await setBiometryCoachShareConsent(pilotId, accepteePartage).catch(() => ({
          ok: false as const,
          error: 'Le réseau n’a pas répondu.',
        }));
        if (!r.ok) echecs.push(r.error ?? 'Le partage n’a pas pu être enregistré.');
      }

      if (echecs.length > 0) {
        setErreur(`${echecs[0]} Votre choix sera à reprendre dans les Réglages.`);
        setEnCours(false);
        return;
      }
      router.replace(REC_ROUTES.placement as never);
    },
    [enCours, profile?.id, capture, share]
  );

  return (
    <View style={chromeStyles.root}>
      {/* Pas de chevron : voir l'en-tête. L'espaceur garde le titre centré. */}
      <View style={[chromeStyles.header, { paddingTop: insets.top + space.md }]}>
        <View style={chromeStyles.headerSpacer} />
        <Text style={chromeStyles.title}>BIOMÉTRIE</Text>
        <View style={chromeStyles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.corps}>
        <View style={styles.tete}>
          <OxvIcon name="coeur" size={26} color={colors.text.hi} />
          <Text style={styles.titre}>Biométrie cardiaque</Text>
        </View>

        <Text style={styles.para}>
          Nous mesurons votre fréquence cardiaque pendant vos sessions, rien d’autre. Selon votre
          équipement : votre Apple Watch (mesure au poignet, indicative) ou une ceinture Polar
          appairée au paddock par le staff (mesure de précision).
        </Text>
        <Text style={styles.para}>
          Aucune donnée cardiaque ne s’affiche pendant que vous roulez. La restitution se fait à
          l’arrêt, pour une lecture posée de votre séance.
        </Text>
        <Text style={styles.para}>
          Vous seul y avez accès. Votre coach ne la voit que si vous l’y autorisez. Vos données sont
          conservées 30 jours, puis supprimées.
        </Text>

        <View style={styles.cases}>
          <CheckRow
            checked={capture}
            title="Capter ma fréquence cardiaque en séance"
            hint="Active la mesure et sa restitution, pour vous seul."
            onToggle={basculerCapture}
          />
          <CheckRow
            checked={share}
            title="Partager avec mon coach"
            hint="Ouvre à votre coach l’analyse détaillée de votre cardio. Suppose la capture."
            onToggle={basculerPartage}
          />
        </View>

        <Text style={styles.note}>
          Désactivé par défaut. Vous pouvez le retirer à tout moment, en un geste, depuis les
          Réglages.
        </Text>

        {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

        {/* ~42 px de haut. On n'élargit QUE VERS L'EXTÉRIEUR — jamais vers le
            bouton voisin.
            POURQUOI : `PressScale` pose le `style` reçu sur sa vue INTERNE, pas
            sur le Pressable externe qui porte le hitSlop. Le `marginTop` de
            `ghostBtn` vit donc DANS « Refuser » : les deux zones tactiles
            externes sont jointives, écart réel nul. Un hitSlop symétrique les
            ferait se recouvrir à cheval sur la frontière, et « Refuser », frère
            le plus tardif, gagnerait le hit-test : appuyer sur le bas
            d'« Accorder » RÉVOQUERAIT le consentement. Sur un écran de
            consentement, c'est le pire défaut possible. Deux bords opposés,
            donc : aucun recouvrement possible.
            La disposition verticale est reprise à l'identique de la feuille
            d'origine : le raisonnement ci-dessus dépend d'elle. */}
        <PressScale
          onPress={() => void enregistrer(capture, share)}
          accessibilityLabel="Accorder"
          accessibilityState={{ disabled: enCours, busy: enCours }}
          hitSlop={{ top: 6 }}
          style={[styles.primaire, enCours && styles.primaireInerte]}
        >
          <Text style={styles.primaireLabel}>{enCours ? 'Enregistrement…' : 'Accorder'}</Text>
        </PressScale>
        <PressScale
          onPress={() => void enregistrer(false, false)}
          accessibilityLabel="Refuser"
          accessibilityState={{ disabled: enCours }}
          hitSlop={{ bottom: 6 }}
          style={styles.discret}
        >
          {/* « Refuser » = révocation EXPLICITE : écrit capture=false et
              share=false, jamais une simple sortie qui laisserait un
              consentement pré-coché intact. */}
          <Text style={styles.discretLabel}>Refuser</Text>
        </PressScale>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  corps: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
  },
  tete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.lg,
  },
  titre: {
    fontFamily: typo.display,
    fontSize: 18,
    letterSpacing: 0.5,
    color: colors.text.hi,
  },
  para: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.mid,
    marginBottom: space.md,
  },
  cases: {
    marginTop: space.sm,
    gap: space.sm,
  },
  note: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.low,
    marginTop: space.md,
    marginBottom: space.lg,
  },
  erreur: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.accent,
    marginBottom: space.md,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: space.sm,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkBoxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkLabels: {
    flex: 1,
  },
  checkTitle: {
    fontFamily: typo.bodyMedium,
    fontSize: 15,
    color: colors.text.hi,
  },
  checkHint: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.low,
    marginTop: 2,
  },
  primaire: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  primaireInerte: {
    opacity: 0.6,
  },
  primaireLabel: {
    fontFamily: typo.bodySemi,
    fontSize: 15,
    letterSpacing: 0.5,
    color: colors.text.hi,
  },
  discret: {
    marginTop: space.sm,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  discretLabel: {
    fontFamily: typo.bodyMedium,
    fontSize: 14,
    color: colors.text.mid,
  },
});
