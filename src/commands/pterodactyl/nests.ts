import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../../types/commands/Command';
import { CommandContext } from '../../types/commands/CommandContext';
import { MiClient } from '../../structures/MiClient';
import { logger } from '../../utils/logger';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ptero-nests')
    .setDescription('Lista todos os nests disponíveis no painel'),

  options: {
    categoria: 'Sistema',
    type: 'SLASH',
    cooldown: 10,
    ownerOnly: true,
    guildOnly: true,
    visible: true,
    usage: 'ptero-nests',
    examples: ['ptero-nests']
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
      const nestsResponse = await client.pterodactyl.nests.getNests();
      const nests = nestsResponse.data;

      if (nests.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('📦 Nests Disponíveis')
          .setDescription('Nenhum nest encontrado no painel.')
          .setColor('#FFA500')
          .setTimestamp();

        if (context.isSlash) {
          await context.interaction!.editReply({ embeds: [embed] });
        }
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📦 Nests Disponíveis')
        .setColor('#00FF88')
        .setDescription(`Encontrados ${nests.length} nest(s) no painel:`)
        .setTimestamp();

      for (const nest of nests.slice(0, 10)) {
        const eggsCount = nest.attributes.relationships?.eggs?.data?.length || 0;
        const serversCount = nest.attributes.relationships?.servers?.data?.length || 0;
        
        embed.addFields({
          name: `🥚 ${nest.attributes.name}`,
          value: `**ID:** ${nest.attributes.id}\n` +
                 `**Autor:** ${nest.attributes.author}\n` +
                 `**Eggs:** ${eggsCount}\n` +
                 `**Servidores:** ${serversCount}\n` +
                 `**Descrição:** ${nest.attributes.description || 'Sem descrição'}`,
          inline: true
        });
      }

      if (nests.length > 10) {
        embed.setFooter({ text: `... e mais ${nests.length - 10} nest(s). Use ptero-eggs para ver detalhes específicos.` });
      }

      if (context.isSlash) {
        await context.interaction!.editReply({ embeds: [embed] });
      }

    } catch (error) {
      logger.error(`Erro no comando ptero-nests: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erro')
        .setDescription('Ocorreu um erro ao listar os nests.')
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