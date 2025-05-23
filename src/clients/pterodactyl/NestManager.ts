import { AxiosResponse } from 'axios';
import { PterodactylBaseClient } from './BaseClient';
import {
  PterodactylNest,
  PterodactylEgg,
  PterodactylNode,
  PterodactylAllocation,
  PterodactylApiResponse
} from '../../types/Pterodactyl';
import { logger } from '../../utils/logger';

export class NestManager extends PterodactylBaseClient {

  async getNests(): Promise<PterodactylApiResponse<PterodactylNest>> {
    try {
      const response: AxiosResponse<PterodactylApiResponse<PterodactylNest>> = await this.api.get('/nests?include=eggs');
      return response.data;
    } catch (error) {
      this.handleError('getNests', error);
    }
  }

  async getNest(nestId: number): Promise<PterodactylNest> {
    try {
      const response: AxiosResponse<{ data: PterodactylNest }> = await this.api.get(`/nests/${nestId}?include=eggs,servers`);
      return response.data.data;
    } catch (error) {
      this.handleError(`getNest(${nestId})`, error);
    }
  }

  async getEggs(nestId: number): Promise<PterodactylApiResponse<PterodactylEgg>> {
    try {
      const response: AxiosResponse<PterodactylApiResponse<PterodactylEgg>> = await this.api.get(`/nests/${nestId}/eggs?include=nest,variables`);
      return response.data;
    } catch (error) {
      this.handleError(`getEggs(${nestId})`, error);
    }
  }

  async getEgg(nestId: number, eggId: number): Promise<PterodactylEgg> {
    try {
      const response: AxiosResponse<{ data: PterodactylEgg }> = await this.api.get(`/nests/${nestId}/eggs/${eggId}?include=nest,variables`);
      return response.data.data;
    } catch (error) {
      this.handleError(`getEgg(${nestId}, ${eggId})`, error);
    }
  }

  async getEggById(eggId: number): Promise<PterodactylEgg | null> {
    try {
      const nestsResponse = await this.getNests();
      
      for (const nest of nestsResponse.data) {
        try {
          const eggsResponse = await this.getEggs(nest.attributes.id);
          const foundEgg = eggsResponse.data.find(egg => egg.attributes.id === eggId);
          if (foundEgg) {
            const fullEgg = await this.getEgg(nest.attributes.id, eggId);
            return fullEgg;
          }
        } catch (error) {
          continue;
        }
      }
      
      return null;
    } catch (error) {
      this.handleError(`getEggById(${eggId})`, error);
    }
  }

  async getAllEggs(): Promise<PterodactylEgg[]> {
    try {
      const nestsResponse = await this.getNests();
      const allEggs: PterodactylEgg[] = [];

      for (const nest of nestsResponse.data) {
        const eggsResponse = await this.getEggs(nest.attributes.id);
        allEggs.push(...eggsResponse.data);
      }

      return allEggs;
    } catch (error) {
      this.handleError('getAllEggs', error);
    }
  }

  async findEggByName(name: string): Promise<PterodactylEgg | null> {
    try {
      const allEggs = await this.getAllEggs();
      return allEggs.find(egg => 
        egg.attributes.name.toLowerCase().includes(name.toLowerCase())
      ) || null;
    } catch (error) {
      this.handleError(`findEggByName(${name})`, error);
    }
  }

  async getMinecraftEggs(): Promise<PterodactylEgg[]> {
    try {
      const allEggs = await this.getAllEggs();
      return allEggs.filter(egg => 
        egg.attributes.name.toLowerCase().includes('minecraft') ||
        egg.attributes.name.toLowerCase().includes('paper') ||
        egg.attributes.name.toLowerCase().includes('spigot') ||
        egg.attributes.name.toLowerCase().includes('bukkit') ||
        egg.attributes.name.toLowerCase().includes('forge') ||
        egg.attributes.name.toLowerCase().includes('fabric')
      );
    } catch (error) {
      this.handleError('getMinecraftEggs', error);
    }
  }

  async getTerrariaEggs(): Promise<PterodactylEgg[]> {
    try {
      const allEggs = await this.getAllEggs();
      
      const terrariaEggs = allEggs.filter(egg => 
        egg.attributes.nest === 5 || 
        egg.attributes.name.toLowerCase().includes('terraria')
      );
      
      logger.info(`[NEST-MANAGER] Encontrados ${terrariaEggs.length} eggs de Terraria`);
      
      return terrariaEggs;
    } catch (error) {
      this.handleError('getTerrariaEggs', error);
    }
  }

  async getRustEggs(): Promise<PterodactylEgg[]> {
    try {
      const allEggs = await this.getAllEggs();
      
      const rustEggs = allEggs.filter(egg => 
        egg.attributes.nest === 4 || 
        egg.attributes.name.toLowerCase().includes('rust')
      );
      
      logger.info(`[NEST-MANAGER] Encontrados ${rustEggs.length} eggs de Rust`);
      
      return rustEggs;
    } catch (error) {
      this.handleError('getRustEggs', error);
    }
  }

  async getSourceEngineEggs(): Promise<PterodactylEgg[]> {
    try {
      const allEggs = await this.getAllEggs();
      
      const sourceEggs = allEggs.filter(egg => 
        egg.attributes.nest === 2 ||
        egg.attributes.name.toLowerCase().includes('source') ||
        egg.attributes.name.toLowerCase().includes('tf2') ||
        egg.attributes.name.toLowerCase().includes('team fortress') ||
        egg.attributes.name.toLowerCase().includes('insurgency')
      );
      
      logger.info(`[NEST-MANAGER] Encontrados ${sourceEggs.length} eggs de Source Engine`);
      
      return sourceEggs;
    } catch (error) {
      this.handleError('getSourceEngineEggs', error);
    }
  }

  async getVoiceServerEggs(): Promise<PterodactylEgg[]> {
    try {
      const allEggs = await this.getAllEggs();
      
      const voiceEggs = allEggs.filter(egg => 
        egg.attributes.nest === 3 ||
        egg.attributes.name.toLowerCase().includes('mumble') ||
        egg.attributes.name.toLowerCase().includes('teamspeak') ||
        egg.attributes.name.toLowerCase().includes('ts3')
      );
      
      logger.info(`[NEST-MANAGER] Encontrados ${voiceEggs.length} eggs de Voice Server`);
      
      return voiceEggs;
    } catch (error) {
      this.handleError('getVoiceServerEggs', error);
    }
  }

  async getGameEggsByType(gameType: 'minecraft' | 'terraria' | 'rust' | 'source' | 'voice'): Promise<PterodactylEgg[]> {
    try {
      switch (gameType) {
        case 'minecraft':
          return await this.getMinecraftEggs();
        case 'terraria':
          return await this.getTerrariaEggs();
        case 'rust':
          return await this.getRustEggs();
        case 'source':
          return await this.getSourceEngineEggs();
        case 'voice':
          return await this.getVoiceServerEggs();
        default:
          return [];
      }
    } catch (error) {
      this.handleError(`getGameEggsByType(${gameType})`, error);
    }
  }

  async getNodes(): Promise<PterodactylApiResponse<PterodactylNode>> {
    try {
      const response: AxiosResponse<PterodactylApiResponse<PterodactylNode>> = await this.api.get('/nodes?include=allocations');
      return response.data;
    } catch (error) {
      this.handleError('getNodes', error);
    }
  }

  async getNode(nodeId: number): Promise<PterodactylNode> {
    try {
      const response: AxiosResponse<{ data: PterodactylNode }> = await this.api.get(`/nodes/${nodeId}?include=allocations`);
      return response.data.data;
    } catch (error) {
      this.handleError(`getNode(${nodeId})`, error);
    }
  }

  async getAvailableAllocations(nodeId: number): Promise<PterodactylAllocation[]> {
    try {
      const response: AxiosResponse<PterodactylApiResponse<PterodactylAllocation>> = await this.api.get(`/nodes/${nodeId}/allocations`);
      return response.data.data.filter(allocation => !allocation.attributes.assigned);
    } catch (error) {
      this.handleError(`getAvailableAllocations(${nodeId})`, error);
    }
  }

  async findBestNode(): Promise<PterodactylNode | null> {
    try {
      const nodesResponse = await this.getNodes();
      
      if (!nodesResponse || !nodesResponse.data || nodesResponse.data.length === 0) {
        return null;
      }
      
      const availableNodes = nodesResponse.data.filter(node => 
        node && node.attributes && !node.attributes.maintenance_mode
      );

      if (availableNodes.length === 0) return null;

      try {
        availableNodes.sort((a, b) => {
          const aUsage = (a.attributes.allocated_resources.memory / a.attributes.memory) + 
                        (a.attributes.allocated_resources.disk / a.attributes.disk);
          const bUsage = (b.attributes.allocated_resources.memory / b.attributes.memory) + 
                        (b.attributes.allocated_resources.disk / b.attributes.disk);
          return aUsage - bUsage;
        });
      } catch (sortError) {
        console.warn('Erro ao ordenar nodes, usando primeiro disponível');
      }

      return availableNodes[0];
    } catch (error) {
      this.handleError('findBestNode', error);
    }
  }

  async getNodeUsage(nodeId: number): Promise<{
    memory: { used: number; total: number; percentage: number };
    disk: { used: number; total: number; percentage: number };
    allocations: { used: number; total: number };
  }> {
    try {
      const node = await this.getNode(nodeId);
      if (!node || !node.attributes) {
        throw new Error(`Node ${nodeId} não encontrado ou dados inválidos`);
      }
      
      const allocations = node.attributes.relationships?.allocations?.data || [];
      
      const memoryPercentage = Math.round((node.attributes.allocated_resources.memory / node.attributes.memory) * 100);
      const diskPercentage = Math.round((node.attributes.allocated_resources.disk / node.attributes.disk) * 100);
      const usedAllocations = allocations.filter((alloc: PterodactylAllocation) => alloc.attributes.assigned).length;

      return {
        memory: {
          used: node.attributes.allocated_resources.memory,
          total: node.attributes.memory,
          percentage: memoryPercentage
        },
        disk: {
          used: node.attributes.allocated_resources.disk,
          total: node.attributes.disk,
          percentage: diskPercentage
        },
        allocations: {
          used: usedAllocations,
          total: allocations.length
        }
      };
    } catch (error) {
      this.handleError(`getNodeUsage(${nodeId})`, error);
    }
  }
}