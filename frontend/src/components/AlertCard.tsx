import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Alert, EventStatus, SeverityType } from '../types';

interface AlertCardProps {
  alert: Alert;
  onPress: () => void;
}

const getSeverityColor = (severity: SeverityType): string => {
  switch (severity) {
    case 'HIGH':
      return '#DC2626';
    case 'MED':
      return '#F59E0B';
    case 'LOW':
      return '#10B981';
    default:
      return '#6B7280';
  }
};

const getStatusColor = (status: EventStatus): string => {
  switch (status) {
    case 'NEW':
      return '#DC2626';
    case 'ACK':
      return '#F59E0B';
    case 'RESOLVED':
      return '#10B981';
    case 'FALSE_ALARM':
      return '#6B7280';
    default:
      return '#6B7280';
  }
};

const getStatusLabel = (status: EventStatus): string => {
  switch (status) {
    case 'NEW':
      return 'NOUVELLE';
    case 'ACK':
      return 'ACQUITTÉE';
    case 'RESOLVED':
      return 'RÉSOLUE';
    case 'FALSE_ALARM':
      return 'FAUSSE ALERTE';
    default:
      return status;
  }
};

const getTypeLabel = (type: string): string => {
  switch (type) {
    case 'FALL':
      return 'CHUTE DÉTECTÉE';
    case 'PRE_FALL':
      return 'PRÉ-CHUTE';
    default:
      return type;
  }
};

const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return format(date, "dd MMM yyyy 'à' HH:mm", { locale: fr });
  } catch {
    return timestamp;
  }
};

export const AlertCard: React.FC<AlertCardProps> = ({ alert, onPress }) => {
  const severityColor = getSeverityColor(alert.severity);
  const statusColor = getStatusColor(alert.status);
  const isNew = alert.status === 'NEW';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isNew && styles.cardNew,
        { borderLeftColor: severityColor },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.typeContainer}>
          <Ionicons
            name={alert.type === 'FALL' ? 'warning' : 'alert-circle'}
            size={24}
            color={severityColor}
          />
          <Text style={[styles.typeText, { color: severityColor }]}>
            {getTypeLabel(alert.type)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{getStatusLabel(alert.status)}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color="#6B7280" />
          <Text style={styles.infoText}>
            {formatTimestamp(alert.occurred_at || alert.timestamp)}
          </Text>
        </View>

        {alert.location_path && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText} numberOfLines={1}>
              {alert.location_path}
            </Text>
          </View>
        )}

        {alert.radar_name && (
          <View style={styles.infoRow}>
            <Ionicons name="radio-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText}>{alert.radar_name}</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.viewDetail}>Voir le détail</Text>
        <Ionicons name="chevron-forward" size={20} color="#3B82F6" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderLeftWidth: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardNew: {
    backgroundColor: '#FEF2F2',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeText: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  content: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 8,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  viewDetail: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
  },
});

export default AlertCard;
