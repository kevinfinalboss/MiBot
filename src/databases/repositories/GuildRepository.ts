import { Collection, Db } from 'mongodb';
import { DatabaseClient } from '../MongoClient';
import { GuildData } from '../schemas/GuildSchema';

export class GuildRepository {
  private static instance: GuildRepository;
  private collection: Collection<GuildData>;

  private constructor() {
    const db: Db = DatabaseClient.getInstance().getDatabase();
    this.collection = db.collection<GuildData>('guilds');
    this.createIndexes();
  }

  public static getInstance(): GuildRepository {
    if (!GuildRepository.instance) {
      GuildRepository.instance = new GuildRepository();
    }
    return GuildRepository.instance;
  }

  private async createIndexes(): Promise<void> {
    try {
      await this.collection.createIndex({ guildId: 1 }, { unique: true });
      await this.collection.createIndex({ isActive: 1 });
      await this.collection.createIndex({ joinedAt: -1 });
      await this.collection.createIndex({ ownerId: 1 });
      await this.collection.createIndex({ memberCount: -1 });
      await this.collection.createIndex({ "premium.isActive": 1 });
      await this.collection.createIndex({ "stats.lastActiveAt": -1 });
    } catch (error) {
      console.error('Erro ao criar índices para guilds:', error);
    }
  }

  async createOrUpdateGuild(guildData: Omit<GuildData, '_id'>): Promise<void> {
    try {
      await this.collection.replaceOne(
        { guildId: guildData.guildId },
        guildData,
        { upsert: true }
      );
    } catch (error) {
      console.error('Erro ao criar/atualizar guild:', error);
    }
  }

  async getGuild(guildId: string): Promise<GuildData | null> {
    try {
      return await this.collection.findOne({ guildId });
    } catch (error) {
      console.error('Erro ao buscar guild:', error);
      return null;
    }
  }

  async getAllActiveGuilds(): Promise<GuildData[]> {
    try {
      return await this.collection.find({ isActive: true }).toArray();
    } catch (error) {
      console.error('Erro ao buscar guilds ativas:', error);
      return [];
    }
  }

  async markAsLeft(guildId: string): Promise<void> {
    try {
      await this.collection.updateOne(
        { guildId },
        { 
          $set: { 
            isActive: false, 
            leftAt: new Date(),
            updatedAt: new Date()
          } 
        }
      );
    } catch (error) {
      console.error('Erro ao marcar guild como inativa:', error);
    }
  }

  async updateGuildSettings(guildId: string, settings: Partial<GuildData['settings']>): Promise<void> {
    try {
      const currentGuild = await this.getGuild(guildId);
      if (!currentGuild) return;

      const updatedSettings = { ...currentGuild.settings, ...settings };
      
      await this.collection.updateOne(
        { guildId },
        { 
          $set: { 
            settings: updatedSettings,
            updatedAt: new Date()
          } 
        }
      );
    } catch (error) {
      console.error('Erro ao atualizar configurações da guild:', error);
    }
  }

  async updateGuildChannels(guildId: string, channels: Partial<GuildData['channels']>): Promise<void> {
    try {
      const updateFields: any = { updatedAt: new Date() };
      
      Object.entries(channels).forEach(([key, value]) => {
        updateFields[`channels.${key}`] = value;
      });

      await this.collection.updateOne(
        { guildId },
        { $set: updateFields }
      );
    } catch (error) {
      console.error('Erro ao atualizar canais da guild:', error);
    }
  }

  async updateGuildStats(guildId: string, stats: Partial<GuildData['stats']>): Promise<void> {
    try {
      const updateFields: any = { updatedAt: new Date() };
      
      Object.entries(stats).forEach(([key, value]) => {
        updateFields[`stats.${key}`] = value;
      });

      await this.collection.updateOne(
        { guildId },
        { $set: updateFields }
      );
    } catch (error) {
      console.error('Erro ao atualizar estatísticas da guild:', error);
    }
  }

  async incrementCommandUsage(guildId: string, commandName: string): Promise<void> {
    try {
      await this.collection.updateOne(
        { guildId },
        { 
          $inc: { "stats.commandsUsed": 1 },
          $set: { 
            "stats.lastActiveAt": new Date(),
            updatedAt: new Date()
          }
        }
      );

      const guild = await this.getGuild(guildId);
      if (guild) {
        const topCommands = guild.stats.topCommands || [];
        const existingCommand = topCommands.find(cmd => cmd.command === commandName);
        
        if (existingCommand) {
          existingCommand.count++;
        } else {
          topCommands.push({ command: commandName, count: 1 });
        }
        
        topCommands.sort((a, b) => b.count - a.count);
        const limitedTopCommands = topCommands.slice(0, 10);
        
        await this.collection.updateOne(
          { guildId },
          { $set: { "stats.topCommands": limitedTopCommands } }
        );
      }
    } catch (error) {
      console.error('Erro ao incrementar uso de comando:', error);
    }
  }

  async getGuildsByOwner(ownerId: string): Promise<GuildData[]> {
    try {
      return await this.collection.find({ 
        ownerId, 
        isActive: true 
      }).toArray();
    } catch (error) {
      console.error('Erro ao buscar guilds por owner:', error);
      return [];
    }
  }

  async getTopGuildsByMembers(limit: number = 10): Promise<GuildData[]> {
    try {
      return await this.collection
        .find({ isActive: true })
        .sort({ memberCount: -1 })
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error('Erro ao buscar top guilds:', error);
      return [];
    }
  }

  async getGuildsStats(): Promise<any> {
    try {
      const stats = await this.collection.aggregate([
        {
          $group: {
            _id: null,
            totalGuilds: { $sum: { $cond: ["$isActive", 1, 0] } },
            totalMembers: { $sum: { $cond: ["$isActive", "$memberCount", 0] } },
            avgMembersPerGuild: { $avg: { $cond: ["$isActive", "$memberCount", null] } },
            totalCommandsUsed: { $sum: "$stats.commandsUsed" },
            totalSongsPlayed: { $sum: "$stats.songsPlayed" },
            premiumGuilds: { $sum: { $cond: ["$premium.isActive", 1, 0] } }
          }
        }
      ]).toArray();

      return stats[0] || {};
    } catch (error) {
      console.error('Erro ao buscar estatísticas das guilds:', error);
      return {};
    }
  }

  async searchGuilds(query: string, limit: number = 20): Promise<GuildData[]> {
    try {
      return await this.collection
        .find({
          isActive: true,
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { guildId: query }
          ]
        })
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error('Erro ao buscar guilds:', error);
      return [];
    }
  }
}