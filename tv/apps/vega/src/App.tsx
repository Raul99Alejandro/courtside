// The Vega app is a thin shell: the same navigator, screens and live controller as apps/expo.
// Everything platform-specific is swapped by metro.config.js (library aliases) and by
// *.kepler.ts files in packages/shared (remote keys). Nothing Vega-only is imported by shared.
import React from 'react';
import { GestureHandlerRootView } from '@amazon-devices/react-native-gesture-handler';
import { AppNavigator } from '@courtside/shared';
// Registers the remote-control mapping (RemoteControlManager.kepler.ts on Vega).
import '../../../packages/shared/src/app/configureRemoteControl';

export const App = () => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <AppNavigator fontsLoaded />
  </GestureHandlerRootView>
);
