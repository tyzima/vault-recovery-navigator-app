import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
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
  Play
} from 'lucide-react';
import { ChatChannel } from '@/lib/chatClient';
import { formatDistanceToNow } from 'date-fns';

/**
 * TODO: Implement message visibility tracking for mentions
 * 
 * To properly track when users have "seen" mentions (not just read the channel),
 * consider adding these fields to your chat message object:
 * 
 * interface ChatMessage {
 *   id: string;
 *   content: string;
 *   author: string;
 *   timestamp: string;
 *   mentions: string[]; // Array of user IDs mentioned
 *   visibility: {
 *     [userId: string]: {
 *       seen: boolean;        // Has the user actually viewed this message?
 *       seenAt?: string;     // When did they see it?
 *       inViewport?: boolean; // Is it currently in their viewport?
 *     }
 *   };
 * }
 * 
 * This would allow red dots to persist until the user actually scrolls to and sees
 * the mention, rather than just opening the channel.
 */

interface ChatChannelListProps {
  channels: ChatChannel[];
  activeChannel: string | null;
  onChannelSelect: (channelId: string) => void;
  getUnreadCount: (channelId: string) => number;
  getMentionCount: (channelId: string) => number;
}

export function ChatChannelList({
  channels,
  activeChannel,
  onChannelSelect,
  getUnreadCount,
  getMentionCount
}: ChatChannelListProps) {
  // Icon mapping
  const ICON_MAP: Record<string, React.ComponentType<any>> = {
    'hash': Hash,
    'message-circle': MessageCircle,
    'users': Users,
    'star': Star,
    'heart': Heart,
    'zap': Zap,
    'shield': Shield,
    'rocket': Rocket,
    'trophy': Trophy,
    'target': Target,
    'coffee': Coffee,
    'lightbulb': Lightbulb,
    'bell': Bell,
    'flag': Flag,
    'book': Book,
    'code': Code,
    'settings': Settings,
    'home': Home,
    'briefcase': Briefcase,
    'calendar': Calendar,
    'clock': Clock,
    'globe': Globe,
    'music': Music,
    'camera': Camera,
    'gift': Gift,
    'smile': Smile,
    'thumbs-up': ThumbsUp,
    'lock': Lock,
    'play': Play,
  };

  const getChannelIcon = (channel: ChatChannel) => {
    // For direct messages, always use the user avatar
    if (channel.type === 'direct') {
      return <Users className="h-4 w-4 text-white transition-all duration-200" />;
    }
    
    // For private channels, show lock if no custom icon
    if (channel.type === 'private' && !channel.icon) {
      return <Lock className="h-4 w-4 text-white transition-all duration-200" />;
    }
    
    // Use custom icon if available
    if (channel.icon && ICON_MAP[channel.icon]) {
      const IconComponent = ICON_MAP[channel.icon];
      return <IconComponent className="h-4 w-4 text-white transition-all duration-200" />;
    }
    
    // Default to hash
    return <Hash className="h-4 w-4 text-white transition-all duration-200" />;
  };

  const formatLastMessage = (lastMessageAt?: string) => {
    if (!lastMessageAt) return '';
    try {
      return formatDistanceToNow(new Date(lastMessageAt), { addSuffix: true });
    } catch {
      return '';
    }
  };

  const sortedChannels = [...channels].sort((a, b) => {
    // Sort by last message time, then by name
    const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    
    if (aTime !== bTime) {
      return bTime - aTime; // Most recent first
    }
    
    return a.name.localeCompare(b.name);
  });

  if (channels.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No channels available</p>
        <p className="text-xs mt-1">Create a channel to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {sortedChannels.map(channel => {
        const unreadCount = getUnreadCount(channel.id);
        const mentionCount = getMentionCount(channel.id);
        const isActive = activeChannel === channel.id;

        return (
          <div key={channel.id} className="relative">
            <Button
              variant={isActive ? "secondary" : "ghost"}
              onClick={() => onChannelSelect(channel.id)}
              className="w-full justify-start h-auto p-3 space-y-1 hover:bg-accent transition-all duration-200 group"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  <div className="flex-shrink-0">
                    {channel.type === 'direct' ? (
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm transition-all duration-200 hover:scale-105">
                          <Users className="h-4 w-4 text-white" />
                        </div>
                        {mentionCount > 0 && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white dark:border-gray-800 rounded-full animate-pulse shadow-sm"></div>
                        )}
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-200 to-gray-400 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center shadow-sm transition-all duration-200 hover:scale-105 group-hover:from-blue-500 group-hover:to-blue-600">
                          <div className="transition-all duration-200">
                            {getChannelIcon(channel)}
                          </div>
                        </div>
                        {mentionCount > 0 && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white dark:border-gray-800 rounded-full animate-pulse shadow-sm"></div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center space-x-1">
                      <span className={`text-sm truncate ${unreadCount > 0 ? 'font-semibold' : 'font-medium'}`}>
                        {channel.name}
                      </span>
                      {channel.type === 'private' && (
                        <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                    
                    {channel.last_message_at && (
                      <div className="text-xs text-muted-foreground truncate">
                        {formatLastMessage(channel.last_message_at)}
                      </div>
                    )}
                  </div>
                </div>

                {mentionCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="ml-2 min-w-[20px] h-5 rounded-md flex items-center justify-center text-xs flex-shrink-0 bg-red-600 hover:bg-red-700 border border-red-500 shadow-sm font-semibold"
                    title="You have mentions in this channel"
                  >
                    @{mentionCount > 99 ? '99+' : mentionCount}
                  </Badge>
                )}

                {unreadCount > 0 && mentionCount === 0 && (
                  <Badge 
                    variant="destructive" 
                    className="ml-2 min-w-[20px] h-5 rounded-md flex items-center justify-center text-xs flex-shrink-0 bg-red-600 hover:bg-red-700 border border-red-500 shadow-sm font-semibold"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </div>

              {channel.description && !isActive && (
                <div className="text-xs text-muted-foreground text-left w-full truncate">
                  {channel.description}
                </div>
              )}
            </Button>
          </div>
        );
      })}
    </div>
  );
} 