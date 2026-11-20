import { AuthProvider } from '@/src/context/AuthContext';
import { SkillsProvider } from '@/src/context/SkillsContext';
import { ActivitiesProvider } from '@/src/context/ActivitiesContext';
import { WorkoutProvider } from '@/src/context/WorkoutContext';
import { GameProvider } from '@/src/context/GameContext';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import React, { useEffect } from 'react';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { VT323_400Regular } from '@expo-google-fonts/vt323';
import { PixelifySans_400Regular, PixelifySans_700Bold } from '@expo-google-fonts/pixelify-sans';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import * as Sentry from '@sentry/react-native';

SystemUI.setBackgroundColorAsync('#1e1608');

SplashScreen.preventAutoHideAsync();

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  debug: __DEV__,
  // Keep local test runs (test-env/, Firebase emulators) out of Sentry.
  enabled: process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR !== '1',
});

function RootLayout() {
  const [fontsLoaded] = useFonts({
    PressStart2P: PressStart2P_400Regular,
    VT323: VT323_400Regular,
    // UI kit for the new version (PROD-024)
    PixelifySans: PixelifySans_400Regular,
    PixelifySansBold: PixelifySans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SkillsProvider>
          <ActivitiesProvider>
            <WorkoutProvider>
              <GameProvider>
                <Slot />
                <StatusBar style="light" />
              </GameProvider>
            </WorkoutProvider>
          </ActivitiesProvider>
        </SkillsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);
