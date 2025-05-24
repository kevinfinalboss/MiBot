export interface GuildData {
  _id?: string;
  guildId: string;
  name: string;
  ownerId: string;
  ownerUsername: string;
  memberCount: number;
  iconURL?: string;
  bannerURL?: string;
  description?: string;
  verificationLevel: number;
  premiumTier: number;
  premiumSubscriptionCount?: number;
  region?: string;
  locale?: string;
  features: string[];
  channelCount: number;
  roleCount: number;
  emojiCount: number;
  stickerCount: number;
  boostCount: number;
  
  channels: {
    auditChannelId?: string;
    commandsChannelId?: string;
    musicsChannelId?: string;
    welcomeChannelId?: string;
    leaveChannelId?: string;
    logsChannelId?: string;
    moderationChannelId?: string;
  };
  
  settings: {
    prefix: string;
    language: string;
    timezone: string;
    autoRole?: string;
    muteRole?: string;
    djRole?: string;
    modRole?: string;
    adminRole?: string;
    welcomeMessage?: string;
    leaveMessage?: string;
    autoDeleteCommands: boolean;
    musicQueueLimit: number;
    volumeLimit: number;
    allowExplicitMusic: boolean;
    requireDjForMusic: boolean;
    enableLevelSystem: boolean;
    enableEconomy: boolean;
  };
  
  permissions: {
    [channelId: string]: {
      allowedCommands: string[];
      disabledCommands: string[];
      allowedRoles: string[];
      disabledUsers: string[];
    };
  };
  
  premium: {
    isActive: boolean;
    tier: number;
    expiresAt?: Date;
    features: string[];
  };
  
  stats: {
    commandsUsed: number;
    songsPlayed: number;
    messagesProcessed: number;
    lastActiveAt: Date;
    topCommands: Array<{
      command: string;
      count: number;
    }>;
  };
  
  joinedAt: Date;
  leftAt?: Date;
  updatedAt: Date;
  isActive: boolean;
}