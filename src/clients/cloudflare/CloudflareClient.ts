import { ZoneManager } from './ZoneManager';
import { DNSManager } from './DNSManager';
import { logger } from '../../utils/logger';

export interface CloudflareConfig {
  apiToken: string;
}

export class CloudflareClient {
  public zones: ZoneManager;
  public dns: DNSManager;

  private config: CloudflareConfig;

  constructor(config: CloudflareConfig) {
    this.config = config;
    
    this.zones = new ZoneManager(config.apiToken);
    this.dns = new DNSManager(config.apiToken);
  }

  async initialize(): Promise<void> {
    try {
      logger.info('[Cloudflare] Inicializando cliente...');
      
      try {
        const userInfo = await this.getUserInfo();
        logger.success(`[Cloudflare] Conectado como: ${userInfo.email}`);
      } catch (userError) {
        logger.warn('[Cloudflare] Token não tem permissão para acessar informações do usuário (isso é normal para alguns tipos de token)');
      }
      
      const zones = await this.zones.getZones();
      logger.success(`[Cloudflare] ${zones.length} zona(s) encontrada(s)`);
      
      if (zones.length > 0) {
        const zoneNames = zones.slice(0, 3).map(z => z.name).join(', ');
        logger.info(`[Cloudflare] Zonas disponíveis: ${zoneNames}${zones.length > 3 ? '...' : ''}`);
      }
      
      logger.success('[Cloudflare] Cliente inicializado com sucesso!');
    } catch (error) {
      logger.error(`[Cloudflare] Erro na inicialização: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getUserInfo(): Promise<any> {
    try {
      const userManager = new (class extends ZoneManager {
        async getUser() {
          return await this.cf.user.get();
        }
      })(this.config.apiToken);
      
      return await userManager.getUser();
    } catch (error) {
      logger.error(`[Cloudflare] Erro ao obter informações do usuário: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.zones.getZones();
      return true;
    } catch (error) {
      return false;
    }
  }

  getConfig(): CloudflareConfig {
    return { ...this.config };
  }
}