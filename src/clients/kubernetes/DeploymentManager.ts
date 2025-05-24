import * as k8s from '@kubernetes/client-node';
import { BaseClient } from './BaseClient';
import { DeploymentInfo } from '../../types/kubernetes/Kubernetes';
import { logger } from '../../utils/logger';

export class DeploymentManager extends BaseClient {
  private appsV1Api: k8s.AppsV1Api;

  constructor(config: any) {
    super(config);
    this.appsV1Api = this.kc.makeApiClient(k8s.AppsV1Api);
  }

  public async listDeployments(namespace?: string): Promise<DeploymentInfo[]> {
    try {
      if (namespace) {
        const response = await this.appsV1Api.listNamespacedDeployment({ namespace });
        return response.items.map((deployment: k8s.V1Deployment) => ({
          name: deployment.metadata?.name || 'unknown',
          namespace: deployment.metadata?.namespace || namespace,
          replicas: {
            desired: deployment.spec?.replicas || 0,
            ready: deployment.status?.readyReplicas || 0,
            available: deployment.status?.availableReplicas || 0
          },
          status: this.getDeploymentStatus(deployment),
          age: this.calculateAge(deployment.metadata?.creationTimestamp)
        }));
      } else {
        const response = await this.appsV1Api.listDeploymentForAllNamespaces();
        return response.items.map((deployment: k8s.V1Deployment) => ({
          name: deployment.metadata?.name || 'unknown',
          namespace: deployment.metadata?.namespace || 'unknown',
          replicas: {
            desired: deployment.spec?.replicas || 0,
            ready: deployment.status?.readyReplicas || 0,
            available: deployment.status?.availableReplicas || 0
          },
          status: this.getDeploymentStatus(deployment),
          age: this.calculateAge(deployment.metadata?.creationTimestamp)
        }));
      }
    } catch (error: any) {
      this.handleError(error, 'listar deployments');
    }
  }

  public async getDeployment(name: string, namespace?: string): Promise<DeploymentInfo | null> {
    try {
      const targetNamespace = namespace || this.getNamespace();
      const response = await this.appsV1Api.readNamespacedDeployment({ name, namespace: targetNamespace });

      return {
        name: response.metadata?.name || name,
        namespace: response.metadata?.namespace || targetNamespace,
        replicas: {
          desired: response.spec?.replicas || 0,
          ready: response.status?.readyReplicas || 0,
          available: response.status?.availableReplicas || 0
        },
        status: this.getDeploymentStatus(response),
        age: this.calculateAge(response.metadata?.creationTimestamp)
      };
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        return null;
      }
      this.handleError(error, `obter deployment ${name}`);
    }
  }

  public async scaleDeployment(name: string, replicas: number, namespace?: string): Promise<boolean> {
    try {
      const targetNamespace = namespace || this.getNamespace();
      
      const patchBody = {
        spec: {
          replicas: replicas
        }
      };

      await this.appsV1Api.patchNamespacedDeploymentScale({
        name,
        namespace: targetNamespace,
        body: patchBody
      });

      logger.info(`[Kubernetes] Deployment ${name} escalado para ${replicas} réplicas`);
      return true;
    } catch (error: any) {
      this.handleError(error, `escalar deployment ${name}`);
    }
  }

  public async restartDeployment(name: string, namespace?: string): Promise<boolean> {
    try {
      const targetNamespace = namespace || this.getNamespace();
      
      const patchBody = {
        spec: {
          template: {
            metadata: {
              annotations: {
                'kubectl.kubernetes.io/restartedAt': new Date().toISOString()
              }
            }
          }
        }
      };

      await this.appsV1Api.patchNamespacedDeployment({
        name,
        namespace: targetNamespace,
        body: patchBody
      });

      logger.info(`[Kubernetes] Deployment ${name} reiniciado com sucesso`);
      return true;
    } catch (error: any) {
      this.handleError(error, `reiniciar deployment ${name}`);
    }
  }

  public async deleteDeployment(name: string, namespace?: string): Promise<boolean> {
    try {
      const targetNamespace = namespace || this.getNamespace();
      await this.appsV1Api.deleteNamespacedDeployment({ name, namespace: targetNamespace });
      logger.info(`[Kubernetes] Deployment ${name} deletado com sucesso`);
      return true;
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        logger.warn(`[Kubernetes] Deployment ${name} não encontrado`);
        return false;
      }
      this.handleError(error, `deletar deployment ${name}`);
    }
  }

  private getDeploymentStatus(deployment: k8s.V1Deployment): string {
    const desired = deployment.spec?.replicas || 0;
    const ready = deployment.status?.readyReplicas || 0;
    const available = deployment.status?.availableReplicas || 0;

    if (desired === 0) return 'Stopped';
    if (ready === 0) return 'Pending';
    if (ready < desired) return 'Partial';
    if (available === desired) return 'Ready';
    
    return 'Unknown';
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