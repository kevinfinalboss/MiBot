import fs from 'fs';
import path from 'path';
import { MiClient } from '../structures/MiClient';
import { Event } from '../types/events/Event';
import { logger } from '../utils/logger';

export async function loadEvents(client: MiClient): Promise<void> {
  const eventDirs = ['client', 'guild', 'interaction', 'message', 'lavalink'];
  const loadedEvents: Set<string> = new Set();
  let eventCount = 0;
  let errorCount = 0;
  
  for (const dir of eventDirs) {
    const eventDir = path.join(__dirname, '..', 'events', dir);
    if (!fs.existsSync(eventDir)) {
      logger.error(`[Events] ❌ Diretório de eventos não existe: ${eventDir}`);
      errorCount++;
      continue;
    }
    
    const eventFiles = fs.readdirSync(eventDir).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
    
    for (const file of eventFiles) {
      try {
        const eventPath = path.join(eventDir, file);
        delete require.cache[require.resolve(eventPath)];
        
        const event = await import(eventPath) as { default: Event<any> };
        
        if (!event.default) {
          logger.error(`[Events] ❌ Evento em ${file} não tem uma exportação padrão`);
          errorCount++;
          continue;
        }
        
        const eventInstance = event.default;
        const eventName = eventInstance.name;
        const eventKey = `${dir}-${eventName}-${file}`;
        
        if (loadedEvents.has(eventKey)) {
          logger.error(`[Events] ❌ Evento duplicado encontrado: ${eventKey}`);
          errorCount++;
          continue;
        }
        
        if (dir === 'lavalink') {
          if (eventInstance.once) {
            client.once(eventName, (...args: any[]) => eventInstance.execute(client, ...args));
          } else {
            client.on(eventName, (...args: any[]) => eventInstance.execute(client, ...args));
          }
        } else {
          if (eventInstance.once) {
            client.once(eventName, (...args: any[]) => eventInstance.execute(...args));
          } else {
            client.on(eventName, (...args: any[]) => eventInstance.execute(...args));
          }
        }
        
        loadedEvents.add(eventKey);
        eventCount++;
      } catch (error) {
        logger.error(`[Events] ❌ Erro ao carregar evento ${file}: ${error instanceof Error ? error.stack || error.message : String(error)}`);
        errorCount++;
      }
    }
  }
  
  if (errorCount > 0) {
    logger.warn(`[Events] ⚠️ ${eventCount} eventos carregados com ${errorCount} erros`);
  } else {
    logger.info(`[Events] ✅ ${eventCount} eventos carregados com sucesso!`);
  }
}