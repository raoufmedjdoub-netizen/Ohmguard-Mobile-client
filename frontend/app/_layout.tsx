import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/authStore';
import Colors from '../src/constants/colors';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  
  // Get auth state from store
  const { isAuthenticated, isInitializing, checkAuth } = useAuthStore();

  // Check auth on mount
  useEffect(() => {
    const init = async () => {
      await checkAuth();
      setIsReady(true);
    };
    init();
  }, []);

  // Handle navigation based on auth state
  useEffect(() => {
    if (!isReady || isInitializing) return;

    const inLoginScreen = segments[0] === 'login';
    const inAlertsScreen = segments[0] === 'alerts';

    console.log('[Layout] Auth state:', { isAuthenticated, segments, inLoginScreen, inAlertsScreen });

    if (!isAuthenticated && !inLoginScreen) {
      // Not authenticated, redirect to login
      console.log('[Layout] Redirecting to login');
      router.replace('/login');
    } else if (isAuthenticated && inLoginScreen) {
      // Authenticated but on login screen, redirect to alerts
      console.log('[Layout] Redirecting to alerts');
      router.replace('/alerts');
    } else if (isAuthenticated && segments.length === 0) {
      // At root and authenticated, go to alerts
      console.log('[Layout] At root, redirecting to alerts');
      router.replace('/alerts');
    }
  }, [isReady, isInitializing, isAuthenticated, segments]);

  // Show loading while checking auth
  if (!isReady || isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.turquoise} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.headerBg },
          headerTintColor: Colors.textLight,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: Colors.backgroundSecondary },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: 'Connexion', headerShown: false }} />
        <Stack.Screen name="alerts/index" options={{ title: 'Alertes', headerBackVisible: false }} />
        <Stack.Screen name="alerts/[id]" options={{ title: 'Détail Alerte', presentation: 'card' }} />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.headerBg,
  },
  loadingText: {
    color: Colors.textLight,
    marginTop: 16,
    fontSize: 16,
  },
});
