import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
} from 'discord.js';
import { Command } from '../types/Command';
import { BotConfig } from '../types/Config';

import { LavalinkManager } from 'lavalink-client';

export class MiClient extends Client {
  public config: BotConfig;

  public commands = new Collection<string, Command>();
  public aliases = new Collection<string, string>();
  public cooldowns = new Collection<string, number>();

  public lavalink: LavalinkManager;

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

    const nodes = config.lavalink.nodes.map(node => ({
      id: node.id,
      host: node.host,
      port: node.port,
      secure: node.secure,
      authorization: node.password
    }));

    this.lavalink = new LavalinkManager({
      nodes,
      sendToShard: (id, payload) => {
        const guild = this.guilds.cache.get(id);
        if (guild) guild.shard.send(payload);
      },
      autoSkip: true,
      playerOptions: {
        volumeDecrementer: 0.75
      }
    });

    this.once('ready', async () => {
      await this.lavalink.init({
        id: this.user!.id,
        username: this.user!.tag
      });
      console.log(`[Lavalink] Conectado como ${this.user!.tag}`);
    });

    this.on('raw', (d) => {
      if(d.t === 'VOICE_SERVER_UPDATE' || d.t === 'VOICE_STATE_UPDATE') {
        this.lavalink.sendRawData(d);
      }
    });
  }

  public async start(): Promise<void> {
    await this.login(this.config.bot.token);
    console.log(`[MiBot] Logado como ${this.user?.tag}`);
  }
}
