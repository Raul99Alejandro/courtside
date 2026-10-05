import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import Watching from '../screens/Watching';
import Replay from '../screens/Replay';
import Answer from '../screens/Answer';
import LevelUp from '../screens/LevelUp';
import { currentScreen } from '../screens/direction';

const Stack = createNativeStackNavigator<RootStackParamList>();

const INITIAL = { watching: 'Watching', replay: 'Replay', answer: 'Answer', levelup: 'LevelUp' } as const;

export default function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName={INITIAL[currentScreen()]} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Watching" component={Watching} />
      <Stack.Screen name="Replay" component={Replay} />
      <Stack.Screen name="Answer" component={Answer} />
      <Stack.Screen name="LevelUp" component={LevelUp} />
    </Stack.Navigator>
  );
}
