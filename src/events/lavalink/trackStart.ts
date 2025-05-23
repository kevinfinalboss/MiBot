import { EmbedBuilder, TextChannel } from 'discord.js';
import { Event } from '../../types/Event';
import { MiClient } from '../../structures/MiClient';
import { logger } from '../../utils/logger';
import { nowPlayingMessages } from '../../utils/musicState';

const event: Event<'ready'> = {
  name: 'ready',
  once: true,
  async execute(client) {
    const miClient = client as MiClient;
    
    if (!miClient.lavalink) {
      logger.error('Lavalink não inicializado para evento trackEnd');
      return;
    }
    
    miClient.lavalink.on('trackEnd', async (player, track, reason) => {
      try {
        if (!track) return;
        
        logger.info(`Track finalizada: ${track.info.title} no servidor ${player.guildId}`);
        
        if (player.queue.tracks.length === 0) {
          const channel = await client.channels.fetch(player.textChannelId || '');
          if (!channel || !(channel instanceof TextChannel)) return;
          
          const embed = new EmbedBuilder()
            .setTitle('📭 Fila Finalizada')
            .setColor('#FFA500')
            .setDescription(`**[${track.info.title}](${track.info.uri})** foi a última música da fila.`)
            .addFields(
              { name: '🎵 Última música', value: `${track.info.author || 'Desconhecido'}`, inline: true },
              { name: '⏱️ Status', value: 'Fila vazia', inline: true }
            )
            .setTimestamp();

          const existingMessageId = nowPlayingMessages.get(player.guildId);
          
          if (existingMessageId) {
            try {
              const message = await channel.messages.fetch(existingMessageId);
              await message.edit({ embeds: [embed], components: [] });
            } catch (error) {
              await channel.send({ embeds: [embed] });
            }
          } else {
            await channel.send({ embeds: [embed] });
          }
          
          nowPlayingMessages.delete(player.guildId);
        }
        
      } catch (error) {
        logger.error(`Erro no evento trackEnd: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      }
    });
    
    logger.info('Evento trackEnd do Lavalink registrado com sucesso');
  }
};

export default event;