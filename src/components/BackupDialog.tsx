import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { 
  CloudUpload, 
  Download, 
  Upload, 
  User, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Minimize2, 
  FileText, 
  Image,
  History,
  Calendar,
  Trash2,
  RefreshCw,
  Loader2,
  Check,
  Square,
  RotateCcw,
  Info,
  Files
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


interface BackupResult {
  name: string;
  type: 'json' | 'image';
  status: 'pending' | 'uploading' | 'success' | 'failed';
  error?: string;
  size?: number;
}

interface BackupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBackupStatusChange?: (status: BackupStatus) => void;
}

interface GoogleUserData {
  name: string;
  email: string;
  picture: string;
}

interface GoogleOAuthState {
  user: GoogleUserData | null;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

interface BackupHistoryEntry {
  id: string;
  timestamp: string;
  date: string;
  initiatedBy: string;
  googleUserEmail: string;
  folderId: string;
  folderName: string;
  status: 'in_progress' | 'completed' | 'failed';
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  files: BackupResult[];
  error?: string;
  completedAt?: string;
}

interface GoogleCredential {
  email: string;
  lastUsed: string;
  hasRefreshToken: boolean;
}

interface AvailableFile {
  name: string;
  type: 'json' | 'image';
  size?: number;
  path: string;
}

// Google OAuth Client ID for your project
const GOOGLE_CLIENT_ID = '891374087575-kup8mebp0hvdadf09tpmvprclip2teis.apps.googleusercontent.com';

// Storage keys
const GOOGLE_OAUTH_STORAGE_KEY = 'google_oauth_state';
const BACKUP_STATUS_STORAGE_KEY = 'backup_status';

// Global type declarations
declare global {
  interface Window {
    google: any;
    googleTokenClient: any;
  }
}

// Global backup status for cross-component communication
export interface BackupStatus {
  isActive: boolean;
  progress: number;
  totalFiles: number;
  completedFiles: number;
  startTime: number;
  results?: BackupResult[];
  isVisible: boolean;
  isBackupInProgress: boolean;
  currentFile: string;
}

// Global backup status management
let globalBackupStatus: BackupStatus | null = null;

export function setBackupStatus(status: BackupStatus | null) {
  globalBackupStatus = status;
  if (status) {
    localStorage.setItem(BACKUP_STATUS_STORAGE_KEY, JSON.stringify(status));
  } else {
    localStorage.removeItem(BACKUP_STATUS_STORAGE_KEY);
  }
  
  // Dispatch custom event for components listening to backup status changes
  const event = new CustomEvent('backup-status-changed', {
    detail: status
  });
  window.dispatchEvent(event);
}

export function getBackupStatus(): BackupStatus | null {
  if (globalBackupStatus) return globalBackupStatus;
  
  const stored = localStorage.getItem(BACKUP_STATUS_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

export const BackupDialog: React.FC<BackupDialogProps> = ({ 
  open, 
  onOpenChange, 
  onBackupStatusChange 
}) => {
  const { session } = useAuth();
  const { toast } = useToast();
  
  // Existing state variables
  const [activeTab, setActiveTab] = useState<'backup' | 'history' | 'auto'>('backup');
  const [googleUser, setGoogleUser] = useState<GoogleUserData | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string>('');
  const [googleRefreshToken, setGoogleRefreshToken] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [backupResults, setBackupResults] = useState<BackupResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [backupHistory, setBackupHistory] = useState<BackupHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [googleCredentials, setGoogleCredentials] = useState<GoogleCredential[]>([]);
  
  // New state for file selection
  const [availableFiles, setAvailableFiles] = useState<AvailableFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Auto backup state
  const [autoBackupConfig, setAutoBackupConfig] = useState({
    enabled: false,
    schedule: 'daily',
    time: '02:00',
    selectedFiles: 'all',
    fileSelection: [],
    googleUserEmail: '',
    lastBackup: null,
    nextBackup: null
  });
  const [autoBackupLoading, setAutoBackupLoading] = useState(false);
  const [autoBackupSaving, setAutoBackupSaving] = useState(false);

  // Restore functionality state
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupHistoryEntry | null>(null);
  const [restoreSelectedFiles, setRestoreSelectedFiles] = useState<Set<string>>(new Set());
  const [restoreInProgress, setRestoreInProgress] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreResults, setRestoreResults] = useState<BackupResult[]>([]);

  // Load data when dialog opens or tab changes
  useEffect(() => {
    if (open) {
      // Only check admin role if user exists
      if (!session?.user || session.user.role !== 'kelyn_admin') {
        return;
      }

      if (activeTab === 'backup') {
        loadGoogleCredentials();
        loadAvailableFiles();
      } else if (activeTab === 'history') {
        loadBackupHistory();
      }
    }
  }, [open, activeTab, session?.user]);

  // Load backup history and credentials when dialog first opens
  useEffect(() => {
    if (open && session?.user?.role === 'kelyn_admin') {
      loadBackupHistory();
      loadGoogleCredentials();
    }
  }, [open, session?.user]);

  // Handle token response from Google OAuth
  const handleTokenResponse = async (response: any) => {
    console.log('Google OAuth token response:', response);
    
    if (response.access_token) {
      setGoogleAccessToken(response.access_token);
      
      // Store refresh token if provided
      if (response.refresh_token) {
        setGoogleRefreshToken(response.refresh_token);
      }
      
      try {
        // Get user info from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            'Authorization': `Bearer ${response.access_token}`
          }
        });
        
        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json();
          const userData: GoogleUserData = {
            name: userInfo.name,
            email: userInfo.email,
            picture: userInfo.picture
          };
          
          setGoogleUser(userData);
          
          // Save to localStorage with expiration
          const expiresAt = Date.now() + (response.expires_in ? response.expires_in * 1000 : 3600000); // Default 1 hour
          const oauthState: GoogleOAuthState = {
            user: userData,
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            expiresAt
          };
          
          localStorage.setItem(GOOGLE_OAUTH_STORAGE_KEY, JSON.stringify(oauthState));
          
          console.log('Google user signed in:', userData);
          
          // Save Google credentials to backend immediately
          if (response.refresh_token) {
            try {
              const authToken = session?.access_token;
              console.log('Attempting to save Google credentials...', {
                hasAuthToken: !!authToken,
                email: userData.email,
                hasRefreshToken: !!response.refresh_token
              });
              
              if (authToken) {
                const apiUrl = window.location.hostname === 'localhost' 
                  ? 'http://localhost:3001' 
                  : `${window.location.protocol}//${window.location.hostname}:3001`;

                const saveResponse = await fetch(`${apiUrl}/api/backup/save-google-credentials`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                  },
                  body: JSON.stringify({
                    email: userData.email,
                    refreshToken: response.refresh_token
                  })
                });

                if (saveResponse.ok) {
                  console.log('✅ Google credentials saved successfully');
                  // Reload credentials to update the UI
                  await loadGoogleCredentials();
                } else {
                  console.error('❌ Failed to save Google credentials:', saveResponse.status, await saveResponse.text());
                }
              } else {
                console.error('❌ No auth token available to save Google credentials');
              }
            } catch (error) {
              console.error('❌ Error saving Google credentials:', error);
            }
          } else {
            console.log('⚠️ No refresh token received - user may need to re-authorize');
            console.log('OAuth response:', response);
          }
          
          toast({
            title: 'Success',
            description: `Signed in as ${userData.name}`
          });
        }
      } catch (error) {
        console.error('Error getting user info:', error);
        toast({
          title: 'Error',
          description: 'Failed to get user information',
          variant: 'destructive'
        });
      }
    } else {
      console.error('No access token received');
      toast({
        title: 'Error',
        description: 'Failed to get access token',
        variant: 'destructive'
      });
    }
  };

  // Load auto backup configuration
  const loadAutoBackupConfig = async () => {
    setAutoBackupLoading(true);
    try {
      let authToken;
      
      if (session?.access_token) {
        authToken = session.access_token;
      } else {
        const fileSession = localStorage.getItem('file_session');
        if (fileSession) {
          try {
            const sessionData = JSON.parse(fileSession);
            authToken = sessionData.access_token || sessionData.session?.access_token || fileSession;
          } catch {
            authToken = fileSession;
          }
        }
      }

      if (!authToken) {
        throw new Error('No authentication token found');
      }

      const apiUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : `${window.location.protocol}//${window.location.hostname}:3001`;

      const response = await fetch(`${apiUrl}/api/backup/auto-config`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load auto backup config: ${response.status} - ${errorText}`);
      }

      const config = await response.json();
      setAutoBackupConfig(config);
    } catch (error) {
      console.error('Error loading auto backup config:', error);
      toast({
        title: 'Error',
        description: 'Failed to load auto backup configuration',
        variant: 'destructive'
      });
    } finally {
      setAutoBackupLoading(false);
    }
  };

  // Save auto backup configuration
  const saveAutoBackupConfig = async (config) => {
    setAutoBackupSaving(true);
    try {
      let authToken;
      
      if (session?.access_token) {
        authToken = session.access_token;
      } else {
        const fileSession = localStorage.getItem('file_session');
        if (fileSession) {
          try {
            const sessionData = JSON.parse(fileSession);
            authToken = sessionData.access_token || sessionData.session?.access_token || fileSession;
          } catch {
            authToken = fileSession;
          }
        }
      }

      if (!authToken) {
        throw new Error('No authentication token found');
      }

      // If enabling auto backup and we have Google credentials, save them
      if (config.enabled && googleUser && googleRefreshToken) {
        try {
          const apiUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3001' 
            : `${window.location.protocol}//${window.location.hostname}:3001`;

          await fetch(`${apiUrl}/api/backup/save-google-credentials`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
              email: googleUser.email,
              refreshToken: googleRefreshToken
            })
          });
          console.log('✅ Google credentials saved for auto backup');
        } catch (error) {
          console.error('❌ Failed to save Google credentials for auto backup:', error);
        }
      }

      const apiUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : `${window.location.protocol}//${window.location.hostname}:3001`;

      const response = await fetch(`${apiUrl}/api/backup/auto-config`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save auto backup config: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      setAutoBackupConfig(result.config);
      
      toast({
        title: 'Success',
        description: 'Auto backup configuration saved successfully'
      });
    } catch (error) {
      console.error('Error saving auto backup config:', error);
      toast({
        title: 'Error',
        description: 'Failed to save auto backup configuration',
        variant: 'destructive'
      });
    } finally {
      setAutoBackupSaving(false);
    }
  };

  // Test auto backup
  const testAutoBackup = async () => {
    try {
      let authToken;
      
      if (session?.access_token) {
        authToken = session.access_token;
      } else {
        const fileSession = localStorage.getItem('file_session');
        if (fileSession) {
          try {
            const sessionData = JSON.parse(fileSession);
            authToken = sessionData.access_token || sessionData.session?.access_token || fileSession;
          } catch {
            authToken = fileSession;
          }
        }
      }

      if (!authToken) {
        throw new Error('No authentication token found');
      }

      const apiUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : `${window.location.protocol}//${window.location.hostname}:3001`;

      const response = await fetch(`${apiUrl}/api/backup/auto-test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to test auto backup: ${response.status} - ${errorText}`);
      }

      toast({
        title: 'Success',
        description: 'Test auto backup completed successfully'
      });
      
      // Reload configuration and history to show the new backup
      await loadAutoBackupConfig();
      await loadBackupHistory();
    } catch (error) {
      console.error('Error testing auto backup:', error);
      toast({
        title: 'Error',
        description: 'Failed to test auto backup',
        variant: 'destructive'
      });
    }
  };

  // Load backup history
  const loadBackupHistory = async () => {
    console.log('loadBackupHistory called', { user: session?.user?.email, role: session?.user?.role });
    if (!session?.user || session.user.role !== 'kelyn_admin') {
      console.log('User not admin, skipping backup history load');
      return;
    }
    
    setHistoryLoading(true);
    try {
      let authToken;
      
      if (session?.access_token) {
        authToken = session.access_token;
      } else {
        const fileSession = localStorage.getItem('file_session');
        if (fileSession) {
          try {
            const sessionData = JSON.parse(fileSession);
            authToken = sessionData.access_token || sessionData.session?.access_token || fileSession;
          } catch {
            authToken = fileSession;
          }
        }
      }

      if (!authToken) {
        throw new Error('No authentication token found');
      }

      const apiUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : `${window.location.protocol}//${window.location.hostname}:3001`;

      console.log('Making backup history request to:', `${apiUrl}/api/backup/history`);
      console.log('Using auth token:', authToken ? 'Present' : 'Missing');
      
      const response = await fetch(`${apiUrl}/api/backup/history`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      console.log('Backup history response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backup history error response:', errorText);
        throw new Error(`Failed to load backup history: ${response.status} - ${errorText}`);
      }

      const history = await response.json();
      console.log('Loaded backup history:', history.length, 'entries');
      setBackupHistory(history);
    } catch (error) {
      console.error('Error loading backup history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load backup history',
        variant: 'destructive'
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  // Load Google credentials
  const loadGoogleCredentials = async () => {
    if (!session?.user) return;
    
    try {
      let authToken;
      
      if (session?.access_token) {
        authToken = session.access_token;
      } else {
        const fileSession = localStorage.getItem('file_session');
        if (fileSession) {
          try {
            const sessionData = JSON.parse(fileSession);
            authToken = sessionData.access_token || sessionData.session?.access_token || fileSession;
          } catch {
            authToken = fileSession;
          }
        }
      }

      if (!authToken) return;

      const apiUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : `${window.location.protocol}//${window.location.hostname}:3001`;

      const response = await fetch(`${apiUrl}/api/backup/google-credentials`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        const credentials = await response.json();
        console.log('Loaded Google credentials:', credentials);
        console.log('Number of credentials loaded:', credentials.length);
        setGoogleCredentials(credentials);
      } else {
        console.error('Failed to load Google credentials:', response.status, await response.text());
      }
    } catch (error) {
      console.error('Error loading Google credentials:', error);
    }
  };

  // Delete Google credentials
  const deleteGoogleCredentials = async (email: string) => {
    try {
      let authToken;
      
      if (session?.access_token) {
        authToken = session.access_token;
      } else {
        const fileSession = localStorage.getItem('file_session');
        if (fileSession) {
          try {
            const sessionData = JSON.parse(fileSession);
            authToken = sessionData.access_token || sessionData.session?.access_token || fileSession;
          } catch {
            authToken = fileSession;
          }
        }
      }

      if (!authToken) {
        throw new Error('No authentication token found');
      }

      const apiUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : `${window.location.protocol}//${window.location.hostname}:3001`;

      const response = await fetch(`${apiUrl}/api/backup/google-credentials/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete credentials: ${response.status}`);
      }

      // Reload credentials
      await loadGoogleCredentials();
      
      toast({
        title: 'Success',
        description: 'Google credentials deleted'
      });
    } catch (error) {
      console.error('Error deleting Google credentials:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete credentials',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    // Load Google Identity Services script when dialog opens
    if (open && !window.google) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        // Initialize Google Identity Services token client
        if (window.google) {
          window.googleTokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
            callback: handleTokenResponse,
            prompt: 'consent',
            access_type: 'offline'
          });
          
          // Now that Google is loaded, check for existing OAuth state
          restoreGoogleOAuthState();
        }
      };
      
      document.body.appendChild(script);

      return () => {
        document.body.removeChild(script);
      };
    } else if (open && window.google) {
      // Google script already loaded, restore state immediately
      restoreGoogleOAuthState();
    }

    if (open) {
      // Check for existing backup status
      const backupStatus = getBackupStatus();
      if (backupStatus && backupStatus.isActive) {
        setLoading(true);
        setBackupResults(backupStatus.results || []);
        setBackupProgress(backupStatus.progress);
        setCurrentFileIndex(backupStatus.completedFiles);
        setShowResults(true);
      }

      // Load backup history and credentials
      loadBackupHistory();
      loadGoogleCredentials();
      
      // Load auto backup config if on auto tab
      if (activeTab === 'auto') {
        loadAutoBackupConfig();
      }
    }
  }, [open]);

  // Separate function to restore Google OAuth state
  const restoreGoogleOAuthState = () => {
    const storedState = localStorage.getItem(GOOGLE_OAUTH_STORAGE_KEY);
    if (storedState) {
      try {
        const oauthState: GoogleOAuthState = JSON.parse(storedState);
        
        // Check if token is still valid (with 5 minute buffer)
        if (oauthState.expiresAt > Date.now() + 300000) {
          setGoogleUser(oauthState.user);
          setGoogleAccessToken(oauthState.accessToken);
          if (oauthState.refreshToken) {
            setGoogleRefreshToken(oauthState.refreshToken);
          }
          console.log('Restored Google OAuth state:', oauthState.user);
        } else {
          // Token expired, clear storage
          localStorage.removeItem(GOOGLE_OAUTH_STORAGE_KEY);
          console.log('Google OAuth token expired, cleared storage');
        }
      } catch (error) {
        console.error('Error parsing stored Google OAuth state:', error);
        localStorage.removeItem(GOOGLE_OAUTH_STORAGE_KEY);
      }
    }
  };

  const signInWithGoogle = async () => {
    try {
      if (window.googleTokenClient) {
        window.googleTokenClient.requestAccessToken();
      } else {
        throw new Error('Google OAuth client not initialized');
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      toast({
        title: 'Error',
        description: 'Failed to sign in with Google',
        variant: 'destructive'
      });
    }
  };

  const signOutFromGoogle = () => {
    setGoogleUser(null);
    setGoogleAccessToken('');
    setGoogleRefreshToken('');
    localStorage.removeItem(GOOGLE_OAUTH_STORAGE_KEY);
    
    // Revoke the token if possible
    if (window.google && googleAccessToken) {
      window.google.accounts.oauth2.revoke(googleAccessToken);
    }
    
    toast({
      title: 'Success',
      description: 'Signed out from Google'
    });
  };

  const updateBackupProgress = (results: BackupResult[]) => {
    const completedFiles = results.filter(r => r.status === 'success' || r.status === 'failed').length;
    const progress = results.length > 0 ? (completedFiles / results.length) * 100 : 0;
    
    setBackupProgress(progress);
    setCurrentFileIndex(completedFiles);
    setBackupResults(results);

    // Update global backup status
    const backupStatus: BackupStatus = {
      isActive: progress < 100,
      progress,
      totalFiles: results.length,
      completedFiles,
      startTime: Date.now(),
      results,
      isVisible: true,
      isBackupInProgress: progress < 100,
      currentFile: results[completedFiles - 1]?.name || '',
    };
    
    setBackupStatus(backupStatus);
    
    // Also notify the parent component about the status change
    onBackupStatusChange?.(backupStatus);
  };

  const handleBackup = async () => {
    if (!googleUser || !googleAccessToken) {
      toast({
        title: 'Error',
        description: 'Please sign in with Google first',
        variant: 'destructive'
      });
      return;
    }

    if (selectedFiles.size === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one file to backup',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      setShowResults(true);
      setBackupResults([]);
      setBackupProgress(0);
      setCurrentFileIndex(0);

      // Update floating status
      onBackupStatusChange?.({
        isActive: true,
        isVisible: true,
        isBackupInProgress: true,
        progress: 0,
        currentFile: '',
        completedFiles: 0,
        totalFiles: selectedFiles.size,
        startTime: Date.now()
      });

      const authToken = session?.access_token;
      if (!authToken) {
        throw new Error('No authentication token found. Please sign in again.');
      }

      console.log('Starting backup with auth token length:', authToken.length);

      // Determine the correct API URL based on current hostname
      const apiUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : `${window.location.protocol}//${window.location.hostname}:3001`;

      const response = await fetch(`${apiUrl}/api/backup/google-drive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          googleAccessToken: googleAccessToken,
          googleUserEmail: googleUser.email,
          googleRefreshToken: googleRefreshToken,
          selectedFiles: Array.from(selectedFiles)
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backup failed: ${response.status} ${errorText}`);
      }

      // Handle Server-Sent Events response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      const results: BackupResult[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() && line.startsWith('data: ')) {
            try {
              const jsonData = line.substring(6); // Remove 'data: ' prefix
              const data = JSON.parse(jsonData);
              
              switch (data.type) {
                case 'init':
                  // Initialize the file list with pending status
                  const initialFiles = data.files.map((file: any) => ({
                    ...file,
                    status: 'pending'
                  }));
                  setBackupResults(initialFiles);
                  updateBackupProgress(initialFiles);
                  break;
                  
                case 'file_start':
                  // Update the specific file to show it's uploading
                  setBackupResults(prev => prev.map(file => 
                    file.name === data.fileName 
                      ? { ...file, status: 'uploading' }
                      : file
                  ));
                  break;
                  
                case 'file_complete':
                  // Update the specific file with completion status
                  setBackupResults(prev => {
                    const updated = prev.map(file => 
                      file.name === data.fileName 
                        ? { 
                            ...file, 
                            status: data.status, 
                            error: data.error,
                            size: data.size 
                          }
                        : file
                    );
                    updateBackupProgress(updated);
                    return updated;
                  });
                  break;
                  
                case 'complete':
                  console.log('Backup completed:', data);
                  setLoading(false);
                  
                  // Update final results
                  if (data.files) {
                    setBackupResults(data.files);
                    updateBackupProgress(data.files);
                  }
                  
                  // Clear backup status when complete
                  setTimeout(() => {
                    setBackupStatus(null);
                    onBackupStatusChange?.({
                      isActive: false,
                      isVisible: false,
                      isBackupInProgress: false,
                      progress: 100,
                      currentFile: '',
                      completedFiles: 0,
                      totalFiles: 0,
                      startTime: Date.now()
                    });
                  }, 3000);
                  
                  // Reload backup history to show the new backup
                  await loadBackupHistory();
                  
                  toast({
                    title: 'Backup Complete',
                    description: data.message || `Successfully backed up ${data.summary?.total || 0} files to Google Drive`,
                  });
                  break;
                  
                case 'error':
                  throw new Error(data.details || data.message || 'Backup failed');
                  
                case 'status':
                  // Just a status message, no action needed
                  console.log('Backup status:', data.message);
                  break;
              }
            } catch (parseError) {
              console.error('Error parsing backup progress:', parseError, 'Line:', line);
            }
          }
        }
      }

    } catch (error) {
      console.error('Backup error:', error);
      setLoading(false);
      setBackupStatus(null);
      onBackupStatusChange?.({
        isActive: false,
        isVisible: false,
        isBackupInProgress: false,
        progress: 0,
        currentFile: '',
        completedFiles: 0,
        totalFiles: 0,
        startTime: Date.now()
      });
      toast({
        title: 'Backup Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  };

  const handleMinimize = () => {
    setIsMinimized(true);
    onOpenChange(false);
  };

  const handleClose = () => {
    if (loading) {
      // If backup is in progress, just hide the dialog but keep the floating indicator visible
      onOpenChange(false);
      // Keep the floating indicator visible and active
      onBackupStatusChange?.({
        isActive: true,
        isVisible: true,
        isBackupInProgress: true,
        progress: backupProgress,
        currentFile: backupResults.length > currentFileIndex ? backupResults[currentFileIndex]?.name || '' : '',
        completedFiles: backupResults.filter(r => r.status === 'success').length,
        totalFiles: backupResults.length,
        startTime: Date.now(),
        results: backupResults
      });
    } else {
      // If no backup in progress, actually close and hide everything
      onOpenChange(false);
      onBackupStatusChange?.({
        isActive: false,
        isVisible: false,
        isBackupInProgress: false,
        progress: 0,
        currentFile: '',
        completedFiles: 0,
        totalFiles: 0,
        startTime: Date.now()
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'uploading':
        return <Upload className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'json':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'image':
        return <Image className="h-4 w-4 text-green-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">In Progress</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Load available files from server
  const loadAvailableFiles = async () => {
    console.log('loadAvailableFiles called', { user: session?.user?.email, role: session?.user?.role });
    if (!session?.user || session.user.role !== 'kelyn_admin') {
      console.log('User not admin, skipping available files load');
      return;
    }
    
    try {
      setLoadingFiles(true);
      
      let authToken;
      
      if (session?.access_token) {
        authToken = session.access_token;
      } else {
        const fileSession = localStorage.getItem('file_session');
        if (fileSession) {
          try {
            const sessionData = JSON.parse(fileSession);
            authToken = sessionData.access_token || sessionData.session?.access_token || fileSession;
          } catch {
            authToken = fileSession;
          }
        }
      }

      if (!authToken) {
        throw new Error('No authentication token found');
      }

      const apiUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : `${window.location.protocol}//${window.location.hostname}:3001`;

      console.log('Making available files request to:', `${apiUrl}/api/backup/available-files`);
      console.log('Using auth token:', authToken ? 'Present' : 'Missing');

      const response = await fetch(`${apiUrl}/api/backup/available-files`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      console.log('Available files response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Available files error response:', errorText);
        throw new Error(`Failed to load available files: ${response.status} - ${errorText}`);
      }

      const files = await response.json();
      console.log('Loaded available files:', files.length, 'files');
      setAvailableFiles(files);
      
      // Select all files by default
      setSelectedFiles(new Set(files.map((file: AvailableFile) => file.path)));
      
    } catch (error) {
      console.error('Error loading available files:', error);
      toast({
        title: 'Error',
        description: 'Failed to load available files',
        variant: 'destructive'
      });
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleRestoreClick = (backup: BackupHistoryEntry) => {
    if (backup.status !== 'completed') {
      toast({
        title: "Cannot Restore",
        description: "Can only restore from completed backups",
        variant: "destructive",
      });
      return;
    }

    setSelectedBackup(backup);
    // Select all successful files by default
    const successfulFiles = backup.files.filter(f => f.status === 'success').map(f => f.name);
    setRestoreSelectedFiles(new Set(successfulFiles));
    setShowRestoreDialog(true);
  };

  const handleRestore = async () => {
    if (!selectedBackup || !googleAccessToken) {
      toast({
        title: "Error",
        description: "Google authentication required for restore",
        variant: "destructive",
      });
      return;
    }

    if (restoreSelectedFiles.size === 0) {
      toast({
        title: "Error",
        description: "Please select at least one file to restore",
        variant: "destructive",
      });
      return;
    }

    try {
      setRestoreInProgress(true);
      setRestoreProgress(0);
      setRestoreResults([]);

      const authToken = session?.access_token || localStorage.getItem('authToken');
      if (!authToken) {
        throw new Error('No authentication token found');
      }

      const apiUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : `${window.location.protocol}//${window.location.hostname}:3001`;

      const response = await fetch(`${apiUrl}/api/backup/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          backupId: selectedBackup.id,
          selectedFiles: Array.from(restoreSelectedFiles),
          googleAccessToken
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Restore failed');
      }

      // Handle Server-Sent Events for real-time progress
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response stream available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'init':
                  console.log('Restore initialized:', data);
                  break;
                  
                case 'file_start':
                  console.log('Starting file:', data.file);
                  setRestoreProgress(data.progress || 0);
                  break;
                  
                case 'file_complete':
                  console.log('File completed:', data.file, 'Status:', data.status);
                  setRestoreResults(prev => {
                    const updated = [...prev];
                    const index = updated.findIndex(r => r.name === data.file);
                    if (index >= 0) {
                      updated[index] = {
                        ...updated[index],
                        status: data.status,
                        error: data.error
                      };
                    } else {
                      updated.push({
                        name: data.file,
                        type: data.file.endsWith('.json') ? 'json' : 'image',
                        status: data.status,
                        error: data.error
                      });
                    }
                    return updated;
                  });
                  setRestoreProgress(data.progress || 0);
                  break;
                  
                case 'complete':
                  console.log('Restore completed:', data);
                  setRestoreProgress(100);
                  toast({
                    title: "Restore Completed",
                    description: `${data.summary.successful} files restored successfully, ${data.summary.failed} failed`,
                  });
                  break;
                  
                case 'error':
                  throw new Error(data.details || 'Restore failed');
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError);
            }
          }
        }
      }

    } catch (error) {
      console.error('Restore error:', error);
      toast({
        title: "Restore Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setRestoreInProgress(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] min-h-[70vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">
              {activeTab === 'backup' 
                ? 'Google Drive Backup' 
                : activeTab === 'history'
                ? 'Backup History'
                : 'Auto Backup Settings'
              }
            </DialogTitle>
          </div>
          <DialogDescription>
            {activeTab === 'backup' 
              ? 'Backup your data to Google Drive for safekeeping'
              : activeTab === 'history'
              ? 'View and manage your previous backups'
              : 'Configure automatic backups to Google Drive'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
                      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'backup' | 'history' | 'auto')} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="backup">New Backup</TabsTrigger>
              <TabsTrigger value="history">Backup History</TabsTrigger>
              <TabsTrigger value="auto">Auto Backup</TabsTrigger>
            </TabsList>
            
            <TabsContent value="backup" className="flex-1 overflow-y-auto space-y-6">
              {/* Google Sign-in Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Google Account</h3>
                
                {googleUser ? (
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200">
                    <div className="flex items-center space-x-3">
                      <img 
                        src={googleUser.picture} 
                        alt={googleUser.name}
                        className="w-10 h-10 rounded-full"
                      />
                      <div>
                        <p className="font-medium text-green-900">{googleUser.name}</p>
                        <p className="text-sm text-green-700">{googleUser.email}</p>
                        {googleRefreshToken && (
                          <p className="text-xs text-green-600">✓ Persistent login enabled</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={signOutFromGoogle}
                      disabled={loading}
                    >
                      Sign Out
                    </Button>
                  </div>
                ) : (
                  <div className="text-center p-6 border rounded-lg border-gray-200">
                    <User className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600 mb-4">
                      Sign in with your Google account to backup files to Google Drive
                    </p>
                    <Button onClick={signInWithGoogle} disabled={loading}>
                      <CloudUpload className="h-4 w-4 mr-2" />
                      Sign in with Google
                    </Button>
                  </div>
                )}
              </div>

              {/* File Selection Section */}
              {googleUser && !showResults && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Select Files to Backup</h3>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedFiles(new Set(availableFiles.map(f => f.path)))}
                        disabled={loadingFiles}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedFiles(new Set())}
                        disabled={loadingFiles}
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Select None
                      </Button>
                    </div>
                  </div>

                  {loadingFiles ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-8 w-8 mx-auto animate-spin text-gray-400 mb-4" />
                      <p className="text-gray-500">Loading available files...</p>
                    </div>
                  ) : availableFiles.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500">No files available for backup</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg max-h-72 min-h-72 overflow-y-auto">
                      <div className="space-y-1 p-4">
                        {availableFiles.map((file, index) => (
                          <div key={index} className="flex items-center space-x-3 py-2 hover:bg-gray-50 rounded">
                            <Checkbox
                              checked={selectedFiles.has(file.path)}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(selectedFiles);
                                if (checked) {
                                  newSelected.add(file.path);
                                } else {
                                  newSelected.delete(file.path);
                                }
                                setSelectedFiles(newSelected);
                              }}
                            />
                            <div className="flex-shrink-0">
                              {getFileIcon(file.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {file.name}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {file.path}
                              </p>
                            </div>
                            {file.size && (
                              <div className="flex-shrink-0 text-xs text-gray-500">
                                {formatFileSize(file.size)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {availableFiles.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        {selectedFiles.size} of {availableFiles.length} files selected
                      </span>
                      <Button
                        onClick={handleBackup}
                        disabled={loading || selectedFiles.size === 0}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {loading ? (
                          <>
                            <Upload className="h-4 w-4 mr-2 animate-spin" />
                            Starting Backup...
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-2" />
                            Backup Selected Files
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Progress Overview */}
              {showResults && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Backup Progress</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Progress: {currentFileIndex} of {backupResults.length} files
                    </span>
                    <span className="text-sm text-gray-500">
                      {Math.round(backupProgress)}%
                    </span>
                  </div>
                  <Progress value={backupProgress} className="w-full" />
                  
                  {/* File List */}
                  <div className="border rounded-lg max-h-96 overflow-y-auto">
                    <div className="space-y-1 p-4">
                      {backupResults.map((file, index) => (
                        <div key={index} className="flex items-center space-x-3 py-2">
                          <div className="flex-shrink-0">
                            {getStatusIcon(file.status)}
                          </div>
                          <div className="flex-shrink-0">
                            {getFileIcon(file.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {file.name}
                            </p>
                            {file.error && (
                              <p className="text-xs text-red-600 truncate">
                                {file.error}
                              </p>
                            )}
                          </div>
                          {file.size && (
                            <div className="flex-shrink-0 text-xs text-gray-500">
                              {formatFileSize(file.size)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="flex-1 overflow-hidden">
              <div className="h-full flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Backup History</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {backupHistory.length} backup{backupHistory.length !== 1 ? 's' : ''} total
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadBackupHistory}
                    disabled={historyLoading}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${historyLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto mt-4">
                  {historyLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="text-center">
                        <RefreshCw className="h-6 w-6 mx-auto animate-spin text-blue-500 mb-3" />
                        <p className="text-sm text-gray-500">Loading backup history...</p>
                      </div>
                    </div>
                  ) : backupHistory.length === 0 ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                          <History className="h-6 w-6 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">No backups found</p>
                        <p className="text-xs text-gray-500 mt-1">Create your first backup to see it here</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                        {backupHistory.map((backup, index) => (
                          <div 
                            key={backup.id} 
                            className={`group relative bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all duration-200 ${
                              index === 0 ? 'ring-1 ring-blue-100 border-blue-200' : ''
                            }`}
                          >
                            {/* Status indicator */}
                            <div className="absolute top-3 right-3">
                              {backup.status === 'completed' && (
                                <div className="flex items-center text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></div>
                                  Completed
                                </div>
                              )}
                              {backup.status === 'failed' && (
                                <div className="flex items-center text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full">
                                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5"></div>
                                  Failed
                                </div>
                              )}
                              {backup.status === 'in_progress' && (
                                <div className="flex items-center text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-full">
                                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5 animate-pulse"></div>
                                  In Progress
                                </div>
                              )}
                            </div>

                            {/* Main content */}
                            <div className="pr-20">
                              <div className="flex items-start space-x-3 mb-3">
                                <div className="flex-shrink-0 mt-0.5">
                                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                                    <Calendar className="h-4 w-4 text-blue-600" />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-semibold text-gray-900 truncate">
                                    Backup - {new Date(backup.timestamp).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    })}
                                  </h4>
                                  <div className="flex items-center space-x-4 mt-1">
                                    <p className="text-xs text-gray-500">
                                      {new Date(backup.timestamp).toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </p>
                                    <span className="text-xs text-gray-300">•</span>
                                    <p className="text-xs text-gray-500">
                                      by {backup.initiatedBy}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Compact Summary with Tooltip */}
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-3">
                                  <div className="relative group">
                                    <div className="flex items-center space-x-2 cursor-help">
                                      <Files className="h-4 w-4 text-gray-500" />
                                      <span className="text-sm font-medium text-gray-900">
                                        {backup.totalFiles} files
                                      </span>
                                      <Info className="h-3 w-3 text-gray-400" />
                                    </div>
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-md shadow-lg max-w-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                                      <div className="space-y-1">
                                        <div>Total Files: {backup.totalFiles}</div>
                                        <div className="text-green-300">✓ Successful: {backup.successfulFiles}</div>
                                        {backup.failedFiles > 0 && (
                                          <div className="text-red-300">✗ Failed: {backup.failedFiles}</div>
                                        )}
                                        <div className="border-t border-gray-600 pt-1 mt-2">
                                          Success Rate: {Math.round((backup.successfulFiles / backup.totalFiles) * 100)}%
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {backup.totalFiles > 0 && (
                                    <div className="flex items-center space-x-2">
                                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                        <div 
                                          className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                                          style={{ width: `${(backup.successfulFiles / backup.totalFiles) * 100}%` }}
                                        ></div>
                                      </div>
                                      <span className="text-xs text-gray-500">
                                        {Math.round((backup.successfulFiles / backup.totalFiles) * 100)}%
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center space-x-2">
                                  {backup.status === 'completed' && backup.successfulFiles > 0 && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRestoreClick(backup)}
                                      className="h-7 px-3 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                                      disabled={!googleUser}
                                    >
                                      <RotateCcw className="h-3 w-3 mr-1" />
                                      Restore
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* Google Drive Info */}
                              {backup.googleUserEmail && (
                                <div className="bg-gray-50 rounded px-3 py-2">
                                  <div className="flex items-center space-x-2 text-xs text-gray-600">
                                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                    </svg>
                                    <span>Saved to {backup.googleUserEmail}</span>
                                  </div>
                                  {!googleUser && backup.status === 'completed' && backup.successfulFiles > 0 && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      Sign in with Google to restore files
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Error message */}
                              {backup.error && (
                                <div className="mt-3 p-2 bg-red-50 border border-red-100 rounded-md">
                                  <div className="flex items-start space-x-2">
                                    <div className="flex-shrink-0 mt-0.5">
                                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-xs font-medium text-red-800">Error Details</p>
                                      <p className="text-xs text-red-700 mt-1">{backup.error}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="auto" className="flex-1 overflow-hidden">
              <div className="h-full flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Auto Backup Settings</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Schedule automatic backups to Google Drive
                    </p>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto mt-4">
                  {autoBackupLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="text-center">
                        <RefreshCw className="h-6 w-6 mx-auto animate-spin text-blue-500 mb-3" />
                        <p className="text-sm text-gray-500">Loading auto backup settings...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Enable/Disable Switch */}
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900">Enable Auto Backup</h4>
                          <p className="text-xs text-gray-500 mt-1">
                            Automatically backup your data to Google Drive on schedule
                          </p>
                        </div>
                        <Switch
                          checked={autoBackupConfig.enabled}
                          onCheckedChange={(enabled) => {
                            setAutoBackupConfig({ ...autoBackupConfig, enabled });
                          }}
                        />
                      </div>

                      {/* Configuration Options */}
                      {autoBackupConfig.enabled && (
                        <>
                          {/* Google Account Selection */}
                          <div className="space-y-3">
                            <Label htmlFor="google-account" className="text-sm font-medium text-gray-900">
                              Google Account
                            </Label>
                            {googleUser ? (
                              <div className="flex items-center space-x-2 p-2 border rounded-md bg-gray-50">
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                                <span className="text-sm">{googleUser.email}</span>
                                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">Connected</span>
                              </div>
                            ) : (
                              <div className="p-2 border rounded-md bg-gray-50 text-center text-sm text-gray-500">
                                No Google account signed in
                              </div>
                            )}
                            {!googleUser && (
                              <p className="text-xs text-amber-600">
                                No Google account signed in. Sign in with Google in the "New Backup" tab first.
                              </p>
                            )}
                          </div>

                          {/* Schedule Configuration */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-3">
                              <Label htmlFor="schedule" className="text-sm font-medium text-gray-900">
                                Schedule
                              </Label>
                              <Select
                                value={autoBackupConfig.schedule}
                                onValueChange={(value) => {
                                  setAutoBackupConfig({ ...autoBackupConfig, schedule: value });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="daily">Daily</SelectItem>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-3">
                              <Label htmlFor="time" className="text-sm font-medium text-gray-900">
                                Time
                              </Label>
                              <Input
                                id="time"
                                type="time"
                                value={autoBackupConfig.time}
                                onChange={(e) => {
                                  setAutoBackupConfig({ ...autoBackupConfig, time: e.target.value });
                                }}
                              />
                            </div>
                          </div>

                          {/* File Selection */}
                          <div className="space-y-3">
                            <Label className="text-sm font-medium text-gray-900">Files to Backup</Label>
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  id="all-files"
                                  name="file-selection"
                                  checked={autoBackupConfig.selectedFiles === 'all'}
                                  onChange={() => {
                                    setAutoBackupConfig({ ...autoBackupConfig, selectedFiles: 'all' });
                                  }}
                                />
                                <Label htmlFor="all-files" className="text-sm text-gray-700">
                                  All available files
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  id="selected-files"
                                  name="file-selection"
                                  checked={autoBackupConfig.selectedFiles === 'selected'}
                                  onChange={() => {
                                    setAutoBackupConfig({ ...autoBackupConfig, selectedFiles: 'selected' });
                                  }}
                                />
                                <Label htmlFor="selected-files" className="text-sm text-gray-700">
                                  Selected files only
                                </Label>
                              </div>
                            </div>
                          </div>

                          {/* Status Information */}
                          {(autoBackupConfig.lastBackup || autoBackupConfig.nextBackup) && (
                            <div className="p-4 bg-blue-50 rounded-lg space-y-2">
                              <h4 className="text-sm font-medium text-blue-900">Status</h4>
                              {autoBackupConfig.lastBackup && (
                                <p className="text-xs text-blue-700">
                                  Last backup: {new Date(autoBackupConfig.lastBackup).toLocaleString()}
                                </p>
                              )}
                              {autoBackupConfig.nextBackup && (
                                <p className="text-xs text-blue-700">
                                  Next backup: {new Date(autoBackupConfig.nextBackup).toLocaleString()}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex space-x-3 pt-4 border-t">
                            <Button
                              onClick={() => saveAutoBackupConfig({
                                ...autoBackupConfig,
                                googleUserEmail: googleUser?.email || ''
                              })}
                              disabled={autoBackupSaving || !googleUser}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {autoBackupSaving ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                'Save Configuration'
                              )}
                            </Button>
                            
                            <Button
                              variant="outline"
                              onClick={testAutoBackup}
                              disabled={!autoBackupConfig.enabled || !googleUser}
                            >
                              Test Backup Now
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>

      {/* Restore Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-xl font-semibold">
              Restore from Backup
            </DialogTitle>
            <DialogDescription>
              Select files to restore from backup created on {selectedBackup?.date}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden space-y-4">
            {!restoreInProgress ? (
              <>
                {/* File Selection */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Select Files to Restore</h3>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const successfulFiles = selectedBackup?.files.filter(f => f.status === 'success').map(f => f.name) || [];
                          setRestoreSelectedFiles(new Set(successfulFiles));
                        }}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRestoreSelectedFiles(new Set())}
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Select None
                      </Button>
                    </div>
                  </div>

                  {selectedBackup && (
                    <div className="border rounded-lg max-h-72 overflow-y-auto">
                      <div className="space-y-1 p-4">
                        {selectedBackup.files.filter(f => f.status === 'success').map((file, index) => (
                          <div key={index} className="flex items-center space-x-3 py-2 hover:bg-gray-50 rounded">
                            <Checkbox
                              checked={restoreSelectedFiles.has(file.name)}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(restoreSelectedFiles);
                                if (checked) {
                                  newSelected.add(file.name);
                                } else {
                                  newSelected.delete(file.name);
                                }
                                setRestoreSelectedFiles(newSelected);
                              }}
                            />
                            <div className="flex-shrink-0">
                              {getFileIcon(file.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {file.name}
                              </p>
                            </div>
                            {file.size && (
                              <div className="flex-shrink-0 text-xs text-gray-500">
                                {formatFileSize(file.size)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>{restoreSelectedFiles.size} files selected</span>
                    <span>From {selectedBackup?.successfulFiles} available files</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setShowRestoreDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleRestore}
                    disabled={restoreSelectedFiles.size === 0 || !googleAccessToken}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Restore {restoreSelectedFiles.size} Files
                  </Button>
                </div>
              </>
            ) : (
              /* Restore Progress */
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <RotateCcw className="h-8 w-8 text-blue-600 animate-spin" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Restoring Files</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Downloading and restoring files from Google Drive...
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{restoreProgress}%</span>
                  </div>
                  <Progress value={restoreProgress} className="h-2" />
                </div>

                {restoreResults.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-900">Restore Results</h4>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {restoreResults.map((result, index) => (
                        <div key={index} className="flex items-center space-x-3 py-1">
                          <div className="flex-shrink-0">
                            {getStatusIcon(result.status)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 truncate">{result.name}</p>
                            {result.error && (
                              <p className="text-xs text-red-600 truncate">{result.error}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
} 