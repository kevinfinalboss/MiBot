import * as k8s from '@kubernetes/client-node';
import { BaseClient } from './BaseClient';
import { CronJobInfo, JobInfo } from '../../types/kubernetes/Kubernetes';
import { logger } from '../../utils/logger';

export class CronJobManager extends BaseClient {
  private batchV1Api: k8s.BatchV1Api;

  constructor(config: any) {
    super(config);
    this.batchV1Api = this.kc.makeApiClient(k8s.BatchV1Api);
  }

  public async listCronJobs(namespace?: string): Promise<CronJobInfo[]> {
    try {
      if (namespace) {
        const response = await this.batchV1Api.listNamespacedCronJob({ namespace });
        return response.items.map((cronJob: k8s.V1CronJob) => ({
          name: cronJob.metadata?.name || 'unknown',
          namespace: cronJob.metadata?.namespace || namespace,
          schedule: cronJob.spec?.schedule || 'unknown',
          lastSchedule: cronJob.status?.lastScheduleTime?.toISOString(),
          active: cronJob.status?.active?.length || 0,
          suspend: cronJob.spec?.suspend || false,
          age: this.calculateAge(cronJob.metadata?.creationTimestamp)
        }));
      } else {
        const response = await this.batchV1Api.listCronJobForAllNamespaces();
        return response.items.map((cronJob: k8s.V1CronJob) => ({
          name: cronJob.metadata?.name || 'unknown',
          namespace: cronJob.metadata?.namespace || 'unknown',
          schedule: cronJob.spec?.schedule || 'unknown',
          lastSchedule: cronJob.status?.lastScheduleTime?.toISOString(),
          active: cronJob.status?.active?.length || 0,
          suspend: cronJob.spec?.suspend || false,
          age: this.calculateAge(cronJob.metadata?.creationTimestamp)
        }));
      }
    } catch (error: any) {
      this.handleError(error, 'listar cronjobs');
    }
  }

  public async getCronJob(name: string, namespace?: string): Promise<CronJobInfo | null> {
    try {
      const targetNamespace = namespace || this.getNamespace();
      const response = await this.batchV1Api.readNamespacedCronJob({ name, namespace: targetNamespace });

      return {
        name: response.metadata?.name || name,
        namespace: response.metadata?.namespace || targetNamespace,
        schedule: response.spec?.schedule || 'unknown',
        lastSchedule: response.status?.lastScheduleTime?.toISOString(),
        active: response.status?.active?.length || 0,
        suspend: response.spec?.suspend || false,
        age: this.calculateAge(response.metadata?.creationTimestamp)
      };
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        return null;
      }
      this.handleError(error, `obter cronjob ${name}`);
    }
  }

  public async suspendCronJob(name: string, suspend: boolean, namespace?: string): Promise<boolean> {
    try {
      const targetNamespace = namespace || this.getNamespace();
      
      const patchBody = {
        spec: {
          suspend: suspend
        }
      };

      await this.batchV1Api.patchNamespacedCronJob({
        name,
        namespace: targetNamespace,
        body: patchBody
      });

      const action = suspend ? 'suspenso' : 'retomado';
      logger.info(`[Kubernetes] CronJob ${name} ${action} com sucesso`);
      return true;
    } catch (error: any) {
      this.handleError(error, `${suspend ? 'suspender' : 'retomar'} cronjob ${name}`);
    }
  }

  public async triggerCronJob(name: string, namespace?: string): Promise<string> {
    try {
      const targetNamespace = namespace || this.getNamespace();
      
      const cronJobResponse = await this.batchV1Api.readNamespacedCronJob({ name, namespace: targetNamespace });

      if (!cronJobResponse.spec?.jobTemplate) {
        throw new Error('Template do job não encontrado no CronJob');
      }

      const jobName = `${name}-manual-${Date.now()}`;
      const job: k8s.V1Job = {
        apiVersion: 'batch/v1',
        kind: 'Job',
        metadata: {
          name: jobName,
          namespace: targetNamespace,
          labels: {
            'cronjob': name,
            'manual-trigger': 'true'
          }
        },
        spec: cronJobResponse.spec.jobTemplate.spec
      };

      await this.batchV1Api.createNamespacedJob({ namespace: targetNamespace, body: job });
      logger.info(`[Kubernetes] Job manual ${jobName} criado a partir do CronJob ${name}`);
      return jobName;
    } catch (error: any) {
      this.handleError(error, `executar cronjob ${name} manualmente`);
    }
  }

  public async listJobs(namespace?: string): Promise<JobInfo[]> {
    try {
      const targetNamespace = namespace || this.getNamespace();
      const response = await this.batchV1Api.listNamespacedJob({ namespace: targetNamespace });
      
      return response.items.map((job: k8s.V1Job) => ({
        name: job.metadata?.name || 'unknown',
        namespace: job.metadata?.namespace || targetNamespace,
        completions: job.spec?.completions || 1,
        duration: this.calculateDuration(job.status?.startTime, job.status?.completionTime),
        age: this.calculateAge(job.metadata?.creationTimestamp),
        status: this.getJobStatus(job)
      }));
    } catch (error: any) {
      this.handleError(error, 'listar jobs');
    }
  }

  public async getJob(name: string, namespace?: string): Promise<JobInfo | null> {
    try {
      const targetNamespace = namespace || this.getNamespace();
      const response = await this.batchV1Api.readNamespacedJob({ name, namespace: targetNamespace });

      return {
        name: response.metadata?.name || name,
        namespace: response.metadata?.namespace || targetNamespace,
        completions: response.spec?.completions || 1,
        duration: this.calculateDuration(response.status?.startTime, response.status?.completionTime),
        age: this.calculateAge(response.metadata?.creationTimestamp),
        status: this.getJobStatus(response)
      };
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        return null;
      }
      this.handleError(error, `obter job ${name}`);
    }
  }

  public async deleteJob(name: string, namespace?: string): Promise<boolean> {
    try {
      const targetNamespace = namespace || this.getNamespace();
      await this.batchV1Api.deleteNamespacedJob({ name, namespace: targetNamespace });
      logger.info(`[Kubernetes] Job ${name} deletado com sucesso`);
      return true;
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        logger.warn(`[Kubernetes] Job ${name} não encontrado`);
        return false;
      }
      this.handleError(error, `deletar job ${name}`);
    }
  }

  private getJobStatus(job: k8s.V1Job): string {
    if (job.status?.succeeded && job.status.succeeded > 0) {
      return 'Completed';
    }
    if (job.status?.failed && job.status.failed > 0) {
      return 'Failed';
    }
    if (job.status?.active && job.status.active > 0) {
      return 'Running';
    }
    return 'Pending';
  }

  private calculateDuration(startTime?: Date, completionTime?: Date): string | undefined {
    if (!startTime) return undefined;
    
    const endTime = completionTime || new Date();
    const diffMs = endTime.getTime() - new Date(startTime).getTime();
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (diffMinutes > 0) return `${diffMinutes}m${diffSeconds}s`;
    return `${diffSeconds}s`;
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