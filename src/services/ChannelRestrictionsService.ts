import { EmbedBuilder } from 'discord.js';
import { MiClient } from '../structures/MiClient';
import { GuildService } from './GuildService';
import { CommandContext } from '../types/commands/CommandContext';

export class ChannelRestrictionsService {
  private static instance: ChannelRestrictionsService;
  private guildService: GuildService;

  private constructor() {
    this.guildService = GuildService.getInstance();
  }

  public static getInstance(): ChannelRestrictionsService {
    if (!ChannelRestrictionsService.instance) {
      ChannelRestrictionsService.instance = new ChannelRestrictionsService();
    }
    return ChannelRestrictionsService.instance;
  }

  async checkCommandChannelRestriction(
    client: MiClient,
    context: CommandContext,
    commandName: string,
    categoria: string
  ): Promise<{ allowed: boolean; embed?: EmbedBuilder }> {
    if (!context.guildId) return { allowed: true };

    const guildData = await this.guildService.getGuildData(context.guildId);
    if (!guildData) return { allowed: true };

    const channels = guildData.channels;

    if (categoria === 'Música' || commandName === 'play') {
      if (channels.musicsChannelId && context.channelId !== channels.musicsChannelId) {
        const embed = new EmbedBuilder()
          .setTitle('🎵 Canal de Música Restrito')
          .setDescription(
            `**Comandos de música só podem ser usados no canal configurado!**\n\n` +
            `**📍 Canal de Música:** <#${channels.musicsChannelId}>\n` +
            `**⌨️ Comando:** \`${commandName}\`\n` +
            `**🎯 Vá para lá** para usar comandos de música.`
          )
          .setColor(0xFF6B6B)
          .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
          .setFooter({
            text: `Mi Bot • Canal de Música • ${context.isSlash ? context.interaction?.user.username : context.message?.author.username}`,
            iconURL: client.user?.displayAvatarURL() || undefined
          })
          .setTimestamp();

        return { allowed: false, embed };
      }
    } 
    else if (channels.commandsChannelId && context.channelId !== channels.commandsChannelId) {
      const embed = new EmbedBuilder()
        .setTitle('⌨️ Canal de Comandos Restrito')
        .setDescription(
          `**Este comando só pode ser usado no canal configurado!**\n\n` +
          `**📍 Canal de Comandos:** <#${channels.commandsChannelId}>\n` +
          `**⌨️ Comando:** \`${commandName}\`\n` +
          `**📂 Categoria:** ${categoria}`
        )
        .setColor(0xFF6B6B)
        .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
        .setFooter({
          text: `Mi Bot • Canal de Comandos • ${context.isSlash ? context.interaction?.user.username : context.message?.author.username}`,
          iconURL: client.user?.displayAvatarURL() || undefined
        })
        .setTimestamp();

      return { allowed: false, embed };
    }

    return { allowed: true };
  }

  async checkMusicChannelRestriction(
    client: MiClient,
    guildId: string,
    channelId: string,
    username: string
  ): Promise<{ allowed: boolean; embed?: EmbedBuilder }> {
    const guildData = await this.guildService.getGuildData(guildId);
    if (!guildData?.channels.musicsChannelId) return { allowed: true };

    if (channelId !== guildData.channels.musicsChannelId) {
      const embed = new EmbedBuilder()
        .setTitle('🎵 Canal de Música Restrito')
        .setDescription(
          `**Os comandos de música só podem ser usados no canal configurado!**\n\n` +
          `**📍 Canal de Música:** <#${guildData.channels.musicsChannelId}>\n` +
          `**🎯 Vá para lá** para usar comandos relacionados à música.`
        )
        .setColor(0xFF6B6B)
        .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
        .setFooter({
          text: `Mi Bot • Canal de Música • ${username}`,
          iconURL: client.user?.displayAvatarURL() || undefined
        })
        .setTimestamp();

      return { allowed: false, embed };
    }

    return { allowed: true };
  }

  async checkButtonMusicRestriction(
    client: MiClient,
    guildId: string,
    channelId: string,
    username: string,
    buttonId: string
  ): Promise<{ allowed: boolean; embed?: EmbedBuilder }> {
    const musicButtons = [
      'music_pause',
      'music_resume', 
      'music_skip',
      'music_stop',
      'music_queue'
    ];

    if (!musicButtons.includes(buttonId)) {
      return { allowed: true };
    }

    const guildData = await this.guildService.getGuildData(guildId);
    if (!guildData?.channels.musicsChannelId) return { allowed: true };

    if (channelId !== guildData.channels.musicsChannelId) {
      const buttonNames: Record<string, string> = {
        'music_pause': 'Pausar',
        'music_resume': 'Retomar',
        'music_skip': 'Pular',
        'music_stop': 'Parar',
        'music_queue': 'Fila'
      };

      const buttonName = buttonNames[buttonId] || 'Música';

      const embed = new EmbedBuilder()
        .setTitle('🎵 Botão de Música Restrito')
        .setDescription(
          `**Os botões de música só podem ser usados no canal configurado!**\n\n` +
          `**🔘 Botão:** ${buttonName}\n` +
          `**📍 Canal de Música:** <#${guildData.channels.musicsChannelId}>\n` +
          `**🎯 Vá para lá** para usar os controles de música.`
        )
        .setColor(0xFF6B6B)
        .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
        .setFooter({
          text: `Mi Bot • Controles de Música • ${username}`,
          iconURL: client.user?.displayAvatarURL() || undefined
        })
        .setTimestamp();

      return { allowed: false, embed };
    }

    return { allowed: true };
  }
}