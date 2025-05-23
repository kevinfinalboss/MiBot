import { PterodactylBaseClient } from './BaseClient';

export type PowerAction = 'start' | 'stop' | 'restart' | 'kill';

export class PowerManager extends PterodactylBaseClient {

  async sendPowerAction(serverId: number, action: PowerAction): Promise<void> {
    try {
      const server = await this.getServerIdentifier(serverId);
      await this.clientApi.post(`/servers/${server.identifier}/power`, {
        signal: action
      });
    } catch (error) {
      this.handleError(`sendPowerAction(${serverId}, ${action})`, error);
    }
  }

  async startServer(serverId: number): Promise<void> {
    try {
      await this.sendPowerAction(serverId, 'start');
    } catch (error) {
      this.handleError(`startServer(${serverId})`, error);
    }
  }

  async stopServer(serverId: number): Promise<void> {
    try {
      await this.sendPowerAction(serverId, 'stop');
    } catch (error) {
      this.handleError(`stopServer(${serverId})`, error);
    }
  }

  async restartServer(serverId: number): Promise<void> {
    try {
      await this.sendPowerAction(serverId, 'restart');
    } catch (error) {
      this.handleError(`restartServer(${serverId})`, error);
    }
  }

  async killServer(serverId: number): Promise<void> {
    try {
      await this.sendPowerAction(serverId, 'kill');
    } catch (error) {
      this.handleError(`killServer(${serverId})`, error);
    }
  }

  async sendCommand(serverId: number, command: string): Promise<void> {
    try {
      const server = await this.getServerIdentifier(serverId);
      await this.clientApi.post(`/servers/${server.identifier}/command`, {
        command: command
      });
    } catch (error) {
      this.handleError(`sendCommand(${serverId}, ${command})`, error);
    }
  }

  async getServerStatus(serverId: number): Promise<string> {
    try {
      const server = await this.getServerIdentifier(serverId);
      const response = await this.clientApi.get(`/servers/${server.identifier}/resources`);
      return response.data.data.attributes.current_state;
    } catch (error) {
      this.handleError(`getServerStatus(${serverId})`, error);
    }
  }

  async waitForServerState(
    serverId: number, 
    targetState: string, 
    timeoutMs: number = 30000,
    checkIntervalMs: number = 2000
  ): Promise<boolean> {
    try {
      const startTime = Date.now();
      
      while (Date.now() - startTime < timeoutMs) {
        const currentState = await this.getServerStatus(serverId);
        
        if (currentState === targetState) {
          return true;
        }
        
        await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
      }
      
      return false;
    } catch (error) {
      this.handleError(`waitForServerState(${serverId}, ${targetState})`, error);
    }
  }

  async restartAndWait(serverId: number, timeoutMs: number = 60000): Promise<boolean> {
    try {
      await this.restartServer(serverId);
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const isOffline = await this.waitForServerState(serverId, 'offline', 30000);
      if (!isOffline) {
        await this.killServer(serverId);
        await this.waitForServerState(serverId, 'offline', 15000);
      }
      
      return await this.waitForServerState(serverId, 'running', timeoutMs);
    } catch (error) {
      this.handleError(`restartAndWait(${serverId})`, error);
    }
  }

  private async getServerIdentifier(serverId: number): Promise<{ identifier: string }> {
    try {
      const response = await this.api.get(`/servers/${serverId}`);
      return {
        identifier: response.data.data.attributes.identifier
      };
    } catch (error) {
      this.handleError(`getServerIdentifier(${serverId})`, error);
    }
  }
}