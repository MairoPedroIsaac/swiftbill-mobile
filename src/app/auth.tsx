import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

// The website sends the user back here after Google sign in.
export default function AuthReturn() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { completeWithToken } = useAuth();

  useEffect(() => {
    (async () => {
      if (token) {
        try {
          await completeWithToken(token);
        } catch {
          // falls back to the sign in screen
        }
      }
      router.replace('/');
    })();
  }, [token, completeWithToken]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.white} />
    </View>
  );
}
