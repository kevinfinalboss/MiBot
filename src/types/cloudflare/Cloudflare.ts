export interface CloudflareConfig {
  apiToken: string;
  zoneId?: string;
}

export interface DNSRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
  zone_id: string;
  zone_name: string;
  created_on: string;
  modified_on: string;
  comment?: string;
  tags?: string[];
  meta?: {
    auto_added: boolean;
    managed_by_apps: boolean;
    managed_by_argo_tunnel: boolean;
  };
}

export interface Zone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type: string;
  development_mode: number;
  name_servers: string[];
  original_name_servers: string[];
  original_registrar: string;
  original_dnshost: string;
  modified_on: string;
  created_on: string;
  activated_on: string;
  account: {
    id: string;
    name: string;
  };
  permissions: string[];
  plan: {
    id: string;
    name: string;
    price: number;
    currency: string;
    frequency: string;
    is_subscribed: boolean;
    can_subscribe: boolean;
  };
}

export interface CreateDNSRecordData {
  type: string;
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
  comment?: string;
  tags?: string[];
}

export interface UpdateDNSRecordData {
  type?: string;
  name?: string;
  content?: string;
  ttl?: number;
  proxied?: boolean;
  comment?: string;
  tags?: string[];
}

export interface PurgeCache {
  files?: string[];
  tags?: string[];
  hosts?: string[];
  prefixes?: string[];
}

export interface CacheStats {
  since: string;
  until: string;
  requests: {
    all: number;
    cached: number;
    uncached: number;
    content_type: Record<string, number>;
    country: Record<string, number>;
    ssl: {
      encrypted: number;
      unencrypted: number;
    };
    http_status: Record<string, number>;
  };
  bandwidth: {
    all: number;
    cached: number;
    uncached: number;
    content_type: Record<string, number>;
    country: Record<string, number>;
    ssl: {
      encrypted: number;
      unencrypted: number;
    };
  };
  threats: {
    all: number;
    country: Record<string, number>;
    type: Record<string, number>;
  };
  pageviews: {
    all: number;
    search_engines: Record<string, number>;
  };
  uniques: {
    all: number;
  };
}

export interface SecurityLevel {
  id: string;
  value: 'essentially_off' | 'low' | 'medium' | 'high' | 'under_attack';
  editable: boolean;
  modified_on: string;
}

export interface DevelopmentMode {
  id: string;
  value: 'on' | 'off';
  editable: boolean;
  modified_on: string;
  time_remaining?: number;
}

export interface SSLSetting {
  id: string;
  value: 'off' | 'flexible' | 'full' | 'strict';
  editable: boolean;
  modified_on: string;
}