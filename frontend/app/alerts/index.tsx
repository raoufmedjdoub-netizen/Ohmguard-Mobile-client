import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAlertStore } from '../../src/store/alertStore';
import { useAuthStore } from '../../src/store/authStore';
import { AlertCard } from '../../src/components/AlertCard';
import { Alert, EventStatus } from '../../src/types';
import Colors from '../../src/constants/colors';

const STATUS_FILTERS: Array<{ value: EventStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Toutes' },
  { value: 'NEW', label: 'Nouvelles' },
  { value: 'ACK', label: 'Acquittées' },
];

export default function AlertsScreen() {
  const router = useRouter();
  const {
    alerts,
    isLoading,
    isRefreshing,
    statusFilter,
    fetchAlerts,
    refreshAlerts,
    setStatusFilter,
  } = useAlertStore();
  const { logout, user } = useAuthStore();

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleAlertPress = useCallback((alert: Alert) => {
    router.push(`/alerts/${alert.id}`);
  }, [router]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const newAlertsCount = alerts.filter((a) => a.status === 'NEW').length;

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
      <Text style={styles.emptyTitle}>Aucune alerte</Text>
      <Text style={styles.emptySubtitle}>
        {statusFilter === 'NEW'
          ? 'Aucune nouvelle alerte en attente'
          : 'Aucune alerte à afficher'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.welcomeText}>Bonjour,</Text>
            <Text style={styles.userName}>{user?.full_name || 'Utilisateur'}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color={Colors.danger} />
          </TouchableOpacity>
        </View>

        {newAlertsCount > 0 && (
          <View style={styles.alertBanner}>
            <Ionicons name="warning" size={24} color={Colors.textLight} />
            <Text style={styles.alertBannerText}>
              {newAlertsCount} alerte{newAlertsCount > 1 ? 's' : ''} en attente
            </Text>
          </View>
        )}

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          {STATUS_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.value}
              style={[
                styles.filterTab,
                statusFilter === filter.value && styles.filterTabActive,
              ]}
              onPress={() => setStatusFilter(filter.value)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  statusFilter === filter.value && styles.filterTabTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Scrollable Alert List */}
      {isLoading && alerts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Chargement des alertes...</Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AlertCard alert={item} onPress={() => handleAlertPress(item)} />
          )}
          ListEmptyComponent={renderEmptyList}
          contentContainerStyle={alerts.length === 0 ? styles.emptyList : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refreshAlerts}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  header: {
    backgroundColor: Colors.headerBg,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeText: {
    color: Colors.turquoise,
    fontSize: 14,
  },
  userName: {
    color: Colors.textLight,
    fontSize: 20,
    fontWeight: '700',
  },
  logoutButton: {
    padding: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderRadius: 8,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  alertBannerText: {
    color: Colors.textLight,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: Colors.turquoise,
  },
  filterTabText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: Colors.textLight,
  },
  list: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  emptyList: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: Colors.textSecondary,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
});
