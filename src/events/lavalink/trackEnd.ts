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
      logger.error('Lavalink não inicializado para evento trackEnd');
      return;
    }
    
    miClient.lavalink.on('trackEnd', async (player, track) => {
      try {
        if (!track) return;
        
        logger.info(`Track finalizada: ${track.info.title} no servidor ${player.guildId}`);
        
        if (player.queue.tracks.length === 0) {
          const channel = await client.channels.fetch(player.textChannelId || '');
          if (!channel || !(channel instanceof TextChannel)) return;
          
          const embed = new EmbedBuilder()
            .setTitle('🎵 Música Finalizada')
            .setColor('#0099ff')
            .setDescription(`**[${track.info.title}](${track.info.uri})** terminou de tocar.`)
            .setTimestamp();
          
          await channel.send({ embeds: [embed] });
        }
      } catch (error) {
        logger.error(`Erro no evento trackEnd: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      }
    });
    
    logger.info('Evento trackEnd do Lavalink registrado com sucesso');
  }
};

export default event;