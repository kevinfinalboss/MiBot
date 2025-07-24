import { MongoClient, Db } from 'mongodb';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

export class DatabaseClient {
  private static instance: DatabaseClient;
  private client: MongoClient | null = null;
  private database: Db | null = null;
  private connectionString: string;

  private constructor() {
    this.connectionString = this.buildConnectionString();
  }

  public static getInstance(): DatabaseClient {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new DatabaseClient();
    }
    return DatabaseClient.instance;
  }

  private buildConnectionString(): string {
    const host = process.env.DB_HOST || '127.0.0.1';
    const port = process.env.DB_PORT || '27017';
    const username = process.env.DB_USERNAME || '';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || '';

    if (!username || !password || !database) {
      throw new Error('Configurações do banco de dados incompletas no .env');
    }

    const connectionString = `mongodb://${username}:${password}@${host}:${port}/${database}?authSource=${database}`;
    
    return connectionString;
  }

  public async connect(): Promise<void> {
    try {
      if (this.client) {
        return;
      }
      
      this.client = new MongoClient(this.connectionString, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 15000,
        maxIdleTimeMS: 30000,
        retryWrites: true,
      });
      
      await this.client.connect();
      this.database = this.client.db();
      await this.client.db('admin').command({ ping: 1 });
      
      logger.info('[MongoDB] ✅ Conectado com sucesso');
    } catch (error) {
      logger.error('[MongoDB] ❌ Erro na conexão:');
      
      if (error instanceof Error) {
        logger.error(`[MongoDB] ${error.message}`);
        
        if ('code' in error) {
          logger.error(`[MongoDB] Código: ${(error as any).code}`);
        }
        
        if ('codeName' in error) {
          logger.error(`[MongoDB] ${(error as any).codeName}`);
        }
      } else {
        logger.error(`[MongoDB] ${String(error)}`);
      }
      
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
        this.database = null;
      }
    } catch (error) {
      logger.error(`[MongoDB] ❌ Erro ao desconectar: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public getDatabase(): Db {
    if (!this.database) {
      throw new Error('Banco de dados não conectado');
    }
    return this.database;
  }

  public getClient(): MongoClient {
    if (!this.client) {
      throw new Error('Cliente MongoDB não conectado');
    }
    return this.client;
  }

  public isConnected(): boolean {
    return this.client !== null && this.database !== null;
  }
}