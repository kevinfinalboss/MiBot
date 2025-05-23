import { EmbedBuilder, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { MiClient } from '../structures/MiClient';
import { nowPlayingMessages } from './musicState';

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

export async function updateNowPlayingEmbed(client: MiClient, player: any) {
  try {
    const channel = await client.channels.fetch(player.textChannelId || '');
    if (!channel || !(channel instanceof TextChannel)) return;

    const currentTrack = player.queue.current;
    if (!currentTrack) return;

    const embed = new EmbedBuilder()
      .setTitle('🎵 Tocando Agora')
      .setColor('#00FF88')
      .setDescription(`**[${currentTrack.info.title}](${currentTrack.info.uri})**`)
      .addFields(
        { name: '👨‍🎤 Artista', value: currentTrack.info.author || 'Desconhecido', inline: true },
        { name: '⏱️ Duração', value: formatTime(currentTrack.info.duration || 0), inline: true },
        { name: '📊 Na fila', value: `${player.queue.tracks.length} música(s)`, inline: true },
        { name: '🎧 Canal', value: `<#${player.voiceChannelId}>`, inline: true },
        { name: '🔊 Volume', value: `${player.volume}%`, inline: true },
        { name: '👤 Solicitado por', value: `<@${currentTrack.requester?.id || 'Desconhecido'}>`, inline: true }
      )
      .setThumbnail(currentTrack.info.artworkUrl || `https://img.youtube.com/vi/${currentTrack.info.identifier}/maxresdefault.jpg`)
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
    }
  } catch (error) {
    console.error('Erro ao atualizar embed:', error);
  }
}