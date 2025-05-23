import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../../types/commands/Command';
import { CommandContext } from '../../types/commands/CommandContext';
import { MiClient } from '../../structures/MiClient';
import { logger } from '../../utils/logger';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ptero-eggs')
    .setDescription('Lista eggs disponíveis')
    .addIntegerOption(option =>
      option.setName('nest-id')
        .setDescription('ID do nest para filtrar eggs (opcional)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('tipo')
        .setDescription('Filtrar por tipo de jogo')
        .setRequired(false)
        .addChoices(
          { name: 'Minecraft', value: 'minecraft' },
          { name: 'Todos', value: 'all' }
        )
    ) as SlashCommandBuilder,

  options: {
    categoria: 'Sistema',
    type: 'SLASH',
    cooldown: 10,
    ownerOnly: true,
    guildOnly: true,
    visible: true,
    usage: 'ptero-eggs [nest-id] [tipo]',
    examples: ['ptero-eggs', 'ptero-eggs nest-id:1', 'ptero-eggs tipo:minecraft']
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
      const nestId = context.isSlash ? context.interaction!.options.getInteger('nest-id') : null;
      const tipo = context.isSlash ? context.interaction!.options.getString('tipo') || 'all' : 'all';

      let eggs;
      let title = '🥚 Eggs Disponíveis';

      if (nestId) {
        const eggsResponse = await client.pterodactyl.nests.getEggs(nestId);
        eggs = eggsResponse.data;
        title += ` (Nest ${nestId})`;
      } else if (tipo === 'minecraft') {
        eggs = await client.pterodactyl.nests.getMinecraftEggs();
        title += ' - Minecraft';
      } else {
        eggs = await client.pterodactyl.nests.getAllEggs();
      }

      if (eggs.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription('Nenhum egg encontrado com os filtros especificados.')
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
        .setDescription(`Encontrados ${eggs.length} egg(s):`)
        .setTimestamp();

      for (const egg of eggs.slice(0, 8)) {
        const variables = egg.attributes.relationships?.variables?.data || [];
        const dockerImages = Object.keys(egg.attributes.docker_images);
        
        embed.addFields({
          name: `🎮 ${egg.attributes.name}`,
          value: `**ID:** ${egg.attributes.id}\n` +
                 `**Nest:** ${egg.attributes.nest}\n` +
                 `**Autor:** ${egg.attributes.author}\n` +
                 `**Imagens:** ${dockerImages.length}\n` +
                 `**Variáveis:** ${variables.length}\n` +
                 `**Descrição:** ${egg.attributes.description.slice(0, 100)}${egg.attributes.description.length > 100 ? '...' : ''}`,
          inline: true
        });
      }

      if (eggs.length > 8) {
        embed.setFooter({ text: `... e mais ${eggs.length - 8} egg(s). Use filtros para refinar a busca.` });
      }

      if (context.isSlash) {
        await context.interaction!.editReply({ embeds: [embed] });
      }

    } catch (error) {
      logger.error(`Erro no comando ptero-eggs: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erro')
        .setDescription('Ocorreu um erro ao listar os eggs.')
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