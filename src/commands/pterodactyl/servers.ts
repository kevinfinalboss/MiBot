import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../../types/commands/Command';
import { CommandContext } from '../../types/commands/CommandContext';
import { MiClient } from '../../structures/MiClient';
import { logger } from '../../utils/logger';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ptero-servers')
    .setDescription('Lista servidores do painel')
    .addStringOption(option =>
      option.setName('buscar')
        .setDescription('Buscar servidor por nome')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('status')
        .setDescription('Filtrar por status')
        .setRequired(false)
        .addChoices(
          { name: 'Online', value: 'running' },
          { name: 'Offline', value: 'offline' },
          { name: 'Suspenso', value: 'suspended' },
          { name: 'Todos', value: 'all' }
        )
    )
    .addIntegerOption(option =>
      option.setName('pagina')
        .setDescription('Página dos resultados (padrão: 1)')
        .setRequired(false)
        .setMinValue(1)
    ) as SlashCommandBuilder,

  options: {
    categoria: 'Sistema',
    type: 'SLASH',
    cooldown: 10,
    ownerOnly: true,
    guildOnly: true,
    visible: true,
    usage: 'ptero-servers [buscar] [status] [pagina]',
    examples: [
      'ptero-servers',
      'ptero-servers buscar:minecraft',
      'ptero-servers status:running',
      'ptero-servers buscar:pvp status:offline pagina:2'
    ]
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
      const buscar = context.isSlash ? context.interaction!.options.getString('buscar') : null;
      const statusFilter = context.isSlash ? context.interaction!.options.getString('status') || 'all' : 'all';
      const pagina = context.isSlash ? context.interaction!.options.getInteger('pagina') || 1 : 1;

      let servers;
      let title = '🖥️ Servidores do Painel';

      if (buscar) {
        servers = await client.pterodactyl.servers.searchServersByName(buscar);
        title += ` - Busca: "${buscar}"`;
      } else {
        const serversResponse = await client.pterodactyl.servers.getServers(pagina, 20);
        servers = serversResponse.data;
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'suspended') {
          servers = servers.filter(server => server.attributes.suspended);
        } else {
          const serverStats = await Promise.allSettled(
            servers.map(server => client.pterodactyl!.stats.getServerStats(server.attributes.id))
          );
          
          servers = servers.filter((server, index) => {
            const stat = serverStats[index];
            if (stat.status === 'fulfilled') {
              return stat.value.attributes.current_state === statusFilter;
            }
            return false;
          });
        }
        title += ` - Status: ${statusFilter}`;
      }

      if (servers.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription('Nenhum servidor encontrado com os filtros especificados.')
          .setColor('#FFA500')
          .setTimestamp();

        if (context.isSlash) {
          await context.interaction!.editReply({ embeds: [embed] });
        }
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor('#00FF88')
        .setDescription(`Encontrados ${servers.length} servidor(es):`)
        .setTimestamp();

      for (const server of servers.slice(0, 8)) {
        let statusText = '❓ Desconhecido';
        let statusEmoji = '⚪';

        try {
          const stats = await client.pterodactyl.stats.getServerStats(server.attributes.id);
          const state = stats.attributes.current_state;
          
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
        } catch (error) {
          statusText = 'Erro';
          statusEmoji = '❌';
        }

        if (server.attributes.suspended) {
          statusText = 'Suspenso';
          statusEmoji = '⏸️';
        }

        const memoryGB = (server.attributes.limits.memory / 1024).toFixed(1);
        const diskGB = (server.attributes.limits.disk / 1024).toFixed(1);

        embed.addFields({
          name: `${statusEmoji} ${server.attributes.name}`,
          value: `**ID:** ${server.attributes.id}\n` +
                 `**Status:** ${statusText}\n` +
                 `**Recursos:** ${memoryGB}GB RAM, ${diskGB}GB Disco\n` +
                 `**CPU:** ${server.attributes.limits.cpu}%\n` +
                 `**Node:** ${server.attributes.node}\n` +
                 `**Criado:** ${new Date(server.attributes.created_at).toLocaleDateString('pt-BR')}`,
          inline: true
        });
      }

      if (servers.length > 8) {
        embed.setFooter({ text: `... e mais ${servers.length - 8} servidor(es). Use filtros ou paginação para refinar.` });
      } else if (pagina > 1) {
        embed.setFooter({ text: `Página ${pagina}` });
      }

      if (context.isSlash) {
        await context.interaction!.editReply({ embeds: [embed] });
      }

    } catch (error) {
      logger.error(`Erro no comando ptero-servers: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erro')
        .setDescription('Ocorreu um erro ao listar os servidores.')
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