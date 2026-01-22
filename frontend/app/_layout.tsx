import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/authStore';
import { useAlertStore } from '../src/store/alertStore';
import socketService from '../src/services/socket';

// Auth guard component
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const { addNewAlert, updateAlertInList } = useAlertStore();
  const segments = useSegments();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  // Check auth on mount
  useEffect(() => {
    checkAuth().catch((e) => {
      console.error('Auth check error:', e);
      setError(String(e));
    });
  }, []);

  // Setup socket listeners
  useEffect(() => {
    if (isAuthenticated) {
      socketService.setOnNewAlert((alert) => {
        addNewAlert(alert);
      });

      socketService.setOnEventUpdated((data) => {
        updateAlertInList(data.event_id, data.update);
      });
    }

    return () => {
      socketService.setOnNewAlert(null);
      socketService.setOnEventUpdated(null);
    };
  }, [isAuthenticated]);

  // Handle navigation based on auth state
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'login';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/alerts');
    }
  }, [isAuthenticated, isLoading, segments]);

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: 'red', padding: 20 }}>Error: {error}</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthGuard>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: '#1F2937',
            },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: {
              fontWeight: '700',
            },
            contentStyle: {
              backgroundColor: '#F3F4F6',
            },
          }}
        >
          <Stack.Screen
            name="index"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="login"
            options={{
              title: 'Connexion',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="alerts/index"
            options={{
              title: 'Alertes',
              headerBackVisible: false,
            }}
          />
          <Stack.Screen
            name="alerts/[id]"
            options={{
              title: 'Détail Alerte',
              presentation: 'card',
            }}
          />
        </Stack>
      </AuthGuard>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1F2937',
  },
});
