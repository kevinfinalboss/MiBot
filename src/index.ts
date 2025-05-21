import { loadConfig } from './utils/loadConfig';
import { BotConfig } from './types/Config';
import { MiClient } from './structures/MiClient';
import path from 'path';
import { ShardingManager } from 'discord.js';
import { loadEvents } from './loaders/eventLoader';
import { loadCommands } from './loaders/commandLoader';
import { loadComponents } from './loaders/componentLoader';
import { logger } from './utils/logger';

async function main() {
  try {
    logger.info('[MiBot] Iniciando o bot...');
    const config = loadConfig<BotConfig>(path.resolve(__dirname, '../config.yaml'));
    
    if (config.bot.useSharding) {
      const manager = new ShardingManager(path.resolve(__dirname, './index.js'), {
        totalShards: config.bot.shards,
        token: config.bot.token,
      });

      manager.on('shardCreate', shard => {
        logger.info('[Shard] Shard ' + shard.id + ' criada.');
      });

      await manager.spawn();
      logger.info('[Shard] ' + manager.shards.size + ' shards iniciadas com sucesso');
    } else {
      const client = new MiClient(config);
      
      await loadEvents(client);
      
      await client.start();
      
      await loadCommands(client);
      await loadComponents(client);
      
      logger.info('[MiBot] Bot iniciado e pronto para uso!');
    }
  } catch (error) {
    logger.error('[MiBot] Erro ao iniciar o bot: ' + (error instanceof Error ? error.stack || error.message : String(error)));
    process.exit(1);
  }
}

main().catch(error => {
  logger.error(`[MiBot] Erro fatal: ${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exit(1);
});