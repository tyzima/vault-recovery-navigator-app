import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Hash, 
  Lock, 
  Loader2, 
  Plus,
  MessageCircle,
  Users,
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
  ArrowRight,
  ArrowLeft,
  UserPlus,
  Play
} from 'lucide-react';
import { ChatChannel } from '@/lib/chatClient';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
}

interface CreateChannelPopupProps {
  trigger?: React.ReactNode;
  onCreateChannel: (data: {
    name: string;
    description?: string;
    type: 'public' | 'private';
    icon?: string;
    members?: string[];
  }) => Promise<ChatChannel>;
}

// Available icons for channel selection
const CHANNEL_ICONS = [
  { name: 'hash', icon: Hash, label: 'General' },
  { name: 'message-circle', icon: MessageCircle, label: 'Chat' },
  { name: 'users', icon: Users, label: 'Team' },
  { name: 'star', icon: Star, label: 'Important' },
  { name: 'heart', icon: Heart, label: 'Social' },
  { name: 'zap', icon: Zap, label: 'Fast' },
  { name: 'shield', icon: Shield, label: 'Security' },
  { name: 'rocket', icon: Rocket, label: 'Projects' },
  { name: 'trophy', icon: Trophy, label: 'Achievements' },
  { name: 'target', icon: Target, label: 'Goals' },
  { name: 'coffee', icon: Coffee, label: 'Casual' },
  { name: 'lightbulb', icon: Lightbulb, label: 'Ideas' },
  { name: 'bell', icon: Bell, label: 'Notifications' },
  { name: 'flag', icon: Flag, label: 'Announcements' },
  { name: 'book', icon: Book, label: 'Documentation' },
  { name: 'code', icon: Code, label: 'Development' },
  { name: 'settings', icon: Settings, label: 'Configuration' },
  { name: 'home', icon: Home, label: 'General' },
  { name: 'briefcase', icon: Briefcase, label: 'Work' },
  { name: 'calendar', icon: Calendar, label: 'Events' },
  { name: 'clock', icon: Clock, label: 'Schedule' },
  { name: 'globe', icon: Globe, label: 'Global' },
  { name: 'music', icon: Music, label: 'Entertainment' },
  { name: 'camera', icon: Camera, label: 'Media' },
  { name: 'gift', icon: Gift, label: 'Special' },
  { name: 'smile', icon: Smile, label: 'Fun' },
  { name: 'thumbs-up', icon: ThumbsUp, label: 'Feedback' },
  { name: 'play', icon: Play, label: 'Execution' },
];

export function CreateChannelPopup({ trigger, onCreateChannel }: CreateChannelPopupProps) {
  const [open, setOpen] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [currentStep, setCurrentStep] = useState<'details' | 'members'>('details');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'public' as 'public' | 'private',
    icon: 'hash'
  });
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Fetch available users when moving to members step
  useEffect(() => {
    if (currentStep === 'members' && formData.type === 'private') {
      fetchAvailableUsers();
    }
  }, [currentStep, formData.type]);

  const fetchAvailableUsers = async () => {
    setLoadingUsers(true);
    try {
      // Use the same authentication method as the chat client
      const { fileClient } = await import('@/lib/fileClient');
      const session = await fileClient.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const response = await fetch('/api/chat/users?for_private_channel=true', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const users = await response.json();
        console.log('Fetched users:', users);
        setAvailableUsers(users);
      } else {
        console.error('Failed to fetch users, status:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Channel name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Channel name must be at least 2 characters';
    } else if (formData.name.length > 50) {
      newErrors.name = 'Channel name must be less than 50 characters';
    } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(formData.name)) {
      newErrors.name = 'Channel name can only contain letters, numbers, spaces, hyphens, and underscores';
    }

    if (formData.description && formData.description.length > 200) {
      newErrors.description = 'Description must be less than 200 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // For private channels, go to member selection step first
    if (formData.type === 'private' && currentStep === 'details') {
      if (!validateForm()) return;
      setCurrentStep('members');
      return;
    }

    // Final submission
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await onCreateChannel({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        type: formData.type,
        icon: formData.icon,
        members: formData.type === 'private' ? selectedMembers : undefined
      });
      
      // Reset form and close popup
      setFormData({ name: '', description: '', type: 'public', icon: 'hash' });
      setSelectedMembers([]);
      setCurrentStep('details');
      setErrors({});
      setOpen(false);
    } catch (error) {
      console.error('Failed to create channel:', error);
      setErrors({ submit: 'Failed to create channel. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field-specific error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', description: '', type: 'public', icon: 'hash' });
    setSelectedMembers([]);
    setCurrentStep('details');
    setErrors({});
    setOpen(false);
  };

  const handleBack = () => {
    setCurrentStep('details');
  };

  const handleIconSelect = (iconName: string) => {
    handleInputChange('icon', iconName);
    setShowIconPicker(false);
  };

  const handleMemberToggle = (userId: string) => {
    setSelectedMembers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0)?.toUpperCase() || '';
    const last = lastName?.charAt(0)?.toUpperCase() || '';
    return first + last || '?';
  };

  const selectedIcon = CHANNEL_ICONS.find(icon => icon.name === formData.icon);
  const SelectedIconComponent = selectedIcon?.icon || Hash;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
            <Plus className="h-4 w-4 mr-1" />
            New Channel
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-96 h-[500px] p-0 flex flex-col" align="end" side="bottom" sideOffset={-90}>
        <div className="p-4 border-b bg-slate-50 dark:bg-slate-800 flex-shrink-0">
          <h3 className="font-semibold text-base text-left">
            {currentStep === 'details' ? 'Create New Channel' : 'Add Members'}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 text-left">
            {currentStep === 'details' 
              ? 'Set up a new channel for your team to communicate in.'
              : 'Select team members to invite to this private channel.'
            }
          </p>
        </div>

        {currentStep === 'details' ? (
          <form onSubmit={handleSubmit} className="p-4 space-y-4 flex-1 overflow-y-auto">
            {/* Channel Name with Icon Selector */}
            <div className="space-y-2">
              <Label htmlFor="channel-name" className="text-left">Channel Name</Label>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    className="p-2 h-10 w-10 border-2 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200"
                    title="Choose channel icon"
                  >
                    <SelectedIconComponent className="h-4 w-4" />
                  </Button>
                  {showIconPicker && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowIconPicker(false)}
                      />
                      <div className="absolute top-12 left-0 z-50 w-72 p-3 bg-white dark:bg-gray-800 border rounded-md shadow-lg">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm">Choose Channel Icon</h4>
                            <Palette className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <div className="grid grid-cols-6 gap-1">
                            {CHANNEL_ICONS.map((iconData) => {
                              const IconComponent = iconData.icon;
                              return (
                                <Button
                                  key={iconData.name}
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleIconSelect(iconData.name)}
                                  className={cn(
                                    "h-8 w-8 p-0 rounded-md transition-all duration-200 hover:scale-105",
                                    formData.icon === iconData.name 
                                      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-600" 
                                      : "hover:bg-gray-100 dark:hover:bg-gray-700"
                                  )}
                                  title={iconData.label}
                                >
                                  <IconComponent className="h-3 w-3" />
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <Input
                  id="channel-name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="e.g. general, project-updates"
                  disabled={isLoading}
                  className={cn("flex-1 text-left", errors.name ? 'border-red-500' : '')}
                />
              </div>
              {errors.name && (
                <p className="text-sm text-red-500 text-left">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="channel-description" className="text-left">Description (Optional)</Label>
              <Textarea
                id="channel-description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="What's this channel about?"
                disabled={isLoading}
                className={cn("text-left", errors.description ? 'border-red-500' : '')}
                rows={1}
              />
              {errors.description && (
                <p className="text-sm text-red-500 text-left">{errors.description}</p>
              )}
            </div>

            {/* Channel Type */}
            <div className="space-y-3">
              <Label htmlFor="channel-type" className="text-left font-medium">Channel Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: 'public' | 'private') => 
                  handleInputChange('type', value)
                }
                disabled={isLoading}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public" className="py-3">
                    <div className="flex items-center space-x-3 text-left">
                      <Hash className="h-5 w-5" />
                      <div>
                        <div className="font-medium text-sm">Public</div>
                        <div className="text-xs text-muted-foreground">
                          Anyone in your organization can join
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="private" className="py-3">
                    <div className="flex items-center space-x-3 text-left">
                      <Lock className="h-5 w-5" />
                      <div>
                        <div className="font-medium text-sm">Private</div>
                        <div className="text-xs text-muted-foreground">
                          Only invited members can join
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {errors.submit && (
              <p className="text-sm text-red-500 text-left">{errors.submit}</p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
                size="sm"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} size="sm">
                {formData.type === 'private' ? (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  <>
                    {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Channel
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          /* Members Selection Step */
          <>
            <div className="p-4 space-y-4 flex-1 min-h-0 overflow-y-auto">
              <div className="space-y-2">
                <Label className="text-left">Add Members</Label>
                <p className="text-xs text-muted-foreground">
                  Select organization members to invite to this private channel. You can always add more members later.
                </p>
              </div>

              {loadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading users...</span>
                </div>
              ) : (
                <div className="border rounded-md p-2 max-h-64 overflow-y-auto">
                  <div className="space-y-2">
                    {availableUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => handleMemberToggle(user.id)}
                      >
                        <Checkbox
                          checked={selectedMembers.includes(user.id)}
                          onChange={() => handleMemberToggle(user.id)}
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(user.first_name, user.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-left">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate text-left">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    ))}
                    {availableUsers.length === 0 && (
                      <div className="text-center py-4">
                        <UserPlus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No users available</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedMembers.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {selectedMembers.length} member{selectedMembers.length === 1 ? '' : 's'} selected
                </div>
              )}

              {errors.submit && (
                <p className="text-sm text-red-500 text-left">{errors.submit}</p>
              )}
            </div>

            {/* Actions - Fixed at bottom */}
            <div className="p-4 border-t bg-white dark:bg-gray-800 flex-shrink-0">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={isLoading}
                  size="sm"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isLoading}
                    size="sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    size="sm"
                  >
                    {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Channel
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Keep the old interface for backward compatibility
export function CreateChannelDialog({ open, onOpenChange, onCreateChannel }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateChannel: (data: {
    name: string;
    description?: string;
    type: 'public' | 'private';
    icon?: string;
  }) => Promise<ChatChannel>;
}) {
  // For now, just show the popup when open changes to true
  // This maintains backward compatibility while using the new popup design
  return open ? (
    <CreateChannelPopup
      onCreateChannel={async (data) => {
        const result = await onCreateChannel({
          name: data.name,
          description: data.description,
          type: data.type,
          icon: data.icon
        });
        onOpenChange(false);
        return result;
      }}
    />
  ) : null;
} 