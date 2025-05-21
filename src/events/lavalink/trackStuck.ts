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
      logger.error('Lavalink não inicializado para evento trackStuck');
      return;
    }
    
    miClient.lavalink.on('trackStuck', async (player, track) => {
      try {
        if (!track) return;
        
        const channel = await client.channels.fetch(player.textChannelId || '');
        if (!channel || !(channel instanceof TextChannel)) return;
        
        const embed = new EmbedBuilder()
          .setTitle('⚠️ Música Travada')
          .setColor('#FFA500')
          .setDescription(`A música **[${track.info.title}](${track.info.uri})** travou e será pulada.`)
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
        
        player.skip();
      } catch (error) {
        logger.error(`Erro no evento trackStuck: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      }
    });
    
    logger.info('Evento trackStuck do Lavalink registrado com sucesso');
  }
};

export default event;