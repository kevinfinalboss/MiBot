import { PterodactylBaseClient } from './BaseClient';
import { ServerManager } from './ServerManager';
import { StatsManager } from './StatsManager';
import { PowerManager } from './PowerManager';
import { UserManager } from './UserManager';
import { NestManager } from './NestManager';
import { logger } from '../../utils/logger';

export class PterodactylClient extends PterodactylBaseClient {
  public servers: ServerManager;
  public stats: StatsManager;
  public power: PowerManager;
  public users: UserManager;
  public nests: NestManager;

  constructor(url: string, apiKey: string) {
    super(url, apiKey);
    
    this.servers = new ServerManager(url, apiKey);
    this.stats = new StatsManager(url, apiKey);
    this.power = new PowerManager(url, apiKey);
    this.users = new UserManager(url, apiKey);
    this.nests = new NestManager(url, apiKey);
  }

  async initialize(): Promise<boolean> {
    try {
      logger.info('[Pterodactyl] Testando conexão com o painel...');
      const isConnected = await this.testConnection();
      
      if (isConnected) {
        logger.success('[Pterodactyl] Conexão estabelecida com sucesso!');
        
        const serverCount = await this.getServerCount();
        const userCount = await this.getUserCount();
        
        logger.info(`[Pterodactyl] Painel conectado - ${serverCount} servidores, ${userCount} usuários`);
        return true;
      } else {
        logger.error('[Pterodactyl] Falha na conexão com o painel');
        return false;
      }
    } catch (error) {
      logger.error(`[Pterodactyl] Erro durante inicialização: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  async getServerCount(): Promise<number> {
    try {
      const response = await this.servers.getServers(1, 1);
      return response.meta?.pagination?.total || 0;
    } catch (error) {
      logger.error(`[Pterodactyl] Erro ao obter contagem de servidores: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }

  async getUserCount(): Promise<number> {
    try {
      const response = await this.users.getUsers(1, 1);
      return response.meta?.pagination?.total || 0;
    } catch (error) {
      logger.error(`[Pterodactyl] Erro ao obter contagem de usuários: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }

  async getSystemInfo(): Promise<{
    totalServers: number;
    totalUsers: number;
    onlineServers: number;
    suspendedServers: number;
    adminUsers: number;
  }> {
    try {
      const [allServers, allUsers] = await Promise.all([
        this.servers.getAllServers(),
        this.users.getAllUsers()
      ]);

      const serverStats = await Promise.allSettled(
        allServers.slice(0, 50).map(server => this.stats.getServerStats(server.attributes.id))
      );

      const onlineServers = serverStats.filter(result => 
        result.status === 'fulfilled' && result.value.attributes.current_state === 'running'
      ).length;

      const suspendedServers = allServers.filter(server => server.attributes.suspended).length;
      const adminUsers = allUsers.filter(user => user.attributes.admin).length;

      return {
        totalServers: allServers.length,
        totalUsers: allUsers.length,
        onlineServers,
        suspendedServers,
        adminUsers
      };
    } catch (error) {
      this.handleError('getSystemInfo', error);
    }
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      api: boolean;
      clientApi: boolean;
      responseTime: number;
    };
  }> {
    try {
      const startTime = Date.now();
      
      const [apiTest, clientApiTest] = await Promise.allSettled([
        this.api.get('/servers?per_page=1'),
        this.clientApi.get('/account')
      ]);

      const responseTime = Date.now() - startTime;
      
      const apiHealthy = apiTest.status === 'fulfilled';
      const clientApiHealthy = clientApiTest.status === 'fulfilled';

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (apiHealthy && clientApiHealthy) {
        status = responseTime > 5000 ? 'degraded' : 'healthy';
      } else if (apiHealthy || clientApiHealthy) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      return {
        status,
        details: {
          api: apiHealthy,
          clientApi: clientApiHealthy,
          responseTime
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          api: false,
          clientApi: false,
          responseTime: -1
        }
      };
    }
  }
}