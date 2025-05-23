import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { MiClient } from '../../../structures/MiClient';
import { logger } from '../../../utils/logger';

export default {
  customId: 'music_stop',
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
      const queueLength = player.queue.tracks.length;

      await player.stopPlaying(true, false);

      const embed = new EmbedBuilder()
        .setTitle('⏹️ Reprodução Parada')
        .setDescription('A reprodução foi interrompida e a fila foi limpa.')
        .setColor('#FF0000')
        .addFields(
          { name: '👤 Parado por', value: `<@${interaction.user.id}>`, inline: true },
          { name: '🗑️ Fila limpa', value: `${queueLength} música(s) removida(s)`, inline: true }
        )
        .setTimestamp();

      if (currentTrack) {
        embed.addFields({
          name: '🎵 Última música',
          value: `**${currentTrack.info.title}**`,
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed] });
      
    } catch (error) {
      logger.error(`Erro no botão stop: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Ocorreu um erro ao parar a música.',
          ephemeral: true
        });
      }
    }
  }
};