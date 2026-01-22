import { create } from 'zustand';
import { Alert, EventStatus } from '../types';
import { alertsApi } from '../services/api';

interface AlertState {
  alerts: Alert[];
  selectedAlert: Alert | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  
  // Filters
  statusFilter: EventStatus | 'ALL';
  
  // Actions
  fetchAlerts: () => Promise<void>;
  refreshAlerts: () => Promise<void>;
  fetchAlertDetail: (id: string) => Promise<void>;
  acknowledgeAlert: (id: string) => Promise<boolean>;
  addNewAlert: (alert: Alert) => void;
  updateAlertInList: (id: string, update: Partial<Alert>) => void;
  setStatusFilter: (status: EventStatus | 'ALL') => void;
  clearError: () => void;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: [],
  selectedAlert: null,
  isLoading: false,
  isRefreshing: false,
  error: null,
  statusFilter: 'ALL',

  fetchAlerts: async (): Promise<void> => {
    set({ isLoading: true, error: null });
    try {
      const { statusFilter } = get();
      const params: any = {
        limit: 100,
        // Only fetch FALL and PRE_FALL events for this app
      };
      
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      
      const alerts = await alertsApi.getAlerts(params);
      
      // Filter to only show FALL and PRE_FALL events
      const fallAlerts = alerts.filter(
        (a) => a.type === 'FALL' || a.type === 'PRE_FALL'
      );
      
      set({ alerts: fallAlerts, isLoading: false });
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Erreur de chargement';
      set({ error: message, isLoading: false });
    }
  },

  refreshAlerts: async (): Promise<void> => {
    set({ isRefreshing: true });
    try {
      const { statusFilter } = get();
      const params: any = { limit: 100 };
      
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      
      const alerts = await alertsApi.getAlerts(params);
      const fallAlerts = alerts.filter(
        (a) => a.type === 'FALL' || a.type === 'PRE_FALL'
      );
      
      set({ alerts: fallAlerts, isRefreshing: false });
    } catch (error: any) {
      set({ isRefreshing: false });
    }
  },

  fetchAlertDetail: async (id: string): Promise<void> => {
    set({ isLoading: true, error: null });
    try {
      const alert = await alertsApi.getAlert(id);
      set({ selectedAlert: alert, isLoading: false });
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Erreur de chargement';
      set({ error: message, isLoading: false });
    }
  },

  acknowledgeAlert: async (id: string): Promise<boolean> => {
    set({ isLoading: true, error: null });
    try {
      const updatedAlert = await alertsApi.acknowledgeAlert(id);
      
      // Update in list
      const { alerts } = get();
      const updatedAlerts = alerts.map((a) =>
        a.id === id ? updatedAlert : a
      );
      
      set({
        alerts: updatedAlerts,
        selectedAlert: updatedAlert,
        isLoading: false,
      });
      
      return true;
    } catch (error: any) {
      const message = error.response?.data?.detail || "Erreur d'acquittement";
      set({ error: message, isLoading: false });
      return false;
    }
  },

  addNewAlert: (alert: Alert): void => {
    // Only add FALL or PRE_FALL alerts
    if (alert.type !== 'FALL' && alert.type !== 'PRE_FALL') return;
    
    const { alerts } = get();
    // Check if already exists
    if (alerts.find((a) => a.id === alert.id)) return;
    
    // Add to beginning of list
    set({ alerts: [alert, ...alerts] });
  },

  updateAlertInList: (id: string, update: Partial<Alert>): void => {
    const { alerts, selectedAlert } = get();
    
    const updatedAlerts = alerts.map((a) =>
      a.id === id ? { ...a, ...update } : a
    );
    
    const updatedSelected =
      selectedAlert?.id === id ? { ...selectedAlert, ...update } : selectedAlert;
    
    set({ alerts: updatedAlerts, selectedAlert: updatedSelected });
  },

  setStatusFilter: (status: EventStatus | 'ALL'): void => {
    set({ statusFilter: status });
    get().fetchAlerts();
  },

  clearError: () => set({ error: null }),
}));
