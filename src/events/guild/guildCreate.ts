import { Guild } from 'discord.js';
import { Event } from '../../types/events/Event';
import { logger } from '../../utils/logger';
import { MiClient } from '../../structures/MiClient';

const event: Event<'guildCreate'> = {
  name: 'guildCreate',
  once: false,
  execute(guild: Guild) {
    const client = guild.client as MiClient;
    
    logger.info('Entrou no servidor: ' + guild.name + ' (ID: ' + guild.id + ') | Membros: ' + guild.memberCount);
    
    client.user?.setPresence({
      status: 'online',
      activities: [
        {
          name: 'mi!help | Servindo música para ' + client.guilds.cache.size + ' servidores',
          type: 3 // 3 = Watching
        }
      ]
    });
    
    try {
      const defaultChannel = guild.channels.cache.find(
        channel => 
          channel.isTextBased() && 
          !channel.isThread() &&
          channel.permissionsFor(guild.members.me!)?.has(['SendMessages', 'ViewChannel'])
      );
      
      if (defaultChannel && defaultChannel.isTextBased() && !defaultChannel.isThread()) {
        defaultChannel.send({
          content: 'Olá! Obrigado por me adicionar ao servidor! Use `mi!help` para ver meus comandos ou `/help` se preferir comandos slash.'
        }).catch(() => {});
      }
    } catch (error) {
      logger.warn('Não foi possível enviar mensagem de boas-vindas no servidor ' + guild.name);
    }
  }
};

export default event;