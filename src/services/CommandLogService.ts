import { CommandLogRepository } from '../databases/repositories/CommandLogRepository';
import { CommandLog } from '../databases/schemas/CommandLogSchema';
import { CommandContext } from '../types/commands/CommandContext';
import { Command } from '../types/commands/Command';
import { MiClient } from '../structures/MiClient';

export class CommandLogService {
  private static instance: CommandLogService;
  private repository: CommandLogRepository;

  private constructor() {
    this.repository = CommandLogRepository.getInstance();
  }

  public static getInstance(): CommandLogService {
    if (!CommandLogService.instance) {
      CommandLogService.instance = new CommandLogService();
    }
    return CommandLogService.instance;
  }

  async logCommandExecution(
    client: MiClient,
    command: Command,
    context: CommandContext,
    success: boolean,
    executionTime: number,
    error?: Error
  ): Promise<void> {
    try {
      const user = context.interaction?.user || context.message?.author;
      if (!user) return;

      const guild = context.interaction?.guild || context.message?.guild;
      const channel = context.interaction?.channel || context.message?.channel;

      const commandLog: Omit<CommandLog, '_id'> = {
        commandName: context.interaction?.commandName || command.data?.name || 'unknown',
        commandType: command.options.type,
        userId: user.id,
        username: user.username,
        userTag: user.tag,
        guildId: guild?.id,
        guildName: guild?.name,
        channelId: context.channelId,
        channelType: this.getChannelType(channel),
        success,
        errorMessage: error?.message,
        executionTime,
        timestamp: new Date(),
        args: context.args || [],
        category: command.options.categoria,
        userPermissions: command.options.userPermissions,
        botPermissions: command.options.botPermissions,
        cooldownTime: command.options.cooldown,
        metadata: {
          memberRoles: context.member?.roles.cache.map(role => role.name) || [],
          memberJoinedAt: context.member?.joinedAt || undefined,
          guildMemberCount: guild?.memberCount,
          isOwner: client.config.bot.ownerIds.includes(user.id),
          isAdmin: context.member?.permissions.has('Administrator') || false,
          premium: false
        }
      };

      await this.repository.logCommand(commandLog);
    } catch (logError) {
      console.error('Erro ao registrar log do comando:', logError);
    }
  }

  private getChannelType(channel: any): string {
    if (!channel) return 'UNKNOWN';
    
    if (channel.type === 0) return 'GUILD_TEXT';
    if (channel.type === 1) return 'DM';
    if (channel.type === 2) return 'GUILD_VOICE';
    if (channel.type === 3) return 'GROUP_DM';
    if (channel.type === 4) return 'GUILD_CATEGORY';
    if (channel.type === 5) return 'GUILD_NEWS';
    if (channel.type === 10) return 'GUILD_NEWS_THREAD';
    if (channel.type === 11) return 'GUILD_PUBLIC_THREAD';
    if (channel.type === 12) return 'GUILD_PRIVATE_THREAD';
    if (channel.type === 13) return 'GUILD_STAGE_VOICE';
    if (channel.type === 15) return 'GUILD_FORUM';
    
    return 'UNKNOWN';
  }

  async getStats(userId?: string, guildId?: string, days: number = 30) {
    return await this.repository.getCommandStats(userId, guildId, days);
  }

  async getTopCommands(limit: number = 10, days: number = 30) {
    return await this.repository.getTopCommands(limit, days);
  }

  async getUserHistory(userId: string, limit: number = 50) {
    return await this.repository.getUserCommandHistory(userId, limit);
  }

  async getGuildHistory(guildId: string, limit: number = 100) {
    return await this.repository.getGuildCommandHistory(guildId, limit);
  }

  async getErrorLogs(days: number = 7) {
    return await this.repository.getErrorLogs(days);
  }
}