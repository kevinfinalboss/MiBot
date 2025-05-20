import { ChatInputCommandInteraction, Message, GuildMember, TextChannel, DMChannel, NewsChannel } from 'discord.js';

export interface CommandContext {
  interaction?: ChatInputCommandInteraction; // Caso seja comando via Slash
  message?: Message;                          // Caso seja comando via prefixo (message)

  args: string[];                            // Argumentos extraídos da mensagem (prefixo)
  authorId: string;                          // ID do usuário que executou o comando
  guildId?: string;                          // ID da guild (se existir)
  channelId: string;                         // ID do canal onde o comando foi usado
  member?: GuildMember;                      // GuildMember que executou (se em servidor)
  channel?: TextChannel | DMChannel | NewsChannel;  // Canal onde foi executado
  isSlash: boolean;                          // Se o comando foi executado via slash ou prefixo
}
