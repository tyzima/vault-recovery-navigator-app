import bcrypt from 'bcryptjs';
import { db, generateId, getCurrentTimestamp, Profile } from './database';

export interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

export interface Session {
  user: User;
  access_token: string;
  expires_at: number;
}

export interface AuthError {
  message: string;
}

class LocalAuth {
  private currentSession: Session | null = null;
  private listeners: ((session: Session | null) => void)[] = [];

  constructor() {
    // Load session from localStorage on initialization
    this.loadSession();
  }

  private loadSession(): void {
    try {
      const savedSession = localStorage.getItem('vault_session');
      if (savedSession) {
        const session = JSON.parse(savedSession);
        // Check if session is expired
        if (session.expires_at > Date.now()) {
          this.currentSession = session;
        } else {
          localStorage.removeItem('vault_session');
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
      localStorage.removeItem('vault_session');
    }
  }

  private saveSession(session: Session | null): void {
    if (session) {
      localStorage.setItem('vault_session', JSON.stringify(session));
    } else {
      localStorage.removeItem('vault_session');
    }
    this.currentSession = session;
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentSession));
  }

  private generateToken(): string {
    return btoa(JSON.stringify({
      timestamp: Date.now(),
      random: Math.random().toString(36)
    }));
  }

  async signUp(credentials: {
    email: string;
    password: string;
    options?: {
      data?: {
        first_name?: string;
        last_name?: string;
      };
    };
  }): Promise<{ data?: { user: User }; error?: AuthError }> {
    try {
      // Check if user already exists
      const existingProfile = await db.profiles.where('email').equals(credentials.email).first();
      if (existingProfile) {
        return { error: { message: 'User already exists' } };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(credentials.password, 10);
      
      // Store password in localStorage (in a real app, this would be more secure)
      const passwordKey = `pwd_${btoa(credentials.email)}`;
      localStorage.setItem(passwordKey, hashedPassword);

      // Create profile
      const userId = generateId();
      const profile: Profile = {
        id: userId,
        email: credentials.email,
        first_name: credentials.options?.data?.first_name,
        last_name: credentials.options?.data?.last_name,
        role: 'client_member',
        created_at: getCurrentTimestamp()
      };

      await db.profiles.add(profile);

      const user: User = {
        id: profile.id,
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name
      };

      return { data: { user } };
    } catch (error) {
      console.error('Sign up error:', error);
      return { error: { message: 'Failed to create account' } };
    }
  }

  async signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{ data?: { user: User; session: Session }; error?: AuthError }> {
    try {
      // Find user profile
      const profile = await db.profiles.where('email').equals(credentials.email).first();
      if (!profile) {
        return { error: { message: 'Invalid email or password' } };
      }

      // Get stored password hash
      const passwordKey = `pwd_${btoa(credentials.email)}`;
      const storedHash = localStorage.getItem(passwordKey);
      
      if (!storedHash) {
        // For migration compatibility, allow admin login with default password
        if (credentials.email === 'admin@vault.local' && credentials.password === 'admin123') {
          // Set the hashed password for future logins
          const hashedPassword = await bcrypt.hash(credentials.password, 10);
          localStorage.setItem(passwordKey, hashedPassword);
        } else {
          return { error: { message: 'Invalid email or password' } };
        }
      } else {
        // Verify password
        const isValid = await bcrypt.compare(credentials.password, storedHash);
        if (!isValid) {
          return { error: { message: 'Invalid email or password' } };
        }
      }

      // Create session
      const user: User = {
        id: profile.id,
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name
      };

      const session: Session = {
        user,
        access_token: this.generateToken(),
        expires_at: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      };

      this.saveSession(session);

      return { data: { user, session } };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error: { message: 'Failed to sign in' } };
    }
  }

  async signOut(): Promise<{ error?: AuthError }> {
    try {
      this.saveSession(null);
      return {};
    } catch (error) {
      console.error('Sign out error:', error);
      return { error: { message: 'Failed to sign out' } };
    }
  }

  async getSession(): Promise<{ data: { session: Session | null } }> {
    return { data: { session: this.currentSession } };
  }

  getUser(): User | null {
    return this.currentSession?.user || null;
  }

  onAuthStateChange(callback: (event: string, session: Session | null) => void): {
    data: { subscription: { unsubscribe: () => void } };
  } {
    const listener = (session: Session | null) => {
      callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
    };
    
    this.listeners.push(listener);
    
    // Call immediately with current state
    setTimeout(() => listener(this.currentSession), 0);

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
              this.listeners.splice(index, 1);
            }
          }
        }
      }
    };
  }

  // Change password for current user
  async changePassword(credentials: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ error?: AuthError }> {
    try {
      if (!this.currentSession?.user) {
        return { error: { message: 'Not authenticated' } };
      }

      const user = this.currentSession.user;
      const passwordKey = `pwd_${btoa(user.email)}`;
      const storedHash = localStorage.getItem(passwordKey);

      if (!storedHash) {
        return { error: { message: 'Current password not found' } };
      }

      // Verify current password
      const isValidCurrent = await bcrypt.compare(credentials.currentPassword, storedHash);
      if (!isValidCurrent) {
        return { error: { message: 'Current password is incorrect' } };
      }

      // Hash and store new password
      const newHashedPassword = await bcrypt.hash(credentials.newPassword, 10);
      localStorage.setItem(passwordKey, newHashedPassword);

      return {};
    } catch (error) {
      console.error('Change password error:', error);
      return { error: { message: 'Failed to change password' } };
    }
  }

  // Admin function to reset any user's password
  async resetUserPassword(email: string, newPassword: string): Promise<{ error?: AuthError }> {
    try {
      if (!this.currentSession?.user) {
        return { error: { message: 'Not authenticated' } };
      }

      // Check if current user is admin
      const currentUserProfile = await db.profiles.where('id').equals(this.currentSession.user.id).first();
      if (!currentUserProfile || currentUserProfile.role !== 'kelyn_admin') {
        return { error: { message: 'Insufficient permissions' } };
      }

      // Verify target user exists
      const targetProfile = await db.profiles.where('email').equals(email).first();
      if (!targetProfile) {
        return { error: { message: 'User not found' } };
      }

      // Hash and store new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const passwordKey = `pwd_${btoa(email)}`;
      localStorage.setItem(passwordKey, hashedPassword);

      return {};
    } catch (error) {
      console.error('Reset user password error:', error);
      return { error: { message: 'Failed to reset password' } };
    }
  }
}

export const localAuth = new LocalAuth(); 