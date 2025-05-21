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
      logger.error('Lavalink não inicializado para evento trackError');
      return;
    }
    
    miClient.lavalink.on('trackError', async (player, track, payload) => {
      try {
        if (!track) return;
        
        const channel = await client.channels.fetch(player.textChannelId || '');
        if (!channel || !(channel instanceof TextChannel)) return;
        
        const embed = new EmbedBuilder()
          .setTitle('❌ Erro na Reprodução')
          .setColor('#FF0000')
          .setDescription(`Ocorreu um erro ao reproduzir **[${track.info.title}](${track.info.uri})**.`)
          .addFields(
            { name: '⚠️ Motivo', value: payload.exception?.message || 'Erro desconhecido' }
          )
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
        
        player.skip();
      } catch (error) {
        logger.error(`Erro no evento trackError: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      }
    });
    
    logger.info('Evento trackError do Lavalink registrado com sucesso');
  }
};

export default event;