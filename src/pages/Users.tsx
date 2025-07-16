
import React from 'react';
import { UsersList } from '@/components/users/UsersList';
import { CreateUserForm } from '@/components/users/CreateUserForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

export function Users() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);

  // Get the appropriate title based on user role
  const getTitle = () => {
    if (profile?.role === 'client_admin') {
      return 'Team Members';
    }
    return 'All Users';
  };

  const getDescription = () => {
    if (profile?.role === 'client_admin') {
      return 'Manage your organization\'s team members';
    }
    return '';
  };

  const getCreateTitle = () => {
    if (profile?.role === 'client_admin') {
      return 'Add Team Member';
    }
    return 'Create New User';
  };

  return (
    <Tabs defaultValue="list" className="space-y-6 max-w-7xl mx-auto">
      <TabsList>
        <TabsTrigger value="list">{getTitle()}</TabsTrigger>
        <TabsTrigger value="create">{profile?.role === 'client_admin' ? 'Add Member' : 'Create User'}</TabsTrigger>
      </TabsList>

      <TabsContent value="list">
        <Card className="border-none">
          <CardHeader className="hidden">
            <CardTitle className="hidden">Users</CardTitle>
            <CardDescription>
              {getDescription()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UsersList />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="create">
        <Card className="border-none">
          <CardHeader className="hidden">
            <CardTitle className=" items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {getCreateTitle()}
            </CardTitle>
            <CardDescription>
              {profile?.role === 'client_admin' 
                ? 'Add a new team member to your organization'
                : ''
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateUserForm />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
