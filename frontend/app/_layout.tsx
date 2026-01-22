import React, { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/authStore';
import { useAlertStore } from '../src/store/alertStore';
import socketService from '../src/services/socket';

function AuthGuard() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const { addNewAlert, updateAlertInList } = useAlertStore();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  // Check auth on mount
  useEffect(() => {
    checkAuth();
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

  // Handle navigation based on auth state - only when navigation is ready
  useEffect(() => {
    if (!navigationState?.key) return; // Navigation not ready
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'login';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/alerts');
    }
  }, [isAuthenticated, isLoading, segments, navigationState?.key]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthGuard />
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
