import React, { useState, useEffect } from 'react';
import { fileClient } from '@/lib/fileClient';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Building2, Shield, Users } from 'lucide-react';

type Profile = {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  client_id?: string;
  client?: {
    name: string;
  };
};

interface UserSelectorProps {
  clientId?: string; // Made optional since we're now showing all users
  value?: string;
  onValueChange: (value: string | undefined) => void;
  placeholder?: string;
}

export function UserSelector({ clientId, value, onValueChange, placeholder = "Select user..." }: UserSelectorProps) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllUsers();
  }, []);

  const fetchAllUsers = async () => {
    try {
      // Fetch all users in the organization
      const profilesResult = await fileClient
        .from('profiles')
        .select('*')
        .execute();

      if (profilesResult.error) {
        console.error('Error fetching users:', profilesResult.error);
        setUsers([]);
      } else {
        // Fetch all clients to join with profiles
        const clientsResult = await fileClient
          .from('clients')
          .select('*')
          .execute();
        
        if (clientsResult.error) {
          console.error('Error fetching clients:', clientsResult.error);
        }
        
        const clients = clientsResult.data || [];
        
        // Join profiles with clients
        const usersWithClients = (profilesResult.data || []).map(profile => {
          const client = clients.find(c => c.id === profile.client_id);
          return {
            ...profile,
            client: client ? { name: client.name } : null
          };
        });

        // Sort by role hierarchy first, then by first name
        const sortedUsers = usersWithClients.sort((a, b) => {
          // Role hierarchy for sorting
          const roleOrder: Record<string, number> = {
            'kelyn_admin': 1,
            'kelyn_rep': 2,
            'client_admin': 3,
            'client_member': 4
          };
          
          const aOrder = roleOrder[a.role] || 5;
          const bOrder = roleOrder[b.role] || 5;
          
          if (aOrder !== bOrder) {
            return aOrder - bOrder;
          }
          
          // Within same role, sort by first name
          return (a.first_name || '').localeCompare(b.first_name || '');
        });
        
        setUsers(sortedUsers);
      }
    } catch (error) {
      console.error('Error fetching all users:', error);
      setUsers([]);
    }
    setLoading(false);
  };

  const handleValueChange = (selectedValue: string) => {
    if (selectedValue === 'unassigned') {
      onValueChange(undefined);
    } else {
      onValueChange(selectedValue);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'kelyn_admin':
        return <Shield className="h-4 w-4 mr-2 text-red-600 flex-shrink-0" />;
      case 'kelyn_rep':
        return <Users className="h-4 w-4 mr-2 text-blue-600 flex-shrink-0" />;
      case 'client_admin':
        return <Building2 className="h-4 w-4 mr-2 text-green-600 flex-shrink-0" />;
      case 'client_member':
        return <User className="h-4 w-4 mr-2 text-gray-600 flex-shrink-0" />;
      default:
        return <User className="h-4 w-4 mr-2 text-gray-600 flex-shrink-0" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'kelyn_admin':
        return 'Kelyn Admin';
      case 'kelyn_rep':
        return 'Kelyn Rep';
      case 'client_admin':
        return 'Team Admin';
      case 'client_member':
        return 'Team Member';
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Loading users..." />
        </SelectTrigger>
      </Select>
    );
  }

  // Get selected user for display
  const selectedUser = users.find(user => user.id === value);
  const displayValue = selectedUser 
    ? `${selectedUser.first_name} ${selectedUser.last_name}`.trim()
    : value === undefined ? "Unassigned" : placeholder;

  return (
    <Select value={value || "unassigned"} onValueChange={handleValueChange}>
      <SelectTrigger className="h-9">
        <SelectValue placeholder={placeholder}>
          <div className="flex items-center min-w-0">
            {!value || value === "unassigned" ? (
              <>
                <User className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                <span className="truncate">Unassigned</span>
              </>
            ) : selectedUser ? (
              <>
                {getRoleIcon(selectedUser.role)}
                <span className="truncate">
                  {`${selectedUser.first_name} ${selectedUser.last_name}`.trim()}
                </span>
              </>
            ) : (
              <span className="truncate">{placeholder}</span>
            )}
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-64">
        <SelectItem value="unassigned">
          <div className="flex items-center">
            <User className="h-4 w-4 mr-2 text-gray-400" />
            Unassigned
          </div>
        </SelectItem>
        {users.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                {getRoleIcon(user.role)}
                <span className="font-medium">
                  {user.first_name} {user.last_name}
                </span>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-muted-foreground">
                  {getRoleLabel(user.role)}
                </span>
                {user.client && (
                  <span className="text-xs text-muted-foreground bg-gray-100 px-1.5 py-0.5 rounded">
                    {user.client.name}
                  </span>
                )}
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
