export interface CommandLog {
  _id?: string;
  commandName: string;
  commandType: 'SLASH' | 'PREFIX' | 'CONTEXT_MENU' | 'HYBRID';
  userId: string;
  username: string;
  userTag: string;
  guildId?: string;
  guildName?: string;
  channelId: string;
  channelType: string;
  success: boolean;
  errorMessage?: string;
  executionTime: number;
  timestamp: Date;
  args: string[];
  category: string;
  userPermissions?: string[];
  botPermissions?: string[];
  cooldownTime?: number;
  metadata?: {
    memberRoles?: string[];
    memberJoinedAt?: Date;
    guildMemberCount?: number;
    isOwner: boolean;
    isAdmin: boolean;
    premium: boolean;
  };
}