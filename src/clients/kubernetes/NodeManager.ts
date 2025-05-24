import * as k8s from '@kubernetes/client-node';
import { BaseClient } from './BaseClient';
import { NodeInfo } from '../../types/kubernetes/Kubernetes';
import { logger } from '../../utils/logger';

export class NodeManager extends BaseClient {
  private coreV1Api: k8s.CoreV1Api;

  constructor(config: any) {
    super(config);
    this.coreV1Api = this.kc.makeApiClient(k8s.CoreV1Api);
  }

  public async listNodes(): Promise<NodeInfo[]> {
    try {
      const response = await this.coreV1Api.listNode();
      
      return response.items.map((node: k8s.V1Node) => ({
        name: node.metadata?.name || 'unknown',
        status: this.getNodeStatus(node),
        roles: this.getNodeRoles(node),
        age: this.calculateAge(node.metadata?.creationTimestamp),
        version: node.status?.nodeInfo?.kubeletVersion || 'unknown',
        internalIP: this.getNodeIP(node, 'InternalIP'),
        externalIP: this.getNodeIP(node, 'ExternalIP'),
        osImage: node.status?.nodeInfo?.osImage || 'unknown',
        kernelVersion: node.status?.nodeInfo?.kernelVersion || 'unknown',
        containerRuntime: node.status?.nodeInfo?.containerRuntimeVersion || 'unknown',
        architecture: node.status?.nodeInfo?.architecture || 'unknown',
        capacity: {
          cpu: node.status?.capacity?.cpu || '0',
          memory: node.status?.capacity?.memory || '0',
          pods: node.status?.capacity?.pods || '0',
          storage: node.status?.capacity?.['ephemeral-storage'] || '0'
        },
        allocatable: {
          cpu: node.status?.allocatable?.cpu || '0',
          memory: node.status?.allocatable?.memory || '0',
          pods: node.status?.allocatable?.pods || '0',
          storage: node.status?.allocatable?.['ephemeral-storage'] || '0'
        },
        conditions: node.status?.conditions?.map(condition => ({
          type: condition.type || 'Unknown',
          status: condition.status || 'Unknown',
          reason: condition.reason || '',
          message: condition.message || ''
        })) || []
      }));
    } catch (error: any) {
      this.handleError(error, 'listar nodes');
    }
  }

  public async readNode(name: string): Promise<NodeInfo | null> {
    try {
      const response = await this.coreV1Api.readNode({ name });
      const node = response;

      return {
        name: node.metadata?.name || name,
        status: this.getNodeStatus(node),
        roles: this.getNodeRoles(node),
        age: this.calculateAge(node.metadata?.creationTimestamp),
        version: node.status?.nodeInfo?.kubeletVersion || 'unknown',
        internalIP: this.getNodeIP(node, 'InternalIP'),
        externalIP: this.getNodeIP(node, 'ExternalIP'),
        osImage: node.status?.nodeInfo?.osImage || 'unknown',
        kernelVersion: node.status?.nodeInfo?.kernelVersion || 'unknown',
        containerRuntime: node.status?.nodeInfo?.containerRuntimeVersion || 'unknown',
        architecture: node.status?.nodeInfo?.architecture || 'unknown',
        capacity: {
          cpu: node.status?.capacity?.cpu || '0',
          memory: node.status?.capacity?.memory || '0',
          pods: node.status?.capacity?.pods || '0',
          storage: node.status?.capacity?.['ephemeral-storage'] || '0'
        },
        allocatable: {
          cpu: node.status?.allocatable?.cpu || '0',
          memory: node.status?.allocatable?.memory || '0',
          pods: node.status?.allocatable?.pods || '0',
          storage: node.status?.allocatable?.['ephemeral-storage'] || '0'
        },
        conditions: node.status?.conditions?.map(condition => ({
          type: condition.type || 'Unknown',
          status: condition.status || 'Unknown',
          reason: condition.reason || '',
          message: condition.message || ''
        })) || []
      };
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        return null;
      }
      this.handleError(error, `obter node ${name}`);
    }
  }

  private getNodeStatus(node: k8s.V1Node): string {
    const readyCondition = node.status?.conditions?.find(c => c.type === 'Ready');
    return readyCondition?.status === 'True' ? 'Ready' : 'NotReady';
  }

  private getNodeRoles(node: k8s.V1Node): string[] {
    const labels = node.metadata?.labels || {};
    const roles: string[] = [];
    
    Object.keys(labels).forEach(label => {
      if (label.startsWith('node-role.kubernetes.io/')) {
        const role = label.replace('node-role.kubernetes.io/', '');
        if (role) roles.push(role);
      }
    });
    
    return roles.length > 0 ? roles : ['worker'];
  }

  private getNodeIP(node: k8s.V1Node, type: string): string {
    const address = node.status?.addresses?.find(addr => addr.type === type);
    return address?.address || '';
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