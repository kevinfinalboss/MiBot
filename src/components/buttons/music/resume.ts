import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { MiClient } from '../../../structures/MiClient';
import { logger } from '../../../utils/logger';

export default {
  customId: 'music_resume',
  async execute(client: MiClient, interaction: ButtonInteraction) {
    try {
      if (!interaction.guildId) {
        await interaction.reply({
          content: '❌ Este botão só pode ser usado em servidores.',
          ephemeral: true
        });
        return;
      }

      const player = client.lavalink.getPlayer(interaction.guildId);
      
      if (!player) {
        await interaction.reply({
          content: '❌ Não há nenhum player ativo neste servidor.',
          ephemeral: true
        });
        return;
      }

      const member = interaction.member;
      if (!member || !('voice' in member) || !member.voice.channel) {
        await interaction.reply({
          content: '❌ Você precisa estar em um canal de voz para usar este botão.',
          ephemeral: true
        });
        return;
      }

      if (member.voice.channelId !== player.voiceChannelId) {
        await interaction.reply({
          content: '❌ Você precisa estar no mesmo canal de voz que o bot.',
          ephemeral: true
        });
        return;
      }

      if (!player.paused) {
        await interaction.reply({
          content: '⚠️ A música não está pausada.',
          ephemeral: true
        });
        return;
      }

      await player.resume();

      const currentTrack = player.queue.current;
      const embed = new EmbedBuilder()
        .setTitle('▶️ Reprodução Retomada')
        .setColor('#00FF88')
        .setDescription(`A música foi retomada com sucesso!`)
        .addFields(
          { name: '🎵 Música', value: currentTrack?.info.title || 'Desconhecida', inline: true },
          { name: '👤 Retomado por', value: `<@${interaction.user.id}>`, inline: true },
          { name: '⏰ Retomado em', value: new Date().toLocaleTimeString('pt-BR'), inline: true }
        )
        .setFooter({ text: 'A reprodução foi retomada!' })
        .setTimestamp();

      if (currentTrack?.info.artworkUrl) {
        embed.setThumbnail(currentTrack.info.artworkUrl);
      }

      const response = await interaction.reply({ embeds: [embed] });
      
      setTimeout(async () => {
        try {
          await response.delete();
        } catch (error) {
        }
      }, 15000);
      
    } catch (error) {
      logger.error(`Erro no botão resume: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Ocorreu um erro ao retomar a música.',
          ephemeral: true
        });
      }
    }
  }
};