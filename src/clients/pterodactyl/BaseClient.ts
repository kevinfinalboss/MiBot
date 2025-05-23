import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';

export class PterodactylBaseClient {
  protected api: AxiosInstance;
  protected clientApi: AxiosInstance;
  protected baseUrl: string;

  constructor(url: string, apiKey: string) {
    this.baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    
    const defaultHeaders = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    this.api = axios.create({
      baseURL: `${this.baseUrl}/api/application`,
      headers: defaultHeaders,
      timeout: 30000
    });

    this.clientApi = axios.create({
      baseURL: `${this.baseUrl}/api/client`,
      headers: defaultHeaders,
      timeout: 15000
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    [this.api, this.clientApi].forEach((instance, index) => {
      const apiType = index === 0 ? 'Application' : 'Client';
      
      instance.interceptors.request.use(
        (config) => {
          logger.info(`[Pterodactyl ${apiType}] ${config.method?.toUpperCase()} ${config.url}`);
          return config;
        },
        (error) => {
          logger.error(`[Pterodactyl ${apiType}] Request error: ${error.message}`);
          return Promise.reject(error);
        }
      );

      instance.interceptors.response.use(
        (response) => {
          logger.info(`[Pterodactyl ${apiType}] Response: ${response.status} ${response.statusText}`);
          return response;
        },
        (error) => {
          logger.error(`[Pterodactyl ${apiType}] Response error: ${error.response?.status} ${error.response?.statusText}`);
          if (error.response?.data) {
            logger.error(`[Pterodactyl ${apiType}] Error details: ${JSON.stringify(error.response.data)}`);
          }
          return Promise.reject(error);
        }
      );
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.api.get('/servers?per_page=1');
      return response.status === 200;
    } catch (error) {
      logger.error(`[Pterodactyl] Connection test failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  protected handleError(operation: string, error: any): never {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[Pterodactyl] Error in ${operation}: ${message}`);
    throw error;
  }
}