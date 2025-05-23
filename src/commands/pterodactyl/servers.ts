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
          { name: 'Instalando', value: 'installing' },
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

      logger.info(`[PTERO-SERVERS] Buscando servidores - buscar: ${buscar}, status: ${statusFilter}, pagina: ${pagina}`);

      let servers;
      let title = '🖥️ Servidores do Painel';

      if (buscar) {
        servers = await client.pterodactyl.servers.searchServersByName(buscar);
        logger.info(`[PTERO-SERVERS] Busca por nome retornou: ${servers.length} servidores`);
        title += ` - Busca: "${buscar}"`;
      } else {
        const serversResponse = await client.pterodactyl.servers.getServers(pagina, 20);
        logger.info(`[PTERO-SERVERS] API retornou: ${JSON.stringify(serversResponse, null, 2)}`);
        
        servers = serversResponse.data;
        logger.info(`[PTERO-SERVERS] Extraído ${servers.length} servidores da resposta`);
        
        if (servers.length > 0) {
          logger.info(`[PTERO-SERVERS] Primeiro servidor: ${JSON.stringify(servers[0], null, 2)}`);
        }
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'suspended') {
          servers = servers.filter(server => server.attributes.suspended);
        } else if (statusFilter === 'installing') {
          servers = servers.filter(server => 
            !server.attributes.container?.installed || 
            !server.attributes.container?.installed === false || 
            server.attributes.container?.installed === 0
          );
        } else {
          const serverStatsPromises = servers.map(async (server) => {
            try {
              const stats = await client.pterodactyl!.stats.getServerStats(server.attributes.id);
              return { serverId: server.attributes.id, state: stats.attributes.current_state };
            } catch (error) {
              return { serverId: server.attributes.id, state: 'unknown' };
            }
          });
          
          const serverStats = await Promise.all(serverStatsPromises);
          const statsMap = new Map(serverStats.map(s => [s.serverId, s.state]));
          
          servers = servers.filter(server => {
            const state = statsMap.get(server.attributes.id);
            return state === statusFilter;
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

        if (server.attributes.suspended) {
          statusText = 'Suspenso';
          statusEmoji = '⏸️';
        } else {
          const installed = server.attributes.container?.installed;
          if (installed === false || installed === 0 || installed === undefined) {
            statusText = 'Instalando';
            statusEmoji = '🔄';
          } else {
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
              statusText = 'Stats indisponíveis';
              statusEmoji = '⚠️';
            }
          }
        }

        const memoryGB = (server.attributes.limits.memory / 1024).toFixed(1);
        const diskGB = (server.attributes.limits.disk / 1024).toFixed(1);
        const cpuLimit = server.attributes.limits.cpu;

        let nodeInfo = 'N/A';
        let userInfo = 'N/A';
        let allocationInfo = 'N/A';
        
        try {
          if (server.attributes.relationships?.user?.data?.attributes) {
            const user = server.attributes.relationships.user.data.attributes;
            userInfo = `${user.first_name} ${user.last_name}`.trim() || user.email;
          }
          
          if (server.attributes.relationships?.node?.data?.attributes) {
            nodeInfo = server.attributes.relationships.node.data.attributes.name;
          } else {
            nodeInfo = `Node ${server.attributes.node}`;
          }

          if (server.attributes.relationships?.allocations?.data?.[0]?.attributes) {
            const alloc = server.attributes.relationships.allocations.data[0].attributes;
            allocationInfo = `${alloc.ip}:${alloc.port}`;
          }
        } catch (error) {
          logger.warn(`Erro ao obter relacionamentos do servidor ${server.attributes.id}: ${error}`);
        }

        const dockerImage = server.attributes.container?.image || 'N/A';
        const shortImage = dockerImage.includes('/') ? dockerImage.split('/').pop()?.split(':')[0] || dockerImage : dockerImage;

        embed.addFields({
          name: `${statusEmoji} ${server.attributes.name}`,
          value: `┌─ **ID:** \`${server.attributes.id}\` │ **Status:** ${statusText}\n` +
                 `├─ **👤 Proprietário:** ${userInfo}\n` +
                 `├─ **🌐 Endereço:** \`${allocationInfo}\`\n` +
                 `├─ **💾 Recursos:** ${memoryGB}GB RAM • ${diskGB}GB Disco • ${cpuLimit}% CPU\n` +
                 `├─ **🖥️ Node:** ${nodeInfo}\n` +
                 `├─ **🐳 Imagem:** \`${shortImage}\`\n` +
                 `└─ **📅 Criado:** ${new Date(server.attributes.created_at).toLocaleDateString('pt-BR')}`,
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