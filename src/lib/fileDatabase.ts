import { promises as fs } from 'fs';
import path from 'path';

// Types (same as before)
export interface Profile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'kelyn_admin' | 'kelyn_rep' | 'client_admin' | 'client_member';
  client_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface Client {
  id: string;
  name: string;
  description?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  logo_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface App {
  id: string;
  name: string;
  logo_url: string;
  created_at?: string;
  updated_at?: string;
}

export interface Runbook {
  id: string;
  title: string;
  description?: string;
  client_id: string;
  created_by: string;
  app_id?: string;
  is_template?: boolean;
  template_name?: string;
  template_description?: string;
  created_at: string;
  updated_at?: string;
}

export interface RunbookStep {
  id: string;
  runbook_id: string;
  title: string;
  description?: string;
  step_order: number;
  estimated_duration_minutes?: number;
  tasks?: any;
  conditions?: any;
  photo_url?: string;
  app_id?: string;
  assigned_to?: string;
  depends_on?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RunbookApp {
  id: string;
  runbook_id: string;
  app_id: string;
  created_at: string;
}

export interface RunbookStepApp {
  id: string;
  step_id: string;
  app_id: string;
  created_at: string;
}

export interface RunbookStepPhoto {
  id: string;
  step_id: string;
  photo_url: string;
  caption?: string;
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
}

export interface RunbookExecution {
  id: string;
  runbook_id: string;
  client_id: string;
  title: string;
  started_by: string;
  status?: 'draft' | 'active' | 'completed' | 'paused';
  started_at?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ExecutionStepAssignment {
  id: string;
  execution_id: string;
  step_id: string;
  assigned_to?: string;
  status?: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  notes?: string;
  started_at?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ClientAssignment {
  id: string;
  client_id?: string;
  kelyn_rep_id?: string;
  created_at?: string;
}

// Chat system interfaces
export interface ChatChannel {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private' | 'direct';
  client_id?: string; // null for cross-client channels (admin only)
  created_by: string;
  created_at: string;
  archived: boolean;
  last_message_at?: string;
}

export interface ChannelMembership {
  id: string;
  channel_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  last_read_at?: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  message_type: 'text' | 'file' | 'system';
  reply_to_id?: string; // for threading
  created_at: string;
  updated_at?: string;
  deleted: boolean;
  edited: boolean;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  created_at: string;
}

// File-based database class
class FileDatabase {
  private dataDir: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
  }

  private async ensureDataDir(): Promise<void> {
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
    }
  }

  private getFilePath(tableName: string): string {
    return path.join(this.dataDir, `${tableName}.json`);
  }

  private async readTable<T>(tableName: string): Promise<T[]> {
    try {
      const filePath = this.getFilePath(tableName);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // File doesn't exist, return empty array
      return [];
    }
  }

  private async writeTable<T>(tableName: string, data: T[]): Promise<void> {
    await this.ensureDataDir();
    const filePath = this.getFilePath(tableName);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  // Generic CRUD operations
  async findAll<T>(tableName: string): Promise<T[]> {
    return this.readTable<T>(tableName);
  }

  async findById<T extends { id: string }>(tableName: string, id: string): Promise<T | null> {
    const data = await this.readTable<T>(tableName);
    return data.find(item => item.id === id) || null;
  }

  async create<T extends { id: string }>(tableName: string, item: T): Promise<T> {
    const data = await this.readTable<T>(tableName);
    data.push(item);
    await this.writeTable(tableName, data);
    return item;
  }

  async update<T extends { id: string }>(tableName: string, id: string, updates: Partial<T>): Promise<T | null> {
    const data = await this.readTable<T>(tableName);
    const index = data.findIndex(item => item.id === id);
    
    if (index === -1) return null;
    
    data[index] = { ...data[index], ...updates };
    await this.writeTable(tableName, data);
    return data[index];
  }

  async delete(tableName: string, id: string): Promise<boolean> {
    const data = await this.readTable(tableName);
    const index = data.findIndex((item: any) => item.id === id);
    
    if (index === -1) return false;
    
    data.splice(index, 1);
    await this.writeTable(tableName, data);
    return true;
  }

  async bulkAdd<T>(tableName: string, items: T[]): Promise<void> {
    const existingData = await this.readTable<T>(tableName);
    const newData = [...existingData, ...items];
    await this.writeTable(tableName, newData);
  }

  async clear(tableName: string): Promise<void> {
    await this.writeTable(tableName, []);
  }

  async count(tableName: string): Promise<number> {
    const data = await this.readTable(tableName);
    return data.length;
  }

  // Specific table methods
  get profiles() {
    return {
      toArray: () => this.findAll<Profile>('profiles'),
      add: (profile: Profile) => this.create('profiles', profile),
      where: (field: keyof Profile) => ({
        equals: (value: any) => this.findAll<Profile>('profiles').then(data => 
          data.filter(item => item[field] === value)
        )
      }),
      count: () => this.count('profiles'),
      clear: () => this.clear('profiles'),
      bulkAdd: (items: Profile[]) => this.bulkAdd('profiles', items)
    };
  }

  get clients() {
    return {
      toArray: () => this.findAll<Client>('clients'),
      add: (client: Client) => this.create('clients', client),
      where: (field: keyof Client) => ({
        equals: (value: any) => this.findAll<Client>('clients').then(data => 
          data.filter(item => item[field] === value)
        )
      }),
      count: () => this.count('clients'),
      clear: () => this.clear('clients'),
      bulkAdd: (items: Client[]) => this.bulkAdd('clients', items)
    };
  }

  get apps() {
    return {
      toArray: () => this.findAll<App>('apps'),
      add: (app: App) => this.create('apps', app),
      count: () => this.count('apps'),
      clear: () => this.clear('apps'),
      bulkAdd: (items: App[]) => this.bulkAdd('apps', items)
    };
  }

  get runbooks() {
    return {
      toArray: () => this.findAll<Runbook>('runbooks'),
      add: (runbook: Runbook) => this.create('runbooks', runbook),
      where: (field: keyof Runbook) => ({
        equals: (value: any) => this.findAll<Runbook>('runbooks').then(data => 
          data.filter(item => item[field] === value)
        )
      }),
      count: () => this.count('runbooks'),
      clear: () => this.clear('runbooks'),
      bulkAdd: (items: Runbook[]) => this.bulkAdd('runbooks', items)
    };
  }

  get runbook_steps() {
    return {
      toArray: () => this.findAll<RunbookStep>('runbook_steps'),
      add: (step: RunbookStep) => this.create('runbook_steps', step),
      where: (field: keyof RunbookStep) => ({
        equals: (value: any) => this.findAll<RunbookStep>('runbook_steps').then(data => 
          data.filter(item => item[field] === value)
        )
      }),
      count: () => this.count('runbook_steps'),
      clear: () => this.clear('runbook_steps'),
      bulkAdd: (items: RunbookStep[]) => this.bulkAdd('runbook_steps', items)
    };
  }

  get runbook_apps() {
    return {
      toArray: () => this.findAll<RunbookApp>('runbook_apps'),
      add: (item: RunbookApp) => this.create('runbook_apps', item),
      count: () => this.count('runbook_apps'),
      clear: () => this.clear('runbook_apps'),
      bulkAdd: (items: RunbookApp[]) => this.bulkAdd('runbook_apps', items)
    };
  }

  get runbook_step_apps() {
    return {
      toArray: () => this.findAll<RunbookStepApp>('runbook_step_apps'),
      add: (item: RunbookStepApp) => this.create('runbook_step_apps', item),
      count: () => this.count('runbook_step_apps'),
      clear: () => this.clear('runbook_step_apps'),
      bulkAdd: (items: RunbookStepApp[]) => this.bulkAdd('runbook_step_apps', items)
    };
  }

  get runbook_step_photos() {
    return {
      toArray: () => this.findAll<RunbookStepPhoto>('runbook_step_photos'),
      add: (item: RunbookStepPhoto) => this.create('runbook_step_photos', item),
      count: () => this.count('runbook_step_photos'),
      clear: () => this.clear('runbook_step_photos'),
      bulkAdd: (items: RunbookStepPhoto[]) => this.bulkAdd('runbook_step_photos', items)
    };
  }

  get runbook_executions() {
    return {
      toArray: () => this.findAll<RunbookExecution>('runbook_executions'),
      add: (item: RunbookExecution) => this.create('runbook_executions', item),
      count: () => this.count('runbook_executions'),
      clear: () => this.clear('runbook_executions'),
      bulkAdd: (items: RunbookExecution[]) => this.bulkAdd('runbook_executions', items)
    };
  }

  get execution_step_assignments() {
    return {
      toArray: () => this.findAll<ExecutionStepAssignment>('execution_step_assignments'),
      add: (item: ExecutionStepAssignment) => this.create('execution_step_assignments', item),
      count: () => this.count('execution_step_assignments'),
      clear: () => this.clear('execution_step_assignments'),
      bulkAdd: (items: ExecutionStepAssignment[]) => this.bulkAdd('execution_step_assignments', items)
    };
  }

  get client_assignments() {
    return {
      toArray: () => this.findAll<ClientAssignment>('client_assignments'),
      add: (assignment: ClientAssignment) => this.create('client_assignments', assignment),
      where: (field: keyof ClientAssignment) => ({
        equals: (value: any) => this.findAll<ClientAssignment>('client_assignments').then(data => 
          data.filter(item => item[field] === value)
        )
      }),
      count: () => this.count('client_assignments'),
      clear: () => this.clear('client_assignments'),
      bulkAdd: (items: ClientAssignment[]) => this.bulkAdd('client_assignments', items)
    };
  }

  // Chat tables
  get chat_channels() {
    return {
      toArray: () => this.findAll<ChatChannel>('chat_channels'),
      add: (channel: ChatChannel) => this.create('chat_channels', channel),
      where: (field: keyof ChatChannel) => ({
        equals: (value: any) => this.findAll<ChatChannel>('chat_channels').then(data => 
          data.filter(item => item[field] === value)
        )
      }),
      count: () => this.count('chat_channels'),
      clear: () => this.clear('chat_channels'),
      bulkAdd: (items: ChatChannel[]) => this.bulkAdd('chat_channels', items),
      update: (id: string, updates: Partial<ChatChannel>) => this.update('chat_channels', id, updates)
    };
  }

  get channel_memberships() {
    return {
      toArray: () => this.findAll<ChannelMembership>('channel_memberships'),
      add: (membership: ChannelMembership) => this.create('channel_memberships', membership),
      where: (field: keyof ChannelMembership) => ({
        equals: (value: any) => this.findAll<ChannelMembership>('channel_memberships').then(data => 
          data.filter(item => item[field] === value)
        )
      }),
      count: () => this.count('channel_memberships'),
      clear: () => this.clear('channel_memberships'),
      bulkAdd: (items: ChannelMembership[]) => this.bulkAdd('channel_memberships', items),
      update: (id: string, updates: Partial<ChannelMembership>) => this.update('channel_memberships', id, updates)
    };
  }

  get chat_messages() {
    return {
      toArray: () => this.findAll<ChatMessage>('chat_messages'),
      add: (message: ChatMessage) => this.create('chat_messages', message),
      where: (field: keyof ChatMessage) => ({
        equals: (value: any) => this.findAll<ChatMessage>('chat_messages').then(data => 
          data.filter(item => item[field] === value)
        )
      }),
      count: () => this.count('chat_messages'),
      clear: () => this.clear('chat_messages'),
      bulkAdd: (items: ChatMessage[]) => this.bulkAdd('chat_messages', items),
      update: (id: string, updates: Partial<ChatMessage>) => this.update('chat_messages', id, updates)
    };
  }

  get message_attachments() {
    return {
      toArray: () => this.findAll<MessageAttachment>('message_attachments'),
      add: (attachment: MessageAttachment) => this.create('message_attachments', attachment),
      where: (field: keyof MessageAttachment) => ({
        equals: (value: any) => this.findAll<MessageAttachment>('message_attachments').then(data => 
          data.filter(item => item[field] === value)
        )
      }),
      count: () => this.count('message_attachments'),
      clear: () => this.clear('message_attachments'),
      bulkAdd: (items: MessageAttachment[]) => this.bulkAdd('message_attachments', items)
    };
  }
}

export const fileDb = new FileDatabase();

// Helper functions
export function generateId(): string {
  return crypto.randomUUID();
}

export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

// Initialize with default data
export async function initializeFileDatabase() {
  try {
    const existingProfiles = await fileDb.profiles.count();
    if (existingProfiles > 0) {
      return; // Already initialized
    }

    console.log('Initializing file-based database...');

    // Create default admin user
    const adminId = generateId();
    await fileDb.profiles.add({
      id: adminId,
      email: 'admin@vault.local',
      first_name: 'Admin',
      last_name: 'User',
      role: 'kelyn_admin',
      created_at: getCurrentTimestamp()
    });

    // Add some default apps
    const defaultApps = [
      { id: generateId(), name: 'Windows Server', logo_url: '/icons/windows.png', created_at: getCurrentTimestamp() },
      { id: generateId(), name: 'Active Directory', logo_url: '/icons/ad.png', created_at: getCurrentTimestamp() },
      { id: generateId(), name: 'Exchange Server', logo_url: '/icons/exchange.png', created_at: getCurrentTimestamp() },
      { id: generateId(), name: 'SQL Server', logo_url: '/icons/sql.png', created_at: getCurrentTimestamp() },
      { id: generateId(), name: 'VMware', logo_url: '/icons/vmware.png', created_at: getCurrentTimestamp() }
    ];

    await fileDb.apps.bulkAdd(defaultApps);

    console.log('File-based database initialized successfully');
    console.log('Data stored in: ./data/ directory');
  } catch (error) {
    console.error('Error initializing file database:', error);
  }
} 