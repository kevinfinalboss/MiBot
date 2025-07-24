import { EmbedBuilder, TextChannel } from 'discord.js';
import { Event } from '../../types/events/Event';
import { MiClient } from '../../structures/MiClient';
import { logger } from '../../utils/logger';

const event: Event<'ready'> = {
  name: 'ready',
  once: true,
  async execute(client) {
    const miClient = client as MiClient;
    
    if (!miClient.lavalink) {
      logger.error('[Lavalink] ❌ Não inicializado para evento trackStuck');
      return;
    }
    
    miClient.lavalink.on('trackStuck', async (player: any, track: any, payload: any) => {
      try {
        if (!track) return;
        
        const channel = await client.channels.fetch(player.textChannelId || '');
        if (!channel || !(channel instanceof TextChannel)) return;
        
        const embed = new EmbedBuilder()
          .setTitle('⚠️ Música Travada')
          .setColor('#FFA500')
          .setDescription(`A música **[${track.info.title}](${track.info.uri})** travou e será pulada automaticamente.`)
          .addFields(
            { name: '🎵 Artista', value: track.info.author || 'Desconhecido', inline: true },
            { name: '⏱️ Tempo travado', value: `${payload.thresholdMs || 'Desconhecido'}ms`, inline: true },
            { name: '⏭️ Ação', value: 'Pulando para próxima música...', inline: false }
          )
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
        
        if (player.queue.tracks.length > 0) {
          await player.skip();
        } else {
          await player.stopPlaying(true, false);
        }
        
      } catch (error) {
        logger.error(`[Lavalink] ❌ trackStuck: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }
};

export default event;