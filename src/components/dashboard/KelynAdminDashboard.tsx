import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, BookOpen, Users, Plus, Clock, ArrowRight } from 'lucide-react';
import { fileClient } from '@/lib/fileClient';
import { useNavigate } from 'react-router-dom';
import { useAppBranding } from '@/hooks/useAppBranding';

interface RecentRunbook {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  step_count: number;
  client?: {
    name: string;
  };
}

export function KelynAdminDashboard() {
  const navigate = useNavigate();
  const { branding } = useAppBranding();
  const [stats, setStats] = useState({
    totalClients: 0,
    totalRunbooks: 0,
    activeUsers: 0
  });
  const [recentRunbooks, setRecentRunbooks] = useState<RecentRunbook[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch all data in parallel
        const [clientsResponse, runbooksResponse, profilesResponse, stepsResponse] = await Promise.all([
          fileClient.from('clients').select('*').execute(),
          fileClient.from('runbooks').select('*').execute(),
          fileClient.from('profiles').select('*').execute(),
          fileClient.from('runbook_steps').select('*').execute()
        ]);

        const clients = clientsResponse.data || [];
        const runbooks = runbooksResponse.data || [];
        const steps = stepsResponse.data || [];

        setStats({
          totalClients: clients.length,
          totalRunbooks: runbooks.length,
          activeUsers: profilesResponse.data?.length || 0
        });

        // Process recent runbooks with step counts and client info
        const runbooksWithDetails = runbooks.map((rb: any) => {
          const stepCount = steps.filter((step: any) => step.runbook_id === rb.id).length;
          const client = clients.find((c: any) => c.id === rb.client_id);
          
          return {
            id: rb.id,
            title: rb.title,
            description: rb.description,
            created_at: rb.created_at,
            step_count: stepCount,
            client: client ? { name: client.name } : undefined,
          };
        });

        // Sort by created_at descending and take first 3
        const recentRunbooksData = runbooksWithDetails
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 2);

        setRecentRunbooks(recentRunbooksData);
      } catch (error) {
        console.error('Error fetching admin dashboard stats:', error);
      }
    };
    
    fetchStats();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClients}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalClients === 0 ? 'No clients created yet' : 'Active clients'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Runbooks</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRunbooks}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalRunbooks === 0 ? 'No runbooks created yet' : 'Active runbooks'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              Registered users
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="border-none shadow-none">
      <CardHeader>
            <CardTitle className="text-left">Quick Actions</CardTitle>
            <CardDescription className="text-left pt-2">
              Create and manage platform resources
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              style={{
                backgroundColor: branding?.primary_color || '#84cc16',
                borderColor: branding?.primary_color || '#84cc16'
              }}
              className="w-full h-14 justify-start text-white hover:opacity-90 transition-opacity" 
              onClick={() => navigate('/clients', { state: { autoOpenCreateModal: true } })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Team
            </Button>
            <Button variant="outline" className="w-full h-14 justify-start" onClick={() => navigate('/runbooks', { state: { autoOpenCreateModal: true } })}>
              <BookOpen className="mr-2 h-4 w-4" />
              Create New Runbook
            </Button>
            <Button variant="outline" className="w-full h-14 justify-start" onClick={() => navigate('/users')}>
              <Users className="mr-2 h-4 w-4" />
              Manage Users
            </Button>
          </CardContent>
        </Card>

        <Card className="border-none shadow-none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-left">Recent Runbooks</CardTitle>
                <CardDescription className="pt-3">
                  Latest runbooks created across all teams
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/runbooks')}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentRunbooks.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No runbooks created yet</p>
                <p className="text-xs mt-1">Runbooks will appear here when they're created</p>
              </div>
            ) : (
              recentRunbooks.map((runbook) => (
                <Card
                  key={runbook.id}
                  className="p-3 hover:shadow-md transition-shadow cursor-pointer border border-gray-100"
                  onClick={() => navigate(`/runbooks/${runbook.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-left text-gray-900 mb-1 text-sm">{runbook.title}</h4>
                      {runbook.description && (
                        <p className="text-xs text-muted-foreground text-left line-clamp-2 mb-2">{runbook.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {runbook.client?.name || 'Unknown Team'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {runbook.step_count} steps
                        </span>
                        <span>Created {new Date(runbook.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
