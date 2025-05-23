import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  ContextMenuCommandBuilder,
  AutocompleteInteraction,
} from 'discord.js';
import { MiClient } from '../../structures/MiClient';
import { CommandContext } from './CommandContext';

export type CommandType = 'SLASH' | 'PREFIX' | 'CONTEXT_MENU' | 'HYBRID';
export type CommandCategoria = 'Util' | 'Moderação' | 'Administração' | 'Diversão' | 'Sistema';

export interface CommandOptions {
  categoria: CommandCategoria;

  adminOnly?: boolean;
  ownerOnly?: boolean;
  guildOnly?: boolean;
  dmOnly?: boolean;
  allowBots?: boolean;

  cooldown?: number;
  type: CommandType;

  aliases?: string[];
  userPermissions?: string[];
  botPermissions?: string[];
  enabled?: boolean;

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

  executeAutocomplete?: (
    client: MiClient,
    interaction: AutocompleteInteraction
  ) => Promise<void> | void;
}