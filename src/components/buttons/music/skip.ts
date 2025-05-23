import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { MiClient } from '../../../structures/MiClient';
import { logger } from '../../../utils/logger';

export default {
  customId: 'music_skip',
  async execute(client: MiClient, interaction: ButtonInteraction) {
    try {
      if (!interaction.guildId) {
        await interaction.reply({
          content: 'Este botão só pode ser usado em servidores.',
          ephemeral: true
        });
        return;
      }

      const player = client.lavalink.getPlayer(interaction.guildId);
      
      if (!player) {
        await interaction.reply({
          content: 'Não há nenhum player ativo neste servidor.',
          ephemeral: true
        });
        return;
      }

      const member = interaction.member;
      if (!member || !('voice' in member) || !member.voice.channel) {
        await interaction.reply({
          content: 'Você precisa estar no mesmo canal de voz que o bot para usar este botão.',
          ephemeral: true
        });
        return;
      }

      if (member.voice.channelId !== player.voiceChannelId) {
        await interaction.reply({
          content: 'Você precisa estar no mesmo canal de voz que o bot para usar este botão.',
          ephemeral: true
        });
        return;
      }

      const currentTrack = player.queue.current;
      if (!currentTrack) {
        await interaction.reply({
          content: 'Não há nenhuma música tocando no momento.',
          ephemeral: true
        });
        return;
      }

      const nextTrack = player.queue.tracks[0];
      
      await player.skip();

      const embed = new EmbedBuilder()
        .setTitle('⏭️ Música Pulada')
        .setDescription(`**${currentTrack.info.title}** foi pulada.`)
        .setColor('#FF6B35')
        .addFields(
          { name: '👤 Pulado por', value: `<@${interaction.user.id}>`, inline: true },
          { name: '🔄 Fila restante', value: `${player.queue.tracks.length} música(s)`, inline: true }
        )
        .setTimestamp();

      if (nextTrack) {
        embed.addFields({
          name: '⏯️ Próxima música',
          value: `**[${nextTrack.info.title}](${nextTrack.info.uri})**`,
          inline: false
        });
      } else {
        embed.addFields({
          name: '📭 Fila vazia',
          value: 'Não há mais músicas na fila.',
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed] });
      
    } catch (error) {
      logger.error(`Erro no botão skip: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Ocorreu um erro ao pular a música.',
          ephemeral: true
        });
      }
    }
  }
};