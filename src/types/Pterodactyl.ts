export interface PterodactylServer {
  object: string;
  attributes: {
    id: number;
    external_id: string | null;
    uuid: string;
    identifier: string;
    name: string;
    description: string;
    status: string | null;
    suspended: boolean;
    limits: {
      memory: number;
      swap: number;
      disk: number;
      io: number;
      cpu: number;
      threads: string | null;
      oom_disabled: boolean;
    };
    feature_limits: {
      databases: number;
      allocations: number;
      backups: number;
    };
    user: number;
    node: number;
    allocation: number;
    nest: number;
    egg: number;
    container: {
      startup_command: string;
      image: string;
      installed: boolean;
      environment: Record<string, any>;
    };
    updated_at: string;
    created_at: string;
  };
}

export interface PterodactylServerStats {
  object: string;
  attributes: {
    current_state: string;
    is_suspended: boolean;
    resources: {
      memory_bytes: number;
      cpu_absolute: number;
      disk_bytes: number;
      network_rx_bytes: number;
      network_tx_bytes: number;
      uptime: number;
    };
  };
}

export interface PterodactylUser {
  object: string;
  attributes: {
    id: number;
    external_id: string | null;
    uuid: string;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    language: string;
    admin: boolean;
    created_at: string;
    updated_at: string;
  };
}

export interface CreateServerRequest {
  name: string;
  description?: string;
  user: number;
  egg: number;
  docker_image: string;
  startup: string;
  environment: Record<string, any>;
  limits: {
    memory: number;
    swap: number;
    disk: number;
    io: number;
    cpu: number;
    threads?: string;
    oom_disabled?: boolean;
  };
  feature_limits: {
    databases: number;
    allocations: number;
    backups: number;
  };
  allocation: {
    default: number;
    additional?: number[];
  };
  start_on_completion?: boolean;
  skip_scripts?: boolean;
}

export interface PterodactylNode {
  object: string;
  attributes: {
    id: number;
    uuid: string;
    public: boolean;
    name: string;
    description: string;
    location_id: number;
    fqdn: string;
    scheme: string;
    behind_proxy: boolean;
    maintenance_mode: boolean;
    memory: number;
    memory_overallocate: number;
    disk: number;
    disk_overallocate: number;
    upload_size: number;
    daemon_listen: number;
    daemon_sftp: number;
    daemon_base: string;
    created_at: string;
    updated_at: string;
    allocated_resources: {
      memory: number;
      disk: number;
    };
    relationships?: {
      allocations?: {
        object: string;
        data: PterodactylAllocation[];
      };
    };
  };
}

export interface PterodactylNest {
  object: string;
  attributes: {
    id: number;
    uuid: string;
    author: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
    relationships?: {
      eggs?: {
        object: string;
        data: PterodactylEgg[];
      };
      servers?: {
        object: string;
        data: PterodactylServer[];
      };
    };
  };
}

export interface PterodactylEgg {
  object: string;
  attributes: {
    id: number;
    uuid: string;
    name: string;
    nest: number;
    author: string;
    description: string;
    docker_image: string;
    docker_images: Record<string, string>;
    config: {
      files: Record<string, any>;
      startup: {
        done: string;
        userInteraction: string[];
      };
      stop: string;
      logs: Record<string, boolean>;
      file_denylist: string[];
    };
    startup: string;
    script: {
      privileged: boolean;
      install: string;
      entry: string;
      container: string;
      extends: string | null;
    };
    created_at: string;
    updated_at: string;
    relationships?: {
      nest?: {
        object: string;
        data: PterodactylNest;
      };
      variables?: {
        object: string;
        data: PterodactylEggVariable[];
      };
    };
  };
}

export interface PterodactylEggVariable {
  object: string;
  attributes: {
    id: number;
    egg_id: number;
    name: string;
    description: string;
    env_variable: string;
    default_value: string;
    user_viewable: boolean;
    user_editable: boolean;
    rules: string;
    created_at: string;
    updated_at: string;
  };
}

export interface PterodactylAllocation {
  object: string;
  attributes: {
    id: number;
    ip: string;
    alias: string | null;
    port: number;
    notes: string | null;
    assigned: boolean;
  };
}

export interface CreateMinecraftServerRequest {
  name: string;
  description?: string;
  user: number;
  egg: number;
  docker_image: string;
  startup: string;
  environment: Record<string, any>;
  limits: {
    memory: number;
    swap: number;
    disk: number;
    io: number;
    cpu: number;
    threads?: string;
    oom_disabled?: boolean;
  };
  feature_limits: {
    databases: number;
    allocations: number;
    backups: number;
  };
  allocation: {
    default: number;
    additional?: number[];
  };
  start_on_completion?: boolean;
  skip_scripts?: boolean;
}

export interface PterodactylApiResponse<T> {
  object: string;
  data: T[];
  meta?: {
    pagination: {
      total: number;
      count: number;
      per_page: number;
      current_page: number;
      total_pages: number;
    };
  };
}