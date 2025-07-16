import { fileClient } from './fileClient';

// Use direct localhost connection for development
const API_BASE = 'http://localhost:3001/api';
const WS_URL = 'ws://localhost:3001/ws';

export interface ChatChannel {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private' | 'direct';
  icon?: string;
  client_id?: string;
  created_by: string;
  created_at: string;
  archived: boolean;
  last_message_at?: string;
  membership?: ChannelMembership;
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
  reply_to_id?: string;
  created_at: string;
  updated_at?: string;
  deleted: boolean;
  edited: boolean;
  mentions?: string[];
  user?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
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

class ChatClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000;
  private isAuthenticated = false;
  private static instance: ChatClient | null = null;
  private connectionPromise: Promise<void> | null = null;
  private tokenRefreshInterval: NodeJS.Timeout | null = null;
  private currentTokenTimestamp: number = 0;

  constructor() {
    if (ChatClient.instance) {
      return ChatClient.instance;
    }
    this.initializeEventTypes();
    this.startTokenRefreshTimer();
    ChatClient.instance = this;
  }

  private initializeEventTypes() {
    const eventTypes = [
      'authenticated', 'auth_error', 'joined_channel', 'left_channel',
      'new_message', 'user_typing', 'error', 'connection_status', 'token_expiring'
    ];
    
    eventTypes.forEach(type => {
      this.listeners.set(type, new Set());
    });
  }

  // Event handling
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback?: Function) {
    if (!this.listeners.has(event)) return;
    
    if (callback) {
      this.listeners.get(event)!.delete(callback);
    } else {
      this.listeners.get(event)!.clear();
    }
  }

  private emit(event: string, data?: any) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} callback:`, error);
        }
      });
    }
  }

  // Start periodic token validation
  private startTokenRefreshTimer() {
    // Check token validity every 5 minutes
    this.tokenRefreshInterval = setInterval(async () => {
      await this.validateAndRefreshToken();
    }, 5 * 60 * 1000);
  }

  private async validateAndRefreshToken() {
    if (!this.isAuthenticated || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const session = await fileClient.auth.getSession();
      const currentToken = session.data.session?.access_token;
      
      if (!currentToken) {
        console.log('🔐 No current token available - disconnecting WebSocket');
        this.emit('auth_error', { message: 'Session expired' });
        this.disconnect();
        return;
      }

      // Decode token to check timestamp
      const decoded = Buffer.from(currentToken, 'base64').toString();
      const sessionData = JSON.parse(decoded);
      
      // If token timestamp has changed, we have a new token - reconnect
      if (sessionData.timestamp !== this.currentTokenTimestamp) {
        console.log('🔐 Token updated - reconnecting with fresh token');
        this.currentTokenTimestamp = sessionData.timestamp;
        
        // Graceful reconnection with new token
        this.disconnect();
        setTimeout(() => {
          this.connect(currentToken);
        }, 1000);
        return;
      }

      // Check if token is close to expiring (within 2 hours)
      const tokenAge = Date.now() - sessionData.timestamp;
      const hoursUntilExpiry = (24 * 60 * 60 * 1000 - tokenAge) / (60 * 60 * 1000);
      
      if (hoursUntilExpiry < 2) {
        console.log('🔐 Token expires soon - attempting automatic refresh');
        
        // Attempt to refresh the session token
        const refreshResult = await fileClient.auth.refreshSession();
        if (refreshResult.data && refreshResult.data.session) {
          console.log('✅ Token refreshed successfully - reconnecting');
          
          // Update current token timestamp
          const newDecoded = Buffer.from(refreshResult.data.session.access_token, 'base64').toString();
          const newSessionData = JSON.parse(newDecoded);
          this.currentTokenTimestamp = newSessionData.timestamp;
          
          // Graceful reconnection with new token
          this.disconnect();
          setTimeout(() => {
            this.connect(refreshResult.data!.session.access_token);
          }, 1000);
        } else {
          // Token refresh failed, emit warning
          console.log('❌ Token refresh failed');
          this.emit('token_expiring', { hoursUntilExpiry });
        }
      }
      
    } catch (error) {
      console.error('Error validating token:', error);
    }
  }

  // WebSocket connection management
  async connect(token?: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('Already connected to WebSocket');
      return;
    }

    if (this.ws?.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket connection already in progress');
      return;
    }

    // If there's already a connection attempt in progress, wait for it
    if (this.connectionPromise) {
      console.log('Waiting for existing connection attempt...');
      return this.connectionPromise;
    }

    // Get current token if not provided
    const currentToken = token || await this.getCurrentToken();
    if (!currentToken) {
      console.error('No authentication token available for WebSocket connection');
      this.emit('auth_error', { message: 'No authentication token available' });
      return;
    }

    // Track current token timestamp
    try {
      const decoded = Buffer.from(currentToken, 'base64').toString();
      const sessionData = JSON.parse(decoded);
      this.currentTokenTimestamp = sessionData.timestamp;
    } catch (error) {
      console.error('Error decoding token timestamp:', error);
    }

    this.connectionPromise = this.performConnection(currentToken);
    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async performConnection(token: string) {
    try {
      console.log('🔌 Attempting WebSocket connection to:', WS_URL);
      this.ws = new WebSocket(WS_URL);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        this.reconnectAttempts = 0;
        this.emit('connection_status', { connected: true });
        
        // Authenticate immediately
        console.log('🔐 Sending authentication token...');
        this.ws!.send(JSON.stringify({
          type: 'authenticate',
          token
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', { code: event.code, reason: event.reason, wasClean: event.wasClean });
        this.isAuthenticated = false;
        this.emit('connection_status', { connected: false });
        
        // Don't reconnect if it was a clean disconnect (code 1000)
        if (event.code !== 1000) {
          this.handleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.emit('error', { message: 'WebSocket connection error' });
      };

    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.emit('error', { message: 'Failed to connect to chat server' });
    }
  }

  private handleMessage(message: any) {
    console.log('📨 Received WebSocket message:', message);
    switch (message.type) {
      case 'authenticated':
        console.log('✅ WebSocket authentication successful');
        this.isAuthenticated = true;
        // Restart token refresh timer if it's not running
        if (!this.tokenRefreshInterval) {
          this.startTokenRefreshTimer();
        }
        this.emit('authenticated', message.user);
        break;
      case 'auth_error':
        console.error('❌ WebSocket authentication failed:', message);
        this.emit('auth_error', message);
        break;
      case 'channels_updated':
        console.log('📋 Channels updated from server');
        this.emit('channels_updated', message);
        break;
      case 'channel_updated':
        console.log('📋 Channel updated from server');
        this.emit('channel_updated', message);
        break;
      case 'joined_channel':
        this.emit('joined_channel', message);
        break;
      case 'left_channel':
        this.emit('left_channel', message);
        break;
      case 'new_message':
        this.emit('new_message', message.message);
        break;
      case 'user_typing':
        this.emit('user_typing', message);
        break;
      case 'error':
        this.emit('error', message);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private async handleReconnect() {
    // Don't reconnect if we're already connected or connecting
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      console.log('Skipping reconnect - already connected/connecting');
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(async () => {
        // Double check we still need to reconnect
        if (this.ws?.readyState !== WebSocket.OPEN) {
          // Get fresh token for reconnection
          const currentToken = await this.getCurrentToken();
          if (currentToken) {
            this.connect(currentToken);
          } else {
            console.error('No token available for reconnection');
            this.emit('auth_error', { message: 'No authentication token available for reconnection' });
          }
        }
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('error', { message: 'Failed to reconnect to chat server' });
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.isAuthenticated = false;
    this.reconnectAttempts = 0; // Reset reconnect attempts
    this.currentTokenTimestamp = 0;
    
    // Clear token refresh timer
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }
  }

  // WebSocket message sending
  private sendMessage(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN && this.isAuthenticated) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  joinChannel(channelId: string) {
    return this.sendMessage({
      type: 'join_channel',
      channel_id: channelId
    });
  }

  leaveChannel(channelId: string) {
    return this.sendMessage({
      type: 'leave_channel',
      channel_id: channelId
    });
  }

  sendChatMessage(channelId: string, content: string, replyToId?: string, mentions?: string[]) {
    return this.sendMessage({
      type: 'send_message',
      channel_id: channelId,
      content,
      message_type: 'text',
      reply_to_id: replyToId,
      mentions
    });
  }

  startTyping(channelId: string) {
    return this.sendMessage({
      type: 'typing_start',
      channel_id: channelId
    });
  }

  stopTyping(channelId: string) {
    return this.sendMessage({
      type: 'typing_stop',
      channel_id: channelId
    });
  }

  // HTTP API methods
  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const session = await fileClient.auth.getSession();
    const token = session.data.session?.access_token;

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Get users for mention suggestions
  async getUsers(channelId?: string): Promise<Array<{
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  }>> {
    const params = channelId ? `?channel_id=${channelId}` : '';
    return this.makeRequest(`/chat/users${params}`);
  }

  // Channel management
  async getChannels(): Promise<ChatChannel[]> {
    return this.makeRequest('/chat/channels');
  }

  async createChannel(data: {
    name: string;
    description?: string;
    type: 'public' | 'private';
    icon?: string;
    client_id?: string;
    members?: string[];
  }): Promise<ChatChannel> {
    console.log('ChatClient: Sending createChannel request with data:', data);
    return this.makeRequest('/chat/channels', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateChannel(channelId: string, updates: {
    name?: string;
    description?: string;
    icon?: string;
  }): Promise<ChatChannel> {
    console.log('ChatClient: Updating channel', channelId, 'with updates:', updates);
    return this.makeRequest(`/chat/channels/${channelId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async getMessages(channelId: string, limit = 50, before?: string): Promise<ChatMessage[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(before && { before }),
    });
    return this.makeRequest(`/chat/channels/${channelId}/messages?${params}`);
  }

  async sendMessageHttp(channelId: string, content: string, replyToId?: string, mentions?: string[]): Promise<ChatMessage> {
    return this.makeRequest(`/chat/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content,
        message_type: 'text',
        reply_to_id: replyToId,
        mentions,
      }),
    });
  }

  async joinChannelHttp(channelId: string): Promise<ChannelMembership> {
    return this.makeRequest(`/chat/channels/${channelId}/join`, {
      method: 'POST',
    });
  }

  async markChannelAsRead(channelId: string): Promise<void> {
    await this.makeRequest(`/chat/channels/${channelId}/read`, {
      method: 'POST',
    });
  }

  // Utility methods
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.isAuthenticated;
  }

  getConnectionState(): string {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return this.isAuthenticated ? 'connected' : 'authenticating';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'unknown';
    }
  }

  // Get current session token
  private async getCurrentToken(): Promise<string | null> {
    try {
      const session = await fileClient.auth.getSession();
      return session.data.session?.access_token || null;
    } catch (error) {
      console.error('Error getting current session token:', error);
      return null;
    }
  }
}

export const chatClient = new ChatClient(); 