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
      this.kubernetes = new KubernetesClient(config.kubernetes);
    } else {
      logger.warn('[Kubernetes] Configuração não encontrada - recursos do Kubernetes desabilitados');
    }

    this.once('ready', async () => {
      await this.lavalink.init({
        id: this.user!.id,
        username: this.user!.tag
      });
      logger.success('Lavalink conectado como ' + this.user!.tag);

      if (this.pterodactyl) {
        await this.pterodactyl.initialize();
      }

      if (this.cloudflare) {
        await this.cloudflare.initialize();
      }

      if (this.kubernetes) {
        await this.kubernetes.initialize();
      }
    });

    this.on('raw', (d) => {
      if(d.t === 'VOICE_SERVER_UPDATE' || d.t === 'VOICE_STATE_UPDATE') {
        this.lavalink.sendRawData(d);
      }
    });
  }

  public async start(): Promise<void> {
    logger.info('Iniciando login no Discord...');
    await this.login(this.config.bot.token);
    logger.success('Logado como ' + this.user?.tag);
  }
}