import { useState, useEffect, useRef, useCallback } from 'react';
import { chatClient, ChatChannel, ChatMessage } from '@/lib/chatClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface TypingUser {
  userId: string;
  channelId: string;
  timestamp: number;
}

interface ChatState {
  channels: ChatChannel[];
  messages: Record<string, ChatMessage[]>;
  activeChannel: string | null;
  isConnected: boolean;
  connectionState: string;
  typingUsers: TypingUser[];
  unreadCounts: Record<string, number>;
  mentionCounts: Record<string, number>; // Track mentions separately
}

// Global state to prevent multiple initializations
let globalChatState: ChatState | null = null;
let globalStateSetters: Set<React.Dispatch<React.SetStateAction<ChatState>>> = new Set();

export function useChat() {
  const { session } = useAuth();
  const { toast } = useToast();
  
  // Only log once per user session
  const userEmail = session?.user?.email;
  const [hasLoggedInit, setHasLoggedInit] = useState(false);
  
  if (userEmail && !hasLoggedInit) {
    console.log('🔧 useChat hook initialized for user:', userEmail);
    setHasLoggedInit(true);
  }
  
  const [state, setState] = useState<ChatState>(() => {
    // Use global state if available, otherwise initialize
    return globalChatState || {
      channels: [],
      messages: {},
      activeChannel: null,
      isConnected: false,
      connectionState: 'disconnected',
      typingUsers: [],
      unreadCounts: {},
      mentionCounts: {}
    };
  });

  // Register this setter in the global set
  useEffect(() => {
    globalStateSetters.add(setState);
    return () => {
      globalStateSetters.delete(setState);
    };
  }, []);

  // Update global state when local state changes
  useEffect(() => {
    globalChatState = state;
    // Sync all other instances
    globalStateSetters.forEach(setter => {
      if (setter !== setState) {
        setter(state);
      }
    });
  }, [state]);

  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const messageInputRef = useRef<HTMLInputElement>(null);
  const connectionInitialized = useRef(false);

  // Initialize chat connection only once
  useEffect(() => {
    if (session?.access_token && !chatClient.isConnected() && !connectionInitialized.current) {
      connectionInitialized.current = true;
      console.log('🔌 Initializing chat connection...');
      
      // Add a small delay to prevent rapid reconnections
      const timeoutId = setTimeout(() => {
        connectChat();
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [session]);

  // Set up event listeners
  useEffect(() => {
    const handleAuthenticated = (user: any) => {
      console.log('Chat authenticated:', user);
      // Don't call loadChannels here - server will send channels_updated
    };

    const handleChannelsUpdated = (data: { channels: ChatChannel[] }) => {
      console.log('Channels updated:', data.channels);
      setState(prev => {
        const newState = { ...prev, channels: data.channels };
        globalChatState = newState;
        globalStateSetters.forEach(setter => {
          if (setter !== setState) {
            setter(newState);
          }
        });
        return newState;
      });
      
      // Load initial messages for channels (inline to avoid dependency)
      for (const channel of data.channels) {
        (async () => {
          try {
            const messages = await chatClient.getMessages(channel.id, 50);
            setState(prev => {
              const newState = {
                ...prev,
                messages: {
                  ...prev.messages,
                  [channel.id]: messages
                }
              };
              
              globalChatState = newState;
              globalStateSetters.forEach(setter => {
                if (setter !== setState) {
                  setter(newState);
                }
              });
              
              return newState;
            });
          } catch (error) {
            console.error('Failed to load messages for channel:', channel.id, error);
          }
        })();
      }
    };

    const handleChannelUpdated = (data: { channel: ChatChannel }) => {
      console.log('Channel updated:', data.channel);
      setState(prev => {
        const newState = {
          ...prev,
          channels: prev.channels.map(channel => 
            channel.id === data.channel.id ? data.channel : channel
          )
        };
        
        globalChatState = newState;
        globalStateSetters.forEach(setter => {
          if (setter !== setState) {
            setter(newState);
          }
        });
        
        return newState;
      });
    };

    const handleAuthError = (error: any) => {
      console.error('Chat auth error:', error);
      
      // If authentication fails, try to reconnect with a fresh token
      if (error.message?.includes('Token expired') || error.message?.includes('Invalid token') || error.message?.includes('No authentication token')) {
        console.log('🔐 Attempting to reconnect with fresh token...');
        setTimeout(async () => {
          try {
            // Force disconnect first
            chatClient.disconnect();
            // Reset connection flag
            connectionInitialized.current = false;
            // Attempt to reconnect
            await connectChat();
          } catch (reconnectError) {
            console.error('Failed to reconnect after auth error:', reconnectError);
            toast({
              title: "Chat Authentication Failed",
              description: "Please refresh the page to reconnect to chat.",
              variant: "destructive",
            });
          }
        }, 1000);
      } else {
        toast({
          title: "Chat Authentication Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    };

    const handleTokenExpiring = (data: { hoursUntilExpiry: number }) => {
      console.log(`🔐 Token expires in ${data.hoursUntilExpiry.toFixed(1)} hours`);
      
      // Show a warning if token expires in less than 1 hour
      if (data.hoursUntilExpiry < 1) {
        toast({
          title: "Session Expiring Soon",
          description: `Your chat session will expire in ${Math.round(data.hoursUntilExpiry * 60)} minutes. Activity will automatically extend your session.`,
          variant: "destructive",
        });
      } else if (data.hoursUntilExpiry < 2) {
        console.log(`ℹ️ Session expires in ${data.hoursUntilExpiry.toFixed(1)} hours - automatic refresh failed`);
      }
    };

    const handleNewMessage = (message: ChatMessage) => {
      setState(prev => {
        const currentActiveChannel = globalChatState?.activeChannel || prev.activeChannel;
        const currentUserId = session?.user?.id;
        
        // Check if the current user is mentioned
        const isMentioned = currentUserId && message.mentions?.includes(currentUserId);
        
        const newState = {
          ...prev,
          messages: {
            ...prev.messages,
            [message.channel_id]: [
              ...(prev.messages[message.channel_id] || []),
              message
            ]
          },
          unreadCounts: {
            ...prev.unreadCounts,
            [message.channel_id]: message.channel_id === currentActiveChannel 
              ? 0 
              : (prev.unreadCounts[message.channel_id] || 0) + 1
          },
          mentionCounts: {
            ...prev.mentionCounts,
            [message.channel_id]: message.channel_id === currentActiveChannel 
              ? (isMentioned ? 0 : (prev.mentionCounts[message.channel_id] || 0))
              : (prev.mentionCounts[message.channel_id] || 0) + (isMentioned ? 1 : 0)
          },
          channels: prev.channels.map(channel => 
            channel.id === message.channel_id 
              ? { ...channel, last_message_at: message.created_at }
              : channel
          )
        };
        
        globalChatState = newState;
        globalStateSetters.forEach(setter => {
          if (setter !== setState) {
            setter(newState);
          }
        });
        
        return newState;
      });
    };

    const handleUserTyping = (data: { channel_id: string; user_id: string; typing: boolean }) => {
      setState(prev => {
        let newTypingUsers = prev.typingUsers.filter(
          tu => !(tu.channelId === data.channel_id && tu.userId === data.user_id)
        );

        if (data.typing) {
          newTypingUsers.push({
            userId: data.user_id,
            channelId: data.channel_id,
            timestamp: Date.now()
          });
        }

        const newState = {
          ...prev,
          typingUsers: newTypingUsers
        };
        
        globalChatState = newState;
        globalStateSetters.forEach(setter => {
          if (setter !== setState) {
            setter(newState);
          }
        });
        
        return newState;
      });

      // Clear typing indicator after 3 seconds
      if (data.typing) {
        const key = `${data.channel_id}-${data.user_id}`;
        if (typingTimeoutRef.current[key]) {
          clearTimeout(typingTimeoutRef.current[key]);
        }
        
        typingTimeoutRef.current[key] = setTimeout(() => {
          setState(prev => {
            const newState = {
              ...prev,
              typingUsers: prev.typingUsers.filter(
                tu => !(tu.channelId === data.channel_id && tu.userId === data.user_id)
              )
            };
            
            globalChatState = newState;
            globalStateSetters.forEach(setter => {
              if (setter !== setState) {
                setter(newState);
              }
            });
            
            return newState;
          });
        }, 3000);
      }
    };

    const handleConnectionStatus = (status: { connected: boolean }) => {
      console.log('Chat connection status changed:', {
        connected: status.connected,
        connectionState: chatClient.getConnectionState()
      });
      setState(prev => {
        const newState = {
          ...prev,
          isConnected: status.connected,
          connectionState: chatClient.getConnectionState()
        };
        
        globalChatState = newState;
        globalStateSetters.forEach(setter => {
          if (setter !== setState) {
            setter(newState);
          }
        });
        
        return newState;
      });
    };

    const handleError = (error: any) => {
      console.error('Chat error:', error);
      toast({
        title: "Chat Error",
        description: error.message,
        variant: "destructive",
      });
    };

    // Register event listeners
    chatClient.on('authenticated', handleAuthenticated);
    chatClient.on('auth_error', handleAuthError);
    chatClient.on('channels_updated', handleChannelsUpdated);
    chatClient.on('channel_updated', handleChannelUpdated);
    chatClient.on('new_message', handleNewMessage);
    chatClient.on('user_typing', handleUserTyping);
    chatClient.on('connection_status', handleConnectionStatus);
    chatClient.on('error', handleError);
    chatClient.on('token_expiring', handleTokenExpiring);

    return () => {
      // Clean up event listeners
      chatClient.off('authenticated', handleAuthenticated);
      chatClient.off('auth_error', handleAuthError);
      chatClient.off('channels_updated', handleChannelsUpdated);
      chatClient.off('channel_updated', handleChannelUpdated);
      chatClient.off('new_message', handleNewMessage);
      chatClient.off('user_typing', handleUserTyping);
      chatClient.off('connection_status', handleConnectionStatus);
      chatClient.off('error', handleError);
      chatClient.off('token_expiring', handleTokenExpiring);
      
      // Clear typing timeouts
      Object.values(typingTimeoutRef.current).forEach(clearTimeout);
    };
  }, [session, toast]);

  // Clean up old typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setState(prev => {
        const newState = {
          ...prev,
          typingUsers: prev.typingUsers.filter(tu => now - tu.timestamp < 5000)
        };
        
        // Only update global state if there was a change
        if (newState.typingUsers.length !== prev.typingUsers.length) {
          globalChatState = newState;
          globalStateSetters.forEach(setter => {
            if (setter !== setState) {
              setter(newState);
            }
          });
        }
        
        return newState;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const connectChat = async () => {
    if (!session?.access_token) {
      console.log('No session token available for chat connection');
      return;
    }
    
    try {
      console.log('Connecting to chat with session:', session.user?.email);
      await chatClient.connect(session.access_token);
    } catch (error) {
      console.error('Failed to connect to chat:', error);
      toast({
        title: "Chat Connection Failed",
        description: "Unable to connect to chat server.",
        variant: "destructive",
      });
    }
  };

  const refreshConnection = useCallback(async () => {
    if (!session?.access_token) {
      toast({
        title: "Connection Error",
        description: "No session available for reconnection.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Force disconnect first to clean up any existing connection
      chatClient.disconnect();
      
      // Reset connection initialized flag to allow reconnection
      connectionInitialized.current = false;
      
      // Wait a moment for cleanup, then reconnect
      setTimeout(async () => {
        connectionInitialized.current = true;
        await connectChat();
      }, 500);
      
      toast({
        title: "Reconnecting...",
        description: "Reconnecting to chat.",
      });
    } catch (error) {
      console.error('Failed to refresh connection:', error);
      toast({
        title: "Reconnection Failed",
        description: "Unable to reconnect to chat server.",
        variant: "destructive",
      });
    }
  }, [session, toast]);

  const loadChannels = useCallback(async () => {
    try {
      const channels = await chatClient.getChannels();
      setState(prev => {
        const newState = { ...prev, channels };
        globalChatState = newState;
        globalStateSetters.forEach(setter => {
          if (setter !== setState) {
            setter(newState);
          }
        });
        return newState;
      });
      
      // Load initial messages for channels (call loadMessages directly)
      for (const channel of channels) {
        try {
          const messages = await chatClient.getMessages(channel.id, 50);
          setState(prev => {
            const newState = {
              ...prev,
              messages: {
                ...prev.messages,
                [channel.id]: messages
              }
            };
            
            globalChatState = newState;
            globalStateSetters.forEach(setter => {
              if (setter !== setState) {
                setter(newState);
              }
            });
            
            return newState;
          });
        } catch (error) {
          console.error('Failed to load messages for channel:', channel.id, error);
        }
      }
    } catch (error) {
      console.error('Failed to load channels:', error);
    }
  }, []);

  const loadMessages = useCallback(async (channelId: string, before?: string) => {
    try {
      const messages = await chatClient.getMessages(channelId, 50, before);
      
      setState(prev => {
        const newState = {
          ...prev,
          messages: {
            ...prev.messages,
            [channelId]: before 
              ? [...messages, ...(prev.messages[channelId] || [])]
              : messages
          }
        };
        
        globalChatState = newState;
        globalStateSetters.forEach(setter => {
          if (setter !== setState) {
            setter(newState);
          }
        });
        
        return newState;
      });
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, []);

  const createChannel = useCallback(async (data: {
    name: string;
    description?: string;
    type: 'public' | 'private';
    icon?: string;
    members?: string[];
  }) => {
    try {
      const channel = await chatClient.createChannel(data);
      setState(prev => {
        const newState = {
          ...prev,
          channels: [...prev.channels, channel]
        };
        
        globalChatState = newState;
        globalStateSetters.forEach(setter => {
          if (setter !== setState) {
            setter(newState);
          }
        });
        
        return newState;
      });
      
      // Join the channel via WebSocket
      chatClient.joinChannel(channel.id);

      return channel;
    } catch (error) {
      console.error('Failed to create channel:', error);
      toast({
        title: "Error",
        description: "Failed to create channel.",
        variant: "destructive",
      });
      throw error;
    }
  }, [toast]);

  const updateChannel = useCallback(async (channelId: string, updates: {
    name?: string;
    description?: string;
    icon?: string;
  }) => {
    try {
      const updatedChannel = await chatClient.updateChannel(channelId, updates);
      setState(prev => {
        const newState = {
          ...prev,
          channels: prev.channels.map(channel => 
            channel.id === channelId ? updatedChannel : channel
          )
        };
        globalChatState = newState;
        globalStateSetters.forEach(setter => {
          if (setter !== setState) {
            setter(newState);
          }
        });
        
        return newState;
      });
      
      toast({
        title: "Channel Updated",
        description: `Channel has been updated.`,
      });

      return updatedChannel;
    } catch (error) {
      console.error('Failed to update channel:', error);
      toast({
        title: "Error",
        description: "Failed to update channel.",
        variant: "destructive",
      });
      throw error;
    }
  }, [toast]);

  const joinChannel = useCallback(async (channelId: string) => {
    try {
      await chatClient.joinChannelHttp(channelId);
      chatClient.joinChannel(channelId);
      
      // Reload channels to get updated membership (inline to avoid dependency)
      try {
        const channels = await chatClient.getChannels();
        setState(prev => {
          const newState = { ...prev, channels };
          globalChatState = newState;
          globalStateSetters.forEach(setter => {
            if (setter !== setState) {
              setter(newState);
            }
          });
          return newState;
        });
      } catch (loadError) {
        console.error('Failed to reload channels:', loadError);
      }
      
      toast({
        title: "Joined Channel",
        description: "You have joined the channel.",
      });
    } catch (error) {
      console.error('Failed to join channel:', error);
      toast({
        title: "Error",
        description: "Failed to join channel.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const selectChannel = useCallback(async (channelId: string) => {
    console.log('Selecting channel:', channelId);
    
    setState(prev => {
      const newState = {
        ...prev,
        activeChannel: channelId || null,
        unreadCounts: {
          ...prev.unreadCounts,
          [channelId]: channelId ? 0 : (prev.unreadCounts[channelId] || 0)
        },
        mentionCounts: {
          ...prev.mentionCounts,
          [channelId]: channelId ? 0 : (prev.mentionCounts[channelId] || 0)
        }
      };
      
      // Update global state immediately
      globalChatState = newState;
      globalStateSetters.forEach(setter => {
        if (setter !== setState) {
          setter(newState);
        }
      });
      
      return newState;
    });

    if (channelId) {
      // Join channel via WebSocket
      chatClient.joinChannel(channelId);
      
      // Mark as read
      try {
        await chatClient.markChannelAsRead(channelId);
      } catch (error) {
        console.error('Failed to mark channel as read:', error);
      }

      // Load messages if not already loaded (use current global state)
      const currentMessages = globalChatState?.messages || {};
      if (!currentMessages[channelId]) {
        try {
          const messages = await chatClient.getMessages(channelId, 50);
          setState(prev => {
            const newState = {
              ...prev,
              messages: {
                ...prev.messages,
                [channelId]: messages
              }
            };
            
            globalChatState = newState;
            globalStateSetters.forEach(setter => {
              if (setter !== setState) {
                setter(newState);
              }
            });
            
            return newState;
          });
        } catch (error) {
          console.error('Failed to load messages for channel:', channelId, error);
        }
      }
    }
  }, []);

  const sendMessage = useCallback(async (content: string, replyToId?: string) => {
    const currentActiveChannel = globalChatState?.activeChannel || state.activeChannel;
    
    if (!currentActiveChannel || !content.trim()) {
      console.log('Cannot send message: no active channel or empty content', {
        activeChannel: currentActiveChannel,
        content: content?.trim(),
        globalState: globalChatState?.activeChannel,
        localState: state.activeChannel
      });
      return;
    }
    
    console.log('Attempting to send message:', {
      channel: currentActiveChannel,
      content: content.trim(),
      isConnected: state.isConnected,
      connectionState: state.connectionState
    });

    // Parse mentions from content
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(content.trim())) !== null) {
      mentions.push(match[2]); // User ID from the mention
    }

    // Create optimistic message
    const optimisticMessage = {
      id: crypto.randomUUID ? crypto.randomUUID() : `temp-${Date.now()}`,
      channel_id: currentActiveChannel,
      user_id: session?.user?.id || '',
      content: content.trim(),
      message_type: 'text' as const,
      reply_to_id: replyToId,
      created_at: new Date().toISOString(),
      deleted: false,
      edited: false,
      mentions: mentions.length > 0 ? mentions : undefined,
      user: session?.user ? {
        id: session.user.id,
        email: session.user.email,
        first_name: session.user.first_name,
        last_name: session.user.last_name
      } : undefined
    };

    // Add optimistic message to state immediately
    setState(prev => {
      const newState = {
        ...prev,
        messages: {
          ...prev.messages,
          [currentActiveChannel]: [
            ...(prev.messages[currentActiveChannel] || []),
            optimisticMessage
          ]
        },
        channels: prev.channels.map(channel => 
          channel.id === currentActiveChannel 
            ? { ...channel, last_message_at: optimisticMessage.created_at }
            : channel
        )
      };
      
      globalChatState = newState;
      globalStateSetters.forEach(setter => {
        if (setter !== setState) {
          setter(newState);
        }
      });
      
      return newState;
    });
    
    try {
      // Try WebSocket first, fallback to HTTP
      const sent = chatClient.sendChatMessage(currentActiveChannel, content.trim(), replyToId, mentions);
      
      if (!sent) {
        // Fallback to HTTP
        console.log('WebSocket not available, using HTTP fallback');
        await chatClient.sendMessageHttp(currentActiveChannel, content.trim(), replyToId, mentions);
        console.log('Message sent via HTTP successfully');
      } else {
        console.log('Message sent via WebSocket successfully');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Remove optimistic message on error
      setState(prev => {
        const newState = {
          ...prev,
          messages: {
            ...prev.messages,
            [currentActiveChannel]: (prev.messages[currentActiveChannel] || [])
              .filter(msg => msg.id !== optimisticMessage.id)
          }
        };
        
        globalChatState = newState;
        globalStateSetters.forEach(setter => {
          if (setter !== setState) {
            setter(newState);
          }
        });
        
        return newState;
      });
      
      toast({
        title: "Error",
        description: "Failed to send message.",
        variant: "destructive",
      });
    }
  }, [state.activeChannel, state.isConnected, state.connectionState, toast, session]);

  const startTyping = useCallback(() => {
    const currentActiveChannel = globalChatState?.activeChannel || state.activeChannel;
    if (currentActiveChannel && chatClient.isConnected()) {
      chatClient.startTyping(currentActiveChannel);
    }
  }, [state.activeChannel]);

  const stopTyping = useCallback(() => {
    const currentActiveChannel = globalChatState?.activeChannel || state.activeChannel;
    if (currentActiveChannel && chatClient.isConnected()) {
      chatClient.stopTyping(currentActiveChannel);
    }
  }, [state.activeChannel]);

  // Get typing users for active channel (excluding current user)
  const getTypingUsers = useCallback(() => {
    const currentActiveChannel = globalChatState?.activeChannel || state.activeChannel;
    if (!currentActiveChannel) return [];
    
    return state.typingUsers
      .filter(tu => tu.channelId === currentActiveChannel && tu.userId !== session?.user?.id)
      .map(tu => tu.userId);
  }, [state.activeChannel, state.typingUsers, session?.user?.id]);

  const getUnreadCount = (channelId: string) => {
    return state.unreadCounts[channelId] || 0;
  };

  const getTotalUnreadCount = () => {
    return Object.values(state.unreadCounts).reduce((sum, count) => sum + count, 0);
  };

  const getMentionCount = (channelId: string) => {
    return state.mentionCounts[channelId] || 0;
  };

  const getTotalMentionCount = () => {
    return Object.values(state.mentionCounts).reduce((sum, count) => sum + count, 0);
  };

  const currentActiveChannel = globalChatState?.activeChannel || state.activeChannel;
  const currentMessages = globalChatState?.messages || state.messages;

  return {
    // State
    channels: state.channels,
    messages: currentMessages[currentActiveChannel] || [],
    activeChannel: currentActiveChannel,
    isConnected: state.isConnected,
    connectionState: state.connectionState,
    
    // Actions
    createChannel,
    updateChannel,
    joinChannel,
    selectChannel,
    sendMessage,
    loadMessages: (before?: string) => currentActiveChannel ? loadMessages(currentActiveChannel, before) : Promise.resolve(),
    startTyping,
    stopTyping,
    refreshConnection,
    loadChannels,
    
    // Utilities
    getTypingUsers,
    getUnreadCount,
    getTotalUnreadCount,
    getMentionCount,
    getTotalMentionCount,
    
    // Refs
    messageInputRef
  };
} 