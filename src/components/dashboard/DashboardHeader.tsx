import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useAppBranding } from '@/hooks/useAppBranding';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  Plus,
  UsersRound,
  Users as UsersIcon,
  BookOpen,
  ArrowLeft,
  Play,
  Download,
  Trash,
  HelpCircle,
  Settings,
  Copy,
  CloudUpload,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { CreateClientForm } from '@/components/clients/CreateClientForm';
import { CreateRunbookForm } from '@/components/runbooks/CreateRunbookForm';
import { StartExecutionDialog } from '@/components/executions/StartExecutionDialog';
import { fileClient } from '@/lib/fileClient';
import { useToast } from '@/hooks/use-toast';
import { generateRunbookPDF, RunbookPDFData } from '@/utils/pdfGenerator';
import { EnhancedCreateRunbookForm } from '@/components/runbooks/EnhancedCreateRunbookForm';
import { useSidebar } from '@/components/ui/sidebar';
import { BackupDialog } from '@/components/BackupDialog';
import { Progress } from '@/components/ui/progress';
import { getBackupStatus, BackupStatus } from '@/components/BackupDialog';

interface DashboardHeaderProps {
  onClientCreated: () => void;
  onRunbookCreated: () => void;
  onStepCreated?: () => void;
}

export function DashboardHeader({
  onClientCreated,
  onRunbookCreated,
  onStepCreated
}: DashboardHeaderProps) {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { branding } = useAppBranding();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const { toast } = useToast();
  const { state: sidebarState } = useSidebar();

  const [showCreateClientForm, setShowCreateClientForm] = useState(false);
  const [showCreateRunbookForm, setShowCreateRunbookForm] = useState(false);
  const [showStartExecution, setShowStartExecution] = useState(false);
  const [loadingPDF, setLoadingPDF] = useState(false);
  const [runbookData, setRunbookData] = useState<any>(null);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [showBackupDialog, setShowBackupDialog] = useState(false);

  // Add console logging for debugging modal performance
  useEffect(() => {
    console.log('DashboardHeader: showCreateClientForm changed to:', showCreateClientForm);
  }, [showCreateClientForm]);

  // Listen for backup status changes
  useEffect(() => {
    // Initial check for backup status
    const initialStatus = getBackupStatus();
    setBackupStatus(initialStatus);

    // Listen for backup status changes
    const handleBackupStatusChange = (event: CustomEvent) => {
      setBackupStatus(event.detail);
    };

    window.addEventListener('backup-status-changed', handleBackupStatusChange as EventListener);

    return () => {
      window.removeEventListener('backup-status-changed', handleBackupStatusChange as EventListener);
    };
  }, []);

  // Check for auto-open modal state from navigation
  useEffect(() => {
    const navigationState = location.state as { autoOpenCreateModal?: boolean };
    if (navigationState?.autoOpenCreateModal) {
      const path = location.pathname;
      
      if (path === '/clients') {
        console.log('DashboardHeader: Auto-opening client creation modal');
        setShowCreateClientForm(true);
      } else if (path === '/runbooks') {
        console.log('DashboardHeader: Auto-opening runbook creation modal');
        setShowCreateRunbookForm(true);
      }
      
      // Clear the navigation state to prevent reopening on subsequent renders
      window.history.replaceState(null, '', location.pathname);
    }
  }, [location.pathname, location.state]);

  // Fetch runbook data when on a runbook details page
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/runbooks/') && path !== '/runbooks' && params.id) {
      fetchRunbookData(params.id);
    } else {
      setRunbookData(null);
    }
  }, [location.pathname, params.id]);

  const fetchRunbookData = async (runbookId: string) => {
    try {
      console.log('DashboardHeader: Fetching runbook data for ID:', runbookId);
      
      // Fetch runbook details
      const runbookResponse = await fileClient.from('runbooks').select('*').eq('id', runbookId);
      const runbook = runbookResponse.data?.[0];
      
      if (!runbook) {
        console.log('DashboardHeader: Runbook not found');
        return;
      }

      console.log('DashboardHeader: Runbook found:', runbook);

      // Fetch related data
      const [clientResponse, creatorResponse, stepsResponse] = await Promise.all([
        fileClient.from('clients').select('*').eq('id', runbook.client_id),
        runbook.created_by ? fileClient.from('profiles').select('*').eq('id', runbook.created_by) : { data: [] },
        fileClient.from('runbook_steps').select('*').eq('runbook_id', runbookId)
      ]);

      const client = clientResponse.data?.[0];
      const createdByProfile = creatorResponse.data?.[0];
      const steps = stepsResponse.data || [];

      // Sort steps by step_order
      steps.sort((a, b) => a.step_order - b.step_order);

      // For each step that has an assigned_to, fetch the user profile
      const stepsWithAssignedUsers = await Promise.all(
        steps.map(async (step) => {
          if (step.assigned_to) {
            const assignedUserResponse = await fileClient.from('profiles').select('*').eq('id', step.assigned_to);
            const assignedUser = assignedUserResponse.data?.[0];
            return {
              ...step,
              assigned_user: assignedUser ? {
                first_name: assignedUser.first_name,
                last_name: assignedUser.last_name
              } : null
            };
          }
          return { ...step, assigned_user: null };
        })
      );

      console.log('DashboardHeader: Setting runbook data with steps:', stepsWithAssignedUsers.length);

      setRunbookData({
        ...runbook,
        client: client ? { name: client.name } : null,
        created_by_profile: createdByProfile ? {
          first_name: createdByProfile.first_name,
          last_name: createdByProfile.last_name
        } : null,
        steps: stepsWithAssignedUsers
      });
    } catch (error) {
      console.error('DashboardHeader: Error fetching runbook data:', error);
    }
  };

  const handleClientCreated = () => {
    console.log('DashboardHeader: handleClientCreated called');
    setShowCreateClientForm(false);
    onClientCreated();
  };

  const handleRunbookCreated = () => {
    console.log('DashboardHeader: handleRunbookCreated called');
    setShowCreateRunbookForm(false);
    onRunbookCreated();
  };

  const handleExecutionStarted = () => {
    setShowStartExecution(false);
    navigate('/executions');
  };

  const handleStepCreated = () => {
    if (onStepCreated) {
      onStepCreated();
    }
  };

  const handleAddStepClick = () => {
    // Dispatch a custom event that the RunbookDetailsView can listen for
    const event = new CustomEvent('add-step-click', {
      detail: { runbookId: params.id }
    });
    window.dispatchEvent(event);
  };

  const handleDownloadPDF = async () => {
    if (!runbookData) return;
    setLoadingPDF(true);
    try {
      const pdfData: RunbookPDFData = {
        id: runbookData.id,
        title: runbookData.title,
        description: runbookData.description || undefined,
        client: runbookData.client,
        created_by_profile: runbookData.created_by_profile,
        created_at: runbookData.created_at || '',
        updated_at: runbookData.updated_at || '',
        steps: runbookData.steps.map((step: any) => ({
          id: step.id,
          title: step.title,
          description: step.description || undefined,
          step_order: step.step_order,
          estimated_duration_minutes: step.estimated_duration_minutes || undefined,
          assigned_user: step.assigned_user || undefined,
          tasks: step.tasks
            ? Array.isArray(step.tasks)
              ? step.tasks
              : []
            : []
        }))
      };
      generateRunbookPDF(pdfData, branding?.primary_color, branding?.app_logo_url);
      toast({
        title: 'Success',
        description: 'PDF downloaded successfully'
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate PDF',
        variant: 'destructive'
      });
    } finally {
      setLoadingPDF(false);
    }
  };

  const handleDeleteRunbook = async () => {
    if (!runbookData) return;

    console.log('DashboardHeader: Deleting runbook:', runbookData.id);
    
    try {
      const result = await fileClient
        .from('runbooks')
        .delete()
        .eq('id', runbookData.id);

      if (result.error) {
        throw new Error(result.error.message);
      }

      toast({
        title: 'Success',
        description: 'Runbook deleted successfully'
      });
      navigate('/runbooks');
    } catch (error) {
      console.error('DashboardHeader: Error deleting runbook:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete runbook',
        variant: 'destructive'
      });
    }
  };

  const handleCloneRunbook = async () => {
    if (!runbookData) return;

    console.log('DashboardHeader: Cloning runbook:', runbookData.id);
    console.log('DashboardHeader: Original runbook data:', runbookData);
    
    try {
      // Generate a new UUID for the cloned runbook
      const newRunbookId = crypto.randomUUID();
      
      // Create the cloned runbook with current timestamp
      const currentTimestamp = new Date().toISOString();
      const clonedRunbook = {
        id: newRunbookId,
        title: `${runbookData.title} Copy`,
        description: runbookData.description,
        client_id: runbookData.client_id,
        created_by: user?.id,
        is_template: false,
        created_at: currentTimestamp,
        updated_at: currentTimestamp
      };

      console.log('DashboardHeader: Cloned runbook object:', clonedRunbook);

      const runbookResult = await fileClient
        .from('runbooks')
        .insert(clonedRunbook);

      if (runbookResult.error) {
        console.error('DashboardHeader: Error inserting runbook:', runbookResult.error);
        throw new Error(runbookResult.error.message);
      }

      console.log('DashboardHeader: Runbook inserted successfully:', runbookResult);

      // Clone all steps
      if (runbookData.steps && runbookData.steps.length > 0) {
        console.log('DashboardHeader: Original steps to clone:', runbookData.steps);
        
        const clonedSteps = runbookData.steps.map((step: any) => {
          const newStepId = crypto.randomUUID();
          
          // Clone tasks with new UUIDs
          const clonedTasks = (step.tasks || []).map((task: any) => ({
            ...task,
            id: crypto.randomUUID() // Generate new UUID for each task
          }));
          
          const clonedStep = {
            id: newStepId,
            runbook_id: newRunbookId,
            title: step.title,
            description: step.description,
            step_order: step.step_order,
            estimated_duration_minutes: step.estimated_duration_minutes,
            assigned_to: step.assigned_to,
            tasks: clonedTasks,
            photo_url: step.photo_url,
            app_id: step.app_id,
            conditions: step.conditions,
            depends_on: step.depends_on,
            created_at: currentTimestamp,
            updated_at: currentTimestamp
          };

          console.log('DashboardHeader: Cloned step:', clonedStep);
          return clonedStep;
        });

        console.log('DashboardHeader: All cloned steps:', clonedSteps);

        // Insert steps one by one instead of as a bulk array
        console.log('DashboardHeader: Inserting steps individually...');
        for (let i = 0; i < clonedSteps.length; i++) {
          const step = clonedSteps[i];
          console.log(`DashboardHeader: Inserting step ${i + 1}/${clonedSteps.length}:`, step);
          
          const stepResult = await fileClient
            .from('runbook_steps')
            .insert(step);

          if (stepResult.error) {
            console.error(`DashboardHeader: Error inserting step ${i + 1}:`, stepResult.error);
            throw new Error(`Failed to insert step ${i + 1}: ${stepResult.error.message}`);
          }

          console.log(`DashboardHeader: Step ${i + 1} inserted successfully:`, stepResult);
        }

        console.log('DashboardHeader: All steps inserted successfully');
      } else {
        console.log('DashboardHeader: No steps to clone');
      }

      toast({
        title: 'Success',
        description: 'Runbook cloned successfully'
      });

      // Add a small delay to ensure data is written before navigation
      setTimeout(() => {
        console.log('DashboardHeader: Navigating to new runbook:', newRunbookId);
        navigate(`/runbooks/${newRunbookId}`);
      }, 500);

    } catch (error) {
      console.error('DashboardHeader: Error cloning runbook:', error);
      toast({
        title: 'Error',
        description: 'Failed to clone runbook',
        variant: 'destructive'
      });
    }
  };

  const canStartExecution = () => {
    if (!profile) return false;
    
    // Kelyn Admin and Kelyn Rep can always execute
    if (profile.role === 'kelyn_admin' || profile.role === 'kelyn_rep') {
      return true;
    }
    
    // Client Admin can execute only if the runbook's client matches their client
    if (profile.role === 'client_admin') {
      return runbookData && profile.client_id === runbookData.client_id;
    }
    
    // Client Member cannot execute
    return false;
  };

  const canEdit = () => {
    if (!profile) return false;
    return profile.role === 'kelyn_admin' || profile.role === 'kelyn_rep';
  };

  const canShowAdminButtons = () => {
    if (!profile) return false;
    
    // Kelyn Admin and Kelyn Rep can always see admin buttons
    if (profile.role === 'kelyn_admin' || profile.role === 'kelyn_rep') {
      return true;
    }
    
    // Client Admin can see admin buttons only if the runbook's client matches their client
    if (profile.role === 'client_admin') {
      return runbookData && profile.client_id === runbookData.client_id;
    }
    
    // Client Member cannot see admin buttons
    return false;
  };

  const canShowCloneButton = () => {
    if (!profile) return false;
    
    // Kelyn Admin, Kelyn Rep, and Client Admin can always see clone button
    return (
      profile.role === 'kelyn_admin' ||
      profile.role === 'kelyn_rep' ||
      profile.role === 'client_admin'
    );
  };

  const getPageInfo = () => {
    const path = location.pathname;
    const canCreateClients =
      profile?.role === 'kelyn_admin' || profile?.role === 'kelyn_rep';
    const canCreateRunbooks =
      profile?.role === 'kelyn_admin' || profile?.role === 'kelyn_rep' || profile?.role === 'client_admin';
    const isRunbookDetails = path.startsWith('/runbooks/') && path !== '/runbooks';

    // Client Details Page
    if (path.startsWith('/clients/') && path !== '/clients') {
      return {
        title: 'Team Details',
        icon: UsersRound,
        showBack: true,
        backTo: '/clients'
      };
    }

    // Runbook Details Page with action buttons
    if (isRunbookDetails && runbookData) {
      return {
        title: '',
        icon: 'BookOpen',
        showBack: true,
        backTo: '/runbooks',
        action: (
          <div className="flex items-center space-x-2">
            {canShowAdminButtons() && (
              <>
                <Button size="sm" onClick={handleAddStepClick}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Step
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive">
                      <Trash className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Runbook</AlertDialogTitle>
                      <AlertDialogDescription>
                        Delete this runbook? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteRunbook}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {canShowCloneButton() && (
              <Button size="sm" variant="outline" onClick={handleCloneRunbook}>
                <Copy className="h-4 w-4 mr-1" />
                Clone
              </Button>
            )}

            {canStartExecution() && (
              <Button size="sm" variant="outline" onClick={() => setShowStartExecution(true)}>
                <Play className="h-4 w-4 mr-1" />
                Execute
              </Button>
            )}

            {/* PDF button visible for all users */}
            <Button size="sm" variant="outline" onClick={handleDownloadPDF} disabled={loadingPDF}>
              <Download className="h-4 w-4 mr-1" />
              {loadingPDF ? 'Generating...' : 'PDF'}
            </Button>
          </div>
        )
      };
    }

    switch (path) {
      case '/clients':
        return {
          title: 'Teams',
          icon: UsersRound,
          action: canCreateClients ? (
            <Dialog open={showCreateClientForm} onOpenChange={setShowCreateClientForm}>
              <DialogTrigger asChild>
                <Button 
                  size="sm" 
                  style={{
                    backgroundColor: branding?.primary_color || '#84cc16',
                    borderColor: branding?.primary_color || '#84cc16'
                  }}
                  className="text-white hover:opacity-90"
                  onClick={() => console.log('DashboardHeader: Create Team button clicked')}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create Team
                </Button>
              </DialogTrigger>
              {showCreateClientForm && (
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle></DialogTitle>
                  </DialogHeader>
                  <CreateClientForm onClientCreated={handleClientCreated} />
                </DialogContent>
              )}
            </Dialog>
          ) : null
        };

      case '/users':
        return {
          title: 'User Management',
          icon: UsersIcon
        };

      case '/runbooks':
        return {
          title: 'Runbooks',
          icon: BookOpen,
          action: canCreateRunbooks ? (
            <Button 
              size="sm" 
              style={{
                backgroundColor: branding?.primary_color || '#84cc16',
                borderColor: branding?.primary_color || '#84cc16'
              }}
              className="text-white hover:opacity-90 transition-opacity"
              onClick={() => setShowCreateRunbookForm(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Runbook
            </Button>
          ) : null
        };

      case '/knowledge-base':
        return {
          title: 'Help',
          icon: HelpCircle
        };

      case '/settings':
        return {
          title: 'Settings',
          icon: Settings
        };

      case '/executions':
        return {
          title: 'Executions'
        };

      default:
        return {
          title: 'Dashboard'
        };
    }
  };

  const currentPageInfo = getPageInfo();
  const PageIcon = currentPageInfo.icon;

  return (
    <>
      <header className={`bg-white border-b border-sidebar-border flex items-center px-6 h-[3.98rem] fixed top-0 z-30 transition-all duration-200 ${
        sidebarState === 'expanded' ? 'left-64 right-0' : 'left-0 right-0'
      }`}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-2">
            <SidebarTrigger className="h-8 w-8 text-sidebar-foreground" />
            <div className="h-6 bg-sidebar-border" />
            <div className="flex items-center">
              {currentPageInfo.showBack && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(currentPageInfo.backTo || '/clients')}
                  className="text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              
              {PageIcon && (
                <PageIcon className="h-5 w-5 hidden text-sidebar-foreground" />
              )}
              
              {currentPageInfo.title && (
                <h1 className="text-xl font-semibold text-sidebar-foreground">
                  {currentPageInfo.title}
                </h1>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Backup Status Indicator */}
            {backupStatus && backupStatus.isActive && (
              <div 
                className="flex items-center space-x-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
                onClick={() => setShowBackupDialog(true)}
              >
                <CloudUpload className="h-4 w-4 text-blue-600 animate-pulse" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-blue-900">
                    Backup in Progress
                  </p>
                  <div className="flex items-center space-x-2">
                    <Progress value={backupStatus.progress} className="h-1 w-16" />
                    <span className="text-xs text-blue-700">
                      {backupStatus.completedFiles}/{backupStatus.totalFiles}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {currentPageInfo.action && currentPageInfo.action}
          </div>
        </div>
      </header>

      {/* Enhanced Create Runbook Form - Only show when modal should be open */}
      {showCreateRunbookForm && (
        <EnhancedCreateRunbookForm 
          isOpen={showCreateRunbookForm}
          onSuccess={handleRunbookCreated}
          onCancel={() => setShowCreateRunbookForm(false)}
        />
      )}

      {/* Start Execution Dialog */}
      {showStartExecution && runbookData && (
        <StartExecutionDialog
          isOpen={showStartExecution}
          onClose={() => setShowStartExecution(false)}
          runbookId={runbookData.id}
          runbookTitle={runbookData.title}
          clientId={runbookData.client_id}
          onExecutionStarted={handleExecutionStarted}
        />
      )}

      {/* Backup Dialog */}
      {profile?.role === 'kelyn_admin' && (
        <BackupDialog
          open={showBackupDialog}
          onOpenChange={setShowBackupDialog}
        />
      )}
    </>
  );
}
