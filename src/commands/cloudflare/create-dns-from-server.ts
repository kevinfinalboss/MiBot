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
      option.setName('tipo-servidor')
        .setDescription('Tipo de servidor/jogo')
        .setRequired(true)
        .addChoices(
          { name: 'Minecraft', value: 'minecraft' },
          { name: 'Terraria', value: 'terraria' }
        )
    ) as SlashCommandBuilder,

  options: {
    categoria: 'Cloudflare',
    type: 'SLASH',
    cooldown: 10,
    ownerOnly: true,
    guildOnly: true,
    visible: true,
    usage: 'cf-create-dns-from-server <zona> <servidor-id> <subdominio> <tipo-servidor>',
    examples: [
      'cf-create-dns-from-server zona:kevindev.com.br servidor-id:3 subdominio:terraria tipo-servidor:terraria',
      'cf-create-dns-from-server zona:nojeira.com.br servidor-id:1 subdominio:minecraft tipo-servidor:minecraft'
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
      const tipoServidor = context.isSlash ? context.interaction!.options.getString('tipo-servidor', true) : 'minecraft';

      logger.info(`[CF-CREATE-DNS] Criando DNS - zona: ${zoneId}, servidor: ${serverId}, subdominio: ${subdominio}, tipo: ${tipoServidor}`);

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

      const { recordType, needsSrvRecord } = getRecordTypeForGame(tipoServidor);

      const loadingEmbed = new EmbedBuilder()
        .setTitle('⏳ Criando Registro DNS...')
        .setDescription(`Configurando DNS para **${server.attributes.name}**`)
        .setColor('#FFA500')
        .addFields(
          { name: '🌐 Domínio', value: fullDomain, inline: true },
          { name: '📍 IP', value: ip, inline: true },
          { name: '🔌 Porta', value: port.toString(), inline: true },
          { name: '🎮 Tipo de Servidor', value: tipoServidor.charAt(0).toUpperCase() + tipoServidor.slice(1), inline: true },
          { name: '📋 Tipo DNS', value: recordType, inline: true }
        )
        .setTimestamp();

      if (context.isSlash) {
        await context.interaction!.editReply({ embeds: [loadingEmbed] });
      }

      let recordData: any;
      let recordName: string;
      let createdRecords: any[] = [];

      if (needsSrvRecord) {
        const servicePrefix = getServicePrefix(tipoServidor);
        recordName = `${servicePrefix}.${subdominio}.${zone.name}`;
        
        const aRecordData = {
          type: 'A',
          name: fullDomain,
          content: ip,
          ttl: 300,
          proxied: false
        };

        const srvRecordData = {
          type: 'SRV',
          name: recordName,
          content: `0 5 ${port} ${fullDomain}`,
          ttl: 300
        };

        const aRecord = await client.cloudflare.dns.createDNSRecord(zoneId, aRecordData);
        const srvRecord = await client.cloudflare.dns.createDNSRecord(zoneId, srvRecordData);
        
        createdRecords = [aRecord, srvRecord];
      } else {
        recordName = fullDomain;
        recordData = {
          type: recordType,
          name: recordName,
          content: ip,
          ttl: 300,
          proxied: false
        };

        const record = await client.cloudflare.dns.createDNSRecord(zoneId, recordData);
        createdRecords = [record];
      }

      const connectionInstructions = generateConnectionInstructions(tipoServidor, fullDomain, port, needsSrvRecord);

      const successEmbed = new EmbedBuilder()
        .setTitle('✅ DNS Criado com Sucesso!')
        .setDescription(`Registro DNS criado para **${server.attributes.name}**`)
        .setColor('#00FF88')
        .addFields(
          { name: '🌐 Domínio', value: `\`${fullDomain}\``, inline: true },
          { name: '📍 IP de Destino', value: `\`${ip}\``, inline: true },
          { name: '🔌 Porta', value: `\`${port}\``, inline: true },
          { name: '🎮 Tipo de Servidor', value: `\`${tipoServidor.charAt(0).toUpperCase() + tipoServidor.slice(1)}\``, inline: true },
          { name: '📋 Registros Criados', value: `\`${createdRecords.map(r => r.type).join(', ')}\``, inline: true },
          { name: '⏰ TTL', value: `\`${createdRecords[0].ttl}s\``, inline: true }
        );

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

      logger.info(`[CF-CREATE-DNS] DNS criado com sucesso - ${recordName} -> ${ip}:${port} (${tipoServidor})`);

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

function getRecordTypeForGame(tipoServidor: string): { recordType: string; needsSrvRecord: boolean } {
  switch (tipoServidor) {
    case 'minecraft':
      return { recordType: 'SRV', needsSrvRecord: true };
    case 'terraria':
      return { recordType: 'A', needsSrvRecord: false };
    default:
      return { recordType: 'A', needsSrvRecord: false };
  }
}

function getServicePrefix(tipoServidor: string): string {
  switch (tipoServidor) {
    case 'minecraft':
      return '_minecraft._tcp';
    case 'terraria':
      return '_terraria._tcp';
    default:
      return '_game._tcp';
  }
}

function generateConnectionInstructions(tipoServidor: string, domain: string, port: number, needsSrvRecord: boolean): string {
  switch (tipoServidor) {
    case 'minecraft':
      if (needsSrvRecord) {
        return `**Minecraft (SRV):**\n\`${domain}\` (porta detectada automaticamente)`;
      } else {
        return `**Minecraft:**\n\`${domain}:${port}\``;
      }
    case 'terraria':
      return `**Terraria:**\n\`${domain}:${port}\``;
    default:
      return `**Conexão Genérica:**\n\`${domain}:${port}\``;
  }
}

export default command;