import React, { useState, useEffect } from 'react';
import { fileClient } from '@/lib/fileClient';
import { Runbook, RunbookStep, Client, Profile, App } from '@/lib/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { ArrowLeft, Plus, FileText, Users, Calendar, Clock, CheckCircle, AlertTriangle, User, Eye, ChevronDown, ChevronRight, Activity, Pause } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useSidebar } from '@/components/ui/sidebar';
import { RunbookStepsList } from './RunbookStepsList';
import { AddStepDialog } from './AddStepDialog';
import { MultiAppDisplay } from './MultiAppDisplay';
import { InlineRunbookTitleEditor } from './InlineRunbookTitleEditor';
import { ClientPreviewModal } from '@/components/runbooks/ClientPreviewModal';

// Extended interface for runbook with related data
interface RunbookWithRelations extends Runbook {
  client?: { name: string };
  runbook_apps?: Array<{
    app: {
      id: string;
      name: string;
      logo_url: string;
    };
  }>;
  steps?: Array<RunbookStep & {
    status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
    assigned_user?: {
      first_name: string;
      last_name: string;
      email: string;
    };
  }>;
}

interface RunbookExecution {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'completed' | 'paused';
  started_by: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  started_by_profile?: {
    first_name: string;
    last_name: string;
  };
}

interface RunbookDetailsViewProps {
  runbookId: string;
  onStepCreated?: () => void;
}



export function RunbookDetailsView({
  runbookId,
  onStepCreated
}: RunbookDetailsViewProps) {
  const [runbook, setRunbook] = useState<RunbookWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [canDelete, setCanDelete] = useState(false);
  const [scrollToNewStep, setScrollToNewStep] = useState(false);
  const [showAddStepDialog, setShowAddStepDialog] = useState(false);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [executions, setExecutions] = useState<RunbookExecution[]>([]);
  const [showExecutions, setShowExecutions] = useState(false);
  const [activeTab, setActiveTab] = useState<'steps' | 'executions'>('steps');
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    user
  } = useAuth();
  const {
    profile
  } = useProfile(user?.id);
  const { state: sidebarState } = useSidebar();

  useEffect(() => {
    fetchRunbookDetails();
    checkPermissions();
    fetchExecutions();
  }, [runbookId, profile]);

  // Add scroll listener for sticky header
  useEffect(() => {
    const handleScroll = () => {
      const runbookOverview = document.getElementById('runbook-overview');
      if (runbookOverview) {
        const rect = runbookOverview.getBoundingClientRect();
        setShowStickyHeader(rect.bottom < 0);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Listen for global add step events from the header button
  useEffect(() => {
    const handleAddStepClick = () => {
      setShowAddStepDialog(true);
    };

    // Add event listener for custom event from header
    const handleCustomAddStep = (event: CustomEvent) => {
      if (event.detail?.runbookId === runbookId) {
        setShowAddStepDialog(true);
      }
    };
    window.addEventListener('add-step-click', handleCustomAddStep as EventListener);
    return () => {
      window.removeEventListener('add-step-click', handleCustomAddStep as EventListener);
    };
  }, [runbookId]);

  const fetchRunbookDetails = async () => {
    setLoading(true);
    try {
      console.log('RunbookDetailsView: Fetching runbook details for ID:', runbookId);
      // Fetch runbook data
      const runbookResponse = await fileClient.from('runbooks').select('*').eq('id', runbookId);
      console.log('RunbookDetailsView: Runbook response:', runbookResponse);
      const runbookData = runbookResponse.data?.[0];
      
      if (!runbookData) {
        throw new Error('Runbook not found');
      }
      console.log('RunbookDetailsView: Runbook data:', runbookData);

      // Fetch related data
      const [clientResponse, runbookAppsResponse, stepsResponse] = await Promise.all([
        fileClient.from('clients').select('*').eq('id', runbookData.client_id),
        fileClient.from('runbook_apps').select('*').eq('runbook_id', runbookId),
        fileClient.from('runbook_steps').select('*').eq('runbook_id', runbookId)
      ]);

      const clientData = clientResponse.data?.[0];
      const runbookAppsData = runbookAppsResponse.data || [];
      const stepsData = stepsResponse.data || [];
      console.log('RunbookDetailsView: Steps data length:', stepsData.length);

      // Fetch apps for runbook_apps
      const appIds = runbookAppsData.map(ra => ra.app_id);
      const appsResponse = appIds.length > 0 ? await fileClient.from('apps').select('*').in('id', appIds) : { data: [] };
      const appsData = appsResponse.data || [];

      // Fetch profiles for step assignments
      const assignedUserIds = stepsData.filter(s => s.assigned_to).map(s => s.assigned_to);
      const profilesResponse = assignedUserIds.length > 0 ? await fileClient.from('profiles').select('*').in('id', assignedUserIds) : { data: [] };
      const profilesData = profilesResponse.data || [];

      // Transform the data to match the expected type
      const transformedData: RunbookWithRelations = {
        ...runbookData,
        client: clientData ? { name: clientData.name } : undefined,
        runbook_apps: runbookAppsData.map(ra => {
          const app = appsData.find(a => a.id === ra.app_id);
          return {
            app: app ? {
              id: app.id,
              name: app.name,
              logo_url: app.logo_url
            } : null
          };
        }).filter(ra => ra.app) as Array<{
          app: {
            id: string;
            name: string;
            logo_url: string;
          };
        }>,
        steps: stepsData.map(step => {
          const assignedUser = step.assigned_to ? profilesData.find(p => p.id === step.assigned_to) : null;
          return {
            ...step,
            status: 'not_started' as const,
            assigned_user: assignedUser ? {
              first_name: assignedUser.first_name || '',
              last_name: assignedUser.last_name || '',
              email: assignedUser.email
            } : undefined
          };
        }).sort((a, b) => a.step_order - b.step_order)
      };
      
      console.log('RunbookDetailsView: Transformed data:', transformedData);
      setRunbook(transformedData);
    } catch (error) {
      console.error('Error fetching runbook details:', error);
      toast({
        title: "Error",
        description: "Failed to load runbook details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteRunbook = async () => {
    if (!window.confirm('Are you sure you want to delete this runbook? This action cannot be undone.')) {
      return;
    }
    try {
      await fileClient.from('runbooks').delete().eq('id', runbookId);
      toast({
        title: "Success",
        description: "Runbook deleted successfully"
      });
      navigate('/runbooks');
    } catch (error) {
      console.error('Error deleting runbook:', error);
      toast({
        title: "Error",
        description: "Failed to delete runbook",
        variant: "destructive"
      });
    }
  };

  const checkPermissions = async () => {
    if (!profile) return;
    try {
      const runbookResponse = await fileClient.from('runbooks').select('*').eq('id', runbookId);
      const runbookData = runbookResponse.data?.[0];
      if (!runbookData) {
        console.error('Error fetching runbook client ID: Runbook not found');
        return;
      }
      const clientId = runbookData.client_id;
      
      // Allow editing for:
      // 1. Kelyn admins (can edit all runbooks)
      // 2. Kelyn reps (can edit all runbooks) 
      // 3. Client admins (can edit their own client's runbooks)
      // Note: client_members are excluded from editing
      if (profile.role === 'kelyn_admin' || 
          profile.role === 'kelyn_rep' ||
          (profile.role === 'client_admin' && profile.client_id === clientId)) {
        setCanDelete(true);
      } else {
        setCanDelete(false);
      }
    } catch (error) {
      console.error('Error fetching runbook client ID:', error);
    }
  };

  const fetchExecutions = async () => {
    try {
      // Fetch executions for this runbook
      const executionsResult = await fileClient
        .from('runbook_executions')
        .select('*')
        .eq('runbook_id', runbookId);
      
      if (executionsResult.error) {
        console.error('Error fetching executions:', executionsResult.error);
        return;
      }

      const executionsData = executionsResult.data || [];

      // Get profiles for the users who started executions
      const starterUserIds = [...new Set(executionsData.map((exec: any) => exec.started_by))];
      const profilesResult = starterUserIds.length > 0 
        ? await fileClient.from('profiles').select('*').in('id', starterUserIds)
        : { data: [] };
      const profiles = profilesResult.data || [];

      // Transform executions with profile data
      const executionsWithProfiles = executionsData.map((execution: any) => {
        const profile = profiles.find((p: any) => p.id === execution.started_by);
        return {
          ...execution,
          started_by_profile: profile ? {
            first_name: profile.first_name || '',
            last_name: profile.last_name || ''
          } : undefined
        };
      }).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setExecutions(executionsWithProfiles);
    } catch (error) {
      console.error('Error fetching executions:', error);
    }
  };

  const handleStepCreated = () => {
    fetchRunbookDetails();
    setScrollToNewStep(true);
    if (onStepCreated) {
      onStepCreated();
    }
  };

  const handleScrollComplete = () => {
    setScrollToNewStep(false);
  };

  const canShowAdminButtons = () => {
    if (!profile) return false;
    return profile.role === 'kelyn_admin' || profile.role === 'kelyn_rep' || profile.role === 'client_admin';
  };

  // Get unique assigned users from steps
  const getAssignedUsers = () => {
    if (!runbook?.steps) return [];
    const assignedUsers = new Map();
    runbook.steps.forEach(step => {
      if (step.assigned_user) {
        const key = step.assigned_user.email;
        if (!assignedUsers.has(key)) {
          assignedUsers.set(key, step.assigned_user);
        }
      }
    });
    return Array.from(assignedUsers.values());
  };

  const handleRunbookUpdate = (updates: { title?: string; description?: string }) => {
    if (runbook) {
      setRunbook({
        ...runbook,
        ...updates
      });
    }
  };

  if (loading) {
    return null;
  }

  if (!runbook) {
    return <div className="text-center py-8 animate-fade-in">
        <h2 className="text-2xl font-bold text-destructive">Runbook Not Found</h2>
        <p className="text-muted-foreground mt-2">The runbook you're looking for doesn't exist or you don't have access to it.</p>
        <Button onClick={() => navigate('/runbooks')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Runbooks
        </Button>
      </div>;
  }

  const appIds = runbook?.runbook_apps?.map(ra => ra.app.id) || [];
  const completedSteps = runbook?.steps?.filter(step => step.status === 'completed').length || 0;
  const totalSteps = runbook?.steps?.length || 0;
  const progressPercentage = totalSteps > 0 ? Math.round(completedSteps / totalSteps * 100) : 0;
  const assignedUsers = getAssignedUsers();

  return (
    <div className="animate-fade-in">
      {/* Sticky Header */}
      <div className={`fixed top-[63px] z-20 bg-background/95 backdrop-blur-sm border-b transition-all duration-200 ${
        showStickyHeader ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      } ${
        sidebarState === 'expanded' ? 'left-64 right-0' : 'left-16 right-0'
      }`}>
        <div className="max-w-6xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold truncate">{runbook?.title}</h2>
              {appIds.length > 0 && (
                <MultiAppDisplay appIds={appIds} size="sm" maxDisplay={3} />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Runbook Overview */}
        <Card id="runbook-overview" className="animate-fade-in border-0 shadow-none">
          <CardHeader>
            <div className="flex items-start justify-between">
              <InlineRunbookTitleEditor
                runbookId={runbookId}
                title={runbook.title}
                description={runbook.description}
                canEdit={canDelete}
                onUpdate={handleRunbookUpdate}
              />
              {appIds.length > 0 && <div className="ml-4">
                  <MultiAppDisplay appIds={appIds} size="md" maxDisplay={5} />
                </div>}
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-medium">Team:</span>
                <span>{runbook.client?.name}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-medium">Created:</span>
                <span>{new Date(runbook.created_at || '').toLocaleDateString()}</span>
              </div>

              {assignedUsers.length > 0 && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-medium">Assigned:</span>
                  <div className="flex gap-1">
                    {assignedUsers.map(user => (
                      <Badge 
                        key={user.email} 
                        variant="secondary" 
                        className="text-xs"
                      >
                        {user.first_name} {user.last_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

                {/* Runbook Content - Tabs */}
        <Card className="border-0">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex space-x-8">
                <button
                  onClick={() => setActiveTab('steps')}
                  className={`pb-3 border-b-2 transition-colors text-sm tracking-widest uppercase font-medium ${
                    activeTab === 'steps'
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Runbook Steps
                </button>
                {executions.length > 0 && (
                  <button
                    onClick={() => setActiveTab('executions')}
                    className={`pb-3 border-b-2 transition-colors text-sm tracking-widest uppercase font-medium flex items-center gap-2 ${
                      activeTab === 'executions'
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Execution History
                    <Badge variant="outline" className="text-xs">
                      {executions.length}
                    </Badge>
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className={activeTab === 'steps' ? 'sm-px-[45px]' : ''}>
            {activeTab === 'steps' && (
              <RunbookStepsList 
                runbookId={runbookId} 
                clientId={runbook.client_id} 
                canEdit={canDelete} 
                scrollToNewStep={scrollToNewStep} 
                onScrollComplete={handleScrollComplete} 
              />
            )}
            
            {activeTab === 'executions' && executions.length > 0 && (
              <div className="space-y-2">
                {executions.map((execution) => (
                  <div
                    key={execution.id}
                    className="flex items-center justify-between p-3 rounded-md border bg-background hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/executions/${execution.id}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="font-medium text-sm truncate">
                        {execution.title}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        by {execution.started_by_profile 
                          ? `${execution.started_by_profile.first_name} ${execution.started_by_profile.last_name}`
                          : 'Unknown'
                        }
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          execution.status === 'completed' ? 'default' :
                          execution.status === 'active' ? 'secondary' :
                          execution.status === 'paused' ? 'outline' : 'outline'
                        }
                        className="text-xs flex items-center gap-1"
                      >
                        {execution.status === 'completed' && (
                          <CheckCircle className="h-3 w-3 text-green-600" />
                        )}
                        {execution.status === 'active' && (
                          <Clock className="h-3 w-3 text-blue-600" />
                        )}
                        {execution.status === 'paused' && (
                          <Pause className="h-3 w-3 text-orange-600" />
                        )}
                        {execution.status === 'draft' && (
                          <Clock className="h-3 w-3 text-gray-600" />
                        )}
                        {execution.started_at 
                          ? new Date(execution.started_at).toLocaleDateString()
                          : new Date(execution.created_at).toLocaleDateString()
                        }
                      </Badge>
                      {execution.completed_at && (
                        <span className="text-xs text-muted-foreground">
                          Completed {new Date(execution.completed_at).toLocaleDateString()}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Step Dialog */}
      <AddStepDialog open={showAddStepDialog} onOpenChange={setShowAddStepDialog} runbookId={runbookId} clientId={runbook.client_id} onSuccess={handleStepCreated} />

      {/* Client Preview Modal - Positioned outside main content */}
    </div>
  );
}
