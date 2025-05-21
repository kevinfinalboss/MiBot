import { Client } from 'discord.js';
import { Event } from '../../types/Event';
import { logger } from '../../utils/logger';

const event: Event<'ready'> = {
  name: 'ready',
  once: true,
  execute(client: Client) {
    logger.success('Bot conectado e pronto como ' + client.user?.tag);
    logger.info('Servindo para ' + client.guilds.cache.size + ' servidores');
    
    client.user?.setPresence({
      status: 'online',
      activities: [
        {
          name: 'mi!help | Servindo música para ' + client.guilds.cache.size + ' servidores',
          type: 3 // 3 = Watching
        }
      ]
    });
  }
};

export default event;