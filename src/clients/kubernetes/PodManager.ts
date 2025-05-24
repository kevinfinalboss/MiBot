import * as k8s from '@kubernetes/client-node';
import { BaseClient } from './BaseClient';
import { PodInfo } from '../../types/kubernetes/Kubernetes';
import { logger } from '../../utils/logger';

export class PodManager extends BaseClient {
  private coreV1Api: k8s.CoreV1Api;

  constructor(config: any) {
    super(config);
    this.coreV1Api = this.kc.makeApiClient(k8s.CoreV1Api);
  }

  public async listPods(namespace?: string): Promise<PodInfo[]> {
    try {
      if (namespace) {
        const response = await this.coreV1Api.listNamespacedPod({ namespace });
        return response.items.map((pod: k8s.V1Pod) => ({
          name: pod.metadata?.name || 'unknown',
          namespace: pod.metadata?.namespace || namespace,
          status: pod.status?.phase || 'Unknown',
          restarts: this.calculateRestarts(pod),
          age: this.calculateAge(pod.metadata?.creationTimestamp),
          ip: pod.status?.podIP,
          resources: this.extractPodResources(pod)
        }));
      } else {
        const response = await this.coreV1Api.listPodForAllNamespaces();
        return response.items.map((pod: k8s.V1Pod) => ({
          name: pod.metadata?.name || 'unknown',
          namespace: pod.metadata?.namespace || 'unknown',
          status: pod.status?.phase || 'Unknown',
          restarts: this.calculateRestarts(pod),
          age: this.calculateAge(pod.metadata?.creationTimestamp),
          ip: pod.status?.podIP,
          resources: this.extractPodResources(pod)
        }));
      }
    } catch (error: any) {
      this.handleError(error, 'listar pods');
    }
  }

  public async getPod(name: string, namespace?: string): Promise<PodInfo | null> {
    try {
      const targetNamespace = namespace || this.getNamespace();
      const response = await this.coreV1Api.readNamespacedPod({ name, namespace: targetNamespace });

      return {
        name: response.metadata?.name || name,
        namespace: response.metadata?.namespace || targetNamespace,
        status: response.status?.phase || 'Unknown',
        restarts: this.calculateRestarts(response),
        age: this.calculateAge(response.metadata?.creationTimestamp),
        ip: response.status?.podIP,
        resources: this.extractPodResources(response)
      };
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        return null;
      }
      this.handleError(error, `obter pod ${name}`);
    }
  }

  public async deletePod(name: string, namespace?: string): Promise<boolean> {
    try {
      const targetNamespace = namespace || this.getNamespace();
      await this.coreV1Api.deleteNamespacedPod({ name, namespace: targetNamespace });
      logger.info(`[Kubernetes] Pod ${name} deletado com sucesso do namespace ${targetNamespace}`);
      return true;
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        logger.warn(`[Kubernetes] Pod ${name} não encontrado`);
        return false;
      }
      this.handleError(error, `deletar pod ${name}`);
    }
  }

  public async getPodLogs(name: string, namespace?: string, lines?: number): Promise<string> {
    try {
      const targetNamespace = namespace || this.getNamespace();
      const response = await this.coreV1Api.readNamespacedPodLog({
        name,
        namespace: targetNamespace,
        tailLines: lines
      });
      return response;
    } catch (error: any) {
      this.handleError(error, `obter logs do pod ${name}`);
    }
  }

  public async restartPod(name: string, namespace?: string): Promise<boolean> {
    try {
      const deleted = await this.deletePod(name, namespace);
      if (deleted) {
        logger.info(`[Kubernetes] Pod ${name} será recriado pelo deployment/replicaset`);
      }
      return deleted;
    } catch (error: any) {
      this.handleError(error, `reiniciar pod ${name}`);
    }
  }

  private extractPodResources(pod: k8s.V1Pod) {
    const containers = pod.spec?.containers || [];
    const totalRequests = { cpu: '0', memory: '0' };
    const totalLimits = { cpu: '0', memory: '0' };
    
    containers.forEach(container => {
      if (container.resources?.requests?.cpu) {
        totalRequests.cpu = this.addResource(totalRequests.cpu, container.resources.requests.cpu);
      }
      if (container.resources?.requests?.memory) {
        totalRequests.memory = this.addResource(totalRequests.memory, container.resources.requests.memory);
      }
      if (container.resources?.limits?.cpu) {
        totalLimits.cpu = this.addResource(totalLimits.cpu, container.resources.limits.cpu);
      }
      if (container.resources?.limits?.memory) {
        totalLimits.memory = this.addResource(totalLimits.memory, container.resources.limits.memory);
      }
    });

    return {
      requests: {
        cpu: totalRequests.cpu !== '0' ? totalRequests.cpu : undefined,
        memory: totalRequests.memory !== '0' ? totalRequests.memory : undefined
      },
      limits: {
        cpu: totalLimits.cpu !== '0' ? totalLimits.cpu : undefined,
        memory: totalLimits.memory !== '0' ? totalLimits.memory : undefined
      }
    };
  }

  private addResource(total: string, value: string): string {
    if (total === '0') return value;
    return `${total}+${value}`;
  }

  private calculateRestarts(pod: k8s.V1Pod): number {
    if (!pod.status?.containerStatuses) return 0;
    
    return pod.status.containerStatuses.reduce((total, container) => {
      return total + (container.restartCount || 0);
    }, 0);
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