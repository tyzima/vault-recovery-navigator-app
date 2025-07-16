import Dexie, { Table } from 'dexie';

// Define types based on the original Supabase schema
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

class VaultDatabase extends Dexie {
  profiles!: Table<Profile>;
  clients!: Table<Client>;
  apps!: Table<App>;
  runbooks!: Table<Runbook>;
  runbook_steps!: Table<RunbookStep>;
  runbook_apps!: Table<RunbookApp>;
  runbook_step_apps!: Table<RunbookStepApp>;
  runbook_step_photos!: Table<RunbookStepPhoto>;
  runbook_executions!: Table<RunbookExecution>;
  execution_step_assignments!: Table<ExecutionStepAssignment>;
  client_assignments!: Table<ClientAssignment>;
  // Chat tables
  chat_channels!: Table<ChatChannel>;
  channel_memberships!: Table<ChannelMembership>;
  chat_messages!: Table<ChatMessage>;
  message_attachments!: Table<MessageAttachment>;

  constructor() {
    super('VaultRecoveryDatabase');
    
    this.version(2).stores({
      profiles: 'id, email, role, client_id',
      clients: 'id, name, contact_email',
      apps: 'id, name',
      runbooks: 'id, title, client_id, created_by, is_template',
      runbook_steps: 'id, runbook_id, step_order, assigned_to',
      runbook_apps: 'id, runbook_id, app_id',
      runbook_step_apps: 'id, step_id, app_id',
      runbook_step_photos: 'id, step_id, uploaded_by',
      runbook_executions: 'id, runbook_id, client_id, started_by, status',
      execution_step_assignments: 'id, execution_id, step_id, assigned_to, status',
      client_assignments: 'id, client_id, kelyn_rep_id',
      // Chat indexes
      chat_channels: 'id, type, client_id, created_by, archived, last_message_at',
      channel_memberships: 'id, channel_id, user_id, last_read_at',
      chat_messages: 'id, channel_id, user_id, created_at, deleted',
      message_attachments: 'id, message_id'
    });
  }
}

export const db = new VaultDatabase();

// Helper function to generate UUIDs
export function generateId(): string {
  return crypto.randomUUID();
}

// Helper function to get current timestamp
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

// Initialize database with some default data
export async function initializeDatabase() {
  try {
    // Check if database is already initialized
    const existingProfiles = await db.profiles.count();
    if (existingProfiles > 0) {
      return; // Already initialized
    }

    console.log('Initializing local database...');

    // Create default admin user
    const adminId = generateId();
    await db.profiles.add({
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

    await db.apps.bulkAdd(defaultApps);

    console.log('Local database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
} 