import { AxiosResponse } from 'axios';
import { PterodactylBaseClient } from './BaseClient';
import { PterodactylUser, PterodactylApiResponse } from '../../types/Pterodactyl';

export interface CreateUserRequest {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password?: string;
  admin?: boolean;
  language?: string;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  password?: string;
  admin?: boolean;
  language?: string;
}

export class UserManager extends PterodactylBaseClient {

  async getUsers(page: number = 1, perPage: number = 50): Promise<PterodactylApiResponse<PterodactylUser>> {
    try {
      const response: AxiosResponse<PterodactylApiResponse<PterodactylUser>> = await this.api.get(
        `/users?page=${page}&per_page=${perPage}`
      );
      return response.data;
    } catch (error) {
      this.handleError('getUsers', error);
    }
  }

  async getAllUsers(): Promise<PterodactylUser[]> {
    try {
      const allUsers: PterodactylUser[] = [];
      let currentPage = 1;
      let totalPages = 1;

      do {
        const response = await this.getUsers(currentPage, 100);
        allUsers.push(...response.data);
        
        if (response.meta?.pagination) {
          totalPages = response.meta.pagination.total_pages;
          currentPage++;
        } else {
          break;
        }
      } while (currentPage <= totalPages);

      return allUsers;
    } catch (error) {
      this.handleError('getAllUsers', error);
    }
  }

  async getUser(userId: number): Promise<PterodactylUser> {
    try {
      const response: AxiosResponse<{ data: PterodactylUser }> = await this.api.get(`/users/${userId}`);
      return response.data.data;
    } catch (error) {
      this.handleError(`getUser(${userId})`, error);
    }
  }

  async getUserByEmail(email: string): Promise<PterodactylUser | null> {
    try {
      const allUsers = await this.getAllUsers();
      return allUsers.find(user => user.attributes.email.toLowerCase() === email.toLowerCase()) || null;
    } catch (error) {
      this.handleError(`getUserByEmail(${email})`, error);
    }
  }

  async getUserByUsername(username: string): Promise<PterodactylUser | null> {
    try {
      const allUsers = await this.getAllUsers();
      return allUsers.find(user => user.attributes.username.toLowerCase() === username.toLowerCase()) || null;
    } catch (error) {
      this.handleError(`getUserByUsername(${username})`, error);
    }
  }

  async searchUsers(query: string): Promise<PterodactylUser[]> {
    try {
      const allUsers = await this.getAllUsers();
      const lowercaseQuery = query.toLowerCase();
      
      return allUsers.filter(user => 
        user.attributes.username.toLowerCase().includes(lowercaseQuery) ||
        user.attributes.email.toLowerCase().includes(lowercaseQuery) ||
        user.attributes.first_name.toLowerCase().includes(lowercaseQuery) ||
        user.attributes.last_name.toLowerCase().includes(lowercaseQuery)
      );
    } catch (error) {
      this.handleError(`searchUsers(${query})`, error);
    }
  }

  async createUser(userData: CreateUserRequest): Promise<PterodactylUser> {
    try {
      const response: AxiosResponse<{ data: PterodactylUser }> = await this.api.post('/users', {
        username: userData.username,
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        password: userData.password,
        admin: userData.admin || false,
        language: userData.language || 'en'
      });
      return response.data.data;
    } catch (error) {
      this.handleError('createUser', error);
    }
  }

  async updateUser(userId: number, userData: UpdateUserRequest): Promise<PterodactylUser> {
    try {
      const response: AxiosResponse<{ data: PterodactylUser }> = await this.api.patch(`/users/${userId}`, userData);
      return response.data.data;
    } catch (error) {
      this.handleError(`updateUser(${userId})`, error);
    }
  }

  async deleteUser(userId: number): Promise<void> {
    try {
      await this.api.delete(`/users/${userId}`);
    } catch (error) {
      this.handleError(`deleteUser(${userId})`, error);
    }
  }

  async getUserServers(userId: number): Promise<any[]> {
    try {
      const response = await this.api.get(`/users/${userId}/servers`);
      return response.data.data || [];
    } catch (error) {
      this.handleError(`getUserServers(${userId})`, error);
    }
  }

  async getAdminUsers(): Promise<PterodactylUser[]> {
    try {
      const allUsers = await this.getAllUsers();
      return allUsers.filter(user => user.attributes.admin);
    } catch (error) {
      this.handleError('getAdminUsers', error);
    }
  }

  async promoteUserToAdmin(userId: number): Promise<PterodactylUser> {
    try {
      return await this.updateUser(userId, { admin: true });
    } catch (error) {
      this.handleError(`promoteUserToAdmin(${userId})`, error);
    }
  }

  async demoteUserFromAdmin(userId: number): Promise<PterodactylUser> {
    try {
      return await this.updateUser(userId, { admin: false });
    } catch (error) {
      this.handleError(`demoteUserFromAdmin(${userId})`, error);
    }
  }

  async generateUserPassword(userId: number): Promise<{ password: string }> {
    try {
      const randomPassword = this.generateRandomPassword();
      await this.updateUser(userId, { password: randomPassword });
      return { password: randomPassword };
    } catch (error) {
      this.handleError(`generateUserPassword(${userId})`, error);
    }
  }

  private generateRandomPassword(length: number = 12): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }
}