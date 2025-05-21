import { EmbedBuilder, TextChannel } from 'discord.js';
import { Event } from '../../types/Event';
import { MiClient } from '../../structures/MiClient';
import { logger } from '../../utils/logger';

const event: Event<'ready'> = {
  name: 'ready',
  once: true,
  async execute(client) {
    const miClient = client as MiClient;
    
    if (!miClient.lavalink) {
      logger.error('Lavalink não inicializado para evento trackStart');
      return;
    }
    
    miClient.lavalink.on('trackStart', async (player, track) => {
      try {
        if (!track) return;
        
        const channel = await client.channels.fetch(player.textChannelId || '');
        if (!channel || !(channel instanceof TextChannel)) return;
        
        const embed = new EmbedBuilder()
          .setTitle('🎵 Tocando Agora')
          .setColor('#00FF00')
          .setDescription(`**[${track.info.title}](${track.info.uri})**`)
          .addFields(
            { name: '👨‍🎤 Artista', value: track.info.author || 'Desconhecido', inline: true },
            { name: '⏱️ Duração', value: formatTime(track.info.duration), inline: true },
            { name: '🔊 Volume', value: `${player.volume}%`, inline: true }
          )
          .setThumbnail(`https://img.youtube.com/vi/${track.info.identifier}/maxresdefault.jpg`)
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
      } catch (error) {
        logger.error(`Erro no evento trackStart: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      }
    });
    
    logger.info('Evento trackStart do Lavalink registrado com sucesso');
  }
};

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

export default event;