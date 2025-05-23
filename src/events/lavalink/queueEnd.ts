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
      logger.error('Lavalink não inicializado para evento queueEnd');
      return;
    }
    
    miClient.lavalink.on('queueEnd', async (player: any) => {
      try {
        const channel = await client.channels.fetch(player.textChannelId || '');
        if (!channel || !(channel instanceof TextChannel)) return;
        
        const embed = new EmbedBuilder()
          .setTitle('📋 Fila Finalizada')
          .setColor('#4B0082')
          .setDescription('A fila de reprodução chegou ao fim.')
          .addFields(
            { name: '⏰ Tempo restante', value: '3 minutos para desconexão automática', inline: true },
            { name: '💡 Dica', value: 'Adicione mais músicas para continuar ouvindo!', inline: true },
            { name: '🎵 Status', value: 'Reprodução finalizada', inline: false }
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
        
        const timeoutId = setTimeout(async () => {
          if (!player.playing && player.connected) {
            try {
              player.destroy();
              
              const disconnectEmbed = new EmbedBuilder()
                .setTitle('👋 Desconectado por Inatividade')
                .setColor('#4B0082')
                .setDescription('Bot foi desconectado automaticamente após 3 minutos de inatividade.')
                .setTimestamp();
              
              await channel.send({ embeds: [disconnectEmbed] });
              nowPlayingMessages.delete(player.guildId);
            } catch (error) {
              logger.error(`Erro ao desconectar player por inatividade: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }, 3 * 60 * 1000);
        
        player.disconnectTimeout = timeoutId;
        
      } catch (error) {
        logger.error(`Erro no evento queueEnd: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      }
    });
    
    logger.info('Evento queueEnd do Lavalink registrado com sucesso');
  }
};

export default event;