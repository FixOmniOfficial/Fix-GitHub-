import React, { useEffect } from 'react';
import { View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppAuthProvider } from '@/contexts/AppAuthContext';
import { TestModeProvider } from '@/contexts/TestModeContext';
import TestModeBanner from '@/components/TestModeBanner';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { setBaseUrl } from '@workspace/api-client-react';

// Set base URL for all API calls — must be at module level
setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <>
      {/* ── Test Mode Banner — floats above all screens when active ── */}
      <TestModeBanner />

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="test-mode/index" options={{ headerShown: false }} />
        <Stack.Screen name="professional/[type]" options={{ headerShown: false }} />
        <Stack.Screen name="booking/new" options={{ headerShown: false }} />
        <Stack.Screen name="booking/success" options={{ headerShown: false }} />
        <Stack.Screen name="booking/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="admin/index" options={{ headerShown: false }} />
        <Stack.Screen name="admin/professionals" options={{ headerShown: false }} />
        <Stack.Screen name="admin/helpline" options={{ headerShown: false }} />
        <Stack.Screen name="admin/rates" options={{ headerShown: false }} />
        <Stack.Screen name="admin/home-config" options={{ headerShown: false }} />
        <Stack.Screen name="auth/index" options={{ headerShown: false }} />
        <Stack.Screen name="auth/technician" options={{ headerShown: false }} />
        <Stack.Screen name="auth/customer" options={{ headerShown: false }} />
        <Stack.Screen name="technician/home" options={{ headerShown: false }} />
        <Stack.Screen name="technician/dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="technician/form-manager" options={{ headerShown: false }} />
        <Stack.Screen name="technician/submissions" options={{ headerShown: false }} />
        <Stack.Screen name="technician/kyc" options={{ headerShown: false }} />
        <Stack.Screen name="form/[techCode]" options={{ headerShown: false }} />
        <Stack.Screen name="rates/index" options={{ headerShown: false }} />
        <Stack.Screen name="helpline/index" options={{ headerShown: false }} />
        <Stack.Screen name="rating/index" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AppAuthProvider>
            {/* TestModeProvider must be inside AppAuthProvider (it calls login/logout) */}
            <TestModeProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </TestModeProvider>
          </AppAuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
