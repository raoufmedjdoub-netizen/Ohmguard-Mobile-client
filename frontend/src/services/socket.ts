import { io, Socket } from 'socket.io-client';
import { Alert } from '../types';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

class SocketService {
  private socket: Socket | null = null;
  private tenantId: string | null = null;
  private onNewAlert: ((alert: Alert) => void) | null = null;
  private onEventUpdated: ((data: { event_id: string; update: any }) => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(tenantId: string, token: string): void {
    if (this.socket?.connected && this.tenantId === tenantId) {
      console.log('[Socket] Already connected to tenant:', tenantId);
      return;
    }

    this.disconnect();
    this.tenantId = tenantId;

    console.log('[Socket] Connecting to:', `${API_BASE_URL}/api/socket.io`);

    this.socket = io(API_BASE_URL, {
      path: '/api/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[Socket] Connected');
      this.reconnectAttempts = 0;
      // Join tenant room
      if (this.tenantId) {
        this.socket?.emit('join_tenant', { tenant_id: this.tenantId });
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      this.reconnectAttempts++;
    });

    this.socket.on('joined', (data) => {
      console.log('[Socket] Joined room:', data);
    });

    // Listen for new events
    this.socket.on('new_event', (data: { type: string; event: Alert }) => {
      console.log('[Socket] New event received:', data.event?.id);
      if (this.onNewAlert && data.event) {
        // Only notify for FALL events (critical alerts)
        if (data.event.type === 'FALL' || data.event.type === 'PRE_FALL') {
          this.onNewAlert(data.event);
        }
      }
    });

    this.socket.on('new_radar_event', (data: { type: string; event: Alert }) => {
      console.log('[Socket] New radar event received:', data.event?.id);
      if (this.onNewAlert && data.event) {
        if (data.event.type === 'FALL' || data.event.type === 'PRE_FALL') {
          this.onNewAlert(data.event);
        }
      }
    });

    // Listen for event updates
    this.socket.on('event_updated', (data: { type: string; event_id: string; update: any }) => {
      console.log('[Socket] Event updated:', data.event_id);
      if (this.onEventUpdated) {
        this.onEventUpdated(data);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      if (this.tenantId) {
        this.socket.emit('leave_tenant', { tenant_id: this.tenantId });
      }
      this.socket.disconnect();
      this.socket = null;
    }
    this.tenantId = null;
  }

  setOnNewAlert(callback: ((alert: Alert) => void) | null): void {
    this.onNewAlert = callback;
  }

  setOnEventUpdated(callback: ((data: { event_id: string; update: any }) => void) | null): void {
    this.onEventUpdated = callback;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
export default socketService;
