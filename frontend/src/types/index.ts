// Types for OhmGuard Mobile App

export type EventType = 'FALL' | 'PRE_FALL' | 'PRESENCE' | 'INACTIVITY' | 'UNKNOWN';
export type EventStatus = 'NEW' | 'ACK' | 'RESOLVED' | 'FALSE_ALARM';
export type SeverityType = 'LOW' | 'MED' | 'HIGH';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  tenant_id: string | null;
  language: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Alert {
  id: string;
  sensor_id: string | null;
  device_id: string | null;
  type: EventType;
  confidence: number;
  severity: SeverityType;
  status: EventStatus;
  timestamp: string;
  tenant_id: string | null;
  site_id: string | null;
  zone_id: string | null;
  presence_status: string | null;
  presence_detected: boolean | null;
  active_regions: number[] | null;
  target_count: number | null;
  occurred_at: string | null;
  assigned_to: string | null;
  notes: string | null;
  location_path: string | null;
  location: {
    client_name: string | null;
    building_name: string | null;
    floor_name: string | null;
    room_number: string | null;
    zone_name: string | null;
  } | null;
  radar_name: string | null;
  serial_product: string | null;
}

export interface AlertUpdate {
  status?: EventStatus;
  assigned_to?: string;
  notes?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ApiError {
  detail: string;
}
