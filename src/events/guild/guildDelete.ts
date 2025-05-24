import { Guild } from 'discord.js';
import { Event } from '../../types/events/Event';
import { logger } from '../../utils/logger';
import { MiClient } from '../../structures/MiClient';
import { GuildService } from '../../services/GuildService';

const event: Event<'guildDelete'> = {
  name: 'guildDelete',
  once: false,
  async execute(guild: Guild) {
    const client = guild.client as MiClient;
    const guildService = GuildService.getInstance();
    
    logger.info(`Bot removido do servidor: ${guild.name} (ID: ${guild.id}) | Membros: ${guild.memberCount}`);
    
    try {
      await guildService.handleGuildLeave(guild.id);
      
      client.user?.setPresence({
        status: 'online',
        activities: [
          {
            name: `mi!help | Servindo música para ${client.guilds.cache.size} servidores`,
            type: 3
          }
        ]
      });
      
      logger.info(`Guild ${guild.name} marcada como inativa no banco de dados`);
    } catch (error) {
      logger.error(`Erro ao processar saída da guild ${guild.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};

export default event;