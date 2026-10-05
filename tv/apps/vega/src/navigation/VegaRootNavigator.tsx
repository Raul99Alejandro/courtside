import { createNativeStackNavigator } from '@amazon-devices/react-navigation__native-stack';
import { Replay } from '@courtside/shared';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function VegaRootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={Replay} />
    </Stack.Navigator>
  );
}
