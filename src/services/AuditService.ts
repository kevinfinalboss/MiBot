import { EmbedBuilder, TextChannel } from 'discord.js';
import { MiClient } from '../structures/MiClient';
import { GuildService } from './GuildService';
import { logger } from '../utils/logger';

export class AuditService {
  private static instance: AuditService;
  private guildService: GuildService;

  private constructor() {
    this.guildService = GuildService.getInstance();
  }

  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  async logCommandExecution(
    client: MiClient,
    guildId: string,
    userId: string,
    username: string,
    commandName: string,
    commandType: 'SLASH' | 'PREFIX',
    success: boolean,
    executionTime: number,
    channelId: string,
    error?: string
  ): Promise<void> {
    try {
      const guildData = await this.guildService.getGuildData(guildId);
      if (!guildData?.channels.auditChannelId) return;

      const auditChannel = await client.channels.fetch(guildData.channels.auditChannelId).catch(() => null);
      if (!auditChannel || !(auditChannel instanceof TextChannel)) return;

      const embed = new EmbedBuilder()
        .setTitle('📋 Comando Executado')
        .setColor(success ? 0x00FF88 : 0xFF0000)
        .addFields([
          {
            name: '👤 Usuário',
            value: `<@${userId}> (\`${username}\`)`,
            inline: true
          },
          {
            name: '⌨️ Comando',
            value: `\`${commandType === 'SLASH' ? '/' : 'mi!'}${commandName}\``,
            inline: true
          },
          {
            name: '📍 Canal',
            value: `<#${channelId}>`,
            inline: true
          },
          {
            name: '✅ Status',
            value: success ? '✅ Sucesso' : '❌ Erro',
            inline: true
          },
          {
            name: '⏱️ Tempo',
            value: `${executionTime}ms`,
            inline: true
          },
          {
            name: '🕒 Horário',
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true
          }
        ])
        .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
        .setFooter({
          text: `Mi Bot • Auditoria de Comandos`,
          iconURL: client.user?.displayAvatarURL() || undefined
        })
        .setTimestamp();

      if (!success && error) {
        embed.addFields([
          {
            name: '❌ Erro',
            value: `\`\`\`\n${error.substring(0, 1000)}\n\`\`\``,
            inline: false
          }
        ]);
      }

      await auditChannel.send({ embeds: [embed] });
    } catch (auditError) {
      logger.error('Erro ao enviar log de auditoria:');
    }
  }

  async logButtonInteraction(
    client: MiClient,
    guildId: string,
    userId: string,
    username: string,
    buttonId: string,
    channelId: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      const guildData = await this.guildService.getGuildData(guildId);
      if (!guildData?.channels.auditChannelId) return;

      const auditChannel = await client.channels.fetch(guildData.channels.auditChannelId).catch(() => null);
      if (!auditChannel || !(auditChannel instanceof TextChannel)) return;

      const embed = new EmbedBuilder()
        .setTitle('🔘 Botão Acionado')
        .setColor(success ? 0x5865F2 : 0xFF0000)
        .addFields([
          {
            name: '👤 Usuário',
            value: `<@${userId}> (\`${username}\`)`,
            inline: true
          },
          {
            name: '🔘 Botão',
            value: `\`${buttonId}\``,
            inline: true
          },
          {
            name: '📍 Canal',
            value: `<#${channelId}>`,
            inline: true
          },
          {
            name: '✅ Status',
            value: success ? '✅ Sucesso' : '❌ Erro',
            inline: true
          },
          {
            name: '🕒 Horário',
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true
          }
        ])
        .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
        .setFooter({
          text: `Mi Bot • Auditoria de Interações`,
          iconURL: client.user?.displayAvatarURL() || undefined
        })
        .setTimestamp();

      if (!success && error) {
        embed.addFields([
          {
            name: '❌ Erro',
            value: `\`\`\`\n${error.substring(0, 1000)}\n\`\`\``,
            inline: false
          }
        ]);
      }

      await auditChannel.send({ embeds: [embed] });
    } catch (auditError) {
      logger.error('Erro ao enviar log de auditoria de botão:');
    }
  }

  async logMenuInteraction(
    client: MiClient,
    guildId: string,
    userId: string,
    username: string,
    menuId: string,
    selectedValues: string[],
    channelId: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      const guildData = await this.guildService.getGuildData(guildId);
      if (!guildData?.channels.auditChannelId) return;

      const auditChannel = await client.channels.fetch(guildData.channels.auditChannelId).catch(() => null);
      if (!auditChannel || !(auditChannel instanceof TextChannel)) return;

      const embed = new EmbedBuilder()
        .setTitle('📋 Menu Utilizado')
        .setColor(success ? 0x9F59FF : 0xFF0000)
        .addFields([
          {
            name: '👤 Usuário',
            value: `<@${userId}> (\`${username}\`)`,
            inline: true
          },
          {
            name: '📋 Menu',
            value: `\`${menuId}\``,
            inline: true
          },
          {
            name: '📍 Canal',
            value: `<#${channelId}>`,
            inline: true
          },
          {
            name: '🎯 Seleção',
            value: `\`${selectedValues.join(', ')}\``,
            inline: true
          },
          {
            name: '✅ Status',
            value: success ? '✅ Sucesso' : '❌ Erro',
            inline: true
          },
          {
            name: '🕒 Horário',
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true
          }
        ])
        .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
        .setFooter({
          text: `Mi Bot • Auditoria de Menus`,
          iconURL: client.user?.displayAvatarURL() || undefined
        })
        .setTimestamp();

      if (!success && error) {
        embed.addFields([
          {
            name: '❌ Erro',
            value: `\`\`\`\n${error.substring(0, 1000)}\n\`\`\``,
            inline: false
          }
        ]);
      }

      await auditChannel.send({ embeds: [embed] });
    } catch (auditError) {
      logger.error('Erro ao enviar log de auditoria de menu:');
    }
  }
}