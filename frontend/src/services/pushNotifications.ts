/**
 * Push Notifications Service
 * Safe wrapper that never crashes even if native modules are missing
 */
import { Platform } from 'react-native';

export interface PushNotificationData {
  type: 'new_event' | 'event_updated';
  eventId?: string;
  eventType?: string;
  location?: string;
  severity?: string;
}

class PushNotificationService {
  private expoPushToken: string | null = null;
  private isInitialized = false;
  private isAvailableFlag = false;

  /**
   * Initialize push notifications - safe method that never throws
   */
  async initialize(): Promise<string | null> {
    if (this.isInitialized) {
      return this.expoPushToken;
    }

    // Skip on web
    if (Platform.OS === 'web') {
      console.log('[Push] Skipping on web platform');
      return null;
    }

    try {
      // Check if native modules are available before importing
      const ExpoModulesCore = require('expo-modules-core');
      
      // Test if the native module exists
      let nativeModuleExists = false;
      try {
        const testModule = ExpoModulesCore.requireNativeModule('ExpoPushTokenManager');
        nativeModuleExists = !!testModule;
      } catch {
        nativeModuleExists = false;
      }

      if (!nativeModuleExists) {
        console.log('[Push] Native push notification module not available in this build');
        console.log('[Push] Please rebuild your development build to enable push notifications');
        this.isInitialized = true;
        return null;
      }

      // Safe to import now
      const Notifications = require('expo-notifications');
      const Device = require('expo-device');
      const Constants = require('expo-constants').default;

      // Configure notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // Check if physical device
      if (!Device.isDevice) {
        console.log('[Push] Must use physical device for Push Notifications');
        this.isInitialized = true;
        return null;
      }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[Push] Permission not granted');
        this.isInitialized = true;
        return null;
      }

      // Get token
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? 
                        Constants?.easConfig?.projectId;
      
      const tokenConfig = projectId ? { projectId } : undefined;
      const tokenData = await Notifications.getExpoPushTokenAsync(tokenConfig);
      this.expoPushToken = tokenData.data;
      this.isAvailableFlag = true;

      console.log('[Push] Token obtained:', this.expoPushToken);

      // Setup Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('alerts', {
          name: 'Alertes de Chute',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
        });
      }

      this.isInitialized = true;
      return this.expoPushToken;

    } catch (error: any) {
      console.log('[Push] Initialization skipped:', error.message || 'Module not available');
      this.isInitialized = true;
      return null;
    }
  }

  getToken(): string | null {
    return this.expoPushToken;
  }

  cleanup(): void {
    this.expoPushToken = null;
    this.isInitialized = false;
  }

  isAvailable(): boolean {
    return this.isAvailableFlag;
  }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
