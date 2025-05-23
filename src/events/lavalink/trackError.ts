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
    
    miClient.lavalink.on('trackError', async (player: any, track: any, payload: any) => {
      try {
        if (!track) return;
        
        const channel = await client.channels.fetch(player.textChannelId || '');
        if (!channel || !(channel instanceof TextChannel)) return;
        
        logger.error(`Erro na reprodução: ${track.info.title} - ${payload.exception?.message || 'Erro desconhecido'}`);
        
        const embed = new EmbedBuilder()
          .setTitle('❌ Erro na Reprodução')
          .setColor('#FF0000')
          .setDescription(`Ocorreu um erro ao reproduzir **[${track.info.title}](${track.info.uri})**.`)
          .addFields(
            { name: '⚠️ Motivo', value: payload.exception?.message || 'Erro desconhecido', inline: false },
            { name: '🎵 Artista', value: track.info.author || 'Desconhecido', inline: true },
            { name: '⏭️ Ação', value: 'Pulando para próxima música...', inline: true }
          )
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
        
        if (player.queue.tracks.length > 0) {
          await player.skip();
        } else {
          await player.stopPlaying(true, false);
        }
        
      } catch (error) {
        logger.error(`Erro no evento trackError: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      }
    });
    
    logger.info('Evento trackError do Lavalink registrado com sucesso');
  }
};

export default event;