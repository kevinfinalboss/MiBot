import * as k8s from '@kubernetes/client-node';
import { BaseClient } from './BaseClient';
import { NamespaceInfo } from '../../types/kubernetes/Kubernetes';
import { logger } from '../../utils/logger';

export class NamespaceManager extends BaseClient {
  private coreV1Api: k8s.CoreV1Api;

  constructor(config: any) {
    super(config);
    this.coreV1Api = this.kc.makeApiClient(k8s.CoreV1Api);
  }

  public async listNamespaces(): Promise<NamespaceInfo[]> {
    try {
      const response = await this.coreV1Api.listNamespace();
      
      return response.items.map((namespace: k8s.V1Namespace) => ({
        name: namespace.metadata?.name || 'unknown',
        status: namespace.status?.phase || 'Unknown',
        age: this.calculateAge(namespace.metadata?.creationTimestamp)
      }));
    } catch (error: any) {
      this.handleError(error, 'listar namespaces');
    }
  }

  public async readNamespace(name: string): Promise<NamespaceInfo | null> {
    try {
      const response = await this.coreV1Api.readNamespace({ name });

      return {
        name: response.metadata?.name || name,
        status: response.status?.phase || 'Unknown',
        age: this.calculateAge(response.metadata?.creationTimestamp)
      };
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        return null;
      }
      this.handleError(error, `obter namespace ${name}`);
    }
  }

  private calculateAge(creationTimestamp?: Date): string {
    if (!creationTimestamp) return 'Unknown';
    
    const now = new Date();
    const created = new Date(creationTimestamp);
    const diffMs = now.getTime() - created.getTime();
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffDays > 0) return `${diffDays}d`;
    if (diffHours > 0) return `${diffHours}h`;
    return `${diffMinutes}m`;
  }
}