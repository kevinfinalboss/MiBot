import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { MiClient } from '../../../structures/MiClient';
import { logger } from '../../../utils/logger';

function formatTime(ms: number): string {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

export default {
  customId: 'music_queue',
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

      const currentTrack = player.queue.current;
      const queueTracks = player.queue.tracks;

      if (!currentTrack && queueTracks.length === 0) {
        await interaction.reply({
          content: 'A fila está vazia.',
          ephemeral: true
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📋 Fila de Música')
        .setColor('#9F59FF')
        .setTimestamp();

      if (currentTrack) {
        const progress = player.position || 0;
        const duration = currentTrack.info.duration || 0;
        const progressBar = createProgressBar(progress, duration);
        
        embed.addFields({
          name: '🔄 Tocando agora',
          value: `**[${currentTrack.info.title}](${currentTrack.info.uri})**\n` +
                 `👨‍🎤 ${currentTrack.info.author || 'Desconhecido'}\n` +
                 `⏱️ ${formatTime(progress)} / ${formatTime(duration)}\n` +
                 `${progressBar}`,
          inline: false
        });
      }

      if (queueTracks.length > 0) {
        const totalDuration = queueTracks.reduce((acc: number, track: any) => acc + (track.info.duration || 0), 0);
        
        let queueList = '';
        const maxTracks = Math.min(10, queueTracks.length);
        
        for (let i = 0; i < maxTracks; i++) {
          const track = queueTracks[i];
          const duration = formatTime(track.info.duration || 0);
          queueList += `**${i + 1}.** [${track.info.title}](${track.info.uri}) - \`${duration}\`\n`;
        }

        if (queueTracks.length > 10) {
          queueList += `\n*... e mais ${queueTracks.length - 10} música(s)*`;
        }

        embed.addFields(
          {
            name: `🔜 Próximas (${queueTracks.length})`,
            value: queueList || 'Nenhuma música na fila',
            inline: false
          },
          {
            name: '📊 Estatísticas da Fila',
            value: `🎵 Total: ${queueTracks.length} música(s)\n⏱️ Duração: ${formatTime(totalDuration)}`,
            inline: true
          }
        );
      } else {
        embed.addFields({
          name: '📭 Fila vazia',
          value: 'Não há músicas na fila.',
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
      
    } catch (error) {
      logger.error(`Erro no botão queue: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Ocorreu um erro ao mostrar a fila.',
          ephemeral: true
        });
      }
    }
  }
};

function createProgressBar(current: number, total: number, length: number = 20): string {
  if (total <= 0) return '▬'.repeat(length);
  
  const percentage = Math.min(current / total, 1);
  const filledLength = Math.round(length * percentage);
  const emptyLength = length - filledLength;
  
  const filled = '▰'.repeat(Math.max(0, filledLength));
  const empty = '▱'.repeat(Math.max(0, emptyLength));
  
  return `${filled}${empty}`;
}