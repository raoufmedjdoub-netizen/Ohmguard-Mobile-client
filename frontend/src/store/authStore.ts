import { create } from 'zustand';
import { User } from '../types';
import { authApi, tokenManager } from '../services/api';
import socketService from '../services/socket';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email: string, password: string): Promise<boolean> => {
    set({ isLoading: true, error: null });
    try {
      await authApi.login({ email, password });
      const user = await authApi.getCurrentUser();
      
      // Connect to WebSocket
      const token = await tokenManager.getAccessToken();
      if (user.tenant_id && token) {
        socketService.connect(user.tenant_id, token);
      }
      
      set({ user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Erreur de connexion';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  logout: async (): Promise<void> => {
    socketService.disconnect();
    await authApi.logout();
    set({ user: null, isAuthenticated: false, error: null });
  },

  checkAuth: async (): Promise<boolean> => {
    set({ isLoading: true });
    try {
      const token = await tokenManager.getAccessToken();
      if (!token) {
        set({ isLoading: false, isAuthenticated: false });
        return false;
      }

      const user = await authApi.getCurrentUser();
      
      // Connect to WebSocket
      if (user.tenant_id) {
        socketService.connect(user.tenant_id, token);
      }
      
      set({ user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (error) {
      await tokenManager.clearTokens();
      set({ user: null, isAuthenticated: false, isLoading: false });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
