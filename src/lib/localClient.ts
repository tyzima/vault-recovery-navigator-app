import { db, generateId, getCurrentTimestamp } from './database';
import { localAuth } from './auth';

// Type definitions for the query builder
interface QueryBuilder<T> {
  select(columns?: string): SelectQueryBuilder<T>;
  insert(data: Partial<T> | Partial<T>[]): InsertQueryBuilder<T>;
  update(data: Partial<T>): UpdateQueryBuilder<T>;
  delete(): DeleteQueryBuilder<T>;
}

interface SelectQueryBuilder<T> {
  eq(column: keyof T, value: any): SelectQueryBuilder<T>;
  neq(column: keyof T, value: any): SelectQueryBuilder<T>;
  in(column: keyof T, values: any[]): SelectQueryBuilder<T>;
  order(column: keyof T, options?: { ascending?: boolean }): SelectQueryBuilder<T>;
  limit(count: number): SelectQueryBuilder<T>;
  single(): Promise<{ data: T | null; error: any }>;
  then(resolve: (result: { data: T[] | null; error: any }) => void): void;
}

interface InsertQueryBuilder<T> {
  then(resolve: (result: { data: T[] | null; error: any }) => void): void;
}

interface UpdateQueryBuilder<T> {
  eq(column: keyof T, value: any): UpdateQueryBuilder<T>;
  then(resolve: (result: { data: T[] | null; error: any }) => void): void;
}

interface DeleteQueryBuilder<T> {
  eq(column: keyof T, value: any): DeleteQueryBuilder<T>;
  then(resolve: (result: { data: T[] | null; error: any }) => void): void;
}

class LocalQueryBuilder<T> implements QueryBuilder<T> {
  private tableName: string;
  private selectColumns: string = '*';
  private whereConditions: Array<{ field: keyof T; operator: string; value: any }> = [];
  private orderByField?: keyof T;
  private orderAscending: boolean = true;
  private limitCount?: number;
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private insertData?: Partial<T> | Partial<T>[];
  private updateData?: Partial<T>;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns: string = '*'): SelectQueryBuilder<T> {
    this.operation = 'select';
    this.selectColumns = columns;
    return this as any;
  }

  insert(data: Partial<T> | Partial<T>[]): InsertQueryBuilder<T> {
    this.operation = 'insert';
    this.insertData = data;
    return this as any;
  }

  update(data: Partial<T>): UpdateQueryBuilder<T> {
    this.operation = 'update';
    this.updateData = data;
    return this as any;
  }

  delete(): DeleteQueryBuilder<T> {
    this.operation = 'delete';
    return this as any;
  }

  eq(column: keyof T, value: any): any {
    this.whereConditions.push({ field: column, operator: '=', value });
    return this;
  }

  neq(column: keyof T, value: any): any {
    this.whereConditions.push({ field: column, operator: '!=', value });
    return this;
  }

  in(column: keyof T, values: any[]): any {
    this.whereConditions.push({ field: column, operator: 'in', value: values });
    return this;
  }

  order(column: keyof T, options: { ascending?: boolean } = {}): any {
    this.orderByField = column;
    this.orderAscending = options.ascending !== false;
    return this;
  }

  limit(count: number): any {
    this.limitCount = count;
    return this;
  }

  async single(): Promise<{ data: T | null; error: any }> {
    const result = await this.execute();
    if (result.error) {
      return { data: null, error: result.error };
    }
    return { data: result.data?.[0] || null, error: null };
  }

  then(resolve: (result: { data: T[] | null; error: any }) => void): void {
    this.execute().then(resolve);
  }

  private async execute(): Promise<{ data: T[] | null; error: any }> {
    try {
      const table = (db as any)[this.tableName];
      if (!table) {
        throw new Error(`Table ${this.tableName} not found`);
      }

      switch (this.operation) {
        case 'select':
          return await this.executeSelect(table);
        case 'insert':
          return await this.executeInsert(table);
        case 'update':
          return await this.executeUpdate(table);
        case 'delete':
          return await this.executeDelete(table);
        default:
          throw new Error(`Unknown operation: ${this.operation}`);
      }
    } catch (error) {
      console.error('Query execution error:', error);
      return { data: null, error };
    }
  }

  private async executeSelect(table: any): Promise<{ data: T[] | null; error: any }> {
    let query = table.orderBy('created_at');

    // Apply where conditions
    for (const condition of this.whereConditions) {
      if (condition.operator === '=') {
        query = query.where(condition.field as string).equals(condition.value);
      } else if (condition.operator === '!=') {
        query = query.where(condition.field as string).notEqual(condition.value);
      } else if (condition.operator === 'in') {
        query = query.where(condition.field as string).anyOf(condition.value);
      }
    }

    // Apply ordering
    if (this.orderByField) {
      if (this.orderAscending) {
        query = query.orderBy(this.orderByField as string);
      } else {
        query = query.reverse();
      }
    }

    // Apply limit
    if (this.limitCount) {
      query = query.limit(this.limitCount);
    }

    const data = await query.toArray();
    return { data, error: null };
  }

  private async executeInsert(table: any): Promise<{ data: T[] | null; error: any }> {
    const dataToInsert = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
    const processedData = dataToInsert.map(item => ({
      ...item,
      id: (item as any).id || generateId(),
      created_at: (item as any).created_at || getCurrentTimestamp(),
      updated_at: getCurrentTimestamp()
    }));

    if (processedData.length === 1) {
      await table.add(processedData[0]);
    } else {
      await table.bulkAdd(processedData);
    }

    return { data: processedData as T[], error: null };
  }

  private async executeUpdate(table: any): Promise<{ data: T[] | null; error: any }> {
    const updateData = {
      ...this.updateData,
      updated_at: getCurrentTimestamp()
    };

    for (const condition of this.whereConditions) {
      if (condition.operator === '=') {
        await table.where(condition.field as string).equals(condition.value).modify(updateData);
      }
    }

    return { data: [], error: null };
  }

  private async executeDelete(table: any): Promise<{ data: T[] | null; error: any }> {
    for (const condition of this.whereConditions) {
      if (condition.operator === '=') {
        await table.where(condition.field as string).equals(condition.value).delete();
      }
    }

    return { data: [], error: null };
  }
}

class LocalClient {
  auth = {
    signUp: localAuth.signUp.bind(localAuth),
    signInWithPassword: localAuth.signInWithPassword.bind(localAuth),
    signOut: localAuth.signOut.bind(localAuth),
    getSession: localAuth.getSession.bind(localAuth),
    getUser: localAuth.getUser.bind(localAuth),
    onAuthStateChange: localAuth.onAuthStateChange.bind(localAuth)
  };

  from<T>(tableName: string): QueryBuilder<T> {
    return new LocalQueryBuilder<T>(tableName);
  }

  // Storage methods for file handling
  storage = {
    from: (bucket: string) => ({
      upload: async (path: string, file: File): Promise<{ data: { path: string } | null; error: any }> => {
        try {
          // Convert file to base64 for local storage
          const base64 = await this.fileToBase64(file);
          const fileData = {
            path,
            data: base64,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified
          };
          
          localStorage.setItem(`storage_${bucket}_${path}`, JSON.stringify(fileData));
          return { data: { path }, error: null };
        } catch (error) {
          return { data: null, error };
        }
      },
      getPublicUrl: (path: string) => {
        return { data: { publicUrl: `local://storage/${bucket}/${path}` } };
      }
    })
  };

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }
}

export const localClient = new LocalClient(); 