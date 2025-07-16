import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Play, Clock, CheckCircle, User, Building2, Calendar, ArrowRight, Mail, Phone } from 'lucide-react';
import { fileClient } from '@/lib/fileClient';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useNavigate } from 'react-router-dom';

interface RunbookPreview {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  step_count: number;
}

interface ExecutionPreview {
  id: string;
  title: string;
  status: string;
  progress: number;
  started_at: string;
  runbook_title: string;
}

interface RepInfo {
  first_name: string;
  last_name: string;
  email: string;
}

export function ClientDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const [stats, setStats] = useState({
    availableRunbooks: 0,
    activeExecutions: 0,
    completedExecutions: 0,
  });
  const [recentRunbooks, setRecentRunbooks] = useState<RunbookPreview[]>([]);
  const [recentExecutions, setRecentExecutions] = useState<ExecutionPreview[]>([]);
  const [assignedRep, setAssignedRep] = useState<RepInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.client_id) {
      fetchDashboardData();
    }
  }, [profile]);

  const fetchDashboardData = async () => {
    if (!profile?.client_id) return;

    try {
      // Fetch all data in parallel
      const [runbooksResponse, executionsResponse, stepsResponse, stepAssignmentsResponse, assignmentsResponse, profilesResponse] = await Promise.all([
        fileClient.from('runbooks').select('*').execute(),
        fileClient.from('runbook_executions').select('*').execute(),
        fileClient.from('runbook_steps').select('*').execute(),
        fileClient.from('execution_step_assignments').select('*').execute(),
        fileClient.from('client_assignments').select('*').execute(),
        fileClient.from('profiles').select('*').execute()
      ]);

      // Filter runbooks for this client
      const clientRunbooks = runbooksResponse.data?.filter((rb: any) => rb.client_id === profile.client_id) || [];
      
      // Filter executions for this client
      const clientExecutions = executionsResponse.data?.filter((ex: any) => ex.client_id === profile.client_id) || [];
      
      // Count stats
      const activeExecutions = clientExecutions.filter((ex: any) => ex.status === 'active');
      const completedExecutions = clientExecutions.filter((ex: any) => ex.status === 'completed');

      setStats({
        availableRunbooks: clientRunbooks.length,
        activeExecutions: activeExecutions.length,
        completedExecutions: completedExecutions.length,
      });

      // Process recent runbooks with step counts
      const runbooksWithSteps = clientRunbooks.map((rb: any) => {
        const stepCount = stepsResponse.data?.filter((step: any) => step.runbook_id === rb.id).length || 0;
        return {
          id: rb.id,
          title: rb.title,
          description: rb.description,
          created_at: rb.created_at,
          step_count: stepCount,
        };
      });

      // Sort by created_at descending and take first 3
      const recentRunbooksData = runbooksWithSteps
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3);

      // Process recent executions with progress
      const executionsWithProgress = clientExecutions.map((ex: any) => {
        const stepAssignments = stepAssignmentsResponse.data?.filter((sa: any) => sa.execution_id === ex.id) || [];
        const completedSteps = stepAssignments.filter((sa: any) => sa.status === 'completed').length;
        const progress = stepAssignments.length > 0 ? Math.round((completedSteps / stepAssignments.length) * 100) : 0;
        
        // Find the runbook title
        const runbook = clientRunbooks.find((rb: any) => rb.id === ex.runbook_id);
        
        return {
          id: ex.id,
          title: ex.title,
          status: ex.status || 'draft',
          progress,
          started_at: ex.started_at || ex.created_at,
          runbook_title: runbook?.title || 'Unknown Runbook',
        };
      });

      // Sort by started_at descending and take first 4
      const recentExecutionsData = executionsWithProgress
        .sort((a: any, b: any) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
        .slice(0, 4);

      // Find assigned rep - org-wide assignment (no client_id filter)
      const assignment = assignmentsResponse.data?.find((ca: any) => ca.kelyn_rep_id);
      let repData = null;
      if (assignment?.kelyn_rep_id) {
        const rep = profilesResponse.data?.find((p: any) => p.id === assignment.kelyn_rep_id);
        if (rep) {
          repData = {
            first_name: rep.first_name,
            last_name: rep.last_name,
            email: rep.email,
          };
        }
      }

      console.log('Dashboard data loaded:', {
        runbooks: recentRunbooksData.length,
        executions: recentExecutionsData.length,
        assignedRep: repData
      });

      setRecentRunbooks(recentRunbooksData);
      setRecentExecutions(recentExecutionsData);
      setAssignedRep(repData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeProps = (status: string, progress: number) => {
    if (progress === 100) {
      return {
        variant: 'default' as const,
        className: 'border-green-600 bg-white text-green-600 rounded-md',
        text: 'Completed',
      };
    }

    switch (status) {
      case 'active':
        return {
          variant: 'default' as const,
          className: 'border-blue-600 bg-white text-blue-600 rounded-md',
          text: 'Active',
        };
      case 'paused':
        return {
          variant: 'secondary' as const,
          className: 'border-gray-400 bg-white text-gray-600 rounded-md',
          text: 'Paused',
        };
      default:
        return {
          variant: 'outline' as const,
          className: 'border-gray-400 bg-white text-gray-600 rounded-md',
          text: 'Draft',
        };
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-32"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Available Runbooks</CardTitle>
            <BookOpen className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.availableRunbooks}</div>
            <p className="text-xs text-muted-foreground">Ready to execute</p>
          </CardContent>
        </Card>

        <Card className="">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Active Executions</CardTitle>
            <Play className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.activeExecutions}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card className="">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completedExecutions}</div>
            <p className="text-xs text-muted-foreground">Successfully finished</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Runbooks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-left text-lg">Recent Runbooks</CardTitle>
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
                <p className="text-sm">No runbooks available yet</p>
                <p className="text-xs mt-1">Runbooks will appear here when they're created for your organization</p>
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

        {/* Recent Executions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-left text-lg">Execution History</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/executions')}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentExecutions.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Play className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No executions yet</p>
                <p className="text-xs mt-1">Your runbook executions will appear here</p>
              </div>
            ) : (
              recentExecutions.map((execution) => {
                const badgeProps = getStatusBadgeProps(execution.status, execution.progress);
                return (
                  <Card
                    key={execution.id}
                    className="p-3 hover:shadow-md transition-shadow cursor-pointer border border-gray-100"
                    onClick={() => navigate(`/executions/${execution.id}`)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-left text-gray-900 text-sm">{execution.title}</h4>
                            <Badge variant={badgeProps.variant} className={`${badgeProps.className} text-xs`}>
                              {badgeProps.text}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground text-left">{execution.runbook_title}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{execution.progress}%</span>
                        </div>
                        <Progress value={execution.progress} className="h-1.5" />
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Started {new Date(execution.started_at).toLocaleDateString()}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Your Rep Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-left text-lg">Your KelynTech Representative</CardTitle>
            <CardDescription className="text-left text-sm">Your dedicated point of contact</CardDescription>
          </CardHeader>
          <CardContent>
            {assignedRep ? (
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {assignedRep.first_name[0]}{assignedRep.last_name[0]}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-left text-gray-900 text-sm">
                    {assignedRep.first_name} {assignedRep.last_name}
                  </h4>
                  <p className="text-xs text-muted-foreground text-left">Account Representative</p>
                  <p className="text-sm font-mono text-left text-blue-700 mt-1">{assignedRep.email}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => (window.location.href = `mailto:${assignedRep.email}`)}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Mail className="h-3 w-3" />
                    Email
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg border border-gray-100">
                <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  KT
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-left text-gray-900 text-sm">KelynTech Sales Team</h4>
                  <p className="text-xs text-muted-foreground text-left">General Sales & Support</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => (window.location.href = 'mailto:sales@kelyntech.com')}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Mail className="h-3 w-3" />
                    Contact Sales
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Emergency Contact Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-left text-lg">Emergency Support</CardTitle>
            <CardDescription className="text-left text-sm">24/7 emergency support line for critical issues</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border border-red-100">
              <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                <Phone className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-left text-gray-900 text-sm">Emergency Hotline</h4>
                <p className="text-xs text-muted-foreground text-left">Available 24/7 for urgent matters</p>
                <p className="text-sm font-mono text-left text-red-700 mt-1">1-800-KELYN-911</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => (window.location.href = 'tel:1-800-535-9691')}
                  className="flex items-center gap-2 text-xs border-red-200 hover:bg-red-50"
                >
                  <Phone className="h-3 w-3" />
                  Call Now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
