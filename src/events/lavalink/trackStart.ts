import { EmbedBuilder, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
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
      logger.error('Lavalink não inicializado para evento trackStart');
      return;
    }
    
    miClient.lavalink.on('trackStart', async (player: any, track: any) => {
      try {
        if (!track) return;
        
        const channel = await client.channels.fetch(player.textChannelId || '');
        if (!channel || !(channel instanceof TextChannel)) return;
        
        logger.info(`Nova música iniciada: ${track.info.title} no servidor ${player.guildId}`);
        
        const embed = new EmbedBuilder()
          .setTitle('🎵 Tocando Agora')
          .setColor('#00FF88')
          .setDescription(`**[${track.info.title}](${track.info.uri})**`)
          .addFields(
            { name: '👨‍🎤 Artista', value: track.info.author || 'Desconhecido', inline: true },
            { name: '⏱️ Duração', value: formatTime(track.info.duration || 0), inline: true },
            { name: '📊 Na fila', value: `${player.queue.tracks.length} música(s)`, inline: true },
            { name: '🎧 Canal', value: `<#${player.voiceChannelId}>`, inline: true },
            { name: '🔊 Volume', value: `${player.volume}%`, inline: true },
            { name: '👤 Solicitado por', value: `<@${track.requester?.id || 'Desconhecido'}>`, inline: true }
          )
          .setThumbnail(track.info.artworkUrl || `https://img.youtube.com/vi/${track.info.identifier}/maxresdefault.jpg`)
          .setTimestamp();
        
        if (player.queue.tracks.length > 0) {
          const nextTrack = player.queue.tracks[0];
          const totalDuration = player.queue.tracks.reduce((acc: number, track: any) => acc + (track.info.duration || 0), 0);
          
          embed.addFields({
            name: '⏭️ Próxima na fila',
            value: `**[${nextTrack.info.title}](${nextTrack.info.uri})**\n👨‍🎤 ${nextTrack.info.author || 'Desconhecido'}\n⏱️ Tempo restante: ${formatTime(totalDuration)}`,
            inline: false
          });
        } else {
          embed.addFields({
            name: '📭 Fila vazia',
            value: 'Adicione mais músicas com `/play`',
            inline: false
          });
        }
        
        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('music_resume')
              .setLabel('Retomar')
              .setStyle(ButtonStyle.Success)
              .setEmoji('▶️')
              .setDisabled(false),
            new ButtonBuilder()
              .setCustomId('music_pause')
              .setLabel('Pausar')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('⏸️')
              .setDisabled(false),
            new ButtonBuilder()
              .setCustomId('music_skip')
              .setLabel('Pular')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('⏭️')
              .setDisabled(player.queue.tracks.length === 0),
            new ButtonBuilder()
              .setCustomId('music_stop')
              .setLabel('Parar')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('⏹️')
              .setDisabled(false),
            new ButtonBuilder()
              .setCustomId('music_queue')
              .setLabel('Fila')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('📋')
              .setDisabled(false)
          );
        
        const existingMessageId = nowPlayingMessages.get(player.guildId);
        
        if (existingMessageId) {
          try {
            const message = await channel.messages.fetch(existingMessageId);
            await message.edit({ embeds: [embed], components: [row] });
          } catch (error) {
            const newMessage = await channel.send({ embeds: [embed], components: [row] });
            nowPlayingMessages.set(player.guildId, newMessage.id);
          }
        } else {
          const newMessage = await channel.send({ embeds: [embed], components: [row] });
          nowPlayingMessages.set(player.guildId, newMessage.id);
        }
        
      } catch (error) {
        logger.error(`Erro no evento trackStart: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      }
    });
    
    logger.info('Evento trackStart do Lavalink registrado com sucesso');
  }
};

function formatTime(ms: number): string {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

export default event;