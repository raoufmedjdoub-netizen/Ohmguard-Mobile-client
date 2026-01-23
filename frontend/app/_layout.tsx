import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/authStore';
import { useAlertStore } from '../src/store/alertStore';
import socketService from '../src/services/socket';
import { tokenManager } from '../src/services/api';
import Colors from '../src/constants/colors';

export default function RootLayout() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const { addNewAlert, updateAlertInList } = useAlertStore();

  useEffect(() => {
    const checkInitialAuth = async () => {
      try {
        const token = await tokenManager.getAccessToken();
        if (token) {
          setInitialRoute('alerts/index');
        } else {
          setInitialRoute('login');
        }
      } catch (error) {
        setInitialRoute('login');
      }
    };
    checkInitialAuth();
  }, []);

  useEffect(() => {
    if (initialRoute === 'alerts/index') {
      const setupSocket = async () => {
        const token = await tokenManager.getAccessToken();
        if (token) {
          // Socket will connect when alerts screen loads
        }
      };
      setupSocket();
    }
  }, [initialRoute]);

  if (initialRoute === null) {
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
        initialRouteName={initialRoute}
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
