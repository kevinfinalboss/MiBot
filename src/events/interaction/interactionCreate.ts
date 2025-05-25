import { Interaction, GuildMember, TextChannel, DMChannel, NewsChannel } from 'discord.js';
import { MiClient } from '../../structures/MiClient';
import { Event } from '../../types/events/Event';
import { logger } from '../../utils/logger';
import { CommandContext } from '../../types/commands/CommandContext';
import { CommandLogService } from '../../services/CommandLogService';
import { AuditService } from '../../services/AuditService';
import { ChannelRestrictionsService } from '../../services/ChannelRestrictionsService';

const event: Event<'interactionCreate'> = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction: Interaction) {
    const client = interaction.client as MiClient;
    const commandLogService = CommandLogService.getInstance();
    const auditService = AuditService.getInstance();
    const restrictionsService = ChannelRestrictionsService.getInstance();
    
    try {
      if (interaction.isChatInputCommand()) {
        const commandName = interaction.commandName;
        const command = client.commands.get(commandName);
        const startTime = Date.now();
        
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
        
        if (interaction.guildId) {
          const restrictionCheck = await restrictionsService.checkCommandChannelRestriction(
            client, 
            context, 
            commandName, 
            options.categoria
          );
          
          if (!restrictionCheck.allowed && restrictionCheck.embed) {
            await interaction.reply({
              embeds: [restrictionCheck.embed],
              ephemeral: true
            });
            return;
          }
        }
        
        let success = false;
        let error: Error | undefined;
        
        try {
          await command.execute(client, context);
          success = true;
          logger.info(`Comando executado: ${commandName} por ${interaction.user.tag} (${interaction.user.id})`);
        } catch (commandError) {
          error = commandError instanceof Error ? commandError : new Error(String(commandError));
          logger.error(`Erro ao executar comando ${commandName}: ${error.stack || error.message}`);
          
          const errorMessage = 'Ocorreu um erro ao executar este comando.';
          
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true }).catch(() => {});
          } else {
            await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => {});
          }
        } finally {
          const executionTime = Date.now() - startTime;
          await commandLogService.logCommandExecution(client, command, context, success, executionTime, error);
          
          if (interaction.guildId) {
            await auditService.logCommandExecution(
              client,
              interaction.guildId,
              interaction.user.id,
              interaction.user.username,
              commandName,
              'SLASH',
              success,
              executionTime,
              interaction.channelId,
              error?.message
            );
          }
        }
      }
      
      else if (interaction.isButton()) {
        const buttonId = interaction.customId;
        const button = client.buttons?.get(buttonId);
        
        if (interaction.guildId) {
          const restrictionCheck = await restrictionsService.checkButtonMusicRestriction(
            client,
            interaction.guildId,
            interaction.channelId,
            interaction.user.username,
            buttonId
          );
          
          if (!restrictionCheck.allowed && restrictionCheck.embed) {
            await interaction.reply({
              embeds: [restrictionCheck.embed],
              ephemeral: true
            });
            
            await auditService.logButtonInteraction(
              client,
              interaction.guildId,
              interaction.user.id,
              interaction.user.username,
              buttonId,
              interaction.channelId,
              false,
              'Canal restrito para botões de música'
            );
            return;
          }
        }
        
        if (button) {
          let success = false;
          let errorMsg: string | undefined;
          
          try {
            await button.execute(client, interaction);
            success = true;
          } catch (error) {
            errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`Erro ao executar botão ${buttonId}: ${error instanceof Error ? error.stack || error.message : String(error)}`);
            
            if (interaction.replied || interaction.deferred) {
              await interaction.followUp({ content: 'Ocorreu um erro ao processar este botão.', ephemeral: true }).catch(() => {});
            } else {
              await interaction.reply({ content: 'Ocorreu um erro ao processar este botão.', ephemeral: true }).catch(() => {});
            }
          } finally {
            if (interaction.guildId) {
              await auditService.logButtonInteraction(
                client,
                interaction.guildId,
                interaction.user.id,
                interaction.user.username,
                buttonId,
                interaction.channelId,
                success,
                errorMsg
              );
            }
          }
        }
      }
      
      else if (interaction.isStringSelectMenu()) {
        const menuId = interaction.customId;
        const menu = client.selectMenus?.get(menuId);
        
        if (menu) {
          let success = false;
          let errorMsg: string | undefined;
          
          try {
            await menu.execute(client, interaction);
            success = true;
          } catch (error) {
            errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`Erro ao executar menu ${menuId}: ${error instanceof Error ? error.stack || error.message : String(error)}`);
            
            if (interaction.replied || interaction.deferred) {
              await interaction.followUp({ content: 'Ocorreu um erro ao processar este menu.', ephemeral: true }).catch(() => {});
            } else {
              await interaction.reply({ content: 'Ocorreu um erro ao processar este menu.', ephemeral: true }).catch(() => {});
            }
          } finally {
            if (interaction.guildId) {
              await auditService.logMenuInteraction(
                client,
                interaction.guildId,
                interaction.user.id,
                interaction.user.username,
                menuId,
                interaction.values,
                interaction.channelId,
                success,
                errorMsg
              );
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