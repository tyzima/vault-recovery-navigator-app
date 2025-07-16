import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  UserPlus, 
  UserMinus, 
  Search, 
  Loader2, 
  Crown,
  MoreHorizontal,
  Trash2,
  Shield
} from 'lucide-react';
import { ChatChannel, ChannelMembership } from '@/lib/chatClient';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Profile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
}

interface ChannelMember extends Profile {
  membership: ChannelMembership;
}

interface ChannelMembersDialogProps {
  channel: ChatChannel;
  trigger?: React.ReactNode;
  onMembersUpdate?: () => void;
}

export function ChannelMembersDialog({ channel, trigger, onMembersUpdate }: ChannelMembersDialogProps) {
  const [open, setOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'members' | 'add'>('members');
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  const currentUserRole = channel.membership?.role;
  const isAdmin = currentUserRole === 'admin';

  // Fetch channel members
  const fetchMembers = async () => {
    if (!open) return;
    
    setLoading(true);
    try {
      const { fileClient } = await import('@/lib/fileClient');
      const session = await fileClient.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const response = await fetch(`/api/chat/channels/${channel.id}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      } else {
        console.error('Failed to fetch members');
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch available users for adding
  const fetchAvailableUsers = async () => {
    if (currentView !== 'add') return;

    try {
      const { fileClient } = await import('@/lib/fileClient');
      const session = await fileClient.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) return;

      const response = await fetch('/api/chat/users?for_private_channel=true', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const users = await response.json();
        // Filter out users who are already members
        const memberIds = members.map(m => m.id);
        const available = users.filter((user: Profile) => !memberIds.includes(user.id));
        setAvailableUsers(available);
      }
    } catch (error) {
      console.error('Error fetching available users:', error);
    }
  };

  // Add members to channel
  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) return;

    setAddingMembers(true);
    try {
      const { fileClient } = await import('@/lib/fileClient');
      const session = await fileClient.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) return;

      const response = await fetch(`/api/chat/channels/${channel.id}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_ids: selectedUsers })
      });

      if (response.ok) {
        setSelectedUsers([]);
        setCurrentView('members');
        await fetchMembers();
        onMembersUpdate?.();
      } else {
        console.error('Failed to add members');
      }
    } catch (error) {
      console.error('Error adding members:', error);
    } finally {
      setAddingMembers(false);
    }
  };

  // Remove member from channel
  const handleRemoveMember = async (userId: string) => {
    setRemovingMember(userId);
    try {
      const { fileClient } = await import('@/lib/fileClient');
      const session = await fileClient.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) return;

      const response = await fetch(`/api/chat/channels/${channel.id}/members/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchMembers();
        onMembersUpdate?.();
      } else {
        console.error('Failed to remove member');
      }
    } catch (error) {
      console.error('Error removing member:', error);
    } finally {
      setRemovingMember(null);
    }
  };

  // Promote/demote member
  const handleChangeRole = async (userId: string, newRole: 'admin' | 'member') => {
    try {
      const { fileClient } = await import('@/lib/fileClient');
      const session = await fileClient.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) return;

      const response = await fetch(`/api/chat/channels/${channel.id}/members/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole })
      });

      if (response.ok) {
        await fetchMembers();
        onMembersUpdate?.();
      } else {
        console.error('Failed to change member role');
      }
    } catch (error) {
      console.error('Error changing member role:', error);
    }
  };

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev => 
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

  const filteredUsers = availableUsers.filter(user => {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
    const email = user.email.toLowerCase();
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || email.includes(search);
  });

  useEffect(() => {
    if (open) {
      fetchMembers();
    }
  }, [open]);

  useEffect(() => {
    if (currentView === 'add') {
      fetchAvailableUsers();
    }
  }, [currentView, members]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm">
            <Users className="h-4 w-4 mr-2" />
            Members
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>
                {currentView === 'members' ? 'Channel Members' : 'Add Members'}
              </span>
            </div>
            {currentView === 'members' && isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentView('add')}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {currentView === 'members' ? (
            // Members List View
            <>
              <div className="text-sm text-muted-foreground">
                {members.length} member{members.length === 1 ? '' : 's'} in #{channel.name}
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <ScrollArea className="h-80">
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(member.first_name, member.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">
                              {member.first_name} {member.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {member.email}
                            </p>
                          </div>
                          {member.membership.role === 'admin' && (
                            <Badge variant="secondary" className="text-xs">
                              <Crown className="h-3 w-3 mr-1" />
                              Admin
                            </Badge>
                          )}
                        </div>

                        {isAdmin && member.id !== channel.created_by && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                disabled={removingMember === member.id}
                              >
                                {removingMember === member.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {member.membership.role === 'member' ? (
                                <DropdownMenuItem
                                  onClick={() => handleChangeRole(member.id, 'admin')}
                                >
                                  <Shield className="h-4 w-4 mr-2" />
                                  Make Admin
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleChangeRole(member.id, 'member')}
                                >
                                  <Shield className="h-4 w-4 mr-2" />
                                  Remove Admin
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleRemoveMember(member.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove Member
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </>
          ) : (
            // Add Members View
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Add Members to #{channel.name}</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentView('members')}
                  >
                    Back
                  </Button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <ScrollArea className="h-64 border rounded-md p-2">
                  <div className="space-y-2">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => handleUserToggle(user.id)}
                      >
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => handleUserToggle(user.id)}
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(user.first_name, user.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    ))}
                    {filteredUsers.length === 0 && (
                      <div className="text-center py-4">
                        <UserPlus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          {searchTerm ? 'No users found' : 'No users available to add'}
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {selectedUsers.length > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-muted-foreground">
                      {selectedUsers.length} user{selectedUsers.length === 1 ? '' : 's'} selected
                    </span>
                    <Button
                      onClick={handleAddMembers}
                      disabled={addingMembers}
                      size="sm"
                    >
                      {addingMembers && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Add Members
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 