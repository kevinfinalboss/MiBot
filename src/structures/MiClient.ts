import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
} from 'discord.js';
import { Command } from '../types/commands/Command';
import { BotConfig } from '../types/Config';
import { LavalinkManager } from 'lavalink-client';
import { PterodactylClient } from '../clients/pterodactyl/PterodactylClient';
import { CloudflareClient } from '../clients/cloudflare/CloudflareClient';
import { KubernetesClient } from '../clients/kubernetes/KubernetesClient';
import { DatabaseClient } from '../databases/MongoClient';
import { logger } from '../utils/logger';

export class MiClient extends Client {
  public config: BotConfig;

  public commands = new Collection<string, Command>();
  public aliases = new Collection<string, string>();
  public cooldowns = new Collection<string, number>();

  public lavalink!: LavalinkManager;
  public pterodactyl?: PterodactylClient;
  public cloudflare?: CloudflareClient;
  public kubernetes?: KubernetesClient;
  public database: DatabaseClient;

  constructor(config: BotConfig) {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction,
      ],
    });

    this.config = config;
    this.database = DatabaseClient.getInstance();
    this.setupLavalink();
    this.setupExternalClients();
    this.setupEventHandlers();
    this.setupProcessHandlers();
  }

  private setupLavalink(): void {
    if (!this.config.lavalink.nodes || !Array.isArray(this.config.lavalink.nodes) || this.config.lavalink.nodes.length === 0) {
      throw new Error('É necessário configurar pelo menos um node Lavalink válido');
    }
        
    const lavalinkNodes = this.config.lavalink.nodes.map(node => ({
      id: node.id,
      host: node.host,
      port: parseInt(String(node.port), 10),
      authorization: node.password,
      secure: node.secure
    }));
        
    this.lavalink = new LavalinkManager({
      nodes: lavalinkNodes,
      sendToShard: (id, payload) => {
        const guild = this.guilds.cache.get(id);
        if (guild) guild.shard.send(payload);
      },
      autoSkip: true,
      playerOptions: {
        volumeDecrementer: 0.75
      }
    });
  }

  private setupExternalClients(): void {
    this.setupPterodactyl();
    this.setupCloudflare();
    this.setupKubernetes();
  }

  private setupPterodactyl(): void {
    if (this.config.pterodactyl?.url && this.config.pterodactyl?.apiKey) {
      this.pterodactyl = new PterodactylClient(
        this.config.pterodactyl.url,
        this.config.pterodactyl.apiKey
      );
    }
  }

  private setupCloudflare(): void {
    if (this.config.cloudflare?.apiToken) {
      this.cloudflare = new CloudflareClient({
        apiToken: this.config.cloudflare.apiToken
      });
    }
  }

  private setupKubernetes(): void {
    if (this.config.kubernetes) {
      try {
        this.kubernetes = new KubernetesClient(this.config.kubernetes);
      } catch (error) {
        logger.error(`[Kubernetes] ❌ Erro ao criar cliente: ${error instanceof Error ? error.message : String(error)}`);
        this.kubernetes = undefined;
      }
    }
  }

  private setupEventHandlers(): void {
    this.once('ready', this.onReady.bind(this));
    this.on('raw', this.onRawData.bind(this));
  }

  private async onReady(): Promise<void> {
    await this.initializeLavalink();
    await this.initializeExternalServices();
  }

  private async initializeLavalink(): Promise<void> {
    try {
      await this.lavalink.init({
        id: this.user!.id,
        username: this.user!.tag
      });
    } catch (error) {
      logger.error(`[Lavalink] ❌ Erro na inicialização: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async initializeExternalServices(): Promise<void> {
    const services = [
      { name: 'Pterodactyl', client: this.pterodactyl },
      { name: 'Cloudflare', client: this.cloudflare },
      { name: 'Kubernetes', client: this.kubernetes }
    ];

    const results = await Promise.allSettled(
      services.map(async ({ name, client }) => {
        if (client) {
          await client.initialize();
          return { name, success: true };
        }
        return { name, success: false, reason: 'not configured' };
      })
    );

    let successCount = 0;
    let errorCount = 0;

    results.forEach((result, index) => {
      const serviceName = services[index].name;
      
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          successCount++;
        }
      } else {
        logger.error(`[${serviceName}] ❌ Erro na inicialização: ${result.reason}`);
        this.disableService(serviceName);
        errorCount++;
      }
    });

    if (errorCount > 0) {
      logger.warn(`[Serviços] ⚠️ ${successCount} serviços inicializados com ${errorCount} erros`);
    } else if (successCount > 0) {
      logger.info(`[Serviços] ✅ ${successCount} serviços externos inicializados`);
    }
  }

  private disableService(serviceName: string): void {
    switch (serviceName) {
      case 'Pterodactyl':
        this.pterodactyl = undefined;
        break;
      case 'Cloudflare':
        this.cloudflare = undefined;
        break;
      case 'Kubernetes':
        this.kubernetes = undefined;
        break;
    }
  }

  private onRawData(d: any): void {
    if (d.t === 'VOICE_SERVER_UPDATE' || d.t === 'VOICE_STATE_UPDATE') {
      this.lavalink.sendRawData(d);
    }
  }

  private setupProcessHandlers(): void {
    const gracefulShutdown = async (signal: string) => {
      logger.info(`[MiBot] Recebido ${signal}, finalizando...`);
      await this.database.disconnect();
      process.exit(0);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  }

  public async start(): Promise<void> {
    try {
      await this.database.connect();
      await this.login(this.config.bot.token);
      logger.info(`[MiBot] ✅ Bot inicializado como ${this.user?.tag}`);
    } catch (error) {
      logger.error(`[MiBot] ❌ Erro durante inicialização: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}