import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useLive } from './index';
import { popTo } from '../navigation/popTo';

type Nav = { navigate: (name: string) => void; popTo?: (name: string) => void; getState: () => { index: number; routes: { name: string }[] } | undefined };

/**
 * Keeps the screens in step with the live session: a phone's answer takes over the screen, and a session that
 * ended (household expired, person removed, session timed out) sends the TV back to Who's watching.
 */
export function LiveBridge() {
  const navigation = useNavigation() as unknown as Nav;
  const { state } = useLive();
  const here = () => {
    const s = navigation.getState();
    return s?.routes[s.index]?.name;
  };
  const waiting = state.answers.length > 0;

  useEffect(() => {
    if (waiting && here() !== 'Answer') navigation.navigate('Answer');
  }, [waiting, state.answers[0]?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!state.sessionId && here() === 'Replay') popTo(navigation, 'Watching');
  }, [state.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
