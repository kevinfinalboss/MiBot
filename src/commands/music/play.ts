import { SlashCommandBuilder, EmbedBuilder, GuildMember, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types/commands/Command';
import { CommandContext } from '../../types/commands/CommandContext';
import { MiClient } from '../../structures/MiClient';
import { logger } from '../../utils/logger';
import { updateNowPlayingEmbed } from '../../utils/updateNowPlaying';
const YouTube = require('youtube-search-api');

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Reproduz música de várias plataformas')
    .addStringOption(option => 
      option.setName('query')
        .setDescription('Nome ou URL da música/playlist')
        .setRequired(true)
        .setAutocomplete(true)) as SlashCommandBuilder,

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

  async executeAutocomplete(client: MiClient, interaction: AutocompleteInteraction) {
    try {
      if (interaction.responded) return;
      
      const focusedOption = interaction.options.getFocused(true);
      
      if (focusedOption.name !== 'query') {
        await interaction.respond([]);
        return;
      }

      const query = focusedOption.value;
      
      if (!query || query.length < 2) {
        await interaction.respond([]);
        return;
      }

      const searchResults = await YouTube.GetListByKeyword(query, false, 10);
      
      if (!searchResults || !searchResults.items || searchResults.items.length === 0) {
        await interaction.respond([{ name: "Nenhum resultado encontrado", value: "no_results" }]);
        return;
      }

      const choices = searchResults.items.slice(0, 10).map((result: any) => {
        const title = result.title ? 
          (result.title.length > 60 ? result.title.substring(0, 57) + '...' : result.title) 
          : 'Título desconhecido';
        
        const author = result.channelTitle ? 
          (result.channelTitle.length > 25 ? result.channelTitle.substring(0, 22) + '...' : result.channelTitle)
          : 'Canal desconhecido';

        const displayName = `${title} - ${author}`;
        const videoUrl = result.id ? `https://www.youtube.com/watch?v=${result.id}` : result.title || 'error';

        return {
          name: displayName.slice(0, 100),
          value: videoUrl
        };
      });

      if (!interaction.responded) {
        await interaction.respond(choices);
      }
      
    } catch (error) {
      logger.error(`Erro no autocomplete: ${error instanceof Error ? error.message : String(error)}`);
      if (!interaction.responded) {
        try {
          await interaction.respond([{ name: "Erro ao buscar resultados", value: "error" }]);
        } catch (respondError) {
        }
      }
    }
  },

  async execute(client: MiClient, context: CommandContext) {
    if (context.isSlash && !context.interaction!.deferred && !context.interaction!.replied) {
      await context.interaction!.deferReply();
    }

    const member = context.member;
    if (!member || !(member instanceof GuildMember)) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('⚠️ Erro')
        .setDescription('Você precisa estar em um servidor para usar este comando!')
        .setColor('#FF0000')
        .setTimestamp();

      if (context.isSlash) {
        await context.interaction!.reply({ embeds: [errorEmbed], flags: 64 });
      } else {
        await context.message!.reply({ embeds: [errorEmbed] });
      }
      return;
    }

    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('⚠️ Erro')
        .setDescription('Você precisa estar em um canal de voz para usar este comando!')
        .setColor('#FF0000')
        .setTimestamp();

      if (context.isSlash) {
        await context.interaction!.reply({ embeds: [errorEmbed], flags: 64 });
      } else {
        await context.message!.reply({ embeds: [errorEmbed] });
      }
      return;
    }

    const permissions = voiceChannel.permissionsFor(client.user!.id);
    if (!permissions?.has('Connect') || !permissions.has('Speak')) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('⚠️ Erro')
        .setDescription('Não tenho permissão para entrar ou falar no seu canal de voz!')
        .setColor('#FF0000')
        .setTimestamp();

      if (context.isSlash) {
        await context.interaction!.reply({ embeds: [errorEmbed], flags: 64 });
      } else {
        await context.message!.reply({ embeds: [errorEmbed] });
      }
      return;
    }

    let query = '';
    if (context.isSlash) {
      query = context.interaction!.options.getString('query', true);
    } else if (context.args.length > 0) {
      query = context.args.join(' ');
    } else {
      const errorEmbed = new EmbedBuilder()
        .setTitle('⚠️ Erro')
        .setDescription('Por favor, forneça o nome ou URL da música!')
        .setColor('#FF0000')
        .setTimestamp();

      if (context.isSlash) {
        await context.interaction!.reply({ embeds: [errorEmbed], flags: 64 });
      } else {
        await context.message!.reply({ embeds: [errorEmbed] });
      }
      return;
    }

    try {
      let player = client.lavalink.getPlayer(context.guildId!);
      
      if (!player) {
        player = client.lavalink.createPlayer({
          guildId: context.guildId!,
          voiceChannelId: voiceChannel.id,
          textChannelId: context.channelId,
          selfDeaf: true,
          volume: 80
        });
        player.connect();
      }

      const res = await player.search({
        query: query,
        source: client.config.lavalink.defaultSearchEngine as any
      }, member);

      if (res.loadType === 'error' || res.loadType === 'empty') {
        const errorEmbed = new EmbedBuilder()
          .setTitle('❌ Não Encontrado')
          .setDescription(`Nenhum resultado encontrado para: \`${query}\``)
          .setColor('#FF0000')
          .setTimestamp();

        if (context.isSlash) {
          await context.interaction!.editReply({ embeds: [errorEmbed] });
        } else {
          await context.message!.reply({ embeds: [errorEmbed] });
        }
        return;
      }

      await cleanupOldMusicMessages(context.channelId, client);

      if (res.loadType === 'playlist') {
        const playlist = res.playlist!;
        
        for (const track of res.tracks) {
          player.queue.add(track);
        }
        
        const totalDuration = res.tracks.reduce((acc: number, track: any) => acc + (track.info.duration || 0), 0);
        
        const ephemeralEmbed = new EmbedBuilder()
          .setTitle('📋 Playlist Adicionada')
          .setColor('#9F59FF')
          .setDescription(`**${playlist.name}**`)
          .addFields(
            { name: '🎵 Total de faixas', value: `${res.tracks.length} músicas`, inline: true },
            { name: '⏱️ Duração total', value: formatTime(totalDuration), inline: true },
            { name: '👤 Adicionado por', value: `<@${member.id}>`, inline: true }
          )
          .setTimestamp();

        if (playlist.thumbnail) {
          ephemeralEmbed.setThumbnail(playlist.thumbnail);
        }

        if (context.isSlash) {
          await context.interaction!.followUp({ embeds: [ephemeralEmbed], flags: 64 });
        } else {
          await context.message!.reply({ embeds: [ephemeralEmbed] });
        }
        
        if (!player.playing && !player.paused) {
          await player.play();
        }
      } else {
        const track = res.tracks[0];
        player.queue.add(track);

        if (context.isSlash) {
          await context.interaction!.deleteReply();
        }

        if (player.playing) {
          await updateNowPlayingEmbed(client, player);
        }
        
        if (!player.playing) {
          await player.play();
        }
      }
    } catch (error) {
      logger.error(`Erro ao executar comando play: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erro')
        .setDescription('Ocorreu um erro ao tentar reproduzir esta música!')
        .setColor('#FF0000')
        .setTimestamp();

      if (context.isSlash) {
        if (context.interaction!.deferred) {
          await context.interaction!.editReply({ embeds: [errorEmbed] });
        } else if (!context.interaction!.replied) {
          await context.interaction!.reply({ embeds: [errorEmbed] });
        }
      } else {
        await context.message!.reply({ embeds: [errorEmbed] });
      }
    }
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

async function cleanupOldMusicMessages(channelId: string, client: MiClient) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !('messages' in channel)) return;

    const messages = await channel.messages.fetch({ limit: 20 });
    const botMessages = messages.filter(msg => 
      msg.author.id === client.user!.id && 
      msg.embeds.length > 0 &&
      (msg.embeds[0].title?.includes('🎵') || msg.embeds[0].title?.includes('📭'))
    );

    for (const message of botMessages.values()) {
      try {
        await message.delete();
      } catch (error) {
      }
    }
  } catch (error) {
  }
}

export default command;