/**
 * Push Notifications Service
 * Handles Expo Push Notifications registration and handling
 * Completely safe loading - no imports at top level
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
  private notificationListener: any = null;
  private responseListener: any = null;
  private isInitialized = false;
  private Notifications: any = null;

  /**
   * Initialize push notifications
   * Returns the Expo Push Token if successful
   */
  async initialize(): Promise<string | null> {
    // Don't initialize twice
    if (this.isInitialized) {
      return this.expoPushToken;
    }

    // Skip on web
    if (Platform.OS === 'web') {
      console.log('[Push] Push notifications not supported on web');
      return null;
    }

    try {
      // Try to dynamically import the modules
      const [NotificationsModule, DeviceModule, ConstantsModule] = await Promise.all([
        import('expo-notifications').catch(() => null),
        import('expo-device').catch(() => null),
        import('expo-constants').catch(() => null),
      ]);

      if (!NotificationsModule || !DeviceModule) {
        console.log('[Push] Notifications modules not available');
        return null;
      }

      this.Notifications = NotificationsModule;
      const Device = DeviceModule;
      const Constants = ConstantsModule?.default;

      // Configure notification handler
      this.Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          priority: this.Notifications.AndroidNotificationPriority?.MAX,
        }),
      });

      // Check if we're on a physical device
      if (!Device.isDevice) {
        console.log('[Push] Must use physical device for Push Notifications');
        return null;
      }

      // Check existing permissions
      const { status: existingStatus } = await this.Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== 'granted') {
        const { status } = await this.Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[Push] Failed to get push notification permissions');
        return null;
      }

      // Get the Expo Push Token
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? 
                        (Constants as any)?.easConfig?.projectId;
      
      try {
        let tokenData;
        if (projectId) {
          tokenData = await this.Notifications.getExpoPushTokenAsync({ projectId });
        } else {
          console.log('[Push] No projectId found, trying without it...');
          tokenData = await this.Notifications.getExpoPushTokenAsync();
        }
        this.expoPushToken = tokenData.data;
        console.log('[Push] Expo Push Token:', this.expoPushToken);
      } catch (e: any) {
        console.log('[Push] Could not get token:', e.message);
        return null;
      }

      // Configure Android channel
      if (Platform.OS === 'android') {
        await this.Notifications.setNotificationChannelAsync('alerts', {
          name: 'Alertes de Chute',
          importance: this.Notifications.AndroidImportance?.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF0000',
          sound: 'default',
          enableLights: true,
          enableVibrate: true,
          lockscreenVisibility: this.Notifications.AndroidNotificationVisibility?.PUBLIC,
          bypassDnd: true,
        });
      }

      // Set up notification listeners
      this.setupListeners();
      this.isInitialized = true;

      return this.expoPushToken;
    } catch (error: any) {
      console.log('[Push] Error initializing push notifications:', error.message);
      return null;
    }
  }

  /**
   * Set up notification event listeners
   */
  private setupListeners(): void {
    if (!this.Notifications) return;

    // Listener for notifications received while app is foregrounded
    this.notificationListener = this.Notifications.addNotificationReceivedListener((notification: any) => {
      console.log('[Push] Notification received in foreground:', notification);
    });

    // Listener for when user taps on notification
    this.responseListener = this.Notifications.addNotificationResponseReceivedListener(async (response: any) => {
      console.log('[Push] Notification tapped:', response);
      const data = response.notification.request.content.data as PushNotificationData;
      
      // Navigate after a short delay to ensure navigation is ready
      setTimeout(async () => {
        try {
          const { router } = await import('expo-router');
          if (data?.eventId) {
            router.push(`/alerts/${data.eventId}`);
          } else {
            router.push('/alerts');
          }
        } catch (e) {
          console.log('[Push] Navigation error:', e);
        }
      }, 500);
    });
  }

  /**
   * Get the current push token
   */
  getToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Clean up listeners
   */
  cleanup(): void {
    if (this.Notifications) {
      if (this.notificationListener) {
        this.Notifications.removeNotificationSubscription(this.notificationListener);
        this.notificationListener = null;
      }
      if (this.responseListener) {
        this.Notifications.removeNotificationSubscription(this.responseListener);
        this.responseListener = null;
      }
    }
    this.isInitialized = false;
  }

  /**
   * Check if notifications are available
   */
  isAvailable(): boolean {
    return this.Notifications !== null;
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
