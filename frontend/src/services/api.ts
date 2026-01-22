import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { AuthTokens, User, Alert, AlertUpdate, LoginRequest } from '../types';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token storage keys
const ACCESS_TOKEN_KEY = 'ohmguard_access_token';
const REFRESH_TOKEN_KEY = 'ohmguard_refresh_token';

// Token management
export const tokenManager = {
  async getAccessToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setTokens(tokens: AuthTokens): Promise<void> {
    try {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.access_token);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refresh_token);
    } catch (error) {
      console.error('Error saving tokens:', error);
    }
  },

  async clearTokens(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  },
};

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await tokenManager.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await tokenManager.getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post<AuthTokens>(
          `${API_BASE_URL}/api/auth/refresh`,
          null,
          { params: { refresh_token: refreshToken } }
        );

        await tokenManager.setTokens(response.data);
        processQueue(null, response.data.access_token);

        originalRequest.headers.Authorization = `Bearer ${response.data.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null);
        await tokenManager.clearTokens();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  async login(credentials: LoginRequest): Promise<AuthTokens> {
    const response = await api.post<AuthTokens>('/auth/login', credentials);
    await tokenManager.setTokens(response.data);
    return response.data;
  },

  async logout(): Promise<void> {
    await tokenManager.clearTokens();
  },

  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },
};

// Alerts API
export const alertsApi = {
  async getAlerts(params?: {
    status?: string;
    event_type?: string;
    limit?: number;
    skip?: number;
  }): Promise<Alert[]> {
    const response = await api.get<Alert[]>('/events', { params });
    return response.data;
  },

  async getAlert(id: string): Promise<Alert> {
    const response = await api.get<Alert>(`/events/${id}`);
    return response.data;
  },

  async updateAlert(id: string, update: AlertUpdate): Promise<Alert> {
    const response = await api.patch<Alert>(`/events/${id}`, update);
    return response.data;
  },

  async acknowledgeAlert(id: string): Promise<Alert> {
    return this.updateAlert(id, { status: 'ACK' });
  },
};

export default api;
