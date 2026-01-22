import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/authStore';
import { useAlertStore } from '../src/store/alertStore';
import socketService from '../src/services/socket';
import { tokenManager } from '../src/services/api';

export default function RootLayout() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const { addNewAlert, updateAlertInList } = useAlertStore();

  // Determine initial route before rendering
  useEffect(() => {
    const checkInitialAuth = async () => {
      try {
        const token = await tokenManager.getAccessToken();
        if (token) {
          setInitialRoute('alerts');
        } else {
          setInitialRoute('login');
        }
      } catch (error) {
        setInitialRoute('login');
      }
    };
    checkInitialAuth();
  }, []);

  // Setup socket listeners when authenticated
  useEffect(() => {
    if (initialRoute === 'alerts') {
      // User is authenticated, setup socket
      const setupSocket = async () => {
        const token = await tokenManager.getAccessToken();
        if (token) {
          // We'll connect socket when alerts screen loads
        }
      };
      setupSocket();
    }
  }, [initialRoute]);

  // Show loading until we determine the initial route
  if (initialRoute === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        initialRouteName={initialRoute}
        screenOptions={{
          headerStyle: { backgroundColor: '#1F2937' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#F3F4F6' },
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
    backgroundColor: '#1F2937',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 16,
  },
});
