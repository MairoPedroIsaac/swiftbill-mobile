import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';

// A navy strip behind the phone's status bar, so text that scrolls up
// never shows under the clock and battery icons.
export function StatusShade() {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.navy }}
    />
  );
}
