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
      logger.error('Lavalink não inicializado para evento playerDisconnect');
      return;
    }
    
    miClient.lavalink.on('playerDisconnect', async (player: any, oldVoiceChannelId: string) => {
      try {
        const channel = await client.channels.fetch(player.textChannelId || '');
        if (channel && channel instanceof TextChannel) {
          const embed = new EmbedBuilder()
            .setTitle('🔌 Desconectado')
            .setColor('#FF6347')
            .setDescription('Bot foi desconectado do canal de voz.')
            .addFields(
              { name: '📍 Canal anterior', value: `<#${oldVoiceChannelId}>`, inline: true },
              { name: '⏱️ Desconectado em', value: new Date().toLocaleTimeString('pt-BR'), inline: true }
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
            nowPlayingMessages.delete(player.guildId);
          } else {
            await channel.send({ embeds: [embed] });
          }
        }
        
        if (player.connected) {
          player.destroy();
        }
        
        logger.info(`Player desconectado no servidor ${player.guildId}`);
        
      } catch (error) {
        logger.error(`Erro no evento playerDisconnect: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      }
    });
    
    logger.info('Evento playerDisconnect do Lavalink registrado com sucesso');
  }
};

export default event;