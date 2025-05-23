import { CloudflareBaseClient } from './BaseClient';
import { Zone } from '../../types/cloudflare/Cloudflare';

export class ZoneManager extends CloudflareBaseClient {

  async getZones(): Promise<Zone[]> {
    try {
      const response = await this.cf.zones.list();
      return response.result as Zone[];
    } catch (error) {
      this.handleError('getZones', error);
    }
  }

  async getZone(zoneId: string): Promise<Zone> {
    try {
      this.validateZoneId(zoneId);
      
      const response = await this.cf.zones.get({ zone_id: zoneId });
      return response as Zone;
    } catch (error) {
      this.handleError(`getZone(${zoneId})`, error);
    }
  }

  async getZoneByName(zoneName: string): Promise<Zone | null> {
    try {
      if (!zoneName || zoneName.trim().length === 0) {
        throw new Error('Nome da zona é obrigatório');
      }

      const zones = await this.getZones();
      return zones.find(zone => zone.name === zoneName) || null;
    } catch (error) {
      this.handleError(`getZoneByName(${zoneName})`, error);
    }
  }

  async searchZones(query: string): Promise<Zone[]> {
    try {
      if (!query || query.trim().length === 0) {
        return await this.getZones();
      }

      const zones = await this.getZones();
      const normalizedQuery = query.toLowerCase().trim();
      
      return zones.filter(zone => 
        zone.name.toLowerCase().includes(normalizedQuery) ||
        zone.id.toLowerCase().includes(normalizedQuery) ||
        zone.status.toLowerCase().includes(normalizedQuery)
      );
    } catch (error) {
      this.handleError(`searchZones(${query})`, error);
    }
  }

  async getZonesByStatus(status: string): Promise<Zone[]> {
    try {
      const zones = await this.getZones();
      return zones.filter(zone => zone.status === status.toLowerCase());
    } catch (error) {
      this.handleError(`getZonesByStatus(${status})`, error);
    }
  }

  async getActiveZones(): Promise<Zone[]> {
    try {
      return await this.getZonesByStatus('active');
    } catch (error) {
      this.handleError('getActiveZones', error);
    }
  }

  async getPausedZones(): Promise<Zone[]> {
    try {
      const zones = await this.getZones();
      return zones.filter(zone => zone.paused === true);
    } catch (error) {
      this.handleError('getPausedZones', error);
    }
  }

  async validateZoneAccess(zoneId: string): Promise<boolean> {
    try {
      this.validateZoneId(zoneId);
      await this.getZone(zoneId);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getZoneStats(zoneId: string): Promise<{
    plan: string;
    status: string;
    paused: boolean;
    developmentMode: boolean;
    nameServers: number;
    createdDaysAgo: number;
  }> {
    try {
      this.validateZoneId(zoneId);
      
      const zone = await this.getZone(zoneId);
      const createdDate = new Date(zone.created_on);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - createdDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        plan: zone.plan?.name || 'Unknown',
        status: zone.status,
        paused: zone.paused,
        developmentMode: zone.development_mode > 0,
        nameServers: zone.name_servers.length,
        createdDaysAgo: diffDays
      };
    } catch (error) {
      this.handleError(`getZoneStats(${zoneId})`, error);
    }
  }
}