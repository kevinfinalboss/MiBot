import { SlashCommandBuilder, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types/commands/Command';
import { CommandContext } from '../../types/commands/CommandContext';
import { MiClient } from '../../structures/MiClient';
import { logger } from '../../utils/logger';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('cf-create-dns-from-server')
    .setDescription('Cria entrada DNS baseada em servidor do Pterodactyl')
    .addStringOption(option =>
      option.setName('zona')
        .setDescription('Zona do Cloudflare')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption(option =>
      option.setName('servidor-id')
        .setDescription('ID do servidor no Pterodactyl')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName('subdominio')
        .setDescription('Subdomínio desejado (ex: terraria, minecraft)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('tipo')
        .setDescription('Tipo de registro DNS')
        .setRequired(false)
        .addChoices(
          { name: 'A (IP v4)', value: 'A' },
          { name: 'SRV (Service Record)', value: 'SRV' }
        )
    )
    .addBooleanOption(option =>
      option.setName('proxy')
        .setDescription('Ativar proxy do Cloudflare (não recomendado para jogos)')
        .setRequired(false)
    ) as SlashCommandBuilder,

  options: {
    categoria: 'Cloudflare',
    type: 'SLASH',
    cooldown: 10,
    ownerOnly: true,
    guildOnly: true,
    visible: true,
    usage: 'cf-create-dns-from-server <zona> <servidor-id> <subdominio>',
    examples: [
      'cf-create-dns-from-server zona:kevindev.com.br servidor-id:3 subdominio:terraria',
      'cf-create-dns-from-server zona:nojeira.com.br servidor-id:1 subdominio:minecraft tipo:SRV'
    ]
  },

  async executeAutocomplete(client: MiClient, interaction: AutocompleteInteraction) {
    try {
      const focusedOption = interaction.options.getFocused(true);

      switch (focusedOption.name) {
        case 'zona':
          await handleZoneAutocomplete(client, interaction, focusedOption.value);
          break;
        case 'servidor-id':
          await handleServerAutocomplete(client, interaction, focusedOption.value);
          break;
        default:
          await interaction.respond([]);
      }
    } catch (error) {
      logger.error(`Erro no autocomplete cf-create-dns-from-server: ${error instanceof Error ? error.message : String(error)}`);
      await interaction.respond([]);
    }
  },

  async execute(client: MiClient, context: CommandContext) {
    if (!client.cloudflare || !client.pterodactyl) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Serviços Indisponíveis')
        .setDescription('Os clientes Cloudflare e Pterodactyl devem estar configurados.')
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
      const zoneId = context.isSlash ? context.interaction!.options.getString('zona', true) : '';
      const serverId = context.isSlash ? context.interaction!.options.getInteger('servidor-id', true) : 0;
      const subdominio = context.isSlash ? context.interaction!.options.getString('subdominio', true) : '';
      const tipo = context.isSlash ? context.interaction!.options.getString('tipo') || 'A' : 'A';
      const proxy = context.isSlash ? context.interaction!.options.getBoolean('proxy') || false : false;

      logger.info(`[CF-CREATE-DNS] Criando DNS - zona: ${zoneId}, servidor: ${serverId}, subdominio: ${subdominio}`);

      const zone = await client.cloudflare.zones.getZone(zoneId);
      if (!zone) {
        throw new Error(`Zona ${zoneId} não encontrada`);
      }

      const server = await client.pterodactyl.servers.getServer(serverId);
      if (!server || !server.attributes) {
        throw new Error(`Servidor ${serverId} não encontrado`);
      }

      const { ip, port } = await extractServerConnectionInfo(client, server);

      if (!isValidSubdomain(subdominio)) {
        throw new Error('Subdomínio inválido. Use apenas letras, números e hífens.');
      }

      const fullDomain = `${subdominio}.${zone.name}`;

      const existingRecords = await client.cloudflare.dns.findDNSRecordsByName(zoneId, fullDomain);
      if (existingRecords.length > 0) {
        const conflictEmbed = new EmbedBuilder()
          .setTitle('⚠️ Conflito de DNS')
          .setDescription(`Já existe um registro DNS para **${fullDomain}**`)
          .setColor('#FFA500')
          .addFields(
            { name: '🔍 Registros Existentes', value: existingRecords.map(r => `**${r.type}:** ${r.content}`).join('\n'), inline: false },
            { name: '💡 Solução', value: 'Use um subdomínio diferente ou delete os registros existentes primeiro.', inline: false }
          )
          .setTimestamp();

        if (context.isSlash) {
          await context.interaction!.editReply({ embeds: [conflictEmbed] });
        }
        return;
      }

      const loadingEmbed = new EmbedBuilder()
        .setTitle('⏳ Criando Registro DNS...')
        .setDescription(`Configurando DNS para **${server.attributes.name}**`)
        .setColor('#FFA500')
        .addFields(
          { name: '🌐 Domínio', value: fullDomain, inline: true },
          { name: '📍 IP', value: ip, inline: true },
          { name: '🔌 Porta', value: port.toString(), inline: true },
          { name: '📋 Tipo', value: tipo, inline: true },
          { name: '🟠 Proxy', value: proxy ? 'Ativo' : 'Inativo', inline: true },
          { name: '🎮 Servidor', value: `${server.attributes.name} (ID: ${serverId})`, inline: true }
        )
        .setTimestamp();

      if (context.isSlash) {
        await context.interaction!.editReply({ embeds: [loadingEmbed] });
      }

      let recordData: any;
      let recordName: string;

      if (tipo === 'SRV') {
        const servicePrefix = detectServiceFromServer(server);
        recordName = `${servicePrefix}.${subdominio}.${zone.name}`;
        recordData = {
          type: 'SRV',
          name: recordName,
          content: `0 5 ${port} ${fullDomain}`,
          ttl: 300
        };

        const aRecordData = {
          type: 'A',
          name: fullDomain,
          content: ip,
          ttl: 300,
          proxied: false
        };

        await client.cloudflare.dns.createDNSRecord(zoneId, aRecordData);
      } else {
        recordName = fullDomain;
        recordData = {
          type: tipo,
          name: recordName,
          content: ip,
          ttl: 300,
          proxied: proxy && tipo === 'A'
        };
      }

      const createdRecord = await client.cloudflare.dns.createDNSRecord(zoneId, recordData);

      const connectionInstructions = generateConnectionInstructions(server, fullDomain, port, tipo);

      const successEmbed = new EmbedBuilder()
        .setTitle('✅ DNS Criado com Sucesso!')
        .setDescription(`Registro DNS criado para **${server.attributes.name}**`)
        .setColor('#00FF88')
        .addFields(
          { name: '🌐 Domínio', value: `\`${recordName}\``, inline: true },
          { name: '📍 IP de Destino', value: `\`${ip}\``, inline: true },
          { name: '🔌 Porta', value: `\`${port}\``, inline: true },
          { name: '📋 Tipo de Registro', value: `\`${createdRecord.type}\``, inline: true },
          { name: '🆔 ID do Registro', value: `\`${createdRecord.id}\``, inline: true },
          { name: '⏰ TTL', value: `\`${createdRecord.ttl}s\``, inline: true }
        );

      if (createdRecord.proxied) {
        successEmbed.addFields({ name: '🟠 Proxy', value: '**Ativo** (pode afetar jogos)', inline: true });
      }

      if (connectionInstructions) {
        successEmbed.addFields({ 
          name: '🎮 Como Conectar', 
          value: connectionInstructions, 
          inline: false 
        });
      }

      successEmbed.addFields({
        name: '⏱️ Propagação',
        value: 'DNS pode levar alguns minutos para propagar globalmente',
        inline: false
      });

      successEmbed.setFooter({ 
        text: `Servidor: ${server.attributes.name} | Zone: ${zone.name}`,
        iconURL: 'https://www.cloudflare.com/favicon.ico'
      })
      .setTimestamp();

      if (context.isSlash) {
        await context.interaction!.editReply({ embeds: [successEmbed] });
      }

      logger.info(`[CF-CREATE-DNS] DNS criado com sucesso - ${recordName} -> ${ip}:${port}`);

    } catch (error) {
      logger.error(`Erro no comando cf-create-dns-from-server: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erro ao Criar DNS')
        .setDescription(`Falha na criação do registro: ${errorMessage}`)
        .setColor('#FF0000')
        .addFields({
          name: '💡 Possíveis Soluções',
          value: '• Verifique se o servidor existe no Pterodactyl\n• Confirme se a zona está ativa no Cloudflare\n• Verifique se o subdomínio é válido\n• Certifique-se de que não há conflitos de DNS',
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

async function handleZoneAutocomplete(client: MiClient, interaction: AutocompleteInteraction, query: string) {
  if (!client.cloudflare) {
    await interaction.respond([]);
    return;
  }

  try {
    const zones = await client.cloudflare.zones.getZones();
    
    let filtered = zones;
    if (query && query.length > 0) {
      filtered = zones.filter(zone => 
        zone.name.toLowerCase().includes(query.toLowerCase()) ||
        zone.id.toLowerCase().includes(query.toLowerCase())
      );
    }

    const choices = filtered.slice(0, 25).map(zone => ({
      name: `${zone.name} (${zone.status})`,
      value: zone.id
    }));

    await interaction.respond(choices);
  } catch (error) {
    await interaction.respond([]);
  }
}

async function handleServerAutocomplete(client: MiClient, interaction: AutocompleteInteraction, query: string) {
  if (!client.pterodactyl) {
    await interaction.respond([]);
    return;
  }

  try {
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
    await interaction.respond([]);
  }
}

async function extractServerConnectionInfo(client: MiClient, server: any): Promise<{ ip: string; port: number }> {
  try {
    if (server.attributes.relationships?.allocations?.data?.[0]) {
      const allocation = server.attributes.relationships.allocations.data[0].attributes;
      return {
        ip: allocation.ip,
        port: allocation.port
      };
    }

    const nodeId = server.attributes.node;
    const node = await client.pterodactyl!.nests.getNode(nodeId);
    
    if (!node || !node.attributes) {
      throw new Error(`Node ${nodeId} não encontrado`);
    }

    const allocations = await client.pterodactyl!.nests.getAvailableAllocations(nodeId);
    const serverAllocation = allocations.find(alloc => alloc.attributes.id === server.attributes.allocation);

    if (!serverAllocation) {
      throw new Error('Allocation do servidor não encontrada');
    }

    return {
      ip: serverAllocation.attributes.ip,
      port: serverAllocation.attributes.port
    };
  } catch (error) {
    logger.error(`Erro ao extrair informações de conexão: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error('Não foi possível obter IP e porta do servidor');
  }
}

function isValidSubdomain(subdomain: string): boolean {
  const subdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
  return subdomainRegex.test(subdomain) && subdomain.length <= 63;
}

function detectServiceFromServer(server: any): string {
  const serverName = server.attributes.name.toLowerCase();
  
  if (serverName.includes('minecraft') || serverName.includes('mc')) {
    return '_minecraft._tcp';
  } else if (serverName.includes('terraria')) {
    return '_terraria._tcp';
  } else if (serverName.includes('teamspeak') || serverName.includes('ts3')) {
    return '_ts3._udp';
  } else if (serverName.includes('discord')) {
    return '_discord._tcp';
  } else {
    return '_game._tcp';
  }
}

function generateConnectionInstructions(server: any, domain: string, port: number, tipo: string): string {
  const serverName = server.attributes.name.toLowerCase();
  
  if (serverName.includes('minecraft') || serverName.includes('mc')) {
    if (tipo === 'SRV') {
      return `**Minecraft (SRV):**\n\`${domain}\` (porta detectada automaticamente)`;
    } else {
      return `**Minecraft:**\n\`${domain}:${port}\``;
    }
  } else if (serverName.includes('terraria')) {
    return `**Terraria:**\n\`${domain}:${port}\``;
  } else if (serverName.includes('teamspeak') || serverName.includes('ts3')) {
    return `**TeamSpeak:**\n\`${domain}:${port}\``;
  } else if (serverName.includes('discord')) {
    return `**Discord Bot:**\n\`${domain}:${port}\``;
  } else {
    return `**Conexão Genérica:**\n\`${domain}:${port}\``;
  }
}

export default command;