import * as k8s from '@kubernetes/client-node';
import { KubernetesConfig } from '../../types/kubernetes/Kubernetes';
import { logger } from '../../utils/logger';
import * as os from 'os';
import * as path from 'path';

export class BaseClient {
  protected kc: k8s.KubeConfig;
  protected config: KubernetesConfig;

  constructor(config: KubernetesConfig) {
    this.config = config;
    this.kc = new k8s.KubeConfig();
    
    const inCluster = this.parseToBoolean(config.inCluster);
    
    if (inCluster) {
      logger.info('[Kubernetes] Configurando para execução in-cluster');
      this.kc.loadFromCluster();
    } else {
      logger.info('[Kubernetes] Configurando para execução externa com kubeconfig');
      const kubeConfigPath = path.join(os.homedir(), '.kube', 'config');
      try {
        this.kc.loadFromFile(kubeConfigPath);
        logger.info(`[Kubernetes] Kubeconfig carregado de: ${kubeConfigPath}`);
      } catch (error) {
        logger.warn(`[Kubernetes] Falha ao carregar kubeconfig de ${kubeConfigPath}, tentando configuração padrão`);
        this.kc.loadFromDefault();
      }
    }
  }

  private parseToBoolean(value: any): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  }

  protected handleError(error: any, operation: string): never {
    const errorMessage = error?.response?.body?.message || error?.message || 'Erro desconhecido';
    logger.error(`[Kubernetes] Erro na operação ${operation}: ${errorMessage}`);
    throw new Error(`Falha em ${operation}: ${errorMessage}`);
  }

  protected getNamespace(): string {
    return this.config.namespace || 'default';
  }

  protected getDefaultNamespace(): string {
    return this.config.namespace || 'default';
  }

  protected getAllNamespaces(): boolean {
    return !this.config.namespace;
  }

  public async testConnection(): Promise<boolean> {
    try {
      const coreV1Api = this.kc.makeApiClient(k8s.CoreV1Api);
      await coreV1Api.listNamespace();
      logger.success('[Kubernetes] Conexão estabelecida com sucesso');
      return true;
    } catch (error) {
      logger.error('[Kubernetes] Falha na conexão: ' + (error instanceof Error ? error.message : String(error)));
      return false;
    }
  }
}