import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, BookOpen, Users, Plus } from 'lucide-react';
import { fileClient } from '@/lib/fileClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAppBranding } from '@/hooks/useAppBranding';

export function KelynRepDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { branding } = useAppBranding();
  const [stats, setStats] = useState({
    myClients: 0,
    activeRunbooks: 0,
    clientUsers: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        // Fetch all data in parallel
        const [clientsResponse, runbooksResponse, profilesResponse, assignmentsResponse] = await Promise.all([
          fileClient.from('clients').select('*').execute(),
          fileClient.from('runbooks').select('*').execute(),
          fileClient.from('profiles').select('*').execute(),
          fileClient.from('client_assignments').select('*').execute()
        ]);

        // For reps, show clients assigned to them
        const myAssignments = assignmentsResponse.data?.filter((ca: any) => ca.kelyn_rep_id === user.id) || [];
        const myClientCount = myAssignments.length;

        // If no assignments, show all clients for now (backwards compatibility)
        const clientCount = myClientCount > 0 ? myClientCount : (clientsResponse.data?.length || 0);

        // Count runbooks (all runbooks for now)
        const runbookCount = runbooksResponse.data?.length || 0;

        // Count client users (client_admin and client_member roles)
        const clientUsers = profilesResponse.data?.filter((p: any) => 
          p.role === 'client_admin' || p.role === 'client_member'
        ) || [];

        setStats({
          myClients: clientCount,
          activeRunbooks: runbookCount,
          clientUsers: clientUsers.length,
        });
      } catch (error) {
        console.error('Error fetching rep dashboard stats:', error);
      }
    };

    fetchStats();
  }, [user]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Teams</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.myClients}</div>
            <p className="text-xs text-muted-foreground">
              {stats.myClients === 0 ? 'No clients assigned yet' : 'Assigned clients'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Runbooks</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeRunbooks}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeRunbooks === 0 ? 'No runbooks created yet' : 'Created runbooks'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clientUsers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.clientUsers === 0 ? 'No team users to manage' : 'Active team users'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-none">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Manage your clients and runbooks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              style={{
                backgroundColor: branding?.primary_color || '#84cc16',
                borderColor: branding?.primary_color || '#84cc16'
              }}
              className="w-full justify-start text-white hover:opacity-90 transition-opacity"
              onClick={() => navigate('/clients', { state: { autoOpenCreateModal: true } })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Team Portal
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/runbooks', { state: { autoOpenCreateModal: true } })}
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Create Runbook
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/clients')}
            >
              <Building2 className="mr-2 h-4 w-4" />
              View My Clients
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My Teams</CardTitle>
            <CardDescription>
              Your assigned team portals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p>{stats.myClients === 0 ? 'No clients assigned yet' : `Managing ${stats.myClients} clients`}</p>
              <p className="text-sm mt-2">
                {stats.myClients === 0 ? 'Clients will appear here when they are assigned to you' : 'Click "View My Clients" to see details'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
