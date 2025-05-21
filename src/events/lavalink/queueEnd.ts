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
      logger.error('Lavalink não inicializado para evento queueEnd');
      return;
    }
    
    miClient.lavalink.on('queueEnd', async (player) => {
      try {
        const channel = await client.channels.fetch(player.textChannelId || '');
        if (!channel || !(channel instanceof TextChannel)) return;
        
        const embed = new EmbedBuilder()
          .setTitle('📋 Fila Finalizada')
          .setColor('#4B0082')
          .setDescription('A fila de reprodução chegou ao fim. Adicione mais músicas ou o bot será desconectado em 3 minutos.')
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
        
        setTimeout(async () => {
          if (!player.playing && player.connected) {
            player.destroy();
            
            const disconnectEmbed = new EmbedBuilder()
              .setTitle('👋 Desconectado')
              .setColor('#4B0082')
              .setDescription('Bot desconectado por inatividade.')
              .setTimestamp();
            
            await channel.send({ embeds: [disconnectEmbed] });
          }
        }, 3 * 60 * 1000);
      } catch (error) {
        logger.error(`Erro no evento queueEnd: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      }
    });
    
    logger.info('Evento queueEnd do Lavalink registrado com sucesso');
  }
};

export default event;