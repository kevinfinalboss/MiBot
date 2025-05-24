import { Guild } from 'discord.js';
import { Event } from '../../types/events/Event';
import { logger } from '../../utils/logger';
import { MiClient } from '../../structures/MiClient';
import { GuildService } from '../../services/GuildService';

const event: Event<'guildCreate'> = {
  name: 'guildCreate',
  once: false,
  async execute(guild: Guild) {
    const client = guild.client as MiClient;
    const guildService = GuildService.getInstance();
    
    logger.info(`Bot adicionado ao servidor: ${guild.name} (ID: ${guild.id}) | Membros: ${guild.memberCount}`);
    
    try {
      await guildService.handleGuildJoin(guild);
      
      client.user?.setPresence({
        status: 'online',
        activities: [
          {
            name: `mi!help | Servindo música para ${client.guilds.cache.size} servidores`,
            type: 3
          }
        ]
      });
      
      logger.success(`Guild ${guild.name} registrada no banco de dados com sucesso!`);
    } catch (error) {
      logger.error(`Erro ao processar entrada na guild ${guild.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};

export default event;