import { Event } from '../../types/Event';
import { logger } from '../../utils/logger';

const event: Event<'guildCreate'> = {
  name: 'guildCreate',
  execute(guild) {
    logger.info(`Entrei no servidor: ${guild.name} (${guild.id})`);
  },
};

export default event;
