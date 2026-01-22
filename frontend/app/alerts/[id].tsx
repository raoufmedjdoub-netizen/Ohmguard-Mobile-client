import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert as RNAlert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAlertStore } from '../../src/store/alertStore';
import { useAuthStore } from '../../src/store/authStore';
import { EventStatus, SeverityType } from '../../src/types';
import Colors from '../../src/constants/colors';

const getSeverityColor = (severity: SeverityType): string => {
  switch (severity) {
    case 'HIGH':
      return Colors.danger;
    case 'MED':
      return Colors.warning;
    case 'LOW':
      return Colors.success;
    default:
      return Colors.textSecondary;
  }
};

const getStatusInfo = (status: EventStatus): { color: string; label: string; icon: string } => {
  switch (status) {
    case 'NEW':
      return { color: Colors.danger, label: 'NOUVELLE', icon: 'alert-circle' };
    case 'ACK':
      return { color: Colors.turquoise, label: 'ACQUITTÉE', icon: 'checkmark-circle' };
    case 'RESOLVED':
      return { color: Colors.success, label: 'RÉSOLUE', icon: 'checkmark-done-circle' };
    case 'FALSE_ALARM':
      return { color: Colors.textSecondary, label: 'FAUSSE ALERTE', icon: 'close-circle' };
    default:
      return { color: Colors.textSecondary, label: status, icon: 'help-circle' };
  }
};

const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return format(date, "EEEE dd MMMM yyyy 'à' HH:mm:ss", { locale: fr });
  } catch {
    return timestamp;
  }
};

const canAcknowledge = (userRole: string | undefined): boolean => {
  const allowedRoles = ['SUPER_ADMIN', 'TENANT_ADMIN', 'SUPERVISOR', 'OPERATOR'];
  return userRole ? allowedRoles.includes(userRole) : false;
};

export default function AlertDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { selectedAlert, isLoading, error, fetchAlertDetail, acknowledgeAlert } = useAlertStore();
  const { user } = useAuthStore();
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  useEffect(() => {
    if (id) {
      fetchAlertDetail(id);
    }
  }, [id]);

  const handleAcknowledge = () => {
    RNAlert.alert(
      'Confirmer l\'acquittement',
      'Êtes-vous sûr de vouloir acquitter cette alerte ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Acquitter',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            setIsAcknowledging(true);
            const success = await acknowledgeAlert(id);
            setIsAcknowledging(false);
            if (success) {
              RNAlert.alert('Succès', 'L\'alerte a été acquittée');
            } else {
              RNAlert.alert('Erreur', 'Impossible d\'acquitter l\'alerte');
            }
          },
        },
      ]
    );
  };

  if (isLoading || !selectedAlert) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusInfo = getStatusInfo(selectedAlert.status);
  const severityColor = getSeverityColor(selectedAlert.severity);
  const userCanAcknowledge = canAcknowledge(user?.role);
  const isAlreadyAcknowledged = selectedAlert.status !== 'NEW';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Alert Type Banner */}
        <View style={[styles.typeBanner, { backgroundColor: severityColor }]}>
          <Ionicons
            name={selectedAlert.type === 'FALL' ? 'warning' : 'alert-circle'}
            size={40}
            color={Colors.textLight}
          />
          <Text style={styles.typeText}>
            {selectedAlert.type === 'FALL' ? 'CHUTE DÉTECTÉE' : 'PRÉ-CHUTE'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name={statusInfo.icon as any} size={16} color={Colors.textLight} />
            <Text style={styles.statusBadgeText}>{statusInfo.label}</Text>
          </View>
        </View>

        {/* Info Cards */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Informations</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: Colors.backgroundSecondary }]}>
                <Ionicons name="time" size={24} color={Colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Date et heure</Text>
                <Text style={styles.infoValue}>
                  {formatTimestamp(selectedAlert.occurred_at || selectedAlert.timestamp)}
                </Text>
              </View>
            </View>
          </View>

          {selectedAlert.location_path && (
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={[styles.infoIcon, { backgroundColor: Colors.backgroundSecondary }]}>
                  <Ionicons name="location" size={24} color={Colors.turquoise} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Localisation</Text>
                  <Text style={styles.infoValue}>{selectedAlert.location_path}</Text>
                </View>
              </View>
            </View>
          )}

          {selectedAlert.location && (
            <View style={styles.infoCard}>
              <View style={styles.locationGrid}>
                {selectedAlert.location.client_name && (
                  <View style={styles.locationItem}>
                    <Text style={styles.locationLabel}>Client</Text>
                    <Text style={styles.locationValue}>{selectedAlert.location.client_name}</Text>
                  </View>
                )}
                {selectedAlert.location.building_name && (
                  <View style={styles.locationItem}>
                    <Text style={styles.locationLabel}>Bâtiment</Text>
                    <Text style={styles.locationValue}>{selectedAlert.location.building_name}</Text>
                  </View>
                )}
                {selectedAlert.location.floor_name && (
                  <View style={styles.locationItem}>
                    <Text style={styles.locationLabel}>Étage</Text>
                    <Text style={styles.locationValue}>{selectedAlert.location.floor_name}</Text>
                  </View>
                )}
                {selectedAlert.location.room_number && (
                  <View style={styles.locationItem}>
                    <Text style={styles.locationLabel}>Chambre</Text>
                    <Text style={styles.locationValue}>{selectedAlert.location.room_number}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {selectedAlert.radar_name && (
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={[styles.infoIcon, { backgroundColor: Colors.backgroundSecondary }]}>
                  <Ionicons name="radio" size={24} color={Colors.primary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Radar</Text>
                  <Text style={styles.infoValue}>{selectedAlert.radar_name}</Text>
                  {selectedAlert.serial_product && (
                    <Text style={styles.infoSubvalue}>S/N: {selectedAlert.serial_product}</Text>
                  )}
                </View>
              </View>
            </View>
          )}

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: Colors.backgroundSecondary }]}>
                <Ionicons name="speedometer" size={24} color={severityColor} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Sévérité</Text>
                <View style={styles.severityRow}>
                  <View style={[styles.severityDot, { backgroundColor: severityColor }]} />
                  <Text style={[styles.severityText, { color: severityColor }]}>
                    {selectedAlert.severity === 'HIGH'
                      ? 'ÉLEVÉE'
                      : selectedAlert.severity === 'MED'
                      ? 'MOYENNE'
                      : 'BASSE'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Acknowledge Button */}
      <View style={styles.footer}>
        {!userCanAcknowledge ? (
          <View style={styles.noPermissionBanner}>
            <Ionicons name="lock-closed" size={20} color={Colors.textSecondary} />
            <Text style={styles.noPermissionText}>
              Vous n'avez pas la permission d'acquitter les alertes
            </Text>
          </View>
        ) : isAlreadyAcknowledged ? (
          <View style={styles.acknowledgedBanner}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
            <Text style={styles.acknowledgedText}>Alerte déjà acquittée</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.acknowledgeButton,
              isAcknowledging && styles.acknowledgeButtonDisabled,
            ]}
            onPress={handleAcknowledge}
            disabled={isAcknowledging}
            activeOpacity={0.8}
          >
            {isAcknowledging ? (
              <ActivityIndicator color={Colors.textLight} size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={28} color={Colors.textLight} />
                <Text style={styles.acknowledgeButtonText}>ACQUITTER L'ALERTE</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
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
  typeBanner: {
    padding: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  typeText: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textLight,
    marginTop: 12,
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusBadgeText: {
    color: Colors.textLight,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  infoSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  infoSubvalue: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  locationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  locationItem: {
    width: '50%',
    marginBottom: 12,
  },
  locationLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  locationValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  severityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  severityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  severityText: {
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    padding: 16,
    backgroundColor: Colors.backgroundCard,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  acknowledgeButton: {
    flexDirection: 'row',
    backgroundColor: Colors.turquoise,
    borderRadius: 16,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acknowledgeButtonDisabled: {
    backgroundColor: Colors.textSecondary,
  },
  acknowledgeButtonText: {
    color: Colors.textLight,
    fontSize: 20,
    fontWeight: '800',
    marginLeft: 12,
  },
  acknowledgedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 16,
  },
  acknowledgedText: {
    color: Colors.success,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  noPermissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
  },
  noPermissionText: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginLeft: 8,
    textAlign: 'center',
  },
});
