import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../../../types/commands/Command';
import { CommandContext } from '../../../types/commands/CommandContext';
import { MiClient } from '../../../structures/MiClient';
import { logger } from '../../../utils/logger';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ptero-info')
    .setDescription('Exibe informações do painel Pterodactyl'),

  options: {
    categoria: 'Sistema',
    type: 'SLASH',
    cooldown: 10,
    ownerOnly: true,
    guildOnly: true,
    visible: true,
    usage: 'ptero-info',
    examples: ['ptero-info']
  },

  async execute(client: MiClient, context: CommandContext) {
    if (!client.pterodactyl) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Pterodactyl Indisponível')
        .setDescription('O cliente Pterodactyl não está configurado ou não está funcionando.')
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
      const [systemInfo, healthCheck] = await Promise.all([
        client.pterodactyl.getSystemInfo(),
        client.pterodactyl.healthCheck()
      ]);

      const statusEmoji = {
        'healthy': '🟢',
        'degraded': '🟡',
        'unhealthy': '🔴'
      };

      const embed = new EmbedBuilder()
        .setTitle('🖥️ Informações do Painel Pterodactyl')
        .setColor(healthCheck.status === 'healthy' ? '#00FF00' : 
                  healthCheck.status === 'degraded' ? '#FFA500' : '#FF0000')
        .addFields(
          {
            name: '📊 Estatísticas Gerais',
            value: `**Servidores:** ${systemInfo.totalServers}\n` +
                   `**Usuários:** ${systemInfo.totalUsers}\n` +
                   `**Administradores:** ${systemInfo.adminUsers}`,
            inline: true
          },
          {
            name: '🔄 Status dos Servidores',
            value: `**Online:** ${systemInfo.onlineServers}\n` +
                   `**Suspensos:** ${systemInfo.suspendedServers}\n` +
                   `**Offline:** ${systemInfo.totalServers - systemInfo.onlineServers}`,
            inline: true
          },
          {
            name: `${statusEmoji[healthCheck.status]} Status da API`,
            value: `**Status:** ${healthCheck.status.toUpperCase()}\n` +
                   `**API Principal:** ${healthCheck.details.api ? '✅' : '❌'}\n` +
                   `**API Cliente:** ${healthCheck.details.clientApi ? '✅' : '❌'}\n` +
                   `**Tempo de Resposta:** ${healthCheck.details.responseTime}ms`,
            inline: false
          }
        )
        .setFooter({ 
          text: `Painel: ${client.config.pterodactyl.url}`,
          iconURL: client.user?.displayAvatarURL()
        })
        .setTimestamp();

      if (context.isSlash) {
        await context.interaction!.editReply({ embeds: [embed] });
      }

    } catch (error) {
      logger.error(`Erro no comando ptero-info: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erro')
        .setDescription('Ocorreu um erro ao obter informações do Pterodactyl.')
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