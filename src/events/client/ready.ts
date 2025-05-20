import { Event } from '../../types/Event';
import { logger } from '../../utils/logger';

const event: Event<'ready'> = {
  name: 'ready',
  once: true,
  execute(client) {
    logger.success(`Bot online como ${client.user?.tag}`);
  },
};

export default event;
