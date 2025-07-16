import React, { useState, useEffect } from 'react';
import { fileClient } from '@/lib/fileClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Eye, 
  X, 
  Clock, 
  User, 
  Calendar, 
  CheckCircle, 
  AlertTriangle, 
  Play, 
  Pause,
  Image,
  ChevronRight,
  ChevronLeft,
  Shuffle,
  Info
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { PhotoLightbox } from './PhotoLightbox';
import { MultiAppDisplay } from './MultiAppDisplay';
import { getStepPhotoUrl } from '@/utils/urlUtils';
import { WorkflowAnswersProvider, useWorkflowAnswers } from '@/hooks/useWorkflowAnswers';
import { TasksList } from './TasksList';

interface ClientPreviewModalProps {
  runbookId: string;
}

interface PreviewTask {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  order: number;
  question?: any;
  visibilityRules?: any[];
  photoUrl?: string;
  codeBlock?: string;
}

interface PreviewRunbook {
  id: string;
  title: string;
  description: string | null;
  client?: { name: string };
  runbook_apps?: Array<{
    app: {
      id: string;
      name: string;
      logo_url: string;
    };
  }>;
  steps: Array<{
    id: string;
    title: string;
    description: string | null;
    step_order: number;
    estimated_duration_minutes: number | null;
    tasks: PreviewTask[];
    photo_url: string | null;
    conditions: any;
    assigned_user?: {
      first_name: string;
      last_name: string;
      email: string;
    };
    runbook_step_apps?: Array<{
      app: { id: string; name: string; logo_url: string };
    }>;
  }>;
}

interface PreviewStepAssignment {
  id: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  step: {
    id: string;
    title: string;
    description: string | null;
    step_order: number;
    estimated_duration_minutes: number | null;
    tasks: PreviewTask[];
    photo_url: string | null;
    conditions: any;
    runbook_step_apps: Array<{
      app: { id: string; name: string; logo_url: string };
    }>;
  };
  assigned_profile?: {
    first_name: string;
    last_name: string;
  };
}

// Helper function to format visibility rules for display
function formatVisibilityRules(visibilityRules: any[]): string {
  if (!visibilityRules || visibilityRules.length === 0) return '';
  
  return visibilityRules.map(rule => {
    const { stepTitle, taskTitle, questionText, operator, value } = rule;
    let condition = '';
    
    if (stepTitle && taskTitle) {
      condition = `"${stepTitle}" → "${taskTitle}"`;
    } else if (questionText) {
      condition = `"${questionText}"`;
    }
    
    switch (operator) {
      case 'equals':
        condition += ` equals "${value}"`;
        break;
      case 'not_equals':
        condition += ` does not equal "${value}"`;
        break;
      case 'contains':
        condition += ` contains "${value}"`;
        break;
      case 'not_contains':
        condition += ` does not contain "${value}"`;
        break;
      case 'is_answered':
        condition += ' is answered';
        break;
      case 'is_not_answered':
        condition += ' is not answered';
        break;
      default:
        condition += ` ${operator} "${value}"`;
    }
    
    return condition;
  }).join(' AND ');
}

// Helper function to check if step has conditions
function hasStepConditions(step: any): boolean {
  return step.conditions && 
    step.conditions.visibilityRules && 
    Array.isArray(step.conditions.visibilityRules) && 
    step.conditions.visibilityRules.length > 0;
}

// Helper function to count tasks with visibility rules
function getTasksWithRulesCount(tasks: PreviewTask[]): number {
  return tasks.filter(task => task.visibilityRules && task.visibilityRules.length > 0).length;
}

// Helper function to parse step visibility rules
function parseStepVisibilityRules(step: any): any[] {
  if (!step.conditions || typeof step.conditions !== 'object') return [];
  try {
    const conditions = step.conditions as any;
    return conditions.visibilityRules || [];
  } catch {
    return [];
  }
}

// Preview wrapper for TasksList that prevents database saves
function PreviewTasksListWrapper({ 
  stepId, 
  tasks, 
  onTasksUpdate 
}: { 
  stepId: string; 
  tasks: PreviewTask[]; 
  onTasksUpdate: (tasks: PreviewTask[]) => void;
}) {
  // Create a modified version of TasksList that bypasses database saves
  const handleTasksUpdateLocal = (updatedTasks: PreviewTask[]) => {
    // This only updates local state, no database calls
    onTasksUpdate(updatedTasks);
  };

  // Create a custom props object that overrides the normal database save behavior
  const previewProps = {
    stepId,
    tasks,
    canEdit: false, // Prevent editing in preview
    onTasksUpdate: handleTasksUpdateLocal,
    isExecution: true, // Use execution mode UI
    canCheckTasks: true, // Allow checking tasks for preview
    isPreview: true // Add a preview flag
  };

  return (
    <TasksList
      {...previewProps}
    />
  );
}

// Inner component that has access to workflow answers context
function ClientPreviewModalContent({ runbookId }: { runbookId: string }) {
  const [runbook, setRunbook] = useState<PreviewRunbook | null>(null);
  const [allStepAssignments, setAllStepAssignments] = useState<PreviewStepAssignment[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; caption?: string; stepData?: { title: string; description?: string } } | null>(null);
  const { toast } = useToast();
  const { checkVisibility } = useWorkflowAnswers();

  const fetchRunbookPreviewData = async () => {
    setLoading(true);
    try {
      // Fetch runbook data
      const runbookResponse = await fileClient.from('runbooks').select('*').eq('id', runbookId);
      const runbookData = runbookResponse.data?.[0];
      
      if (!runbookData) {
        throw new Error('Runbook not found');
      }

      // Fetch related data
      const [clientResponse, runbookAppsResponse, stepsResponse] = await Promise.all([
        fileClient.from('clients').select('*').eq('id', runbookData.client_id),
        fileClient.from('runbook_apps').select('*').eq('runbook_id', runbookId),
        fileClient.from('runbook_steps').select('*').eq('runbook_id', runbookId)
      ]);

      const clientData = clientResponse.data?.[0];
      const runbookAppsData = runbookAppsResponse.data || [];
      const stepsData = stepsResponse.data || [];

      // Fetch apps for runbook_apps
      const appIds = runbookAppsData.map(ra => ra.app_id);
      const appsResponse = appIds.length > 0 ? await fileClient.from('apps').select('*').in('id', appIds) : { data: [] };
      const appsData = appsResponse.data || [];

      // Fetch profiles for step assignments
      const assignedUserIds = stepsData.filter(s => s.assigned_to).map(s => s.assigned_to);
      const profilesResponse = assignedUserIds.length > 0 ? await fileClient.from('profiles').select('*').in('id', assignedUserIds) : { data: [] };
      const profilesData = profilesResponse.data || [];

      // Fetch step apps for each step
      const stepAppPromises = stepsData.map(async (step) => {
        const stepAppsResult = await fileClient.from('runbook_step_apps').select('*').eq('step_id', step.id);
        const stepAppsData = stepAppsResult.data || [];
        const stepApps = await Promise.all(stepAppsData.map(async (rsa) => {
          const appResult = await fileClient.from('apps').select('*').eq('id', rsa.app_id);
          return {
            app: appResult.data?.[0]
          };
        }));
        return { stepId: step.id, apps: stepApps };
      });
      const stepAppsMap = await Promise.all(stepAppPromises);
      const stepAppsLookup = stepAppsMap.reduce((acc, item) => {
        acc[item.stepId] = item.apps;
        return acc;
      }, {} as Record<string, any[]>);

      // Transform the data to match the expected type
      const transformedRunbook: PreviewRunbook = {
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
            tasks: step.tasks || [], // Ensure tasks is always an array
            assigned_user: assignedUser ? {
              first_name: assignedUser.first_name || '',
              last_name: assignedUser.last_name || '',
              email: assignedUser.email
            } : undefined,
            runbook_step_apps: stepAppsLookup[step.id] || []
          };
        }).sort((a, b) => a.step_order - b.step_order)
      };

      // Create mock step assignments to simulate execution view
      const mockStepAssignments: PreviewStepAssignment[] = transformedRunbook.steps.map((step, index) => ({
        id: `preview-${step.id}`,
        status: 'not_started', // Start all as not_started, will be filtered by visibility
        notes: null,
        started_at: null,
        completed_at: null,
        step: {
          id: step.id,
          title: step.title,
          description: step.description,
          step_order: step.step_order,
          estimated_duration_minutes: step.estimated_duration_minutes,
          tasks: step.tasks || [],
          photo_url: step.photo_url,
          conditions: step.conditions,
          runbook_step_apps: step.runbook_step_apps || []
        },
        assigned_profile: step.assigned_user ? {
          first_name: step.assigned_user.first_name,
          last_name: step.assigned_user.last_name
        } : undefined
      }));

      setRunbook(transformedRunbook);
      setAllStepAssignments(mockStepAssignments);
      setCurrentStepIndex(0);
    } catch (error) {
      console.error('Error fetching runbook preview data:', error);
      toast({
        title: "Error",
        description: "Failed to load runbook preview",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRunbookPreviewData();
  }, []);

  // Filter steps based on visibility rules
  const visibleStepAssignments = allStepAssignments.filter(assignment => {
    const visibilityRules = parseStepVisibilityRules(assignment.step);
    if (!visibilityRules || visibilityRules.length === 0) return true;
    return checkVisibility(visibilityRules);
  });

  // Set the first visible step as in_progress
  useEffect(() => {
    if (visibleStepAssignments.length > 0 && visibleStepAssignments[0].status === 'not_started') {
      setAllStepAssignments(prev => prev.map(sa => {
        if (sa.id === visibleStepAssignments[0].id) {
          return {
            ...sa,
            status: 'in_progress' as const,
            started_at: new Date().toISOString()
          };
        }
        return sa;
      }));
    }
  }, [visibleStepAssignments.length]);

  const getExecutionProgress = () => {
    if (!visibleStepAssignments || visibleStepAssignments.length === 0) return 0;
    const completedSteps = visibleStepAssignments.filter(sa => sa.status === 'completed').length;
    return Math.round((completedSteps / visibleStepAssignments.length) * 100);
  };

  const getStatusBadgeProps = (status: string) => {
    switch (status) {
      case 'completed':
        return { variant: 'secondary' as const, className: 'bg-green-100 text-green-800', text: 'Completed' };
      case 'in_progress':
        return { variant: 'secondary' as const, className: 'bg-blue-100 text-blue-800', text: 'In Progress' };
      case 'blocked':
        return { variant: 'secondary' as const, className: 'bg-red-100 text-red-800', text: 'Blocked' };
      default:
        return { variant: 'secondary' as const, className: 'bg-gray-100 text-gray-800', text: 'Not Started' };
    }
  };

  // Isolated function that only updates local state, doesn't affect actual runbook
  const handleStepStatusChange = (stepId: string, newStatus: 'not_started' | 'in_progress' | 'completed' | 'blocked', notes?: string) => {
    setAllStepAssignments(prev => prev.map(sa => {
      if (sa.id === stepId) {
        const updatedAssignment = {
          ...sa,
          status: newStatus,
          notes: notes !== undefined ? notes : sa.notes
        };
        
        if (newStatus === 'in_progress' && sa.status === 'not_started') {
          updatedAssignment.started_at = new Date().toISOString();
        } else if (newStatus === 'completed' && sa.status !== 'completed') {
          updatedAssignment.completed_at = new Date().toISOString();
        }
        
        return updatedAssignment;
      }
      return sa;
    }));
  };

  // Isolated function that only updates local task state, doesn't save to database
  const handleTasksUpdate = (stepId: string, updatedTasks: PreviewTask[]) => {
    setAllStepAssignments(prev => prev.map(sa => {
      if (sa.step.id === stepId) {
        return {
          ...sa,
          step: {
            ...sa.step,
            tasks: updatedTasks
          }
        };
      }
      return sa;
    }));
  };

  const navigateToStep = (direction: 'next' | 'prev') => {
    if (direction === 'next' && currentStepIndex < visibleStepAssignments.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else if (direction === 'prev' && currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const currentStep = visibleStepAssignments[currentStepIndex];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading preview...</p>
        </div>
      </div>
    );
  }

  if (!runbook) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium">Preview Unavailable</h3>
        <p className="text-muted-foreground">Unable to load runbook preview</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Execution Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{runbook.title} - Preview Execution</CardTitle>
              <CardDescription className="mt-2">
                {runbook.description || 'No description provided'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              {runbook.runbook_apps && runbook.runbook_apps.length > 0 && (
                <MultiAppDisplay 
                  appIds={runbook.runbook_apps.map(ra => ra.app.id)} 
                  size="md" 
                  maxDisplay={3} 
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>Team: {runbook.client?.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Started: {new Date().toLocaleDateString()}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progress ({visibleStepAssignments.length} visible steps)</span>
                <span className="font-medium">{getExecutionProgress()}%</span>
              </div>
              <Progress value={getExecutionProgress()} className="h-2" />
            </div>
            
            {/* Show conditional logic summary */}
            {allStepAssignments.length !== visibleStepAssignments.length && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                <Shuffle className="h-4 w-4" />
                <span>
                  {allStepAssignments.length - visibleStepAssignments.length} steps are hidden by conditional logic
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Steps Navigation */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Step {currentStepIndex + 1} of {visibleStepAssignments.length} 
          {visibleStepAssignments.length !== allStepAssignments.length && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({allStepAssignments.length} total steps)
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateToStep('prev')}
            disabled={currentStepIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateToStep('next')}
            disabled={currentStepIndex === visibleStepAssignments.length - 1}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Current Step */}
      {currentStep && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <CardTitle className="text-lg">{currentStep.step.title}</CardTitle>
                  <Badge {...getStatusBadgeProps(currentStep.status)}>
                    {getStatusBadgeProps(currentStep.status).text}
                  </Badge>
                  
                  {/* Step Conditional Logic Indicator */}
                  {hasStepConditions(currentStep.step) && (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                      <Shuffle className="h-3 w-3 mr-1" />
                      Conditional Step
                    </Badge>
                  )}
                  
                  {/* Tasks with Rules Indicator */}
                  {getTasksWithRulesCount(currentStep.step.tasks) > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          <Info className="h-3 w-3 mr-1" />
                          {getTasksWithRulesCount(currentStep.step.tasks)} Conditional Tasks
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="text-sm">
                          <strong>{getTasksWithRulesCount(currentStep.step.tasks)} tasks have conditional visibility rules</strong><br />
                          Tasks may show/hide based on previous answers
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {currentStep.step.description && (
                  <CardDescription>{currentStep.step.description}</CardDescription>
                )}
              </div>
              {currentStep.step.runbook_step_apps && currentStep.step.runbook_step_apps.length > 0 && (
                <MultiAppDisplay 
                  appIds={currentStep.step.runbook_step_apps.map(rsa => rsa.app.id)} 
                  size="sm" 
                  maxDisplay={3} 
                />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step Photo */}
            {currentStep.step.photo_url && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Reference Image</Label>
                <div className="border rounded-lg p-2">
                  <img
                    src={getStepPhotoUrl(currentStep.step.photo_url)}
                    alt="Step reference"
                    className="max-w-full h-auto rounded cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setLightboxPhoto({
                      url: getStepPhotoUrl(currentStep.step.photo_url),
                      caption: currentStep.step.title,
                      stepData: {
                        title: currentStep.step.title,
                        description: currentStep.step.description || undefined
                      }
                    })}
                  />
                </div>
              </div>
            )}

            {/* Tasks */}
            {currentStep.step.tasks && currentStep.step.tasks.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tasks</Label>
                <PreviewTasksListWrapper
                  stepId={currentStep.step.id}
                  tasks={currentStep.step.tasks}
                  onTasksUpdate={(updatedTasks) => handleTasksUpdate(currentStep.step.id, updatedTasks)}
                />
              </div>
            )}

            {/* Step Controls */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {currentStep.step.estimated_duration_minutes && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Est. {currentStep.step.estimated_duration_minutes} min</span>
                    </div>
                  )}
                  {currentStep.assigned_profile && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>Assigned to: {currentStep.assigned_profile.first_name} {currentStep.assigned_profile.last_name}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {currentStep.status === 'not_started' && (
                    <Button
                      size="sm"
                      onClick={() => handleStepStatusChange(currentStep.id, 'in_progress')}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start Step
                    </Button>
                  )}
                  {currentStep.status === 'in_progress' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStepStatusChange(currentStep.id, 'blocked')}
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Mark Blocked
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleStepStatusChange(currentStep.id, 'completed')}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Complete Step
                      </Button>
                    </>
                  )}
                  {currentStep.status === 'completed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStepStatusChange(currentStep.id, 'in_progress')}
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      Reopen Step
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Notes Section */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Notes</Label>
              <Textarea
                placeholder="Add notes about this step..."
                value={currentStep.notes || ''}
                onChange={(e) => handleStepStatusChange(currentStep.id, currentStep.status, e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Steps Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Steps Overview</CardTitle>
          <CardDescription>
            Click on any step to navigate to it. Purple badges indicate conditional logic.
            {allStepAssignments.length !== visibleStepAssignments.length && (
              <span className="block mt-1 text-amber-700">
                {allStepAssignments.length - visibleStepAssignments.length} steps are currently hidden by conditional logic.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {visibleStepAssignments.map((assignment, index) => (
              <div
                key={assignment.id}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  currentStepIndex === index ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                }`}
                onClick={() => setCurrentStepIndex(index)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{assignment.step.title}</h4>
                      
                      {/* Step Conditional Logic Indicator */}
                      {hasStepConditions(assignment.step) && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                          <Shuffle className="h-2 w-2 mr-1" />
                          Conditional
                        </Badge>
                      )}
                      
                      {/* Tasks with Rules Indicator */}
                      {getTasksWithRulesCount(assignment.step.tasks) > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                              <Info className="h-2 w-2 mr-1" />
                              {getTasksWithRulesCount(assignment.step.tasks)}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <p className="text-sm">
                              <strong>{getTasksWithRulesCount(assignment.step.tasks)} tasks with conditional rules</strong><br />
                              Some tasks may show/hide based on answers
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    {assignment.step.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {assignment.step.description}
                      </p>
                    )}
                  </div>
                </div>
                <Badge {...getStatusBadgeProps(assignment.status)}>
                  {getStatusBadgeProps(assignment.status).text}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Photo Lightbox */}
      {lightboxPhoto && (
        <PhotoLightbox
          isOpen={true}
          photoUrl={lightboxPhoto.url}
          caption={lightboxPhoto.caption}
          onClose={() => setLightboxPhoto(null)}
          contextType="step"
          contextData={lightboxPhoto.stepData}
        />
      )}
    </div>
  );
}

export function ClientPreviewModal({ runbookId }: ClientPreviewModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);

  // Check if user has admin permissions to see the preview button
  const canShowPreview = () => {
    if (!profile) return false;
    return profile.role === 'kelyn_admin' || profile.role === 'kelyn_rep' || profile.role === 'client_admin';
  };

  if (!canShowPreview()) {
    return null;
  }

  return (
    <TooltipProvider>
      {/* Floating Preview Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-primary hover:bg-primary/90"
        size="icon"
        title="Preview how client members will see this runbook"
      >
        <Eye className="h-6 w-6" />
      </Button>

      {/* Preview Modal - Wrapped in WorkflowAnswersProvider for conditional logic */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl h-[90vh] overflow-hidden p-0 flex flex-col">
          <DialogHeader className="p-6 pb-0 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-semibold">Client Member Preview</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  This is how client members will see and interact with this runbook during execution. 
                  Conditional logic is active - steps and tasks will show/hide based on answers.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-6 pt-4">
            <WorkflowAnswersProvider>
              <ClientPreviewModalContent runbookId={runbookId} />
            </WorkflowAnswersProvider>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
} 