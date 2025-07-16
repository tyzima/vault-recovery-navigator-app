import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MessageCircle, 
  Minus, 
  X, 
  Users, 
  Wifi, 
  WifiOff,
  ArrowLeft,
  Hash,
  Lock,
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
  Palette,
  RefreshCw,
  Play
} from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChatChannelList } from './ChatChannelList';
import { ChatWindow } from './ChatWindow';
import { CreateChannelPopup } from './CreateChannelDialog';
import { ChannelMembersDialog } from './ChannelMembersDialog';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';

interface FloatingChatProps {
  className?: string;
}

export function FloatingChat({ className }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Available icons for channels
  const AVAILABLE_ICONS = [
    { key: 'hash', icon: Hash, name: 'General' },
    { key: 'message-circle', icon: MessageCircle, name: 'Chat' },
    { key: 'users', icon: Users, name: 'Team' },
    { key: 'star', icon: Star, name: 'Important' },
    { key: 'heart', icon: Heart, name: 'Social' },
    { key: 'zap', icon: Zap, name: 'Quick' },
    { key: 'shield', icon: Shield, name: 'Security' },
    { key: 'rocket', icon: Rocket, name: 'Launch' },
    { key: 'trophy', icon: Trophy, name: 'Success' },
    { key: 'target', icon: Target, name: 'Goals' },
    { key: 'coffee', icon: Coffee, name: 'Casual' },
    { key: 'lightbulb', icon: Lightbulb, name: 'Ideas' },
    { key: 'bell', icon: Bell, name: 'Alerts' },
    { key: 'flag', icon: Flag, name: 'Reports' },
    { key: 'book', icon: Book, name: 'Docs' },
    { key: 'code', icon: Code, name: 'Dev' },
    { key: 'settings', icon: Settings, name: 'Config' },
    { key: 'home', icon: Home, name: 'Main' },
    { key: 'briefcase', icon: Briefcase, name: 'Work' },
    { key: 'calendar', icon: Calendar, name: 'Events' },
    { key: 'clock', icon: Clock, name: 'Time' },
    { key: 'globe', icon: Globe, name: 'Global' },
    { key: 'music', icon: Music, name: 'Music' },
    { key: 'camera', icon: Camera, name: 'Photos' },
    { key: 'gift', icon: Gift, name: 'Rewards' },
    { key: 'smile', icon: Smile, name: 'Fun' },
    { key: 'thumbs-up', icon: ThumbsUp, name: 'Feedback' },
  ];

  // Icon mapping for channel icons
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

  const getChannelIcon = (channel: any) => {
    // For direct messages, always use the user avatar
    if (channel.type === 'direct') {
      return <Users className="h-4 w-4 text-gray-300 transition-all duration-200" />;
    }
    
    // For private channels, show lock if no custom icon
    if (channel.type === 'private' && !channel.icon) {
      return <Lock className="h-4 w-4 text-white transition-all duration-200" />;
    }
    
    // Use custom icon if available
    if (channel.icon && ICON_MAP[channel.icon]) {
      const IconComponent = ICON_MAP[channel.icon];
      return <IconComponent className="h-4 w-4 text-gray-300 transition-all duration-200" />;
    }
    
    // Default to hash
    return <Hash className="h-4 w-4 text-white transition-all duration-200" />;
  };
  
  const {
    channels,
    messages,
    activeChannel,
    isConnected,
    connectionState,
    selectChannel,
    createChannel,
    updateChannel,
    getTotalUnreadCount,
    getUnreadCount,
    getTotalMentionCount,
    getMentionCount,
    refreshConnection
  } = useChat();

  const totalUnread = getTotalUnreadCount();
  const totalMentions = getTotalMentionCount();
  const selectedChannel = channels.find(c => c.id === activeChannel);
  
  // Debug logging for unread counts
  useEffect(() => {
    if (totalUnread > 0 || totalMentions > 0) {
      console.log('FloatingChat unread counts:', { totalUnread, totalMentions });
    }
  }, [totalUnread, totalMentions]);

  // Auto-open when first message received (but only if user hasn't manually closed it recently)
  const [manuallyClosedAt, setManuallyClosedAt] = useState<number | null>(null);
  
  useEffect(() => {
    // Don't auto-open if user manually closed it within the last 30 seconds
    const recentlyClosed = manuallyClosedAt && (Date.now() - manuallyClosedAt) < 30000;
    
    if (totalUnread > 0 && !isOpen && !recentlyClosed) {
      setIsOpen(true);
    }
  }, [totalUnread, isOpen, manuallyClosedAt]);

  const handleClose = () => {
    setIsOpen(false);
    setManuallyClosedAt(Date.now()); // Track when user manually closed the chat
  };

  const handleIconChange = async (iconKey: string) => {
    if (!selectedChannel) return;
    
    try {
      await updateChannel(selectedChannel.id, { icon: iconKey });
      setShowIconPicker(false);
    } catch (error) {
      console.error('Failed to update channel icon:', error);
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

  const handleCreateChannel = async (data: {
    name: string;
    description?: string;
    type: 'public' | 'private';
    icon?: string;
    members?: string[];
  }) => {
    const channel = await createChannel(data);
    // Automatically navigate to the newly created channel
    await selectChannel(channel.id);
    return channel;
  };

  if (!isOpen) {
    return (
      <div className={cn("fixed bottom-4 right-4 z-50", className)}>
        <Tooltip
          content={selectedChannel ? selectedChannel.name : "Team Chat"}
          side="left"
          className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 shadow-lg"
        >
          <div className="relative">
            <button
              onClick={() => {
                setIsAnimating(true);
                setIsOpen(true);
                setTimeout(() => setIsAnimating(false), 400);
              }}
              className={cn(
                "relative p-3 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.05] active:scale-[0.95]",
                selectedChannel 
                  ? "bg-blue-600 hover:bg-blue-700" 
                  : "bg-gray-600 hover:bg-gray-700"
              )}
            >
              {selectedChannel ? (
                <div className="h-6 w-6 flex items-center justify-center">
                  {getChannelIcon(selectedChannel)}
                </div>
              ) : (
                <MessageCircle className="h-6 w-6" />
              )}
              
              {/* Status indicator */}
              {isConnected && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
              )}
            </button>
            
            {/* Notification badges */}
            {totalMentions > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -left-1 min-w-[18px] h-5 rounded-full flex items-center justify-center text-xs font-semibold bg-orange-600 hover:bg-orange-700 border-2 border-white shadow-lg z-10"
                title="You have mentions"
              >
                @{totalMentions > 99 ? '99+' : totalMentions}
              </Badge>
            )}
            {totalUnread > 0 && totalMentions === 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -left-1 min-w-[18px] h-5 rounded-full flex items-center justify-center text-xs font-semibold bg-red-600 hover:bg-red-700 border-2 border-white shadow-lg z-10"
                title={`You have ${totalUnread} unread message${totalUnread > 1 ? 's' : ''}`}
              >
                {totalUnread > 99 ? '99+' : totalUnread}
              </Badge>
            )}
          </div>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className={cn("fixed bottom-4 right-4 z-50", className)}>
      <Card className={cn(
        "w-[380px] h-[500px] shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl overflow-hidden",
        isAnimating && "animate-in zoom-in-98 slide-in-from-bottom-1 duration-300 ease-out",
        "origin-bottom-right"
      )}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-2 px-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className={cn("flex items-center ml-[-4px]", selectedChannel ? "space-x-2" : "")}>
            {selectedChannel && (
              // Show channel-specific icon when a channel is selected
              selectedChannel.membership?.role === 'admin' && selectedChannel.type !== 'direct' ? (
                <Popover open={showIconPicker} onOpenChange={setShowIconPicker}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 border border-transparent hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer group"
                      title="Click to change channel icon"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm transition-all duration-200 group-hover:scale-105 group-hover:from-blue-600 group-hover:to-blue-700">
                        <div className="transition-all duration-200">
                          {getChannelIcon(selectedChannel)}
                        </div>
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3 rounded-lg border border-gray-200 dark:border-gray-600 shadow-lg bg-white dark:bg-gray-800" align="start">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">Choose Channel Icon</h4>
                        <Palette className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="grid grid-cols-6 gap-1">
                        {AVAILABLE_ICONS.map(({ key, icon: Icon, name }) => (
                          <Button
                            key={key}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleIconChange(key)}
                            className={cn(
                              "h-8 w-8 p-0 rounded-md transition-all duration-200 hover:scale-105",
                              selectedChannel.icon === key 
                                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-600" 
                                : "hover:bg-gray-100 dark:hover:bg-gray-700"
                            )}
                            title={name}
                          >
                            <Icon className="h-3 w-3" />
                          </Button>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              ) : (
                <div
                  className="p-1 rounded-lg cursor-default"
                  title={
                    selectedChannel.type === 'direct' 
                      ? 'Direct message channels cannot have custom icons' 
                      : 'Only channel admins can change the channel icon'
                  }
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white to-gray-100 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center shadow-sm transition-all duration-200">
                    <div className="transition-all duration-200">
                      {getChannelIcon(selectedChannel)}
                    </div>
                  </div>
                </div>
              )
            )}
            <div>
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white text-left">
                {selectedChannel ? selectedChannel.name : 'Team Chat'}
              </h3>
              <div className="flex items-center space-x-1 mt-0.5" title={`Connection: ${connectionState}`}>
                {isConnected ? (
                  <div className="flex items-center text-green-600 dark:text-green-400">
                    <Wifi className="h-3 w-3 mr-1" />
                    <span className="text-xs font-medium">Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-500 dark:text-red-400">
                    <WifiOff className="h-3 w-3 mr-1" />
                    <span className="text-xs font-medium">Offline</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRefreshConnection}
                      disabled={isRefreshing}
                      className="h-4 w-4 p-0 ml-1 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md disabled:opacity-50 transition-all duration-200"
                      title="Reconnect to chat server"
                    >
                      <RefreshCw className={cn("h-2.5 w-2.5", isRefreshing && "animate-spin")} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            {/* Members button for private channels */}
            {selectedChannel && selectedChannel.type === 'private' && (
              <ChannelMembersDialog 
                channel={selectedChannel}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all duration-200"
                    title="Manage Members"
                  >
                    <Users className="h-3 w-3 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400" />
                  </Button>
                }
                onMembersUpdate={() => {
                  // Optionally refresh channel data or show a toast
                  console.log('Members updated for channel:', selectedChannel.name);
                }}
              />
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-7 w-7 p-0 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-200"
              title="Close"
            >
              <X className="h-3 w-3 text-gray-600 dark:text-gray-300" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex h-[calc(500px-60px)] transition-all duration-300 ease-in-out overflow-hidden">
          {!activeChannel ? (
            <div className="flex w-full">
              <div className="w-full">
                <div className="p-2 border-b bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm flex items-center text-gray-900 dark:text-white">
                      <MessageCircle className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                   
                    </h4>
                    <CreateChannelPopup onCreateChannel={handleCreateChannel} />
                  </div>
                </div>
                <div className="overflow-y-auto max-h-[calc(500px-120px)]">
                  <ChatChannelList
                    channels={channels}
                    activeChannel={activeChannel}
                    onChannelSelect={selectChannel}
                    getUnreadCount={getUnreadCount}
                    getMentionCount={getMentionCount}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex w-full h-full">
              <div className="w-12 border-r bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 flex-shrink-0 flex flex-col">
                <div className="p-1 border-b bg-gray-100 dark:bg-gray-750 border-gray-200 dark:border-gray-700 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => selectChannel('')}
                    className="w-full h-8 justify-center p-0 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-all duration-200 group"
                    title="Back to channels"
                  >
                    <ArrowLeft className="h-3 w-3 text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                  </Button>
                </div>
                <div className="space-y-1 p-1 overflow-y-auto flex-1 min-h-0 scrollbar-hide">
                  {channels.map(channel => (
                    <div key={channel.id} className="relative">
                      <Button
                        variant={activeChannel === channel.id ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => selectChannel(channel.id)}
                        className={cn(
                          "w-full h-10 justify-center p-1 rounded-lg transition-all duration-200 group",
                          activeChannel === channel.id 
                            ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700" 
                            : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
                        )}
                        title={channel.name}
                      >
                        <div className="relative">
                          <div className={cn(
                            "w-8 h-8 rounded-md flex items-center justify-center shadow-sm transition-all duration-200 group-hover:scale-105",
                            activeChannel === channel.id
                              ? "bg-gradient-to-br from-blue-500 to-blue-600"
                              : "bg-white dark:from-gray-600 dark:to-gray-700 group-hover:from-blue-500 group-hover:to-blue-600"
                          )}>
                            <div className="transition-all duration-200">
                              {getChannelIcon(channel)}
                            </div>
                          </div>
                          {/* Red dot for mentions on channel icons */}
                          {getMentionCount(channel.id) > 0 && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white dark:border-gray-800 rounded-full animate-pulse shadow-sm"></div>
                          )}
                        </div>
                      </Button>
                      {getMentionCount(channel.id) > 0 && (
                        <Badge 
                          variant="destructive" 
                          className="absolute -top-0.5 -right-0.5 min-w-[14px] h-4 rounded-md flex items-center justify-center text-xs px-1 shadow-sm bg-orange-600 border border-white dark:border-gray-800 font-semibold"
                          title="You have mentions in this channel"
                        >
                          @{getMentionCount(channel.id) > 9 ? '9+' : getMentionCount(channel.id)}
                        </Badge>
                      )}
                      {getUnreadCount(channel.id) > 0 && !getMentionCount(channel.id) && (
                        <Badge 
                          variant="destructive" 
                          className="absolute -top-0.5 -right-0.5 min-w-[14px] h-4 rounded-md flex items-center justify-center text-xs px-1 shadow-sm bg-red-600 border border-white dark:border-gray-800 font-semibold"
                        >
                          {getUnreadCount(channel.id) > 9 ? '9+' : getUnreadCount(channel.id)}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex-1 overflow-hidden">
                <ChatWindow
                  channel={selectedChannel!}
                  messages={messages}
                  isConnected={isConnected}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Add custom CSS animations
const styles = `
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-4px); }
  }
  
  .animate-float {
    animation: float 3s ease-in-out infinite;
  }
  
  .scrollbar-hide {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
  
  .scrollbar-hide::-webkit-scrollbar {
    display: none;  /* Chrome, Safari and Opera */
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
} 