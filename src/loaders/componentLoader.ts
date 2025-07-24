import fs from 'fs';
import path from 'path';
import { Collection } from 'discord.js';
import { MiClient } from '../structures/MiClient';
import { logger } from '../utils/logger';

interface Component {
  customId: string;
  execute: Function;
}

export async function loadComponents(client: MiClient): Promise<void> {
  if (!client.buttons) client.buttons = new Collection<string, Component>();
  if (!client.modals) client.modals = new Collection<string, Component>();
  if (!client.selectMenus) client.selectMenus = new Collection<string, Component>();
  
  client.buttons.clear();
  client.modals.clear();
  client.selectMenus.clear();
  
  let totalErrors = 0;
  
  totalErrors += await loadComponentType(client, 'buttons', client.buttons);
  totalErrors += await loadComponentType(client, 'modals', client.modals);
  totalErrors += await loadComponentType(client, 'menus', client.selectMenus);
  
  const totalComponents = client.buttons.size + client.modals.size + (client.selectMenus?.size || 0);
  
  if (totalErrors > 0) {
    logger.warn(`[Componentes] ⚠️ ${totalComponents} componentes carregados com ${totalErrors} erros`);
  } else {
    logger.info(`[Componentes] ✅ ${totalComponents} componentes carregados com sucesso!`);
  }
}

async function loadComponentType(
  client: MiClient, 
  type: string, 
  collection: Collection<string, Component>
): Promise<number> {
  const componentsDir = path.join(__dirname, '..', 'components', type);
  if (!fs.existsSync(componentsDir)) {
    logger.error(`[Componentes] ❌ Diretório de ${type} não existe: ${componentsDir}`);
    return 1;
  }
  
  return await loadComponentsRecursively(componentsDir, collection, type);
}

async function loadComponentsRecursively(
  dir: string, 
  collection: Collection<string, Component>, 
  type: string
): Promise<number> {
  let errorCount = 0;
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        errorCount += await loadComponentsRecursively(itemPath, collection, type);
      } else if ((item.endsWith('.ts') || item.endsWith('.js')) && !item.endsWith('.d.ts')) {
        errorCount += await loadSingleComponent(itemPath, collection, type, item);
      }
    }
  } catch (error) {
    logger.error(`[Componentes] ❌ Erro ao ler diretório ${dir}: ${error instanceof Error ? error.message : String(error)}`);
    errorCount++;
  }
  
  return errorCount;
}

async function loadSingleComponent(
  filePath: string,
  collection: Collection<string, Component>,
  type: string,
  fileName: string
): Promise<number> {
  try {
    delete require.cache[require.resolve(filePath)];
    
    const component = await import(filePath) as { default: Component };
    
    if (!component.default) {
      logger.error(`[Componentes] ❌ Componente em ${fileName} não tem uma exportação padrão`);
      return 1;
    }
    
    const componentInstance = component.default;
    
    if (!componentInstance.customId) {
      logger.error(`[Componentes] ❌ Componente em ${fileName} não tem um customId definido`);
      return 1;
    }
    
    if (!componentInstance.execute || typeof componentInstance.execute !== 'function') {
      logger.error(`[Componentes] ❌ Componente em ${fileName} não tem um método execute válido`);
      return 1;
    }
    
    collection.set(componentInstance.customId, componentInstance);
    return 0;
  } catch (error) {
    logger.error(`[Componentes] ❌ Erro ao carregar ${type} ${fileName}: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    return 1;
  }
}

declare module '../structures/MiClient' {
  interface MiClient {
    buttons: Collection<string, Component>;
    modals: Collection<string, Component>;
    selectMenus: Collection<string, Component>;
  }
}