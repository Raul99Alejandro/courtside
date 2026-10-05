import React, { useEffect, StrictMode } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { Platform } from 'react-native';
import { GoBackConfiguration } from '../app/remote-control/GoBackConfiguration';
import RootNavigator from './RootNavigator';
import { LiveBridge } from '../live/LiveBridge';
import { isDemo } from '../screens/screen';
import { liveController } from '../live';

export interface AppNavigatorProps {
  fontsLoaded?: boolean;
  onReady?: () => void;
}

export default function AppNavigator({ fontsLoaded = true, onReady }: AppNavigatorProps) {
  useEffect(() => {
    // Import remote control config for TV platforms
    if (Platform.isTV) {
      try {
        require('../app/configureRemoteControl');
      } catch (error) {
        console.warn('Remote control configuration not available:', error);
      }
    }
  }, []);

  // The live session (socket, timers) lives as long as the app; unmounting stops it. A remount boots it again.
  useEffect(() => {
    if (isDemo()) return undefined;
    const live = liveController();
    void live.boot();
    return () => live.stop();
  }, []);

  useEffect(() => {
    if (fontsLoaded && onReady) {
      onReady();
    }
  }, [fontsLoaded, onReady]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <StrictMode>
      <NavigationContainer theme={DarkTheme}>
        <GoBackConfiguration />
        {!isDemo() && <LiveBridge />}
        <RootNavigator />
      </NavigationContainer>
    </StrictMode>
  );
}
