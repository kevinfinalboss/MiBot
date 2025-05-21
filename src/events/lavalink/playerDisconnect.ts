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
      logger.error('Lavalink não inicializado para evento playerDisconnect');
      return;
    }
    
    miClient.lavalink.on('playerDisconnect', async (player, oldVoiceChannelId) => {
      try {
        const channel = await client.channels.fetch(player.textChannelId || '');
        if (channel && channel instanceof TextChannel) {
          const embed = new EmbedBuilder()
            .setTitle('🔌 Desconectado')
            .setColor('#FF6347')
            .setDescription('Bot desconectado do canal de voz.')
            .setTimestamp();
          
          await channel.send({ embeds: [embed] });
        }
        
        player.destroy();
      } catch (error) {
        logger.error(`Erro no evento playerDisconnect: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      }
    });
    
    logger.info('Evento playerDisconnect do Lavalink registrado com sucesso');
  }
};

export default event;