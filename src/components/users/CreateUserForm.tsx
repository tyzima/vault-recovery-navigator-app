import React, { useState, useEffect } from 'react';
import { fileClient } from '@/lib/fileClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAppBranding } from '@/hooks/useAppBranding';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { UserPlus, Users, Building2, Shield, User, AlertTriangle } from 'lucide-react';

type Client = {
  id: string;
  name: string;
  description?: string;
};

type UserRole = 'client_admin' | 'client_member' | 'kelyn_rep' | 'kelyn_admin';

type Profile = {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  client_id?: string;
};

export function CreateUserForm() {
  const { user } = useAuth();
  const { profile: currentProfile } = useProfile(user?.id);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: 'client_member' as UserRole,
    clientId: ''
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { branding } = useAppBranding();

  // Check if current user can create users
  const canCreateUsers = () => {
    if (!currentProfile) return false;
    return ['kelyn_admin', 'kelyn_rep', 'client_admin'].includes(currentProfile.role);
  };

  // Get available roles based on current user's role
  const getAvailableRoles = (): UserRole[] => {
    if (!currentProfile) return [];
    
    switch (currentProfile.role) {
      case 'kelyn_admin':
      case 'kelyn_rep':
        return ['kelyn_admin', 'kelyn_rep', 'client_admin', 'client_member'];
      case 'client_admin':
        return ['client_member'];
      default:
        return [];
    }
  };

  // Get available clients based on current user's role
  const getAvailableClients = (): Client[] => {
    if (!currentProfile) return [];
    
    switch (currentProfile.role) {
      case 'kelyn_admin':
      case 'kelyn_rep':
        return clients; // Can assign to any client
      case 'client_admin':
        // Can only assign to their own client
        return clients.filter(client => client.id === currentProfile.client_id);
      default:
        return [];
    }
  };

  useEffect(() => {
    if (canCreateUsers()) {
      fetchClients();
      
      // Set default values based on current user's role
      if (currentProfile?.role === 'client_admin') {
        setFormData(prev => ({
          ...prev,
          role: 'client_member',
          clientId: currentProfile.client_id || ''
        }));
      }
    }
  }, [currentProfile]);

  const fetchClients = async () => {
    const response = await fileClient
      .from('clients')
      .select('*')
      .execute();
    
    if (!response.error && response.data) {
      // Sort clients by name
      const sortedClients = response.data.sort((a, b) => a.name.localeCompare(b.name));
      setClients(sortedClients);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('Creating user with form data:', formData);

      // Validate passwords match
      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      // Validate permissions before creating user
      if (!canCreateUsers()) {
        throw new Error('You do not have permission to create users');
      }

      // Validate role restrictions
      const allowedRoles = getAvailableRoles();
      if (!allowedRoles.includes(formData.role)) {
        throw new Error('You do not have permission to create users with this role');
      }

      // Validate client restrictions for client_admin
      if (currentProfile?.role === 'client_admin') {
        if (formData.role !== 'client_member') {
          throw new Error('Client admins can only create client members');
        }
        if (formData.clientId !== currentProfile.client_id) {
          throw new Error('Client admins can only create users in their own team');
        }
      }
      
      // Convert empty string to null for client_id
      const clientId = formData.clientId === '' || formData.clientId === 'none' ? null : formData.clientId;
      
      const userId = crypto.randomUUID();
      
      // Create the user profile
      const profileResponse = await fileClient
        .from('profiles')
        .insert({
          id: userId,
          email: formData.email,
          first_name: formData.firstName,
          last_name: formData.lastName,
          role: formData.role,
          client_id: clientId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (profileResponse.error) {
        throw new Error(profileResponse.error.message);
      }

      // If it's a kelyn_rep, create org-wide assignment (no client_id needed)
      if (formData.role === 'kelyn_rep') {
        await fileClient
          .from('client_assignments')
          .insert({
            id: crypto.randomUUID(),
            kelyn_rep_id: userId,
            created_at: new Date().toISOString(),
          });
      }

      toast({
        title: "Success",
        description: "User created successfully"
      });

      // Reset form with appropriate defaults based on user role
      const resetFormData = {
        email: '',
        password: '',
        confirmPassword: '',
        firstName: '',
        lastName: '',
        role: 'client_member' as UserRole,
        clientId: currentProfile?.role === 'client_admin' ? (currentProfile.client_id || '') : ''
      };
      setFormData(resetFormData);
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const availableRoles = getAvailableRoles();
  const availableClients = getAvailableClients();

  // If user cannot create users, show access denied message
  if (!currentProfile) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!canCreateUsers()) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
            <div>
              <h3 className="text-lg font-medium">Access Restricted</h3>
              <p className="text-muted-foreground">
                You don't have permission to create users. Please contact your administrator.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const requiresClient = formData.role === 'client_admin' || formData.role === 'client_member';

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'kelyn_admin':
        return <Shield className="h-4 w-4" />;
      case 'kelyn_rep':
        return <Users className="h-4 w-4" />;
      case 'client_admin':
        return <Building2 className="h-4 w-4" />;
      case 'client_member':
        return <User className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  return (
    <Card className="max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <UserPlus className="h-5 w-5" />
          <span>Create New User</span>
        </CardTitle>
        <CardDescription className="hidden">
          Add a new user to the system with appropriate role and team assignment
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Personal & Account Information */}
            <div className="space-y-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 mb-3">
                  <User className="h-4 w-4 text-muted-foreground/50" />
                  <h3 className="text-sm font-medium text-foreground/50">Personal Information</h3>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 text-left">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        placeholder="Enter first name"
                        required
                      />
                    </div>
                    <div className="space-y-2 text-left">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        placeholder="Enter last name"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Information */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Shield className="h-4 w-4 text-muted-foreground/50" />
                  <h3 className="text-sm font-medium text-foreground/50">Account Information</h3>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2 text-left">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Enter email address"
                      required
                    />
                  </div>

                  <div className="space-y-2 text-left">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter password (minimum 6 characters)"
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="space-y-2 text-left">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="Re-enter password to confirm"
                      required
                      minLength={6}
                      className={formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword ? 'border-red-500' : ''}
                    />
                    {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                      <p className="text-sm text-red-600">Passwords do not match</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Role & Assignment */}
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Building2 className="h-4 w-4 text-muted-foreground/50" />
                  <h3 className="text-sm font-medium text-foreground/50">Role & Assignment</h3>
                </div>
                {currentProfile?.role === 'client_admin' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <div className="flex items-start space-x-2">
                      <Shield className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium">Team Admin Restrictions</p>
                        <p>As a Team Admin, you can only create Team Members within your assigned team.</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-2">
                      {availableRoles.includes('kelyn_admin') && (
                        <Button
                          type="button"
                          variant={formData.role === 'kelyn_admin' ? 'default' : 'outline'}
                          className="w-full justify-start h-auto p-4"
                          onClick={() => setFormData({ ...formData, role: 'kelyn_admin', clientId: '' })}
                        >
                          <div className="flex items-center space-x-3">
                            {getRoleIcon('kelyn_admin')}
                            <div className="text-left">
                              <div className="font-medium">Kelyn Admin</div>
                              <div className="text-sm text-muted-foreground">Full system access and management</div>
                            </div>
                          </div>
                        </Button>
                      )}
                      {availableRoles.includes('kelyn_rep') && (
                        <Button
                          type="button"
                          variant={formData.role === 'kelyn_rep' ? 'default' : 'outline'}
                          className="w-full justify-start h-auto p-4"
                          onClick={() => setFormData({ ...formData, role: 'kelyn_rep', clientId: '' })}
                        >
                          <div className="flex items-center space-x-3">
                            {getRoleIcon('kelyn_rep')}
                            <div className="text-left">
                              <div className="font-medium">Kelyn Rep</div>
                              <div className="text-sm text-muted-foreground">Client relationship management</div>
                            </div>
                          </div>
                        </Button>
                      )}
                      {availableRoles.includes('client_admin') && (
                        <Button
                          type="button"
                          variant={formData.role === 'client_admin' ? 'default' : 'outline'}
                          className="w-full justify-start h-auto p-4"
                          onClick={() => setFormData({ ...formData, role: 'client_admin', clientId: '' })}
                        >
                          <div className="flex items-center space-x-3">
                            {getRoleIcon('client_admin')}
                            <div className="text-left">
                              <div className="font-medium">Team Admin</div>
                              <div className="text-sm text-muted-foreground">Manage team members and settings</div>
                            </div>
                          </div>
                        </Button>
                      )}
                      {availableRoles.includes('client_member') && (
                        <Button
                          type="button"
                          variant={formData.role === 'client_member' ? 'default' : 'outline'}
                          className="w-full justify-start h-auto p-4"
                          onClick={() => setFormData({ ...formData, role: 'client_member', clientId: '' })}
                        >
                          <div className="flex items-center space-x-3">
                            {getRoleIcon('client_member')}
                            <div className="text-left">
                              <div className="font-medium">Team Member</div>
                              <div className="text-sm text-muted-foreground">Standard team access</div>
                            </div>
                          </div>
                        </Button>
                      )}
                    </div>
                  </div>

                  {(requiresClient || formData.role === 'kelyn_rep') && (
                    <div className="space-y-2">
                      <Label htmlFor="client">
                        {requiresClient ? 'Team (Required)' : 'Team (Optional)'}
                      </Label>
                      <Select
                        value={formData.clientId}
                        onValueChange={(value) => setFormData({ ...formData, clientId: value })}
                        required={requiresClient}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a team..." />
                        </SelectTrigger>
                        <SelectContent>
                          {!requiresClient && (
                            <SelectItem value="none">
                              <div className="flex items-center space-x-2">
                                <User className="h-4 w-4" />
                                <span>No team assignment</span>
                              </div>
                            </SelectItem>
                          )}
                          {availableClients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              <div className="flex items-center space-x-2">
                                <Building2 className="h-4 w-4" />
                                <span>{client.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button 
              type="submit" 
              disabled={loading} 
              className="text-white px-8"
              style={{
                backgroundColor: branding?.primary_color || '#84cc16', // fallback to lime-500
                ...(branding?.primary_color && {
                  '--tw-bg-opacity': '1',
                  ':hover': {
                    backgroundColor: branding.primary_color,
                    filter: 'brightness(0.9)'
                  }
                })
              }}
              onMouseEnter={(e) => {
                if (branding?.primary_color) {
                  e.currentTarget.style.filter = 'brightness(0.9)';
                }
              }}
              onMouseLeave={(e) => {
                if (branding?.primary_color) {
                  e.currentTarget.style.filter = 'brightness(1)';
                }
              }}
            >
              {loading ? 'Creating User...' : 'Create User'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
