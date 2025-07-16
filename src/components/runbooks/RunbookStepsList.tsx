import React, { useState, useEffect, useRef } from 'react';
import { fileClient } from '@/lib/fileClient';
import { RunbookStep as DBRunbookStep } from '@/lib/database';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Clock, Edit, Trash2, ArrowUp, ArrowDown, User, Camera, Image, CheckCircle, X, ChevronDown, ChevronRight, Settings, GitBranch, HelpCircle, ListCollapse, ListEnd, ArrowRight, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserSelector } from './UserSelector';
import { StepPhotoUpload } from './StepPhotoUpload';
import { PhotoLightbox } from './PhotoLightbox';
import { TasksList } from './TasksList';
import { MultiAppDisplay } from './MultiAppDisplay';
import { MultiAppSelector } from './MultiAppSelector';
import { WorkflowCondition, TaskQuestion } from '@/types/workflow';
import { DecisionPoint } from '@/types/workflow';
import { UnifiedWorkflowEditor } from './UnifiedWorkflowEditor';
import { getStepPhotoUrl, getRelativeFileUrl } from '@/utils/urlUtils';
import { useWorkflowAnswers, QuestionDefinition, VisibilityRule } from '@/hooks/useWorkflowAnswers';
import { QuestionRenderer } from './QuestionRenderer';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { InlineStepDetailsEditor } from './InlineStepDetailsEditor';
import { StepNumberBadge } from './StepNumberBadge';
import { StepInfoPills } from './StepInfoPills';

type RunbookStep = DBRunbookStep & {
  assigned_user?: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
};
interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  order: number;
  conditions?: WorkflowCondition | null;
  question?: TaskQuestion | null;
}
interface AvailableStep {
  id: string;
  title: string;
  stepOrder: number;
  conditions?: {
    type: string;
    options: string[];
  } | null;
}
interface RunbookStepsListProps {
  runbookId: string;
  clientId: string;
  canEdit: boolean;
  scrollToNewStep?: boolean;
  onScrollComplete?: () => void;
}
export function RunbookStepsList({
  runbookId,
  clientId,
  canEdit,
  scrollToNewStep,
  onScrollComplete
}: RunbookStepsListProps) {
  const [steps, setSteps] = useState<RunbookStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [lightboxStepId, setLightboxStepId] = useState<string | null>(null);
  const [openSteps, setOpenSteps] = useState<string[]>([]);
  const [editingStepApp, setEditingStepApp] = useState<string | null>(null);
  const [stepAppIds, setStepAppIds] = useState<Record<string, string[]>>({});
  const [workflowPopoverOpen, setWorkflowPopoverOpen] = useState<Record<string, boolean>>({});
  const [questionPopoverOpen, setQuestionPopoverOpen] = useState<Record<string, boolean>>({});
  const [visibilityPopoverOpen, setVisibilityPopoverOpen] = useState<Record<string, boolean>>({});
  const [editingSteps, setEditingSteps] = useState<Record<string, boolean>>({});
  const {
    toast
  } = useToast();
  const {
    checkVisibility
  } = useWorkflowAnswers();
  const {
    user
  } = useAuth();
  const {
    profile
  } = useProfile(user?.id);
  const stepsContainerRef = useRef<HTMLDivElement>(null);
  const lastStepRef = useRef<HTMLDivElement>(null);

  // Determine if user can edit step/task content (not just status)
  const canEditContent = canEdit && profile?.role !== 'client_member';
  useEffect(() => {
    fetchSteps();
    fetchStepApps();
  }, [runbookId]);

  // Scroll to the last step when a new step is added
  useEffect(() => {
    if (scrollToNewStep && steps.length > 0 && lastStepRef.current) {
      const timeout = setTimeout(() => {
        lastStepRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
        if (onScrollComplete) {
          onScrollComplete();
        }
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [scrollToNewStep, steps.length, onScrollComplete]);
  const fetchSteps = async (preserveAccordionState: boolean = false) => {
    try {
      console.log('RunbookStepsList: Fetching steps for runbook:', runbookId);
      const stepsResponse = await fileClient.from('runbook_steps').select('*').eq('runbook_id', runbookId);
      console.log('RunbookStepsList: Steps response:', stepsResponse);
      const stepsData = stepsResponse.data || [];
      console.log('RunbookStepsList: Steps data length:', stepsData.length);

      // Fetch assigned users for steps
      const assignedUserIds = stepsData.filter(s => s.assigned_to).map(s => s.assigned_to);
      console.log('RunbookStepsList: Assigned user IDs:', assignedUserIds);
      const profilesResponse = assignedUserIds.length > 0 ? await fileClient.from('profiles').select('*').in('id', assignedUserIds) : { data: [] };
      const profilesData = profilesResponse.data || [];
      console.log('RunbookStepsList: Profiles data:', profilesData);

      // Transform steps with assigned user data and reset task completion states
      const transformedSteps = stepsData.map(step => {
        const assignedUser = step.assigned_to ? profilesData.find(p => p.id === step.assigned_to) : null;
        
        // Reset all task completion states to false for temporary interaction
        let resetTasks = step.tasks;
        if (resetTasks && Array.isArray(resetTasks)) {
          resetTasks = resetTasks.map((task: any) => ({
            ...task,
            completed: false
          }));
        }
        
        return {
          ...step,
          tasks: resetTasks,
          assigned_user: assignedUser ? {
            first_name: assignedUser.first_name,
            last_name: assignedUser.last_name,
            email: assignedUser.email
          } : null
        };
      }).sort((a, b) => a.step_order - b.step_order);

      console.log('RunbookStepsList: Transformed steps:', transformedSteps);
      setSteps(transformedSteps);
      
      // Only reset accordion state if not preserving it
      if (!preserveAccordionState) {
        // Start with all steps collapsed by default
        setOpenSteps([]);
      }
    } catch (error) {
      console.error('Error fetching runbook steps:', error);
      toast({
        title: "Error",
        description: "Failed to load runbook steps",
        variant: "destructive"
      });
    }
    setLoading(false);
  };
  
  const fetchStepApps = async () => {
    try {
      const stepIds = steps.map(step => step.id);
      if (stepIds.length === 0) return;
      
      const stepAppsResponse = await fileClient.from('runbook_step_apps').select('*').in('step_id', stepIds);
      const stepAppsData = stepAppsResponse.data || [];
      
      const appsByStep: Record<string, string[]> = {};
      stepAppsData.forEach(item => {
        if (!appsByStep[item.step_id]) {
          appsByStep[item.step_id] = [];
        }
        appsByStep[item.step_id].push(item.app_id);
      });
      setStepAppIds(appsByStep);
    } catch (error) {
      console.error('Error fetching step apps:', error);
    }
  };

  // Re-fetch step apps when steps change
  useEffect(() => {
    if (steps.length > 0) {
      fetchStepApps();
    }
  }, [steps]);
  const toggleStep = (stepId: string) => {
    // Don't allow toggling if step is being edited
    if (editingSteps[stepId]) return;
    setOpenSteps(prev => {
      if (prev.includes(stepId)) {
        return prev.filter(id => id !== stepId);
      } else {
        return [...prev, stepId];
      }
    });
  };
  const collapseAll = () => {
    setOpenSteps([]);
  };
  const expandAll = () => {
    const visibleSteps = steps.filter(step => {
      const visibilityRules = parseStepVisibilityRules(step);
      if (!visibilityRules || visibilityRules.length === 0) return true;
      return checkVisibility(visibilityRules);
    });
    setOpenSteps(visibleSteps.map(step => step.id));
  };
  const openNextIncompleteStep = (currentStepId?: string) => {
    const visibleSteps = steps.filter(step => {
      const visibilityRules = parseStepVisibilityRules(step);
      if (!visibilityRules || visibilityRules.length === 0) return true;
      return checkVisibility(visibilityRules);
    });

    let nextIncompleteStep;
    
    if (currentStepId) {
      // Find the current step index and look for the next incomplete step after it
      const currentStepIndex = visibleSteps.findIndex(step => step.id === currentStepId);
      if (currentStepIndex !== -1) {
        // Look for the next incomplete step after the current one
        nextIncompleteStep = visibleSteps.slice(currentStepIndex + 1).find(step => {
          const tasks = parseTasksFromStep(step);
          const completion = getStepCompletionStatus(tasks);
          return completion.percentage < 100;
        });
      }
    } else {
      // If no current step specified, find the first incomplete step
      nextIncompleteStep = visibleSteps.find(step => {
        const tasks = parseTasksFromStep(step);
        const completion = getStepCompletionStatus(tasks);
        return completion.percentage < 100;
      });
    }

    if (nextIncompleteStep) {
      // Close all steps and open only the next incomplete one
      setOpenSteps([nextIncompleteStep.id]);
      
      // Calculate proper scroll position to avoid cutting off the header
      setTimeout(() => {
        const stepElement = document.querySelector(`[data-step-id="${nextIncompleteStep.id}"]`);
        if (stepElement) {
          const elementRect = stepElement.getBoundingClientRect();
          const elementTop = elementRect.top + window.pageYOffset;
          
          // Calculate how much space is needed at the top
          // Check for fixed headers, navbars, or any sticky elements
          let topOffset = 20; // Base padding
          
          // Look for common fixed/sticky elements
          const fixedElements = document.querySelectorAll('[style*="position: fixed"], [style*="position: sticky"], .fixed, .sticky');
          fixedElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            // If the element is at the top of the viewport and has height
            if (rect.top <= 10 && rect.height > 0) {
              topOffset = Math.max(topOffset, rect.height + 20);
            }
          });
          
          // Also check for any header elements by class or tag
          const headers = document.querySelectorAll('header, nav, .header, .navbar, .app-header');
          headers.forEach(header => {
            const rect = header.getBoundingClientRect();
            if (rect.top <= 10 && rect.height > 0) {
              topOffset = Math.max(topOffset, rect.height + 20);
            }
          });
          
          // Ensure we have at least some padding and don't exceed reasonable limits
          topOffset = Math.max(topOffset, 80); // Minimum 80px
          topOffset = Math.min(topOffset, 200); // Maximum 200px
          
          window.scrollTo({
            top: elementTop - topOffset,
            behavior: 'smooth'
          });
        }
      }, 100);
    } else {
      // No more incomplete steps, close all
      setOpenSteps([]);
    }
  };
  const handleStepEditingChange = (stepId: string, isEditing: boolean) => {
    setEditingSteps(prev => ({
      ...prev,
      [stepId]: isEditing
    }));
  };
  const handleDeleteStep = async (stepId: string) => {
    try {
      await fileClient.from('runbook_steps').delete().eq('id', stepId);
      toast({
        title: "Success",
        description: "Step deleted successfully"
      });
      fetchSteps();
    } catch (error) {
      console.error('Error deleting step:', error);
      toast({
        title: "Error",
        description: "Failed to delete step",
        variant: "destructive"
      });
    }
  };
  const handleMoveStep = async (stepId: string, direction: 'up' | 'down') => {
    const currentStep = steps.find(s => s.id === stepId);
    if (!currentStep) return;
    const targetOrder = direction === 'up' ? currentStep.step_order - 1 : currentStep.step_order + 1;
    const targetStep = steps.find(s => s.step_order === targetOrder);
    if (!targetStep) return;
    try {
      await fileClient.from('runbook_steps').update({
        step_order: targetOrder,
        updated_at: new Date().toISOString()
      }).eq('id', currentStep.id);
      
      await fileClient.from('runbook_steps').update({
        step_order: currentStep.step_order,
        updated_at: new Date().toISOString()
      }).eq('id', targetStep.id);
      
      toast({
        title: "Success",
        description: "Step order updated successfully"
      });
      // Preserve accordion state when reordering steps
      fetchSteps(true);
    } catch (error) {
      console.error('Error moving step:', error);
      toast({
        title: "Error",
        description: "Failed to move step",
        variant: "destructive"
      });
    }
  };
  const handleAssignmentChange = async (stepId: string, userId: string | undefined) => {
    try {
      await fileClient.from('runbook_steps').update({
        assigned_to: userId || null,
        updated_at: new Date().toISOString()
      }).eq('id', stepId);
      
      toast({
        title: "Success",
        description: "Assignment updated successfully"
      });
      
      // Fetch steps while preserving the current accordion state
      await fetchSteps(true);
    } catch (error) {
      console.error('Error updating assignment:', error);
      toast({
        title: "Error",
        description: "Failed to update assignment",
        variant: "destructive"
      });
    }
  };
  const handleUpdateStepApps = async (stepId: string, appIds: string[]) => {
    try {
      // Delete existing app assignments for this step - need to delete all, not just one
      const existingAppsResponse = await fileClient.from('runbook_step_apps').select('*').eq('step_id', stepId);
      const existingApps = existingAppsResponse.data || [];
      
      // Delete each existing app assignment individually
      for (const existingApp of existingApps) {
        await fileClient.from('runbook_step_apps').delete().eq('id', existingApp.id);
      }

      // Insert new app assignments one by one
      if (appIds.length > 0) {
        for (const appId of appIds) {
          await fileClient.from('runbook_step_apps').insert({
            id: crypto.randomUUID(),
            step_id: stepId,
            app_id: appId,
            created_at: new Date().toISOString()
          });
        }
      }
      setStepAppIds(prev => ({
        ...prev,
        [stepId]: appIds
      }));
      setEditingStepApp(null);
      toast({
        title: "Success",
        description: "App assignments updated"
      });
    } catch (error) {
      console.error('Error updating step apps:', error);
      toast({
        title: "Error",
        description: "Failed to update app assignments",
        variant: "destructive"
      });
    }
  };
  const handlePhotoUploaded = (stepId: string, photoUrl: string) => {
    setSteps(prevSteps => prevSteps.map(step => step.id === stepId ? {
      ...step,
      photo_url: getRelativeFileUrl(photoUrl)
    } : step));
  };
  const handleRemoveStepPhoto = async (stepId: string) => {
    try {
      // Get auth token from storage
      const session = localStorage.getItem('file_session');
      const headers: HeadersInit = {};
      
      if (session) {
        const sessionData = JSON.parse(session);
        headers['Authorization'] = `Bearer ${sessionData.access_token}`;
      }

      // Call the server endpoint to remove the photo
      const response = await fetch(`http://localhost:3001/api/steps/${stepId}/photo`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove photo');
      }
      
      setSteps(prevSteps => prevSteps.map(step => step.id === stepId ? {
        ...step,
        photo_url: null
      } : step));
      toast({
        title: "Success",
        description: "Photo removed successfully"
      });
    } catch (error) {
      console.error('Error removing step photo:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove photo",
        variant: "destructive"
      });
    }
  };
  const handleTasksUpdate = (stepId: string, tasks: Task[]) => {
    // Only update local state - don't save to database for temporary interaction
    setSteps(prevSteps => prevSteps.map(step => step.id === stepId ? {
      ...step,
      tasks: tasks as unknown as any
    } : step));

    // Note: Task completion is now temporary and not saved to database
    // State resets when navigating away and returning to the runbook
  };
  const getStepCompletionStatus = (tasks: Task[]) => {
    if (!tasks || tasks.length === 0) return {
      completed: 0,
      total: 0,
      percentage: 0
    };
    
    // Filter tasks based on visibility rules - check if task has conditions that affect visibility
    const visibleTasks = tasks.filter(task => {
      if (!task.conditions) return true;
      // For now, assume all tasks with conditions are visible
      // The actual visibility logic should be handled by the TasksList component
      return true;
    });
    
    const completed = visibleTasks.filter(task => task.completed).length;
    return {
      completed,
      total: visibleTasks.length,
      percentage: visibleTasks.length > 0 ? Math.round(completed / visibleTasks.length * 100) : 0
    };
  };
  const parseTasksFromStep = (step: RunbookStep): Task[] => {
    if (!step.tasks) return [];
    try {
      const parsed = step.tasks as unknown as Task[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const parseStepQuestion = (step: RunbookStep): QuestionDefinition | null => {
    if (!step.conditions || typeof step.conditions !== 'object') return null;
    try {
      const conditions = step.conditions as any;
      if (conditions.question) {
        return {
          id: conditions.question.id || 'step-question',
          question: conditions.question.question || '',
          type: conditions.question.type || 'yes_no',
          options: conditions.question.options || [],
          required: conditions.question.required || false
        };
      }
    } catch {
      return null;
    }
    return null;
  };
  const parseStepVisibilityRules = (step: RunbookStep): VisibilityRule[] => {
    if (!step.conditions || typeof step.conditions !== 'object') return [];
    try {
      const conditions = step.conditions as any;
      return conditions.visibilityRules || [];
    } catch {
      return [];
    }
  };
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
    steps.forEach(step => {
      // Add step-level question
      const stepQuestion = parseStepQuestion(step);
      if (stepQuestion) {
        questions.push({
          stepId: step.id,
          stepTitle: step.title,
          stepOrder: step.step_order,
          questionId: stepQuestion.id,
          question: stepQuestion.question,
          options: stepQuestion.type === 'yes_no' ? ['yes', 'no'] : stepQuestion.options || []
        });
      }

      // Add task-level questions
      const tasks = parseTasksFromStep(step);
      tasks.forEach(task => {
        if (task.question) {
          questions.push({
            stepId: step.id,
            stepTitle: step.title,
            stepOrder: step.step_order,
            taskId: task.id,
            taskTitle: task.title,
            questionId: task.question.id,
            question: task.question.question,
            options: task.question.type === 'yes_no' ? ['yes', 'no'] : task.question.options || []
          });
        }
      });
    });
    return questions;
  };
  const getAvailableStepsForWorkflow = (currentStepId: string): AvailableStep[] => {
    return steps.filter(step => step.id !== currentStepId).map(step => {
      // Create mock conditions for steps that have questions in their tasks
      const tasks = parseTasksFromStep(step);
      const stepWithQuestions = tasks.find(task => task.question && task.question.options && task.question.options.length > 0);
      return {
        id: step.id,
        title: step.title,
        stepOrder: step.step_order,
        conditions: stepWithQuestions ? {
          type: stepWithQuestions.question?.type || 'select',
          options: stepWithQuestions.question?.options || []
        } : null
      };
    });
  };
  const handleWorkflowChange = async (stepId: string, workflow: any) => {
    try {
      await fileClient.from('runbook_steps').update({
        conditions: workflow,
        updated_at: new Date().toISOString()
      }).eq('id', stepId);
      
      toast({
        title: "Success",
        description: "Workflow logic updated"
      });
      setWorkflowPopoverOpen(prev => ({
        ...prev,
        [stepId]: false
      }));
      // Preserve accordion state when updating workflow logic
      fetchSteps(true);
    } catch (error) {
      console.error('Error updating workflow:', error);
      toast({
        title: "Error",
        description: "Failed to update workflow logic",
        variant: "destructive"
      });
    }
  };
  const toggleWorkflowPopover = (stepId: string) => {
    setWorkflowPopoverOpen(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }));
  };

  const toggleQuestionPopover = (stepId: string) => {
    setQuestionPopoverOpen(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }));
  };

  const toggleVisibilityPopover = (stepId: string) => {
    setVisibilityPopoverOpen(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }));
  };
  const handleStepDetailsUpdate = (stepId: string, updates: {
    title?: string;
    description?: string;
    estimated_duration_minutes?: number;
  }) => {
    setSteps(prevSteps => prevSteps.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  };
  function StepsSkeleton() {
    return <div className="space-y-4">
        {Array.from({
        length: 3
      }).map((_, index) => <Card key={index} className="overflow-hidden border-l-4 border-l-primary/20 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-start gap-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-72" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>)}
      </div>;
  }
  if (loading) {
    return (
      <TooltipProvider>
        <StepsSkeleton />
      </TooltipProvider>
    );
  }
  if (steps.length === 0) {
    return (
      <div className="text-left py-8">
        <Clock className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No steps defined yet</p>
        <p className="text-sm text-muted-foreground mt-2">Add your first step to get started</p>
      </div>
    );
  }

  // Check if there's a next incomplete step after the current one
  const getNextIncompleteStep = (currentStepId: string) => {
    const visibleSteps = steps.filter(step => {
      const visibilityRules = parseStepVisibilityRules(step);
      if (!visibilityRules || visibilityRules.length === 0) return true;
      return checkVisibility(visibilityRules);
    });

    const currentStepIndex = visibleSteps.findIndex(step => step.id === currentStepId);
    if (currentStepIndex !== -1) {
      return visibleSteps.slice(currentStepIndex + 1).find(step => {
        const tasks = parseTasksFromStep(step);
        const completion = getStepCompletionStatus(tasks);
        return completion.percentage < 100;
      });
    }
    return null;
  };

  // Apply workflow filtering and calculate dynamic numbering
  const stepsWithVisibility = steps.map(step => {
    const visibilityRules = parseStepVisibilityRules(step);
    const isVisible = !visibilityRules || visibilityRules.length === 0 || checkVisibility(visibilityRules);
    return { ...step, isVisible };
  });
  
  // Only count visible steps for numbering
  const visibleSteps = stepsWithVisibility.filter(step => step.isVisible);

  // Get all available questions for the entire runbook
  const allAvailableQuestions = getAllAvailableQuestions();
  
  return (
    <TooltipProvider>
      <div className="space-y-4" ref={stepsContainerRef}>
        {/* Collapse/Expand Controls */}
        <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border">
          <div className="text-sm font-medium text-muted-foreground">
            {visibleSteps.length} step{visibleSteps.length !== 1 ? 's' : ''} • {openSteps.length} expanded
          </div>
          <div className="flex items-left gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (openSteps.length === visibleSteps.length) {
                  collapseAll();
                } else {
                  expandAll();
                }
              }}
              className="text-xs text-left min-w-32"
            >
              {openSteps.length === visibleSteps.length ? (
                <>
                  <ListCollapse className="h-3 w-3 mr-1" />
                  Collapse All
                </>
              ) : (
                <>
                  <ListEnd className="h-3 w-3 mr-1" />
                  Expand All
                </>
              )}
            </Button>
          </div>
        </div>

        <Accordion type="multiple" value={openSteps} onValueChange={setOpenSteps} className="space-y-4">
          {stepsWithVisibility.map((step, stepIndex) => {
            const tasks = parseTasksFromStep(step);
            const stepQuestion = parseStepQuestion(step);
            const visibilityRules = parseStepVisibilityRules(step);
            const completion = getStepCompletionStatus(tasks);
            const stepApps = stepAppIds[step.id] || [];
            const hasWorkflowLogic = Boolean(stepQuestion) || visibilityRules && visibilityRules.length > 0;
            const isLastStep = stepIndex === stepsWithVisibility.length - 1;
            const isStepEditing = editingSteps[step.id];
            // Dynamic step numbering - only count visible steps before this one
            const visibleStepsBeforeThis = stepsWithVisibility.slice(0, stepIndex).filter(s => s.isVisible).length;
            const dynamicStepNumber = step.isVisible ? visibleStepsBeforeThis + 1 : null;
            const isExpanded = openSteps.includes(step.id);
            const isStepComplete = completion.percentage === 100;
            const nextIncompleteStep = getNextIncompleteStep(step.id);
            
            // Generate a color for the left border based on the step order - using gray gradient
            const grayColors = [
              'border-l-gray-200',
              'border-l-gray-300', 
              'border-l-gray-400',
              'border-l-gray-500',
              'border-l-gray-600',
              'border-l-gray-700',
              'border-l-gray-800',
              'border-l-gray-900',
            ];
            
            const borderColor = grayColors[stepIndex % grayColors.length];

            return (
              <AccordionItem key={step.id} value={step.id} className="border-none">
                <div className="space-y-3" ref={isLastStep ? lastStepRef : undefined} data-step-id={step.id}>
                  <Card className={`overflow-hidden shadow-none hover:shadow-sm hover:bg-muted/40 transition-all duration-300 ease-in-out border-l-4 ${borderColor} relative ${
                    !step.isVisible 
                      ? isExpanded 
                        ? 'opacity-75 grayscale' 
                        : 'opacity-40 grayscale'
                      : ''
                  }`}>
                    {/* Step Number Badge - positioned absolutely */}
                    <StepNumberBadge displayNumber={step.isVisible ? dynamicStepNumber : null} />
                    
                    <AccordionTrigger className="hover:no-underline p-0 [&>svg]:hidden" onClick={() => toggleStep(step.id)} disabled={isStepEditing}>
                      <CardHeader className={`pb-3 w-full relative transition-all duration-200 pl-20 ${!isStepEditing ? 'cursor-pointer hover:bg-muted/20' : ''} ${isExpanded ? 'pb-4' : 'pb-6'}`}>
                        <div className="flex items-center gap-3 pr-8">
                          {/* Main Content - Compact when collapsed */}
                          <div className="flex-1 min-w-0 flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              {/* Title and basic info */}
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  {isExpanded ? (
                                    <InlineStepDetailsEditor
                                      stepId={step.id}
                                      title={step.title}
                                      description={step.description}
                                      estimatedDurationMinutes={step.estimated_duration_minutes}
                                      canEdit={canEditContent}
                                      onUpdate={(updates) => handleStepDetailsUpdate(step.id, updates)}
                                      onEditingChange={(isEditing) => handleStepEditingChange(step.id, isEditing)}
                                    />
                                  ) : (
                                    <>
                                      <h3 className="text-lg font-semibold text-gray-900 truncate text-left">
                                        {step.title}
                                      </h3>
                                      <div className="flex items-center gap-2 mt-1">
                                        {completion.total > 0 && (
                                          <Badge variant={completion.percentage === 100 ? 'default' : 'secondary'} className="text-xs">
                                            {completion.completed}/{completion.total}
                                          </Badge>
                                        )}
                                        {step.estimated_duration_minutes && (
                                          <Badge variant="outline" className="text-xs">
                                            <Clock className="h-3 w-3 mr-1" />
                                            {step.estimated_duration_minutes}m
                                          </Badge>
                                        )}
                                        {step.assigned_user && (
                                          <Badge variant="outline" className="text-xs">
                                            <User className="h-3 w-3 mr-1" />
                                            {step.assigned_user.first_name}
                                          </Badge>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                                
                                {/* Right side content: Photo thumbnail and App logos */}
                                <div className="flex-shrink-0 ml-4 flex items-center gap-3" style={{ width: '25%', minWidth: '200px' }}>
                                  {/* Step photo thumbnail */}
                                  {step.photo_url && (
                                    <div 
                                      className="relative cursor-pointer group rounded-lg overflow-hidden border-2 border-white shadow-sm w-16 h-12 shrink-0 hover:shadow-md transition-shadow"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setLightboxPhoto(getStepPhotoUrl(step.photo_url));
                                        setLightboxStepId(step.id);
                                      }}
                                    >
                                      <img
                                        src={getStepPhotoUrl(step.photo_url)}
                                        alt={`Step ${dynamicStepNumber} thumbnail`}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                      />
                                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                                        <Image className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* App logos */}
                                  {stepApps.length > 0 && (
                                    <div className="flex-1 min-w-0">
                                      <MultiAppDisplay 
                                        appIds={stepApps} 
                                        size="sm" 
                                        maxDisplay={step.photo_url ? 3 : 5} 
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Info Pills - only show when expanded, excluding apps since they're now on the right */}
                              {isExpanded && (
                                <div className="mt-3">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {step.estimated_duration_minutes && (
                                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                                        <Clock className="h-3 w-3" />
                                        <span>{step.estimated_duration_minutes} min</span>
                                      </div>
                                    )}
                                    
                                    {hasWorkflowLogic && (
                                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                        <GitBranch className="h-3 w-3 mr-1" />
                                        Smart Logic
                                      </Badge>
                                    )}
                                    
                                    {!step.isVisible && (
                                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                        <Eye className="h-3 w-3 mr-1" />
                                        Hidden by Rules
                                      </Badge>
                                    )}
                                    
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 text-gray-700 rounded-full text-xs font-medium">
                                      <User className="h-3 w-3" />
                                      <span>
                                        {step.assigned_user ? `${step.assigned_user.first_name} ${step.assigned_user.last_name}` : 'Unassigned'}
                                      </span>
                                    </div>
                                    
                                    {completion.total > 0 && (
                                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                        completion.percentage === 100 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                                      }`}>
                                        <CheckCircle className="h-3 w-3" />
                                        <span>{completion.completed}/{completion.total} tasks</span>
                                        <span className="ml-1 px-1.5 py-0.5 bg-white/60 rounded text-xs">
                                          {completion.percentage}%
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {/* Control buttons - only show when expanded and for content editors */}
                            {isExpanded && canEditContent && (
                              <div className="flex items-center gap-1 ml-4" onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" onClick={() => handleMoveStep(step.id, 'up')} disabled={stepIndex === 0} className="h-8 w-8 p-0">
                                  <ArrowUp className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleMoveStep(step.id, 'down')} disabled={stepIndex === stepsWithVisibility.length - 1} className="h-8 w-8 p-0">
                                  <ArrowDown className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteStep(step.id)} className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Chevron Icon - positioned absolutely, only show if not editing */}
                        {!isStepEditing && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        )}
                      </CardHeader>
                    </AccordionTrigger>
                    
                    <AccordionContent className="pb-0">
                      <CardContent className="pt-0 pb-6 space-y-6 pl-20">
                        {/* Compact Assignment Section - only show for content editors */}
                        {canEditContent && <div className="bg-gray-50/50 rounded-lg p-3 border border-gray-100">
                            {/* Compact grid layout with uniform sizing */}
                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                              {/* User Assignment */}
                              <div className="space-y-1">
                                <span className="text-xs font-medium text-gray-600">Assign to:</span>
                                <UserSelector value={step.assigned_to || undefined} onValueChange={userId => handleAssignmentChange(step.id, userId)} placeholder="Select user..." />
                              </div>

                              {/* App Assignment */}
                              <div className="space-y-1">
                                <span className="text-xs font-medium text-gray-600">Apps:</span>
                                <MultiAppSelector selectedAppIds={stepApps} onAppsChange={appIds => handleUpdateStepApps(step.id, appIds)} placeholder="Select apps..." />
                              </div>

                              {/* Question Logic */}
                              <div className="space-y-1">
                                <span className="text-xs font-medium text-gray-600">Question:</span>
                                <Popover open={questionPopoverOpen[step.id] || false} onOpenChange={() => toggleQuestionPopover(step.id)}>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className={`h-9 w-full text-xs ${stepQuestion ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}`}>
                                      <HelpCircle className="h-3 w-3 mr-1" />
                                      {stepQuestion ? 'Edit' : 'Add'}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-96 p-4" align="end">
                                    <UnifiedWorkflowEditor 
                                      workflow={step.conditions} 
                                      onWorkflowChange={workflow => handleWorkflowChange(step.id, workflow)} 
                                      availableSteps={getAvailableStepsForWorkflow(step.id)} 
                                      availableQuestions={allAvailableQuestions}
                                      defaultTab="question"
                                      autoExpand={true}
                                      onCancel={() => setQuestionPopoverOpen(prev => ({ ...prev, [step.id]: false }))}
                                      currentStepOrder={step.step_order}
                                    />
                                  </PopoverContent>
                                </Popover>
                              </div>

                              {/* Show/Hide Logic */}
                              <div className="space-y-1">
                                <span className="text-xs font-medium text-gray-600">Show/Hide:</span>
                                <Popover open={visibilityPopoverOpen[step.id] || false} onOpenChange={() => toggleVisibilityPopover(step.id)}>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className={`h-9 w-full text-xs ${visibilityRules && visibilityRules.length > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}`}>
                                      <GitBranch className="h-3 w-3 mr-1" />
                                      {visibilityRules && visibilityRules.length > 0 ? 'Edit' : 'Logic'}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-96 p-4" align="end">
                                    <UnifiedWorkflowEditor 
                                      workflow={step.conditions} 
                                      onWorkflowChange={workflow => handleWorkflowChange(step.id, workflow)} 
                                      availableSteps={getAvailableStepsForWorkflow(step.id)} 
                                      availableQuestions={allAvailableQuestions}
                                      defaultTab="visibility"
                                      autoExpand={true}
                                      onCancel={() => setVisibilityPopoverOpen(prev => ({ ...prev, [step.id]: false }))}
                                      currentStepOrder={step.step_order}
                                    />
                                  </PopoverContent>
                                </Popover>
                              </div>

                              {/* Step Photo */}
                              <div className="space-y-1">
                                <span className="text-xs font-medium text-gray-600">Photo:</span>
                                {step.photo_url ? <Button variant="outline" size="sm" onClick={() => setLightboxPhoto(getStepPhotoUrl(step.photo_url))} className="h-9 w-full text-xs">
                                    <Image className="h-3 w-3 mr-1" />
                                    Added
                                                                     </Button> : <StepPhotoUpload stepId={step.id} onPhotoUploaded={url => handlePhotoUploaded(step.id, url)} />}
                              </div>
                            </div>
                          </div>}

                        {/* Step Reference Photo */}
                        {step.photo_url && <div className="space-y-3">
                            <h4 className="font-semibold text-sm text-left text-gray-900 flex items-center gap-2">
                              <Image className="h-4 w-4 text-primary" />
                              Step Reference
                            </h4>
                            <div className="flex items-start gap-4 bg-gray-50/50 rounded-lg p-4 border border-gray-100">
                              <div className="relative cursor-pointer group rounded-lg overflow-hidden border-2 border-white shadow-sm w-32 h-24 shrink-0" onClick={() => {
                                setLightboxPhoto(getStepPhotoUrl(step.photo_url));
                                setLightboxStepId(step.id);
                              }}>
                                <img src={getStepPhotoUrl(step.photo_url)} alt={`Step ${dynamicStepNumber} reference`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                                  <Image className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                              {canEditContent && <div className="flex flex-col gap-2 w-28">
                                  <StepPhotoUpload stepId={step.id} onPhotoUploaded={url => handlePhotoUploaded(step.id, url)} className="h-9 w-full text-xs flex items-center justify-center" />
                                  <Button variant="outline" size="sm" onClick={() => handleRemoveStepPhoto(step.id)} className="h-9 w-full text-xs text-destructive hover:text-destructive flex items-center justify-center">
                                    <X className="h-3 w-3 mr-1" />
                                    Remove
                                  </Button>
                                </div>}
                            </div>
                          </div>}

                        {/* Step Question */}
                        {stepQuestion && <div className="space-y-3">
                            <h4 className="font-semibold text-sm text-left text-gray-900 flex items-center gap-2">
                              <HelpCircle className="h-4 w-4 text-primary" />
                              Step Question
                            </h4>
                            <QuestionRenderer question={stepQuestion} stepId={step.id} />
                          </div>}

                        {/* Tasks Section */}
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm text-left text-gray-900 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-primary" />
                            Tasks {completion.total > 0 && (
                              <Badge variant={completion.percentage === 100 ? 'default' : 'secondary'} className="text-xs">
                                {completion.completed}/{completion.total}
                              </Badge>
                            )}
                          </h4>
                          <TasksList 
                            stepId={step.id} 
                            tasks={tasks} 
                            canEdit={canEditContent} 
                            onTasksUpdate={tasks => handleTasksUpdate(step.id, tasks)} 
                            availableQuestions={allAvailableQuestions}
                            currentStepOrder={step.step_order}
                          />
                        </div>

                        {/* Next Step Button - shown when step is complete and there's a next step */}
                        {isStepComplete && nextIncompleteStep && (
                          <div className="mt-6 pt-4 border-t border-gray-200">
                            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-4">
                              <div className="flex items-center gap-3">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                                <div>
                               
                                  <p className="text-xs text-green-700">Ready to move to the next step</p>
                                </div>
                              </div>
                              <Button 
                                onClick={() => openNextIncompleteStep(step.id)}
                                className="bg-green-600 hover:bg-green-700 text-white"
                                size="sm"
                              >
                                <ArrowRight className="h-4 w-4 mr-1" />
                                Next Step
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </AccordionContent>
                  </Card>
                </div>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      {/* Photo Lightbox */}
      {lightboxPhoto && lightboxStepId && (
        <PhotoLightbox 
          isOpen={!!lightboxPhoto} 
          onClose={() => {
            setLightboxPhoto(null);
            setLightboxStepId(null);
          }} 
          photoUrl={lightboxPhoto}
          contextType="step"
          contextId={lightboxStepId}
          onPhotoUpdated={(newPhotoUrl) => {
            handlePhotoUploaded(lightboxStepId, newPhotoUrl);
            setLightboxPhoto(null);
            setLightboxStepId(null);
          }}
          contextData={(() => {
            const step = steps.find(s => s.id === lightboxStepId);
            return step ? {
              title: step.title,
              description: step.description
            } : undefined;
          })()}
        />
      )}
    </TooltipProvider>
  );
}
