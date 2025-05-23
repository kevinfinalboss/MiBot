import { Interaction, GuildMember, TextChannel, DMChannel, NewsChannel } from 'discord.js';
import { MiClient } from '../../structures/MiClient';
import { Event } from '../../types/events/Event';
import { logger } from '../../utils/logger';
import { CommandContext } from '../../types/commands/CommandContext';

const event: Event<'interactionCreate'> = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction: Interaction) {
    const client = interaction.client as MiClient;
    
    try {
      if (interaction.isChatInputCommand()) {
        const commandName = interaction.commandName;
        const command = client.commands.get(commandName);
        
        if (!command) {
          logger.warn('Comando não encontrado: ' + commandName);
          return;
        }
        
        const { options } = command;
        
        if (options.ownerOnly && !client.config.bot.ownerIds.includes(interaction.user.id)) {
          await interaction.reply({
            content: 'Este comando só pode ser usado pelos donos do bot.',
            ephemeral: true
          });
          return;
        }
        
        if (options.guildOnly && !interaction.guildId) {
          await interaction.reply({
            content: 'Este comando só pode ser usado em servidores.',
            ephemeral: true
          });
          return;
        }
        
        if (options.dmOnly && interaction.guildId) {
          await interaction.reply({
            content: 'Este comando só pode ser usado em mensagens diretas.',
            ephemeral: true
          });
          return;
        }
        
        if (options.cooldown) {
          const cooldownKey = `${interaction.user.id}-${commandName}`;
          const cooldownTime = client.cooldowns.get(cooldownKey);
          
          if (cooldownTime && Date.now() < cooldownTime) {
            const remainingTime = Math.ceil((cooldownTime - Date.now()) / 1000);
            await interaction.reply({
              content: `Por favor, aguarde ${remainingTime} segundos antes de usar este comando novamente.`,
              ephemeral: true
            });
            return;
          }
          
          client.cooldowns.set(cooldownKey, Date.now() + options.cooldown * 1000);
          
          setTimeout(() => {
            client.cooldowns.delete(cooldownKey);
          }, options.cooldown * 1000);
        }
        
        const context: CommandContext = {
          interaction,
          args: [],
          authorId: interaction.user.id,
          guildId: interaction.guildId || undefined,
          channelId: interaction.channelId,
          member: interaction.member instanceof GuildMember ? interaction.member : undefined,
          channel: (interaction.channel && (
            interaction.channel instanceof TextChannel || 
            interaction.channel instanceof DMChannel || 
            interaction.channel instanceof NewsChannel
          )) ? interaction.channel : undefined,
          isSlash: true
        };
        
        try {
          await command.execute(client, context);
          logger.info(`Comando executado: ${commandName} por ${interaction.user.tag} (${interaction.user.id})`);
        } catch (error) {
          logger.error(`Erro ao executar comando ${commandName}: ${error instanceof Error ? error.stack || error.message : String(error)}`);
          
          const errorMessage = 'Ocorreu um erro ao executar este comando.';
          
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true }).catch(() => {});
          } else {
            await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => {});
          }
        }
      }
      
      else if (interaction.isButton()) {
        const buttonId = interaction.customId;
        const button = client.buttons?.get(buttonId);
        
        if (button) {
          try {
            await button.execute(client, interaction);
          } catch (error) {
            logger.error(`Erro ao executar botão ${buttonId}: ${error instanceof Error ? error.stack || error.message : String(error)}`);
            
            if (interaction.replied || interaction.deferred) {
              await interaction.followUp({ content: 'Ocorreu um erro ao processar este botão.', ephemeral: true }).catch(() => {});
            } else {
              await interaction.reply({ content: 'Ocorreu um erro ao processar este botão.', ephemeral: true }).catch(() => {});
            }
          }
        }
      }
      
      else if (interaction.isStringSelectMenu()) {
        const menuId = interaction.customId;
        const menu = client.selectMenus?.get(menuId);
        
        if (menu) {
          try {
            await menu.execute(client, interaction);
          } catch (error) {
            logger.error(`Erro ao executar menu ${menuId}: ${error instanceof Error ? error.stack || error.message : String(error)}`);
            
            if (interaction.replied || interaction.deferred) {
              await interaction.followUp({ content: 'Ocorreu um erro ao processar este menu.', ephemeral: true }).catch(() => {});
            } else {
              await interaction.reply({ content: 'Ocorreu um erro ao processar este menu.', ephemeral: true }).catch(() => {});
            }
          }
        }
      }
      
      else if (interaction.isModalSubmit()) {
        const modalId = interaction.customId;
        const modal = client.modals?.get(modalId);
        
        if (modal) {
          try {
            await modal.execute(client, interaction);
          } catch (error) {
            logger.error(`Erro ao executar modal ${modalId}: ${error instanceof Error ? error.stack || error.message : String(error)}`);
            
            if (interaction.replied || interaction.deferred) {
              await interaction.followUp({ content: 'Ocorreu um erro ao processar este formulário.', ephemeral: true }).catch(() => {});
            } else {
              await interaction.reply({ content: 'Ocorreu um erro ao processar este formulário.', ephemeral: true }).catch(() => {});
            }
          }
        }
      }
      
      else if (interaction.isAutocomplete()) {
        const commandName = interaction.commandName;
        const command = client.commands.get(commandName);
        
        if (command && typeof (command as any).executeAutocomplete === 'function') {
          try {
            await (command as any).executeAutocomplete(client, interaction);
          } catch (error) {
            logger.error(`Erro ao executar autocomplete para ${commandName}: ${error instanceof Error ? error.stack || error.message : String(error)}`);
          }
        }
      }
    } catch (error) {
      logger.error(`Erro não tratado em interactionCreate: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    }
  }
};

export default event;