import { StringSelectMenuInteraction, EmbedBuilder, ChannelType, TextChannel } from 'discord.js';
import { MiClient } from '../../../structures/MiClient';
import { GuildService } from '../../../services/GuildService';

interface SelectMenuComponent {
  customId: string;
  execute: (client: MiClient, interaction: StringSelectMenuInteraction) => Promise<void>;
}

const component: SelectMenuComponent = {
  customId: 'config_channel_select',

  async execute(client: MiClient, interaction: StringSelectMenuInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Comando Restrito')
            .setDescription('**Este comando só pode ser usado em servidores.**\n\nTente usar o comando em um canal de texto de um servidor.')
            .setColor(0xFF0000)
            .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
            .setFooter({
              text: `Mi Bot • Comando Restrito • ${interaction.user.username}`,
              iconURL: client.user?.displayAvatarURL() || undefined
            })
            .setTimestamp()
        ],
        ephemeral: true
      });
      return;
    }

    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Permissão Insuficiente')
            .setDescription('**Você precisa ter permissão de Administrador.**\n\nApenas administradores podem configurar os canais do servidor.')
            .setColor(0xFF0000)
            .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
            .setFooter({
              text: `Mi Bot • Sem Permissão • ${interaction.user.username}`,
              iconURL: client.user?.displayAvatarURL() || undefined
            })
            .setTimestamp()
        ],
        ephemeral: true
      });
      return;
    }

    const selectedValue = interaction.values[0];
    
    const channelTypes: Record<string, { name: string; emoji: string; description: string }> = {
      welcome: {
        name: 'Entrada',
        emoji: '📥',
        description: 'boas-vindas aos novos membros'
      },
      leave: {
        name: 'Saída',
        emoji: '📤',
        description: 'despedidas dos membros que saíram'
      },
      commands: {
        name: 'Comandos',
        emoji: '⌨️',
        description: 'execução de comandos do bot'
      },
      music: {
        name: 'Música',
        emoji: '🎵',
        description: 'comandos de música'
      },
      audit: {
        name: 'Auditoria',
        emoji: '🛡️',
        description: 'logs de moderação e auditoria'
      },
      logs: {
        name: 'Logs',
        emoji: '📋',
        description: 'logs gerais do bot'
      }
    };

    const channelInfo = channelTypes[selectedValue];
    
    if (!channelInfo) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Seleção Inválida')
            .setDescription('**Tipo de canal não reconhecido.**\n\nTente usar o comando `/config` novamente e selecione uma opção válida.')
            .setColor(0xFF0000)
            .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
            .setFooter({
              text: `Mi Bot • Seleção Inválida • ${interaction.user.username}`,
              iconURL: client.user?.displayAvatarURL() || undefined
            })
            .setTimestamp()
        ],
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`${channelInfo.emoji} Configurar Canal de ${channelInfo.name}`)
      .setDescription(
        `**Configure o canal de ${channelInfo.name.toLowerCase()}** para ${channelInfo.description}\n\n` +
        `**🔹 Opção 1:** Mencione o canal\n` +
        `\`\`\`\n#${channelInfo.name.toLowerCase()}\n\`\`\`\n` +
        `**🔹 Opção 2:** Digite o ID do canal\n` +
        `\`\`\`\n123456789012345678\n\`\`\`\n` +
        `**🔹 Opção 3:** Remover configuração atual\n` +
        `\`\`\`\nremover\n\`\`\`\n` +
        `⏰ **Tempo limite:** 60 segundos`
      )
      .setColor(0x5865F2)
      .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
      .setFooter({
        text: `Mi Bot • Digite sua resposta no chat • ${interaction.user.username}`,
        iconURL: client.user?.displayAvatarURL() || undefined
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });

    const channel = interaction.channel as TextChannel;
    if (!channel || !('awaitMessages' in channel)) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Canal Indisponível')
            .setDescription('**Não foi possível aguardar mensagens neste canal.**\n\nTente usar o comando em um canal de texto onde o bot tenha permissões adequadas.')
            .setColor(0xFF0000)
            .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
            .setFooter({
              text: `Mi Bot • Erro de Permissão • ${interaction.user.username}`,
              iconURL: client.user?.displayAvatarURL() || undefined
            })
            .setTimestamp()
        ]
      });
      return;
    }

    const filter = (message: any) => {
      return message.author.id === interaction.user.id;
    };

    try {
      const collected = await channel.awaitMessages({
        filter,
        max: 1,
        time: 60000,
        errors: ['time']
      });

      const message = collected?.first();
      if (!message) return;

      const content = message.content.trim().toLowerCase();
      
      if (content === 'remover' || content === 'remove') {
        await removeChannelConfig(client, interaction, selectedValue, channelInfo);
        await message.delete().catch(() => {});
        return;
      }

      let channelId: string | null = null;

      const channelMention = message.content.match(/<#(\d+)>/);
      if (channelMention) {
        channelId = channelMention[1];
      } else if (/^\d+$/.test(message.content.trim())) {
        channelId = message.content.trim();
      }

      if (!channelId) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ Formato Inválido')
              .setDescription('**Por favor, use um formato válido:**\n\n• Mencione o canal: `#canal`\n• Digite o ID: `123456789012345678`\n• Para remover: `remover`')
              .setColor(0xFF0000)
              .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
              .setFooter({
                text: `Mi Bot • Formato Inválido • ${interaction.user.username}`,
                iconURL: client.user?.displayAvatarURL() || undefined
              })
              .setTimestamp()
          ]
        });
        await message.delete().catch(() => {});
        return;
      }

      const targetChannel = await interaction.guild?.channels.fetch(channelId).catch(() => null);
      
      if (!targetChannel) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ Canal Não Encontrado')
              .setDescription(`**O canal especificado não foi encontrado.**\n\nVerifique se:\n• O canal existe neste servidor\n• O ID está correto\n• Você mencionou o canal corretamente`)
              .setColor(0xFF0000)
              .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
              .setFooter({
                text: `Mi Bot • Canal Não Encontrado • ${interaction.user.username}`,
                iconURL: client.user?.displayAvatarURL() || undefined
              })
              .setTimestamp()
          ]
        });
        await message.delete().catch(() => {});
        return;
      }

      if (targetChannel.type !== ChannelType.GuildText && targetChannel.type !== ChannelType.GuildNews) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ Tipo de Canal Inválido')
              .setDescription('**Apenas canais de texto podem ser configurados.**\n\nTipos suportados:\n• 📝 Canais de Texto\n• 📢 Canais de Anúncios')
              .setColor(0xFF0000)
              .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
              .setFooter({
                text: `Mi Bot • Tipo Inválido • ${interaction.user.username}`,
                iconURL: client.user?.displayAvatarURL() || undefined
              })
              .setTimestamp()
          ]
        });
        await message.delete().catch(() => {});
        return;
      }

      await updateChannelConfig(client, interaction, selectedValue, channelId, channelInfo, targetChannel.name);
      await message.delete().catch(() => {});

    } catch (error) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('⏰ Tempo Esgotado')
            .setDescription('**Você não respondeu a tempo.**\n\nPara tentar novamente, use o comando `/config` e selecione a opção desejada.')
            .setColor(0xFFAA00)
            .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
            .setFooter({
              text: `Mi Bot • Tempo Esgotado • ${interaction.user.username}`,
              iconURL: client.user?.displayAvatarURL() || undefined
            })
            .setTimestamp()
        ]
      });
    }
  }
};

async function updateChannelConfig(
  client: MiClient, 
  interaction: StringSelectMenuInteraction, 
  configType: string, 
  channelId: string,
  channelInfo: { name: string; emoji: string; description: string },
  channelName: string
) {
  try {
    const guildService = GuildService.getInstance();

    const channelConfigMap: Record<string, string> = {
      welcome: 'welcomeChannelId',
      leave: 'leaveChannelId',
      commands: 'commandsChannelId',
      music: 'musicsChannelId',
      audit: 'auditChannelId',
      logs: 'logsChannelId'
    };

    const configKey = channelConfigMap[configType];
    if (!configKey) return;

    await guildService.updateGuildChannels(interaction.guildId!, {
      [configKey]: channelId
    });

    const successEmbed = new EmbedBuilder()
      .setTitle(`${channelInfo.emoji} Configuração Atualizada`)
      .setDescription(
        `**Canal de ${channelInfo.name.toLowerCase()} configurado com sucesso!**\n\n` +
        `**📍 Canal Configurado:** <#${channelId}>\n` +
        `**📝 Nome do Canal:** \`#${channelName}\`\n` +
        `**🎯 Função:** ${channelInfo.description}\n` +
        `**👤 Configurado por:** ${interaction.user}\n` +
        `**🕒 Data:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setColor(0x00FF88)
      .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
      .setFooter({
        text: `Mi Bot • Configuração Salva • ${interaction.user.username}`,
        iconURL: client.user?.displayAvatarURL() || undefined
      })
      .setTimestamp();

    await interaction.editReply({
      embeds: [successEmbed]
    });

  } catch (error) {
    console.error('Erro ao atualizar configuração:', error);
    
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('❌ Erro ao Salvar Configuração')
          .setDescription('**Ocorreu um erro interno ao salvar a configuração.**\n\nTente novamente em alguns momentos. Se o problema persistir, entre em contato com o suporte.')
          .setColor(0xFF0000)
          .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
          .setFooter({
            text: `Mi Bot • Erro Interno • ${interaction.user.username}`,
            iconURL: client.user?.displayAvatarURL() || undefined
          })
          .setTimestamp()
      ]
    });
  }
}

async function removeChannelConfig(
  client: MiClient, 
  interaction: StringSelectMenuInteraction, 
  configType: string,
  channelInfo: { name: string; emoji: string; description: string }
) {
  try {
    const guildService = GuildService.getInstance();

    const channelConfigMap: Record<string, string> = {
      welcome: 'welcomeChannelId',
      leave: 'leaveChannelId',
      commands: 'commandsChannelId',
      music: 'musicsChannelId',
      audit: 'auditChannelId',
      logs: 'logsChannelId'
    };

    const configKey = channelConfigMap[configType];
    if (!configKey) return;

    await guildService.updateGuildChannels(interaction.guildId!, {
      [configKey]: undefined
    });

    const successEmbed = new EmbedBuilder()
      .setTitle(`${channelInfo.emoji} Configuração Removida`)
      .setDescription(
        `**Canal de ${channelInfo.name.toLowerCase()} removido com sucesso!**\n\n` +
        `A configuração foi limpa do sistema e não será mais utilizada pelo bot.\n\n` +
        `**👤 Removido por:** ${interaction.user}\n` +
        `**🕒 Data:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setColor(0xFF9500)
      .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
      .setFooter({
        text: `Mi Bot • Configuração Removida • ${interaction.user.username}`,
        iconURL: client.user?.displayAvatarURL() || undefined
      })
      .setTimestamp();

    await interaction.editReply({
      embeds: [successEmbed]
    });

  } catch (error) {
    console.error('Erro ao remover configuração:', error);
    
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('❌ Erro ao Remover Configuração')
          .setDescription('**Ocorreu um erro interno ao remover a configuração.**\n\nTente novamente em alguns momentos. Se o problema persistir, entre em contato com o suporte.')
          .setColor(0xFF0000)
          .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
          .setFooter({
            text: `Mi Bot • Erro Interno • ${interaction.user.username}`,
            iconURL: client.user?.displayAvatarURL() || undefined
          })
          .setTimestamp()
      ]
    });
  }
}

export default component;