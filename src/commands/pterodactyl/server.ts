import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../types/commands/Command';
import { CommandContext } from '../../types/commands/CommandContext';
import { MiClient } from '../../structures/MiClient';
import { logger } from '../../utils/logger';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ptero-server')
    .setDescription('Exibe detalhes de um servidor específico')
    .addIntegerOption(option =>
      option.setName('id')
        .setDescription('ID do servidor')
        .setRequired(true)
    ) as SlashCommandBuilder,

  options: {
    categoria: 'Sistema',
    type: 'SLASH',
    cooldown: 10,
    ownerOnly: true,
    guildOnly: true,
    visible: true,
    usage: 'ptero-server <id>',
    examples: ['ptero-server id:1', 'ptero-server id:42']
  },

  async execute(client: MiClient, context: CommandContext) {
    if (!client.pterodactyl) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Pterodactyl Indisponível')
        .setDescription('O cliente Pterodactyl não está configurado.')
        .setColor('#FF0000')
        .setTimestamp();

      if (context.isSlash) {
        await context.interaction!.reply({ embeds: [errorEmbed], ephemeral: true });
      }
      return;
    }

    if (context.isSlash && !context.interaction!.deferred) {
      await context.interaction!.deferReply();
    }

    try {
      const serverId = context.isSlash ? context.interaction!.options.getInteger('id', true) : 0;

      const [server, stats] = await Promise.allSettled([
        client.pterodactyl.servers.getServer(serverId),
        client.pterodactyl.stats.getServerStatsFormatted(serverId)
      ]);

      if (server.status === 'rejected') {
        throw new Error(`Servidor com ID ${serverId} não encontrado`);
      }

      const serverData = server.value;
      let statsData = null;
      let statusEmoji = '❓';
      let statusText = 'Desconhecido';

      if (stats.status === 'fulfilled') {
        statsData = stats.value;
        const state = statsData.status;
        
        switch (state) {
          case 'running':
            statusText = 'Online';
            statusEmoji = '🟢';
            break;
          case 'offline':
            statusText = 'Offline';
            statusEmoji = '🔴';
            break;
          case 'starting':
            statusText = 'Iniciando';
            statusEmoji = '🟡';
            break;
          case 'stopping':
            statusText = 'Parando';
            statusEmoji = '🟠';
            break;
          default:
            statusText = state;
            statusEmoji = '⚪';
        }
      }

      if (serverData.attributes.suspended) {
        statusText = 'Suspenso';
        statusEmoji = '⏸️';
      }

      const memoryGB = (serverData.attributes.limits.memory / 1024).toFixed(1);
      const diskGB = (serverData.attributes.limits.disk / 1024).toFixed(1);

      const embed = new EmbedBuilder()
        .setTitle(`${statusEmoji} ${serverData.attributes.name}`)
        .setColor(statusEmoji === '🟢' ? '#00FF88' : statusEmoji === '🔴' ? '#FF0000' : '#FFA500')
        .setDescription(serverData.attributes.description || 'Sem descrição')
        .addFields(
          {
            name: '📋 Informações Básicas',
            value: `**ID:** ${serverData.attributes.id}\n` +
                   `**UUID:** ${serverData.attributes.uuid}\n` +
                   `**Identificador:** ${serverData.attributes.identifier}\n` +
                   `**Status:** ${statusText}`,
            inline: true
          },
          {
            name: '💾 Limites de Recursos',
            value: `**Memória:** ${memoryGB}GB\n` +
                   `**Disco:** ${diskGB}GB\n` +
                   `**CPU:** ${serverData.attributes.limits.cpu}%\n` +
                   `**Swap:** ${serverData.attributes.limits.swap}MB`,
            inline: true
          },
          {
            name: '🎮 Limites de Features',
            value: `**Databases:** ${serverData.attributes.feature_limits.databases}\n` +
                   `**Allocations:** ${serverData.attributes.feature_limits.allocations}\n` +
                   `**Backups:** ${serverData.attributes.feature_limits.backups}`,
            inline: true
          }
        );

      if (statsData) {
        embed.addFields({
          name: '📊 Uso Atual de Recursos',
          value: `**Memória:** ${statsData.resources.memory.formatted.used} / ${statsData.resources.memory.formatted.limit} (${statsData.resources.memory.percentage}%)\n` +
                 `**CPU:** ${statsData.resources.cpu.percentage}% (${statsData.resources.cpu.usage.toFixed(1)}%)\n` +
                 `**Disco:** ${statsData.resources.disk.formatted.used} / ${statsData.resources.disk.formatted.limit} (${statsData.resources.disk.percentage}%)\n` +
                 `**Uptime:** ${statsData.resources.uptime.formatted}`,
          inline: false
        });

        embed.addFields({
          name: '🌐 Tráfego de Rede',
          value: `**Download:** ${statsData.resources.network.rx}\n` +
                 `**Upload:** ${statsData.resources.network.tx}`,
          inline: true
        });
      }

      embed.addFields(
        {
          name: '🏢 Infraestrutura',
          value: `**Node:** ${serverData.attributes.node}\n` +
                 `**Allocation:** ${serverData.attributes.allocation}\n` +
                 `**Nest:** ${serverData.attributes.nest}\n` +
                 `**Egg:** ${serverData.attributes.egg}`,
          inline: true
        },
        {
          name: '📅 Datas',
          value: `**Criado:** ${new Date(serverData.attributes.created_at).toLocaleString('pt-BR')}\n` +
                 `**Atualizado:** ${new Date(serverData.attributes.updated_at).toLocaleString('pt-BR')}`,
          inline: true
        }
      );

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`ptero_start_${serverId}`)
            .setLabel('Iniciar')
            .setStyle(ButtonStyle.Success)
            .setEmoji('▶️')
            .setDisabled(statusText === 'Online' || statusText === 'Iniciando' || statusText === 'Suspenso'),
          new ButtonBuilder()
            .setCustomId(`ptero_stop_${serverId}`)
            .setLabel('Parar')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⏹️')
            .setDisabled(statusText === 'Offline' || statusText === 'Parando' || statusText === 'Suspenso'),
          new ButtonBuilder()
            .setCustomId(`ptero_restart_${serverId}`)
            .setLabel('Reiniciar')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔄')
            .setDisabled(statusText === 'Offline' || statusText === 'Suspenso'),
          new ButtonBuilder()
            .setCustomId(`ptero_refresh_${serverId}`)
            .setLabel('Atualizar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔃')
        );

      embed.setFooter({ 
        text: `Painel: ${client.config.pterodactyl.url}`,
        iconURL: client.user?.displayAvatarURL()
      })
      .setTimestamp();

      if (context.isSlash) {
        await context.interaction!.editReply({ embeds: [embed], components: [row] });
      }

    } catch (error) {
      logger.error(`Erro no comando ptero-server: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erro')
        .setDescription(`Erro ao obter detalhes do servidor: ${errorMessage}`)
        .setColor('#FF0000')
        .setTimestamp();

      if (context.isSlash) {
        if (context.interaction!.deferred) {
          await context.interaction!.editReply({ embeds: [errorEmbed] });
        } else {
          await context.interaction!.reply({ embeds: [errorEmbed], ephemeral: true });
        }
      }
    }
  }
};

export default command;