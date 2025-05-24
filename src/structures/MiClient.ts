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

  public lavalink: LavalinkManager;
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

    if (!config.lavalink.nodes || !Array.isArray(config.lavalink.nodes) || config.lavalink.nodes.length === 0) {
      throw new Error('É necessário configurar pelo menos um node Lavalink válido');
    }
        
    const lavalinkNodes = config.lavalink.nodes.map(node => {
      return {
        id: node.id,
        host: node.host,
        port: parseInt(String(node.port), 10),
        authorization: node.password,
        secure: node.secure
      };
    });
    
    logger.info('Inicializando LavalinkManager com ' + lavalinkNodes.length + ' nós');
        
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

    if (config.pterodactyl?.url && config.pterodactyl?.apiKey) {
      this.pterodactyl = new PterodactylClient(
        config.pterodactyl.url,
        config.pterodactyl.apiKey
      );
    } else {
      logger.warn('[Pterodactyl] Configuração não encontrada - recursos do Pterodactyl desabilitados');
    }

    if (config.cloudflare?.apiToken) {
      this.cloudflare = new CloudflareClient({
        apiToken: config.cloudflare.apiToken
      });
    } else {
      logger.warn('[Cloudflare] Configuração não encontrada - recursos do Cloudflare desabilitados');
    }

    if (config.kubernetes) {
      try {
        this.kubernetes = new KubernetesClient(config.kubernetes);
        logger.info('[Kubernetes] Cliente criado com sucesso');
      } catch (error) {
        logger.error('[Kubernetes] Erro ao criar cliente: ' + (error instanceof Error ? error.message : String(error)));
        logger.warn('[Kubernetes] Recursos do Kubernetes desabilitados devido ao erro');
        this.kubernetes = undefined;
      }
    } else {
      logger.warn('[Kubernetes] Configuração não encontrada - recursos do Kubernetes desabilitados');
    }

    this.once('ready', async () => {
      await this.database.connect();

      await this.lavalink.init({
        id: this.user!.id,
        username: this.user!.tag
      });
      logger.success('Lavalink conectado como ' + this.user!.tag);

      if (this.pterodactyl) {
        try {
          await this.pterodactyl.initialize();
        } catch (error) {
          logger.error('[Pterodactyl] Erro na inicialização: ' + (error instanceof Error ? error.message : String(error)));
          logger.warn('[Pterodactyl] Continuando sem recursos do Pterodactyl...');
          this.pterodactyl = undefined;
        }
      }

      if (this.cloudflare) {
        try {
          await this.cloudflare.initialize();
        } catch (error) {
          logger.error('[Cloudflare] Erro na inicialização: ' + (error instanceof Error ? error.message : String(error)));
          logger.warn('[Cloudflare] Continuando sem recursos do Cloudflare...');
          this.cloudflare = undefined;
        }
      }

      if (this.kubernetes) {
        try {
          await this.kubernetes.initialize();
        } catch (error) {
          logger.error('[Kubernetes] Erro na inicialização: ' + (error instanceof Error ? error.message : String(error)));
          logger.warn('[Kubernetes] Continuando sem recursos do Kubernetes...');
          this.kubernetes = undefined;
        }
      }
    });

    this.on('raw', (d) => {
      if(d.t === 'VOICE_SERVER_UPDATE' || d.t === 'VOICE_STATE_UPDATE') {
        this.lavalink.sendRawData(d);
      }
    });

    process.on('SIGINT', async () => {
      logger.info('[MiBot] Recebido SIGINT, desconectando do banco...');
      await this.database.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('[MiBot] Recebido SIGTERM, desconectando do banco...');
      await this.database.disconnect();
      process.exit(0);
    });
  }

  public async start(): Promise<void> {
    logger.info('Iniciando login no Discord...');
    await this.login(this.config.bot.token);
    logger.success('Logado como ' + this.user?.tag);
  }
}