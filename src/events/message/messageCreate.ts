import { Event } from '../../types/Event';
import { logger } from '../../utils/logger';

const event: Event<'messageCreate'> = {
  name: 'messageCreate',
  execute(message) {
    if (message.author.bot) return;
    logger.info(`Mensagem recebida de ${message.author.tag}: ${message.content}`);
  },
};

export default event;
