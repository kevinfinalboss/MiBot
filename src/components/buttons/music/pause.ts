import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { MiClient } from '../../../structures/MiClient';
import { logger } from '../../../utils/logger';

export default {
  customId: 'music_pause',
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

      if (player.paused) {
        await interaction.reply({
          content: 'A música já está pausada.',
          ephemeral: true
        });
        return;
      }

      await player.pause();

      const embed = new EmbedBuilder()
        .setTitle('⏸️ Música Pausada')
        .setDescription('A reprodução foi pausada.')
        .setColor('#FFA500')
        .addFields(
          { name: '👤 Pausado por', value: `<@${interaction.user.id}>`, inline: true },
          { name: '🎵 Música atual', value: player.queue.current?.info.title || 'Nenhuma música', inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      
    } catch (error) {
      logger.error(`Erro no botão pause: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Ocorreu um erro ao pausar a música.',
          ephemeral: true
        });
      }
    }
  }
};