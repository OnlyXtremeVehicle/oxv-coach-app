import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/theme/v2';

export function Screen({
  children,
  scroll = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const Body: React.ElementType = scroll ? ScrollView : View;
  return (
    <View style={{ flex: 1, backgroundColor: theme.palette.night, paddingTop: insets.top }}>
      <Body
        style={{ flex: 1 }}
        contentContainerStyle={scroll ? { paddingBottom: 24, flexGrow: 1 } : undefined}
      >
        {children}
      </Body>
    </View>
  );
}
