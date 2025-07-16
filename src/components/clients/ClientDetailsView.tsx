import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fileClient } from '@/lib/fileClient';
// Database import removed - using local types
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Edit, Save, X, Building2, Mail, Phone, MapPin, Calendar, Clock, BookOpen, Users, User, Download, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { generateRunbookPDF } from '@/utils/pdfGenerator';
import { useAppBranding } from '@/hooks/useAppBranding';
import { getClientLogoUrl, getRelativeFileUrl } from '@/utils/urlUtils';
import { ClientLogoUpload } from './ClientLogoUpload';
import { ClientLogo } from './ClientLogo';
import { Client, Runbook, Profile } from '@/lib/database';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ClientDetailsViewProps {
  clientId: string;
}

export function ClientDetailsView({
  clientId
}: ClientDetailsViewProps) {
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const {
    profile
  } = useProfile(user?.id);
  const { branding } = useAppBranding();
  const [client, setClient] = useState<Client | null>(null);
  const [runbooks, setRunbooks] = useState<Runbook[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [runbooksLoading, setRunbooksLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [availableUsersLoading, setAvailableUsersLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [addingUser, setAddingUser] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    contact_email: '',
    contact_phone: '',
    address: ''
  });
  const {
    toast
  } = useToast();
  const canEdit = () => {
    if (!profile) return false;
    
    // Kelyn Admin and Kelyn Rep can always edit
    if (profile.role === 'kelyn_admin' || profile.role === 'kelyn_rep') {
      return true;
    }
    
    // Client Admin can edit only if the client matches their assigned client
    if (profile.role === 'client_admin') {
      return client && profile.client_id === client.id;
    }
    
    return false;
  };

  const canDelete = () => {
    if (!profile) return false;
    
    // Only Kelyn Admin and Kelyn Rep can delete
    return profile.role === 'kelyn_admin' || profile.role === 'kelyn_rep';
  };
  useEffect(() => {
    fetchClient();
    fetchClientRunbooks();
    fetchClientUsers();
  }, [clientId]);

  // Separate effect for fetchAvailableUsers that depends on profile being loaded
  useEffect(() => {
    if (profile !== null) { // Wait for profile to be loaded (could be null or a profile object)
      fetchAvailableUsers();
    }
  }, [clientId, profile]);
  const fetchClient = async () => {
    try {
      const clientResponse = await fileClient.from('clients').select('*').eq('id', clientId);
      const clientData = clientResponse.data?.[0];
      
      if (!clientData) {
        toast({
          title: "Error",
          description: "Team not found",
          variant: "destructive"
        });
        return;
      }
      
      setClient(clientData);
      setFormData({
        name: clientData.name || '',
        description: clientData.description || '',
        contact_email: clientData.contact_email || '',
        contact_phone: clientData.contact_phone || '',
        address: clientData.address || ''
      });
    } catch (error) {
      console.error('Error fetching client:', error);
      toast({
        title: "Error",
        description: "Failed to load team details",
        variant: "destructive"
      });
    }
    setLoading(false);
  };
  const fetchClientRunbooks = async () => {
    try {
      // Fetch runbooks for this client
      const runbooksResponse = await fileClient.from('runbooks').select('*').eq('client_id', clientId);
      const runbooksData = runbooksResponse.data || [];
      
      // Fetch creators for the runbooks
      const creatorIds = runbooksData.map(r => r.created_by).filter(Boolean);
      const profilesResponse = creatorIds.length > 0 ? await fileClient.from('profiles').select('*').in('id', creatorIds) : { data: [] };
      const profilesData = profilesResponse.data || [];
      
      // Transform runbooks with creator data
      const transformedRunbooks = runbooksData.map(runbook => {
        const creator = runbook.created_by ? profilesData.find(p => p.id === runbook.created_by) : null;
        return {
          ...runbook,
          creator: creator ? {
            first_name: creator.first_name,
            last_name: creator.last_name
          } : null
        };
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setRunbooks(transformedRunbooks);
    } catch (error) {
      console.error('Error fetching client runbooks:', error);
    }
    setRunbooksLoading(false);
  };
  const fetchClientUsers = async () => {
    try {
      const usersResponse = await fileClient.from('profiles').select('*').eq('client_id', clientId);
      const usersData = usersResponse.data || [];
      
      // Sort by first name
      usersData.sort((a, b) => (a.first_name || '').localeCompare(b.first_name || ''));
      
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching client users:', error);
    }
    setUsersLoading(false);
  };

  const fetchAvailableUsers = async () => {
    setAvailableUsersLoading(true);
    
    console.log('fetchAvailableUsers called', { profile, canEdit: canEdit() });
    
    if (!profile || !canEdit()) {
      console.log('Not fetching available users: profile or canEdit failed');
      setAvailableUsers([]);
      setAvailableUsersLoading(false);
      return;
    }

    try {
      // Fetch all users not assigned to this team
      const allUsersResponse = await fileClient.from('profiles').select('*').execute();
      const allUsers = allUsersResponse.data || [];
      
      console.log('All users fetched:', allUsers.length);
      
      // Filter users based on permissions and current team assignment
      let filteredUsers = allUsers.filter(user => {
        // Don't show users already assigned to this team
        if (user.client_id === clientId) return false;
        
        // Permission-based filtering
        if (!profile) return false;
        
        if (profile.role === 'kelyn_admin' || profile.role === 'kelyn_rep') {
          // Kelyn admin/rep can add any user
          return true;
        } else if (profile.role === 'client_admin') {
          // Client admin can only add users not assigned to any team (client_id is null)
          return user.client_id === null || user.client_id === undefined;
        }
        
        return false;
      });
      
      console.log('Filtered users:', filteredUsers.length);
      
      // Sort by first name, then email
      filteredUsers.sort((a, b) => {
        const aName = a.first_name && a.last_name ? `${a.first_name} ${a.last_name}` : a.email;
        const bName = b.first_name && b.last_name ? `${b.first_name} ${b.last_name}` : b.email;
        return aName.localeCompare(bName);
      });
      
      setAvailableUsers(filteredUsers);
    } catch (error) {
      console.error('Error fetching available users:', error);
      setAvailableUsers([]);
    }
    setAvailableUsersLoading(false);
  };

  const handleAddUser = async () => {
    if (!selectedUserId || !client) return;
    
    setAddingUser(true);
    try {
      // Update the user's client_id to assign them to this team
      const result = await fileClient.from('profiles').update({
        client_id: clientId,
        updated_at: new Date().toISOString()
      }).eq('id', selectedUserId);
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      // Get the selected user to provide more informative feedback
      const selectedUser = availableUsers.find(u => u.id === selectedUserId);
      const wasReassigned = selectedUser?.client_id;
      
      toast({
        title: "Success",
        description: wasReassigned 
          ? "User reassigned to this team successfully" 
          : "User added to team successfully"
      });
      
      // Reset selection and refresh data
      setSelectedUserId('');
      fetchClientUsers();
      fetchAvailableUsers();
    } catch (error) {
      console.error('Error adding user to team:', error);
      toast({
        title: "Error",
        description: "Failed to add user to team",
        variant: "destructive"
      });
    }
    setAddingUser(false);
  };

  const handleSave = async () => {
    console.log('ClientDetailsView: handleSave called with formData:', formData);
    setSaving(true);
    try {
      console.log('ClientDetailsView: calling fileClient.update with clientId:', clientId);
      const result = await fileClient.from('clients').update({
        name: formData.name,
        description: formData.description,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone,
        address: formData.address,
        updated_at: new Date().toISOString()
      }).eq('id', clientId);
      
      console.log('ClientDetailsView: update result:', result);
      
      toast({
        title: "Success",
        description: "Team updated successfully"
      });
      setEditing(false);
      fetchClient();
    } catch (error) {
      console.error('ClientDetailsView: Error updating client:', error);
      toast({
        title: "Error",
        description: "Failed to update team",
        variant: "destructive"
      });
    }
    setSaving(false);
  };
  const handleCancel = () => {
    setEditing(false);
    if (client) {
      setFormData({
        name: client.name || '',
        description: client.description || '',
        contact_email: client.contact_email || '',
        contact_phone: client.contact_phone || '',
        address: client.address || ''
      });
    }
  };
  const handleRunbookClick = (runbookId: string) => {
    navigate(`/runbooks/${runbookId}`);
  };
  const handleDownloadPDF = async (runbook: Runbook) => {
    try {
      // Fetch the full runbook details with steps
      const runbookResponse = await fileClient.from('runbooks').select('*').eq('id', runbook.id);
      const runbookDetails = runbookResponse.data?.[0];
      
      if (!runbookDetails) {
        throw new Error('Runbook not found');
      }

      // Fetch related data
      const [clientResponse, creatorResponse, stepsResponse] = await Promise.all([
        fileClient.from('clients').select('*').eq('id', runbookDetails.client_id),
        runbookDetails.created_by ? fileClient.from('profiles').select('*').eq('id', runbookDetails.created_by) : { data: [] },
        fileClient.from('runbook_steps').select('*').eq('runbook_id', runbook.id)
      ]);

      const clientData = clientResponse.data?.[0];
      const creatorData = creatorResponse.data?.[0];
      const stepsData = stepsResponse.data || [];

      // Fetch assigned users for steps
      const assignedUserIds = stepsData.filter(s => s.assigned_to).map(s => s.assigned_to);
      const assignedUsersResponse = assignedUserIds.length > 0 ? await fileClient.from('profiles').select('*').in('id', assignedUserIds) : { data: [] };
      const assignedUsersData = assignedUsersResponse.data || [];

      // Transform the data to match the PDF generator interface
      const pdfData = {
        id: runbookDetails.id,
        title: runbookDetails.title,
        description: runbookDetails.description,
        client: clientData ? { name: clientData.name } : null,
        created_by_profile: creatorData ? {
          first_name: creatorData.first_name,
          last_name: creatorData.last_name
        } : null,
        created_at: runbookDetails.created_at,
        updated_at: runbookDetails.updated_at,
        steps: stepsData.map((step: any) => {
          const assignedUser = step.assigned_to ? assignedUsersData.find(u => u.id === step.assigned_to) : null;
          return {
            id: step.id,
            title: step.title,
            description: step.description,
            step_order: step.step_order,
            estimated_duration_minutes: step.estimated_duration_minutes,
            assigned_user: assignedUser ? {
              first_name: assignedUser.first_name,
              last_name: assignedUser.last_name
            } : null,
            photo_url: step.photo_url,
            tasks: step.tasks || []
          };
        }).sort((a, b) => a.step_order - b.step_order)
      };
      
      generateRunbookPDF(pdfData, branding?.primary_color, branding?.app_logo_url);
      toast({
        title: "Success",
        description: "PDF download started"
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive"
      });
    }
  };
  const handleLogoUpdated = (logoUrl: string | null) => {
    if (client) {
      // Store the relative URL in the client state (this matches what's in the database)
      const relativeUrl = getRelativeFileUrl(logoUrl);
      setClient({ ...client, logo_url: relativeUrl });
    }
  };

  const deleteClient = async () => {
    try {
      await fileClient.from('clients').delete().eq('id', clientId);
      toast({
        title: "Success",
        description: "Team deleted successfully"
      });
      navigate('/clients');
    } catch (error) {
      console.error('Error deleting client:', error);
      toast({
        title: "Error",
        description: "Failed to delete team",
        variant: "destructive"
      });
    }
    // Reset confirmation text after deletion attempt
    setDeleteConfirmText('');
  };

  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (!open) {
      setDeleteConfirmText('');
    }
  };
  if (loading) {
    return <div className="flex items-center justify-center min-h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>;
  }
  if (!client) {
    return <div className="text-left py-12">
        <Building2 className="h-8 w-8 text-muted-foreground mb-3" />
        <h3 className="text-base font-medium text-left">Team not found</h3>
        <p className="text-sm text-muted-foreground text-left">The requested team could not be found.</p>
      </div>;
  }
  return <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start space-x-3">
          <ClientLogo logoUrl={getClientLogoUrl(client.logo_url)} clientName={client.name} size="lg" />
          <div>
            <h1 className="text-xl font-semibold text-left">{editing ? 'Edit Team' : client.name}</h1>
            <p className="text-sm text-muted-foreground text-left mt-1">
              {editing ? 'Update team information' : 'Team details and information'}
            </p>
          </div>
        </div>
        {canEdit() && <div className="flex space-x-2">
            {editing ? <>
                <Button onClick={handleSave} disabled={saving} size="sm" className="bg-lime-500 hover:bg-lime-600">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save
                </Button>
                <Button onClick={handleCancel} variant="outline" size="sm" disabled={saving}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </> : <>
                <Button onClick={() => setEditing(true)} variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                {canDelete() && (
                  <AlertDialog onOpenChange={handleDeleteDialogOpenChange}>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the team "{client?.name}" 
                          and remove all associated data from our servers.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="my-4">
                        <Label htmlFor="delete-confirm" className="text-sm font-medium">
                          Please type <span className="font-mono font-bold">{client?.name}</span> to confirm:
                        </Label>
                        <Input
                          id="delete-confirm"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder="Enter team name"
                          className="mt-2"
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={deleteClient} 
                          disabled={deleteConfirmText !== client?.name}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Delete Team
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </>}
          </div>}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        
        {/* Basic Information Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-left flex items-center gap-2 text-sm font-medium">
              <Building2 className="h-4 w-4" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ClientLogoUpload
              clientId={clientId}
              currentLogoUrl={getClientLogoUrl(client.logo_url)}
              onLogoUpdated={handleLogoUpdated}
              canEdit={canEdit()}
            />

            <div>
              <Label htmlFor="name" className="text-left block mb-1 text-xs text-muted-foreground">Team Name</Label>
              {editing ? <Input id="name" value={formData.name} onChange={e => setFormData({
              ...formData,
              name: e.target.value
            })} placeholder="Enter team name" className="text-left text-sm" /> : <p className="text-left text-sm">{client.name}</p>}
            </div>

            <div>
              <Label className="text-left block mb-1 text-xs text-muted-foreground">Description</Label>
              {editing ? <Textarea value={formData.description} onChange={e => setFormData({
              ...formData,
              description: e.target.value
            })} placeholder="Enter team description" rows={3} className="text-left text-sm" /> : <p className="text-left text-xs text-muted-foreground whitespace-pre-wrap">
                  {client.description || 'No description provided'}
                </p>}
            </div>
          </CardContent>
        </Card>

        {/* Contact Information Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-left flex items-center gap-2 text-sm font-medium">
              <Mail className="h-4 w-4" />
              Contact & Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="contact_email" className="text-left flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" />
                Email Address
              </Label>
              {editing ? <Input id="contact_email" type="email" value={formData.contact_email} onChange={e => setFormData({
              ...formData,
              contact_email: e.target.value
            })} placeholder="Enter contact email" className="text-left text-sm" /> : <p className="text-left text-sm">{client.contact_email || 'Not provided'}</p>}
            </div>

            <div>
              <Label htmlFor="contact_phone" className="text-left flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                Phone Number
              </Label>
              {editing ? <Input id="contact_phone" value={formData.contact_phone} onChange={e => setFormData({
              ...formData,
              contact_phone: e.target.value
            })} placeholder="Enter contact phone" className="text-left text-sm" /> : <p className="text-left text-sm">{client.contact_phone || 'Not provided'}</p>}
            </div>

            <div>
              <Label htmlFor="address" className="text-left flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                Address
              </Label>
              {editing ? <Textarea id="address" value={formData.address} onChange={e => setFormData({
              ...formData,
              address: e.target.value
            })} placeholder="Enter team address" rows={2} className="text-left text-sm" /> : <p className="text-left text-xs text-muted-foreground whitespace-pre-wrap">
                  {client.address || 'Not provided'}
                </p>}
            </div>

            <div className="pt-3 border-t space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground text-left">Created:</span>
                <span className="text-muted-foreground text-left">
                  {new Date(client.created_at || '').toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground text-left">Last Updated:</span>
                <span className="text-muted-foreground text-left">
                  {new Date(client.updated_at || '').toLocaleDateString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Runbooks Section - moved here */}
        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-left flex items-center gap-2 text-sm font-medium">
              <BookOpen className="h-4 w-4" />
              Team Runbooks ({runbooks.length})
            </CardTitle>
            <CardDescription className="text-left text-xs">
              Runbooks assigned to this team
            </CardDescription>
          </CardHeader>
          <CardContent>
            {runbooksLoading ? <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div> : runbooks.length === 0 ? <div className="text-center py-8">
                <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-xs">No runbooks assigned to this team</p>
              </div> : <div className="space-y-2">
                {runbooks.slice(0, 3).map(runbook => <div key={runbook.id} className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-left truncate">{runbook.title}</p>
                      <p className="text-xs text-muted-foreground text-left truncate">
                        {runbook.description || 'No description'}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleRunbookClick(runbook.id)} className="text-xs px-2 py-1 h-auto">
                        View
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDownloadPDF(runbook)} className="text-xs px-2 py-1 h-auto">
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>)}
                {runbooks.length > 3 && <p className="text-xs text-muted-foreground text-center mt-2">
                    +{runbooks.length - 3} more runbooks
                  </p>}
              </div>}
          </CardContent>
        </Card>
      </div>



      {/* Full Runbooks Section */}
      

      {/* Users Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-left flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4" />
                Team Users ({users.length})
              </CardTitle>
              <CardDescription className="text-left text-xs">
                Users assigned to this team
              </CardDescription>
            </div>
            {canEdit() && availableUsers.length > 0 && (
              <div className="flex items-center gap-2">
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                  disabled={addingUser}
                >
                  <SelectTrigger className="w-48 h-8 text-xs">
                    <SelectValue placeholder="Select user to add..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map(user => {
                      const displayName = user.first_name && user.last_name 
                        ? `${user.first_name} ${user.last_name}` 
                        : user.email;
                      const isReassignment = user.client_id;
                      
                      return (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center gap-2 w-full">
                            <User className="h-3 w-3 flex-shrink-0" />
                            <span className="font-medium text-xs truncate flex-1">
                              {displayName}
                            </span>
                            {isReassignment && (
                              <span className="text-xs text-orange-600 flex-shrink-0">
                                (Reassign)
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAddUser}
                  disabled={!selectedUserId || addingUser}
                  size="sm"
                  className="h-8 px-3 text-xs"
                >
                  {addingUser ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    'Add User'
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {usersLoading ? <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div> : users.length === 0 ? <div className="text-center py-8">
              <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No users assigned to this team</p>
            </div> : <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Name</TableHead>
                  <TableHead className="text-left">Email</TableHead>
                  <TableHead className="text-left">Role</TableHead>
                  <TableHead className="text-left">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => <TableRow key={user.id}>
                    <TableCell className="text-left">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-left text-sm text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell className="text-left">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {user.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </TableCell>
                    <TableCell className="text-left text-sm">
                      {new Date(user.created_at || '').toLocaleDateString()}
                    </TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>}
        </CardContent>
      </Card>
    </div>;
}
