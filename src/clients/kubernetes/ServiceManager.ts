import * as k8s from '@kubernetes/client-node';
import { BaseClient } from './BaseClient';
import { ServiceInfo } from '../../types/kubernetes/Kubernetes';
import { logger } from '../../utils/logger';

export class ServiceManager extends BaseClient {
  private coreV1Api: k8s.CoreV1Api;

  constructor(config: any) {
    super(config);
    this.coreV1Api = this.kc.makeApiClient(k8s.CoreV1Api);
  }

  public async listServices(namespace?: string): Promise<ServiceInfo[]> {
    try {
      if (namespace) {
        const response = await this.coreV1Api.listNamespacedService({ namespace });
        return response.items.map((service: k8s.V1Service) => ({
          name: service.metadata?.name || 'unknown',
          namespace: service.metadata?.namespace || namespace,
          type: service.spec?.type || 'Unknown',
          clusterIP: service.spec?.clusterIP || 'None',
          externalIP: service.status?.loadBalancer?.ingress?.[0]?.ip,
          ports: service.spec?.ports?.map((port: k8s.V1ServicePort) => ({
            port: port.port,
            targetPort: typeof port.targetPort === 'string' ? parseInt(port.targetPort) : port.targetPort || port.port,
            protocol: port.protocol || 'TCP'
          })) || []
        }));
      } else {
        const response = await this.coreV1Api.listServiceForAllNamespaces();
        return response.items.map((service: k8s.V1Service) => ({
          name: service.metadata?.name || 'unknown',
          namespace: service.metadata?.namespace || 'unknown',
          type: service.spec?.type || 'Unknown',
          clusterIP: service.spec?.clusterIP || 'None',
          externalIP: service.status?.loadBalancer?.ingress?.[0]?.ip,
          ports: service.spec?.ports?.map((port: k8s.V1ServicePort) => ({
            port: port.port,
            targetPort: typeof port.targetPort === 'string' ? parseInt(port.targetPort) : port.targetPort || port.port,
            protocol: port.protocol || 'TCP'
          })) || []
        }));
      }
    } catch (error: any) {
      this.handleError(error, 'listar services');
    }
  }

  public async getService(name: string, namespace?: string): Promise<ServiceInfo | null> {
    try {
      const targetNamespace = namespace || this.getNamespace();
      const response = await this.coreV1Api.readNamespacedService({ name, namespace: targetNamespace });

      return {
        name: response.metadata?.name || name,
        namespace: response.metadata?.namespace || targetNamespace,
        type: response.spec?.type || 'Unknown',
        clusterIP: response.spec?.clusterIP || 'None',
        externalIP: response.status?.loadBalancer?.ingress?.[0]?.ip,
        ports: response.spec?.ports?.map((port: k8s.V1ServicePort) => ({
          port: port.port,
          targetPort: typeof port.targetPort === 'string' ? parseInt(port.targetPort) : port.targetPort || port.port,
          protocol: port.protocol || 'TCP'
        })) || []
      };
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        return null;
      }
      this.handleError(error, `obter service ${name}`);
    }
  }

  public async deleteService(name: string, namespace?: string): Promise<boolean> {
    try {
      const targetNamespace = namespace || this.getNamespace();
      await this.coreV1Api.deleteNamespacedService({ name, namespace: targetNamespace });
      logger.info(`[Kubernetes] Service ${name} deletado com sucesso`);
      return true;
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        logger.warn(`[Kubernetes] Service ${name} não encontrado`);
        return false;
      }
      this.handleError(error, `deletar service ${name}`);
    }
  }
}