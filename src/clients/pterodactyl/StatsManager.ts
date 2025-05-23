import { AxiosResponse } from 'axios';
import { PterodactylBaseClient } from './BaseClient';
import { PterodactylServerStats, PterodactylServer } from '../../types/Pterodactyl';

export interface ServerStatsFormatted {
  serverId: number;
  serverName: string;
  status: string;
  suspended: boolean;
  resources: {
    memory: {
      used: number;
      limit: number;
      percentage: number;
      formatted: {
        used: string;
        limit: string;
      };
    };
    cpu: {
      usage: number;
      percentage: number;
      limit: number;
    };
    disk: {
      used: number;
      limit: number;
      percentage: number;
      formatted: {
        used: string;
        limit: string;
      };
    };
    network: {
      rx: string;
      tx: string;
    };
    uptime: {
      seconds: number;
      formatted: string;
    };
  };
}

export class StatsManager extends PterodactylBaseClient {

  async getServerStats(serverId: number): Promise<PterodactylServerStats> {
    try {
      const server = await this.getServerBasicInfo(serverId);
      if (!server || !server.attributes) {
        throw new Error(`Servidor ${serverId} não encontrado ou dados inválidos`);
      }
      
      const response: AxiosResponse<PterodactylServerStats> = await this.clientApi.get(
        `/servers/${server.attributes.identifier}/resources`
      );
      
      if (!response.data) {
        throw new Error(`Stats não encontrados para servidor ${serverId}`);
      }
      
      return response.data;
    } catch (error) {
      this.handleError(`getServerStats(${serverId})`, error);
    }
  }

  async getServerStatsFormatted(serverId: number): Promise<ServerStatsFormatted> {
    try {
      const [server, stats] = await Promise.all([
        this.getServerBasicInfo(serverId),
        this.getServerStats(serverId)
      ]);

      const memoryPercentage = server.attributes.limits.memory > 0 
        ? Math.round((stats.attributes.resources.memory_bytes / (server.attributes.limits.memory * 1024 * 1024)) * 100)
        : 0;

      const diskPercentage = server.attributes.limits.disk > 0
        ? Math.round((stats.attributes.resources.disk_bytes / (server.attributes.limits.disk * 1024 * 1024)) * 100)
        : 0;

      const cpuPercentage = server.attributes.limits.cpu > 0
        ? Math.round((stats.attributes.resources.cpu_absolute / server.attributes.limits.cpu) * 100)
        : Math.round(stats.attributes.resources.cpu_absolute);

      return {
        serverId: server.attributes.id,
        serverName: server.attributes.name,
        status: stats.attributes.current_state,
        suspended: stats.attributes.is_suspended,
        resources: {
          memory: {
            used: stats.attributes.resources.memory_bytes,
            limit: server.attributes.limits.memory * 1024 * 1024,
            percentage: memoryPercentage,
            formatted: {
              used: this.formatBytes(stats.attributes.resources.memory_bytes),
              limit: this.formatBytes(server.attributes.limits.memory * 1024 * 1024)
            }
          },
          cpu: {
            usage: stats.attributes.resources.cpu_absolute,
            percentage: cpuPercentage,
            limit: server.attributes.limits.cpu
          },
          disk: {
            used: stats.attributes.resources.disk_bytes,
            limit: server.attributes.limits.disk * 1024 * 1024,
            percentage: diskPercentage,
            formatted: {
              used: this.formatBytes(stats.attributes.resources.disk_bytes),
              limit: this.formatBytes(server.attributes.limits.disk * 1024 * 1024)
            }
          },
          network: {
            rx: this.formatBytes(stats.attributes.resources.network_rx_bytes),
            tx: this.formatBytes(stats.attributes.resources.network_tx_bytes)
          },
          uptime: {
            seconds: stats.attributes.resources.uptime,
            formatted: this.formatUptime(stats.attributes.resources.uptime)
          }
        }
      };
    } catch (error) {
      this.handleError(`getServerStatsFormatted(${serverId})`, error);
    }
  }

  async getMultipleServerStats(serverIds: number[]): Promise<ServerStatsFormatted[]> {
    try {
      const statsPromises = serverIds.map(id => this.getServerStatsFormatted(id));
      const results = await Promise.allSettled(statsPromises);
      
      return results
        .filter((result): result is PromiseFulfilledResult<ServerStatsFormatted> => result.status === 'fulfilled')
        .map(result => result.value);
    } catch (error) {
      this.handleError('getMultipleServerStats', error);
    }
  }

  async getServerPowerState(serverId: number): Promise<string> {
    try {
      const stats = await this.getServerStats(serverId);
      return stats.attributes.current_state;
    } catch (error) {
      this.handleError(`getServerPowerState(${serverId})`, error);
    }
  }

  private async getServerBasicInfo(serverId: number): Promise<PterodactylServer> {
    try {
      const response: AxiosResponse<PterodactylServer> = await this.api.get(`/servers/${serverId}`);
      
      if (!response.data) {
        throw new Error(`Resposta inválida da API para servidor ${serverId}`);
      }
      
      const server = response.data;
      if (!server.attributes) {
        throw new Error(`Servidor ${serverId} não possui attributes válidos`);
      }
      
      return server;
    } catch (error) {
      this.handleError(`getServerBasicInfo(${serverId})`, error);
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  private formatUptime(seconds: number): string {
    if (seconds === 0) return 'Offline';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    
    return parts.length > 0 ? parts.join(' ') : '< 1m';
  }
}