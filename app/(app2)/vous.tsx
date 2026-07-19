/**
 * VOUS — porte espace personnel (app2). Placeholder du lot L0 (Livrable 8),
 * remplacé par le lot L5. Entrée d'écran : la porte (useDoorTransition).
 */

import { StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabBarSpace } from '@/ui/v2';
import { StateView } from '@/ui/v2/StateView';
import { useDoorTransition } from '@/ui/v2/motion';
import { colors, space, type as typo } from '@/ui/v2/tokens';

export default function VousDoor() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();

  return (
    <Animated.View
      style={[
        styles.root,
        { paddingTop: insets.top + space.xl, paddingBottom: tabBarSpace(insets.bottom) },
        door,
      ]}
    >
      <Text style={styles.title}>VOUS</Text>
      <StateView
        state="empty"
        emptyMessage="À venir — votre espace personnel s'installera ici."
        style={styles.state}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
    paddingHorizontal: space.xl,
  },
  title: {
    fontFamily: typo.display,
    fontSize: 22,
    letterSpacing: 2,
    color: colors.text.hi,
  },
  state: {
    flex: 1,
    justifyContent: 'center',
  },
});
