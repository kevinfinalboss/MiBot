import fs from 'fs';
import path from 'path';
import { ApplicationCommand, REST, Routes } from 'discord.js';
import { MiClient } from '../structures/MiClient';
import { Command } from '../types/commands/Command';
import { logger } from '../utils/logger';

export async function loadCommands(client: MiClient): Promise<void> {
  const commandsDir = path.join(__dirname, '..', 'commands');
  const commandsPath = fs.existsSync(commandsDir) ? commandsDir : null;
  
  if (!commandsPath) {
    logger.warn('[Comandos] Diretório de comandos não existe');
    return;
  }
  
  let commandCount = 0;
  let errorCount = 0;
  const commandsToRegister: any[] = [];
  const loadedCommandNames: Set<string> = new Set();
  
  client.commands.clear();
  client.aliases.clear();
  
  async function loadCommandsRecursively(dirPath: string, relativePath: string = ''): Promise<void> {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const itemStat = fs.statSync(itemPath);
      const currentRelativePath = relativePath ? `${relativePath}/${item}` : item;
      
      if (itemStat.isDirectory()) {
        await loadCommandsRecursively(itemPath, currentRelativePath);
      } else if (itemStat.isFile() && (item.endsWith('.ts') || item.endsWith('.js'))) {
        await loadSingleCommand(itemPath, currentRelativePath);
      }
    }
  }
  
  async function loadSingleCommand(commandPath: string, relativePath: string): Promise<void> {
    try {
      const command = await import(commandPath) as { default: Command };
      
      if (!command.default) {
        logger.error(`[Comandos] ❌ Comando em ${relativePath} não tem uma exportação padrão`);
        errorCount++;
        return;
      }
      
      const commandInstance = command.default;
      
      if (!commandInstance.data) {
        logger.error(`[Comandos] ❌ Comando em ${relativePath} não tem data definida`);
        errorCount++;
        return;
      }
      
      const commandName = commandInstance.data.name || path.basename(relativePath, path.extname(relativePath));
      
      if (loadedCommandNames.has(commandName)) {
        logger.error(`[Comandos] ❌ Comando duplicado encontrado: ${commandName} em ${relativePath}`);
        errorCount++;
        return;
      }
      
      client.commands.set(commandName, commandInstance);
      loadedCommandNames.add(commandName);
      
      if (commandInstance.options.aliases && Array.isArray(commandInstance.options.aliases)) {
        for (const alias of commandInstance.options.aliases) {
          if (client.aliases.has(alias)) {
            logger.error(`[Comandos] ❌ Alias duplicado encontrado: ${alias} para comando ${commandName}`);
            errorCount++;
          } else {
            client.aliases.set(alias, commandName);
          }
        }
      }
      
      if (commandInstance.options.type === 'SLASH' || commandInstance.options.type === 'HYBRID') {
        if (commandInstance.data) {
          commandsToRegister.push(commandInstance.data.toJSON());
        }
      }
      
      commandCount++;
      
    } catch (error) {
      logger.error(`[Comandos] ❌ Erro ao carregar comando ${relativePath}: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      errorCount++;
    }
  }
  
  await loadCommandsRecursively(commandsPath);
  
  const categories = Array.from(client.commands.values())
    .map(cmd => cmd.options.categoria || 'Sem categoria')
    .reduce((acc, cat) => {
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  
  if (errorCount > 0) {
    logger.warn(`[Comandos] ⚠️ ${commandCount} comandos carregados com ${errorCount} erros`);
  } else {
    logger.info(`[Comandos] ✅ ${commandCount} comandos carregados com sucesso!`);
  }
  
  if (client.isReady()) {
    await syncSlashCommands(client, commandsToRegister);
  } else {
    client.once('ready', async () => {
      await syncSlashCommands(client, commandsToRegister);
    });
  }
}

async function syncSlashCommands(client: MiClient, commandsToRegister: any[]): Promise<void> {
  if (!client.isReady()) return;
  
  try {
    const rest = new REST({ version: '10' }).setToken(client.config.bot.token);
    const clientId = client.user?.id;
    
    if (!clientId) {
      logger.error('[Comandos] ID do cliente não disponível para sincronização de comandos slash');
      return;
    }
    
    const existingCommands = await rest.get(
      Routes.applicationCommands(clientId)
    ) as ApplicationCommand[];
    
    const existingCommandsMap = new Map<string, ApplicationCommand>();
    existingCommands.forEach(cmd => existingCommandsMap.set(cmd.name, cmd));
    
    const commandsToAdd: any[] = [];
    const commandsToUpdate: any[] = [];
    const commandsToRemove: string[] = [];
    
    for (const cmd of commandsToRegister) {
      if (!existingCommandsMap.has(cmd.name)) {
        commandsToAdd.push(cmd);
      } else {
        const existingCmd = existingCommandsMap.get(cmd.name)!;
        if (existingCmd.description !== cmd.description) {
          commandsToUpdate.push(cmd);
        }
      }
    }
    
    existingCommandsMap.forEach((cmd) => {
      if (!commandsToRegister.some(c => c.name === cmd.name)) {
        commandsToRemove.push(cmd.id);
      }
    });
    
    let hasChanges = false;
    
    if (commandsToAdd.length > 0) {
      hasChanges = true;
      for (const cmd of commandsToAdd) {
        await rest.post(
          Routes.applicationCommands(clientId),
          { body: cmd }
        );
      }
      logger.info(`[Comandos] ➕ ${commandsToAdd.length} comandos slash registrados`);
    }
    
    if (commandsToUpdate.length > 0) {
      hasChanges = true;
      for (const cmd of commandsToUpdate) {
        const existingCmd = existingCommandsMap.get(cmd.name);
        await rest.patch(
          Routes.applicationCommand(clientId, existingCmd!.id),
          { body: cmd }
        );
      }
      logger.info(`[Comandos] 🔄 ${commandsToUpdate.length} comandos slash atualizados`);
    }
    
    if (commandsToRemove.length > 0) {
      hasChanges = true;
      for (const cmdId of commandsToRemove) {
        await rest.delete(
          Routes.applicationCommand(clientId, cmdId)
        );
      }
      logger.info(`[Comandos] 🗑️ ${commandsToRemove.length} comandos slash removidos`);
    }
    
    if (hasChanges) {
      logger.info('[Comandos] ✅ Sincronização de comandos slash concluída');
    }
    
  } catch (error) {
    logger.error(`[Comandos] ❌ Erro ao sincronizar comandos slash: ${error instanceof Error ? error.stack || error.message : String(error)}`);
  }
}