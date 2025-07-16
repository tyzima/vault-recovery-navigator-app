// File-based client that connects to the Express backend
const API_BASE = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3001/api';

interface AuthResponse {
  user: any;
  session: { access_token: string };
}

interface FileStorageResponse {
  url: string;
}

class FileClient {
  private session: { access_token: string } | null = null;

  // Authentication methods
  auth = {
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      try {
        const response = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
          const error = await response.json();
          return { data: null, error };
        }

        const data: AuthResponse = await response.json();
        this.session = data.session;
        localStorage.setItem('file_session', JSON.stringify(data.session));
        
        return { data, error: null };
      } catch (error) {
        return { data: null, error: { message: 'Network error' } };
      }
    },

    refreshSession: async () => {
      try {
        if (!this.session?.access_token) {
          return { data: null, error: { message: 'No current session to refresh' } };
        }

        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.session.access_token}`
          }
        });

        if (!response.ok) {
          const error = await response.json();
          return { data: null, error };
        }

        const data: AuthResponse = await response.json();
        this.session = data.session;
        localStorage.setItem('file_session', JSON.stringify(data.session));
        
        return { data, error: null };
      } catch (error) {
        console.error('Session refresh error:', error);
        return { data: null, error: { message: 'Failed to refresh session' } };
      }
    },

    signUp: async ({ email, password, options }: { email: string; password: string; options?: any }) => {
      // For now, sign up creates a new profile
      const newProfile = {
        id: crypto.randomUUID(),
        email,
        first_name: options?.data?.first_name || '',
        last_name: options?.data?.last_name || '',
        role: 'client_member' as const,
        created_at: new Date().toISOString()
      };

      try {
        const response = await fetch(`${API_BASE}/profiles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProfile)
        });

        if (!response.ok) {
          const error = await response.json();
          return { data: null, error };
        }

        return { data: { user: newProfile }, error: null };
      } catch (error) {
        return { data: null, error: { message: 'Network error' } };
      }
    },

    signOut: async () => {
      try {
        await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
        this.session = null;
        localStorage.removeItem('file_session');
        return { error: null };
      } catch (error) {
        return { error: { message: 'Network error' } };
      }
    },

    getSession: async () => {
      const storedSession = localStorage.getItem('file_session');
      if (storedSession) {
        this.session = JSON.parse(storedSession);
        
        // Get user info for the session
        try {
          const tokenData = JSON.parse(atob(this.session!.access_token));
          const email = tokenData.email;
          
          const headers: HeadersInit = {};
          if (this.session?.access_token) {
            headers['Authorization'] = `Bearer ${this.session.access_token}`;
          }
          
          const response = await fetch(`${API_BASE}/profiles`, { headers });
          const profiles = await response.json();
          const user = profiles.find((p: any) => p.email === email);
          
          return {
            data: {
              session: user ? { ...this.session, user } : null
            },
            error: null
          };
        } catch {
          return { data: { session: null }, error: null };
        }
      }
      return { data: { session: null }, error: null };
    },

    onAuthStateChange: (callback: (event: string, session: any) => void) => {
             // Simple implementation - call immediately with current session
       this.auth.getSession().then(({ data }) => {
         callback('INITIAL_SESSION', data.session);
       });

      return {
        data: {
          subscription: {
            unsubscribe: () => {}
          }
        }
      };
    }
  };

  // Database methods
  from(table: string) {
    return {
      select: (columns = '*') => ({
        eq: (column: string, value: any) => this.query(table, { [column]: value }),
        neq: (column: string, value: any) => this.query(table, { [`${column}__not`]: value }),
        gte: (column: string, value: any) => this.query(table, { [`${column}__gte`]: value }),
        lte: (column: string, value: any) => this.query(table, { [`${column}__lte`]: value }),
        like: (column: string, value: any) => this.query(table, { [`${column}__like`]: value }),
        in: (column: string, values: any[]) => this.query(table, { [`${column}__in`]: values }),
        order: (column: string, options?: { ascending?: boolean }) => ({
          execute: () => this.query(table, {}, { order: column, ascending: options?.ascending })
        }),
        limit: (count: number) => ({
          execute: () => this.query(table, {}, { limit: count })
        }),
        execute: () => this.query(table)
      }),

      insert: (data: any) => this.insert(table, data),
      update: (data: any) => ({
        eq: (column: string, value: any) => this.update(table, data, { [column]: value })
      }),
      delete: () => ({
        eq: (column: string, value: any) => this.delete(table, { [column]: value })
      }),
      upsert: (data: any) => this.upsert(table, data)
    };
  }

  private async query(table: string, filters: Record<string, any> = {}, options: { order?: string; ascending?: boolean; limit?: number } = {}) {
    try {
      const headers: HeadersInit = {};
      if (this.session?.access_token) {
        headers['Authorization'] = `Bearer ${this.session.access_token}`;
      }
      
      const response = await fetch(`${API_BASE}/${table}`, { headers });
      if (!response.ok) throw new Error('Failed to fetch');
      
      let data = await response.json();
      
      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (key.includes('__')) {
          const [column, operator] = key.split('__');
          switch (operator) {
            case 'not':
              data = data.filter((item: any) => item[column] !== value);
              break;
            case 'gte':
              data = data.filter((item: any) => item[column] >= value);
              break;
            case 'lte':
              data = data.filter((item: any) => item[column] <= value);
              break;
            case 'like':
              data = data.filter((item: any) => 
                item[column]?.toString().toLowerCase().includes(value.toString().toLowerCase())
              );
              break;
            case 'in':
              data = data.filter((item: any) => value.includes(item[column]));
              break;
          }
        } else {
          data = data.filter((item: any) => item[key] === value);
        }
      });

      // Apply ordering and limits
      if (options.order) {
        data.sort((a: any, b: any) => {
          const aVal = a[options.order];
          const bVal = b[options.order];
          if (options.ascending === false) {
            return bVal > aVal ? 1 : -1;
          }
          return aVal > bVal ? 1 : -1;
        });
      }

      if (options.limit) {
        data = data.slice(0, options.limit);
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: 'Failed to query data' } };
    }
  }

  private async insert(table: string, data: any) {
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (this.session?.access_token) {
        headers['Authorization'] = `Bearer ${this.session.access_token}`;
      }
      
      const response = await fetch(`${API_BASE}/${table}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to insert');
      
      const result = await response.json();
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: { message: 'Failed to insert data' } };
    }
  }

  private async update(table: string, data: any, filters: any) {
    try {
      console.log('FileClient update called:', { table, data, filters });
      
      // First find the item to update
      const { data: items } = await this.query(table, filters);
      console.log('FileClient update - found items:', items);
      
      if (!items || items.length === 0) {
        console.log('FileClient update - no items found');
        return { data: null, error: { message: 'Item not found' } };
      }

      const item = items[0];
      console.log('FileClient update - updating item:', item.id);
      
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (this.session?.access_token) {
        headers['Authorization'] = `Bearer ${this.session.access_token}`;
      }
      
      const response = await fetch(`${API_BASE}/${table}/${item.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        console.log('FileClient update - response not ok:', response.status);
        throw new Error('Failed to update');
      }
      
      const result = await response.json();
      console.log('FileClient update - success:', result);
      return { data: result, error: null };
    } catch (error) {
      console.log('FileClient update - error:', error);
      return { data: null, error: { message: 'Failed to update data' } };
    }
  }

  private async delete(table: string, filters: any) {
    try {
      // First find the item to delete
      const { data: items } = await this.query(table, filters);
      if (!items || items.length === 0) {
        return { data: null, error: { message: 'Item not found' } };
      }

      const item = items[0];
      
      const headers: HeadersInit = {};
      if (this.session?.access_token) {
        headers['Authorization'] = `Bearer ${this.session.access_token}`;
      }
      
      const response = await fetch(`${API_BASE}/${table}/${item.id}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) throw new Error('Failed to delete');
      
      return { data: { success: true }, error: null };
    } catch (error) {
      return { data: null, error: { message: 'Failed to delete data' } };
    }
  }

  private async upsert(table: string, data: any) {
    // Try to find existing record
    if (data.id) {
      const { data: existing } = await this.query(table, { id: data.id });
      if (existing && existing.length > 0) {
        return this.update(table, data, { id: data.id });
      }
    }
    
    // Insert new record
    return this.insert(table, data);
  }

  // Storage methods (for file uploads)
  storage = {
    from: (bucket: string) => ({
      upload: async (path: string, file: File) => {
        // Convert file to base64 for simple storage
        return new Promise<{ data: FileStorageResponse | null; error: any }>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result as string;
            const url = `data:${file.type};base64,${base64.split(',')[1]}`;
            resolve({ data: { url }, error: null });
          };
          reader.onerror = () => {
            resolve({ data: null, error: { message: 'Failed to upload file' } });
          };
          reader.readAsDataURL(file);
        });
      },
      
      remove: async (paths: string[]) => {
        // For file-based storage, we don't need to do anything special
        return { data: null, error: null };
      }
    })
  };

  // Migration functionality has been removed - data files now persist changes directly

  // Migration status checking has been removed - data files now persist changes directly
}

export const fileClient = new FileClient(); 