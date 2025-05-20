import { loadConfig } from './utils/loadConfig';
import { BotConfig } from './types/Config';
import { MiClient } from './structures/MiClient';
import path from 'path';
import { ShardingManager } from 'discord.js';

async function main() {
  const config = loadConfig<BotConfig>(path.resolve(__dirname, '../config.yaml'));

  if (config.bot.useSharding) {
    const manager = new ShardingManager(path.resolve(__dirname, './index.js'), {
      totalShards: config.bot.shards,
      token: config.bot.token,
    });

    manager.on('shardCreate', shard => {
      console.log(`[Shard] Shard ${shard.id} criada.`);
    });

    await manager.spawn();
  } else {
    const client = new MiClient(config);
    await client.start();
  }
}

main().catch(console.error);
