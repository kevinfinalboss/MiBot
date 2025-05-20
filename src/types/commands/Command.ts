import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  ContextMenuCommandBuilder,
} from 'discord.js';
import { MiClient } from '../../structures/MiClient';
import { CommandContext } from './CommandContext';

export type CommandType = 'SLASH' | 'PREFIX' | 'CONTEXT_MENU' | 'HYBRID';
export type CommandCategoria = 'Util' | 'Moderação' | 'Administração' | 'Diversão' | 'Sistema';

export interface CommandOptions {
  categoria: CommandCategoria;

  // Acesso
  adminOnly?: boolean;
  ownerOnly?: boolean;
  guildOnly?: boolean;
  dmOnly?: boolean;
  allowBots?: boolean;

  // Execução
  cooldown?: number; // em segundos
  type: CommandType;

  aliases?: string[]; // para prefix
  userPermissions?: string[]; // permissões requeridas pelo autor
  botPermissions?: string[];  // permissões requeridas pelo bot
  enabled?: boolean;

  // Visibilidade e ajuda
  visible?: boolean;
  usage?: string;
  examples?: string[];
}

export interface Command {
  data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | ContextMenuCommandBuilder
    | null;

  options: CommandOptions;

  execute: (
    client: MiClient,
    context: CommandContext
  ) => Promise<void> | void;
}
