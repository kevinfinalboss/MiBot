import { SlashCommandBuilder, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../../types/commands/Command';
import { CommandContext } from '../../../types/commands/CommandContext';
import { MiClient } from '../../../structures/MiClient';
import { CreateMinecraftServerRequest } from '../../../types/pterodactyl/Pterodactyl';
import { logger } from '../../../utils/logger';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ptero-create-minecraft')
    .setDescription('Cria um novo servidor de Minecraft')
    .addStringOption(option =>
      option.setName('nome')
        .setDescription('Nome do servidor')
        .setRequired(true)
        .setMaxLength(191)
    )
    .addStringOption(option =>
      option.setName('email')
        .setDescription('Email do proprietário do servidor')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption(option =>
      option.setName('memoria')
        .setDescription('Memória em MB (ex: 1024, 2048, 4096)')
        .setRequired(true)
        .setMinValue(512)
        .setMaxValue(32768)
    )
    .addIntegerOption(option =>
      option.setName('disco')
        .setDescription('Espaço em disco em MB (ex: 2048, 5120, 10240)')
        .setRequired(true)
        .setMinValue(1024)
        .setMaxValue(102400)
    )
    .addIntegerOption(option =>
      option.setName('cpu')
        .setDescription('Limite de CPU em % (ex: 100, 200, 400)')
        .setRequired(false)
        .setMinValue(50)
        .setMaxValue(800)
    )
    .addStringOption(option =>
      option.setName('versao')
        .setDescription('Versão do Minecraft (latest, 1.20.1, etc)')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName('tipo')
        .setDescription('Tipo de servidor Minecraft')
        .setRequired(false)
        .addChoices(
          { name: 'Paper (Recomendado)', value: 'paper' },
          { name: 'Vanilla', value: 'vanilla' },
          { name: 'Spigot', value: 'spigot' },
          { name: 'Bukkit', value: 'bukkit' }
        )
    )
    .addIntegerOption(option =>
      option.setName('egg-id')
        .setDescription('ID do egg específico (opcional)')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addIntegerOption(option =>
      option.setName('node-id')
        .setDescription('ID do node específico (opcional)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('descricao')
        .setDescription('Descrição do servidor')
        .setRequired(false)
        .setMaxLength(255)
    ) as SlashCommandBuilder,

  options: {
    categoria: 'Sistema',
    type: 'SLASH',
    cooldown: 30,
    ownerOnly: true,
    guildOnly: true,
    visible: true,
    usage: 'ptero-create-minecraft <nome> <email> <memoria> <disco>',
    examples: [
      'ptero-create-minecraft nome:"Meu Server" email:user@example.com memoria:2048 disco:5120',
      'ptero-create-minecraft nome:"PvP Server" email:admin@site.com memoria:4096 disco:10240 cpu:200 versao:1.20.1 tipo:paper'
    ]
  },

  async executeAutocomplete(client: MiClient, interaction: AutocompleteInteraction) {
    if (!client.pterodactyl) {
      await interaction.respond([]);
      return;
    }

    try {
      const focusedOption = interaction.options.getFocused(true);

      switch (focusedOption.name) {
        case 'email':
          await handleEmailAutocomplete(client, interaction, focusedOption.value);
          break;
        case 'versao':
          await handleVersionAutocomplete(interaction, focusedOption.value);
          break;
        case 'egg-id':
          await handleEggAutocomplete(client, interaction, focusedOption.value);
          break;
        default:
          await interaction.respond([]);
      }
    } catch (error) {
      logger.error(`Erro no autocomplete create-minecraft: ${error instanceof Error ? error.message : String(error)}`);
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
      const nome = context.isSlash ? context.interaction!.options.getString('nome', true) : '';
      const email = context.isSlash ? context.interaction!.options.getString('email', true) : '';
      const memoria = context.isSlash ? context.interaction!.options.getInteger('memoria', true) : 0;
      const disco = context.isSlash ? context.interaction!.options.getInteger('disco', true) : 0;
      const cpu = context.isSlash ? context.interaction!.options.getInteger('cpu') || 100 : 100;
      const versao = context.isSlash ? context.interaction!.options.getString('versao') || 'latest' : 'latest';
      const tipo = context.isSlash ? context.interaction!.options.getString('tipo') || 'paper' : 'paper';
      const eggId = context.isSlash ? context.interaction!.options.getInteger('egg-id') : null;
      const nodeId = context.isSlash ? context.interaction!.options.getInteger('node-id') : null;
      const descricao = context.isSlash ? context.interaction!.options.getString('descricao') || `Servidor Minecraft criado via Discord` : '';

      const loadingEmbed = new EmbedBuilder()
        .setTitle('⏳ Criando Servidor...')
        .setDescription(`Criando servidor **${nome}**...\nIsso pode levar alguns minutos.`)
        .setColor('#FFA500')
        .addFields(
          { name: '📝 Nome', value: nome, inline: true },
          { name: '💾 Memória', value: `${memoria} MB`, inline: true },
          { name: '💿 Disco', value: `${disco} MB`, inline: true },
          { name: '⚡ CPU', value: `${cpu}%`, inline: true },
          { name: '🎮 Tipo', value: tipo.toUpperCase(), inline: true },
          { name: '📦 Versão', value: versao, inline: true },
          { name: '🖥️ Node', value: nodeId ? `Node ID: ${nodeId}` : 'Selecionando automaticamente...', inline: true }
        )
        .setTimestamp();

      if (context.isSlash) {
        await context.interaction!.editReply({ embeds: [loadingEmbed] });
      }

      logger.info(`[CREATE-MINECRAFT] Iniciando criação do servidor: ${nome}`);

      let user = await client.pterodactyl.users.getUserByEmail(email);
      logger.info(`[CREATE-MINECRAFT] Usuário encontrado: ${user ? 'Sim' : 'Não'}`);
      
      if (!user) {
        const progressEmbed = new EmbedBuilder()
          .setTitle('👤 Criando Usuário...')
          .setDescription(`Usuário com email **${email}** não encontrado.\nCriando novo usuário...`)
          .setColor('#FFA500')
          .setTimestamp();

        if (context.isSlash) {
          await context.interaction!.editReply({ embeds: [progressEmbed] });
        }

        const username = email.split('@')[0] + Math.random().toString(36).substring(2, 6);
        user = await client.pterodactyl.users.createUser({
          username: username,
          email: email,
          first_name: 'Discord',
          last_name: 'User',
          admin: false
        });
      }

      if (!user || !user.attributes) {
        throw new Error('Erro ao obter ou criar usuário');
      }

      logger.info(`[CREATE-MINECRAFT] Usuário válido: ${user.attributes.email}`);

      let selectedEgg;
      if (eggId) {
        logger.info(`[CREATE-MINECRAFT] Buscando egg específico: ${eggId}`);
        try {
          const allEggs = await client.pterodactyl.nests.getAllEggs();
          selectedEgg = allEggs.find(egg => egg.attributes.id === eggId);
          
          if (!selectedEgg) {
            logger.error(`[CREATE-MINECRAFT] Egg ${eggId} não encontrado na lista de todos os eggs`);
            throw new Error(`Egg com ID ${eggId} não encontrado`);
          }
          
          logger.info(`[CREATE-MINECRAFT] Egg encontrado: ${selectedEgg.attributes.name}`);
        } catch (error) {
          logger.error(`[CREATE-MINECRAFT] Erro ao buscar egg ${eggId}: ${error instanceof Error ? error.message : String(error)}`);
          throw new Error(`Erro ao buscar egg com ID ${eggId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        logger.info(`[CREATE-MINECRAFT] Buscando eggs de Minecraft...`);
        const minecraftEggs = await client.pterodactyl.nests.getMinecraftEggs();
        logger.info(`[CREATE-MINECRAFT] Encontrados ${minecraftEggs.length} eggs de Minecraft`);
        
        if (minecraftEggs.length === 0) {
          throw new Error('Nenhum egg de Minecraft encontrado no painel');
        }

        selectedEgg = minecraftEggs.find(egg => 
          egg.attributes.name.toLowerCase().includes(tipo)
        ) || minecraftEggs[0];
      }

      if (!selectedEgg || !selectedEgg.attributes) {
        throw new Error('Erro ao obter informações do egg selecionado');
      }

      logger.info(`[CREATE-MINECRAFT] Egg selecionado: ${selectedEgg.attributes.name} (ID: ${selectedEgg.attributes.id})`);

      let selectedNode;
      if (nodeId) {
        logger.info(`[CREATE-MINECRAFT] Buscando node específico: ${nodeId}`);
        try {
          selectedNode = await client.pterodactyl.nests.getNode(nodeId);
        } catch (error) {
          throw new Error(`Node com ID ${nodeId} não encontrado`);
        }
      } else {
        logger.info(`[CREATE-MINECRAFT] Buscando melhor node disponível...`);
        selectedNode = await client.pterodactyl.nests.findBestNode();
        logger.info(`[CREATE-MINECRAFT] Resultado findBestNode: ${selectedNode ? 'Node encontrado' : 'Null retornado'}`);
        
        if (selectedNode) {
          logger.info(`[CREATE-MINECRAFT] Node retornado tem attributes: ${selectedNode.attributes ? 'Sim' : 'Não'}`);
          if (selectedNode.attributes) {
            logger.info(`[CREATE-MINECRAFT] Node attributes: id=${selectedNode.attributes.id}, name=${selectedNode.attributes.name}`);
          }
        }
        
        if (!selectedNode) {
          throw new Error('Nenhum node disponível encontrado');
        }
      }

      if (!selectedNode || !selectedNode.attributes) {
        throw new Error('Erro ao obter informações do node selecionado');
      }

      logger.info(`[CREATE-MINECRAFT] Node selecionado: ${selectedNode.attributes.name} (ID: ${selectedNode.attributes.id})`);

      const availableAllocations = await client.pterodactyl.nests.getAvailableAllocations(selectedNode.attributes.id);
      logger.info(`[CREATE-MINECRAFT] Allocations disponíveis: ${availableAllocations.length}`);
      
      if (availableAllocations.length === 0) {
        throw new Error(`Nenhuma alocação disponível no node ${selectedNode.attributes.name}`);
      }

      const allocation = availableAllocations[0];
      if (!allocation || !allocation.attributes) {
        throw new Error('Erro ao obter allocation disponível');
      }

      logger.info(`[CREATE-MINECRAFT] Allocation selecionada: ${allocation.attributes.ip}:${allocation.attributes.port}`);

      const dockerImages = selectedEgg.attributes.docker_images;
      if (!dockerImages || typeof dockerImages !== 'object') {
        throw new Error('Imagens Docker não encontradas para este egg');
      }

      const dockerImage = dockerImages['Java 21'] || dockerImages['Java 17'] || dockerImages['Java 8'] || Object.values(dockerImages)[0];
      if (!dockerImage) {
        throw new Error('Nenhuma imagem Docker válida encontrada para este egg');
      }

      logger.info(`[CREATE-MINECRAFT] Docker image selecionada: ${dockerImage}`);

      const eggVariables: Record<string, any> = {};
      if (selectedEgg.attributes.relationships?.variables?.data) {
        const variables = selectedEgg.attributes.relationships.variables.data;
        
        for (const variable of variables) {
          const envVar = variable.attributes.env_variable;
          const defaultValue = variable.attributes.default_value;
          
          switch (envVar) {
            case 'MINECRAFT_VERSION':
            case 'VANILLA_VERSION':
            case 'MC_VERSION':
            case 'VERSION':
              eggVariables[envVar] = versao;
              break;
            case 'SERVER_JARFILE':
            case 'JARFILE':
              eggVariables[envVar] = 'server.jar';
              break;
            case 'BUILD_NUMBER':
            case 'BUILD':
              eggVariables[envVar] = 'latest';
              break;
            case 'DL_PATH':
            case 'DOWNLOAD_PATH':
              eggVariables[envVar] = defaultValue || '';
              break;
            default:
              if (defaultValue) {
                eggVariables[envVar] = defaultValue;
              }
              break;
          }
        }
        
        logger.info(`[CREATE-MINECRAFT] Variáveis do egg configuradas: ${JSON.stringify(eggVariables)}`);
      } else {
        logger.warn(`[CREATE-MINECRAFT] Egg não possui variáveis definidas, usando padrões`);
        eggVariables.MINECRAFT_VERSION = versao;
        eggVariables.SERVER_JARFILE = 'server.jar';
        eggVariables.BUILD_NUMBER = 'latest';
      }

      const serverData: CreateMinecraftServerRequest = {
        name: nome,
        description: descricao,
        user: user.attributes.id,
        egg: selectedEgg.attributes.id,
        docker_image: dockerImage,
        startup: selectedEgg.attributes.startup,
        environment: eggVariables,
        limits: {
          memory: memoria,
          swap: 0,
          disk: disco,
          io: 500,
          cpu: cpu,
          oom_disabled: false
        },
        feature_limits: {
          databases: 1,
          allocations: 1,
          backups: 2
        },
        allocation: {
          default: allocation.attributes.id
        },
        start_on_completion: false,
        skip_scripts: false
      };

      const createdServer = await client.pterodactyl.servers.createServer(serverData);
      
      logger.info(`[CREATE-MINECRAFT] Resposta da criação: ${createdServer ? 'Objeto recebido' : 'Null/undefined'}`);
      
      if (createdServer) {
        logger.info(`[CREATE-MINECRAFT] Server attributes: ${createdServer.attributes ? 'Presentes' : 'Ausentes'}`);
      }

      if (!createdServer) {
        logger.warn(`[CREATE-MINECRAFT] Servidor criado (201) mas resposta vazia, buscando servidor mais recente...`);
        
        try {
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const serversResponse = await client.pterodactyl.servers.getServers(1, 10);
          const recentServer = serversResponse.data
            .sort((a, b) => new Date(b.attributes.created_at).getTime() - new Date(a.attributes.created_at).getTime())[0];
          
          if (recentServer && recentServer.attributes && recentServer.attributes.name === nome) {
            logger.info(`[CREATE-MINECRAFT] Servidor encontrado por nome: ${recentServer.attributes.name} (ID: ${recentServer.attributes.id})`);
            
            const successEmbed = new EmbedBuilder()
              .setTitle('✅ Servidor Criado com Sucesso!')
              .setColor('#00FF88')
              .setDescription(`Servidor **${nome}** foi criado e está sendo instalado.`)
              .addFields(
                { name: '🆔 ID do Servidor', value: `${recentServer.attributes.id}`, inline: true },
                { name: '🔗 UUID', value: recentServer.attributes.uuid, inline: true },
                { name: '👤 Proprietário', value: user.attributes.email, inline: true },
                { name: '🖥️ Node', value: `${selectedNode.attributes.name} (${nodeId ? 'Específico' : 'Auto-selecionado'})`, inline: true },
                { name: '🥚 Egg', value: selectedEgg.attributes.name, inline: true },
                { name: '💾 Recursos', value: `**RAM:** ${memoria}MB\n**Disco:** ${disco}MB\n**CPU:** ${cpu}%`, inline: true },
                { name: '🎮 Configuração', value: `**Tipo:** ${tipo.toUpperCase()}\n**Versão:** ${versao}\n**Java:** ${dockerImage.includes('21') ? '21' : dockerImage.includes('17') ? '17' : '8'}`, inline: true },
                { name: '📋 Status', value: 'Instalando... ⏳', inline: true }
              )
              .setFooter({ 
                text: `Use /ptero-server ${recentServer.attributes.id} para ver detalhes | Painel: ${client.config.pterodactyl.url}`,
                iconURL: client.user?.displayAvatarURL()
              })
              .setTimestamp();

            if (context.isSlash) {
              await context.interaction!.editReply({ embeds: [successEmbed] });
            }
            return;
          }
        } catch (searchError) {
          logger.error(`[CREATE-MINECRAFT] Erro ao buscar servidor criado: ${searchError instanceof Error ? searchError.message : String(searchError)}`);
        }
        
        const basicSuccessEmbed = new EmbedBuilder()
          .setTitle('✅ Servidor Provavelmente Criado!')
          .setColor('#FFA500')
          .setDescription(`O servidor **${nome}** foi criado (API retornou 201), mas não conseguimos obter os detalhes.\n\nUse \`/ptero-servers\` para verificar todos os servidores.`)
          .addFields(
            { name: '👤 Proprietário', value: user.attributes.email, inline: true },
            { name: '🖥️ Node', value: `${selectedNode.attributes.name} (${nodeId ? 'Específico' : 'Auto-selecionado'})`, inline: true },
            { name: '🥚 Egg', value: selectedEgg.attributes.name, inline: true },
            { name: '💾 Recursos', value: `**RAM:** ${memoria}MB\n**Disco:** ${disco}MB\n**CPU:** ${cpu}%`, inline: true },
            { name: '🎮 Configuração', value: `**Tipo:** ${tipo.toUpperCase()}\n**Versão:** ${versao}`, inline: true },
            { name: '📋 Próximos Passos', value: 'Verifique o painel em alguns minutos', inline: true }
          )
          .setFooter({ 
            text: `Painel: ${client.config.pterodactyl.url}`,
            iconURL: client.user?.displayAvatarURL()
          })
          .setTimestamp();

        if (context.isSlash) {
          await context.interaction!.editReply({ embeds: [basicSuccessEmbed] });
        }
        return;
      }

      const successEmbed = new EmbedBuilder()
        .setTitle('✅ Servidor Criado com Sucesso!')
        .setColor('#00FF88')
        .setDescription(`Servidor **${nome}** foi criado e está sendo instalado.`)
        .addFields(
          { name: '🆔 ID do Servidor', value: `${createdServer.attributes.id}`, inline: true },
          { name: '🔗 UUID', value: createdServer.attributes.uuid, inline: true },
          { name: '📍 Endereço', value: `${allocation.attributes.ip}:${allocation.attributes.port}`, inline: true },
          { name: '👤 Proprietário', value: user.attributes.email, inline: true },
          { name: '🖥️ Node', value: `${selectedNode.attributes.name} (${nodeId ? 'Específico' : 'Auto-selecionado'})`, inline: true },
          { name: '🥚 Egg', value: selectedEgg.attributes.name, inline: true },
          { name: '💾 Recursos', value: `**RAM:** ${memoria}MB\n**Disco:** ${disco}MB\n**CPU:** ${cpu}%`, inline: true },
          { name: '🎮 Configuração', value: `**Tipo:** ${tipo.toUpperCase()}\n**Versão:** ${versao}\n**Java:** ${dockerImage.includes('21') ? '21' : dockerImage.includes('17') ? '17' : '8'}`, inline: true },
          { name: '📋 Status', value: 'Instalando... ⏳', inline: true }
        )
        .setFooter({ 
          text: `Use /ptero-server ${createdServer.attributes.id} para ver detalhes | Painel: ${client.config.pterodactyl.url}`,
          iconURL: client.user?.displayAvatarURL()
        })
        .setTimestamp();

      if (context.isSlash) {
        await context.interaction!.editReply({ embeds: [successEmbed] });
      }

    } catch (error) {
      logger.error(`Erro no comando ptero-create-minecraft: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erro ao Criar Servidor')
        .setDescription(`Falha na criação do servidor: ${errorMessage}`)
        .setColor('#FF0000')
        .addFields({
          name: '💡 Possíveis Soluções',
          value: '• Verifique se o email é válido\n• Confirme se há recursos suficientes no painel\n• Tente usar um node específico\n• Verifique as permissões da API\n• Confirme se existem eggs de Minecraft disponíveis',
          inline: false
        })
        .addFields({
          name: '🔧 Informações de Debug',
          value: `**Erro:** ${errorMessage}\n**Timestamp:** ${new Date().toLocaleString('pt-BR')}`,
          inline: false
        })
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

async function handleEmailAutocomplete(client: MiClient, interaction: AutocompleteInteraction, query: string) {
  try {
    if (!query || query.length < 2) {
      await interaction.respond([
        { name: 'Digite pelo menos 2 caracteres...', value: 'placeholder' }
      ]);
      return;
    }

    const users = await client.pterodactyl!.users.searchUsers(query);
    const choices = users.slice(0, 10).map(user => ({
      name: `${user.attributes.email} (${user.attributes.first_name} ${user.attributes.last_name})`,
      value: user.attributes.email
    }));

    if (choices.length === 0) {
      choices.push({ name: `Criar novo usuário: ${query}`, value: query });
    }

    await interaction.respond(choices);
  } catch (error) {
    await interaction.respond([{ name: 'Erro ao buscar usuários', value: 'error' }]);
  }
}

async function handleVersionAutocomplete(interaction: AutocompleteInteraction, query: string) {
  const versions = [
    'latest',
    '1.21.5',
    '1.21.4',
    '1.21.3', 
    '1.21.1',
    '1.21',
    '1.20.6',
    '1.20.4',
    '1.20.2',
    '1.20.1',
    '1.20',
    '1.19.4',
    '1.19.2',
    '1.18.2',
    '1.17.1',
    '1.16.5',
    '1.12.2',
    '1.8.8'
  ];

  const filtered = versions.filter(version => 
    version.toLowerCase().includes(query.toLowerCase())
  );

  const choices = filtered.slice(0, 25).map(version => ({
    name: version === 'latest' ? 'latest (Mais recente)' : `Minecraft ${version}`,
    value: version
  }));

  await interaction.respond(choices);
}

async function handleEggAutocomplete(client: MiClient, interaction: AutocompleteInteraction, query: string) {
  try {
    const eggs = await client.pterodactyl!.nests.getMinecraftEggs();
    
    let filtered = eggs;
    if (query && query.length > 0) {
      filtered = eggs.filter(egg => 
        egg.attributes.name.toLowerCase().includes(query.toLowerCase()) ||
        egg.attributes.id.toString().includes(query)
      );
    }

    const choices = filtered.slice(0, 25).map(egg => ({
      name: `${egg.attributes.name} (ID: ${egg.attributes.id})`,
      value: egg.attributes.id
    }));

    if (choices.length === 0) {
      await interaction.respond([{ name: 'Nenhum egg encontrado', value: 0 }]);
    } else {
      await interaction.respond(choices);
    }
  } catch (error) {
    await interaction.respond([{ name: 'Erro ao buscar eggs', value: 0 }]);
  }
}

export default command;