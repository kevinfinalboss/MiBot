import { Message, TextChannel, DMChannel, NewsChannel } from 'discord.js';
import { MiClient } from '../../structures/MiClient';
import { Event } from '../../types/events/Event';
import { logger } from '../../utils/logger';
import { CommandContext } from '../../types/commands/CommandContext';

const event: Event<'messageCreate'> = {
  name: 'messageCreate',
  once: false,
  async execute(message: Message) {
    try {
      const client = message.client as MiClient;
      
      if (message.author.bot) return;
      
      const prefix = client.config.bot.prefix;
      
      if (!message.content.startsWith(prefix)) return;
      
      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift()?.toLowerCase();
      
      if (!commandName) return;
      
      const command = client.commands.get(commandName) || 
                      client.commands.get(client.aliases.get(commandName) || '');
      
      if (!command) return;
      
      const { options } = command;
      if (options.type === 'SLASH') {
        message.reply(`Este comando só pode ser usado como slash command. Use \`/${commandName}\` em vez disso.`);
        return;
      }
      
      if (options.ownerOnly && !client.config.bot.ownerIds.includes(message.author.id)) {
        message.reply('Este comando só pode ser usado pelos donos do bot.');
        return;
      }
      
      if (options.guildOnly && !message.guild) {
        message.reply('Este comando só pode ser usado em servidores.');
        return;
      }
      
      if (options.dmOnly && message.guild) {
        message.reply('Este comando só pode ser usado em mensagens diretas.');
        return;
      }
      
      if (options.cooldown) {
        const cooldownKey = `${message.author.id}-${commandName}`;
        const cooldownTime = client.cooldowns.get(cooldownKey);
        
        if (cooldownTime && Date.now() < cooldownTime) {
          const remainingTime = Math.ceil((cooldownTime - Date.now()) / 1000);
          message.reply(`Por favor, aguarde ${remainingTime} segundos antes de usar este comando novamente.`);
          return;
        }
        
        client.cooldowns.set(cooldownKey, Date.now() + options.cooldown * 1000);
        
        setTimeout(() => {
          client.cooldowns.delete(cooldownKey);
        }, options.cooldown * 1000);
      }
      
      const channel = message.channel instanceof TextChannel || 
                     message.channel instanceof DMChannel || 
                     message.channel instanceof NewsChannel ? 
                     message.channel : undefined;
      
      const context: CommandContext = {
        message,
        args,
        authorId: message.author.id,
        guildId: message.guild?.id,
        channelId: message.channelId,
        member: message.member || undefined,
        channel,
        isSlash: false
      };
      
      try {
        await command.execute(client, context);
        logger.info(`Comando executado: ${commandName} por ${message.author.tag} (${message.author.id})`);
      } catch (error) {
        logger.error(`Erro ao executar comando ${commandName}: ${error instanceof Error ? error.stack || error.message : String(error)}`);
        message.reply('Ocorreu um erro ao executar este comando.').catch(() => {});
      }
    } catch (error) {
      logger.error(`Erro não tratado em messageCreate: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    }
  }
};

export default event;