import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fileClient } from '@/lib/fileClient';
// Import the required types
import { RunbookExecution, ExecutionStepAssignment } from '@/lib/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ArrowLeft, Play, Pause, CheckCircle, Clock, User, Calendar, AlertCircle, Image, Star, Download, FileText, FileSpreadsheet, Trash2, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePendingTasksContext } from '@/contexts/PendingTasksContext';
import { PhotoLightbox } from '@/components/runbooks/PhotoLightbox';
import { TasksList } from '@/components/runbooks/TasksList';
import { MultiAppDisplay } from '@/components/runbooks/MultiAppDisplay';
import { getStepPhotoUrl } from '@/utils/urlUtils';
import { generateExecutionCSV, generateExecutionPDF, ExecutionReportData } from '@/utils/executionReportGenerator';

// Define local types based on the database schema
type ExecutionStatus = 'draft' | 'active' | 'completed' | 'paused';
type StepStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked';

type ExecutionDetails = RunbookExecution & {
  runbook: { 
    title: string; 
    description: string | null;
    runbook_apps: Array<{
      app: { id: string; name: string; logo_url: string };
    }>;
  };
  client: { name: string };
  started_by_profile: { first_name: string; last_name: string };
  step_assignments: Array<{
    id: string;
    status: StepStatus;
    notes: string | null;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
    assigned_to: string | null;
    step: {
      id: string;
      title: string;
      description: string | null;
      step_order: number;
      estimated_duration_minutes: number | null;
      tasks: any;
      photo_url: string | null;
      conditions: any;
      runbook_step_apps: Array<{
        app: { id: string; name: string; logo_url: string };
      }>;
    };
    assigned_profile: {
      first_name: string;
      last_name: string;
    } | null;
  }>;
};

interface ExecutionDetailsViewProps {
  executionId: string;
}

export function ExecutionDetailsView({ executionId }: ExecutionDetailsViewProps) {
  const [execution, setExecution] = useState<ExecutionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStep, setUpdatingStep] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; caption?: string; stepData?: { title: string; description?: string } } | null>(null);
  const [exportingReport, setExportingReport] = useState<'csv' | 'pdf' | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { refetchPendingTasks } = usePendingTasksContext();
  const navigate = useNavigate();

  useEffect(() => {
    fetchExecutionDetails();
  }, [executionId]);

  const fetchExecutionDetails = async () => {
    try {
      console.log('Fetching execution details for:', executionId);
      
      // Fetch execution
      const executionResult = await fileClient.from('runbook_executions').select('*').eq('id', executionId);
      const execution = executionResult.data?.[0];
      
      if (!execution) {
        console.log('Execution not found:', executionId);
        setExecution(null);
        setLoading(false);
        return;
      }
      
      console.log('Found execution:', execution.title);
      
      // Fetch runbook data
      const runbookResult = await fileClient.from('runbooks').select('*').eq('id', execution.runbook_id);
      const runbook = runbookResult.data?.[0];
      
      // Fetch client data
      const clientResult = await fileClient.from('clients').select('*').eq('id', execution.client_id);
      const client = clientResult.data?.[0];
      
      // Fetch started by profile
      const profileResult = await fileClient.from('profiles').select('*').eq('id', execution.started_by);
      const started_by_profile = profileResult.data?.[0];
      
      // Fetch step assignments
      const assignmentsResult = await fileClient.from('execution_step_assignments').select('*').eq('execution_id', execution.id);
      const step_assignments = assignmentsResult.data || [];
      
      // Fetch runbook apps if runbook exists
      let runbook_apps = [];
      if (runbook) {
        const runbookAppsResult = await fileClient.from('runbook_apps').select('*').eq('runbook_id', runbook.id);
        const runbookAppsData = runbookAppsResult.data || [];
        
        runbook_apps = await Promise.all(runbookAppsData.map(async (ra) => {
          const appResult = await fileClient.from('apps').select('*').eq('id', ra.app_id);
          return {
            app: appResult.data?.[0]
          };
        }));
      }
      
      // Fetch detailed step and assignment data
      const enrichedAssignments = await Promise.all(step_assignments.map(async (assignment) => {
        const stepResult = await fileClient.from('runbook_steps').select('*').eq('id', assignment.step_id);
        const step = stepResult.data?.[0];
        
        // Fetch assigned profile if exists
        let assigned_profile = null;
        if (assignment.assigned_to) {
          const assignedProfileResult = await fileClient.from('profiles').select('*').eq('id', assignment.assigned_to);
          assigned_profile = assignedProfileResult.data?.[0];
        }
        
        // Fetch step apps if step exists
        let runbook_step_apps = [];
        if (step) {
          const stepAppsResult = await fileClient.from('runbook_step_apps').select('*').eq('step_id', step.id);
          const stepAppsData = stepAppsResult.data || [];
          
          runbook_step_apps = await Promise.all(stepAppsData.map(async (rsa) => {
            const appResult = await fileClient.from('apps').select('*').eq('id', rsa.app_id);
            return {
              app: appResult.data?.[0]
            };
          }));
        }
        
        return {
          ...assignment,
          step: step ? {
            ...step,
            runbook_step_apps
          } : null,
          assigned_profile: assigned_profile ? {
            first_name: assigned_profile.first_name,
            last_name: assigned_profile.last_name
          } : null
        };
      }));
      
      const data = {
        ...execution,
        runbook: runbook ? {
          title: runbook.title,
          description: runbook.description,
          runbook_apps
        } : null,
        client: client ? { name: client.name } : null,
        started_by_profile: started_by_profile ? {
          first_name: started_by_profile.first_name,
          last_name: started_by_profile.last_name
        } : null,
        step_assignments: enrichedAssignments
      };
      
      const error = null;

      if (error) {
        console.error('Error fetching execution details:', error);
        toast({
          title: "Error",
          description: "Failed to load execution details",
          variant: "destructive",
        });
      } else {
        // Sort step assignments by step order
        if (data?.step_assignments) {
          data.step_assignments.sort((a, b) => a.step.step_order - b.step.step_order);
        }
        setExecution(data);
        
        // Check if execution should be marked as completed
        if (data && data.status !== 'completed') {
          const progress = getExecutionProgressFromData(data);
          if (progress === 100) {
            updateExecutionStatus(data.id, 'completed');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching execution details:', error);
      toast({
        title: "Error",
        description: "Failed to load execution details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getExecutionProgressFromData = (executionData: ExecutionDetails) => {
    if (!executionData?.step_assignments || executionData.step_assignments.length === 0) return 0;
    const completedSteps = executionData.step_assignments.filter(sa => sa.status === 'completed').length;
    return Math.round((completedSteps / executionData.step_assignments.length) * 100);
  };

  const updateExecutionStatus = async (executionId: string, newStatus: ExecutionStatus) => {
    const updateData = { 
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString() 
    };
    
    const { error } = await fileClient
      .from('runbook_executions')
      .update(updateData)
      .eq('id', executionId);

    if (error) {
      console.error('Error updating execution status:', error);
    } else {
      // Update local state
      if (execution) {
        setExecution({
          ...execution,
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : execution.completed_at
        });
      }
      
      if (newStatus === 'completed') {
        toast({
          title: "👊 Execution Completed,",
          description: "Mission Accomplished.",
        });
      }
    }
  };

  const updateStepStatus = async (assignmentId: string, newStatus: StepStatus, notes?: string) => {
    setUpdatingStep(assignmentId);
    
    const updates: any = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (notes !== undefined) {
      updates.notes = notes;
    }

    if (newStatus === 'in_progress' && !execution?.step_assignments.find(sa => sa.id === assignmentId)?.started_at) {
      updates.started_at = new Date().toISOString();
    }

    if (newStatus === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    const { error } = await fileClient
      .from('execution_step_assignments')
      .update(updates)
      .eq('id', assignmentId);

    if (error) {
      console.error('Error updating step status:', error);
      toast({
        title: "Error",
        description: "Failed to update step status",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Step status updated",
      });
      fetchExecutionDetails(); // Refresh data
      
      // Refresh pending tasks count to update sidebar badge
      await refetchPendingTasks();
    }
    
    setUpdatingStep(null);
  };

  const handleTasksUpdate = async (stepId: string, updatedTasks: any[]) => {
    // For executions, we only allow task completion updates, not structural changes
    // Task completion is handled locally and doesn't modify the runbook structure
    
    // Update the local state immediately for task completion
    if (execution) {
      const updatedExecution = {
        ...execution,
        step_assignments: execution.step_assignments.map(assignment => 
          assignment.step.id === stepId 
            ? { ...assignment, step: { ...assignment.step, tasks: updatedTasks } }
            : assignment
        )
      };
      setExecution(updatedExecution);
    }

    // For executions, we don't save task completion states back to the runbook steps
    // Task completion is temporary execution state, not permanent runbook changes
    // Only draft executions would allow structural task changes
    if (execution?.status === 'draft') {
      const updateData = { 
        tasks: updatedTasks as unknown as any,
        updated_at: new Date().toISOString() 
      };
      
      const { error } = await fileClient
        .from('runbook_steps')
        .update(updateData)
        .eq('id', stepId);

      if (error) {
        console.error('Error updating tasks:', error);
        // Revert the local state if save failed
        fetchExecutionDetails();
        toast({
          title: "Error",
          description: "Failed to update tasks",
          variant: "destructive",
        });
      }
    }
  };

  const getExecutionProgress = () => {
    if (!execution?.step_assignments || execution.step_assignments.length === 0) return 0;
    const completedSteps = execution.step_assignments.filter(sa => sa.status === 'completed').length;
    return Math.round((completedSteps / execution.step_assignments.length) * 100);
  };

  const getStatusColor = (status: StepStatus) => {
    switch (status) {
      case 'in_progress':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'blocked':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: StepStatus) => {
    switch (status) {
      case 'in_progress':
        return <Play className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'blocked':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusBadgeVariant = (status: StepStatus) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'blocked':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatStatusText = (status: StepStatus) => {
    return status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Not Started';
  };

  const calculateStepDuration = (startedAt: string | null, completedAt: string | null) => {
    if (!startedAt || !completedAt) return null;
    
    const start = new Date(startedAt);
    const end = new Date(completedAt);
    const diffMs = end.getTime() - start.getTime();
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;
    
    if (diffHours > 0) {
      return remainingMinutes > 0 
        ? `${diffHours}h ${remainingMinutes}m`
        : `${diffHours}h`;
    }
    
    return `${diffMinutes}m`;
  };

  const calculateTotalDuration = () => {
    if (!execution?.created_at) return null;
    
    const endTime = execution.completed_at ? new Date(execution.completed_at) : new Date();
    const startTime = new Date(execution.created_at);
    const diffMs = endTime.getTime() - startTime.getTime();
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;
    const diffDays = Math.floor(diffHours / 24);
    const remainingHours = diffHours % 24;
    
    if (diffDays > 0) {
      return `${diffDays}d ${remainingHours}h ${remainingMinutes}m`;
    } else if (diffHours > 0) {
      return remainingMinutes > 0 
        ? `${diffHours}h ${remainingMinutes}m`
        : `${diffHours}h`;
    }
    
    return `${diffMinutes}m`;
  };

  const transformExecutionForReport = (): ExecutionReportData | null => {
    if (!execution) return null;

    return {
      id: execution.id,
      title: execution.title,
      runbook_title: execution.runbook?.title || 'Unknown Runbook',
      runbook_description: execution.runbook?.description || undefined,
      client_name: execution.client?.name || 'Unknown Client',
      status: execution.status,
      started_by: execution.started_by_profile 
        ? `${execution.started_by_profile.first_name} ${execution.started_by_profile.last_name}`
        : 'Unknown User',
      created_at: execution.created_at || '',
      started_at: execution.started_at || undefined,
      completed_at: execution.completed_at || undefined,
      total_duration: calculateTotalDuration() || undefined,
      progress: getExecutionProgress(),
      step_assignments: execution.step_assignments?.map(assignment => ({
        id: assignment.id,
        step_order: assignment.step.step_order,
        step_title: assignment.step.title,
        step_description: assignment.step.description || undefined,
        assigned_to: assignment.assigned_profile 
          ? `${assignment.assigned_profile.first_name} ${assignment.assigned_profile.last_name}`
          : undefined,
        status: assignment.status || 'not_started',
        created_at: assignment.created_at,
        started_at: assignment.started_at || undefined,
        completed_at: assignment.completed_at || undefined,
        duration: calculateStepDuration(assignment.started_at, assignment.completed_at) || undefined,
        notes: assignment.notes || undefined,
        estimated_duration_minutes: assignment.step.estimated_duration_minutes || undefined
      })) || []
    };
  };

  const handleExportCSV = async () => {
    const reportData = transformExecutionForReport();
    if (!reportData) {
      toast({
        title: "Error",
        description: "Unable to prepare report data",
        variant: "destructive"
      });
      return;
    }

    setExportingReport('csv');
    try {
      generateExecutionCSV(reportData);
      toast({
        title: "Success",
        description: "CSV report downloaded successfully"
      });
    } catch (error) {
      console.error('Error generating CSV:', error);
      toast({
        title: "Error",
        description: "Failed to generate CSV report",
        variant: "destructive"
      });
    } finally {
      setExportingReport(null);
    }
  };

  const handleExportPDF = async () => {
    const reportData = transformExecutionForReport();
    if (!reportData) {
      toast({
        title: "Error",
        description: "Unable to prepare report data",
        variant: "destructive"
      });
      return;
    }

    setExportingReport('pdf');
    try {
      // You might want to fetch branding data here if available
      // For now, using default colors
      await generateExecutionPDF(reportData);
      toast({
        title: "Success",
        description: "PDF report downloaded successfully"
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF report",
        variant: "destructive"
      });
    } finally {
      setExportingReport(null);
    }
  };

  const handleDeleteExecution = async () => {
    if (!execution) return;

    setDeleting(true);
    try {
      // Delete all step assignments first
      const { error: assignmentsError } = await fileClient
        .from('execution_step_assignments')
        .delete()
        .eq('execution_id', execution.id);

      if (assignmentsError) {
        console.error('Error deleting step assignments:', assignmentsError);
        throw new Error('Failed to delete step assignments');
      }

      // Delete the execution
      const { error: executionError } = await fileClient
        .from('runbook_executions')
        .delete()
        .eq('id', execution.id);

      if (executionError) {
        console.error('Error deleting execution:', executionError);
        throw new Error('Failed to delete execution');
      }

      toast({
        title: "Success",
        description: "Execution deleted successfully"
      });

      // Refresh pending tasks count to update sidebar badge
      refetchPendingTasks();

      // Navigate back to executions list
      navigate('/executions');
    } catch (error) {
      console.error('Error deleting execution:', error);
      toast({
        title: "Error",
        description: "Failed to delete execution",
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Check if user can delete executions (all roles except client_member)
  const canDeleteExecution = profile?.role !== 'client_member';

  const formatCompletionTime = (completedAt: string | null) => {
    if (!completedAt) return null;
    
    const date = new Date(completedAt);
    return {
      date: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    };
  };

  // Collect all available questions for workflow rules
  const getAllAvailableQuestions = () => {
    const questions: Array<{
      stepId: string;
      stepTitle: string;
      stepOrder: number;
      taskId?: string;
      taskTitle?: string;
      questionId: string;
      question: string;
      options: string[];
    }> = [];

    execution?.step_assignments?.forEach(assignment => {
      // Step-level questions from conditions
      if (assignment.step.conditions && assignment.step.conditions.question) {
        questions.push({
          stepId: assignment.step.id,
          stepTitle: assignment.step.title,
          stepOrder: assignment.step.step_order,
          questionId: assignment.step.conditions.question.id,
          question: assignment.step.conditions.question.question,
          options: assignment.step.conditions.question.options || []
        });
      }

      // Task-level questions
      if (assignment.step.tasks && Array.isArray(assignment.step.tasks)) {
        assignment.step.tasks.forEach((task: any) => {
          if (task.question) {
            questions.push({
              stepId: assignment.step.id,
              stepTitle: assignment.step.title,
              stepOrder: assignment.step.step_order,
              taskId: task.id,
              taskTitle: task.title,
              questionId: task.question.id,
              question: task.question.question,
              options: task.question.options || []
            });
          }
        });
      }
    });

    return questions;
  };

  if (loading) {
    return null;
  }

  if (!execution) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold text-destructive">Execution Not Found</h2>
        <p className="text-muted-foreground mt-2 text-center">The execution you're looking for doesn't exist or you don't have access to it.</p>
        <Button onClick={() => navigate('/executions')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Executions
        </Button>
      </div>
    );
  }

  const progress = getExecutionProgress();
  const isCompleted = progress === 100;
  const runbookAppIds = execution.runbook?.runbook_apps?.map(ra => ra.app.id) || [];

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
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div 
          className="flex items-center justify-between gap-4"
          style={{ 
            opacity: 0,
            animation: 'fadeIn 0.8s ease-out 0ms forwards'
          }}
        >
          <Button variant="ghost" onClick={() => navigate('/executions')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Executions
          </Button>
          
          <div className="flex items-center gap-3">
            {/* Delete Button - Only show for non-client members */}
            {canDeleteExecution && (
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(true)}
                disabled={deleting}
                className="text-sm border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}

            {/* Export Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={exportingReport !== null}
                  className="text-sm"
                >
                  {exportingReport ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                      Exporting...
                    </div>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export Report
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleExportCSV} disabled={exportingReport !== null}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Download as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF} disabled={exportingReport !== null}>
                  <FileText className="h-4 w-4 mr-2" />
                  Download as PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Execution audit reports
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Execution Overview */}
        <Card 
          className={`${isCompleted ? 'border-green-200 bg-green-50/20' : 'border-gray-200'}`}
          style={{ 
            opacity: 0,
            animation: 'fadeIn 0.8s ease-out 80ms forwards'
          }}
        >
          <CardContent className="p-5">
            {/* Title and Apps Row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <h1 className="text-xl font-semibold text-gray-900 text-left truncate">{execution.title}</h1>
                <Badge 
                  variant={isCompleted ? 'default' : execution.status === 'active' ? 'default' : 'secondary'}
                  className={`text-xs ${isCompleted ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
                >
                  {isCompleted ? 'Completed' : execution.status}
                </Badge>
              </div>
              {runbookAppIds.length > 0 && (
                <MultiAppDisplay 
                  appIds={runbookAppIds}
                  size="sm"
                  maxDisplay={4}
                  className="ml-4 flex-shrink-0"
                />
              )}
            </div>
            
            {/* Runbook Row */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 text-left">
                Based on runbook: 
                <button 
                  onClick={() => navigate(`/runbooks/${execution.runbook_id}`)}
                  className="font-medium text-blue-600 hover:text-blue-800 hover:underline ml-1 inline-flex items-center gap-1 transition-colors"
                >
                  {execution.runbook?.title}
                  <ExternalLink className="h-3 w-3" />
                </button>
              </p>
            </div>
            
            {/* Progress and Metadata Row */}
            <div className="flex items-center justify-between gap-6 mb-4">
              {/* Progress Section - Left Side */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <Progress 
                    value={progress} 
                    className={`w-32 h-2 ${isCompleted ? '[&>div]:bg-green-500' : ''}`}
                  />
                  <span className={`text-sm font-medium ${isCompleted ? 'text-green-600' : 'text-gray-700'}`}>
                    {progress}%
                  </span>
                </div>
                
                <div className="text-xs text-gray-500 whitespace-nowrap">
                  {execution.step_assignments?.filter(sa => sa.status === 'completed').length || 0}/{execution.step_assignments?.length || 0} steps
                </div>
                
                {isCompleted && (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    <span className="text-xs font-medium">Complete</span>
                  </div>
                )}
              </div>

              {/* Metadata - Right Side */}
              <div className="flex items-center gap-6 text-sm text-gray-600 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <User className="h-3 w-3 text-gray-400" />
                  <span className="truncate max-w-32">
                    {execution.started_by_profile?.first_name} {execution.started_by_profile?.last_name}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-gray-400" />
                  <span className="whitespace-nowrap">
                    {new Date(execution.created_at || '').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                
                {execution.started_at && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-gray-400" />
                    <span className="whitespace-nowrap">
                      Started {new Date(execution.started_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Team Info */}
            <div className="text-sm text-gray-600 text-left">
              <span className="font-medium">Team:</span> {execution.client?.name}
            </div>
            
            {/* Completion Banner */}
            {isCompleted && (
              <div className="mt-4 flex items-center gap-2 text-green-700 bg-green-100 px-4 py-2 rounded-md">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium text-left">All steps completed successfully!</span>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Steps */}
        <Card
          style={{ 
            opacity: 0,
            animation: 'fadeIn 0.8s ease-out 160ms forwards'
          }}
        >
          <CardHeader>
            <CardTitle className="text-left hidden">Execution Steps</CardTitle>
            <CardDescription className="text-left hidden">
              Track progress and manage step assignments
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Accordion type="single" collapsible className="space-y-4">
              {execution.step_assignments?.map((assignment) => {
                const stepAppIds = assignment.step.runbook_step_apps?.map(rsa => rsa.app.id) || [];
                const isAssignedToCurrentUser = assignment.assigned_to === user?.id;
                const isUserActiveStep = isAssignedToCurrentUser && assignment.status === 'in_progress';
                // Only restrict access for Client Members - other roles can edit all steps
                const canInteract = profile?.role !== 'client_member' || isAssignedToCurrentUser;
                
                return (
                  <AccordionItem 
                    key={assignment.id} 
                    value={assignment.id} 
                    className={`border rounded-lg ${
                      isUserActiveStep 
                        ? 'border-blue-300 bg-gradient-to-r from-blue-50/50 to-blue-50/30 shadow-sm' 
                        : isAssignedToCurrentUser 
                          ? 'border-blue-300 bg-blue-50/30' 
                          : !canInteract
                            ? 'border-gray-200 bg-gray-50/30 opacity-75'
                            : 'border-gray-200'
                    }`}
                  >
                    <AccordionTrigger 
                      className={`px-6 py-4 hover:no-underline ${
                        !canInteract ? 'cursor-not-allowed pointer-events-none' : ''
                      }`}
                      disabled={!canInteract}
                    >
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center space-x-4">
                          <div className={`p-2 rounded-full ${getStatusColor(assignment.status || 'not_started')} text-white`}>
                            {getStatusIcon(assignment.status || 'not_started')}
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-lg text-left">
                                Step {assignment.step.step_order}: {assignment.step.title}
                              </h4>
                              {isUserActiveStep && (
                                <Badge 
                                  variant="outline" 
                                  className="text-xs bg-blue-50 text-blue-700 border-blue-300 animate-pulse shadow-sm"
                                >
                                  Your Turn
                                </Badge>
                              )}
                              {!canInteract && assignment.assigned_profile && (
                                <Badge 
                                  variant="outline" 
                                  className="text-xs bg-gray-100 text-gray-600 border-gray-300"
                                >
                                  Assigned to {assignment.assigned_profile.first_name} {assignment.assigned_profile.last_name}
                                </Badge>
                              )}
                            </div>
                            {(assignment.assigned_profile || assignment.step.estimated_duration_minutes) && (
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                {assignment.assigned_profile && (
                                  <div className="flex items-center gap-1.5">
                                    <User className="h-4 w-4" />
                                    {isAssignedToCurrentUser ? (
                                      <Badge 
                                        variant="outline" 
                                        className="text-xs bg-blue-100 text-blue-700 border-blue-300"
                                      >
                                        Assigned to You
                                      </Badge>
                                    ) : (
                                      <span>{assignment.assigned_profile.first_name} {assignment.assigned_profile.last_name}</span>
                                    )}
                                  </div>
                                )}
                                {assignment.step.estimated_duration_minutes && (
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="h-4 w-4" />
                                    {assignment.step.estimated_duration_minutes} minutes
                                  </div>
                                )}
                              </div>
                            )}
                            {stepAppIds.length > 0 && (
                              <div className="mt-2">
                                <MultiAppDisplay 
                                  appIds={stepAppIds}
                                  size="sm"
                                  maxDisplay={3}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Right side content: Photo thumbnail, completion info, and status */}
                        <div className="flex items-center gap-3" style={{ width: '25%', minWidth: '200px' }}>
                          {/* Step photo thumbnail */}
                          {assignment.step.photo_url && (
                            <div 
                              className="relative cursor-pointer group rounded-lg overflow-hidden border-2 border-white shadow-sm w-16 h-12 shrink-0 hover:shadow-md transition-shadow"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxPhoto({ 
                                  url: getStepPhotoUrl(assignment.step.photo_url)!, 
                                  caption: `Step ${assignment.step.step_order}: ${assignment.step.title}`,
                                  stepData: {
                                    title: assignment.step.title,
                                    description: assignment.step.description || undefined
                                  }
                                });
                              }}
                            >
                              <img
                                src={getStepPhotoUrl(assignment.step.photo_url)}
                                alt={`Step ${assignment.step.step_order} thumbnail`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                                <Image className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {assignment.status === 'completed' && assignment.completed_at && (
                              <div className="text-right text-xs text-muted-foreground">
                                {(() => {
                                  const completionTime = formatCompletionTime(assignment.completed_at);
                                  const duration = calculateStepDuration(assignment.started_at, assignment.completed_at);
                                  return (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 justify-end">
                                        <CheckCircle className="h-3 w-3 text-green-600" />
                                        <span className="truncate">{completionTime?.date} at {completionTime?.time}</span>
                                      </div>
                                      {duration && (
                                        <div className="flex items-center gap-1.5 justify-end">
                                          <Clock className="h-3 w-3 text-gray-500" />
                                          <span>Took {duration}</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                            <Badge variant={getStatusBadgeVariant(assignment.status || 'not_started')}>
                              {formatStatusText(assignment.status || 'not_started')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    
                    <AccordionContent className="px-6 pb-6">
                      {!canInteract ? (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                          <div className="flex items-center justify-center gap-2 text-gray-600 mb-2">
                            <User className="h-5 w-5" />
                            <span className="font-medium">Access Restricted</span>
                          </div>
                          <p className="text-sm text-gray-500">
                            This step is assigned to {assignment.assigned_profile?.first_name} {assignment.assigned_profile?.last_name}. 
                            {assignment.assigned_profile ? ' Only they can interact with this step.' : ' You cannot interact with this step.'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {assignment.step.description && (
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                              <h5 className="font-medium mb-2 text-left">Description:</h5>
                              <p className="text-sm text-muted-foreground text-left">
                                {assignment.step.description}
                              </p>
                            </div>
                          )}

                          {/* Step Reference Image */}
                          {assignment.step.photo_url && (
                            <div>
                              <h5 className="font-medium mb-3 text-left">Reference Image:</h5>
                              <div 
                                className="relative cursor-pointer group rounded-lg overflow-hidden border w-32 h-24 hover:shadow-md transition-shadow"
                                onClick={() => setLightboxPhoto({ 
                                  url: getStepPhotoUrl(assignment.step.photo_url)!, 
                                  caption: `Step ${assignment.step.step_order}: ${assignment.step.title}`,
                                  stepData: {
                                    title: assignment.step.title,
                                    description: assignment.step.description || undefined
                                  }
                                })}
                              >
                                <img
                                  src={getStepPhotoUrl(assignment.step.photo_url)}
                                  alt={`Step ${assignment.step.step_order} reference`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                                  <Image className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Tasks with individual images */}
                          {assignment.step.tasks && Array.isArray(assignment.step.tasks) && assignment.step.tasks.length > 0 && (
                            <div>
                                                          <TasksList
                              stepId={assignment.step.id}
                              tasks={assignment.step.tasks}
                              canEdit={canInteract && execution.status === 'draft'}
                              onTasksUpdate={(updatedTasks) => handleTasksUpdate(assignment.step.id, updatedTasks)}
                              availableQuestions={getAllAvailableQuestions()}
                              isExecution={true}
                              canCheckTasks={canInteract}
                              currentStepOrder={assignment.step.step_order}
                            />
                            </div>
                          )}

                          {assignment.notes && (
                            <div>
                              <h5 className="font-medium mb-2 text-left">Notes:</h5>
                              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                                <p className="text-sm text-left">
                                  {assignment.notes}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Professional Action Section - Only show if user can interact */}
                          <div className="bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200 rounded-xl p-6 mt-6">
                            <div className="flex flex-col lg:flex-row gap-6">
                              
                              {/* Status Actions */}
                              <div className="flex-1">
                                <h5 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  Step Actions
                                </h5>
                                
                                <div className="flex flex-wrap gap-3">
                                  {assignment.status === 'not_started' && (
                                    <Button
                                      onClick={() => updateStepStatus(assignment.id, 'in_progress')}
                                      disabled={updatingStep === assignment.id}
                                      className="bg-gradient-to-br from-white to-gray-50 hover:from-gray-50 hover:to-gray-100 text-gray-700 border border-gray-200/60 shadow-sm relative overflow-hidden group transition-all duration-200 font-medium"
                                    >
                                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                                      <Play className="h-4 w-4 mr-2 relative z-10" />
                                      <span className="relative z-10">
                                        <span className="bg-gradient-to-r from-gray-700 via-blue-600 to-gray-700 bg-[length:200%_100%] animate-[gradient_3s_ease-in-out_infinite] bg-clip-text text-transparent">
                                          Start Step
                                        </span>
                                      </span>
                                    </Button>
                                  )}
                                  
                                  {assignment.status === 'in_progress' && (
                                    <>
                                      <Button
                                        onClick={() => updateStepStatus(assignment.id, 'completed')}
                                        disabled={updatingStep === assignment.id}
                                        className="bg-gradient-to-b from-green-600 to-green-700 hover:from-green-650 hover:to-green-750 text-white shadow-sm hover:shadow-md transition-all duration-300 ease-in-out border border-green-700 hover:border-green-750 font-medium"
                                      >
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Complete
                                      </Button>
                                      
                                      <Button
                                        onClick={() => updateStepStatus(assignment.id, 'blocked')}
                                        disabled={updatingStep === assignment.id}
                                        className="bg-gradient-to-b from-red-600 to-red-700 hover:from-red-650 hover:to-red-750 text-white shadow-sm hover:shadow-md transition-all duration-300 ease-in-out border border-red-700 hover:border-red-750 font-medium"
                                      >
                                        <AlertCircle className="h-4 w-4 mr-2" />
                                        Blocked
                                      </Button>
                                      
                                      <Button
                                        onClick={() => updateStepStatus(assignment.id, 'not_started')}
                                        disabled={updatingStep === assignment.id}
                                        className="bg-gradient-to-b from-white to-gray-50 hover:from-gray-50 hover:to-gray-100 text-slate-700 shadow-sm hover:shadow-md transition-all duration-300 ease-in-out border border-gray-300 hover:border-gray-400 font-medium"
                                      >
                                        <Pause className="h-4 w-4 mr-2" />
                                        Pause Step
                                      </Button>
                                    </>
                                  )}
                                  
                                  {assignment.status === 'blocked' && (
                                    <Button
                                      onClick={() => updateStepStatus(assignment.id, 'in_progress')}
                                      disabled={updatingStep === assignment.id}
                                      className="bg-gradient-to-br from-white to-gray-50 hover:from-gray-50 hover:to-gray-100 text-gray-700 border border-gray-200/60 shadow-sm relative overflow-hidden group transition-all duration-200 font-medium"
                                    >
                                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                                      <Play className="h-4 w-4 mr-2 relative z-10" />
                                      <span className="relative z-10">Resume Step</span>
                                    </Button>
                                  )}
                                  
                                  {assignment.status === 'completed' && (
                                    <Button
                                      variant="outline"
                                      onClick={() => updateStepStatus(assignment.id, 'in_progress')}
                                      disabled={updatingStep === assignment.id}
                                      className="border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 shadow-sm hover:shadow transition-all duration-200 font-medium"
                                    >
                                      <Play className="h-4 w-4 mr-2" />
                                      Reopen Step
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* Notes Section */}
                              <div className="flex-1 min-w-0">
                                <h5 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                                  Add Notes
                                </h5>
                                
                                <div className="space-y-3">
                                  <Textarea
                                    placeholder="Document your progress, observations, or issues..."
                                    className="text-left resize-none min-h-[50px] border-slate-300 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 bg-white/80 hover:bg-white"
                                    id={`notes-${assignment.id}`}
                                  />
                                  <div className="flex justify-end">
                                    <Button
                                      onClick={() => {
                                        const textarea = document.getElementById(`notes-${assignment.id}`) as HTMLTextAreaElement;
                                        if (textarea?.value.trim()) {
                                          updateStepStatus(assignment.id, assignment.status || 'not_started', textarea.value);
                                          textarea.value = '';
                                        }
                                      }}
                                      disabled={updatingStep === assignment.id}
                                      className="bg-gradient-to-b from-white to-gray-50 hover:from-gray-50 hover:to-gray-100 text-slate-700 shadow-sm hover:shadow-md transition-all duration-300 ease-in-out border border-gray-300 hover:border-gray-400 font-medium min-w-[120px]"
                                    >
                                      {updatingStep === assignment.id ? (
                                        <div className="flex items-center gap-2">
                                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                          Saving...
                                        </div>
                                      ) : (
                                        <>
                                          <CheckCircle className="h-4 w-4 mr-2" />
                                          Save Note
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="sm:max-w-md backdrop-blur-xl bg-white/80 border border-white/20 shadow-2xl">
            <DialogHeader className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-100/80 rounded-full backdrop-blur-sm">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <DialogTitle className="text-xl font-semibold text-gray-900">Delete Execution</DialogTitle>
              </div>
              <DialogDescription className="text-gray-600 leading-relaxed">
                <p className="mb-3">Are you sure you want to delete this execution? This action cannot be undone and will permanently remove:</p>
                <div className="bg-red-50/60 backdrop-blur-sm rounded-lg p-4 border border-red-100/40">
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                      <span>The execution record</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                      <span>All step assignments and progress</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                      <span>All notes and completion data</span>
                    </li>
                  </ul>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleting}
                className="backdrop-blur-sm bg-white/60 border-gray-200/60 hover:bg-white/80 hover:border-gray-300/80 transition-all duration-200"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDeleteExecution}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 transition-all duration-200 border-0 backdrop-blur-sm"
              >
                {deleting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Deleting...
                  </div>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Execution
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Photo Lightbox */}
        {lightboxPhoto && (
          <PhotoLightbox
            isOpen={!!lightboxPhoto}
            onClose={() => setLightboxPhoto(null)}
            photoUrl={lightboxPhoto.url}
            caption={lightboxPhoto.caption}
            contextType="step"
            contextData={lightboxPhoto.stepData}
          />
        )}
      </div>
    </>
  );
}
