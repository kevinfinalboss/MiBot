import { SlashCommandBuilder, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../../types/commands/Command';
import { CommandContext } from '../../../types/commands/CommandContext';
import { MiClient } from '../../../structures/MiClient';
import { CreateServerRequest } from '../../../types/cloudflare/Pterodactyl';
import { logger } from '../../../utils/logger';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ptero-create-terraria')
    .setDescription('Cria um novo servidor de Terraria')
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
        .setDescription('Memória em MB (ex: 512, 1024, 2048)')
        .setRequired(true)
        .setMinValue(512)
        .setMaxValue(8192)
    )
    .addIntegerOption(option =>
      option.setName('disco')
        .setDescription('Espaço em disco em MB (ex: 1024, 2048, 5120)')
        .setRequired(true)
        .setMinValue(1024)
        .setMaxValue(51200)
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
        .setDescription('Versão do Terraria (latest, 1.4.4.9, etc)')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName('mundo-nome')
        .setDescription('Nome do mundo (padrão: world)')
        .setRequired(false)
        .setMaxLength(20)
    )
    .addIntegerOption(option =>
      option.setName('mundo-tamanho')
        .setDescription('Tamanho do mundo')
        .setRequired(false)
        .addChoices(
          { name: 'Pequeno', value: 1 },
          { name: 'Médio', value: 2 },
          { name: 'Grande', value: 3 }
        )
    )
    .addIntegerOption(option =>
      option.setName('dificuldade')
        .setDescription('Dificuldade do mundo')
        .setRequired(false)
        .addChoices(
          { name: 'Normal', value: 0 },
          { name: 'Expert', value: 1 },
          { name: 'Master', value: 2 },
          { name: 'Journey', value: 3 }
        )
    )
    .addIntegerOption(option =>
      option.setName('max-jogadores')
        .setDescription('Máximo de jogadores (padrão: 8)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(255)
    )
    .addStringOption(option =>
      option.setName('motd')
        .setDescription('Mensagem do dia (MOTD)')
        .setRequired(false)
        .setMaxLength(128)
    )
    .addStringOption(option =>
      option.setName('senha')
        .setDescription('Senha do servidor (opcional)')
        .setRequired(false)
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
    usage: 'ptero-create-terraria <nome> <email> <memoria> <disco>',
    examples: [
      'ptero-create-terraria nome:"Meu Terraria" email:user@example.com memoria:1024 disco:2048',
      'ptero-create-terraria nome:"PvP Server" email:admin@site.com memoria:2048 disco:5120 max-jogadores:16'
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
        default:
          await interaction.respond([]);
      }
    } catch (error) {
      logger.error(`Erro no autocomplete create-terraria: ${error instanceof Error ? error.message : String(error)}`);
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
      const mundoNome = context.isSlash ? context.interaction!.options.getString('mundo-nome') || 'world' : 'world';
      const mundoTamanho = context.isSlash ? context.interaction!.options.getInteger('mundo-tamanho') || 2 : 2;
      const dificuldade = context.isSlash ? context.interaction!.options.getInteger('dificuldade') || 0 : 0;
      const maxJogadores = context.isSlash ? context.interaction!.options.getInteger('max-jogadores') || 8 : 8;
      const motd = context.isSlash ? context.interaction!.options.getString('motd') || 'Welcome!' : 'Welcome!';
      const senha = context.isSlash ? context.interaction!.options.getString('senha') || '' : '';
      const nodeId = context.isSlash ? context.interaction!.options.getInteger('node-id') : null;
      const descricao = context.isSlash ? context.interaction!.options.getString('descricao') || `Servidor Terraria criado via Discord` : '';

      const loadingEmbed = new EmbedBuilder()
        .setTitle('⏳ Criando Servidor...')
        .setDescription(`Criando servidor **${nome}**...\nIsso pode levar alguns minutos.`)
        .setColor('#8B4513')
        .addFields(
          { name: '📝 Nome', value: nome, inline: true },
          { name: '💾 Memória', value: `${memoria} MB`, inline: true },
          { name: '💿 Disco', value: `${disco} MB`, inline: true },
          { name: '⚡ CPU', value: `${cpu}%`, inline: true },
          { name: '🎮 Versão', value: versao, inline: true },
          { name: '🌍 Mundo', value: `${mundoNome} (Tamanho: ${mundoTamanho})`, inline: true },
          { name: '🎯 Dificuldade', value: ['Normal', 'Expert', 'Master', 'Journey'][dificuldade], inline: true },
          { name: '👥 Max Jogadores', value: maxJogadores.toString(), inline: true },
          { name: '🖥️ Node', value: nodeId ? `Node ID: ${nodeId}` : 'Selecionando automaticamente...', inline: true }
        )
        .setTimestamp();

      if (context.isSlash) {
        await context.interaction!.editReply({ embeds: [loadingEmbed] });
      }

      logger.info(`[CREATE-TERRARIA] Iniciando criação do servidor: ${nome}`);

      let user = await client.pterodactyl.users.getUserByEmail(email);
      logger.info(`[CREATE-TERRARIA] Usuário encontrado: ${user ? 'Sim' : 'Não'}`);
      
      if (!user) {
        const progressEmbed = new EmbedBuilder()
          .setTitle('👤 Criando Usuário...')
          .setDescription(`Usuário com email **${email}** não encontrado.\nCriando novo usuário...`)
          .setColor('#8B4513')
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

      logger.info(`[CREATE-TERRARIA] Usuário válido: ${user.attributes.email}`);

      logger.info(`[CREATE-TERRARIA] Buscando eggs de Terraria...`);
      const terrariaEggs = await client.pterodactyl.nests.getTerrariaEggs();
      logger.info(`[CREATE-TERRARIA] Encontrados ${terrariaEggs.length} eggs de Terraria`);
      
      if (terrariaEggs.length === 0) {
        throw new Error('Nenhum egg de Terraria encontrado no painel');
      }

      const selectedEgg = terrariaEggs[0];

      if (!selectedEgg || !selectedEgg.attributes) {
        throw new Error('Erro ao obter informações do egg selecionado');
      }

      logger.info(`[CREATE-TERRARIA] Egg selecionado: ${selectedEgg.attributes.name} (ID: ${selectedEgg.attributes.id})`);

      let selectedNode;
      if (nodeId) {
        logger.info(`[CREATE-TERRARIA] Buscando node específico: ${nodeId}`);
        try {
          selectedNode = await client.pterodactyl.nests.getNode(nodeId);
        } catch (error) {
          throw new Error(`Node com ID ${nodeId} não encontrado`);
        }
      } else {
        logger.info(`[CREATE-TERRARIA] Buscando melhor node disponível...`);
        selectedNode = await client.pterodactyl.nests.findBestNode();
        
        if (!selectedNode) {
          throw new Error('Nenhum node disponível encontrado');
        }
      }

      if (!selectedNode || !selectedNode.attributes) {
        throw new Error('Erro ao obter informações do node selecionado');
      }

      logger.info(`[CREATE-TERRARIA] Node selecionado: ${selectedNode.attributes.name} (ID: ${selectedNode.attributes.id})`);

      const availableAllocations = await client.pterodactyl.nests.getAvailableAllocations(selectedNode.attributes.id);
      logger.info(`[CREATE-TERRARIA] Allocations disponíveis: ${availableAllocations.length}`);
      
      if (availableAllocations.length === 0) {
        throw new Error(`Nenhuma alocação disponível no node ${selectedNode.attributes.name}`);
      }

      const allocation = availableAllocations[0];
      if (!allocation || !allocation.attributes) {
        throw new Error('Erro ao obter allocation disponível');
      }

      logger.info(`[CREATE-TERRARIA] Allocation selecionada: ${allocation.attributes.ip}:${allocation.attributes.port}`);

      const dockerImages = selectedEgg.attributes.docker_images;
      if (!dockerImages || typeof dockerImages !== 'object') {
        throw new Error('Imagens Docker não encontradas para este egg');
      }

      const dockerImage = dockerImages['Debian'] || Object.values(dockerImages)[0];
      if (!dockerImage) {
        throw new Error('Nenhuma imagem Docker válida encontrada para este egg');
      }

      logger.info(`[CREATE-TERRARIA] Docker image selecionada: ${dockerImage}`);

      const eggVariables: Record<string, any> = {
        TERRARIA_VERSION: versao,
        WORLD_NAME: mundoNome,
        MAX_PLAYERS: maxJogadores.toString(),
        WORLD_SIZE: mundoTamanho.toString(),
        WORLD_DIFFICULTY: dificuldade.toString(),
        SERVER_MOTD: motd,
        WORLD_SEED: '',
        PASSWORD: senha,
        NPCSTREAM: '0'
      };

      if (selectedEgg.attributes.relationships?.variables?.data) {
        const variables = selectedEgg.attributes.relationships.variables.data;
        
        for (const variable of variables) {
          const envVar = variable.attributes.env_variable;
          const defaultValue = variable.attributes.default_value;
          
          if (!eggVariables[envVar] && defaultValue) {
            eggVariables[envVar] = defaultValue;
          }
        }
        
        logger.info(`[CREATE-TERRARIA] Variáveis do egg configuradas: ${JSON.stringify(eggVariables)}`);
      }

      const serverData: CreateServerRequest = {
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
          databases: 0,
          allocations: 1,
          backups: 1
        },
        allocation: {
          default: allocation.attributes.id
        },
        start_on_completion: false,
        skip_scripts: false
      };

      const createdServer = await client.pterodactyl.servers.createServer(serverData);
      
      logger.info(`[CREATE-TERRARIA] Resposta da criação: ${createdServer ? 'Objeto recebido' : 'Null/undefined'}`);
      
      if (createdServer) {
        logger.info(`[CREATE-TERRARIA] Server attributes: ${createdServer.attributes ? 'Presentes' : 'Ausentes'}`);
      }

      if (!createdServer) {
        logger.warn(`[CREATE-TERRARIA] Servidor criado (201) mas resposta vazia, buscando servidor mais recente...`);
        
        try {
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const serversResponse = await client.pterodactyl.servers.getServers(1, 10);
          const recentServer = serversResponse.data
            .sort((a, b) => new Date(b.attributes.created_at).getTime() - new Date(a.attributes.created_at).getTime())[0];
          
          if (recentServer && recentServer.attributes && recentServer.attributes.name === nome) {
            logger.info(`[CREATE-TERRARIA] Servidor encontrado por nome: ${recentServer.attributes.name} (ID: ${recentServer.attributes.id})`);
            
            const successEmbed = new EmbedBuilder()
              .setTitle('✅ Servidor Criado com Sucesso!')
              .setColor('#8B4513')
              .setDescription(`Servidor **${nome}** foi criado e está sendo instalado.`)
              .addFields(
                { name: '🆔 ID do Servidor', value: `${recentServer.attributes.id}`, inline: true },
                { name: '🔗 UUID', value: recentServer.attributes.uuid, inline: true },
                { name: '👤 Proprietário', value: user.attributes.email, inline: true },
                { name: '🖥️ Node', value: `${selectedNode.attributes.name} (${nodeId ? 'Específico' : 'Auto-selecionado'})`, inline: true },
                { name: '🥚 Egg', value: selectedEgg.attributes.name, inline: true },
                { name: '💾 Recursos', value: `**RAM:** ${memoria}MB\n**Disco:** ${disco}MB\n**CPU:** ${cpu}%`, inline: true },
                { name: '🎮 Configuração', value: `**Versão:** ${versao}\n**Mundo:** ${mundoNome}\n**Max Jogadores:** ${maxJogadores}\n**Dificuldade:** ${['Normal', 'Expert', 'Master', 'Journey'][dificuldade]}`, inline: true },
                { name: '🌐 Conexão', value: `**IP:** ${allocation.attributes.ip}\n**Porta:** ${allocation.attributes.port}`, inline: true },
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
          logger.error(`[CREATE-TERRARIA] Erro ao buscar servidor criado: ${searchError instanceof Error ? searchError.message : String(searchError)}`);
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
            { name: '🎮 Configuração', value: `**Versão:** ${versao}\n**Mundo:** ${mundoNome}`, inline: true },
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
        .setColor('#8B4513')
        .setDescription(`Servidor **${nome}** foi criado e está sendo instalado.`)
        .addFields(
          { name: '🆔 ID do Servidor', value: `${createdServer.attributes.id}`, inline: true },
          { name: '🔗 UUID', value: createdServer.attributes.uuid, inline: true },
          { name: '🌐 Endereço', value: `${allocation.attributes.ip}:${allocation.attributes.port}`, inline: true },
          { name: '👤 Proprietário', value: user.attributes.email, inline: true },
          { name: '🖥️ Node', value: `${selectedNode.attributes.name} (${nodeId ? 'Específico' : 'Auto-selecionado'})`, inline: true },
          { name: '🥚 Egg', value: selectedEgg.attributes.name, inline: true },
          { name: '💾 Recursos', value: `**RAM:** ${memoria}MB\n**Disco:** ${disco}MB\n**CPU:** ${cpu}%`, inline: true },
          { name: '🎮 Configuração', value: `**Versão:** ${versao}\n**Mundo:** ${mundoNome}\n**Max Jogadores:** ${maxJogadores}\n**Dificuldade:** ${['Normal', 'Expert', 'Master', 'Journey'][dificuldade]}`, inline: true },
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
      logger.error(`Erro no comando ptero-create-terraria: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erro ao Criar Servidor')
        .setDescription(`Falha na criação do servidor: ${errorMessage}`)
        .setColor('#FF0000')
        .addFields({
          name: '💡 Possíveis Soluções',
          value: '• Verifique se o email é válido\n• Confirme se há recursos suficientes no painel\n• Tente usar um node específico\n• Verifique as permissões da API\n• Confirme se existem eggs de Terraria disponíveis',
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
    '1.4.4.9',
    '1.4.4.8',
    '1.4.4.7',
    '1.4.4.6',
    '1.4.4.5',
    '1.4.3.6',
    '1.4.3.2',
    '1.4.2.3',
    '1.4.1.2',
    '1.4.0.5'
  ];

  const filtered = versions.filter(version => 
    version.toLowerCase().includes(query.toLowerCase())
  );

  const choices = filtered.slice(0, 25).map(version => ({
    name: version === 'latest' ? 'latest (Mais recente)' : `Terraria ${version}`,
    value: version
  }));

  await interaction.respond(choices);
}

export default command;