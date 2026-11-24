import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';

export function Logo({ size = 36, showName = true }: { size?: number; showName?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.26 }]}>
        <Text style={[styles.s, { fontSize: size * 0.56 }]}>S</Text>
      </View>
      {showName && <Text style={[styles.name, { fontSize: size * 0.56 }]}>SwiftBill</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tile: { backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  s: { color: colors.blue, fontWeight: '900', marginTop: -1 },
  name: { color: colors.white, fontWeight: '800', letterSpacing: -0.5 },
});
