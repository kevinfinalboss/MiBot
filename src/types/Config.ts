export interface LavalinkNodeConfig {
  id: string;
  host: string;
  port: number;
  password: string;
  secure: boolean;
}

export interface KubernetesConfig {
  inCluster: boolean;
  namespace?: string;
  kubeConfigPath?: string;
}

export interface BotConfig {
  bot: {
    token: string;
    prefix: string;
    useSharding: boolean;
    shards: number;
    ownerIds: string[];
  };
  lavalink: {
    nodes: LavalinkNodeConfig[];
    defaultSearchEngine: string;
    autoPlay: boolean;
  };
  cloudflare: {
    apiToken: string;
  };
  pterodactyl: {
    url: string;
    apiKey: string;
  };
  kubernetes?: KubernetesConfig;
}