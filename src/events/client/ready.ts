import { Client } from 'discord.js';
import { Event } from '../../types/events/Event';
import { logger } from '../../utils/logger';
import { MiClient } from '../../structures/MiClient';
import { GuildService } from '../../services/GuildService';

const event: Event<'ready'> = {
  name: 'ready',
  once: true,
  async execute(client: Client) {
    const miClient = client as MiClient;
    const guildService = GuildService.getInstance();
    
    logger.success('Bot conectado e pronto como ' + client.user?.tag);
    logger.info('Servindo para ' + client.guilds.cache.size + ' servidores');
    
    try {
      client.user?.setPresence({
        status: 'online',
        activities: [
          {
            name: 'mi!help | Servindo música para ' + client.guilds.cache.size + ' servidores',
            type: 3
          }
        ]
      });
      
      logger.info('Iniciando sincronização de guilds...');
      await guildService.syncAllGuilds(miClient);
      logger.success('Sincronização de guilds concluída!');
      
    } catch (error) {
      logger.error('Erro durante inicialização: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
};

export default event;