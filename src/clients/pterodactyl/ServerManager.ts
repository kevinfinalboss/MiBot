import { AxiosResponse } from 'axios';
import { PterodactylBaseClient } from './BaseClient';
import {
  PterodactylServer,
  PterodactylApiResponse,
  CreateServerRequest
} from '../../types/Pterodactyl';

export class ServerManager extends PterodactylBaseClient {
  
  async getServers(page: number = 1, perPage: number = 50): Promise<PterodactylApiResponse<PterodactylServer>> {
    try {
      const response: AxiosResponse<PterodactylApiResponse<PterodactylServer>> = await this.api.get(
        `/servers?page=${page}&per_page=${perPage}&include=allocations,user`
      );
      return response.data;
    } catch (error) {
      this.handleError('getServers', error);
    }
  }

  async getAllServers(): Promise<PterodactylServer[]> {
    try {
      const allServers: PterodactylServer[] = [];
      let currentPage = 1;
      let totalPages = 1;

      do {
        const response = await this.getServers(currentPage, 100);
        allServers.push(...response.data);
        
        if (response.meta?.pagination) {
          totalPages = response.meta.pagination.total_pages;
          currentPage++;
        } else {
          break;
        }
      } while (currentPage <= totalPages);

      return allServers;
    } catch (error) {
      this.handleError('getAllServers', error);
    }
  }

  async getServer(serverId: number): Promise<PterodactylServer> {
    try {
      const response: AxiosResponse<PterodactylServer> = await this.api.get(
        `/servers/${serverId}?include=allocations,user,subusers,nest,egg,variables,location,node,databases`
      );
      
      if (!response.data) {
        throw new Error(`Servidor ${serverId} não encontrado na API`);
      }
      
      return response.data;
    } catch (error) {
      this.handleError(`getServer(${serverId})`, error);
    }
  }

  async getServerByUuid(uuid: string): Promise<PterodactylServer> {
    try {
      const response: AxiosResponse<PterodactylServer> = await this.api.get(
        `/servers/external/${uuid}?include=allocations,user,subusers,nest,egg,variables,location,node,databases`
      );
      
      if (!response.data) {
        throw new Error(`Servidor com UUID ${uuid} não encontrado na API`);
      }
      
      return response.data;
    } catch (error) {
      this.handleError(`getServerByUuid(${uuid})`, error);
    }
  }

  async searchServersByName(name: string): Promise<PterodactylServer[]> {
    try {
      const allServers = await this.getAllServers();
      return allServers.filter(server => 
        server.attributes.name.toLowerCase().includes(name.toLowerCase())
      );
    } catch (error) {
      this.handleError(`searchServersByName(${name})`, error);
    }
  }

  async createServer(serverData: CreateServerRequest): Promise<PterodactylServer> {
    try {
      const response: AxiosResponse<PterodactylServer> = await this.api.post('/servers', serverData);
      
      if (!response.data) {
        throw new Error('Erro ao criar servidor: resposta da API está vazia');
      }
      
      return response.data;
    } catch (error) {
      this.handleError('createServer', error);
    }
  }

  async updateServer(serverId: number, updateData: Partial<CreateServerRequest>): Promise<PterodactylServer> {
    try {
      const response: AxiosResponse<PterodactylServer> = await this.api.patch(
        `/servers/${serverId}/details`, 
        updateData
      );
      
      if (!response.data) {
        throw new Error(`Erro ao atualizar servidor ${serverId}`);
      }
      
      return response.data;
    } catch (error) {
      this.handleError(`updateServer(${serverId})`, error);
    }
  }

  async updateServerBuild(serverId: number, buildData: {
    memory: number;
    swap: number;
    disk: number;
    io: number;
    cpu: number;
    threads?: string;
    feature_limits: {
      databases: number;
      allocations: number;
      backups: number;
    };
  }): Promise<PterodactylServer> {
    try {
      const response: AxiosResponse<PterodactylServer> = await this.api.patch(
        `/servers/${serverId}/build`, 
        buildData
      );
      
      if (!response.data) {
        throw new Error(`Erro ao atualizar build do servidor ${serverId}`);
      }
      
      return response.data;
    } catch (error) {
      this.handleError(`updateServerBuild(${serverId})`, error);
    }
  }

  async suspendServer(serverId: number): Promise<void> {
    try {
      await this.api.post(`/servers/${serverId}/suspend`);
    } catch (error) {
      this.handleError(`suspendServer(${serverId})`, error);
    }
  }

  async unsuspendServer(serverId: number): Promise<void> {
    try {
      await this.api.post(`/servers/${serverId}/unsuspend`);
    } catch (error) {
      this.handleError(`unsuspendServer(${serverId})`, error);
    }
  }

  async deleteServer(serverId: number, forceDelete: boolean = false): Promise<void> {
    try {
      const url = forceDelete ? `/servers/${serverId}/force` : `/servers/${serverId}`;
      await this.api.delete(url);
    } catch (error) {
      this.handleError(`deleteServer(${serverId}, force: ${forceDelete})`, error);
    }
  }

  async reinstallServer(serverId: number): Promise<void> {
    try {
      await this.api.post(`/servers/${serverId}/reinstall`);
    } catch (error) {
      this.handleError(`reinstallServer(${serverId})`, error);
    }
  }
}