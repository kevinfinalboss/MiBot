import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../types/commands/Command';
import { CommandContext } from '../../types/commands/CommandContext';
import { MiClient } from '../../structures/MiClient';
import { GuildService } from '../../services/GuildService';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configurar canais específicos do servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  options: {
    categoria: 'Administração',
    guildOnly: true,
    adminOnly: true,
    type: 'SLASH',
    userPermissions: ['Administrator'],
    cooldown: 5,
    enabled: true,
    visible: true,
    usage: '/config',
    examples: ['/config']
  },

  async execute(client: MiClient, context: CommandContext) {
    if (!context.interaction || !context.guildId) return;

    const guildService = GuildService.getInstance();
    const guildData = await guildService.getGuildData(context.guildId);

    const currentChannels = guildData?.channels || {};

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Configurações do Servidor')
      .setDescription('**Gerencie os canais específicos do seu servidor**\n\nSelecione abaixo qual canal você deseja configurar:')
      .setColor(0x5865F2)
      .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
      .addFields([
        {
          name: '📥 Canal de Entrada',
          value: currentChannels.welcomeChannelId ? `<#${currentChannels.welcomeChannelId}>` : '`Não configurado`',
          inline: true
        },
        {
          name: '📤 Canal de Saída',
          value: currentChannels.leaveChannelId ? `<#${currentChannels.leaveChannelId}>` : '`Não configurado`',
          inline: true
        },
        {
          name: '⌨️ Canal de Comandos',
          value: currentChannels.commandsChannelId ? `<#${currentChannels.commandsChannelId}>` : '`Não configurado`',
          inline: true
        },
        {
          name: '🎵 Canal de Música',
          value: currentChannels.musicsChannelId ? `<#${currentChannels.musicsChannelId}>` : '`Não configurado`',
          inline: true
        },
        {
          name: '🛡️ Canal de Auditoria',
          value: currentChannels.auditChannelId ? `<#${currentChannels.auditChannelId}>` : '`Não configurado`',
          inline: true
        },
        {
          name: '📋 Canal de Logs',
          value: currentChannels.logsChannelId ? `<#${currentChannels.logsChannelId}>` : '`Não configurado`',
          inline: true
        }
      ])
      .setFooter({
        text: `Mi Bot • Solicitado por ${context.interaction.user.username}`,
        iconURL: client.user?.displayAvatarURL() || undefined
      })
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('config_channel_select')
      .setPlaceholder('Selecione um canal para configurar...')
      .addOptions([
        {
          label: 'Canal de Entrada',
          description: 'Configurar onde enviar mensagens de boas-vindas',
          value: 'welcome',
          emoji: '📥'
        },
        {
          label: 'Canal de Saída',
          description: 'Configurar onde enviar mensagens de despedida',
          value: 'leave',
          emoji: '📤'
        },
        {
          label: 'Canal de Comandos',
          description: 'Configurar canal específico para comandos',
          value: 'commands',
          emoji: '⌨️'
        },
        {
          label: 'Canal de Música',
          description: 'Configurar canal específico para comandos de música',
          value: 'music',
          emoji: '🎵'
        },
        {
          label: 'Canal de Auditoria',
          description: 'Configurar canal para logs de moderação',
          value: 'audit',
          emoji: '🛡️'
        },
        {
          label: 'Canal de Logs',
          description: 'Configurar canal para logs gerais do bot',
          value: 'logs',
          emoji: '📋'
        }
      ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(selectMenu);

    await context.interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }
};

export default command;