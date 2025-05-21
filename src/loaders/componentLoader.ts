import fs from 'fs';
import path from 'path';
import { Collection } from 'discord.js';
import { MiClient } from '../structures/MiClient';
import { logger } from '../utils/logger';

interface Component {
  id: string;
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
    logger.warn(`[Componentes] Diretório de ${type} não existe`);
    return;
  }
  
  const componentFiles = fs.readdirSync(componentsDir).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
  
  for (const file of componentFiles) {
    try {
      const componentPath = path.join(componentsDir, file);
      const component = await import(componentPath) as { default: Component };
      
      if (!component.default) {
        logger.warn(`[Componentes] Componente em ${file} não tem uma exportação padrão`);
        continue;
      }
      
      const componentInstance = component.default;
      
      if (!componentInstance.id) {
        logger.warn(`[Componentes] Componente em ${file} não tem um ID definido`);
        continue;
      }
      
      if (!componentInstance.execute || typeof componentInstance.execute !== 'function') {
        logger.warn(`[Componentes] Componente em ${file} não tem um método execute`);
        continue;
      }
      
      collection.set(componentInstance.id, componentInstance);
      logger.info(`[Componentes] ${type} carregado: ${componentInstance.id} (${file})`);
    } catch (error) {
      logger.error(`[Componentes] Erro ao carregar ${type} ${file}: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    }
  }
  
  logger.info(`[Componentes] Total de ${collection.size} ${type} carregados`);
}

declare module '../structures/MiClient' {
  interface MiClient {
    buttons: Collection<string, Component>;
    modals: Collection<string, Component>;
    selectMenus: Collection<string, Component>;
  }
}