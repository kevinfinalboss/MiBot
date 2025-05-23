import { CloudflareBaseClient } from './BaseClient';
import { DNSRecord, CreateDNSRecordData, UpdateDNSRecordData } from '../../types/cloudflare/Cloudflare';

export class DNSManager extends CloudflareBaseClient {

  async getDNSRecords(zoneId: string): Promise<DNSRecord[]> {
    try {
      this.validateZoneId(zoneId);

      const response = await this.cf.dns.records.list({ zone_id: zoneId });
      return response.result as unknown as DNSRecord[];
    } catch (error) {
      this.handleError(`getDNSRecords(${zoneId})`, error);
    }
  }

  async getDNSRecord(zoneId: string, recordId: string): Promise<DNSRecord> {
    try {
      this.validateZoneId(zoneId);

      const response = await this.cf.dns.records.get(recordId, {
        zone_id: zoneId
      });
      return response as unknown as DNSRecord;
    } catch (error) {
      this.handleError(`getDNSRecord(${zoneId}, ${recordId})`, error);
    }
  }

  async createDNSRecord(zoneId: string, data: CreateDNSRecordData): Promise<DNSRecord> {
    try {
      this.validateZoneId(zoneId);

      const baseData = {
        zone_id: zoneId,
        type: data.type as any,
        name: data.name,
        content: data.content,
        ttl: data.ttl,
        proxied: data.proxied,
        comment: data.comment,
        tags: data.tags
      };

      if (data.type === 'SRV' && (data as any).priority !== undefined) {
        const srvData = data as any;
        const response = await this.cf.dns.records.create({
          ...baseData,
          data: {
            priority: srvData.priority,
            weight: srvData.weight,
            port: srvData.port,
            target: srvData.target
          }
        });
        return response as unknown as DNSRecord;
      } else {
        const response = await this.cf.dns.records.create(baseData);
        return response as unknown as DNSRecord;
      }
    } catch (error) {
      this.handleError(`createDNSRecord(${zoneId})`, error);
    }
  }

  async updateDNSRecord(zoneId: string, recordId: string, data: UpdateDNSRecordData): Promise<DNSRecord> {
    try {
      this.validateZoneId(zoneId);

      const response = await this.cf.dns.records.edit(recordId, {
        zone_id: zoneId,
        type: data.type as any,
        name: data.name,
        content: data.content,
        ttl: data.ttl,
        proxied: data.proxied,
        comment: data.comment,
        tags: data.tags
      });
      return response as unknown as DNSRecord;
    } catch (error) {
      this.handleError(`updateDNSRecord(${zoneId}, ${recordId})`, error);
    }
  }

  async deleteDNSRecord(zoneId: string, recordId: string): Promise<boolean> {
    try {
      this.validateZoneId(zoneId);

      await this.cf.dns.records.delete(recordId, {
        zone_id: zoneId
      });
      return true;
    } catch (error) {
      this.handleError(`deleteDNSRecord(${zoneId}, ${recordId})`, error);
    }
  }

  async findDNSRecordsByName(zoneId: string, name: string): Promise<DNSRecord[]> {
    try {
      const records = await this.getDNSRecords(zoneId);
      return records.filter(record => record.name === name);
    } catch (error) {
      this.handleError(`findDNSRecordsByName(${zoneId}, ${name})`, error);
    }
  }

  async findDNSRecordsByType(zoneId: string, type: string): Promise<DNSRecord[]> {
    try {
      const records = await this.getDNSRecords(zoneId);
      return records.filter(record => record.type === type.toUpperCase());
    } catch (error) {
      this.handleError(`findDNSRecordsByType(${zoneId}, ${type})`, error);
    }
  }

  async findDNSRecordsByContent(zoneId: string, content: string): Promise<DNSRecord[]> {
    try {
      const records = await this.getDNSRecords(zoneId);
      return records.filter(record => 
        record.content.toLowerCase().includes(content.toLowerCase())
      );
    } catch (error) {
      this.handleError(`findDNSRecordsByContent(${zoneId}, ${content})`, error);
    }
  }

  async searchDNSRecords(zoneId: string, query: string): Promise<DNSRecord[]> {
    try {
      if (!query || query.trim().length === 0) {
        return await this.getDNSRecords(zoneId);
      }

      const records = await this.getDNSRecords(zoneId);
      const normalizedQuery = query.toLowerCase().trim();
      
      return records.filter(record => 
        record.name.toLowerCase().includes(normalizedQuery) ||
        record.content.toLowerCase().includes(normalizedQuery) ||
        record.type.toLowerCase().includes(normalizedQuery) ||
        record.id.toLowerCase().includes(normalizedQuery)
      );
    } catch (error) {
      this.handleError(`searchDNSRecords(${zoneId}, ${query})`, error);
    }
  }

  async getProxiedRecords(zoneId: string): Promise<DNSRecord[]> {
    try {
      const records = await this.getDNSRecords(zoneId);
      return records.filter(record => record.proxied === true);
    } catch (error) {
      this.handleError(`getProxiedRecords(${zoneId})`, error);
    }
  }

  async getNonProxiedRecords(zoneId: string): Promise<DNSRecord[]> {
    try {
      const records = await this.getDNSRecords(zoneId);
      return records.filter(record => record.proxied === false);
    } catch (error) {
      this.handleError(`getNonProxiedRecords(${zoneId})`, error);
    }
  }

  async toggleProxy(zoneId: string, recordId: string): Promise<DNSRecord> {
    try {
      const record = await this.getDNSRecord(zoneId, recordId);
      
      if (!['A', 'AAAA', 'CNAME'].includes(record.type)) {
        throw new Error(`Tipo de registro ${record.type} não suporta proxy`);
      }

      return await this.updateDNSRecord(zoneId, recordId, {
        proxied: !record.proxied
      });
    } catch (error) {
      this.handleError(`toggleProxy(${zoneId}, ${recordId})`, error);
    }
  }

  async bulkUpdateTTL(zoneId: string, recordIds: string[], ttl: number): Promise<DNSRecord[]> {
    try {
      const updatePromises = recordIds.map(recordId => 
        this.updateDNSRecord(zoneId, recordId, { ttl })
      );
      
      return await Promise.all(updatePromises);
    } catch (error) {
      this.handleError(`bulkUpdateTTL(${zoneId})`, error);
    }
  }

  async validateDNSRecord(data: CreateDNSRecordData): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Nome é obrigatório');
    }

    if (!data.content || data.content.trim().length === 0) {
      errors.push('Conteúdo é obrigatório');
    }

    if (!data.type || !['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'NS', 'PTR', 'CAA'].includes(data.type)) {
      errors.push('Tipo de registro inválido');
    }

    if (data.ttl && (data.ttl < 1 || data.ttl > 86400)) {
      errors.push('TTL deve estar entre 1 e 86400 segundos');
    }

    if (data.proxied && !['A', 'AAAA', 'CNAME'].includes(data.type)) {
      errors.push(`Tipo ${data.type} não suporta proxy`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async getDNSRecordStats(zoneId: string): Promise<{
    total: number;
    byType: Record<string, number>;
    proxied: number;
    nonProxied: number;
  }> {
    try {
      const records = await this.getDNSRecords(zoneId);
      
      const byType = records.reduce((acc, record) => {
        acc[record.type] = (acc[record.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const proxied = records.filter(r => r.proxied).length;
      const nonProxied = records.filter(r => !r.proxied).length;

      return {
        total: records.length,
        byType,
        proxied,
        nonProxied
      };
    } catch (error) {
      this.handleError(`getDNSRecordStats(${zoneId})`, error);
    }
  }
}