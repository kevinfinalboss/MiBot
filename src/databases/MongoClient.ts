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
    
    logger.info('[MongoDB] Connection string construída a partir do .env');
    return connectionString;
  }

  public async connect(): Promise<void> {
    try {
      if (this.client) {
        logger.warn('[MongoDB] Cliente já conectado');
        return;
      }

      logger.info('[MongoDB] Conectando ao banco de dados...');
      
      logger.info('[MongoDB] Connection String (mascarada): ' + this.maskConnectionString(this.connectionString));
      logger.info('[MongoDB] Connection String tem authSource? ' + (this.connectionString.includes('authSource') ? 'Sim' : 'Não'));
      
      const parsedUrl = this.parseConnectionString(this.connectionString);
      logger.info('[MongoDB] Host: ' + parsedUrl.host);
      logger.info('[MongoDB] Port: ' + parsedUrl.port);
      logger.info('[MongoDB] Username: ' + parsedUrl.username);
      logger.info('[MongoDB] Database: ' + parsedUrl.database);
      logger.info('[MongoDB] Senha presente: ' + (parsedUrl.password ? 'Sim' : 'Não'));
      
      this.client = new MongoClient(this.connectionString, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 15000,
        maxIdleTimeMS: 30000,
        retryWrites: true,
      });

      logger.info('[MongoDB] Cliente MongoDB criado, iniciando conexão...');
      
      await this.client.connect();
      logger.info('[MongoDB] Conexão estabelecida com sucesso');
      
      this.database = this.client.db();
      logger.info('[MongoDB] Database selecionada: ' + this.database.databaseName);
      
      logger.info('[MongoDB] Testando autenticação...');
      await this.client.db('admin').command({ ping: 1 });
      logger.info('[MongoDB] Ping executado com sucesso');
      
      logger.info('[MongoDB] Listando databases disponíveis...');
      const adminDb = this.client.db().admin();
      const dbList = await adminDb.listDatabases();
      logger.info('[MongoDB] Databases encontradas: ' + dbList.databases.map(db => db.name).join(', '));
      
      logger.success('[MongoDB] Conectado com sucesso');
    } catch (error) {
      logger.error('[MongoDB] Erro detalhado na conexão:');
      
      if (error instanceof Error) {
        logger.error('[MongoDB] Mensagem do erro: ' + error.message);
        logger.error('[MongoDB] Stack trace: ' + error.stack);
        logger.error('[MongoDB] Nome do erro: ' + error.name);
        
        if ('code' in error) {
          logger.error('[MongoDB] Código do erro: ' + (error as any).code);
        }
        
        if ('codeName' in error) {
          logger.error('[MongoDB] Nome do código: ' + (error as any).codeName);
        }
        
        if ('errmsg' in error) {
          logger.error('[MongoDB] Mensagem interna: ' + (error as any).errmsg);
        }
      } else {
        logger.error('[MongoDB] Erro desconhecido: ' + String(error));
      }
      
      logger.error('[MongoDB] Verificações sugeridas:');
      logger.error('1. Usuário existe na database correta?');
      logger.error('2. Senha está correta?');
      logger.error('3. Usuário tem permissões adequadas?');
      logger.error('4. Conexão de rede está funcionando?');
      
      throw error;
    }
  }

  private maskConnectionString(connectionString: string): string {
    return connectionString.replace(/:([^:@]+)@/, ':***@');
  }

  private parseConnectionString(connectionString: string): {
    host: string;
    port: string;
    username: string;
    password: string;
    database: string;
  } {
    try {
      const url = new URL(connectionString);
      return {
        host: url.hostname,
        port: url.port,
        username: url.username,
        password: url.password,
        database: url.pathname.substring(1)
      };
    } catch (error) {
      return {
        host: 'Erro ao parsear',
        port: 'Erro ao parsear',
        username: 'Erro ao parsear',
        password: 'Erro ao parsear',
        database: 'Erro ao parsear'
      };
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.client) {
        logger.info('[MongoDB] Iniciando desconexão...');
        await this.client.close();
        this.client = null;
        this.database = null;
        logger.info('[MongoDB] Desconectado do banco de dados');
      }
    } catch (error) {
      logger.error('[MongoDB] Erro ao desconectar: ' + (error instanceof Error ? error.message : String(error)));
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