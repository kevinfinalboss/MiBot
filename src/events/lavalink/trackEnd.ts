import { EmbedBuilder, TextChannel } from 'discord.js';
import { Event } from '../../types/events/Event';
import { MiClient } from '../../structures/MiClient';
import { logger } from '../../utils/logger';
import { nowPlayingMessages } from '../../utils/musicState';

const event: Event<'ready'> = {
  name: 'ready',
  once: true,
  async execute(client) {
    const miClient = client as MiClient;
    
    if (!miClient.lavalink) {
      logger.error('[Lavalink] ❌ Não inicializado para evento trackEnd');
      return;
    }
    
    miClient.lavalink.on('trackEnd', async (player: any, track: any, payload: any) => {
      try {
        if (!track) return;
        
        if (payload.reason === 'replaced') return;
        
        const channel = await client.channels.fetch(player.textChannelId || '');
        if (!channel || !(channel instanceof TextChannel)) return;
        
        if (player.queue.tracks.length === 0 && payload.reason !== 'stopped') {
          const embed = new EmbedBuilder()
            .setTitle('📭 Fila Finalizada')
            .setColor('#FFA500')
            .setDescription(`**[${track.info.title}](${track.info.uri})** foi a última música da fila.`)
            .addFields(
              { name: '🎵 Última música', value: `${track.info.author || 'Desconhecido'}`, inline: true },
              { name: '⏱️ Status', value: 'Fila vazia', inline: true },
              { name: '💡 Dica', value: 'Use `/play` para adicionar mais músicas!', inline: false }
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
          
          setTimeout(() => {
            nowPlayingMessages.delete(player.guildId);
          }, 30000);
        }
        
      } catch (error) {
        logger.error(`[Lavalink] ❌ trackEnd: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }
};

export default event;