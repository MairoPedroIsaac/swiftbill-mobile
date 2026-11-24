import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

// Opens home if signed in, otherwise the sign in screen.
export default function Index() {
  const { ready, token } = useAuth();
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.navy }} />;
  return <Redirect href={token ? '/home' : '/sign-in'} />;
}
