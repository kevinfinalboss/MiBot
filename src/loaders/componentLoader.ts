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
  
  logger.info('[Componentes] Iniciando carregamento de componentes...');
  
  await loadComponentType(client, 'buttons', client.buttons);
  
  await loadComponentType(client, 'modals', client.modals);
  
  const selectMenusDir = path.join(__dirname, '..', 'components', 'selectMenus');
  if (fs.existsSync(selectMenusDir)) {
    await loadComponentType(client, 'selectMenus', client.selectMenus);
  }
  
  logger.info(`[Componentes] Carregamento concluído: ${client.buttons.size} botões, ${client.modals.size} modais, ${client.selectMenus?.size || 0} menus de seleção`);
}

async function loadComponentType(
  client: MiClient, 
  type: string, 
  collection: Collection<string, Component>
): Promise<void> {
  const componentsDir = path.join(__dirname, '..', 'components', type);
  if (!fs.existsSync(componentsDir)) {
    logger.warn(`[Componentes] Diretório de ${type} não existe: ${componentsDir}`);
    return;
  }
  
  await loadComponentsRecursively(componentsDir, collection, type);
  
  logger.info(`[Componentes] Total de ${collection.size} ${type} carregados`);
}

async function loadComponentsRecursively(
  dir: string, 
  collection: Collection<string, Component>, 
  type: string
): Promise<void> {
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        logger.info(`[Componentes] Carregando subdiretório: ${item}`);
        await loadComponentsRecursively(itemPath, collection, type);
      } else if ((item.endsWith('.ts') || item.endsWith('.js')) && !item.endsWith('.d.ts')) {
        await loadSingleComponent(itemPath, collection, type, item);
      }
    }
  } catch (error) {
    logger.error(`[Componentes] Erro ao ler diretório ${dir}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function loadSingleComponent(
  filePath: string,
  collection: Collection<string, Component>,
  type: string,
  fileName: string
): Promise<void> {
  try {
    delete require.cache[require.resolve(filePath)];
    
    const component = await import(filePath) as { default: Component };
    
    if (!component.default) {
      logger.warn(`[Componentes] Componente em ${fileName} não tem uma exportação padrão`);
      return;
    }
    
    const componentInstance = component.default;
    
    if (!componentInstance.customId) {
      logger.warn(`[Componentes] Componente em ${fileName} não tem um customId definido`);
      return;
    }
    
    if (!componentInstance.execute || typeof componentInstance.execute !== 'function') {
      logger.warn(`[Componentes] Componente em ${fileName} não tem um método execute válido`);
      return;
    }
    
    collection.set(componentInstance.customId, componentInstance);
    logger.info(`[Componentes] ${type} carregado: ${componentInstance.customId} (${fileName})`);
  } catch (error) {
    logger.error(`[Componentes] Erro ao carregar ${type} ${fileName}: ${error instanceof Error ? error.stack || error.message : String(error)}`);
  }
}

declare module '../structures/MiClient' {
  interface MiClient {
    buttons: Collection<string, Component>;
    modals: Collection<string, Component>;
    selectMenus: Collection<string, Component>;
  }
}