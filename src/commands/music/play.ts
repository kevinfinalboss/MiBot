import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, GuildMember, TextChannel } from 'discord.js';
import { Command } from '../../types/commands/Command';
import { CommandContext } from '../../types/commands/CommandContext';
import { MiClient } from '../../structures/MiClient';
import { logger } from '../../utils/logger';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Reproduz música de várias plataformas')
    .addStringOption(option => 
      option.setName('query')
        .setDescription('Nome ou URL da música/playlist')
        .setRequired(true)) as SlashCommandBuilder,

  options: {
    categoria: 'Util',
    type: 'HYBRID',
    aliases: ['p', 'tocar'],
    cooldown: 3,
    guildOnly: true,
    visible: true,
    usage: 'play <música>',
    examples: ['play lofi', 'play https://www.youtube.com/watch?v=dQw4w9WgXcQ']
  },

  async execute(client: MiClient, context: CommandContext) {
    const member = context.member;
    if (!member || !(member instanceof GuildMember)) {
      await sendErrorEmbed(context, '⚠️ Erro', 'Você precisa estar em um servidor para usar este comando!');
      return;
    }

    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      await sendErrorEmbed(context, '⚠️ Erro', 'Você precisa estar em um canal de voz para usar este comando!');
      return;
    }

    const permissions = voiceChannel.permissionsFor(client.user!.id);
    if (!permissions?.has('Connect') || !permissions.has('Speak')) {
      await sendErrorEmbed(context, '⚠️ Erro', 'Não tenho permissão para entrar ou falar no seu canal de voz!');
      return;
    }

    let query = '';
    if (context.isSlash) {
      query = context.interaction!.options.getString('query', true);
    } else if (context.args.length > 0) {
      query = context.args.join(' ');
    } else {
      await sendErrorEmbed(context, '⚠️ Erro', 'Por favor, forneça o nome ou URL da música!');
      return;
    }

    await sendEmbed(context, '🔍 Procurando...', `Procurando por: \`${query}\``);

    try {
      const player = client.lavalink.createPlayer({
        guildId: context.guildId!,
        voiceChannelId: voiceChannel.id,
        textChannelId: context.channelId,
        selfDeaf: true,
        volume: 80
      });

      player.connect();

      const res = await player.search({
        query: query,
        source: client.config.lavalink.defaultSearchEngine as any
      }, member);

      if (res.loadType === 'error' || res.loadType === 'empty') {
        await sendErrorEmbed(context, '❌ Não Encontrado', `Nenhum resultado encontrado para: \`${query}\``);
        return;
      }

      if (res.loadType === 'playlist') {
        const playlist = res.playlist!;
        
        for (const track of res.tracks) {
          player.queue.add(track);
        }
        
        const totalDuration = res.tracks.reduce((acc: number, track: any) => acc + (track.info.duration || 0), 0);
        const queuePosition = player.queue.tracks.length - res.tracks.length + 1;
        
        const embed = new EmbedBuilder()
          .setTitle('📋 Playlist Adicionada à Fila')
          .setColor('#9F59FF')
          .setDescription(`**${playlist.name}**`)
          .addFields(
            { name: '👤 Solicitado por', value: `<@${member.id}>`, inline: true },
            { name: '🎵 Total de faixas', value: `${res.tracks.length} músicas`, inline: true },
            { name: '⏱️ Duração total', value: formatTime(totalDuration), inline: true },
            { name: '📍 Posição na fila', value: `${queuePosition} - ${queuePosition + res.tracks.length - 1}`, inline: true },
            { name: '🎧 Canal de voz', value: voiceChannel.name, inline: true },
            { name: '📊 Fila atual', value: `${player.queue.tracks.length} música(s)`, inline: true }
          )
          .setFooter({ text: `${res.tracks.length} faixas adicionadas` })
          .setTimestamp();

        if (playlist.thumbnail) {
          embed.setThumbnail(playlist.thumbnail);
        }

        await sendEmbedObject(context, embed);
        
        if (!player.playing && !player.paused) {
          await player.play();
        }
      } else {
        const track = res.tracks[0];
        const queuePosition = player.queue.tracks.length + 1;
        
        player.queue.add(track);

        const embed = new EmbedBuilder()
          .setTitle('🎵 Música Adicionada à Fila')
          .setColor('#00FF88')
          .setDescription(`**[${track.info.title}](${track.info.uri})**`)
          .addFields(
            { name: '👤 Solicitado por', value: `<@${member.id}>`, inline: true },
            { name: '👨‍🎤 Artista', value: track.info.author || 'Desconhecido', inline: true },
            { name: '⏱️ Duração', value: formatTime(track.info.duration || 0), inline: true },
            { name: '📍 Posição na fila', value: player.queue.tracks.length === 1 ? '🔄 Tocando agora' : `#${queuePosition}`, inline: true },
            { name: '🎧 Canal de voz', value: voiceChannel.name, inline: true },
            { name: '📊 Fila atual', value: `${player.queue.tracks.length} música(s)`, inline: true }
          )
          .setThumbnail(track.info.artworkUrl || `https://img.youtube.com/vi/${track.info.identifier}/maxresdefault.jpg`)
          .setFooter({ 
            text: player.queue.tracks.length === 1 ? 'Reproduzindo agora' : `${player.queue.tracks.length - 1} música(s) na fila`
          })
          .setTimestamp();

        if (player.queue.tracks.length > 1) {
          const nextTracks = player.queue.tracks.slice(0, 3);
          const nextTracksText = nextTracks.map((t: any, index: number) => 
            `**${index + 2}.** [${t.info.title}](${t.info.uri}) - \`${formatTime(t.info.duration || 0)}\``
          ).join('\n');
          
          if (nextTracksText) {
            embed.addFields({
              name: '🔜 Próximas na fila',
              value: nextTracksText + (player.queue.tracks.length > 4 ? `\n*... e mais ${player.queue.tracks.length - 4} música(s)*` : ''),
              inline: false
            });
          }
        }
        
        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('music_resume')
              .setLabel('Retomar')
              .setStyle(ButtonStyle.Success)
              .setEmoji('▶️'),
            new ButtonBuilder()
              .setCustomId('music_pause')
              .setLabel('Pausar')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('⏸️'),
            new ButtonBuilder()
              .setCustomId('music_stop')
              .setLabel('Parar')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('⏹️'),
            new ButtonBuilder()
              .setCustomId('music_queue')
              .setLabel('Ver Fila')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('📋')
          );

        await sendEmbedObject(context, embed, row);
        
        if (!player.playing) {
          await player.play();
        }
      }
    } catch (error) {
      logger.error(`Erro ao executar comando play: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      await sendErrorEmbed(context, '❌ Erro', 'Ocorreu um erro ao tentar reproduzir esta música!');
    }
  }
};

async function sendEmbed(context: CommandContext, title: string, description: string) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor('#00BFFF')
    .setTimestamp();
  
  if (context.isSlash) {
    if (context.interaction!.deferred || context.interaction!.replied) {
      await context.interaction!.editReply({ embeds: [embed] });
    } else {
      await context.interaction!.reply({ embeds: [embed] });
    }
  } else {
    await context.message!.reply({ embeds: [embed] });
  }
}

async function sendErrorEmbed(context: CommandContext, title: string, description: string) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor('#FF0000')
    .setTimestamp();
  
  if (context.isSlash) {
    if (context.interaction!.deferred || context.interaction!.replied) {
      await context.interaction!.editReply({ embeds: [embed] });
    } else {
      await context.interaction!.reply({ embeds: [embed] });
    }
  } else {
    await context.message!.reply({ embeds: [embed] });
  }
}

async function sendEmbedObject(context: CommandContext, embed: EmbedBuilder, row?: ActionRowBuilder<ButtonBuilder>) {
  const payload = row ? { embeds: [embed], components: [row] } : { embeds: [embed] };
  
  if (context.isSlash) {
    if (context.interaction!.deferred || context.interaction!.replied) {
      await context.interaction!.editReply(payload);
    } else {
      await context.interaction!.reply(payload);
    }
  } else {
    await context.message!.reply(payload);
  }
}

function getMemberName(member: GuildMember): string {
  return member.nickname || member.user.username;
}

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

export default command;