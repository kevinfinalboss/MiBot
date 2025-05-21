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
  
  const commandFolders = fs.readdirSync(commandsPath);
  let commandCount = 0;
  const commandsToRegister: any[] = [];
  const loadedCommandNames: Set<string> = new Set();
  
  logger.info('[Comandos] Iniciando carregamento de comandos...');
  
  client.commands.clear();
  client.aliases.clear();
  
  for (const folder of commandFolders) {
    const categoryPath = path.join(commandsPath, folder);
    if (!fs.statSync(categoryPath).isDirectory()) continue;
    
    const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
    
    for (const file of commandFiles) {
      try {
        const commandPath = path.join(categoryPath, file);
        const command = await import(commandPath) as { default: Command };
        
        if (!command.default) {
          logger.warn('[Comandos] Comando em ' + file + ' não tem uma exportação padrão');
          continue;
        }
        
        const commandInstance = command.default;
        
        if (commandInstance.data) {
          const commandName = commandInstance.data.name || file.split('.')[0];
          
          if (loadedCommandNames.has(commandName)) {
            logger.warn('[Comandos] Comando duplicado encontrado: ' + commandName);
            continue;
          }
          
          client.commands.set(commandName, commandInstance);
          loadedCommandNames.add(commandName);
          
          if (commandInstance.options.aliases && Array.isArray(commandInstance.options.aliases)) {
            for (const alias of commandInstance.options.aliases) {
              if (client.aliases.has(alias)) {
                logger.warn('[Comandos] Alias duplicado encontrado: ' + alias);
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
          logger.info('[Comandos] Comando carregado: ' + commandName + ' (' + folder + '/' + file + ')');
        } else {
          logger.warn('[Comandos] Comando em ' + file + ' não tem data definida');
        }
      } catch (error) {
        logger.error('[Comandos] Erro ao carregar comando ' + file + ': ' + (error instanceof Error ? error.stack || error.message : String(error)));
      }
    }
  }
  
  logger.info('[Comandos] Total de ' + commandCount + ' comandos carregados com sucesso!');
  
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
    
    logger.info('[Comandos] Iniciando sincronização de comandos slash com a API do Discord...');
    
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
        commandsToUpdate.push(cmd);
      }
    }
    
    existingCommandsMap.forEach((cmd) => {
      if (!commandsToRegister.some(c => c.name === cmd.name)) {
        commandsToRemove.push(cmd.id);
      }
    });
    
    if (commandsToAdd.length > 0) {
      logger.info('[Comandos] Registrando ' + commandsToAdd.length + ' novos comandos slash...');
      
      for (const cmd of commandsToAdd) {
        await rest.post(
          Routes.applicationCommands(clientId),
          { body: cmd }
        );
        logger.info('[Comandos] Comando slash registrado: ' + cmd.name);
      }
    }
    
    if (commandsToUpdate.length > 0) {
      logger.info('[Comandos] Atualizando ' + commandsToUpdate.length + ' comandos slash existentes...');
      
      for (const cmd of commandsToUpdate) {
        const existingCmd = existingCommandsMap.get(cmd.name);
        await rest.patch(
          Routes.applicationCommand(clientId, existingCmd!.id),
          { body: cmd }
        );
        logger.info('[Comandos] Comando slash atualizado: ' + cmd.name);
      }
    }
    
    if (commandsToRemove.length > 0) {
      logger.info('[Comandos] Removendo ' + commandsToRemove.length + ' comandos slash obsoletos...');
      
      for (const cmdId of commandsToRemove) {
        await rest.delete(
          Routes.applicationCommand(clientId, cmdId)
        );
        logger.info('[Comandos] Comando slash removido: ID ' + cmdId);
      }
    }
    
    logger.info('[Comandos] Sincronização de comandos slash concluída com sucesso!');
    logger.info('[Comandos] ' + commandsToAdd.length + ' comandos adicionados, ' + commandsToUpdate.length + ' atualizados, ' + commandsToRemove.length + ' removidos');
    
  } catch (error) {
    logger.error('[Comandos] Erro ao sincronizar comandos slash: ' + (error instanceof Error ? error.stack || error.message : String(error)));
  }
}