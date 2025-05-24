import { BaseClient } from './BaseClient';
import { PodManager } from './PodManager';
import { DeploymentManager } from './DeploymentManager';
import { CronJobManager } from './CronJobManager';
import { ServiceManager } from './ServiceManager';
import { NamespaceManager } from './NamespaceManager';
import { NodeManager } from './NodeManager';
import { KubernetesConfig } from '../../types/kubernetes/Kubernetes';
import { logger } from '../../utils/logger';
import * as k8s from '@kubernetes/client-node';

export class KubernetesClient extends BaseClient {
  public pods: PodManager;
  public deployments: DeploymentManager;
  public cronJobs: CronJobManager;
  public services: ServiceManager;
  public namespaces: NamespaceManager;
  public nodes: NodeManager;

  constructor(config: KubernetesConfig) {
    super(config);
    
    this.pods = new PodManager(config);
    this.deployments = new DeploymentManager(config);
    this.cronJobs = new CronJobManager(config);
    this.services = new ServiceManager(config);
    this.namespaces = new NamespaceManager(config);
    this.nodes = new NodeManager(config);
  }

  public async initialize(): Promise<void> {
    try {
      logger.info('[Kubernetes] Inicializando cliente Kubernetes...');
      
      const isConnected = await this.testConnection();
      if (!isConnected) {
        throw new Error('Falha ao conectar com o cluster Kubernetes');
      }

      logger.success(`[Kubernetes] Cliente inicializado com sucesso${this.config.inCluster ? ' (in-cluster)' : ' (external)'}`);
      logger.info(`[Kubernetes] Namespace padrão: ${this.getNamespace()}`);
    } catch (error) {
      logger.error('[Kubernetes] Falha na inicialização: ' + (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  }

  public async getClusterInfo(): Promise<{
    version: string;
    namespace: string;
    inCluster: boolean;
    nodeCount: number;
  }> {
    try {
      const versionApi = this.kc.makeApiClient(k8s.VersionApi);
      const coreV1Api = this.kc.makeApiClient(k8s.CoreV1Api);
      
      const versionResponse = await versionApi.getCode();
      const nodesResponse = await coreV1Api.listNode();
      
      return {
        version: versionResponse.gitVersion || 'unknown',
        namespace: this.getNamespace(),
        inCluster: this.config.inCluster,
        nodeCount: nodesResponse.items.length
      };
    } catch (error: any) {
      this.handleError(error, 'obter informações do cluster');
    }
  }
}
