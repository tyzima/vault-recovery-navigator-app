import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Send, 
  Hash, 
  Lock, 
  Users,
  MessageCircle,
  Star,
  Heart,
  Zap,
  Shield,
  Rocket,
  Trophy,
  Target,
  Coffee,
  Lightbulb,
  Bell,
  Flag,
  Book,
  Code,
  Settings,
  Home,
  Briefcase,
  Calendar,
  Clock,
  Globe,
  Music,
  Camera,
  Gift,
  Smile,
  ThumbsUp,
  RefreshCw
} from 'lucide-react';
import { ChatChannel, ChatMessage } from '@/lib/chatClient';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { MentionInput } from './MentionInput';
import { MessageContent } from './MessageContent';

interface ChatWindowProps {
  channel: ChatChannel;
  messages: ChatMessage[];
  isConnected: boolean;
}

export function ChatWindow({ channel, messages, isConnected }: ChatWindowProps) {
  const [messageText, setMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const { session } = useAuth();
  const currentUserId = session?.user?.id;

  const {
    sendMessage,
    startTyping,
    stopTyping,
    getTypingUsers,
    loadMessages,
    refreshConnection
  } = useChat();

  const typingUsers = getTypingUsers();

  // Parse mentions from message text
  const parseMentions = (text: string): string[] => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[2]); // User ID from the mention
    }
    
    return mentions;
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when channel changes
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [channel.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageText.trim() || !isConnected) return;

    // Parse mentions before sending
    const mentions = parseMentions(messageText);
    console.log('Sending message with mentions:', mentions);

    await sendMessage(messageText);
    setMessageText('');
    handleStopTyping();
  };

  const handleInputChange = (value: string) => {
    setMessageText(value);
    
    if (value && !isTyping) {
      handleStartTyping();
    } else if (!value && isTyping) {
      handleStopTyping();
    }
  };

  const handleStartTyping = () => {
    if (!isTyping && isConnected) {
      setIsTyping(true);
      startTyping();
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 1000);
  };

  const handleStopTyping = () => {
    if (isTyping && isConnected) {
      setIsTyping(false);
      stopTyping();
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = undefined;
    }
  };

  const handleRefreshConnection = async () => {
    setIsRefreshing(true);
    try {
      await refreshConnection();
    } finally {
      // Reset loading state after a short delay
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, 'HH:mm')}`;
    } else {
      return format(date, 'MMM d, HH:mm');
    }
  };

  const getUserDisplayName = (user?: ChatMessage['user']) => {
    if (!user) return 'Unknown User';
    return user.first_name && user.last_name 
      ? `${user.first_name} ${user.last_name}`
      : user.email;
  };

  const getUserInitials = (user?: ChatMessage['user']) => {
    if (!user) return 'U';
    if (user.first_name && user.last_name) {
      return `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
    }
    return user.email.charAt(0).toUpperCase();
  };

  // Check if message mentions current user
  const isMentioned = (message: ChatMessage) => {
    if (!currentUserId || !message.mentions) return false;
    return message.mentions.includes(currentUserId);
  };

  // Group messages by sender and time proximity
  const groupedMessages = messages.reduce((groups: (ChatMessage & { isGroupStart: boolean })[], message, index) => {
    const prevMessage = messages[index - 1];
    const isGroupStart = !prevMessage || 
      prevMessage.user_id !== message.user_id ||
      new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() > 5 * 60 * 1000; // 5 minutes

    groups.push({ ...message, isGroupStart });
    return groups;
  }, []);

  return (
    <div className={cn(
      "flex flex-col bg-white dark:bg-gray-900",
      "h-full"
    )}>
      {/* Messages */}
      <ScrollArea className={cn("flex-1", "p-2 pt-0")}>
        <div className={cn("space-y-1 text-left")}>
          {groupedMessages.map((message) => (
            <div key={message.id} className={cn(
              "flex items-start text-left group hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-md transition-all duration-200",
              message.isGroupStart ? "mt-3" : "mt-0.5",
              isMentioned(message) && "bg-blue-50/50 dark:bg-blue-900/20 border-l-2 border-blue-400 dark:border-blue-500",
              "space-x-2 p-1 -mx-1"
            )}>
              <div className="flex-shrink-0">
                {message.isGroupStart ? (
                  <Avatar className={cn("ring-1 ring-gray-200 dark:ring-gray-700", "h-7 w-7")}>
                    <AvatarFallback className={cn("font-medium bg-blue-500 text-white", "text-xs")}>
                      {getUserInitials(message.user)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className={cn("w-7 h-7")} />
                )}
              </div>
              
              <div className="flex-1 min-w-0 text-left relative">
                {!message.isGroupStart && (
                  <span className={cn(
                    "absolute right-0 top-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-xs"
                  )}>
                    {format(new Date(message.created_at), 'HH:mm')}
                  </span>
                )}
                {message.isGroupStart && (
                  <div className={cn("flex items-start flex-col text-left", "mb-1")}>
                    <div className="flex items-center space-x-2">
                      <span className={cn(
                        "font-medium truncate text-gray-900 dark:text-white",
                        "text-sm"
                      )}>
                        {getUserDisplayName(message.user)}
                      </span>
                      <span className={cn("text-gray-400 dark:text-gray-500 text-xs")}>
                        {formatMessageTime(message.created_at)}
                      </span>
                      {isMentioned(message) && (
                        <span className={cn(
                          "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1 py-0.5 rounded text-xs"
                        )}>
                          mentioned you
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                <MessageContent
                  content={message.content}
                  mentions={message.mentions}
                  currentUserId={currentUserId}
                  className={cn("text-gray-800 dark:text-gray-200", "text-sm")}
                />
                
                {message.edited && (
                  <span className={cn("text-gray-400 dark:text-gray-500 italic text-xs")}>(edited)</span>
                )}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <div className={cn(
              "flex items-start text-left opacity-70 bg-gray-50 dark:bg-gray-800 rounded-md",
              "space-x-2 mt-3 p-2"
            )}>
              <div className="flex space-x-1 pt-0.5">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className={cn("text-gray-600 dark:text-gray-300", "text-xs")}>
                {typingUsers.length === 1 
                  ? 'Someone is typing...' 
                  : `${typingUsers.length} people are typing...`}
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className={cn(
        "border-t bg-gray-50 dark:bg-gray-800 text-left",
        "p-2"
      )}>
        <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
          <MentionInput
            value={messageText}
            onChange={handleInputChange}
            onSubmit={handleSendMessage}
            placeholder={`Message ${channel.name}...`}
            disabled={!isConnected}
            className={cn(
              "flex-1 text-left text-sm rounded-lg border border-gray-200 dark:border-gray-600 focus:border-blue-400 dark:focus:border-blue-500 bg-white dark:bg-gray-700",
              "h-8"
            )}
            channelId={channel.id}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
          />
          <Button 
            type="submit" 
            size="sm"
            disabled={!messageText.trim() || !isConnected}
            className={cn(
              "rounded-lg bg-blue-600 hover:bg-blue-700 transition-all duration-200",
              "px-2 py-1 h-8"
            )}
          >
            <Send className={cn("h-3 w-3")} />
          </Button>
        </form>
        
        {!isConnected && (
          <div className={cn(
            "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md",
            "mt-2 p-2"
          )}>
            <div className="flex items-center justify-between">
              <p className={cn(
                "text-red-600 dark:text-red-400 flex items-center",
                "text-xs"
              )}>
                                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1 animate-pulse" />
                  Disconnected from chat server. Messages may not be delivered.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefreshConnection}
                disabled={isRefreshing}
                className={cn(
                  "text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-800/30 disabled:opacity-50",
                  "h-6 px-2"
                )}
                title="Reconnect to chat server"
              >
                <RefreshCw className={cn("mr-1", "h-3 w-3", isRefreshing && "animate-spin")} />
                {isRefreshing ? 'Connecting...' : 'Retry'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 