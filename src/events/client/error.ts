import { Event } from '../../types/Event';
import { logger } from '../../utils/logger';

const event: Event<'error'> = {
  name: 'error',
  execute(error) {
    logger.error(`Erro no client: ${error.message}`);
  },
};

export default event;
