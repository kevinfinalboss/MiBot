import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../../types/commands/Command';
import { CommandContext } from '../../../types/commands/CommandContext';
import { MiClient } from '../../../structures/MiClient';
import { logger } from '../../../utils/logger';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ptero-server')
    .setDescription('Exibe detalhes de um servidor específico')
    .addIntegerOption(option =>
      option.setName('id')
        .setDescription('ID do servidor')
        .setRequired(true)
        .setAutocomplete(true)
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

  async executeAutocomplete(client: MiClient, interaction: AutocompleteInteraction) {
    if (!client.pterodactyl) {
      await interaction.respond([]);
      return;
    }

    try {
      const query = interaction.options.getFocused().toString();
      const serversResponse = await client.pterodactyl.servers.getServers(1, 25);
      
      let filtered = serversResponse.data;
      if (query && query.length > 0) {
        filtered = serversResponse.data.filter(server => 
          server.attributes.id.toString().includes(query) ||
          server.attributes.name.toLowerCase().includes(query.toLowerCase())
        );
      }

      const choices = filtered.slice(0, 25).map(server => ({
        name: `${server.attributes.name} (ID: ${server.attributes.id})`,
        value: server.attributes.id
      }));

      await interaction.respond(choices);
    } catch (error) {
      logger.error(`Erro no autocomplete ptero-server: ${error instanceof Error ? error.message : String(error)}`);
      await interaction.respond([]);
    }
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

      logger.info(`[PTERO-SERVER] Buscando servidor ID: ${serverId}`);
      
      const server = await client.pterodactyl.servers.getServer(serverId);
      
      logger.info(`[PTERO-SERVER] Resposta da API: ${server ? 'Objeto recebido' : 'Null/undefined'}`);
      
      if (server) {
        logger.info(`[PTERO-SERVER] Server attributes: ${server.attributes ? 'Presentes' : 'Ausentes'}`);
        
        if (server.attributes) {
          logger.info(`[PTERO-SERVER] Server attributes keys: ${Object.keys(server.attributes)}`);
          logger.info(`[PTERO-SERVER] Server ID: ${server.attributes.id}, Nome: ${server.attributes.name}`);
        }
      }
      
      if (!server || !server.attributes) {
        logger.error(`[PTERO-SERVER] Dados inválidos - server: ${!!server}, attributes: ${!!server?.attributes}`);
        throw new Error(`Servidor com ID ${serverId} não encontrado ou dados inválidos`);
      }

      const serverData = server;
      let statsData = null;
      let statusEmoji = '❓';
      let statusText = 'Desconhecido';

      if (serverData.attributes.suspended) {
        statusText = 'Suspenso';
        statusEmoji = '⏸️';
      } else {
        const installed = serverData.attributes.container?.installed;
        if (!installed || installed === 0) {
          statusText = 'Instalando';
          statusEmoji = '🔄';
        } else {
          try {
            const stats = await client.pterodactyl.stats.getServerStatsFormatted(serverId);
            statsData = stats;
            const state = stats.status;
            
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
            logger.warn(`Erro ao obter stats do servidor ${serverId}: ${error instanceof Error ? error.message : String(error)}`);
            statusText = 'Stats indisponíveis';
            statusEmoji = '⚠️';
          }
        }
      }

      const memoryGB = (serverData.attributes.limits.memory / 1024).toFixed(1);
      const diskGB = (serverData.attributes.limits.disk / 1024).toFixed(1);

      let userInfo = 'N/A';
      let nodeInfo = 'N/A';
      let allocationInfo = 'N/A';
      let nestInfo = 'N/A';
      let eggInfo = 'N/A';

      try {
        if (serverData.attributes.relationships?.user?.data?.attributes) {
          const user = serverData.attributes.relationships.user.data.attributes;
          userInfo = `${user.first_name} ${user.last_name} (${user.email})`;
        }
        
        if (serverData.attributes.relationships?.node?.data?.attributes) {
          const node = serverData.attributes.relationships.node.data.attributes;
          nodeInfo = `${node.name} (${node.fqdn})`;
        } else {
          nodeInfo = `Node ${serverData.attributes.node}`;
        }

        if (serverData.attributes.relationships?.allocations?.data?.[0]?.attributes) {
          const allocation = serverData.attributes.relationships.allocations.data[0].attributes;
          allocationInfo = `${allocation.ip}:${allocation.port}`;
        }

        if (serverData.attributes.relationships?.nest?.data?.attributes) {
          nestInfo = serverData.attributes.relationships.nest.data.attributes.name;
        } else {
          nestInfo = `Nest ${serverData.attributes.nest}`;
        }

        if (serverData.attributes.relationships?.egg?.data?.attributes) {
          eggInfo = serverData.attributes.relationships.egg.data.attributes.name;
        } else {
          eggInfo = `Egg ${serverData.attributes.egg}`;
        }
      } catch (error) {
        logger.warn(`Erro ao processar relacionamentos: ${error instanceof Error ? error.message : String(error)}`);
      }

      const embed = new EmbedBuilder()
        .setTitle(`${statusEmoji} ${serverData.attributes.name}`)
        .setColor(statusEmoji === '🟢' ? '#00FF88' : statusEmoji === '🔴' ? '#FF0000' : statusEmoji === '🟡' ? '#FFFF00' : '#FFA500')
        .setDescription(`\`\`\`yaml\n${serverData.attributes.description || 'Sem descrição'}\n\`\`\``)
        .setThumbnail('https://cdn.jsdelivr.net/gh/devicons/devicon/icons/minecraft/minecraft-original.svg');

      embed.addFields(
        {
          name: '🔍 **Identificação**',
          value: `\`\`\`ini\n[ID]        = ${serverData.attributes.id}\n[UUID]      = ${serverData.attributes.uuid}\n[Identifier] = ${serverData.attributes.identifier}\n[Status]    = ${statusText}\`\`\``,
          inline: false
        },
        {
          name: '👤 **Proprietário**',
          value: `\`\`\`\n${userInfo}\`\`\``,
          inline: true
        },
        {
          name: '🌐 **Conexão**',
          value: `\`\`\`\n${allocationInfo}\`\`\``,
          inline: true
        },
        {
          name: '💾 **Limites de Recursos**',
          value: `\`\`\`yaml\nMemória: ${memoryGB} GB\nDisco:   ${diskGB} GB\nCPU:     ${serverData.attributes.limits.cpu}%\nSwap:    ${serverData.attributes.limits.swap} MB\nIO:      ${serverData.attributes.limits.io}\`\`\``,
          inline: true
        },
        {
          name: '🎮 **Limites de Features**',
          value: `\`\`\`yaml\nDatabases:   ${serverData.attributes.feature_limits.databases}\nAllocations: ${serverData.attributes.feature_limits.allocations}\nBackups:     ${serverData.attributes.feature_limits.backups}\`\`\``,
          inline: true
        }
      );

      if (statsData && statusText !== 'Instalando' && statusText !== 'Stats indisponíveis') {
        embed.addFields({
          name: '📊 **Uso Atual de Recursos**',
          value: `\`\`\`yaml\nMemória: ${statsData.resources.memory.formatted.used} / ${statsData.resources.memory.formatted.limit} (${statsData.resources.memory.percentage}%)\nCPU:     ${statsData.resources.cpu.percentage}% (${statsData.resources.cpu.usage.toFixed(1)}%)\nDisco:   ${statsData.resources.disk.formatted.used} / ${statsData.resources.disk.formatted.limit} (${statsData.resources.disk.percentage}%)\nUptime:  ${statsData.resources.uptime.formatted}\`\`\``,
          inline: false
        });

        embed.addFields({
          name: '🌐 **Tráfego de Rede**',
          value: `\`\`\`yaml\nDownload: ${statsData.resources.network.rx}\nUpload:   ${statsData.resources.network.tx}\`\`\``,
          inline: true
        });
      }

      embed.addFields(
        {
          name: '🏢 **Infraestrutura**',
          value: `\`\`\`yaml\nNode:       ${nodeInfo}\nAllocation: ${allocationInfo}\nNest:       ${nestInfo}\nEgg:        ${eggInfo}\`\`\``,
          inline: true
        },
        {
          name: '🐳 **Container**',
          value: `\`\`\`yaml\nImagem:    ${serverData.attributes.container?.image || 'N/A'}\nInstalado: ${(serverData.attributes.container?.installed === 1 || serverData.attributes.container?.installed === true) ? 'Sim' : 'Não'}\nOOM Kill:  ${serverData.attributes.limits.oom_disabled ? 'Desabilitado' : 'Habilitado'}\`\`\``,
          inline: true
        }
      );

      if (serverData.attributes.container?.startup_command) {
        const startupCommand = serverData.attributes.container.startup_command;
        const truncatedCommand = startupCommand.length > 150 ? 
          startupCommand.substring(0, 150) + '...' : startupCommand;
        
        embed.addFields({
          name: '🚀 **Comando de Inicialização**',
          value: `\`\`\`bash\n${truncatedCommand}\n\`\`\``,
          inline: false
        });
      }

      if (serverData.attributes.container?.environment) {
        const envVars = Object.entries(serverData.attributes.container.environment)
          .filter(([key]) => !key.startsWith('P_SERVER_'))
          .slice(0, 4)
          .map(([key, value]) => `${key} = ${value}`)
          .join('\n');
        
        if (envVars) {
          const totalVars = Object.keys(serverData.attributes.container.environment).length;
          const hiddenCount = totalVars - Object.entries(serverData.attributes.container.environment).filter(([key]) => !key.startsWith('P_SERVER_')).length;
          
          embed.addFields({
            name: '⚙️ **Variáveis de Ambiente**',
            value: `\`\`\`ini\n${envVars}\`\`\`` + (hiddenCount > 4 ? `\n*... e mais ${hiddenCount} variáveis*` : ''),
            inline: false
          });
        }
      }

      embed.addFields({
        name: '📅 **Datas**',
        value: `\`\`\`yaml\nCriado:     ${new Date(serverData.attributes.created_at).toLocaleString('pt-BR')}\nAtualizado: ${new Date(serverData.attributes.updated_at).toLocaleString('pt-BR')}\`\`\``,
        inline: false
      });

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`ptero_start_${serverId}`)
            .setLabel('Iniciar')
            .setStyle(ButtonStyle.Success)
            .setEmoji('▶️')
            .setDisabled(statusText === 'Online' || statusText === 'Iniciando' || statusText === 'Suspenso' || statusText === 'Instalando'),
          new ButtonBuilder()
            .setCustomId(`ptero_stop_${serverId}`)
            .setLabel('Parar')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⏹️')
            .setDisabled(statusText === 'Offline' || statusText === 'Parando' || statusText === 'Suspenso' || statusText === 'Instalando'),
          new ButtonBuilder()
            .setCustomId(`ptero_restart_${serverId}`)
            .setLabel('Reiniciar')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔄')
            .setDisabled(statusText === 'Offline' || statusText === 'Suspenso' || statusText === 'Instalando'),
          new ButtonBuilder()
            .setCustomId(`ptero_refresh_${serverId}`)
            .setLabel('Atualizar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔃')
        );

      embed.setFooter({ 
        text: `Painel Pterodactyl • ${client.config.pterodactyl.url}`,
        iconURL: 'https://cdn.jsdelivr.net/gh/pterodactyl/panel@develop/public/favicons/android-icon-192x192.png'
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