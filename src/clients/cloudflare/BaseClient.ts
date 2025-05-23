import Cloudflare from 'cloudflare';
import { logger } from '../../utils/logger';

export abstract class CloudflareBaseClient {
  protected cf: Cloudflare;

  constructor(apiToken: string) {
    this.cf = new Cloudflare({
      apiToken: apiToken,
    });
  }

  protected handleError(method: string, error: unknown): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[Cloudflare] Erro em ${method}: ${errorMessage}`);
    throw error;
  }

  protected formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  protected formatPercentage(value: number, total: number): string {
    if (total === 0) return '0%';
    return `${Math.round((value / total) * 100)}%`;
  }

  protected validateZoneId(zoneId: string): void {
    if (!zoneId || zoneId.trim().length === 0) {
      throw new Error('Zone ID é obrigatório');
    }
  }
}