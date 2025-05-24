import { Collection, Db } from 'mongodb';
import { DatabaseClient } from '../MongoClient';
import { CommandLog } from '../schemas/CommandLogSchema';

export class CommandLogRepository {
  private static instance: CommandLogRepository;
  private collection: Collection<CommandLog>;

  private constructor() {
    const db: Db = DatabaseClient.getInstance().getDatabase();
    this.collection = db.collection<CommandLog>('commandLogs');
    this.createIndexes();
  }

  public static getInstance(): CommandLogRepository {
    if (!CommandLogRepository.instance) {
      CommandLogRepository.instance = new CommandLogRepository();
    }
    return CommandLogRepository.instance;
  }

  private async createIndexes(): Promise<void> {
    try {
      await this.collection.createIndex({ timestamp: -1 });
      await this.collection.createIndex({ userId: 1 });
      await this.collection.createIndex({ guildId: 1 });
      await this.collection.createIndex({ commandName: 1 });
      await this.collection.createIndex({ success: 1 });
      await this.collection.createIndex({ 
        userId: 1, 
        commandName: 1, 
        timestamp: -1 
      });
    } catch (error) {
      console.error('Erro ao criar índices para commandLogs:', error);
    }
  }

  async logCommand(commandLog: Omit<CommandLog, '_id'>): Promise<void> {
    try {
      await this.collection.insertOne(commandLog as CommandLog);
    } catch (error) {
      console.error('Erro ao salvar log do comando:', error);
    }
  }

  async getCommandStats(userId?: string, guildId?: string, days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const filter: any = { timestamp: { $gte: startDate } };
    if (userId) filter.userId = userId;
    if (guildId) filter.guildId = guildId;

    return await this.collection.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalCommands: { $sum: 1 },
          successfulCommands: { $sum: { $cond: ["$success", 1, 0] } },
          failedCommands: { $sum: { $cond: ["$success", 0, 1] } },
          avgExecutionTime: { $avg: "$executionTime" },
          uniqueUsers: { $addToSet: "$userId" },
          mostUsedCommands: {
            $push: {
              command: "$commandName",
              category: "$category"
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalCommands: 1,
          successfulCommands: 1,
          failedCommands: 1,
          successRate: { 
            $multiply: [
              { $divide: ["$successfulCommands", "$totalCommands"] },
              100
            ]
          },
          avgExecutionTime: { $round: ["$avgExecutionTime", 2] },
          uniqueUserCount: { $size: "$uniqueUsers" },
          mostUsedCommands: 1
        }
      }
    ]).toArray();
  }

  async getTopCommands(limit: number = 10, days: number = 30): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await this.collection.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: "$commandName",
          count: { $sum: 1 },
          category: { $first: "$category" },
          successRate: {
            $avg: { $cond: ["$success", 1, 0] }
          },
          avgExecutionTime: { $avg: "$executionTime" }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit },
      {
        $project: {
          commandName: "$_id",
          count: 1,
          category: 1,
          successRate: { $multiply: ["$successRate", 100] },
          avgExecutionTime: { $round: ["$avgExecutionTime", 2] },
          _id: 0
        }
      }
    ]).toArray();
  }

  async getUserCommandHistory(userId: string, limit: number = 50): Promise<CommandLog[]> {
    return await this.collection
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  async getGuildCommandHistory(guildId: string, limit: number = 100): Promise<CommandLog[]> {
    return await this.collection
      .find({ guildId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  async getErrorLogs(days: number = 7): Promise<CommandLog[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await this.collection
      .find({ 
        success: false, 
        timestamp: { $gte: startDate } 
      })
      .sort({ timestamp: -1 })
      .toArray();
  }
}