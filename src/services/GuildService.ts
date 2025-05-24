import { Guild } from 'discord.js';
import { GuildRepository } from '../databases/repositories/GuildRepository';
import { GuildData } from '../databases/schemas/GuildSchema';
import { MiClient } from '../structures/MiClient';
import { logger } from '../utils/logger';

export class GuildService {
  private static instance: GuildService;
  private repository: GuildRepository;

  private constructor() {
    this.repository = GuildRepository.getInstance();
  }

  public static getInstance(): GuildService {
    if (!GuildService.instance) {
      GuildService.instance = new GuildService();
    }
    return GuildService.instance;
  }

  async syncGuild(guild: Guild): Promise<void> {
    try {
      const owner = await guild.fetchOwner().catch(() => null);
      
      const guildData: Omit<GuildData, '_id'> = {
        guildId: guild.id,
        name: guild.name,
        ownerId: guild.ownerId,
        ownerUsername: owner?.user.username || 'Unknown',
        memberCount: guild.memberCount,
        iconURL: guild.iconURL({ extension: 'png', size: 256 }) ?? undefined,
        bannerURL: guild.bannerURL({ extension: 'png', size: 1024 }) ?? undefined,
        description: guild.description ?? undefined,
        verificationLevel: guild.verificationLevel,
        premiumTier: guild.premiumTier,
        premiumSubscriptionCount: guild.premiumSubscriptionCount ?? undefined,
        features: guild.features,
        channelCount: guild.channels.cache.size,
        roleCount: guild.roles.cache.size,
        emojiCount: guild.emojis.cache.size,
        stickerCount: guild.stickers.cache.size,
        boostCount: guild.premiumSubscriptionCount || 0,
        
        channels: {
          auditChannelId: undefined,
          commandsChannelId: undefined,
          musicsChannelId: undefined,
          welcomeChannelId: undefined,
          leaveChannelId: undefined,
          logsChannelId: undefined,
          moderationChannelId: undefined,
        },
        
        settings: {
          prefix: 'mi!',
          language: 'pt-BR',
          timezone: 'America/Sao_Paulo',
          autoDeleteCommands: false,
          musicQueueLimit: 100,
          volumeLimit: 100,
          allowExplicitMusic: true,
          requireDjForMusic: false,
          enableLevelSystem: false,
          enableEconomy: false,
        },
        
        permissions: {},
        
        premium: {
          isActive: false,
          tier: 0,
          features: [],
        },
        
        stats: {
          commandsUsed: 0,
          songsPlayed: 0,
          messagesProcessed: 0,
          lastActiveAt: new Date(),
          topCommands: [],
        },
        
        joinedAt: guild.joinedAt || new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      const existingGuild = await this.repository.getGuild(guild.id);
      if (existingGuild) {
        guildData.channels = { ...guildData.channels, ...existingGuild.channels };
        guildData.settings = { ...guildData.settings, ...existingGuild.settings };
        guildData.permissions = existingGuild.permissions;
        guildData.premium = existingGuild.premium;
        guildData.stats = existingGuild.stats;
        guildData.joinedAt = existingGuild.joinedAt;
      }

      await this.repository.createOrUpdateGuild(guildData);
      logger.info(`Guild sincronizada: ${guild.name} (${guild.id})`);
    } catch (error) {
      logger.error(`Erro ao sincronizar guild ${guild.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async syncAllGuilds(client: MiClient): Promise<void> {
    try {
      logger.info(`Iniciando sincronização de ${client.guilds.cache.size} guilds...`);
      
      let syncedCount = 0;
      let errorCount = 0;

      for (const guild of client.guilds.cache.values()) {
        try {
          await this.syncGuild(guild);
          syncedCount++;
        } catch (error) {
          errorCount++;
          logger.error(`Erro ao sincronizar guild ${guild.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const dbGuilds = await this.repository.getAllActiveGuilds();
      const currentGuildIds = new Set(client.guilds.cache.keys());
      
      for (const dbGuild of dbGuilds) {
        if (!currentGuildIds.has(dbGuild.guildId)) {
          await this.repository.markAsLeft(dbGuild.guildId);
          logger.info(`Guild marcada como inativa: ${dbGuild.name} (${dbGuild.guildId})`);
        }
      }

      logger.info(`Sincronização concluída: ${syncedCount} guilds sincronizadas, ${errorCount} erros`);
    } catch (error) {
      logger.error(`Erro na sincronização geral de guilds: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async handleGuildJoin(guild: Guild): Promise<void> {
    await this.syncGuild(guild);
    
    try {
      const defaultChannel = guild.channels.cache.find(
        channel => 
          channel.isTextBased() && 
          !channel.isThread() &&
          channel.permissionsFor(guild.members.me!)?.has(['SendMessages', 'ViewChannel'])
      );
      
      if (defaultChannel && defaultChannel.isTextBased() && !defaultChannel.isThread()) {
        await defaultChannel.send({
          content: '🎉 **Olá! Obrigado por me adicionar ao servidor!**\n\n' +
                   '• Use `mi!help` para ver meus comandos\n' +
                   '• Use `/help` se preferir comandos slash\n' +
                   '• Configure canais específicos com `/config`\n\n' +
                   'Precisa de ajuda? Entre no meu servidor de suporte!'
        });
      }
    } catch (error) {
      logger.warn(`Não foi possível enviar mensagem de boas-vindas no servidor ${guild.name}`);
    }
  }

  async handleGuildLeave(guildId: string): Promise<void> {
    await this.repository.markAsLeft(guildId);
    logger.info(`Guild removida dos registros: ${guildId}`);
  }

  async getGuildData(guildId: string): Promise<GuildData | null> {
    return await this.repository.getGuild(guildId);
  }

  async updateGuildChannels(guildId: string, channels: Partial<GuildData['channels']>): Promise<void> {
    await this.repository.updateGuildChannels(guildId, channels);
  }

  async updateGuildSettings(guildId: string, settings: Partial<GuildData['settings']>): Promise<void> {
    await this.repository.updateGuildSettings(guildId, settings);
  }

  async incrementCommandUsage(guildId: string, commandName: string): Promise<void> {
    await this.repository.incrementCommandUsage(guildId, commandName);
  }

  async getGuildStats(): Promise<any> {
    return await this.repository.getGuildsStats();
  }

  async getTopGuilds(limit: number = 10): Promise<GuildData[]> {
    return await this.repository.getTopGuildsByMembers(limit);
  }

  async searchGuilds(query: string, limit: number = 20): Promise<GuildData[]> {
    return await this.repository.searchGuilds(query, limit);
  }
}