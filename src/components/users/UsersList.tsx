import React, { useEffect, useState } from 'react';
import { fileClient } from '@/lib/fileClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Building2, ArrowRightLeft } from 'lucide-react';

import { Tooltip } from '@/components/ui/tooltip';
import { EditUserDialog } from './EditUserDialog';
import { ReassignStepsDialog } from './ReassignStepsDialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

interface Profile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  client_id?: string;
  created_at: string;
  updated_at?: string;
}

interface Client {
  id: string;
  name: string;
  description?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  created_at: string;
  updated_at?: string;
  logo_url?: string;
}

interface UserWithClient extends Profile {
  client?: Client;
}

export function UsersList() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const [users, setUsers] = useState<UserWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserWithClient | null>(null);
  const [reassignFromUser, setReassignFromUser] = useState<UserWithClient | null>(null);
  const { toast } = useToast();

  const fetchUsers = async () => {
    console.log('Fetching users...');
    setLoading(true);
    
    try {
      // Get all profiles
      const profilesResult = await fileClient.from('profiles').select('*').execute();
      if (profilesResult.error) {
        console.error('Error fetching profiles:', profilesResult.error);
        toast({
          title: "Error",
          description: "Failed to fetch users",
          variant: "destructive"
        });
        return;
      }

      let profiles = profilesResult.data || [];

      // Filter based on user role
      if (profile?.role === 'client_admin' && profile?.client_id) {
        profiles = profiles.filter((p: any) => p.client_id === profile.client_id);
      }

      // Get all clients to join with profiles
      const clientsResult = await fileClient.from('clients').select('*').execute();
      const clients = clientsResult.data || [];

      // Join profiles with clients
      const usersWithClients = profiles.map((profile: any) => {
        const client = clients.find((c: any) => c.id === profile.client_id);
        return {
          ...profile,
          client: client || null
        };
      });

      // Sort by created_at descending
      usersWithClients.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      console.log('Users fetched:', usersWithClients);
      setUsers(usersWithClients);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [profile?.role, profile?.client_id]);

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const result = await fileClient.from('profiles').delete().eq('id', userId);
      
      if (result.error) {
        toast({
          title: "Error",
          description: "Failed to delete user",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success",
          description: "User deleted successfully"
        });
        fetchUsers();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive"
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'kelyn_admin':
        return 'destructive';
      case 'kelyn_rep':
        return 'default';
      case 'client_admin':
        return 'secondary';
      case 'client_member':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const canEditUser = (targetUser: UserWithClient) => {
    // Kelyn admins can edit anyone
    if (profile?.role === 'kelyn_admin') return true;
    
    // Client admins can only edit users from their own client (except kelyn roles)
    if (profile?.role === 'client_admin') {
      return targetUser.client_id === profile.client_id && 
             !['kelyn_admin', 'kelyn_rep'].includes(targetUser.role);
    }
    
    return false;
  };

  const canDeleteUser = (targetUser: UserWithClient) => {
    // Same logic as canEditUser for now
    return canEditUser(targetUser);
  };

  const canReassignSteps = (targetUser: UserWithClient) => {
    // Kelyn admins can reassign steps from anyone
    if (profile?.role === 'kelyn_admin') return true;
    
    // Client admins can only reassign steps from users in their own client (except kelyn roles)
    if (profile?.role === 'client_admin') {
      return targetUser.client_id === profile.client_id && 
             !['kelyn_admin', 'kelyn_rep'].includes(targetUser.role);
    }
    
    return false;
  };

  if (loading) {
    return null;
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>
          {profile?.role === 'client_admin' 
            ? 'No team members found for your organization'
            : 'No users found'
          }
        </p>
      </div>
    );
  }

  return (
    <>
      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
        `}
      </style>
      <div className="max-w-7xl mx-auto">
        <div className="w-full overflow-x-auto">
          <div className="border rounded-lg overflow-hidden bg-white min-w-max">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left">
                  <th className="px-4 py-3 text-sm font-medium text-gray-900">Name</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-900">Email</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-900">Role</th>
                  {profile?.role === 'kelyn_admin' && (
                    <th className="px-4 py-3 text-sm font-medium text-gray-900">Team</th>
                  )}
                  <th className="px-4 py-3 text-sm font-medium text-gray-900">Created</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user, index) => (
                  <tr 
                    key={user.id} 
                    className="hover:bg-gray-50 transition-colors"
                    style={{ 
                      opacity: 0,
                      animation: `fadeIn 0.6s ease-out ${index * 60}ms forwards`
                    }}
                  >
                    <td className="px-4 py-3 text-left">
                      <div className="font-medium text-gray-900 text-left">
                        {user.first_name} {user.last_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <div className="text-sm text-gray-600 text-left">{user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <Badge variant={getRoleBadgeVariant(user.role)} className="uppercase text-[7px]">
                        {user.role.replace('_', ' ')}
                      </Badge>
                    </td>
                    {profile?.role === 'kelyn_admin' && (
                      <td className="px-4 py-3 text-left">
                        {user.client ? (
                          <div className="flex items-center gap-1 text-sm text-gray-600 text-left">
                            <Building2 className="h-4 w-4" />
                            {user.client.name}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500 text-left">-</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-left">
                      <div className="text-sm text-gray-600 text-left">
                        {new Date(user.created_at || '').toLocaleDateString('en-US', {
                          month: '2-digit',
                          day: '2-digit',
                          year: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <div className="flex gap-1">
                        {canEditUser(user) && (
                          <Tooltip content="Edit user details" side="top">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingUser(user)}
                              className="h-7 w-7 p-0 hover:bg-gray-100"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </Tooltip>
                        )}
                        {canReassignSteps(user) && (
                          <Tooltip content="Reassign steps to another user" side="top">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setReassignFromUser(user)}
                              className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <ArrowRightLeft className="h-3 w-3" />
                            </Button>
                          </Tooltip>
                        )}
                        {canDeleteUser(user) && (
                          <Tooltip content="Delete user permanently" side="top">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteUser(user.id)}
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editingUser && (
        <EditUserDialog
          user={editingUser as any}
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          onSuccess={() => {
            fetchUsers();
            setEditingUser(null);
          }}
        />
      )}

      {reassignFromUser && (
        <ReassignStepsDialog
          fromUser={reassignFromUser}
          users={users}
          currentUserProfile={profile}
          open={!!reassignFromUser}
          onOpenChange={(open) => !open && setReassignFromUser(null)}
          onSuccess={() => {
            setReassignFromUser(null);
            toast({
              title: "Success",
              description: "Steps reassigned successfully"
            });
          }}
        />
      )}
    </>
  );
}
