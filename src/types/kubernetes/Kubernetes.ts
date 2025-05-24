export interface KubernetesConfig {
  inCluster: boolean;
  namespace?: string;
}

export interface PodInfo {
  name: string;
  namespace: string;
  status: string;
  restarts: number;
  age: string;
  ip?: string;
  resources?: {
    requests?: {
      cpu?: string;
      memory?: string;
    };
    limits?: {
      cpu?: string;
      memory?: string;
    };
  };
}

export interface DeploymentInfo {
  name: string;
  namespace: string;
  replicas: {
    desired: number;
    ready: number;
    available: number;
  };
  status: string;
  age: string;
}

export interface ServiceInfo {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIP?: string;
  ports: Array<{
    port: number;
    targetPort: number;
    protocol: string;
  }>;
}

export interface ConfigMapInfo {
  name: string;
  namespace: string;
  data: Record<string, string>;
  age: string;
}

export interface SecretInfo {
  name: string;
  namespace: string;
  type: string;
  data: Record<string, string>;
  age: string;
}

export interface CronJobInfo {
  name: string;
  namespace: string;
  schedule: string;
  lastSchedule?: string;
  active: number;
  suspend: boolean;
  age: string;
}

export interface JobInfo {
  name: string;
  namespace: string;
  completions: number;
  duration?: string;
  age: string;
  status: string;
}

export interface NodeInfo {
  name: string;
  status: string;
  roles: string[];
  age: string;
  version: string;
  internalIP: string;
  externalIP?: string;
  osImage?: string;
  kernelVersion?: string;
  containerRuntime?: string;
  architecture?: string;
  capacity?: {
    cpu: string;
    memory: string;
    pods: string;
    storage: string;
  };
  allocatable?: {
    cpu: string;
    memory: string;
    pods: string;
    storage: string;
  };
  conditions?: Array<{
    type: string;
    status: string;
    reason: string;
    message: string;
  }>;
}

export interface NamespaceInfo {
  name: string;
  status: string;
  age: string;
}

export interface EventInfo {
  type: string;
  reason: string;
  object: string;
  message: string;
  firstTime: string;
  lastTime: string;
  count: number;
}

export interface ResourceQuota {
  namespace: string;
  hard: Record<string, string>;
  used: Record<string, string>;
}

export interface PersistentVolumeInfo {
  name: string;
  capacity: string;
  accessModes: string[];
  reclaimPolicy: string;
  status: string;
  claim?: string;
  storageClass?: string;
  age: string;
}

export interface PersistentVolumeClaimInfo {
  name: string;
  namespace: string;
  status: string;
  volume?: string;
  capacity?: string;
  accessModes: string[];
  storageClass?: string;
  age: string;
}