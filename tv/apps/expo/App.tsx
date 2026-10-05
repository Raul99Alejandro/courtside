import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppNavigator } from '@courtside/shared';
import { LogBox } from 'react-native';
import '../../packages/shared/src/app/configureRemoteControl';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible';
import { Kalam_700Bold } from '@expo-google-fonts/kalam';

// Suppress specific deprecation warnings that don't affect functionality
// These warnings come from libraries using deprecated React methods
if (__DEV__) {
  // Suppress in LogBox
  LogBox.ignoreLogs([
    /findNodeHandle is deprecated/,
    /findHostInstance_DEPRECATED is deprecated/,
  ]);

  // Also suppress at console level for warnings that slip through
  const originalWarn = console.warn;
  console.warn = (...args) => {
    const message = args[0]?.toString() || '';
    if (
      message.includes('findNodeHandle is deprecated') ||
      message.includes('findHostInstance_DEPRECATED is deprecated')
    ) {
      return;
    }
    originalWarn(...args);
  };
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [loaded, error] = useFonts({
    BarlowCondensed_700Bold,
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
    Kalam_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
      if (error) {
        console.warn(`Error in loading fonts: ${error}`);
      }
    }
  }, [loaded, error]);

  return <AppNavigator fontsLoaded={loaded || !!error} />;
}
